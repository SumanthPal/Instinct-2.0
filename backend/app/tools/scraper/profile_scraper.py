from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from app.tools.scraper.rate_limit_detector import RateLimitDetector
from ..logger import logger
from typing import List, Dict, Tuple
from bs4 import BeautifulSoup


class ProfileScraper:
    def __init__(
        self, driver: WebDriver, wait: WebDriverWait, rate_detector: RateLimitDetector
    ):
        self.driver = driver
        self.wait = wait
        self.rate_detector = rate_detector
        self.logger = logger

    def scrape_profile(self, username: str) -> dict:
        """Scrape Instagram profile information."""
        profile_url = f"https://www.instagram.com/{username}/"

        if not self.rate_detector.safe_get_page(profile_url):
            raise Exception(f"Failed to access profile for {username}")

        # Handle dynamic content
        self._handle_more_button()
        club_links = self._handle_links_button()

        # Parse static content
        page_source = self.driver.page_source
        soup = BeautifulSoup(page_source, "html.parser")

        club_name, pfp_url = self._extract_name_and_pfp(soup, username)
        description, followers, following, posts = self._extract_stats(soup)
        post_links = self._extract_post_links(soup)

        return {
            "Instagram Handle": username,
            "Club Name": club_name,
            "Profile Picture": pfp_url,
            "Description": description,
            "Followers": followers,
            "Following": following,
            "Post Count": posts,
            "Club Links": club_links,
            "Recent Posts": post_links,
        }

    def _handle_more_button(self) -> None:
        """Click the 'more' button if it exists."""
        try:
            self.wait.until(
                EC.presence_of_all_elements_located(
                    (By.XPATH, "//a[contains(@href, '/p/')]")
                )
            )
            button = self.wait.until(
                EC.presence_of_element_located(
                    (By.XPATH, "//span[contains(@class, 'x1lliihq') and text()='more']")
                )
            )
            button.click()
        except (NoSuchElementException, TimeoutException):
            pass

    def _handle_links_button(self) -> List[Dict[str, str]]:
        """Extract external links from profile."""
        try:
            # Try to find existing link first
            try:
                link_element = self.wait.until(
                    EC.presence_of_element_located(
                        (
                            By.XPATH,
                            "//a[@rel='me nofollow noopener noreferrer' and @target='_blank']",
                        )
                    )
                )
                return [
                    {
                        "text": link_element.get_attribute("text"),
                        "url": link_element.get_attribute("href"),
                    }
                ]
            except TimeoutException:
                pass

            # Try to click links button
            button = self.driver.find_element(
                By.CSS_SELECTOR, "button._acan._acao._acas._aj1-._ap30"
            )
            button.click()

            self.wait.until(
                EC.presence_of_element_located(
                    (
                        By.XPATH,
                        "//a[@rel='me nofollow noopener noreferrer' and @target='_blank']",
                    )
                )
            )

            links = self.driver.find_elements(
                By.XPATH,
                "//a[@rel='me nofollow noopener noreferrer' and @target='_blank']",
            )

            urls = []
            for link in links:
                text = link.text.strip().replace("Link icon", "").strip()
                url = link.get_attribute("href")
                urls.append({"text": text, "url": url})

            # Close the modal
            close_button = self.driver.find_element(
                By.CSS_SELECTOR, 'div[aria-label="Close"]'
            )
            close_button.click()

            return urls

        except Exception:
            return []

    def _extract_name_and_pfp(
        self, soup: BeautifulSoup, username: str
    ) -> Tuple[str, str]:
        """Extract profile name and picture URL."""
        club_name = soup.find(
            "span",
            class_="x1lliihq x1plvlek xryxfnj x1n2onr6 x1ji0vk5 x18bv5gf "
            "x193iq5w xeuugli x1fj9vlw x13faqbe x1vvkbs x1s928wv xhkezso "
            "x1gmr53x x1cpjm7i x1fgarty x1943h6x x1i0vuye xvs91rp "
            "x1s688f x5n08af x10wh9bi x1wdrske x8viiok x18hxmgj",
        ).text

        club_tag = soup.find("img", alt=f"{username}'s profile picture")
        if not club_tag:
            raise Exception("Profile picture not found.")

        pfp_url = club_tag.get("src")
        return club_name, pfp_url

    def _extract_stats(self, soup: BeautifulSoup) -> Tuple[str, int, int, int]:
        """Extract profile statistics and description."""
        meta_tag = soup.find("meta", {"name": "description"})
        if not meta_tag:
            raise Exception("Description not found.")

        description = meta_tag.get("content", "")
        parts = description.split(" - ")

        # Extract counts
        counts = parts[0].split(", ")
        followers_count = self._parse_count(counts[0].split(" ")[0])
        following_count = self._parse_count(counts[1].split(" ")[0])
        posts_count = self._parse_count(counts[2].split(" ")[0])

        club_description = parts[1:]
        return club_description, followers_count, following_count, posts_count

    def _extract_post_links(self, soup: BeautifulSoup) -> List[str]:
        """Extract post URLs from profile page."""
        links = soup.find_all("a", href=True)
        post_links = []

        for link in links:
            href = link["href"]
            if "/p/" in href:
                post_url = f"https://www.instagram.com{href}"
                post_links.append(post_url)

        return post_links

    def _parse_count(self, count_str: str) -> int:
        """Parse follower/following counts with K/M suffixes."""
        count_str = count_str.replace(",", "").upper()
        if "K" in count_str:
            return int(float(count_str.replace("K", "")) * 1000)
        elif "M" in count_str:
            return int(float(count_str.replace("M", "")) * 1_000_000)
        else:
            return int(count_str)
