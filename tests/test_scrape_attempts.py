"""Offline tests for counting failed post scrapes; no browser or network."""

import pytest

from instinct.tools.insta_scraper import MAX_SCRAPE_ATTEMPTS, InstagramScraper


class FakeDB:
    def __init__(self, posts):
        self.posts = posts
        self.max_attempts = None
        self.recorded = {}
        self.updated = []

    def get_club_by_instagram_handle(self, handle):
        return 1

    def get_unscrapped_posts_by_club_id(self, club_id, max_attempts):
        self.max_attempts = max_attempts
        return self.posts

    def check_if_post_is_scrapped(self, post_id):
        return False

    def download_and_upload_img(self, url, path):
        return path

    def update_post_by_id(self, post_id, data):
        self.updated.append(post_id)

    def record_failed_scrape(self, post_id, attempts):
        self.recorded[post_id] = attempts


def make_scraper(db, broken):
    scraper = object.__new__(InstagramScraper)
    scraper.db = db

    def get_post_info(url, club_username=""):
        if url in broken:
            raise ValueError("post is gone")
        return "caption", "2026-10-05", "https://cdn/img.jpg"

    scraper.get_post_info = get_post_info
    return scraper


IG = "https://www.instagram.com/p"


def test_failure_increments_attempts_and_success_does_not():
    db = FakeDB(
        [
            {"id": "a", "post_url": f"{IG}/B/", "scrape_attempts": 1},
            {"id": "b", "post_url": f"{IG}/C/", "scrape_attempts": 0},
        ]
    )
    make_scraper(db, broken={f"{IG}/B/"}).save_post_info("acm")
    assert db.max_attempts == MAX_SCRAPE_ATTEMPTS
    assert db.recorded == {"a": 2}
    assert db.updated == ["b"]


def test_missing_attempts_value_counts_from_zero():
    db = FakeDB(
        [
            {"id": "a", "post_url": f"{IG}/B/"},
            {"id": "b", "post_url": f"{IG}/C/", "scrape_attempts": None},
        ]
    )
    with pytest.raises(RuntimeError, match="Failed to scrape 2"):
        make_scraper(db, broken={f"{IG}/B/", f"{IG}/C/"}).save_post_info("acm")
    assert db.recorded == {"a": 1, "b": 1}


def test_db_error_while_recording_does_not_hide_scrape(monkeypatch):
    db = FakeDB(
        [
            {"id": "a", "post_url": f"{IG}/B/", "scrape_attempts": 0},
            {"id": "b", "post_url": f"{IG}/C/", "scrape_attempts": 0},
        ]
    )

    def boom(post_id, attempts):
        raise ConnectionError("db down")

    monkeypatch.setattr(db, "record_failed_scrape", boom)
    make_scraper(db, broken={f"{IG}/B/"}).save_post_info("acm")
    assert db.updated == ["b"]
