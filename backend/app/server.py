from io import BytesIO, StringIO
from tools.ai_validation import EventParser, get_embedding
from tools.calendar_connection import CalendarConnection
from tools.scraper_rotation import ScraperRotation
from db.supabase_client import supabase
from db.queries import SupabaseQueries
import os
import time
import uuid
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from io import StringIO
import requests
import dotenv
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, Query, Request, APIRouter, Depends
from fastapi.responses import JSONResponse, Response

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
import multiprocessing
import os

# Load environment variables
dotenv.load_dotenv()
from tools.logger import logger
azure_blob_cdn = os.getenv("AZURE_CDN")
# Initialize dependencies
calendar = CalendarConnection()
app = FastAPI(
    title="UCI Club Discovery API",
    description="API for discovering UCI clubs and their events",
    version="2.0.0"
)
router = APIRouter()

origins = [
    "*"
]


origins = [
    "https://instinct-2-0.vercel.app",       # production frontend
    "https://instinct.vercel.app",           # backup/staging
    "http://localhost:3000",                 # local development
    "http://127.0.0.1:3000"                  # alt local dev
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,       # needed if you send cookies/auth headers
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # whitelist only used methods
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],  # restrict to needed headers
)


db = SupabaseQueries()

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

HCAPTCHA_SECRET = os.getenv("HCAPTCHA_SECRET") 
@router.post("/club/add")
async def submit_pending_club(new_club: PendingClubSubmission, request: Request):
    # 1. Validate user auth
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    supabase_user = await db.get_user_from_token(auth_header)
    if not supabase_user:
        raise HTTPException(status_code=401, detail="Invalid Supabase token")

    # 2. Check UCI email
    if not supabase_user["email"].endswith("@uci.edu"):
        raise HTTPException(status_code=403, detail="Only UCI students can submit clubs")

    # 3. Check if club already exists in real table
    existing = db.get_club_by_instagram(new_club.instagram_handle)
    if existing:
        raise HTTPException(status_code=409, detail="Club with this Instagram handle already exists")

    # 4. Insert into pending_clubs table
    try:
        result = supabase.table("pending_clubs").insert({
            "name": new_club.club_name,
            "instagram_handle": new_club.instagram_handle,
            "categories": [{"name": category} for category in new_club.categories],
            "submitted_by_email": new_club.submitted_by_email,
            "submitted_at": datetime.now().isoformat(),
            "approved": False
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit pending club: {str(e)}")

    # If it gets here, it was successful
    return {"message": "Club submitted successfully. Awaiting approval."}
@router.delete("/pending-club/{pending_id}/reject")
async def reject_pending_club(pending_id: str, request: Request):
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    
    if auth_header != f"Bearer {db.SUPABASE_KEY}":
        raise HTTPException(status_code=401, detail="Invalid service token")

    try:
        # Set approved = false
        result = supabase.table("pending_clubs").update({
            "approved": False
        }).eq('id', pending_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reject club: {str(e)}")

    return {"message": f"Club {pending_id} rejected and will be auto-deleted by trigger."}

@router.get("/pending-clubs")
async def list_pending_clubs(
    limit: int = Query(20, description="Number of pending clubs to fetch"),
    offset: int = Query(0, description="Pagination offset")
):
    """List pending clubs that have not been approved yet."""
    try:
        response = supabase.table("pending_clubs") \
            .select("*") \
            .eq("approved", False) \
            .order("submitted_at", desc=False) \
            .range(offset, offset + limit - 1) \
            .execute()
        
        # FIX: Check if response.data is not None
        pending = response.data
        if not pending:
            pending = []

        return {
            "count": len(pending),
            "results": pending
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching pending clubs: {str(e)}"})

from datetime import datetime  # Make sure you have this imported!


@router.post("/pending-club/{pending_id}/approve")
async def approve_pending_club(pending_id: str, request: Request):
    # 1. Validate admin authentication
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    if auth_header != f"Bearer {db.SUPABASE_KEY}":
        raise HTTPException(status_code=401, detail="Invalid service token")

    # 2. Fetch pending club
    try:
        response = db.supabase.table("pending_clubs").select("*").eq("id", pending_id).single().execute()
        pending_club = response.data
        if not pending_club:
            raise HTTPException(status_code=404, detail="Pending club not found")
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Pending club not found: {str(e)}")

    # 3. Insert into real clubs table
    insert_payload = {
        "name": pending_club["name"],
        "instagram_handle": pending_club["instagram_handle"],
    }
    
    # Note: club_links don't exist yet, but we'll need to handle categories
    # Categories should be processed separately after club creation
    
    try:
        # Insert the club
        club_result = db.supabase.table("clubs").insert(insert_payload).execute()
        
        # Get the new club ID for category association
        if not club_result.data or len(club_result.data) == 0:
            raise Exception("Failed to insert club - no data returned")
            
        new_club_id = club_result.data[0]["id"]
        
        # Process categories if they exist
        if pending_club.get("categories") and isinstance(pending_club["categories"], list):
            # Log for debugging
            logger.info(f"Processing categories: {pending_club['categories']}")
            
            # Handle your categories based on your schema
            # This assumes you have a club_categories junction table
            # and that categories are formatted as objects with a "name" field
            for category in pending_club["categories"]:
                # Find or create the category
                category_name = category.get("name")
                if not category_name:
                    continue
                    
                # Look up category ID by name
                cat_response = db.supabase.table("categories").select("id").eq("name", category_name).execute()
                
                if cat_response.data and len(cat_response.data) > 0:
                    category_id = cat_response.data[0]["id"]
                    
                    # Insert association
                    db.supabase.table("clubs_categories").insert({
                        "club_id": new_club_id,
                        "category_id": category_id
                    }).execute()
                else:
                    logger.warning(f"Category '{category_name}' not found, skipping")
            
    except Exception as e:
        logger.error(f"Failed to insert into clubs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to insert into clubs: {str(e)}")

    # 4. Delete the pending club entry
    try:
        delete_result = db.supabase.table("pending_clubs").delete().eq("id", pending_id).execute()
        logger.info(f"Deleted pending club: {delete_result.data}")
        
    except Exception as e:
        logger.error(f"Failed to delete pending club: {str(e)}")
        # Note: We don't raise an exception here because the club was already successfully added
        # Just log the error and return a warning
        return {
            "message": "Club approved and added successfully, but failed to remove from pending queue",
            "warning": f"Failed to delete pending club: {str(e)}"
        }

    return {"message": "Club approved and added successfully"}

@app.get("/")
async def home():
    """Home endpoint to verify API is working."""
    return {"message": "Welcome to the UCI Club Discovery API"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }
    
from fastapi import FastAPI, Query
from typing import Optional
from fastapi.responses import JSONResponse

@app.get("/club")
async def list_clubs(
    page: int = Query(1, description="Page number, starting from 1"),
    limit: int = Query(20, description="Number of clubs per page"),
    category: Optional[str] = Query(None, description="Filter by category name (exact match)")
):
    """Get a paginated list of clubs, optionally filtered by category."""
    try:
        # Calculate offset
        offset = (page - 1) * limit
        
        # Use optimized database-level pagination
        result = db.get_clubs_paginated(offset, limit, category)
        
        # Determine if there are more pages
        has_more = result["total"] > (offset + limit)
        
        # Return the response
        return {
            "total": result["total"],
            "results": result["clubs"],
            "hasMore": has_more,
            "page": page,
            "pages": (result["total"] + limit - 1) // limit
        }
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching clubs: {str(e)}"}
        )

@app.get("/club/{instagram_handle}")
async def get_club_data(instagram_handle: str):
    """Get detailed information about a specific club."""
    try:
        club = db.get_club_by_instagram(instagram_handle)
        if not club:
            raise HTTPException(status_code=404, detail=f"Club with Instagram handle '{instagram_handle}' not found")
        
        if club.get("profile_image_path"):
            # Fixed: Use instagram_handle variable, correct path, and add dot before jpg
            public_url = f"{azure_blob_cdn}/pfps/{instagram_handle}.jpg"
            club["profile_image_url"] = public_url
        
        return club
    except HTTPException as http_e:
        raise http_e
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching club data: {str(e)}"}
        )


@app.get("/club/{instagram_handle}/posts")
async def get_club_posts(
    instagram_handle: str,
    limit: int = Query(20, description="Maximum number of posts to return"),
    offset: int = Query(0, description="Number of posts to skip")
):
    """Get posts for a specific club."""
    try:
        # Check if club exists
        club = db.get_club_by_instagram(instagram_handle)
        if not club:
            raise HTTPException(status_code=404, detail=f"Club with Instagram handle '{instagram_handle}' not found")
        
        # Get club ID
        club_id = club["id"]
        
        # Query posts
        posts = db.get_posts_by_club_id(club_id, limit, offset)
        
        for post in posts:
            if post.get("image_path"):
                # Fixed: Use Azure CDN instead of Supabase storage
                # Assuming image_path contains the relative path like "posts/{instagram_handle}/{post_id}"
                if not post["image_path"].lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                    post["image_path"] += ".jpg"  # default fallback
                
                post["image_url"] = f"{azure_blob_cdn}/{post['image_path']}"
        
        return {
            "count": len(posts),
            "results": posts
        }
    except HTTPException as http_e:
        raise http_e
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching club posts: {str(e)}"}
        )

        
@app.get("/club/{instagram_handle}/events")
async def get_club_events(
    instagram_handle: str,
    start_date: Optional[datetime] = Query(None, description="Filter events after this date"),
    end_date: Optional[datetime] = Query(None, description="Filter events before this date")
):
    """Get events for a specific club."""
    try:
        # Check if club exists
        club = db.get_club_by_instagram(instagram_handle)
        if not club:
            raise HTTPException(status_code=404, detail=f"Club with Instagram handle '{instagram_handle}' not found")
        
        # Get club ID
        club_id = club["id"]
        
        # Get events
        events = db.get_events_for_club(club_id)
        
        # Apply date filters if specified
        filtered_events = []
        for event in events:
            event_date = datetime.fromisoformat(event["date"].replace('Z', '+00:00'))
            
            if start_date and event_date < start_date:
                continue
                
            if end_date and event_date > end_date:
                continue
                
            filtered_events.append(event)
        
        return {
            "count": len(filtered_events),
            "results": filtered_events
        }
    except HTTPException as http_e:
        raise http_e
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching club events: {str(e)}"}
        )


@app.get("/club/{instagram_handle}/calendar.ics")
async def get_club_calendar(instagram_handle: str):
    """Get calendar file (ICS) for a specific club."""
    try:
        # Check if club exists
        club = db.get_club_by_instagram(instagram_handle)
        if not club:
            raise HTTPException(status_code=404, detail=f"Club with Instagram handle '{instagram_handle}' not found")
        
        # Get club ID
        club_id = club["id"]
        
        # Get calendar content
        calendar_content = db.get_calendar_file(club_id)
        
        if not calendar_content:
            raise HTTPException(status_code=404, detail="Calendar file not found")
        
        # Return as ICS file
        return Response(
            content=calendar_content,
            media_type="text/calendar",
            headers={
                "Content-Disposition": f"attachment; filename={instagram_handle}_calendar.ics"
            }
        )
    except HTTPException as http_e:
        raise http_e
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching calendar: {str(e)}"}
        )


@app.get("/club-manifest")
async def get_club_manifest(
    category: Optional[str] = Query(None),
    limit: int = Query(100, description="Max clubs to return"),
    include_categories: bool = Query(False, description="Include category data")
):
    """Get manifest of clubs with pagination and selective field loading."""
    try:
        # Only fetch essential fields for manifest
        if include_categories:
            select_fields = "id, name, instagram_handle, profile_image_path, categories(name)"
        else:
            select_fields = "id, name, instagram_handle, profile_image_path"
        
        result = db.get_club_manifest_optimized(category, limit, select_fields)
        
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching club manifest: {str(e)}"}
        )
        
@app.get("/categories")
async def get_categories():
    """Get list of all categories."""
    try:
        # Query categories (implement this in your SupabaseQueries class)
        response = supabase.table("categories").select("id, name").execute()
        categories = response.data if response.data else []
        
        return {
            "count": len(categories),
            "results": categories
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching categories: {str(e)}"}
        )

@app.get("/club/{instagram_handle}/next_scrape")
async def next_scrape(
    instagram_handle: str,
):
    try:
        date = ScraperRotation().calculate_next_scrape(instagram_handle)
        return {
            "next_scrape": date
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error obtianing next scrape: {str(e)}"}
        )
        

@router.get("/smart-search")
async def smart_search(
    q: str = Query(..., description="Search query"),
    page: int = Query(1, description="Page number starting from 1"),
    limit: int = Query(20, description="Number of clubs per page"),
    category: Optional[str] = Query(None, description="Filter by category")
):
    """Optimized full text search with database-level pagination."""
    try:
        offset = (page - 1) * limit
        
        # Use database-level search and pagination
        result = db.search_clubs_optimized(q, offset, limit, category)
        
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
            status_code=500,
            content={"message": f"Error in smart search: {str(e)}"}
        )

@router.get("/hybrid-search")
async def hybrid_search(
    q: str = Query(..., description="Search query"),
    page: int = Query(1, description="Page number starting from 1"),
    limit: int = Query(20, description="Number of clubs per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    semantic_weight: float = Query(0.5, description="Weight for semantic search (0-1)")
):
    """Hybrid search combining full-text and semantic search on clubs."""
    try:
        # Get embedding for semantic search
        query_embedding = get_embedding(q)
        
        # If embedding fails, fall back to full-text search
        if not query_embedding:
            return await smart_search(q, page, limit, category)
        
        # Normalize weight (ensure it's between 0 and 1)
        semantic_weight = max(0, min(1, semantic_weight))
        fulltext_weight = 1 - semantic_weight
        
        # Prepare the search query using text_search for full-text and vector comparison for semantic
        # Use a CTE (Common Table Expression) to handle the hybrid search logic
        response = supabase.rpc(
            'hybrid_search',
            {
                'query_text': q,
                'query_embedding': query_embedding,
                'match_threshold': 0.5, # Adjust as needed
                'fulltext_weight': fulltext_weight,
                'semantic_weight': semantic_weight
            }
        ).execute()
        
        matches = response.data if response.data else []
        
        # Filter by category if specified
        if category:
            matches = [
                club for club in matches
                if any(cat["name"] == category for cat in club.get("categories", []))
            ]
        
        # Manually paginate results
        total_matches = len(matches)
        cdn_prefix = os.getenv("AZURE_CDN", "")
        start = (page - 1) * limit
        end = start + limit
        paginated_matches = matches[start:end]
        
        for club in paginated_matches:
            image_path = club.get("profile_image_path")
            if image_path:
                club["profile_image_path"] = f"{cdn_prefix}/{image_path.lstrip('/')}"
        
        return {
            "count": total_matches,
            "results": paginated_matches,
            "hasMore": end < total_matches,
            "page": page,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"message": f"Error in hybrid search: {str(e)}"}
        )

def run_scraper_process():
    from tools.scraper_rotation import ScraperRotation
    scraper = ScraperRotation()
    scraper.run()

app.include_router(router)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
    