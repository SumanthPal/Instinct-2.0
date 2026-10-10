"""Scheduled scrape: the clubs scraped longest ago, on one login, under a daily cap.

Meant to run a few times a day from launchd or cron on the machine that holds
the Instagram session (see scripts/launchd/). Each run:

- picks up to --clubs clubs ordered by last_scraped (never-scraped first),
- scrapes them on one browser session and one login via run_session, so the
  usual 15-45s wait between clubs and the 3-post cap still apply,
- sets last_scraped on every club it tried, so a broken club moves to the
  back of the line instead of being picked first forever,
- refreshes the post and event text that club search matches once at the
  end (not under --dry-run; a failure is logged and does not fail the run),
- never goes past --daily-cap clubs per calendar day, and
- after a challenge, checkpoint, rate limit or dead browser, stops and skips
  every remaining run that day. Any other error (CHROME_BIN unset, a locked
  Chrome profile, Supabase) fails only this run; the next run tries again.

Each run (not --dry-run) records itself in scrape_runs, is skipped while
scraper_state.paused is set, reads its waits and timeouts from scraper_state,
and ends cleanly after the current club on a stop or pause command. Only one
run uses Chrome at a time (a lock file); a run that finds it held exits 3.

A club with no new posts costs one profile load: only posts that are not
already scraped get opened.

--rescrape re-fetches the captions and images of posts already stored (the
newest 3 per club) for the handles given, or for the clubs due when none
are given. It skips the profile page, never parses events, does not move
last_scraped, and counts toward the daily cap like a normal scrape.

    uv run python -m instinct.tools.daily_scrape --clubs 50 --daily-cap 200
    uv run python -m instinct.tools.daily_scrape --rescrape swe.uci irvinerhosas
"""

import argparse
import datetime
import json
import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

from instinct.tools import scraper_control
from instinct.tools.logger import logger

BUSY = 3

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
    from instinct.db.queries import SupabaseQueries, _like_literal

    SupabaseQueries().supabase.table("clubs").update(
        {"last_scraped": datetime.datetime.now().isoformat()}
    ).ilike("instagram_handle", _like_literal(handle)).execute()


def notify(message: str) -> None:
    """Best-effort desktop notification on macOS; always logged."""
    logger.error(message)
    if platform.system() == "Darwin":
        script = (
            f'display notification {json.dumps(message)} with title "Instinct scraper"'
        )
        subprocess.run(["osascript", "-e", script], check=False)


def run(
    clubs: int,
    daily_cap: int,
    *,
    dry_run: bool,
    state_path: Path,
    rescrape: Optional[List[str]] = None,
) -> int:
    """One scheduled run. rescrape (a list, possibly empty) switches to
    re-fetching stored posts for those handles, or for the clubs due.
    Returns 0 ok or skipped, 1 failed, 2 stopped for the day, 3 busy."""
    with scraper_control.run_lock() as locked:
        if not locked:
            logger.info("Another scrape holds the lock; not starting.")
            return BUSY
        return _run_locked(
            clubs, daily_cap, dry_run=dry_run, state_path=state_path, rescrape=rescrape
        )


def _run_locked(
    clubs: int,
    daily_cap: int,
    *,
    dry_run: bool,
    state_path: Path,
    rescrape: Optional[List[str]],
) -> int:
    from instinct.tools.scraper_rotation import run_session

    control = scraper_control.get_state()
    if control.get("paused"):
        logger.info(f"Skipping: scraper paused since {control.get('paused_at')}.")
        return 0
    config = scraper_control.config_from_row(control)

    state = load_state(state_path, datetime.date.today().isoformat())
    if state["stopped"]:
        logger.info(f"Skipping: stopped earlier today ({state['stopped']}).")
        return 0
    budget = min(clubs, daily_cap - state["scraped"])
    if budget <= 0:
        logger.info(f"Daily cap of {daily_cap} reached; nothing to do.")
        return 0

    handles = rescrape[:budget] if rescrape else clubs_due(budget)
    logger.info(
        f"Scraping {len(handles)} club(s); {state['scraped']}/{daily_cap} done today."
    )

    run_id = None if dry_run else scraper_control.start_run()
    attempted: List[str] = []
    interrupted: List[str] = []

    def should_stop() -> Optional[str]:
        if dry_run:
            return None
        reason = scraper_control.interrupt_reason()
        if reason:
            interrupted.append(reason)
        return reason

    def finish(status: str, failed: List[str], error: Optional[str]) -> None:
        scraper_control.finish_run(
            run_id,
            status=status,
            clubs_attempted=len(attempted),
            clubs_failed=len(failed),
            error=error,
        )

    def on_attempted(handle: str) -> None:
        attempted.append(handle)
        if dry_run:
            return
        if rescrape is None:
            try:
                mark_scraped(handle)
            except Exception as exc:
                logger.error(f"Could not set last_scraped for {handle}: {exc}")
        state["scraped"] += 1
        save_state(state_path, state)

    try:
        failed, stopped = run_session(
            handles,
            dry_run=dry_run,
            rescrape=rescrape is not None,
            on_attempted=on_attempted,
            should_stop=should_stop,
            config=config,
        )
    except Exception as exc:
        # Not an Instagram stop, so the next scheduled run tries again.
        finish("failed", [], str(exc))
        notify(f"Scraper run failed (will retry next run): {exc}")
        return 1
    if stopped:
        state["stopped"] = stopped
        save_state(state_path, state)
        finish("stopped", failed, stopped)
        notify(f"Scraper stopped for today: {stopped}")
        return 2
    if interrupted:
        finish("stopped", failed, f"ended early: {interrupted[0]}")
    elif failed:
        status = "failed" if len(failed) == len(attempted) else "partial"
        finish(status, failed, f"failed: {', '.join(failed)}")
    else:
        finish("ok", failed, None)
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
    parser.add_argument(
        "--rescrape",
        nargs="*",
        metavar="INSTAGRAM_HANDLE",
        help=(
            "re-fetch captions and images of stored posts for these clubs (or "
            "the clubs due); no event parsing"
        ),
    )
    args = parser.parse_args()
    if args.clubs < 1 or args.daily_cap < 1:
        parser.error("--clubs and --daily-cap must be at least 1")
    if args.rescrape is not None and args.dry_run:
        parser.error("--rescrape cannot be combined with --dry-run")
    return run(
        args.clubs,
        args.daily_cap,
        dry_run=args.dry_run,
        state_path=STATE_PATH,
        rescrape=args.rescrape,
    )


if __name__ == "__main__":
    sys.exit(main())
