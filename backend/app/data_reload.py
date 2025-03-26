from tools.logger import logger
from tools.ai_validation import EventParser
from tools.insta_scraper import multi_threaded_scrape
from tools.data_retriever import DataRetriever
from tools.calendar_connection import CalendarConnection
from tools.ai_validation import EventParser
from tools.s3_client import S3Client
import sys
import os

import time
def main():
    logger.info("setting up objects...")
    retriver = DataRetriever()
    clubs = retriver.fetch_club_instagram_from_manifest()
    parser = EventParser()
    s3_client = S3Client()
    
    cc = CalendarConnection()
    logger.info("objects have been initiated")
    
    logger.info("initiating scraping with 1 threads")
   # multi_threaded_scrape(clubs, 1)
    logger.info('successful scrape!')
    
    logger.info("initiating ai and calendar file creation")
    for club in clubs:
        parser.parse_all_posts(club)
        cc.create_calendar_file(club)
        
    #s3_client.delete_data()
    logger.info('s3 data has been deleted')
    #s3_client.upload_data()
    
    
    #create/append the new manifest accordingly
    retriver.create_list_of_clubs()
    
    logger.info("completed.")
        
if __name__ == "__main__":
    starttime = time.time()
    main()
    logger.info(f"Elapsed time: {time.time() - starttime}")

    
    
        
        
        
    