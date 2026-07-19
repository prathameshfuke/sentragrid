"""SentraGrid Backend — FastAPI Application."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import sensors, alerts, permits, rag, simulator
from app.services.simulator import get_simulator


app = FastAPI(
    title="SentraGrid API",
    description="AI-Powered Industrial Safety Intelligence Platform",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(sensors.router)
app.include_router(alerts.router)
app.include_router(permits.router)
app.include_router(rag.router)
app.include_router(simulator.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc),
        },
    )


@app.get("/")
async def root():
    return {
        "name": "SentraGrid API",
        "version": "1.0.0",
        "status": "operational",
        "mock_mode": settings.mock_mode,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    if settings.auto_start_simulator:
        sim = get_simulator()
        if not sim.running:
            await sim.start_normal()
