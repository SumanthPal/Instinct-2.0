import redis
import json
import time
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.logger import logger

class RedisScraperQueue:
    def __init__(self):
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis = redis.from_url(redis_url)
        
        self.queue_key = 'scraper:queue'
        self.processing_key = 'scraper:processing'
        self.failed_key = 'scraper:failed'
        self.rate_limit_key = 'scraper:rate_limit'
        self.event_queue_key = 'scraper:event_queue'
        self.event_processing_key = 'scraper:event_processing'
        self.event_failed_key = 'scraper:event_failed'
        
        logger.info("RedisScraperQueue initialized successfully.")

    def enqueue_club(self, instagram_handle, priority=0):
        job = {
            'instagram_handle': instagram_handle,
            'enqueued_at': time.time(),
            'attempts': 0
        }
        self.redis.zadd(self.queue_key, {json.dumps(job): priority})
        logger.info(f"Enqueued club: {instagram_handle} with priority {priority}.")

    def get_next_club(self):
        current_time = time.time()
        recent_requests = self.redis.zrangebyscore(
            self.rate_limit_key, current_time - 3600, current_time
        )
        if len(recent_requests) >= 100:
            logger.warning("Rate limit exceeded. Delaying scrape.")
            return None

        jobs = self.redis.zrange(self.queue_key, 0, 0, withscores=True)
        if not jobs:
            return None

        job_json, priority = jobs[0]
        job = json.loads(job_json)

        self.redis.zadd(self.rate_limit_key, {job['instagram_handle']: current_time})
        self.redis.zrem(self.queue_key, job_json)
        job['processing_started'] = time.time()
        job['attempts'] += 1
        self.redis.hset(self.processing_key, job['instagram_handle'], json.dumps(job))

        logger.info(f"Started processing club: {job['instagram_handle']}. Attempt: {job['attempts']}")
        return job

    def mark_complete(self, instagram_handle):
        self.redis.hdel(self.processing_key, instagram_handle)
        logger.info(f"Completed club: {instagram_handle}.")
    
    def requeue_job(self, instagram_handle):
        """Requeue a single job immediately (e.g., if rate limited)."""
        try:
            job_json = self.redis.hget(self.processing_key, instagram_handle)
            if not job_json:
                logger.warning(f"Job {instagram_handle} not found in processing queue. Re-adding fresh.")
                self.enqueue_club(instagram_handle, priority=-10)
                return

            job = json.loads(job_json)
            self.redis.hdel(self.processing_key, instagram_handle)
            self.enqueue_club(job['instagram_handle'], priority=-10)
            logger.info(f"Successfully requeued {instagram_handle} due to manual fallback.")
        except Exception as e:
            logger.error(f"Error requeuing {instagram_handle}: {e}")


    def mark_failed(self, instagram_handle, error=None):
        job_json = self.redis.hget(self.processing_key, instagram_handle)
        if not job_json:
            logger.error(f"Tried to mark non-existent job as failed: {instagram_handle}.")
            return

        job = json.loads(job_json)
        job['error'] = str(error)
        job['failed_at'] = time.time()

        self.redis.hdel(self.processing_key, instagram_handle)

        if job['attempts'] < 3:
            self.enqueue_club(instagram_handle, priority=-10)
            logger.warning(f"Club {instagram_handle} failed, retrying (attempt {job['attempts']}). Error: {error}")
        else:
            self.redis.hset(self.failed_key, instagram_handle, json.dumps(job))
            logger.error(f"Club {instagram_handle} permanently failed after 3 attempts. Error: {error}")

    def requeue_stalled(self, timeout_seconds=1800):
        stalled = self.get_stalled_jobs(timeout_seconds)
        for job in stalled:
            instagram_handle = job['instagram_handle']
            self.redis.hdel(self.processing_key, instagram_handle)
            self.enqueue_club(instagram_handle, priority=-5)
            logger.warning(f"Requeued stalled job: {instagram_handle} after timeout of {timeout_seconds} seconds.")
        return len(stalled)
    
    def get_stalled_jobs(self, timeout_seconds=1800):
        """Return jobs that have been 'processing' too long (likely stuck)."""
        current_time = time.time()
        stalled_jobs = []

        all_processing = self.redis.hgetall(self.processing_key)

        for instagram_handle, job_json in all_processing.items():
            try:
                job = json.loads(job_json)
                processing_started = job.get('processing_started', 0)

                if current_time - processing_started > timeout_seconds:
                    stalled_jobs.append(job)
            except Exception as e:
                logger.error(f"Error parsing job {instagram_handle} during stalled job check: {e}")

        return stalled_jobs
    def get_next_event_job(self):
        """Get the next event job from the event queue."""
        jobs = self.redis.zrange(self.event_queue_key, 0, 0, withscores=True)
        if not jobs:
            return None

        job_json, priority = jobs[0]
        job = json.loads(job_json)

        self.redis.zrem(self.event_queue_key, job_json)
        job['processing_started'] = time.time()
        job['attempts'] = job.get('attempts', 0) + 1
        self.redis.hset(self.event_processing_key, job['instagram_handle'], json.dumps(job))

        logger.info(f"Started processing event for club: {job['instagram_handle']}. Attempt: {job['attempts']}")
        return job
    
    def enqueue_event_job(self, instagram_handle, priority=0):
        """
        Enqueue a new event processing job (for OpenAI + Calendar creation).
        """
        try:
            job = {
                'instagram_handle': instagram_handle,
                'enqueued_at': time.time(),
                'attempts': 0
            }
            self.redis.zadd(self.event_queue_key, {json.dumps(job): priority})
            logger.info(f"Enqueued event job for {instagram_handle} with priority {priority}")
        except Exception as e:
            logger.error(f"Error enqueuing event job for {instagram_handle}: {e}")


    def requeue_stalled_event_jobs(self, timeout_seconds=1800):
        """Requeue event jobs that are stuck too long in processing."""
        stalled = self.get_stalled_event_jobs(timeout_seconds)
        for job in stalled:
            instagram_handle = job['instagram_handle']
            self.redis.hdel(self.event_processing_key, instagram_handle)
            self.redis.zadd(self.event_queue_key, {json.dumps(job): -5})
            logger.warning(f"Requeued stalled event job: {instagram_handle} after timeout of {timeout_seconds} seconds.")
        return len(stalled)

    def get_stalled_event_jobs(self, timeout_seconds=1800):
        """Return event jobs that have been stuck too long."""
        current_time = time.time()
        stalled_jobs = []

        all_processing = self.redis.hgetall(self.event_processing_key)

        for instagram_handle, job_json in all_processing.items():
            try:
                job = json.loads(job_json)
                processing_started = job.get('processing_started', 0)

                if current_time - processing_started > timeout_seconds:
                    stalled_jobs.append(job)
            except Exception as e:
                logger.error(f"Error parsing event job {instagram_handle} during stalled event job check: {e}")

        return stalled_jobs
    
    def mark_event_complete(self, instagram_handle):
        """Mark an event processing job as completed."""
        try:
            self.redis.hdel(self.event_processing_key, instagram_handle)
            logger.info(f"✅ Event processing complete for {instagram_handle}")
        except Exception as e:
            logger.error(f"Error marking event complete for {instagram_handle}: {e}")

    def mark_event_failed(self, instagram_handle, error=None):
        """Mark an event job as failed."""
        try:
            job_json = self.redis.hget(self.event_processing_key, instagram_handle)
            if not job_json:
                logger.error(f"Tried to mark non-existent event job as failed: {instagram_handle}")
                return

            job = json.loads(job_json)
            job['error'] = str(error)
            job['failed_at'] = time.time()

            self.redis.hdel(self.event_processing_key, instagram_handle)

            if job['attempts'] < 3:
                self.redis.zadd(self.event_queue_key, {json.dumps(job): -10})
                logger.warning(f"Event job {instagram_handle} failed, retrying (attempt {job['attempts']}). Error: {error}")
            else:
                self.redis.hset(self.event_failed_key, instagram_handle, json.dumps(job))
                logger.error(f"Event job {instagram_handle} permanently failed after 3 attempts. Error: {error}")

        except Exception as e:
            logger.error(f"Error marking event job {instagram_handle} as failed: {e}")


