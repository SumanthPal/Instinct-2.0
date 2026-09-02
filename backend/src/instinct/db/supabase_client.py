"""Lazy Supabase client.

Importing this module must never require configuration or a network round trip:
everything downstream (the FastAPI app, the Discord bots, the scraper) imports it
transitively, so an import-time `create_client()` made the whole backend
unimportable without a full environment. The client is built on first attribute
access instead, and missing configuration surfaces as a readable error at that
point.
"""

import os
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

_client: Client | None = None


def get_supabase() -> Client:
    """Return the shared Supabase client, creating it on first use."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        missing = [
            name
            for name, value in (("SUPABASE_URL", url), ("SUPABASE_KEY", key))
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
