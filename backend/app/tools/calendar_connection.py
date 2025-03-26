from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import datetime
import os
from ics import Calendar, Event
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.logger import logger
from tools.data_retriever import DataRetriever

3
class CalendarConnection:
    def __init__(self):
        
        self.retriever = DataRetriever()
        
    def create_calendar_file(self, username):
            # Define the path to the .ics file
   
            ics_path = os.path.join(self.retriever.get_user_dir(), username, "calendar_file.ics")
            
            calendar = Calendar()
            # Load the calendar file if it exists
            

            # Fetch post information
            try:
                posts = self.retriever.fetch_club_posts(username)
            except FileNotFoundError:
                logger.error('club does not exist unable to create calendar file')
                return

            # Add events to the calendar
            for post in posts:
                try:
                    for event in post['Parsed']:
                        try:
                            new_event = Event()
                            new_event.name = event['Name']
                            new_event.begin = event['Date']  # Ensure this is in ISO 8601 or datetime format
                            duration = event['Duration']['estimated duration']
                            description = event['Details']
                            
                            # Add duration if provided
                            if 'days' in duration or 'hours' in duration:
                                days = duration.get('days', 0)
                                hours = duration.get('hours', 0)
                                total_seconds = (days * 86400) + (hours * 3600)
                                new_event.duration = datetime.timedelta(seconds=total_seconds)
                                
                            new_event.description = description
                            
                            # Check for duplicates and add the event
                            if not self.is_duplicate(new_event, calendar):
                                calendar.events.add(new_event)
                        except Exception as e:
                            logger.error(f"Error while adding event: {e} for {username}")
                except KeyError:
                    continue
                    

            # Save the updated calendar to the .ics file
            with open(ics_path, 'w') as f:
                f.writelines(calendar)

            logger.info(f"Calendar file successfully created/updated for {username}")
        
 
    
    def check_for_presence_of_file(self, ics_path):
        return os.path.exists(ics_path)
    
    def get_ics_path(self, username):
        return os.path.join(self.retriever.get_user_dir(), username, "calendar_file.ics")
    

    def is_duplicate(self, new_event, calendar):
        """
        Check if the event already exists in the calendar.

        Args:
            new_event (Event): The event to check.

        Returns:
            bool: True if a duplicate exists, False otherwise.
        """
        for event in calendar.events:
            if (event.name == new_event.name and event.begin == new_event.begin):
                return True
        return False


if __name__ == "__main__":
    calendar = CalendarConnection()
    calendar.create_calendar_file("icssc.uci")
    
    