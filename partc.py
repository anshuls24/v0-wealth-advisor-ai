"""
Part (c) dataset construction from the same daily source as Part (b) (``spx_50yr.csv``).

Case-study assumption:
- **First 40 years** (from first observation date): you only observe **monthly
  average** levels (here: calendar-month means of daily OHLC; **Volume** is the
  **sum** of daily volume in the month), **not** month-end prints. Each row is
  dated by the **last trading day** of that month (calendar label / sort key),
  same cut as Part (b), but ``Close`` (and O/H/L) are **averages**.
- **Last 10 years**: **daily** observations (all trading days), identical to
  Part (b).

The split date is ``daily_start = first_date + 40 years``. A month contributes
at most one low-frequency row only if that month’s **last trading day** is
strictly before ``daily_start`` (same inclusion rule as Part (b) month-end rows).

For imputing month-end levels from averages and bridged GARCH paths, use the
last 10 years of dailies (see ``part c solution.txt``); this module only builds
the **observed** Part (c) panel.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from partb import MONTHLY_HISTORY_YEARS, load_spx_daily

MONTHLY_AVG_GRANULARITY = "monthly_avg"
DEFAULT_MONTHLY_AVG_CSV = Path(__file__).resolve().parent / "monthly_avg_early.csv"


def _monthly_average_ohlcv_from_daily(daily: pd.DataFrame) -> pd.DataFrame:
    """One row per calendar month: mean O/H/L/C, sum Volume, Date = last trading day."""
    if daily.empty:
        return pd.DataFrame()
    df = daily.sort_values("Date").copy()
    df["year_month"] = df["Date"].dt.to_period("M")
    agg_spec = {
        "Date": ("Date", "max"),
        "Open": ("Open", "mean"),
        "High": ("High", "mean"),
        "Low": ("Low", "mean"),
        "Close": ("Close", "mean"),
    }
    if "Volume" in df.columns:
        agg_spec["Volume"] = ("Volume", "sum")
    return df.groupby("year_month", as_index=False).agg(**agg_spec)


def build_part_c_dataset(csv_path: str | Path | None = None) -> pd.DataFrame:
    """
    Build the Part (c) mixed-frequency panel (monthly **averages** + daily tail).

    Returns
    -------
    pd.DataFrame
        Same OHLCV columns as the daily CSV where applicable, plus:

        - ``granularity``: ``\"monthly_avg\"`` or ``\"daily\"``.
        - ``year_month``: ``YYYY-MM`` for monthly rows; NA for daily rows.

        Rows are sorted by ``Date``. Monthly rows use the **last trading day**
        of that month as ``Date`` (for ordering and the ``Date < daily_start``
        cut), but levels are **monthly means**, not month-end closes.
    """
    daily_full = load_spx_daily(csv_path)
    if daily_full.empty:
        return pd.DataFrame()

    first_date = daily_full["Date"].min()
    daily_start = first_date + pd.DateOffset(years=MONTHLY_HISTORY_YEARS)

    monthly_all = _monthly_average_ohlcv_from_daily(daily_full)
    monthly_early = monthly_all[monthly_all["Date"] < daily_start].copy()
    monthly_early["granularity"] = MONTHLY_AVG_GRANULARITY
    monthly_early["year_month"] = monthly_early["year_month"].astype(str)

    daily_recent = daily_full[daily_full["Date"] >= daily_start].copy()
    daily_recent["granularity"] = "daily"
    daily_recent["year_month"] = pd.NA

    out = pd.concat([monthly_early, daily_recent], ignore_index=True)
    return out.sort_values("Date").reset_index(drop=True)


def build_part_c_split(
    csv_path: str | Path | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Same as :func:`build_part_c_dataset` but returns three frames.

    Returns
    -------
    monthly_avg_early, daily_recent, combined
        ``combined`` equals :func:`build_part_c_dataset`.
    """
    combined = build_part_c_dataset(csv_path)
    if combined.empty:
        empty = pd.DataFrame()
        return empty, empty, empty
    monthly_avg_early = combined[
        combined["granularity"] == MONTHLY_AVG_GRANULARITY
    ].reset_index(drop=True)
    daily_recent = combined[combined["granularity"] == "daily"].reset_index(
        drop=True
    )
    return monthly_avg_early, daily_recent, combined


def split_summary(combined: pd.DataFrame) -> dict:
    """Date ranges and row counts for logging / notebooks (Part c)."""
    if combined.empty:
        return {}
    m = combined[combined["granularity"] == MONTHLY_AVG_GRANULARITY]
    d = combined[combined["granularity"] == "daily"]
    return {
        "first_date": combined["Date"].min(),
        "last_date": combined["Date"].max(),
        "daily_start": d["Date"].min() if len(d) else None,
        "n_monthly_avg": int(len(m)),
        "n_daily": int(len(d)),
        "n_total": int(len(combined)),
    }


def load_monthly_avg_csv(csv_path: str | Path | None = None) -> pd.DataFrame:
    """
    Load ``monthly_avg_early.csv`` (exported monthly-average panel).

    Same logical content as the ``monthly_avg_early`` frame from
    :func:`build_part_c_split` when both are built from the same daily history.
    """
    path = Path(csv_path) if csv_path is not None else DEFAULT_MONTHLY_AVG_CSV
    df = pd.read_csv(path, index_col=0)
    df["Date"] = pd.to_datetime(df["Date"])
    for col in ("Open", "High", "Low", "Close", "Volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    if "granularity" not in df.columns:
        df["granularity"] = MONTHLY_AVG_GRANULARITY
    return df.sort_values("Date").reset_index(drop=True)


if __name__ == "__main__":
    comb = build_part_c_dataset()
    s = split_summary(comb)
    print("Part (c) dataset summary:")
    for k, v in s.items():
        print(f"  {k}: {v}")
    print(comb[comb["granularity"] == MONTHLY_AVG_GRANULARITY].head(3).to_string())
    print("...")
    print(comb.tail(3).to_string())
