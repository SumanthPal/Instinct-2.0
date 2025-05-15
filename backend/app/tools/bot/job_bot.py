import os
import sys
import discord
import redis
import json
import time
import datetime
import traceback
from discord.ext import commands, tasks
from dotenv import load_dotenv
from discord import ButtonStyle
from discord.ui import Button, View
from typing import Dict, List, Optional
import asyncio

import matplotlib.pyplot as plt
import io
from collections import deque
import numpy as np

# Path setup
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Set base directory for logs
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LOG_FILE_PATH = os.path.join(BASE_DIR, 'logs', 'logfile.log')

# Import custom modules
from tools.logger import logger
from db.queries import SupabaseQueries

# Load environment variables
load_dotenv()

# Job Bot Configuration
JOB_BOT_TOKEN = os.getenv('JOB_BOT_TOKEN')
JOB_BOT_PREFIX = os.getenv('JOB_BOT_PREFIX', '!')
JOB_BOT_CHANNEL_ID = int(os.getenv('JOB_BOT_CHANNEL_ID', '0'))
JOB_BOT_ERROR_CHANNEL_ID = int(os.getenv('JOB_BOT_ERROR_CHANNEL_ID', '0'))
JOB_BOT_ADMIN_ROLE_ID = int(os.getenv('JOB_BOT_ADMIN_ROLE_ID', '0'))
OWNER_USER_ID = int(os.getenv("USER_ID"))  # 👈  Discord user ID
ALLOWED_SERVER_LIST = [int(os.getenv('SERVER_ID'))]
# Add this to bot startup (on_ready event)


# Add a new health stream name constant at the top with the other stream names
HEALTH_STREAM = "system:health" 
# Initialize bot with intents
intents = discord.Intents.default()
intents.message_content = True
intents.members = True
job_bot = commands.Bot(command_prefix=JOB_BOT_PREFIX, intents=intents)

# Initialize database connection
db = SupabaseQueries()

# Redis connection (shared resource)
redis_url = os.getenv('REDIS_URL')
redis_conn = redis.from_url(redis_url)

# Redis queue key names
QUEUE_KEYS = {
    "scraper": {
        "queue": "scraper:queue",
        "processing": "scraper:processing",
        "failed": "scraper:failed",
        "rate_limit": "scraper:rate_limit"
    },
    "event": {
        "queue": "scraper:event_queue", 
        "processing": "scraper:event_processing",
        "failed": "scraper:event_failed"
    },
    "log": {
        "queue": "log:queue",
        "entries": "logs:entries",
        "processing": "queue:processing",

    }
}

# Notification streams
NOTIFICATION_STREAM = "notifications"
STATUS_STREAM = "status"

# Status tracking
status_info = {
    "last_update": 0,
    "scraper_state": "unknown",
    "last_notification_id": "0", 
    "last_status_id": "0"
}

@job_bot.event
async def on_command(ctx):
    if ctx.guild is None or ctx.guild.id not in ALLOWED_SERVER_LIST:
        try:
            owner = ctx.bot.get_user(OWNER_USER_ID)
            if owner:
                await owner.send(
                    f"🚨 BIXIE ALERT!\n"
                    f"Someone tried to use {ctx.bot.user.name} in `{ctx.guild.name if ctx.guild else 'DM'}` ({ctx.guild.id if ctx.guild else 'N/A'})!\n"
                    f"Command: `{ctx.command}` by `{ctx.author}`"
                )

            # Try banning or kicking
            if ctx.guild and ctx.guild.me.guild_permissions.ban_members:
                await ctx.guild.ban(ctx.author, reason="Tried to misuse private bot 🚫")
                await ctx.send("banned 💀 don't touch my circuits again")
            elif ctx.guild and ctx.guild.me.guild_permissions.kick_members:
                await ctx.guild.kick(ctx.author, reason="Tried to misuse private bot 🚫")
                await ctx.send("kicked 😌 lucky i can't ban u rn")
            else:
                await ctx.send("can't even ban or kick u... but i *definitely* saw that 😑")
        except Exception as e:
            logger.error(f"Error during server protection: {e}")

        raise commands.CheckFailure("Unauthorized server.")  # 💥 Force command to fail

# Utility functions for channel communication
async def send_notification(embed=None, message=None, file=None):
    """Send a notification to the main notification channel."""
    channel = job_bot.get_channel(JOB_BOT_CHANNEL_ID)
    if channel:
        if embed:
            await channel.send(embed=embed)
        elif message:
            if file:
                await channel.send(content=message, file=file)
            else:
                await channel.send(content=message)

async def send_error(embed=None, message=None, file=None):
    """Send an error message to the error channel."""
    channel = job_bot.get_channel(JOB_BOT_ERROR_CHANNEL_ID)
    if channel:
        if embed:
            await channel.send(embed=embed)
        elif message:
            if file:
                await channel.send(content=message, file=file)
            else:
                await channel.send(content=message)

# Helper functions for Redis operations
def get_queue_status():
    """Get status information for all queues."""
    try:
        stats = {}
        
        # Scraper queue stats
        scraper_queue = QUEUE_KEYS["scraper"]["queue"]
        scraper_processing = QUEUE_KEYS["scraper"]["processing"]
        scraper_failed = QUEUE_KEYS["scraper"]["failed"]
        
        stats["scraper"] = {
            "queue_count": redis_conn.zcard(scraper_queue),
            "processing_count": len(redis_conn.hkeys(scraper_processing)),
            "failed_count": len(redis_conn.hkeys(scraper_failed))
        }
        
        # Event queue stats
        event_queue = QUEUE_KEYS["event"]["queue"]
        event_processing = QUEUE_KEYS["event"]["processing"]
        event_failed = QUEUE_KEYS["event"]["failed"]
        
        stats["event"] = {
            "queue_count": redis_conn.zcard(event_queue),
            "processing_count": len(redis_conn.hkeys(event_processing)),
            "failed_count": len(redis_conn.hkeys(event_failed))
        }
        
        # Log queue stats
        log_queue = QUEUE_KEYS["log"]["queue"]
        log_entries = QUEUE_KEYS["log"]["entries"]
        
        stats["log"] = {
            "queue_count": redis_conn.zcard(log_queue),
            "entries_count": redis_conn.llen(log_entries)
        }
        
        return stats
    except Exception as e:
        logger.error(f"Error getting queue status: {e}")
        return {"error": str(e)}

def publish_notification(message, data=None):
    """Publish a notification to the notification stream."""
    try:
        notification = {
            "message": message,
            "timestamp": time.time(),
            "data": data or {}
        }
        
        # Convert to JSON and add to stream
        redis_conn.xadd(NOTIFICATION_STREAM, {"payload": json.dumps(notification)})
        return True
    except Exception as e:
        logger.error(f"Error publishing notification: {e}")
        return False

def flush_queue(queue_type):
    """Flush a specific queue."""
    try:
        queue_key = QUEUE_KEYS[queue_type]["queue"]
        processing_key = QUEUE_KEYS[queue_type]["processing"]
        
        # Get counts before flushing
        queue_count = redis_conn.zcard(queue_key)
        processing_count = len(redis_conn.hkeys(processing_key))
        
        # Flush both queue and processing
        redis_conn.delete(queue_key)
        redis_conn.delete(processing_key)
        
        total_removed = queue_count + processing_count
        
        # Publish notification
        publish_notification(
            f"{queue_type.capitalize()} queue flushed", 
            {
                "queue_count": queue_count,
                "processing_count": processing_count,
                "total_removed": total_removed
            }
        )
        
        return total_removed
    except Exception as e:
        logger.error(f"Error flushing {queue_type} queue: {e}")
        return 0

def get_stalled_jobs(queue_type, timeout_seconds=1800):
    """Get jobs that have been stuck in processing too long."""
    try:
        processing_key = QUEUE_KEYS[queue_type]["processing"]
        current_time = time.time()
        stalled_jobs = []
        
        all_processing = redis_conn.hgetall(processing_key)
        
        for job_id, job_json in all_processing.items():
            try:
                job = json.loads(job_json)
                processing_started = job.get('processing_started', 0)
                
                if current_time - processing_started > timeout_seconds:
                    job['id'] = job_id.decode() if isinstance(job_id, bytes) else job_id
                    stalled_jobs.append(job)
            except Exception as e:
                logger.error(f"Error parsing job {job_id} during stalled job check: {e}")
        
        return stalled_jobs
    except Exception as e:
        logger.error(f"Error getting stalled {queue_type} jobs: {e}")
        return []

def requeue_stalled_jobs(queue_type, timeout_seconds=1800):
    """Requeue jobs that have been stuck in processing too long."""
    try:
        stalled_jobs = get_stalled_jobs(queue_type, timeout_seconds)
        requeued_count = 0
        
        for job in stalled_jobs:
            job_id = job.get('instagram_handle', job.get('id', 'unknown'))
            processing_key = QUEUE_KEYS[queue_type]["processing"]
            queue_key = QUEUE_KEYS[queue_type]["queue"]
            
            # Remove from processing
            if isinstance(job_id, bytes):
                job_id_key = job_id
            else:
                job_id_key = job_id
                
            redis_conn.hdel(processing_key, job_id_key)
            
            # Update job and requeue
            job['enqueued_at'] = time.time()
            if 'processing_started' in job:
                del job['processing_started']
                
            # Add to queue with high priority
            redis_conn.zadd(queue_key, {json.dumps(job): -5})
            requeued_count += 1
            
            logger.warning(f"Requeued stalled {queue_type} job: {job_id} after timeout of {timeout_seconds} seconds.")
        
        if requeued_count > 0:
            # Publish notification
            publish_notification(
                f"Requeued {requeued_count} stalled {queue_type} jobs",
                {
                    "count": requeued_count,
                    "queue_type": queue_type,
                    "timeout_seconds": timeout_seconds
                }
            )
        
        return requeued_count
    except Exception as e:
        logger.error(f"Error requeuing stalled {queue_type} jobs: {e}")
        return 0

def enqueue_club(instagram_handle, priority=0):
    """Add a club to the scraper queue."""
    try:
        job = {
            'instagram_handle': instagram_handle,
            'enqueued_at': time.time(),
            'attempts': 0
        }
        queue_key = QUEUE_KEYS["scraper"]["queue"]
        redis_conn.zadd(queue_key, {json.dumps(job): priority})
        
        publish_notification(
            f"Added club {instagram_handle} to queue",
            {
                "instagram_handle": instagram_handle,
                "priority": priority
            }
        )
        
        logger.info(f"Enqueued club: {instagram_handle} with priority {priority}.")
        return True
    except Exception as e:
        logger.error(f"Error enqueueing club {instagram_handle}: {e}")
        return False

def requeue_job(queue_type, job_id):
    """Requeue a job that might be stuck."""
    try:
        processing_key = QUEUE_KEYS[queue_type]["processing"]
        queue_key = QUEUE_KEYS[queue_type]["queue"]
        
        # Get the job from processing
        job_data = redis_conn.hget(processing_key, job_id)
        if not job_data:
            logger.warning(f"Job {job_id} not found in {queue_type} processing queue.")
            return False
        
        # Parse the job
        job = json.loads(job_data)
        
        # Remove from processing
        redis_conn.hdel(processing_key, job_id)
        
        # Update job and add to queue with high priority
        job['enqueued_at'] = time.time()
        if 'processing_started' in job:
            del job['processing_started']
            
        redis_conn.zadd(queue_key, {json.dumps(job): -10})
        
        logger.info(f"Requeued {queue_type} job: {job_id}")
        publish_notification(f"Manual requeue of {queue_type} job: {job_id}")
        
        return True
    except Exception as e:
        logger.error(f"Error requeuing {queue_type} job {job_id}: {e}")
        return False

def populate_clubs_queue(limit=40):
    """Populate the scraper queue with clubs from the database."""
    try:
        # First get clubs that have never been scraped
        never_scraped = db.supabase.rpc('get_never_scraped_clubs', {
            'limit_num': limit
        }).execute()
        
        added_count = 0
        
        if never_scraped.data:
            for club in never_scraped.data:
                if enqueue_club(club["instagram_handle"]):
                    added_count += 1
        
        # If not enough, get oldest scraped clubs
        if added_count < limit:
            remaining = limit - added_count
            cooldown_hours = 24  # Default cooldown period
            cooldown_time = datetime.datetime.now() - datetime.timedelta(hours=cooldown_hours)
            
            oldest_scraped = db.supabase.rpc('get_oldest_scraped_clubs', {
                'cooldown_time': cooldown_time.isoformat(),
                'limit_num': remaining
            }).execute()
            
            if oldest_scraped.data:
                for club in oldest_scraped.data:
                    if enqueue_club(club["instagram_handle"]):
                        added_count += 1
        
        logger.info(f"Populated queue with {added_count} clubs")
        publish_notification(f"Populated queue with {added_count} clubs", {"count": added_count})
        
        return added_count
    except Exception as e:
        logger.error(f"Error populating clubs queue: {e}")
        return 0

def check_rate_limits(window_minutes=30):
    """
    Check Redis logs for rate limit occurrences and return severity level:
    0 = No issues, 1 = Mild (1-2 occurrences), 2 = Severe (3+ occurrences)
    """
    try:
        # Fetch all logs from Redis
        log_entries = redis_conn.lrange('logs:entries', 0, -1)
        now = datetime.datetime.now()
        count = 0

        for entry in reversed(log_entries):
            try:
                log_str = entry.decode('utf-8')

                if "Possible rate limit detected" in log_str or "RATE LIMIT DETECTED" in log_str:
                    # Try to extract the timestamp (format: "YYYY-MM-DDTHH:MM:SS")
                    timestamp_str = log_str.split(' - ')[0]

                    try:
                        timestamp = datetime.datetime.fromisoformat(timestamp_str)
                        if (now - timestamp).total_seconds() <= window_minutes * 60:
                            count += 1
                        else:
                            break  # If the log is older than the window, stop checking
                    except Exception:
                        continue  # Skip if timestamp parse fails

            except Exception:
                continue  # Skip malformed logs

        if count >= 3:
            return 2  # Severe
        elif count >= 1:
            return 1  # Mild
        else:
            return 0  # No issues

    except Exception as e:
        logger.error(f"Error checking for rate limits in Redis: {e}")
        return 0

# Check if user has admin role
def is_admin():
    async def predicate(ctx):
        # Check if user has admin role
        if ctx.guild is None:
            await ctx.send("uhhh srry these cmds dont work here 😖 pls try in a server!")
            return False
        
        admin_role = ctx.guild.get_role(JOB_BOT_ADMIN_ROLE_ID)
        if admin_role is None:
            await ctx.send("hmmm i don't think u have the ~special~ pass 🚫✨ can't let u run thattt 😅")
            return False
        
        if admin_role not in ctx.author.roles:
            await ctx.send("u gotta be a lil more official for this onee 🫣 admin onlyyy")
            return False
        
        return True  # allowed!
    
    return commands.check(predicate)


# Bot events
@job_bot.event
async def on_ready():
    logger.info(f"omg im back")
    activity = discord.Game(name="fixing the system ⚙️ | instinct.club")
    await job_bot.change_presence(status=discord.Status.online, activity=activity)
    
    # Start background tasks
    passive_error_monitor.start()
    queue_backlog_check.start()
    monitor_and_flush_logs.start()
    nightly_summary_check.start()
    clean_old_logs.start()
    requeue_stalled_task.start()
    # Add this to bot startup (on_ready event)
    monitor_system_health.start()
    logger.info("System health monitoring started")
    
    job_bot.queue_monitor = LiveQueueMonitor(
            job_bot, 
            JOB_BOT_CHANNEL_ID,
            update_interval=30
        )
    await job_bot.queue_monitor.start_monitoring()
    logger.info("Live queue monitor started automatically")

# Add a new health stream name constant at the top with the other stream names
    
    # Send startup notification
    await send_notification(message=f"hiii reporting for duty 📝✨ {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\nready to handle some jobs!! 🚀")

@job_bot.command(name="about")
async def about_fixie(ctx):
    embed = discord.Embed(
        title="🛠️ Fixie Bixie",
        description=(
            "> the slightly chaotic but hardworking soul behind instinct’s engine room 💻\n"
            "> she fixes bugs, keeps things running... and sometimes causes a little bit of drama 😳\n\n"
            "**vibe**: scrappy, loyal, built different.\n"
            "**catch her working**: [instinct-2.0](https://instinct-2-0.vercel.app) 🚀"
        ),
        color=0x5865F2  # Discord blurple
    )
    embed.set_footer(text="🧹 she loves you even when you forget her.", icon_url="https://img.icons8.com/color/48/000000/maintenance.png")
    await ctx.send(embed=embed)

# Background tasks
@tasks.loop(minutes=1)
async def passive_error_monitor():
    """Background task to monitor critical errors or rate limits 🚨😰"""
    try:
        # Fetch logs from Redis
        all_logs = redis_conn.lrange('logs:entries', 0, -1)
        
        # Initialize counter if not present
        if not hasattr(passive_error_monitor, "last_log_count"):
            passive_error_monitor.last_log_count = len(all_logs)
            return
        
        # Check for new logs
        if len(all_logs) > passive_error_monitor.last_log_count:
            new_logs = all_logs[:len(all_logs) - passive_error_monitor.last_log_count]
            
            for log_entry in new_logs:
                try:
                    log_str = log_entry.decode('utf-8')
                    
                    # Check for rate limits
                    if "RATE LIMIT DETECTED" in log_str:
                        embed = discord.Embed(
                            title="🚨 rate limit detected omg 😵‍💫",
                            description=f"```{log_str}```",
                            color=0xFEE75C  # Yellow
                        )
                        await send_notification(embed=embed)
                    
                    # Check for errors
                    elif " ERROR " in log_str:
                        embed = discord.Embed(
                            title="😣 uh ohhh i caught an error!!",
                            description=f"```{log_str}```",
                            color=0xED4245  # Red
                        )
                        await send_error(embed=embed)
                except Exception:
                    continue
            
            # Update counter
            passive_error_monitor.last_log_count = len(all_logs)
    except Exception as e:
        logger.error(f"hiii something went wrong in passive_error_monitor: {e}")

@tasks.loop(minutes=10)
async def queue_backlog_check():
    """Monitor queues to make sure they are not overloaded 📈🫣"""
    try:
        queue_stats = get_queue_status()
        
        # Check for backlog in scraper queue
        scraper_queue_count = queue_stats.get("scraper", {}).get("queue_count", 0)
        if scraper_queue_count > 100:
            await send_notification(
                message=f"😰 ummm there's like `{scraper_queue_count}` scraper jobs waiting rn... kinda stressing me out 💥 pls flush if u can!!!"
            )
        
        # Check for backlog in event queue
        event_queue_count = queue_stats.get("event", {}).get("queue_count", 0)
        if event_queue_count > 100:
            await send_notification(
                message=f"😵‍💫 omg `{event_queue_count}` event jobs just sittin here... can u help me clean up?? 🧹✨ flush me plss!!"
            )
    except Exception as e:
        logger.error(f"Queue monitor error: {e}")

@tasks.loop(minutes=5)
async def monitor_and_flush_logs():
    """Monitor Redis log storage size and flush to Discord if too big 📚💨"""
    try:
        log_entries = redis_conn.lrange('logs:entries', 0, -1)
        
        # Calculate approximate size
        total_size_bytes = sum(len(entry) for entry in log_entries)
        max_size_bytes = 3 * 1024 * 1024  # 3 MB
        
        if total_size_bytes >= max_size_bytes:
            logger.warning(f"Log size exceeded {total_size_bytes} bytes. Flushing to Discord...")
            
            # Write to temp file
            temp_log_file_path = '/tmp/redis_logs_flush.log'
            with open(temp_log_file_path, 'w') as f:
                for entry in log_entries:
                    f.write(entry.decode('utf-8') + '\n')
            
            # Send to Discord
            await send_error(
                message="🚨 hiiii sorryyy the logs got too chunky 😵‍💫 auto-flushing now!!",
                file=discord.File(temp_log_file_path)
            )
            
            # Clear logs
            redis_conn.delete('logs:entries')
            logger.info("Logs flushed and reset after sending to Discord.")
            
            # Little followup cuteness
            await send_notification(
                message="📚💨 okok i flushed all the heavy logs!! we're back to being light and speedy again ✨"
            )
    except Exception as e:
        logger.error(f"Error in monitor_and_flush_logs: {e}")

@tasks.loop(hours=24)
async def clean_old_logs():
    """Trim old Redis logs to keep only latest entries 🧹✨"""
    try:
        max_logs = 10000  # Keep last 10,000 logs
        log_count = redis_conn.llen('logs:entries')
        
        if log_count > max_logs:
            redis_conn.ltrim('logs:entries', -max_logs, -1)
            logger.info(f"Cleaned old logs. Kept {max_logs} recent entries.")
            await send_notification(
                message=f"🧹 hiii i did a lil cleaning!! kept the freshest `{max_logs}` logs only ✨🗂️"
            )
    except Exception as e:
        logger.error(f"Error during log cleaning: {e}")

@tasks.loop(minutes=30)
async def requeue_stalled_task():
    """Periodically check and requeue stalled jobs ♻️✨"""
    try:
        # Requeue stalled scraper jobs
        scraper_count = requeue_stalled_jobs("scraper")
        
        # Requeue stalled event jobs
        event_count = requeue_stalled_jobs("event")
        
        if scraper_count > 0 or event_count > 0:
            await send_notification(
                message=f"♻️ hiii i cleaned up a lil bit!! requeued `{scraper_count}` scraper jobs and `{event_count}` event jobs ✨📚"
            )
    except Exception as e:
        logger.error(f"Error in requeue_stalled_task: {e}")


@tasks.loop(hours=24)
async def nightly_summary_check():
    """Post system summary once a day at midnight 🌙✨"""
    now = datetime.datetime.now()
    
    if now.hour == 0:  # Midnight
        try:
            # Get queue status
            queue_stats = get_queue_status()
            
            # Count errors today
            errors_today = 0
            today_str = now.strftime('%Y-%m-%d')
            
            try:
                with open(LOG_FILE_PATH, 'r') as f:
                    lines = f.readlines()
                    errors_today = sum(1 for line in lines if 'ERROR' in line and today_str in line)
            except Exception as e:
                logger.error(f"Error counting today's errors: {e}")
            
            # Get stalled job counts
            scraper_stalled = len(get_stalled_jobs("scraper"))
            event_stalled = len(get_stalled_jobs("event"))
            
            # Create summary embed
            embed = discord.Embed(
                title="🌙 nightly check-in!!",
                description="hii here's what happened todayyy 🧸📖",
                color=0x5865F2,  # Discord blue
                timestamp=now
            )
            
            embed.add_field(
                name="🧹 Queue Status",
                value=(
                    f"➔ clubs still waiting: `{queue_stats.get('scraper', {}).get('queue_count', 0)}`\n"
                    f"➔ clubs being processed: `{queue_stats.get('scraper', {}).get('processing_count', 0)}`\n"
                    f"➔ events waiting: `{queue_stats.get('event', {}).get('queue_count', 0)}`\n"
                    f"➔ events being processed: `{queue_stats.get('event', {}).get('processing_count', 0)}`"
                ),
                inline=False
            )
            
            embed.add_field(
                name="🚨 lil bumps i found",
                value=f"➔ errors today: `{errors_today}`",
                inline=False
            )
            
            embed.add_field(
                name="🔎 stalled stuff i caught",
                value=(
                    f"➔ scraper jobs stuck: `{scraper_stalled}`\n"
                    f"➔ event jobs stuck: `{event_stalled}`"
                ),
                inline=False
            )
            
            embed.set_footer(
                text="okies that's it for now... goodnight 💤💗",
                icon_url="https://img.icons8.com/color/48/000000/combo-chart--v1.png"
            )
            
            await send_notification(embed=embed)
        except Exception as e:
            logger.error(f"Nightly summary error: {e}")

@job_bot.command(name="flushqueue")
@is_admin()
async def flush_queue_cmd(ctx, queue_type="scraper"):
    """Force clear a job queue (carefullyyy 😵‍💫)"""
    try:
        # Validate queue type
        if queue_type not in ["scraper", "event", "log"]:
            await ctx.send(
                f"😵‍💫 uhhh i don't recognize `{queue_type}`...\n"
                "use one of these bestie: `'scraper'`, `'event'`, or `'log'` pls!! ✨"
            )
            return
        
        # Get queue stats
        queue_stats = get_queue_status()
        queue_count = queue_stats.get(queue_type, {}).get("queue_count", 0)
        processing_count = queue_stats.get(queue_type, {}).get("processing_count", 0)
        
        if queue_count == 0 and processing_count == 0:
            await ctx.send(f"✅ omg all clearrr 💨 {queue_type.capitalize()} queue is already squeaky clean 🧽✨")
            return
        
        # Create confirmation view
        class ConfirmFlushView(View):
            def __init__(self):
                super().__init__(timeout=30)
                
            @discord.ui.button(label="🚨 YES, FLUSH IT", style=discord.ButtonStyle.danger)
            async def confirm_flush(self, interaction: discord.Interaction, button: Button):
                try:
                    # Flush the queue
                    count = flush_queue(queue_type)
                    
                    await interaction.response.edit_message(
                        content=f"🧹 all done! flushed `{count}` jobs from {queue_type} queue ✨",
                        view=None
                    )
                except Exception as e:
                    await interaction.response.edit_message(
                        content=f"😵‍💫 omg i messed up while flushing... `{e}`",
                        view=None
                    )
                    
            @discord.ui.button(label="❌ nah cancel", style=discord.ButtonStyle.secondary)
            async def cancel_flush(self, interaction: discord.Interaction, button: Button):
                await interaction.response.edit_message(content="okok cancelled 😌 no big moves todayy", view=None)
        
        # Send confirmation message
        await ctx.send(
            f"⚠️ WAIT BESTIE ‼️ `{queue_type.capitalize()}` queue has `{queue_count}` pending and `{processing_count}` processing rn...\n\n"
            "**are you SURE you wanna wipe it clean???** 🧹💨",
            view=ConfirmFlushView()
        )
    except Exception as e:
        logger.error(f"Error in flushqueue command: {e}")
        await ctx.send(f"💔 awww i tried but ran into an error while setting up flush: `{e}`")

@job_bot.command(name="populatequeue")
@is_admin()
async def populate_queue_cmd(ctx, limit: int = 40):
    """Populate the scraper queue with clubs to scrape."""
    try:
        # Validate limit
        if limit <= 0 or limit > 100:
            await ctx.send("hiii limit must be between 1 and 100 ✨ pls fix and try again!")
            return
        
        await ctx.send(f"okok populating the queue with up to {limit} clubs 📚✨")

        
        # Populate the queue
        count = populate_clubs_queue(limit)
        
        if count > 0:
            await ctx.send(f"✅ doneee! added {count} clubs to the scraper queue 📚🚀")

        else:
            await ctx.send("aww no new clubs added rn 💤 everything might be in cooldown, try later!")

    except Exception as e:
        logger.error(f"Error populating queue: {e}")
        await ctx.send(f"❌ Error: {str(e)}")

@job_bot.command(name="addclub")
@is_admin()
async def add_club_cmd(ctx, instagram_handle: str, priority: int = 0):
    """Add a specific club to the scraper queue ✨"""
    try:
        # Check if the club exists
        club_data = db.get_club_by_instagram_handle(instagram_handle)
        
        if not club_data:
            await ctx.send(
                f"😰 umm i couldn't find `{instagram_handle}` in the database...\n"
                "could u double check the spelling for meee pretty pls? 🥺✨"
            )
            return
        
        # Add to queue
        success = enqueue_club(instagram_handle, priority)
        
        if success:
            await ctx.send(
                f"yayyy i just added `{instagram_handle}` to the queue! 🎀⚡\n"
                f"she's gonna be processed soon ✨ (priority `{priority}` 🚀)"
            )
        else:
            await ctx.send(
                f"💔 awww i tried but i couldn't add `{instagram_handle}` to the queue... "
                "maybe smth went wrong? 🥲 pls try again later?"
            )

    except Exception as e:
        logger.error(f"Error adding club to queue: {e}")
        await ctx.send(f"😵‍💫 umm i ran into an error while adding... `{e}` sorry bestie!!")


@job_bot.command(name="requeuejob")
@is_admin()
async def requeue_job_cmd(ctx, instagram_handle: str, job_type: str = "scraper"):
    """Requeue a job that might be stuck in processing."""
    try:
        # Validate job type
        if job_type not in ["scraper", "event"]:
            await ctx.send(f"huhhh `{job_type}` isn't valid 😵‍💫 use 'scraper' or 'event' instead!")
            return
        
        # Requeue the job
        success = requeue_job(job_type, instagram_handle)
        
        if success:
            await ctx.send(f"✅ requeued the {job_type} job for `{instagram_handle}`! all set 🚀")

        else:
            await ctx.send(f"ummm couldn't find `{instagram_handle}` in {job_type} processing 😔")

    except Exception as e:
        logger.error(f"Error requeuing job: {e}")
        await ctx.send(f"there appears to be an error: {str(e)}")

@job_bot.command(name="emergencyrequeue")
@is_admin()
async def emergency_requeue_cmd(ctx):
    """Emergency: Requeue all currently processing jobs back into the queue 🚨💨"""
    try:
        class ConfirmRequeueView(View):
            def __init__(self):
                super().__init__(timeout=30)
                
            @discord.ui.button(label="🚨 YES, Save the Jobs!!", style=discord.ButtonStyle.danger)
            async def confirm(self, interaction: discord.Interaction, button: Button):
                try:
                    # Requeue scraper jobs
                    scraper_processing = redis_conn.hgetall(QUEUE_KEYS["scraper"]["processing"])
                    scraper_requeued = 0
                    
                    for job_id, job_json in scraper_processing.items():
                        job = json.loads(job_json)
                        instagram_handle = job['instagram_handle']
                        
                        # Requeue with high priority
                        new_job = {
                            'instagram_handle': instagram_handle,
                            'enqueued_at': time.time(),
                            'attempts': job.get('attempts', 0) + 1
                        }
                        redis_conn.zadd(QUEUE_KEYS["scraper"]["queue"], {json.dumps(new_job): -10})
                        redis_conn.hdel(QUEUE_KEYS["scraper"]["processing"], job_id)
                        scraper_requeued += 1
                    
                    # Requeue event jobs
                    event_processing = redis_conn.hgetall(QUEUE_KEYS["event"]["processing"])
                    event_requeued = 0
                    
                    for job_id, job_json in event_processing.items():
                        job = json.loads(job_json)
                        instagram_handle = job['instagram_handle']
                        
                        # Requeue with high priority
                        new_job = {
                            'instagram_handle': instagram_handle,
                            'enqueued_at': time.time(),
                            'attempts': job.get('attempts', 0) + 1
                        }
                        redis_conn.zadd(QUEUE_KEYS["event"]["queue"], {json.dumps(new_job): -10})
                        redis_conn.hdel(QUEUE_KEYS["event"]["processing"], job_id)
                        event_requeued += 1
                    
                    # Publish notification
                    publish_notification(
                        "Emergency requeue of all jobs",
                        {
                            "scraper_jobs": scraper_requeued,
                            "event_jobs": event_requeued
                        }
                    )
                    
                    await interaction.response.edit_message(
                        content=f"✅ all saved! 🛟 i requeued {scraper_requeued} scraper jobs and {event_requeued} event jobs! we're sooo back 💖✨",
                        view=None
                    )
                except Exception as e:
                    await interaction.response.edit_message(
                        content=f"💔 umm smth broke while requeuing... `{e}` pls forgive meee",
                        view=None
                    )
                    
            @discord.ui.button(label="❌ Cancel", style=discord.ButtonStyle.secondary)
            async def cancel(self, interaction: discord.Interaction, button: Button):
                await interaction.response.edit_message(
                    content="okie no worries!! cancelling requeue like u said 🙈✨", 
                    view=None
                )
        
        # Send confirmation message
        await ctx.send(
            "**⚠️ EMERGENCY MODE ⚠️**\n"
            "this is like DEFCON 1 fr 😭💨 i'm gonna save all stuck jobs if u confirm!\n\n"
            "**are u REALLY REALLY sure bestie?** ✨👀",
            view=ConfirmRequeueView()
        )
    except Exception as e:
        logger.error(f"Emergency requeue failed: {e}")
        await ctx.send(f"🚨 uhh emergency requeue broke... `{e}` 😭 pls check me!")

@job_bot.command(name="getlogs")
@is_admin()
async def get_logs_cmd(ctx, count: int = 50):
    """Fetch the latest logs stored in Redis and send them to youuuu! 🎀"""
    try:
        # Validate count
        if count <= 0 or count > 1000:
            await ctx.send("⚠️ umm bestie no 💀 pick a number between **1 and 1000** pls ✨")
            return
        
        log_entries = redis_conn.lrange('logs:entries', 0, count - 1)
        
        if not log_entries:
            await ctx.send("📚💨 no logs found rn... she's clear and thrivinggg 😌")
            return
        
        # Write logs to a temp file
        temp_log_path = '/tmp/current_redis_logs.log'
        with open(temp_log_path, 'w') as f:
            for entry in log_entries:
                f.write(entry.decode('utf-8') + '\n')
        
        await ctx.send(
            content=f"here's the latest **{min(count, len(log_entries))} logs** u asked forrr 📝💖",
            file=discord.File(temp_log_path)
        )
    except Exception as e:
        logger.error(f"Error in getlogs command: {e}")
        await ctx.send(f"😭 i tried so hard but i can't fetch them logs rn: `{e}`")

@job_bot.command(name="lasterrors")
async def last_errors_cmd(ctx, count: int = 10):
    """Fetch the last N error logs stored in Redis and show them all cuteee."""
    try:
        # Validate count
        if count <= 0 or count > 25:
            await ctx.send("⚠️ uhhh your count has to be between 1 and 25, silly 🤓✍️")
            return
        
        # Get all logs
        log_entries = redis_conn.lrange('logs:entries', 0, -1)
        
        if not log_entries:
            await ctx.send("hmmm no logs discovered rn! 📚✨ system's chillin fr")
            return
        
        # Filter error logs
        error_logs = []
        for entry in log_entries:
            log_str = entry.decode('utf-8')
            if " ERROR " in log_str or "[RATE LIMIT DETECTED]" in log_str:
                error_logs.append(log_str)
        
        if not error_logs:
            await ctx.send("hiii no errors showing atm 😌 everything's smooth like butterrr 🧈✨")
            return
        
        # Get last N errors
        latest_errors = error_logs[-count:]
        
        # Create embed
        embed = discord.Embed(
            title=f"🚨 here are the last {len(latest_errors)} Errors i found",
            description="pls don't panic tho 😭 we're working on ittt",
            color=0xED4245  # Red
        )
        
        for idx, error in enumerate(latest_errors, start=1):
            try:
                # Try to get timestamp and message
                parts = error.split(' - ', 2)
                timestamp = parts[0] if len(parts) > 0 else "Unknown time"
                message = parts[2] if len(parts) > 2 else error
                
                # Truncate message if too long
                if len(message) > 200:
                    message = message[:197] + "..."
                
                embed.add_field(
                    name=f"{idx}. 🕒 {timestamp}",
                    value=f"```{message}```",
                    inline=False
                )
            except Exception as e:
                logger.warning(f"couldn't parse this log entry: {e}")
                continue
        
        await ctx.send(embed=embed)
    except Exception as e:
        logger.error(f"uhhh issue in lasterrors cmd: {e}")
        await ctx.send(f"💔 i tripped trying to fetch the errors: `{e}`")

@job_bot.command(name="prettylog")
@is_admin()
async def pretty_log_cmd(ctx, count: int = 20):
    """Show nicely formatted recent logs from Redis"""
    try:
        # Validate count
        if count <= 0 or count > 100:
            await ctx.send("🤨 please pick a number between 1 and 100, bestie!")
            return
        
        log_entries = redis_conn.lrange('logs:entries', 0, count - 1)
        
        if not log_entries:
            await ctx.send("📝 no logs found right now! system's quiet 💤")
            return
        
        # Format logs nicely
        formatted_logs = []
        for entry in log_entries:
            try:
                log_data = json.loads(entry.decode('utf-8'))
                timestamp = log_data.get('timestamp', 'Unknown time')
                level = log_data.get('level', 'INFO')
                message = log_data.get('message', 'No message')
                
                # Format by log level with emojis
                if level == "ERROR":
                    prefix = "🚨"
                elif level == "WARNING":
                    prefix = "⚠️"
                elif level == "INFO":
                    prefix = "ℹ️"
                else:
                    prefix = "📝"
                
                # Add to formatted logs
                formatted_logs.append(f"{prefix} **{timestamp.split('T')[1].split('.')[0]}** - {message}")
            except Exception as e:
                logger.error(f"Error parsing log entry: {e}")
                continue
        
        # Split into chunks if too many logs
        log_chunks = [formatted_logs[i:i+10] for i in range(0, len(formatted_logs), 10)]
        
        for i, chunk in enumerate(log_chunks):
            embed = discord.Embed(
                title=f"✨ Pretty Logs ({i+1}/{len(log_chunks)})",
                description="\n".join(chunk),
                color=0x7289DA
            )
            await ctx.send(embed=embed)
            
    except Exception as e:
        logger.error(f"Error in prettylog command: {e}")
        await ctx.send(f"💔 couldn't fetch pretty logs because: `{e}`")

@job_bot.command(name="scrapeinfo")
async def scrape_info_cmd(ctx, hours: int = 1):
    """Show scraping statistics for the last N hours"""
    try:
        # Validate hours
        if hours <= 0 or hours > 48:
            await ctx.send("⏰ please choose between 1 and 48 hours, hun!")
            return
        
        # Get logs from Redis
        log_entries = redis_conn.lrange('logs:entries', 0, -1)
        
        # Set time threshold
        now = datetime.datetime.now()
        time_threshold = now - datetime.timedelta(hours=hours)
        
        # Initialize counters
        stats = {
            "total_clubs_processed": 0,
            "successful_scrapes": 0,
            "failed_scrapes": 0,
            "rate_limits": 0,
            "processed_clubs": set(),
            "errors": []
        }
        
        # Process logs
        for entry in log_entries:
            try:
                log_data = json.loads(entry.decode('utf-8'))
                timestamp = log_data.get('timestamp')
                message = log_data.get('message', '')
                level = log_data.get('level', '')
                
                # Parse timestamp
                log_time = datetime.datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                
                # Skip if older than threshold
                if log_time < time_threshold:
                    continue
                    
                # Count club processing
                if "Processing club" in message:
                    club = message.split("Processing club ")[1].strip().rstrip('.')
                    stats["processed_clubs"].add(club)
                    stats["total_clubs_processed"] += 1
                
                # Count successful scrapes
                if "Successfully scraped" in message:
                    stats["successful_scrapes"] += 1
                    
                # Count failures
                if level == "ERROR" and "club" in message.lower():
                    stats["failed_scrapes"] += 1
                    # Store error details (limited to 5)
                    if len(stats["errors"]) < 5:
                        stats["errors"].append(message[:100] + "..." if len(message) > 100 else message)
                
                # Count rate limits
                if "rate limit" in message.lower():
                    stats["rate_limits"] += 1
                    
            except Exception:
                continue
                
        # Create embed
        embed = discord.Embed(
            title=f"📊 Scraping Stats (Last {hours} hours)",
            description=f"Here's what's been happening with the scraper in the last {hours} hour(s):",
            color=0x57F287 if stats["rate_limits"] == 0 else 0xED4245,
            timestamp=now
        )
        
        embed.add_field(
            name="🔍 Scraping Activity",
            value=(
                f"➔ Total clubs processed: **{stats['total_clubs_processed']}**\n"
                f"➔ Unique clubs: **{len(stats['processed_clubs'])}**\n"
                f"➔ Successful scrapes: **{stats['successful_scrapes']}**\n"
                f"➔ Failed scrapes: **{stats['failed_scrapes']}**\n"
                f"➔ Rate limits encountered: **{stats['rate_limits']}**"
            ),
            inline=False
        )
        
        if stats["processed_clubs"]:
            # Show some of the clubs (max 10)
            club_list = list(stats["processed_clubs"])
            displayed_clubs = club_list[:10]
            club_text = ", ".join([f"`{club}`" for club in displayed_clubs])
            
            if len(club_list) > 10:
                club_text += f" and {len(club_list) - 10} more..."
                
            embed.add_field(
                name="🏫 Clubs Processed",
                value=club_text,
                inline=False
            )
            
        if stats["errors"]:
            embed.add_field(
                name="❌ Recent Errors",
                value="\n".join([f"• {error}" for error in stats["errors"]]),
                inline=False
            )
            
        await ctx.send(embed=embed)
            
    except Exception as e:
        logger.error(f"Error in scrapeinfo command: {e}")
        await ctx.send(f"😵‍💫 couldn't get scraping stats because: `{e}`")

# Global state for notification silencing
notification_state = {
    "silenced": False,
    "silenced_until": None,
    "silenced_by": None
}

@job_bot.command(name="unsilence")
@is_admin()
async def unsilence_cmd(ctx):
    """Turn notifications back on"""
    global notification_state
    
    try:
        if not notification_state["silenced"]:
            await ctx.send("🔊 notifications are already on, bestie!")
            return
            
        # Update silencing state
        notification_state = {
            "silenced": False,
            "silenced_until": None,
            "silenced_by": None
        }
        
        await ctx.send("🔊 i'm back and louder than ever! notifications turned back ON ✨")
        
    except Exception as e:
        logger.error(f"Error in unsilence command: {e}")
        await ctx.send(f"😵‍💫 couldn't restore notifications because: `{e}`")

async def auto_unsilence(minutes):
    """Background task to automatically unsilence after duration"""
    global notification_state
    
    await asyncio.sleep(minutes * 60)  # Convert to seconds
    
    # Check if still silenced by the same command
    if notification_state["silenced"]:
        # Reset silencing state
        notification_state = {
            "silenced": False,
            "silenced_until": None,
            "silenced_by": None
        }
        
        # Send notification that silencing is over
        channel = job_bot.get_channel(JOB_BOT_CHANNEL_ID)
        if channel:
            await channel.send("🔊 silence time is OVER! i'm back to my chatty self again ✨")
            
@job_bot.command(name="silence")
@is_admin()
async def silence_cmd(ctx, duration_minutes: int = 30):
    """Silence notifications temporarily during scraping"""
    global notification_state
    
    try:
        # Validate duration
        if duration_minutes <= 0 or duration_minutes > 120:
            await ctx.send("⏱️ duration must be between 1 and 120 minutes, please!")
            return
        
        # Calculate end time
        end_time = datetime.datetime.now() + datetime.timedelta(minutes=duration_minutes)
        
        # Update silencing state
        notification_state = {
            "silenced": True,
            "silenced_until": end_time,
            "silenced_by": ctx.author.name
        }
        
        # Create embed
        embed = discord.Embed(
            title="🔕 Notifications Silenced",
            description=f"I'll be super quiet for the next {duration_minutes} minutes!",
            color=0x9B59B6,
            timestamp=datetime.datetime.now()
        )
        
        embed.add_field(
            name="Details",
            value=(
                f"➔ Silenced by: **{ctx.author.name}**\n"
                f"➔ Silent until: **{end_time.strftime('%H:%M:%S')}**\n"
                f"➔ Use `!unsilence` to unmute me early!"
            ),
            inline=False
        )
        
        embed.set_footer(text="scraping in peace... 💤✨")
        
        await ctx.send(embed=embed)
        
        # Start a background task to automatically unsilence
        job_bot.loop.create_task(auto_unsilence(duration_minutes))
        
    except Exception as e:
        logger.error(f"Error in silence command: {e}")
        await ctx.send(f"💔 couldn't silence notifications: `{e}`")
# Modify the send_notification and send_error functions to respect silencing
async def send_notification(embed=None, message=None, file=None):
    """Send a notification to the main notification channel, respecting silence mode."""
    # Check if notifications are silenced
    if notification_state["silenced"]:
        # Log that a notification was suppressed
        logger.info(f"Notification suppressed during silence period: {message if message else 'embed notification'}")
        return
        
    channel = job_bot.get_channel(JOB_BOT_CHANNEL_ID)
    if channel:
        if embed:
            await channel.send(embed=embed)
        elif message:
            if file:
                await channel.send(content=message, file=file)
            else:
                await channel.send(content=message)

async def send_error(embed=None, message=None, file=None):
    """Send an error message to the error channel, respecting silence mode for non-critical errors."""
    # For errors, we'll still send CRITICAL errors even during silence
    is_critical = False
    if embed and "CRITICAL" in embed.title:
        is_critical = True
    if message and "CRITICAL" in message:
        is_critical = True
        
    # Check if notifications are silenced and this isn't critical
    if notification_state["silenced"] and not is_critical:
        # Log that an error notification was suppressed
        logger.info(f"Error notification suppressed during silence period: {message if message else 'embed error'}")
        return
        
    channel = job_bot.get_channel(JOB_BOT_ERROR_CHANNEL_ID)
    if channel:
        if embed:
            await channel.send(embed=embed)
        elif message:
            if file:
                await channel.send(content=message, file=file)
            else:
                await channel.send(content=message)

@job_bot.command(name="systemstatus")
async def system_status_cmd(ctx):
    """Check system health and send a status embed (girlboss edition 💅)"""
    try:
        # Get queue status
        queue_stats = get_queue_status()
        
        # Get rate limit level
        rate_limit_level = check_rate_limits()
        if rate_limit_level == 0:
            rate_status = "🟢 all clear bestie, no rate limits detected!!"
        elif rate_limit_level == 1:
            rate_status = "🟡 ehh like 1-2 rate limits... not cute but survivable"
        else:
            rate_status = "🔴 UMMM HELP we're rate limited like crazy 😭"

        # Get stalled job counts
        scraper_stalled = len(get_stalled_jobs("scraper"))
        event_stalled = len(get_stalled_jobs("event"))
        
        # Pick color
        if rate_limit_level == 2 or scraper_stalled > 5 or event_stalled > 5:
            status_color = 0xED4245  # Red (she's panicking)
        elif rate_limit_level == 1 or scraper_stalled > 0 or event_stalled > 0:
            status_color = 0xFEE75C  # Yellow (she's stressed but lying about it)
        else:
            status_color = 0x57F287  # Green (she’s thriving ✨)

        # Build the embed
        embed = discord.Embed(
            title="📈 system check-in 💅✨",
            description="heyyy here's the tea on how instinct is doing rn:",
            color=status_color,
            timestamp=datetime.datetime.now()
        )

        embed.add_field(
            name="🛠️ job queue status",
            value=(
                f"➔ Clubs pending: `{queue_stats.get('scraper', {}).get('queue_count', 0)}`\n"
                f"➔ Clubs processing: `{queue_stats.get('scraper', {}).get('processing_count', 0)}`\n"
                f"➔ Events pending: `{queue_stats.get('event', {}).get('queue_count', 0)}`\n"
                f"➔ Events processing: `{queue_stats.get('event', {}).get('processing_count', 0)}`"
            ),
            inline=False
        )

        embed.add_field(
            name="💖 system vibes",
            value=(
                f"➔ Rate limits (30m): {rate_status}\n"
                f"➔ Stalled scraper jobs: `{scraper_stalled}`\n"
                f"➔ Stalled event jobs: `{event_stalled}`"
            ),
            inline=False
        )

        embed.set_footer(
            text="💅 always working harder than everyone else... ur welcome 😘",
            icon_url="https://img.icons8.com/color/48/robot-2--v1.png"
        )

        await ctx.send(embed=embed)

    except Exception as e:
        logger.error(f"Error in systemstatus command: {e}")
        await ctx.send(f"🥺 uhh i tripped trying to check system status... pls check logs 👉 {e}")


@job_bot.command(name="listfailed")
@is_admin()
async def list_failed_cmd(ctx):
    """Show failed clubs."""
    failed_jobs = redis_conn.hgetall(QUEUE_KEYS["scraper"]["failed"])
    if not failed_jobs:
        await ctx.send("💖 no failed clubs rn! she's perfect fr ✨")
        return

    embed = discord.Embed(title="💥 Failed Clubs", color=0xED4245)

    for idx, (job_id, job_data) in enumerate(failed_jobs.items(), start=1):
        job = json.loads(job_data)
        error = job.get("error", "unknown error")
        embed.add_field(
            name=f"{idx}. {job_id.decode() if isinstance(job_id, bytes) else job_id}",
            value=f"Error: `{error}`",
            inline=False
        )
        if idx >= 20:
            break  # Cap at 20 per page for now

    await ctx.send(embed=embed)

@job_bot.command(name="buryclub")
@is_admin()
async def bury_club_cmd(ctx, instagram_handle: str):
    """Permanently remove a failed club."""
    if redis_conn.hdel(QUEUE_KEYS["scraper"]["failed"], instagram_handle):
        await ctx.send(f"🪦 buried `{instagram_handle}` forever... rest in peace queen ✨")
    else:
        await ctx.send(f"💔 couldn't find `{instagram_handle}` in failed list...")
@job_bot.command(name="massbury")
@is_admin()
async def mass_bury_cmd(ctx):
    """Delete all failed clubs."""
    failed_count = len(redis_conn.hkeys(QUEUE_KEYS["scraper"]["failed"]))
    if failed_count == 0:
        await ctx.send("✅ no failed clubs to bury!")
        return

    class ConfirmBuryView(View):
        def __init__(self):
            super().__init__(timeout=20)

        @discord.ui.button(label="YES, Bury All", style=discord.ButtonStyle.danger)
        async def confirm_bury(self, interaction: discord.Interaction, button: Button):
            redis_conn.delete(QUEUE_KEYS["scraper"]["failed"])
            await interaction.response.edit_message(content=f"🪦 all {failed_count} failed clubs buried. rest easy ✨", view=None)

        @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
        async def cancel_bury(self, interaction: discord.Interaction, button: Button):
            await interaction.response.edit_message(content="okok cancelling mass burial 🙈✨", view=None)

    await ctx.send(
        f"⚠️ there's `{failed_count}` failed clubs... you sure you wanna mass bury them??? 🪦",
        view=ConfirmBuryView()
    )
@job_bot.command(name="revive")
@is_admin()
async def revive_club_cmd(ctx, instagram_handle: str):
    """Retry a failed club manually."""
    job_json = redis_conn.hget(QUEUE_KEYS["scraper"]["failed"], instagram_handle)
    if not job_json:
        await ctx.send(f"💔 umm `{instagram_handle}` isn't in failed list...")
        return

    job = json.loads(job_json)
    redis_conn.hdel(QUEUE_KEYS["scraper"]["failed"], instagram_handle)
    redis_conn.zadd(QUEUE_KEYS["scraper"]["queue"], {json.dumps(job): 0})

    await ctx.send(f"✨ revived `{instagram_handle}` back into the queue! she's gonna try again fr 🏃‍♀️")

@job_bot.command(name="cleanup")
@is_admin()
async def cleanup_cmd(ctx):
    """Trigger database cleanup operations (girlboss style 💅)"""
    try:
        await ctx.send("okok ✨ starting my deep clean mode 🧹💨 wish me luckkk!")

        # Clean up orphaned records
        try:
            db.supabase.rpc('cleanup_orphaned_records').execute()
            await ctx.send("✅ orphaned records? *gone.* no crumbs left 💅")
        except Exception as e:
            logger.error(f"Error cleaning up orphaned records: {e}")
            await ctx.send(f"❌ umm i tripped while cleaning orphaned records 😭 `{e}`")

        # Refresh materialized views
       
        # Delete old events
        try:
            db.supabase.rpc('delete_old_events').execute()
            await ctx.send("✅ deleted old events like taking out the trash 🚮✨")
        except Exception as e:
            logger.error(f"Error deleting old events: {e}")
            await ctx.send(f"❌ oops couldn't delete old events... `{e}`")

        # Refresh club search vector
        try:
            db.supabase.rpc('refresh_club_search_vector').execute()
            await ctx.send("✅ refreshed club search vectors! feeling extra smart now 🤓💡")
        except Exception as e:
            logger.error(f"Error refreshing club search vector: {e}")
            await ctx.send(f"❌ failed to refresh club search vector 😔 `{e}`")

        await ctx.send("🎉 cleanup done babyyy!! everything's shiny and fresh ✨🧼💖")

    except Exception as e:
        logger.error(f"Error in cleanup command: {e}")
        await ctx.send(f"❌ umm i made a boo-boo during cleanup 🥲 `{e}`")
   
@job_bot.command(name="bitch")
async def help_cmd(ctx):
        """Show everything this girlboss can do"""
        embed = discord.Embed(
            title="💅✨ Job Bot Command Center ✨💅",
            description="heyyy it's me 💅 ur reliable (but dramatic) job manager.\nhere's everything i can do when im not crying over bugs 😭:",
            color=discord.Color.purple()
        )

        embed.add_field(
            name="!flushqueue [scraper|event|log]",
            value="delete the mess. 🚽 (pls double check or else ur cooked)",
            inline=False
        )
        embed.add_field(
            name="!populatequeue [limit]",
            value="fill the club list 📚✨ (aka building the empire)",
            inline=False
        )
        embed.add_field(
            name="!addclub <instagram_handle> [priority]",
            value="add 1 precious club manually 💖 (bc i luv u)",
            inline=False
        )
        embed.add_field(
            name="!requeuejob <instagram_handle> [scraper|event]",
            value="rescue a stuck job 🚑 (very heroic moment)",
            inline=False
        )
        embed.add_field(
            name="!emergencyrequeue",
            value="requeue everything 💥 (only if ur panicking... like me rn)",
            inline=False
        )
        embed.add_field(
            name="!systemstatus",
            value="system health check 📈 (she’s either thriving or sobbing)",
            inline=False
        )
        embed.add_field(
            name="!getlogs [count]",
            value="pull the receipts 📜💅 (get ur drama files ready)",
            inline=False
        )
        embed.add_field(
            name="!lasterrors [count]",
            value="show me the disasters 🚑💥 (errors but cute)",
            inline=False
        )
        embed.add_field(
            name="!cleanup",
            value="spring clean the whole thing 🧹✨ (fresh vibes only)",
            inline=False
        )
        embed.add_field(
    name="!buryclub <instagram_handle>",
    value="🪦 move a failed job to the graveyard (so i stop retrying it 🥀)",
    inline=False
)
        embed.add_field(
            name="!revive <instagram_handle>",
            value="✨ bring a graveyard job back to life (she deserves a second chance!!)",
            inline=False
        )
        embed.add_field(
            name="!massbury[queue_type]",
            value="🧹 delete all jobs in the graveyard (rip but necessary sometimes 💔)",
            inline=False
        )
        embed.add_field(
        name="!prettylog [count]",
        value="📝 show logs in a cute, readable format (default: 20)",
        inline=False
    )
        embed.add_field(
            name="!scrapeinfo [hours]",
            value="📊 get stats about recent scraping activity (default: last hour)",
            inline=False
        )
        embed.add_field(
            name="!silence [minutes]",
            value="🔕 shush notifications during scraping (default: 30 min)",
            inline=False
        )
        embed.add_field(
            name="!unsilence",
            value="🔊 turn notifications back on before time's up",
            inline=False
        )


        embed.set_footer(text="ur fav girlboss bot 💅 powered by caffeine + chaos", icon_url="https://img.icons8.com/emoji/48/robot-emoji.png")

        await ctx.send(embed=embed)



health_history = {
    "timestamps": deque(maxlen=60),  # Keep the last 60 data points
    "cpu_percent": deque(maxlen=60),
    "memory_percent": deque(maxlen=60),
    "disk_percent": deque(maxlen=60),
    "process_memory_mb": deque(maxlen=60),
    "last_health_id": "0"
}

# Create a new background task for reading health metrics
@tasks.loop(seconds=30)
async def monitor_system_health():
    """Background task to monitor system health metrics from Redis stream"""
    try:
        # Read latest health metrics
        health_metrics = read_health_metrics(health_history["last_health_id"], count=10)
        
        if not health_metrics:
            return
        
        # Update last ID for next check
        health_history["last_health_id"] = health_metrics[-1]["id"]
        
        # Process each health metric
        for metric in health_metrics:
            try:
                data = metric["payload"]
                
                # Add to history
                timestamp = datetime.datetime.fromisoformat(data.get("timestamp", "")).strftime("%H:%M:%S")
                health_history["timestamps"].append(timestamp)
                health_history["cpu_percent"].append(data.get("cpu", {}).get("percent", 0))
                health_history["memory_percent"].append(data.get("memory", {}).get("percent", 0))
                health_history["disk_percent"].append(data.get("disk", {}).get("percent", 0))
                health_history["process_memory_mb"].append(data.get("process", {}).get("memory_rss_mb", 0))
                
                # Check for critical alerts and send notifications if needed
                process_alerts(data)
                
            except Exception as e:
                logger.error(f"Error processing health metric: {e}")
                
    except Exception as e:
        logger.error(f"Error monitoring system health: {e}")

def process_alerts(health_data):
    """Process health data and send alerts for critical conditions"""
    try:
        # Check for critical CPU usage
        cpu_percent = health_data.get("cpu", {}).get("percent", 0)
        if cpu_percent > 90:
            asyncio.create_task(send_error(
                message=f"🚨 **CRITICAL CPU ALERT** 🚨\nCPU usage at {cpu_percent}% - system performance critical!"
            ))
        
        # Check for critical memory usage
        memory_percent = health_data.get("memory", {}).get("percent", 0)
        if memory_percent > 90:
            asyncio.create_task(send_error(
                message=f"🚨 **CRITICAL MEMORY ALERT** 🚨\nMemory usage at {memory_percent}% - system at risk of OOM!"
            ))
        
        # Check for process memory growth (potential memory leak)
        process_memory_mb = health_data.get("process", {}).get("memory_rss_mb", 0)
        if process_memory_mb > 2000:  # 2GB
            asyncio.create_task(send_error(
                message=f"🚨 **PROCESS MEMORY ALERT** 🚨\nScraper process using {process_memory_mb}MB - possible memory leak!"
            ))
            
    except Exception as e:
        logger.error(f"Error processing health alerts: {e}")

def read_health_metrics(last_id="0", count=10):
    """Read system health metrics from Redis stream"""
    try:
        results = redis_conn.xread({HEALTH_STREAM: last_id}, count=count)
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



@job_bot.command(name="systemhealth")
async def system_health_cmd(ctx):
    """Display detailed system health information 📊🔍"""
    try:
        # Get the latest health data
        health_metrics = read_health_metrics("0", count=1)
        
        if not health_metrics:
            await ctx.send("💔 no system health data available right now... check back later!")
            return
        
        health_data = health_metrics[0]["payload"]
        
        # Create the embed
        embed = discord.Embed(
            title="💻 System Health Report 📊",
            description="full diagnostic scan of the system 🔬",
            color=0x3498DB,  # Blue
            timestamp=datetime.datetime.now()
        )
        
        # CPU information
        cpu = health_data.get("cpu", {})
        cpu_percent = cpu.get("percent", 0)
        cpu_color = "🟢" if cpu_percent < 70 else "🟡" if cpu_percent < 90 else "🔴"
        
        embed.add_field(
            name=f"{cpu_color} CPU Status",
            value=(
                f"➔ Usage: **{cpu_percent}%**\n"
                f"➔ Frequency: **{cpu.get('frequency_mhz', 0)} MHz**\n"
                f"➔ Cores: **{cpu.get('cores_logical', 0)}** logical, **{cpu.get('cores_physical', 0)}** physical\n"
                f"➔ Context Switches: **{cpu.get('ctx_switches', 0):,}**"
            ),
            inline=False
        )
        
        # Memory information
        memory = health_data.get("memory", {})
        memory_percent = memory.get("percent", 0)
        memory_color = "🟢" if memory_percent < 70 else "🟡" if memory_percent < 90 else "🔴"
        
        embed.add_field(
            name=f"{memory_color} Memory Status",
            value=(
                f"➔ Usage: **{memory_percent}%**\n"
                f"➔ Total: **{memory.get('total_gb', 0)} GB**\n"
                f"➔ Available: **{memory.get('available_gb', 0)} GB**\n"
                f"➔ Swap Usage: **{memory.get('swap_percent', 0)}%** of **{memory.get('swap_total_gb', 0)} GB**"
            ),
            inline=False
        )
        
        # Disk information
        disk = health_data.get("disk", {})
        disk_percent = disk.get("percent", 0)
        disk_color = "🟢" if disk_percent < 75 else "🟡" if disk_percent < 90 else "🔴"
        
        embed.add_field(
            name=f"{disk_color} Disk Status",
            value=(
                f"➔ Usage: **{disk_percent}%**\n"
                f"➔ Total: **{disk.get('total_gb', 0)} GB**\n"
                f"➔ Free: **{disk.get('free_gb', 0)} GB**\n"
                f"➔ I/O: **{disk.get('read_count', 0):,}** reads, **{disk.get('write_count', 0):,}** writes"
            ),
            inline=False
        )
        
        # Process information
        process = health_data.get("process", {})
        process_memory_mb = process.get("memory_rss_mb", 0)
        process_color = "🟢" if process_memory_mb < 500 else "🟡" if process_memory_mb < 1000 else "🔴"
        
        embed.add_field(
            name=f"{process_color} Scraper Process",
            value=(
                f"➔ Memory: **{process_memory_mb} MB**\n"
                f"➔ CPU Usage: **{process.get('cpu_percent', 0)}%**\n"
                f"➔ Threads: **{process.get('threads', 0)}**\n"
                f"➔ Open Files: **{process.get('open_files', 0)}**\n"
                f"➔ Connections: **{process.get('connections', 0)}**"
            ),
            inline=False
        )
        
        # System information
        system = health_data.get("system", {})
        
        embed.add_field(
            name="🖥️ System Info",
            value=(
                f"➔ Platform: **{system.get('platform', 'Unknown')}**\n"
                f"➔ Python: **{system.get('python_version', 'Unknown')}**\n"
                f"➔ Uptime: **{system.get('uptime_seconds', 0) // 86400}d {(system.get('uptime_seconds', 0) % 86400) // 3600}h {((system.get('uptime_seconds', 0) % 86400) % 3600) // 60}m**\n"
                f"➔ Boot Time: **{system.get('boot_time', 'Unknown')}**"
            ),
            inline=False
        )
        
        # Network information
        network = health_data.get("network", {})
        
        embed.add_field(
            name="🌐 Network Activity",
            value=(
                f"➔ Sent: **{network.get('bytes_sent_mb', 0)} MB**\n"
                f"➔ Received: **{network.get('bytes_recv_mb', 0)} MB**\n"
                f"➔ Packets: **{network.get('packets_sent', 0):,}** sent, **{network.get('packets_recv', 0):,}** received\n"
                f"➔ Errors: **{network.get('errin', 0)}** in, **{network.get('errout', 0)}** out"
            ),
            inline=False
        )
        
        embed.set_footer(text="i'm keeping an eye on everything 👀 she's either thriving or strugglinggg")
        
        # Create and attach a graph image
        if len(health_history["timestamps"]) > 1:
            graph_file = await create_health_graph()
            await ctx.send(embed=embed, file=graph_file)
        else:
            await ctx.send(embed=embed)
        
    except Exception as e:
        logger.error(f"Error in systemhealth command: {e}")
        await ctx.send(f"😵‍💫 couldn't get system health info: `{e}`")

async def create_health_graph():
    """Create a graph of historical health metrics"""
    try:
        plt.figure(figsize=(10, 6))
        
        # Only plot if we have data
        if len(health_history["timestamps"]) > 1:
            x = list(range(len(health_history["timestamps"])))
            labels = list(health_history["timestamps"])
            
            # Plot CPU, memory and disk percentages
            plt.plot(x, list(health_history["cpu_percent"]), 'r-', label='CPU %')
            plt.plot(x, list(health_history["memory_percent"]), 'b-', label='Memory %')
            plt.plot(x, list(health_history["disk_percent"]), 'g-', label='Disk %')
            
            # Add a second y-axis for process memory
            ax2 = plt.twinx()
            ax2.plot(x, list(health_history["process_memory_mb"]), 'm-', label='Process Memory (MB)')
            ax2.set_ylabel('Process Memory (MB)')
            
            # Set labels
            plt.xlabel('Time')
            plt.ylabel('Usage %')
            plt.title('System Resource Usage History')
            
            # Set x-axis labels (showing fewer for readability)
            if len(x) > 10:
                step = len(x) // 10
                plt.xticks(x[::step], labels[::step], rotation=45)
            else:
                plt.xticks(x, labels, rotation=45)
                
            # Add legends
            lines1, labels1 = plt.gca().get_legend_handles_labels()
            lines2, labels2 = ax2.get_legend_handles_labels()
            plt.legend(lines1 + lines2, labels1 + labels2, loc='upper left')
            
            # Add grid for readability
            plt.grid(True, linestyle='--', alpha=0.7)
            
            # Adjust layout
            plt.tight_layout()
            
            # Save to a bytes buffer
            buf = io.BytesIO()
            plt.savefig(buf, format='png')
            buf.seek(0)
            
            # Create discord file
            file = discord.File(buf, filename="health_graph.png")
            plt.close()
            
            return file
        else:
            # Not enough data points yet
            return None
            
    except Exception as e:
        logger.error(f"Error creating health graph: {e}")
        return None

@job_bot.command(name="memgraph")
async def memory_graph_cmd(ctx, minutes: int = 30):
    """Generate a detailed memory usage graph 📊💭"""
    try:
        # Validate minutes
        if minutes <= 0 or minutes > 180:
            await ctx.send("⏰ please choose between 1 and 180 minutes, bestie!")
            return
            
        # Check if we have enough data
        if len(health_history["timestamps"]) < 2:
            await ctx.send("💔 not enough data points yet... check back in a few minutes!")
            return
            
        # Get the data limited to the requested time range
        data_limit = min(len(health_history["timestamps"]), int(minutes * 60 / 30))  # 30 second intervals
        
        timestamps = list(health_history["timestamps"])[-data_limit:]
        memory_percent = list(health_history["memory_percent"])[-data_limit:]
        process_memory = list(health_history["process_memory_mb"])[-data_limit:]
        
        # Create the graph
        plt.figure(figsize=(12, 7))
        
        # Plot memory percentage
        ax1 = plt.subplot(2, 1, 1)
        ax1.plot(timestamps, memory_percent, 'b-', marker='o', markersize=3, label='System Memory %')
        ax1.set_ylabel('Memory Usage %')
        ax1.set_title(f'Memory Usage History (Last {minutes} minutes)')
        ax1.grid(True, linestyle='--', alpha=0.7)
        ax1.legend(loc='upper left')
        
        # Plot process memory
        ax2 = plt.subplot(2, 1, 2)
        ax2.plot(timestamps, process_memory, 'm-', marker='o', markersize=3, label='Process Memory (MB)')
        ax2.set_ylabel('Process Memory (MB)')
        ax2.set_xlabel('Time')
        ax2.grid(True, linestyle='--', alpha=0.7)
        ax2.legend(loc='upper left')
        
        # Rotate timestamps for readability
        for ax in [ax1, ax2]:
            if len(timestamps) > 10:
                step = len(timestamps) // 10
                ax.set_xticks(range(0, len(timestamps), step))
                ax.set_xticklabels([timestamps[i] for i in range(0, len(timestamps), step)], rotation=45)
            else:
                ax.set_xticks(range(len(timestamps)))
                ax.set_xticklabels(timestamps, rotation=45)
        
        # Adjust layout
        plt.tight_layout()
        
        # Save to a bytes buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        
        # Create discord file
        file = discord.File(buf, filename="memory_graph.png")
        plt.close()
        
        # Send the graph
        await ctx.send(
            f"📊 **Memory Usage Graph** 📊\nShowing data for the last **{minutes} minutes**",
            file=file
        )
        
    except Exception as e:
        logger.error(f"Error creating memory graph: {e}")
        await ctx.send(f"💔 couldn't generate the memory graph: `{e}`")

@job_bot.command(name="cpugraph")
async def cpu_graph_cmd(ctx, minutes: int = 30):
    """Generate a detailed CPU usage graph 📈⚙️"""
    try:
        # Validate minutes
        if minutes <= 0 or minutes > 180:
            await ctx.send("⏰ please choose between 1 and 180 minutes, bestie!")
            return
            
        # Check if we have enough data
        if len(health_history["timestamps"]) < 2:
            await ctx.send("💔 not enough data points yet... check back in a few minutes!")
            return
            
        # Get the data limited to the requested time range
        data_limit = min(len(health_history["timestamps"]), int(minutes * 60 / 30))  # 30 second intervals
        
        timestamps = list(health_history["timestamps"])[-data_limit:]
        cpu_percent = list(health_history["cpu_percent"])[-data_limit:]
        
        # Create the graph
        plt.figure(figsize=(12, 6))
        
        # Plot CPU usage with gradient color based on intensity
        plt.plot(timestamps, cpu_percent, 'r-', marker='o', markersize=3, label='CPU Usage %')
        
        # Add threshold lines
        plt.axhline(y=70, color='y', linestyle='--', alpha=0.7, label='Warning Threshold (70%)')
        plt.axhline(y=90, color='r', linestyle='--', alpha=0.7, label='Critical Threshold (90%)')
        
        # Fill the area under the curve
        plt.fill_between(timestamps, cpu_percent, alpha=0.2, color='r')
        
        # Set labels and title
        plt.ylabel('CPU Usage %')
        plt.xlabel('Time')
        plt.title(f'CPU Usage History (Last {minutes} minutes)')
        plt.grid(True, linestyle='--', alpha=0.7)
        plt.legend(loc='upper left')
        
        # Rotate timestamps for readability
        if len(timestamps) > 10:
            step = len(timestamps) // 10
            plt.xticks(range(0, len(timestamps), step), [timestamps[i] for i in range(0, len(timestamps), step)], rotation=45)
        else:
            plt.xticks(range(len(timestamps)), timestamps, rotation=45)
        
        # Adjust layout
        plt.tight_layout()
        
        # Save to a bytes buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        
        # Create discord file
        file = discord.File(buf, filename="cpu_graph.png")
        plt.close()
        
        # Send the graph
        await ctx.send(
            f"📈 **CPU Usage Graph** 📈\nShowing data for the last **{minutes} minutes**",
            file=file
        )
        
    except Exception as e:
        logger.error(f"Error creating CPU graph: {e}")
        await ctx.send(f"💔 couldn't generate the CPU graph: `{e}`")

@job_bot.command(name="quickhealth")
async def quick_health_cmd(ctx):
    """Show a quick summary of system health 🔍✨"""
    try:
        # Get the latest health data
        health_metrics = read_health_metrics("0", count=1)
        
        if not health_metrics:
            await ctx.send("💔 no system health data available rn... check back later!")
            return
        
        health_data = health_metrics[0]["payload"]
        
        # Extract key metrics
        cpu_percent = health_data.get("cpu", {}).get("percent", 0)
        memory_percent = health_data.get("memory", {}).get("percent", 0)
        disk_percent = health_data.get("disk", {}).get("percent", 0)
        process_memory_mb = health_data.get("process", {}).get("memory_rss_mb", 0)
        
        # Determine status emojis
        cpu_emoji = "🟢" if cpu_percent < 70 else "🟡" if cpu_percent < 90 else "🔴"
        memory_emoji = "🟢" if memory_percent < 70 else "🟡" if memory_percent < 90 else "🔴"
        disk_emoji = "🟢" if disk_percent < 75 else "🟡" if disk_percent < 90 else "🔴"
        process_emoji = "🟢" if process_memory_mb < 500 else "🟡" if process_memory_mb < 1000 else "🔴"
        
        # Determine overall status
        if "🔴" in [cpu_emoji, memory_emoji, disk_emoji, process_emoji]:
            overall_status = "🔴 **CRITICAL**"
            color = 0xED4245  # Red
        elif "🟡" in [cpu_emoji, memory_emoji, disk_emoji, process_emoji]:
            overall_status = "🟡 **WARNING**"
            color = 0xFEE75C  # Yellow
        else:
            overall_status = "🟢 **HEALTHY**"
            color = 0x57F287  # Green
        
        # Create embed
        embed = discord.Embed(
            title="🩺 System Health Checkup",
            description=f"Quick health status: {overall_status}",
            color=color,
            timestamp=datetime.datetime.now()
        )
        
        embed.add_field(
            name="Key Metrics",
            value=(
                f"{cpu_emoji} CPU: **{cpu_percent}%**\n"
                f"{memory_emoji} Memory: **{memory_percent}%**\n"
                f"{disk_emoji} Disk: **{disk_percent}%**\n"
                f"{process_emoji} Process Memory: **{process_memory_mb} MB**"
            ),
            inline=False
        )
        
        embed.add_field(
            name="Last Update",
            value=f"⏰ {datetime.datetime.fromisoformat(health_data.get('timestamp', '')).strftime('%H:%M:%S')}",
            inline=False
        )
        
        embed.set_footer(text="use !systemhealth for detailed report or !cpugraph / !memgraph for trends")
        
        await ctx.send(embed=embed)
        
    except Exception as e:
        logger.error(f"Error in quickhealth command: {e}")
        await ctx.send(f"💔 couldn't get quick health info: `{e}`")
import asyncio
import datetime
import discord
from discord.ext import tasks
import json
from typing import Dict, List, Optional, Set

# Import the RedisScraperQueue class from your existing code
# Assuming the redis_queue.py file is in the same directory or in your import path
from redis_queue import RedisScraperQueue, QueueType

class LiveQueueMonitor:
    """
    A class to provide live updates about which clubs are being processed in the Redis queues.
    This can be integrated into your existing Discord bot.
    """
    def __init__(self, bot, channel_id: int, update_interval: int = 30):
        """
        Initialize the live queue monitor.
        
        Args:
            bot: The Discord bot instance
            channel_id: The ID of the channel to send updates to
            update_interval: How often to check for updates (in seconds)
        """
        self.bot = bot
        self.channel_id = channel_id
        self.update_interval = update_interval
        self.redis_queue = RedisScraperQueue()
        
        # Keep track of previously seen jobs to detect changes
        self.previous_processing: Set[str] = set()
        self.previous_queued_count = 0
        
        # Message ID of the pinned status message to update
        self.status_message_id = None
        
        # Emoji indicators for different states
        self.emojis = {
            "processing": "⚙️",
            "queued": "📋",
            "new": "🆕",
            "completed": "✅",
            "failed": "❌",
            "up": "📈",
            "down": "📉",
            "same": "➡️"
        }
    
    async def start_monitoring(self):
        """Start the monitor background task"""
        self.monitor_queue.start()
        channel = self.bot.get_channel(self.channel_id)
        if channel:
            await channel.send("📊 **Live Queue Monitor started!** I'll keep you updated on what's happening with the scraper jobs.")
    
    async def stop_monitoring(self):
        """Stop the monitor background task"""
        self.monitor_queue.cancel()
        channel = self.bot.get_channel(self.channel_id)
        if channel:
            await channel.send("📊 **Live Queue Monitor stopped!** You won't receive further updates.")
    
    async def create_status_message(self):
        """Create a new pinned status message that will be updated"""
        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            return
            
        embed = discord.Embed(
            title="🔄 Live Scraper Queue Status",
            description="This message will update automatically with the latest queue status.",
            color=0x3498DB,
            timestamp=datetime.datetime.now()
        )
        
        embed.add_field(
            name="⏳ Initializing...",
            value="Collecting data... please wait for the first update.",
            inline=False
        )
        
        message = await channel.send(embed=embed)
        
        # Pin the message for easy reference
        try:
            await message.pin()
            self.status_message_id = message.id
        except discord.HTTPException:
            # Failed to pin, possibly due to too many pins
            await channel.send("⚠️ Could not pin status message - you may have too many pins already. I'll still update it regularly.")
            self.status_message_id = message.id
    
    async def update_status_message(self, processing_jobs: List[str], queue_stats: Dict):
        """Update the pinned status message with current information"""
        if not self.status_message_id:
            await self.create_status_message()
            
        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            return
            
        try:
            message = await channel.fetch_message(self.status_message_id)
        except (discord.NotFound, discord.HTTPException):
            # Message was deleted or cannot be found
            await self.create_status_message()
            return
        
        # Create a new embed with updated information
        embed = discord.Embed(
            title="🔄 Live Scraper Queue Status",
            description=f"Last updated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            color=0x3498DB
        )
        
        # Queue stats section
        queue_count = queue_stats.get("queue_count", 0)
        processing_count = queue_stats.get("processing_count", 0)
        failed_count = queue_stats.get("failed_count", 0)
        stalled_count = queue_stats.get("stalled_count", 0)
        
        # Determine queue trend
        if queue_count > self.previous_queued_count:
            queue_trend = f"{self.emojis['up']} +{queue_count - self.previous_queued_count}"
        elif queue_count < self.previous_queued_count:
            queue_trend = f"{self.emojis['down']} -{self.previous_queued_count - queue_count}"
        else:
            queue_trend = f"{self.emojis['same']} No change"
        
        embed.add_field(
            name="📊 Queue Statistics",
            value=(
                f"{self.emojis['queued']} Queued: **{queue_count}** ({queue_trend})\n"
                f"{self.emojis['processing']} Processing: **{processing_count}**\n"
                f"{self.emojis['failed']} Failed: **{failed_count}**\n"
                f"⚠️ Stalled: **{stalled_count}**"
            ),
            inline=False
        )
        
        # Currently processing section
        if processing_jobs:
            # Find new entries that weren't in the previous update
            new_jobs = set(processing_jobs) - self.previous_processing
            
            processing_text = ""
            for i, job in enumerate(processing_jobs[:10], 1):
                marker = f"{self.emojis['new']} " if job in new_jobs else ""
                processing_text += f"{i}. {marker}`{job}`\n"
                
            if len(processing_jobs) > 10:
                processing_text += f"...and {len(processing_jobs) - 10} more clubs"
                
            embed.add_field(
                name=f"{self.emojis['processing']} Currently Processing ({len(processing_jobs)})",
                value=processing_text or "No clubs currently being processed.",
                inline=False
            )
        else:
            embed.add_field(
                name=f"{self.emojis['processing']} Currently Processing",
                value="No clubs currently being processed.",
                inline=False
            )
        
        # Recent activity section
        # We can include some information about recent completions or failures
        # This could be expanded with data from completed/failed queues
        
        # Update the message
        await message.edit(embed=embed)
        
        # Update previous state for comparison in next update
        self.previous_processing = set(processing_jobs)
        self.previous_queued_count = queue_count
    
    async def send_notification(self, title: str, message: str, color: int = 0x57F287):
        """Send a notification about notable queue events"""
        channel = self.bot.get_channel(self.channel_id)
        if not channel:
            return
            
        embed = discord.Embed(
            title=title,
            description=message,
            color=color,
            timestamp=datetime.datetime.now()
        )
        
        await channel.send(embed=embed)
    
    @tasks.loop(seconds=30)
    async def monitor_queue(self):
        """Background task to monitor the queue and provide updates"""
        try:
            # Get currently processing jobs
            processing_jobs_data = self.redis_queue.redis.hgetall(
                self.redis_queue.queue_keys[QueueType.SCRAPER]["processing"]
            )
            
            # Extract instagram handles from processing jobs
            processing_jobs = []
            for job_id, job_data in processing_jobs_data.items():
                try:
                    if isinstance(job_id, bytes):
                        job_id = job_id.decode('utf-8')
                    processing_jobs.append(job_id)
                except Exception as e:
                    print(f"Error processing job ID: {e}")
            
            # Get queue statistics
            queue_stats = self.redis_queue.get_queue_status(QueueType.SCRAPER)
            
            # Update the status message with current information
            await self.update_status_message(processing_jobs, queue_stats)
            
            # Check for notable events and send notifications
            await self.check_notable_events(processing_jobs, queue_stats)
            
        except Exception as e:
            print(f"Error in queue monitor: {e}")
    
    async def check_notable_events(self, processing_jobs: List[str], queue_stats: Dict):
        """Check for notable events and send notifications when appropriate"""
        # New jobs entering processing
        new_jobs = set(processing_jobs) - self.previous_processing
        if len(new_jobs) > 3:
            # More than 3 new jobs, just send a summary
            await self.send_notification(
                "🔄 New Clubs Being Processed",
                f"{len(new_jobs)} new clubs have started processing.",
                0x3498DB  # Blue
            )
        elif new_jobs and len(self.previous_processing) > 0:  # Don't notify on first run
            # 1-3 new jobs, list them specifically
            await self.send_notification(
                "🔄 New Clubs Being Processed",
                "The following clubs have started processing:\n" + 
                "\n".join([f"• `{job}`" for job in new_jobs]),
                0x3498DB  # Blue
            )
        
        # Jobs that finished processing
        completed_jobs = self.previous_processing - set(processing_jobs)
        if len(completed_jobs) > 3:
            # More than 3 completed jobs, just send a summary
            await self.send_notification(
                "✅ Clubs Finished Processing",
                f"{len(completed_jobs)} clubs have finished processing.",
                0x57F287  # Green
            )
            
        # Check if queue size has changed significantly
        if self.previous_queued_count > 0:  # Skip the first run
            queue_count = queue_stats.get("queue_count", 0)
            
            # Queue grew significantly (more than 10 new items)
            if queue_count > self.previous_queued_count + 10:
                await self.send_notification(
                    "📈 Queue Growth Detected",
                    f"The queue has grown from {self.previous_queued_count} to {queue_count} items.",
                    0xFEE75C  # Yellow
                )
            
            # Queue depleted significantly (more than 50% reduction with at least 10 items processed)
            elif self.previous_queued_count > 20 and queue_count <= self.previous_queued_count * 0.5:
                await self.send_notification(
                    "📉 Queue Depleting",
                    f"The queue has reduced from {self.previous_queued_count} to {queue_count} items.",
                    0x57F287  # Green
                )
        
        # Check for stalled jobs
        stalled_count = queue_stats.get("stalled_count", 0)
        if stalled_count > 0 and stalled_count % 5 == 0:  # Notify every 5 stalled jobs
            await self.send_notification(
                "⚠️ Stalled Jobs Detected",
                f"There are currently {stalled_count} stalled jobs in the scraper queue.",
                0xED4245  # Red
            )

# To integrate this with your existing bot, add the following to your bot.py file:

@job_bot.command(name="startmonitor")
@is_admin()
async def start_monitor_cmd(ctx):
    """Start the live queue monitoring system"""
    try:
        # Initialize the monitor if it doesn't exist
        if not hasattr(job_bot, "queue_monitor"):
            job_bot.queue_monitor = LiveQueueMonitor(
                job_bot, 
                JOB_BOT_CHANNEL_ID,  # Use your notification channel
                update_interval=30  # Update every 30 seconds
            )
        
        await job_bot.queue_monitor.start_monitoring()
    except Exception as e:
        logger.error(f"Error starting queue monitor: {e}")
        await ctx.send(f"❌ Error starting queue monitor: `{e}`")

@job_bot.command(name="stopmonitor")
@is_admin()
async def stop_monitor_cmd(ctx):
    """Stop the live queue monitoring system"""
    try:
        if hasattr(job_bot, "queue_monitor"):
            await job_bot.queue_monitor.stop_monitoring()
            await ctx.send("📊 Live queue monitoring stopped!")
        else:
            await ctx.send("📊 Monitor wasn't running!")
    except Exception as e:
        logger.error(f"Error stopping queue monitor: {e}")
        await ctx.send(f"❌ Error stopping queue monitor: `{e}`")


# Run the bot
if __name__ == "__main__":
    job_bot.run(JOB_BOT_TOKEN)