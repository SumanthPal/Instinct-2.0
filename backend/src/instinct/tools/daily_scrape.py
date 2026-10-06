"""Scheduled scrape: the clubs scraped longest ago, on one login, under a daily cap.

Meant to run a few times a day from launchd or cron on the machine that holds
the Instagram session (see scripts/launchd/). Each run:

- picks up to --clubs clubs ordered by last_scraped (never-scraped first),
- scrapes them on one browser session and one login via run_session, so the
  usual 30-90s wait between clubs and the 3-post cap still apply,
- sets last_scraped on every club it tried, so a broken club moves to the
  back of the line instead of being picked first forever,
- never goes past --daily-cap clubs per calendar day, and
- after a challenge, checkpoint, rate limit or dead browser, stops and skips
  every remaining run that day.

A club with no new posts costs one profile load: only posts that are not
already scraped get opened.

    uv run python -m instinct.tools.daily_scrape --clubs 50 --daily-cap 200
"""

import argparse
import datetime
import json
import os
import platform
import subprocess
import sys
from pathlib import Path

from instinct.tools.logger import logger

STATE_PATH = Path(
    os.getenv("SCRAPE_STATE_PATH", Path.home() / ".cache/instinct/daily_scrape.json")
)


def load_state(path: Path, today: str) -> dict:
    """Today's counters; a new day (or a missing or corrupt file) starts at zero."""
    try:
        state = json.loads(path.read_text())
    except OSError, ValueError:
        state = {}
    if state.get("date") != today:
        state = {"date": today, "scraped": 0, "stopped": None}
    return state


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state))


def clubs_due(limit: int) -> list:
    """Handles of the clubs scraped longest ago, never-scraped first."""
    from instinct.db.queries import SupabaseQueries

    rows = (
        SupabaseQueries()
        .supabase.table("clubs")
        .select("instagram_handle")
        .order("last_scraped", nullsfirst=True)
        .order("id")
        .limit(limit)
        .execute()
        .data
        or []
    )
    return [row["instagram_handle"] for row in rows if row.get("instagram_handle")]


def mark_scraped(handle: str) -> None:
    from instinct.db.queries import SupabaseQueries

    SupabaseQueries().supabase.table("clubs").update(
        {"last_scraped": datetime.datetime.now().isoformat()}
    ).ilike("instagram_handle", handle).execute()


def notify(message: str) -> None:
    """Best-effort desktop notification on macOS; always logged."""
    logger.error(message)
    if platform.system() == "Darwin":
        script = (
            f'display notification {json.dumps(message)} with title "Instinct scraper"'
        )
        subprocess.run(["osascript", "-e", script], check=False)


def run(clubs: int, daily_cap: int, *, dry_run: bool, state_path: Path) -> int:
    from instinct.tools.scraper_rotation import run_session

    state = load_state(state_path, datetime.date.today().isoformat())
    if state["stopped"]:
        logger.info(f"Skipping: stopped earlier today ({state['stopped']}).")
        return 0
    budget = min(clubs, daily_cap - state["scraped"])
    if budget <= 0:
        logger.info(f"Daily cap of {daily_cap} reached; nothing to do.")
        return 0

    handles = clubs_due(budget)
    logger.info(
        f"Scraping {len(handles)} club(s); {state['scraped']}/{daily_cap} done today."
    )

    def on_attempted(handle: str) -> None:
        if dry_run:
            return
        try:
            mark_scraped(handle)
        except Exception as exc:
            logger.error(f"Could not set last_scraped for {handle}: {exc}")
        state["scraped"] += 1
        save_state(state_path, state)

    failed, stopped = run_session(handles, dry_run=dry_run, on_attempted=on_attempted)
    if stopped:
        state["stopped"] = stopped
        save_state(state_path, state)
        notify(f"Scraper stopped for today: {stopped}")
        return 2
    logger.info(
        f"Done: {len(handles) - len(failed)} ok, {len(failed)} failed; "
        f"{state['scraped']}/{daily_cap} today."
    )
    return 0


def main() -> int:
    import dotenv

    dotenv.load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--clubs", type=int, default=50, help="clubs this run (default 50)"
    )
    parser.add_argument(
        "--daily-cap",
        type=int,
        default=int(os.getenv("SCRAPE_DAILY_CAP", "200")),
        help="clubs per calendar day across runs (default $SCRAPE_DAILY_CAP or 200)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="scrape without writing anything"
    )
    args = parser.parse_args()
    if args.clubs < 1 or args.daily_cap < 1:
        parser.error("--clubs and --daily-cap must be at least 1")
    return run(args.clubs, args.daily_cap, dry_run=args.dry_run, state_path=STATE_PATH)


if __name__ == "__main__":
    sys.exit(main())
