"""
Part (b) dataset construction from ``spx_50yr.csv``.

Implements the sample structure from the case study:
- **First 40 years** (from first observation date): only **end-of-month**
  observations (last trading day in each calendar month).
- **Last 10 years**: **daily** observations (all trading days).

The split is calendar-based: ``daily_start = first_date + 40 years``; months
whose last in-sample trading day falls before ``daily_start`` contribute one
month-end row each; all rows on or after ``daily_start`` are kept as daily data
(no duplicate month-end row for a month that is already covered by daily data).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd

DEFAULT_CSV = Path(__file__).resolve().parent / "spx_50yr.csv"
MONTHLY_HISTORY_YEARS = 40
DAILY_TAIL_YEARS = 10


def load_spx_daily(csv_path: str | Path | None = None) -> pd.DataFrame:
    """Load full daily SPX history; columns Date (datetime), OHLCV."""
    path = Path(csv_path) if csv_path is not None else DEFAULT_CSV
    raw = pd.read_csv(path)
    df = raw.copy()
    df["Date"] = pd.to_datetime(df["Date"], format="%m/%d/%Y")
    for col in ("Open", "High", "Low", "Close", "Volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.sort_values("Date").reset_index(drop=True)


def build_part_b_dataset(csv_path: str | Path | None = None) -> pd.DataFrame:
    """
    Build the Part (b) mixed-frequency panel.

    Returns
    -------
    pd.DataFrame
        All columns from the CSV, plus:

        - ``granularity``: ``\"month_end\"`` or ``\"daily\"``.
        - ``year_month``: period string ``YYYY-MM`` for month-end rows; NaN for daily rows.

    Rows are sorted by ``Date``. Month-end rows use the **last trading day**
    of that calendar month in the source data.
    """
    daily_full = load_spx_daily(csv_path)
    if daily_full.empty:
        return pd.DataFrame()

    first_date = daily_full["Date"].min()
    daily_start = first_date + pd.DateOffset(years=MONTHLY_HISTORY_YEARS)

    daily_full["year_month"] = daily_full["Date"].dt.to_period("M")
    # Last row per calendar month (end-of-month proxy = last trading day).
    month_ends = daily_full.sort_values("Date").groupby("year_month", as_index=False).last()
    monthly_early = month_ends[month_ends["Date"] < daily_start].copy()
    monthly_early["granularity"] = "month_end"
    monthly_early["year_month"] = monthly_early["year_month"].astype(str)

    daily_recent = daily_full[daily_full["Date"] >= daily_start].copy()
    daily_recent["granularity"] = "daily"
    daily_recent["year_month"] = pd.NA

    out = pd.concat([monthly_early, daily_recent], ignore_index=True)
    out = out.sort_values("Date").reset_index(drop=True)
    return out


def build_part_b_split(
    csv_path: str | Path | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Same as ``build_part_b_dataset`` but returns three frames:

    Returns
    -------
    monthly_early, daily_recent, combined
        ``combined`` equals ``build_part_b_dataset(...)``.
    """
    combined = build_part_b_dataset(csv_path)
    if combined.empty:
        empty = pd.DataFrame()
        return empty, empty, empty
    monthly_early = combined[combined["granularity"] == "month_end"].reset_index(
        drop=True
    )
    daily_recent = combined[combined["granularity"] == "daily"].reset_index(drop=True)
    return monthly_early, daily_recent, combined


def split_summary(combined: pd.DataFrame) -> dict:
    """Small dict for logging / notebooks: date ranges and row counts."""
    if combined.empty:
        return {}
    m = combined[combined["granularity"] == "month_end"]
    d = combined[combined["granularity"] == "daily"]
    return {
        "first_date": combined["Date"].min(),
        "last_date": combined["Date"].max(),
        "daily_start": d["Date"].min() if len(d) else None,
        "n_month_end": int(len(m)),
        "n_daily": int(len(d)),
        "n_total": int(len(combined)),
    }


def compute_log_returns(
    daily_recent: pd.DataFrame, price_col: str = "Close"
) -> pd.Series:
    """
    Daily log returns on trading days only: ``r_t = log(P_t / P_{t-1})``.

    Rows are sorted by ``Date`` before differencing; the result is indexed by
    ``Date`` (no calendar filling). First row is dropped (NaN after shift).
    Use the same definition end-to-end for GARCH fitting and later simulation
    so monthly aggregation stays consistent with Part (b).

    Parameters
    ----------
    daily_recent
        Must include ``Date`` and ``price_col`` (e.g. ``Close`` from
        ``build_part_b_split``).
    price_col
        Price column used for returns.
    """
    if daily_recent.empty:
        return pd.Series(dtype=float, name="log_return")
    df = daily_recent.sort_values("Date")
    close = df[price_col].astype(float)
    # Index by Date so volatilities align to trading days only.
    r = np.log(close / close.shift(1))
    r.index = df["Date"].values
    r = r.dropna()
    r.name = "log_return"
    return r


@dataclass
class TGarchFitResult:
    """Output of :func:`fit_t_garch_on_daily_recent`."""

    p: int
    q: int
    mean: Literal["Constant", "Zero"]
    scale: float
    params: dict[str, float]
    conditional_volatility: pd.Series
    standardized_residuals: pd.Series
    fit: Any

    def __post_init__(self) -> None:
        self.conditional_volatility = self.conditional_volatility.rename(
            "cond_vol_log_return"
        )


def _fit_t_garch_log_returns(
    log_returns: pd.Series,
    p: int = 1,
    q: int = 1,
    *,
    mean: Literal["Constant", "Zero"] = "Constant",
    scale: float = 100.0,
    update_freq: int = 0,
    disp: str | None = "off",
) -> TGarchFitResult:
    """Fit Student-t GARCH(p,q) on a log-return series (requires ``arch``)."""
    from arch.univariate import arch_model

    if scale <= 0:
        raise ValueError("scale must be positive (e.g. 100 for percent units, or 1.0 for raw log returns)")
    y = log_returns.astype(float).dropna()
    if len(y) < max(50, p + q + 10):
        raise ValueError(
            f"need more observations for GARCH({p},{q}); got {len(y)} after dropna"
        )

    endog = y * scale
    kw: dict[str, Any] = dict(vol="Garch", p=p, o=1,q=q, power=1.0, dist="t")
    if mean == "Zero":
        am = arch_model(endog, mean="Zero", **kw)
    else:
        am = arch_model(endog, mean="Constant", **kw)

    res = am.fit(update_freq=update_freq, disp=disp)
    params = {str(k): float(v) for k, v in res.params.items()}

    # ``arch`` volatility is for ``endog`` = scale * log return.
    sigma_scaled = pd.Series(res.conditional_volatility, copy=True, index=y.index)
    sigma_log = sigma_scaled / scale

    std_resid = pd.Series(res.std_resid, copy=True, index=y.index)
    std_resid.name = "std_resid"

    return TGarchFitResult(
        p=p,
        q=q,
        mean=mean,
        scale=float(scale),
        params=params,
        conditional_volatility=sigma_log,
        standardized_residuals=std_resid,
        fit=res,
    )


def fit_t_garch_on_daily_recent(
    daily_recent: pd.DataFrame,
    p: int = 1,
    q: int = 1,
    *,
    mean: Literal["Constant", "Zero"] = "Constant",
    scale: float = 100.0,
    price_col: str = "Close",
    update_freq: int = 0,
    disp: str | None = "off",
) -> TGarchFitResult:
    """
    Student-t GARCH(p,q) on ``daily_recent`` log closes (``mean='Constant'`` default).

    Dependencies: ``pip install arch`` (NumPy / pandas versions per arch docs).

    Returns ``scale``: returns are multiplied by this value during estimation
    (default **100**, percent units) for numerical stability; the fitted
    ``fit`` object and ``params`` refer to that scaled series. Simulate with
    the same scaling. ``conditional_volatility`` is **converted back** to
    units of one-day log return (÷ ``scale``) for weights such as
    ``w ∝ σ̃`` in Part (b).

    Pitfalls
    --------
    - **Mean**: ``Constant`` vs ``Zero`` changes interpretation; keep the same
      choice for simulation.
    - **Alignment**: inputs are trading days only; do not calendar-fill before
      fitting.
    """
    r = compute_log_returns(daily_recent, price_col=price_col)
    return _fit_t_garch_log_returns(
        r, p=p, q=q, mean=mean, scale=scale, update_freq=update_freq, disp=disp
    )


def fit_t_garch_on_daily(
    daily: pd.DataFrame,
    p: int = 1,
    q: int = 1,
    *,
    mean: Literal["Constant", "Zero"] = "Constant",
    scale: float = 100.0,
    price_col: str = "Close",
    update_freq: int = 0,
    disp: str | None = "off",
) -> TGarchFitResult:
    """
    Student-t GARCH on any daily price panel (e.g. full ``load_spx_daily()``).

    Same implementation as :func:`fit_t_garch_on_daily_recent`; the name
    signals use with the entire ``spx_50yr.csv`` history rather than only the
    Part (b) ``daily_recent`` slice.
    """
    return fit_t_garch_on_daily_recent(
        daily,
        p=p,
        q=q,
        mean=mean,
        scale=scale,
        price_col=price_col,
        update_freq=update_freq,
        disp=disp,
    )


def compare_garch_orders(
    daily_recent: pd.DataFrame,
    *,
    orders: tuple[tuple[int, int], ...] = ((1, 1), (2, 1), (1, 2)),
    mean: Literal["Constant", "Zero"] = "Constant",
    scale: float = 100.0,
    criterion: Literal["aic", "bic"] = "bic",
    ljung_box_lags: int = 10,
    price_col: str = "Close",
    update_freq: int = 0,
    disp: str | None = "off",
) -> dict[str, Any]:
    """
    Fit a small (p,q) grid of t-GARCH models on ``daily_recent`` log returns.

    Compares **AIC** and **BIC** on the same sample. The **chosen** order
    minimizes ``criterion`` (default **BIC**, parsimony) among optimizations
    with ``convergence_flag == 0`` (scipy success). Runs **Ljung–Box** on
    **squared standardized residuals** of the chosen fit to check remaining
    serial correlation in squares (ARCH in residuals).

    Returns a dict with ``criteria_table``, ``chosen_order``, ``chosen_fit``,
    ``ljung_box_sq_std_residuals``, and ``model_selection_note`` for write-ups.

    Notes
    -----
    Likelihood-ratio tests between nested orders are possible but involve
    boundary issues; information criteria are the default decision rule here.
    """
    from statsmodels.stats.diagnostic import acorr_ljungbox

    rows: list[dict[str, Any]] = []
    fits: dict[tuple[int, int], TGarchFitResult] = {}

    for pv, qv in orders:
        try:
            out = fit_t_garch_on_daily_recent(
                daily_recent,
                p=pv,
                q=qv,
                mean=mean,
                scale=scale,
                price_col=price_col,
                update_freq=update_freq,
                disp=disp,
            )
            res = out.fit
            ok = int(getattr(res, "convergence_flag", -1)) == 0
            rows.append(
                {
                    "p": pv,
                    "q": qv,
                    "loglikelihood": float(res.loglikelihood),
                    "aic": float(res.aic),
                    "bic": float(res.bic),
                    "converged": ok,
                }
            )
            fits[(pv, qv)] = out
        except Exception as exc:  # pragma: no cover - robust notebook API
            rows.append(
                {
                    "p": pv,
                    "q": qv,
                    "loglikelihood": float("nan"),
                    "aic": float("nan"),
                    "bic": float("nan"),
                    "converged": False,
                    "error": str(exc),
                }
            )

    table = pd.DataFrame(rows)
    crit_col = criterion.lower()
    converged = table[table["converged"] & table[crit_col].notna()]
    if len(converged):
        best_idx = converged[crit_col].idxmin()
        chosen_p = int(table.loc[best_idx, "p"])
        chosen_q = int(table.loc[best_idx, "q"])
        note = (
            f"Chosen order GARCH({chosen_p},{chosen_q}) by minimum {crit_col.upper()} "
            f"among converged fits in grid {list(orders)}."
        )
    else:
        chosen_p, chosen_q = 1, 1
        note = (
            "No converged fit in grid; falling back to GARCH(1,1). "
            "Inspect criteria_table and errors."
        )

    chosen_key = (chosen_p, chosen_q)
    chosen_fit = fits.get(chosen_key)
    if chosen_fit is None:
        chosen_fit = fit_t_garch_on_daily_recent(
            daily_recent,
            p=chosen_p,
            q=chosen_q,
            mean=mean,
            scale=scale,
            price_col=price_col,
            update_freq=update_freq,
            disp=disp,
        )

    zs = chosen_fit.standardized_residuals.dropna() ** 2
    lb = acorr_ljungbox(zs, lags=ljung_box_lags, return_df=True)

    return {
        "criteria_table": table,
        "chosen_order": (chosen_p, chosen_q),
        "criterion": crit_col,
        "chosen_fit": chosen_fit,
        "ljung_box_sq_std_residuals": lb,
        "model_selection_note": note,
    }


DEFAULT_MONTHLY_EARLY_CSV = Path(__file__).resolve().parent / "monthly_early.csv"


def load_monthly_early_csv(csv_path: str | Path | None = None) -> pd.DataFrame:
    """
    Load ``monthly_early.csv`` (exported month-end early-era panel).

    Same logical content as the ``monthly_early`` frame from
    :func:`build_part_b_split` when both are built from the same daily history.
    """
    path = Path(csv_path) if csv_path is not None else DEFAULT_MONTHLY_EARLY_CSV
    df = pd.read_csv(path, index_col=0)
    df["Date"] = pd.to_datetime(df["Date"])
    for col in ("Open", "High", "Low", "Close", "Volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    if "granularity" not in df.columns:
        df["granularity"] = "month_end"
    return df.sort_values("Date").reset_index(drop=True)


if __name__ == "__main__":
    comb = build_part_b_dataset()
    s = split_summary(comb)
    print("Part (b) dataset summary:")
    for k, v in s.items():
        print(f"  {k}: {v}")
    print(comb.head(3).to_string())
    print("...")
    print(comb.tail(3).to_string())
