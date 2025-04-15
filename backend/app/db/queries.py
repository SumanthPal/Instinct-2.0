import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import uuid
from pathlib import Path
import sys


from pathlib import Path
import os
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from db.supabase_client import supabase

from tools.logger import logger

class SupabaseQueries:
    def __init__(self):
        """Initialize the Supabase client"""
        self.supabase = supabase
        
    def execute_sql(self, sql_statement: str) -> Dict[str, Any]:
        """Execute raw SQL statement"""
        response = self.supabase.rpc('exec_sql', {'sql_query': sql_statement})
        return response
    
    def create_table_schema(self, sql_schema: str) -> Dict[str, Any]:
        """Create table schema using raw SQL"""
        return self.execute_sql(sql_schema)
    
    def create_clubs_table(self) -> Dict[str, Any]:
        """Create the clubs table"""
        sql = """
        CREATE TABLE IF NOT EXISTS clubs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          instagram_handle TEXT UNIQUE NOT NULL,
          profile_pic TEXT,
          description TEXT,
          created_at TIMESTAMP DEFAULT now(),
          updated_at TIMESTAMP DEFAULT now()
        );
        """
        return self.execute_sql(sql)
    
    def create_categories_table(self) -> Dict[str, Any]:
        """Create the categories table"""
        sql = """
        CREATE TABLE IF NOT EXISTS categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT UNIQUE NOT NULL
        );
        """
        return self.execute_sql(sql)
    
    def create_clubs_categories_table(self) -> Dict[str, Any]:
        """Create the clubs_categories junction table"""
        sql = """
        CREATE TABLE IF NOT EXISTS clubs_categories (
          club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
          category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
          PRIMARY KEY (club_id, category_id)
        );
        """
        return self.execute_sql(sql)
    
    def create_posts_table(self) -> Dict[str, Any]:
        """Create the posts table"""
        sql = """
        CREATE TABLE IF NOT EXISTS posts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
          caption TEXT,
          image_url TEXT,
          created_at TIMESTAMP DEFAULT now(),
          posted TIMESTAMP NOT NULL
        );
        """
        return self.execute_sql(sql)
    
    def create_events_table(self) -> Dict[str, Any]:
        """Create the events table"""
        sql = """
        CREATE TABLE IF NOT EXISTS events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
          post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          date TIMESTAMP NOT NULL,
          details TEXT,
          duration INTERVAL,
          parsed JSONB,
          created_at TIMESTAMP DEFAULT now()
        );
        """
        return self.execute_sql(sql)
    
    def create_all_tables(self) -> Dict[str, List[Dict[str, Any]]]:
        """Create all tables in the correct order for dependencies"""
        results = {
            "successful": [],
            "failed": []
        }
        
        # Define tables in order of dependencies
        tables = [
            {"name": "clubs", "method": self.create_clubs_table},
            {"name": "categories", "method": self.create_categories_table},
            {"name": "clubs_categories", "method": self.create_clubs_categories_table},
            {"name": "posts", "method": self.create_posts_table},
            {"name": "events", "method": self.create_events_table}
        ]
        
        # Create each table
        for table in tables:
            try:
                table["method"]()
                results["successful"].append({"table": table["name"]})
            except Exception as e:
                results["failed"].append({"table": table["name"], "error": str(e)})
        
        return results
    
    def create_index(self, table: str, column: str, index_name: Optional[str] = None) -> Dict[str, Any]:
        """Create an index on a table column"""
        if not index_name:
            index_name = f"idx_{table}_{column}"
            
        sql = f"""
        CREATE INDEX IF NOT EXISTS {index_name} ON {table} ({column});
        """
        return self.execute_sql(sql)
    
    def create_common_indexes(self) -> Dict[str, List[Dict[str, Any]]]:
        """Create common indexes for performance"""
        results = {
            "successful": [],
            "failed": []
        }
        
        # Define common indexes
        indexes = [
            {"table": "clubs", "column": "instagram_handle"},
            {"table": "posts", "column": "club_id"},
            {"table": "posts", "column": "posted"},
            {"table": "events", "column": "date"},
            {"table": "events", "column": "club_id"}
        ]
        
        # Create each index
        for idx in indexes:
            try:
                self.create_index(idx["table"], idx["column"])
                results["successful"].append({"index": f"{idx['table']}.{idx['column']}"})
            except Exception as e:
                results["failed"].append({"index": f"{idx['table']}.{idx['column']}", "error": str(e)})
        
        return results
    
    def drop_table(self, table_name: str, cascade: bool = False) -> Dict[str, Any]:
        """Drop a table if it exists"""
        cascade_text = "CASCADE" if cascade else ""
        sql = f"""
        DROP TABLE IF EXISTS {table_name} {cascade_text};
        """
        return self.execute_sql(sql)
    
    def add_column(self, table: str, column: str, data_type: str, 
                   constraints: Optional[str] = None) -> Dict[str, Any]:
        """Add a column to an existing table"""
        constraints_text = constraints if constraints else ""
        sql = f"""
        ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {data_type} {constraints_text};
        """
        return self.execute_sql(sql)
    
    def create_view(self, view_name: str, sql_query: str) -> Dict[str, Any]:
        """Create a view for common queries"""
        sql = f"""
        CREATE OR REPLACE VIEW {view_name} AS 
        {sql_query};
        """
        return self.execute_sql(sql)
    
    def create_upcoming_events_view(self) -> Dict[str, Any]:
        """Create a view for upcoming events with club info"""
        sql = """
        CREATE OR REPLACE VIEW upcoming_events_view AS
        SELECT 
            e.id, 
            e.name, 
            e.date,
            e.details,
            e.duration,
            c.id as club_id,
            c.name as club_name,
            c.instagram_handle,
            c.profile_pic
        FROM events e
        JOIN clubs c ON e.club_id = c.id
        WHERE e.date > now()
        ORDER BY e.date ASC;
        """
        return self.execute_sql(sql)
    
    def create_club_posts_view(self) -> Dict[str, Any]:
        """Create a view for club posts with category info"""
        sql = """
        CREATE OR REPLACE VIEW club_posts_view AS
        SELECT 
            p.id,
            p.instagram_post_id,
            p.caption,
            p.image_url,
            p.posted,
            c.id as club_id,
            c.name as club_name,
            c.instagram_handle,
            c.profile_pic,
            array_agg(cat.name) as categories
        FROM posts p
        JOIN clubs c ON p.club_id = c.id
        LEFT JOIN clubs_categories cc ON c.id = cc.club_id
        LEFT JOIN categories cat ON cc.category_id = cat.id
        GROUP BY p.id, c.id
        ORDER BY p.posted DESC;
        """
        return self.execute_sql(sql)
        
    # ----- Category Methods -----
    
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
        """Fetch all clubs with their categories"""
        response = self.supabase.table("clubs").select("*, categories(name)").execute()
        return response.data if response.data else []
    
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
            "updated_at": datetime.now().isoformat()
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
    
    def get_posts_by_club(self, club_id: str, limit: int = 12) -> List[Dict]:
        """Get posts for a specific club"""
        response = self.supabase.table("posts").select("*").eq("club_id", club_id).order("posted", desc=True).limit(limit).execute()
        return response.data if response.data else []
    
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
    
    def get_upcoming_events(self, limit: int = 10) -> List[Dict]:
        """Get upcoming events"""
        now = datetime.now().isoformat()
        response = self.supabase.table("events").select("*, clubs(name, instagram_handle, profile_pic)").gt("date", now).order("date").limit(limit).execute()
        return response.data if response.data else []
    
    # ----- Import Methods -----
    
    def import_club_data(self, club_instagram: str, club_categories: List[str], club_info_path: str, posts_dir: str) -> Tuple[str, int]:
        """Import a club with its posts from files"""
        try:
            # Load club info
            with open(club_info_path, 'r') as f:
                club_info = json.load(f)
            
            # Upsert club and get club ID
            club_id = self.upsert_club(club_info)
            
            # Assign categories
            self.assign_categories_to_club(club_id, club_categories)
            
            # Import posts
            posts_count = 0
            for post_file in os.listdir(posts_dir):
                if post_file.endswith('.json'):
                    post_path = os.path.join(posts_dir, post_file)
                    with open(post_path, 'r') as f:
                        post_data = json.load(f)
                    
                    # Upsert post
                    post_id = self.upsert_post(club_id, post_data)
                    
                    # Check if post has event data and create/update event
                    if "EventData" in post_data and post_data["EventData"]:
                        event_data = post_data["EventData"]
                        self.upsert_event(club_id, post_id, event_data)
                    
                    posts_count += 1
            
            return club_id, posts_count
        
        except Exception as e:
            logger.error(f"Error importing club data for {club_instagram}: {str(e)}")
            raise
    
    def import_all_clubs_from_manifest(self, manifest_path: str, data_dir: str) -> Dict[str, Any]:
        """Import all clubs from a manifest file"""
        results = {
            "successful": [],
            "failed": []
        }
        
        # Load manifest
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        for club_entry in manifest:
            club_instagram = club_entry.get("instagram")
            if not club_instagram:
                results["failed"].append({"club": club_entry.get("name", "Unknown"), "reason": "Missing Instagram handle"})
                continue
            
            try:
                club_categories = club_entry.get("categories", [])
                club_info_path = os.path.join(data_dir, club_instagram, "club_info.json")
                posts_dir = os.path.join(data_dir, club_instagram, "posts")
                
                if not os.path.exists(club_info_path):
                    results["failed"].append({"club": club_instagram, "reason": "Club info file not found"})
                    continue
                
                if not os.path.exists(posts_dir):
                    results["failed"].append({"club": club_instagram, "reason": "Posts directory not found"})
                    continue
                
                club_id, posts_count = self.import_club_data(club_instagram, club_categories, club_info_path, posts_dir)
                results["successful"].append({
                    "club": club_instagram,
                    "id": club_id,
                    "posts_imported": posts_count
                })
                
            except Exception as e:
                results["failed"].append({"club": club_instagram, "reason": str(e)})
        
        return results
    
    # ----- Delete Methods -----
    
    def delete_club(self, club_id: str) -> bool:
        """Delete a club and all associated data (cascade will handle related tables)"""
        try:
            self.supabase.table("clubs").delete().eq("id", club_id).execute()
            logger.info(f"Deleted club with ID: {club_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting club {club_id}: {str(e)}")
            return False
    
    def delete_club_by_instagram(self, instagram_handle: str) -> bool:
        """Delete a club by Instagram handle"""
        club = self.get_club_by_instagram(instagram_handle)
        if not club:
            logger.warning(f"Club with Instagram handle {instagram_handle} not found")
            return False
        
        return self.delete_club(club["id"])
    
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






# Example usage
if __name__ == "__main__":
    
    
    # Load environment variables from .env file
    load_dotenv()
    
    # Initialize the client
    queries = SupabaseQueries()
    
    # Example: Import all clubs from manifest
    logger.info('creating tables')
    results = queries.create_clubs_table()
    # working_path = Path(__file__).parent.parent.parent  # Adjust to match your project structure
    # manifest_path = os.path.join(working_path, 'club_manifest.json')
    # data_dir = os.path.join(working_path, 'data')
    
    # if os.path.exists(manifest_path) and os.path.exists(data_dir):
    #     results = queries.import_all_clubs_from_manifest(manifest_path, data_dir)
    #     print(f"Successfully imported {len(results['successful'])} clubs")
    #     print(f"Failed to import {len(results['failed'])} clubs")
    # else:
    #     print(f"Manifest file or data directory not found")