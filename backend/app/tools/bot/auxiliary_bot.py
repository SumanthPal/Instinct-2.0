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
from discord.ui import Button, View
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
        "processing": "scraper:processing"
    },
    "event": {
        "queue": "scraper:event_queue", 
        "processing": "scraper:event_processing"
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
    "populate_interval_hours": 6,  # How often to populate queue
    "check_pending_interval_minutes": 30,  # How often to check pending clubs
    "requeue_stalled_interval_minutes": 60,  # How often to check for stalled jobs
    "max_queue_size": 40,  # Maximum number of clubs to have in queue
    "auto_cleanup_days": 7  # Days between automatic cleanup
}

# Check if user has admin role
def is_admin():
    async def predicate(ctx):
        # Check if user has admin role
        if ctx.guild is None:
            await ctx.send("srry idek u")
            return False
        
        admin_role = ctx.guild.get_role(AUX_BOT_ADMIN_ROLE_ID)
        if admin_role is None:
            await ctx.send("umm this is awkward... ur not given permission")
            return False
        
        return admin_role in ctx.author.roles
    
    return commands.check(predicate)
# security_checks.py or just at top of bot file


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
        
        stats["scraper"] = {
            "queue_count": redis_conn.zcard(scraper_queue),
            "processing_count": len(redis_conn.hkeys(scraper_processing))
        }
        
        # Event queue stats
        event_queue = QUEUE_KEYS["event"]["queue"]
        event_processing = QUEUE_KEYS["event"]["processing"]
        
        stats["event"] = {
            "queue_count": redis_conn.zcard(event_queue),
            "processing_count": len(redis_conn.hkeys(event_processing))
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
            headers=headers
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

# Bot events
@aux_bot.event
async def on_ready():
    logger.info(f"Auxiliary Bot logged in as {aux_bot.user}")
    
    # Start background tasks
    check_pending_clubs.start()
    auto_populate_queue.start()
    auto_requeue_stalled.start()
    auto_cleanup.start()
    
    # Send startup notification
    channel = aux_bot.get_channel(AUX_BOT_CHANNEL_ID)
    if channel:
        await channel.send(
    f"heyyyyy im awakeee 😴✨ it's {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} rn btw!\n" +
    f"right now i'm feeling **{'ON 🔥' if automation_state['enabled'] else 'OFF 💤'}**"
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

@tasks.loop(hours=1)
async def auto_populate_queue():
    """Periodically populate the scraper queue with clubs to scrape."""
    # Skip if automation is disabled
    if not automation_state["enabled"]:
        return
        
    # Only run every N hours
    current_hour = datetime.datetime.now().hour
    if current_hour % automation_state["populate_interval_hours"] != 0:
        return
        
    try:
        # Check current queue size
        queue_stats = get_queue_status()
        current_queue_size = queue_stats.get("scraper", {}).get("queue_count", 0)
        current_processing = queue_stats.get("scraper", {}).get("processing_count", 0)
        
        # Only populate if queue is getting low
        if current_queue_size + current_processing >= automation_state["max_queue_size"]:
            logger.info(f"Queue already has {current_queue_size} items. Skipping auto-populate.")
            return
            
        # Calculate how many more clubs to add
        to_add = automation_state["max_queue_size"] - (current_queue_size + current_processing)
        
        # Trigger population
        publish_notification(
            "Automated queue population",
            {
                "type": "command",
                "command": "populate_queue",
                "limit": to_add,
                "source": "aux_bot_auto",
                "trigger": "scheduled"
            }
        )
        
        logger.info(f"Auto-triggered population of queue with up to {to_add} clubs")
        
        # Send notification to channel
        channel = aux_bot.get_channel(AUX_BOT_CHANNEL_ID)
        if channel:
            await channel.send(f"yaaay i auto-populated the queue with {to_add} cuties 🎀✨")
    except Exception as e:
        logger.error(f"Error in auto_populate_queue: {e}")

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

@aux_bot.event
async def on_ready():
    logger.info(f"hiii im back {aux_bot.user}")
    
    # Start background tasks
    check_pending_clubs.start()
    auto_populate_queue.start()
    auto_requeue_stalled.start()
    auto_cleanup.start()
    activity = discord.Game(name="managing queues ✨ | instinct-2.0")
    await aux_bot.change_presence(status=discord.Status.online, activity=activity)
    # Send startup notification
    channel = aux_bot.get_channel(AUX_BOT_CHANNEL_ID)
    if channel:
        await channel.send(
            f"heyyy im backkkk 🎀✨ woke up at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}!\n" +
            f"currently i'm feeling **{'ENABLED 🔥' if automation_state['enabled'] else 'DISABLED 💤'}** btw 💬💖"
        )


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
                except ValueError:
                    await ctx.send("omg the limit u gave me is weird 😭 so imma just use default okok")

            
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
            await ctx.send(f"hiii i just triggered the queue population with limit {limit}!")
            
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
            await ctx.send(f"i just flushed the {queue_type} queue!")

            
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
            publish_notification(
                "Request for system status",
                {
                    "type": "command",
                    "command": "get_status",
                    "source": "aux_bot",
                    "user": str(ctx.author)
                }
            )
            await ctx.send("okieee pulling up the system vibes rn ✨🔧 pls holddd 😚📡")

    except Exception as e:
        logger.error(f"Error in trigger command: {e}")
        await ctx.send(f"nooo something broke 😭💔 here's what happened: {str(e)}")


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
        
        else:
            await ctx.send("omg nooo 😭 valid actions are: `status`, `enable`, `disable`, `set` ok?? ✨")

    except Exception as e:
        logger.error(f"idk what i did but theres an error: {e}")
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

    
    await ctx.send(embed=embed)

# Run the bot
if __name__ == "__main__":
    aux_bot.run(AUX_BOT_TOKEN)