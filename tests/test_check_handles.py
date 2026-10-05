"""Offline tests for the handle checker's page classification."""

import pytest

from instinct.tools.check_handles import StopRun, classify, name_mismatch

IG = "https://www.instagram.com"


def test_ok():
    assert classify("acm", f"{IG}/acm/", "<html>profile</html>") == ("ok", "")


def test_ok_ignores_case_and_query():
    assert classify("acm", f"{IG}/ACM/?hl=en", "") == ("ok", "")


def test_not_found():
    page = "<span>Sorry, this page isn't available.</span>"
    assert classify("oldname", f"{IG}/oldname/", page) == ("not_found", "")


def test_redirected():
    assert classify("uciblockchain", f"{IG}/blockchainuci/", "") == (
        "redirected",
        "blockchainuci",
    )


@pytest.mark.parametrize(
    "url",
    [f"{IG}/accounts/login/?next=/acm/", f"{IG}/challenge/abc/", f"{IG}/x/checkpoint/"],
)
def test_hard_stop(url):
    with pytest.raises(StopRun):
        classify("acm", url, "")


def test_rate_limit_text_stops():
    with pytest.raises(StopRun):
        classify("acm", f"{IG}/acm/", "Please wait a few minutes")


def test_name_mismatch():
    assert name_mismatch("Home", None)
    assert name_mismatch("Home", "Men's Club Volleyball")
    assert not name_mismatch("ACM at UCI", "acm at uci")
    assert not name_mismatch("ACM at UCI", None)
