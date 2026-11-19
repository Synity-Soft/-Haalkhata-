"""
BazarBondhu AI — Health Check Router
====================================

Exposes both legacy ML health check (/health) and unified system health check (/api/health).
"""

import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, status, Response
from sqlalchemy import text

from backend.database import engine, DEFAULT_DB_PATH
from backend.schemas.health import (
    DatabaseHealth,
    MLServiceHealth,
    UnifiedHealthResponse,
)
from ml.api.schemas import HealthResponse as MLHealthResponse
from ml.inference.prediction_service import PredictionService

router = APIRouter(tags=["Health & Diagnostics"])


@router.get(
    "/health",
    response_model=MLHealthResponse,
    summary="Legacy ML Service Health Check",
    description="Maintains 100% backward compatibility with the existing ML FastAPI health endpoint."
)
def get_ml_health(request: Request) -> MLHealthResponse:
    """Returns ML model and prediction service status matching existing test suite."""
    service: Optional[PredictionService] = getattr(request.app.state, "prediction_service", None)
    is_ready: bool = getattr(request.app.state, "ml_ready", False)
    init_error: Optional[str] = getattr(request.app.state, "ml_init_error", None)

    if not is_ready or service is None:
        return MLHealthResponse(
            status="unhealthy",
            prediction_service_initialized=False,
            model_7d_loaded=False,
            model_30d_loaded=False,
            initialization_error=init_error,
        )

    earliest_date = service.feature_builder.canonical_dates[service.feature_builder.min_history_idx]
    latest_date = service.feature_builder.canonical_dates[-1]

    return MLHealthResponse(
        status="healthy",
        prediction_service_initialized=True,
        model_7d_loaded=True,
        model_30d_loaded=True,
        model_7d_id=service.model_7d_id,
        model_30d_id=service.model_30d_id,
        earliest_supported_date=earliest_date,
        latest_supported_date=latest_date,
        initialization_error=None,
    )


@router.get(
    "/api/health",
    response_model=UnifiedHealthResponse,
    summary="Unified System Health Check",
    description="Reports connectivity and status for both SQLite database and ML prediction engine. Satisfies frontend contract."
)
def get_unified_health(request: Request, response: Response) -> UnifiedHealthResponse:
    """
    Probes both the SQLite database and the ML inference service, returning
    subsystem diagnostics and overall service state.
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Probe SQLite Database
    db_status = "connected"
    db_error = None
    total_tables = 0
    total_records = 0
    db_latency_ms = 0.0

    t0 = time.time()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            # Count domain tables
            tbl_res = conn.execute(
                text("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            ).scalar()
            total_tables = int(tbl_res or 0)

            # Fast record count check across outlets
            cnt_res = conn.execute(text("SELECT count(*) FROM outlets")).scalar()
            outlet_count = int(cnt_res or 0)
            total_records = outlet_count
        db_latency_ms = round((time.time() - t0) * 1000.0, 2)
    except Exception as e:
        db_status = "disconnected"
        db_error = str(e)
        db_latency_ms = round((time.time() - t0) * 1000.0, 2)

    db_health = DatabaseHealth(
        status=db_status,
        engine="sqlite",
        database_file=DEFAULT_DB_PATH.name,
        total_tables=total_tables,
        total_records=total_records,
        latency_ms=db_latency_ms,
        error=db_error,
    )

    # 2. Probe ML Inference Engine
    service: Optional[PredictionService] = getattr(request.app.state, "prediction_service", None)
    ml_ready: bool = getattr(request.app.state, "ml_ready", False)
    ml_error: Optional[str] = getattr(request.app.state, "ml_init_error", None)

    if ml_ready and service is not None:
        earliest_date = service.feature_builder.canonical_dates[service.feature_builder.min_history_idx]
        latest_date = service.feature_builder.canonical_dates[-1]
        ml_health = MLServiceHealth(
            status="ready",
            prediction_service_initialized=True,
            model_7d_loaded=True,
            model_30d_loaded=True,
            model_7d_id=service.model_7d_id,
            model_30d_id=service.model_30d_id,
            earliest_supported_date=earliest_date,
            latest_supported_date=latest_date,
            error=None,
        )
    else:
        ml_health = MLServiceHealth(
            status="unavailable",
            prediction_service_initialized=False,
            model_7d_loaded=False,
            model_30d_loaded=False,
            model_7d_id=None,
            model_30d_id=None,
            earliest_supported_date=None,
            latest_supported_date=None,
            error=ml_error,
        )

    # 3. Overall Service Status
    if db_status == "connected" and ml_health.status == "ready":
        overall_status = "healthy"
    elif db_status == "connected" or ml_health.status == "ready":
        overall_status = "degraded"
    else:
        overall_status = "unhealthy"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return UnifiedHealthResponse(
        status=overall_status,
        version="1.0.0",
        timestamp=now_iso,
        database=db_health,
        ml_service=ml_health,
    )
