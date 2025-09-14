from typing import Tuple
from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from .scraper_exceptions import RateLimitException


class PostScraper:
    def __init__(self, driver, wait, rate_detector):
        self.driver = driver
        self.wait = wait
        self.rate_detector = rate_detector

    def scrape_post(self, post_url: str) -> Tuple[str, str, str]:
        """Scrape individual post information."""
        if not self.rate_detector.safe_get_page(post_url):
            raise Exception(f"Failed to access post {post_url}")

        self.wait.until(
            EC.presence_of_element_located(
                (
                    By.XPATH,
                    "//h1[contains(@class, '_ap3a') and contains(@class, '_aaco') and contains(@class, '_aacu')]",
                )
            )
        )

        post_source = self.driver.page_source
        soup = BeautifulSoup(post_source, "html.parser")

        description = self._extract_description(soup)
        date = self._extract_date(soup)
        img_src = self._extract_image(soup)

        return description, date, img_src

    def _extract_description(self, soup: BeautifulSoup) -> str:
        """Extract post description/caption."""
        h1_element = soup.find("h1", class_="_ap3a _aaco _aacu _aacx _aad7 _aade")
        return h1_element.text if h1_element else ""

    def _extract_date(self, soup: BeautifulSoup) -> str:
        """Extract post date."""
        post_time = soup.find("time", class_="_a9ze _a9zf")
        return post_time["datetime"] if post_time else ""

    def _extract_image(self, soup: BeautifulSoup) -> str:
        """Extract post image URL."""
        img_tag = soup.find(
            "img", class_="x5yr21d xu96u03 x10l6tqk x13vifvy x87ps6o xh8yej3"
        )

        if img_tag:
            return img_tag.get("src", "http://www.w3.org/2000/svg")
        else:
            raise RateLimitException("Instagram rate limit suspected: no image found.")
