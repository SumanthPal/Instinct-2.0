from os import wait
from .scraper_exceptions import RateLimitException
import time
import random

class RateLimitDetector:
    def __init__(self, driver):
        self.driver = driver

    def detect_rate_limit(self) -> bool:
        """Check for signs of Instagram rate limiting."""
        try:
            current_url = self.driver.current_url

            # Fast URL-based checks
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
                return True

            # Check page content for rate limit indicators
            page_source = self.driver.page_source[:3000]  # Only check first part
            indicators = [
                "sorry, this page isn't available",
                "please wait",
                "try again later",
                "captcha",
                "unusual activity",
                "page not found",
            ]

            for indicator in indicators:
                if indicator in page_source.lower():
                    return True

            return False

        except Exception:
            return False:

    def safe_get_page(self, url: str, retry_count: int = 1) -> bool:
        """Safely access a page with rate limit detection."""
        try:
            # Add random delay
            time.sleep(random.uniform(0.25, 0.8))

            self.driver.get(url)
            time.sleep(0.5)

            if self.detect_rate_limit():
                raise RateLimitException(f"Rate limit detected when accessing {url}")

            return True

        except RateLimitException:
            raise
        except Exception:
            if retry_count > 0:
                time.sleep(2)
                return self.safe_get_page(url, retry_count - 1)
            else:
                return False
