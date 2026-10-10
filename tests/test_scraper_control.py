"""Offline tests for scraper status and control: run rows, the pause flag,
stop/pause between clubs, settings fallback and clamping, the per-club
timeout, the run lock and the command runner."""

import time

import pytest

from instinct.tools import daily_scrape, scraper_commands, scraper_control
from instinct.tools import scraper_rotation

# The real helpers; conftest stubs them for every other test.
REAL = {
    name: getattr(scraper_control, name)
    for name in ("get_state", "start_run", "finish_run", "interrupt_reason")
}


class Result:
    def __init__(self, data):
        self.data = data


class Query:
    """A tiny stand-in for a supabase table query over in-memory rows."""

    def __init__(self, db, table):
        self.db, self.table, self.filters, self.op = db, table, [], ("select",)

    def select(self, *_):
        return self

    def insert(self, row):
        self.op = ("insert", row)
        return self

    def upsert(self, row):
        self.op = ("upsert", row)
        return self

    def update(self, fields):
        self.op = ("update", fields)
        return self

    def eq(self, column, value):
        self.filters.append(lambda r: r.get(column) == value)
        return self

    def in_(self, column, values):
        self.filters.append(lambda r: r.get(column) in values)
        return self

    def order(self, *_args, **_kw):
        return self

    def execute(self):
        rows = self.db.setdefault(self.table, [])
        kind = self.op[0]
        if kind == "insert":
            row = {"id": len(rows) + 1, **self.op[1]}
            rows.append(row)
            return Result([row])
        if kind == "upsert":
            existing = [r for r in rows if r["id"] == self.op[1]["id"]]
            if existing:
                existing[0].update(self.op[1])
            else:
                rows.append(dict(self.op[1]))
            return Result([self.op[1]])
        matched = [r for r in rows if all(f(r) for f in self.filters)]
        if kind == "update":
            for row in matched:
                row.update(self.op[1])
        return Result([dict(r) for r in matched])


@pytest.fixture
def db(monkeypatch):
    data = {}

    class Client:
        def table(self, name):
            return Query(data, name)

    for name, func in REAL.items():
        monkeypatch.setattr(scraper_control, name, func)
    monkeypatch.setattr(scraper_control, "_client", Client)
    return data


@pytest.fixture
def session(monkeypatch, tmp_path):
    """daily_scrape.run on a fake run_session that calls should_stop."""
    seen = {}

    def run_session(handles, *, dry_run, rescrape, on_attempted, should_stop, config):
        seen["config"] = config
        seen["handles"] = list(handles)
        failed = []
        for index, handle in enumerate(handles):
            if index and should_stop():
                break
            if handle.startswith("bad"):
                failed.append(handle)
            on_attempted(handle)
        return failed, seen.get("stop")

    monkeypatch.setattr(scraper_rotation, "run_session", run_session)
    monkeypatch.setattr(
        daily_scrape, "clubs_due", lambda n: [f"c{i}" for i in range(n)]
    )
    monkeypatch.setattr(daily_scrape, "mark_scraped", lambda h: None)
    monkeypatch.setattr(daily_scrape, "notify", lambda m: None)
    return seen, tmp_path / "state.json"


def run(state, clubs=3, **kw):
    return daily_scrape.run(clubs, 200, dry_run=False, state_path=state, **kw)


class Storage:
    def report(self):
        return ""


class Browser:
    """A fake InstagramScraper whose driver accepts a page-load timeout."""

    def __init__(self, *args):
        self._driver = self

    def set_page_load_timeout(self, seconds):
        self.page_load = seconds

    def login(self):
        pass

    def _driver_quit(self):
        pass


@pytest.fixture
def browser(monkeypatch):
    from instinct import storage
    from instinct.tools import insta_scraper

    made = []

    def make(*args):
        made.append(Browser())
        return made[-1]

    monkeypatch.setattr(insta_scraper, "InstagramScraper", make)
    monkeypatch.setattr(storage, "get_storage", Storage)
    monkeypatch.setattr(scraper_rotation, "driver_alive", lambda s: True)
    return made


# Settings ---------------------------------------------------------------


def test_missing_row_uses_defaults():
    assert scraper_control.config_from_row(None) == scraper_control.RunConfig()
    assert scraper_control.config_from_row({"paused": False}) == (
        scraper_control.RunConfig()
    )


def test_defaults_match_the_code_constants():
    from instinct.tools import insta_scraper

    config = scraper_control.RunConfig()
    assert (config.club_delay_min_seconds, config.club_delay_max_seconds) == (
        scraper_rotation.ONCE_CLUB_DELAY_SECONDS
    )
    assert config.page_load_timeout_seconds == insta_scraper.PAGE_LOAD_TIMEOUT_SECONDS
    assert config.max_posts_per_club == insta_scraper.MAX_POSTS_PER_CLUB


def test_settings_are_clamped():
    config = scraper_control.config_from_row(
        {
            "club_delay_min_seconds": 0,
            "club_delay_max_seconds": 10_000,
            "page_load_timeout_seconds": 1,
            "club_timeout_seconds": "nonsense",
            "max_posts_per_club": 50,
        }
    )
    assert config.club_delay_min_seconds == 5
    assert config.club_delay_max_seconds == 600
    assert config.page_load_timeout_seconds == 10
    assert config.club_timeout_seconds == 600  # unparseable -> default
    assert config.max_posts_per_club == 12
    assert scraper_control.config_from_row({"max_posts_per_club": 0}) == (
        scraper_control.RunConfig(max_posts_per_club=1)
    )


def test_max_wait_never_below_min():
    config = scraper_control.config_from_row(
        {"club_delay_min_seconds": 60, "club_delay_max_seconds": 20}
    )
    assert config.club_delay_max_seconds == 60


def test_unreadable_state_table_falls_back(monkeypatch):
    def boom():
        raise RuntimeError("relation scraper_state does not exist")

    monkeypatch.setattr(scraper_control, "get_state", REAL["get_state"])
    monkeypatch.setattr(scraper_control, "_client", boom)
    assert scraper_control.get_state() == {}


def test_run_reads_settings(db, session):
    seen, state = session
    db["scraper_state"] = [{"id": 1, "paused": False, "club_delay_max_seconds": 1}]
    run(state)
    assert seen["config"].club_delay_max_seconds == 15  # clamped up to min


def test_session_applies_settings(browser, monkeypatch):
    sleeps = []
    monkeypatch.setattr(scraper_rotation, "scrape_one", lambda *a, **k: None)
    monkeypatch.setattr(scraper_rotation.time, "sleep", sleeps.append)
    config = scraper_control.config_from_row(
        {
            "club_delay_min_seconds": 7,
            "club_delay_max_seconds": 7,
            "page_load_timeout_seconds": 20,
            "max_posts_per_club": 5,
        }
    )
    scraper_rotation.run_session(["a", "b"], dry_run=True, config=config)
    assert sleeps == [7]
    assert browser[0].page_load == 20
    assert browser[0].max_posts == 5


def test_scraper_slices_posts_by_max_posts():
    from instinct.tools import insta_scraper

    scraper = insta_scraper.InstagramScraper.__new__(insta_scraper.InstagramScraper)
    links = list(range(20))
    assert links[: getattr(scraper, "max_posts", insta_scraper.MAX_POSTS_PER_CLUB)] == [
        0,
        1,
        2,
    ]
    scraper.max_posts = 6
    assert len(links[: getattr(scraper, "max_posts", 3)]) == 6


# Run rows and pausing ---------------------------------------------------


def test_run_row_ok(db, session):
    _, state = session
    assert run(state) == 0
    (row,) = db["scrape_runs"]
    assert row["status"] == "ok" and row["clubs_attempted"] == 3
    assert row["clubs_failed"] == 0 and row["finished_at"]


def test_run_row_partial(db, session, monkeypatch):
    _, state = session
    monkeypatch.setattr(daily_scrape, "clubs_due", lambda n: ["c0", "bad1"])
    run(state)
    (row,) = db["scrape_runs"]
    assert row["status"] == "partial" and row["error"] == "failed: bad1"


def test_challenge_marks_run_stopped(db, session):
    seen, state = session
    seen["stop"] = "challenge page"
    assert run(state) == 2
    assert db["scrape_runs"][0]["status"] == "stopped"
    assert db["scrape_runs"][0]["error"] == "challenge page"


def test_paused_skips_run(db, session):
    seen, state = session
    db["scraper_state"] = [{"id": 1, "paused": True}]
    assert run(state) == 0
    assert "handles" not in seen and "scrape_runs" not in db


def test_stop_command_ends_run_after_current_club(db, session):
    _, state = session
    db["scraper_commands"] = [{"id": 7, "command": "stop", "status": "pending"}]
    run(state)
    row = db["scrape_runs"][0]
    assert row["status"] == "stopped" and row["clubs_attempted"] == 1
    assert row["error"] == "ended early: stop command"
    assert db["scraper_commands"][0]["status"] == "done"


def test_pause_command_ends_run_and_sets_flag(db, session):
    _, state = session
    db["scraper_commands"] = [{"id": 1, "command": "pause", "status": "pending"}]
    run(state)
    assert db["scraper_state"][0]["paused"] is True
    assert db["scrape_runs"][0]["clubs_attempted"] == 1


def test_dry_run_writes_no_run_row(db, session):
    _, state = session
    daily_scrape.run(2, 200, dry_run=True, state_path=state)
    assert "scrape_runs" not in db


# Lock and per-club timeout ----------------------------------------------


def test_lock_held_means_busy(session):
    _, state = session
    with scraper_control.run_lock() as locked:
        assert locked
        assert run(state) == daily_scrape.BUSY


def test_club_timeout_escapes_except_exception():
    with pytest.raises(scraper_control.ClubTimeout):
        with scraper_control.club_timeout(0.05):
            try:
                time.sleep(1)
            except Exception:
                pass


def test_timed_out_club_fails_and_run_continues(browser, monkeypatch):
    def scrape_one(scraper, handle, **kw):
        if handle == "slow":
            raise scraper_control.ClubTimeout("too slow")

    monkeypatch.setattr(scraper_rotation, "scrape_one", scrape_one)
    monkeypatch.setattr(scraper_rotation.time, "sleep", lambda s: None)
    attempted = []
    failed, stopped = scraper_rotation.run_session(
        ["slow", "fast"], dry_run=True, on_attempted=attempted.append
    )
    assert (failed, stopped) == (["slow"], None)
    assert attempted == ["slow", "fast"]


# Command runner ---------------------------------------------------------


@pytest.fixture
def runs(monkeypatch):
    calls = []
    result = {"code": 0}

    def fake_run(clubs, cap, *, dry_run, state_path, rescrape=None):
        calls.append(rescrape)
        return result["code"]

    monkeypatch.setattr(daily_scrape, "run", fake_run)
    return calls, result


def commands(db, *rows):
    db["scraper_commands"] = [
        {"id": i + 1, "status": "pending", **row} for i, row in enumerate(rows)
    ]
    return db["scraper_commands"]


def test_pause_and_resume(db):
    rows = commands(db, {"command": "pause"})
    scraper_commands.tick()
    assert db["scraper_state"][0]["paused"] is True
    assert db["scraper_state"][0]["paused_at"]
    assert rows[0]["status"] == "done"
    commands(db, {"command": "resume"})
    scraper_commands.tick()
    assert db["scraper_state"][0] == {"id": 1, "paused": False, "paused_at": None}


def test_run_now_and_rescrape(db, runs):
    calls, _ = runs
    rows = commands(
        db, {"command": "run_now"}, {"command": "rescrape", "handle": " acm.uci "}
    )
    scraper_commands.tick()
    assert calls == [None, ["acm.uci"]]
    assert [r["status"] for r in rows] == ["done", "done"]
    assert rows[0]["result"].startswith("run finished")


def test_busy_run_stays_pending(db, runs):
    _, result = runs
    result["code"] = daily_scrape.BUSY
    rows = commands(db, {"command": "run_now"})
    scraper_commands.tick()
    assert rows[0]["status"] == "pending"


def test_failed_run_is_reported(db, runs):
    _, result = runs
    result["code"] = 1
    rows = commands(db, {"command": "run_now"})
    scraper_commands.tick()
    assert rows[0]["status"] == "failed"


def test_bad_commands_fail(db, runs):
    rows = commands(db, {"command": "rescrape"}, {"command": "explode"})
    scraper_commands.tick()
    assert [r["status"] for r in rows] == ["failed", "failed"]
    assert runs[0] == []


def test_stop_without_a_run(db):
    rows = commands(db, {"command": "stop"})
    scraper_commands.tick()
    assert rows[0]["status"] == "done"
    assert rows[0]["result"] == "no run in progress"


def test_stop_during_a_run_is_left_for_the_run(db):
    rows = commands(db, {"command": "stop"})
    with scraper_control.run_lock():
        scraper_commands.tick()
    assert rows[0]["status"] == "pending"
