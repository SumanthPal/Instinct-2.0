from typing import Optional
from selenium import webdriver
import os
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager
from app.tools.scraper.config import ScraperConfig
from tools.logger import logger
import random


class WebDriverManager:
    def __init__(self, config: ScraperConfig):
        self.config = config
        self._driver: Optional[webdriver.Chrome] = None
        self._wait: Optional[WebDriverWait] = None
        self.logger = logger

    def create_driver(self) -> webdriver.Chrome:
        """Create and return a configured Chrom WebDriver instance."""
        options = self._create_options()
        service = self._create_service()

        self._driver = webdriver.Chrome(service=service, options=options)
        self._wait = WebDriverWait(self._driver, 5)

        return self._driver

    def _create_options(self) -> Options:
        """Create Chrome options with all necessary flags."""
        options = Options()
        args = [
            f"user-agent={random.choice(self.config.USER_AGENTS)}",
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

        if self.config.headless:
            args.append("--headless")

        for arg in args:
            options.add_argument(arg)

        options.add_experimental_option(
            "prefs", {"profile.default_content_setting_values.images": 2}
        )
        options.add_experimental_option(
            "excludeSwitches", ["enable-logging", "enable-automation"]
        )
        options.add_experimental_option("useAutomationExtension", False)

        return options

    def _create_service(self) -> Service:
        """Create Chrome service based on environment."""
        if os.environ.get("DOCKER_ENV") or os.environ.get("CI"):
            chromedriver_path = os.environ.get(
                "CHROMEDRIVER_PATH", "/usr/bin/chromedriver"
            )
            logger.info(f"Running in Docker/CI environment. Using system ChromeDriver")
            logger.debug(f"ChromeDriver path: {chromedriver_path}")

            return Service(executable_path=chromedriver_path)
        else:
            logger.info("Running in local environment. Using WebDriver Manager")
            return Service(ChromeDriverManager().install())

    def quit(self):
        """Safely quit the driver."""
        if self._driver:
            self._driver.quit()
            self._driver = None
            self._wait = None
            self.logger.info("WebDriver has been quit successfully.")
