import sys
import json
import logging
from pathlib import Path
from supabase import create_client

# Add backend directory to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from app.config import settings
from app.services.rag_service import _get_embedding_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentragrid.seed")

def seed_database():
    if not settings.supabase_url or not settings.supabase_service_key:
        logger.error("Supabase URL or Service Key is missing! Cannot seed database.")
        sys.exit(1)
        
    logger.info("Connecting to Supabase at %s...", settings.supabase_url)
    supabase = create_client(settings.supabase_url, settings.supabase_service_key)
    
    # Load raw incidents
    incidents_path = Path(__file__).parent / "seed" / "incidents.json"
    if not incidents_path.exists():
        logger.error("incidents.json seed file not found at %s!", incidents_path)
        sys.exit(1)
        
    with open(incidents_path, "r", encoding="utf-8") as f:
        incidents = json.load(f)
        
    logger.info("Loaded %d incident reports from incidents.json", len(incidents))
    
    # Load embedding model
    logger.info("Loading SentenceTransformer model '%s'...", settings.embedding_model)
    model = _get_embedding_model()
    
    # Clean existing incident reports
    logger.info("Cleaning existing incident_reports from Supabase...")
    try:
        supabase.table("incident_reports").delete().neq("title", "").execute()
    except Exception as e:
        logger.warning("Failed to clear incident_reports table: %s (continuing...)", e)
        
    # Generate embeddings and upload
    logger.info("Generating embeddings and seeding...")
    rows_to_insert = []
    for inc in incidents:
        text_to_embed = f"Title: {inc['title']}\nContent: {inc['content']}"
        embedding = model.encode(text_to_embed).tolist()
        
        rows_to_insert.append({
            "title": inc["title"],
            "content": inc["content"],
            "source": inc["source"],
            "embedding": embedding
        })
        
    # Batch insert into Supabase
    try:
        response = supabase.table("incident_reports").insert(rows_to_insert).execute()
        inserted_rows = response.data or []
        logger.info("Successfully seeded %d incident reports into Supabase with vector embeddings!", len(inserted_rows))
        
        # Verify
        non_null_rows = [r for r in inserted_rows if r.get("embedding") is not None]
        distinct_embs = len({json.dumps(r.get("embedding")) for r in non_null_rows})
        logger.info(
            "Verification: total_inserted=%d, non_null_embeddings=%d, distinct_embeddings=%d",
            len(inserted_rows),
            len(non_null_rows),
            distinct_embs
        )
    except Exception as e:
        logger.error("Failed to seed incident_reports table into Supabase: %s", e)
        sys.exit(1)

if __name__ == "__main__":
    seed_database()
