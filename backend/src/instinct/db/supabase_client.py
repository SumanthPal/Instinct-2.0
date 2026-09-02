"""Lazy Supabase client.

Importing this module must never require configuration or a network round trip:
everything downstream (the FastAPI app, the Discord bots, the scraper) imports it
transitively, so an import-time `create_client()` made the whole backend
unimportable without a full environment. The client is built on first attribute
access instead, and missing configuration surfaces as a readable error at that
point.

Key naming (#50): Supabase is retiring the legacy `anon`/`service_role` JWT keys
by the end of 2026. The backend uses the secret key, read from
SUPABASE_SECRET_KEY. The project URL is unaffected by that migration.
"""

import logging
import os
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

_log = logging.getLogger(__name__)

URL_ENV = "SUPABASE_URL"
SECRET_KEY_ENV = "SUPABASE_SECRET_KEY"
LEGACY_SECRET_KEY_ENV = "SUPABASE_KEY"

_client: Client | None = None
_warned_about_legacy_env = False


def get_supabase_url() -> str | None:
    """Project URL. Unchanged by the new-API-keys migration."""
    return os.getenv(URL_ENV)


def get_supabase_secret_key() -> str | None:
    """Secret key (the replacement for the legacy `service_role` key).

    Prefers SUPABASE_SECRET_KEY. The old SUPABASE_KEY name is still accepted,
    with a warning, so that a deployment whose secrets have not been renamed yet
    keeps working; drop that fallback once every environment is updated (#30).
    """
    key = os.getenv(SECRET_KEY_ENV)
    if key:
        return key

    legacy = os.getenv(LEGACY_SECRET_KEY_ENV)
    if legacy:
        global _warned_about_legacy_env
        if not _warned_about_legacy_env:
            _warned_about_legacy_env = True
            _log.warning(
                "%s is deprecated; rename it to %s.",
                LEGACY_SECRET_KEY_ENV,
                SECRET_KEY_ENV,
            )
        return legacy

    return None


def get_supabase() -> Client:
    """Return the shared Supabase client, creating it on first use."""
    global _client
    if _client is None:
        url = get_supabase_url()
        key = get_supabase_secret_key()
        missing = [
            name
            for name, value in ((URL_ENV, url), (SECRET_KEY_ENV, key))
            if not value
        ]
        if missing:
            raise RuntimeError(
                "Supabase is not configured: missing "
                f"{' and '.join(missing)} in the environment. "
                "Set them in .env or the process environment before using the "
                "database."
            )
        _client = create_client(url, key)
    return _client


class _LazySupabase:
    """Proxy that defers client creation to the first attribute access.

    Lets existing call sites keep doing `from ... import supabase` at module
    import time and `supabase.table(...)` at call time.
    """

    def __getattr__(self, name: str) -> Any:
        return getattr(get_supabase(), name)

    def __repr__(self) -> str:
        state = "connected" if _client is not None else "not connected"
        return f"<LazySupabaseClient ({state})>"


supabase = _LazySupabase()
