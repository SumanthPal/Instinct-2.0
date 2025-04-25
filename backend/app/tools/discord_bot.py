import os
import discord
import requests
import logging
from discord.ext import commands, tasks
from dotenv import load_dotenv
from discord import ButtonStyle
from discord.ui import Button, View
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.logger import logger

load_dotenv()

# Load env variables
API_URL = os.getenv('BOT_API_URL')
API_AUTH_TOKEN = os.getenv('SUPABASE_KEY')
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN')
DISCORD_CHANNEL_ID = int(os.getenv('DISCORD_CHANNEL_ID'))



# Initialize Bot
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

# Track posted pending clubs
pending_clubs = {}  # pending_id -> message_id

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


# --- Bot Events ---

@bot.event
async def on_ready():
    print(f"✅ Logged in as {bot.user}")
    await bot.get_channel(DISCORD_CHANNEL_ID).send("ur boy is back")

# --- Bot Commands ---

@bot.command()
async def checkpending(ctx):
    """Fetch and post pending clubs."""
    try:
        response = requests.get(f"{API_URL}/pending-clubs", headers={"Authorization": f"Bearer {API_AUTH_TOKEN}"})
        if response.status_code != 200:
            await ctx.send(f"⚠️ Failed to fetch pending clubs: {response.text}")
            logging.error(f"Failed to fetch pending clubs: {response.text}")
            return

        clubs = response.json().get('results', [])
        if not clubs:
            await ctx.send("✅ No pending clubs found!")
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

            message = await ctx.send(embed=embed, view=ApprovalView(pending_id))
            pending_clubs[pending_id] = message.id

    except Exception as e:
        await ctx.send(f"❌ Error posting pending clubs.")
        logging.error(f"Error posting pending clubs: {e}")

@bot.command()
async def systemhealth(ctx):
    """Background task to monitor all system components."""
    channel = bot.get_channel(DISCORD_CHANNEL_ID)
    
    # 1. API health check
    try:
        resp = requests.get(f"{API_URL}/health")
        if resp.status_code == 200:
            await channel.send("✅ API server is healthy!")
        else:
            await channel.send(f"⚠️ API health check failed: {resp.status_code}")
    except Exception as e:
        await channel.send(f"❌ API health check error: {e}")
@bot.command()
async def getlogs(ctx):
    """Send latest log file."""
    try:
        await ctx.send(file=discord.File('logs/logfile.log'))
    except Exception as e:
        await ctx.send(f"❌ Failed to fetch logs: {e}")
        logging.error(f"Error sending logs: {e}")

@bot.command()
async def errors(ctx):
    """Send latest 10 error log entries."""
    try:
        with open('logs/logfile.log', 'r') as f:
            lines = f.readlines()

        error_lines = [line for line in lines if 'ERROR' in line]
        if not error_lines:
            await ctx.send("✅ No errors found.")
            return

        latest_errors = error_lines[-10:]
        error_message = "```\n" + "\n".join(latest_errors) + "\n```"

        if len(error_message) > 1900:
            error_message = error_message[:1900] + "\n```"

        await ctx.send(error_message)

    except Exception as e:
        await ctx.send(f"❌ Failed to fetch errors: {e}")
        logging.error(f"Error sending latest errors: {e}")

# --- Run the bot ---

bot.run(DISCORD_BOT_TOKEN)
