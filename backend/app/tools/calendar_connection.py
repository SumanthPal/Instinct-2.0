import os
import sys
import uuid
from datetime import datetime, timedelta
import pytz
from typing import Optional, List, Dict
from ics import Calendar, Event

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from db.queries import SupabaseQueries
from tools.logger import logger
import re

def parse_duration_string(duration_str: str) -> timedelta:
    """
    Parses Supabase/Postgres INTERVAL string into timedelta.
    Supports formats like '2 days 04:30:00', '04:30:00', etc.
    """
    if not duration_str:
        return timedelta(hours=1)  # Default duration
    
    duration_str = duration_str.strip().lower()
    
    # Case: "2 days 04:30:00"
    if 'day' in duration_str:
        day_match = re.search(r'(\d+)\s*day', duration_str)
        time_match = re.search(r'(\d+):(\d+):(\d+)', duration_str)
        days = int(day_match.group(1)) if day_match else 0
        if time_match:
            hours, minutes, seconds = map(int, time_match.groups())
        else:
            hours = minutes = seconds = 0
        return timedelta(days=days, hours=hours, minutes=minutes, seconds=seconds)
    
    # Case: "04:30:00"
    time_match = re.search(r'(\d+):(\d+):(\d+)', duration_str)
    if time_match:
        hours, minutes, seconds = map(int, time_match.groups())
        return timedelta(hours=hours, minutes=minutes, seconds=seconds)

    # Fallback if somehow it's just "45m" etc.
    h_match = re.search(r'(\d+)h', duration_str)
    m_match = re.search(r'(\d+)m', duration_str)

    hours = int(h_match.group(1)) if h_match else 0
    minutes = int(m_match.group(1)) if m_match else 0

    return timedelta(hours=hours, minutes=minutes)


class CalendarConnection:
    def __init__(self):
        """Initialize the CalendarConnection with Supabase client"""
        self.supabase = SupabaseQueries()
        # Default timezone if none is specified for the club
        self.default_timezone = pytz.timezone('America/Los_Angeles')
        logger.info("Initialized CalendarConnection.")
    
    def _get_club_timezone(self, club_data: Dict) -> pytz.timezone:
        """
        Get the timezone for a club.
        
        Args:
            club_data: Club data dictionary
            
        Returns:
            pytz.timezone: The club's timezone, or default if not specified
        """
        tz_name = club_data.get('timezone', 'America/Los_Angeles')
        try:
            return pytz.timezone(tz_name)
        except pytz.exceptions.UnknownTimeZoneError:
            logger.warning(f"Unknown timezone {tz_name}, using default")
            return self.default_timezone

    def create_calendar_file(self, username: str) -> Optional[str]:
        """
        Create or update a calendar file for a club based on its username.
        Properly handles timezones for consistent event times.
        """
        logger.info(f"Starting calendar creation for club: {username}")
        
        # Get club details 
        club_data = self.supabase.get_club_by_instagram(username)
        
        if not club_data:
            logger.error(f"Club with username '{username}' does not exist. Cannot create calendar file.")
            return None
        
        club_id = club_data.get('id')
        if not club_id:
            logger.error(f"Invalid club data returned for {username}")
            return None
            
        # Get club's timezone
        club_timezone = self._get_club_timezone(club_data)
        logger.info(f"Using timezone {club_timezone} for club {username}")
        
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
                event_name = db_event.get('name', 'Unnamed Event')
                logger.info(f"Adding event: {event_name}")
                
                new_event = Event()
                new_event.name = event_name
                
                # Convert string date to datetime with proper timezone
                event_date = db_event.get("date")
                if not event_date:
                    logger.warning(f"Event {event_name} has no date, skipping")
                    continue
                    
                # Handle date string conversion
                if isinstance(event_date, str):
                    try:
                        # Try to parse with timezone info
                        if 'Z' in event_date:
                            # UTC date
                            utc_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
                            # Convert to club's timezone
                            event_date = utc_date.astimezone(club_timezone)
                        elif '+' in event_date or '-' in event_date and 'T' in event_date:
                            # Already has timezone info
                            event_date = datetime.fromisoformat(event_date)
                        else:
                            # No timezone info, assume club's timezone
                            naive_date = datetime.fromisoformat(event_date)
                            event_date = club_timezone.localize(naive_date)
                    except ValueError:
                        # Fallback for other date formats
                        logger.warning(f"Could not parse date {event_date} for event {event_name}, using current date")
                        event_date = club_timezone.localize(datetime.now())
                
                # Ensure event date has timezone info
                if event_date.tzinfo is None:
                    event_date = club_timezone.localize(event_date)
                
                new_event.begin = event_date
                
                # Handle duration with better error handling
                if db_event.get("duration"):
                    try:
                        duration = parse_duration_string(db_event["duration"])
                        new_event.duration = duration
                        logger.info(f"Set duration for event '{event_name}' to {duration} from '{db_event['duration']}'")
                    except Exception as e:
                        logger.warning(f"Could not parse duration '{db_event['duration']}' for event '{event_name}': {e}")
                        # Default fallback if parsing fails
                        new_event.duration = timedelta(hours=1)
                        logger.info(f"Defaulted to 1 hour duration for '{event_name}'")
                else:
                    # No duration provided at all → safe fallback
                    new_event.duration = timedelta(hours=1)
                    logger.info(f"No duration provided for '{event_name}', defaulted to 1 hour")

                # Add additional details
                if db_event.get("details"):
                    new_event.description = db_event["details"]
                
                # Add location if available
                if db_event.get("location"):
                    new_event.location = db_event["location"]
                    
                # Add URL if available
                if db_event.get("url"):
                    new_event.url = db_event["url"]
                
                # Generate UID for the event if not already set
                new_event.uid = db_event.get("uid") or str(uuid.uuid4())
                
                calendar.events.add(new_event)
                logger.info(f"Successfully added event '{event_name}'")
                
            except Exception as e:
                logger.error(f"Error while adding event {db_event.get('id', 'unknown id')}: {e}")
                continue

        # Save the full calendar
        try:
            ics_content = str(calendar)
            calendar_id = self.supabase.save_calendar_file(club_id, ics_content)
            logger.info(f"Calendar file successfully created/updated for '{username}' with {len(calendar.events)} events")
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



    conn = CalendarConnection()
    result = conn.create_calendar_file("icssc.uci")

    if result:
        print(f"✅ Successfully created calendar for icssc.uci")
    else:
        print(f"❌ Failed to create calendar for icssc.uci")
