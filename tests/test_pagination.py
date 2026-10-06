"""Paging and counts through the routes, with a stubbed Supabase client (#93)."""

from types import SimpleNamespace

from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

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
        self.orders = []
        self.window = None

    def select(self, columns, count=None):
        self.columns, self.count = columns, count
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def ilike(self, column, pattern):
        # The club lookup escapes LIKE wildcards, so the pattern is a literal.
        literal = pattern.replace("\\_", "_").replace("\\%", "%")
        literal = literal.replace("\\\\", "\\")
        self.filters.append((column, ("ilike", literal.lower())))
        return self

    def order(self, column, desc=False):
        self.orders.append((column, desc))
        return self

    def range(self, start, end):
        self.window = (start, end + 1)
        return self

    def limit(self, n):
        self.window = (0, n)
        return self

    def execute(self):
        rows = self.rows
        self._raise_past_the_end()
        # Chained orders: the first is the primary key. Ties keep insertion
        # order, like an unordered scan.
        for column, desc in reversed(self.orders):
            rows.sort(key=lambda r: r[column], reverse=desc)
        for column, value in self.filters:
            if column == "category_filter.name":
                # The !inner embed: keep only clubs with a matching category.
                assert "category_filter:categories!inner(name)" in self.columns
                rows = [r for r in rows if {"name": value} in r["categories"]]
            elif isinstance(value, tuple) and value[0] == "ilike":
                rows = [r for r in rows if (r[column] or "").lower() == value[1]]
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

    def _raise_past_the_end(self):
        # PostgREST with count=exact: an offset past the last row is a 416.
        if self.count == "exact" and self.window and self.window[0] > 0:
            total = len([r for r in self.rows if self._keep(r)])
            if self.window[0] > total:
                raise APIError(
                    {
                        "code": "PGRST103",
                        "message": "Requested range not satisfiable",
                        "details": f"An offset of {self.window[0]} was requested, "
                        f"but there are only {total} rows.",
                        "hint": None,
                    }
                )

    def _keep(self, row):
        return all(row.get(c) == v for c, v in self.filters if not isinstance(v, tuple))


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


def test_posts_with_the_same_timestamp_page_by_id(monkeypatch):
    # Inserted out of id order, all posted at the same instant.
    same_time = [
        {"id": f"p{i:02d}", "club_id": "c1", "posted": "2026-04-01T12:00:00"}
        for i in (7, 3, 9, 1, 5, 2, 8, 4, 6, 10)
    ]
    tables = {"clubs": [CLUB], "posts": same_time}
    api = use_stub(monkeypatch, StubClient(tables=tables))

    pages = [
        [
            p["id"]
            for p in api.get(f"/club/acm/posts?page={n}&limit=4").json()["results"]
        ]
        for n in (1, 2, 3)
    ]
    assert pages == [
        ["p01", "p02", "p03", "p04"],
        ["p05", "p06", "p07", "p08"],
        ["p09", "p10"],
    ]


def test_paging_params_are_bounded(monkeypatch):
    tables = {"clubs": [CLUB], "posts": POSTS}
    api = use_stub(monkeypatch, StubClient(tables=tables, matches=[]))

    for path, extra in (("/smart-search", {"q": "dance"}), ("/club/acm/posts", {})):
        assert api.get(path, params={**extra, "page": 0}).status_code == 422
        assert api.get(path, params={**extra, "limit": 0}).status_code == 422
        assert api.get(path, params={**extra, "limit": 101}).status_code == 422
        assert api.get(path, params={**extra, "limit": 100}).status_code == 200


def test_posts_database_error_is_a_500_not_an_empty_page(monkeypatch):
    class BrokenPosts(StubQuery):
        def execute(self):
            raise RuntimeError("connection reset")

    class Client(StubClient):
        def table(self, name):
            return BrokenPosts([]) if name == "posts" else StubQuery([CLUB])

    api = use_stub(monkeypatch, Client())

    response = api.get("/club/acm/posts")
    assert response.status_code == 500
    assert "connection reset" in response.json()["message"]


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


def test_posts_page_past_the_end_is_empty_not_a_500(monkeypatch):
    # PostgREST answers offset == total with 206 [] and offset > total with a
    # 416 PGRST103 (count=exact). Both must be an empty 200 page.
    api = use_stub(monkeypatch, StubClient(tables={"clubs": [CLUB], "posts": POSTS}))
    limit = 5
    at_end = -(-len(POSTS) // limit) + 1  # first page with no rows

    for page in (at_end, at_end + 1):
        response = api.get("/club/acm/posts", params={"page": page, "limit": limit})
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["results"] == []
        assert body["total"] == len(POSTS)
        assert body["hasMore"] is False
