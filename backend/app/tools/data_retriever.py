import os
import json
from pathlib import Path
import dotenv
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tools.logger import logger

class DataRetriever:
    def __init__(self):
        dotenv.load_dotenv()
        self.working_path = os.path.join(os.path.dirname(__file__), '..', '..')

    def get_user_dir(self):
        return os.path.join(self.working_path, 'data')
    
    def club_data_exists(self, club_name):
        return os.path.exists(os.path.join(self.working_path, 'data', club_name)) and os.path.exists(os.path.join(self.working_path, 'data', club_name, "posts"))
    
    def fetch_club_info(self, club_name):
        if not self.club_data_exists(club_name):
            raise FileNotFoundError(f"Directory for {club_name} not found")
        
        # Load the club data
        with open(os.path.join(self.working_path, 'data', club_name, 'club_info.json'), 'r') as file:
            club_data = json.load(file)
            logger.info(f'club data for {club_name} successfully fetched.')
        
        return club_data
    
    def validate_club_is_ok(self, club_name: str):
        if not self.club_data_exists(club_name):
            return False
        
        posts_dir = os.path.join(self.get_user_dir(), club_name, 'posts')
        if not os.path.isdir(posts_dir) or not any(os.scandir(posts_dir)):
            return False
        
        if not os.path.exists(os.path.join(self.get_user_dir(), club_name, 'calendar_file.ics')):
            return False
        
        return True
        
    def delete_data_from_manifest(self):
        file_path = os.path.join(self.working_path, 'manifest.json')
        
        if os.path.exists(file_path):
            
            with open(file_path, 'w') as file:
                file.truncate(0)  # Truncate the file to 0 bytes
            logger.info(f"All data in {file_path} has been deleted.")
        else:
            logger.info(f"The file {file_path} does not exist.")
    
    def create_list_of_clubs(self):
        # this is the actual manifest
        club_manifest_path = os.path.join(self.working_path, 'club_manifest.json')
        # joker manifest; used for home page route
        home_path = os.path.join(self.working_path, 'manifest.json')
        
        with open(club_manifest_path, 'r') as file:
            club_data = json.load(file)
        try: 
            self.delete_data_from_manifest()
        except FileNotFoundError:
            logger.info('home file successfully created.')
        
        with open(home_path, 'w') as f:
                json.dump([], f)
                
        
        for idx, club in enumerate(club_data, start=1):
            if self.validate_club_is_ok(club['instagram']):
                curr = self.fetch_club_info(club['instagram'])
                info = {'name': club['name'], 
                        'genre': club['genre'],
                        'instagram': club['instagram'],
                        'categories': club['categories'],
                        'pfp': curr['Profile Picture'],
                        'description': curr['Description']
                        }
                
                with open(home_path, 'r') as f:
                    data = json.load(f)
                
                data.append(info)
                
                with open(home_path, 'w') as file:
                    json.dump(data, file, indent=4) 
                
                
    
    def fetch_club_posts(self, club_name):
        if not self.club_data_exists(club_name):
            raise FileNotFoundError(f"Directory for {club_name} not found")
        
        if not os.listdir(os.path.join(self.working_path, 'data', club_name, "posts")):
            raise FileNotFoundError(f"No posts found for {club_name}")
        
        posts_data = []
        for post in os.listdir(os.path.join(self.working_path, 'data', club_name, "posts")):
            with open(os.path.join(self.working_path, 'data', club_name, "posts", post), 'r') as file:
                post_data = json.load(file)
            
            posts_data.append(post_data)
            
        return posts_data
    
    def check_if_post_exists(self, post_name) -> bool:
        return Path(post_name).exists()
    
    def fetch_manifest(self) -> json:
        with open(os.path.join(self.working_path, 'manifest.json'), 'r') as f:
            club_data = json.load(f)
            
        return club_data

    def fetch_club_instagram_from_manifest(self) -> list[str]:
        clubs = []
        for c in self.fetch_manifest():
            clubs.append(c['instagram'])
        
        return clubs

    def fetch_club_calendar(self, club_name):
        """Fetch the .ics file for a club from the local filesystem and return its content"""
        try:
            # Construct the path for the .ics file
            path = os.path.join(self.working_path, 'data', club_name, 'calendar_file.ics')

            # Check if the file exists
            if not os.path.exists(path):
                raise FileNotFoundError(f".ics file 'data/{club_name}/calendar_file.ics' not found for club '{club_name}'")

            # Return the path to the .ics file
            return path
        except FileNotFoundError as e:
            raise e     
    
if __name__ == "__main__":
    retriver = DataRetriever();
    print(retriver.fetch_club_instagram_from_manifest())
        
        

            
        
      
    
    
    