import logging
import os
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler

# Define the log file directory
log_file_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'logs')

# Create the log file directory if it doesn't exist
if not os.path.exists(log_file_dir):
    os.makedirs(log_file_dir)

# Define the log file path with the current date (but will rotate daily)
log_file_path = os.path.join(log_file_dir, 'logfile.log')

# Create a TimedRotatingFileHandler to rotate logs daily
handler = TimedRotatingFileHandler(log_file_path, when="midnight", interval=1, backupCount=7)  # Keep logs for the last 7 days

handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))

# Configure the root logger with the handler and the log level
logging.basicConfig(level=logging.INFO, handlers=[handler, logging.StreamHandler()])

# Create a logger object
logger = logging.getLogger(__name__)

# Example log message
logger.info('This is an info message.')
