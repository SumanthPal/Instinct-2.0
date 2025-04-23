import json
import os
from db.supabase_client import supabase
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.logger import logger


def process_clubs_data(clubs_data):
    """Process JSON data of clubs and insert into database"""
    logger.info(f"Processing {len(clubs_data)} clubs")
    
    # Step 1: Extract and insert unique categories
    all_categories = set()
    for club in clubs_data:
        if "categories" in club and isinstance(club["categories"], list):
            for category in club["categories"]:
                all_categories.add(category)
    
    logger.info(f"Found {len(all_categories)} unique categories")
    
    # Insert categories and get their IDs
    category_mapping = {}
    for category_name in all_categories:
        try:
            # Check if category exists
            result = supabase.table("categories").select("id").eq("name", category_name).execute()
            
            if result.data:
                # Category exists
                category_id = result.data[0]["id"]
                logger.info(f"Found existing category: {category_name}")
            else:
                # Insert new category
                result = supabase.table("categories").insert({"name": category_name}).execute()
                category_id = result.data[0]["id"]
                logger.info(f"Created new category: {category_name}")
            
            category_mapping[category_name] = category_id
        except Exception as e:
            logger.error(f"Error processing category {category_name}: {str(e)}")
    
    # Step 2: Insert clubs and create category relationships
    successful_clubs = 0
    skipped_clubs = 0
    for club in clubs_data:
        try:
            # Prepare club data
            club_data = {
                "name": club.get("name", ""),
                "instagram_handle": club.get("instagram", ""),
                "description": club.get("genre", ""),  # Using genre as description for now
                # Other fields can be set to default values
            }
            
            # Check if club with this Instagram handle already exists
            existing = supabase.table("clubs").select("id").eq("instagram_handle", club_data["instagram_handle"]).execute()
            
            if existing.data:
                # Club with this Instagram handle already exists, skip insertion
                club_id = existing.data[0]["id"]
                logger.info(f"Club with Instagram handle '{club_data['instagram_handle']}' already exists, skipping insertion")
                skipped_clubs += 1
                
                # Optional: Update categories for existing club
                if "categories" in club and isinstance(club["categories"], list):
                    for category_name in club["categories"]:
                        if category_name in category_mapping:
                            try:
                                # Check if relationship already exists
                                relation_check = supabase.table("clubs_categories").select("*").eq("club_id", club_id).eq("category_id", category_mapping[category_name]).execute()
                                
                                if not relation_check.data:
                                    # Insert into junction table
                                    supabase.table("clubs_categories").insert({
                                        "club_id": club_id,
                                        "category_id": category_mapping[category_name]
                                    }).execute()
                                    logger.info(f"Added category {category_name} to existing club {club_data['name']}")
                            except Exception as e:
                                logger.error(f"Error creating relationship for existing club {club_data['name']} and {category_name}: {str(e)}")
            else:
                # Insert new club
                try:
                    result = supabase.table("clubs").insert(club_data).execute()
                    club_id = result.data[0]["id"]
                    logger.info(f"Created new club: {club_data['name']}")
                    
                    # Step 3: Create relationships between club and categories
                    if "categories" in club and isinstance(club["categories"], list):
                        for category_name in club["categories"]:
                            if category_name in category_mapping:
                                try:
                                    # Insert into junction table
                                    supabase.table("clubs_categories").insert({
                                        "club_id": club_id,
                                        "category_id": category_mapping[category_name]
                                    }).execute()
                                    logger.info(f"Added category {category_name} to new club {club_data['name']}")
                                except Exception as e:
                                    logger.error(f"Error creating relationship for new club {club_data['name']} and {category_name}: {str(e)}")
                    
                    successful_clubs += 1
                except Exception as e:
                    if "23505" in str(e) and "clubs_instagram_handle_key" in str(e):
                        # This is a duplicate key error for instagram_handle
                        logger.warning(f"Club with Instagram handle '{club_data['instagram_handle']}' already exists (caught in exception), skipping")
                        skipped_clubs += 1
                    else:
                        # Some other error
                        logger.error(f"Error inserting club {club_data['name']}: {str(e)}")
                        
        except Exception as e:
            logger.error(f"Error processing club {club.get('name', 'unknown')}: {str(e)}")
    
    logger.info(f"Successfully processed {successful_clubs} new clubs, skipped {skipped_clubs} existing clubs out of {len(clubs_data)} total")

def main():
    try:
        # Get the absolute path to the file
        script_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(script_dir, 'club_manifest.json')
        logger.info(f"Attempting to load JSON from: {file_path}")
        
        # Try to read the file contents first
        try:
            with open(file_path, 'r') as file:
                file_contents = file.read()
                logger.info(f"File read successfully, size: {len(file_contents)} bytes")
        except Exception as e:
            logger.error(f"Error reading file: {str(e)}")
            return
        
        # Try to parse as a list of JSON objects
        try:
            # First try to parse as a proper JSON array
            clubs_data = json.loads(file_contents)
            logger.info("Successfully parsed JSON")
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse as standard JSON: {str(e)}")
            
            # Try to parse as a series of JSON objects
            try:
                # Clean the data by ensuring each object is separated by commas
                cleaned_content = file_contents.replace('} {', '}, {')
                # Wrap in array brackets if not already
                if not cleaned_content.strip().startswith('['):
                    cleaned_content = '[' + cleaned_content
                if not cleaned_content.strip().endswith(']'):
                    cleaned_content = cleaned_content + ']'
                
                clubs_data = json.loads(cleaned_content)
                logger.info("Successfully parsed JSON after cleaning")
            except json.JSONDecodeError as e2:
                logger.error(f"Failed to parse even after cleaning: {str(e2)}")
                
                # One last attempt: try parsing line by line
                clubs_data = []
                for line in file_contents.strip().split('\n'):
                    line = line.strip()
                    if line.endswith(','):
                        line = line[:-1]
                    try:
                        if line:
                            club = json.loads(line)
                            clubs_data.append(club)
                    except json.JSONDecodeError:
                        continue
                
                if not clubs_data:
                    logger.error("Could not parse any valid JSON from the file")
                    return
                else:
                    logger.info(f"Parsed {len(clubs_data)} clubs line by line")
        
        # Ensure clubs_data is a list
        if not isinstance(clubs_data, list):
            clubs_data = [clubs_data]
        
        logger.info(f"Loaded {len(clubs_data)} clubs from JSON")
        process_clubs_data(clubs_data)
        logger.info("Data import completed!")
        
    except Exception as e:
        logger.error(f"Unexpected error in main function: {str(e)}")

if __name__ == "__main__":
    main()