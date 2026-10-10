"""Admin API and its MCP wrapper: club vetting, bad handles, user reports,
scraper run log/commands/config, plus the public GET /status.

Both surfaces call the same plain functions below and are gated by the same
bearer token (INTERNAL_API_TOKEN), so the bots get admin actions without ever
holding Supabase keys. Unset token = admin surface disabled (503).
"""

import hmac
import os
import time
from datetime import datetime, timedelta, timezone
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from mcp.server.mcpserver import MCPServer
from postgrest.exceptions import APIError
from pydantic import BaseModel, EmailStr, Field, model_validator
from starlette.routing import Route

from instinct.db.queries import normalize_handle
from instinct.db.supabase_client import supabase


def require_internal_token(request: Request) -> None:
    """Authenticate an internal caller (admin routes and /mcp).

    INTERNAL_API_TOKEN is a secret whose only purpose is internal -> API auth;
    it is deliberately not the Supabase key (#50).
    """
    expected = os.getenv("INTERNAL_API_TOKEN")
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Server misconfigured: INTERNAL_API_TOKEN is not set",
        )

    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    # Constant-time compare on bytes: Starlette decodes headers as latin-1 and
    # compare_digest raises TypeError on non-ASCII str (a 500 instead of 401).
    provided = auth_header.strip().encode("latin-1", "replace")
    if not hmac.compare_digest(provided, f"Bearer {expected}".encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid service token")


# --- operations shared by the REST routes and the MCP tools -----------------


def list_pending_clubs(limit: int = 50) -> list[dict]:
    """Submitted clubs waiting for review, oldest first."""
    rows = (
        supabase.table("pending_clubs")
        .select("*")
        .eq("approved", False)
        .order("submitted_at")
        .limit(limit)
        .execute()
        .data
    )
    return rows or []


def approve_pending_club(pending_id: str) -> dict:
    """Move a pending club into clubs. last_scraped stays NULL so the next
    scrape picks it up first; then the pending row is deleted."""
    rows = (
        supabase.table("pending_clubs").select("*").eq("id", pending_id).execute().data
    )
    if not rows:
        raise LookupError(f"Pending club {pending_id} not found")
    pending = rows[0]

    club = (
        supabase.table("clubs")
        .insert(
            {"name": pending["name"], "instagram_handle": pending["instagram_handle"]}
        )
        .execute()
        .data[0]
    )

    names = [
        c["name"]
        for c in pending.get("categories") or []
        if isinstance(c, dict) and c.get("name")
    ]
    if names:
        cats = (
            supabase.table("categories").select("id").in_("name", names).execute().data
            or []
        )
        if cats:
            supabase.table("clubs_categories").insert(
                [{"club_id": club["id"], "category_id": c["id"]} for c in cats]
            ).execute()

    supabase.table("pending_clubs").delete().eq("id", pending_id).execute()
    return club


def reject_pending_club(pending_id: str) -> dict:
    rows = supabase.table("pending_clubs").delete().eq("id", pending_id).execute().data
    if not rows:
        raise LookupError(f"Pending club {pending_id} not found")
    return {"rejected": pending_id}


def list_flagged_clubs() -> list[dict]:
    """Clubs the scraper marked with a bad Instagram handle."""
    rows = (
        supabase.table("clubs")
        .select("id, name, instagram_handle, handle_error, last_scraped")
        .not_.is_("handle_error", "null")
        .execute()
        .data
    )
    return rows or []


def set_club_handle(club_id: str, instagram_handle: str) -> dict:
    """Fix a club's handle: clear handle_error and queue it for the next scrape."""
    handle = normalize_handle(instagram_handle)
    if not handle:
        raise ValueError("instagram_handle is empty")
    rows = (
        supabase.table("clubs")
        .update(
            {"instagram_handle": handle, "handle_error": None, "last_scraped": None}
        )
        .eq("id", club_id)
        .execute()
        .data
    )
    if not rows:
        raise LookupError(f"Club {club_id} not found")
    return rows[0]


def list_reports(status: str = "open", limit: int = 50) -> list[dict]:
    rows = (
        supabase.table("reports")
        .select("*")
        .eq("status", status)
        .order("created_at")
        .limit(limit)
        .execute()
        .data
    )
    return rows or []


def resolve_report(report_id: str) -> dict:
    rows = (
        supabase.table("reports")
        .update({"status": "resolved"})
        .eq("id", report_id)
        .execute()
        .data
    )
    if not rows:
        raise LookupError(f"Report {report_id} not found")
    return rows[0]


# --- scraper: run log, commands, config, public status -------------------------

SCRAPER_COMMANDS = ("pause", "resume", "stop", "run_now", "rescrape")
STALE_AFTER = timedelta(hours=8)


def list_scrape_runs(limit: int = 20) -> list[dict]:
    """Most recent scraper runs, newest first."""
    rows = (
        supabase.table("scrape_runs")
        .select("*")
        .order("started_at", desc=True)
        .limit(max(1, min(limit, 200)))
        .execute()
        .data
    )
    return rows or []


def send_scraper_command(command: str, handle: Optional[str] = None) -> dict:
    """Queue a command for the scraper's runner: pause, resume, stop, run_now,
    or rescrape (needs the Instagram handle of a club in the directory)."""
    if command not in SCRAPER_COMMANDS:
        raise ValueError(f"command must be one of {', '.join(SCRAPER_COMMANDS)}")
    row: dict = {"command": command}
    if command == "rescrape":
        h = normalize_handle(handle or "")
        if not h:
            raise ValueError("handle is required for rescrape")
        found = (
            supabase.table("clubs")
            .select("id")
            .eq("instagram_handle", h)
            .limit(1)
            .execute()
            .data
        )
        if not found:
            raise LookupError(f"No club with handle {h}")
        row["handle"] = h
    elif handle:
        raise ValueError("handle is only used with rescrape")
    return supabase.table("scraper_commands").insert(row).execute().data[0]


def list_scraper_commands(status: Optional[str] = None, limit: int = 50) -> list[dict]:
    """Scraper commands, newest first; optional status filter
    (pending, running, done, failed)."""
    q = supabase.table("scraper_commands").select("*")
    if status:
        q = q.eq("status", status)
    rows = (
        q.order("created_at", desc=True).limit(max(1, min(limit, 200))).execute().data
    )
    return rows or []


CONFIG_BOUNDS = {
    "club_delay_min_s": (5, 600),
    "club_delay_max_s": (5, 600),
    "page_load_timeout_s": (10, 120),
    "club_timeout_s": (60, 1800),
    "max_posts_per_club": (1, 12),
}


def get_scraper_config() -> dict:
    """Scraper tunables: delay between clubs (min/max seconds), page load
    timeout, per-club timeout and max posts per club."""
    rows = (
        supabase.table("scraper_state")
        .select(", ".join(CONFIG_BOUNDS))
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise LookupError("scraper_state row is missing")
    return rows[0]


def set_scraper_config(
    club_delay_min_s: Optional[int] = None,
    club_delay_max_s: Optional[int] = None,
    page_load_timeout_s: Optional[int] = None,
    club_timeout_s: Optional[int] = None,
    max_posts_per_club: Optional[int] = None,
) -> dict:
    """Partially update scraper tunables. Bounds: delays 5-600 s with
    min <= max, page load 10-120 s, club timeout 60-1800 s, max posts 1-12."""
    given = {
        "club_delay_min_s": club_delay_min_s,
        "club_delay_max_s": club_delay_max_s,
        "page_load_timeout_s": page_load_timeout_s,
        "club_timeout_s": club_timeout_s,
        "max_posts_per_club": max_posts_per_club,
    }
    changes = {k: v for k, v in given.items() if v is not None}
    if not changes:
        raise ValueError("no config fields given")
    for k, v in changes.items():
        lo, hi = CONFIG_BOUNDS[k]
        if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi:
            raise ValueError(f"{k} must be an integer between {lo} and {hi}")
    merged = get_scraper_config() | changes
    if merged["club_delay_min_s"] > merged["club_delay_max_s"]:
        raise ValueError("club_delay_min_s must be <= club_delay_max_s")
    rows = (
        supabase.table("scraper_state")
        .update(changes | {"updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", True)
        .execute()
        .data
    )
    if not rows:
        return merged
    return {k: rows[0][k] for k in CONFIG_BOUNDS if k in rows[0]}


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def scraper_status(now: Optional[datetime] = None) -> dict:
    """Public scraper health. Only times, statuses and counts: no error text."""
    now = now or datetime.now(timezone.utc)
    cols = "started_at, finished_at, status, clubs_attempted, clubs_failed, posts_added"
    last = (
        supabase.table("scrape_runs")
        .select(cols)
        .order("started_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    good = (
        supabase.table("scrape_runs")
        .select("started_at, finished_at")
        .in_("status", ["ok", "partial"])
        .order("started_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    state = (
        supabase.table("scraper_state")
        .select("paused, paused_at")
        .limit(1)
        .execute()
        .data
    )
    paused = bool(state and state[0].get("paused"))
    good_at = (good[0].get("finished_at") or good[0]["started_at"]) if good else None
    good_dt = _parse_ts(good_at)
    return {
        "last_run": last[0] if last else None,
        "last_success_at": good_at,
        "paused": paused,
        "paused_at": state[0].get("paused_at") if state else None,
        "stale": not paused and (good_dt is None or now - good_dt > STALE_AFTER),
    }


# --- REST --------------------------------------------------------------------


def _call(fn, *args, bad_status: int = 422, **kwargs):
    try:
        return fn(*args, **kwargs)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=bad_status, detail=str(e))


admin_router = APIRouter(
    prefix="/admin", dependencies=[Depends(require_internal_token)]
)


class HandleUpdate(BaseModel):
    instagram_handle: str = Field(min_length=1, max_length=100)


@admin_router.get("/pending-clubs")
def get_pending_clubs(limit: int = 50):
    return list_pending_clubs(limit)


@admin_router.post("/pending-clubs/{pending_id}/approve")
def post_approve(pending_id: UUID):
    return _call(approve_pending_club, str(pending_id))


@admin_router.post("/pending-clubs/{pending_id}/reject")
def post_reject(pending_id: UUID):
    return _call(reject_pending_club, str(pending_id))


@admin_router.get("/flagged-clubs")
def get_flagged_clubs():
    return list_flagged_clubs()


@admin_router.post("/clubs/{club_id}/handle")
def post_club_handle(club_id: UUID, body: HandleUpdate):
    return _call(set_club_handle, str(club_id), body.instagram_handle)


@admin_router.get("/reports")
def get_reports(status: Literal["open", "resolved"] = "open", limit: int = 50):
    return list_reports(status, limit)


@admin_router.post("/reports/{report_id}/resolve")
def post_resolve(report_id: UUID):
    return _call(resolve_report, str(report_id))


class ScraperCommandIn(BaseModel):
    command: Literal["pause", "resume", "stop", "run_now", "rescrape"]
    handle: Optional[str] = Field(default=None, max_length=100)


class ScraperConfigIn(BaseModel):
    # Bounds live in set_scraper_config so REST and MCP share them (400 here).
    club_delay_min_s: Optional[int] = None
    club_delay_max_s: Optional[int] = None
    page_load_timeout_s: Optional[int] = None
    club_timeout_s: Optional[int] = None
    max_posts_per_club: Optional[int] = None


@admin_router.get("/scrape-runs")
def get_scrape_runs(limit: int = 20):
    return list_scrape_runs(limit)


@admin_router.post("/scraper/commands", status_code=201)
def post_scraper_command(body: ScraperCommandIn):
    return _call(send_scraper_command, body.command, body.handle)


@admin_router.get("/scraper/commands")
def get_scraper_commands(
    status: Optional[Literal["pending", "running", "done", "failed"]] = None,
    limit: int = 50,
):
    return list_scraper_commands(status, limit)


@admin_router.get("/scraper/config")
def get_config():
    return _call(get_scraper_config)


@admin_router.patch("/scraper/config")
def patch_config(body: ScraperConfigIn):
    return _call(set_scraper_config, bad_status=400, **body.model_dump())


# Public, unauthenticated: config stays admin-only.
status_router = APIRouter()


@status_router.get("/status")
def get_status():
    return scraper_status()


# --- public report intake ------------------------------------------------------

REPORT_LIMIT = 5  # per IP per window
REPORT_WINDOW_S = 600
_report_hits: dict[str, deque] = defaultdict(deque)

reports_router = APIRouter()


class ReportIn(BaseModel):
    # "site" = a report about the site itself (footer link), no club attached.
    kind: Literal["club", "event", "site"]
    category: Literal[
        "wrong_info", "wrong_time_place", "wrong_instagram", "broken_image", "other"
    ]
    club_id: Optional[UUID] = None
    event_id: Optional[UUID] = None
    page_url: str = Field(min_length=1, max_length=500)
    note: str = Field(min_length=1, max_length=2000)
    email: Optional[EmailStr] = None

    @model_validator(mode="after")
    def _club_report_names_club(self):
        if self.kind == "club" and self.club_id is None:
            raise ValueError("club_id is required when kind is 'club'")
        return self


def _client_ip(request: Request) -> str:
    # Heroku's router appends the real client IP last; earlier entries are
    # client-supplied and spoofable.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    hits = _report_hits[ip]
    while hits and now - hits[0] > REPORT_WINDOW_S:
        hits.popleft()
    if len(hits) >= REPORT_LIMIT:
        return True
    hits.append(now)
    return False


@reports_router.post("/reports", status_code=201)
def create_report(report: ReportIn, request: Request):
    if _rate_limited(_client_ip(request)):
        raise HTTPException(status_code=429, detail="Too many reports, try again later")
    try:
        row = (
            supabase.table("reports")
            .insert(report.model_dump(mode="json"))
            .execute()
            .data[0]
        )
    except APIError as e:
        # Only reachable with a club_id: a NULL club_id never trips the FK.
        if e.code == "23503":  # club_id not in clubs
            raise HTTPException(status_code=400, detail="Unknown club_id")
        raise
    return {"id": row["id"]}


# --- MCP (streamable HTTP at /mcp, same token) ---------------------------------

mcp = MCPServer("instinct-admin")
for _fn in (
    list_pending_clubs,
    approve_pending_club,
    reject_pending_club,
    list_flagged_clubs,
    set_club_handle,
    list_reports,
    resolve_report,
    list_scrape_runs,
    send_scraper_command,
    list_scraper_commands,
    get_scraper_config,
    set_scraper_config,
):
    mcp.tool()(_fn)


class _AuthedMCP:
    """ASGI wrapper: reject before the MCP transport sees the request."""

    async def __call__(self, scope, receive, send):
        try:
            require_internal_token(Request(scope))
        except HTTPException as e:
            await JSONResponse({"detail": e.detail}, status_code=e.status_code)(
                scope, receive, send
            )
            return
        await _mcp_handler(scope, receive, send)


mcp_route = Route("/mcp", endpoint=_AuthedMCP(), methods=["GET", "POST", "DELETE"])


_mcp_handler = None


@asynccontextmanager
async def lifespan(app):
    # A session manager runs once, so build the transport per app lifespan.
    # Stateless + JSON: no sticky sessions across dynos/restarts. host is not
    # localhost so the SDK's localhost-only DNS-rebinding guard stays off; the
    # bearer token is the guard.
    global _mcp_handler
    asgi = mcp.streamable_http_app(
        streamable_http_path="/mcp",
        stateless_http=True,
        json_response=True,
        host="0.0.0.0",
    )
    _mcp_handler = next(
        r for r in asgi.routes if getattr(r, "path", None) == "/mcp"
    ).app
    async with mcp.session_manager.run():
        yield
