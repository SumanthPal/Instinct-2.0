import os
from typing import List
from .config import ScraperConfig
from .webdriver_manager import WebDriverManager
from .instagram_auth import InstagramAuth
from .rate_limit_detector import RateLimitDetector
from .profile_scraper import ProfileScraper
from .post_scraper import PostScraper
from db.queries import SupabaseQueries
from .scraper_exceptions import RateLimitException, ProfileNotFoundException
from typing import Optional
import datetime


class InstagramService:
    def __init__(self, config: ScraperConfig):
        self.config = config
        self.db = SupabaseQueries()
        self.driver_manager: Optional[WebDriverManager] = None
        self.auth: Optional[InstagramAuth] = None
        self.rate_detector: Optional[RateLimitDetector] = None
        self.profile_scraper: Optional[ProfileScraper] = None
        self.post_scraper: Optional[PostScraper] = None

    def initialize(self):
        """Initialize all components."""
        self.driver_manager = WebDriverManager(self.config)
        driver = self.driver_manager.create_driver()
        wait = self.driver_manager._wait

        self.auth = InstagramAuth(driver, wait, self.config)
        self.rate_detector = RateLimitDetector(driver)
        self.profile_scraper = ProfileScraper(driver, wait, self.rate_detector)
        self.post_scraper = PostScraper(driver, wait, self.rate_detector)

    def login(self):
        """Login to Instagram."""
        if not self.auth:
            raise Exception("Service not initialized. Call initialize() first.")
        self.auth.login()

    def scrape_club_data(self, username: str) -> bool:
        """Main method for scraping and storing club data."""
        try:
            username = username[1:] if username.startswith("@") else username

            # Check if profile exists
            if not self._profile_exists(username):
                raise ProfileNotFoundException(f"Profile {username} not found")

            # Scrape profile data
            club_info = self.profile_scraper.scrape_profile(username)

            # Save to database
            self._save_club_info(club_info)
            self._save_post_info(username)

            return True

        except Exception as e:
            raise Exception(f"Error scraping {username}: {str(e)}")

    def _profile_exists(self, username: str) -> bool:
        """Check if Instagram profile exists."""
        try:
            profile_url = f"https://www.instagram.com/{username}/"
            return self.rate_detector.safe_get_page(profile_url)
        except:
            return False

    def _save_club_info(self, club_info: dict):
        """Save club information to database."""
        try:
            instagram_handle = club_info["Instagram Handle"]
            club_pfp_url = club_info["Profile Picture"]
            pfp_path = f"pfps/{instagram_handle}.jpg"
            storage_path = self.db.download_and_upload_img(club_pfp_url, pfp_path)

            club_info["profile_image_path"] = storage_path

            club_id = self.db.upsert_club(club_info)

            # Store post links in the database
            if club_info[0]["Recent Posts"] and club_id:
                self._store_post_links(club_id, club_info["Recent Posts"])

            return club_id

        except Exception as e:
            # ERROR HANDLING HERE...
            return None

    def _store_post_links(self, club_id: str, post_links: list):
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

                except Exception as e:
                    continue

        except Exception as e:
            pass

    def cleanup(self):
        """Clean up resources."""
        if self.driver_manager:
            self.driver_manager.quit()

    def save_post_info(self, club_username: str):
        """Process and save post information to the database"""
        try:
            # Get club ID from database
            club_id = self.db.get_club_by_instagram_handle(club_username)
            if not club_id:
                return

            # Get unprocessed post links from database - ALREADY GOOD
            post_links_response = self.db.get_unscrapped_posts_by_club_id(club_id)

            if not post_links_response:
                return

            for post_data in post_links_response:
                post_url = post_data["post_url"]
                post_id = post_data["id"]

                if self.db.check_if_post_is_scrapped(post_id):
                    continue

                try:
                    # Scrape post information
                    description, date, post_pic = self.post_scraper.scrape_post(
                        post_url
                    )

                    instagram_storage_path = f"posts/{club_username}/{post_id}"

                    uploaded_path = self.db.download_and_upload_img(
                        post_pic, instagram_storage_path
                    )

                    # Update post in database
                    update_data = {
                        "caption": description,
                        "posted": date,
                        "image_url": post_pic,
                        "scrapped": True,
                        "image_path": uploaded_path,
                    }

                    self.db.update_post_by_id(post_id, update_data)

                except Exception as e:
                    continue

        except Exception as e:
            pass
