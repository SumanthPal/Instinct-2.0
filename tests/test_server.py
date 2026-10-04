"""Smoke tests for the public API routes; no network, secrets or database."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from instinct import server

CLUB = {"id": 1, "instagram_handle": "acm", "profile_image_path": "pfps/acm.jpg"}


@pytest.fixture
def client():
    return TestClient(server.app)


def fake_db(monkeypatch, **methods):
    """Replace get_db() so routes never construct a real Supabase client."""
    monkeypatch.setattr(server, "get_db", lambda: SimpleNamespace(**methods))


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_list_clubs_paginates(client, monkeypatch):
    calls = []

    def get_clubs_paginated(offset, limit, category):
        calls.append((offset, limit, category))
        return {"total": 3, "clubs": [CLUB, CLUB]}

    fake_db(monkeypatch, get_clubs_paginated=get_clubs_paginated)
    response = client.get("/club", params={"page": 1, "limit": 2})
    assert response.status_code == 200
    assert response.json()["hasMore"] is True
    assert response.json()["pages"] == 2
    assert calls == [(0, 2, None)]


def test_get_club_not_found(client, monkeypatch):
    fake_db(monkeypatch, get_club_by_instagram=lambda handle: None)
    assert client.get("/club/nope").status_code == 404


def test_get_club_image_url_uses_s3_public_url(client, monkeypatch):
    monkeypatch.delenv("GCP_URL", raising=False)
    monkeypatch.setenv("S3_PUBLIC_URL", "https://cdn.example")
    fake_db(monkeypatch, get_club_by_instagram=lambda handle: dict(CLUB))
    response = client.get("/club/acm")
    assert response.json()["profile_image_url"] == "https://cdn.example/pfps/acm.jpg"
