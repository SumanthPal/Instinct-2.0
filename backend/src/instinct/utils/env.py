"""Small helpers for reading configuration without crashing at import time."""

import os

DEFAULT_REDIS_URL = "redis://localhost:6379"


def env_int(name: str, default: int = 0) -> int:
    """Read an integer environment variable, falling back to `default`.

    Unset, blank and malformed values return the default instead of raising, so
    that importing a module never depends on a fully populated environment.
    """
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def redis_url() -> str:
    """Redis URL, defaulting to a local server when REDIS_URL is unset."""
    return os.getenv("REDIS_URL") or DEFAULT_REDIS_URL


def require_env_int(name: str, purpose: str) -> int:
    """Return an integer environment variable or raise a readable error.

    For settings where a silent default is dangerous — a Discord server or owner
    id that quietly becomes 0 makes every real guild look unauthorized — so a
    missing or malformed value must fail loudly at startup.
    """
    raw = require_env(name, purpose)
    try:
        return int(raw)
    except ValueError:
        raise RuntimeError(
            f"{name}={raw!r} is not an integer; it is required to {purpose}."
        ) from None


def require_env(name: str, purpose: str) -> str:
    """Return an environment variable or raise a readable, actionable error."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"{name} is missing from the environment; it is required to {purpose}. "
            f"Set it in .env or the process environment."
        )
    return value
