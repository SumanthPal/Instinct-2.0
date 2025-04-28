import os
import time
import sys
import datetime
import random
import dotenv
import threading
import signal
from typing import List, Dict, Optional, Any, Union
import schedule
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
import json

# Import your existing tools
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.logger import logger
from db.queries import SupabaseQueries
from tools.insta_scraper import InstagramScraper, scrape_with_retries, scrape_sequence, RateLimitDetected
from tools.ai_validation import EventParser
from tools.calendar_connection import CalendarConnection
from tools.redis_queue import RedisScraperQueue, QueueType

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
        
        # Control flags
        self.running = False
        self.paused = False
        self.rate_limited = False
        self.rate_limit_end_time = 0
        
        # Thread references
        self.scraper_thread = None
        self.event_thread = None
        self.monitor_thread = None
        self.log_processor_thread = None
        
        # Stream reading positions
        self.last_notification_id = "0"
        self.last_status_id = "0"
        
        # Status tracking
        self.status = {
            "scraper_state": "stopped",
            "rate_limited_until": None,
            "current_job": None,
            "jobs_completed": 0,
            "jobs_failed": 0,
            "events_processed": 0,
            "events_failed": 0,
            "last_error": None,
            "last_status_update": time.time()
        }
        
        # Thread stop event
        self.stop_event = threading.Event()
    
    def start(self):
        """Start all threads and begin processing"""
        if self.running:
            logger.warning("Scraper is already running")
            return False
            
        self.running = True
        self.paused = False
        self.stop_event.clear()
        
        # Start processing threads
        self.start_event_processing_thread()
        self.start_scraper_thread()
        self.start_monitor_thread()
        self.start_log_processor_thread()
        
        # Populate queue initially
        self.populate_queue()
        
        # Set status
        self.status["scraper_state"] = "running"
        
        logger.info("Scraper rotation started successfully")
        self.queue.publish_notification("Scraper rotation started", {
            "max_threads": self.max_threads,
            "clubs_per_session": self.clubs_per_session
        })
        
        return True
    
    def stop(self):
        """Stop all threads and processing"""
        if not self.running:
            logger.warning("Scraper is not running")
            return False
        
        self.running = False
        self.stop_event.set()
        
        # Wait for threads to terminate
        threads = [
            (self.scraper_thread, "scraper"),
            (self.event_thread, "event"),
            (self.monitor_thread, "monitor"),
            (self.log_processor_thread, "log processor")
        ]
        
        for thread, name in threads:
            if thread and thread.is_alive():
                logger.info(f"Waiting for {name} thread to terminate...")
                thread.join(timeout=5.0)
                if thread.is_alive():
                    logger.warning(f"{name.capitalize()} thread did not terminate gracefully")
        
        # Update status
        self.status["scraper_state"] = "stopped"
        
        logger.info("Scraper rotation stopped")
        self.queue.publish_notification("Scraper rotation stopped", {
            "jobs_completed": self.status["jobs_completed"],
            "jobs_failed": self.status["jobs_failed"],
            "events_processed": self.status["events_processed"],
            "events_failed": self.status["events_failed"]
        })
        
        return True
    
    def pause(self):
        """Pause processing but keep threads running"""
        if not self.running:
            logger.warning("Scraper is not running, cannot pause")
            return False
            
        if self.paused:
            logger.warning("Scraper is already paused")
            return False
            
        self.paused = True
        self.status["scraper_state"] = "paused"
        
        logger.info("Scraper rotation paused")
        self.queue.publish_notification("Scraper rotation paused", {})
        
        return True
    
    def resume(self):
        """Resume processing after pause"""
        if not self.running:
            logger.warning("Scraper is not running, cannot resume")
            return False
            
        if not self.paused:
            logger.warning("Scraper is not paused, cannot resume")
            return False
            
        self.paused = False
        self.status["scraper_state"] = "running"
        
        logger.info("Scraper rotation resumed")
        self.queue.publish_notification("Scraper rotation resumed", {})
        
        return True
        
    # ---------- Thread initialization methods ----------
    
    def start_scraper_thread(self):
        """Start the scraper thread that processes club scraping jobs"""
        self.scraper_thread = threading.Thread(
            target=self.scraper_worker,
            name="scraper_worker",
            daemon=True
        )
        self.scraper_thread.start()
        logger.info("Started scraper worker thread")
    
    def start_event_processing_thread(self):
        """Start the event processing thread"""
        self.event_thread = threading.Thread(
            target=self.event_processing_worker,
            name="event_worker",
            daemon=True
        )
        self.event_thread.start()
        logger.info("Started event processing thread")
    
    def start_monitor_thread(self):
        """Start the monitoring thread that checks for stalled jobs and handles streams"""
        self.monitor_thread = threading.Thread(
            target=self.monitor_worker,
            name="monitor_worker",
            daemon=True
        )
        self.monitor_thread.start()
        logger.info("Started monitor thread")
    
    def start_log_processor_thread(self):
        """Start the log processor thread"""
        self.log_processor_thread = threading.Thread(
            target=self.log_processor_worker,
            name="log_processor",
            daemon=True
        )
        self.log_processor_thread.start()
        logger.info("Started log processor thread")
        
    # ---------- Worker thread functions ----------
    
    def scraper_worker(self):
        """Worker function that runs in a thread to process scraper jobs"""
        logger.info("Scraper worker started")
        self.queue.publish_notification("Scraper worker started", {})
        
        while self.running and not self.stop_event.is_set():
            try:
                # Check if we're paused
                if self.paused:
                    time.sleep(5)
                    continue
                
                # Check if we're rate limited
                if self.rate_limited and time.time() < self.rate_limit_end_time:
                    remaining = int(self.rate_limit_end_time - time.time())
                    logger.info(f"Rate limited. Sleeping for {remaining} more seconds.")
                    time.sleep(min(remaining, 60))  # Sleep, but check periodically for stop signals
                    continue
                elif self.rate_limited:
                    # Rate limit period has expired
                    self.rate_limited = False
                    self.status["rate_limited_until"] = None
                    logger.info("Rate limit period ended. Resuming normal operation.")
                    self.queue.publish_notification("Rate limit ended", {})
                
                # Requeue stalled jobs
                self.queue.requeue_stalled_jobs(QueueType.SCRAPER)
                
                # Get the next job
                job = self.queue.get_next_job(QueueType.SCRAPER)
                
                if not job:
                    # No jobs available, check if we should populate
                    queue_status = self.queue.get_queue_status(QueueType.SCRAPER)
                    total_jobs = queue_status.get("queue_count", 0) + queue_status.get("processing_count", 0)
                    
                    if total_jobs == 0:
                        logger.info("Queue empty. Sleeping...")
                        time.sleep(60)

                        
                    # Sleep a bit to avoid CPU spinning
                    time.sleep(10)
                    continue
                
                # Update status
                if isinstance(job, str):
                    try:
                        job = json.loads(job)
                    except Exception as e:
                        logger.error(f"Job in event queue is a raw string and failed to parse JSON: {e} | job={job}")
                        self.queue.mark_job_failed(QueueType.EVENT, job, error="Invalid job format")
                        continue  # skip this bad job

                if not isinstance(job, dict):
                    logger.error(f"Invalid event job: expected dict but got {type(job)}")
                    self.queue.mark_job_failed(QueueType.EVENT, job, error="Invalid job format")
                    continue  # skip this bad job

                # Now safe
                instagram_handle = job.get('instagram_handle')

                self.status["current_job"] = instagram_handle
                
                # Process the job
                try:
                    logger.info(f"Processing club {instagram_handle}...")
                    
                    # Create and login to scraper
                    scraper = InstagramScraper(
                        os.getenv("INSTAGRAM_USERNAME"),
                        os.getenv("INSTAGRAM_PASSWORD")
                    )
                    scraper.login()
                    
                    # Perform scraping with retries
                    scraper = scrape_with_retries(scraper, instagram_handle)
                    
                    # Update last scraped time in database
                    self.update_club_last_scraped(instagram_handle)
                    
                    # Enqueue for event processing
                    self.queue.enqueue_job(QueueType.EVENT, {'instagram_handle': instagram_handle})
                    
                    # Mark as complete
                    self.queue.mark_job_complete(QueueType.SCRAPER, instagram_handle)
                    
                    # Update statistics
                    self.status["jobs_completed"] += 1
                    self.status["current_job"] = None
                    
                    # Check for rate limiting
                    rate_limit_level = self.check_recent_rate_limits()
                    
                    if rate_limit_level == 2:
                        # Severe rate limiting
                        cooldown_hours = 12
                        logger.warning(f"🚨 Severe rate limits detected! Cooling down for {cooldown_hours} hours...")
                        self.set_rate_limit(cooldown_hours * 3600)
                        continue
                    elif rate_limit_level == 1:
                        # Mild rate limiting
                        cooldown_hours = 6
                        logger.warning(f"⚠️ Mild rate limits detected. Cooling down for {cooldown_hours} hours...")
                        self.set_rate_limit(cooldown_hours * 3600)
                        continue
                    
                    # Random delay to avoid detection
                    delay = random.uniform(2, 5)
                    time.sleep(delay)
                    
                except RateLimitDetected as rl:
                    logger.error(f"🚨 [RATE LIMIT DETECTED] Cooling down scraper for 12 hours... {rl}")
                    self.queue.requeue_job(instagram_handle)
                    self.set_rate_limit(12 * 3600)
                    
                except Exception as e:
                    logger.error(f"Error scraping {instagram_handle}: {e}")
                    self.queue.mark_job_failed(QueueType.SCRAPER, instagram_handle, error=str(e))
                    self.status["jobs_failed"] += 1
                    self.status["last_error"] = str(e)
                
            except Exception as e:
                logger.error(f"Error in scraper worker: {e}")
                time.sleep(30)  # Sleep before retrying
                
        logger.info("Scraper worker stopped")
    
    def event_processing_worker(self):
        """Worker function that runs in a thread to process event jobs"""
        logger.info("Event worker started")
        self.queue.publish_notification("Event worker started", {})
        
        while self.running and not self.stop_event.is_set():
            try:
                # Check if we're paused
                if self.paused:
                    time.sleep(5)
                    continue
                
                # Requeue stalled event jobs
                self.queue.requeue_stalled_jobs(QueueType.EVENT)
                
                # Get the next job
                job = self.queue.get_next_job(QueueType.EVENT)
                
                if not job:
                    # No jobs available, sleep for a bit
                    time.sleep(10)
                    continue
                
                instagram_handle = job.get('instagram_handle')
                
                try:
                    logger.info(f"Processing events for {instagram_handle}")
                    
                    # Create the event parser and calendar
                    parser = EventParser()
                    calendar = CalendarConnection()
                    
                    # Parse posts and create calendar
                    parser.parse_all_posts(instagram_handle)
                    calendar.create_calendar_file(instagram_handle)
                    
                    # Mark job as complete
                    self.queue.mark_job_complete(QueueType.EVENT, instagram_handle)
                    self.status["events_processed"] += 1
                    
                except Exception as e:
                    logger.error(f"Error processing events for {instagram_handle}: {e}")
                    self.queue.mark_job_failed(QueueType.EVENT, instagram_handle, error=str(e))
                    self.status["events_failed"] += 1
                    
            except Exception as e:
                logger.error(f"Error in event processing worker: {e}")
                time.sleep(30)  # Sleep before retrying
                
        logger.info("Event worker stopped")
    
    def monitor_worker(self):
        """Worker that monitors queues, checks for stalled jobs, and processes streams"""
        logger.info("Monitor worker started")
        self.queue.publish_notification("Monitor worker started", {})
        
        # Set up scheduled tasks
        self.setup_scheduled_tasks()
        
        while self.running and not self.stop_event.is_set():
            try:
                # Run pending scheduled tasks
                schedule.run_pending()
                
                # Process stream updates
                if not self.paused:
                    self.process_streams()
                
                # Update status
                self.update_status()
                
                # Sleep for a bit
                time.sleep(5)
                
            except Exception as e:
                logger.error(f"Error in monitor worker: {e}")
                time.sleep(30)  # Sleep before retrying
                
        logger.info("Monitor worker stopped")
    
    def log_processor_worker(self):
        """Worker that processes logs from the log queue"""
        logger.info("Log processor worker started")
        
        while self.running and not self.stop_event.is_set():
            try:
                # Process logs from the queue
                processed_count = self.queue.process_log_queue()
                
                if processed_count > 0:
                    logger.debug(f"Processed {processed_count} log entries")
                
                # Sleep for a bit
                time.sleep(5)
                
            except Exception as e:
                logger.error(f"Error in log processor worker: {e}")
                time.sleep(30)  # Sleep before retrying
                
        logger.info("Log processor worker stopped")
    
    # ---------- Helper methods ----------
    
    def populate_queue(self):
        """Get clubs from database and add to queue"""
        logger.info("Starting to populate queue...")
        
        try:
            clubs_to_scrape = self.get_clubs_to_scrape()
            added_count = 0
            
            for username in clubs_to_scrape:
                if self.queue.enqueue_job(QueueType.SCRAPER, {'instagram_handle': username}):
                    added_count += 1
            
            logger.info(f"Finished populating queue with {added_count} clubs")
            self.queue.publish_notification("Queue populated", {
                "count": added_count,
                "source": "auto"
            })
            
            return added_count
        except Exception as e:
            logger.error(f"Error populating queue: {e}")
            return 0
    
    def set_rate_limit(self, duration_seconds):
        """Set rate limit for a specific duration"""
        self.rate_limited = True
        self.rate_limit_end_time = time.time() + duration_seconds
        end_time = datetime.datetime.fromtimestamp(self.rate_limit_end_time).strftime("%Y-%m-%d %H:%M:%S")
        
        self.status["rate_limited_until"] = end_time
        
        logger.warning(f"Rate limit set until {end_time} ({duration_seconds // 3600} hours)")
        self.queue.publish_notification("Rate limit activated", {
            "duration_hours": duration_seconds // 3600,
            "end_time": end_time
        })
    
    def process_streams(self):
        """Process notification and status streams from Redis"""
        try:
            # Process notifications (10 at a time)
            notifications = self.queue.read_notifications(self.last_notification_id, count=10)
            
            for notification in notifications:
                self.last_notification_id = notification["id"]
                
                # Process notification based on type
                payload = notification.get("payload", {})
                notification_type = payload.get("data", {}).get("type")
                
                # Handle specific notification types
                if notification_type == "command" and not self.paused:
                    command = payload.get("data", {}).get("command")
                    self.handle_command(command, payload.get("data", {}))
            
            # Process status updates (10 at a time)
            status_updates = self.queue.read_status_updates(self.last_status_id, count=10)
            
            for update in status_updates:
                self.last_status_id = update["id"]
                
                # Process status update
                # (This could be extended with specific status handling)
            
        except Exception as e:
            logger.error(f"Error processing streams: {e}")
    
    def handle_command(self, command, data):
        """Handle commands received via the notification stream"""
        logger.info(f"Received command: {command}")
        
        try:
            if command == "stop":
                self.stop()
            elif command == "pause":
                self.pause()
            elif command == "resume":
                self.resume()
            elif command == "populate_queue":
                self.populate_queue()
            elif command == "flush_queue":
                queue_type_str = data.get("queue_type", "scraper")
                queue_type = getattr(QueueType, queue_type_str.upper(), QueueType.SCRAPER)
                count = self.queue.flush_queue(queue_type)
                logger.info(f"Flushed {count} jobs from {queue_type.value} queue")
            elif command == "add_club":
                instagram_handle = data.get("instagram_handle")
                priority = data.get("priority", 0)
                if instagram_handle:
                    result = self.queue.enqueue_job(
                        QueueType.SCRAPER,
                        {'instagram_handle': instagram_handle},
                        priority=priority
                    )
                    if result:
                        logger.info(f"Added club {instagram_handle} to queue with priority {priority}")
                    else:
                        logger.error(f"Failed to add club {instagram_handle} to queue")
            elif command == "trigger_clean":
                self.trigger_cleanup()
            else:
                logger.warning(f"Unknown command: {command}")
        
        except Exception as e:
            logger.error(f"Error handling command {command}: {e}")
    
    def update_status(self):
        """Update status information"""
        try:
            # Only update every 30 seconds to avoid too much overhead
            if time.time() - self.status["last_status_update"] < 30:
                return
            
            # Get queue stats
            scraper_stats = self.queue.get_queue_status(QueueType.SCRAPER)
            event_stats = self.queue.get_queue_status(QueueType.EVENT)
            
            status = {
                "scraper_state": "rate_limited" if self.rate_limited else 
                                "paused" if self.paused else 
                                "running" if self.running else "stopped",
                "rate_limited_until": self.status["rate_limited_until"],
                "current_job": self.status["current_job"],
                "jobs_completed": self.status["jobs_completed"],
                "jobs_failed": self.status["jobs_failed"],
                "events_processed": self.status["events_processed"],
                "events_failed": self.status["events_failed"],
                "last_error": self.status["last_error"],
                "last_status_update": time.time(),
                "scraper_queue": scraper_stats,
                "event_queue": event_stats
            }
            
            # Update local status
            self.status = status
            
            # Publish status update (every ~5 minutes)
            if time.time() % 300 < 30:
                self.queue.publish_status("status_update", status)
            
        except Exception as e:
            logger.error(f"Error updating status: {e}")
    
    def setup_scheduled_tasks(self):
        """Set up scheduled maintenance tasks"""
        # Requeue stalled jobs every 30 minutes
        schedule.every(30).minutes.do(self.queue.requeue_stalled_jobs, QueueType.SCRAPER)
        schedule.every(30).minutes.do(self.queue.requeue_stalled_jobs, QueueType.EVENT)
        
        # Refresh club search vector every 12 hours
        schedule.every(12).hours.do(self.refresh_club_search_vector)
    
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
                if "Possible rate limit detected" in line or "RATE LIMIT DETECTED" in line:
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
    
    def refresh_club_search_vector(self):
        """Refresh the search vector for clubs in the database"""
        try:
            self.db.supabase.rpc('refresh_club_search_vector').execute()
            logger.info("Refreshed club search vector")
            return True
        except Exception as e:
            logger.error(f"Error refreshing club search vector: {e}")
            return False
    
    def trigger_cleanup(self):
        """Trigger database cleanup operations"""
        try:
            # Clean up orphaned records
            self.db.supabase.rpc('cleanup_orphaned_records').execute()
            logger.info("Cleaned up orphaned records")
            
            # Refresh materialized views if needed

            # Publish notification
            self.queue.publish_notification("Database cleanup completed", {
                "timestamp": time.time()
            })
            
            return True
        except Exception as e:
            logger.error(f"Error during database cleanup: {e}")
            return False
    
    def run(self):
        """Main method to run the scraper rotation - legacy compatibility"""
        self.start()
        
        # Keep main thread alive
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received, stopping...")
            self.stop()
        
        logger.info("Scraper rotation terminated")
        

if __name__ == "__main__":
    ScraperRotation().run()