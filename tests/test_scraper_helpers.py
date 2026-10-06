"""Offline tests for the scraper's pure helpers; no browser or network."""

import pytest

from instinct.db.queries import normalize_handle
from instinct.tools.insta_scraper import (
    is_hard_stop_url,
    is_plausible_club_name,
    post_recency_key,
)

IG = "https://www.instagram.com"


@pytest.mark.parametrize(
    "path",
    [
        "/challenge/",
        "/challenge/abc/def/",
        "/checkpoint/",
        "/accounts/login/",
        "/accounts/login",
        "/accounts/suspended/",
    ],
)
def test_hard_stop_paths(path):
    assert is_hard_stop_url(f"{IG}{path}?next=/acm/")


@pytest.mark.parametrize(
    "path",
    [
        "/checkpointclub/",
        "/challengeclub/",
        "/acm/",
        "/acm/?next=/accounts/login/",
        "/p/Ddx1ONoMygN/",
    ],
)
def test_not_hard_stop(path):
    assert not is_hard_stop_url(f"{IG}{path}")


def test_post_recency_newest_first():
    older, newer = f"{IG}/p/DWqOKffldbx/", f"{IG}/p/Ddx1ONoMygN/"
    assert post_recency_key(newer) > post_recency_key(older)
    assert post_recency_key(f"{IG}/p/not*valid/") == -1


@pytest.mark.parametrize(
    "raw", ["blockchainuci", "@BlockchainUCI", "  @blockchainuci ", "BLOCKCHAINUCI"]
)
def test_normalize_handle(raw):
    assert normalize_handle(raw) == "blockchainuci"


def test_normalize_handle_blank():
    assert normalize_handle("@") == ""
    assert normalize_handle(None) == ""


@pytest.mark.parametrize(
    "name", ["", "Home", "home", "blockchainuci", "1,234", "12 posts"]
)
def test_implausible_names(name):
    assert not is_plausible_club_name(name, "blockchainuci")


def test_plausible_name():
    assert is_plausible_club_name("Blockchain at UCI", "blockchainuci")
