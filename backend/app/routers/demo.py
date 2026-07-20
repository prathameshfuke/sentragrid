"""SentraGrid Backend — Demo Controller and Scripted Sequence."""

import asyncio
import time
import logging
from fastapi import APIRouter, HTTPException
from app.database import get_db, reset_mock_store
from app.services.simulator import get_simulator
from app.services.risk_engine import evaluate_all_zones
from app.services.permit_agent import evaluate_permit_request, issue_permit_with_override

router = APIRouter(prefix="/api/demo", tags=["demo"])
logger = logging.getLogger("sentragrid.demo")

_demo_task: asyncio.Task = None

async def _execute_demo_sequence():
    sim = get_simulator()
    
    try:
        # ── STAGE 1 (t=0s) ──
        sim.running = True
        sim.mode = "demo"
        sim.phase = 1
        sim.phase_description = "Demo Phase 1: All zones nominal. Map renders green."
        sim.start_time = time.time()
        
        # Reset database to seeded nominal parameters
        reset_mock_store()
        db = get_db()
        
        # Force a nominal zone risk evaluation
        await evaluate_all_zones()
        
        # Write initial normal telemetry for target zones
        db.add_sensor_reading("sensor-gas-holder-h2s", 1.5)
        db.add_sensor_reading("sensor-gas-holder-pressure", 85.0)
        db.add_sensor_reading("sensor-gas-holder-temp", 35.0)
        await evaluate_all_zones()
        
        # Wait 15 seconds
        for _ in range(15):
            if not sim.running or sim.mode != "demo":
                return
            await asyncio.sleep(1.0)
            
        # ── STAGE 2 (t=15s) ──
        sim.phase = 2
        sim.phase_description = "Demo Phase 2: Gas levels rising in Gas Holder Station"
        
        # Climb gas readings below warning threshold (7.0 ppm)
        gas_climb = [3.2, 4.8, 6.2]
        for i, val in enumerate(gas_climb):
            if not sim.running or sim.mode != "demo":
                return
            db.add_sensor_reading("sensor-gas-holder-h2s", val)
            await evaluate_all_zones()
            
            # Wait 10 seconds per reading step (total 30s)
            for _ in range(10):
                if not sim.running or sim.mode != "demo":
                    return
                await asyncio.sleep(1.0)
                
        # ── STAGE 3 (t=45s) ──
        sim.phase = 3
        sim.phase_description = "Demo Phase 3: Hot work permit requested near leaking gas zone"
        
        # Execute permit intelligence agent evaluation and issue
        evaluation = await evaluate_permit_request(
            zone_id="zone-byproduct",
            permit_type="hot_work",
            issued_by="Chief Safety Officer",
        )
        
        # Issue permit with override justification due to adjacent conflict
        justification = "Critical operations override: cooling valve repair required immediately to prevent pressure build up. Local extraction fans deployed."
        await issue_permit_with_override(
            zone_id="zone-byproduct",
            permit_type="hot_work",
            issued_by="Chief Safety Officer",
            justification=justification,
        )
        
        # Force risk engine sweep to process new permit
        await evaluate_all_zones()
        
        # Wait 15 seconds
        for _ in range(15):
            if not sim.running or sim.mode != "demo":
                return
            await asyncio.sleep(1.0)
            
        # ── STAGE 4 (t=60s) ──
        sim.phase = 4
        sim.phase_description = "Demo Phase 4: Gas crosses critical limits. Firing risk engine."
        
        # Breach critical threshold (reaches 10.5 ppm, critical limit is 10.0 ppm)
        db.add_sensor_reading("sensor-gas-holder-h2s", 10.5)
        
        # Evaluate all zones to trigger real compound risk alert with LLM reasoning
        await evaluate_all_zones()
        
        # Wait 30 seconds
        for _ in range(30):
            if not sim.running or sim.mode != "demo":
                return
            await asyncio.sleep(1.0)
            
        # ── STAGE 5 (t=90s) ──
        sim.phase = 5
        sim.phase_description = "Demo Phase 5: Critical alert active. Gas Holder Station in evacuation mode."
        
        # Final persist hold (60 seconds to align with RAG walkthrough audio)
        for _ in range(60):
            if not sim.running or sim.mode != "demo":
                return
            await asyncio.sleep(1.0)
            
        sim.phase = 6
        sim.phase_description = "Demo sequence completed successfully."
        sim.running = False
        
    except asyncio.CancelledError:
        logger.info("[DemoRunner] Demo sequence task cancelled.")
    except Exception as e:
        logger.error(f"[DemoRunner] Exception in demo runner: {e}")
        sim.running = False

@router.post("/run")
async def run_demo():
    """Trigger the scripted deterministic demo sequence."""
    global _demo_task
    sim = get_simulator()
    
    # Stop standard simulator to prevent collision
    await sim.stop()
    
    # Cancel any active demo tasks
    if _demo_task and not _demo_task.done():
        _demo_task.cancel()
        try:
            await _demo_task
        except asyncio.CancelledError:
            pass
            
    _demo_task = asyncio.create_task(_execute_demo_sequence())
    return {
        "status": "started",
        "message": "Deterministic demo sequence triggered successfully in the background."
    }

@router.post("/reset")
async def reset_demo():
    """Reset the database to nominal state and stop all simulations."""
    global _demo_task
    sim = get_simulator()
    
    # Stop all simulation loops
    await sim.stop()
    if _demo_task and not _demo_task.done():
        _demo_task.cancel()
        try:
            await _demo_task
        except asyncio.CancelledError:
            pass
            
    # Reset mock database to clean baseline seeds
    reset_mock_store()
    
    # Evaluate all zones so everything returns to nominal
    await evaluate_all_zones()
    
    return {
        "status": "reset",
        "message": "Database reset to nominal and simulations stopped."
    }
