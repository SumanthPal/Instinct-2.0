"""GET /events: the date-range events endpoint for the calendar."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from instinct import server
from instinct.db.queries import SupabaseQueries

CLUBS = {
    "chess": [{"name": "Academic"}],
    "robotics": [{"name": "Academic"}, {"name": "Technology"}],
    "film": [{"name": "Arts & Culture"}],
    "nocat": [],
}


def event(i, day, handle, time="18:00:00"):
    return {
        "id": f"e{i:04d}",
        "club_id": f"c-{handle}",
        "name": f"Event {i}",
        "date": f"{day}T{time}",
        "clubs": {
            "id": f"c-{handle}",
            "name": handle.title(),
            "instagram_handle": handle,
            "profile_image_path": f"clubs/{handle}.jpg",
            "categories": list(CLUBS[handle]),
        },
    }


class EventsQuery:
    """Applies the filters get_events_in_range uses the way PostgREST would."""

    def __init__(self, client):
        self.client = client
        self.rows = [dict(r, clubs=dict(r["clubs"])) for r in client.rows]
        self.columns = None

    def select(self, columns):
        self.columns = columns
        return self

    def gte(self, column, value):
        assert column == "date"
        self.rows = [r for r in self.rows if r["date"] >= value]
        return self

    def lt(self, column, value):
        assert column == "date"
        self.rows = [r for r in self.rows if r["date"] < value]
        return self

    def in_(self, column, values):
        assert column == "clubs.instagram_handle"
        assert "clubs!inner(" in self.columns
        self.rows = [r for r in self.rows if r["clubs"]["instagram_handle"] in values]
        return self

    def eq(self, column, value):
        assert column == "category_filter.categories.name"
        assert "category_filter:clubs!inner(categories!inner(name))" in self.columns
        self.rows = [
            dict(r, category_filter={"categories": [{"name": value}]})
            for r in self.rows
            if {"name": value} in r["clubs"]["categories"]
        ]
        return self

    def order(self, column):
        self.client.orders.append(column)
        return self

    def range(self, start, end):
        self.client.ranges.append((start, end))
        self.window = (start, end + 1)
        return self

    def execute(self):
        rows = sorted(self.rows, key=lambda r: (r["date"], r["id"]))
        return SimpleNamespace(data=rows[self.window[0] : self.window[1]])


class EventsClient:
    def __init__(self, rows):
        self.rows = rows
        self.orders = []
        self.ranges = []

    def table(self, name):
        assert name == "events"
        return EventsQuery(self)


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setenv("S3_PUBLIC_URL", "https://cdn.test")

    def make(rows):
        db = SupabaseQueries.__new__(SupabaseQueries)
        db.supabase = EventsClient(rows)
        monkeypatch.setattr(server, "get_db", lambda: db)
        return TestClient(server.app), db.supabase

    return make


ROWS = [
    event(1, "2026-10-31", "chess", "23:59:59"),  # day before the range
    event(2, "2026-11-01", "film", "00:00:00"),  # date-only event, first day
    event(3, "2026-11-05", "robotics"),
    event(4, "2026-11-05", "chess"),
    event(5, "2026-11-30", "nocat", "23:59:59"),  # last moment of the last day
    event(6, "2026-12-01", "chess", "00:00:00"),  # day after the range
]


def test_range_is_inclusive_la_dates_ordered_by_date_then_id(api):
    client, _ = api(ROWS)
    response = client.get("/events", params={"from": "2026-11-01", "to": "2026-11-30"})
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 4
    assert [e["id"] for e in body["results"]] == ["e0002", "e0003", "e0004", "e0005"]


def test_rows_keep_campus_wide_shape_plus_club_categories(api):
    client, _ = api(ROWS)
    body = client.get(
        "/events", params={"from": "2026-11-05", "to": "2026-11-05"}
    ).json()
    robotics = body["results"][0]
    assert robotics["clubs"] == {
        "id": "c-robotics",
        "name": "Robotics",
        "instagram_handle": "robotics",
        "profile_image_path": "https://cdn.test/clubs/robotics.jpg",
    }
    assert robotics["categories"] == ["Academic", "Technology"]
    assert "category_filter" not in robotics


def test_club_without_categories_gets_empty_list(api):
    client, _ = api(ROWS)
    body = client.get(
        "/events", params={"from": "2026-11-30", "to": "2026-11-30"}
    ).json()
    assert body["results"][0]["categories"] == []


def test_clubs_filter_normalizes_handles(api):
    client, _ = api(ROWS)
    body = client.get(
        "/events",
        params={"from": "2026-11-01", "to": "2026-11-30", "clubs": " @Chess, FILM ,,"},
    ).json()
    assert [e["id"] for e in body["results"]] == ["e0002", "e0004"]


def test_category_filter_keeps_full_category_list(api):
    client, _ = api(ROWS)
    body = client.get(
        "/events",
        params={"from": "2026-11-01", "to": "2026-11-30", "category": "Technology"},
    ).json()
    assert [e["id"] for e in body["results"]] == ["e0003"]
    assert body["results"][0]["categories"] == ["Academic", "Technology"]
    assert "category_filter" not in body["results"][0]


def test_reads_past_the_row_cap_in_pages(api):
    rows = [event(i, "2026-11-10", "chess") for i in range(2500)]
    client, stub = api(rows)
    body = client.get(
        "/events", params={"from": "2026-11-10", "to": "2026-11-10"}
    ).json()
    assert body["count"] == 2500
    assert [e["id"] for e in body["results"]] == [f"e{i:04d}" for i in range(2500)]
    assert stub.ranges == [(0, 999), (1000, 1999), (2000, 2999)]
    assert stub.orders[:2] == ["date", "id"]


@pytest.mark.parametrize(
    "params, detail",
    [
        ({"from": "2026-11-02", "to": "2026-11-01"}, "`to` is before `from`"),
        (
            {"from": "2026-11-01", "to": "2027-02-01"},
            "Range is 93 days; the maximum is 92",
        ),
        (
            {"from": "2026-11-01", "to": "2026-11-30", "clubs": " , "},
            "`clubs` has no handles",
        ),
    ],
)
def test_bad_requests_are_400(api, params, detail):
    client, stub = api(ROWS)
    response = client.get("/events", params=params)
    assert response.status_code == 400
    assert response.json()["detail"] == detail
    assert stub.ranges == []


def test_92_day_range_is_allowed(api):
    client, _ = api(ROWS)
    response = client.get("/events", params={"from": "2026-11-01", "to": "2027-01-31"})
    assert response.status_code == 200


def test_too_many_clubs_is_400(api):
    client, _ = api(ROWS)
    handles = ",".join(f"club{i}" for i in range(101))
    response = client.get(
        "/events", params={"from": "2026-11-01", "to": "2026-11-30", "clubs": handles}
    )
    assert response.status_code == 400
    assert "maximum is 100" in response.json()["detail"]


@pytest.mark.parametrize(
    "params",
    [
        {"to": "2026-11-30"},
        {"from": "2026-11-01"},
        {"from": "11/01/2026", "to": "2026-11-30"},
        {"from": "2026-11-01", "to": "2026-02-30"},
    ],
)
def test_missing_or_malformed_dates_are_422(api, params):
    client, _ = api(ROWS)
    assert client.get("/events", params=params).status_code == 422
