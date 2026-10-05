"""GET /club/{handle} must not return the club's search vectors (#92)."""

from types import SimpleNamespace

from fastapi.testclient import TestClient

from instinct import server
from instinct.db.queries import SupabaseQueries

# Every column of public.clubs, as select("*") would return it.
ROW = {
    "id": "1",
    "name": "ACM",
    "instagram_handle": "acm",
    "profile_pic": None,
    "description": "Computing club",
    "updated_at": "2026-04-20T04:52:28",
    "followers": 10,
    "following": 2,
    "club_links": [],
    "last_scraped": "2026-04-20T04:52:28",
    "search_vector": "'acm':1A 'comput':2B",
    "profile_image_path": "pfps/acm.jpg",
    "embedding": [0.01] * 1536,
    "needs_embedding_update": False,
    "last_embedding_update": "2026-04-20T04:52:28",
}


class StubQuery:
    """Answers like PostgREST: only the selected columns come back."""

    def __init__(self):
        self.columns = None

    def select(self, columns, **kwargs):
        self.columns = columns
        return self

    def eq(self, column, value):
        return self

    def execute(self):
        if self.columns.strip() == "*":
            row = dict(ROW)
        else:
            wanted = [c.strip() for c in self.columns.split(",")]
            missing = set(wanted) - ROW.keys()
            assert not missing, f"not a clubs column: {missing}"
            row = {c: ROW[c] for c in wanted}
        return SimpleNamespace(data=[row], count=None)


class StubClient:
    def table(self, name):
        assert name == "clubs"
        return StubQuery()


def test_club_detail_omits_embedding_and_search_vector(monkeypatch):
    db = SupabaseQueries.__new__(SupabaseQueries)
    db.supabase = StubClient()
    monkeypatch.setattr(server, "get_db", lambda: db)
    monkeypatch.setenv("S3_PUBLIC_URL", "https://cdn.example")

    response = TestClient(server.app).get("/club/acm")

    body = response.json()
    assert response.status_code == 200
    assert "embedding" not in body
    assert "search_vector" not in body
    # Everything else the page uses is still there.
    assert body["name"] == "ACM"
    assert body["description"] == "Computing club"
    assert (body["followers"], body["following"]) == (10, 2)
    assert body["profile_image_url"] == "https://cdn.example/pfps/acm.jpg"
