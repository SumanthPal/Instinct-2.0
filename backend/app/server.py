from io import BytesIO, StringIO
from tools.ai_validation import EventParser
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
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

@router.post("/submit-club")
async def submit_club(data: ClubSubmission, request: Request):
    # 1. Basic honeypot check
    if data.honeypot:
        raise HTTPException(status_code=400, detail="Bot detected")

    # 2. CAPTCHA validation
    captcha_resp = requests.post(
        "https://hcaptcha.com/siteverify",  # or Turnstile URL
        data={
            "secret": HCAPTCHA_SECRET,
            "response": data.captcha_token,
            "remoteip": request.client.host
        }
    )
    if not captcha_resp.json().get("success"):
        raise HTTPException(status_code=400, detail="CAPTCHA verification failed")

    # 3. Get user from headers (assumes you're passing in Supabase token)
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization")

    # 4. Validate Supabase user (backend service key, not client key)
    supabase_user = db.get_user_from_token(auth_header)
    if not supabase_user:
        raise HTTPException(status_code=401, detail="Invalid Supabase token")

    if not supabase_user["email"].endswith("@uci.edu"):
        raise HTTPException(status_code=403, detail="Only UCI students may submit")

    # 5. Optional: Rate limiting or trust score
    recent_submission = db.get_last_submission_by_user(supabase_user["id"])
    if recent_submission and recent_submission.within_last_hour():
        raise HTTPException(status_code=429, detail="Please wait before submitting again")

    # 6. Check if club exists already
    existing = db.get_club_by_instagram(data.instagram_handle)
    if existing:
        raise HTTPException(status_code=409, detail="Club already exists")

    # 7. Insert into pending table
    db.insert_pending_club({
        "name": data.name,
        "instagram_handle": data.instagram_handle,
        "description": data.description,
        "club_links": data.club_links,
        "submitted_by": supabase_user["id"],
        "approved": False,
    })

    return {"message": "Club submitted successfully. Awaiting approval."}


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
    
@app.get("/club")
async def list_clubs(
    limit: int = Query(100, description="Maximum number of clubs to return"),
    offset: int = Query(0, description="Number of clubs to skip"),
    category: Optional[str] = Query(None, description="Filter by category")
):
    """Get a list of all clubs."""
    try:
        # This would be implemented to fetch clubs from Supabase
        # For now, let's imagine we're fetching all clubs
        clubs = db.get_all_clubs()
        
        # Apply category filter if specified
        if category:
            # This filtering would happen at the database level
            # For illustration purposes only
            filtered_clubs = []
            for club in clubs:
                if club.get("categories") and any(cat.get("name") == category for cat in club.get("categories", [])):
                    filtered_clubs.append(club)
            clubs = filtered_clubs
        
        # Apply pagination
        paginated_clubs = clubs # deleted [offset:offset + limit]
        
        return {
            "count": len(clubs),
            "results": paginated_clubs
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error fetching clubs: {str(e)}"}
        )
        
@app.get("/club/{instagram_handle}")
async def get_club_data(instagram_handle: str):
    """Get detailed information about a specific club."""
    try:
        # Check if club exists
        club = db.get_club_by_instagram(instagram_handle)
        if not club:
            raise HTTPException(status_code=404, detail=f"Club with Instagram handle '{instagram_handle}' not found")
        
        # Return club data
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
        
        # Query posts (this would be implemented in your SupabaseQueries class)
        # For illustration, we're assuming a method exists
        posts = db.get_posts_by_club_id(club_id, limit, offset)
        
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
async def get_club_manifest():
    """Get manifest of all clubs with basic information."""
    try:
        # Get all clubs
        clubs = db.get_all_clubs()
        
        # Create simplified manifest
        manifest = []
        for club in clubs:
            manifest.append({
                "id": club["id"],
                "name": club["name"],
                "instagram_handle": club["instagram_handle"],
                "profile_pic": club.get("profile_pic", ""),
                "categories": [cat["name"] for cat in club.get("categories", [])],
            })
        
        return manifest
    except Exception as e:
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
        

@app.get("/search")
async def search_clubs(
    q: str = Query(..., description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category")
):
    """Search for clubs by name or description."""
    try:
        # This would be a more complex query in your database
        # For illustration purposes only
        response = supabase.table("clubs").select("*").ilike("name", f"%{q}%").execute()
        name_matches = response.data if response.data else []
        
        response = supabase.table("clubs").select("*").ilike("description", f"%{q}%").execute()
        desc_matches = response.data if response.data else []
        
        # Combine results and remove duplicates
        all_matches = name_matches.copy()
        existing_ids = set(club["id"] for club in all_matches)
        
        for club in desc_matches:
            if club["id"] not in existing_ids:
                all_matches.append(club)
                existing_ids.add(club["id"])
        
        # Apply category filter if specified
        filtered_matches = all_matches
        if category:
            # This filtering would happen at the database level in a real implementation
            filtered_matches = []
            for club in all_matches:
                # Get categories for this club
                club_categories_response = supabase.table("clubs_categories") \
                    .select("categories!inner(name)") \
                    .eq("club_id", club["id"]) \
                    .execute()
                    
                club_categories = club_categories_response.data if club_categories_response.data else []
                
                # Check if club has the specified category
                if any(cat["categories"]["name"] == category for cat in club_categories):
                    filtered_matches.append(club)
        
        return {
            "count": len(filtered_matches),
            "results": filtered_matches
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error searching clubs: {str(e)}"}
        )


def run_scraper_process():
    from tools.scraper_rotation import ScraperRotation
    scraper = ScraperRotation()
    scraper.run()

app.include_router(router)
if __name__ == "__main__":

    
    # Check if running on Heroku
    is_heroku = 'DYNO' in os.environ
    
    if is_heroku:
        # On Heroku, use a worker process instead (defined in Procfile)
        # Run only the web server in this process
        import uvicorn
        uvicorn.run("server:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
    else:
        
        scraper_process = multiprocessing.Process(target=run_scraper_process)
        scraper_process.daemon = True
        scraper_process.start()
        
        # Run the FastAPI server
        import uvicorn
        uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)