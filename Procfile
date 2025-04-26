# Procfile for the backend (server, scraper, and discord bot)

# The web server process (e.g., FastAPI or Flask app)
web: cd backend && python app/server.py
# The scraper rotation process
scraper: python app/tools/scraper_rotation.py

# The discord bot process
discord: python app/tools/discord_bot.py
