"""Central Redis client factory and connection pool configuration (#55).

All processes (FastAPI server, scraper, job_bot, auxiliary_bot) connect to Redis
through this module so that connection pools are uniformly bounded.
Redis Cloud free tier caps memory at 30 MB and concurrent connections (~30),
so every connection pool must limit max_connections (default: 5) and enable
socket keepalive.
"""

import os
from typing import Any
import redis
from instinct.utils.env import redis_url as get_default_redis_url

DEFAULT_MAX_CONNECTIONS = 5

_clients: dict[tuple[str, int, bool, bool], redis.Redis] = {}


def get_redis_url() -> str:
    """Return configured REDIS_URL or fallback to local default."""
    return get_default_redis_url()


def get_redis(
    url: str | None = None,
    max_connections: int = DEFAULT_MAX_CONNECTIONS,
    socket_keepalive: bool = True,
    decode_responses: bool = False,
    **kwargs: Any,
) -> redis.Redis:
    """Return a Redis client with a bounded connection pool and keepalive enabled.

    Reuses client instances per (url, max_connections, socket_keepalive, decode_responses)
    so each process shares a single connection pool across logger, queue, and bot usages (#55).

    Args:
        url: Redis connection URL (defaults to REDIS_URL env var or redis://localhost:6379)
        max_connections: Max connections in the pool (default: 5)
        socket_keepalive: Enable TCP keepalive (default: True)
        decode_responses: Whether to decode responses to str (default: False, byte strings)
        **kwargs: Additional arguments forwarded to redis.from_url

    Returns:
        A configured redis.Redis instance.
    """
    target_url = url or get_redis_url()
    cache_key = (target_url, max_connections, socket_keepalive, decode_responses)
    if not kwargs and cache_key in _clients:
        return _clients[cache_key]

    client = redis.from_url(
        target_url,
        max_connections=max_connections,
        socket_keepalive=socket_keepalive,
        decode_responses=decode_responses,
        **kwargs,
    )
    if not kwargs:
        _clients[cache_key] = client
    return client
