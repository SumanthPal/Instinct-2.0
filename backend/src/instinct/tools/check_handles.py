"""Read-only check that every clubs.instagram_handle still points at a profile.

Clubs rename their Instagram handles. A --once run on a stale handle cannot
find the existing row and inserts a duplicate club, so run this first and
review the CSV. It never writes to the database: handle and name fixes are
applied separately, after review.

It is built to be gentle on the account: one browser, one login, a small batch
per run (--limit), a long random wait between profiles, and the first
challenge, checkpoint, login or rate-limit page stops the whole run with no
retry. Rerunning appends to the CSV and skips handles with a final status;
"unknown" rows (the page never showed a profile or an error) are retried.

    uv run python -m instinct.tools.check_handles --limit 5
"""

import argparse
import csv
import datetime
import random
import sys
import time
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from instinct.tools.logger import logger
from instinct.tools.scraper import selectors

PROFILE_DELAY_SECONDS = (20, 45)
MAX_LIMIT = 50
FIELDS = [
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
NOT_FOUND_TEXT = "sorry, this page isn't available"
RATE_LIMIT_TEXT = ("please wait", "try again later", "unusual activity", "captcha")
# Rows with these statuses are final; unknown rows are retried on the next run.
FINAL_STATUSES = {"ok", "not_found", "redirected"}
# Single-segment Instagram paths that are never a profile.
RESERVED_PATHS = {
    "accounts",
    "direct",
    "explore",
    "p",
    "reel",
    "reels",
    "stories",
    "tv",
}


class StopRun(Exception):
    """Instagram wants a human or is throttling; stop without retrying."""


def classify(
    handle: str,
    final_url: str,
    page_text: str,
    *,
    has_profile: bool,
    status_code: Optional[int] = None,
) -> Tuple[str, str]:
    """Return (status, new_handle) for a loaded page.

    status is ok, not_found, redirected or unknown. ok and redirected need
    positive evidence that a profile rendered (has_profile). Raises StopRun
    for a challenge, checkpoint, login, suspension or rate-limit page.
    Rate-limit wording only counts when no profile rendered, so a club bio
    that says "please wait" cannot stop the run.
    """
    from instinct.tools.insta_scraper import is_hard_stop_url, is_soft_block_url

    if is_hard_stop_url(final_url) or is_soft_block_url(final_url):
        raise StopRun(f"redirected to {final_url}")
    if status_code in (403, 429):
        raise StopRun(f"HTTP {status_code} on {final_url}")
    text = page_text.lower()
    if not has_profile:
        if NOT_FOUND_TEXT in text:
            return "not_found", ""
        if any(marker in text for marker in RATE_LIMIT_TEXT):
            raise StopRun(f"rate-limit text on {final_url}")
        return "unknown", ""
    parts = [part for part in urlparse(final_url).path.split("/") if part]
    if len(parts) != 1 or parts[0].lower() in RESERVED_PATHS:
        return "unknown", ""
    if parts[0].lower() == handle.lower():
        return "ok", ""
    return "redirected", parts[0].lower()


def name_mismatch(stored: str, display: Optional[str]) -> bool:
    """True when the stored name is a nav label or differs from the profile's."""
    stored_text = (stored or "").strip().lower()
    if stored_text in selectors.NAV_LABELS:
        return True
    return bool(display) and stored_text != display.strip().lower()


def already_checked(path: Path) -> set:
    """Handles with a final status in an earlier CSV from this tool."""
    if not path.exists():
        return set()
    with path.open(newline="") as file:
        reader = csv.DictReader(file)
        if not {"handle", "status"} <= set(reader.fieldnames or []):
            raise SystemExit(
                f"{path} is not a handle_check CSV (needs handle and status "
                "columns); pass a different --out."
            )
        return {row["handle"] for row in reader if row["status"] in FINAL_STATUSES}


def fetch_clubs(page_size: int = 1000) -> list:
    """Every club, paged so PostgREST's row cap cannot silently drop any."""
    from instinct.db.queries import SupabaseQueries

    table = SupabaseQueries().supabase.table("clubs")
    clubs = []
    while True:
        rows = (
            table.select("id, name, instagram_handle")
            .order("instagram_handle")
            .order("id")
            .range(len(clubs), len(clubs) + page_size - 1)
            .execute()
            .data
            or []
        )
        clubs += rows
        if len(rows) < page_size:
            return clubs


def pending_clubs(clubs: list, done: set, limit: int) -> list:
    """Clubs still to check: blank and duplicate handles dropped, capped at limit."""
    from instinct.db.queries import normalize_handle

    seen = set(done)
    todo = []
    for club in clubs:
        handle = normalize_handle(club["instagram_handle"])
        if handle and handle not in seen:
            seen.add(handle)
            todo.append({**club, "handle": handle})
    return todo[:limit]


def response_status(driver) -> Optional[int]:
    """HTTP status of the last navigation, when the browser exposes it."""
    try:
        return driver.execute_script(
            "return window.performance.getEntries()[0].responseStatus"
        )
    except Exception:
        return None


def check_handles(limit: int, out: Path) -> int:
    import os

    from instinct.tools.insta_scraper import InstagramScraper

    done = already_checked(out)
    todo = pending_clubs(fetch_clubs(), done, limit)
    logger.info(f"{len(done)} handle(s) already checked; checking {len(todo)} now.")
    if not todo:
        return 0

    new_file = not out.exists()
    scraper = None
    with out.open("a", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        if new_file:
            writer.writeheader()
        try:
            scraper = InstagramScraper(
                os.getenv("INSTAGRAM_USERNAME"), os.getenv("INSTAGRAM_PASSWORD")
            )
            scraper.login()
            driver = scraper._driver
            for index, club in enumerate(todo):
                if index > 0:
                    time.sleep(random.uniform(*PROFILE_DELAY_SECONDS))
                handle = club["handle"]
                driver.get(f"https://www.instagram.com/{handle}/")
                time.sleep(random.uniform(3, 6))
                final_url = driver.current_url
                soup = BeautifulSoup(driver.page_source, "html.parser")
                segment = urlparse(final_url).path.strip("/").split("/")[0]
                display = scraper._find_club_name(soup, segment or handle)
                has_profile = (
                    bool(display) or soup.select_one("main header") is not None
                )
                # Classify on visible text: the raw source carries JS bundles
                # that can mention words like "captcha" on a normal profile.
                visible = driver.find_element(*selectors.PAGE_BODY).text
                status, new_handle = classify(
                    handle,
                    final_url,
                    visible,
                    has_profile=has_profile,
                    status_code=response_status(driver),
                )
                if status not in ("ok", "redirected"):
                    display = None
                writer.writerow(
                    {
                        "club_id": club["id"],
                        "name": club["name"],
                        "handle": handle,
                        "status": status,
                        "new_handle": new_handle,
                        "display_name": display or "",
                        "name_mismatch": name_mismatch(club["name"], display),
                        "final_url": final_url,
                        "checked_at": datetime.datetime.now().isoformat(
                            timespec="seconds"
                        ),
                    }
                )
                file.flush()
                logger.info(f"{handle}: {status} {new_handle}".rstrip())
        except StopRun as exc:
            logger.error(f"Stopped without retrying: {exc}")
            return 1
        except Exception as exc:
            # Includes InstagramLoginError from login(); never retry.
            logger.error(f"Handle check stopped: {exc}")
            return 1
        finally:
            if scraper:
                scraper._driver_quit()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only check of clubs.instagram_handle; writes a CSV."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help=f"Profiles to visit this run (1-{MAX_LIMIT}, default 20).",
    )
    parser.add_argument(
        "--out", type=Path, default=Path("handle_check.csv"), help="CSV to append to."
    )
    args = parser.parse_args()
    if not 1 <= args.limit <= MAX_LIMIT:
        parser.error(f"--limit must be between 1 and {MAX_LIMIT}")
    return check_handles(args.limit, args.out)


if __name__ == "__main__":
    sys.exit(main())
