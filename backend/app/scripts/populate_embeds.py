import asyncio
import openai
from supabase import create_client
import os
from os import dotenv

# Setup Supabase client
dotenv.load_dotenv()
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase = create_client(supabase_url, supabase_key)

# Setup OpenAI
openai.api_key = "OPENAI"

async def generate_embedding(text):
    """Generate an embedding using OpenAI's API."""
    if not text:
        return None
        
    # Prepare text - normalize and truncate if needed
    text = text.replace("\n", " ").strip()
    # OpenAI has a token limit, so you might need to truncate
    
    response = await openai.Embedding.acreate(
        input=text,
        model="text-embedding-ada-002"  # or your preferred model
    )
    return response['data'][0]['embedding']

async def process_club_with_related_content(club_id):
    """Generate and store embedding for a club including all related content."""
    # Fetch the club
    club_query = supabase.table("clubs").select("*").eq("id", club_id).execute()
    
    if not club_query.data:
        print(f"Club {club_id} not found")
        return False
    
    club = club_query.data[0]
    
    # Initialize text collection
    text_components = []
    
    # Add core club information
    if club.get('name'):
        text_components.append(club['name'] + " " * 3)  # Give more weight to name
    
    if club.get('description'):
        text_components.append(club['description'] + " " * 2)  # Give more weight to description
    
    # Add categories if available
    if club.get('categories'):
        category_names = [cat['name'] for cat in club['categories']]
        text_components.append(' '.join(category_names))
    
    # Fetch related posts (based on your schema)
    posts_query = supabase.table("posts").select("caption, determinant").eq("club_id", club_id).execute()
    
    if posts_query.data:
        for post in posts_query.data:
            post_text = []
            if post.get('caption'):
                post_text.append(post['caption'])
            if post.get('determinant') and post['determinant'] != '':
                post_text.append(post['determinant'])
            
            if post_text:
                text_components.append(' '.join(post_text))
    
    # Fetch related events (based on your schema)
    events_query = supabase.table("events").select("name, details, parsed").eq("club_id", club_id).execute()
    
    if events_query.data:
        for event in events_query.data:
            event_text = []
            if event.get('name'):
                event_text.append(event['name'])
            if event.get('details'):
                event_text.append(event['details'])
            
            # Handle the parsed JSONB field if it contains useful text
            if event.get('parsed') and isinstance(event['parsed'], dict):
                # Extract relevant fields from parsed JSON
                if event['parsed'].get('description'):
                    event_text.append(event['parsed']['description'])
                if event['parsed'].get('location'):
                    event_text.append(event['parsed']['location'])
                # Add other relevant fields from parsed as needed
            
            if event_text:
                text_components.append(' '.join(event_text))
    
    # Combine all text
    combined_text = ' '.join(text_components).strip()
    
    if not combined_text:
        print(f"No text to embed for club {club_id}")
        return False
    
    # Preprocess text - remove excess whitespace
    combined_text = ' '.join(combined_text.split())
    
    # Truncate if needed (OpenAI's embedding model has a token limit)
    # A simple character-based truncation - you may need more sophisticated tokenization
    if len(combined_text) > 8000:  # Approximate limit
        combined_text = combined_text[:8000]
    
    # Generate embedding
    try:
        embedding = await generate_embedding(combined_text)
        
        if embedding:
            # Update club with embedding
            response = supabase.table("clubs").update({
                "embedding": embedding,
                "needs_embedding_update": False,
                "last_embedding_update": "now()"  # Update timestamp
            }).eq("id", club_id).execute()
            
            print(f"Updated club {club_id} with enriched embedding")
            return True
    except Exception as e:
        print(f"Error generating embedding for club {club_id}: {str(e)}")
    
    return False
async def update_all_clubs():
    """Fetch all clubs and update them with embeddings."""
    # Get all clubs that don't have embeddings yet
    response = supabase.table("clubs").select("*").is_("embedding", "null").execute()
    clubs = response.data
    
    print(f"Found {len(clubs)} clubs without embeddings")
    
    # Process clubs in batches to avoid rate limits
    batch_size = 20
    for i in range(0, len(clubs), batch_size):
        batch = clubs[i:i+batch_size]
        tasks = [process_club(club) for club in batch]
        results = await asyncio.gather(*tasks)
        print(f"Processed batch {i//batch_size + 1}/{(len(clubs)-1)//batch_size + 1}")
        
        # Optional: add delay between batches if hitting rate limits
        await asyncio.sleep(1)
    
    print("Finished updating all clubs with embeddings")

# Run the script
if __name__ == "__main__":
    asyncio.run(update_all_clubs())