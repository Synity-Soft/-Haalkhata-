#!/usr/bin/env python3
"""
BazarBondhu AI — Standalone ML Prediction Service
=================================================

Production-grade, standalone Python prediction service for BazarBondhu AI.
Integrates the 67 SAFE feature builder with the two verified HistGradientBoosting
forecasting models (7-day EXP3 and 30-day).

Design Invariants:
1. Standalone Python: zero backend, zero database, zero external web frameworks.
2. Dual & Single Horizon: supports '7d', '30d', or 'both' (default).
3. Ground-Truth Feature Construction: strictly reuses feature_builder.py (67 SAFE features).
4. Schema Enforcement: validates feature presence, ordering, finiteness, and exclusion of CONDITIONAL/FORBIDDEN columns.
5. Non-Negative Demand with Raw Preservation: prevents negative forecasts (clip to >= 0) while strictly preserving raw outputs.
6. Pure Forecasting: outputs sales forecasts only; leaves ordering, purchasing, and business decisions to downstream layers.
"""

import sys
import time
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional, Union, Dict, Any, List

import joblib
import numpy as np
import pandas as pd

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.inference.feature_builder import (
    InferenceFeatureBuilder,
    get_feature_builder,
    SAFE_FEATURES,
    NUM_COLS,
    CAT_COLS,
    CONDITIONAL_FEATURES,
    FORBIDDEN_COLUMNS,
)


@dataclass(frozen=True)
class PredictionResult:
    """
    Structured forecasting prediction output.
    Preserves raw unclipped model outputs and unrounded floating-point precision.
    """
    outlet_id: str
    product_id: str
    forecast_origin_date: str
    horizon: str
    forecast_7d: Optional[float]
    forecast_30d: Optional[float]
    raw_forecast_7d: Optional[float]
    raw_forecast_30d: Optional[float]
    daily_implied_demand_7d: Optional[float]
    daily_implied_demand_30d: Optional[float]
    status: str
    models: Dict[str, str]
    feature_count: int = 67
    execution_time_ms: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        """Converts result dataclass to a standard Python dictionary."""
        return asdict(self)


class PredictionService:
    """
    Standalone prediction service encapsulating model lifecycle and inference orchestration.
    """

    def __init__(
        self,
        model_7d_path: Optional[Union[str, Path]] = None,
        model_30d_path: Optional[Union[str, Path]] = None,
        data_dir: Optional[Union[str, Path]] = None,
        feature_builder: Optional[InferenceFeatureBuilder] = None,
    ):
        base_dir = REPO_ROOT

        # 1. Resolve model artifact paths
        self.path_7d = Path(model_7d_path) if model_7d_path else base_dir / "ml" / "models" / "7d" / "hgb_exp3_absolute_error_model.joblib"
        self.path_30d = Path(model_30d_path) if model_30d_path else base_dir / "ml" / "models" / "30d" / "hgb_absolute_error_model.joblib"

        # 2. Load models with explicit error handling
        self.model_7d = self._load_model_artifact(self.path_7d, "7-day")
        self.model_30d = self._load_model_artifact(self.path_30d, "30-day")

        # 3. Model identifiers / version metadata
        self.model_7d_id = self.model_7d.metadata.get("experiment_id", "HGB_EXP3_7D")
        self.model_30d_id = self.model_30d.metadata.get("experiment_id", "HGB_30D")

        # 4. Initialize or bind Feature Builder
        if feature_builder is not None:
            self.feature_builder = feature_builder
        else:
            self.feature_builder = get_feature_builder(data_dir=data_dir)

    def _load_model_artifact(self, model_path: Path, model_label: str) -> Any:
        """Loads and verifies a forecaster artifact."""
        if not model_path.exists():
            raise FileNotFoundError(f"Missing {model_label} model artifact at: {model_path}")

        try:
            model = joblib.load(model_path)
        except Exception as e:
            raise RuntimeError(f"Failed to deserialize {model_label} model artifact from {model_path}: {e}") from e

        # Validate required estimator interface
        for attr in ("predict", "predict_raw", "validate_inputs", "safe_features"):
            if not hasattr(model, attr):
                raise AttributeError(f"{model_label} model missing required forecaster attribute '{attr}'")

        if len(model.safe_features) != 67:
            raise ValueError(f"{model_label} model feature count {len(model.safe_features)} != expected 67 SAFE features.")

        return model

    def validate_feature_dataframe(self, df: pd.DataFrame):
        """
        Validates feature schema, finiteness, and exclusion rules prior to prediction.
        """
        if not isinstance(df, pd.DataFrame):
            raise TypeError(f"Expected pandas DataFrame from feature builder, got {type(df).__name__}")

        if len(df) != 1:
            raise ValueError(f"Expected single-row feature DataFrame for 1 origin, got {len(df)} rows.")

        if list(df.columns) != SAFE_FEATURES:
            missing = set(SAFE_FEATURES) - set(df.columns)
            extra = set(df.columns) - set(SAFE_FEATURES)
            raise KeyError(
                f"Feature schema mismatch. Missing features: {sorted(list(missing))}, "
                f"Extra/unexpected features: {sorted(list(extra))}"
            )

        # Check for forbidden columns or conditional features
        forbidden = set(df.columns) & (set(FORBIDDEN_COLUMNS) | set(CONDITIONAL_FEATURES))
        if forbidden:
            raise ValueError(f"Forbidden or conditional features detected in inference input: {forbidden}")

        # Check numerical finiteness
        for col in NUM_COLS:
            val = df[col].iloc[0]
            if pd.isna(val) or not np.isfinite(val):
                raise ValueError(f"Numerical feature '{col}' contains invalid/non-finite value: {val}")

        # Check categorical presence
        for col in CAT_COLS:
            val = df[col].iloc[0]
            if pd.isna(val) or not isinstance(val, str) or len(val.strip()) == 0:
                raise ValueError(f"Categorical feature '{col}' must be a non-empty string, got {val!r}")

    def predict(
        self,
        outlet_id: str,
        product_id: str,
        forecast_origin_date: str,
        horizon: str = "both",
    ) -> PredictionResult:
        """
        Generates demand forecasts for an outlet-product pair at a forecast origin date.

        Parameters
        ----------
        outlet_id : str
            Outlet identifier (e.g. 'OUT001').
        product_id : str
            Product identifier (e.g. 'PRD047').
        forecast_origin_date : str
            Origin date in 'YYYY-MM-DD' format (e.g. '2026-08-01').
        horizon : str, default 'both'
            Forecasting horizon: '7d', '30d', or 'both'.

        Returns
        -------
        PredictionResult
            Structured forecast result containing raw and non-negative demand predictions.
        """
        t0 = time.perf_counter()

        # 1. Validate horizon parameter
        valid_horizons = ("7d", "30d", "both")
        if horizon not in valid_horizons:
            raise ValueError(f"Invalid horizon '{horizon}'. Must be one of {valid_horizons}.")

        # 2. Build 67 SAFE features (inherently validates outlet_id, product_id, pair, date range & history)
        features_df = self.feature_builder.build_features(
            outlet_id=outlet_id,
            product_id=product_id,
            forecast_date=forecast_origin_date
        )

        # 3. Explicit schema and finiteness verification
        self.validate_feature_dataframe(features_df)

        raw_7d: Optional[float] = None
        forecast_7d: Optional[float] = None
        daily_7d: Optional[float] = None

        raw_30d: Optional[float] = None
        forecast_30d: Optional[float] = None
        daily_30d: Optional[float] = None

        models_used: Dict[str, str] = {}

        # 4. Execute 7-day model if requested
        if horizon in ("7d", "both"):
            raw_pred_7d = float(self.model_7d.predict_raw(features_df)[0])
            if not np.isfinite(raw_pred_7d):
                raise ValueError(f"7-day model generated non-finite raw forecast: {raw_pred_7d}")
            raw_7d = raw_pred_7d
            forecast_7d = max(0.0, raw_pred_7d)
            daily_7d = forecast_7d / 7.0
            models_used["7d"] = self.model_7d_id

        # 5. Execute 30-day model if requested
        if horizon in ("30d", "both"):
            raw_pred_30d = float(self.model_30d.predict_raw(features_df)[0])
            if not np.isfinite(raw_pred_30d):
                raise ValueError(f"30-day model generated non-finite raw forecast: {raw_pred_30d}")
            raw_30d = raw_pred_30d
            forecast_30d = max(0.0, raw_pred_30d)
            daily_30d = forecast_30d / 30.0
            models_used["30d"] = self.model_30d_id

        t_elapsed_ms = (time.perf_counter() - t0) * 1000.0

        return PredictionResult(
            outlet_id=outlet_id,
            product_id=product_id,
            forecast_origin_date=forecast_origin_date,
            horizon=horizon,
            forecast_7d=forecast_7d,
            forecast_30d=forecast_30d,
            raw_forecast_7d=raw_7d,
            raw_forecast_30d=raw_30d,
            daily_implied_demand_7d=daily_7d,
            daily_implied_demand_30d=daily_30d,
            status="SUCCESS",
            models=models_used,
            feature_count=len(SAFE_FEATURES),
            execution_time_ms=t_elapsed_ms,
        )


# -----------------------------------------------------------------------------
# Module Singleton & Top-Level Predictor
# -----------------------------------------------------------------------------

_GLOBAL_PREDICTION_SERVICE: Optional[PredictionService] = None


def get_prediction_service(
    model_7d_path: Optional[Union[str, Path]] = None,
    model_30d_path: Optional[Union[str, Path]] = None,
    data_dir: Optional[Union[str, Path]] = None,
) -> PredictionService:
    """Returns a cached singleton of PredictionService."""
    global _GLOBAL_PREDICTION_SERVICE
    if _GLOBAL_PREDICTION_SERVICE is None:
        _GLOBAL_PREDICTION_SERVICE = PredictionService(
            model_7d_path=model_7d_path,
            model_30d_path=model_30d_path,
            data_dir=data_dir,
        )
    return _GLOBAL_PREDICTION_SERVICE


def predict(
    outlet_id: str,
    product_id: str,
    forecast_origin_date: str,
    horizon: str = "both",
) -> PredictionResult:
    """
    Convenience function for direct forecast predictions.

    Example:
    --------
    >>> from ml.inference.prediction_service import predict
    >>> result = predict("OUT001", "PRD047", "2026-08-01")
    >>> print(result.forecast_7d, result.forecast_30d)
    """
    service = get_prediction_service()
    return service.predict(
        outlet_id=outlet_id,
        product_id=product_id,
        forecast_origin_date=forecast_origin_date,
        horizon=horizon,
    )
