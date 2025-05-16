import logging
import os
import json
import sys
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
import redis
import dotenv

class RedisLogHandler(logging.Handler):
    """Simple Redis logging handler that pushes logs to a Redis list"""
    
    def __init__(self, max_entries=1000):
        super().__init__()
        dotenv.load_dotenv()
        self.redis_url = os.getenv('REDIS_URL')
        print(self.redis_url)
        self.redis_conn = redis.from_url(self.redis_url)
        self.max_entries = max_entries
        self.log_key = 'logs:entries'

    def emit(self, record):
        """Process a log record and send it to Redis"""
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
            self.redis_conn.lpush(self.log_key, json_entry)
            
            # Trim the list if needed
            self.redis_conn.ltrim(self.log_key, 0, self.max_entries - 1)
                
        except Exception as e:
            # Last resort fallback to print
            print(f"Failed to push log to Redis: {e}")
            print(f"Original log: {record.getMessage()}")

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
    log_file_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'logs')
    
    # Create the log file directory if it doesn't exist
    if not os.path.exists(log_file_dir):
        os.makedirs(log_file_dir)
    
    # Define the log file path
    log_file_path = os.path.join(log_file_dir, 'logfile.log')
    
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