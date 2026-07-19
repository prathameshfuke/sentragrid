"""SentraGrid Backend — Compound Risk Detection Engine."""

import json
from typing import Optional
from app.database import get_db
from app.services.llm_client import call_llm


# ── Thresholds ──

THRESHOLDS = {
    "gas_h2s": {"warning": 7.0, "critical": 10.0, "unit": "ppm"},
    "gas_co": {"warning": 25.0, "critical": 35.0, "unit": "ppm"},
    "temperature": {"warning": 350.0, "critical": 450.0, "unit": "°C"},
    "pressure": {"warning": 150.0, "critical": 200.0, "unit": "kPa"},
}

# Permit conflict matrix: (permit_type, zone_type) → risk multiplier
CONFLICT_MATRIX = {
    ("hot_work", "confined_space"): 3.0,
    ("hot_work", "storage"): 2.5,
    ("hot_work", "hot_work_area"): 1.5,
    ("confined_space_entry", "confined_space"): 1.5,
    ("confined_space_entry", "storage"): 2.0,
    ("electrical", "electrical"): 1.0,
}

# Adjacent zone pairs
ADJACENT_ZONES = {
    "zone-coke-oven": ["zone-byproduct", "zone-tank-farm"],
    "zone-byproduct": ["zone-coke-oven", "zone-gas-holder"],
    "zone-gas-holder": ["zone-byproduct", "zone-electrical"],
    "zone-tank-farm": ["zone-coke-oven", "zone-workshop", "zone-water-treatment"],
    "zone-workshop": ["zone-tank-farm", "zone-electrical", "zone-control-room"],
    "zone-electrical": ["zone-gas-holder", "zone-workshop", "zone-loading-bay"],
    "zone-control-room": ["zone-workshop", "zone-loading-bay", "zone-water-treatment"],
    "zone-loading-bay": ["zone-electrical", "zone-control-room", "zone-admin"],
    "zone-water-treatment": ["zone-tank-farm", "zone-control-room"],
    "zone-admin": ["zone-loading-bay"],
}


def get_adjacent_zones(zone_id: str) -> list[str]:
    return ADJACENT_ZONES.get(zone_id, [])


def _detect_trend(readings: list[dict]) -> str:
    """Detect rising/falling/stable trend from last N readings."""
    if len(readings) < 3:
        return "insufficient_data"
    values = [r["value"] for r in readings[-3:]]
    if values[-1] > values[-2] > values[-3]:
        return "rising"
    elif values[-1] < values[-2] < values[-3]:
        return "falling"
    return "stable"


def _get_zone_risk_score(zone_id: str) -> dict:
    """Calculate risk score for a zone based on current conditions."""
    db = get_db()
    zone = db.get_zone(zone_id)
    if not zone:
        return {"score": 0, "level": "low", "factors": []}

    score = 0.0
    factors = []

    # Get sensors for this zone
    sensors = db.get_sensors(zone_id)
    sensor_readings = {}

    for sensor in sensors:
        history = db.get_sensor_history(sensor["id"], limit=5)
        if not history:
            continue

        latest = history[-1]
        sensor_type = sensor["sensor_type"]
        value = latest["value"]
        sensor_readings[sensor_type] = {
            "value": value,
            "trend": _detect_trend(history),
            "history": [r["value"] for r in history],
        }

        threshold = THRESHOLDS.get(sensor_type, {})
        if not threshold:
            continue

        # Check absolute thresholds
        if value >= threshold.get("critical", float("inf")):
            score += 40
            factors.append(f"{sensor_type} at {value} {threshold['unit']} (CRITICAL threshold: {threshold['critical']})")
        elif value >= threshold.get("warning", float("inf")):
            score += 20
            factors.append(f"{sensor_type} at {value} {threshold['unit']} (WARNING threshold: {threshold['warning']})")

        # Check trend
        trend = sensor_readings[sensor_type]["trend"]
        if trend == "rising" and value >= threshold.get("warning", float("inf")) * 0.6:
            score += 10
            factors.append(f"{sensor_type} showing rising trend (current: {value})")

    # Check active permits (compound risk)
    active_permits = db.get_permits(status="active", zone_id=zone_id)
    for permit in active_permits:
        permit_type = permit["permit_type"]
        zone_type = zone.get("zone_type", "general")
        conflict_key = (permit_type, zone_type)
        multiplier = CONFLICT_MATRIX.get(conflict_key, 1.0)
        if multiplier > 1.0:
            score *= multiplier
            factors.append(f"Active {permit_type} permit in {zone_type} zone (risk multiplier: {multiplier}x)")

    # Check workers in zone (exposure risk)
    workers = db.get_workers_in_zone(zone_id)
    if workers and score > 10:
        worker_count = len(workers)
        score += worker_count * 2
        factors.append(f"{worker_count} worker(s) present in elevated-risk zone")

    # Check adjacent zone conditions
    for adj_zone_id in get_adjacent_zones(zone_id):
        adj_permits = db.get_permits(status="active", zone_id=adj_zone_id)
        for adj_permit in adj_permits:
            if adj_permit["permit_type"] in ("hot_work", "confined_space_entry"):
                score += 5
                adj_zone = db.get_zone(adj_zone_id)
                adj_name = adj_zone["name"] if adj_zone else adj_zone_id
                factors.append(f"Active {adj_permit['permit_type']} permit in adjacent zone: {adj_name}")

    # Determine level
    if score >= 60:
        level = "critical"
    elif score >= 30:
        level = "high"
    elif score >= 15:
        level = "medium"
    else:
        level = "low"

    return {
        "score": round(score, 1),
        "level": level,
        "factors": factors,
        "sensor_readings": sensor_readings,
        "active_permits": [p["permit_type"] for p in active_permits],
        "worker_count": len(db.get_workers_in_zone(zone_id)),
    }


def _build_triggering_factors(risk: dict) -> dict:
    factors: dict = {
        "risk_score": risk.get("score"),
        "risk_level": risk.get("level"),
        "active_permits": risk.get("active_permits", []),
        "worker_count": risk.get("worker_count", 0),
    }
    for sensor_type, reading in risk.get("sensor_readings", {}).items():
        factors[sensor_type] = {
            "value": reading.get("value"),
            "trend": reading.get("trend"),
            "history": reading.get("history", []),
        }
    if risk.get("factors"):
        factors["compound_factors"] = risk["factors"][:5]
    return factors


async def evaluate_zone(zone_id: str) -> Optional[dict]:
    """Evaluate a zone for compound risk and generate alert if needed."""
    db = get_db()
    zone = db.get_zone(zone_id)
    if not zone:
        return None

    risk = _get_zone_risk_score(zone_id)

    if risk["level"] not in ("high", "critical"):
        return {
            "zone_id": zone_id,
            "risk_level": risk["level"],
            "score": risk["score"],
            "should_alert": False,
        }

    # Build context for LLM reasoning
    severity = "critical" if risk["level"] == "critical" else "warning"

    context = {
        "zone_name": zone["name"],
        "zone_type": zone.get("zone_type", "general"),
        "risk_score": risk["score"],
        "risk_factors": risk["factors"],
        "sensor_readings": risk["sensor_readings"],
        "active_permits": risk["active_permits"],
        "worker_count": risk["worker_count"],
        "adjacent_zones": get_adjacent_zones(zone_id),
    }

    system_prompt = """You are a compound-risk analyst for an industrial steel plant. 
Given the current zone conditions, analyze whether these conditions create a dangerous combination.
Consider: gas concentrations, temperature, pressure, active work permits, worker presence, and adjacent zone activities.
Think step-by-step about what could go wrong if these conditions persist or worsen.

Output a JSON object with these fields:
- severity: "warning" or "critical"
- title: a concise alert title (instrument-like, factual tone)
- explanation: a clear, technical explanation of why these combined conditions are dangerous (2-3 sentences)
- should_alert: boolean
- triggering_factors: an object with the key measurements/conditions that combined to create this risk, which MUST also include:
  * confidence_score: a float between 0.0 and 1.0 representing your confidence in this risk assessment (e.g. 0.85)
  * prediction_lead_time_min: an integer representing estimated minutes before these conditions escalate to a full incident threshold (e.g., 15-45)
  * single_sensor_missed: a boolean indicating if standard single-sensor threshold alarms would have missed this risk (i.e. all individual sensor values are below their absolute critical thresholds, but the compound risk is high)
  * lead_time_advantage_min: an integer representing how many minutes earlier this compound alert is raised compared to when a standard threshold would be breached (e.g., 10-30)"""

    user_prompt = f"Current zone state:\n{json.dumps(context, indent=2)}"

    try:
        llm_response = await call_llm(system_prompt, user_prompt, json_mode=True)
        result = json.loads(llm_response)
    except Exception as e:
        print(f"[RiskEngine] LLM call failed, using rule-based alert: {e}")
        
        # Calculate dynamic fallback values
        single_sensor_missed = True
        for sensor_type, reading in risk.get("sensor_readings", {}).items():
            threshold = THRESHOLDS.get(sensor_type, {})
            if threshold and reading.get("value", 0) >= threshold.get("critical", 999999):
                single_sensor_missed = False
                break

        score_val = risk.get("score", 0)
        confidence = round(min(0.95, 0.5 + score_val / 200.0), 2)
        lead_time = max(10, 45 - int(score_val / 3))
        advantage = max(5, 30 - int(score_val / 4))

        result = {
            "severity": severity,
            "title": f"Compound risk detected in {zone['name']}",
            "explanation": "Multiple risk factors detected simultaneously: " + "; ".join(risk["factors"][:3]),
            "triggering_factors": {
                "confidence_score": confidence,
                "prediction_lead_time_min": lead_time,
                "single_sensor_missed": single_sensor_missed,
                "lead_time_advantage_min": advantage,
                "factors_summary": risk["factors"][:5]
            },
            "should_alert": True,
        }

    # Normalize triggering factors to always contain concrete measured context.
    merged_factors = _build_triggering_factors(risk)
    llm_factors = result.get("triggering_factors")
    if isinstance(llm_factors, dict):
        merged_factors.update(llm_factors)
    result["triggering_factors"] = merged_factors

    # Avoid duplicate open alerts for persistent unchanged risk.
    should_create_alert = bool(result.get("should_alert", True))
    if should_create_alert:
        existing_open = db.get_alerts(status="open", zone_id=zone_id, limit=10)
        duplicate = next(
            (
                alert for alert in existing_open
                if alert.get("severity") == result.get("severity", severity)
                and alert.get("title") == result.get("title", "")
            ),
            None,
        )
        should_create_alert = duplicate is None

    # Create alert only when a new distinct condition appears.
    if should_create_alert:
        alert = db.create_alert(
            zone_id=zone_id,
            severity=result.get("severity", severity),
            title=result.get("title", f"Risk alert in {zone['name']}"),
            explanation=result.get("explanation", ""),
            triggering_factors=merged_factors,
        )
        result["alert"] = alert
    else:
        result["alert"] = None

    result["zone_id"] = zone_id
    result["risk_level"] = risk["level"]
    result["score"] = risk["score"]
    return result


async def evaluate_all_zones() -> list[dict]:
    """Evaluate all zones and return results."""
    db = get_db()
    zones = db.get_zones()
    results = []
    for zone in zones:
        result = await evaluate_zone(zone["id"])
        if result:
            results.append(result)
    return results


def get_zone_risk_levels() -> dict[str, dict]:
    """Get current risk level for all zones (no LLM call, fast)."""
    db = get_db()
    zones = db.get_zones()
    levels = {}
    for zone in zones:
        risk = _get_zone_risk_score(zone["id"])
        levels[zone["id"]] = {
            "level": risk["level"],
            "score": risk["score"],
            "factors_count": len(risk["factors"]),
        }
    return levels
