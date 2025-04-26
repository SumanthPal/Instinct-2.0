import os
import sys
import discord
import requests
import logging
from discord.ext import commands, tasks
from dotenv import load_dotenv
from discord import ButtonStyle
from discord.ui import Button, View
import redis
import datetime

# --- PATH SETUP ---
# (1) Allow importing from 'tools'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# (2) Setup correct path to /logs/
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LOG_FILE_PATH = os.path.join(BASE_DIR, 'logs', 'logfile.log')
# --- END PATH SETUP ---

from tools.logger import logger
load_dotenv()

# Load env variables
API_URL = os.getenv('BOT_API_URL')
API_AUTH_TOKEN = os.getenv('SUPABASE_KEY')
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN')

# Handle two channels
DISCORD_CHANNEL_ID = int(os.getenv('DISCORD_CHANNEL_ID'))
DISCORD_CHANNEL_ID_2 = int(os.getenv('DISCORD_CHANNEL_ID_2'))
DISCORD_CHANNEL_IDS = [DISCORD_CHANNEL_ID, DISCORD_CHANNEL_ID_2]



# Initialize Bot
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

# Track posted pending clubs
pending_clubs = {}  # pending_id -> message_id
async def send_update(embed=None, message=None):
    """Send regular updates to the updates channel."""
    channel = bot.get_channel(DISCORD_CHANNEL_ID)
    if channel:
        if embed:
            await channel.send(embed=embed)
        elif message:
            await channel.send(message)

async def send_error(embed=None, message=None):
    """Send error messages to the errors channel."""
    channel = bot.get_channel(DISCORD_CHANNEL_ID_2)
    if channel:
        if embed:
            await channel.send(embed=embed)
        elif message:
            await channel.send(message)

@tasks.loop(minutes=60)
async def nightly_summary_check():
    """Post system summary once a day at midnight."""
    now = datetime.datetime.now()
    if now.hour == 0:  # Midnight
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            redis_conn = redis.from_url(redis_url)

            club_queue_size = redis_conn.zcard('scraper:queue')
            event_queue_size = redis_conn.zcard('scraper:event_queue')

            # Count number of errors today
            errors_today = 0
            try:
                with open(LOG_FILE_PATH, 'r') as f:
                    lines = f.readlines()
                    today_str = now.strftime('%Y-%m-%d')
                    errors_today = sum(1 for line in lines if 'ERROR' in line and today_str in line)
            except Exception as e:
                logger.error(f"Nightly summary: Error counting today's errors: {e}")

            # Send summary
            channel = bot.get_channel(DISCORD_CHANNEL_ID)
            await channel.send(
                f"🌙 **Daily System Summary**\n"
                f"➔ Clubs pending: `{club_queue_size}`\n"
                f"➔ Events pending: `{event_queue_size}`\n"
                f"➔ Errors today: `{errors_today}`\n"
                f"✅ Summary completed at {now.strftime('%H:%M:%S')}"
            )

        except Exception as e:
            logger.error(f"Nightly summary error: {e}")

# Approve club function
def approve_club(pending_id):
    try:
        response = requests.post(
            f"{API_URL}/pending-club/{pending_id}/approve",
            headers={"Authorization": f"Bearer {API_AUTH_TOKEN}"}
        )
        return response.status_code == 200
    except Exception as e:
        logging.error(f"Error approving club {pending_id}: {e}")
        return False

# Reject club function (just logs for now)
def reject_club(pending_id):
    try:
        response = requests.delete(
            f"{API_URL}/pending-club/{pending_id}/reject",
            headers={"Authorization": f"Bearer {API_AUTH_TOKEN}"}
        )
        if response.status_code == 200:
            logging.info(f"✅ Successfully rejected and deleted club {pending_id}.")
        else:
            logging.error(f"⚠️ Failed to delete rejected club {pending_id}: {response.status_code} - {response.text}")
    except Exception as e:
        logging.error(f"❌ Error rejecting club {pending_id}: {e}")

# View (Buttons) for each pending club
class ApprovalView(View):
    def __init__(self, pending_id):
        super().__init__(timeout=None)
        self.pending_id = pending_id

    @discord.ui.button(label="Approve ✅", style=discord.ButtonStyle.success)
    async def approve(self, interaction: discord.Interaction, button: Button):
        if approve_club(self.pending_id):
            await interaction.message.delete()  # Delete the embed message
            await interaction.response.send_message(f"✅ Approved club `{self.pending_id}`!", ephemeral=True)
            logging.info(f"Approved club {self.pending_id}")
        else:
            await interaction.response.send_message(f"⚠️ Failed to approve `{self.pending_id}`.", ephemeral=True)
    @discord.ui.button(label="Reject ❌", style=discord.ButtonStyle.danger)
    async def reject(self, interaction: discord.Interaction, button: Button):
        reject_club(self.pending_id)
        await interaction.message.delete()  # Delete the embed message
        await interaction.response.send_message(f"❌ Rejected club `{self.pending_id}`.", ephemeral=True)

@tasks.loop(seconds=60)
async def passive_error_monitor():
    """Background task to monitor new critical errors or rate limits."""
    try:
        with open(LOG_FILE_PATH, 'r') as f:
            lines = f.readlines()

        error_lines = [line for line in lines if 'ERROR' in line or '[RATE LIMIT DETECTED]' in line]

        if not hasattr(passive_error_monitor, "last_error_count"):
            passive_error_monitor.last_error_count = len(error_lines)
            return
        
        if len(error_lines) > passive_error_monitor.last_error_count:
            new_errors = error_lines[passive_error_monitor.last_error_count:]
            
            for line in new_errors:
                if '[RATE LIMIT DETECTED]' in line:
                    channel = bot.get_channel(DISCORD_CHANNEL_ID)
                    embed = discord.Embed(
                        title="⚠️ Rate Limit Cooldown Started",
                        description=f"```{line.strip()}```",
                        color=0xFEE75C  # Yellow
                    )
                else:
                    channel = bot.get_channel(DISCORD_CHANNEL_ID_2)
                    embed = discord.Embed(
                        title="🚨 Error Detected",
                        description=f"```{line.strip()}```",
                        color=0xED4245  # Red
                    )
                await channel.send(embed=embed)

            passive_error_monitor.last_error_count = len(error_lines)

    except Exception as e:
        logger.error(f"Error in passive error monitor: {e}")

@tasks.loop(minutes=10)
async def queue_backlog_check():
    """Monitor scraper queues to make sure they are not overloaded."""
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        redis_conn = redis.from_url(redis_url)

        club_queue_size = redis_conn.zcard('scraper:queue')
        event_queue_size = redis_conn.zcard('scraper:event_queue')

        if club_queue_size > 100:
            channel = bot.get_channel(DISCORD_CHANNEL_ID)
            await channel.send(f"⚠️ Club queue is backed up: {club_queue_size} jobs waiting!")

        if event_queue_size > 100:
            channel = bot.get_channel(DISCORD_CHANNEL_ID)
            await channel.send(f"⚠️ Event queue is backed up: {event_queue_size} jobs waiting!")

    except Exception as e:
        logger.error(f"Queue monitor error: {e}")

# --- Bot Events ---
@bot.event
async def on_ready():
    print(f"✅ Logged in as {bot.user}")
    await bot.get_channel(DISCORD_CHANNEL_ID).send("ur boy is back")
    passive_error_monitor.start()  # <<< start the background monitor
    queue_backlog_check.start()



# --- Bot Commands ---
@bot.command()
async def emergencyrequeue(ctx):
    """Emergency: Requeue all currently processing jobs back into the queue."""
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
    bot_redis = redis.from_url(redis_url)
    try:
        class ConfirmRequeueView(View):
            def __init__(self):
                super().__init__(timeout=30)  # Timeout after 30 seconds

            @discord.ui.button(label="🚨 YES, Requeue All", style=discord.ButtonStyle.danger)
            async def confirm(self, interaction: discord.Interaction, button: Button):
                try:
                    processing_jobs = bot_redis.hgetall('scraper:processing')
                    requeued_count = 0

                    for job_json in processing_jobs.values():
                        job = json.loads(job_json)
                        instagram_handle = job['instagram_handle']

                        # Requeue into main scraper queue
                        new_job = {
                            'instagram_handle': instagram_handle,
                            'enqueued_at': time.time(),
                            'attempts': job.get('attempts', 0) + 1
                        }
                        bot_redis.zadd('scraper:queue', {json.dumps(new_job): -10})
                        bot_redis.hdel('scraper:processing', instagram_handle)
                        requeued_count += 1

                    await interaction.response.edit_message(content=f"✅ Emergency requeue complete! {requeued_count} jobs requeued.", view=None)
                except Exception as e:
                    await interaction.response.edit_message(content=f"❌ Failed emergency requeue: {e}", view=None)

            @discord.ui.button(label="❌ Cancel", style=discord.ButtonStyle.secondary)
            async def cancel(self, interaction: discord.Interaction, button: Button):
                await interaction.response.edit_message(content="❎ Emergency requeue cancelled.", view=None)

        await ctx.send(
            "**⚠️ WARNING: Emergency Requeue!**\n"
            "This will force all currently stuck jobs back into the queue.\n"
            "Are you absolutely sure?",
            view=ConfirmRequeueView()
        )

    except Exception as e:
        await ctx.send(f"❌ Failed emergency requeue setup: {e}")
        logger.error(f"Emergency requeue command error: {e}")
@bot.command()
async def checkpending(ctx):
    """Fetch and post pending clubs."""
    try:
        response = requests.get(f"{API_URL}/pending-clubs", headers={"Authorization": f"Bearer {API_AUTH_TOKEN}"})
        if response.status_code != 200:
            await send_error(message=f"⚠️ Failed to fetch pending clubs: {response.text}")
            return

        clubs = response.json().get('results', [])
        if not clubs:
            await send_update(message="✅ No pending clubs found!")
            return

        for club in clubs:
            pending_id = club["id"]
            if pending_id in pending_clubs:
                continue  # already posted

            categories_list = club.get('categories', [])
            categories_formatted = ', '.join(cat['name'] for cat in categories_list) if categories_list else "None"

            embed = discord.Embed(
                title=club["name"],
                color=discord.Color.blue(),
                timestamp=discord.utils.parse_time(club.get('submitted_at'))
            )
            embed.add_field(name="Instagram", value=f"[Click Here](https://instagram.com/{club['instagram_handle']})", inline=False)
            embed.add_field(name="Categories", value=categories_formatted, inline=False)
            embed.set_footer(text=f"Submitted by {club['submitted_by_email']}")

            await send_update(embed=embed, message=None)

            pending_clubs[pending_id] = ctx.message.id  # Tracking posted

    except Exception as e:
        await send_error(message=f"❌ Error posting pending clubs: {e}")
        logger.error(f"Error posting pending clubs: {e}")


def get_last_scrape_time():
    try:
        with open(LOG_FILE_PATH, 'r') as f:
            lines = f.readlines()
        for line in reversed(lines):
            if 'Scraping of' in line:
                # Extract timestamp
                timestamp_str = line.split(' - ')[0]
                return datetime.datetime.fromisoformat(timestamp_str)
    except Exception as e:
        logger.error(f"Error getting last scrape time: {e}")
        return None

def get_scrape_counts_today():
    try:
        now = datetime.datetime.now()
        today_str = now.strftime("%Y-%m-%d")
        scraped = 0
        errors = 0

        with open(LOG_FILE_PATH, 'r') as f:
            for line in f:
                if today_str in line:
                    if 'Scraping of' in line:
                        scraped += 1
                    elif 'Error scraping' in line:
                        errors += 1
        return scraped, errors
    except Exception as e:
        logger.error(f"Error counting scrapes/errors today: {e}")
        return 0, 0

@bot.command()
async def systemstatus(ctx):
    """Check system health and send a status embed."""
    try:
        # --- 1. API Health ---
        try:
            api_resp = requests.get(f"{API_URL}/health", timeout=5)
            api_status = "🟢 Healthy" if api_resp.status_code == 200 else "🔴 Unhealthy"
        except Exception as e:
            api_status = "🔴 Unreachable"

        # --- 2. Last Scrape Info ---
        last_scrape_time = get_last_scrape_time()
        if last_scrape_time:
            elapsed = datetime.datetime.now() - last_scrape_time
            elapsed_minutes = int(elapsed.total_seconds() / 60)
            scrape_status = f"🕒 {elapsed_minutes} min ago"
            scrape_color = 0x57F287 if elapsed_minutes < 30 else 0xED4245
        else:
            scrape_status = "❓ Unknown"
            scrape_color = 0xED4245  # Red if unknown

        # --- 3. Scrape Count Today ---
        scraped_today, errors_today = get_scrape_counts_today()

        # --- Build Embed ---
        embed = discord.Embed(
            title="📈 System Status - Instinct Scraper",
            color=scrape_color
        )
        embed.add_field(name="API Server", value=api_status, inline=True)
        embed.add_field(name="Last Scrape", value=scrape_status, inline=True)
        embed.add_field(name="Scraped Today", value=f"✅ {scraped_today} successes", inline=False)
        embed.add_field(name="Errors Today", value=f"⚠️ {errors_today} errors", inline=False)
        embed.set_footer(text="Instinct Bot Monitoring", icon_url="https://img.icons8.com/color/48/000000/combo-chart--v1.png")

        await send_update(embed=embed, message=None)

    except Exception as e:
        await send_error(message=f"❌ Failed to fetch system status: {e}")
        logger.error(f"Error in systemstatus command: {e}")

@bot.command()
async def getlogs(ctx):
    """Send latest log file."""
    try:
        await ctx.send(file=discord.File(LOG_FILE_PATH))
    except Exception as e:
        await ctx.send(f"❌ Failed to fetch logs: {e}")
        logging.error(f"Error sending logs: {e}")
@bot.command()
async def lasterrors(ctx):
    """Fetch the last 10 error logs and show in an embed."""
    try:
        with open(LOG_FILE_PATH, 'r') as f:
            lines = f.readlines()

        # Filter only ERROR lines
        error_lines = [line for line in lines if 'ERROR' in line]
        if not error_lines:
            await ctx.send("✅ No recent errors found.")
            return

        latest_errors = error_lines[-10:]  # Last 10 errors

        # Create Embed
        embed = discord.Embed(
            title="🚨 Last 10 Errors",
            color=0xED4245  # Red color for errors
        )
        for idx, error in enumerate(latest_errors, start=1):
            timestamp = error.split(' - ')[0]
            message = ' - '.join(error.split(' - ')[2:]).strip()
            short_message = (message[:80] + '...') if len(message) > 80 else message

            embed.add_field(
                name=f"{idx}. {timestamp}",
                value=f"```{short_message}```",
                inline=False
            )

        embed.set_footer(text="Instinct System Error Monitor", icon_url="https://img.icons8.com/color/48/000000/high-priority.png")

        await ctx.send(embed=embed)

    except Exception as e:
        await ctx.send(f"❌ Failed to fetch last errors: {e}")
        logger.error(f"Error in lasterrors command: {e}")

# --- Run the bot ---

bot.run(DISCORD_BOT_TOKEN)
