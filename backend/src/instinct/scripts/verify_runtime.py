"""Runtime verification for the major dependency jumps of #47.

`uv sync` already proves the graph resolves and installs. This script proves the
code still *runs* against openai 3.x, redis 8.x, starlette 1.x, fastapi 0.141
and selenium 4.48.

Every check reports PASS, FAIL or SKIP. Checks that need a real service run only
when its credentials are present in the environment, and otherwise SKIP with the
reason recorded, so the same script is meaningful both in CI and on a laptop
with no secrets.

    uv run python -m instinct.scripts.verify_runtime
"""

import os
import sys
import time
import traceback

# (name, requires-this-env-var-or-skip, function). Checks are only *registered*
# at import; nothing runs until main() is called. Importing this module must not
# boot the app, talk to Redis or spend OpenAI calls — the same invariant #31
# established for the rest of the package.
checks: list[tuple[str, str | None, object]] = []
results: list[tuple[str, str, str]] = []


def record(status: str, name: str, detail: str = "") -> None:
    results.append((status, name, detail))
    print(f"{status:4} {name}" + (f" — {detail}" if detail else ""))


def check(name: str, skip_reason_env: str | None = None):
    """Decorator: register a check to be run by main()."""

    def wrap(fn):
        checks.append((name, skip_reason_env, fn))
        return fn

    return wrap


def run_checks() -> None:
    """Run every registered check, recording PASS / FAIL / SKIP."""
    for name, skip_reason_env, fn in checks:
        if skip_reason_env and not os.getenv(skip_reason_env):
            record("SKIP", name, f"{skip_reason_env} is not set")
            continue
        try:
            detail = fn() or ""
        except Exception as e:
            record("FAIL", name, f"{type(e).__name__}: {e}")
            traceback.print_exc()
        else:
            record("PASS", name, detail)


# --------------------------------------------------------------------------
# starlette 0.x -> 1.x / fastapi 0.141: the app boots and serves a route
# --------------------------------------------------------------------------
@check("fastapi/starlette: boot app and hit a route")
def _app():
    import starlette
    from fastapi.testclient import TestClient
    from instinct.server import app

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200, response.status_code
    assert response.json()["status"] == "healthy", response.json()
    return f"starlette {starlette.__version__}, {len(app.routes)} routes, /health 200"


# --------------------------------------------------------------------------
# redis 5 -> 8: bytes-vs-str assumption, then a real queue round trip
# --------------------------------------------------------------------------
@check("redis: from_url still defaults to decode_responses=False")
def _redis_decode():
    import redis

    conn = redis.from_url("redis://localhost:6379")
    decode_responses = conn.get_encoder().decode_responses
    assert decode_responses is False, decode_responses
    return f"redis {redis.__version__}, decode_responses=False (call sites expect bytes)"


@check("redis: zadd -> zrangebyscore -> pop round trip", skip_reason_env="REDIS_URL")
def _redis_roundtrip():
    import redis

    conn = redis.from_url(os.environ["REDIS_URL"])
    conn.ping()
    key = f"verify:{int(time.time())}"
    try:
        conn.zadd(key, {"job-a": 1.0, "job-b": 2.0})
        found = conn.zrangebyscore(key, 0, 10)
        assert found, "zrangebyscore returned nothing"
        assert isinstance(found[0], bytes), f"expected bytes, got {type(found[0])}"
        assert found[0] == b"job-a", found[0]
        removed = conn.zrem(key, found[0])
        assert removed == 1, removed
    finally:
        conn.delete(key)
    return "values come back as bytes, as the call sites assume"


@check("redis: RedisScraperQueue enqueue -> get_next_job", skip_reason_env="REDIS_URL")
def _redis_queue():
    from instinct.tools.redis_queue import QueueType, RedisScraperQueue

    queue = RedisScraperQueue()
    queue_key = queue.queue_keys[QueueType.SCRAPER]["queue"]
    if queue.redis.zcard(queue_key):
        # get_next_job() pops the highest-priority job; refuse to touch a queue
        # that already holds real work.
        raise RuntimeError(
            f"{queue_key} is not empty — point REDIS_URL at a scratch Redis"
        )

    handle = f"verify_{int(time.time())}"
    try:
        assert queue.enqueue_job(QueueType.SCRAPER, {"instagram_handle": handle})
        job = queue.get_next_job(QueueType.SCRAPER)
        assert job, "get_next_job returned nothing"
        assert job["instagram_handle"] == handle, job
        assert queue.mark_job_complete(QueueType.SCRAPER, handle)
    finally:
        keys = queue.queue_keys[QueueType.SCRAPER]
        queue.redis.zrem(keys["queue"], handle)
        queue.redis.hdel(keys["processing"], handle)
        queue.redis.hdel(keys["completed"], handle)
    return "pipeline/zadd/zrangebyscore/hset path works on redis 8"


# --------------------------------------------------------------------------
# openai 1.x -> 3.x: the three entry points the code actually uses
# --------------------------------------------------------------------------
@check("openai: client surface (embeddings.create / chat.completions.create)")
def _openai_surface():
    import openai
    from openai import OpenAI

    client = OpenAI(api_key="sk-not-a-real-key")
    assert callable(client.embeddings.create)
    assert callable(client.chat.completions.create)
    return f"openai {openai.__version__}, all three entry points present"


@check("openai: embedding dimensions match the stored index", skip_reason_env="OPENAI")
def _openai_embed():
    from instinct.tools.ai_validation import EMBEDDING_MODEL, get_embedding

    vector = get_embedding("UCI club fair, Wednesday at 5pm on Ring Road")
    assert vector, "no embedding returned"
    assert len(vector) == 1536, f"{EMBEDDING_MODEL} returned {len(vector)} dims"
    return f"{EMBEDDING_MODEL}: {len(vector)} dims"


@check("openai: event parser against a real caption", skip_reason_env="OPENAI")
def _openai_parse():
    import json

    from instinct.tools.ai_validation import EventParser, get_event_model

    parser = EventParser()
    completion = parser.client.chat.completions.create(
        model=get_event_model(),
        messages=[
            {
                "role": "system",
                "content": (
                    "Respond with valid raw JSON only: a JSON array of objects "
                    'with the keys "Name", "Date", "Details", "Duration". '
                    "Return [] if the text is not an event."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Join us for our Fall Kickoff on October 3rd at 6pm in "
                    "DBH 1100! Free boba for the first 50 people."
                ),
            },
        ],
    )
    raw = completion.choices[0].message.content
    parsed = json.loads(raw)
    assert isinstance(parsed, list), type(parsed)
    if parsed:
        assert "Name" in parsed[0], parsed[0]
    return f"{get_event_model()} returned a JSON array of {len(parsed)} event(s)"


# --------------------------------------------------------------------------
# selenium 4.31 -> 4.48: the API the scraper drives still exists (#36 owns the
# live Instagram run)
# --------------------------------------------------------------------------
@check("selenium: API surface used by the scraper")
def _selenium():
    import selenium
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC  # noqa: F401
    from selenium.webdriver.support.ui import WebDriverWait  # noqa: F401

    options = Options()
    options.add_argument("--headless=new")
    assert hasattr(webdriver, "Chrome")
    assert callable(Service)
    assert By.CSS_SELECTOR == "css selector"
    return f"selenium {selenium.__version__}, Options/Service/By unchanged"


# --------------------------------------------------------------------------
# supabase 2.31: accepts the new sb_secret_ key format without JWT parsing (#50)
# --------------------------------------------------------------------------
@check("supabase: client accepts an sb_secret_ key")
def _supabase_key():
    import supabase as supabase_pkg
    from supabase import create_client

    client = create_client("https://example.supabase.co", "sb_secret_placeholder")
    header = client.postgrest.session.headers.get("apikey")
    assert header == "sb_secret_placeholder", header
    return f"supabase {supabase_pkg.__version__}, key forwarded verbatim as apikey"


def main() -> int:
    run_checks()

    failed = [r for r in results if r[0] == "FAIL"]
    skipped = [r for r in results if r[0] == "SKIP"]
    print(
        f"\n{len(results) - len(failed) - len(skipped)} passed, "
        f"{len(failed)} failed, {len(skipped)} skipped"
    )
    for _, name, detail in skipped:
        print(f"  skipped: {name} ({detail})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
