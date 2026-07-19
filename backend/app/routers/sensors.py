"""SentraGrid Backend — Sensor & Zone API routes."""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.services.risk_engine import get_zone_risk_levels, evaluate_zone, evaluate_all_zones

router = APIRouter(prefix="/api", tags=["sensors"])


@router.get("/zones")
async def list_zones():
    """Get all zones with current risk levels."""
    try:
        db = get_db()
        zones = db.get_zones()
        risk_levels = get_zone_risk_levels()

        result = []
        for zone in zones:
            zone_data = {**zone}
            risk = risk_levels.get(zone["id"], {"level": "low", "score": 0})
            zone_data["risk_level"] = risk["level"]
            zone_data["risk_score"] = risk["score"]
            result.append(zone_data)

        return {"zones": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load zones: {exc}")


@router.get("/zones/{zone_id}")
async def get_zone_detail(zone_id: str):
    """Get detailed zone status including sensors, permits, workers, alerts."""
    db = get_db()
    zone = db.get_zone(zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    # Latest readings for this zone
    readings = db.get_latest_readings(zone_id=zone_id, limit=30)

    # Group readings by sensor type
    sensor_current: dict[str, dict] = {}
    for r in readings:
        st = r.get("sensor_type", "unknown")
        sensor_current[st] = r  # last one wins = most recent

    # Active permits
    permits = db.get_permits(status="active", zone_id=zone_id)

    # Workers
    workers = db.get_workers_in_zone(zone_id)

    # Recent alerts
    alerts = db.get_alerts(zone_id=zone_id, limit=10)

    # Risk level
    risk_levels = get_zone_risk_levels()
    risk = risk_levels.get(zone_id, {"level": "low", "score": 0})

    try:
        return {
            "zone": zone,
            "risk_level": risk["level"],
            "risk_score": risk["score"],
            "sensor_readings": sensor_current,
            "all_readings": readings[-20:],
            "active_permits": permits,
            "workers": workers,
            "recent_alerts": alerts,
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load zone detail: {exc}")


@router.get("/sensors/readings")
async def get_readings(
    zone_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Get recent sensor readings, optionally filtered by zone."""
    try:
        db = get_db()
        readings = db.get_latest_readings(zone_id=zone_id, limit=limit)
        return {"readings": readings}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load readings: {exc}")


@router.get("/sensors/{sensor_id}/history")
async def get_sensor_history(sensor_id: str, limit: int = Query(20, ge=1, le=100)):
    """Get reading history for a specific sensor."""
    try:
        db = get_db()
        history = db.get_sensor_history(sensor_id, limit=limit)
        return {"sensor_id": sensor_id, "history": history}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load sensor history: {exc}")


@router.get("/risk/levels")
async def get_risk_levels():
    """Get current risk levels for all zones (fast, no LLM)."""
    levels = get_zone_risk_levels()
    return {"risk_levels": levels}


@router.post("/risk/evaluate/{zone_id}")
async def evaluate_zone_risk(zone_id: str):
    """Evaluate compound risk for a zone (may call LLM)."""
    result = await evaluate_zone(zone_id)
    if not result:
        raise HTTPException(status_code=404, detail="Zone not found")
    return {"evaluation": result}


@router.post("/risk/evaluate-all")
async def evaluate_all_risk():
    """Evaluate all zones for compound risk."""
    try:
        results = await evaluate_all_zones()
        return {"evaluations": results}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to evaluate zones: {exc}")


@router.get("/workers/positions")
async def get_worker_positions():
    """Get current positions of all workers."""
    try:
        db = get_db()
        positions = db.get_current_worker_positions()
        return {"positions": positions}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load worker positions: {exc}")


class CustomReadingBody(BaseModel):
    sensor_id: str
    value: float


@router.post("/sensors/reading")
async def add_custom_reading(body: CustomReadingBody):
    """Add a custom sensor reading (What-If simulator)."""
    try:
        db = get_db()
        reading = db.add_sensor_reading(body.sensor_id, body.value)
        
        # Evaluate risk for the zone immediately after adding the reading
        await evaluate_zone(reading["zone_id"])
        
        return {"status": "ok", "reading": reading}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to add reading: {exc}")
