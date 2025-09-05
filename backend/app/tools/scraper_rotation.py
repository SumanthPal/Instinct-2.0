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
import json

# Import your existing tools
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.logger import logger
from db.queries import SupabaseQueries
from tools.insta_scraper import RateLimitDetected
from tools.ai_validation import EventParser
from tools.calendar_connection import CalendarConnection
from tools.redis_queue import RedisScraperQueue, QueueType, SystemHealthMonitor


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LOG_FILE_PATH = os.path.join(BASE_DIR, 'logs', 'logfile.log')

class ScraperRotation:
    def __init__(self):
        """Initialize the scraper rotation manager"""
        dotenv.load_dotenv()
        self.db = SupabaseQueries()
        self.clubs_per_session = 10
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
        self.start_health_monitoring()
        
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
        last_check = 0

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
                    time.sleep(min(remaining, 60))
                    continue
                elif self.rate_limited:
                    # Rate limit period has expired
                    self.rate_limited = False
                    self.status["rate_limited_until"] = None
                    logger.info("Rate limit period ended. Resuming normal operation.")
                    
                # Requeue stalled jobs
                if time.time() - last_check > 1800:  # 30 minutes
                    last_check = time.time()
                    self.queue.requeue_stalled_jobs(QueueType.SCRAPER)
                
                # Get the next job
                job = self.queue.listen_to_scraper_queue(blocking_timeout=5)

                if not job:
                    time.sleep(1)
                    continue
                
                # Update status
                if isinstance(job, str):
                    try:
                        job = json.loads(job)
                    except Exception as e:
                        logger.error(f"Job in event queue is a raw string and failed to parse JSON: {e} | job={job}")
                        self.queue.mark_job_failed(QueueType.SCRAPER, job, error="Invalid job format")
                        continue

                if not isinstance(job, dict):
                    logger.error(f"Invalid event job: expected dict but got {type(job)}")
                    self.queue.mark_job_failed(QueueType.SCRAPER, job, error="Invalid job format")
                    continue

                instagram_handle = job.get('instagram_handle')
                self.status["current_job"] = instagram_handle
                
                # Process the job - MODIFIED SECTION
                try:
                    logger.info(f"Processing club {instagram_handle}...")
                    
                    # Use the enhanced scrape_sequence that handles cookie rotation
                    success = self._scrape_with_session_rotation([instagram_handle])
                    
                    if success:
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
                    else:
                        # Failed after all attempts including cookie rotation
                        logger.error(f"Failed to scrape {instagram_handle} after all attempts")
                        self.queue.mark_job_failed(QueueType.SCRAPER, instagram_handle, error="Failed after retries with cookie rotation")
                        self.status["jobs_failed"] += 1
                        
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
        if data.get("source") == "system" and command == "populate_queue":
            logger.warning("Ignoring automated queue population")
            return
        try:
            if command == "stop":
                self.stop()
            elif command == "pause":
                self.pause()
            elif command == "resume":
                self.resume()
            elif command == "populate_queue":
                self.populate_queue()
            elif command == "requeue_stalled":
                self.queue.requeue_stalled()
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
        #schedule.every(30).minutes.do(self.queue.requeue_stalled_jobs, QueueType.SCRAPER)
        #schedule.every(30).minutes.do(self.queue.requeue_stalled_jobs, QueueType.EVENT)
        
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

    def _init_queue_keys(self):
        """Initialize all queue keys with proper prefixes"""
        # Queue key format: {type}:{purpose}
        self.keys = {
            QueueType.SCRAPER: {
                "queue": "scraper:queue",
                "processing": "scraper:processing",
                "failed": "scraper:failed",
                "rate_limit": "scraper:rate_limit",
                "completed": "scraper:completed"
            },
            QueueType.EVENT: {
                "queue": "event:queue",
                "processing": "event:processing",
                "failed": "event:failed",
                "completed": "event:completed"
            },
            QueueType.LOG: {
                "queue": "log:queue",
                "history": "log:history",
                "processing": "log:processing"
            }
        }
        
        # Stream names for event-driven architecture
        self.notification_stream = "notifications"
        self.status_stream = "status"
        self.health_stream = "system:health"  # New stream for system health data

    def publish_health_metrics(self, health_data: Dict = None) -> bool:
        """
        Publish system health metrics to the health stream
        
        Args:
            health_data: System health data dictionary. If None, will gather fresh data.
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Get health data if not provided
            if health_data is None:
                health_data = SystemHealthMonitor.get_system_health()
            
            # Add to stream with * to auto-generate ID
            self.redis.xadd(self.health_stream, {"payload": json.dumps(health_data)})
            logger.debug(f"Published system health metrics to {self.health_stream}")
            return True
            
        except Exception as e:
            logger.error(f"Error publishing health metrics: {e}")
            return False

    def read_health_metrics(self, last_id: str = "0", count: int = 10) -> List[Dict]:
        """
        Read system health metrics from the health stream
        
        Args:
            last_id: Last ID that was read (exclusive)
            count: Maximum number of metrics to read
            
        Returns:
            List[Dict]: List of health metrics entries
        """
        try:
            results = self.redis.xread({self.health_stream: last_id}, count=count)
            metrics = []
            
            if results:
                for stream_name, messages in results:
                    for msg_id, msg_data in messages:
                        try:
                            payload = json.loads(msg_data[b"payload"])
                            metrics.append({
                                "id": msg_id.decode(),
                                "payload": payload
                            })
                        except Exception as e:
                            logger.error(f"Error parsing health metric: {e}")
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error reading health metrics: {e}")
            return []

    def get_latest_health_metrics(self) -> Dict:
        """
        Get the most recent system health metrics
        
        Returns:
            Dict: Latest health metrics or empty dict if none found
        """
        try:
            # Get the last entry from the health stream
            results = self.redis.xrevrange(self.health_stream, "+", "-", count=1)
            
            if results:
                msg_id, msg_data = results[0]
                payload = json.dumps(msg_data[b"payload"])
                return {
                    "id": msg_id.decode(),
                    "payload": payload
                }
            
            return {}
            
        except Exception as e:
            logger.error(f"Error getting latest health metrics: {e}")
            return {}

    def start_health_monitoring(self, interval_seconds: int = 60) -> bool:
        """
        Start a background thread to periodically publish system health metrics
        
        Args:
            interval_seconds: Time between health checks in seconds
            
        Returns:
            bool: True if started successfully, False otherwise
        """
        try:
            import threading
            
            # Define the monitoring function
            def health_monitor_worker():
                logger.info(f"Health monitoring started with {interval_seconds}s interval")
                
                while True:
                    try:
                        # Get and publish health metrics
                        health_data = SystemHealthMonitor.get_system_health()
                        self.queue.publish_health_metrics(health_data)
                        
                        # Check for critical conditions
                        self._check_health_alerts(health_data)
                        
                        # Sleep for the interval
                        time.sleep(interval_seconds)
                        
                    except Exception as e:
                        logger.error(f"Error in health monitor worker: {e}")
                        time.sleep(60)  # Sleep for a minute before retrying
            
            # Start the thread
            thread = threading.Thread(
                target=health_monitor_worker,
                name="health_monitor",
                daemon=True
            )
            thread.start()
            
            # Publish notification about monitoring start
            self.queue.publish_notification(
                "System health monitoring started",
                {
                    "interval_seconds": interval_seconds,
                    "timestamp": time.time()
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error starting health monitoring: {e}")
            return False

    def _check_health_alerts(self, health_data: Dict) -> None:
        """
        Check health data for critical conditions and publish alerts
        
        Args:
            health_data: System health metrics
        """
        try:
            alerts = []
            
            # Check CPU usage
            cpu_percent = health_data.get("cpu", {}).get("percent", 0)
            if cpu_percent > 90:
                alerts.append({
                    "type": "critical",
                    "component": "cpu",
                    "message": f"CPU usage is critically high at {cpu_percent}%"
                })
            elif cpu_percent > 75:
                alerts.append({
                    "type": "warning",
                    "component": "cpu",
                    "message": f"CPU usage is high at {cpu_percent}%"
                })
            
            # Check memory usage
            memory_percent = health_data.get("memory", {}).get("percent", 0)
            if memory_percent > 90:
                alerts.append({
                    "type": "critical",
                    "component": "memory",
                    "message": f"Memory usage is critically high at {memory_percent}%"
                })
            elif memory_percent > 80:
                alerts.append({
                    "type": "warning",
                    "component": "memory",
                    "message": f"Memory usage is high at {memory_percent}%"
                })
            
            # Check disk usage
            disk_percent = health_data.get("disk", {}).get("percent", 0)
            if disk_percent > 95:
                alerts.append({
                    "type": "critical",
                    "component": "disk",
                    "message": f"Disk usage is critically high at {disk_percent}%"
                })
            elif disk_percent > 85:
                alerts.append({
                    "type": "warning",
                    "component": "disk",
                    "message": f"Disk usage is high at {disk_percent}%"
                })
            
            # Check process memory usage (potential memory leak)
            process_memory_mb = health_data.get("process", {}).get("memory_rss_mb", 0)
            if process_memory_mb > 2000:  # 2GB
                alerts.append({
                    "type": "critical",
                    "component": "process_memory",
                    "message": f"Process memory usage is critically high at {process_memory_mb}MB"
                })
            elif process_memory_mb > 1000:  # 1GB
                alerts.append({
                    "type": "warning",
                    "component": "process_memory",
                    "message": f"Process memory usage is high at {process_memory_mb}MB"
                })
            
            # Publish alerts to notification stream
            for alert in alerts:
                self.queue.publish_notification(
                    alert["message"],
                    {
                        "type": "health_alert",
                        "alert_type": alert["type"],
                        "component": alert["component"],
                        "timestamp": time.time()
                    }
                )
            
            # If critical alerts, also add to status stream
            critical_alerts = [a for a in alerts if a["type"] == "critical"]
            if critical_alerts:
                self.queue.publish_status(
                    "health_critical",
                    {
                        "alerts": critical_alerts,
                        "timestamp": time.time()
                    }
                )
                
        except Exception as e:
            logger.error(f"Error checking health alerts: {e}")
            
    
    def _scrape_with_session_rotation(self, username_list, max_cookie_attempts=2):
        """
        Enhanced scraping with cookie rotation - creates fresh session each time
        
        Args:
            username_list: List of usernames to scrape (usually just one)
            max_cookie_attempts: Number of different cookies to try
            
        Returns:
            bool: True if successful, False if failed
        """
        for cookie_attempt in range(max_cookie_attempts):
            scraper = None
            try:
                logger.info(f"Creating new scraper session (cookie attempt {cookie_attempt + 1}/{max_cookie_attempts})")
                
                # Create fresh scraper instance
                from tools.insta_scraper import InstagramScraper
                scraper = InstagramScraper(
                    os.getenv("INSTAGRAM_USERNAME"), 
                    os.getenv("INSTAGRAM_PASSWORD")
                )
                
                # Set the cookie index for this attempt
                scraper.current_cookie_index = cookie_attempt % len(scraper.cookies_list)
                logger.info(f"Using cookie account #{scraper.current_cookie_index + 1}")
                
                # Login with the selected cookie
                scraper.login()
                logger.info("Logged into Instagram with fresh session.")

                # Process each username in the list
                for username in username_list:
                    logger.info(f"Starting scrape for {username}...")
                    
                    # Use the existing scrape_with_retries but with cookie rotation disabled
                    # since we're handling cookie rotation at the session level
                    success = self._scrape_single_with_retries(scraper, username, max_retries=2)
                    
                    if not success:
                        raise RateLimitDetected(f"Failed to scrape {username} - likely rate limited")
                        
                    logger.info(f"Finished scraping {username}.")
                
                # If we get here, everything succeeded
                return True
                
            except RateLimitDetected as rl:
                logger.warning(f"Rate limit detected with cookie #{cookie_attempt + 1}: {rl}")
                
                if cookie_attempt < max_cookie_attempts - 1:
                    logger.info(f"Will try next cookie account...")
                    # Add delay before trying next cookie
                    delay = random.uniform(30, 60) * (cookie_attempt + 1)  # Progressive delay
                    time.sleep(delay)
                else:
                    logger.error("Rate limited with all available cookies")
                    return False
                    
            except Exception as e:
                logger.error(f"Session error with cookie #{cookie_attempt + 1}: {str(e)}")
                
                if cookie_attempt < max_cookie_attempts - 1:
                    logger.info("Will try next cookie account...")
                    time.sleep(30)
                else:
                    logger.error("Failed with all available cookies")
                    return False
                    
            finally:
                # Always clean up the session
                if scraper:
                    logger.info("Cleaning up scraper session...")
                    scraper._driver_quit()
                    scraper = None
        
        return False

    def _scrape_single_with_retries(self, scraper, username, max_retries=2):
        """
        Scrape a single username with retries (no cookie swapping - that's handled at session level)
        
        Args:
            scraper: InstagramScraper instance
            username: Username to scrape
            max_retries: Number of retry attempts
            
        Returns:
            bool: True if successful, False if failed
        """
        for attempt in range(max_retries):
            try:
                username = username[1:] if username.startswith('@') else username
                logger.info(f"Scrape attempt {attempt+1}/{max_retries} for {username}")
                
                if attempt > 0:
                    # Add delay before retry
                    delay = random.uniform(10, 30) * attempt
                    logger.info(f"Waiting {delay:.1f} seconds before retry...")
                    time.sleep(delay)
                
                # Try scraping
                scraper.store_club_data(username)
                logger.info(f"Successfully scraped {username}")
                return True
                
            except RateLimitDetected as rate_limit_exc:
                logger.warning(f"Rate limit detected during attempt {attempt+1} for {username}: {rate_limit_exc}")
                # Don't try cookie swapping here - let the session-level handler deal with it
                return False
                
            except Exception as e:
                logger.error(f"Attempt {attempt+1} failed for {username}: {str(e)}")
                
                if attempt == max_retries - 1:
                    logger.error(f"All retry attempts failed for {username}")
                    return False
        
        return False

if __name__ == "__main__":
    ScraperRotation().run()
