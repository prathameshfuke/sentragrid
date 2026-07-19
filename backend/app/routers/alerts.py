"""SentraGrid Backend — Alerts API routes."""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.database import get_db

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    zone_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """List alerts with optional filters."""
    try:
        db = get_db()
        alerts = db.get_alerts(status=status, severity=severity, zone_id=zone_id, limit=limit)
        return {"alerts": alerts}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load alerts: {exc}")


@router.get("/recent")
async def recent_alerts(limit: int = Query(10, ge=1, le=50)):
    """Get most recent alerts across all zones."""
    try:
        db = get_db()
        alerts = db.get_alerts(limit=limit)
        return {"alerts": alerts}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load recent alerts: {exc}")


@router.get("/open")
async def open_alerts():
    """Get all open alerts."""
    try:
        db = get_db()
        alerts = db.get_alerts(status="open")

        critical = [a for a in alerts if a["severity"] == "critical"]
        warnings = [a for a in alerts if a["severity"] == "warning"]
        info = [a for a in alerts if a["severity"] == "info"]

        return {
            "alerts": alerts,
            "counts": {
                "total": len(alerts),
                "critical": len(critical),
                "warning": len(warnings),
                "info": len(info),
            }
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load open alerts: {exc}")


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert."""
    db = get_db()
    alert = db.update_alert_status(alert_id, "acknowledged")
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"alert": alert}


@router.post("/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    """Resolve an alert."""
    db = get_db()
    alert = db.update_alert_status(alert_id, "resolved")
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"alert": alert}
