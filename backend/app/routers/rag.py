"""SentraGrid Backend — RAG Q&A API routes."""

import logging
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from app.services.rag_service import query_incidents

router = APIRouter(prefix="/api/rag", tags=["rag"])
logger = logging.getLogger("sentragrid.rag")


class QueryRequest(BaseModel):
    question: str


@router.post("/query")
async def rag_query(body: QueryRequest, response: Response):
    """Query the incident knowledge base."""
    logger.info("[RAG Router] received POST /api/rag/query with question=%r", body.question)
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        result = await query_incidents(body.question)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"RAG query failed: {exc}")


@router.get("/suggested-questions")
async def suggested_questions():
    """Return suggested questions for the RAG panel."""
    return {
        "questions": [
            "Have we had gas incidents in confined spaces before?",
            "What does OISD-105 say about simultaneous permits?",
            "Tell me about the Visakhapatnam coke oven incident",
            "What are the requirements for hot work near gas holders?",
            "How should we handle compound hazard evacuations?",
            "What are the Factory Act requirements for safety officers?",
            "What incidents involved shift handover gaps?",
        ]
    }
