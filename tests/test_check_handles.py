"""Offline tests for the handle checker's classification and CSV resume."""

import csv

import pytest

from instinct.tools.check_handles import (
    FIELDS,
    StopRun,
    already_checked,
    classify,
    name_mismatch,
    pending_clubs,
)

IG = "https://www.instagram.com"


def test_ok():
    assert classify("acm", f"{IG}/acm/", "ACM at UCI", has_profile=True) == ("ok", "")


def test_ok_ignores_case_and_query():
    assert classify("acm", f"{IG}/ACM/?hl=en", "", has_profile=True) == ("ok", "")


def test_ok_needs_profile_evidence():
    assert classify("acm", f"{IG}/acm/", "", has_profile=False) == ("unknown", "")


def test_not_found():
    page = "Sorry, this page isn't available."
    assert classify("old", f"{IG}/old/", page, has_profile=False) == ("not_found", "")


def test_redirected():
    assert classify("uciblockchain", f"{IG}/blockchainuci/", "", has_profile=True) == (
        "redirected",
        "blockchainuci",
    )


@pytest.mark.parametrize("path", ["explore", "reels", "accounts", "p"])
def test_reserved_path_is_not_a_new_handle(path):
    assert classify("acm", f"{IG}/{path}/", "", has_profile=True) == ("unknown", "")


@pytest.mark.parametrize(
    "path",
    [
        "accounts/login/?next=/acm/",
        "challenge/abc/",
        "accounts/suspended/",
        "accounts/unusual_activity/",
    ],
)
def test_hard_and_soft_block_urls_stop(path):
    with pytest.raises(StopRun):
        classify("acm", f"{IG}/{path}", "", has_profile=True)


@pytest.mark.parametrize("code", [403, 429])
def test_throttle_status_stops(code):
    with pytest.raises(StopRun):
        classify("acm", f"{IG}/acm/", "", has_profile=True, status_code=code)


def test_rate_limit_text_without_profile_stops():
    with pytest.raises(StopRun):
        classify("acm", f"{IG}/acm/", "Please wait a few minutes", has_profile=False)


def test_rate_limit_words_in_bio_do_not_stop():
    bio = "Hackathon signups: please wait for our next post! Try again later."
    assert classify("acm", f"{IG}/acm/", bio, has_profile=True) == ("ok", "")


def test_name_mismatch():
    assert name_mismatch("Home", None)
    assert name_mismatch("Home", "Men's Club Volleyball")
    assert not name_mismatch("ACM at UCI", "acm at uci")
    assert not name_mismatch("ACM at UCI", None)


def write_csv(path, rows):
    with path.open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in FIELDS})


def test_csv_columns():
    assert FIELDS == [
        "club_id",
        "name",
        "handle",
        "status",
        "new_handle",
        "display_name",
        "name_mismatch",
        "final_url",
        "checked_at",
    ]


def test_resume_skips_final_rows_and_retries_unknown(tmp_path):
    out = tmp_path / "handle_check.csv"
    write_csv(
        out,
        [
            {"handle": "acm", "status": "ok"},
            {"handle": "gone", "status": "not_found"},
            {"handle": "flaky", "status": "unknown"},
        ],
    )
    assert already_checked(out) == {"acm", "gone"}


def test_missing_csv_means_nothing_checked(tmp_path):
    assert already_checked(tmp_path / "nope.csv") == set()


def test_malformed_csv_gives_clear_error(tmp_path):
    out = tmp_path / "other.csv"
    out.write_text("a,b\n1,2\n")
    with pytest.raises(SystemExit, match="not a handle_check CSV"):
        already_checked(out)


def test_pending_clubs_drops_blank_duplicate_and_done():
    clubs = [
        {"id": 1, "name": "A", "instagram_handle": "@ACM"},
        {"id": 2, "name": "A dup", "instagram_handle": "acm"},
        {"id": 3, "name": "Blank", "instagram_handle": "  "},
        {"id": 4, "name": "None", "instagram_handle": None},
        {"id": 5, "name": "Done", "instagram_handle": "gone"},
        {"id": 6, "name": "B", "instagram_handle": "bclub"},
        {"id": 7, "name": "C", "instagram_handle": "cclub"},
    ]
    todo = pending_clubs(clubs, {"gone"}, limit=2)
    assert [(club["id"], club["handle"]) for club in todo] == [(1, "acm"), (6, "bclub")]
