"""
BazarBondhu AI — Inference Module
==================================

Reusable standalone ML inference and forecasting pipeline.
"""

from ml.inference.feature_builder import (
    InferenceFeatureBuilder,
    get_feature_builder,
    build_features,
    SAFE_FEATURES,
    NUM_COLS,
    CAT_COLS,
    CONDITIONAL_FEATURES,
    FORBIDDEN_COLUMNS,
)

from ml.inference.prediction_service import (
    PredictionService,
    PredictionResult,
    get_prediction_service,
    predict,
)

__all__ = [
    "InferenceFeatureBuilder",
    "get_feature_builder",
    "build_features",
    "SAFE_FEATURES",
    "NUM_COLS",
    "CAT_COLS",
    "CONDITIONAL_FEATURES",
    "FORBIDDEN_COLUMNS",
    "PredictionService",
    "PredictionResult",
    "get_prediction_service",
    "predict",
]
