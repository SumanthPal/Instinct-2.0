from instinct.db.supabase_client import supabase
from instinct.db.queries import SupabaseQueries, normalize_handle
from instinct.utils.images import IMAGE_EXTENSIONS, cdn_url
from instinct.admin import admin_router, lifespan, mcp_route, reports_router
import uuid
import os
from typing import List, Optional
from datetime import date, datetime
import dotenv
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request, APIRouter
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

# Load environment variables
dotenv.load_dotenv()


app = FastAPI(
    title="UCI Club Discovery API",
    description="API for discovering UCI clubs and their events",
    version="2.0.0",
    lifespan=lifespan,
)
router = APIRouter()

origins = [
    "https://instincts.one",  # production frontend (custom domain)
    "https://www.instincts.one",
    "https://instinct-2-0.vercel.app",  # vercel.app frontend
    "https://instinct.vercel.app",  # backup/staging
    "http://localhost:3000",  # local development
    "http://127.0.0.1:3000",
    "https://instincts.systems",  # alt local dev
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,  # needed if you send cookies/auth headers
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],  # whitelist only used methods
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-CSRF-Token",
    ],  # restrict to needed headers
)


_db: Optional[SupabaseQueries] = None


def get_db() -> SupabaseQueries:
    """Shared SupabaseQueries instance, created on first request.

    Deliberately not module scope: importing this module must not construct
    database or storage clients (#31).
    """
    global _db
    if _db is None:
        _db = SupabaseQueries()
    return _db


class Club(BaseModel):
    id: str
    name: str
    instagram_handle: str
    profile_pic: Optional[str] = None
    description: Optional[str] = None
    followers: Optional[int] = None
    following: Optional[int] = None
    club_links: Optional[List[str]] = None


class PendingClubSubmission(BaseModel):
    club_name: str
    instagram_handle: str
    categories: List[str]
    submitted_by_email: EmailStr


class Post(BaseModel):
    id: str
    club_id: str
    post_url: str
    caption: Optional[str] = None
    image_url: Optional[str] = None
    posted: Optional[datetime] = None


class Event(BaseModel):
    id: str
    club_id: str
    post_id: str
    name: str
    date: datetime
    details: Optional[str] = None
    duration: Optional[str] = None


class ClubSubmission(BaseModel):
    name: str
    instagram_handle: str
    description: Optional[str]
    club_links: Optional[List[str]]
    captcha_token: str
    honeypot: Optional[str] = ""  # should be empty if real user


@router.post("/club/add")
async def submit_pending_club(new_club: PendingClubSubmission, request: Request):
    # 1. Validate user auth
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    supabase_user = await get_db().get_user_from_token(auth_header)
    if not supabase_user:
        raise HTTPException(status_code=401, detail="Invalid Supabase token")

    # 2. Check UCI email
    if not supabase_user["email"].endswith("@uci.edu"):
        raise HTTPException(
            status_code=403, detail="Only UCI students can submit clubs"
        )

    # 3. Check if club already exists in real table
    existing = get_db().get_club_by_instagram(new_club.instagram_handle)
    if existing:
        raise HTTPException(
            status_code=409, detail="Club with this Instagram handle already exists"
        )

    # 4. Insert into pending_clubs table
    try:
        (
            supabase.table("pending_clubs")
            .insert(
                {
                    "name": new_club.club_name,
                    "instagram_handle": new_club.instagram_handle,
                    "categories": [
                        {"name": category} for category in new_club.categories
                    ],
                    "submitted_by_email": new_club.submitted_by_email,
                    "submitted_at": datetime.now().isoformat(),
                    "approved": False,
                }
            )
            .execute()
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to submit pending club: {str(e)}"
        )

    # If it gets here, it was successful
    return {"message": "Club submitted successfully. Awaiting approval."}


@app.get("/")
async def home():
    """Home endpoint to verify API is working."""
    return {"message": "Welcome to the UCI Club Discovery API"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/club")
def list_clubs(
    page: int = Query(1, description="Page number, starting from 1"),
    limit: int = Query(20, description="Number of clubs per page"),
    category: Optional[str] = Query(
        None, description="Filter by category name (exact match)"
    ),
):
    """Get a paginated list of clubs, optionally filtered by category."""
    try:
        # Calculate offset
        offset = (page - 1) * limit

        # Use optimized database-level pagination
        result = get_db().get_clubs_paginated(offset, limit, category)

        # Determine if there are more pages
        has_more = result["total"] > (offset + limit)

        # Return the response
        return {
            "total": result["total"],
            "results": result["clubs"],
            "hasMore": has_more,
            "page": page,
            "pages": (result["total"] + limit - 1) // limit,
        }

    except Exception as e:
        import traceback

        traceback.print_exc()
        return JSONResponse(
            status_code=500, content={"message": f"Error fetching clubs: {str(e)}"}
        )


@app.get("/club/{instagram_handle}")
def get_club_data(instagram_handle: str):
    """Get detailed information about a specific club."""
    try:
        club = get_db().get_club_by_instagram(instagram_handle)
        if not club:
            raise HTTPException(
                status_code=404,
                detail=f"Club with Instagram handle '{instagram_handle}' not found",
            )

        # Use the stored path (e.g. pfps/taoxuci.jpg), not the request's
        # handle, whose case may differ from the object's name.
        image_url = cdn_url(club.get("profile_image_path"))
        if image_url:
            club["profile_image_url"] = image_url
        else:
            # A stale "NULL" path would otherwise reach the frontend as a src.
            club["profile_image_path"] = None

        return club
    except HTTPException as http_e:
        raise http_e
    except Exception as e:
        return JSONResponse(
            status_code=500, content={"message": f"Error fetching club data: {str(e)}"}
        )


def add_post_image_url(post: dict) -> dict:
    """Set post["image_url"] and normalise post["image_path"], in place.

    Mirrored post images are stored as posts/{handle}/{post_id} and served as
    .jpg; a missing or "NULL" path means no image.
    """
    post["image_url"] = cdn_url(post.get("image_path"), ".jpg")
    if post["image_url"] is None:
        post["image_path"] = None
    elif not post["image_path"].lower().endswith(IMAGE_EXTENSIONS):
        post["image_path"] += ".jpg"
    return post


@app.get("/club/{instagram_handle}/posts")
def get_club_posts(
    instagram_handle: str,
    page: int = Query(1, ge=1, description="Page number, starting from 1"),
    limit: int = Query(20, ge=1, le=100, description="Number of posts per page"),
):
    """Get one page of a club's posts, newest first."""
    try:
        # Check if club exists
        club = get_db().get_club_by_instagram(instagram_handle)
        if not club:
            raise HTTPException(
                status_code=404,
                detail=f"Club with Instagram handle '{instagram_handle}' not found",
            )

        # Get club ID
        club_id = club["id"]

        # Query posts
        offset = (page - 1) * limit
        result = get_db().get_posts_by_club_id(club_id, limit, offset)
        posts = result["posts"]

        for post in posts:
            add_post_image_url(post)

        return {
            "count": len(posts),
            "total": result["total"],
            "results": posts,
            "hasMore": result["total"] > offset + limit,
            "page": page,
            "pages": (result["total"] + limit - 1) // limit,
        }
    except HTTPException as http_e:
        raise http_e
    except Exception as e:
        return JSONResponse(
            status_code=500, content={"message": f"Error fetching club posts: {str(e)}"}
        )


# /posts batch limits. The dashboard shows posts from up to 12 starred clubs,
# 6 posts each.
POSTS_BATCH_MAX_CLUBS = 12
POSTS_BATCH_DEFAULT_LIMIT = 6
POSTS_BATCH_MAX_LIMIT = 20


@app.get("/posts")
def get_posts_for_clubs(
    club_ids: str = Query(..., description="Comma-separated club ids (UUIDs)"),
    limit: int = Query(
        POSTS_BATCH_DEFAULT_LIMIT,
        ge=1,
        le=POSTS_BATCH_MAX_LIMIT,
        description="Newest posts to return per club",
    ),
):
    """The newest `limit` posts of each listed club, in one request.

    Replaces one /club/{handle}/posts call per club on the dashboard. Results
    are flat and newest first; each post carries its `club_id` and
    `image_url` (null when the post has no image). Unknown ids return no
    posts rather than an error.
    """
    ids = []
    for raw in club_ids.split(","):
        raw = raw.strip()
        if not raw:
            continue
        try:
            club_id = str(uuid.UUID(raw))
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"`club_ids` has an invalid id: {raw!r}"
            )
        if club_id not in ids:
            ids.append(club_id)
    if not ids:
        raise HTTPException(status_code=400, detail="`club_ids` has no ids")
    if len(ids) > POSTS_BATCH_MAX_CLUBS:
        raise HTTPException(
            status_code=400,
            detail=f"`club_ids` has {len(ids)} ids; the maximum is "
            f"{POSTS_BATCH_MAX_CLUBS}",
        )
    try:
        posts = get_db().get_recent_posts_by_club_ids(ids, limit)
    except Exception as e:
        return JSONResponse(
            status_code=500, content={"message": f"Error fetching posts: {str(e)}"}
        )
    for post in posts:
        add_post_image_url(post)
    return {"count": len(posts), "limit": limit, "results": posts}


@app.get("/club/{instagram_handle}/events")
def get_club_events(
    instagram_handle: str,
    start_date: Optional[datetime] = Query(
        None, description="Filter events after this date"
    ),
    end_date: Optional[datetime] = Query(
        None, description="Filter events before this date"
    ),
):
    """Get events for a specific club."""
    try:
        # Check if club exists
        club = get_db().get_club_by_instagram(instagram_handle)
        if not club:
            raise HTTPException(
                status_code=404,
                detail=f"Club with Instagram handle '{instagram_handle}' not found",
            )

        # Get club ID
        club_id = club["id"]

        # Get events
        events = get_db().get_events_for_club(club_id)

        # Apply date filters if specified
        filtered_events = []
        for event in events:
            event_date = datetime.fromisoformat(event["date"].replace("Z", "+00:00"))

            if start_date and event_date < start_date:
                continue

            if end_date and event_date > end_date:
                continue

            filtered_events.append(event)

        return {"count": len(filtered_events), "results": filtered_events}
    except HTTPException as http_e:
        raise http_e
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching club events: {str(e)}"},
        )


@app.get("/club/{instagram_handle}/calendar.ics")
def get_club_calendar(instagram_handle: str):
    """Get calendar file (ICS) for a specific club."""
    try:
        # Check if club exists
        club = get_db().get_club_by_instagram(instagram_handle)
        if not club:
            raise HTTPException(
                status_code=404,
                detail=f"Club with Instagram handle '{instagram_handle}' not found",
            )

        # Get club ID
        club_id = club["id"]

        # Get calendar content
        calendar_content = get_db().get_calendar_file(club_id)

        if not calendar_content:
            raise HTTPException(status_code=404, detail="Calendar file not found")

        # Return as ICS file
        return Response(
            content=calendar_content,
            media_type="text/calendar",
            headers={
                "Content-Disposition": f"attachment; filename={instagram_handle}_calendar.ics"
            },
        )
    except HTTPException as http_e:
        raise http_e
    except Exception as e:
        return JSONResponse(
            status_code=500, content={"message": f"Error fetching calendar: {str(e)}"}
        )


@app.get("/events/campus-wide")
def get_all_campus_events(
    start_date: Optional[datetime] = Query(
        None, description="Filter events after this date"
    ),
    end_date: Optional[datetime] = Query(
        None, description="Filter events before this date"
    ),
    limit: int = Query(100, description="Maximum number of events to return"),
    offset: int = Query(0, description="Pagination offset"),
):
    """Get all events from all clubs campus-wide with pagination and date filtering."""
    try:
        # Get all campus events in a single efficient query
        events = get_db().get_all_campus_events(start_date, end_date, limit, offset)

        return {"count": len(events), "results": events}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching campus events: {str(e)}"},
        )


# Longest /events range, inclusive of both ends: a quarter.
EVENTS_MAX_RANGE_DAYS = 92
EVENTS_MAX_CLUBS = 100


@app.get("/events")
def get_events_in_range(
    from_: Optional[date] = Query(
        None,
        alias="from",
        description="First day, YYYY-MM-DD (America/Los_Angeles), inclusive. "
        "Required unless `clubs` names exactly one club.",
    ),
    to: Optional[date] = Query(
        None,
        description="Last day, YYYY-MM-DD (America/Los_Angeles), inclusive. "
        "Required unless `clubs` names exactly one club.",
    ),
    clubs: Optional[str] = Query(
        None, description="Comma-separated Instagram handles to keep"
    ),
    category: Optional[str] = Query(
        None, description="Keep events whose club has this category"
    ),
):
    """Events for the calendar and club pages, filtered in the database.

    Calendar mode (no `clubs`, or several): `from` and `to` are required and
    the range is at most 92 days. Club mode (`clubs` names exactly one club):
    `from` and `to` are optional, each end open when left out, with no range
    limit, so one request returns the club's whole history. Rows are ordered
    by date then id; each has the event, its club, the club's `categories`
    and `post_image_url` (the linked post's image, or null).
    """
    handles = None
    if clubs is not None:
        handles = sorted({normalize_handle(h) for h in clubs.split(",")} - {""})
        if not handles:
            raise HTTPException(status_code=400, detail="`clubs` has no handles")
        if len(handles) > EVENTS_MAX_CLUBS:
            raise HTTPException(
                status_code=400,
                detail=f"`clubs` has {len(handles)} handles; the maximum is "
                f"{EVENTS_MAX_CLUBS}",
            )
    club_mode = handles is not None and len(handles) == 1

    if not club_mode:
        # Same 422 body FastAPI sends for a missing required parameter.
        missing = [
            {
                "type": "missing",
                "loc": ("query", name),
                "msg": "Field required",
                "input": None,
            }
            for name, value in (("from", from_), ("to", to))
            if value is None
        ]
        if missing:
            raise RequestValidationError(missing)
    if from_ and to and to < from_:
        raise HTTPException(status_code=400, detail="`to` is before `from`")
    if not club_mode:
        days = (to - from_).days + 1
        if days > EVENTS_MAX_RANGE_DAYS:
            raise HTTPException(
                status_code=400,
                detail=f"Range is {days} days; the maximum is {EVENTS_MAX_RANGE_DAYS}",
            )
    try:
        events = get_db().get_events_in_range(
            from_, to, handles, (category or "").strip() or None
        )
    except Exception as e:
        return JSONResponse(
            status_code=500, content={"message": f"Error fetching events: {str(e)}"}
        )
    return {"count": len(events), "results": events}


@app.get("/club-manifest")
def get_club_manifest(
    category: Optional[str] = Query(None),
    limit: int = Query(100, description="Max clubs to return"),
    include_categories: bool = Query(False, description="Include category data"),
):
    """Get manifest of clubs with pagination and selective field loading."""
    try:
        # Only fetch essential fields for manifest
        if include_categories:
            select_fields = (
                "id, name, instagram_handle, profile_image_path, categories(name)"
            )
        else:
            select_fields = "id, name, instagram_handle, profile_image_path"

        result = get_db().get_club_manifest_optimized(category, limit, select_fields)

        return result
    except Exception as e:
        import traceback

        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching club manifest: {str(e)}"},
        )


@app.get("/categories")
def get_categories():
    """Get list of all categories."""
    try:
        # Query categories (implement this in your SupabaseQueries class)
        response = supabase.table("categories").select("id, name").execute()
        categories = response.data if response.data else []

        return {"count": len(categories), "results": categories}
    except Exception as e:
        return JSONResponse(
            status_code=500, content={"message": f"Error fetching categories: {str(e)}"}
        )


@router.get("/smart-search")
def smart_search(
    q: str = Query(..., description="Search query"),
    page: int = Query(1, ge=1, description="Page number starting from 1"),
    limit: int = Query(20, ge=1, le=100, description="Number of clubs per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
):
    """Optimized full text search with database-level pagination."""
    try:
        offset = (page - 1) * limit

        # Use database-level search and pagination
        result = get_db().search_clubs_optimized(q, offset, limit, category)

        return {
            "count": result["total"],
            "results": result["clubs"],
            "hasMore": result["total"] > (offset + limit),
            "page": page,
        }
    except Exception as e:
        import traceback

        traceback.print_exc()
        return JSONResponse(
            status_code=500, content={"message": f"Error in smart search: {str(e)}"}
        )


def run_scraper_process():
    from instinct.tools.scraper_rotation import ScraperRotation

    scraper = ScraperRotation()
    scraper.run()


app.include_router(router)
app.include_router(admin_router)
app.include_router(reports_router)
app.router.routes.append(mcp_route)
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "instinct.server:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000))
    )
