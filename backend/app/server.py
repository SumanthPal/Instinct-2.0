from io import BytesIO, StringIO
from flask import Flask, request, jsonify, send_file, abort
from tools.ai_validation import EventParser
from tools.calendar_connection import CalendarConnection
from tools.insta_scraper import InstagramScraper, multi_threaded_scrape
from tools.data_retriever import DataRetriever
from tools.s3_client import S3Client
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
#IMPORTANT: TO FIX SQLALCHEMY issues, use: $pip install sqlmodel
from threading import Lock
from fastapi.middleware.cors import CORSMiddleware

import dotenv
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import os
import sys
import atexit

# Load environment variables
dotenv.load_dotenv()
from tools.logger import logger

# Initialize dependencies
calendar = CalendarConnection()
retriever = DataRetriever()
s3_client = S3Client()
app = FastAPI()

origins = [
    "*" # Allow all origins temporarily (adjust for production)
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials = True,
    allow_methods=["*"],
    allow_headers=["*"]
)



# Routes
@app.get('/')
def home():
    logger.info("Home endpoint called.")
    return {"message": "Welcome to the Club API"}


@app.get("/club")
def club():
    return {"message": "Club page"}

@app.get("/club/<username>")
def club_data(username):
    try:
        if not retriever.club_data_exists(username):
            s3_client.download_instagram_directory(username)
            
        logger.info(f"Fetching data for club: {username}")
        return retriever.fetch_club_info(username)
    except FileNotFoundError as e:
        return JSONResponse(content = f"Club not found, {e}", status_code = 404)
    except Exception as e:
        logger.error(f"Error fetching club data: {e}")
        return JSONResponse(content = f"Error: {e}", status_code = 500)

@app.get("/club/<username>/posts")
def club_post_data(username):
    try:
        if not retriever.club_data_exists(username):
            s3_client.download_instagram_directory(username)
            
        logger.info(f"Fetching posts for club: {username}")
        return retriever.fetch_club_posts(username)
    except FileNotFoundError:
        return JSONResponse(content = f"Club posts not found", status_code = 404)
    except Exception as e:
        logger.error(f"Error fetching club posts: {e}")
        return JSONResponse(content = f"Error: {e}", status_code = 500)

@app.get("/club-manifest")
def club_manifest():
    try:
        logger.info("Fetching club manifest.")
        return retriever.fetch_manifest()
    except Exception as e:
        logger.error(f"Error fetching club manifest: {e}")
        return JSONResponse(content = f"Error: {e}", status_code = 500)

    #@TODO: FIX "Error: [Errno 2] No such file or directory: 'C:\\\\Users\\\\wudan\\\\Instinct\\\\Instinct-2.0\\\\backend\\\\app\\\\tools\\\\..\\\\..\\\\manifest.json'" when accessing page


@app.get("/club/<username>/calendar.ics")
def club_calendar(username):
    try:
        if not retriever.club_data_exists(username):
            s3_client.download_instagram_directory(username)
            
        logger.info(f"Fetching calendar for club: {username}")
        calendar_path = retriever.fetch_club_calendar(username)
        
        return send_file(
            calendar_path,  # File-like object containing the .ics content
            download_name=f"{username}_calendar.ics",  # Name of the file when downloaded
            as_attachment=False,  # Set to True if you want to force download
            mimetype='text/calendar',  # MIME type for .ics files
        )
        
    except FileNotFoundError as e:
        logger.error(f"Calendar file not found for {username}: {e}")
        raise HTTPException(status_code = 404, detail = "Calendar file not found")
    except Exception as e:
        logger.error(f"Error fetching calendar for {username}: {e}")
        raise HTTPException(status_code = 500, detail = "Internal Server Error")


@app.get("/job-status")
def job_status():
    response = {}
    for job_id in ['reload_data_job', 'file_cleanup_job']:
        job = scheduler.get_job(job_id)
        response[job_id] = {
            "job_id": job.id if job else "N/A",
            "next_run_time": str(job.next_run_time) if job else "N/A"
        }
    return response


if __name__ == "__main__":
    uvicorn.run(app, debug = True, host='127.0.0.1', port=5022)
