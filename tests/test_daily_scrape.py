"""Offline tests for the scheduled scrape's daily cap and stop-for-the-day rule."""

import datetime
import json

import pytest

from instinct.tools import daily_scrape, scraper_rotation

TODAY = datetime.date.today().isoformat()


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

    monkeypatch.setenv("OPENAI_API_KEY", "test")
    monkeypatch.setattr(scraper_rotation, "EventParser", Boom)
    scraper_rotation.parse_events("acm.uci")


def test_no_openai_key_skips_events(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    def explode():
        raise AssertionError("should not construct EventParser")

    monkeypatch.setattr(scraper_rotation, "EventParser", explode)
    scraper_rotation.parse_events("acm.uci")
