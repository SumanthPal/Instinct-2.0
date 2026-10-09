"""Compare event-parser prompt variants on real captions. Read-only.

Runs the old prompt (free-form JSON, as shipped before the structured-output
change) and the current prompt (tools/ai_validation.py, strict json_schema)
over the same posts, optionally for several models, and prints per-variant
stats plus a few side-by-side differences. It never writes to the database.

    # 50 most recent captioned posts from Supabase (needs SUPABASE_URL,
    # SUPABASE_SECRET_KEY and the provider's key, META_API_KEY by default,
    # in the environment or .env):
    uv run python -m instinct.scripts.eval_event_parser

    # Same posts every run: save them once, then evaluate from the file.
    uv run python -m instinct.scripts.eval_event_parser --save-posts posts.json
    uv run python -m instinct.scripts.eval_event_parser --posts-file posts.json \\
        --prompts new --models muse-spark-1.2-contributor muse-spark-1.3-contributor

    # The same posts on OpenAI, to compare (one provider per run):
    EVENT_PROVIDER=openai uv run python -m instinct.scripts.eval_event_parser \\
        --posts-file posts.json --prompts new --models gpt-6-luna gpt-4.1-mini

    # Offline plumbing check: canned client and sample posts, no network.
    uv run python -m instinct.scripts.eval_event_parser --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from types import SimpleNamespace

from instinct.tools.ai_validation import (
    EventParseError,
    extract_events,
    get_event_model,
    get_event_provider,
    make_event_client,
    safe_int,
    starts_at_midnight,
)

# The production system prompt before the structured-output change, kept here
# (not in prod code) so the eval can compare against it.
OLD_SYSTEM_PROMPT = (
    "You must strictly follow these rules when responding:\n"
    "1. Respond with **valid, raw JSON only**. Do not include any text, comments, markdown, or extra formatting outside the JSON.\n"
    "2. The response must be a JSON array.\n"
    "3. If the input is not a valid club event (meaning the club does not have anything) or cannot be parsed, return an empty array: [].\n"
    "4. Each item in the array must be a dictionary with **exactly** the following keys:\n"
    '   - "Name": string (name of the event)\n'
    '   - "Date": string in ISO 8601 format (e.g., "2025-04-14T18:00:00")\n'
    '   - "Details": string (optional event information)\n'
    '   - "Duration": object with "days", "hours", and "minutes" keys\n'
    "5. If the event spans multiple dates, create one entry\n"
    "6. Do not include any additional metadata, explanations, or keys not listed above.\n"
    "7. Use the context date and the content to find the context date for the event."
)


def run_old(client, model, caption, posted):
    """The old request as parse_post sent it, minus temperature=0.3, which
    some models (e.g. gpt-6-luna) reject; both variants use the default."""
    completion = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": OLD_SYSTEM_PROMPT},
            {"role": "user", "content": f"{caption} context date: {posted}"},
        ],
    )
    events = json.loads(completion.choices[0].message.content)
    if not isinstance(events, list) or not all(isinstance(e, dict) for e in events):
        raise EventParseError("Invalid API response format")
    return events


def run_new(client, model, caption, posted):
    return extract_events(client, caption, posted, model=model)


PROMPTS = {"old": run_old, "new": run_new}

SAMPLE_POSTS = [
    {
        "id": "sample-range",
        "posted": "2026-10-01T03:15:00",
        "caption": "General meeting this Thursday 6-8pm in DBH 1100! Free pizza.",
    },
    {
        "id": "sample-start-only",
        "posted": "2026-10-02T18:00:00",
        "caption": "Join us for boba night on Friday at 7pm at the Anteater Plaza.",
    },
    {
        "id": "sample-all-day",
        "posted": "2026-10-03T20:00:00",
        "caption": "Our bake sale is on Ring Road next Tuesday, come say hi!",
    },
    {
        "id": "sample-recap",
        "posted": "2026-10-04T22:00:00",
        "caption": "Thank you to everyone who came out last week! See you soon.",
    },
]


class CannedClient:
    """Stands in for OpenAI in --dry-run: no network, deterministic replies.

    It finds the first "Npm"/"Nam" in the caption and returns one event the
    day after the post at that time (or all-day if there is none, unless the
    caption is a recap). The numbers it produces mean nothing; it exists to
    check the script runs end to end.
    """

    def __init__(self):
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, model, messages, response_format=None, **_):
        user = messages[-1]["content"]
        caption = user.split("Caption:\n", 1)[-1].split(" context date: ")[0]
        events = []
        if "thank you" not in caption.lower():
            day = datetime(2026, 10, 9)
            match = re.search(r"(\d{1,2})\s*(am|pm)", caption, re.I)
            hour = 0
            if match:
                hour = int(match.group(1)) % 12 + (12 if match.group(2) == "pm" else 0)
            new = response_format is not None
            events.append(
                {
                    "Name": caption.split("!")[0][:40],
                    "Date": (day + timedelta(hours=hour)).isoformat(),
                    "Details": "",
                    "Duration": {
                        "days": 1 if new and not match else 0,
                        "hours": 1 if new and match else 0,
                        "minutes": 0,
                    },
                }
            )
        content = json.dumps({"events": events} if response_format else events)
        message = SimpleNamespace(content=content, refusal=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def load_posts(args):
    if args.posts_file:
        with open(args.posts_file) as f:
            posts = json.load(f)
        return posts[: args.limit]
    if args.dry_run:
        return SAMPLE_POSTS[: args.limit]
    from instinct.db.queries import SupabaseQueries

    response = (
        SupabaseQueries()
        .supabase.table("posts")
        .select("id, caption, posted")
        .neq("caption", "")
        .order("posted", desc=True)
        .limit(args.limit)
        .execute()
    )
    return response.data or []


def duration_parts(event):
    raw = event.get("Duration")
    if not isinstance(raw, dict):
        raw = {}
    return tuple(safe_int(raw.get(k, 0)) for k in ("days", "hours", "minutes"))


def fmt_duration(parts):
    text = " ".join(f"{n}{u}" for n, u in zip(parts, "dhm") if n)
    return text or "0"


def run_variant(client, prompt, model, posts, workers):
    def one(post):
        started = time.monotonic()
        try:
            events = PROMPTS[prompt](client, model, post["caption"], post["posted"])
            error = None
        except (EventParseError, json.JSONDecodeError) as e:
            events, error = None, f"bad output: {e}"
        except Exception as e:
            events, error = None, f"api error: {type(e).__name__}: {e}"
        return {
            "post_id": post.get("id"),
            "events": events,
            "error": error,
            "seconds": round(time.monotonic() - started, 2),
        }

    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(one, posts))


def summarize(results):
    events = [e for r in results if r["events"] for e in r["events"]]
    zero = [e for e in events if not any(duration_parts(e))]
    midnight = [e for e in events if starts_at_midnight(e.get("Date"))]
    timed_zero = [e for e in zero if not starts_at_midnight(e.get("Date"))]
    all_day = [
        e
        for e in midnight
        if duration_parts(e)[0] > 0 and not any(duration_parts(e)[1:])
    ]

    def pct(part):
        return f"{100 * len(part) / len(events):.1f}%" if events else "-"

    return {
        "posts": len(results),
        "posts_with_events": sum(1 for r in results if r["events"]),
        "events": len(events),
        "zero_duration": pct(zero),
        "timed_zero_duration": pct(timed_zero),
        "midnight": pct(midnight),
        "all_day_midnight_whole_days": pct(all_day),
        "bad_output": sum(1 for r in results if (r["error"] or "").startswith("bad")),
        "api_errors": sum(1 for r in results if (r["error"] or "").startswith("api")),
    }


def print_summary(summaries):
    names = list(summaries)
    rows = list(next(iter(summaries.values())))
    width = max(len(r) for r in rows) + 2
    col = max(14, *(len(n) + 2 for n in names))
    print("".ljust(width) + "".join(n.rjust(col) for n in names))
    for row in rows:
        print(
            row.ljust(width) + "".join(str(summaries[n][row]).rjust(col) for n in names)
        )


def event_key(e):
    return (str(e.get("Date")), duration_parts(e))


def describe(result):
    if result["error"]:
        return [f"    ERROR {result['error'][:120]}"]
    if not result["events"]:
        return ["    (no events)"]
    return [
        f"    {e.get('Date')} | {fmt_duration(duration_parts(e))} | {e.get('Name')}"
        for e in result["events"]
    ]


def print_diffs(posts, runs, limit):
    names = list(runs)
    base = names[0]
    shown = 0
    for i, post in enumerate(posts):
        if shown >= limit:
            break
        keys = {
            n: sorted(map(event_key, runs[n][i]["events"] or []))
            if not runs[n][i]["error"]
            else "error"
            for n in names
        }
        if all(keys[n] == keys[base] for n in names):
            continue
        shown += 1
        caption = " ".join(str(post["caption"]).split())
        print(f"\n--- post {post.get('id')} (posted {post.get('posted')} UTC)")
        print(f"    {caption[:240]}{'...' if len(caption) > 240 else ''}")
        for n in names:
            print(f"  [{n}]")
            print("\n".join(describe(runs[n][i])))
    if not shown:
        print("\n(no differences between variants)")


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Compare event-parser prompts on real post captions. "
        "Read-only: never writes to the database.",
    )
    parser.add_argument("--limit", type=int, default=50, help="posts to evaluate")
    parser.add_argument(
        "--posts-file",
        help='JSON list of {"id", "caption", "posted" (UTC)} to use instead of Supabase',
    )
    parser.add_argument(
        "--save-posts", help="write the posts used to this JSON file, for reruns"
    )
    parser.add_argument(
        "--prompts",
        nargs="+",
        choices=list(PROMPTS),
        default=list(PROMPTS),
        help="prompt variants (default: old new)",
    )
    parser.add_argument(
        "--models",
        nargs="+",
        default=None,
        help="models to try (default: the EVENT_PROVIDER's model, "
        f"currently {get_event_model()})",
    )
    parser.add_argument("--diffs", type=int, default=5, help="side-by-side diffs")
    parser.add_argument("--workers", type=int, default=4, help="parallel requests")
    parser.add_argument("--out", help="write every variant's raw results to JSON")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="canned offline client and sample posts; checks the plumbing only",
    )
    args = parser.parse_args(argv)

    if args.dry_run:
        client = CannedClient()
    else:
        client = make_event_client()
        if client is None:
            key_env = get_event_provider()["key_env"]
            parser.error(f"{key_env} is not set (use --dry-run to test offline)")

    posts = [p for p in load_posts(args) if p.get("caption")]
    if not posts:
        print("no posts with captions found", file=sys.stderr)
        return 1
    if args.save_posts:
        with open(args.save_posts, "w") as f:
            json.dump(posts, f, indent=2, default=str)

    models = args.models or [get_event_model()]
    provider = "canned" if args.dry_run else get_event_provider()["name"]
    print(
        f"{len(posts)} posts, provider {provider}, prompts {args.prompts}, "
        f"models {models}"
        + (" (DRY RUN: canned client, numbers are meaningless)" if args.dry_run else "")
    )
    runs = {}
    for model in models:
        for prompt in args.prompts:
            name = f"{prompt}:{model}"
            started = time.monotonic()
            runs[name] = run_variant(client, prompt, model, posts, args.workers)
            print(f"  {name}: {time.monotonic() - started:.1f}s", file=sys.stderr)

    print("\nDurations are as the model returned them, before the parser's")
    print("1-hour / all-day fallback for a zero duration.\n")
    print_summary({name: summarize(results) for name, results in runs.items()})
    print_diffs(posts, runs, args.diffs)

    if args.out:
        with open(args.out, "w") as f:
            json.dump({"posts": posts, "runs": runs}, f, indent=2, default=str)
    return 0


if __name__ == "__main__":
    sys.exit(main())
