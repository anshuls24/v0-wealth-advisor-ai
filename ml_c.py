"""
Part (c) ML pipeline: 10-year daily → monthly supervised table, deployable OLS
(PARTC_1-style features), sliding-window time-series CV, and optional imputation
of month-end from monthly averages.

Target: r_m = log(M_m / A_m) with M_m month-end close, A_m monthly average close.
Inference: hat_M_m = A_m * exp(hat_r_m).

Does not modify partb.py / partc.py; imports ``load_spx_daily`` and split constants
from partb.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd

from partb import MONTHLY_HISTORY_YEARS, load_spx_daily

try:
    import statsmodels.api as sm
except ImportError:  # pragma: no cover
    sm = None  # type: ignore

try:
    from scipy import stats as scipy_stats
except ImportError:  # pragma: no cover
    scipy_stats = None  # type: ignore

# --- Column contracts ---

TARGET_COL = "r_m"
COL_M_MONTH_END = "Close_m_month_end"
COL_A_AVG = "Close_a_month_avg"

# Deployable regressors (no constant; sm.add_constant prepends Intercept)
DEPLOYABLE_FEATURES: list[str] = [
    "g_m_A",
    "g_lag1_A",
    "vol_avg_m3",
    # month dummies mo_1 .. mo_11 (December baseline)
    *[f"mo_{m}" for m in range(1, 12)],
]

OPTIONAL_SHAPE_FEATURES: list[str] = [
    "daily_logret_vol_m",
    "daily_logret_skew_m",
    "late_rally_proxy_m",
]

MONTH_BASELINE = 12  # December reference level for categorical month

# Nonlinear extensions of ``g_m_A`` and ``g_lag1_A`` only (no vol / seasonals)
COL_G_M_A_SQ = "g_m_A_sq"
COL_G_M_A_X_LAG = "g_m_A_x_g_lag1_A"

NONLINEAR_G_SQ_FEATURES: list[str] = ["g_m_A", "g_lag1_A", COL_G_M_A_SQ]
NONLINEAR_G_INT_FEATURES: list[str] = ["g_m_A", "g_lag1_A", COL_G_M_A_X_LAG]
NONLINEAR_G_FULL_FEATURES: list[str] = [
    "g_m_A",
    "g_lag1_A",
    COL_G_M_A_SQ,
    COL_G_M_A_X_LAG,
]

LINEAR_G_ONLY_FEATURES: list[str] = ["g_m_A", "g_lag1_A"]

NonlinearGVariant = Literal["sq", "int", "full"]


def add_g_nonlinear_terms(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add ``g_m_A ** 2`` and ``g_m_A * g_lag1_A`` (requires ``g_m_A`` and ``g_lag1_A``).
    """
    if "g_m_A" not in df.columns or "g_lag1_A" not in df.columns:
        raise ValueError("df must contain columns g_m_A and g_lag1_A")
    out = df.copy()
    g = out["g_m_A"].astype(float)
    gl = out["g_lag1_A"].astype(float)
    out[COL_G_M_A_SQ] = g**2
    out[COL_G_M_A_X_LAG] = g * gl
    return out


def nonlinear_g_feature_list(variant: NonlinearGVariant) -> list[str]:
    if variant == "sq":
        return list(NONLINEAR_G_SQ_FEATURES)
    if variant == "int":
        return list(NONLINEAR_G_INT_FEATURES)
    if variant == "full":
        return list(NONLINEAR_G_FULL_FEATURES)
    raise ValueError(f"unknown variant {variant!r}")


def monthly_table_complete_g_pair(monthly_df: pd.DataFrame) -> pd.DataFrame:
    """Rows with finite target and both average-growth terms (ignores vol / dummies)."""
    need = [TARGET_COL, "g_m_A", "g_lag1_A"]
    miss = [c for c in need if c not in monthly_df.columns]
    if miss:
        raise ValueError(f"monthly_df missing columns: {miss}")
    out = monthly_df.dropna(subset=need).reset_index(drop=True)
    return add_g_nonlinear_terms(out)


def build_daily_recent(
    csv_path: str | Path | None = None,
) -> pd.DataFrame:
    """Last ``MONTHLY_HISTORY_YEARS`` years of daily rows (same cut as Part b/c)."""
    daily_full = load_spx_daily(csv_path)
    if daily_full.empty:
        return daily_full
    first_date = daily_full["Date"].min()
    daily_start = first_date + pd.DateOffset(years=MONTHLY_HISTORY_YEARS)
    return daily_full[daily_full["Date"] >= daily_start].copy().reset_index(drop=True)


def _monthly_avg_from_daily(daily: pd.DataFrame) -> pd.DataFrame:
    """One row per month: mean Close, Date = last trading day in month."""
    if daily.empty:
        return pd.DataFrame()
    df = daily.sort_values("Date").copy()
    df["year_month"] = df["Date"].dt.to_period("M")
    return (
        df.groupby("year_month", as_index=False)
        .agg(Date_end=("Date", "max"), Close_a_month_avg=("Close", "mean"))
        .rename(columns={"Date_end": "Date"})
    )


def _monthly_month_end_from_daily(daily: pd.DataFrame) -> pd.DataFrame:
    """One row per month: last Close, Date = last trading day in month."""
    if daily.empty:
        return pd.DataFrame()
    df = daily.sort_values("Date").copy()
    df["year_month"] = df["Date"].dt.to_period("M")
    return df.groupby("year_month", as_index=False).last()


def _month_dummies(dates: pd.Series) -> pd.DataFrame:
    """11 dummies mo_1..mo_11; December (12) is baseline (all zero)."""
    mon = pd.to_datetime(dates).dt.month.astype(int)
    d = pd.DataFrame(index=mon.index)
    for m in range(1, 12):
        d[f"mo_{m}"] = (mon == m).astype(float)
    return d


def _vol_avg_three_prior_g(g_series: pd.Series) -> pd.Series:
    """
    For each index i, sample std of g[i-1], g[i-2], g[i-3] (g = monthly avg log growth).
    First 3 rows after g exists are NaN for vol (need three prior months).
    """
    g = g_series.astype(float)
    # shift so that at i we look at g_{i-1}, g_{i-2}, g_{i-3}
    a = g.shift(1)
    b = g.shift(2)
    c = g.shift(3)
    # rolling std of the three as separate cols
    stack = pd.concat([a, b, c], axis=1)
    return stack.std(axis=1, ddof=1)


def _add_deployable_from_averages(
    df: pd.DataFrame,
    *,
    date_col: str = "Date",
    a_col: str = "Close",
) -> pd.DataFrame:
    """
    Expects rows sorted in time, one per month, with monthly average close in ``a_col``.
    Adds g_m_A, g_lag1_A, vol_avg_m3, mo_* dummies.
    """
    out = df.sort_values(date_col).reset_index(drop=True).copy()
    a = out[a_col].astype(float)
    out["g_m_A"] = np.log(a / a.shift(1))
    out["g_lag1_A"] = out["g_m_A"].shift(1)
    out["vol_avg_m3"] = _vol_avg_three_prior_g(out["g_m_A"])
    dums = _month_dummies(out[date_col])
    for c in dums.columns:
        out[c] = dums[c].values
    return out


def _add_optional_shape_features(
    daily_recent: pd.DataFrame,
    month_table: pd.DataFrame,
    *,
    late_rally_k: int = 5,
    date_col: str = "Date",
    price_col: str = "Close",
) -> pd.DataFrame:
    """Merge month-level stats from daily data onto month_table (aligned year_month)."""
    if daily_recent.empty or month_table.empty:
        mt = month_table.copy()
        for c in OPTIONAL_SHAPE_FEATURES:
            mt[c] = np.nan
        return mt

    dr = daily_recent.sort_values(date_col).copy()
    dr["year_month"] = dr[date_col].dt.to_period("M")
    log_c = np.log(dr[price_col].astype(float))
    dr["logret_1"] = log_c.groupby(dr["year_month"]).diff()

    rows: list[dict[str, Any]] = []
    for ym, chunk in dr.groupby("year_month", sort=True):
        chunk = chunk.sort_values(date_col)
        r = chunk["logret_1"].dropna()
        if len(r) < 2:
            vol, skew = np.nan, np.nan
        else:
            vol = float(r.std(ddof=1))
            skew = float(r.skew())
        if len(chunk) >= 2 * late_rally_k and late_rally_k > 0:
            early = chunk.head(late_rally_k)["logret_1"]
            late = chunk.tail(late_rally_k)["logret_1"]
            proxy = float(late.mean() - early.mean())
        else:
            proxy = np.nan
        rows.append(
            {
                "year_month": ym,
                "daily_logret_vol_m": vol,
                "daily_logret_skew_m": skew,
                "late_rally_proxy_m": proxy,
            }
        )
    shape = pd.DataFrame(rows)
    mt = month_table.merge(shape, on="year_month", how="left")
    return mt


def build_ml_c_monthly_table(
    daily_recent: pd.DataFrame,
    *,
    include_shape_features: bool = True,
    late_rally_k: int = 5,
) -> pd.DataFrame:
    """
    Build supervised monthly rows from the 10-year daily sample.

    Target ``r_m = log(M_m / A_m)``. Deployable features use only average-based
    growth and calendar month (PARTC_1).

    Warm-up: first months lose ``g_lag1_A`` / ``vol_avg_m3``; complete cases for
    deployable OLS typically start ~4 months after the second month with valid A.
    """
    if daily_recent.empty:
        return pd.DataFrame()

    avg_m = _monthly_avg_from_daily(daily_recent)
    end_m = _monthly_month_end_from_daily(daily_recent)
    avg_m = avg_m.rename(columns={"Close_a_month_avg": COL_A_AVG})
    end_m = end_m.rename(columns={"Close": COL_M_MONTH_END})[
        ["year_month", "Date", COL_M_MONTH_END]
    ]

    tbl = avg_m.merge(
        end_m[["year_month", COL_M_MONTH_END]], on="year_month", how="inner"
    )
    tbl = tbl.rename(columns={"Date": "Date"})
    tbl[TARGET_COL] = np.log(tbl[COL_M_MONTH_END] / tbl[COL_A_AVG])

    tbl = _add_deployable_from_averages(tbl, date_col="Date", a_col=COL_A_AVG)

    if include_shape_features:
        tbl = _add_optional_shape_features(
            daily_recent, tbl, late_rally_k=late_rally_k
        )

    tbl["year_month_str"] = tbl["year_month"].astype(str)
    return tbl.sort_values("Date").reset_index(drop=True)


def monthly_table_complete_deployable(monthly_df: pd.DataFrame) -> pd.DataFrame:
    """Drop rows with NaN in target or any deployable feature."""
    cols = [TARGET_COL, *DEPLOYABLE_FEATURES]
    return monthly_df.dropna(subset=cols).reset_index(drop=True)


@dataclass
class MLCFit:
    """Wrapper around statsmodels OLS ``results`` with feature metadata."""

    result: Any
    feature_names: list[str]
    deployable_columns: list[str] = field(default_factory=lambda: list(DEPLOYABLE_FEATURES))

    @property
    def params(self) -> pd.Series:
        return self.result.params

    @property
    def pvalues(self) -> pd.Series:
        return self.result.pvalues

    @property
    def conf_int(self) -> pd.DataFrame:
        return self.result.conf_int()

    @property
    def rsquared(self) -> float:
        return float(self.result.rsquared)

    @property
    def rsquared_adj(self) -> float:
        return float(self.result.rsquared_adj)

    @property
    def nobs(self) -> float:
        return float(self.result.nobs)

    def summary(self) -> str:
        return str(self.result.summary())


def fit_ols_linear_g_only(monthly_df: pd.DataFrame) -> MLCFit:
    """
    OLS for ``r_m = log(M_m/A_m)`` using only ``g_m_A`` and ``g_lag1_A``.

    Fit on the 10-year monthly training table from :func:`build_ml_c_monthly_table`.
    Use :func:`predict_month_end_from_averages` to apply on ``partc`` early
    monthly-average rows.
    """
    if sm is None:
        raise ImportError(
            "fit_ols_linear_g_only requires statsmodels (pip install statsmodels)"
        )
    df = monthly_table_complete_g_pair(monthly_df)
    if df.empty:
        raise ValueError("no complete rows for linear g-only OLS")
    cols = list(LINEAR_G_ONLY_FEATURES)
    y = df[TARGET_COL].astype(float)
    X = df[cols].astype(float)
    X_const = sm.add_constant(X, has_constant="add")
    res = sm.OLS(y, X_const, missing="drop").fit()
    names = ["const", *cols]
    return MLCFit(result=res, feature_names=names, deployable_columns=list(cols))


def fit_ols_g_nonlinear(
    monthly_df: pd.DataFrame,
    variant: NonlinearGVariant,
) -> MLCFit:
    """
    OLS for ``r_m`` using only ``g_m_A``, ``g_lag1_A``, plus one or two nonlinear terms:

    - ``sq``: adds ``g_m_A_sq``
    - ``int``: adds ``g_m_A * g_lag1_A``
    - ``full``: both squared and interaction

    Uses all months with valid ``r_m``, ``g_m_A``, ``g_lag1_A`` (typically slightly
    more observations than the full deployable spec because vol / seasonals are omitted).
    """
    if sm is None:
        raise ImportError(
            "fit_ols_g_nonlinear requires statsmodels (pip install statsmodels)"
        )
    df = monthly_table_complete_g_pair(monthly_df)
    if df.empty:
        raise ValueError("no complete rows for g-pair nonlinear OLS")
    cols = nonlinear_g_feature_list(variant)
    y = df[TARGET_COL].astype(float)
    X = df[cols].astype(float)
    X_const = sm.add_constant(X, has_constant="add")
    res = sm.OLS(y, X_const, missing="drop").fit()
    names = ["const", *cols]
    return MLCFit(result=res, feature_names=names, deployable_columns=list(cols))


def fit_all_g_nonlinear_models(
    monthly_df: pd.DataFrame,
) -> dict[str, MLCFit]:
    """Fit the three nonlinear specs; keys ``sq``, ``int``, ``full``."""
    return {
        "sq": fit_ols_g_nonlinear(monthly_df, "sq"),
        "int": fit_ols_g_nonlinear(monthly_df, "int"),
        "full": fit_ols_g_nonlinear(monthly_df, "full"),
    }


def compare_g_nonlinear_models(monthly_df: pd.DataFrame) -> pd.DataFrame:
    """
    Side-by-side **in-sample** metrics for the three nonlinear ``g`` models plus a
    linear baseline (``g_m_A`` + ``g_lag1_A`` only).
    """
    if sm is None:
        raise ImportError("compare_g_nonlinear_models requires statsmodels")
    df = monthly_table_complete_g_pair(monthly_df)
    rows: list[dict[str, Any]] = []

    def _one(label: str, xcols: list[str]) -> None:
        y = df[TARGET_COL].astype(float)
        X = sm.add_constant(df[xcols].astype(float), has_constant="add")
        res = sm.OLS(y, X, missing="drop").fit()
        rows.append(
            {
                "model": label,
                "k_exog": int(len(xcols)),
                "nobs": float(res.nobs),
                "rsquared": float(res.rsquared),
                "rsquared_adj": float(res.rsquared_adj),
                "aic": float(res.aic),
                "bic": float(res.bic),
                "f_pvalue": float(getattr(res, "f_pvalue", float("nan"))),
            }
        )

    _one("linear_g_only", ["g_m_A", "g_lag1_A"])
    _one("nonlinear_sq", NONLINEAR_G_SQ_FEATURES)
    _one("nonlinear_int", NONLINEAR_G_INT_FEATURES)
    _one("nonlinear_full", NONLINEAR_G_FULL_FEATURES)
    return pd.DataFrame(rows)


def fit_ols_deployable(monthly_df: pd.DataFrame) -> MLCFit:
    """
    Fit OLS on deployable features only. Drops incomplete rows.
    Requires statsmodels.
    """
    if sm is None:
        raise ImportError("fit_ols_deployable requires statsmodels (pip install statsmodels)")
    df = monthly_table_complete_deployable(monthly_df)
    if df.empty:
        raise ValueError("no complete rows for OLS")
    y = df[TARGET_COL].astype(float)
    X = df[DEPLOYABLE_FEATURES].astype(float)
    X_const = sm.add_constant(X, has_constant="add")
    res = sm.OLS(y, X_const, missing="drop").fit()
    names = ["const", *DEPLOYABLE_FEATURES]
    return MLCFit(result=res, feature_names=names)


def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    """RMSE, MAE, R^2 (can be negative on holdout)."""
    y_true = np.asarray(y_true, dtype=float).ravel()
    y_pred = np.asarray(y_pred, dtype=float).ravel()
    mask = np.isfinite(y_true) & np.isfinite(y_pred)
    y_true, y_pred = y_true[mask], y_pred[mask]
    if y_true.size == 0:
        return {"rmse": float("nan"), "mae": float("nan"), "r2": float("nan"), "n": 0.0}
    err = y_pred - y_true
    rmse = float(np.sqrt(np.mean(err**2)))
    mae = float(np.mean(np.abs(err)))
    sst = float(np.sum((y_true - y_true.mean()) ** 2))
    r2 = float(1.0 - np.sum(err**2) / sst) if sst > 0 else float("nan")
    return {"rmse": rmse, "mae": mae, "r2": r2, "n": float(y_true.size)}


def _metrics_level_m(
    df_val: pd.DataFrame, y_pred_log: np.ndarray
) -> dict[str, float]:
    """RMSE of implied month-end level vs true M_m."""
    m_true = df_val[COL_M_MONTH_END].astype(float).to_numpy()
    a = df_val[COL_A_AVG].astype(float).to_numpy()
    m_hat = a * np.exp(np.asarray(y_pred_log, dtype=float))
    return evaluate_predictions(m_true, m_hat)


@dataclass
class CVReport:
    folds: list[dict[str, Any]]
    metrics_df: pd.DataFrame
    oof_predictions: pd.DataFrame


def _sliding_window_cv_ols_core(
    df: pd.DataFrame,
    exog_columns: list[str],
    *,
    n_folds: int = 5,
    train_months: int = 48,
    test_months: int = 12,
    min_train_months: int = 36,
) -> CVReport:
    """
    Sliding-window time CV on a **prepared** monthly frame (must include
    ``TARGET_COL``, ``exog_columns``, ``COL_M_MONTH_END``, ``COL_A_AVG``).
    """
    if sm is None:
        raise ImportError("_sliding_window_cv_ols_core requires statsmodels")
    miss = [c for c in [TARGET_COL, *exog_columns, COL_M_MONTH_END, COL_A_AVG] if c not in df.columns]
    if miss:
        raise ValueError(f"df missing columns: {miss}")

    d = df.dropna(subset=[TARGET_COL, *exog_columns]).reset_index(drop=True)
    n = len(d)
    need = n_folds * test_months + train_months
    if n < need:
        raise ValueError(
            f"Need at least n_folds*test_months + train_months = {need} complete rows; "
            f"got {n}. Reduce n_folds, test_months, or train_months."
        )
    if train_months < min_train_months:
        raise ValueError(
            f"train_months ({train_months}) < min_train_months ({min_train_months})"
        )

    folds: list[dict[str, Any]] = []
    oof_idx: list[int] = []
    oof_y: list[float] = []
    oof_yhat: list[float] = []

    for k in range(n_folds):
        val_end = n - k * test_months
        val_start = val_end - test_months
        train_end = val_start
        train_start = train_end - train_months
        if train_start < 0:
            raise ValueError(
                f"Fold {k}: train window [{train_start}, {train_end}) invalid; "
                "increase history or decrease train_months / n_folds / test_months."
            )
        tr = d.iloc[train_start:train_end]
        va = d.iloc[val_start:val_end]
        if len(tr) < min_train_months:
            raise ValueError(f"Fold {k}: train size {len(tr)} < min_train_months")

        y_tr = tr[TARGET_COL].astype(float)
        X_tr = sm.add_constant(tr[exog_columns].astype(float), has_constant="add")
        res = sm.OLS(y_tr, X_tr, missing="drop").fit()

        X_va = sm.add_constant(va[exog_columns].astype(float), has_constant="add")
        y_hat = np.asarray(res.predict(X_va), dtype=float)
        y_va = va[TARGET_COL].astype(float).to_numpy()

        m_log = evaluate_predictions(y_va, y_hat)
        m_lvl = _metrics_level_m(va, y_hat)

        folds.append(
            {
                "fold": k,
                "train_start_idx": int(train_start),
                "train_end_idx": int(train_end),
                "val_start_idx": int(val_start),
                "val_end_idx": int(val_end),
                "train_n": int(len(tr)),
                "val_n": int(len(va)),
                "rmse_r_log": m_log["rmse"],
                "mae_r_log": m_log["mae"],
                "r2_r_log": m_log["r2"],
                "rmse_M_level": m_lvl["rmse"],
                "mae_M_level": m_lvl["mae"],
                "r2_M_level": m_lvl["r2"],
            }
        )
        for j, i in enumerate(range(val_start, val_end)):
            oof_idx.append(i)
            oof_y.append(float(d.loc[i, TARGET_COL]))
            oof_yhat.append(float(y_hat[j]))

    metrics_df = pd.DataFrame(folds)
    oof = pd.DataFrame(
        {
            "row_index": oof_idx,
            "y_true_r": oof_y,
            "y_pred_r": oof_yhat,
        }
    )
    return CVReport(folds=folds, metrics_df=metrics_df, oof_predictions=oof)


def sliding_window_cv_ols(
    monthly_df: pd.DataFrame,
    *,
    n_folds: int = 5,
    train_months: int = 48,
    test_months: int = 12,
    min_train_months: int = 36,
) -> CVReport:
    """
    Time-ordered CV: K folds with non-overlapping validation blocks taken from the
    **end** of the sample (most recent block = fold 0 validation).

    For fold k (k=0 oldest val block among the K, or we use k=0 = most recent):
    Here: **fold 0** uses validation on the last ``test_months``;
    **fold 1** validates on the ``test_months`` immediately before that; etc.

    Training for each fold: the ``train_months`` rows immediately before that fold's
    validation window (rolling causal window).
    """
    df = monthly_table_complete_deployable(monthly_df).reset_index(drop=True)
    return _sliding_window_cv_ols_core(
        df,
        DEPLOYABLE_FEATURES,
        n_folds=n_folds,
        train_months=train_months,
        test_months=test_months,
        min_train_months=min_train_months,
    )


def sliding_window_cv_ols_exog(
    monthly_df: pd.DataFrame,
    exog_columns: list[str],
    *,
    n_folds: int = 5,
    train_months: int = 48,
    test_months: int = 12,
    min_train_months: int = 36,
    use_g_pair_table: bool = True,
) -> CVReport:
    """
    Same splitting scheme as :func:`sliding_window_cv_ols` but with a custom exog list.

    If ``use_g_pair_table`` (default True), builds the **g-pair** monthly frame
    (118 rows typical): ``r_m``, ``g_m_A``, ``g_lag1_A``, nonlinear terms, and
    month-end / average columns for level metrics.

    If False, expects ``monthly_df`` to already contain all ``exog_columns`` and
    required target/level columns.
    """
    if use_g_pair_table:
        df = monthly_table_complete_g_pair(monthly_df).reset_index(drop=True)
    else:
        df = monthly_df.reset_index(drop=True)
    return _sliding_window_cv_ols_core(
        df,
        exog_columns,
        n_folds=n_folds,
        train_months=train_months,
        test_months=test_months,
        min_train_months=min_train_months,
    )


def compare_g_models_cv(
    monthly_df: pd.DataFrame,
    *,
    n_folds: int = 5,
    train_months: int = 48,
    test_months: int = 12,
    min_train_months: int = 36,
) -> pd.DataFrame:
    """
    Run the same sliding-window CV for **linear_g_only** and the three nonlinear
    ``g`` specs; return one summary row per model (mean/std of fold metrics).

    Uses the **g-pair** sample size (typically slightly larger than the full
    deployable table).
    """
    df = monthly_table_complete_g_pair(monthly_df).reset_index(drop=True)
    specs: list[tuple[str, list[str]]] = [
        ("linear_g_only", ["g_m_A", "g_lag1_A"]),
        ("nonlinear_sq", list(NONLINEAR_G_SQ_FEATURES)),
        ("nonlinear_int", list(NONLINEAR_G_INT_FEATURES)),
        ("nonlinear_full", list(NONLINEAR_G_FULL_FEATURES)),
    ]
    kw: dict[str, Any] = dict(
        n_folds=n_folds,
        train_months=train_months,
        test_months=test_months,
        min_train_months=min_train_months,
    )
    rows: list[dict[str, Any]] = []
    for label, cols in specs:
        rep = _sliding_window_cv_ols_core(df, cols, **kw)
        m = rep.metrics_df
        rows.append(
            {
                "model": label,
                "mean_rmse_r_log": float(m["rmse_r_log"].mean()),
                "std_rmse_r_log": float(m["rmse_r_log"].std(ddof=1)),
                "mean_mae_r_log": float(m["mae_r_log"].mean()),
                "mean_r2_r_log": float(m["r2_r_log"].mean()),
                "mean_rmse_M_level": float(m["rmse_M_level"].mean()),
                "mean_r2_M_level": float(m["r2_M_level"].mean()),
            }
        )
    return pd.DataFrame(rows)


def paired_cv_metric_test(
    monthly_df: pd.DataFrame,
    exog_a: list[str],
    exog_b: list[str],
    *,
    label_a: str = "model_a",
    label_b: str = "model_b",
    metrics_lower_better: tuple[str, ...] = ("rmse_r_log", "mae_r_log", "rmse_M_level"),
    metrics_higher_better: tuple[str, ...] = ("r2_r_log", "r2_M_level"),
    n_folds: int = 5,
    train_months: int = 48,
    test_months: int = 12,
    min_train_months: int = 36,
    alternative: Literal["two-sided", "greater", "less"] = "two-sided",
) -> dict[str, Any]:
    """
    Paired comparison of two OLS specs on the **same** sliding-window CV folds.

    For metrics where **lower is better** (RMSE, MAE), ``diff = A - B`` per fold:
    **positive** means **B** had a **lower** error on that fold.

    For metrics where **higher is better** (R²), ``diff = A - B``: **negative**
    means **B** scored higher on that fold.

    Uses ``scipy.stats.ttest_rel`` and ``scipy.stats.wilcoxon`` on the paired
    differences (when SciPy is installed). With few folds, p-values are **rough**
    indicators only.

    Parameters
    ----------
    alternative
        Passed to the paired tests (e.g. ``\"greater\"`` with RMSE tests
        ``mean(RMSE_A - RMSE_B) > 0`` i.e. B systematically wins on error).
    """
    if sm is None:
        raise ImportError("paired_cv_metric_test requires statsmodels")

    df = monthly_table_complete_g_pair(monthly_df).reset_index(drop=True)
    kw: dict[str, Any] = dict(
        n_folds=n_folds,
        train_months=train_months,
        test_months=test_months,
        min_train_months=min_train_months,
    )
    rep_a = _sliding_window_cv_ols_core(df, exog_a, **kw)
    rep_b = _sliding_window_cv_ols_core(df, exog_b, **kw)

    ma = rep_a.metrics_df.reset_index(drop=True)
    mb = rep_b.metrics_df.reset_index(drop=True)
    if len(ma) != len(mb):
        raise RuntimeError("CV fold count mismatch")
    fold_idx = ma["fold"].tolist()

    out: dict[str, Any] = {
        "label_a": label_a,
        "label_b": label_b,
        "exog_a": list(exog_a),
        "exog_b": list(exog_b),
        "n_folds": int(len(ma)),
        "metrics": {},
        "fold_table": pd.DataFrame({"fold": fold_idx}),
        "note": (
            "Small n_folds => low power; p-values are indicative. "
            "Folds are overlapping in calendar time."
        ),
    }

    ft = out["fold_table"]
    for col in metrics_lower_better + metrics_higher_better:
        if col not in ma.columns or col not in mb.columns:
            continue
        a = ma[col].to_numpy(dtype=float)
        b = mb[col].to_numpy(dtype=float)
        d = a - b
        ft[f"{col}_{label_a}"] = a
        ft[f"{col}_{label_b}"] = b
        ft[f"{col}_diff_a_minus_b"] = d

        entry: dict[str, Any] = {
            "mean_a": float(np.nanmean(a)),
            "mean_b": float(np.nanmean(b)),
            "mean_diff_a_minus_b": float(np.nanmean(d)),
        }
        if scipy_stats is not None and len(d) > 1:
            tr = scipy_stats.ttest_rel(a, b, alternative=alternative)
            entry["ttest_statistic"] = float(tr.statistic)
            entry["ttest_pvalue"] = float(tr.pvalue)
            try:
                wr = scipy_stats.wilcoxon(d, alternative=alternative, zero_method="wilcox")
                entry["wilcoxon_statistic"] = float(wr.statistic)
                entry["wilcoxon_pvalue"] = float(wr.pvalue)
            except Exception as exc:  # pragma: no cover
                entry["wilcoxon_error"] = str(exc)
        else:
            entry["ttest_pvalue"] = float("nan")
            entry["wilcoxon_pvalue"] = float("nan")
            if scipy_stats is None:
                entry["test_note"] = "install scipy for ttest_rel / wilcoxon"

        out["metrics"][col] = entry

    return out


def paired_cv_linear_vs_nonlinear_int(
    monthly_df: pd.DataFrame,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Shorthand: ``linear_g_only`` vs ``nonlinear_int`` on the same CV folds.
    """
    return paired_cv_metric_test(
        monthly_df,
        ["g_m_A", "g_lag1_A"],
        list(NONLINEAR_G_INT_FEATURES),
        label_a="linear_g_only",
        label_b="nonlinear_int",
        **kwargs,
    )


def fit_ols_deployable_all_complete(monthly_df: pd.DataFrame) -> MLCFit:
    """Convenience: fit on all complete deployable rows (full 10y post warm-up)."""
    return fit_ols_deployable(monthly_df)


def predict_month_end_from_averages(
    monthly_avg_early: pd.DataFrame,
    fit: MLCFit,
    *,
    close_col: str = "Close",
    date_col: str = "Date",
    passthrough_cols: tuple[str, ...] = ("year_month", "granularity"),
) -> pd.DataFrame:
    """
    Apply fitted deployable OLS to a monthly-average panel (e.g. partc early window).

    Adds deployable features, drops incomplete rows, predicts ``r_m``, then
    ``Close_month_end_imputed = Close * exp(yhat)``.

    Columns listed in ``passthrough_cols`` are kept when present on the input
    (aligned by row before the ``dropna`` on deployable features).
    """
    if sm is None:
        raise ImportError("predict_month_end_from_averages requires statsmodels")
    keep_extra = [c for c in passthrough_cols if c in monthly_avg_early.columns]
    cols = [date_col, close_col, *keep_extra]
    df = monthly_avg_early[cols].copy()
    df = df.rename(columns={close_col: COL_A_AVG})
    df = _add_deployable_from_averages(df, date_col=date_col, a_col=COL_A_AVG)
    df = add_g_nonlinear_terms(df)

    pnames = list(fit.result.params.index)
    xcols = [c for c in pnames if str(c) != "const"]
    complete = df.dropna(subset=xcols).reset_index(drop=True)
    if complete.empty:
        return complete.assign(y_hat_r=np.nan, Close_month_end_imputed=np.nan)

    X = sm.add_constant(complete[xcols].astype(float), has_constant="add")
    if list(X.columns) != pnames:
        X = X.reindex(columns=pnames, fill_value=0.0)
    y_hat = np.asarray(fit.result.predict(X), dtype=float)
    out = complete.copy()
    out["y_hat_r"] = y_hat
    out["Close_month_end_imputed"] = out[COL_A_AVG].astype(float).to_numpy() * np.exp(
        y_hat
    )
    return out


def run_linear_g_only_impute_early(
    csv_path: str | Path | None = None,
    *,
    include_shape_features: bool = False,
) -> dict[str, Any]:
    """
    Fit **linear_g_only** on the last-10y monthly supervised table, then impute
    month-end levels on the **40y** ``monthly_avg_early`` panel from ``partc``.

    Returns
    -------
    dict
        ``fit`` — :class:`MLCFit`; ``monthly_10y`` — training table;
        ``monthly_avg_early`` — low-frequency panel; ``imputed_early`` — same with
        ``y_hat_r``, ``Close_month_end_imputed``.
    """
    from partc import build_part_c_split

    dr = build_daily_recent(csv_path)
    monthly_10y = build_ml_c_monthly_table(
        dr, include_shape_features=include_shape_features
    )
    fit = fit_ols_linear_g_only(monthly_10y)
    monthly_avg_early, _daily_recent, _comb = build_part_c_split(csv_path)
    imputed_early = predict_month_end_from_averages(monthly_avg_early, fit)
    return {
        "fit": fit,
        "monthly_10y": monthly_10y,
        "monthly_avg_early": monthly_avg_early,
        "imputed_early": imputed_early,
    }


def run_ml_c_pipeline(
    csv_path: str | Path | None = None,
    *,
    n_folds: int = 5,
    train_months: int = 48,
    test_months: int = 12,
) -> dict[str, Any]:
    """Load 10y tail, build monthly table, CV, refit on all complete rows."""
    dr = build_daily_recent(csv_path)
    monthly = build_ml_c_monthly_table(dr, include_shape_features=True)
    cv = sliding_window_cv_ols(
        monthly,
        n_folds=n_folds,
        train_months=train_months,
        test_months=test_months,
    )
    final = fit_ols_deployable_all_complete(monthly)
    return {
        "daily_recent": dr,
        "monthly": monthly,
        "cv_report": cv,
        "final_fit": final,
    }


if __name__ == "__main__":
    out = run_ml_c_pipeline()
    print("Monthly rows:", len(out["monthly"]))
    print(out["monthly"][[TARGET_COL, COL_M_MONTH_END, COL_A_AVG]].tail(3))
    print("\nCV metrics by fold:")
    print(out["cv_report"].metrics_df.to_string())
    print("\nFinal OLS summary (truncated):")
    print(out["final_fit"].summary()[:1200])
