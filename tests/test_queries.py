"""SupabaseQueries logic behind the /club route, with a stubbed Supabase client."""

from types import SimpleNamespace

from fastapi.testclient import TestClient

from instinct import server
from instinct.db.queries import SupabaseQueries

# Shaped like PostgREST's answer for the seed's clubs with categories(name).
CLUBS = [
    {"id": "1", "name": "Example Chess Club", "categories": [{"name": "Academic"}]},
    {
        "id": "2",
        "name": "Example Robotics Team",
        "categories": [{"name": "Academic"}, {"name": "Technology"}],
    },
    {"id": "3", "name": "Example Film Society", "categories": [{"name": "Arts"}]},
]


class StubQuery:
    def select(self, *args, **kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=[dict(c) for c in CLUBS], count=None)


class StubClient:
    def table(self, name):
        assert name == "clubs"
        return StubQuery()

    def rpc(self, name, params):
        # What the repaired get_clubs_by_category_paginated returned: one page,
        # no count, and only the filtered category on each club.
        rows = [
            {**c, "categories": [{"name": params["category_name"]}]}
            for c in CLUBS
            if {"name": params["category_name"]} in c["categories"]
        ][params["page_offset"] : params["page_offset"] + params["page_limit"]]
        result = SimpleNamespace(data=rows, count=None)
        return SimpleNamespace(execute=lambda: result)


def test_list_clubs_by_category_counts_and_keeps_categories(monkeypatch):
    db = SupabaseQueries.__new__(SupabaseQueries)
    db.supabase = StubClient()
    monkeypatch.setattr(server, "get_db", lambda: db)

    response = TestClient(server.app).get(
        "/club", params={"category": "Academic", "limit": 1, "page": 1}
    )

    body = response.json()
    assert response.status_code == 200
    assert (body["total"], body["hasMore"], body["pages"]) == (2, True, 2)
    assert [c["name"] for c in body["results"]] == ["Example Chess Club"]

    page2 = TestClient(server.app).get(
        "/club", params={"category": "Academic", "limit": 1, "page": 2}
    )
    robotics = page2.json()["results"][0]
    assert page2.json()["hasMore"] is False
    assert robotics["categories"] == [{"name": "Academic"}, {"name": "Technology"}]
