"""SentraGrid Backend — Simulator API routes + SSE streaming."""

import asyncio
import json
import time
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from app.database import get_db
from app.services.simulator import get_simulator

router = APIRouter(prefix="/api/simulator", tags=["simulator"])


@router.get("/status")
async def simulator_status():
    """Get current simulator status."""
    sim = get_simulator()
    return sim.status()


@router.post("/start-normal")
async def start_normal():
    """Start normal mode simulation."""
    try:
        sim = get_simulator()
        await sim.start_normal()
        return {"message": "Normal simulation started", "status": sim.status()}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to start normal simulation: {exc}")


@router.post("/start-demo")
async def start_demo():
    """Start the scripted demo sequence."""
    try:
        sim = get_simulator()
        await sim.start_demo()
        return {"message": "Demo sequence started", "status": sim.status()}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to start demo simulation: {exc}")


@router.post("/stop")
async def stop_simulator():
    """Stop the simulator."""
    try:
        sim = get_simulator()
        await sim.stop()
        return {"message": "Simulator stopped", "status": sim.status()}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to stop simulator: {exc}")


@router.get("/stream")
async def event_stream(request: Request):
    """SSE endpoint for real-time updates."""
    
    async def generate():
        db = get_db()
        event_queue: asyncio.Queue = asyncio.Queue()

        def on_event(event_type: str, data: dict):
            try:
                event_queue.put_nowait({"type": event_type, "data": data})
            except asyncio.QueueFull:
                pass

        # Subscribe to events
        db.on("sensor_readings", on_event)
        db.on("alerts", on_event)
        db.on("worker_positions", on_event)
        db.on("permits", on_event)

        try:
            while True:
                if await request.is_disconnected():
                    break

                try:
                    event = await asyncio.wait_for(event_queue.get(), timeout=2.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive
                    sim = get_simulator()
                    keepalive = {
                        "type": "keepalive",
                        "data": {
                            "timestamp": time.time(),
                            "simulator": sim.status(),
                        }
                    }
                    yield f"data: {json.dumps(keepalive)}\n\n"
        finally:
            db.off("sensor_readings", on_event)
            db.off("alerts", on_event)
            db.off("worker_positions", on_event)
            db.off("permits", on_event)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Dashboard KPIs ──

@router.get("/dashboard")
async def dashboard_kpis():
    """Get dashboard KPI summary."""
    db = get_db()
    sim = get_simulator()

    open_alerts = db.get_alerts(status="open")
    active_permits = db.get_permits(status="active")
    worker_positions = db.get_current_worker_positions()

    # Count elevated zones
    from app.services.risk_engine import get_zone_risk_levels
    risk_levels = get_zone_risk_levels()
    elevated = sum(1 for r in risk_levels.values() if r["level"] in ("medium", "high", "critical"))

    critical_count = sum(1 for a in open_alerts if a["severity"] == "critical")
    warning_count = sum(1 for a in open_alerts if a["severity"] == "warning")

    return {
        "kpis": {
            "open_alerts": len(open_alerts),
            "critical_alerts": critical_count,
            "warning_alerts": warning_count,
            "active_permits": len(active_permits),
            "elevated_zones": elevated,
            "workers_on_site": len(worker_positions),
        },
        "simulator": sim.status(),
    }
