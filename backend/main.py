# DEPRECATED// LOOK AT server.py
import os
import multiprocessing
import app.server
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', )))
if __name__ == "__main__":

    
    # Check if running on Heroku
    is_heroku = 'DYNO' in os.environ
    
        # On Heroku, use a worker process instead (defined in Procfile)
        # Run only the web server in this process
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
    