import os
import sys
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from ics import Calendar, Event

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from db.queries import SupabaseQueries
from tools.logger import logger
import re

def parse_duration_string(duration_str: str) -> timedelta:
    """
    Parses a flexible duration string into a timedelta object.
    
    Supports formats like:
    - "2 days 4:30"
    - "1 day"
    - "4:30"
    - "2d 4h 30m"
    - "3h 15m"
    - "45m"
    """
    duration_str = duration_str.strip().lower()

    # Default values
    days = hours = minutes = 0

    # Case 1: Explicit "day" keyword
    if "day" in duration_str:
        day_match = re.search(r'(\d+)\s*day', duration_str)
        if day_match:
            days = int(day_match.group(1))
        else:
            # If no number before "day", assume 1 day
            days = 1

        # After "day", parse time if available (e.g., "2 days 4:30")
        time_part = re.findall(r'(\d+:\d+)', duration_str)
        if time_part:
            hours, minutes = map(int, time_part[0].split(":"))

    # Case 2: Formats like "2d 4h 30m"
    else:
        d_match = re.search(r'(\d+)d', duration_str)
        h_match = re.search(r'(\d+)h', duration_str)
        m_match = re.search(r'(\d+)m', duration_str)

        if d_match:
            days = int(d_match.group(1))
        if h_match:
            hours = int(h_match.group(1))
        if m_match:
            minutes = int(m_match.group(1))

        # Case 3: Simple "4:30" format
        if ':' in duration_str and not (d_match or h_match or m_match):
            hours, minutes = map(int, duration_str.split(":")[:2])

    return timedelta(days=days, hours=hours, minutes=minutes)

class CalendarConnection:
    def __init__(self):
        """Initialize the CalendarConnection with Supabase client"""
        self.supabase = SupabaseQueries()
        logger.info("Initialized CalendarConnection.")

    def create_calendar_file(self, username: str) -> Optional[str]:
        """
        Create or update a calendar file for a club based on its username.
        """
        logger.info(f"Starting calendar creation for club: {username}")
        
        club_id = self.supabase.get_club_by_instagram_handle(username)
        
        if not club_id:
            logger.error(f"Club with username '{username}' does not exist. Cannot create calendar file.")
            return None
        
        calendar = Calendar()
        
        try:
            events = self.supabase.get_events_for_club(club_id)
            logger.info(f"Fetched {len(events)} events for club '{username}'.")
        except Exception as e:
            logger.error(f"Error fetching events for {username}: {e}")
            return None
        
        if not events:
            logger.warning(f"No events found for club '{username}'. Creating empty calendar.")
            return self.supabase.save_calendar_file(club_id, str(calendar))
        
        # Process each event
        for db_event in events:
            try:
                logger.info(f"Adding event: {db_event.get('name', 'Unnamed Event')}")
                
                new_event = Event()
                new_event.name = db_event["name"]
                
                # Convert string date to datetime
                event_date = db_event["date"]
                if isinstance(event_date, str):
                    event_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
                
                new_event.begin = event_date
                
                # Handle duration
                # --- inside your for db_event in events loop ---
                if db_event.get("duration"):
                    try:
                        new_event.duration = parse_duration_string(db_event["duration"])
                        logger.info(f"Set duration for event '{new_event.name}' from '{db_event['duration']}'.")
                    except Exception as e:
                        logger.warning(f"Could not parse duration '{db_event['duration']}' for event '{new_event['name']}': {e}")
                        # Default fallback if parsing fails
                        new_event.duration = timedelta(hours=1)
                        logger.info(f"Defaulted to 1 hour duration for '{new_event.name}'.")
                else:
                    # No duration provided at all → safe fallback
                    new_event.duration = timedelta(hours=1)
                    logger.info(f"No duration provided for '{new_event.name}', defaulted to 1 hour.")



                # Add optional details
                if db_event.get("details"):
                    new_event.description = db_event["details"]
                
                calendar.events.add(new_event)
                logger.info(f"Successfully added event '{new_event.name}'.")
                
            except Exception as e:
                logger.error(f"Error while adding event {db_event.get('id', 'unknown id')}: {e}")

        # Save the full calendar
        try:
            ics_content = str(calendar)
            calendar_id = self.supabase.save_calendar_file(club_id, ics_content)
            logger.info(f"Calendar file successfully created/updated for '{username}' with {len(calendar.events)} events.")
            return calendar_id
        except Exception as e:
            logger.error(f"Error saving calendar for {username}: {e}")
            return None

    def get_calendar_for_club(self, club_id: str) -> Optional[Calendar]:
        """
        Get the calendar object for a club
        """
        logger.info(f"Fetching calendar for club ID: {club_id}")
        
        try:
            ics_content = self.supabase.get_calendar_file(club_id)
            if ics_content:
                calendar = Calendar(ics_content)
                logger.info(f"Successfully parsed calendar for club ID: {club_id}")
                return calendar
            else:
                logger.warning(f"No calendar file found for club ID: {club_id}")
                return None
        except Exception as e:
            logger.error(f"Error parsing calendar file for club {club_id}: {e}")
            return None

if __name__ == "__main__":
    calendar_conn = CalendarConnection()
    calendar_conn.create_calendar_file("uciavahita")
