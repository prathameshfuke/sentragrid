"""SentraGrid Backend — FastAPI Application."""

import os
import logging
import psutil
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import sensors, alerts, permits, rag, simulator, demo
from app.services.simulator import get_simulator

logger = logging.getLogger("sentragrid.main")

def get_current_rss_mb() -> float:
    process = psutil.Process(os.getpid())
    return round(process.memory_info().rss / 1024 / 1024, 2)

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

# Limit payload size to 512KB to protect memory
@app.middleware("http")
async def limit_body_size_middleware(request: Request, call_next):
    if request.url.path == "/api/simulator/stream" or request.url.path.startswith("/api/demo"):
        return await call_next(request)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > 512 * 1024:
                return JSONResponse(
                    status_code=413,
                    content={"error": "Payload Too Large", "detail": "Request body size exceeds 512KB limit."}
                )
        except ValueError:
            pass
    return await call_next(request)

# Request memory profiler middleware
@app.middleware("http")
async def log_request_memory_middleware(request: Request, call_next):
    if request.url.path == "/api/simulator/stream" or request.url.path.startswith("/api/demo"):
        return await call_next(request)
    rss_before = get_current_rss_mb()
    response = await call_next(request)
    rss_after = get_current_rss_mb()
    # Log memory changes if any allocation happens
    if rss_after != rss_before:
        logger.info(f"[Memory] Route {request.url.path} finished. RSS: {rss_before}MB -> {rss_after}MB (diff: {round(rss_after - rss_before, 2)}MB)")
    return response

# Routers
app.include_router(sensors.router)
app.include_router(alerts.router)
app.include_router(permits.router)
app.include_router(rag.router)
app.include_router(simulator.router)
app.include_router(demo.router)


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
        "memory": {
            "rss_mb": get_current_rss_mb(),
            "limit_mb": 512.0
        }
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "memory": {
            "rss_mb": get_current_rss_mb(),
            "limit_mb": 512.0,
            "usage_percent": round((get_current_rss_mb() / 512.0) * 100, 1)
        }
    }


@app.on_event("startup")
async def startup_event():
    initial_rss = get_current_rss_mb()
    print(f"==========================================")
    print(f"SentraGrid Startup Completed successfully!")
    print(f"Initial RSS Memory Usage: {initial_rss} MB")
    print(f"==========================================")
    logger.info(f"[Startup] FastAPI initialized. Initial RSS Memory: {initial_rss} MB")
    
    if settings.auto_start_simulator:
        sim = get_simulator()
        if not sim.running:
            await sim.start_normal()
