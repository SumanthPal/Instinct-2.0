import os
import sys
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from ics import Calendar, Event

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from db.queries import SupabaseQueries
from tools.logger import logger

class CalendarConnection:
    def __init__(self):
        """Initialize the CalendarConnection with Supabase client"""
        self.supabase = SupabaseQueries()
        
    
    def create_calendar_file(self, username: str) -> Optional[str]:
        """
        Create or update a calendar file for a club based on its username
        
        Args:
            username (str): Instagram handle of the club
            
        Returns:
            Optional[str]: The UUID of the calendar file, or None if the club doesn't exist
        """
        # Get the club ID from the username
        club_id = self.supabase.get_club_by_instagram_handle(username)
        
        if not club_id:
            logger.error(f'Club with username {username} does not exist, unable to create calendar file')
            return None
        
        # Create new calendar
        calendar = Calendar()
        
        # Fetch events from the events table
        events = self.supabase.get_events_for_club(club_id)
        
        if not events:
            logger.warning(f'No events found for club {username}')
            # Save empty calendar anyway
            return self.supabase.save_calendar_file(club_id, str(calendar))
        
        # Add events to the calendar
        for db_event in events:
            try:
                logger.info(f'adding event: {db_event}')
                new_event = Event()
                new_event.name = db_event["name"]
                
                # Convert the date to a datetime object if it's a string
                if isinstance(db_event["date"], str):
                    new_event.begin = datetime.fromisoformat(db_event["date"].replace('Z', '+00:00'))
                else:
                    new_event.begin = db_event["date"]
                
                # Add duration if provided
                if db_event["duration"]:
                    if "day" in db_event["duration"] or "days" in db_event["duration"]:
                        parts = db_event["duration"].split(" ")
                        days = parts[0]
                        time = parts[1] if len(parts) > 1 else "00:00:00"
                    else:
                        days = "0"
                        time = db_event["duration"]
                        
                timing = time.split(':')
                logger.info(f'time: {days} days {timing[0]} hrs {timing[1]} minutes')
                new_event.duration = timedelta(days=int(days), hours=int(timing[0]), minutes=int(timing[1]))

               
                # Add details if available
                if db_event["details"]:
                    new_event.description = db_event["details"]
                
                # Add the event to the calendar
                calendar.events.add(new_event)
                logger.info(f'succesfully added event {new_event.name}')
                
            except Exception as e:
                logger.error(f"Error while adding event {db_event['id']}: {e}")
        
        # Convert calendar to string
        ics_content = str(calendar)
        
        # Save to database
        calendar_id = self.supabase.save_calendar_file(club_id, ics_content)
        
        logger.info(f"Calendar file successfully created/updated for {username} with {len(calendar.events)} events")
        return calendar_id

    
    
    def get_calendar_for_club(self, club_id: str) -> Optional[Calendar]:
        """
        Get the calendar object for a club
        
        Args:
            club_id (str): The UUID of the club
            
        Returns:
            Optional[Calendar]: The Calendar object if found, None otherwise
        """
        ics_content = self.supabase.get_calendar_file(club_id)
        if ics_content:
            try:
                return Calendar(ics_content)
            except Exception as e:
                logger.error(f"Error parsing calendar for club {club_id}: {e}")
        return None
    
    
if __name__ == "__main__":
    calendar_conn = CalendarConnection()
    # Example: create calendar for a specific club by username
    calendar_conn.create_calendar_file("uciavahita")
    