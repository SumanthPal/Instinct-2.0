"""GET /posts: the dashboard's batch of recent posts per club."""

from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from instinct import server
from instinct.db.queries import SupabaseQueries

A = "11111111-1111-1111-1111-111111111111"
B = "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def client():
    return TestClient(server.app)


def fake_db(monkeypatch, posts=None, error=None):
    calls = []

    def get_recent_posts_by_club_ids(club_ids, limit):
        calls.append((club_ids, limit))
        if error:
            raise error
        return [dict(p) for p in posts or []]

    db = SimpleNamespace(get_recent_posts_by_club_ids=get_recent_posts_by_club_ids)
    monkeypatch.setattr(server, "get_db", lambda: db)
    return calls


def test_returns_posts_with_club_id_and_image_url(client, monkeypatch):
    monkeypatch.setenv("S3_PUBLIC_URL", "https://cdn.example")
    calls = fake_db(
        monkeypatch,
        posts=[
            {"id": "p1", "club_id": A, "image_path": "posts/acm/p1"},
            {"id": "p2", "club_id": B, "image_path": "NULL"},
        ],
    )
    response = client.get("/posts", params={"club_ids": f"{A},{B}"})
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    assert body["limit"] == server.POSTS_BATCH_DEFAULT_LIMIT == 6
    first, second = body["results"]
    assert first["club_id"] == A
    assert first["image_url"] == "https://cdn.example/posts/acm/p1.jpg"
    assert first["image_path"] == "posts/acm/p1.jpg"
    assert second["image_url"] is None and second["image_path"] is None
    assert calls == [([A, B], 6)]


def test_ids_are_normalised_and_deduplicated(client, monkeypatch):
    calls = fake_db(monkeypatch)
    response = client.get(
        "/posts", params={"club_ids": f" {A.upper()} ,{A},,{B}", "limit": 3}
    )
    assert response.status_code == 200
    assert calls == [([A, B], 3)]


@pytest.mark.parametrize(
    "params",
    [
        {"club_ids": "acm"},
        {"club_ids": f"{A},not-a-uuid"},
        {"club_ids": " , "},
        {
            "club_ids": ",".join(
                f"{i:08d}-0000-0000-0000-000000000000" for i in range(13)
            )
        },
    ],
)
def test_bad_ids_are_a_400(client, monkeypatch, params):
    calls = fake_db(monkeypatch)
    assert client.get("/posts", params=params).status_code == 400
    assert calls == []


@pytest.mark.parametrize(
    "params", [{}, {"club_ids": A, "limit": 0}, {"club_ids": A, "limit": 21}]
)
def test_missing_ids_or_out_of_range_limit_are_rejected(client, monkeypatch, params):
    calls = fake_db(monkeypatch)
    assert client.get("/posts", params=params).status_code == 422
    assert calls == []


def test_twelve_clubs_and_twenty_posts_are_allowed(client, monkeypatch):
    calls = fake_db(monkeypatch)
    ids = ",".join(f"{i:08d}-0000-0000-0000-000000000000" for i in range(12))
    assert (
        client.get("/posts", params={"club_ids": ids, "limit": 20}).status_code == 200
    )
    assert len(calls[0][0]) == 12 and calls[0][1] == 20


def test_database_error_is_a_500(client, monkeypatch):
    fake_db(monkeypatch, error=RuntimeError("boom"))
    response = client.get("/posts", params={"club_ids": A})
    assert response.status_code == 500


def recording_client(data):
    """A real PostgREST client whose HTTP requests are recorded, not sent."""
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json=data)

    http = httpx.Client(
        base_url="http://postgrest.test", transport=httpx.MockTransport(handler)
    )
    return SyncPostgrestClient("http://postgrest.test", http_client=http), requests


def test_query_is_one_request_with_a_per_club_limit():
    rows = [
        {
            "id": A,
            "posts": [
                {"id": "a2", "club_id": A, "posted": "2026-10-02T10:00:00"},
                {"id": "a1", "club_id": A, "posted": "2026-09-01T10:00:00"},
            ],
        },
        {
            "id": B,
            "posts": [
                {"id": "b1", "club_id": B, "posted": "2026-10-05T10:00:00"},
                {"id": "b0", "club_id": B, "posted": None},
            ],
        },
        {"id": "c", "posts": []},
    ]
    db = SupabaseQueries.__new__(SupabaseQueries)
    db.supabase, requests = recording_client(rows)

    posts = db.get_recent_posts_by_club_ids([A, B], 6)

    assert [p["id"] for p in posts] == ["b1", "a2", "a1", "b0"]
    (request,) = requests
    assert request.method == "GET"
    assert request.url.path.endswith("/clubs")
    params = dict(request.url.params)
    assert params["select"] == "id,posts(id,club_id,post_url,caption,image_path,posted)"
    assert params["id"] == f"in.({A},{B})"
    assert params["posts.order"] == "posted.desc,id.asc"
    assert params["posts.limit"] == "6"
