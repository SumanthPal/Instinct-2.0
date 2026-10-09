"""Offline tests for the scheduled scrape's daily cap and stop-for-the-day rule."""

import datetime
import json

import pytest

from instinct.tools import daily_scrape, scraper_rotation

TODAY = datetime.date.today().isoformat()
REAL_REFRESH = scraper_rotation.refresh_search_content


@pytest.fixture
def fake(monkeypatch, tmp_path):
    calls = {"due": None, "session": None, "marked": [], "notes": []}
    result = {"failed": [], "stopped": None, "error": None}

    def clubs_due(limit):
        calls["due"] = limit
        return [f"club{i}" for i in range(limit)]

    def run_session(handles, *, dry_run, on_attempted):
        calls["session"] = list(handles)
        if result["error"]:
            raise result["error"]
        for handle in handles:
            on_attempted(handle)
        return result["failed"], result["stopped"]

    monkeypatch.setattr(daily_scrape, "clubs_due", clubs_due)
    monkeypatch.setattr(daily_scrape, "mark_scraped", calls["marked"].append)
    monkeypatch.setattr(daily_scrape, "notify", calls["notes"].append)
    monkeypatch.setattr(scraper_rotation, "run_session", run_session)
    return calls, result, tmp_path / "state.json"


def test_run_counts_and_marks(fake):
    calls, _, state = fake
    assert daily_scrape.run(3, 200, dry_run=False, state_path=state) == 0
    assert calls["marked"] == ["club0", "club1", "club2"]
    assert json.loads(state.read_text()) == {
        "date": TODAY,
        "scraped": 3,
        "stopped": None,
    }


def test_daily_cap_limits_the_batch(fake):
    calls, _, state = fake
    state.write_text(json.dumps({"date": TODAY, "scraped": 198, "stopped": None}))
    daily_scrape.run(50, 200, dry_run=False, state_path=state)
    assert calls["due"] == 2


def test_cap_reached_does_nothing(fake):
    calls, _, state = fake
    state.write_text(json.dumps({"date": TODAY, "scraped": 200, "stopped": None}))
    assert daily_scrape.run(50, 200, dry_run=False, state_path=state) == 0
    assert calls["session"] is None


def test_new_day_resets(fake):
    calls, _, state = fake
    state.write_text(json.dumps({"date": "2000-01-01", "scraped": 200, "stopped": "x"}))
    daily_scrape.run(5, 200, dry_run=False, state_path=state)
    assert calls["due"] == 5


def test_stop_skips_rest_of_day(fake):
    calls, result, state = fake
    result["stopped"] = "challenge page"
    assert daily_scrape.run(3, 200, dry_run=False, state_path=state) == 2
    assert json.loads(state.read_text())["stopped"] == "challenge page"
    calls["session"] = None
    assert daily_scrape.run(3, 200, dry_run=False, state_path=state) == 0
    assert calls["session"] is None


def test_other_error_fails_run_but_not_the_day(fake):
    calls, result, state = fake
    result["error"] = RuntimeError("CHROME_BIN is unset")
    assert daily_scrape.run(3, 200, dry_run=False, state_path=state) == 1
    assert "CHROME_BIN is unset" in calls["notes"][0]
    assert not state.exists()
    result["error"] = None
    assert daily_scrape.run(3, 200, dry_run=False, state_path=state) == 0
    assert json.loads(state.read_text())["stopped"] is None


def test_mark_scraped_escapes_wildcards(monkeypatch):
    from instinct.db import queries

    seen = []

    class Table:
        def update(self, values):
            return self

        def ilike(self, column, pattern):
            seen.append(pattern)
            return self

        def execute(self):
            pass

    class Queries:
        supabase = type("Client", (), {"table": lambda self, name: Table()})()

    monkeypatch.setattr(queries, "SupabaseQueries", Queries)
    daily_scrape.mark_scraped("acm_uci")
    assert seen == ["acm\\_uci"]


def test_crashed_browser_stops_session(monkeypatch):
    from selenium.common.exceptions import InvalidSessionIdException

    from instinct.tools import insta_scraper

    class CrashedDriver:
        """A driver whose Chrome died: every attribute or call raises."""

        def __getattr__(self, name):
            raise InvalidSessionIdException("invalid session id")

    # The real scraper methods (get_club_info, safe_get_page) on a dead
    # driver, without starting Chrome or logging in.
    scraper = insta_scraper.InstagramScraper.__new__(insta_scraper.InstagramScraper)
    scraper._driver = CrashedDriver()
    scraper.login = lambda: None
    sleeps = []
    attempted = []
    monkeypatch.setattr(insta_scraper, "InstagramScraper", lambda *args: scraper)
    monkeypatch.setattr(scraper_rotation, "ONCE_CLUB_DELAY_SECONDS", (999, 999))
    monkeypatch.setattr(scraper_rotation.time, "sleep", sleeps.append)
    failed, stopped = scraper_rotation.run_session(
        ["a", "b", "c"], dry_run=True, on_attempted=attempted.append
    )
    assert (failed, stopped) == ([], "browser died")
    assert attempted == []
    assert 999 not in sleeps  # never waited for the next club
    assert scraper._driver is None


def test_dry_run_writes_nothing(fake):
    calls, _, state = fake
    daily_scrape.run(3, 200, dry_run=True, state_path=state)
    assert calls["marked"] == []
    assert not state.exists()


def test_corrupt_state_starts_fresh(tmp_path):
    path = tmp_path / "state.json"
    path.write_text("{not json")
    assert daily_scrape.load_state(path, TODAY) == {
        "date": TODAY,
        "scraped": 0,
        "stopped": None,
    }


class FakeScraper:
    def __init__(self, ok=True):
        self.ok = ok

    def store_club_data(self, handle):
        return self.ok


def test_successful_scrape_parses_events(monkeypatch):
    parsed = []
    monkeypatch.setattr(scraper_rotation, "parse_events", parsed.append)
    scraper_rotation.scrape_one(FakeScraper(), "acm.uci", dry_run=False)
    assert parsed == ["acm.uci"]


def test_failed_scrape_skips_events(monkeypatch):
    parsed = []
    monkeypatch.setattr(scraper_rotation, "parse_events", parsed.append)
    with pytest.raises(RuntimeError):
        scraper_rotation.scrape_one(FakeScraper(ok=False), "acm.uci", dry_run=False)
    assert parsed == []


def test_event_errors_never_fail_the_scrape(monkeypatch):
    class Boom:
        def parse_all_posts(self, handle):
            raise RuntimeError("openai down")

    monkeypatch.delenv("EVENT_PROVIDER", raising=False)
    monkeypatch.setenv("META_API_KEY", "test")
    monkeypatch.setattr(scraper_rotation, "EventParser", Boom)
    scraper_rotation.parse_events("acm.uci")


def test_out_of_credit_stops_parsing_for_the_rest_of_the_run(monkeypatch, caplog):
    from instinct.tools.ai_validation import QuotaExhausted

    calls = []

    class OutOfCredit:
        def parse_all_posts(self, handle):
            calls.append(handle)
            raise QuotaExhausted("credit_balance_exhausted")

    monkeypatch.delenv("EVENT_PROVIDER", raising=False)
    monkeypatch.setenv("META_API_KEY", "test")
    monkeypatch.setattr(scraper_rotation, "EventParser", OutOfCredit)
    monkeypatch.setattr(scraper_rotation, "_parsing_stopped", None)

    for handle in ("acm.uci", "hack.uci", "wics.uci"):
        scraper_rotation.parse_events(handle)

    assert calls == ["acm.uci"]  # later clubs are scraped but not parsed
    stops = [r for r in caplog.records if "out of credit" in r.getMessage()]
    assert len(stops) == 1


def test_no_event_api_key_skips_events(monkeypatch):
    monkeypatch.delenv("EVENT_PROVIDER", raising=False)
    monkeypatch.delenv("META_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")  # not the parsing key

    def explode():
        raise AssertionError("should not construct EventParser")

    monkeypatch.setattr(scraper_rotation, "EventParser", explode)
    scraper_rotation.parse_events("acm.uci")


@pytest.fixture
def session(monkeypatch, tmp_path):
    """The real daily run and run_session on a fake browser, recording steps."""
    from instinct import storage
    from instinct.tools import insta_scraper

    steps = []

    class Browser:
        _driver = object()

        def __init__(self, *args):
            pass

        def login(self):
            steps.append("login")

        def store_club_data(self, handle):
            steps.append(f"store {handle}")
            return True

        def get_club_info(self, handle):
            steps.append(f"fetch {handle}")
            return {"Club Name": handle, "Recent Posts": []}

        def _driver_quit(self):
            steps.append("quit")

    class Storage:
        def report(self):
            return "storage report"

    def refresh():
        steps.append("refresh")
        return True

    monkeypatch.setattr(insta_scraper, "InstagramScraper", Browser)
    monkeypatch.setattr(storage, "get_storage", Storage)
    monkeypatch.setattr(scraper_rotation.time, "sleep", lambda s: None)
    monkeypatch.setattr(
        scraper_rotation, "parse_events", lambda h: steps.append(f"parse {h}")
    )
    monkeypatch.setattr(scraper_rotation, "refresh_search_content", refresh)
    monkeypatch.setattr(
        daily_scrape, "clubs_due", lambda n: [f"club{i}" for i in range(n)]
    )
    monkeypatch.setattr(daily_scrape, "mark_scraped", lambda h: None)
    return steps, Browser, tmp_path / "state.json"


def test_daily_run_refreshes_search_once_after_parsing(session):
    steps, _, state = session
    assert daily_scrape.run(2, 200, dry_run=False, state_path=state) == 0
    assert steps == [
        "login",
        "store club0",
        "parse club0",
        "store club1",
        "parse club1",
        "quit",
        "refresh",
    ]


def test_daily_dry_run_skips_search_refresh(session):
    steps, _, state = session
    assert daily_scrape.run(2, 200, dry_run=True, state_path=state) == 0
    assert steps == ["login", "fetch club0", "fetch club1", "quit"]


def test_once_refreshes_search(session):
    steps, _, _ = session
    assert scraper_rotation.run_once(["acm.uci"]) is True
    assert steps.count("refresh") == 1 and steps[-1] == "refresh"


def test_no_refresh_when_no_club_was_tried(session):
    steps, Browser, state = session

    def login(self):
        raise scraper_rotation.InstagramLoginError("challenge")

    Browser.login = login
    assert daily_scrape.run(2, 200, dry_run=False, state_path=state) == 2
    assert "refresh" not in steps


def test_refresh_failure_does_not_fail_the_scrape(session, monkeypatch):
    from instinct.db import queries

    steps, _, state = session

    class Rpc:
        def execute(self):
            raise RuntimeError("supabase down")

    class Client:
        def rpc(self, name):
            steps.append(f"rpc {name}")
            return Rpc()

    class Queries:
        supabase = Client()

    monkeypatch.setattr(queries, "SupabaseQueries", Queries)
    # The real refresh (the fixture stubs it), against a failing RPC.
    monkeypatch.setattr(scraper_rotation, "refresh_search_content", REAL_REFRESH)
    assert daily_scrape.run(1, 200, dry_run=False, state_path=state) == 0
    assert steps[-1] == "rpc refresh_club_search_vector"
    assert REAL_REFRESH() is False


def test_each_run_starts_with_parsing_enabled(session, monkeypatch):
    # A previous run in the same process ran out of credit; a new run (after a
    # top-up) tries parsing again.
    monkeypatch.setattr(scraper_rotation, "_parsing_stopped", "out of credit")
    assert scraper_rotation.run_once(["acm.uci"]) is True
    assert scraper_rotation._parsing_stopped is None
