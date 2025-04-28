import redis
import json
import time
import os
import sys
import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.logger import logger

class QueueType(Enum):
    SCRAPER = "scraper"
    EVENT = "event"
    LOG = "log"

class RedisScraperQueue:
    def __init__(self):
        redis_url = os.getenv('REDIS_UL', 'redis://localhost:6379')
        self.redis = redis.from_url(redis_url)
        
        # Initialize all queue keys with prefixes
        self._init_queue_keys()
        
        # Stream names for event-driven architecture
        self.notification_stream = "notifications"
        self.status_stream = "status"
        
        logger.info("RedisScraperQueue initialized successfully.")

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
                "processing": "log:processing",  # <-- add this line

            }
        }

    # ---------- Generic Queue Methods ----------
    
    def enqueue_job(self, queue_type: QueueType, job_data: Dict, priority: int = 0) -> bool:
        """
        Generic method to enqueue a job to any queue
        
        Args:
            queue_type: The type of queue (SCRAPER, EVENT, LOG)
            job_data: The job data to enqueue (must include at least instagram_handle)
            priority: Lower number = higher priority
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Ensure job has required fields
            job = {
                **job_data,
                'enqueued_at': time.time(),
                'attempts': job_data.get('attempts', 0)
            }
            
            # Ensure job has instagram_handle
            if 'instagram_handle' not in job and queue_type != QueueType.LOG:
                logger.error(f"Cannot enqueue job without instagram_handle: {job}")
                return False
                
            queue_key = self.keys[queue_type]["queue"]
            self.redis.zadd(queue_key, {json.dumps(job): priority})
            
            # Send notification about new job
            self.publish_notification(f"New job added to {queue_type.value} queue", {
                "type": "job_added",
                "queue": queue_type.value,
                "instagram_handle": job.get('instagram_handle', 'N/A'),
                "timestamp": time.time()
            })
            
            logger.info(f"Enqueued job to {queue_type.value} queue: {job.get('instagram_handle', 'log')} with priority {priority}")
            return True
            
        except Exception as e:
            logger.error(f"Error enqueueing job to {queue_type.value} queue: {e}")
            return False
    
    def get_next_job(self, queue_type: QueueType) -> Optional[Dict]:
        """
        Generic method to get the next job from any queue
        
        Args:
            queue_type: The type of queue (SCRAPER, EVENT, LOG)
            
        Returns:
            Optional[Dict]: The job data or None if queue is empty
        """
        try:
            queue_key = self.keys[queue_type]["queue"]
            processing_key = self.keys[queue_type]["processing"]
            
            # Rate limiting check for scraper jobs
            if queue_type == QueueType.SCRAPER:
                current_time = time.time()
                recent_requests = self.redis.zrangebyscore(
                    self.keys[QueueType.SCRAPER]["rate_limit"], 
                    current_time - 3600, 
                    current_time
                )
                if len(recent_requests) >= 100:
                    logger.warning("Rate limit exceeded. Delaying scrape.")
                    
                    # Publish a status update about rate limiting
                    self.publish_status("rate_limit_exceeded", {
                        "message": "Rate limit exceeded, delaying scrape operations",
                        "recent_requests": len(recent_requests),
                        "window": "1 hour"
                    })
                    return None
            
            # Get the highest priority job (lowest score)
            jobs = self.redis.zrange(queue_key, 0, 0, withscores=True)
            if not jobs:
                return None
            
            job_json, priority = jobs[0]

# If bytes, decode to str
            if isinstance(job_json, bytes):
                job_json = job_json.decode('utf-8')

            # Always try to parse
            try:
                job = json.loads(job_json)
            except Exception as e:
                logger.error(f"Failed to parse job JSON from queue: {e} | job_json={job_json}")
                return None  # Skip this bad job

            
            # Rate limiting for scraper jobs
            if queue_type == QueueType.SCRAPER and 'instagram_handle' in job:
                self.redis.zadd(
                    self.keys[QueueType.SCRAPER]["rate_limit"], 
                    {job['instagram_handle']: time.time()}
                )
            
            # Remove from queue and add to processing
            self.redis.zrem(queue_key, job_json)
            job['processing_started'] = time.time()
            job['attempts'] = job.get('attempts', 0) + 1
            
            # For scraper and event queues, track by instagram_handle
            if queue_type != QueueType.LOG and 'instagram_handle' in job:
                self.redis.hset(processing_key, job['instagram_handle'], json.dumps(job))
                logger.info(f"Started processing {queue_type.value} job: {job['instagram_handle']}. Attempt: {job['attempts']}")
            else:
                # For logs, use a unique ID
                job_id = job.get('id', f"log_{int(time.time())}")
                self.redis.hset(processing_key, job_id, json.dumps(job))
                logger.info(f"Started processing {queue_type.value} job: {job_id}.")
            
            # Publish status update
            self.publish_status("job_started", {
                "queue": queue_type.value,
                "instagram_handle": job.get('instagram_handle', 'N/A'),
                "timestamp": time.time(),
                "attempt": job['attempts']
            })
            
            return job
            
        except Exception as e:
            logger.error(f"Error getting next job from {queue_type.value} queue: {e}")
            return None
    
    def mark_job_complete(self, queue_type: QueueType, job_id: str) -> bool:
        """
        Mark a job as completed
        
        Args:
            queue_type: The type of queue
            job_id: For scraper/event queues, this is instagram_handle. For logs, this is log ID.
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            processing_key = self.keys[queue_type]["processing"]
            completed_key = self.keys[queue_type].get("completed")
            
            # Get the job from processing
            job_json = self.redis.hget(processing_key, job_id)
            if not job_json:
                logger.warning(f"Job {job_id} not found in {queue_type.value} processing queue.")
                return False
            
            # Move to completed if we track completed jobs for this queue type
            if completed_key:
                job = json.loads(job_json)
                job['completed_at'] = time.time()
                self.redis.hset(completed_key, job_id, json.dumps(job))
            
            # Remove from processing
            self.redis.hdel(processing_key, job_id)
            
            # Publish status update
            self.publish_status("job_completed", {
                "queue": queue_type.value,
                "job_id": job_id,
                "timestamp": time.time()
            })
            
            logger.info(f"Completed {queue_type.value} job: {job_id}.")
            return True
            
        except Exception as e:
            logger.error(f"Error marking {queue_type.value} job {job_id} as complete: {e}")
            return False
    
    def mark_job_failed(self, queue_type: QueueType, job_id: str, error: Optional[str] = None, retry: bool = True) -> bool:
        """
        Mark a job as failed
        
        Args:
            queue_type: The type of queue
            job_id: For scraper/event queues, this is instagram_handle. For logs, this is log ID.
            error: Optional error message
            retry: Whether to retry the job (up to max attempts)
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            processing_key = self.keys[queue_type]["processing"]
            failed_key = self.keys[queue_type]["failed"]
            
            # Get the job from processing
            job_json = self.redis.hget(processing_key, job_id)
            if not job_json:
                logger.error(f"Tried to mark non-existent job as failed: {job_id} in {queue_type.value} queue.")
                return False
            
            job = json.loads(job_json)
            job['error'] = str(error)
            job['failed_at'] = time.time()
            
            # Remove from processing
            self.redis.hdel(processing_key, job_id)
            
            max_attempts = 3  # Could make this configurable
            
            # Retry if requested and not exceeded max attempts
            if retry and job.get('attempts', 0) < max_attempts:
                self.enqueue_job(queue_type, job, priority=-10)  # High priority for retries
                logger.warning(f"{queue_type.value} job {job_id} failed, retrying (attempt {job.get('attempts', 0)}). Error: {error}")
                
                # Publish status update for retry
                self.publish_status("job_retrying", {
                    "queue": queue_type.value,
                    "job_id": job_id,
                    "attempts": job.get('attempts', 0),
                    "max_attempts": max_attempts,
                    "error": str(error),
                    "timestamp": time.time()
                })
            else:
                # Mark as permanently failed
                self.redis.hset(failed_key, job_id, json.dumps(job))
                logger.error(f"{queue_type.value} job {job_id} permanently failed after {max_attempts} attempts. Error: {error}")
                
                # Publish status update for permanent failure
                self.publish_status("job_failed", {
                    "queue": queue_type.value,
                    "job_id": job_id,
                    "error": str(error),
                    "timestamp": time.time()
                })
            
            return True
            
        except Exception as e:
            logger.error(f"Error marking {queue_type.value} job {job_id} as failed: {e}")
            return False
    
    def requeue_stalled_jobs(self, queue_type: QueueType, timeout_seconds: int = 1800) -> int:
        """
        Requeue jobs that have been stuck in processing too long
        
        Args:
            queue_type: The type of queue
            timeout_seconds: Time in seconds after which a job is considered stalled
            
        Returns:
            int: Number of stalled jobs requeued
        """
        try:
            stalled_jobs = self.get_stalled_jobs(queue_type, timeout_seconds)
            requeued_count = 0
            
            for job in stalled_jobs:
                job_id = job.get('instagram_handle', job.get('id', 'unknown'))
                processing_key = self.keys[queue_type]["processing"]
                
                # Remove from processing
                self.redis.hdel(processing_key, job_id)
                
                # Requeue
                self.enqueue_job(queue_type, job, priority=-5)
                requeued_count += 1
                
                logger.warning(f"Requeued stalled {queue_type.value} job: {job_id} after timeout of {timeout_seconds} seconds.")
            
            if requeued_count > 0:
                # Publish status update
                self.publish_status("stalled_jobs_requeued", {
                    "queue": queue_type.value,
                    "count": requeued_count,
                    "timeout_seconds": timeout_seconds,
                    "timestamp": time.time()
                })
            
            return requeued_count
            
        except Exception as e:
            logger.error(f"Error requeuing stalled {queue_type.value} jobs: {e}")
            return 0
    
    def get_stalled_jobs(self, queue_type: QueueType, timeout_seconds: int = 1800) -> List[Dict]:
        """
        Get jobs that have been stuck in processing too long
        
        Args:
            queue_type: The type of queue
            timeout_seconds: Time in seconds after which a job is considered stalled
            
        Returns:
            List[Dict]: List of stalled jobs
        """
        try:
            processing_key = self.keys[queue_type]["processing"]
            current_time = time.time()
            stalled_jobs = []
            
            all_processing = self.redis.hgetall(processing_key)
            
            for job_id, job_json in all_processing.items():
                try:
                    job = json.loads(job_json)
                    processing_started = job.get('processing_started', 0)
                    
                    if current_time - processing_started > timeout_seconds:
                        stalled_jobs.append(job)
                except Exception as e:
                    logger.error(f"Error parsing job {job_id} during stalled job check: {e}")
            
            return stalled_jobs
            
        except Exception as e:
            logger.error(f"Error getting stalled {queue_type.value} jobs: {e}")
            return []
    
    def flush_queue(self, queue_type: QueueType) -> int:
        """
        Flush (empty) a queue
        
        Args:
            queue_type: The type of queue
            
        Returns:
            int: Number of jobs removed
        """
        try:
            queue_key = self.keys[queue_type]["queue"]
            processing_key = self.keys[queue_type]["processing"]
            
            # Count jobs before flushing
            queue_count = self.redis.zcard(queue_key)
            processing_count = len(self.redis.hkeys(processing_key))
            
            # Flush the queue
            self.redis.delete(queue_key)
            self.redis.delete(processing_key)
            
            total_removed = queue_count + processing_count
            
            # Publish status update
            self.publish_status("queue_flushed", {
                "queue": queue_type.value,
                "queue_count": queue_count,
                "processing_count": processing_count,
                "total_removed": total_removed,
                "timestamp": time.time()
            })
            
            logger.warning(f"Flushed {queue_type.value} queue. Removed {total_removed} jobs.")
            return total_removed
            
        except Exception as e:
            logger.error(f"Error flushing {queue_type.value} queue: {e}")
            return 0
    
    def get_queue_status(self, queue_type: QueueType) -> Dict:
        """
        Get status information about a queue
        
        Args:
            queue_type: The type of queue
            
        Returns:
            Dict: Status information
        """
        try:
            stats = {}
            
            # Get counts for different queues
            for purpose, key in self.keys[queue_type].items():
                if purpose == "queue":
                    stats[f"{purpose}_count"] = self.redis.zcard(key)
                elif purpose in ["processing", "failed", "completed"]:
                    stats[f"{purpose}_count"] = len(self.redis.hkeys(key))
                elif purpose == "rate_limit" and queue_type == QueueType.SCRAPER:
                    current_time = time.time()
                    stats["rate_limited_last_hour"] = len(
                        self.redis.zrangebyscore(key, current_time - 3600, current_time)
                    )
            
            # Add stalled job count
            stats["stalled_count"] = len(self.get_stalled_jobs(queue_type))
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting {queue_type.value} queue status: {e}")
            return {"error": str(e)}

    # ---------- Stream Methods for Event-Driven Architecture ----------
    
    def publish_notification(self, message: str, data: Dict = None) -> bool:
        """
        Publish a notification to the notification stream
        
        Args:
            message: Notification message
            data: Additional data for the notification
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            notification = {
                "message": message,
                "timestamp": time.time(),
                "data": data or {}
            }
            
            # Add to stream with * to auto-generate ID
            self.redis.xadd(self.notification_stream, {"payload": json.dumps(notification)})
            return True
            
        except Exception as e:
            logger.error(f"Error publishing notification: {e}")
            return False
    
    def publish_status(self, status_type: str, data: Dict = None) -> bool:
        """
        Publish a status update to the status stream
        
        Args:
            status_type: Type of status update
            data: Status data
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            status = {
                "type": status_type,
                "timestamp": time.time(),
                "data": data or {}
            }
            
            # Add to stream with * to auto-generate ID
            self.redis.xadd(self.status_stream, {"payload": json.dumps(status)})
            return True
            
        except Exception as e:
            logger.error(f"Error publishing status: {e}")
            return False
    
    def read_notifications(self, last_id: str = "0", count: int = 10) -> List[Dict]:
        """
        Read notifications from the notification stream
        
        Args:
            last_id: Last ID that was read (exclusive)
            count: Maximum number of notifications to read
            
        Returns:
            List[Dict]: List of notifications
        """
        try:
            results = self.redis.xread({self.notification_stream: last_id}, count=count)
            notifications = []
            
            if results:
                for stream_name, messages in results:
                    for msg_id, msg_data in messages:
                        try:
                            payload = json.loads(msg_data[b"payload"])
                            notifications.append({
                                "id": msg_id.decode(),
                                "payload": payload
                            })
                        except Exception as e:
                            logger.error(f"Error parsing notification: {e}")
            
            return notifications
            
        except Exception as e:
            logger.error(f"Error reading notifications: {e}")
            return []
    
    def read_status_updates(self, last_id: str = "0", count: int = 10) -> List[Dict]:
        """
        Read status updates from the status stream
        
        Args:
            last_id: Last ID that was read (exclusive)
            count: Maximum number of status updates to read
            
        Returns:
            List[Dict]: List of status updates
        """
        try:
            results = self.redis.xread({self.status_stream: last_id}, count=count)
            status_updates = []
            
            if results:
                for stream_name, messages in results:
                    for msg_id, msg_data in messages:
                        try:
                            payload = json.loads(msg_data[b"payload"])
                            status_updates.append({
                                "id": msg_id.decode(),
                                "payload": payload
                            })
                        except Exception as e:
                            logger.error(f"Error parsing status update: {e}")
            
            return status_updates
            
        except Exception as e:
            logger.error(f"Error reading status updates: {e}")
            return []

    # ---------- Log Queue Methods ----------
    
    def log_message(self, message: str, level: str = "info", metadata: Dict = None) -> bool:
        """
        Add a log message to the log queue
        
        Args:
            message: Log message
            level: Log level (info, warning, error, debug)
            metadata: Additional metadata
            
        Returns:
            bool: True if successful, False otherwise
        """
        log_entry = {
            "id": f"log_{int(time.time()*1000)}",
            "message": message,
            "level": level,
            "timestamp": time.time(),
            "metadata": metadata or {}
        }
        
        return self.enqueue_job(QueueType.LOG, log_entry, priority=0)
    
    def get_logs(self, count: int = 100, level: str = None, search: str = None) -> List[Dict]:
        """
        Get recent logs from the log history
        
        Args:
            count: Maximum number of logs to return
            level: Filter by log level
            search: Search term in log messages
            
        Returns:
            List[Dict]: List of log entries
        """
        try:
            log_history_key = self.keys[QueueType.LOG]["history"]
            
            # Get all logs
            all_logs = self.redis.lrange(log_history_key, 0, count - 1)
            logs = []
            
            for log_json in all_logs:
                try:
                    log = json.loads(log_json)
                    
                    # Apply filters
                    if level and log.get("level") != level:
                        continue
                    
                    if search and search.lower() not in log.get("message", "").lower():
                        continue
                    
                    logs.append(log)
                except Exception as e:
                    logger.error(f"Error parsing log entry: {e}")
            
            return logs
            
        except Exception as e:
            logger.error(f"Error getting logs: {e}")
            return []
    
    def process_log_queue(self) -> int:
        """
        Process logs from the log queue and move them to history
        
        Returns:
            int: Number of logs processed
        """
        try:
            processed_count = 0
            log_history_key = self.keys[QueueType.LOG]["history"]
            
            while True:
                log_entry = self.get_next_job(QueueType.LOG)
                if not log_entry:
                    break
                
                # Add to history
                self.redis.lpush(log_history_key, json.dumps(log_entry))
                
                # Trim history to last 1000 logs
                self.redis.ltrim(log_history_key, 0, 999)
                
                # Mark as complete
                self.mark_job_complete(QueueType.LOG, log_entry.get("id", f"log_{int(time.time())}"))
                
                processed_count += 1
            
            return processed_count
            
        except Exception as e:
            logger.error(f"Error processing log queue: {e}")
            return 0

    # ---------- Legacy Methods (for backwards compatibility) ----------
    
    def enqueue_club(self, instagram_handle, priority=0):
        """Legacy method for enqueuing a club to the scraper queue"""
        job = {
            'instagram_handle': instagram_handle,
            'enqueued_at': time.time(),
            'attempts': 0
        }
        return self.enqueue_job(QueueType.SCRAPER, job, priority)
    
    def get_next_club(self):
        """Legacy method for getting the next club from the scraper queue"""
        return self.get_next_job(QueueType.SCRAPER)
    
    def mark_complete(self, instagram_handle):
        """Legacy method for marking a club as completed"""
        return self.mark_job_complete(QueueType.SCRAPER, instagram_handle)
    
    def mark_failed(self, instagram_handle, error=None):
        """Legacy method for marking a club as failed"""
        return self.mark_job_failed(QueueType.SCRAPER, instagram_handle, error)
    
    def requeue_job(self, instagram_handle):
        """Legacy method for requeuing a job"""
        try:
            job_json = self.redis.hget(self.keys[QueueType.SCRAPER]["processing"], instagram_handle)
            if not job_json:
                logger.warning(f"Job {instagram_handle} not found in processing queue. Re-adding fresh.")
                self.enqueue_club(instagram_handle, priority=-10)
                return True

            job = json.loads(job_json)
            self.redis.hdel(self.keys[QueueType.SCRAPER]["processing"], instagram_handle)
            self.enqueue_club(job['instagram_handle'], priority=-10)
            logger.info(f"Successfully requeued {instagram_handle} due to manual fallback.")
            return True
        except Exception as e:
            logger.error(f"Error requeuing {instagram_handle}: {e}")
            return False
    
    def requeue_stalled(self, timeout_seconds=1800):
        """Legacy method for requeuing stalled jobs"""
        return self.requeue_stalled_jobs(QueueType.SCRAPER, timeout_seconds)
    
    def get_stalled_scrapper_jobs(self, timeout_seconds=1800):
        """Legacy method for getting stalled jobs"""
        return self.get_stalled_jobs(QueueType.SCRAPER, timeout_seconds)
    
    def enqueue_event_job(self, instagram_handle, priority=0):
        """Legacy method for enqueuing an event job"""
        job = {
            'instagram_handle': instagram_handle,
            'enqueued_at': time.time(),
            'attempts': 0
        }
        return self.enqueue_job(QueueType.EVENT, job, priority)
    
    def get_next_event_job(self):
        """Legacy method for getting the next event job"""
        return self.get_next_job(QueueType.EVENT)
    
    def mark_event_complete(self, instagram_handle):
        """Legacy method for marking an event job as completed"""
        return self.mark_job_complete(QueueType.EVENT, instagram_handle)
    
    def mark_event_failed(self, instagram_handle, error=None):
        """Legacy method for marking an event job as failed"""
        return self.mark_job_failed(QueueType.EVENT, instagram_handle, error)
    
    def requeue_stalled_event_jobs(self, timeout_seconds=1800):
        """Legacy method for requeuing stalled event jobs"""
        return self.requeue_stalled_jobs(QueueType.EVENT, timeout_seconds)
    
    def get_stalled_event_jobs(self, timeout_seconds=1800):
        """Legacy method for getting stalled event jobs"""
        return self.get_stalled_jobs(QueueType.EVENT, timeout_seconds)