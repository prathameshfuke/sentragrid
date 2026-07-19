"""SentraGrid Backend — Database layer with mock mode support."""

import json
import uuid
import os
from datetime import datetime, timezone
from typing import Optional
from pathlib import Path

from app.config import settings


# ── Mock In-Memory Store ──

class MockStore:
    """In-memory data store for development without Supabase."""

    def __init__(self):
        self.zones: dict[str, dict] = {}
        self.sensors: dict[str, dict] = {}
        self.sensor_readings: list[dict] = []
        self.permits: dict[str, dict] = {}
        self.workers: dict[str, dict] = {}
        self.worker_positions: list[dict] = []
        self.alerts: dict[str, dict] = {}
        self.incident_reports: list[dict] = []
        self._reading_counter = 0
        self._position_counter = 0
        self._event_listeners: dict[str, list] = {}
        self._load_seed_data()

    def _load_seed_data(self):
        seed_dir = Path(__file__).parent / "seed"

        # Load zones
        zones_file = seed_dir / "zones.json"
        if zones_file.exists():
            for z in json.loads(zones_file.read_text()):
                self.zones[z["id"]] = z

        # Load sensors
        sensors_file = seed_dir / "sensors.json"
        if sensors_file.exists():
            for s in json.loads(sensors_file.read_text()):
                self.sensors[s["id"]] = s

        # Load workers
        workers_file = seed_dir / "workers.json"
        if workers_file.exists():
            for w in json.loads(workers_file.read_text()):
                self.workers[w["id"]] = w

        # Load incidents
        incidents_file = seed_dir / "incidents.json"
        if incidents_file.exists():
            self.incident_reports = json.loads(incidents_file.read_text())

    def now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # ── Zones ──

    def get_zones(self) -> list[dict]:
        return list(self.zones.values())

    def get_zone(self, zone_id: str) -> Optional[dict]:
        return self.zones.get(zone_id)

    # ── Sensors ──

    def get_sensors(self, zone_id: Optional[str] = None) -> list[dict]:
        sensors = list(self.sensors.values())
        if zone_id:
            sensors = [s for s in sensors if s["zone_id"] == zone_id]
        return sensors

    def add_sensor_reading(self, sensor_id: str, value: float) -> dict:
        self._reading_counter += 1
        sensor = self.sensors.get(sensor_id, {})
        reading = {
            "id": self._reading_counter,
            "sensor_id": sensor_id,
            "value": round(value, 2),
            "recorded_at": self.now_iso(),
            "zone_id": sensor.get("zone_id", ""),
            "sensor_type": sensor.get("sensor_type", ""),
        }
        self.sensor_readings.append(reading)
        # Keep only last 500 readings
        if len(self.sensor_readings) > 500:
            self.sensor_readings = self.sensor_readings[-500:]
        self._emit("sensor_readings", reading)
        return reading

    def get_latest_readings(self, zone_id: Optional[str] = None, limit: int = 50) -> list[dict]:
        readings = self.sensor_readings
        if zone_id:
            readings = [r for r in readings if r.get("zone_id") == zone_id]
        return readings[-limit:]

    def get_sensor_history(self, sensor_id: str, limit: int = 10) -> list[dict]:
        readings = [r for r in self.sensor_readings if r["sensor_id"] == sensor_id]
        return readings[-limit:]

    # ── Permits ──

    def get_permits(self, status: Optional[str] = None, zone_id: Optional[str] = None) -> list[dict]:
        permits = list(self.permits.values())
        if status:
            permits = [p for p in permits if p["status"] == status]
        if zone_id:
            permits = [p for p in permits if p["zone_id"] == zone_id]
        return sorted(permits, key=lambda p: p.get("issued_at", ""), reverse=True)

    def create_permit(self, zone_id: str, permit_type: str, issued_by: str = "Safety Officer") -> dict:
        permit_id = str(uuid.uuid4())
        zone = self.zones.get(zone_id, {})
        permit = {
            "id": permit_id,
            "zone_id": zone_id,
            "permit_type": permit_type,
            "status": "active",
            "issued_by": issued_by,
            "issued_at": self.now_iso(),
            "valid_until": "",
            "zone_name": zone.get("name", "Unknown"),
        }
        self.permits[permit_id] = permit
        self._emit("permits", permit)
        return permit

    def update_permit_status(self, permit_id: str, status: str) -> Optional[dict]:
        if permit_id in self.permits:
            self.permits[permit_id]["status"] = status
            return self.permits[permit_id]
        return None

    # ── Workers ──

    def get_workers(self) -> list[dict]:
        return list(self.workers.values())

    def update_worker_position(self, worker_id: str, zone_id: str) -> dict:
        self._position_counter += 1
        worker = self.workers.get(worker_id, {})
        pos = {
            "id": self._position_counter,
            "worker_id": worker_id,
            "zone_id": zone_id,
            "recorded_at": self.now_iso(),
            "worker_name": worker.get("name", "Unknown"),
        }
        self.worker_positions.append(pos)
        if len(self.worker_positions) > 200:
            self.worker_positions = self.worker_positions[-200:]
        self._emit("worker_positions", pos)
        return pos

    def get_current_worker_positions(self) -> list[dict]:
        """Get most recent position for each worker."""
        latest: dict[str, dict] = {}
        for pos in self.worker_positions:
            latest[pos["worker_id"]] = pos
        return list(latest.values())

    def get_workers_in_zone(self, zone_id: str) -> list[dict]:
        positions = self.get_current_worker_positions()
        return [p for p in positions if p["zone_id"] == zone_id]

    # ── Alerts ──

    def create_alert(self, zone_id: str, severity: str, title: str,
                     explanation: str, triggering_factors: dict = None) -> dict:
        alert_id = str(uuid.uuid4())
        zone = self.zones.get(zone_id, {})
        alert = {
            "id": alert_id,
            "zone_id": zone_id,
            "severity": severity,
            "title": title,
            "explanation": explanation,
            "triggering_factors": triggering_factors or {},
            "status": "open",
            "created_at": self.now_iso(),
            "zone_name": zone.get("name", "Unknown"),
        }
        self.alerts[alert_id] = alert
        # Keep only the last 100 alerts to prevent memory leaks
        if len(self.alerts) > 100:
            sorted_keys = sorted(self.alerts.keys(), key=lambda k: self.alerts[k].get("created_at", ""))
            for old_key in sorted_keys[:len(self.alerts) - 100]:
                self.alerts.pop(old_key, None)
        self._emit("alerts", alert)
        return alert

    def get_alerts(self, status: Optional[str] = None, severity: Optional[str] = None,
                   zone_id: Optional[str] = None, limit: int = 50) -> list[dict]:
        alerts = list(self.alerts.values())
        if status:
            alerts = [a for a in alerts if a["status"] == status]
        if severity:
            alerts = [a for a in alerts if a["severity"] == severity]
        if zone_id:
            alerts = [a for a in alerts if a["zone_id"] == zone_id]
        return sorted(alerts, key=lambda a: a.get("created_at", ""), reverse=True)[:limit]

    def update_alert_status(self, alert_id: str, status: str) -> Optional[dict]:
        if alert_id in self.alerts:
            self.alerts[alert_id]["status"] = status
            return self.alerts[alert_id]
        return None

    # ── Incident Reports ──

    def get_incident_reports(self) -> list[dict]:
        return self.incident_reports

    # ── Event System (for SSE) ──

    def on(self, event: str, callback):
        if event not in self._event_listeners:
            self._event_listeners[event] = []
        self._event_listeners[event].append(callback)

    def off(self, event: str, callback):
        if event in self._event_listeners:
            self._event_listeners[event] = [
                cb for cb in self._event_listeners[event] if cb != callback
            ]

    def _emit(self, event: str, data: dict):
        for callback in self._event_listeners.get(event, []):
            try:
                callback(event, data)
            except Exception:
                pass


# ── Singleton ──

_mock_store: Optional[MockStore] = None


def get_mock_store() -> MockStore:
    global _mock_store
    if _mock_store is None:
        _mock_store = MockStore()
    return _mock_store


def reset_mock_store():
    """Reset the mock store (useful for demo restart)."""
    global _mock_store
    _mock_store = MockStore()
    return _mock_store


def get_db():
    """Get the database interface. Returns MockStore in mock mode."""
    return get_mock_store()
