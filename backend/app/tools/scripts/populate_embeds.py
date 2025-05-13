import asyncio
import openai
from supabase import create_client
import os
from os import dotenv

# Setup Supabase client
dotenv.load_dotenv()
supabase_url = "YOUR_SUPABASE_URL"
supabase_key = "YOUR_SUPABASE_KEY"
supabase = create_client(supabase_url, supabase_key)

# Setup OpenAI
openai.api_key = "YOUR_OPENAI_API_KEY"

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

async def process_club(club):
    """Generate and store embedding for a single club."""
    # Create text to embed - typically you'd use the most meaningful fields
    text_to_embed = f"{club['name']} {club['description']}"
    
    # For clubs with categories, add them to the text
    if club.get('categories'):
        category_names = [cat['name'] for cat in club['categories']]
        text_to_embed += f" {' '.join(category_names)}"
    
    # Generate embedding
    embedding = await generate_embedding(text_to_embed)
    
    if embedding:
        # Update club with embedding
        response = supabase.table("clubs").update({"embedding": embedding}).eq("id", club['id']).execute()
        print(f"Updated club {club['id']} with embedding")
        return True
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