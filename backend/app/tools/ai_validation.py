import ast
import os
import dotenv
from openai import OpenAI
import json
from typing import List, Dict, Optional
import time
import sys
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.logger import logger
from db.queries import SupabaseQueries
from difflib import SequenceMatcher
from datetime import datetime, timedelta


class EventParser:
    def __init__(self):
        # Load environment variables (for OpenAI API key)
        dotenv.load_dotenv()
        self.client = OpenAI(api_key=os.getenv('OPENAI'))
        print("API Key Loaded:", os.getenv('OPENAI'))

        self.db = SupabaseQueries()
        
        # Configure similarity thresholds
        self.name_similarity_threshold = 0.6  # Lower than original 0.7
        self.time_window_hours = 24  # Hours to consider for time proximity

    def validate_username(self, username: str) -> bool:
        """
        Validates if the username exists in the database.
        """
        # Check if the club exists in the database using SupabaseQueries
        club = self.db.get_club_by_instagram(username)
        if not club:
            raise ValueError(f"Club with Instagram handle '{username}' not found in the database.")
        
        return True

    def parse_post(self, post_id: "uuid") -> List[Dict]:
        """
        Parses a post to extract event data using OpenAI's GPT-4 API.

        Args:
            post_id (uuid): ID of the post to parse.

        Returns:
            List[Dict]: Parsed events or an empty list if parsing fails.
        """
        MAX_RETRIES = 3  # Define the number of retries
        RETRY_DELAY = 2  # Delay (in seconds) between retries

        # Load the post data
        try:
            post_date, post_text = self.db.get_post_date_and_caption(post_id)

            # Retry mechanism for API calls
            for attempt in range(MAX_RETRIES):
                try:
                    logger.info(f"Parsing attempt {attempt + 1}...")

                    # Send request to OpenAI API to extract dates
                    completion = self.client.chat.completions.create(
                        model="gpt-4.1-mini-2025-04-14",  # Ensure the model name is correct
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                "You must strictly follow these rules when responding:\n"
                                "1. Respond with **valid, raw JSON only**. Do not include any text, comments, markdown, or extra formatting outside the JSON.\n"
                                "2. The response must be a JSON array.\n"
                                "3. If the input is not a valid club event (meaning the club does not have anything) or cannot be parsed, return an empty array: [].\n"
                                "4. Each item in the array must be a dictionary with **exactly** the following keys:\n"
                                "   - \"Name\": string (name of the event)\n"
                                "   - \"Date\": string in ISO 8601 format (e.g., \"2025-04-14T18:00:00\")\n"
                                "   - \"Details\": string (optional event information)\n"
                                "   - \"Duration\": object with \"days\", \"hours\", and \"minutes\" keys\n"
                                "5. If the event spans multiple dates, create one entry\n"
                                "6. Do not include any additional metadata, explanations, or keys not listed above.\n"
                                "7. Use the context date and the content to find the context date for the event."
                                )
                            },
                            {
                                "role": "user",
                                "content": f"{post_text} context date: {post_date}"
                            }
                        ],
                        temperature=0.3
                    )

                    # Process and validate the response
                    response = completion.choices[0].message.content
                    events = json.loads(response)  # Attempt to parse the JSON

                    # Check if the response format is valid
                    if isinstance(events, list) and all(isinstance(event, dict) for event in events):
                        logger.info("Successful parse.")
                        return events

                    raise ValueError("Invalid API response format")

                except json.JSONDecodeError as e:
                    logger.error(response)
                    logger.error(f"JSON decoding error: {e}")
                except Exception as e:
                    logger.error(f"Error during API call: {e}")

                if attempt < MAX_RETRIES - 1:
                    logger.warning(f"Retrying in {RETRY_DELAY} seconds...")
                    time.sleep(RETRY_DELAY)

            # If retries fail, log and return an empty list
            logger.error("Failed to parse post after multiple attempts.")
            return []

        except (FileNotFoundError, KeyError) as e:
            logger.error(f"Error loading post data: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return []
    
    def get_embedding(self, text: str) -> List[float]:
        """
        Get embeddings for text using OpenAI's embeddings API.
        This enables semantic similarity matching.
        """
        try:
            response = self.client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error getting embedding: {e}")
            return None

    def cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """
        Calculate cosine similarity between two vectors.
        """
        if not a or not b:
            return 0.0
            
        dot_product = sum(x * y for x, y in zip(a, b))
        magnitude_a = sum(x * x for x in a) ** 0.5
        magnitude_b = sum(x * x for x in b) ** 0.5
        
        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0
            
        return dot_product / (magnitude_a * magnitude_b)

    def parse_date(self, date_str: str) -> Optional[datetime]:
        """
        Try multiple date formats to parse a date string.
        """
        formats = [
            "%Y-%m-%dT%H:%M:%S",  # ISO format with T
            "%Y-%m-%d %H:%M:%S",  # Standard format with space
            "%Y-%m-%d",           # Just date
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
                
        # If we get here, try ISO format with potential timezone info
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except ValueError:
            logger.error(f"Failed to parse date: {date_str}")
            return None

    def find_similar_event(self, name: str, date_str: str, club_id: str) -> Optional[Dict]:
        """
        Find similar events using multiple methods:
        1. String similarity for event names
        2. Date/time proximity
        3. Semantic similarity using embeddings (if available)
        
        Args:
            name (str): Event name to match
            date_str (str): Event date string
            club_id (str): Club ID to filter events
            
        Returns:
            dict or None: Most similar existing event data if found, None otherwise
        """
        # Parse the input date
        event_date = self.parse_date(date_str)
        if not event_date:
            return None
            
        # Calculate date range for filtering
        date_start = event_date - timedelta(hours=self.time_window_hours/2)
        date_end = event_date + timedelta(hours=self.time_window_hours/2)
        
        # Format dates for database query
        date_start_str = date_start.isoformat()
        date_end_str = date_end.isoformat()
        
        # Get events for this club within the date range
        try:
            response = (
                self.db.supabase
                .table("events")
                .select("id, name, date, details")
                .eq("club_id", club_id)
                .gte("date", date_start_str)
                .lte("date", date_end_str)
                .execute()
            )
            
            events = response.data
            if not events:
                logger.info(f"No events found for club {club_id} in date range")
                return None
                
            logger.info(f"Found {len(events)} potential matches within time window")
        except Exception as e:
            logger.error(f"Error querying events: {e}")
            return None
        
        # Get embedding for our target event name
        try:
            target_embedding = self.get_embedding(name)
        except:
            target_embedding = None
            logger.warning("Could not get embedding for semantic matching")
        
        # Track best matches
        best_match = None
        best_score = 0.0
        
        for event in events:
            event_name = event.get("name", "")
            
            # Calculate string similarity score (0-1)
            string_sim = SequenceMatcher(None, name.lower(), event_name.lower()).ratio()
            
            # Calculate time proximity score (0-1)
            event_datetime = self.parse_date(event.get("date", ""))
            if event_datetime:
                time_diff = abs((event_datetime - event_date).total_seconds() / 3600)  # hours
                time_sim = max(0, 1 - (time_diff / self.time_window_hours))  # Scale to 0-1
            else:
                time_sim = 0.0
            
            # Calculate semantic similarity if embeddings available (0-1)
            semantic_sim = 0.0
            if target_embedding:
                try:
                    event_embedding = self.get_embedding(event_name)
                    if event_embedding:
                        semantic_sim = self.cosine_similarity(target_embedding, event_embedding)
                except:
                    semantic_sim = 0.0
            
            # Compute combined score:
            # 50% string similarity, 30% semantic similarity, 20% time proximity
            combined_score = (0.5 * string_sim) + (0.3 * semantic_sim) + (0.2 * time_sim)
            
            logger.info(f"Event '{event_name}': string_sim={string_sim:.2f}, semantic_sim={semantic_sim:.2f}, time_sim={time_sim:.2f}, combined={combined_score:.2f}")
            
            if combined_score > best_score:
                best_score = combined_score
                best_match = event
        
        # Apply threshold to combined score
        if best_score >= self.name_similarity_threshold:
            logger.info(f"Found similar event: '{best_match['name']}' with score {best_score:.2f}")
            return best_match
        else:
            logger.info(f"No similar event found. Best score was {best_score:.2f}")
            return None

    def parse_all_posts(self, username):
        try:
            logger.info('fetching posts to parse...')
            posts_to_parse = self.db.posts_to_parse(username)
            logger.info(f'successfully fetched {len(posts_to_parse)} posts to parse!')
            
            for post_id in posts_to_parse:
                # Make sure post_id is a string, not a dict
                if isinstance(post_id, dict) and 'id' in post_id:
                    post_id = post_id['id']
                    
                logger.info(f'parsing post ID: {post_id}...')
                
                if self.db.check_if_post_is_parsed(post_id):
                    logger.info(f'post {post_id} already parsed, skipping...')
                    continue
                    
                parsed_info = self.parse_post(post_id)
                logger.info('successfully parsed and storing...')
                
                club_id = self.db.get_club_by_instagram_handle(username)
                self.store_parsed_info(parsed_info, post_id, club_id)
                logger.info('successfully stored.')
        except Exception as e:
            logger.error(f"Unexpected Error: {e}")
            logger.error(f"Error type: {type(e)}")
            import traceback
            logger.error(traceback.format_exc())

    def store_parsed_info(self, parsed_info, post_id, club_id):
        """
        Store parsed information from a post, avoiding duplicate events using enhanced matching.
        """
        if not parsed_info:
            # Mark post as parsed even if no events were extracted
            self.db.update_post_by_id(post_id, {"parsed": True})
            logger.info(f"No events found in post {post_id}, marking as parsed")
            return
            
        for event in parsed_info:
            existing_event = self.find_similar_event(event["Name"], event["Date"], club_id)
            
            if existing_event:
                # Event already exists, just update the post as parsed
                self.db.update_post_by_id(post_id, {"parsed": True})
                logger.info(f"Similar event '{existing_event['name']}' found, linking post to it.")
                
                # Optionally, you could update the existing event with any new information
                # if you want to merge the data
            else:
                # Create a new event
                duration = event.get("Duration", {})
                
                # Make sure Duration has the right structure
                if isinstance(duration, dict) and "estimated duration" in duration:
                    duration = duration["estimated duration"]
                
                # Ensure we have all the duration components
                duration_dict = {
                    "days": duration.get("days", 0),
                    "hours": duration.get("hours", 0),
                    "minutes": duration.get("minutes", 0)
                }
                
                event_data = {
                    "club_id": club_id,
                    "post_id": post_id,
                    "name": event["Name"],
                    "date": event["Date"],
                    "details": event.get("Details", ""),
                    "duration": self.dict_to_interval(duration_dict),
                    "parsed": event
                }
                
                # Insert the event
                new_event = self.db.insert_event(event_data)
                
                # Update the post as parsed
                self.db.update_post_by_id(post_id, {"parsed": True})
                
                logger.info(f"Inserted new event: {event['Name']}")

    def safe_int(self, value, default=0):
        """Convert value safely to integer, handling numeric strings and simple words like 'one'."""
        word_to_number = {
            "zero": 0,
            "one": 1,
            "two": 2,
            "three": 3,
            "four": 4,
            "five": 5,
            "six": 6,
            "seven": 7,
            "eight": 8,
            "nine": 9,
            "ten": 10
        }

        try:
            return int(value)
        except (ValueError, TypeError):
            if isinstance(value, str):
                value_clean = value.strip().lower()
                if value_clean in word_to_number:
                    return word_to_number[value_clean]
            return default


    def dict_to_interval(self, duration_dict: dict) -> str:
        """Convert duration dictionary to a PostgreSQL interval string safely."""
        days = self.safe_int(duration_dict.get('days', 0))
        hours = self.safe_int(duration_dict.get('hours', 0))
        minutes = self.safe_int(duration_dict.get('minutes', 0))

        parts = []
        if days:
            parts.append(f"{days} days")
        if hours:
            parts.append(f"{hours} hours")
        if minutes:
            parts.append(f"{minutes} minutes")

        return ' '.join(parts) or '0 minutes'



if __name__ == "__main__":
    # Example usage
    parser = EventParser()
    parser.parse_all_posts("_openjam_")