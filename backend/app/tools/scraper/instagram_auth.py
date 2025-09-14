import base64
import json
from typing import Optional
from selenium.webdriver.chrome.webdriver import WebDriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
import time
from app.tools.scraper.scraper_exceptions import LoginFailedException
from .config import ScraperConfig
from ..logger import logger


class InstagramAuth:
    def __init__(self, driver: WebDriver, wait: WebDriverWait, config: ScraperConfig):
        self.driver = driver
        self.wait = wait
        self.config = config
        self.logger = logger

        self.current_cookie_index = 0

    def login(self):
        """Main method to log into Instagram with credentials or cookies."""
        try:
            if self.config.cookies_list[self.current_cookie_index]:
                self.logger.info("Attempting login with cookies.")
                self._login_with_cookies()
            else:
                self.logger.info("Attempting login with username and password.")
                self._login_with_credentials()
        except Exception as e:
            raise LoginFailedException(f"Login failed: {e}")

    def _login_with_cookies(self) -> None:
        """Log into Instagram using cookies."""
        self.driver.delete_all_cookies()
        self.driver.get("https://www.instagram.com/")

        decoded_cookies = base64.b64decode(
            self.config.cookies_list[self.current_cookie_index],
        )
        cookies = json.loads(decoded_cookies.decode("utf-8"))

        for cookie in cookies:
            self.driver.add_cookie(cookie)

        self.driver.refresh()
        self.logger.info("Logged in with cookies successfully.")

    def _login_with_credentials(self):
        """Log into Instagram using username and password."""
        if not self.config.username or not self.config.password:
            raise LoginFailedException("Username or password not provided.")

        self.driver.get("https://www.instagram.com")

        self._accept_cookies()

        username_field = self.wait.until(
            EC.visibility_of_element_located((By.NAME, "username"))
        )
        password_field = self.wait.until(
            EC.visibility_of_element_located((By.NAME, "password"))
        )
        username_field.send_keys(self.config.username)
        password_field.send_keys(self.config.password)

        password_field.send_keys("\n")  # Simulates Enter press

        logger.info("Login credentials sent.")

        time.sleep(5)

        error_message = self._check_login_error()

        if error_message:
            raise LoginFailedException(f"Login failed: {error_message}")

    def swap_cookies(self):
        """Switch to the next cookie/account when rate limited."""
        self.current_cookie_index = (self.current_cookie_index + 1) % len(
            self.config.cookies_list
        )

        try:
            self.driver.delete_all_cookies()
            decoded_cookies = base64.b64decode(
                self.config.cookies_list[self.current_cookie_index]
            )
            cookies = json.loads(decoded_cookies.decode("utf-8"))

            for cookie in cookies:
                self.driver.add_cookie(cookie)

            self.driver.refresh()
            time.sleep(5)
        except Exception as e:
            raise LoginFailedException(f"Error while swapping cookies: {e}")

    def _accept_cookies(self):
        """Handles the cookie popup."""
        try:
            accept_button = self.wait.until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//button[contains(text(),'Allow all cookies')]")
                )
            )
            accept_button.click()
            self.logger.info("External Cookies accepted.")
        except Exception as e:
            self.logger.error(f"Cookies button not found or couldn't be clicked: {e}")

    def _check_login_error(self) -> Optional[str]:
        """Check if there is an error message after login attempt."""
        try:
            error_element = self.driver.find_element(By.CLASS_NAME, "_ab2z")
            if error_element:
                return error_element.text
        except Exception:
            return None
