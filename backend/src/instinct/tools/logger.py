import logging
import os
import json
import sys
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
import redis
import dotenv

def _default_log_dir() -> str:
    """Where logs go when LOG_DIR is unset.

    Running from the source tree (or an editable install) resolves
    backend/src/instinct/tools/logger.py -> backend/logs, i.e. the same place as
    before the package move and independent of the working directory. Installed
    non-editable, the package lives in site-packages, where `parents[3]` would
    be a path inside the venv — so fall back to ./logs. Containers should set
    LOG_DIR explicitly.
    """
    package_parent = Path(__file__).resolve().parents[2]  # .../src or site-packages
    if package_parent.name == "src":
        return str(package_parent.parent / "logs")
    return str(Path.cwd() / "logs")


# Single source of truth for where logs go; every reader (job_bot's !logs,
# scraper_rotation) imports LOG_FILE_PATH from here rather than recomputing it.
LOG_DIR = os.getenv("LOG_DIR") or _default_log_dir()
LOG_FILE_PATH = os.path.join(LOG_DIR, "logfile.log")

class RedisLogHandler(logging.Handler):
    """Redis logging handler that pushes logs to a Redis list.

    Connecting is deferred to the first record: constructing the handler must
    never require a reachable Redis (or a REDIS_URL at all). If Redis is not
    configured or the first push fails, the handler disables itself and every
    record falls through to the stderr/file handlers instead.
    """

    def __init__(self, max_entries=1000):
        super().__init__()
        dotenv.load_dotenv()
        # Never print the URL: it can carry credentials.
        self.redis_url = os.getenv('REDIS_URL')
        self.redis_conn = None
        self.disabled = not self.redis_url
        self.max_entries = max_entries
        self.log_key = 'logs:entries'

    def _disable(self, reason):
        """Stop trying to reach Redis; report once, not once per record."""
        self.disabled = True
        self.redis_conn = None
        print(
            f"Redis log handler disabled ({reason}); logging to file and console only.",
            file=sys.stderr,
        )

    def _get_conn(self):
        """Connect on first use. Returns None when Redis is unavailable."""
        if self.disabled:
            return None
        if self.redis_conn is None:
            try:
                self.redis_conn = redis.from_url(self.redis_url)
            except Exception as e:
                self._disable(f"bad REDIS_URL: {e}")
                return None
        return self.redis_conn

    def emit(self, record):
        """Process a log record and send it to Redis"""
        conn = self._get_conn()
        if conn is None:
            return
        try:
            # Format the log message
            log_entry = self.format(record)
            
            # Create a structured log entry
            structured_entry = {
                'timestamp': datetime.now().isoformat(),
                'level': record.levelname,
                'message': record.getMessage(),
                'logger': record.name,
                'formatted': log_entry
            }
            
            # Add exception info if available
            if record.exc_info:
                structured_entry['exception'] = self.formatter.formatException(record.exc_info)
            # Convert to JSON string
            json_entry = json.dumps(structured_entry)
            
            # Push to Redis list
            conn.lpush(self.log_key, json_entry)
            
            # Trim the list if needed
            conn.ltrim(self.log_key, 0, self.max_entries - 1)
                
        except Exception as e:
            # Do not retry per-record: one dead Redis would otherwise print a
            # traceback for every single log line.
            self._disable(f"failed to push log: {e}")

# Configure logging system
def setup_logging(log_level=logging.INFO):
    """
    Set up the logging system with file, console, and Redis handlers.
    
    Args:
        log_level: Logging level (default: INFO)
    
    Returns:
        The configured logger
    """
    # Define the log file directory
    log_file_dir = LOG_DIR
    
    # Create the log file directory if it doesn't exist
    if not os.path.exists(log_file_dir):
        os.makedirs(log_file_dir)
    
    # Define the log file path
    log_file_path = LOG_FILE_PATH
    
    # Create a TimedRotatingFileHandler to rotate logs daily
    file_handler = TimedRotatingFileHandler(
        log_file_path, 
        when="midnight", 
        interval=1, 
        backupCount=7  # Keep logs for the last 7 days
    )
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    
    # Create a console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    
    # Create a Redis handler
    redis_handler = RedisLogHandler()
    redis_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    
    # Configure the root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Remove any existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Add our handlers
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(redis_handler)
    
    # Create a named logger
    logger = logging.getLogger(__name__)
    logger.info('Logging system initialized')
    
    return logger

# Create and export the logger
logger = setup_logging()

# Example usage
if __name__ == "__main__":
    logger.debug("This is a debug message")
    logger.info("This is an info message")
    logger.warning("This is a warning message")
    logger.error("This is an error message")
    try:
        1/0
    except Exception as e:
        logger.exception("This is an exception")