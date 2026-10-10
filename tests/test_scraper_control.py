"""/status, scraper run log, command queue and config; no network or database."""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from instinct import admin, server
from test_admin import AUTH, TOKEN, FakeSupabase

NOW = datetime(2026, 10, 10, 16, 0, tzinfo=timezone.utc)
CONFIG = {
    "club_delay_min_s": 30,
    "club_delay_max_s": 90,
    "page_load_timeout_s": 30,
    "club_timeout_s": 300,
    "max_posts_per_club": 3,
}


@pytest.fixture
def fake(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_TOKEN", TOKEN)
    db = FakeSupabase()
    monkeypatch.setattr(admin, "supabase", db)
    return db


@pytest.fixture
def client():
    return TestClient(server.app)


def ops(fake, table):
    return [op for t, chain in fake.calls if t == table for op in chain]


# --- /status --------------------------------------------------------------------


def run(started, status="ok", finished=None):
    return {
        "started_at": started,
        "finished_at": finished,
        "status": status,
        "clubs_attempted": 50,
        "clubs_failed": 2,
        "posts_added": 7,
    }


def status_with(fake, last, good, state):
    fake.responses = {"scrape_runs": [last, good], "scraper_state": [state]}
    return admin.scraper_status(now=NOW)


def test_status_fresh(fake):
    last = run("2026-10-10T14:00:00+00:00", "partial", "2026-10-10T14:30:00+00:00")
    s = status_with(fake, [last], [last], [{"paused": False, "paused_at": None}])
    assert s == {
        "last_run": last,
        "last_success_at": "2026-10-10T14:30:00+00:00",
        "paused": False,
        "paused_at": None,
        "stale": False,
    }
    assert ("in_", ("status", ["ok", "partial"])) in ops(fake, "scrape_runs")


def test_status_stale_after_8h_of_failures(fake):
    failed = run("2026-10-10T15:00:00+00:00", "failed")
    good = run("2026-10-10T07:00:00Z", "ok", "2026-10-10T07:30:00Z")
    s = status_with(fake, [failed], [good], [{"paused": False, "paused_at": None}])
    assert s["stale"] is True
    assert s["last_run"]["status"] == "failed"


def test_status_never_run_is_stale_unless_paused(fake):
    assert status_with(fake, [], [], [{"paused": False}])["stale"] is True
    s = status_with(fake, [], [], [{"paused": True, "paused_at": "2026-10-09T00:00Z"}])
    assert s["stale"] is False and s["paused"] is True
    assert s["paused_at"] == "2026-10-09T00:00Z"


def test_status_route_public_and_no_error_text(client, fake, monkeypatch):
    monkeypatch.delenv("INTERNAL_API_TOKEN")
    fake.responses = {
        "scrape_runs": [[run("2026-10-10T15:00:00Z", "failed")], []],
        "scraper_state": [[{"paused": False, "paused_at": None}]],
    }
    r = client.get("/status")
    assert r.status_code == 200
    assert "error" not in r.json()["last_run"]
    select_cols = [op[1][0] for op in ops(fake, "scrape_runs") if op[0] == "select"]
    assert all("error" not in c and c != "*" for c in select_cols)


# --- run log --------------------------------------------------------------------


def test_list_scrape_runs(client, fake):
    fake.responses = {"scrape_runs": [[{"id": "r1"}]]}
    r = client.get("/admin/scrape-runs", params={"limit": 5}, headers=AUTH)
    assert r.json() == [{"id": "r1"}]
    assert ("order", ("started_at",)) in ops(fake, "scrape_runs")
    assert ("limit", (5,)) in ops(fake, "scrape_runs")
    assert client.get("/admin/scrape-runs").status_code == 401


# --- commands -------------------------------------------------------------------


def test_send_rescrape_normalizes_and_checks_club(client, fake):
    fake.responses = {
        "clubs": [[{"id": "c1"}]],
        "scraper_commands": [[{"id": "k1", "command": "rescrape"}]],
    }
    r = client.post(
        "/admin/scraper/commands",
        json={"command": "rescrape", "handle": " @ACM.UCI "},
        headers=AUTH,
    )
    assert r.status_code == 201, r.text
    assert ("eq", ("instagram_handle", "acm.uci")) in ops(fake, "clubs")
    assert ("insert", ({"command": "rescrape", "handle": "acm.uci"},)) in ops(
        fake, "scraper_commands"
    )


def test_rescrape_unknown_club_404_missing_handle_422(client, fake):
    url = "/admin/scraper/commands"
    r = client.post(url, json={"command": "rescrape", "handle": "nope"}, headers=AUTH)
    assert r.status_code == 404
    assert (
        client.post(url, json={"command": "rescrape"}, headers=AUTH).status_code == 422
    )
    assert not ops(fake, "scraper_commands")


def test_send_simple_commands_and_validation(client, fake):
    fake.responses = {"scraper_commands": [[{"id": "k1"}]]}
    url = "/admin/scraper/commands"
    for cmd in ("pause", "resume", "stop", "run_now"):
        assert client.post(url, json={"command": cmd}, headers=AUTH).status_code == 201
    assert client.post(url, json={"command": "rm"}, headers=AUTH).status_code == 422
    r = client.post(url, json={"command": "pause", "handle": "x"}, headers=AUTH)
    assert r.status_code == 422
    assert client.post(url, json={"command": "pause"}).status_code == 401
    with pytest.raises(ValueError):
        admin.send_scraper_command("drop_tables")


def test_list_scraper_commands_filter(client, fake):
    fake.responses = {"scraper_commands": [[{"id": "k1", "status": "pending"}]]}
    url = "/admin/scraper/commands"
    r = client.get(url, params={"status": "pending"}, headers=AUTH)
    assert r.json() == [{"id": "k1", "status": "pending"}]
    assert ("eq", ("status", "pending")) in ops(fake, "scraper_commands")
    assert client.get(url, params={"status": "x"}, headers=AUTH).status_code == 422


# --- config ---------------------------------------------------------------------


def test_get_config_admin_only(client, fake):
    fake.responses = {"scraper_state": [[CONFIG]]}
    assert client.get("/admin/scraper/config", headers=AUTH).json() == CONFIG
    assert client.get("/admin/scraper/config").status_code == 401


def test_set_config_partial(client, fake):
    fake.responses = {"scraper_state": [[CONFIG], [CONFIG | {"club_timeout_s": 600}]]}
    r = client.patch(
        "/admin/scraper/config", json={"club_timeout_s": 600}, headers=AUTH
    )
    assert r.status_code == 200, r.text
    assert r.json()["club_timeout_s"] == 600
    update = [op for op in ops(fake, "scraper_state") if op[0] == "update"][0]
    assert set(update[1][0]) == {"club_timeout_s", "updated_at"}


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"club_delay_min_s": 4},
        {"club_delay_max_s": 601},
        {"page_load_timeout_s": 9},
        {"page_load_timeout_s": 121},
        {"club_timeout_s": 59},
        {"club_timeout_s": 1801},
        {"max_posts_per_club": 0},
        {"max_posts_per_club": 13},
        {"club_delay_min_s": 100},  # > current max of 90
        {"club_delay_min_s": 60, "club_delay_max_s": 40},
    ],
)
def test_set_config_rejects_bad_values(client, fake, body):
    fake.responses = {"scraper_state": [[CONFIG]]}
    r = client.patch("/admin/scraper/config", json=body, headers=AUTH)
    assert r.status_code == 400, body
    assert not [op for op in ops(fake, "scraper_state") if op[0] == "update"]


def test_config_not_in_status(client, fake):
    fake.responses = {"scrape_runs": [[], []], "scraper_state": [[{"paused": False}]]}
    assert not set(CONFIG) & set(client.get("/status").json())
