"""Offline tests for caption, image and post-link extraction, --rescrape and
the frozen-browser handling; no browser or network."""

import plistlib
from pathlib import Path

import pytest
from bs4 import BeautifulSoup
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.support.ui import WebDriverWait
from urllib3.exceptions import MaxRetryError, ReadTimeoutError

from instinct.tools import daily_scrape, insta_scraper, scraper_rotation
from instinct.tools.insta_scraper import (
    MAX_SCRAPE_ATTEMPTS,
    InstagramScraper,
    SelectorNotFoundError,
    canonical_post_url,
    clean_caption,
    is_post_image,
    tighten_driver_timeouts,
)
from instinct.tools.scraper import selectors

# Captions as the old locator stored them in posts (October 2026).


@pytest.mark.parametrize(
    "stored, handle, expected",
    [
        (
            "irvineccm\n 41m\nMeet your 2026–2027 CCM Board! 🩺🤎",
            "irvineccm",
            "Meet your 2026–2027 CCM Board! 🩺🤎",
        ),
        (
            "swe.uci\n Edited\n•\n1w\nAre you interested in becoming a mentee?",
            "swe.uci",
            "Are you interested in becoming a mentee?",
        ),
        (
            "hackatuci\n Edited\n•\n52m\n⚠️UPDATE: The workshop will now be "
            "happening at DBH 3011\n\n🦾 Intro to Git Workshop",
            "hackatuci",
            "⚠️UPDATE: The workshop will now be happening at DBH 3011\n\n"
            "🦾 Intro to Git Workshop",
        ),
        ("Join us\n5d\nfor boba", "x", "Join us\n5d\nfor boba"),
        (
            "meet our 2026 RHOsa actives!",
            "irvinerhosas",
            "meet our 2026 RHOsa actives!",
        ),
    ],
)
def test_clean_caption_strips_the_header(stored, handle, expected):
    assert clean_caption(stored, handle=handle) == expected


@pytest.mark.parametrize(
    "stored, handle",
    [
        ("repaircafeatuci\nand\nuciantrepreneur", "repaircafeatuci"),
        ("ucicareer\nand 2 others", "ucicareer"),
        ("bpshiucirvine\nand 4 others", "bpshiucirvine"),
        ("ucistudenthealthcenter", "ucistudenthealthcenter"),
        ("ucibiosci.ugstudentaffairs", "ucibiosci"),
        ("Start the conversation.", "activemindsatuci"),
        ("", "acm.uci"),
        (None, "acm.uci"),
        ("   ", "acm.uci"),
    ],
)
def test_clean_caption_rejects_non_captions(stored, handle):
    assert clean_caption(stored, handle=handle) is None


def test_clean_caption_rejects_the_location_tag():
    location = "University of California, Irvine"
    assert clean_caption(location, handle="x", non_captions=[location]) is None
    # A real caption that mentions the place is kept.
    caption = "GBM tonight at University of California, Irvine"
    assert clean_caption(caption, handle="x", non_captions=[location]) == caption


@pytest.mark.parametrize(
    "href, expected",
    [
        ("/p/DdpYXnXBm1-/", "https://www.instagram.com/p/DdpYXnXBm1-/"),
        ("/swe.uci/p/DdpYXnXBm1-/", "https://www.instagram.com/swe.uci/p/DdpYXnXBm1-/"),
        ("/reel/DeAbc123/", "https://www.instagram.com/p/DeAbc123/"),
        (
            "/swe.uci/reel/DeAbc123/?x=1",
            "https://www.instagram.com/swe.uci/p/DeAbc123/",
        ),
        ("/swe.uci/", None),
        ("/explore/locations/123/uci/", None),
        (
            "https://www.instagram.com/reel/DeAbc123/",
            "https://www.instagram.com/p/DeAbc123/",
        ),
    ],
)
def test_canonical_post_url(href, expected):
    assert canonical_post_url(href) == expected


def test_profile_grid_collects_reels():
    html = """
    <a href="/swe.uci/">profile</a>
    <a href="/swe.uci/p/AAA/">post</a>
    <a href="/swe.uci/reel/BBB/">reel</a>
    <a href="/swe.uci/p/AAA/">pinned duplicate</a>
    """
    scraper = object.__new__(InstagramScraper)
    links = scraper._find_club_post_links(BeautifulSoup(html, "html.parser"))
    assert links == [
        "https://www.instagram.com/swe.uci/p/AAA/",
        "https://www.instagram.com/swe.uci/p/BBB/",
    ]


POST = "https://scontent-lax3-1.cdninstagram.com/v/t51.82787-15/1_n.jpg?stp=dst-jpg"
AVATAR = "https://scontent-lax3-1.cdninstagram.com/v/t51.82787-19/2_n.jpg?stp=dst-jpg"
OLD_AVATAR = "https://scontent-dfw5-1.cdninstagram.com/v/t51.2885-19/3_n.jpg"


@pytest.mark.parametrize(
    "src, width, expected",
    [
        (POST, 600, True),
        (POST, None, True),
        (POST, 0, True),  # not laid out yet
        (POST, 32, False),  # tiny
        (AVATAR, 600, False),
        (OLD_AVATAR, None, False),
        ("https://example.com/a.jpg", 600, False),
        (None, None, False),
    ],
)
def test_is_post_image(src, width, expected):
    assert is_post_image(src, width) is expected


class Element:
    def __init__(self, text="", width=None, **attributes):
        self.text = text
        self.size = {"width": width} if width is not None else {}
        self.attributes = attributes

    def get_attribute(self, name):
        return self.attributes.get(name)


class FakeDriver:
    """Answers find_element(s) from a locator -> elements map."""

    def __init__(self, elements, page_source="<html></html>"):
        self.elements = elements
        self.page_source = page_source

    def find_elements(self, by, value):
        return list(self.elements.get((by, value), []))

    def find_element(self, by, value):
        found = self.find_elements(by, value)
        if not found:
            raise NoSuchElementException(value)
        return found[0]


def post_page_scraper(elements, page_source="<html></html>"):
    scraper = object.__new__(InstagramScraper)
    driver = FakeDriver(elements, page_source=page_source)
    scraper._driver = driver
    scraper._wait = WebDriverWait(driver, 0.05, poll_frequency=0.01)
    scraper._short_wait = WebDriverWait(driver, 0.05, poll_frequency=0.01)
    scraper.safe_get_page = lambda url, **kwargs: True
    return scraper


DATE = Element(datetime="2026-10-06T18:00:00.000Z")


def test_post_reads_h1_caption_and_skips_the_avatar():
    scraper = post_page_scraper(
        {
            selectors.POST_DATETIME: [DATE],
            selectors.POST_LOCATION: [Element("University of California, Irvine")],
            selectors.POST_CAPTION: [Element("swe.uci\n Edited\n•\n1w\nJoin us!")],
            selectors.POST_CAPTION_FALLBACK: [
                Element("University of California, Irvine")
            ],
            selectors.POST_IMAGE: [
                Element(src=AVATAR, width=32),
                Element(src=POST, width=600),
            ],
        }
    )
    assert scraper.get_post_info("u", club_username="swe.uci") == (
        "Join us!",
        "2026-10-06T18:00:00.000Z",
        POST,
    )


def test_fallback_caption_that_is_the_location_is_dropped():
    location = "University of California, Irvine"
    scraper = post_page_scraper(
        {
            selectors.POST_DATETIME: [DATE],
            selectors.POST_LOCATION: [Element(location)],
            selectors.POST_CAPTION_FALLBACK: [Element(location)],
            selectors.POST_IMAGE: [Element(src=POST, width=600)],
        }
    )
    assert scraper.get_post_info("u", club_username="irvinerhosas")[0] is None


def _fallback_post_elements(caption_text="Kaien Nuen, SUGAR, M.Sasuke"):
    return {
        selectors.POST_DATETIME: [DATE],
        selectors.POST_CAPTION_FALLBACK: [Element(caption_text)],
        selectors.POST_IMAGE: [Element(src=POST, width=600)],
    }


def test_caption_debug_dump_writes_on_fallback(monkeypatch, tmp_path):
    monkeypatch.setenv("SCRAPER_DEBUG_DUMP", "1")
    monkeypatch.setenv("HOME", str(tmp_path))
    html = "<html><body>caption miss</body></html>"
    scraper = post_page_scraper(_fallback_post_elements(), page_source=html)
    url = "https://www.instagram.com/cyberuci/p/DePdzrMJRiV/"
    caption, _, _ = scraper.get_post_info(url, club_username="cyberuci")
    assert caption == "Kaien Nuen, SUGAR, M.Sasuke"
    dump = tmp_path / ".cache" / "instinct" / "debug" / "DePdzrMJRiV.html"
    assert dump.read_text(encoding="utf-8") == html


def test_caption_debug_dump_skipped_when_env_unset(monkeypatch, tmp_path):
    monkeypatch.delenv("SCRAPER_DEBUG_DUMP", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))
    scraper = post_page_scraper(_fallback_post_elements())
    scraper.get_post_info(
        "https://www.instagram.com/cyberuci/p/DePdzrMJRiV/",
        club_username="cyberuci",
    )
    assert not (tmp_path / ".cache" / "instinct" / "debug").exists()


def test_caption_debug_dump_skipped_when_h1_matches(monkeypatch, tmp_path):
    monkeypatch.setenv("SCRAPER_DEBUG_DUMP", "1")
    monkeypatch.setenv("HOME", str(tmp_path))
    scraper = post_page_scraper(
        {
            selectors.POST_DATETIME: [DATE],
            selectors.POST_CAPTION: [Element("swe.uci\n Edited\n•\n1w\nJoin us!")],
            selectors.POST_IMAGE: [Element(src=POST, width=600)],
        },
        page_source="<html>h1 hit</html>",
    )
    assert (
        scraper.get_post_info(
            "https://www.instagram.com/swe.uci/p/Abc123XyZ01/",
            club_username="swe.uci",
        )[0]
        == "Join us!"
    )
    assert not (tmp_path / ".cache" / "instinct" / "debug").exists()


def test_caption_debug_dump_caps_at_ten(monkeypatch, tmp_path):
    monkeypatch.setenv("SCRAPER_DEBUG_DUMP", "1")
    monkeypatch.setenv("HOME", str(tmp_path))
    scraper = post_page_scraper(
        _fallback_post_elements(), page_source="<html>cap</html>"
    )
    for i in range(12):
        scraper.get_post_info(
            f"https://www.instagram.com/cyberuci/p/Code{i:07d}/",
            club_username="cyberuci",
        )
    dumps = list((tmp_path / ".cache" / "instinct" / "debug").glob("*.html"))
    assert len(dumps) == 10


def test_video_post_uses_the_poster_not_the_avatar():
    poster = "https://scontent.cdninstagram.com/v/t51.71878-15/9_n.jpg"
    scraper = post_page_scraper(
        {
            selectors.POST_DATETIME: [DATE],
            selectors.POST_IMAGE: [Element(src=AVATAR, width=32)],
            selectors.POST_VIDEO_POSTER: [Element(poster=poster)],
        }
    )
    assert scraper.get_post_info("u")[2] == poster


def test_post_with_only_an_avatar_fails():
    scraper = post_page_scraper(
        {
            selectors.POST_DATETIME: [DATE],
            selectors.POST_IMAGE: [Element(src=AVATAR, width=32)],
        }
    )
    with pytest.raises(SelectorNotFoundError):
        scraper.get_post_info("u")


# --rescrape

IG = "https://www.instagram.com/acm.uci/p"


class RescrapeDB:
    def __init__(self, posts):
        self.posts = posts
        self.updates = {}
        self.uploads = []
        self.recorded = {}

    def get_club_by_instagram_handle(self, handle):
        return "club-1"

    def get_posts_for_rescrape(self, club_id, max_attempts):
        assert max_attempts == MAX_SCRAPE_ATTEMPTS
        return self.posts

    def download_and_upload_img(self, url, path):
        self.uploads.append(path)
        return f"{path}.jpg"

    def update_post_by_id(self, post_id, data):
        self.updates[post_id] = data

    def record_failed_scrape(self, post_id, attempts):
        self.recorded[post_id] = attempts


def rescraper(db, results):
    scraper = object.__new__(InstagramScraper)
    scraper.db = db

    def get_post_info(url, club_username=""):
        result = results[url]
        if isinstance(result, Exception):
            raise result
        return result

    scraper.get_post_info = get_post_info
    return scraper


def test_rescrape_updates_stored_posts_and_keeps_good_captions():
    db = RescrapeDB(
        [
            {"id": "a", "post_url": f"{IG}/C/", "scrapped": True, "caption": "Old"},
            {"id": "b", "post_url": f"{IG}/B/", "scrapped": True, "caption": "Kept"},
            {
                "id": "c",
                "post_url": f"{IG}/A/",
                "scrapped": True,
                "caption": "acm.uci\nand\nwics.uci",
            },
        ]
    )
    rescraper(
        db,
        {
            f"{IG}/C/": ("New caption", "2026-10-01", POST),
            f"{IG}/B/": (None, "2026-10-02", POST),
            f"{IG}/A/": (None, "2026-10-03", POST),
        },
    ).rescrape_club("acm.uci")
    assert db.updates["a"]["caption"] == "New caption"
    assert "caption" not in db.updates["b"]  # empty never overwrites a caption
    assert db.updates["c"]["caption"] is None  # but a stored non-caption goes
    assert db.updates["a"]["image_path"] == "posts/acm.uci/a.jpg"
    assert all("parsed" not in update for update in db.updates.values())
    assert db.uploads == ["posts/acm.uci/a", "posts/acm.uci/b", "posts/acm.uci/c"]


def test_rescrape_failure_leaves_row_unchanged():
    db = RescrapeDB(
        [
            {"id": "a", "post_url": f"{IG}/C/", "scrapped": True, "scrape_attempts": 0},
            {
                "id": "b",
                "post_url": f"{IG}/B/",
                "scrapped": False,
                "scrape_attempts": 1,
            },
            {"id": "c", "post_url": f"{IG}/A/", "scrapped": True, "caption": "x y"},
        ]
    )
    rescraper(
        db,
        {
            f"{IG}/C/": ValueError("gone"),
            f"{IG}/B/": ValueError("gone"),
            f"{IG}/A/": ("Fine", "2026-10-03", POST),
        },
    ).rescrape_club("acm.uci")
    assert set(db.updates) == {"c"}
    # Only the never-scraped post counts the failure.
    assert db.recorded == {"b": 2}


def test_rescrape_raises_when_every_post_fails():
    db = RescrapeDB([{"id": "a", "post_url": f"{IG}/C/", "scrapped": True}])
    with pytest.raises(RuntimeError, match="Failed to rescrape 1"):
        rescraper(db, {f"{IG}/C/": ValueError("gone")}).rescrape_club("acm.uci")
    assert db.updates == {}


def test_rescrape_only_opens_the_newest_posts():
    posts = [
        {"id": code, "post_url": f"{IG}/{code}/", "scrapped": True}
        for code in ("A", "B", "C", "D", "E")
    ]
    db = RescrapeDB(posts)
    results = {p["post_url"]: ("c", "2026-10-01", POST) for p in posts}
    rescraper(db, results).rescrape_club("acm.uci")
    assert sorted(db.updates) == ["C", "D", "E"]


@pytest.fixture
def browser(monkeypatch):
    from instinct import storage

    steps = []

    class Browser:
        _driver = object()

        def __init__(self, *args):
            pass

        def login(self):
            steps.append("login")

        def store_club_data(self, handle):
            steps.append(f"store {handle}")
            return True

        def rescrape_club(self, handle):
            steps.append(f"rescrape {handle}")

        def _driver_quit(self):
            steps.append("quit")

    class Storage:
        def report(self):
            return ""

    monkeypatch.setattr(insta_scraper, "InstagramScraper", Browser)
    monkeypatch.setattr(storage, "get_storage", Storage)
    monkeypatch.setattr(scraper_rotation.time, "sleep", lambda s: None)
    monkeypatch.setattr(
        scraper_rotation, "parse_events", lambda h: steps.append(f"parse {h}")
    )
    monkeypatch.setattr(
        scraper_rotation, "refresh_search_content", lambda: steps.append("refresh")
    )
    return steps


def test_rescrape_session_never_parses_events(browser):
    assert scraper_rotation.run_once(["acm.uci", "wics.uci"], rescrape=True)
    assert browser == [
        "login",
        "rescrape acm.uci",
        "rescrape wics.uci",
        "quit",
        "refresh",
    ]


def test_parsing_runs_after_a_stop_for_clubs_already_scraped(browser, monkeypatch):
    def store(self, handle):
        if handle == "b":
            raise scraper_rotation.RateLimitDetected("429")
        browser.append(f"store {handle}")
        return True

    # The fixture's fake browser; club b hits a rate limit.
    monkeypatch.setattr(insta_scraper.InstagramScraper, "store_club_data", store)
    failed, stopped = scraper_rotation.run_session(["a", "b", "c"])
    assert stopped == "429"
    assert browser[-3:] == ["quit", "parse a", "refresh"]


@pytest.fixture
def daily(monkeypatch, tmp_path):
    calls = {"due": None, "marked": [], "session": None}

    def clubs_due(limit):
        calls["due"] = limit
        return [f"club{i}" for i in range(limit)]

    def run_session(handles, *, dry_run, rescrape=False, on_attempted, **kwargs):
        calls["session"] = (list(handles), rescrape)
        for handle in handles:
            on_attempted(handle)
        return [], None

    monkeypatch.setattr(daily_scrape, "clubs_due", clubs_due)
    monkeypatch.setattr(daily_scrape, "mark_scraped", calls["marked"].append)
    monkeypatch.setattr(scraper_rotation, "run_session", run_session)
    return calls, tmp_path / "state.json"


def test_daily_rescrape_given_handles(daily):
    calls, state = daily
    code = daily_scrape.run(
        5, 200, dry_run=False, state_path=state, rescrape=["swe.uci", "acm.uci"]
    )
    assert code == 0
    assert calls["session"] == (["swe.uci", "acm.uci"], True)
    assert calls["due"] is None
    assert calls["marked"] == []  # last_scraped is not moved


def test_daily_rescrape_without_handles_uses_clubs_due(daily):
    calls, state = daily
    daily_scrape.run(2, 200, dry_run=False, state_path=state, rescrape=[])
    assert calls["session"] == (["club0", "club1"], True)


def test_daily_rescrape_respects_the_cap(daily):
    calls, state = daily
    daily_scrape.run(1, 200, dry_run=False, state_path=state, rescrape=["a", "b"])
    assert calls["session"] == (["a"], True)


# Frozen browser


class HungDriver:
    """chromedriver stopped answering: every command times out."""

    def quit(self):
        raise ReadTimeoutError(None, "", "Read timed out. (read timeout=45)")

    @property
    def current_url(self):
        raise MaxRetryError(
            None, "/session/x/url", ReadTimeoutError(None, "", "timed out")
        )


class RefusedDriver:
    @property
    def current_url(self):
        raise ConnectionRefusedError(61, "Connection refused")


@pytest.mark.parametrize("driver", [HungDriver(), RefusedDriver()])
def test_hung_or_unreachable_driver_is_dead(driver):
    scraper = type("S", (), {"_driver": driver})()
    assert scraper_rotation.driver_alive(scraper) is False


def test_hung_driver_stops_the_session_cleanly(monkeypatch):
    scraper = InstagramScraper.__new__(InstagramScraper)
    scraper._driver = HungDriver()
    scraper.login = lambda: None

    def store(handle):
        raise ReadTimeoutError(None, "", "Read timed out. (read timeout=45)")

    scraper.store_club_data = store
    monkeypatch.setattr(insta_scraper, "InstagramScraper", lambda *args: scraper)
    monkeypatch.setattr(scraper_rotation.time, "sleep", lambda s: None)
    monkeypatch.setattr(scraper_rotation, "refresh_search_content", lambda: True)
    monkeypatch.setattr(scraper_rotation, "parse_events", lambda h: None)
    failed, stopped = scraper_rotation.run_session(["a", "b"])
    assert stopped == "browser died"
    assert scraper._driver is None  # quit was attempted and the driver dropped


def test_tighten_driver_timeouts():
    import urllib3

    class Config:
        timeout = 120

    class Executor:
        _client_config = Config()
        _conn = urllib3.PoolManager(timeout=120)

    class Driver:
        command_executor = Executor()
        page_load = None

        def set_page_load_timeout(self, seconds):
            self.page_load = seconds

    driver = Driver()
    tighten_driver_timeouts(driver)
    assert driver.page_load == insta_scraper.PAGE_LOAD_TIMEOUT_SECONDS
    assert (
        Executor._client_config.timeout == insta_scraper.DRIVER_COMMAND_TIMEOUT_SECONDS
    )
    retries = Executor._conn.connection_pool_kw["retries"]
    assert retries.read == 0


def test_launchd_job_keeps_the_mac_awake():
    plist = Path(__file__).parents[1] / "scripts/launchd/com.instinct.scraper.plist"
    arguments = plistlib.loads(plist.read_bytes())["ProgramArguments"]
    assert arguments[:2] == ["/usr/bin/caffeinate", "-i"]
