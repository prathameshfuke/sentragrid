"""SentraGrid Backend — RAG Incident Q&A Service."""

import json
import math
import logging
from typing import Optional
from app.database import get_db
from app.config import settings
from app.services.llm_client import call_llm

_embedding_model = None
logger = logging.getLogger("sentragrid.rag")
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "how",
    "i", "in", "is", "it", "of", "on", "or", "that", "the", "to", "was", "what", "when",
    "where", "which", "who", "why", "with", "you", "your",
}


def _has_live_llm() -> bool:
    return bool(settings.groq_api_key or settings.gemini_api_key)


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer(settings.embedding_model)
    return _embedding_model


def _query_pgvector(question: str, top_k: int) -> list[tuple[dict, float]]:
    if settings.mock_mode or not settings.use_supabase:
        logger.info(
            "[RAG] pgvector skipped: mock_mode=%s use_supabase=%s",
            settings.mock_mode,
            settings.use_supabase,
        )
        return []
    try:
        from supabase import create_client
        supabase = create_client(settings.supabase_url, settings.supabase_service_key)
        
        # Step 1: Log the raw user query right before embedding
        logger.info("[RAG Step 1] Query text right before embedding: %r", question)
        
        model = _get_embedding_model()
        embedding = model.encode(question).tolist()
        
        # Step 2: Log the embedding vector (length and first few values)
        logger.info(
            "[RAG Step 2] Generated embedding vector: len=%d, head=%s, query=%r",
            len(embedding),
            embedding[:5],
            question,
        )
        
        # Step 4: Check if Supabase table is populated with real distinct embeddings
        try:
            db_check = supabase.table("incident_reports").select("id, title, embedding", count="exact").execute()
            all_rows = db_check.data or []
            non_null_rows = [r for r in all_rows if r.get("embedding") is not None]
            distinct_embs = len({json.dumps(r.get("embedding")) for r in non_null_rows})
            logger.info(
                "[RAG Step 4 DB Check] Supabase incident_reports total_rows=%d, non_null_embeddings=%d, distinct_embeddings=%d",
                len(all_rows),
                len(non_null_rows),
                distinct_embs
            )
            if len(all_rows) > 0 and len(non_null_rows) == 0:
                logger.warning("[RAG Step 4 Warning] Supabase incident_reports contains rows but ALL embeddings are NULL!")
            elif len(non_null_rows) > 0 and distinct_embs == 1:
                logger.warning("[RAG Step 4 Warning] Supabase incident_reports has non-null embeddings, but they are all IDENTICAL!")
        except Exception as db_err:
            logger.error("[RAG Step 4 DB Check Failed] Could not query incident_reports table metadata: %s", db_err)

        # Step 3: Log the actual SQL/query sent to Supabase
        logger.info(
            "[RAG Step 3] SQL/Query sent to Supabase: SELECT ir.id, ir.title, ir.content, ir.source, 1 - (ir.embedding <=> query_embedding) as similarity FROM incident_reports ir WHERE ir.embedding IS NOT NULL ORDER BY ir.embedding <=> query_embedding LIMIT %d",
            top_k
        )
        
        response = supabase.rpc(
            "match_incident_reports",
            {
                "query_embedding": embedding,
                "match_count": top_k,
            },
        ).execute()
        rows = response.data or []
        results = []
        for row in rows:
            score = float(row.get("similarity", 0.0))
            results.append((row, score))
        return results
    except Exception as exc:
        print(f"[RAG] pgvector query failed, falling back to TF-IDF: {exc}")
        return []


def _simple_tokenize(text: str) -> list[str]:
    """Simple whitespace + punctuation tokenizer."""
    import re
    text = text.lower()
    tokens = re.findall(r'\b\w+\b', text)
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]


def _compute_tfidf_similarity(query: str, documents: list[dict]) -> list[tuple[dict, float]]:
    """Compute TF-IDF cosine similarity between query and documents.
    
    This is a lightweight alternative to vector embeddings for mock mode.
    Works without any ML model dependencies.
    """
    query_tokens = set(_simple_tokenize(query))
    if not query_tokens:
        return [(doc, 0.0) for doc in documents]

    # Build document frequencies
    doc_count = len(documents)
    doc_freq: dict[str, int] = {}
    doc_tokens_list = []
    for doc in documents:
        text = f"{doc.get('title', '')} {doc.get('content', '')}"
        tokens = set(_simple_tokenize(text))
        doc_tokens_list.append(tokens)
        for token in tokens:
            doc_freq[token] = doc_freq.get(token, 0) + 1

    # Compute IDF
    idf = {}
    for token in query_tokens:
        df = doc_freq.get(token, 0)
        idf[token] = math.log((doc_count + 1) / (df + 1)) + 1

    # Score each document
    scored = []
    for i, doc in enumerate(documents):
        doc_tokens = doc_tokens_list[i]
        score = 0.0
        for token in query_tokens:
            if token in doc_tokens:
                score += idf.get(token, 0)
        scored.append((doc, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def _build_non_llm_answer(question: str, top_docs: list[tuple[dict, float]]) -> str:
    top_titles = [doc.get("title", "Untitled") for doc, _ in top_docs[:3]]
    highlights = []
    for doc, _ in top_docs[:2]:
        content = doc.get("content", "")
        sentence = content.split(". ")[0].strip()
        if sentence:
            highlights.append(f"{doc.get('title', 'Untitled')}: {sentence}.")
    return (
        f"For your question \"{question}\", the most relevant records are: "
        f"{'; '.join(top_titles)}. "
        + (" ".join(highlights) if highlights else "Review the cited records for details.")
    )


async def query_incidents(question: str, top_k: int = 5) -> dict:
    """Answer a question using the incident report corpus."""
    logger.info("[RAG] received question=%r", question)
    db = get_db()
    reports = db.get_incident_reports()

    if not reports:
        return {
            "answer": "No incident reports available in the knowledge base.",
            "sources": [],
        }

    embedding_values = [r.get("embedding") for r in reports if isinstance(r, dict)]
    non_null_embeddings = [e for e in embedding_values if e is not None]
    distinct_embeddings = len({json.dumps(e) for e in non_null_embeddings}) if non_null_embeddings else 0
    logger.info(
        "[RAG] corpus embeddings total=%s non_null=%s distinct=%s",
        len(reports),
        len(non_null_embeddings),
        distinct_embeddings,
    )

    # Prefer pgvector retrieval when Supabase is configured.
    scored = _query_pgvector(question, top_k)
    retrieval_mode = "pgvector" if scored else "tfidf"
    if not scored:
        scored = _compute_tfidf_similarity(question, reports)
    top_docs = scored[:top_k]
    logger.info(
        "[RAG] retrieval_mode=%s top=%s",
        retrieval_mode,
        [(doc.get("title", "Untitled"), round(score, 3)) for doc, score in top_docs[:3]],
    )

    # Filter out very low scores
    max_score = top_docs[0][1] if top_docs else 0
    if max_score > 0:
        threshold = max_score * 0.2
        top_docs = [(doc, score) for doc, score in top_docs if score >= threshold]

    cutoff = 0.4 if retrieval_mode == "pgvector" else 1.2
    if max_score < cutoff:
        top_docs = []

    if not top_docs:
        return {
            "answer": "The knowledge base does not contain relevant records for that question. Ask about plant incidents, permits, gas exposure, or OISD/Factory Act guidance.",
            "sources": [],
        }

    # Build context for LLM
    context_chunks = []
    sources = []
    for doc, score in top_docs:
        context_chunks.append(
            f"[Source: {doc.get('source', 'unknown')}] "
            f"Title: {doc.get('title', 'Untitled')}\n"
            f"{doc.get('content', '')}"
        )
        sources.append({
            "title": doc.get("title", "Untitled"),
            "content_snippet": doc.get("content", "")[:200] + "...",
            "source_type": doc.get("source", "unknown"),
            "similarity": round(score, 3),
        })

    system_prompt = """You are a safety intelligence assistant for an industrial plant.
Answer the user's question based ONLY on the provided incident reports and safety guidelines.
Cite specific incidents or guidelines by their title when referencing them.
Use a professional, technical tone appropriate for a safety officer audience.
If the provided documents don't contain enough information to fully answer the question, say so explicitly.

Output JSON with:
- answer: your synthesized answer (2-4 sentences, citing sources by title)
- sources: array of objects with {title, content_snippet, source_type} for each cited source"""

    user_prompt = (
        f"Question: {question}\n\n"
        f"Available documents:\n\n"
        + "\n\n---\n\n".join(context_chunks)
    )
    # Step 5: Log the final prompt sent to the LLM (including retrieved context chunks and user question)
    logger.info(
        "[RAG Step 5] Final prompt sent to LLM:\n%s",
        user_prompt,
    )

    if not _has_live_llm():
        return {
            "answer": _build_non_llm_answer(question, top_docs),
            "sources": sources[:3],
        }

    try:
        llm_response = await call_llm(system_prompt, user_prompt, json_mode=True)
        result = json.loads(llm_response)
        # Merge source metadata
        if "sources" not in result or not result["sources"]:
            result["sources"] = sources[:3]
        return result
    except Exception as e:
        print(f"[RAG] LLM failed: {e}")
        # Fallback: return top documents with a simple concatenation
        snippets = [doc.get("title", "") for doc, _ in top_docs[:3]]
        return {
            "answer": (
                f"Based on the available records, the following incidents are relevant to your query: "
                f"{'; '.join(snippets)}. "
                f"Please review the full incident reports below for detailed information."
            ),
            "sources": sources[:3],
        }
