"""SentraGrid Backend — Permits API routes."""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, field_validator
from typing import Optional
from app.database import get_db
from app.services.permit_agent import evaluate_permit_request, issue_permit_with_override

router = APIRouter(prefix="/api/permits", tags=["permits"])


class PermitRequestBody(BaseModel):
    zone_id: str
    permit_type: str
    issued_by: str = "Safety Officer"

    @field_validator("zone_id", "permit_type", "issued_by")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Field cannot be empty")
        return value.strip()


class PermitOverrideBody(BaseModel):
    zone_id: str
    permit_type: str
    issued_by: str = "Safety Officer"
    justification: str

    @field_validator("zone_id", "permit_type", "issued_by")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Field cannot be empty")
        return value.strip()

    @field_validator("justification")
    @classmethod
    def validate_justification(cls, value: str) -> str:
        if not value or len(value.strip()) < 10:
            raise ValueError("Override requires at least 10 characters")
        return value.strip()


@router.get("")
async def list_permits(
    status: Optional[str] = Query(None),
    zone_id: Optional[str] = Query(None),
):
    """List permits with optional filters."""
    try:
        db = get_db()
        permits = db.get_permits(status=status, zone_id=zone_id)
        return {"permits": permits}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load permits: {exc}")


@router.post("/evaluate")
async def evaluate_permit(body: PermitRequestBody):
    """Evaluate a permit request against current conditions."""
    try:
        result = await evaluate_permit_request(
            zone_id=body.zone_id,
            permit_type=body.permit_type,
            issued_by=body.issued_by,
        )
        return {"evaluation": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Permit evaluation failed: {exc}")


@router.post("/issue")
async def issue_permit(body: PermitRequestBody):
    """Issue a permit (only if evaluation passes)."""
    # Permit intelligence gate runs before any insert.
    evaluation = await evaluate_permit_request(
        zone_id=body.zone_id,
        permit_type=body.permit_type,
        issued_by=body.issued_by,
    )

    if not evaluation["approved"]:
        return {
            "issued": False,
            "evaluation": evaluation,
            "message": "Permit blocked by safety evaluation. Use /override to issue with justification.",
        }

    # Issue the permit
    permit = await issue_permit_with_override(
        zone_id=body.zone_id,
        permit_type=body.permit_type,
        issued_by=body.issued_by,
    )

    # Evaluate zone immediately after issuing permit
    from app.services.risk_engine import evaluate_zone
    await evaluate_zone(body.zone_id)

    return {"issued": True, "permit": permit}


@router.post("/override")
async def override_permit(body: PermitOverrideBody):
    """Issue a permit with safety override (requires justification)."""
    permit = await issue_permit_with_override(
        zone_id=body.zone_id,
        permit_type=body.permit_type,
        issued_by=body.issued_by,
        justification=body.justification,
    )

    # Evaluate zone immediately after issuing permit
    from app.services.risk_engine import evaluate_zone
    await evaluate_zone(body.zone_id)

    return {
        "issued": True,
        "permit": permit,
        "override_logged": True,
        "message": f"Permit issued with override. Justification recorded against officer: {body.issued_by}.",
    }


@router.post("/{permit_id}/close")
async def close_permit(permit_id: str):
    """Close/cancel a permit."""
    db = get_db()
    permit = db.update_permit_status(permit_id, "closed")
    if not permit:
        raise HTTPException(status_code=404, detail="Permit not found")

    # Evaluate zone immediately after closing permit
    from app.services.risk_engine import evaluate_zone
    await evaluate_zone(permit["zone_id"])

    return {"permit": permit}
