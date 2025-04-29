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

# Initialize bot with intents
intents = discord.Intents.default()
intents.message_content = True
intents.members = True
job_bot = commands.Bot(command_prefix=JOB_BOT_PREFIX, intents=intents)

# Initialize database connection
db = SupabaseQueries()

# Redis connection (shared resource)
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
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
   
@job_bot.command(name="helpp")
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



# Run the bot
if __name__ == "__main__":
    job_bot.run(JOB_BOT_TOKEN)