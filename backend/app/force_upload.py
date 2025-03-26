import json
import os
import dropbox
from dropbox.files import WriteMode, DeleteArg
from dropbox.exceptions import ApiError

class DropboxUploader:
    def __init__(self, dropbox_token):
        self.dbx = dropbox.Dropbox(dropbox_token)

    def upload_directory(self, local_dir, dropbox_dir):
        """
        Uploads a local directory to Dropbox, overwriting the existing directory if it exists.

        :param local_dir: Path to the local directory.
        :param dropbox_dir: Path to the target directory in Dropbox.
        """
        # Delete the existing directory in Dropbox (if it exists)
        self.delete_directory(dropbox_dir)

        # Create the target directory in Dropbox
        self.create_folder(dropbox_dir)

        # Upload all files from the local directory
        for root, dirs, files in os.walk(local_dir):
            for file_name in files:
                local_path = os.path.join(root, file_name)
                relative_path = os.path.relpath(local_path, local_dir)
                dropbox_path = os.path.join(dropbox_dir, relative_path).replace("\\", "/")

                try:
                    with open(local_path, "rb") as f:
                        print(f"Uploading {local_path} to {dropbox_path}...")
                        self.dbx.files_upload(f.read(), dropbox_path, mode=WriteMode.overwrite)
                except ApiError as e:
                    print(f"Failed to upload {local_path}: {e}")

    def create_folder(self, dropbox_path):
        """
        Creates a folder in Dropbox if it doesn't already exist.

        :param dropbox_path: Path to the folder in Dropbox.
        """
        try:
            self.dbx.files_create_folder_v2(dropbox_path)
            print(f"Created folder: {dropbox_path}")
        except ApiError as e:
            if e.error.is_path() and e.error.get_path().is_conflict():
                print(f"Folder already exists: {dropbox_path}")
            else:
                print(f"Failed to create folder {dropbox_path}: {e}")

    def delete_directory(self, dropbox_path):
        """
        Deletes a directory in Dropbox if it exists.

        :param dropbox_path: Path to the directory in Dropbox.
        """
        try:
            # Check if the directory exists
            self.dbx.files_get_metadata(dropbox_path)
            # Delete the directory and its contents
            self.dbx.files_delete_v2(dropbox_path)
            print(f"Deleted existing directory: {dropbox_path}")
        except ApiError as e:
            if e.error.is_path() and e.error.get_path().is_not_found():
                print(f"Directory does not exist: {dropbox_path}")
            else:
                print(f"Failed to delete directory {dropbox_path}: {e}")

def update_manifest_with_club_data(manifest_path, data_dir):
    """
    Updates the manifest.json file with profile picture links and descriptions from club_info.json files.

    :param manifest_path: Path to the manifest.json file.
    :param data_dir: Path to the directory containing club folders.
    """
    # Load the manifest.json file
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    # Iterate through each club in the manifest
    for club in manifest:
        club_instagram = club["instagram"]
        club_folder = os.path.join(data_dir, club_instagram)

        # Check if the club folder exists
        if not os.path.exists(club_folder):
            print(f"Club folder not found: {club_folder}")
            continue

        # Path to the club_info.json file
        club_info_path = os.path.join(club_folder, "club_info.json")

        # Check if the club_info.json file exists
        if not os.path.exists(club_info_path):
            print(f"club_info.json not found for {club_instagram}")
            continue

        # Load the club_info.json file
        with open(club_info_path, "r") as f:
            club_info = json.load(f)

        # Extract the profile picture link and description
        pfp = club_info.get("Profile Picture", "")
        description = club_info.get("Description", "")

        # Update the manifest entry
        club["pfp"] = pfp
        club["description"] = description

    # Save the updated manifest.json file
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=4)

    print("Manifest updated successfully!")

if __name__ == "__main__":
    # # Replace with your Dropbox access token
    # DROPBOX_TOKEN = os.getenv('DROPBOX_API_KEY')

    # # Path to the local directory you want to upload
    # LOCAL_DIR = "/Users/sumanth/Programming-Apps/uciproto/data"
    # # Path to the target directory in Dropbox
    # DROPBOX_DIR = "/data"

    # # Initialize the uploader
    # uploader = DropboxUploader(DROPBOX_TOKEN)

    # # Upload the directory (overwriting if it exists)
    # uploader.upload_directory(LOCAL_DIR, DROPBOX_DIR)
    
    # Path to the manifest.json file
    MANIFEST_PATH = "/Users/sumanth/Programming-Apps/uciproto/manifest.json"

    # Path to the directory containing club folders
    DATA_DIR = "/Users/sumanth/Programming-Apps/uciproto/data"

    # Update the manifest with club data
    update_manifest_with_club_data(MANIFEST_PATH, DATA_DIR)