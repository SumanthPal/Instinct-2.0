import os
import boto3
import dotenv
import logging
from pathlib import Path

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class S3Client:
    def __init__(self):
        dotenv.load_dotenv()
        
        # Initialize the S3 client
        self.s3 = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-west-1')
        )
        
        self.bucket_name = os.getenv('S3_BUCKET_NAME', 'instinct-club-data')
        self.working_path = os.path.join(os.path.dirname(__file__), '..')
        self.logger = logger

        self.logger.info("Initializing S3 client...")
        self.logger.info(f"Bucket: {self.bucket_name}")

    def get_all_files_in_directory(self, directory: str):
        """
        Fetches all files in a specific directory (prefix) in S3.

        :param directory: The directory (prefix) in S3 to fetch files from.
        :return: List of S3 file keys.
        """
        files = []
        continuation_token = None
        
        while True:
            list_args = {'Bucket': self.bucket_name, 'Prefix': directory}
            if continuation_token:
                list_args['ContinuationToken'] = continuation_token
            
            response = self.s3.list_objects_v2(**list_args)
            if 'Contents' in response:
                files.extend([obj['Key'] for obj in response['Contents']])

            if 'NextContinuationToken' in response:
                continuation_token = response['NextContinuationToken']
            else:
                break
        
        return files
    
    def _download_directory(self, s3_directory: str, local_directory: str):
        """
        Downloads all files in a specific directory from S3 to a local directory,
        maintaining the file hierarchy structure.

        :param s3_directory: The S3 directory (prefix) to fetch files from.
        :param local_directory: The local directory to save the files to.
        """
        # Get all files in the S3 directory
        file_keys = self.get_all_files_in_directory(s3_directory)
        
        # Ensure the local directory exists
        if not os.path.exists(local_directory):
            os.makedirs(local_directory)
        
        # Download each file
        for file_key in file_keys:
            # Construct the local file path
            relative_path = os.path.relpath(file_key, s3_directory)  # Preserve relative path
            local_file_path = os.path.join(local_directory, relative_path)
            
            # Ensure the local directory for the file exists
            local_file_dir = os.path.dirname(local_file_path)
            if not os.path.exists(local_file_dir):
                os.makedirs(local_file_dir)
            
            # Skip downloading if the file already exists
            if os.path.exists(local_file_path):
                self.logger.info(f"File already exists: {local_file_path}, skipping download.")
                continue
        
            # Download the file
            self.s3.download_file(self.bucket_name, file_key, local_file_path)
            self.logger.info(f"Downloaded: {file_key} to {local_file_path}")
                
    def download_instagram_directory(self, instagram: str):
        self._download_directory(f'data/{instagram}', f'./data/{instagram}')
        

    def delete_directory(self, instagram: str):
        """
        Deletes all files in the specified directory (prefix) in S3.

        :param directory: The directory (prefix) to delete.
        """
        directory = f'data/{instagram}'
        try:
            files_to_delete = self.get_all_files_in_directory(directory)
            if files_to_delete:
                for i in range(0, len(files_to_delete), 1000):
                    batch = [{'Key': key} for key in files_to_delete[i:i + 1000]]
                    self.s3.delete_objects(Bucket=self.bucket_name, Delete={'Objects': batch})
                    self.logger.info(f"Deleted batch of {len(batch)} files.")
            else:
                self.logger.info(f"No files found in directory: {directory}")
        except Exception as e:
            self.logger.error(f"Error deleting directory {directory}: {e}")

    def delete_data(self):
        self.delete_directory('')
        
    def upload_data(self):
        self.upload_directory('./data', 'data')
        
    def upload_directory(self, local_dir: str, s3_prefix: str):
        """
        Uploads a local directory to a specified prefix in S3.

        :param local_dir: Path to the local directory.
        :param s3_prefix: The S3 directory (prefix) to upload the files to.
        """
        local_dir = Path(local_dir)
        for file_path in local_dir.rglob('*'):
            if file_path.is_file():
                s3_key = os.path.join(s3_prefix, file_path.relative_to(local_dir).as_posix())
                try:
                    self.s3.upload_file(str(file_path), self.bucket_name, s3_key)
                    self.logger.info(f"Uploaded {file_path} to s3://{self.bucket_name}/{s3_key}")
                except Exception as e:
                    self.logger.error(f"Failed to upload {file_path}: {e}")

# Usage example:
if __name__ == "__main__":
    s3_client = S3Client()

    s3_client.delete_data()
    