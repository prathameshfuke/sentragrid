"""SentraGrid Backend — LLM Client (Groq + Gemini fallback)."""

import json
import httpx
from typing import Optional
from app.config import settings


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    json_mode: bool = True,
    temperature: float = 0.3,
) -> str:
    """Call Groq LLM API, falling back to Gemini if needed.
    
    In mock mode or when no API key is set, returns a synthetic response.
    """
    # Try Groq first
    if settings.groq_api_key:
        try:
            return await _call_groq(system_prompt, user_prompt, json_mode, temperature)
        except Exception as e:
            print(f"[LLM] Groq call failed: {e}")
            # Fall through to Gemini

    # Try Gemini fallback
    if settings.gemini_api_key:
        try:
            return await _call_gemini(system_prompt, user_prompt, json_mode, temperature)
        except Exception as e:
            print(f"[LLM] Gemini call failed: {e}")

    # Mock fallback
    return _mock_response(system_prompt, user_prompt)


async def _call_groq(
    system_prompt: str,
    user_prompt: str,
    json_mode: bool,
    temperature: float,
) -> str:
    """Call Groq API."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        payload = {
            "model": settings.groq_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": 1024,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _call_gemini(
    system_prompt: str,
    user_prompt: str,
    json_mode: bool,
    temperature: float,
) -> str:
    """Call Gemini API."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{system_prompt}\n\n{user_prompt}"}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 1024,
            },
        }
        if json_mode:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.gemini_api_key}",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


def _mock_response(system_prompt: str, user_prompt: str) -> str:
    """Generate a synthetic response when no LLM API is available."""
    prompt_lower = user_prompt.lower()

    # Risk evaluation mock
    if "risk" in system_prompt.lower() or "compound" in system_prompt.lower():
        if "critical" in prompt_lower or "h2s" in prompt_lower:
            return json.dumps({
                "severity": "critical",
                "title": "Compound risk detected — elevated gas with active permit",
                "explanation": "H2S concentration has exceeded safe threshold while an active hot work permit is in effect in this zone. The combination of toxic/flammable gas presence with ignition sources from hot work creates an immediate explosion and exposure hazard. This compound risk exceeds what either condition alone would present. Immediate evacuation of non-essential personnel and permit suspension recommended.",
                "triggering_factors": {
                    "gas_h2s_ppm": 14.2,
                    "active_permit": "hot_work",
                    "zone_type": "hot_work_area",
                    "trend": "rising",
                    "confidence_score": 0.94,
                    "prediction_lead_time_min": 15,
                    "single_sensor_missed": False,
                    "lead_time_advantage_min": 12
                },
                "should_alert": True
            })
        else:
            return json.dumps({
                "severity": "warning",
                "title": "Rising gas trend detected in active work zone",
                "explanation": "Gas sensor readings show a consistent upward trend over the last 3 readings, coinciding with active maintenance operations in the zone. While current levels remain below the absolute alarm threshold, the combination of rising concentrations and ongoing work activity warrants heightened monitoring and precautionary measures.",
                "triggering_factors": {
                    "trend": "rising",
                    "readings_count": 3,
                    "current_value": 7.5,
                    "confidence_score": 0.88,
                    "prediction_lead_time_min": 35,
                    "single_sensor_missed": True,
                    "lead_time_advantage_min": 25
                },
                "should_alert": True
            })

    # Permit evaluation mock
    if "permit" in system_prompt.lower():
        if "hot_work" in prompt_lower and ("gas" in prompt_lower or "h2s" in prompt_lower):
            return json.dumps({
                "approved": False,
                "conflicts": [
                    "Elevated H2S readings detected in target zone",
                    "Gas trend is rising — 3 consecutive increases recorded",
                    "Hot work ignition source incompatible with current atmospheric conditions"
                ],
                "recommendation": "Hot work permit cannot be safely issued in the current conditions. H2S readings in this zone show a rising trend approaching the alarm threshold. Hot work activities introduce ignition sources that are incompatible with elevated flammable/toxic gas concentrations. Recommend postponing until gas levels return to baseline and remain stable for at least 30 minutes. Refer to OISD-105 Section 4.3 on atmospheric verification before hot work authorization.",
                "override_allowed": True,
                "risk_level": "high"
            })
        else:
            return json.dumps({
                "approved": True,
                "conflicts": [],
                "recommendation": "Zone conditions are within acceptable parameters for the requested permit type. Standard precautions apply.",
                "override_allowed": True,
                "risk_level": "low"
            })

    # RAG mock
    if "incident" in system_prompt.lower() or "rag" in system_prompt.lower() or "question" in system_prompt.lower():
        import re
        # Try to parse the question
        question_match = re.search(r"Question:\s*(.*)", user_prompt)
        question_str = question_match.group(1).strip() if question_match else "unknown question"
        
        # Split the prompt by the document separator "---"
        doc_chunks = user_prompt.split("---")
        parsed_docs = []
        for chunk in doc_chunks:
            source_match = re.search(r"\[Source:\s*([^\]]+)\]", chunk)
            title_match = re.search(r"Title:\s*([^\n]+)", chunk)
            if title_match:
                title = title_match.group(1).strip()
                source = source_match.group(1).strip() if source_match else "unknown"
                # Extract snippet lines
                lines = chunk.split("\n")
                content_lines = []
                found_title = False
                for line in lines:
                    if "Title:" in line:
                        found_title = True
                        continue
                    if found_title:
                        # Filter out source info if it is duplicated on same line
                        content_lines.append(line.strip())
                content_snippet = " ".join([l for l in content_lines if l]).strip()
                if len(content_snippet) > 200:
                    content_snippet = content_snippet[:200] + "..."
                parsed_docs.append({
                    "title": title,
                    "content_snippet": content_snippet,
                    "source_type": source
                })
                
        if parsed_docs:
            top_titles = [d["title"] for d in parsed_docs[:3]]
            highlights = []
            for d in parsed_docs[:2]:
                snippet_preview = d["content_snippet"].split(". ")[0].strip()
                if snippet_preview:
                    highlights.append(f"{d['title']}: {snippet_preview}.")
            answer = (
                f"Based on the safety records for your query \"{question_str}\", "
                f"the most relevant incidents/guidelines found are: {'; '.join(top_titles)}. "
                + " ".join(highlights)
            )
            sources = parsed_docs[:3]
        else:
            answer = f"No relevant incident reports or safety guidelines could be found in the knowledge base matching: '{question_str}'."
            sources = []
            
        return json.dumps({
            "answer": answer,
            "sources": sources
        })

    return json.dumps({"response": "Analysis complete. No immediate concerns identified."})
