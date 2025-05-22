import os
from PIL import Image
import json
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import uuid
from pathlib import Path
import sys
import requests
from io import BytesIO
import httpx


from pathlib import Path
import os
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient, ContentSettings
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from db.supabase_client import supabase

from tools.logger import logger

class SupabaseQueries:
    def __init__(self):
        """Initialize the Supabase client"""
        self.supabase = supabase
        self.SUPABASE_URL = os.getenv("SUPABASE_URL")
        self.SUPABASE_KEY = os.getenv("SUPABASE_KEY")
        self.BUCKET_NAME = os.getenv("BUCKET_NAME")
        self.azure_connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        if not self.azure_connection_string:
            raise ValueError("AZURE_STORAGE_CONNECTION_STRING environment variable not set")
        
        self.blob_service_client = BlobServiceClient.from_connection_string(self.azure_connection_string)
        self.azure_container_name = "images"


        
    def get_category_id(self, category_name: str) -> Optional[str]:
        """Get the UUID for a category by name, or None if it doesn't exist"""
        response = self.supabase.table("categories").select("id").eq("name", category_name).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]["id"]
        return None
    
    def ensure_category_exists(self, category_name: str) -> str:
        """Ensure a category exists, creating it if necessary, and return its ID"""
        existing_id = self.get_category_id(category_name)
        if existing_id:
            return existing_id
        
        # Create new category
        response = self.supabase.table("categories").insert({"name": category_name}).execute()
        
        if response.data and len(response.data) > 0:
            logger.info(f"Created new category: {category_name}")
            return response.data[0]["id"]
        else:
            logger.error(f"Failed to create category: {category_name}")
            raise Exception(f"Failed to create category: {category_name}")
    
    # ----- Club Methods ----- 
    
    def get_club_by_instagram(self, instagram_handle: str) -> Optional[Dict]:
        """Fetch a club by Instagram handle"""
        response = self.supabase.table("clubs").select("*").eq("instagram_handle", instagram_handle).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    
    
    def get_all_clubs(self) -> List[Dict]:
        """Fetch all clubs with their categories and prepend CDN URL to profile images"""
        cdn_prefix = os.getenv("AZURE_CDN", "")
        response = self.supabase.table("clubs").select("*, categories(name)").execute()

        clubs = response.data if response.data else []

        for club in clubs:
            image_path = club.get("profile_image_path")
            if image_path:
                # Construct full image URL: <CDN_URL>/images/<profile_image_path>
                club["profile_image_path"] = f"{cdn_prefix}/{image_path.lstrip('/')}"

        return clubs
        
    def upsert_club(self, club_info: Dict) -> str:
        """Create or update a club and assign categories"""
        instagram_handle = club_info.get("Instagram Handle", "")
        if not instagram_handle:
            raise ValueError("Instagram handle is required")
        
        # Prepare club data
        club_data = {
            "name": club_info.get("Club Name", ""),
            "instagram_handle": instagram_handle,
            "profile_pic": club_info.get("Profile Picture", ""),
            "description": " ".join(club_info.get("Description", [])),
            "updated_at": datetime.now().isoformat(),
            "followers": club_info.get("Followers", 0),
            "following": club_info.get("Following", 0),
            "club_links": club_info.get("Club Links", []),
            "profile_image_path": club_info.get("profile_image_path", None)
        }
        
        # Check if club exists
        existing_club = self.get_club_by_instagram(instagram_handle)
        
        if existing_club:
            # Update existing club
            club_id = existing_club["id"]
            self.supabase.table("clubs").update(club_data).eq("id", club_id).execute()
            logger.info(f"Updated club: {club_data['name']}")
        else:
            # Create new club
            response = self.supabase.table("clubs").insert(club_data).execute()
            if response.data and len(response.data) > 0:
                club_id = response.data[0]["id"]
                logger.info(f"Created new club: {club_data['name']}")
            else:
                logger.error(f"Failed to create club: {club_data['name']}")
                raise Exception(f"Failed to create club: {club_data['name']}")
        
        return club_id
    
    
    def assign_categories_to_club(self, club_id: str, categories: List[str]) -> None:
        """Assign categories to a club"""
        # First, get all current category assignments
        existing_assignments = self.supabase.table("clubs_categories").select("category_id").eq("club_id", club_id).execute()
        existing_category_ids = [item["category_id"] for item in existing_assignments.data] if existing_assignments.data else []
        
        # Get/create all category IDs
        category_id_map = {cat: self.ensure_category_exists(cat) for cat in categories}
        new_category_ids = list(category_id_map.values())
        
        # Categories to add
        categories_to_add = [id for id in new_category_ids if id not in existing_category_ids]
        
        # Categories to remove
        categories_to_remove = [id for id in existing_category_ids if id not in new_category_ids]
        
        # Add new categories
        if categories_to_add:
            assignments = [{"club_id": club_id, "category_id": cat_id} for cat_id in categories_to_add]
            self.supabase.table("clubs_categories").insert(assignments).execute()
            logger.info(f"Added {len(categories_to_add)} categories to club {club_id}")
        
        # Remove old categories
        if categories_to_remove:
            for cat_id in categories_to_remove:
                self.supabase.table("clubs_categories").delete().eq("club_id", club_id).eq("category_id", cat_id).execute()
            logger.info(f"Removed {len(categories_to_remove)} categories from club {club_id}")
    
    # ----- Post Methods -----
    
    def get_post_by_instagram_id(self, instagram_post_id: str) -> Optional[Dict]:
        """Get a post by its Instagram post ID"""
        response = self.supabase.table("posts").select("*").eq("determinant", instagram_post_id).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    
    def upsert_post(self, club_id: str, post_data: Dict) -> str:
        """Create or update a post"""
        instagram_post_id = post_data.get("post_url", "").split("/")[-2]
        if not instagram_post_id:
            raise ValueError("Instagram post ID could not be determined")
        
        # Prepare post data
        post_to_insert = {
            "club_id": club_id,
            "post_id": instagram_post_id,
            "caption": post_data.get("", ""),
            "image_url": post_data.get("image_url", ""),
            "posted": post_data.get("posted", datetime.now().isoformat())
        }
        
        # Check if post exists
        existing_post = self.get_post_by_instagram_id(instagram_post_id)
        
        if existing_post:
            # Update existing post
            post_id = existing_post["id"]
            self.supabase.table("posts").update(post_to_insert).eq("id", post_id).execute()
            logger.info(f"Updated post: {instagram_post_id}")
        else:
            # Create new post
            response = self.supabase.table("posts").insert(post_to_insert).execute()
            if response.data and len(response.data) > 0:
                post_id = response.data[0]["id"]
                logger.info(f"Created new post: {instagram_post_id}")
            else:
                logger.error(f"Failed to create post: {instagram_post_id}")
                raise Exception(f"Failed to create post: {instagram_post_id}")
        
        return post_id
    

    
    # ----- Event Methods -----
    
    def get_event_by_post_id(self, post_id: str) -> Optional[Dict]:
        """Get an event by its associated post ID"""
        response = self.supabase.table("events").select("*").eq("post_id", post_id).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    
    def upsert_event(self, club_id: str, post_id: str, event_data: Dict) -> str:
        """Create or update an event"""
        # Prepare event data
        event_to_insert = {
            "club_id": club_id,
            "post_id": post_id,
            "name": event_data.get("name", "Untitled Event"),
            "date": event_data.get("date", datetime.now().isoformat()),
            "details": event_data.get("details", ""),
            "duration": event_data.get("duration", "1 hour"),
            "parsed": event_data.get("parsed", {})
        }
        
        # Check if event exists
        existing_event = self.get_event_by_post_id(post_id)
        
        if existing_event:
            # Update existing event
            event_id = existing_event["id"]
            self.supabase.table("events").update(event_to_insert).eq("id", event_id).execute()
            logger.info(f"Updated event: {event_to_insert['name']}")
        else:
            # Create new event
            response = self.supabase.table("events").insert(event_to_insert).execute()
            if response.data and len(response.data) > 0:
                event_id = response.data[0]["id"]
                logger.info(f"Created new event: {event_to_insert['name']}")
            else:
                logger.error(f"Failed to create event: {event_to_insert['name']}")
                raise Exception(f"Failed to create event: {event_to_insert['name']}")
        
        return event_id
    
    
    def cleanup_unused_categories(self) -> int:
        """Delete categories that are not associated with any clubs"""
        # First, get all category IDs that are used in clubs_categories
        used_categories_response = self.supabase.table("clubs_categories").select("category_id").execute()
        used_category_ids = {item["category_id"] for item in used_categories_response.data} if used_categories_response.data else set()
        
        # Then, get all categories
        all_categories_response = self.supabase.table("categories").select("id").execute()
        all_category_ids = {item["id"] for item in all_categories_response.data} if all_categories_response.data else set()
        
        # Find unused categories
        unused_category_ids = all_category_ids - used_category_ids
        
        # Delete unused categories
        deleted_count = 0
        for cat_id in unused_category_ids:
            self.supabase.table("categories").delete().eq("id", cat_id).execute()
            deleted_count += 1
        
        logger.info(f"Deleted {deleted_count} unused categories")
        return deleted_count
    
    def insert_post_link(self, post_data):
        """Insert a minimal post entry with just the link information if determinant doesn't already exist"""
        response = (
            self.supabase
            .from_("posts")
            .upsert({
                "club_id": post_data["club_id"],
                "post_url": post_data["post_url"],
                "scrapped": post_data["scrapped"],
                "determinant": post_data['determinant'],
                "created_at": post_data['created_at'],
            }, on_conflict=["determinant"])  # Only insert if determinant is not already present
            .execute()
        )

        # If insert was skipped due to conflict, you might get empty `response.data`, so return None or handle accordingly
        return response.data[0]["id"] if response.data else None
    
    def get_club_by_instagram_handle(self, instagram_handle: str):
        """Fetch the club row matching the given Instagram handle."""
        response = (
            self.supabase
            .from_("clubs")
            .select("id")
            .eq("instagram_handle", instagram_handle)
            .execute()
        )

        if not response.data:
            return None  # or raise an exception if preferred

        return response.data[0]["id"]
    
    def get_unscrapped_posts_by_club_id(self, club_id: int):
        """Fetch all unscrapped posts for a given club."""
        response = (
            self.supabase
            .from_("posts")
            .select("id", "post_url")
            .eq("club_id", club_id)
            .eq("scrapped", False)
            .execute()
        )

        return response.data or []

    def update_post_by_id(self, post_id: int, update_data: dict):
        """Update a post by its ID with the given update data."""
        response = (
            self.supabase
            .from_("posts")
            .update(update_data)
            .eq("id", post_id)
            .execute()
        )

        return response.data
    
    def check_if_post_is_parsed(self, post_id: uuid) -> bool:
        response = (self.supabase.table("posts")
                    .select("id")
                    .eq("parsed", False)
                    .eq("id", post_id)
                    .limit(1)
                    .execute())
    
        if response.data:
            return False  # post_id already exists
        return True  # post_id not found, so it's not parsed yet
    
    def posts_to_parse(self, username):
        club_id = self.get_club_by_instagram_handle(username)
        response = (self.supabase
         .table("posts")
         .select("id")
         .eq("parsed", False)
         .eq("club_id", club_id)
         .execute()
         )
        return response.data
    
    def get_post_date_and_caption(self, post_id) -> tuple:
            """
            Get the posting date and caption for a post.
            
            Args:
                post_id (uuid): ID of the post
                
            Returns:
                Tuple of (posted_date, caption)
            """
            response = (
                self.supabase
                .table("posts")
                .select("posted", "caption")
                .eq("id", post_id)  # Fixed this line - use "id" instead of "post_id"
                .limit(1)
                .execute()
            )
            
            if response.data:
                post = response.data[0]
                return post["posted"], post["caption"]
            
            raise ValueError(f"Post with ID {post_id} not found.")
    def insert_event(self, event_data: dict):
        """
        Insert a new event into the events table.
        
        Args:
            event_data (dict): Event data containing club_id, post_id, name, date, details, duration, and parsed
            
        Returns:
            The inserted event data
        """
        response = (
            self.supabase
            .from_("events")
            .insert(event_data)
            .execute()
        )
        
        return response.data
    
    def update_post_by_id(self, post_id: "uuid", update_data: dict):
        """
        Update a post by its ID with the given update data.
        
        Args:
            post_id (uuid): ID of the post to update
            update_data (dict): Dictionary containing the fields to update
            
        Returns:
            The updated post data
        """
        response = (  # Fixed typo here - 'response' instead of 'reponse'
            self.supabase
            .from_("posts")
            .update(update_data)
            .eq("id", post_id)
            .execute()
        )
        
        return response.data

    def get_calendar_file(self, club_id: str) -> Optional[str]:
        """
        Get the ICS content for a club from the database
        
        Args:
            club_id (str): The UUID of the club
            
        Returns:
            Optional[str]: The ICS content if found, None otherwise
        """
        response = (
            self.supabase
            .from_("calendar_files")
            .select("ics_content")
            .eq("club_id", club_id)
            .limit(1)
            .execute()
        )
        
        if response.data and len(response.data) > 0:
            return response.data[0]["ics_content"]
        return None

    def save_calendar_file(self, club_id: str, ics_content: str) -> str:
        """
        Save the ICS content to the database
        
        Args:
            club_id (str): The UUID of the club
            ics_content (str): The ICS content to save
            
        Returns:
            str: The UUID of the saved calendar file
        """
        # Check if a calendar file already exists for this club
        existing_response = (
            self.supabase
            .from_("calendar_files")
            .select("id")
            .eq("club_id", club_id)
            .limit(1)
            .execute()
        )
        
        if existing_response.data and len(existing_response.data) > 0:
            # Update existing record
            calendar_id = existing_response.data[0]["id"]
            response = (
                self.supabase
                .from_("calendar_files")
                .update({"ics_content": ics_content})
                .eq("id", calendar_id)
                .execute()
            )
            logger.info(f"Updated calendar file for club {club_id}")
            return calendar_id
        else:
            # Insert new record
            response = (
                self.supabase
                .from_("calendar_files")
                .insert({
                    "club_id": club_id,
                    "ics_content": ics_content
                })
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                logger.info(f"Created new calendar file for club {club_id}")
                return response.data[0]["id"]
            else:
                logger.error(f"Failed to create calendar file for club {club_id}")
                raise Exception(f"Failed to create calendar file for club {club_id}")
            
    def get_events_for_club(self, club_id: str) -> List[Dict]:
        """
        Get all events for a club from the events table
        
        Args:
            club_id (str): The UUID of the club
            
        Returns:
            List[Dict]: List of event records
        """
        response = (
            self.supabase
            .from_("events")
            .select("*")
            .eq("club_id", club_id)
            .execute()
        )
        
        return response.data if response.data else []
    
    def check_if_post_is_scrapped(self, post_id: str) -> bool:
        """Check if a post has already been scrapped"""
        response = (
            self.supabase
            .table("posts")
            .select("scrapped")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )
        
        if response.data and len(response.data) > 0:
            return response.data[0]["scrapped"]
        return False

    def check_if_post_is_photo_reloaded(self, post_id: str) -> bool:
        """Check if a post has already been scrapped"""
        response = (
            self.supabase
            .table("posts")
            .select("photo_reload")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )
        
        if response.data and len(response.data) > 0:
            return response.data[0]["photo_reload"]
        return False
    
    async def get_user_from_token(self, token: str):
        # Remove "Bearer " if present
        token = token.replace("Bearer ", "")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": self.SUPABASE_KEY,
                },
            )

        if response.status_code != 200:
            return None
        
        return response.json()
    
    def insert_pending_club(self, data: dict):
        supabase.table("clubs_pending").insert(data).execute()
        
    def get_last_submission_by_user(self, user_id: str):
        response = supabase.table("clubs_pending").select("*").eq("submitted_by", user_id).order("created_at", desc=True).limit(1).execute()
        if response.data:
            return response.data[0]
        return None
    
    def get_posts_by_club_id(self, club_id: str, limit: int = 10, offset: int = 0) -> List[Dict]:
        try:
            response = supabase.table("posts") \
                .select("*") \
                .eq("club_id", club_id) \
                .order("posted", desc=True) \
                .range(offset, offset + limit - 1) \
                .execute()

            return response.data or []  # Return empty list if None
        except Exception as e:
            print(f"Error in get_posts_by_club_id: {e}")
            return []
        
    def download_and_upload_img(self, image_url: str, storage_path: str):
        """
        Download image from URL, compress it, and upload to Azure Blob Storage
        """
        response = requests.get(image_url)
        if response.status_code != 200:
            logger.error("Error in fetching image.")
            raise Exception(f"Failed to download image: {response.status_code}")
        
        try:
            img = Image.open(BytesIO(response.content))
        except Exception as e:
            logger.error("Failed to load image into Pillow")
            raise e
        
        # Compress image
        compressed_io = BytesIO()
        img.convert("RGB").save(compressed_io, format="JPEG", quality=85)
        compressed_io.seek(0)
        
        # Ensure storage_path has .jpg extension for proper content type detection
        if not storage_path.lower().endswith(('.jpg', '.jpeg')):
            storage_path += '.jpg'
        
        try:
            # Upload to Azure Blob Storage
            blob_client = self.blob_service_client.get_blob_client(
                container=self.azure_container_name, 
                blob=storage_path
            )
            
            # Upload with proper content settings to prevent download behavior
            blob_client.upload_blob(
                compressed_io.read(),
                content_settings=ContentSettings(
                    content_type='image/jpeg',
                    content_disposition='inline'
                ),
                overwrite=True
            )
            
            logger.info(f"Successfully uploaded image to Azure: {storage_path}")
            return storage_path
            
        except Exception as e:
            logger.error(f"Failed to upload image to Azure Blob Storage: {str(e)}")
            raise e

    def _get_from_cache(self, key: str):
        """Get item from cache if not expired"""
        if key in self._cache:
            if time.time() < self._cache_ttl.get(key, 0):
                return self._cache[key]
            else:
                # Remove expired item
                self._cache.pop(key, None)
                self._cache_ttl.pop(key, None)
        return None

    def _set_cache(self, key: str, value, ttl: int = None):
        """Set item in cache with TTL"""
        if ttl is None:
            ttl = self.default_ttl
        self._cache[key] = value
        self._cache_ttl[key] = time.time() + ttl

    def get_clubs_paginated(self, offset: int, limit: int, category: Optional[str] = None) -> Dict:
        """Fetch clubs with database-level pagination and optional category filtering"""
        cdn_prefix = os.getenv("AZURE_CDN", "")
        
        try:
            # Build the query with only essential fields to reduce data transfer
            if category:
                # For category filtering, we need to use a different approach
                # since direct filtering on joined tables can be complex
                query = self.supabase.rpc('get_clubs_by_category_paginated', {
                    'category_name': category,
                    'page_offset': offset,
                    'page_limit': limit
                })
            else:
                # Simple pagination without category filter
                query = self.supabase.table("clubs")\
                    .select("id, name, instagram_handle, profile_image_path, description, followers, categories(name)", count="exact")\
                    .range(offset, offset + limit - 1)\
                    .order("name")
            
            response = query.execute()
            
            clubs = response.data if response.data else []
            total_count = response.count if response.count is not None else 0
            
            # Add CDN prefix only when needed
            for club in clubs:
                image_path = club.get("profile_image_path")
                if image_path:
                    club["profile_image_path"] = f"{cdn_prefix}/{image_path.lstrip('/')}"
            
            return {
                "clubs": clubs,
                "total": total_count
            }
            
        except Exception as e:
            logger.error(f"Error in get_clubs_paginated: {str(e)}")
            # Fallback to original method if RPC doesn't exist
            return self._get_clubs_paginated_fallback(offset, limit, category)

    def _get_clubs_paginated_fallback(self, offset: int, limit: int, category: Optional[str] = None) -> Dict:
        """Fallback method using client-side filtering (less efficient)"""
        cdn_prefix = os.getenv("AZURE_CDN", "")
        
        # Get only essential fields
        query = self.supabase.table("clubs")\
            .select("id, name, instagram_handle, profile_image_path, description, followers, categories(name)")
        
        if category:
            # This is less efficient but works without stored procedures
            all_clubs_response = query.execute()
            all_clubs = all_clubs_response.data if all_clubs_response.data else []
            
            # Filter by category
            filtered_clubs = []
            for club in all_clubs:
                if club.get("categories") and any(
                    cat.get("name") == category for cat in club.get("categories", [])
                ):
                    filtered_clubs.append(club)
            
            total_count = len(filtered_clubs)
            clubs = filtered_clubs[offset:offset + limit]
        else:
            response = query.range(offset, offset + limit - 1).execute()
            clubs = response.data if response.data else []
            
            # Get total count separately
            count_response = self.supabase.table("clubs").select("id", count="exact").execute()
            total_count = count_response.count if count_response.count is not None else 0
        
        # Add CDN prefix
        for club in clubs:
            image_path = club.get("profile_image_path")
            if image_path:
                club["profile_image_path"] = f"{cdn_prefix}/{image_path.lstrip('/')}"
        
        return {
            "clubs": clubs,
            "total": total_count
        }
        
    def search_clubs_optimized(self, query: str, offset: int, limit: int, category: Optional[str] = None) -> Dict:
        """Optimized search with database-level pagination"""
        cdn_prefix = os.getenv("AZURE_CDN", "")
        logger.info(f"CDN prefix: {cdn_prefix}")  # Debug log
        
        try:
            # Use RPC for complex search operations
            response = self.supabase.rpc('search_clubs_paginated', {
                'search_query': query,
                'page_offset': offset,
                'page_limit': limit,
                'filter_category': category
            }).execute()
            
            clubs = response.data if response.data else []
            total_count = len(clubs) if clubs else 0
            
            # Add CDN prefix to profile images
            for club in clubs:
                image_path = club.get("profile_image_path")
                if image_path:
                    original_path = image_path
                    club["profile_image_path"] = f"{cdn_prefix}/{image_path.lstrip('/')}"
                    logger.info(f"RPC: Transformed {original_path} -> {club['profile_image_path']}")  # Debug log
            
            return {
                "clubs": clubs,
                "total": total_count
            }
            
        except Exception as e:
            logger.warning(f"RPC search failed, falling back to basic search: {str(e)}")
            # Fallback to basic text search - get all matches first, then paginate
            response = self.supabase.table("clubs")\
                .select("id, name, instagram_handle, profile_image_path, description, categories(name)")\
                .text_search("search_vector", query)\
                .execute()
            
            all_matches = response.data if response.data else []
            
            # Apply category filter if provided
            if category:
                filtered_matches = [
                    club for club in all_matches
                    if any(cat.get("name") == category for cat in club.get("categories", []))
                ]
                all_matches = filtered_matches
            
            # Calculate total and apply pagination manually
            total_count = len(all_matches)
            clubs = all_matches[offset:offset + limit]
            
            # Add CDN prefix to profile images for fallback results
            for club in clubs:
                image_path = club.get("profile_image_path")
                if image_path:
                    original_path = image_path
                    club["profile_image_path"] = f"{cdn_prefix}/{image_path.lstrip('/')}"
                    logger.info(f"Fallback: Transformed {original_path} -> {club['profile_image_path']}")  # Debug log
            
            return {
                "clubs": clubs,
                "total": total_count
            }

    def get_club_manifest_optimized(self, category: Optional[str], limit: int, select_fields: str) -> List[Dict]:
        """Optimized club manifest with selective field loading"""
        cache_key = f"manifest_{category}_{limit}_{select_fields}"
        cached_result = self._get_from_cache(cache_key)
        if cached_result:
            return cached_result
        
        cdn_prefix = os.getenv("AZURE_CDN", "")
        
        query = self.supabase.table("clubs").select(select_fields).limit(limit)
        
        if category:
            # Use RPC or fallback to client filtering
            try:
                response = self.supabase.rpc('get_clubs_manifest_by_category', {
                    'category_name': category,
                    'result_limit': limit
                }).execute()
            except:
                # Fallback to full fetch and filter (less efficient)
                response = query.execute()
                if response.data:
                    response.data = [
                        club for club in response.data
                        if any(cat.get("name") == category for cat in club.get("categories", []))
                    ][:limit]
        else:
            response = query.execute()
        
        clubs = response.data if response.data else []
        
        # Process manifest data
        manifest = []
        for club in clubs:
            manifest_item = {
                "id": club["id"],
                "name": club["name"],
                "instagram_handle": club["instagram_handle"],
            }
            
            # Add profile pic if requested
            if "profile_image_path" in select_fields:
                image_path = club.get("profile_image_path")
                manifest_item["profile_pic"] = f"{cdn_prefix}/{image_path.lstrip('/')}" if image_path else ""
            
            # Add categories if requested
            if "categories" in select_fields:
                manifest_item["categories"] = [cat["name"] for cat in club.get("categories", [])]
            
            manifest.append(manifest_item)
        
        # Cache the result
        self._set_cache(cache_key, manifest, 600)  # Cache for 10 minutes
        
        return manifest

    def get_posts_by_club_id(self, club_id: str, limit: int = 10, offset: int = 0) -> List[Dict]:
        """Optimized posts fetching with selective fields"""
        try:
            # Only fetch essential fields
            response = self.supabase.table("posts")\
                .select("id, post_url, caption, image_path, posted")\
                .eq("club_id", club_id)\
                .order("posted", desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()

            return response.data or []
        except Exception as e:
            logger.error(f"Error in get_posts_by_club_id: {e}")
            return []

    # Override the original get_all_clubs to use caching
    def get_all_clubs(self) -> List[Dict]:
        """Cached version of get_all_clubs - use only when necessary"""
        cache_key = "all_clubs"
        cached_result = self._get_from_cache(cache_key)
        if cached_result:
            return cached_result
        
        logger.warning("get_all_clubs called - consider using pagination instead")
        
        cdn_prefix = os.getenv("AZURE_CDN", "")
        response = self.supabase.table("clubs").select("*, categories(name)").execute()
        clubs = response.data if response.data else []

        for club in clubs:
            image_path = club.get("profile_image_path")
            if image_path:
                club["profile_image_path"] = f"{cdn_prefix}/{image_path.lstrip('/')}"

        # Cache for a shorter time since this is expensive
        self._set_cache(cache_key, clubs, 180)  # 3 minutes
        return clubs
              
    
    
