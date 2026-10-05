"""Paging and counts through the routes, with a stubbed Supabase client (#93)."""

from types import SimpleNamespace

from fastapi.testclient import TestClient

from instinct import server
from instinct.db.queries import SupabaseQueries

CLUB = {"id": "c1", "name": "ACM", "instagram_handle": "acm"}
POSTS = [
    {"id": f"p{i:02d}", "club_id": "c1", "posted": f"2026-04-{i:02d}T12:00:00"}
    for i in range(1, 26)
]
# Five clubs; the two Technology ones sort last, after the limit used below.
MANIFEST_CLUBS = [
    {"id": "1", "name": "A Chess", "categories": [{"name": "Academic"}]},
    {"id": "2", "name": "B Film", "categories": [{"name": "Arts"}]},
    {"id": "3", "name": "C Running", "categories": [{"name": "Sports"}]},
    {
        "id": "4",
        "name": "D Robotics",
        "categories": [{"name": "Academic"}, {"name": "Technology"}],
    },
    {"id": "5", "name": "E Hack", "categories": [{"name": "Technology"}]},
]
for club in MANIFEST_CLUBS:
    club.update(instagram_handle=club["name"].lower(), profile_image_path=None)


class StubQuery:
    """Applies select/eq/order/range/limit to rows the way PostgREST would."""

    def __init__(self, rows):
        self.rows = [dict(r) for r in rows]
        self.columns = "*"
        self.count = None
        self.filters = []
        self.window = None

    def select(self, columns, count=None):
        self.columns, self.count = columns, count
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def order(self, column, desc=False):
        self.rows.sort(key=lambda r: r[column], reverse=desc)
        return self

    def range(self, start, end):
        self.window = (start, end + 1)
        return self

    def limit(self, n):
        self.window = (0, n)
        return self

    def execute(self):
        rows = self.rows
        for column, value in self.filters:
            if column == "category_filter.name":
                # The !inner embed: keep only clubs with a matching category.
                assert "category_filter:categories!inner(name)" in self.columns
                rows = [r for r in rows if {"name": value} in r["categories"]]
            else:
                rows = [r for r in rows if r[column] == value]
        total = len(rows)
        if self.window:
            rows = rows[self.window[0] : self.window[1]]
        if "categories" not in self.columns:
            rows = [{k: v for k, v in r.items() if k != "categories"} for r in rows]
        return SimpleNamespace(
            data=rows, count=total if self.count == "exact" else None
        )


class StubClient:
    def __init__(self, tables=None, matches=None):
        self.tables = tables or {}
        self.matches = matches or []

    def table(self, name):
        return StubQuery(self.tables[name])

    def rpc(self, name, params):
        # search_clubs_paginated: one page, the full count on every row.
        assert name == "search_clubs_paginated"
        start = params["page_offset"]
        page = self.matches[start : start + params["page_limit"]]
        rows = [{**m, "total_count": len(self.matches)} for m in page]
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=rows))


def use_stub(monkeypatch, client):
    db = SupabaseQueries.__new__(SupabaseQueries)
    db.supabase = client
    monkeypatch.setattr(server, "get_db", lambda: db)
    return TestClient(server.app)


def test_smart_search_reports_the_full_match_count(monkeypatch):
    matches = [
        {"id": str(i), "name": f"Dance {i}", "profile_image_path": None}
        for i in range(62)
    ]
    api = use_stub(monkeypatch, StubClient(matches=matches))

    def page(n):
        r = api.get("/smart-search", params={"q": "dance", "page": n, "limit": 20})
        assert r.status_code == 200
        return r.json()

    first, last, past_end = page(1), page(4), page(5)
    assert (first["count"], first["hasMore"], len(first["results"])) == (62, True, 20)
    assert (last["count"], last["hasMore"], len(last["results"])) == (62, False, 2)
    assert (past_end["count"], past_end["hasMore"]) == (62, False)
    assert past_end["results"] == []
    assert "total_count" not in first["results"][0]


def test_posts_page_param_pages(monkeypatch):
    tables = {"clubs": [CLUB], "posts": POSTS}
    api = use_stub(monkeypatch, StubClient(tables=tables))

    def page(n):
        r = api.get("/club/acm/posts", params={"page": n, "limit": 10})
        assert r.status_code == 200
        return r.json()

    first, second, third = page(1), page(2), page(3)
    ids = [[p["id"] for p in body["results"]] for body in (first, second, third)]
    assert ids[0] == [f"p{i:02d}" for i in range(25, 15, -1)]  # newest first
    assert ids[1] == [f"p{i:02d}" for i in range(15, 5, -1)]
    assert ids[2] == [f"p{i:02d}" for i in range(5, 0, -1)]
    assert (first["total"], first["pages"], first["hasMore"]) == (25, 3, True)
    assert (third["count"], third["hasMore"]) == (5, False)
    assert api.get("/club/acm/posts", params={"page": 0}).status_code == 422


def test_manifest_filters_by_category_before_the_limit(monkeypatch):
    api = use_stub(monkeypatch, StubClient(tables={"clubs": MANIFEST_CLUBS}))

    with_categories = api.get(
        "/club-manifest",
        params={"category": "Technology", "limit": 2, "include_categories": True},
    ).json()
    assert [c["name"] for c in with_categories] == ["D Robotics", "E Hack"]
    # Each club keeps its full category list, not just the filtered one.
    assert with_categories[0]["categories"] == ["Academic", "Technology"]

    # Without include_categories the filter used to match nothing.
    plain = api.get(
        "/club-manifest", params={"category": "Technology", "limit": 2}
    ).json()
    assert [c["name"] for c in plain] == ["D Robotics", "E Hack"]
    assert "categories" not in plain[0]

    unfiltered = api.get("/club-manifest", params={"limit": 2}).json()
    assert [c["name"] for c in unfiltered] == ["A Chess", "B Film"]
