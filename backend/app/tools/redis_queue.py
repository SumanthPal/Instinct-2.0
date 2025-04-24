import redis
import json
import time
import os

class RedisScraperQueue:
    def __init__(self):
        # Connect to Redis (using Heroku Redis URL if available)
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis = redis.from_url(redis_url)
        
        # Queue keys
        self.queue_key = 'scraper:queue'
        self.processing_key = 'scraper:processing'
        self.failed_key = 'scraper:failed'
        self.rate_limit_key = 'scraper:rate_limit'
        self.event_queue_key = 'scraper:event_queue'
        self.event_processing_key = 'scraper:event_processing'
        self.event_failed_key = 'scraper:event_failed'
            
        
    def enqueue_event_job(self, instagram_handle, priority=0):
        """Add a club to the event processing queue"""
        job = {
            'instagram_handle': instagram_handle,
            'enqueued_at': time.time(),
            'attempts': 0
        }
        
        # Add to sorted set with priority as score
        self.redis.zadd(self.event_queue_key, {json.dumps(job): priority})

    def get_next_event_job(self):
        """Get the next club to process events for"""
        # Get highest priority job (lowest score)
        jobs = self.redis.zrange(self.event_queue_key, 0, 0, withscores=True)
        if not jobs:
            return None
            
        job_json, priority = jobs[0]
        job = json.loads(job_json)
        
        # Remove from queue and add to processing
        self.redis.zrem(self.event_queue_key, job_json)
        job['processing_started'] = time.time()
        job['attempts'] += 1
        self.redis.hset(self.event_processing_key, job['instagram_handle'], json.dumps(job))
        
        return job
        
    def mark_event_complete(self, instagram_handle):
        """Mark event processing as successfully completed"""
        # Remove from processing
        self.redis.hdel(self.event_processing_key, instagram_handle)
        
    def mark_event_failed(self, instagram_handle, error=None):
        """Mark event processing as failed, possibly requeue if attempts < max_attempts"""
        job_json = self.redis.hget(self.event_processing_key, instagram_handle)
        if not job_json:
            return
            
        job = json.loads(job_json)
        job['error'] = str(error)
        job['failed_at'] = time.time()
        
        # Remove from processing
        self.redis.hdel(self.event_processing_key, instagram_handle)
        
        # If fewer than 3 attempts, requeue with higher priority
        if job['attempts'] < 3:
            self.enqueue_event_job(instagram_handle, priority=-10)  # Higher priority for retries
        else:
            # Otherwise add to failed list
            self.redis.hset(self.event_failed_key, instagram_handle, json.dumps(job))

    def requeue_stalled_event_jobs(self, timeout_seconds=1800):
        """Requeue event jobs that have been processing for too long"""
        stalled = []
        current_time = time.time()
        
        # Check all processing jobs
        for instagram_handle, job_json in self.redis.hgetall(self.event_processing_key).items():
            job = json.loads(job_json)
            if current_time - job['processing_started'] > timeout_seconds:
                stalled.append(job)
                
        # Requeue stalled jobs
        for job in stalled:
            instagram_handle = job['instagram_handle']
            self.redis.hdel(self.event_processing_key, instagram_handle)
            self.enqueue_event_job(instagram_handle, priority=-5)  # Higher priority for stalled jobs
            
        return len(stalled)
            
        def enqueue_club(self, instagram_handle, priority=0):
            """Add a club to the scraping queue with priority (lower = higher priority)"""
            job = {
                'instagram_handle': instagram_handle,
                'enqueued_at': time.time(),
                'attempts': 0
            }
            
            # Add to sorted set with priority as score
            self.redis.zadd(self.queue_key, {json.dumps(job): priority})
            
    def get_next_club(self):
        """Get the next club to scrape from the queue"""
        # Get rate limit info
        current_time = time.time()
        recent_requests = self.redis.zrangebyscore(
            self.rate_limit_key, 
            current_time - 3600,  # Last hour
            current_time
        )
        
        # If too many recent requests, back off
        if len(recent_requests) >= 100:  # Adjust threshold as needed
            return None
            
        # Get highest priority job (lowest score)
        jobs = self.redis.zrange(self.queue_key, 0, 0, withscores=True)
        if not jobs:
            return None
            
        job_json, priority = jobs[0]
        job = json.loads(job_json)
        
        # Record the request for rate limiting
        self.redis.zadd(self.rate_limit_key, {job['instagram_handle']: current_time})
        
        # Remove from queue and add to processing
        self.redis.zrem(self.queue_key, job_json)
        job['processing_started'] = time.time()
        job['attempts'] += 1
        self.redis.hset(self.processing_key, job['instagram_handle'], json.dumps(job))
        
        return job
        
    def mark_complete(self, instagram_handle):
        """Mark a club as successfully scraped"""
        # Remove from processing
        self.redis.hdel(self.processing_key, instagram_handle)
        
    def mark_failed(self, instagram_handle, error=None):
        """Mark a club as failed, possibly requeue if attempts < max_attempts"""
        job_json = self.redis.hget(self.processing_key, instagram_handle)
        if not job_json:
            return
            
        job = json.loads(job_json)
        job['error'] = str(error)
        job['failed_at'] = time.time()
        
        # Remove from processing
        self.redis.hdel(self.processing_key, instagram_handle)
        
        # If fewer than 3 attempts, requeue with higher priority
        if job['attempts'] < 3:
            self.enqueue_club(instagram_handle, priority=-10)  # Higher priority for retries
        else:
            # Otherwise add to failed list
            self.redis.hset(self.failed_key, instagram_handle, json.dumps(job))
            
    def get_stalled_jobs(self, timeout_seconds=1800):
        """Get jobs that have been processing for too long (possibly stalled)"""
        stalled = []
        current_time = time.time()
        
        # Check all processing jobs
        for instagram_handle, job_json in self.redis.hgetall(self.processing_key).items():
            job = json.loads(job_json)
            if current_time - job['processing_started'] > timeout_seconds:
                stalled.append(job)
                
        return stalled
        
    def requeue_stalled(self, timeout_seconds=1800):
        """Requeue jobs that have been processing for too long"""
        stalled = self.get_stalled_jobs(timeout_seconds)
        for job in stalled:
            instagram_handle = job['instagram_handle']
            self.redis.hdel(self.processing_key, instagram_handle)
            self.enqueue_club(instagram_handle, priority=-5)  # Higher priority for stalled jobs
            
        return len(stalled)