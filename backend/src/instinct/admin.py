"""Admin API and its MCP wrapper: club vetting, bad handles, user reports.

Both surfaces call the same plain functions below and are gated by the same
bearer token (INTERNAL_API_TOKEN), so the bots get admin actions without ever
holding Supabase keys. Unset token = admin surface disabled (503).
"""

import hmac
import os
import time
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


# --- REST --------------------------------------------------------------------


def _call(fn, *args):
    try:
        return fn(*args)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


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
