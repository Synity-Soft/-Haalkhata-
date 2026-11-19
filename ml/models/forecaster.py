# ml/models/forecaster.py
"""
BazarBondhu AI — Ridge Demand Forecaster
========================================

Self-contained, production-grade demand forecaster for BazarBondhu AI.
Encapsulates fitted StandardScaler, OneHotEncoder, and Ridge regression model
with comprehensive input validation, non-finite checks, and exact feature ordering.
"""

import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.base import BaseEstimator, RegressorMixin
from typing import List, Dict, Any, Optional, Tuple


class RidgeDemandForecaster(BaseEstimator, RegressorMixin):
    """
    Inference estimator combining fitted StandardScaler, OneHotEncoder,
    and Ridge regression model.
    """
    def __init__(
        self,
        scaler,
        ohe,
        ridge,
        num_cols: List[str],
        cat_cols: List[str],
        safe_features: List[str],
        horizon: str,
        target_col: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.scaler = scaler
        self.ohe = ohe
        self.ridge = ridge
        self.num_cols = list(num_cols)
        self.cat_cols = list(cat_cols)
        self.safe_features = list(safe_features)
        self.horizon = horizon
        self.target_col = target_col
        self.metadata = metadata or {}

    def validate_inputs(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Validates input DataFrame schema, missing values, and numerical finiteness.
        Returns extracted (df_num, df_cat) in consistent feature order.
        Any extra columns present in df beyond required features (e.g., outlet_id,
        product_id, forecast_origin_date, targets) are explicitly ignored.
        """
        if not isinstance(df, pd.DataFrame):
            raise TypeError(f"Expected pandas DataFrame as input, got {type(df).__name__}")

        # 1. Required column presence validation
        missing_num = [c for c in self.num_cols if c not in df.columns]
        missing_cat = [c for c in self.cat_cols if c not in df.columns]
        if missing_num or missing_cat:
            missing_all = missing_num + missing_cat
            raise KeyError(
                f"Input DataFrame is missing {len(missing_all)} required feature(s): {missing_all}. "
                f"Expected exactly {len(self.safe_features)} SAFE features."
            )

        # 2. Extract in strict feature order (extra columns beyond num_cols/cat_cols are ignored)
        df_num = df[self.num_cols].copy()
        df_cat = df[self.cat_cols].copy()

        # 3. Missing and non-finite value validation for numerical features
        num_nulls = df_num.isna().sum()
        cols_with_nulls = num_nulls[num_nulls > 0].to_dict()
        if cols_with_nulls:
            raise ValueError(
                f"Numerical features contain missing (NaN) values: {cols_with_nulls}. "
                "Inputs must contain finite numerical values."
            )

        try:
            num_values = df_num.to_numpy(dtype=np.float32)
        except (ValueError, TypeError) as e:
            invalid_cols = []
            for c in self.num_cols:
                try:
                    pd.to_numeric(df_num[c], errors="raise")
                except Exception:
                    invalid_cols.append(c)
            raise ValueError(
                f"Numerical features contain invalid non-numeric values in column(s) {invalid_cols}: {e}. "
                "All numerical predictors must be finite and convertible to float32 without imputation."
            ) from e

        if not np.all(np.isfinite(num_values)):
            raise ValueError(
                "Numerical features contain non-finite values (Inf or -Inf). "
                "All numerical predictors must be finite."
            )

        # 4. Ensure categorical missing values are represented as string 'missing'
        for c in self.cat_cols:
            if df_cat[c].isna().any():
                df_cat[c] = df_cat[c].fillna("missing").astype(str)
            else:
                df_cat[c] = df_cat[c].astype(str)

        return df_num, df_cat

    def transform(self, df: pd.DataFrame) -> sp.csr_matrix:
        """
        Transforms validated DataFrame into sparse CSR design matrix.
        """
        df_num, df_cat = self.validate_inputs(df)
        X_num = self.scaler.transform(df_num)
        X_cat = self.ohe.transform(df_cat)
        X = sp.hstack([sp.csr_matrix(X_num, dtype=np.float32), X_cat], format="csr")
        if not np.all(np.isfinite(X.data)):
            raise ValueError("Transformed sparse matrix contains non-finite values (NaN or Inf).")
        return X

    def predict_raw(self, df: pd.DataFrame) -> np.ndarray:
        """
        Generates unclipped raw linear predictions with finiteness validation.
        """
        X = self.transform(df)
        raw_preds = self.ridge.predict(X)

        if not np.all(np.isfinite(raw_preds)):
            raise ValueError("Model generated non-finite raw predictions (NaN or Inf).")

        return raw_preds

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        """
        Generates non-negative clipped demand forecasts (clip to >= 0).
        """
        raw_preds = self.predict_raw(df)
        clipped_preds = np.clip(raw_preds, 0, None)

        if not np.all(np.isfinite(clipped_preds)):
            raise ValueError("Model generated non-finite clipped predictions.")
        if np.any(clipped_preds < 0):
            raise ValueError("Clipped predictions contain negative values.")

        return clipped_preds


class HGBDemandForecaster(BaseEstimator, RegressorMixin):
    """
    Self-contained inference estimator combining fitted OrdinalEncoder
    and HistGradientBoostingRegressor with input validation and non-finite checks.
    """
    def __init__(
        self,
        encoder,
        hgb,
        num_cols: List[str],
        cat_cols: List[str],
        safe_features: List[str],
        horizon: str,
        target_col: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.encoder = encoder
        self.hgb = hgb
        self.num_cols = list(num_cols)
        self.cat_cols = list(cat_cols)
        self.safe_features = list(safe_features)
        self.horizon = horizon
        self.target_col = target_col
        self.metadata = metadata or {}

        # Lightweight schema safeguards
        if len(self.safe_features) != len(set(self.safe_features)):
            raise ValueError(
                f"safe_features contains duplicate entries: count={len(self.safe_features)}, "
                f"unique={len(set(self.safe_features))}"
            )

        if set(self.num_cols) & set(self.cat_cols):
            overlapping = sorted(list(set(self.num_cols) & set(self.cat_cols)))
            raise ValueError(f"num_cols and cat_cols overlap: {overlapping}")

        if set(self.num_cols + self.cat_cols) != set(self.safe_features):
            missing_in_partition = sorted(list(set(self.safe_features) - set(self.num_cols + self.cat_cols)))
            extra_in_partition = sorted(list(set(self.num_cols + self.cat_cols) - set(self.safe_features)))
            raise ValueError(
                f"num_cols and cat_cols do not form a complete partition of safe_features. "
                f"Missing: {missing_in_partition}, Extra: {extra_in_partition}"
            )

        expected_cat_indices = list(range(len(self.num_cols), len(self.num_cols) + len(self.cat_cols)))
        if "categorical_indices" in self.metadata:
            if list(self.metadata["categorical_indices"]) != expected_cat_indices:
                raise ValueError(
                    f"Metadata categorical_indices {self.metadata['categorical_indices']} "
                    f"does not match expected layout {expected_cat_indices}"
                )

    def validate_inputs(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Validates input DataFrame schema, missing values, and numerical finiteness.
        Returns extracted (df_num, df_cat) in consistent feature order.
        Any extra columns present in df beyond required features (e.g., outlet_id,
        product_id, forecast_origin_date, targets) are explicitly ignored.
        """
        if not isinstance(df, pd.DataFrame):
            raise TypeError(f"Expected pandas DataFrame as input, got {type(df).__name__}")

        # 1. Required column presence validation
        missing_num = [c for c in self.num_cols if c not in df.columns]
        missing_cat = [c for c in self.cat_cols if c not in df.columns]
        if missing_num or missing_cat:
            missing_all = missing_num + missing_cat
            raise KeyError(
                f"Input DataFrame is missing {len(missing_all)} required feature(s): {missing_all}. "
                f"Expected exactly {len(self.safe_features)} SAFE features."
            )

        # 2. Extract in strict feature order (extra columns beyond num_cols/cat_cols are ignored)
        df_num = df[self.num_cols].copy()
        df_cat = df[self.cat_cols].copy()

        # 3. Missing and non-finite value validation for numerical features
        num_nulls = df_num.isna().sum()
        cols_with_nulls = num_nulls[num_nulls > 0].to_dict()
        if cols_with_nulls:
            raise ValueError(
                f"Numerical features contain missing (NaN) values: {cols_with_nulls}. "
                "Inputs must contain finite numerical values."
            )

        try:
            num_values = df_num.to_numpy(dtype=np.float32)
        except (ValueError, TypeError) as e:
            invalid_cols = []
            for c in self.num_cols:
                try:
                    pd.to_numeric(df_num[c], errors="raise")
                except Exception:
                    invalid_cols.append(c)
            raise ValueError(
                f"Numerical features contain invalid non-numeric values in column(s) {invalid_cols}: {e}. "
                "All numerical predictors must be finite and convertible to float32 without imputation."
            ) from e

        if not np.all(np.isfinite(num_values)):
            raise ValueError(
                "Numerical features contain non-finite values (Inf or -Inf). "
                "All numerical predictors must be finite."
            )

        # 4. Ensure categorical missing values are represented as string 'missing'
        for c in self.cat_cols:
            if df_cat[c].isna().any():
                df_cat[c] = df_cat[c].fillna("missing").astype(str)
            else:
                df_cat[c] = df_cat[c].astype(str)

        return df_num, df_cat

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """
        Transforms validated DataFrame into float32 feature array.
        Orders numerical columns first, followed by encoded categorical columns.
        """
        df_num, df_cat = self.validate_inputs(df)
        X_num = df_num.to_numpy(dtype=np.float32)
        X_cat = self.encoder.transform(df_cat).astype(np.float32)
        X = np.column_stack([X_num, X_cat])

        expected_width = len(self.num_cols) + len(self.cat_cols)
        if X.shape[1] != expected_width:
            raise ValueError(
                f"Transformed matrix width {X.shape[1]} does not match expected width {expected_width}."
            )

        if not np.all(np.isfinite(X)):
            raise ValueError(
                "Transformed feature matrix contains non-finite values (NaN or Inf). "
                "All features must be finite before estimator prediction."
            )

        return X

    def predict_raw(self, df: pd.DataFrame) -> np.ndarray:
        """
        Generates unclipped raw tree predictions with finiteness validation.
        """
        X = self.transform(df)
        raw_preds = self.hgb.predict(X)

        if not np.all(np.isfinite(raw_preds)):
            raise ValueError("Model generated non-finite raw predictions (NaN or Inf).")

        return raw_preds

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        """
        Generates non-negative clipped demand forecasts (clip to >= 0).
        """
        raw_preds = self.predict_raw(df)
        clipped_preds = np.clip(raw_preds, 0, None)

        if not np.all(np.isfinite(clipped_preds)):
            raise ValueError("Model generated non-finite clipped predictions.")
        if np.any(clipped_preds < 0):
            raise ValueError("Clipped predictions contain negative values.")

        return clipped_preds

