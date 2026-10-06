"""Image URLs: a missing or "NULL" stored path means no image, everywhere."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from instinct import server
from instinct.db.queries import SupabaseQueries, with_cdn_image
from instinct.utils.images import cdn_url, image_key

CDN = "https://cdn.example"
NO_IMAGE = [None, "", "   ", "NULL", "null", " NULL ", "/NULL", 0]


@pytest.fixture(autouse=True)
def cdn(monkeypatch):
    monkeypatch.setenv("S3_PUBLIC_URL", CDN)


@pytest.mark.parametrize("path", NO_IMAGE)
def test_no_image_values(path):
    assert image_key(path) is None
    assert cdn_url(path) is None
    assert cdn_url(path, ".jpg") is None


@pytest.mark.parametrize(
    "path, extension, url",
    [
        ("pfps/acm.jpg", None, f"{CDN}/pfps/acm.jpg"),
        ("/pfps/acm.jpg", None, f"{CDN}/pfps/acm.jpg"),
        (" pfps/acm.jpg ", None, f"{CDN}/pfps/acm.jpg"),
        ("posts/acm/p1", ".jpg", f"{CDN}/posts/acm/p1.jpg"),
        ("posts/acm/p1.PNG", ".jpg", f"{CDN}/posts/acm/p1.PNG"),
        ("posts/acm/p1.webp", ".jpg", f"{CDN}/posts/acm/p1.webp"),
        # A real key that merely contains NULL is still an image.
        ("pfps/null_club.jpg", None, f"{CDN}/pfps/null_club.jpg"),
    ],
)
def test_cdn_url(path, extension, url):
    assert cdn_url(path, extension) == url


def test_cdn_url_reads_the_prefix_per_call(monkeypatch):
    monkeypatch.setenv("S3_PUBLIC_URL", "https://other.example")
    assert cdn_url("pfps/acm.jpg") == "https://other.example/pfps/acm.jpg"


def test_with_cdn_image():
    assert with_cdn_image({"profile_image_path": "NULL"}) == {
        "profile_image_path": None
    }
    assert with_cdn_image({"profile_image_path": None}) == {"profile_image_path": None}
    assert with_cdn_image({"profile_image_path": "pfps/a.jpg"}) == {
        "profile_image_path": f"{CDN}/pfps/a.jpg"
    }


def use_db(monkeypatch, **methods):
    monkeypatch.setattr(server, "get_db", lambda: SimpleNamespace(**methods))
    return TestClient(server.app)


def test_posts_route_returns_null_image_url_for_null_paths(monkeypatch):
    posts = [
        {"id": "p1", "image_path": "posts/acm/p1"},
        {"id": "p2", "image_path": "posts/acm/p2.png"},
        {"id": "p3", "image_path": "NULL"},
        {"id": "p4", "image_path": None},
        {"id": "p5", "image_path": ""},
    ]
    client = use_db(
        monkeypatch,
        get_club_by_instagram=lambda handle: {"id": "c1"},
        get_posts_by_club_id=lambda club_id, limit, offset: {
            "posts": [dict(p) for p in posts],
            "total": len(posts),
        },
    )

    results = client.get("/club/acm/posts").json()["results"]

    assert [(p["image_path"], p["image_url"]) for p in results] == [
        ("posts/acm/p1.jpg", f"{CDN}/posts/acm/p1.jpg"),
        ("posts/acm/p2.png", f"{CDN}/posts/acm/p2.png"),
        (None, None),
        (None, None),
        (None, None),
    ]


@pytest.mark.parametrize("path", ["NULL", None, ""])
def test_club_detail_without_image(monkeypatch, path):
    client = use_db(
        monkeypatch,
        get_club_by_instagram=lambda handle: {"id": "c1", "profile_image_path": path},
    )
    body = client.get("/club/acm").json()
    assert "profile_image_url" not in body
    assert body["profile_image_path"] is None


def test_club_detail_with_image(monkeypatch):
    client = use_db(
        monkeypatch,
        get_club_by_instagram=lambda handle: {
            "id": "c1",
            "profile_image_path": "pfps/acm.jpg",
        },
    )
    body = client.get("/club/acm").json()
    assert body["profile_image_url"] == f"{CDN}/pfps/acm.jpg"
    assert body["profile_image_path"] == "pfps/acm.jpg"


class ClubsQuery:
    """Enough of PostgREST for the club list and manifest queries."""

    ROWS = [
        {
            "id": "1",
            "name": "A",
            "instagram_handle": "a",
            "profile_image_path": "pfps/a.jpg",
        },
        {"id": "2", "name": "B", "instagram_handle": "b", "profile_image_path": "NULL"},
        {"id": "3", "name": "C", "instagram_handle": "c", "profile_image_path": None},
    ]

    def select(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def range(self, *args):
        return self

    def limit(self, n):
        return self

    def execute(self):
        return SimpleNamespace(data=[dict(r) for r in self.ROWS], count=len(self.ROWS))


def stub_queries():
    db = SupabaseQueries.__new__(SupabaseQueries)
    db.supabase = SimpleNamespace(table=lambda name: ClubsQuery())
    return db


def test_club_list_images():
    clubs = stub_queries().get_clubs_paginated(0, 10)["clubs"]
    assert [c["profile_image_path"] for c in clubs] == [f"{CDN}/pfps/a.jpg", None, None]


def test_manifest_profile_pic_keeps_empty_string_for_no_image():
    manifest = stub_queries().get_club_manifest_optimized(
        None, 10, "id, name, instagram_handle, profile_image_path"
    )
    assert [m["profile_pic"] for m in manifest] == [f"{CDN}/pfps/a.jpg", "", ""]
