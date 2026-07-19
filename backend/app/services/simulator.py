"""SentraGrid Backend — Synthetic Data Simulator."""

import asyncio
import random
import time
from typing import Optional
from app.database import get_db, reset_mock_store
from app.services.risk_engine import evaluate_zone, evaluate_all_zones


# ── Baseline sensor values ──

SENSOR_BASELINES = {
    "sensor-coke-h2s": {"base": 3.0, "noise": 1.0},
    "sensor-coke-co": {"base": 12.0, "noise": 3.0},
    "sensor-coke-temp": {"base": 280.0, "noise": 15.0},
    "sensor-byproduct-h2s": {"base": 2.0, "noise": 0.8},
    "sensor-byproduct-co": {"base": 8.0, "noise": 2.0},
    "sensor-byproduct-temp": {"base": 45.0, "noise": 5.0},
    "sensor-gas-holder-h2s": {"base": 1.5, "noise": 0.5},
    "sensor-gas-holder-pressure": {"base": 85.0, "noise": 5.0},
    "sensor-gas-holder-temp": {"base": 35.0, "noise": 3.0},
    "sensor-tank-h2s": {"base": 1.0, "noise": 0.5},
    "sensor-tank-co": {"base": 5.0, "noise": 2.0},
    "sensor-tank-temp": {"base": 42.0, "noise": 3.0},
    "sensor-workshop-co": {"base": 3.0, "noise": 1.5},
    "sensor-workshop-temp": {"base": 32.0, "noise": 4.0},
    "sensor-electrical-temp": {"base": 38.0, "noise": 3.0},
    "sensor-electrical-pressure": {"base": 101.0, "noise": 2.0},
    "sensor-control-temp": {"base": 24.0, "noise": 1.0},
    "sensor-loading-co": {"base": 4.0, "noise": 2.0},
    "sensor-loading-temp": {"base": 35.0, "noise": 4.0},
    "sensor-water-temp": {"base": 28.0, "noise": 2.0},
    "sensor-water-pressure": {"base": 95.0, "noise": 3.0},
}

# Worker initial zone assignments
WORKER_ZONES = {
    "worker-01": "zone-control-room",
    "worker-02": "zone-coke-oven",
    "worker-03": "zone-coke-oven",
    "worker-04": "zone-electrical",
    "worker-05": "zone-workshop",
    "worker-06": "zone-byproduct",
    "worker-07": "zone-control-room",
    "worker-08": "zone-gas-holder",
    "worker-09": "zone-tank-farm",
    "worker-10": "zone-loading-bay",
    "worker-11": "zone-admin",
    "worker-12": "zone-water-treatment",
}

ALL_ZONE_IDS = [
    "zone-coke-oven", "zone-byproduct", "zone-gas-holder", "zone-tank-farm",
    "zone-workshop", "zone-electrical", "zone-control-room", "zone-loading-bay",
    "zone-water-treatment", "zone-admin",
]


class Simulator:
    def __init__(self):
        self.running = False
        self.mode = "idle"  # idle, normal, demo
        self.phase = 0
        self.phase_description = ""
        self.start_time = 0.0
        self._task: Optional[asyncio.Task] = None
        self._overrides: dict[str, float] = {}  # sensor_id -> override value

    @property
    def elapsed(self) -> float:
        if self.start_time == 0:
            return 0
        return time.time() - self.start_time

    def status(self) -> dict:
        return {
            "running": self.running,
            "mode": self.mode,
            "phase": self.phase,
            "phase_description": self.phase_description,
            "elapsed_seconds": round(self.elapsed, 1),
        }

    async def start_normal(self):
        """Start normal simulation — random plausible data."""
        if self.running:
            await self.stop()
        self.running = True
        self.mode = "normal"
        self.phase = 0
        self.phase_description = "Normal operations"
        self.start_time = time.time()
        self._overrides = {}
        self._task = asyncio.create_task(self._run_normal())

    async def start_demo(self):
        """Start the scripted demo sequence."""
        if self.running:
            await self.stop()

        # Reset state for clean demo
        reset_mock_store()

        self.running = True
        self.mode = "demo"
        self.phase = 0
        self.phase_description = "Initializing"
        self.start_time = time.time()
        self._overrides = {}

        # Set initial worker positions
        db = get_db()
        for worker_id, zone_id in WORKER_ZONES.items():
            db.update_worker_position(worker_id, zone_id)

        self._task = asyncio.create_task(self._run_demo())

    async def stop(self):
        """Stop the simulator."""
        self.running = False
        self.mode = "idle"
        self.phase = 0
        self.phase_description = ""
        self._overrides = {}
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    def _generate_reading(self, sensor_id: str) -> float:
        """Generate a sensor reading with optional override."""
        if sensor_id in self._overrides:
            override = self._overrides[sensor_id]
            # Add small noise to override
            return round(override + random.uniform(-0.3, 0.3), 2)

        baseline = SENSOR_BASELINES.get(sensor_id, {"base": 10.0, "noise": 2.0})
        return round(
            baseline["base"] + random.uniform(-baseline["noise"], baseline["noise"]),
            2,
        )

    async def _write_all_readings(self):
        """Write readings for all sensors."""
        db = get_db()
        for sensor_id in SENSOR_BASELINES:
            value = self._generate_reading(sensor_id)
            db.add_sensor_reading(sensor_id, value)

    async def _move_workers_randomly(self, chance: float = 0.1):
        """Randomly move some workers."""
        db = get_db()
        for worker_id in WORKER_ZONES:
            if random.random() < chance:
                zone = random.choice(ALL_ZONE_IDS)
                db.update_worker_position(worker_id, zone)

    async def _run_normal(self):
        """Normal mode: generate readings every 3-5 seconds."""
        try:
            # Initial worker positions
            db = get_db()
            for worker_id, zone_id in WORKER_ZONES.items():
                db.update_worker_position(worker_id, zone_id)

            while self.running:
                await self._write_all_readings()
                from app.services.risk_engine import evaluate_all_zones
                await evaluate_all_zones()
                await self._move_workers_randomly(chance=0.08)
                await asyncio.sleep(random.uniform(3.0, 5.0))
        except asyncio.CancelledError:
            pass

    async def _run_demo(self):
        """Scripted demo sequence — ~3.5 minute arc."""
        try:
            db = get_db()

            # ── PHASE 1: Normal state (0-30s) ──
            self.phase = 1
            self.phase_description = "Normal operations — all zones nominal"
            for _ in range(8):
                if not self.running:
                    return
                await self._write_all_readings()
                await self._move_workers_randomly(chance=0.05)
                await evaluate_all_zones()
                await asyncio.sleep(3.5)

            # ── PHASE 2: Gas starts rising in Coke Oven (30-60s) ──
            self.phase = 2
            self.phase_description = "Gas trending upward in Coke Oven Battery"

            # Gradually increase H2S
            for h2s_val in [5.0, 6.2, 7.5, 8.1, 8.8, 9.2]:
                if not self.running:
                    return
                self._overrides["sensor-coke-h2s"] = h2s_val
                self._overrides["sensor-coke-co"] = 12.0 + (h2s_val - 5.0) * 2
                await self._write_all_readings()

                # Move a worker into the coke oven zone
                if h2s_val > 7.0:
                    db.update_worker_position("worker-05", "zone-coke-oven")

                # Evaluate risk
                await evaluate_all_zones()

                await asyncio.sleep(4.0)

            # ── PHASE 3: Hot work permit request in adjacent zone (60-90s) ──
            self.phase = 3
            self.phase_description = "Hot work permit requested near elevated gas zone"

            # Create the conflicting permit
            permit = db.create_permit(
                zone_id="zone-byproduct",
                permit_type="hot_work",
                issued_by="S. Kumar",
            )

            # Also create a permit in coke oven to compound risk
            db.create_permit(
                zone_id="zone-coke-oven",
                permit_type="confined_space_entry",
                issued_by="R. Patel",
            )

            # Continue rising gas
            for h2s_val in [9.5, 9.8, 10.5, 11.2]:
                if not self.running:
                    return
                self._overrides["sensor-coke-h2s"] = h2s_val
                self._overrides["sensor-coke-co"] = 20.0 + (h2s_val - 9.0) * 3
                await self._write_all_readings()
                await self._move_workers_randomly(chance=0.03)
                await evaluate_all_zones()
                await asyncio.sleep(5.0)

            # ── PHASE 4: Critical alert fires (90-120s) ──
            self.phase = 4
            self.phase_description = "CRITICAL — compound risk alert in Coke Oven Battery"

            # H2S crosses threshold hard
            for h2s_val in [12.5, 14.0, 15.5]:
                if not self.running:
                    return
                self._overrides["sensor-coke-h2s"] = h2s_val
                self._overrides["sensor-coke-co"] = 30.0 + (h2s_val - 12.0) * 2
                self._overrides["sensor-coke-temp"] = 320.0 + (h2s_val - 12.0) * 10
                await self._write_all_readings()

                # Trigger risk evaluation
                await evaluate_all_zones()

                await asyncio.sleep(5.0)

            # Storage tank farm sympathetic temperature rise
            self._overrides["sensor-tank-temp"] = 65.0
            await self._write_all_readings()
            await evaluate_all_zones()

            await asyncio.sleep(5.0)

            # ── PHASE 5: Response — readings declining (120-180s) ──
            self.phase = 5
            self.phase_description = "Response underway — readings declining"

            # Close the permits
            for pid, permit in list(db.permits.items()):
                if permit["status"] == "active":
                    db.update_permit_status(pid, "closed")

            # Gradually decrease readings
            for h2s_val in [13.0, 10.5, 8.0, 6.0, 4.5, 3.5]:
                if not self.running:
                    return
                self._overrides["sensor-coke-h2s"] = h2s_val
                self._overrides["sensor-coke-co"] = max(12.0, 15.0 + (h2s_val - 8.0) * 2)
                self._overrides["sensor-coke-temp"] = max(280.0, 300.0 + (h2s_val - 5.0) * 5)
                self._overrides["sensor-tank-temp"] = max(42.0, 50.0 + (h2s_val - 5.0) * 3)
                await self._write_all_readings()
                await self._move_workers_randomly(chance=0.05)
                await evaluate_all_zones()
                await asyncio.sleep(5.0)

            # ── PHASE 6: Return to normal ──
            self.phase = 6
            self.phase_description = "Situation resolved — returning to normal operations"
            self._overrides = {}

            # Continue normal readings
            for _ in range(10):
                if not self.running:
                    return
                await self._write_all_readings()
                await self._move_workers_randomly(chance=0.08)
                await evaluate_all_zones()
                await asyncio.sleep(4.0)

            self.phase_description = "Demo sequence complete"
            self.running = False

        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[Simulator] Error: {e}")
            self.running = False


# Singleton
_simulator: Optional[Simulator] = None


def get_simulator() -> Simulator:
    global _simulator
    if _simulator is None:
        _simulator = Simulator()
    return _simulator
