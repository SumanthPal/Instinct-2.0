import json
import os
import random
import re
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Optional
from typing_extensions import Tuple
from urllib.parse import urlparse
import base64
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.common.exceptions import (
    WebDriverException,
    NoSuchElementException,
    TimeoutException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

from instinct.tools.logger import logger
from instinct.tools.scraper import selectors
from instinct.storage import get_storage

from instinct.db.queries import SupabaseQueries, normalize_handle
import datetime

# Keep each scrape small and slow so one session does not look like a bot.
MAX_POSTS_PER_CLUB = 3
PAGE_DELAY_SECONDS = (3, 8)

# Whole path segments only, so profiles like /checkpointclub/ never match.
_HARD_STOP_PATH = re.compile(
    r"^/(challenge|checkpoint|accounts/login|accounts/suspended)(/|$)"
)
_SOFT_BLOCK_PATH = re.compile(r"/(login|confirm|unusual_activity)(/|$)")

# Shortcode alphabet; a shortcode is the base-64 form of the post's media id.
_SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"


def is_hard_stop_url(url: str) -> bool:
    """True when Instagram sent the session to a challenge, checkpoint,
    suspension or login page. Retrying from any of these only adds logins to
    the account, so they stop the run instead.

    Checks the URL path only, so a ?next= query string cannot trigger it.
    """
    path = urlparse(url).path.lower()
    return bool(_HARD_STOP_PATH.match(path))


def post_recency_key(post_url: str) -> int:
    """Sort key that is larger for newer posts.

    The shortcode in /p/<shortcode>/ is the base-64 media id, and media ids
    start with a creation timestamp, so a larger id is a newer post. Stored
    rows carry no usable date (posts.created_at is a date column filled at
    insert time), and pinned posts break grid order. Shortcodes that do not
    decode sort last.
    """
    shortcode = post_url.rstrip("/").split("/")[-1]
    if not shortcode or len(shortcode) > 11:
        return -1
    media_id = 0
    for char in shortcode:
        index = _SHORTCODE_ALPHABET.find(char)
        if index < 0:
            return -1
        media_id = media_id * 64 + index
    return media_id


def is_plausible_club_name(name: Optional[str], club_username: str) -> bool:
    """Reject empty values, nav labels like "Home", the handle and count text."""
    text = (name or "").strip().lower()
    if not text or text in selectors.NAV_LABELS:
        return False
    if text.lstrip("@") == club_username.lower():
        return False
    if re.fullmatch(r"[\d.,\s]+[km]?", text):
        return False
    return not (
        re.search(r"\d", text) and re.search(r"\b(followers?|following|posts?)\b", text)
    )


class RateLimitDetected(Exception):
    """Raised when a potential rate limit is detected during scraping."""


class InstagramLoginError(Exception):
    """Raised when Instagram rejects a login or demands account verification."""


class SelectorNotFoundError(RuntimeError):
    """Raised when a required Instagram page element is absent."""


class InstagramScraper:
    def __init__(self, username, password, *, cookie_index: int = 0):
        self._username = username
        self._password = password
        self._current_page = "none"
        self._db = SupabaseQueries()
        self.current_cookie_index = cookie_index

        default_profile_dir = (
            "/app/chrome-profile"
            if os.environ.get("DOCKER_ENV")
            else "~/.cache/instinct/chrome-profile"
        )
        profile_root = Path(
            os.getenv("CHROME_PROFILE_DIR") or default_profile_dir
        ).expanduser()
        self._chrome_profile_dir = profile_root / f"account-{cookie_index + 1}"
        try:
            self._chrome_profile_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise RuntimeError(
                f"Unable to create Chrome profile directory: {self._chrome_profile_dir}"
            ) from exc

        self._scraper_tz = os.getenv("SCRAPER_TZ") or "America/Los_Angeles"
        os.environ["TZ"] = self._scraper_tz
        if hasattr(time, "tzset"):
            time.tzset()

        self._chrome_bin_path = self._configured_chrome_binary()
        self._chromium_version = self._installed_chromium_version()
        self._chromium_user_agent = self._native_chromium_user_agent()
        options = Options()
        self.db = SupabaseQueries()
        self._add_options(options)
        self.working_path = os.path.join(os.path.dirname(__file__), "..")

        # Initialize WebDriver with options
        logger.info("Initializing WebDriver")
        self._driver = self._create_driver(options)
        logger.info("WebDriver successfully initialized")
        self._wait = WebDriverWait(self._driver, 5)
        self.cookies_list = [os.getenv("COOKIE_1"), os.getenv("COOKIE_2")]

    def _configured_chrome_binary(self) -> Optional[str]:
        """Return the browser binary used by Selenium, when it is configured."""
        configured_path = os.getenv("CHROME_BIN")
        if configured_path:
            return configured_path
        if os.environ.get("DOCKER_ENV") or os.environ.get("CI"):
            return "/usr/bin/chromium"
        raise RuntimeError(
            "CHROME_BIN must name the local Chromium binary so its version can be "
            "used for a consistent user agent."
        )

    def _installed_chromium_version(self) -> Optional[str]:
        """Read the full version of the binary Selenium will launch."""
        if not self._chrome_bin_path:
            return None
        try:
            version_output = subprocess.run(
                [self._chrome_bin_path, "--version"],
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
        except (OSError, subprocess.CalledProcessError) as exc:
            raise RuntimeError(
                f"Unable to read Chromium version from {self._chrome_bin_path}"
            ) from exc

        match = re.search(
            r"(?:Chromium|Google Chrome)\s+(\d+(?:\.\d+){3})", version_output
        )
        if not match:
            raise RuntimeError(
                f"Could not parse Chromium version from: {version_output!r}"
            )
        return match.group(1)

    def _native_chromium_user_agent(self) -> Optional[str]:
        """Build a reduced non-headless UA from the launched Chromium version."""
        if not self._chromium_version:
            return None
        major_version = self._chromium_version.split(".", maxsplit=1)[0]
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            f"(KHTML, like Gecko) Chrome/{major_version}.0.0.0 Safari/537.36"
        )

    def _create_driver(self, chrome_options: Options = None):
        """Create and return a Chrome WebDriver instance.

        Args:
            chrome_options: Optional Chrome options. If None, default options will be used.

        Returns:
            A configured Chrome WebDriver instance.
        """
        # Check if running in Docker or CI environment (set in Dockerfile)
        if os.environ.get("DOCKER_ENV") or os.environ.get("CI"):
            logger.info("Running in Docker/CI environment. Using system ChromeDriver.")

            # Use environment variables if set, otherwise use Docker defaults.
            chromedriver_path = (
                os.environ.get("CHROMEDRIVER_PATH") or "/usr/bin/chromedriver"
            )
            chrome_bin_path = self._chrome_bin_path

            logger.info(f"ChromeDriver path: {chromedriver_path}")
            logger.info(f"Chrome binary path: {chrome_bin_path}")

            if not chrome_bin_path or not os.path.exists(chrome_bin_path):
                raise RuntimeError(f"Chrome binary not found at {chrome_bin_path}")
            chrome_options.binary_location = chrome_bin_path
            logger.info(f"Chrome binary location set to {chrome_bin_path}")

            if not os.path.exists(chromedriver_path):
                logger.warning(f"ChromeDriver not found at {chromedriver_path}")
                logger.info("Falling back to webdriver_manager")
                service = Service(ChromeDriverManager().install())
            else:
                logger.info(f"Using ChromeDriver at {chromedriver_path}")
                service = Service(executable_path=chromedriver_path)
        else:
            # Keep the launched binary and its version-derived UA in lockstep.
            logger.info("Local environment detected. Using configured Chromium.")
            if not self._chrome_bin_path or not os.path.exists(self._chrome_bin_path):
                raise RuntimeError(
                    f"Chrome binary not found at {self._chrome_bin_path}"
                )
            chrome_options.binary_location = self._chrome_bin_path
            service = Service(
                ChromeDriverManager(driver_version=self._chromium_version).install()
            )

        try:
            driver = webdriver.Chrome(service=service, options=chrome_options)
            logger.info("Chrome WebDriver created successfully")
            return driver
        except WebDriverException as exc:
            error_message = str(exc)
            chrome_lock_files = ("SingletonLock", "SingletonSocket", "SingletonCookie")
            has_profile_lock = any(
                os.path.lexists(self._chrome_profile_dir / lock_file)
                for lock_file in chrome_lock_files
            )
            lock_error_markers = (
                "user data directory is already in use",
                "exited normally",
                "chrome not reachable",
            )
            if has_profile_lock and any(
                marker in error_message.lower() for marker in lock_error_markers
            ):
                message = (
                    "Chrome profile is locked; another scraper instance is using "
                    f"{self._chrome_profile_dir}."
                )
                logger.error(message)
                raise RuntimeError(message) from exc
            logger.error(f"Failed to create Chrome WebDriver: {error_message}")
            raise

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self._driver_quit()

    def detect_rate_limit(self, *, check_page_content: bool = True):
        """
        Check for signs of Instagram rate limiting with optimized performance

        Returns:
            bool: True if rate limited, False otherwise
        """
        try:
            current_url = self._driver.current_url

            # Challenge, checkpoint, suspension and logged-out pages are not
            # rate limits: retrying or swapping accounts from here only adds
            # logins. Raise a hard stop and let the caller end the run.
            if is_hard_stop_url(current_url):
                logger.error(
                    f"Instagram requires attention: redirected to {current_url}"
                )
                raise InstagramLoginError(
                    f"Instagram redirected to {current_url}; stopping without retrying."
                )

            # Fast URL-based checks first (these are much quicker than page parsing)
            if _SOFT_BLOCK_PATH.search(urlparse(current_url).path.lower()):
                logger.warning(f"Rate limit detected: Redirected to {current_url}")
                return True

            # Check response code if available (very fast)
            try:
                response_code = self._driver.execute_script(
                    "return window.performance.getEntries()[0].responseStatus"
                )
                if response_code in [429, 403]:
                    logger.warning(
                        f"Rate limit detected: Response code {response_code}"
                    )
                    return True
            except:
                pass  # Skip if not available

            # Use a more efficient page content check (avoid full lowercase conversion)
            page_source = self._driver.page_source  # Don't convert to lowercase yet

            # Check for common rate limit indicators (process in chunks for speed)
            indicators = [
                "sorry, this page isn't available",
                "please wait",
                "try again later",
                "captcha",
                "unusual activity",
                "page not found",
            ]

            # Fast check - only convert lowercase what we need
            for indicator in indicators:
                if (
                    indicator in page_source.lower()[:2000]
                ):  # Only check first part of page for speed
                    logger.warning(f"Rate limit detected: '{indicator}' text found")
                    return True

            # Content can render after navigation. Post extraction waits for its
            # required locators explicitly, so do not mistake a slow render for a
            # rate limit before those waits have had a chance to run.
            if check_page_content and "/p/" in current_url:  # Post page
                if not self._driver.find_elements(*selectors.POST_CONTENT):
                    logger.warning("Rate limit detected: Missing post content")
                    return True
            elif check_page_content and "/stories/" in current_url:  # Stories page
                if not self._driver.find_elements(*selectors.STORY_CONTENT):
                    logger.warning("Rate limit detected: Missing stories content")
                    return True

            # Fast captcha check
            if any(
                text in page_source.lower()[:3000]
                for text in ["captcha", "security check"]
            ):
                logger.warning("Rate limit detected: Captcha text found")
                return True

            return False

        except InstagramLoginError:
            raise
        except Exception as e:
            logger.error(
                f"Error checking for rate limit: {str(e)[:100]}"
            )  # Limit log size
            return False

    def safe_get_page(self, url, retry_count=0, *, check_page_content=True):
        """
        Safely access a page with rate limit detection

        Args:
            url: URL to access
            retry_count: Number of retries on failure

        Returns:
            bool: True if successful, False if failed

        Raises:
            RateLimitDetected: If rate limit is detected
        """
        try:
            # Add random delay to avoid detection patterns
            delay = random.uniform(*PAGE_DELAY_SECONDS)
            time.sleep(delay)

            # Navigate to the URL
            self._driver.get(url)

            # Wait for page to load and possibly redirect
            time.sleep(0.5)

            # Check if we've been rate limited
            if self.detect_rate_limit(check_page_content=check_page_content):
                raise RateLimitDetected(f"Rate limit detected when accessing {url}")

            return True

        except RateLimitDetected, InstagramLoginError:
            # Re-raise for the caller to handle; never retry these here.
            raise

        except Exception as e:
            if retry_count > 0:
                logger.warning(f"Error accessing {url}: {e}. Retrying...")
                time.sleep(2)
                return self.safe_get_page(
                    url, retry_count - 1, check_page_content=check_page_content
                )
            else:
                logger.error(f"Failed to access {url} after retries: {e}")
                return False

    def swap_cookies(self):
        """Return a scraper using the next account's isolated browser profile."""
        next_cookie_index = (self.current_cookie_index + 1) % len(self.cookies_list)
        logger.warning(f"Switching to cookie account #{next_cookie_index + 1}.")
        self._driver_quit()
        next_scraper = InstagramScraper(
            self._username, self._password, cookie_index=next_cookie_index
        )
        next_scraper.login()
        return next_scraper

    def _inject_cookie_seed(self) -> None:
        """Seed an empty account profile without logging or persisting cookie values."""
        encoded_cookies = self.cookies_list[self.current_cookie_index]
        try:
            cookies = json.loads(base64.b64decode(encoded_cookies).decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise InstagramLoginError("COOKIE seed is not valid base64 JSON.") from exc
        if not isinstance(cookies, list) or not all(
            isinstance(cookie, dict) for cookie in cookies
        ):
            raise InstagramLoginError(
                "COOKIE seed must be a JSON array of cookie objects."
            )
        for cookie in cookies:
            self._driver.add_cookie(cookie)

    def login(self) -> None:
        """Reuse an account profile session, seeding it once only when necessary."""
        try:
            self._driver.get("https://www.instagram.com/")
            profile_has_session = bool(self._driver.get_cookie("sessionid"))
            using_cookies = profile_has_session or bool(
                self.cookies_list[self.current_cookie_index]
            )
            if profile_has_session:
                logger.info(
                    f"Reusing profile session for account {self.current_cookie_index + 1}."
                )
                self._driver.refresh()
                time.sleep(3)
            elif self.cookies_list[self.current_cookie_index]:
                logger.info(
                    f"Seeding profile for account {self.current_cookie_index + 1}."
                )
                self._inject_cookie_seed()
                self._driver.refresh()
                time.sleep(3)
            else:
                if not self._username or not self._password:
                    raise InstagramLoginError(
                        "No Instagram cookies or username/password credentials are configured."
                    )
                logger.info("No cookies configured; submitting username/password once.")
                self._accept_cookies()
                username_field = self._wait.until(
                    EC.visibility_of_element_located(selectors.LOGIN_USERNAME)
                )
                password_field = self._wait.until(
                    EC.visibility_of_element_located(selectors.LOGIN_PASSWORD)
                )
                username_field.send_keys(self._username)
                password_field.send_keys(self._password)
                self._wait.until(
                    EC.element_to_be_clickable(selectors.LOGIN_SUBMIT)
                ).click()
                time.sleep(5)

            # A rejected cookie can render the logged-out page without an alert.
            # Check rate limits/challenges first, then require evidence of a session.
            error_message = self._check_login_error(
                include_login_page=not using_cookies
            )
            if error_message:
                raise InstagramLoginError(error_message)
            if using_cookies:
                self._assert_authenticated_cookie_session(
                    profile_held_session=profile_has_session
                )
            else:
                self._get_cookies()
        except InstagramLoginError:
            self._driver_quit()
            raise
        except (WebDriverException, TimeoutException, ValueError) as exc:
            self._driver_quit()
            raise InstagramLoginError(
                f"Instagram login could not be completed: {exc}"
            ) from exc

    def _parse_count(self, count_str):
        count_str = count_str.replace(",", "").upper()
        if "K" in count_str:
            return int(float(count_str.replace("K", "")) * 1000)
        elif "M" in count_str:
            return int(float(count_str.replace("M", "")) * 1_000_000)
        else:
            return int(count_str)

    def store_club_data(self, club_username: str) -> bool:
        """
        Main method for scraping and storing club and post data.
        :param club_username: the instagram tag of the club
        """
        try:
            club_username = normalize_handle(club_username)
            club_info = self.get_club_info(club_username)

            self.save_club_info(club_info)
            self.save_post_info(club_username)
            return True
        except AttributeError:
            logger.error(f"Enter a valid username {club_username}")
            return False

    def get_club_info(self, club_username: str) -> Dict[str, any]:
        """Main scraper method to get club info
        :param club_username: the instagram tag of the club
        :return club_info: a dictionary containing the club's information
        """
        try:
            profile_url = f"https://www.instagram.com/{club_username}/"
            if not self.safe_get_page(profile_url):
                raise Exception(f"Failed to access profile for {club_username}")

            # handles all scraping for links. this is dynamic, hence why its in selenium
            self._handle_instagram_more_button()
            club_links = self._handle_instagram_links_button()

            page_source = self._driver.page_source
            profile_soup = BeautifulSoup(page_source, "html.parser")

            club_name, pfp_url = self._find_club_name_pfp(profile_soup, club_username)
            club_description, followers_count, following_count, posts_count = (
                self._find_club_description(profile_soup)
            )
            post_links = self._find_club_post_links(profile_soup)

            return {
                "Instagram Handle": club_username,
                "Club Name": club_name,
                "Profile Picture": pfp_url,
                "Description": club_description,
                "Followers": followers_count,
                "Following": following_count,
                "Post Count": posts_count,
                "Club Links": club_links,
                "Recent Posts": post_links,
            }

        except WebDriverException as e:
            logger.error(f"Error fetching club info: {e}")
            self._driver_quit()

    def get_post_info(self, post_url: str) -> Tuple[Optional[str], str, str]:
        """Extract a post's caption, date, and image, failing on missing required data."""
        if not self.safe_get_page(post_url, check_page_content=False):
            raise RuntimeError(f"Failed to access Instagram post: {post_url}")
        logger.info(f"Fetching Instagram post: {post_url}")

        try:
            caption_element = self._wait.until(
                EC.presence_of_element_located(selectors.POST_CAPTION)
            )
            description = caption_element.text.strip() or None
        except TimeoutException:
            # A post may have no caption; this is not a selector failure.
            description = None

        try:
            date_element = self._wait.until(
                EC.presence_of_element_located(selectors.POST_DATETIME)
            )
            date = date_element.get_attribute("datetime")
            if not date:
                raise SelectorNotFoundError("POST_DATETIME had no datetime value")
        except TimeoutException as exc:
            raise SelectorNotFoundError("POST_DATETIME did not match") from exc

        try:
            image_element = self._wait.until(
                EC.presence_of_element_located(selectors.POST_IMAGE)
            )
            image_url = image_element.get_attribute("src")
            if not image_url:
                raise SelectorNotFoundError("POST_IMAGE had no src value")
        except TimeoutException:
            try:
                video_element = self._wait.until(
                    EC.presence_of_element_located(selectors.POST_VIDEO_POSTER)
                )
                image_url = video_element.get_attribute("poster")
                if not image_url:
                    raise SelectorNotFoundError("POST_VIDEO_POSTER had no poster value")
            except TimeoutException as exc:
                raise SelectorNotFoundError(
                    "Neither POST_IMAGE nor POST_VIDEO_POSTER matched"
                ) from exc

        return description, date, image_url

    def save_post_info(self, club_username: str):
        """Process and save post information, never marking a failed mirror as scraped."""
        club_id = self.db.get_club_by_instagram_handle(club_username)
        logger.info(f"Club ID for {club_username}: {club_id}")
        if not club_id:
            raise RuntimeError(
                f"Club {club_username} was not saved before post scraping"
            )

        post_links_response = self.db.get_unscrapped_posts_by_club_id(club_id)
        if not post_links_response:
            logger.info(f"No unprocessed posts found for {club_username}")
            return
        # Each post is a page load, so visit only the newest few and leave the
        # rest for a later run. The query itself returns rows in no set order.
        post_links_response = sorted(
            post_links_response,
            key=lambda post: post_recency_key(post["post_url"]),
            reverse=True,
        )[:MAX_POSTS_PER_CLUB]

        processed = 0
        failures = []
        for post_data in post_links_response:
            post_url = post_data["post_url"]
            post_id = post_data["id"]
            if self.db.check_if_post_is_scrapped(post_id):
                logger.info(f"Post {post_id} already scrapped, skipping")
                continue

            try:
                description, date, post_pic = self.get_post_info(post_url)
                uploaded_path = self.db.download_and_upload_img(
                    post_pic, f"posts/{club_username}/{post_id}"
                )
                self.db.update_post_by_id(
                    post_id,
                    {
                        "caption": description,
                        "posted": date,
                        "image_url": post_pic,
                        "scrapped": True,
                        "image_path": uploaded_path,
                    },
                )
                processed += 1
                logger.info(f"Updated post {post_id} in database")
            except InstagramLoginError, RateLimitDetected:
                # Stop at once rather than loading the next post on a flagged session.
                raise
            except Exception as exc:
                failures.append(str(post_id))
                logger.error(f"Error processing post {post_id}: {exc}")

        # A deleted or broken post fails on every run, so only fail the club
        # when nothing at all was scraped; partial progress still counts.
        if failures and not processed:
            raise RuntimeError(
                f"Failed to scrape {len(failures)} post(s) for {club_username}: "
                f"{', '.join(failures)}"
            )
        if failures:
            logger.warning(
                f"Skipped {len(failures)} post(s) for {club_username} that failed: "
                f"{', '.join(failures)}"
            )
        logger.info(f"Mirrored {processed} post image(s) for {club_username}")

    def save_club_info(self, club_info: dict):
        """Mirror the profile image before recording its object key in Supabase."""
        instagram_handle = club_info["Instagram Handle"]
        club_pfp_url = club_info["Profile Picture"]
        if not club_pfp_url:
            raise SelectorNotFoundError("Profile picture URL is missing")

        storage_path = self.db.download_and_upload_img(
            club_pfp_url, f"pfps/{instagram_handle}.jpg"
        )
        club_info["profile_image_path"] = storage_path
        club_id = self.db.upsert_club(club_info)

        if club_info["Recent Posts"] and club_id:
            self._store_post_links(club_id, instagram_handle, club_info["Recent Posts"])

        logger.info(f"Club info for {instagram_handle} saved to database.")
        return club_id

    def _store_post_links(self, club_id: str, club_username: str, post_links: list):
        """Store post links in the database with minimal information"""
        try:
            stored = 0
            for post_url in post_links:
                try:
                    instagram_post_id = post_url.split("/")[-2]

                    # Check if post already exists

                    post_data = {
                        "club_id": club_id,
                        "determinant": instagram_post_id,
                        "post_url": post_url,
                        "created_at": datetime.datetime.now().isoformat(),
                        "scrapped": False,
                    }

                    if self.db.insert_post_link(post_data):
                        stored += 1
                        logger.info(f"Stored new post link {instagram_post_id}")
                    else:
                        logger.info(
                            f"Post link {instagram_post_id} already stored; left unchanged"
                        )

                except Exception as e:
                    logger.error(f"Error storing post link {post_url}: {str(e)}")
                    continue

            logger.info(f"Stored {stored} new post links for {club_username}")
        except Exception as e:
            logger.error(f"Error in _store_post_links: {str(e)}")

    def check_instagram_handle(self, club_username) -> bool:
        try:
            # Navigate to the Instagram page
            self._driver.get(f"https://www.instagram.com/{club_username}/")

            # Wait for the error message or the page content
            try:
                # Wait specifically for the error span to appear
                WebDriverWait(self._driver, 10).until(
                    EC.visibility_of_element_located(selectors.INVALID_PROFILE)
                )
                return False  # Error span found, handle is invalid
            except TimeoutException:
                # If the span isn't found within the timeout, assume the page is valid
                return True

        except WebDriverException as e:
            # Handle other driver-related errors
            logger.info(f"WebDriver error: {e}")
            return False

    def _handle_instagram_links_button(self) -> List[Dict[str, str]]:
        try:
            # First check if links are already visible
            try:
                link_element = self._wait.until(
                    EC.presence_of_element_located(selectors.PROFILE_EXTERNAL_LINK)
                )
                return [
                    {
                        "text": link_element.text,  # Fixed: use .text property
                        "url": link_element.get_attribute("href"),
                    }
                ]
            except TimeoutException:
                pass

            button_found = False
            for locator in selectors.PROFILE_LINK_TRIGGERS:
                try:
                    button = self._wait.until(EC.element_to_be_clickable(locator))
                    button.click()
                    logger.info("Links trigger clicked successfully.")
                    button_found = True
                    break
                except TimeoutException:
                    continue

            if not button_found:
                logger.warning("No links trigger found.")
                return []

            # Wait for links to appear (they might be in buttons now)
            self._wait.until(
                EC.presence_of_element_located(selectors.PROFILE_EXTERNAL_LINK)
            )

            # Get all link elements (whether direct or in buttons)
            links = self._driver.find_elements(
                *selectors.PROFILE_EXTERNAL_LINK,
            )
            logger.info("Links found successfully.")

            urls = []
            for link in links:
                text = link.text.strip().replace("Link icon", "").strip()
                url = link.get_attribute("href")
                urls.append({"text": text or "Link", "url": url})

            logger.info("URLs extracted successfully.")

            # Close modal
            try:
                close_button = self._driver.find_element(*selectors.CLOSE_DIALOG)
                close_button.click()
                logger.info("Close button clicked successfully.")
            except:
                # Try escape key as fallback
                try:
                    from selenium.webdriver.common.keys import Keys

                    self._driver.find_element(*selectors.PAGE_BODY).send_keys(
                        Keys.ESCAPE
                    )
                    logger.info("Closed modal with Escape key.")
                except:
                    logger.warning("Could not close modal.")

            return urls

        except TimeoutException:
            logger.warning("Links button not found within the timeout.")
            return []
        except Exception as e:
            logger.error(
                f"An error occurred while trying to interact with the links button: {e}"
            )
            return []

    def _handle_instagram_more_button(self) -> None:
        try:
            self._wait.until(
                EC.presence_of_all_elements_located(selectors.PROFILE_POST_LINKS)
            )
            button_element = self._wait.until(
                EC.presence_of_element_located(selectors.PROFILE_MORE_BUTTON)
            )

            button_element.click()
            logger.info("Button for more info clicked!")
        except (NoSuchElementException, TimeoutException, WebDriverException) as exc:
            logger.info(f"More... button unavailable; continuing without it: {exc}")

    def _find_club_name(
        self, profile_soup: BeautifulSoup, club_username: str
    ) -> Optional[str]:
        """Return the profile's display name, or None when no source is trustworthy.

        Tries the og:title and description meta tags, which both read
        "... Name (@handle) ...", then text inside the profile <header>. Never
        the whole page: when logged in, its first span[dir=auto] is the
        sidebar's "Home" link.
        """
        handle = re.escape(club_username)
        og_title = profile_soup.select_one(selectors.PROFILE_OG_TITLE[1])
        description = profile_soup.find("meta", {"name": "description"})
        candidates = []
        for tag, pattern in (
            (og_title, rf"^\s*(.*?)\s*\(@{handle}\)"),
            (description, rf"\bfrom\s+(.*?)\s*\(@{handle}\)"),
        ):
            # A <meta> Tag has no children, so it is falsy; compare with None.
            content = tag.get("content", "") if tag is not None else ""
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                candidates.append(match.group(1))
        candidates += [
            element.get_text(" ", strip=True)
            for element in profile_soup.select(selectors.PROFILE_HEADER_NAME[1])
        ]
        return next(
            (
                name.strip()
                for name in candidates
                if is_plausible_club_name(name, club_username)
            ),
            None,
        )

    def _find_club_name_pfp(
        self, profile_soup: BeautifulSoup, club_username: str
    ) -> Tuple[Optional[str], str]:
        """Extract club name (None if not trustworthy) and profile picture URL."""
        club_name = self._find_club_name(profile_soup, club_username)
        if not club_name:
            logger.warning(
                f"No trustworthy display name found for {club_username}; "
                "an existing club keeps its stored name."
            )

        # Find profile picture - use alt text (more reliable than classes)
        club_tag = profile_soup.find("img", alt=f"{club_username}'s profile picture")
        if not club_tag:
            raise Exception("Profile picture not found.")

        pfp_url = club_tag.get("src")
        return club_name, pfp_url

    def _find_club_description(
        self, profile_soup: BeautifulSoup
    ) -> Tuple[str, int, int, int]:
        meta_tag = profile_soup.find("meta", {"name": "description"})
        if not meta_tag:
            raise Exception("Description not found.")

        description = meta_tag.get("content", "")

        parts = description.split(" - ")

        # Extract follower, following, and post counts

        counts = parts[0].split(", ")
        followers_count = self._parse_count(counts[0].split(" ")[0])
        following_count = self._parse_count(counts[1].split(" ")[0])
        posts_count = self._parse_count(counts[2].split(" ")[0])

        # The rest of the string is the description
        club_description = parts[1:]
        logger.info("obtained description...")

        return club_description, followers_count, following_count, posts_count

    def _find_club_post_links(self, profile_soup: BeautifulSoup):
        """
        Fins all links pertaining to posts when scraping
        :param profile_soup:
        :return:
        """
        links = profile_soup.find_all("a", href=True)

        post_links = []
        for link in links:
            href = link["href"]
            if "/p/" in href:
                post_url = f"https://www.instagram.com{href}"
                post_links.append(post_url)
        # The grid can link the same post more than once (e.g. pinned posts).
        post_links = list(dict.fromkeys(post_links))
        if not post_links:
            raise SelectorNotFoundError("PROFILE_POST_LINKS did not match any posts")
        logger.info(f"obtained {len(post_links)} post links")
        return post_links

    def _get_club_post_links(self, club_username: str) -> list:
        """
        Parses the club_info.json file to get the post links.
        param club_username:
        return: list of post links
        """
        club_info_path = os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "data",
            club_username,
            "club_info.json",
        )
        with open(club_info_path, "r") as file:
            clubs_info = json.load(file)

        return clubs_info["Recent Posts"]

    def _driver_quit(self):
        driver = getattr(self, "_driver", None)
        if driver:
            try:
                driver.quit()
            finally:
                self._driver = None

    def _add_options(self, option: Options):
        """Add options to the Chrome WebDriver."""
        # Add all the common arguments in one go
        args = [
            f"--user-data-dir={self._chrome_profile_dir}",
            "--window-size=1920,1080",
            "--screen-info={0,0 1920x1080}",
            "--disable-blink-features=AutomationControlled",
            "--disable-notifications",
            "--disable-popup-blocking",
            "--disable-infobars",
            "--disable-extensions",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-software-rasterizer",
            "--disable-background-networking",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-breakpad",
            "--disable-client-side-phishing-detection",
            "--disable-component-update",
            "--disable-default-apps",
            "--disable-domain-reliability",
            "--disable-features=AudioServiceOutOfProcess",
            "--disable-hang-monitor",
            "--disable-ipc-flooding-protection",
            "--disable-renderer-backgrounding",
            "--disable-sync",
            "--force-color-profile=srgb",
            "--metrics-recording-only",
            "--safebrowsing-disable-auto-update",
            "--enable-automation",
            "--password-store=basic",
            "--use-mock-keychain",
            "--blink-settings=imagesEnabled=false",
            "--disable-application-cache",
            "--disable-cache",
            "--aggressive-cache-discard",
        ]
        if self._chromium_user_agent:
            args.append(f"--user-agent={self._chromium_user_agent}")
        if os.getenv("HEADLESS", "true").lower() not in {"0", "false", "no"}:
            args.append("--headless=new")

        for arg in args:
            option.add_argument(arg)

        # Set preferences with one call
        option.add_experimental_option(
            "prefs", {"profile.default_content_setting_values.images": 2}
        )

        # Exclude switches in a single call
        option.add_experimental_option(
            "excludeSwitches", ["enable-logging", "enable-automation"]
        )
        option.add_experimental_option("useAutomationExtension", False)

    def _get_cookies(self):
        """Dismiss the save-login prompt without writing or logging session secrets.

        To refresh COOKIE_1/COOKIE_2, export the browser's Instagram cookies as a
        JSON array, base64 encode that JSON, and update the local secret manager.
        Never write cookie values to a repository file or application logs.
        """
        try:
            self._wait.until(
                EC.element_to_be_clickable(selectors.SAVE_LOGIN_INFO)
            ).click()
        except TimeoutException:
            # Instagram does not always display this prompt; no persistence is needed.
            pass

    def _accept_cookies(self):
        """Handles the cookie popup."""
        try:
            # Wait for the popup and try accepting it using XPath (you can try to use other methods like CSS selectors too)
            accept_button = self._wait.until(
                EC.element_to_be_clickable(selectors.ALLOW_COOKIES)
            )
            # Perform a click on the "Accept" button
            accept_button.click()
            logger.info("External Cookies accepted.")
        except Exception as e:
            logger.error(f"Cookies button not found or couldn't be clicked: {e}")

    def _assert_authenticated_cookie_session(
        self, *, profile_held_session: bool = False
    ) -> None:
        """Require a logged-in affordance after loading or reusing session cookies."""
        message = "session cookie expired or rejected"
        if profile_held_session:
            message += (
                f"; remove {self._chrome_profile_dir} to re-seed this account profile"
            )
        if self._driver.find_elements(*selectors.LOGIN_USERNAME):
            raise InstagramLoginError(message)
        try:
            self._wait.until(
                lambda driver: bool(
                    driver.find_elements(*selectors.AUTHENTICATED_AFFORDANCE)
                )
            )
        except TimeoutException as exc:
            raise InstagramLoginError(message) from exc

    def _check_login_error(self, *, include_login_page: bool = True) -> Optional[str]:
        """Return a categorized login failure without relying on obfuscated classes."""
        current_url = self._driver.current_url.lower()
        if any(
            path in current_url for path in ("/challenge/", "/checkpoint/", "/confirm/")
        ):
            return (
                "Instagram checkpoint or challenge required; do not retry this login."
            )
        if "/accounts/suspended" in current_url:
            return (
                "Instagram reports this account is suspended; do not retry this login."
            )

        page_text = self._driver.page_source.lower()
        rate_limit_messages = (
            "try again later",
            "please wait a few minutes",
            "rate limit",
            "unusual activity",
        )
        if any(message in page_text for message in rate_limit_messages):
            return "Instagram rate-limited this login; do not retry this login."
        credential_messages = (
            "incorrect password",
            "password was incorrect",
            "invalid username",
        )
        if any(message in page_text for message in credential_messages):
            return "Instagram rejected the supplied username or password."

        for error_element in self._driver.find_elements(*selectors.LOGIN_ERROR):
            message = error_element.text.strip()
            if message:
                return f"Instagram login error: {message}"

        if include_login_page and "/accounts/login" in current_url:
            return "Instagram remained on the login page; credentials or verification may be required."
        return None


def scrape_with_retries(scraper, username, max_retries=3, base_delay=10):
    for attempt in range(max_retries):
        try:
            username = username[1:] if username.startswith("@") else username
            logger.info(f"Attempt {attempt + 1}/{max_retries} for {username}")

            # Implement progressive backoff delay
            delay = base_delay * (2**attempt)  # Exponential backoff

            # Add jitter to avoid synchronized retries when multithreading
            jitter = random.uniform(0.5, 1.5)
            actual_delay = delay * jitter

            # If not first attempt, add delay before retrying
            if attempt > 0:
                logger.info(f"Waiting {actual_delay:.2f} seconds before retry...")
                time.sleep(actual_delay)

            # Try scraping
            scraper.store_club_data(username)
            logger.info(f"Scraping of {username} complete.")
            return scraper

        except InstagramLoginError:
            # Never retry or swap accounts on a challenge or logged-out session.
            raise

        except RateLimitDetected as rate_limit_exc:
            logger.warning(
                f"Rate limit detected during attempt {attempt + 1} for {username}: {rate_limit_exc}"
            )

            # Switch to a fresh browser instance for the next account profile.
            scraper = scraper.swap_cookies()

            # On last attempt, restart the driver completely
            if attempt == max_retries - 1:
                logger.warning(
                    f"Final attempt failed for {username}. Restarting driver..."
                )
                scraper._driver_quit()
                scraper = InstagramScraper(
                    os.getenv("INSTAGRAM_USERNAME"),
                    os.getenv("INSTAGRAM_PASSWORD"),
                    cookie_index=scraper.current_cookie_index,
                )
                scraper.login()
                return scraper

        except Exception as e:
            logger.error(
                f"Attempt {attempt + 1} failed for {username} with error: {str(e)}"
            )

            # On last attempt, restart the driver
            if attempt == max_retries - 1:
                logger.warning(
                    f"Multiple failures for {username}. Restarting driver..."
                )
                scraper._driver_quit()
                scraper = InstagramScraper(
                    os.getenv("INSTAGRAM_USERNAME"),
                    os.getenv("INSTAGRAM_PASSWORD"),
                    cookie_index=scraper.current_cookie_index,
                )
                scraper.login()
                return scraper

    # If we've exhausted all retries
    return scraper


def scrape_sequence(username_list: list[str]) -> None:
    scraper = None
    try:
        logger.info(f"Starting scraper sequence for {len(username_list)} club(s)...")
        scraper = InstagramScraper(
            os.getenv("INSTAGRAM_USERNAME"), os.getenv("INSTAGRAM_PASSWORD")
        )
        logger.info("Scraper initialized.")

        scraper.login()
        logger.info("Logged into Instagram.")

        for username in username_list:
            logger.info(f"Starting scrape for {username}...")
            scraper = scrape_with_retries(scraper, username)
            logger.info(f"Finished scraping {username}.")
    except Exception as e:
        logger.error(f"An error occurred during scrape sequence: {e}")
    finally:
        logger.info(get_storage().report())
        if scraper:
            logger.info("Quitting scraper driver...")
            scraper._driver_quit()
            logger.info("Driver quit successfully.")


if __name__ == "__main__":
    # Example usage
    username_list = ["dspuci"]  # Replace with actual usernames
    scrape_sequence(username_list)
