from supabase import create_client, Client
import os
from dotenv import load_dotenv


load_dotenv()
# Load environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise EnvironmentError("Missing SUPABASE_URL or SUPABASE_KEY in environment variables")

# Create the Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
