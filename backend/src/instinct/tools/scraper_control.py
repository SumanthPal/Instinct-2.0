"""Status and control for the scraper, through three tables backend owns.

- scrape_runs: one row per run (started_at, finished_at, status ok, failed,
  partial or stopped, clubs_attempted, clubs_failed, posts_added, error).
- scraper_state: a single row (id true) with the pause flag (paused, paused_at)
  and run settings: the wait between clubs, the page-load timeout, the
  per-club timeout and the posts opened per club. Missing rows or columns
  fall back to the defaults below, and every value is clamped to BOUNDS so
  a typo cannot hang or hammer.
- scraper_commands: pause, resume, stop, run_now and rescrape <handle>,
  picked up by instinct.tools.scraper_commands and between clubs.

Every helper here is best effort: a control-table failure is logged and never
fails a scrape, so the scraper keeps working before backend's migration lands.
"""

import contextlib
import datetime
import fcntl
import os
import signal
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, List, Optional

from instinct.tools.logger import logger

RUNS = "scrape_runs"
STATE = "scraper_state"
COMMANDS = "scraper_commands"
STATE_ID = True  # scraper_state has one row, id = true

LOCK_PATH = Path(
    os.getenv("SCRAPE_LOCK_PATH", Path.home() / ".cache/instinct/scraper.lock")
)

# scraper_state column -> (RunConfig field, default, low, high). Defaults are
# the values the code used before these settings existed (the per-club
# timeout is new); the bounds match the table's check constraints. When the
# row is present its values win (the table defaults the wait to 30-90s).
BOUNDS = {
    "club_delay_min_s": ("club_delay_min_seconds", 15, 5, 600),
    "club_delay_max_s": ("club_delay_max_seconds", 45, 5, 600),
    "page_load_timeout_s": ("page_load_timeout_seconds", 30, 10, 120),
    "club_timeout_s": ("club_timeout_seconds", 300, 60, 1800),
    "max_posts_per_club": ("max_posts_per_club", 3, 1, 12),
}


@dataclass(frozen=True)
class RunConfig:
    club_delay_min_seconds: float = 15
    club_delay_max_seconds: float = 45
    page_load_timeout_seconds: float = 30
    club_timeout_seconds: float = 300
    max_posts_per_club: int = 3


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _client():
    from instinct.db.queries import SupabaseQueries

    return SupabaseQueries().supabase


def config_from_row(row: Optional[dict]) -> RunConfig:
    """Settings from a scraper_state row, defaulted and clamped."""
    row = row or {}
    values = {}
    for column, (field, default, low, high) in BOUNDS.items():
        value = row.get(column)
        try:
            value = float(value) if value is not None else default
        except TypeError, ValueError:
            value = default
        if value != value:  # NaN
            value = default
        values[field] = min(max(value, low), high)
    if values["club_delay_max_seconds"] < values["club_delay_min_seconds"]:
        values["club_delay_max_seconds"] = values["club_delay_min_seconds"]
    values["max_posts_per_club"] = int(values["max_posts_per_club"])
    return RunConfig(**values)


def get_state() -> dict:
    """The scraper_state row, or {} when it (or the table) is missing."""
    try:
        rows = (
            _client().table(STATE).select("*").eq("id", STATE_ID).execute().data or []
        )
        return rows[0] if rows else {}
    except Exception as exc:
        logger.error(f"Could not read {STATE}; using defaults: {exc}")
        return {}


def set_paused(paused: bool) -> None:
    now = _now()
    _client().table(STATE).upsert(
        {
            "id": STATE_ID,
            "paused": paused,
            "paused_at": now if paused else None,
            "updated_at": now,
        }
    ).execute()


def start_run(trigger: str = "scheduled") -> Optional[str]:
    """Insert a running scrape_runs row; trigger is scheduled, command or
    manual."""
    try:
        rows = (
            _client()
            .table(RUNS)
            .insert({"started_at": _now(), "status": "running", "trigger": trigger})
            .execute()
            .data
        )
        return rows[0]["id"] if rows else None
    except Exception as exc:
        logger.error(f"Could not record the run start in {RUNS}: {exc}")
        return None


def finish_run(run_id: Optional[str], **fields) -> None:
    if run_id is None:
        return
    try:
        _client().table(RUNS).update({"finished_at": _now(), **fields}).eq(
            "id", run_id
        ).execute()
    except Exception as exc:
        logger.error(f"Could not record the run result in {RUNS}: {exc}")


def pending_commands(kinds: Optional[List[str]] = None) -> List[dict]:
    """Pending commands, oldest first."""
    try:
        query = _client().table(COMMANDS).select("*").eq("status", "pending")
        if kinds:
            query = query.in_("command", kinds)
        return query.order("created_at").order("id").execute().data or []
    except Exception as exc:
        logger.error(f"Could not read {COMMANDS}: {exc}")
        return []


def claim_command(command_id) -> bool:
    """pending -> running in one conditional update; False when another
    runner (or the run itself) took it first."""
    try:
        rows = (
            _client()
            .table(COMMANDS)
            .update({"status": "running", "started_at": _now()})
            .eq("id", command_id)
            .eq("status", "pending")
            .execute()
            .data
        )
        return bool(rows)
    except Exception as exc:
        logger.error(f"Could not claim command {command_id}: {exc}")
        return False


def update_command(command_id, status: str, result: Optional[str] = None) -> None:
    fields = {"status": status, "result": result}
    if status == "running":
        fields["started_at"] = _now()
    elif status in ("done", "failed"):
        fields["finished_at"] = _now()
    try:
        _client().table(COMMANDS).update(fields).eq("id", command_id).execute()
    except Exception as exc:
        logger.error(f"Could not update command {command_id}: {exc}")


def interrupt_reason() -> Optional[str]:
    """Checked between clubs: a pending stop or pause command (marked done
    here) or the paused flag ends the run after the current club."""
    for command in pending_commands(["stop", "pause"]):
        if not claim_command(command["id"]):
            continue
        if command["command"] == "pause":
            try:
                set_paused(True)
            except Exception as exc:
                logger.error(f"Could not set the pause flag: {exc}")
        update_command(command["id"], "done", "run ended after the current club")
        return f"{command['command']} command"
    if get_state().get("paused"):
        return "paused"
    return None


@contextlib.contextmanager
def run_lock(path: Path = None) -> Iterator[bool]:
    """Yields True when this process holds the one-Chrome-at-a-time lock,
    False when another run holds it. Released when the process exits."""
    path = path or LOCK_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            yield False
            return
        try:
            yield True
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


class ClubTimeout(BaseException):
    """A club ran past its hard timeout. A BaseException so the scraper's
    many `except Exception` blocks cannot swallow it."""


@contextlib.contextmanager
def club_timeout(seconds: float) -> Iterator[None]:
    """Raise ClubTimeout after seconds (SIGALRM; main thread only, a no-op
    elsewhere)."""
    if (
        not hasattr(signal, "SIGALRM")
        or threading.current_thread() is not threading.main_thread()
    ):
        yield
        return

    def expire(signum, frame):
        raise ClubTimeout(f"club took longer than {seconds:.0f}s")

    previous = signal.signal(signal.SIGALRM, expire)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)
