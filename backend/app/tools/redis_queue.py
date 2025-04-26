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
