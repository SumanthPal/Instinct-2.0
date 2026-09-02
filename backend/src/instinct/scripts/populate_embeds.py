import os
import time
from openai import OpenAI
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize OpenAI client
api_key = os.getenv("OPENAI")
client = OpenAI(api_key=api_key)

def get_embedding(text: str) -> list:
    """Get embedding from OpenAI API."""
    if not text or text.strip() == "":
        return None
    
    try:
        # Using text-embedding-3-small model (newer and more cost-effective)
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error getting embedding: {e}")
        return None

def update_club_embeddings(batch_size=50):
    """Update embeddings for all clubs with needs_embedding_update=True."""
    print("Starting embedding update process...")
    
    # Get clubs that need embedding updates
    # We'll fetch the raw text used for the search_vector to ensure consistency
   
    response = supabase.rpc('get_clubs_for_embedding').execute()
    # If you don't have an RPC function, you can use raw SQL:
    # response = supabase.query(query).execute()
    
    clubs_to_update = response.data
    total_clubs = len(clubs_to_update)
    print(f"Found {total_clubs} clubs that need embedding updates")
    
    updated_count = 0
    error_count = 0
    
    # Process in batches to avoid rate limits
    for i in range(0, total_clubs, batch_size):
        batch = clubs_to_update[i:i+batch_size]
        
        for club in batch:
            club_id = club["id"]
            
            # Combine all text fields for the embedding
            text_parts = []
            
            if club.get("name"):
                text_parts.append(club["name"])
            
            if club.get("description"):
                text_parts.append(club["description"])
            
            if club.get("instagram_handle"):
                text_parts.append(club["instagram_handle"])
            
            # Add post captions
            if club.get("post_texts"):
                text_parts.append(club["post_texts"])
            
            # Add event details
            if club.get("event_texts"):
                text_parts.append(club["event_texts"])
            
            embedding_text = " ".join(text_parts)
            
            if not embedding_text:
                print(f"No text to embed for club {club_id}")
                continue
            
            # Get embedding
            embedding = get_embedding(embedding_text)
            
            if embedding:
                try:
                    # Update club with embedding
                    supabase.table("clubs") \
                        .update({
                            "embedding": embedding,
                            "needs_embedding_update": False,
                            "last_embedding_update": "now()"
                        }) \
                        .eq("id", club_id) \
                        .execute()
                    
                    updated_count += 1
                    print(f"Updated embedding for club {club_id} - {updated_count}/{total_clubs}")
                except Exception as e:
                    print(f"Error updating club {club_id}: {e}")
                    error_count += 1
            else:
                print(f"Failed to get embedding for club {club_id}")
                error_count += 1
        
        # Avoid rate limits
        if i + batch_size < total_clubs:
            print(f"Sleeping for 2 seconds to avoid rate limits...")
            time.sleep(2)
    
    print(f"Embedding update complete. Updated: {updated_count}, Errors: {error_count}")

if __name__ == "__main__":
    update_club_embeddings()