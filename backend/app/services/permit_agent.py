"""SentraGrid Backend — Digital Permit Intelligence Agent."""

import json
from typing import Optional
from app.database import get_db
from app.services.llm_client import call_llm
from app.services.risk_engine import (
    _get_zone_risk_score,
    get_adjacent_zones,
    THRESHOLDS,
)


# Permit conflict pairs — if both types are active in same/adjacent zones, flag
PERMIT_CONFLICTS = {
    frozenset(["hot_work", "confined_space_entry"]): "critical",
    frozenset(["hot_work", "hot_work"]): "warning",
    frozenset(["confined_space_entry", "confined_space_entry"]): "warning",
    frozenset(["electrical", "hot_work"]): "warning",
}


async def evaluate_permit_request(
    zone_id: str,
    permit_type: str,
    issued_by: str = "Safety Officer",
) -> dict:
    """Evaluate a permit request against current plant conditions.
    
    Returns approval/denial recommendation with reasoning.
    """
    db = get_db()
    zone = db.get_zone(zone_id)
    if not zone:
        return {
            "approved": False,
            "conflicts": ["Zone not found"],
            "recommendation": "Invalid zone specified.",
            "override_allowed": False,
            "risk_level": "unknown",
        }

    conflicts = []
    risk_level = "low"

    # 1. Check current zone risk
    zone_risk = _get_zone_risk_score(zone_id)
    if zone_risk["level"] in ("critical", "high"):
        risk_level = zone_risk["level"]
        conflicts.append(
            f"Zone '{zone['name']}' is currently at {zone_risk['level']} risk level "
            f"(score: {zone_risk['score']})"
        )
        for factor in zone_risk["factors"][:3]:
            conflicts.append(f"  → {factor}")

    # 2. Check sensor readings for the specific permit type
    sensors = db.get_sensors(zone_id)
    for sensor in sensors:
        history = db.get_sensor_history(sensor["id"], limit=5)
        if not history:
            continue
        latest_value = history[-1]["value"]
        sensor_type = sensor["sensor_type"]
        threshold = THRESHOLDS.get(sensor_type, {})

        # Hot work + gas readings
        if permit_type == "hot_work" and sensor_type in ("gas_h2s", "gas_co"):
            if latest_value >= threshold.get("warning", float("inf")) * 0.6:
                conflicts.append(
                    f"{sensor_type} reading at {latest_value} {threshold.get('unit', '')} — "
                    f"elevated for hot work authorization "
                    f"(warning threshold: {threshold.get('warning')})"
                )
                risk_level = max(risk_level, "medium", key=lambda x: ["low", "medium", "high", "critical"].index(x))

            # Check trend
            if len(history) >= 3:
                values = [r["value"] for r in history[-3:]]
                if values[-1] > values[-2] > values[-3]:
                    conflicts.append(
                        f"{sensor_type} shows rising trend: "
                        f"{' → '.join(str(v) for v in values)}"
                    )

        # Confined space entry + oxygen/gas
        if permit_type == "confined_space_entry" and sensor_type in ("gas_h2s", "gas_co"):
            if latest_value >= threshold.get("warning", float("inf")) * 0.5:
                conflicts.append(
                    f"{sensor_type} at {latest_value} — elevated for confined space entry"
                )
                risk_level = max(risk_level, "medium", key=lambda x: ["low", "medium", "high", "critical"].index(x))

    # 3. Check active permits in same zone
    active_permits = db.get_permits(status="active", zone_id=zone_id)
    for existing in active_permits:
        pair = frozenset([permit_type, existing["permit_type"]])
        if pair in PERMIT_CONFLICTS:
            severity = PERMIT_CONFLICTS[pair]
            conflicts.append(
                f"Active {existing['permit_type']} permit already exists in this zone "
                f"(conflict severity: {severity})"
            )
            if severity == "critical":
                risk_level = "critical"
            else:
                risk_level = max(risk_level, "high", key=lambda x: ["low", "medium", "high", "critical"].index(x))

    # 4. Check adjacent zones
    for adj_zone_id in get_adjacent_zones(zone_id):
        adj_permits = db.get_permits(status="active", zone_id=adj_zone_id)
        adj_zone = db.get_zone(adj_zone_id)
        adj_name = adj_zone["name"] if adj_zone else adj_zone_id
        for adj_permit in adj_permits:
            pair = frozenset([permit_type, adj_permit["permit_type"]])
            if pair in PERMIT_CONFLICTS:
                severity = PERMIT_CONFLICTS[pair]
                conflicts.append(
                    f"Active {adj_permit['permit_type']} permit in adjacent zone "
                    f"'{adj_name}' — cross-zone conflict"
                )
                if severity == "critical":
                    risk_level = max(risk_level, "high", key=lambda x: ["low", "medium", "high", "critical"].index(x))
                else:
                    risk_level = max(risk_level, "medium", key=lambda x: ["low", "medium", "high", "critical"].index(x))

        # Check adjacent zone risk level and gas trend for hot work
        adj_risk = _get_zone_risk_score(adj_zone_id)
        if adj_risk["level"] in ("critical", "high"):
            conflicts.append(
                f"Adjacent zone '{adj_name}' is currently at {adj_risk['level']} risk level "
                f"(score: {adj_risk['score']})"
            )
            if adj_risk["level"] == "critical":
                risk_level = max(risk_level, "high", key=lambda x: ["low", "medium", "high", "critical"].index(x))
            else:
                risk_level = max(risk_level, "medium", key=lambda x: ["low", "medium", "high", "critical"].index(x))

        if permit_type == "hot_work":
            adj_sensors = db.get_sensors(adj_zone_id)
            for sensor in adj_sensors:
                sensor_type = sensor["sensor_type"]
                if sensor_type in ("gas_h2s", "gas_co"):
                    history = db.get_sensor_history(sensor["id"], limit=3)
                    if history:
                        latest_val = history[-1]["value"]
                        threshold = THRESHOLDS.get(sensor_type, {})
                        if latest_val >= threshold.get("warning", float("inf")) * 0.6:
                            conflicts.append(
                                f"Elevated {sensor_type} ({latest_val} {threshold.get('unit', '')}) "
                                f"detected in adjacent zone '{adj_name}'"
                            )
                            risk_level = max(risk_level, "medium", key=lambda x: ["low", "medium", "high", "critical"].index(x))
                        if len(history) >= 2:
                            values = [r["value"] for r in history]
                            if values[-1] > values[-2]:
                                conflicts.append(
                                    f"Rising {sensor_type} trend in adjacent zone '{adj_name}': "
                                    f"{' → '.join(str(v) for v in values)}"
                                )

    # 5. Decision
    approved = len(conflicts) == 0

    # If conflicts exist, get LLM-generated recommendation
    recommendation = ""
    if conflicts:
        context = {
            "zone_name": zone["name"],
            "zone_type": zone.get("zone_type", "general"),
            "requested_permit": permit_type,
            "requested_by": issued_by,
            "conflicts": conflicts,
            "risk_level": risk_level,
            "zone_risk_score": zone_risk["score"],
        }

        system_prompt = """You are a Digital Permit Intelligence Agent for an industrial safety system.
A safety officer has requested a new permit. Based on the detected conflicts, provide a clear, 
technical recommendation. Use an authoritative, instrument-like tone — not conversational.
Reference relevant safety standards (OISD-105, Factory Act) where applicable.

Output JSON with:
- recommendation: a 2-3 sentence technical recommendation
- override_allowed: boolean (false only if conditions are immediately dangerous to life)
- risk_level: "low", "medium", "high", or "critical"
"""
        user_prompt = f"Permit evaluation context:\n{json.dumps(context, indent=2)}"

        try:
            llm_response = await call_llm(system_prompt, user_prompt, json_mode=True)
            llm_result = json.loads(llm_response)
            recommendation = llm_result.get("recommendation", "")
            risk_level = llm_result.get("risk_level", risk_level)
        except Exception as e:
            print(f"[PermitAgent] LLM failed: {e}")
            recommendation = (
                f"Permit issuance not recommended due to {len(conflicts)} conflict(s) detected. "
                f"Current zone risk level: {risk_level}. "
                f"Review conflicts below before proceeding. "
                f"Per OISD-105, atmospheric conditions must be verified before authorization."
            )
    else:
        recommendation = (
            f"Zone conditions are within acceptable parameters for {permit_type} permit. "
            f"Standard precautions apply per OISD-105."
        )

    return {
        "approved": approved,
        "conflicts": conflicts,
        "recommendation": recommendation,
        "override_allowed": risk_level != "critical",
        "risk_level": risk_level,
    }


async def issue_permit_with_override(
    zone_id: str,
    permit_type: str,
    issued_by: str,
    justification: str = "",
) -> dict:
    """Issue a permit, optionally with override justification."""
    db = get_db()

    permit = db.create_permit(
        zone_id=zone_id,
        permit_type=permit_type,
        issued_by=issued_by,
    )

    if justification:
        # Log the override
        permit["override"] = {
            "justification": justification,
            "officer": issued_by,
            "timestamp": permit["issued_at"],
        }

    return permit
