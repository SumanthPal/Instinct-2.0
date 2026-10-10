"""Run pending scraper_commands; meant to run every minute from a timer.

    uv run python -m instinct.tools.scraper_commands

Commands, oldest first:
- pause / resume: set scraper_state.paused. Scheduled runs skip while paused
  and a run in progress ends after its current club.
- stop: ends a run in progress after its current club (the run itself picks
  it up between clubs); with no run going it is marked done with a note.
- run_now: a normal scheduled run (daily_scrape --clubs 50) right away.
- rescrape <handle>: daily_scrape --rescrape for that handle.

Only one run uses Chrome at a time. If a run holds the lock, run_now and
rescrape stay pending for the next tick. A command is claimed with one
conditional update (pending -> running), so two runners never take the same
one; then its status (done, failed) and result are written back.
"""

import sys

from instinct.tools import daily_scrape, scraper_control
from instinct.tools.logger import logger

RUN_CLUBS = 50
RUN_RESULTS = {
    0: (
        "done",
        "run finished (or skipped: paused, stopped for today or daily cap reached)",
    ),
    1: ("failed", "run failed; see scrape_runs and the scraper log"),
    2: ("done", "Instagram stopped the run; skipping the rest of today"),
}


def _daily_cap() -> int:
    import os

    return int(os.getenv("SCRAPE_DAILY_CAP", "200"))


def _busy() -> bool:
    with scraper_control.run_lock() as locked:
        return not locked


def run_command(command: dict) -> None:
    """Claim (pending -> running) and handle one command."""
    kind, command_id = command.get("command"), command["id"]
    if kind in ("stop", "run_now", "rescrape") and _busy():
        return  # a run is going: it takes stops itself; runs wait a tick
    if not scraper_control.claim_command(command_id):
        return  # another runner, or the run, took it
    if kind in ("pause", "resume"):
        scraper_control.set_paused(kind == "pause")
        scraper_control.update_command(command_id, "done", f"{kind}d")
        return
    if kind == "stop":
        scraper_control.update_command(command_id, "done", "no run in progress")
        return
    if kind == "rescrape" and not (command.get("handle") or "").strip():
        scraper_control.update_command(command_id, "failed", "rescrape needs a handle")
        return
    if kind not in ("run_now", "rescrape"):
        scraper_control.update_command(
            command_id, "failed", f"unknown command {kind!r}"
        )
        return

    try:
        code = daily_scrape.run(
            RUN_CLUBS,
            _daily_cap(),
            dry_run=False,
            state_path=daily_scrape.STATE_PATH,
            rescrape=[command["handle"].strip()] if kind == "rescrape" else None,
            trigger="command",
        )
    except Exception as exc:
        scraper_control.update_command(command_id, "failed", str(exc))
        return
    if code == daily_scrape.BUSY:
        scraper_control.update_command(command_id, "pending", "waiting for a run")
        return
    status, result = RUN_RESULTS.get(code, ("failed", f"exit code {code}"))
    scraper_control.update_command(command_id, status, result)


def tick() -> int:
    """Handle every pending command once. Returns how many were seen."""
    commands = scraper_control.pending_commands()
    for command in commands:
        try:
            run_command(command)
        except Exception as exc:
            logger.error(f"Command {command.get('id')} failed: {exc}")
            scraper_control.update_command(command["id"], "failed", str(exc))
    return len(commands)


def main() -> int:
    import dotenv

    dotenv.load_dotenv()
    tick()
    return 0


if __name__ == "__main__":
    sys.exit(main())
