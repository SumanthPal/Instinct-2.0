"""Small helpers for reading configuration without crashing at import time."""

import os

DEFAULT_REDIS_URL = "redis://localhost:6379"


def redis_url() -> str:
    """Redis URL, defaulting to a local server when REDIS_URL is unset."""
    return os.getenv("REDIS_URL") or DEFAULT_REDIS_URL
