import os
import sys
import discord
import redis
import json
import time
import datetime
import requests
import traceback
from discord.ext import commands, tasks
from dotenv import load_dotenv
from discord import ButtonStyle
from discord.ui import Button, View, Select
from typing import Dict, List, Optional

# Path setup
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

# Import custom modules
from tools.logger import logger
from db.queries import SupabaseQueries

# Load environment variables
load_dotenv()

# Auxiliary Bot Configuration
AUX_BOT_TOKEN = os.getenv('AUX_BOT_TOKEN')
AUX_BOT_PREFIX = os.getenv('AUX_BOT_PREFIX', '?')
AUX_BOT_CHANNEL_ID = int(os.getenv('AUX_BOT_CHANNEL_ID', '0'))
AUX_BOT_ADMIN_ROLE_ID = int(os.getenv('AUX_BOT_ADMIN_ROLE_ID', '0'))
ALLOWED_SERVER_LIST = [int(os.getenv('SERVER_ID'))]
# security_checks.py or just at top of bot file

OWNER_USER_ID = int(os.getenv("USER_ID"))  # 👈  Discord user ID

# API Configuration
API_URL = os.getenv('BOT_API_URL')
API_AUTH_TOKEN = os.getenv('SUPABASE_KEY')

# Initialize bot with intents
intents = discord.Intents.default()
intents.message_content = True
intents.members = True
aux_bot = commands.Bot(command_prefix=AUX_BOT_PREFIX, intents=intents)

# Initialize database connection
db = SupabaseQueries()

# Redis connection (shared resource)
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
redis_conn = redis.from_url(redis_url)

# Redis queue key names (for status checks)
QUEUE_KEYS = {
    "scraper": {
        "queue": "scraper:queue",
        "processing": "scraper:processing",
        "failed": "scraper:failed"  # Added failed queue reference
    },
    "event": {
        "queue": "scraper:event_queue", 
        "processing": "scraper:event_processing",
        "failed": "scraper:event_failed"  # Added failed queue reference
    }
}

# Notification streams
NOTIFICATION_STREAM = "notifications"
STATUS_STREAM = "status"

# Track posted pending clubs
pending_clubs = {}  # pending_id -> message_id

# Automation control
automation_state = {
    "enabled": True,  # Default to enabled
    "last_run": 0,
    "populate_interval_hours": 2,  # How often to populate queue
    "check_pending_interval_minutes": 30,  # How often to check pending clubs
    "requeue_stalled_interval_minutes": 60,  # How often to check for stalled jobs
    "max_queue_size": 10,  # Maximum number of clubs to have in queue
    "auto_cleanup_days": 7,  # Days between automatic cleanup
    "last_population_time": 0,  # Timestamp of last population
    "min_population_interval_hours": 2,  # Minimum hours between populations
    "clubs_per_population": 15,  # Maximum clubs to add per population cycle
}

# Check if user has admin role
def is_admin():
    async def predicate(ctx):
        # Check if user has admin role
        if ctx.guild is None:
            await ctx.send("uhhh srry these cmds dont work here 😖 pls try in a server!")
            return False
        
        admin_role = ctx.guild.get_role(AUX_BOT_ADMIN_ROLE_ID)
        if admin_role is None:
            await ctx.send("hmmm i don't think u have the ~special~ pass 🚫✨ can't let u run thattt 😅")
            return False
        
        if admin_role not in ctx.author.roles:
            await ctx.send("u gotta be a lil more official lil bro for this onee 🫣 admin onlyyy")
            return False
        
        return True  # allowed!
    
    return commands.check(predicate)

@aux_bot.event
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

def get_queue_status():
    """Get status information for scraper and event queues."""
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
        
        return stats
    except Exception as e:
        logger.error(f"Error getting queue status: {e}")
        return {"error": str(e)}

# Club Approval Functions
def approve_club(pending_id):
    """Approve a pending club."""
    try:
        # Make sure API_AUTH_TOKEN is properly set and in the expected format
        # The server expects: Bearer <token>
        headers = {"Authorization": f"Bearer {API_AUTH_TOKEN}"}
        
        # Log the request before sending
        logger.info(f"🔄 Sending approval request for club {pending_id}")
        
        response = requests.post(
            f"{API_URL}/pending-club/{pending_id}/approve",
            headers={"Authorization": f"Bearer {API_AUTH_TOKEN}"}
        )
        
        # Log the full response for debugging
        logger.debug(f"Response: {response.status_code} - {response.text}")
        
        if response.status_code == 200:
            logger.info(f"✅ Successfully approved club {pending_id}")
            publish_notification(f"Club {pending_id} approved", {"pending_id": pending_id})
            return True
        else:
            # More detailed error logging
            logger.error(f"⚠️ Failed to approve club {pending_id}: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Error approving club {pending_id}: {str(e)}")
        return False

def reject_club(pending_id):
    """Reject and delete a pending club."""
    try:
        response = requests.delete(
            f"{API_URL}/pending-club/{pending_id}/reject",
            headers={"Authorization": f"Bearer {API_AUTH_TOKEN}"}
        )
        
        if response.status_code == 200:
            logger.info(f"✅ Successfully rejected and deleted club {pending_id}")
            publish_notification(f"Club {pending_id} rejected", {"pending_id": pending_id})
            return True
        else:
            logger.error(f"⚠️ Failed to reject club {pending_id}: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Error rejecting club {pending_id}: {e}")
        return False

# View (Buttons) for each pending club
class ApprovalView(View):
    def __init__(self, pending_id):
        super().__init__(timeout=None)  # No timeout for approval buttons
        self.pending_id = pending_id

    @discord.ui.button(label="Approve ✅", style=discord.ButtonStyle.success)
    async def approve(self, interaction: discord.Interaction, button: Button):
        if approve_club(self.pending_id):
            await interaction.message.delete()  # Delete the embed message
            await interaction.response.send_message(f"yaaaay i approved the club `{self.pending_id}`! 🌟✨", ephemeral=True)

            logger.info(f"Approved club {self.pending_id}")
        else:
            await interaction.response.send_message(f"⚠️ im unable to approve `{self.pending_id}`.", ephemeral=True)
    
    @discord.ui.button(label="Reject ❌", style=discord.ButtonStyle.danger)
    async def reject(self, interaction: discord.Interaction, button: Button):
        reject_club(self.pending_id)
        await interaction.message.delete()  # Delete the embed message
        await interaction.response.send_message(f"lol rejected `{self.pending_id}` like a boss 🤭❌", ephemeral=True)


# View for toggling automation
class AutomationToggleView(View):
    def __init__(self, current_state):
        super().__init__(timeout=None)
        self.current_state = current_state
        
    @discord.ui.button(label="Enable Automation", style=discord.ButtonStyle.success)
    async def enable_automation(self, interaction: discord.Interaction, button: Button):
        automation_state["enabled"] = True
        await interaction.response.edit_message(
            content=f"yaaaay automation is back ON 🔥💖 let's get this breaddd\n" +
                f"- Queue: every {automation_state['populate_interval_hours']} hours\n" +
                f"- Pending check: {automation_state['check_pending_interval_minutes']} mins\n" +
                f"- Stalled check: {automation_state['requeue_stalled_interval_minutes']} mins",
            view=AutomationToggleView(True)
        )
        
    @discord.ui.button(label="Disable Automation", style=discord.ButtonStyle.danger)
    async def disable_automation(self, interaction: discord.Interaction, button: Button):
        automation_state["enabled"] = False
        
        await interaction.response.edit_message(
            content="ugh fineee 🙄 automation is now **OFF**... guess it's all you now 💔",
            view=AutomationToggleView(False)
        )
@tasks.loop(hours=2)  # Run every 2 hours by default
async def auto_populate_queue():
    """Automatically populate the scraper queue when needed."""
    # Skip if automation is disabled
    if not automation_state["enabled"]:
        return
    
    # Check if enough time has passed since last population
    current_time = time.time()
    min_interval = automation_state["min_population_interval_hours"] * 3600
    
    if current_time - automation_state["last_population_time"] < min_interval:
        logger.debug("Skipping auto-population - too soon since last run")
        return
    
    try:
        # Check current queue size
        queue_stats = get_queue_status()
        current_queue_size = queue_stats.get("scraper", {}).get("queue_count", 0)
        
        # Only populate if queue is below threshold
        if current_queue_size >= automation_state["max_queue_size"]:
            logger.debug(f"Queue size ({current_queue_size}) is at or above max ({automation_state['max_queue_size']})")
            return
        
        # Calculate how many clubs to add
        clubs_to_add = min(
            automation_state["clubs_per_population"],
            automation_state["max_queue_size"] - current_queue_size
        )
        
        # Trigger population
        publish_notification(
            "Automated queue population",
            {
                "type": "command",
                "command": "populate_queue",
                "limit": clubs_to_add,
                "source": "aux_bot_auto",
                "trigger": "scheduled",
                "current_queue_size": current_queue_size
            }
        )
        
        # Update timestamp
        automation_state["last_population_time"] = current_time
        
        logger.info(f"Auto-triggered queue population: adding {clubs_to_add} clubs")
        
        # Optionally notify in Discord channel
        channel = aux_bot.get_channel(AUX_BOT_CHANNEL_ID)
        if channel and clubs_to_add > 0:
            await channel.send(f"🤖 automatically added {clubs_to_add} clubs to queue! current size: {current_queue_size + clubs_to_add} ✨")
            
    except Exception as e:
        logger.error(f"Error in auto_populate_queue: {e}")
        
        # Notify about error in Discord
        channel = aux_bot.get_channel(AUX_BOT_CHANNEL_ID)
        if channel:
            await channel.send(f"😭 auto-population failed: {str(e)}")
# Bot events
@aux_bot.event
async def on_ready():
    logger.info(f"Auxiliary Bot logged in as {aux_bot.user}")
    
    # Start background tasks
    check_pending_clubs.start()
    auto_populate_queue.start()
    auto_requeue_stalled.start()
    auto_cleanup.start()
    
    # Set activity status
    activity = discord.Game(name="managing queues ✨ | instinct-2.0")
    await aux_bot.change_presence(status=discord.Status.online, activity=activity)
    
    # Initial queue population if enabled and queue is empty
    if automation_state["enabled"]:
        try:
            queue_stats = get_queue_status()
            current_queue_size = queue_stats.get("scraper", {}).get("queue_count", 0)
            
            if current_queue_size == 0:
                # Populate queue on startup
                publish_notification(
                    "Initial queue population on bot startup", 
                    {
                        "type": "command",
                        "command": "populate_queue",
                        "limit": automation_state["clubs_per_population"],
                        "source": "aux_bot_startup",
                        "trigger": "startup"
                    }
                )
                automation_state["last_population_time"] = time.time()
                logger.info("Triggered initial queue population on startup")
        except Exception as e:
            logger.error(f"Error during startup population: {e}")
    
    # Send startup notification
    channel = aux_bot.get_channel(AUX_BOT_CHANNEL_ID)
    if channel:
        await channel.send(
            f"heyyyyy im awakeee 😴✨ it's {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} rn btw!\n" +
            f"right now i'm feeling **{'ON 🔥' if automation_state['enabled'] else 'OFF 💤'}**\n" +
            f"{'🤖 i also just populated the queue to get started!' if automation_state['enabled'] else ''}"
        )
# Background tasks
@tasks.loop(minutes=5)
async def check_pending_clubs():
    """Periodically check and post new pending clubs."""
    # Skip if automation is disabled
    if not automation_state["enabled"]:
        return
        
    # Skip if not time to run yet
    current_time = time.time()
    interval_seconds = automation_state["check_pending_interval_minutes"] * 60
    if current_time - automation_state["last_run"] < interval_seconds:
        return
        
    automation_state["last_run"] = current_time
    
    try:
        # Get pending clubs from API
        response = requests.get(
            f"{API_URL}/pending-clubs", 
            headers={"Authorization": f"Bearer {API_AUTH_TOKEN}"}
        )
        
        if response.status_code != 200:
            logger.error(f"⚠️ Failed to fetch pending clubs: {response.text}")
            return
        
        clubs = response.json().get('results', [])
        
        if not clubs:
            logger.info("No pending clubs found.")
            return
        
        # Post each club that hasn't been posted yet
        channel = aux_bot.get_channel(AUX_BOT_CHANNEL_ID)
        if not channel:
            logger.error("Channel not found for pending clubs")
            return
            
        posted_count = 0
        
        for club in clubs:
            pending_id = club["id"]
            
            # Skip if already posted
            if pending_id in pending_clubs:
                continue
            
            # Format categories
            categories_list = club.get('categories', [])
            categories_formatted = ', '.join(cat['name'] for cat in categories_list) if categories_list else "None"
            
            # Create embed
            embed = discord.Embed(
                title=club["name"],
                color=discord.Color.blue(),
                timestamp=discord.utils.parse_time(club.get('submitted_at'))
            )
            
            embed.add_field(
                name="Instagram", 
                value=f"[Click Here](https://instagram.com/{club['instagram_handle']})", 
                inline=False
            )
            
            embed.add_field(
                name="Categories", 
                value=categories_formatted, 
                inline=False
            )
            
            embed.set_footer(text=f"Submitted by {club['submitted_by_email']}")
            
            # Send with approval buttons
            message = await channel.send(embed=embed, view=ApprovalView(pending_id))
            
            # Track posted club
            pending_clubs[pending_id] = message.id
            posted_count += 1
            
        if posted_count > 0:
            logger.info(f"Auto-posted {posted_count} pending clubs for approval")
    except Exception as e:
        logger.error(f"Error in check_pending_clubs: {e}")

@tasks.loop(minutes=10)
async def auto_requeue_stalled():
    """Periodically check and requeue stalled jobs."""
    # Skip if automation is disabled
    if not automation_state["enabled"]:
        return
        
    # Check if it's time to run
    current_time = time.time()
    interval_seconds = automation_state["requeue_stalled_interval_minutes"] * 60
    last_requeue_run = automation_state.get("last_requeue_run", 0)
    
    if current_time - last_requeue_run < interval_seconds:
        return
        
    automation_state["last_requeue_run"] = current_time
    
    try:
        # Trigger requeue of stalled jobs
        publish_notification(
            "Automated requeue of stalled jobs",
            {
                "type": "command",
                "command": "requeue_stalled",
                "source": "aux_bot_auto",
                "trigger": "scheduled"
            }
        )
        
        logger.info("Auto-triggered requeue of stalled jobs")
    except Exception as e:
        logger.error(f"Error in auto_requeue_stalled: {e}")

@tasks.loop(hours=24)
async def auto_cleanup():
    """Periodically trigger database cleanup operations."""
    # Skip if automation is disabled
    if not automation_state["enabled"]:
        return
        
    # Only run every N days
    current_date = datetime.datetime.now()
    day_of_year = current_date.timetuple().tm_yday
    
    if day_of_year % automation_state["auto_cleanup_days"] != 0:
        return
        
    try:
        # Trigger cleanup
        publish_notification(
            "Automated database cleanup",
            {
                "type": "command",
                "command": "trigger_clean",
                "source": "aux_bot_auto",
                "trigger": "scheduled"
            }
        )
        
        logger.info("Auto-triggered database cleanup")
        
        # Send notification to channel
        channel = aux_bot.get_channel(AUX_BOT_CHANNEL_ID)
        if channel:
            await channel.send("im cleaning !!")
    except Exception as e:
        logger.error(f"Error in auto_cleanup: {e}")

@aux_bot.command(name="about")
async def about_queuetie(ctx):
    embed = discord.Embed(
        title="✨ Queuetie",
        description=(
            "> the sweet angel managing all your club queues 📚💌\n"
            "> she's quick, cheerful, and 100% powered by good vibes and caffeine ☕\n\n"
            "**vibe**: soft, encouraging, a little sassy sometimes.\n"
            "**find her hanging out**: [instinct.club](https://instinct-2-0.vercel.app) 🌸"
        ),
        color=0xF8C8D8  # pastel pink vibe
    )
    embed.set_footer(text="💖 queues r her love language.", icon_url="https://img.icons8.com/color/48/000000/love.png")
    await ctx.send(embed=embed)


# Auxiliary Bot Commands
@aux_bot.command(name="checkpending")
async def check_pending_cmd(ctx):
    """Manually check for pending clubs."""
    try:
        await ctx.send("im checking for pending clubs...")
        
        # Get pending clubs from API
        response = requests.get(
            f"{API_URL}/pending-clubs", 
            headers={"Authorization": f"Bearer {API_AUTH_TOKEN}"}
        )
        
        if response.status_code != 200:
            await ctx.send(f" i couldn't fetch the right text 😢: {response.text}")
            return
        
        clubs = response.json().get('results', [])
        
        if not clubs:
            await ctx.send("nooo pending clubs are GONE 😭✨ nothing for me to do rn")
            return
        
        # Count newly posted and already posted
        posted_count = 0
        already_posted = 0
        
        for club in clubs:
            pending_id = club["id"]
            
            # Skip if already posted
            if pending_id in pending_clubs:
                already_posted += 1
                continue
            
            # Format categories
            categories_list = club.get('categories', [])
            categories_formatted = ', '.join(cat['name'] for cat in categories_list) if categories_list else "None"
            
            # Create embed
            embed = discord.Embed(
                title=club["name"],
                color=discord.Color.blue(),
                timestamp=discord.utils.parse_time(club.get('submitted_at'))
            )
            
            embed.add_field(
                name="Instagram", 
                value=f"[Click Here](https://instagram.com/{club['instagram_handle']})", 
                inline=False
            )
            
            embed.add_field(
                name="Categories", 
                value=categories_formatted, 
                inline=False
            )
            
            embed.set_footer(text=f"Submitted by {club['submitted_by_email']}")
            
            # Send with approval buttons
            channel = aux_bot.get_channel(AUX_BOT_CHANNEL_ID)
            message = await channel.send(embed=embed, view=ApprovalView(pending_id))
            
            # Track posted club
            pending_clubs[pending_id] = message.id
            posted_count += 1
        
        # Send summary
        if posted_count > 0:
            await ctx.send(f"yaaaay i found {posted_count} new pending clubs waiting for approval 🎀✨ go check em outtt!!")
        else:
            if already_posted > 0:
                await ctx.send(f"uhh these {already_posted} clubs are already posted 🤭✨ nothing new but still cute right??")
            else:
                await ctx.send("nooo there's nothing pending rn 😭✨ guess we chillingggg")

    except Exception as e:
        logger.error(f"Error in checkpending command: {e}")
        await ctx.send(f"nooo something broke 😭💔 here's what happened: {str(e)}")

@aux_bot.command(name="trigger")
@is_admin()
async def trigger_cmd(ctx, action: str, *args):
    """Trigger an action in the Job Bot."""
    try:
        # Validate action
        valid_actions = [
            "populate", "flush", "cleanup", "addclub", "requeuejob", "status"
        ]
        
        if action.lower() not in valid_actions:
            await ctx.send(
                f"uhhh i can't do thattt 😭👉 but i CAN do this: {', '.join(valid_actions)} ✨"
            )
            return
        
        # Process based on action
        if action.lower() == "populate":
            # Populate queue
            limit = automation_state["max_queue_size"]
            if len(args) > 0:
                try:
                    limit = int(args[0])
                    print(args)
                except ValueError:
                    await ctx.send("omg the limit u gave me is weird 😭 so imma just use default okok")
            
            # Save timestamp of manual population
            automation_state["last_population_time"] = time.time()
            
            publish_notification(
                "Request to populate queue",
                {
                    "type": "command",
                    "command": "populate_queue",
                    "limit": limit,
                    "source": "aux_bot",
                    "user": str(ctx.author)
                }
            )
            await ctx.send(f"hiii i just triggered the queue population with limit {limit}! 🎀✨")
            
        elif action.lower() == "flush":
            # Flush queue
            queue_type = "scraper"
            if len(args) > 0:
                queue_type = args[0].lower()
                
            # Validate queue type
            if queue_type not in ["scraper", "event", "log"]:
                await ctx.send("hii use the correct commands! like 'scraper', 'event', or 'log'!!")
                return
                
            publish_notification(
                f"Request to flush {queue_type} queue",
                {
                    "type": "command",
                    "command": "flush_queue",
                    "queue_type": queue_type,
                    "source": "aux_bot",
                    "user": str(ctx.author)
                }
            )
            await ctx.send(f"i just flushed the {queue_type} queue! all clean now 🧹✨")
            
        elif action.lower() == "cleanup":
            # Database cleanup
            publish_notification(
                "Request for database cleanup",
                {
                    "type": "command",
                    "command": "trigger_clean",
                    "source": "aux_bot",
                    "user": str(ctx.author)
                }
            )
            await ctx.send("yaaaay i cleaned up the database 🧹✨ it's all sparkly now!!")
            
        elif action.lower() == "addclub":
            # Add club to queue
            if len(args) < 1:
                await ctx.send("nooo u forgot something 😭👉 use it like this pls: `?trigger addclub <instagram_handle> [priority]`")
                return
                
            instagram_handle = args[0]
            priority = 0
            if len(args) > 1:
                try:
                    priority = int(args[1])
                except ValueError:
                    await ctx.send("sryy give me a better priority value. Using default priority (0).")
            
            publish_notification(
                f"Request to add club {instagram_handle} to queue",
                {
                    "type": "command",
                    "command": "add_club",
                    "instagram_handle": instagram_handle,
                    "priority": priority,
                    "source": "aux_bot",
                    "user": str(ctx.author)
                }
            )
            await ctx.send(f"okok im adding `{instagram_handle}` to the queue with priority {priority}!!")
            
        elif action.lower() == "requeuejob":
            # Requeue job
            if len(args) < 1:
                await ctx.send("u forgot the insta handle 😭🫶 use it like this: `?trigger requeuejob <instagram_handle> [job_type]` ok??")
                return
                
            instagram_handle = args[0]
            job_type = "scraper"
            if len(args) > 1:
                job_type = args[1].lower()
                
            # Validate job type
            if job_type not in ["scraper", "event"]:
                 await ctx.send("that's not even a real job type 😭👉 pls use 'scraper' or 'event' ok?? 💖")
                 return
                
            publish_notification(
                f"Request to requeue {job_type} job for {instagram_handle}",
                {
                    "type": "command",
                    "command": "requeue_job",
                    "instagram_handle": instagram_handle,
                    "job_type": job_type,
                    "source": "aux_bot",
                    "user": str(ctx.author)
                }
            )
            await ctx.send(f"slayyy i'm requeuing the {job_type} job for `{instagram_handle}` 🤭💖 wish me luckkkk")

        elif action.lower() == "status":
            # Status check
            try:
                # Get queue status
                queue_stats = get_queue_status()
                
                # Create status embed
                embed = discord.Embed(
                    title="✨ System Status",
                    color=discord.Color.blue(),
                    timestamp=datetime.datetime.now()
                )
                
                # Scraper queue status
                scraper_stats = queue_stats.get("scraper", {})
                embed.add_field(
                    name="📚 Scraper Queue",
                    value=(
                        f"Waiting: **{scraper_stats.get('queue_count', 0)}**\n"
                        f"Processing: **{scraper_stats.get('processing_count', 0)}**\n"
                        f"Failed: **{scraper_stats.get('failed_count', 0)}**"
                    ),
                    inline=True
                )
                
                # Event queue status
                event_stats = queue_stats.get("event", {})
                embed.add_field(
                    name="📅 Event Queue",
                    value=(
                        f"Waiting: **{event_stats.get('queue_count', 0)}**\n"
                        f"Processing: **{event_stats.get('processing_count', 0)}**\n"
                        f"Failed: **{event_stats.get('failed_count', 0)}**"
                    ),
                    inline=True
                )
                
                # Automation status
                embed.add_field(
                    name="⚙️ Automation",
                    value=(
                        f"Status: **{'ENABLED 🔥' if automation_state['enabled'] else 'DISABLED 💤'}**\n"
                        f"Last Queue Population: {datetime.datetime.fromtimestamp(automation_state['last_population_time']).strftime('%Y-%m-%d %H:%M:%S') if automation_state['last_population_time'] > 0 else 'Never'}"
                    ),
                    inline=False
                )
                
                await ctx.send(embed=embed)
            except Exception as e:
                logger.error(f"Error getting status: {e}")
                await ctx.send(f"omg i'm sorry but I couldn't get the status 😭 ({str(e)})")

    except Exception as e:
        logger.error(f"Error in trigger command: {e}")
        await ctx.send(f"nooo something broke 😭💔 here's what happened: {str(e)}")


def update_task_intervals():
    """Update task intervals based on automation settings."""
    try:
        # Update auto-population interval
        if hasattr(auto_populate_queue, 'change_interval'):
            auto_populate_queue.change_interval(hours=automation_state["populate_interval_hours"])
        
        # Update other task intervals if needed
        if hasattr(check_pending_clubs, 'change_interval'):
            check_pending_clubs.change_interval(minutes=automation_state["check_pending_interval_minutes"])
            
        if hasattr(auto_requeue_stalled, 'change_interval'):
            auto_requeue_stalled.change_interval(minutes=automation_state["requeue_stalled_interval_minutes"])
            
        logger.info("Updated task intervals based on automation settings")
        
    except Exception as e:
        logger.error(f"Error updating task intervals: {e}")


@aux_bot.command(name="automation")
@is_admin()
async def automation_cmd(ctx, action: str = "status", *args):
    """Control automation settings."""
    try:
        if action.lower() == "status":
            # Show current automation status
            embed = discord.Embed(
                title="Automation Status",
                color=discord.Color.green() if automation_state["enabled"] else discord.Color.red(),
                description=f"im currently **{'working' if automation_state['enabled'] else 'not working'}**"
            )
            
            embed.add_field(
                name="Interval Settings",
                value=(
                    f"➔ populating queue: Every {automation_state['populate_interval_hours']} hours\n"
                    f"➔ checking pending clubs: Every {automation_state['check_pending_interval_minutes']} minutes\n"
                    f"➔ checking stalled jobs: Every {automation_state['requeue_stalled_interval_minutes']} minutes\n"
                    f"➔ cleaning up: Every {automation_state['auto_cleanup_days']} days"
                ),
                inline=False
            )
            
            embed.add_field(
                name="Queue Settings",
                value=f"➔ Max queue size: {automation_state['max_queue_size']} clubs",
                inline=False
            )
            
            await ctx.send(
                embed=embed,
                view=AutomationToggleView(automation_state["enabled"])
            )
            
        elif action.lower() == "enable":
            # Enable automation
            automation_state["enabled"] = True
            await ctx.send("yaaaay im back to workkk 💻✨ let's gooo!")
            
        elif action.lower() == "disable":
            # Disable automation
            automation_state["enabled"] = False
            await ctx.send("ugh fineee 🙄 taking a nap now... automation is **OFF** 💤💖")
            
        elif action.lower() == "set":
            # Set a specific automation parameter
            if len(args) < 2:
                await ctx.send("ummm what are u sayinggg 😭👉 try like this: `?automation set <parameter> <value>`")
                return
                
            param = args[0].lower()
            try:
                value = int(args[1])
            except ValueError:
                await ctx.send("math is hard but like... pls give me a number 🧮😭")
                return
                
            # Validate and set parameter
            if param == "populate_hours" or param == "populate":
                if value < 1 or value > 24:
                    await ctx.send("it has to be between 1 and 24 hours 😭⏰ pls fix ittt")
                    return
                automation_state["populate_interval_hours"] = value
                
            elif param == "check_pending" or param == "pending":
                if value < 5 or value > 120:
                    await ctx.send("the pending time gotta be between 5 and 120 minutes 😢⏳")
                    return
                automation_state["check_pending_interval_minutes"] = value
                
            elif param == "requeue_stalled" or param == "stalled":
                if value < 10 or value > 240:
                    await ctx.send("stalled interval needs to be between 10 and 240 mins 😭🛠️")
                    return
                automation_state["requeue_stalled_interval_minutes"] = value
                
            elif param == "max_queue" or param == "queue_size":
                if value < 10 or value > 100:
                    await ctx.send(	"umm max queue size gotta be 10-100 bb 😭✨")
                    return
                automation_state["max_queue_size"] = value
                
            elif param == "cleanup_days" or param == "cleanup":
                if value < 1 or value > 30:
                    await ctx.send("cleanup days gotta be between 1 and 30yyy 🌸🧹")
                    return
                automation_state["auto_cleanup_days"] = value
                
            else:
                await ctx.send("ummm idk what u mean 😭 valid options are: populate_hours, check_pending, requeue_stalled, max_queue, cleanup_days ✨")
                return
                
            await ctx.send(f"yayyy i set `{param}` to `{value}` 🎯✨ im so smart omg")
            update_task_intervals()

        
        else:
            await ctx.send("omg nooo 😭 valid actions are: `status`, `enable`, `disable`, `set` ok?? ✨")

    except Exception as e:
        logger.error(f"Error in automation command: {e}")
        await ctx.send(f"nooo something broke 😭💔 here's what happened: {str(e)}")

@aux_bot.command(name="helpp")
async def help_cmd(ctx):
    """Show help information."""
    embed = discord.Embed(
        title="✨ look at all the crazy things i can dooo ✨",
        description="im basically the best thing ever ok?? 💖😎",
        color=discord.Color.purple()
    )

    embed.add_field(
        name=f"{AUX_BOT_PREFIX}checkpending",
        value="i can check pending clubs and post them all cuteee 🎀✨",
        inline=False
    )

    embed.add_field(
        name=f"{AUX_BOT_PREFIX}trigger populate [limit]",
        value="populate queue like a QUEEN 👑 (limit optional)",
        inline=False
    )

    embed.add_field(
        name=f"{AUX_BOT_PREFIX}trigger flush [scraper|event|log]",
        value="flush a queue bc who needs old junk anyway 🤭🗑️",
        inline=False
    )

    embed.add_field(
        name=f"{AUX_BOT_PREFIX}trigger cleanup",
        value="squeaky clean db timeeee ✨🧹",
        inline=False
    )
    
    embed.add_field(
        name=f"{AUX_BOT_PREFIX}trigger status",
        value="check how everything's going rn 📊✨",
        inline=False
    )

    embed.add_field(
        name=f"{AUX_BOT_PREFIX}automation status",
        value="i'll tell u if im working or just vibin 🛌🎶",
        inline=False
    )

    embed.add_field(
        name=f"{AUX_BOT_PREFIX}automation enable/disable",
        value="make me WORK 😈 or make me NAP 💤",
        inline=False
    )

    embed.add_field(
        name=f"{AUX_BOT_PREFIX}automation set <param> <value>",
        value="set my moodswings 👉 (populate_hours, check_pending, requeue_stalled, max_queue, cleanup_days)",
        inline=False
    )
    
    embed.add_field(
        name=f"{AUX_BOT_PREFIX}queueactive [scraper|event]",
        value="👀 see which clubs are waiting in line rn (paginated bc she's popular 🎟️✨)",
        inline=False
    )
    
    embed.add_field(
        name=f"{AUX_BOT_PREFIX}clubinsights <instagram_handle>",
        value="✨ see all the juicy details about a specific club 📊💖",
        inline=False
    )
    
    await ctx.send(embed=embed)

@aux_bot.command(name="queueactive")
async def queue_active_cmd(ctx, queue_type: str = "scraper", limit: int = 10):
    """Show active queue jobs (no pagination)."""
    try:
        if queue_type not in ["scraper", "event"]:
            await ctx.send("only `scraper` or `event` queue is allowed!! 🛠️✨")
            return
        
        queue_key = QUEUE_KEYS[queue_type]["queue"]
        jobs = redis_conn.zrange(queue_key, 0, -1)

        if not jobs:
            await ctx.send(f"no jobs waiting in {queue_type} queue rn 💨🎉")
            return

        # Parse jobs
        parsed_jobs = []
        for job in jobs:
            try:
                # Handle byte strings
                if isinstance(job, bytes):
                    job = job.decode('utf-8')
                    
                job_data = json.loads(job)
                instagram_handle = job_data.get('instagram_handle', 'unknown')
                parsed_jobs.append(instagram_handle)
            except Exception:
                parsed_jobs.append("(invalid job)")

        # Limit results
        parsed_jobs = parsed_jobs[:limit]

        # Make the list for display
        job_list_text = "\n".join(
            [f"`{i+1}.` @{handle}" for i, handle in enumerate(parsed_jobs)]
        )

        embed = discord.Embed(
            title=f"📚 {queue_type.capitalize()} Queue (Top {limit})",
            description=job_list_text,
            color=0xF8C8D8
        )
        embed.set_footer(text=f"Total in Queue: {len(jobs)}")

        await ctx.send(embed=embed)

    except Exception as e:
        logger.error(f"queueactive failed: {e}")
        await ctx.send("something broke 🥲")

@aux_bot.command(name="deletequeue")
@is_admin()
async def delete_queue_cmd(ctx, queue_type: str, index: int):
    """Delete a club from the queue by its index number."""
    try:
        if queue_type not in ["scraper", "event"]:
            await ctx.send("only `scraper` or `event` queue allowed! 🛠️")
            return

        queue_key = QUEUE_KEYS[queue_type]["queue"]
        jobs = redis_conn.zrange(queue_key, 0, -1)

        if not jobs:
            await ctx.send(f"no jobs in {queue_type} queue rn!")
            return

        if index < 1 or index > len(jobs):
            await ctx.send(f"invalid index! choose 1-{len(jobs)} ❌")
            return

        job_to_delete = jobs[index - 1]

        redis_conn.zrem(queue_key, job_to_delete)

        await ctx.send(f"✅ deleted job #{index} from {queue_type} queue!")

    except Exception as e:
        logger.error(f"deletequeue failed: {e}")
        await ctx.send("something broke 🥲")

@aux_bot.command(name="clubinsights")
async def club_insights_cmd(ctx, instagram_handle: str):
    """Show detailed insights about a specific club ✨📊"""
    try:
        # Get club data from database
        club_data = db.get_club_by_instagram(instagram_handle)
        
        if not club_data:
            await ctx.send(f"hmm can't find `{instagram_handle}` in the database... 🔍 did u spell it right?")
            return
        
        # Create embed
        embed = discord.Embed(
            title=f"✨ Club Insights: @{instagram_handle}",
            description=f"Here's everything I know about this club!",
            color=0xE1306C,  # Instagram pink color
            timestamp=datetime.datetime.now()
        )
        
        # Get categories for the club
        categories = []
        try:
            # Get categories from clubs_categories table
            categories_query = db.supabase.from_('clubs_categories').select(
                'categories(name)'
            ).eq('club_id', club_data.get('id')).execute()
            
            if categories_query.data:
                categories = [cat['categories']['name'] for cat in categories_query.data]
        except Exception as e:
            logger.warning(f"Couldn't fetch categories: {e}")
        
        # Club details with description
        description = club_data.get('description', 'No description available')
        if description and len(description) > 100:
            description = description[:97] + "..."
            
        embed.add_field(
            name="📝 Club Details",
            value=(
                f"Name: **{club_data.get('name', 'Unknown')}**\n"
                f"Instagram: [@{instagram_handle}](https://instagram.com/{instagram_handle})\n"
                f"Categories: `{', '.join(categories) if categories else 'None'}`\n"
                f"Description: {description}\n"
                f"Last Scraped: {club_data.get('last_scraped', 'Never')}"
            ),
            inline=False
        )
        
        # Get post statistics
        post_count = 0
        newest_post_date = "Never"
        oldest_post_date = "Never"
        
        try:
            # Count total posts
            posts_query = db.supabase.from_('posts').select(
                'id', 
                count='exact'
            ).eq('club_id', club_data.get('id')).execute()
            
            post_count = posts_query.count if hasattr(posts_query, 'count') else 0
            
            # Get newest post date
            newest_post_query = db.supabase.from_('posts').select(
                'posted'
            ).eq('club_id', club_data.get('id')).order('posted', desc=True).limit(1).execute()
            
            if newest_post_query.data and newest_post_query.data[0].get('posted'):
                newest_post_date = newest_post_query.data[0].get('posted')
                
            # Get oldest post date
            oldest_post_query = db.supabase.from_('posts').select(
                'posted'
            ).eq('club_id', club_data.get('id')).order('posted', desc=False).limit(1).execute()
            
            if oldest_post_query.data and oldest_post_query.data[0].get('posted'):
                oldest_post_date = oldest_post_query.data[0].get('posted')
                
        except Exception as e:
            logger.warning(f"Couldn't fetch post statistics: {e}")
        
        # Basic social media stats
        follower_count = club_data.get('followers', 0)
        following_count = club_data.get('following', 0)
        
        # Activity score - simple metric based on post frequency
        activity_score = "Low"
        try:
            if post_count > 0 and newest_post_date != "Never" and oldest_post_date != "Never":
                # Convert dates to datetime objects
                newest = datetime.datetime.fromisoformat(str(newest_post_date).replace('Z', '+00:00'))
                oldest = datetime.datetime.fromisoformat(str(oldest_post_date).replace('Z', '+00:00'))
                
                # Calculate days between first and last post
                days_active = (newest - oldest).days
                if days_active > 0:
                    # Posts per month
                    posts_per_month = (post_count / days_active) * 30
                    
                    if posts_per_month > 8:
                        activity_score = "Very High 🔥"
                    elif posts_per_month > 4:
                        activity_score = "High ✨"
                    elif posts_per_month > 2:
                        activity_score = "Medium 📊"
                    elif posts_per_month > 1:
                        activity_score = "Low 📝"
                    else:
                        activity_score = "Very Low 💤"
        except Exception as e:
            logger.warning(f"Couldn't calculate activity score: {e}")
        
        embed.add_field(
            name="📊 Analytics",
            value=(
                f"Followers: **{follower_count:,}**\n"
                f"Following: **{following_count:,}**\n"
                f"Posts: **{post_count:,}**\n"
                f"Activity Level: **{activity_score}**\n"
                f"Newest Post: {newest_post_date if newest_post_date != 'Never' else 'None'}"
            ),
            inline=False
        )
        
        # Get upcoming events
        upcoming_events = []
        now = datetime.datetime.now()
        try:
            events_query = db.supabase.from_('events').select(
                'name, date'
            ).eq('club_id', club_data.get('id')).gte('date', now.isoformat()).order('date', desc=False).limit(3).execute()
            
            if events_query.data:
                upcoming_events = events_query.data
        except Exception as e:
            logger.warning(f"Couldn't fetch upcoming events: {e}")
        
        if upcoming_events:
            events_lines = [
                f"• {event.get('name', 'Unknown Event')}: {event.get('date', 'Unknown Date')}"
                for event in upcoming_events
            ]

            events_text = ""
            for line in events_lines:
                # Only add if adding this line doesn't exceed 1024
                if len(events_text) + len(line) + 1 < 1024:
                    events_text += line + "\n"
                else:
                    events_text += "• ...and more events.\n"
                    break

            embed.add_field(
                name="📅 Upcoming Events",
                value=events_text.strip(),
                inline=False
            )
        
        # Get club links if available
        club_links = club_data.get('club_links', [])
        if club_links:
            links_text = ""
            for link_obj in club_links:
                if isinstance(link_obj, dict):
                    url = link_obj.get('url', '')
                    label = link_obj.get('label', url)
                    
                    # Create the link string and check if adding it would exceed the limit
                    link_str = f"• [{label}]({url})\n"
                    if len(links_text) + len(link_str) < 1020:  # Leave a little buffer
                        links_text += link_str
                    else:
                        links_text += "• ...and more links.\n"
                        break
            
            if links_text:
                embed.add_field(
                    name="🔗 Links",
                    value=links_text,
                    inline=False
                )
        
        # Queue Status
        # For queue check, we need to check for the job object that contains this handle
        in_queue = False
        in_processing = False
        in_failed = False
        
        try:
            # Check if in queue
            queue_jobs = redis_conn.zrange(QUEUE_KEYS["scraper"]["queue"], 0, -1)
            for job_json in queue_jobs:
                try:
                    # Handle byte strings
                    if isinstance(job_json, bytes):
                        job_json = job_json.decode('utf-8')
                    job = json.loads(job_json)
                    if job.get('instagram_handle') == instagram_handle:
                        in_queue = True
                        break
                except Exception as e:
                    logger.debug(f"Error parsing queue job: {e}")
                    continue
                    
            # Check if in processing
            processing_jobs = redis_conn.hgetall(QUEUE_KEYS["scraper"]["processing"])
            for _, job_json in processing_jobs.items():
                try:
                    # Handle byte strings
                    if isinstance(job_json, bytes):
                        job_json = job_json.decode('utf-8')
                    job = json.loads(job_json)
                    if job.get('instagram_handle') == instagram_handle:
                        in_processing = True
                        break
                except Exception as e:
                    logger.debug(f"Error parsing processing job: {e}")
                    continue
                    
            # Check if in failed
            failed_jobs = redis_conn.hgetall(QUEUE_KEYS["scraper"]["failed"])
            for _, job_json in failed_jobs.items():
                try:
                    # Handle byte strings
                    if isinstance(job_json, bytes):
                        job_json = job_json.decode('utf-8')
                    job = json.loads(job_json)
                    if job.get('instagram_handle') == instagram_handle:
                        in_failed = True
                        break
                except Exception as e:
                    logger.debug(f"Error parsing failed job: {e}")
                    continue
        except Exception as e:
            logger.warning(f"Error checking queue status: {e}")
        
        status = "Not in queue system"
        if in_queue:
            status = "In queue, waiting to be processed 🕒"
        elif in_processing:
            status = "Currently being scraped 🔄"
        elif in_failed:
            status = "Failed to process recently 💔"
            
        embed.add_field(
            name="⚙️ Current Status",
            value=status,
            inline=False
        )
        
        # Add profile pic as thumbnail if available
        if club_data.get('profile_pic'):
            embed.set_thumbnail(url=club_data.get('profile_pic'))
        
        await ctx.send(embed=embed)
        
    except Exception as e:
        logger.error(f"Error in clubinsights command: {e}")
        await ctx.send(f"omg i'm so sorry but I couldn't fetch insights rn 😭 ({str(e)})")

@aux_bot.command(name="debug")
@is_admin()
async def debug_cmd(ctx):
    """Debug automation and task status."""
    try:
        embed = discord.Embed(
            title="🔧 Debug Information",
            color=discord.Color.orange(),
            timestamp=datetime.datetime.now()
        )
        
        # Task status
        tasks_status = []
        for task_name, task in [
            ("check_pending_clubs", check_pending_clubs),
            ("auto_populate_queue", auto_populate_queue),
            ("auto_requeue_stalled", auto_requeue_stalled),
            ("auto_cleanup", auto_cleanup)
        ]:
            status = "✅ Running" if task.is_running() else "❌ Stopped"
            next_run = f"Next: {task.next_iteration}" if hasattr(task, 'next_iteration') else "N/A"
            tasks_status.append(f"**{task_name}**: {status} | {next_run}")
        
        embed.add_field(
            name="📊 Background Tasks",
            value="\n".join(tasks_status),
            inline=False
        )
        
        # Automation state
        embed.add_field(
            name="⚙️ Automation Config",
            value=(
                f"Enabled: **{automation_state['enabled']}**\n"
                f"Last Population: **{datetime.datetime.fromtimestamp(automation_state['last_population_time']).strftime('%Y-%m-%d %H:%M:%S') if automation_state['last_population_time'] > 0 else 'Never'}**\n"
                f"Population Interval: **{automation_state['populate_interval_hours']} hours**\n"
                f"Max Queue Size: **{automation_state['max_queue_size']}**\n"
                f"Clubs Per Population: **{automation_state['clubs_per_population']}**"
            ),
            inline=False
        )
        
        # Queue status
        queue_stats = get_queue_status()
        embed.add_field(
            name="📋 Current Queue Status",
            value=(
                f"Scraper Queue: **{queue_stats.get('scraper', {}).get('queue_count', 0)}**\n"
                f"Event Queue: **{queue_stats.get('event', {}).get('queue_count', 0)}**"
            ),
            inline=False
        )
        
        await ctx.send(embed=embed)
        
    except Exception as e:
        logger.error(f"Error in debug command: {e}")
        await ctx.send(f"debug failed: {str(e)}")
# Run the bot
if __name__ == "__main__":
    aux_bot.run(AUX_BOT_TOKEN)