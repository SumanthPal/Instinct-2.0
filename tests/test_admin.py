"""Admin routes, POST /reports and the /mcp wrapper; no network or database."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from instinct import admin, server

TOKEN = "test-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
CLUB_ID = "00000000-0000-0000-0000-000000000001"
PENDING_ID = "00000000-0000-0000-0000-0000000000aa"
REPORT_ID = "00000000-0000-0000-0000-0000000000bb"


class FakeSupabase:
    """Chainable stand-in for the supabase client.

    `responses[table]` is a list of data payloads returned by successive
    execute() calls on that table; every call chain is recorded in `calls`.
    """

    def __init__(self, responses=None, error=None):
        self.responses = {k: list(v) for k, v in (responses or {}).items()}
        self.error = error
        self.calls = []

    def table(self, name):
        fake = self
        ops = []
        fake.calls.append((name, ops))

        class Query:
            def __getattr__(self, op):
                def method(*args, **kwargs):
                    ops.append((op, args))
                    return self

                return method

            @property
            def not_(self):
                ops.append(("not_", ()))
                return self

            def execute(self):
                if fake.error:
                    raise fake.error
                queue = fake.responses.get(name) or [[]]
                return SimpleNamespace(
                    data=queue.pop(0) if len(queue) > 1 else queue[0]
                )

        return Query()


@pytest.fixture
def fake(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_TOKEN", TOKEN)
    admin._report_hits.clear()
    db = FakeSupabase()
    monkeypatch.setattr(admin, "supabase", db)
    return db


@pytest.fixture
def client():
    return TestClient(server.app)


def report(**overrides):
    body = {
        "kind": "club",
        "category": "wrong_info",
        "club_id": CLUB_ID,
        "page_url": "https://instincts.one/club/acm.uci",
        "note": "Meeting room moved",
    }
    return body | overrides


# --- auth ---------------------------------------------------------------------


@pytest.mark.parametrize(
    "path", ["/admin/pending-clubs", "/admin/flagged-clubs", "/admin/reports"]
)
def test_admin_requires_token(client, fake, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.get(path, headers=AUTH).status_code == 200


def test_admin_disabled_without_env(client, fake, monkeypatch):
    monkeypatch.delenv("INTERNAL_API_TOKEN")
    assert client.get("/admin/reports", headers=AUTH).status_code == 503


def test_old_unauthenticated_pending_list_is_gone(client, fake):
    assert client.get("/pending-clubs").status_code == 404


# --- clubs --------------------------------------------------------------------


def test_approve_inserts_club_with_categories_and_deletes_pending(client, fake):
    fake.responses = {
        "pending_clubs": [
            [
                {
                    "id": PENDING_ID,
                    "name": "ACM",
                    "instagram_handle": "acm.uci",
                    "categories": [{"name": "Tech"}, {"name": "Nope"}],
                }
            ],
            [],
        ],
        "clubs": [[{"id": CLUB_ID, "name": "ACM", "instagram_handle": "acm.uci"}]],
        "categories": [[{"id": "cat-tech"}]],
    }
    r = client.post(f"/admin/pending-clubs/{PENDING_ID}/approve", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["id"] == CLUB_ID
    ops = {(t, op[0]): op[1] for t, chain in fake.calls for op in chain}
    # Only name + handle: last_scraped stays NULL so the next scrape takes it first.
    assert ops[("clubs", "insert")] == ({"name": "ACM", "instagram_handle": "acm.uci"},)
    assert ops[("categories", "in_")] == ("name", ["Tech", "Nope"])
    assert ops[("clubs_categories", "insert")] == (
        [{"club_id": CLUB_ID, "category_id": "cat-tech"}],
    )
    assert ("pending_clubs", "delete") in ops


def test_approve_missing_pending_is_404(client, fake):
    r = client.post(f"/admin/pending-clubs/{PENDING_ID}/approve", headers=AUTH)
    assert r.status_code == 404


def test_reject_deletes_pending(client, fake):
    fake.responses = {"pending_clubs": [[{"id": PENDING_ID}]]}
    r = client.post(f"/admin/pending-clubs/{PENDING_ID}/reject", headers=AUTH)
    assert r.status_code == 200
    assert fake.calls[0][1][0] == ("delete", ())


def test_flagged_clubs_filters_on_handle_error(client, fake):
    fake.responses = {"clubs": [[{"id": CLUB_ID, "handle_error": "not found"}]]}
    r = client.get("/admin/flagged-clubs", headers=AUTH)
    assert r.json() == [{"id": CLUB_ID, "handle_error": "not found"}]
    assert ("is_", ("handle_error", "null")) in fake.calls[0][1]


def test_set_handle_normalizes_clears_error_and_requeues(client, fake):
    fake.responses = {"clubs": [[{"id": CLUB_ID, "instagram_handle": "acmuci"}]]}
    r = client.post(
        f"/admin/clubs/{CLUB_ID}/handle",
        json={"instagram_handle": " @ACMUCI "},
        headers=AUTH,
    )
    assert r.status_code == 200
    assert fake.calls[0][1][0] == (
        "update",
        ({"instagram_handle": "acmuci", "handle_error": None, "last_scraped": None},),
    )
    assert fake.calls[0][1][1] == ("eq", ("id", CLUB_ID))


def test_set_handle_unknown_club_is_404_and_blank_is_422(client, fake):
    url = f"/admin/clubs/{CLUB_ID}/handle"
    assert (
        client.post(url, json={"instagram_handle": "x"}, headers=AUTH).status_code
        == 404
    )
    assert (
        client.post(url, json={"instagram_handle": " @ "}, headers=AUTH).status_code
        == 422
    )
    assert client.post(url, json={"instagram_handle": "x"}).status_code == 401


# --- reports ------------------------------------------------------------------


def test_list_reports_includes_category(client, fake):
    row = {"id": REPORT_ID, "category": "broken_image", "status": "open"}
    fake.responses = {"reports": [[row]]}
    r = client.get("/admin/reports", params={"status": "open"}, headers=AUTH)
    assert r.json() == [row]
    assert ("eq", ("status", "open")) in fake.calls[0][1]
    assert (
        client.get("/admin/reports", params={"status": "x"}, headers=AUTH).status_code
        == 422
    )


def test_resolve_report(client, fake):
    fake.responses = {"reports": [[{"id": REPORT_ID, "status": "resolved"}]]}
    r = client.post(f"/admin/reports/{REPORT_ID}/resolve", headers=AUTH)
    assert r.json()["status"] == "resolved"
    assert fake.calls[0][1][0] == ("update", ({"status": "resolved"},))


def test_create_report_is_public_and_stores_payload(client, fake):
    fake.responses = {"reports": [[{"id": REPORT_ID}]]}
    body = report(
        kind="event", category="wrong_time_place", event_id=REPORT_ID, email="a@uci.edu"
    )
    r = client.post("/reports", json=body)
    assert r.status_code == 201
    assert r.json() == {"id": REPORT_ID}
    assert fake.calls[0][1][0] == ("insert", (body,))


@pytest.mark.parametrize(
    "overrides",
    [
        {"kind": "post"},
        {"category": "spam"},
        {"category": None},
        {"club_id": "not-a-uuid"},
        {"note": ""},
        {"email": "nope"},
    ],
)
def test_create_report_validation(client, fake, overrides):
    assert client.post("/reports", json=report(**overrides)).status_code == 422


def test_create_report_accepts_every_category(client, fake):
    fake.responses = {"reports": [[{"id": REPORT_ID}]]}
    for cat in [
        "wrong_info",
        "wrong_time_place",
        "wrong_instagram",
        "broken_image",
        "other",
    ]:
        admin._report_hits.clear()
        assert client.post("/reports", json=report(category=cat)).status_code == 201


def test_create_report_unknown_club_is_400(client, fake):
    fake.error = APIError({"code": "23503", "message": "fk"})
    assert client.post("/reports", json=report()).status_code == 400


def test_create_report_rate_limited_per_ip(client, fake):
    fake.responses = {"reports": [[{"id": REPORT_ID}]]}
    ip_a = {"X-Forwarded-For": "6.6.6.6, 1.1.1.1"}
    for _ in range(admin.REPORT_LIMIT):
        assert client.post("/reports", json=report(), headers=ip_a).status_code == 201
    assert client.post("/reports", json=report(), headers=ip_a).status_code == 429
    # Spoofed leading entry doesn't dodge the limit; a different real IP does.
    assert (
        client.post(
            "/reports", json=report(), headers={"X-Forwarded-For": "9.9.9.9, 1.1.1.1"}
        ).status_code
        == 429
    )
    assert (
        client.post(
            "/reports", json=report(), headers={"X-Forwarded-For": "2.2.2.2"}
        ).status_code
        == 201
    )


def test_reports_cors_preflight(client):
    r = client.options(
        "/reports",
        headers={
            "Origin": "https://instincts.one",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "https://instincts.one"


# --- MCP ----------------------------------------------------------------------

MCP_HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}


def rpc(method, params=None, id=1):
    return {"jsonrpc": "2.0", "id": id, "method": method, "params": params or {}}


def test_mcp_requires_token(fake):
    with TestClient(server.app) as c:
        assert (
            c.post("/mcp", json=rpc("tools/list"), headers=MCP_HEADERS).status_code
            == 401
        )


def test_mcp_lists_only_admin_tools_and_calls_one(fake):
    fake.responses = {"clubs": [[{"id": CLUB_ID, "instagram_handle": "acmuci"}]]}
    with TestClient(server.app) as c:
        h = MCP_HEADERS | AUTH
        init = c.post(
            "/mcp",
            json=rpc(
                "initialize",
                {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "0"},
                },
            ),
            headers=h,
        )
        assert init.status_code == 200, init.text
        tools = c.post("/mcp", json=rpc("tools/list", id=2), headers=h).json()[
            "result"
        ]["tools"]
        assert sorted(t["name"] for t in tools) == [
            "approve_pending_club",
            "list_flagged_clubs",
            "list_pending_clubs",
            "list_reports",
            "reject_pending_club",
            "resolve_report",
            "set_club_handle",
        ]
        r = c.post(
            "/mcp",
            json=rpc(
                "tools/call",
                {
                    "name": "set_club_handle",
                    "arguments": {"club_id": CLUB_ID, "instagram_handle": "@AcmUci"},
                },
                id=3,
            ),
            headers=h,
        )
        assert r.status_code == 200, r.text
        assert r.json()["result"]["isError"] is False
        assert fake.calls[0][1][0][1][0]["instagram_handle"] == "acmuci"
