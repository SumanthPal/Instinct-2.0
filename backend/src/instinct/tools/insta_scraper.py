import json
import os
import random
import time
from typing import Dict, List, Optional
from typing_extensions import Tuple
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

from instinct.db.queries import SupabaseQueries
import datetime


class RateLimitDetected(Exception):
    """Raised when a potential rate limit is detected during scraping."""


class InstagramLoginError(Exception):
    """Raised when Instagram rejects a login or demands account verification."""


class SelectorNotFoundError(RuntimeError):
    """Raised when a required Instagram page element is absent."""


class InstagramScraper:
    def __init__(self, username, password):
        self._username = username
        self._password = password
        self._current_page = "none"
        self._db = SupabaseQueries()

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
        self.current_cookie_index = 0  # Start from the first cookie

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

            # Use environment variables if set, otherwise use defaults
            chromedriver_path = os.environ.get("CHROMEDRIVER_PATH") or "/usr/bin/chromedriver"
            chrome_bin_path = os.environ.get("CHROME_BIN") or "/usr/bin/chromium"

            logger.info(f"ChromeDriver path: {chromedriver_path}")
            logger.info(f"Chrome binary path: {chrome_bin_path}")

            # Check if binaries exist
            if not os.path.exists(chrome_bin_path):
                logger.warning(f"Chrome binary not found at {chrome_bin_path}")
            else:
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
            # For local development, use webdriver_manager
            logger.info("Local environment detected. Using webdriver_manager.")
            service = Service(ChromeDriverManager().install())

        try:
            driver = webdriver.Chrome(service=service, options=chrome_options)
            logger.info("Chrome WebDriver created successfully")
            return driver
        except Exception as e:
            logger.error(f"Failed to create Chrome WebDriver: {str(e)}")
            raise

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self._driver_quit()

    def detect_rate_limit(self):
        """
        Check for signs of Instagram rate limiting with optimized performance

        Returns:
            bool: True if rate limited, False otherwise
        """
        try:
            current_url = self._driver.current_url

            # Fast URL-based checks first (these are much quicker than page parsing)
            rate_limit_redirects = [
                "/challenge/",
                "/login",
                "/accounts/login",
                "/accounts/suspended",
                "/checkpoint",
                "/confirm",
                "/unusual_activity",
            ]

            if any(redirect in current_url for redirect in rate_limit_redirects):
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

            # Use CSS selectors instead of XPath for faster element detection
            if "/p/" in current_url:  # Post page
                if not self._driver.find_elements(
                    *selectors.POST_CONTENT
                ):
                    logger.warning("Rate limit detected: Missing post content")
                    return True
            elif "/stories/" in current_url:  # Stories page
                if not self._driver.find_elements(
                    *selectors.STORY_CONTENT
                ):
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

        except Exception as e:
            logger.error(
                f"Error checking for rate limit: {str(e)[:100]}"
            )  # Limit log size
            return False

    def safe_get_page(self, url, retry_count=0):
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
            delay = random.uniform(0.25, 0.8)
            time.sleep(delay)

            # Navigate to the URL
            self._driver.get(url)

            # Wait for page to load and possibly redirect
            time.sleep(0.5)

            # Check if we've been rate limited
            if self.detect_rate_limit():
                raise RateLimitDetected(f"Rate limit detected when accessing {url}")

            return True

        except RateLimitDetected:
            # Re-raise RateLimitDetected for caller to handle
            raise

        except Exception as e:
            if retry_count > 0:
                logger.warning(f"Error accessing {url}: {e}. Retrying...")
                time.sleep(2)
                return self.safe_get_page(url, retry_count - 1)
            else:
                logger.error(f"Failed to access {url} after retries: {e}")
                return False

    def swap_cookies(self):
        """Switch to the next cookie/account when rate limited."""
        self.current_cookie_index = (self.current_cookie_index + 1) % len(
            self.cookies_list
        )
        logger.warning(
            f"🔄 Swapping to cookie account #{self.current_cookie_index + 1}..."
        )

        try:
            self._driver.delete_all_cookies()
            decoded_cookies = base64.b64decode(
                self.cookies_list[self.current_cookie_index]
            )
            cookies = json.loads(decoded_cookies.decode("utf-8"))
            for cookie in cookies:
                self._driver.add_cookie(cookie)

            self._driver.refresh()
            time.sleep(5)  # Give some time to reload
            logger.info("Cookies swapped and page refreshed successfully.")
        except Exception as e:
            logger.error(f"Error while swapping cookies: {e}")

    def login(self) -> None:
        """Log in once and raise a specific error when Instagram rejects the session."""
        try:
            using_cookies = bool(self.cookies_list[self.current_cookie_index])
            if using_cookies:
                self._driver.delete_all_cookies()
                logger.info(
                    f"Loading cookies for account {self.current_cookie_index + 1}."
                )
                self._driver.get("https://www.instagram.com/")
                decoded_cookies = base64.b64decode(
                    self.cookies_list[self.current_cookie_index]
                )
                for cookie in json.loads(decoded_cookies.decode("utf-8")):
                    self._driver.add_cookie(cookie)
                self._driver.refresh()
                time.sleep(3)
            else:
                if not self._username or not self._password:
                    raise InstagramLoginError(
                        "No Instagram cookies or username/password credentials are configured."
                    )
                logger.info("No cookies configured; submitting username/password once.")
                self._driver.get("https://www.instagram.com")
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
                self._assert_authenticated_cookie_session()
            else:
                self._get_cookies()
        except InstagramLoginError:
            self._driver_quit()
            raise
        except (WebDriverException, TimeoutException, ValueError) as exc:
            self._driver_quit()
            raise InstagramLoginError(f"Instagram login could not be completed: {exc}") from exc

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
            club_username = (
                club_username[1:] if club_username.startswith("@") else club_username
            )
            club_info = self.get_club_info(club_username)

            self.save_club_info(club_info)
            self.save_post_info(club_username)
            return True
        except AttributeError as e:
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

    def get_post_info(
        self, post_url: str
    ) -> Tuple[Optional[str], str, str]:
        """Extract a post's caption, date, and image, failing on missing required data."""
        if not self.safe_get_page(post_url):
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
            raise RuntimeError(f"Club {club_username} was not saved before post scraping")

        post_links_response = self.db.get_unscrapped_posts_by_club_id(club_id)
        if not post_links_response:
            logger.info(f"No unprocessed posts found for {club_username}")
            return

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
            except Exception as exc:
                failures.append(str(post_id))
                logger.error(f"Error processing post {post_id}: {exc}")

        if failures:
            raise RuntimeError(
                f"Failed to scrape {len(failures)} post(s) for {club_username}: "
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

                    self.db.insert_post_link(post_data)
                    stored += 1
                    logger.info(
                        f"Post link {instagram_post_id} stored or refreshed in database"
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
                    EC.visibility_of_element_located(
                        selectors.INVALID_PROFILE
                    )
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
                    EC.presence_of_element_located(
                        selectors.PROFILE_EXTERNAL_LINK
                    )
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
                EC.presence_of_element_located(
                    selectors.PROFILE_EXTERNAL_LINK
                )
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
                close_button = self._driver.find_element(
                    *selectors.CLOSE_DIALOG
                )
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
                EC.presence_of_all_elements_located(
                    selectors.PROFILE_POST_LINKS
                )
            )
            button_element = self._wait.until(
                EC.presence_of_element_located(
                    selectors.PROFILE_MORE_BUTTON
                )
            )

            button_element.click()
            logger.info("Button for more info clicked!")
        except (NoSuchElementException, TimeoutException):
            logger.info("More... button not found / timeout error.")

    def _find_club_name_pfp(
        self, profile_soup: BeautifulSoup, club_username: str
    ) -> Tuple[str, str]:
        """Extract club name and profile picture with simple robust selectors."""

        # Find club name - look for span with dir="auto" attribute (more reliable than classes)
        club_name = None
        span_elements = profile_soup.find_all("span", {"dir": "auto"})
        for span in span_elements:
            text = span.text.strip()
            # Look for meaningful text (not just numbers or common UI text)
            if text and len(text) > 2 and not text.isdigit():
                skip_words = ["followers", "following", "posts", "more"]
                if not any(word in text.lower() for word in skip_words):
                    club_name = text
                    break

        # Fallback: use username if name not found
        if not club_name:
            club_name = club_username

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
            f"user-agent={self._set_random_user_agent()}",
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

    def _set_random_user_agent(self):
        """Randomly selects a User-Agent string from the list."""
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 "
            "Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0",
            "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:39.0) Gecko/20100101 Firefox/39.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/89.0.4389.128 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/80.0.3987.122 Safari/537.36",
            "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:85.0) Gecko/20100101 Firefox/85.0",
        ]
        return random.choice(user_agents)

    def _get_cookies(self):
        """Dismiss the save-login prompt without writing or logging session secrets.

        To refresh COOKIE_1/COOKIE_2, export the browser's Instagram cookies as a
        JSON array, base64 encode that JSON, and update the local secret manager.
        Never write cookie values to a repository file or application logs.
        """
        try:
            self._wait.until(EC.element_to_be_clickable(selectors.SAVE_LOGIN_INFO)).click()
        except TimeoutException:
            # Instagram does not always display this prompt; no persistence is needed.
            pass

    def _accept_cookies(self):
        """Handles the cookie popup."""
        try:
            # Wait for the popup and try accepting it using XPath (you can try to use other methods like CSS selectors too)
            accept_button = self._wait.until(
                EC.element_to_be_clickable(
                    selectors.ALLOW_COOKIES
                )
            )
            # Perform a click on the "Accept" button
            accept_button.click()
            logger.info("External Cookies accepted.")
        except Exception as e:
            logger.error(f"Cookies button not found or couldn't be clicked: {e}")

    def _assert_authenticated_cookie_session(self) -> None:
        """Require a logged-in affordance after loading session cookies."""
        if self._driver.find_elements(*selectors.LOGIN_USERNAME):
            raise InstagramLoginError("session cookie expired or rejected")
        try:
            self._wait.until(
                lambda driver: bool(
                    driver.find_elements(*selectors.AUTHENTICATED_AFFORDANCE)
                )
            )
        except TimeoutException as exc:
            raise InstagramLoginError("session cookie expired or rejected") from exc

    def _check_login_error(self, *, include_login_page: bool = True) -> Optional[str]:
        """Return a categorized login failure without relying on obfuscated classes."""
        current_url = self._driver.current_url.lower()
        if any(path in current_url for path in ("/challenge/", "/checkpoint/", "/confirm/")):
            return "Instagram checkpoint or challenge required; do not retry this login."
        if "/accounts/suspended" in current_url:
            return "Instagram reports this account is suspended; do not retry this login."

        page_text = self._driver.page_source.lower()
        rate_limit_messages = (
            "try again later",
            "please wait a few minutes",
            "rate limit",
            "unusual activity",
        )
        if any(message in page_text for message in rate_limit_messages):
            return "Instagram rate-limited this login; do not retry this login."
        credential_messages = ("incorrect password", "password was incorrect", "invalid username")
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
            logger.info(f"Attempt {attempt+1}/{max_retries} for {username}")

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

        except RateLimitDetected as rate_limit_exc:
            logger.warning(
                f"Rate limit detected during attempt {attempt+1} for {username}: {rate_limit_exc}"
            )

            # Swap cookies
            scraper.swap_cookies()

            # On last attempt, restart the driver completely
            if attempt == max_retries - 1:
                logger.warning(
                    f"Final attempt failed for {username}. Restarting driver..."
                )
                scraper._driver_quit()
                scraper = InstagramScraper(
                    os.getenv("INSTAGRAM_USERNAME"), os.getenv("INSTAGRAM_PASSWORD")
                )
                scraper.login()
                return scraper

        except Exception as e:
            logger.error(
                f"Attempt {attempt+1} failed for {username} with error: {str(e)}"
            )

            # On last attempt, restart the driver
            if attempt == max_retries - 1:
                logger.warning(
                    f"Multiple failures for {username}. Restarting driver..."
                )
                scraper._driver_quit()
                scraper = InstagramScraper(
                    os.getenv("INSTAGRAM_USERNAME"), os.getenv("INSTAGRAM_PASSWORD")
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
