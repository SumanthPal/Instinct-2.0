import os
from datetime import datetime

from dateutil.relativedelta import relativedelta

import app.tools.logger as logger

def file_cleanup():
    """
    Cleans up club data files. Ensures each `data/clubname/posts/` directory
    has at most 10 posts, removing the oldest files if necessary.
    """
    base_dir = "../data"  # Root directory containing club data
    for root, dirs, files in os.walk(base_dir):
        # Skip the base directory and focus on `posts` subdirectories
        if not root.endswith("posts"):
            continue

        # Sort files by creation time (oldest first)
        files = sorted(files, key=lambda f: os.path.getctime(os.path.join(root, f)))

        # If there are more than 10 files, remove the oldest ones
        if len(files) > 10:
            extra_files = len(files) - 10
            logger.info(f"Directory {root} has {len(files)} files, cleaning up {extra_files}...")
            for file in files[:extra_files]:  # Remove the oldest files
                file_path = os.path.join(root, file)
                try:
                    os.remove(file_path)
                    logger.info(f"Removed old file: {file_path}")
                except Exception as e:
                    logger.error(f"Error removing file {file_path}: {e}")


if __name__ == "__main__":
    file_cleanup()