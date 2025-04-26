import os
import time
import sys
import datetime
import random
import dotenv
from typing import List, Dict
import schedule
from concurrent.futures import ThreadPoolExecutor
import threading
from queue import Queue

# Import your existing tools
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.logger import logger
from db.queries import SupabaseQueries
from tools.insta_scraper import InstagramScraper, scrape_with_retries, scrape_sequence, RateLimitDetected
from tools.ai_validation import EventParser
from tools.calendar_connection import CalendarConnection
from tools.redis_queue import RedisScraperQueue

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LOG_FILE_PATH = os.path.join(BASE_DIR, 'logs', 'logfile.log')

class ScraperRotation:
    def __init__(self):
        """Initialize the scraper rotation manager"""
        dotenv.load_dotenv()
        self.db = SupabaseQueries()
        self.clubs_per_session = 40
        self.cooldown_hours = 24  # Don't scrape same club more than once every 3 days
        self.session_cooldown_hours = 2  # Wait between sessions
        self.max_threads = 1  # Start with 1 thread (can be increased based on Heroku dyno)
        self.queue = RedisScraperQueue()
    
    def populate_queue(self):
        """Get clubs from database and add to queue"""
        logger.info("Starting to populate queue...")

        clubs_to_scrape = self.get_clubs_to_scrape()
        for username in clubs_to_scrape:
            self.queue.enqueue_club(username)
        
        logger.info(f"Finished populating queue with {clubs_to_scrape}")


    
    def start_event_processing_thread(self):
        """Start a separate thread for processing events"""
        self.event_thread = threading.Thread(
            target=self.event_processing_worker,
            daemon=True
        )
        self.event_thread.start()
        logger.info("Started event processing thread")

    def event_processing_worker(self):
        """Worker function that runs in a separate thread to process events"""
        while True:
            try:
                # Get the next club from the event processing queue
                job = self.queue.get_next_event_job()
                if not job:
                    # No job available, sleep and try again
                    time.sleep(10)
                    continue
                    
                instagram_handle = job['instagram_handle']
                
                try:
                    logger.info(f"Processing events for {instagram_handle}")
                    
                    # Create the event parser and calendar
                    parser = EventParser()
                    calendar = CalendarConnection()
                    
                    # Parse posts and create calendar
                    parser.parse_all_posts(instagram_handle)
                    calendar.create_calendar_file(instagram_handle)
                    
                    # Mark job as complete
                    self.queue.mark_event_complete(instagram_handle)
                    
                except Exception as e:
                    logger.error(f"Error processing events for {instagram_handle}: {e}")
                    self.queue.mark_event_failed(instagram_handle, error=str(e))
                    
            except Exception as e:
                logger.error(f"Error in event processing worker: {e}")
                time.sleep(30)  # Sleep before retrying
    def check_recent_rate_limits(self, window_minutes=30) -> int:
        """
        Checks for recent rate limits and returns an intensity level:
        - 0 => No issues
        - 1 => Mild (1-2 rate limits recently)
        - 2 => Severe (3+ rate limits recently)
        """
        try:
            with open(LOG_FILE_PATH, 'r') as f:
                lines = f.readlines()

            now = datetime.datetime.now()
            count = 0
            for line in reversed(lines):
                if "Possible rate limit detected" in line:
                    timestamp_str = line.split(' - ')[0]
                    try:
                        timestamp = datetime.datetime.fromisoformat(timestamp_str)
                        if (now - timestamp).total_seconds() <= window_minutes * 60:
                            count += 1
                        else:
                            break  # No need to go further back
                    except Exception:
                        continue
                
            if count >= 3:
                return 2  # Severe
            elif count >= 1:
                return 1  # Mild
            else:
                return 0  # No rate limits
                
        except Exception as e:
            logger.error(f"Error checking for rate limits: {e}")
            return 0

                
    def process_queue(self):
        """Process clubs from the queue."""
        logger.info("Starting to process queue...")

        while True:
            # Requeue stuck jobs
            self.queue.requeue_stalled()
            self.queue.requeue_stalled_event_jobs()

            job = self.queue.get_next_club()

            if not job:
                logger.info("Queue empty. Sleeping 6 hours before retrying...")
                time.sleep(6 * 60 * 60)  # Sleep for 6 hours
                logger.info("Waking up and repopulating queue...")
                self.populate_queue()
                continue

            instagram_handle = job['instagram_handle']
            logger.info(f"Processing club {instagram_handle}...")

            try:
                scraper = InstagramScraper(
                    os.getenv("INSTAGRAM_USERNAME"), 
                    os.getenv("INSTAGRAM_PASSWORD")
                )
                scraper.login()

                scraper = scrape_with_retries(scraper, instagram_handle)

                self.update_club_last_scraped(instagram_handle)
                self.queue.enqueue_event_job(instagram_handle)
                self.queue.mark_complete(instagram_handle)

                delay = random.uniform(2, 5)
                time.sleep(delay)

                rate_limit_level = self.check_recent_rate_limits()

                if rate_limit_level == 2:
                    logger.warning("🚨 Severe rate limits detected! Cooling down for 12 hours...")
                    time.sleep(12 * 60 * 60)
                    continue
                elif rate_limit_level == 1:
                    logger.warning("⚠️ Mild rate limits detected. Cooling down for 6 hours...")
                    time.sleep(6 * 60 * 60)
                    continue

            except RateLimitDetected as rl:
                logger.error(f"🚨 [RATE LIMIT DETECTED] Cooling down scraper for 12 hours... {rl}")
                self.queue.requeue_job(instagram_handle)
                time.sleep(12 * 60 * 60)

            except Exception as e:
                logger.error(f"Error scraping {instagram_handle}: {e}")
                self.queue.mark_failed(instagram_handle, error=str(e))

                        
            
    def get_clubs_to_scrape(self) -> List[str]:
        """
        Get a list of Instagram handles to scrape, prioritizing:
        1. Clubs that have never been scraped
        2. Clubs that were scraped longest time ago
        """
        clubs_to_scrape = []
        
        try:
            # First: Get clubs that have never been scraped
            response = self.db.supabase.rpc('get_never_scraped_clubs', {
                'limit_num': self.clubs_per_session
            }).execute()

            if response.data:
                never_scraped = response.data
                clubs_to_scrape = [club["instagram_handle"] for club in never_scraped]
            
            # Second: If not enough, get oldest scraped clubs
            if len(clubs_to_scrape) < self.clubs_per_session:
                remaining = self.clubs_per_session - len(clubs_to_scrape)
                cooldown_time = datetime.datetime.now() - datetime.timedelta(hours=self.cooldown_hours)

                response = self.db.supabase.rpc('get_oldest_scraped_clubs', {
                    'cooldown_time': cooldown_time.isoformat(),
                    'limit_num': remaining
                }).execute()

                if response.data:
                    oldest_scraped = response.data
                    clubs_to_scrape.extend([club["instagram_handle"] for club in oldest_scraped])

            logger.info(f"Selected {len(clubs_to_scrape)} clubs for scraping.")
            return clubs_to_scrape

        except Exception as e:
            logger.error(f"Error selecting clubs to scrape: {e}")
            return []

    
    def update_club_last_scraped(self, instagram_handle: str):
        """Update the last_scraped timestamp for a club"""
        try:
            now = datetime.datetime.now().isoformat()
            self.db.supabase.table("clubs").update(
                {"last_scraped": now}
            ).eq("instagram_handle", instagram_handle).execute()
            logger.info(f"Updated last_scraped for {instagram_handle}")
        except Exception as e:
            logger.error(f"Error updating last_scraped for {instagram_handle}: {e}")
    
    def scrape_club_batch(self, usernames: List[str]):
        """Scrape a batch of clubs with a single scraper instance"""
        if not usernames:
            return []
            
        successful_scrapes = []
        try:
            # Initialize scraper
            scraper = InstagramScraper(
                os.getenv("INSTAGRAM_USERNAME"), 
                os.getenv("INSTAGRAM_PASSWORD")
            )
            scraper.login()
            
            # Process each club
            logger.info(f"Processing batch of {len(usernames)} clubs...")
            for username in usernames:
                try:
                    logger.info(f"Scraping {username}...")
                    scraper = scrape_sequence([scrape_sequence])
                    
                    # Update last_scraped timestamp in database
                    self.update_club_last_scraped(username)
                    successful_scrapes.append(username)
                    
                    # Random delay between scrapes to avoid detection
                    delay = random.uniform(2, 5)
                    time.sleep(delay)
                    
                except Exception as e:
                    logger.error(f"Error scraping {username}: {e}")
                    continue
            
            # Clean up
            logger.info(f"Successfully scraped {username}")
            
            scraper._driver_quit()
            
        except Exception as e:
            logger.error(f"Batch error: {e}")
        
        return successful_scrapes
    
    def run_scraping_session(self):
        """Run a complete scraping session with batched processing"""
        start_time = datetime.datetime.now()
        logger.info(f"Starting scraping session at {start_time}")
        
        
        try:
            # Get clubs to scrape
            clubs_to_scrape = self.get_clubs_to_scrape()
            if not clubs_to_scrape:
                logger.info("No clubs to scrape at this time")
                return
                
            # Divide clubs into batches for parallel processing
            batch_size = len(clubs_to_scrape) // self.max_threads
            if batch_size == 0:
                batch_size = 1
                
            batches = [clubs_to_scrape[i:i + batch_size] for i in range(0, len(clubs_to_scrape), batch_size)]
            logger.info(f"Divided {len(clubs_to_scrape)} clubs into {len(batches)} batches")
            
            # Process batches
            successful_scrapes = []
            
            if self.max_threads > 1:
                # Parallel processing with ThreadPoolExecutor
                with ThreadPoolExecutor(max_workers=self.max_threads) as executor:
                    futures = [executor.submit(self.scrape_club_batch, batch) for batch in batches]
                    
                    for future in futures:
                        successful_scrapes.extend(future.result())
            else:
                # Sequential processing
                for batch in batches:
                    successful_scrapes.extend(self.scrape_club_batch(batch))
            
            # Process events for successful scrapes
            self.process_events(successful_scrapes)


            
        except Exception as e:
            logger.error(f"Session error: {e}")
        finally:
            end_time = datetime.datetime.now()
            duration = end_time - start_time
            logger.info(f"Scraping session completed in {duration}. Sleeping until next session.")
            self.db.supabase.rpc('refresh_club_search_vector').execute()

    
    def process_events(self, usernames: List[str]):
        """Process events for the successfully scraped clubs"""
        try:
            # Create the event parser
            parser = EventParser()
            calendar = CalendarConnection()
            
            for username in usernames:
                try:
                    logger.info(f"Parsing posts for {username}")
                    parser.parse_all_posts(username)
                    
                    # Generate calendar files
                    logger.info(f"Generating calendar for {username}")
                    calendar.create_calendar_file(username)
                    
                except Exception as e:
                    logger.error(f"Error processing events for {username}: {e}")
        except Exception as e:
            logger.error(f"Error in process_events: {e}")
    
    def calculate_next_scrape(self, instagram_handle: str) -> datetime.datetime:
        """
        Calculate the next scheduled scrape time for a club based on activity level
        
        This is a more advanced feature that can be used later to optimize scraping schedule
        """
        try:
            # Get the club info
            club = self.db.get_club_by_instagram(instagram_handle)
            if not club:
                return datetime.datetime.now() + datetime.timedelta(hours=self.cooldown_hours)
                
            # Get the posts count and last post date
            post_count = club.get("post_count", 0)
            followers = club.get("followers", 0)
            
            # Calculate the base scrape frequency in hours
            # More followers and posts = scrape more frequently
            base_frequency = self.cooldown_hours
            
            # Adjust for follower count (popular clubs get scraped more often)
            if followers > 1000:
                base_frequency *= 0.7  # 30% reduction in time between scrapes
            elif followers > 500:
                base_frequency *= 0.85  # 15% reduction
                
            # Adjust for post frequency
            if post_count > 100:
                base_frequency *= 0.8  # 20% reduction for active clubs
                
            # Calculate the next scrape time
            last_scraped = club.get("last_scraped")
            if last_scraped:
                # Convert string to datetime if needed
                if isinstance(last_scraped, str):
                    last_scraped = datetime.datetime.fromisoformat(last_scraped.replace('Z', '+00:00'))
                
                next_scrape = last_scraped + datetime.timedelta(hours=base_frequency)
            else:
                next_scrape = datetime.datetime.now()
                
            return next_scrape
            
        except Exception as e:
            logger.error(f"Error calculating next scrape for {instagram_handle}: {e}")
            # Default to cooldown period
            return datetime.datetime.now() + datetime.timedelta(hours=self.cooldown_hours)
    
    def schedule_scraping(self):
        """Schedule regular scraping sessions"""
        # Run initial session immediately
        self.run_scraping_session()
        
        # Schedule future sessions
        schedule.every(self.session_cooldown_hours).hours.do(self.run_scraping_session)
        
        # Keep the scheduler running
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    
    def run(self):
        """Main method to run the scraper rotation"""
        # Start the event processing thread
        self.start_event_processing_thread()
        
        while True:
            try:
                # Populate the queue with fresh clubs
                self.populate_queue()
                
                # Process the queue
                self.process_queue()
                
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(60)  # Sleep before retrying


if __name__ == "__main__":
    rotation = ScraperRotation()
    
    # Check if running in Heroku
    # if os.environ.get("DYNO"):
    #     # In Heroku, determine thread count based on dyno type
    #     dyno_type = os.environ.get("DYNO_TYPE", "").lower()
    #     if "performance" in dyno_type:
    #         rotation.max_threads = 4  # More threads for Performance dynos
    #     elif "standard-2x" in dyno_type:
    #         rotation.max_threads = 2  # 2 threads for Standard-2X
    #     else:
    #         rotation.max_threads = 1  # Default to 1 thread for basic dynos
    # rotation = ScraperRotation()
    rotation.run()
    
    # Start the rotation
    #rotation.schedule_scraping()