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


def require_env(name: str, purpose: str) -> str:
    """Return an environment variable or raise a readable, actionable error."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"{name} is missing from the environment; it is required to {purpose}. "
            f"Set it in .env or the process environment."
        )
    return value
