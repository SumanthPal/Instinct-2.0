# Procfile for the backend (server, scraper, and discord bot)
#
# Every process runs the installed `instinct` package, so no `cd` and no
# PYTHONPATH juggling is required — `uv sync` installs the package from
# backend/src/instinct (see pyproject.toml).

# The web server process (FastAPI via uvicorn)
web: uv run python -m instinct.server
# The scraper rotation process
scraper: uv run python -m instinct.tools.scraper_rotation

# The discord bot process
discord: uv run python -m instinct.tools.discord_bot
