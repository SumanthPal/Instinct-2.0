from concurrent.futures import ThreadPoolExecutor
import json
import os
import random
import re
import time
import sys
import dotenv
import base64
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.common.exceptions import WebDriverException, NoSuchElementException, TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from pathlib import Path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', )))
from tools.logger import logger

from db.queries import SupabaseQueries
import boto3
import datetime
import tempfile

# Create a random temporary directory

#import chromedriver_binary  # This automatically sets up ChromeDriver

class RateLimitDetected(Exception):
    """Raised when a potential rate limit is detected during scraping."""
    pass


class InstagramScraper:
    def __init__(self, username, password):
        self._username = username
        self._password = password
        self._current_page = "none"
        self._db = SupabaseQueries()

        options = Options()
        self.db = SupabaseQueries()
        self.user_data_dir = tempfile.mkdtemp()
        self._add_options(options, self.user_data_dir)
        self.working_path = os.path.join(os.path.dirname(__file__), '..')

        # Initialize WebDriver with options
        logger.info("Initializing WebDriver")
        self._driver = self._create_driver(options)
        logger.info("WebDriver successfully initialized")
        self._wait = WebDriverWait(self._driver, 5)
        self.cookies_list = [
            os.getenv('COOKIE_1'),
            os.getenv('COOKIE_2')
        ]
        self.current_cookie_index = 0  # Start from the first cookie
                
                
    
    def _create_driver(self, chrome_options):
        # Initialize WebDriver
        #For heroku: '/app/.chrome-for-testing/chromedriver-linux64/chromedriver'
        service = Service()
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        return driver
    
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self._driver_quit()
    
    def swap_cookies(self):
        """Switch to the next cookie/account when rate limited."""
        self.current_cookie_index = (self.current_cookie_index + 1) % len(self.cookies_list)
        logger.warning(f"🔄 Swapping to cookie account #{self.current_cookie_index + 1}...")

        try:
            self._driver.delete_all_cookies()
            decoded_cookies = base64.b64decode(self.cookies_list[self.current_cookie_index])
            cookies = json.loads(decoded_cookies.decode('utf-8'))
            for cookie in cookies:
                self._driver.add_cookie(cookie)
            
            self._driver.refresh()
            time.sleep(5)  # Give some time to reload
            logger.info("Cookies swapped and page refreshed successfully.")
        except Exception as e:
            logger.error(f"Error while swapping cookies: {e}")


    def login(self) -> None:
        """
        Main method to log into Instagram with credentials. Creates a cookies.json file to store cookies.
        :return: None
        """
        try:
            
           
            if self.cookies_list[self.current_cookie_index]:
                self._driver.delete_all_cookies()
                logger.info(f"Cookies found for account {self.current_cookie_index + 1}. Loading...")
                self._driver.get("https://www.instagram.com/")

                decoded_cookies = base64.b64decode(self.cookies_list[self.current_cookie_index])
                cookies = json.loads(decoded_cookies.decode('utf-8'))
                
                for cookie in cookies:
                    self._driver.add_cookie(cookie)

                logger.info("Cookies loaded.")
                self._driver.refresh()

            else:
                logger.info("No cookies file found. Logging in...")
                self._driver.get("https://www.instagram.com")

                self._accept_cookies()
                username_field = self._wait.until(EC.visibility_of_element_located((By.NAME, "username")))
                password_field = self._wait.until(EC.visibility_of_element_located((By.NAME, "password")))

                # Send login credentials
                username_field.send_keys(self._username)
                password_field.send_keys(self._password)
                password_field.send_keys("\n")  # Simulate pressing Enter
                logger.info("Login credentials sent.")
                time.sleep(5)

                # Check if login was successful or failed
                error_message = self._check_login_error()
                if error_message:
                    self._driver_quit()
                    raise Exception(f"{error_message}")

                self._get_cookies()

        except WebDriverException as e:
            logger.error(f"Error during login: {e}", exc_info=True)
            self._driver_quit()

    def store_club_data(self, club_username: str) -> bool:
        """
        Main method for scraping and storing club and post data.
        :param club_username: the instagram tag of the club
        """
        try:
            club_username = club_username[1:] if club_username.startswith('@') else club_username
            club_info = self.get_club_info(club_username)
            
            self.save_club_info(club_info)
            self.save_post_info(club_username)
            return True
        except AttributeError as e:
            logger.error(f"Enter a valid username {club_username}")
            return False
        

    def get_club_info(self, club_username: str) -> dict:
        """Main scraper method to get club info
        :param club_username: the instagram tag of the club
        :return club_info: a dictionary containing the club's information
        """
        try:

            profile_url = f"https://www.instagram.com/{club_username}/"
            self._driver.get(profile_url)
            # if not self.check_instagram_handle(club_username):
            #     raise Exception("Invalid Instagram handle.")
            
            self._handle_instagram_more_button()
            club_links = self._handle_instagram_links_button()

            page_source = self._driver.page_source
            profile_soup = BeautifulSoup(page_source, 'html.parser')

            club_name, pfp_url = self._find_club_name_pfp(profile_soup, club_username)
            club_description, followers_count, following_count, posts_count = self._find_club_description(profile_soup)
            post_links = self._find_club_post_links(profile_soup)


            return {"Instagram Handle": club_username,
                    "Club Name": club_name,
                    "Profile Picture": pfp_url,
                    "Description": club_description,
                    "Followers": followers_count,
                    "Following": following_count,
                    "Post Count": posts_count,
                    "Club Links": club_links,
                    "Recent Posts": post_links},

        except WebDriverException as e:
            logger.error(f"Error fetching club info: {e}")
            self._driver_quit()

    
    def get_post_info(self, post_url: str) -> tuple:
        """Main method to scrape post information."""
        description = ""
        date = ""

        try:
            self._driver.get(post_url)
            self._wait.until(EC.presence_of_element_located((By.XPATH,
                                                             "//h1[contains(@class, '_ap3a') and contains(@class, '_aaco') and contains(@class, '_aacu')]")))
            
            post_source = self._driver.page_source
            post_soup = BeautifulSoup(post_source, 'html.parser')

            # Looks for post description
            h1_element = post_soup.find('h1', class_="_ap3a _aaco _aacu _aacx _aad7 _aade")
            description = h1_element.text if h1_element else ""
            logger.info(f"description found!: {description}") if description else logger.info(f"no description found!")



            # looks for post time
            post_time = post_soup.find('time', class_="_a9ze _a9zf")
            date = post_time['datetime']
            img_src = 0
            logger.info(f"date found!: {date}") if date else logger.info(f"no date found!")

            
            # look for post pic
            img_tag = post_soup.find('img', class_="x5yr21d xu96u03 x10l6tqk x13vifvy x87ps6o xh8yej3")

            if not img_tag:
                logger.warning("Image source missing, possible rate limit.")
                raise RateLimitDetected("Instagram rate limit suspected: no image found.")

            img_src = img_tag.get('src', 'http://www.w3.org/2000/svg')
            
            
        except WebDriverException as e:
            logger.error(f"Error fetching post info: {str(e)}")
            

        return description, date, img_src
    
    

    def save_post_info(self, club_username: str):
        """Process and save post information to the database"""
        try:
            # Get club ID from database
            club_id = self.db.get_club_by_instagram_handle(club_username)
            if not club_id:
                logger.error(f"Club {club_username} not found in database")
                return
            
            # Get unprocessed post links from database - ALREADY GOOD
            post_links_response = self.db.get_unscrapped_posts_by_club_id(club_id)
            
            if not post_links_response:
                logger.info(f"No unprocessed posts found for {club_username}")
                return
                
            for post_data in post_links_response:
                post_url = post_data["post_url"]
                post_id = post_data["id"]
                
                # NEW: Double-check if post was marked as scrapped by another process
                if self.db.check_if_post_is_scrapped(post_id):
                    logger.info(f"Post {post_id} already scrapped, skipping...")
                    continue
                    
                try:
                    # Scrape post information
                    description, date, post_pic = self.get_post_info(post_url)
                    
                    # Update post in database
                    update_data = {
                        "caption": description,
                        "posted": date,
                        "image_url": post_pic,
                        "scrapped": True,
                    }
                    
                    self.db.update_post_by_id(post_id, update_data)
                    logger.info(f"Updated post {post_id} in database")
                    
                except Exception as e:
                    logger.error(f"Error processing post {post_id}: {str(e)}")
                    continue
                
        except Exception as e:
            logger.error(f"Error in save_post_info: {str(e)}")
                
    # def get_club_categories(self, instagram_handle: str) -> list:
    #     """Get the club's categories from the manifest file"""
    #     try:
    #         manifest_path = os.path.join(self.working_path, 'club_manifest.json')
            
    #         if not os.path.exists(manifest_path):
    #             logger.warning(f"Manifest file not found: {manifest_path}")
    #             return []
                
    #         with open(manifest_path, 'r') as f:
    #             manifest = json.load(f)
                
    #         for club in manifest:
    #             if club.get("instagram") == instagram_handle:
    #                 return club.get("categories", [])
                    
    #         logger.warning(f"Club {instagram_handle} not found in manifest")
    #         return []
    #     except Exception as e:
    #         logger.error(f"Error getting club categories: {str(e)}")
    #         return []

    def save_club_info(self, club_info: dict):
        """Save the club information and post links to the database"""
        try:
            # Get club categories from manifest
            
            instagram_handle = club_info[0]["Instagram Handle"]
            

            club_id = self.db.upsert_club(club_info[0])
            logger.info('inserted data')
            
             
            # Store post links in the database
            logger.info(club_info)
            if club_info[0]['Recent Posts'] and club_id:
                self._store_post_links(club_id, instagram_handle, club_info[0]["Recent Posts"])
                
            logger.info(f"Club info for {instagram_handle} saved to database.")
            return club_id
        except Exception as e:
            logger.error(f"Error saving club info to database: {str(e)}\n type of error {type(e)}" )
            return None

    def _store_post_links(self, club_id: str, club_username: str, post_links: list):
        """Store post links in the database with minimal information"""
        try:
            for post_url in post_links:
                try:
                    # Extract Instagram post ID from URL
                    instagram_post_id = post_url.split('/')[-2]
                    
                    # Check if post already exists
                    existing_post = self.db.get_post_by_instagram_id(instagram_post_id)
                    
                    if existing_post:
                        logger.info(f"Post {instagram_post_id} already exists in database")
                        continue
                    
                    # Create a minimal post entry with just the URL and ID
                    post_data = {
                        "club_id": club_id,
                        "determinant": instagram_post_id,
                        "post_id": instagram_post_id,
                        "post_url": post_url,
                        "created_at": datetime.datetime.now().isoformat(),
                        "scrapped": False  # Flag to indicate content hasn't been processed yet
                    }
                    
                    # Insert the post
                    self.db.insert_post_link(post_data)
                    logger.info(f"Post link {instagram_post_id} stored in database")
                    
                except Exception as e:
                    logger.error(f"Error storing post link {post_url}: {str(e)}")
                    continue
                    
            logger.info(f"Stored {len(post_links)} post links for {club_username}")
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
                        (By.XPATH, "//span[contains(text(), \"Sorry, this page isn't available.\")]")
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
    def _handle_instagram_links_button(self):
        #TODO: fix this shitter
        try:
            # Wait for the button to be present, but allow for a possible timeout
            # check if there is only one link:
            try:
                link_element = self._wait.until(EC.presence_of_element_located(
                    (By.XPATH, "//a[@rel='me nofollow noopener noreferrer' and @target='_blank']")))
                
                return [{'text': link_element.get_attribute('text'), 'url':link_element.get_attribute('href')}]
            except TimeoutException:
                pass
            self._wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'button._acan._acao._acas._aj1-._ap30')))

            # Find the button and click it if it's found
            button = self._driver.find_element(By.CSS_SELECTOR, 'button._acan._acao._acas._aj1-._ap30')
            button.click()
            logger.info("Links button clicked successfully.")

            self._wait.until(EC.presence_of_element_located(
                (By.XPATH, "//a[@rel='me nofollow noopener noreferrer' and @target='_blank']")))
            links = self._driver.find_elements(By.XPATH,
                                               "//a[@rel='me nofollow noopener noreferrer' and @target='_blank']")
            logger.info("Links found successfully.")
            urls = []
            for link in links:
                text = link.text.strip().replace('Link icon', '').strip()
                url = link.get_attribute('href')
                urls.append({'text': text, 'url': url})

            logger.info("URLs extracted successfully.")

            close_button = self._driver.find_element(By.CSS_SELECTOR, 'div[aria-label="Close"]')
            close_button.click()
            logger.info("Close button clicked successfully.")

            return urls

        except TimeoutException:
            # This will catch the case where the element is not found within the timeout
            logger.warning("Links button not found within the timeout.")

        except Exception as e:
            # Catch any other unexpected exceptions
            logger.error(f"An error occurred while trying to interact with the links button: {e}")

    def _handle_instagram_more_button(self):
        try:
            self._wait.until(EC.presence_of_all_elements_located((By.XPATH, "//a[contains(@href, '/p/')]")))
            button_element = self._wait.until(EC.presence_of_element_located(
                (By.XPATH, "//span[contains(@class, 'x1lliihq') and text()='more']")))

            button_element.click()
            logger.info("Button for more info clicked!")
        except (NoSuchElementException, TimeoutException):
            logger.info("More... button not found / timeout error.")

    def _find_club_name_pfp(self, profile_soup: BeautifulSoup, club_username: str):
        club_name = profile_soup.find("span", class_="x1lliihq x1plvlek xryxfnj x1n2onr6 x1ji0vk5 x18bv5gf "
                                                     "x193iq5w xeuugli x1fj9vlw x13faqbe x1vvkbs x1s928wv xhkezso "
                                                     "x1gmr53x x1cpjm7i x1fgarty x1943h6x x1i0vuye xvs91rp "
                                                     "x1s688f x5n08af x10wh9bi x1wdrske x8viiok x18hxmgj").text
        club_tag = profile_soup.find("img", alt=f"{club_username}'s profile picture")
        if not club_tag:
            raise Exception("Profile picture not found.")
        pfp_url = club_tag.get("src")
        return club_name, pfp_url

    def _find_club_description(self, profile_soup: BeautifulSoup):
        meta_tag = profile_soup.find('meta', {'name': 'description'})
        if not meta_tag:
            raise Exception("Description not found.")

        description = meta_tag.get('content', '')

        parts = description.split(' - ')

        # Extract follower, following, and post counts

        counts = parts[0].split(', ')
        followers_count = counts[0].split(' ')[0].replace(',', '')
        logger.info("obtained follower count...")
        following_count = counts[1].split(' ')[0].replace(',', '')
        logger.info("obtained following count...")
        posts_count = counts[2].split(' ')[0].replace(',', '')
        logger.info("obtained post count...")

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
        links = profile_soup.find_all('a', href=True)

        post_links = []
        for link in links:
            href = link['href']
            if '/p/' in href:
                post_url = f"https://www.instagram.com{href}"
                post_links.append(post_url)
        logger.info("obtained post links...")
        return post_links


    def _get_club_post_links(self, club_username: str) -> list:
        """
        Parses the club_info.json file to get the post links.
        param club_username:
        return: list of post links
        """
        club_info_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", club_username, "club_info.json")
        with open(club_info_path, "r") as file:
            clubs_info = json.load(file)

        return clubs_info["Recent Posts"]

    def _driver_quit(self):
        if hasattr(self, '_driver') and self._driver:
            self._driver.quit()

    def _add_options(self, option: Options, user_dir):
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
            "--headless",  # Run in headless mode for better speed
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
           f"--user-data-dir={user_data_dir}"

        ]
        for arg in args:
            option.add_argument(arg)
            
        

        # Set preferences with one call
        option.add_experimental_option("prefs", {"profile.default_content_setting_values.images": 2})

        # Exclude switches in a single call
        option.add_experimental_option("excludeSwitches", ["enable-logging", "enable-automation"])
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
            "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:85.0) Gecko/20100101 Firefox/85.0"
        ]
        return random.choice(user_agents)

  
    def _get_cookies(self):
        """DEPRECATED; requires fix"""
        try:
            save_button = self._wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'Save info')]"))
            )
            save_button.click()

            cookies = self._driver.get_cookies()
            logger.info(cookies)

            cookies_json = json.dumps(cookies)

            # Encode to base64
            encoded_cookies = base64.b64encode(cookies_json.encode()).decode()
            logger.info(encoded_cookies)

            # Save to .env file
            current_file = Path(__file__).resolve()
            env_path = current_file.parents[1] / "backend" / ".env"
            dotenv.set_key(env_path, "COOKIE", encoded_cookies)

            logger.info("Cookies saved to .env file.")

        except Exception as e:
            logger.error(f"Error saving cookies: {e}")

    def _accept_cookies(self):
        """Handles the cookie popup."""
        try:
            # Wait for the popup and try accepting it using XPath (you can try to use other methods like CSS selectors too)
            accept_button = self._wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'Allow all cookies')]"))
            )
            # Perform a click on the "Accept" button
            accept_button.click()
            logger.info("External Cookies accepted.")
        except Exception as e:
            logger.error(f"Cookies button not found or couldn't be clicked: {e}")

    def _check_login_error(self):
        """Check if there is an error message after login attempt."""
        try:
            # Look for the error message in the class "_ab2z" (Instagram's error message class)
            error_element = self._driver.find_element(By.CLASS_NAME, "_ab2z")
            if error_element:
                return error_element.text
        except Exception:
            # If no error message is found, return None (indicating no error)
            return None



def _chunk_list(lst, n):
    """Divide a list into n chunks, prioritizing evenly-sized distributions."""
    avg = len(lst) // n
    remainder = len(lst) % n
    chunks = []
    start = 0

    for i in range(n):
        extra = 1 if i < remainder else 0  # Distribute the remainder
        end = start + avg + extra
        chunks.append(lst[start:end])
        start = end

    return chunks

def scrape_with_retries(scraper, username, max_retries=3, delay=5):
    for attempt in range(max_retries):
        try:
            username = username[1:] if username.startswith('@') else username
            scraper.store_club_data(username)
            logger.info(f"Scraping of {username} complete.")
            scraper._driver_quit()
            return scraper
        except RateLimitDetected as rate_limit_exc:
            logger.warning(f"Rate limit detected during scrape of {username}: {rate_limit_exc}")
            scraper.swap_cookies()
            time.sleep(5)  # Short pause after swapping
            continue
        except Exception as e:
            logger.warning(f"Attempt {attempt + 1} failed for {username}: {e}")
            if attempt < max_retries - 1:
                time.sleep(delay)
            else:
                logger.error(f"Giving up after repeated failures for {username}. Restarting driver.")
                scraper._driver_quit()
                scraper = InstagramScraper(os.getenv("INSTAGRAM_USERNAME"), os.getenv("INSTAGRAM_PASSWORD"))
                scraper.login()
                return scraper
    

def scrape_sequence(username_list: list[str]) -> None:
    scraper = None
    try:
        logger.info(f"Starting scraper sequence for {len(username_list)} club(s)...")
        scraper = InstagramScraper(os.getenv("INSTAGRAM_USERNAME"), os.getenv("INSTAGRAM_PASSWORD"))
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
        if scraper:
            logger.info("Quitting scraper driver...")
            scraper._driver_quit()
            logger.info("Driver quit successfully.")

    

    
def multi_threaded_scrape(clubs: list[str], max_threads: int) -> None:
    club_chunks = _chunk_list(clubs, max_threads)
    logger.info(f"Launching multi-threaded scrape: {len(clubs)} clubs across {max_threads} threads.")
    
    with ThreadPoolExecutor(max_threads) as executor:
        futures = []
        for chunk in club_chunks:
            futures.append(executor.submit(scrape_sequence, chunk))

        for future in futures:
            try:
                future.result()
            except Exception as e:
                logger.error(f"An error occurred inside a thread: {e}")

    logger.info("All threads completed scraping.")

if __name__ == "__main__":

        dotenv.load_dotenv()
        starttime = time.time()
        multi_threaded_scrape(['uciavahita'], 1)
        
    


