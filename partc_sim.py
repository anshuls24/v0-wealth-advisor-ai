"""
PARTC_2: simulate daily log returns from a fitted t-GARCH (10y daily calibration),
then **rescale** only the **intramonth** closes ``P_1,…,P_n`` so their arithmetic
mean matches the observed monthly average from ``monthly_avg_early``. The month
boundary level ``P_0`` is **not** scaled: it equals the previous month’s simulated
last close (or the first row’s ``avg_start``), so paths **chain** like Part (b).

This mirrors ``partb_sim`` (PARTB_2) but swaps the **log-sum bridge to month-end**
for a **mean-on-levels** adjustment:

- Draw ``n`` GARCH log returns; build ``P_1,…,P_n`` from fixed ``P_0``.
- Target ``A = avg_end`` (observed calendar-month **mean** Close).
- ``c = A / mean(P_1,…,P_n)``; set ``P_i* = c P_i`` for ``i ≥ 1``, ``P_0* = P_0``.
  Then ``mean(P_1*,…,P_n*) = A``. Returns on days ``2,…,n`` match the GARCH draw;
  day ``1`` absorbs the rescaling.

Innovations: same as ``partb_sim`` (parametric standardized *t* or bootstrap
standardized residuals for GARCH(1,1)).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from partb import TGarchFitResult, load_spx_daily
from partb_sim import (
    InnovationKind,
    _normalize_year_month_token,
    max_drawdown_from_prices,
    partb2_path_drawdown_horizons,
    prices_from_log_returns,
    simulate_tgarch_segment_log_units,
)


### each row tells the simulator the observed start 
# and end levels for a calendar month span and how many trading 
# days fall in that span.

def partc2_month_table(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    *,
    price_col: str = "Close",
    date_col: str = "Date",
) -> pd.DataFrame:
    """
    One row per calendar month **interval** between consecutive low-frequency rows.

    ``avg_start`` / ``avg_end`` are **monthly mean closes** from the early panel
    (not month-end prints). Trading days in the interval satisfy
    ``date_start < Date <= date_end`` (same calendar construction as Part (b)).
    """
    if monthly_avg_early.empty:
        return pd.DataFrame()
    me = monthly_avg_early.sort_values(date_col).reset_index(drop=True)
    rows: list[dict[str, Any]] = []
    for i in range(len(me) - 1):
        d0 = me.loc[i, date_col]
        d1 = me.loc[i + 1, date_col]
        a0 = float(me.loc[i, price_col])
        a1 = float(me.loc[i + 1, price_col])
        r_from_avgs = float(np.log(a1 / a0)) if a0 > 0 and a1 > 0 else float("nan")
        mask = (daily_full[date_col] > d0) & (daily_full[date_col] <= d1)
        n_days = int(mask.sum())
        cal_slice = daily_full.loc[mask].sort_values(date_col).reset_index(drop=True)
        if n_days == 0:
            d_first = pd.NaT
            c_first = float("nan")
        else:
            d_first = cal_slice.iloc[0][date_col]
            c_first = float(cal_slice.iloc[0][price_col])
        d1_ts = pd.Timestamp(d1)
        rows.append(
            {
                "date_start": d0,
                "date_end": d1,
                "target_year_month": f"{d1_ts.year}-{d1_ts.month:02d}",
                "avg_start": a0,
                "avg_end": a1,
                "R_month_log_from_avgs": r_from_avgs,
                "n_days": n_days,
                "date_first_trading": d_first,
                "close_first_trading": c_first,
            }
        )
    return pd.DataFrame(rows)



### a single dictionary of bridge targets for one chosen calendar month 
# (the “target” month), using the same convention as partc2_month_table, but 
# looked up by (target_year, target_month) instead of looping over the whole history.
def bridge_interval_from_monthly_avg_early(
    monthly_avg_early: pd.DataFrame,
    target_year: int,
    target_month: int,
    *,
    date_col: str = "Date",
    price_col: str = "Close",
    year_month_col: str = "year_month",
    daily_full: pd.DataFrame | None = None,
) -> dict[str, Any]:
    """
    Bridge metadata for simulating one **target** calendar month under Part (c):

    - **End** row: ``target_year`` / ``target_month`` in ``year_month``.
    - **Start** row: the previous row (previous month’s **average** panel).
    """
    if monthly_avg_early.empty:
        raise ValueError("monthly_avg_early is empty")
    if year_month_col not in monthly_avg_early.columns:
        raise ValueError(
            f"monthly_avg_early must have column {year_month_col!r}"
        )
    ym_end = f"{int(target_year)}-{int(target_month):02d}"
    me = monthly_avg_early.sort_values(date_col).reset_index(drop=True)
    yms = me[year_month_col].astype(str).map(_normalize_year_month_token)
    hit = np.flatnonzero((yms == ym_end).to_numpy())
    if hit.size == 0:
        avail = sorted(yms.unique().tolist())[:8]
        raise ValueError(
            f"no monthly_avg_early row with {year_month_col}={ym_end!r}; "
            f"sample of available: {avail!r}"
        )
    if hit.size > 1:
        raise ValueError(f"ambiguous: multiple rows for target {ym_end!r}")
    i_end = int(hit[0])
    if i_end < 1:
        raise ValueError(
            f"target {ym_end!r} is the first row; no previous month for avg_start"
        )
    i_start = i_end - 1
    row_prev = me.iloc[i_start]
    row_cur = me.iloc[i_end]
    d0 = row_prev[date_col]
    d1 = row_cur[date_col]
    a0 = float(row_prev[price_col])
    a1 = float(row_cur[price_col])
    r_a = float(np.log(a1 / a0)) if a0 > 0 and a1 > 0 else float("nan")
    ym_prev = _normalize_year_month_token(str(row_prev[year_month_col]))
    out: dict[str, Any] = {
        "target_year_month": ym_end,
        "previous_year_month": ym_prev,
        "date_start": d0,
        "date_end": d1,
        "avg_start": a0,
        "avg_end": a1,
        "R_month_log_from_avgs": r_a,
        "monthly_avg_early_iloc_start": i_start,
        "monthly_avg_early_iloc_end": i_end,
        "month_table_row_index": i_start,
    }
    if daily_full is not None:
        mt = partc2_month_table(me, daily_full, date_col=date_col, price_col=price_col)
        if mt.empty or i_start >= len(mt):
            raise RuntimeError("month_table shorter than expected for cross-check")
        mr = mt.iloc[i_start]
        if not np.isclose(float(mr["avg_start"]), a0, rtol=1e-9, atol=1e-6):
            raise RuntimeError(
                f"month_table vs bridge_interval avg_start mismatch: {mr['avg_start']} vs {a0}"
            )
        if not np.isclose(float(mr["avg_end"]), a1, rtol=1e-9, atol=1e-6):
            raise RuntimeError(
                f"month_table vs bridge_interval avg_end mismatch: {mr['avg_end']} vs {a1}"
            )
        out["date_first_trading"] = mr["date_first_trading"]
        out["close_first_trading"] = float(mr["close_first_trading"])
    return out



### scales the intramonth prices so their arithmetic mean matches the observed monthly average
# by adjusting the first daily log return to absorb the scaling factor.

def _mean_scale_segment(
    p0: float,
    r_tilde: np.ndarray,
    avg_target: float,
    *,
    mean_tol: float = 1e-6,
) -> tuple[np.ndarray, np.ndarray]:
    """
    GARCH log returns → prices from fixed chain level ``p0``.

    Only **intramonth** closes ``P_1, …, P_n`` are scaled by ``c = A / mean(P_{1:n})``;
    ``P_0`` stays ``p0`` so the path connects to the previous month’s terminal.
    The **first** daily log return is adjusted; days ``2 … n`` keep GARCH ratios.
    """
    r_tilde = np.asarray(r_tilde, dtype=float)
    if p0 <= 0.0 or not np.isfinite(p0):       
        
        # p0 is previous month’s terminal close on the simulated path; 
        # for the first month, the panel’s avg_start        
        
        raise ValueError(f"invalid p0={p0}")

    if not np.isfinite(avg_target) or avg_target <= 0.0:
        raise ValueError(f"invalid avg_target={avg_target}")


    prices = prices_from_log_returns(float(p0), r_tilde)
    intra = prices[1:]
    if intra.size == 0:
        raise ValueError("n_days=0")
    m_raw = float(np.mean(intra))
    if not np.isfinite(m_raw) or m_raw <= 0.0:
        raise RuntimeError(f"non-positive mean raw intra-month prices: {m_raw}")
    c = avg_target / m_raw
    prices_star = prices.copy()
    prices_star[0] = float(p0)
    prices_star[1:] = intra * c
    m_star = float(np.mean(prices_star[1:]))
    if not np.isclose(m_star, avg_target, rtol=mean_tol, atol=mean_tol * max(abs(avg_target), 1.0)):
        raise RuntimeError(f"mean constraint failed: {m_star} vs {avg_target}")
    r_star = np.diff(np.log(prices_star))
    return prices_star, r_star


### end of simulated month → prev_terminal → next month’s p0 explicitly.
### each simulated segment starts at the previous segment’s terminal price

def simulate_partc2_path(
    month_table: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    rng: np.random.Generator,
    *,
    date_col: str = "Date",
    price_col: str = "Close",
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    mean_tol: float = 1e-6,
) -> dict[str, Any]:
    """
    One Monte Carlo path over consecutive Part (c) average-panel intervals.

    First interval: pre-month level ``P_0`` = ``avg_start`` from the table.
    Later intervals: ``P_0`` = terminal close of the previous simulated month.
    Each segment is mean-rescaled to ``avg_end``.
    """
    r_all: list[float] = []
    dates_out: list[pd.Timestamp] = []
    prev_terminal: float | None = None
    prices_arr: np.ndarray | None = None

    for mi, (_, row) in enumerate(month_table.iterrows()):
        d0 = row["date_start"]
        d1 = row["date_end"]
        avg_end = float(row["avg_end"])
        n = int(row["n_days"])
        if mi == 0:
            p0 = float(row["avg_start"])
        else:
            assert prev_terminal is not None
            p0 = float(prev_terminal)

        cal = (
            daily_full.loc[
                (daily_full[date_col] > d0) & (daily_full[date_col] <= d1)
            ]
            .sort_values(date_col)
            .reset_index(drop=True)
        )
        if len(cal) != n:
            raise ValueError(
                f"trading day count mismatch: table n_days={n} vs calendar {len(cal)}"
            )
        r_tilde, _sig = simulate_tgarch_segment_log_units(
            garch, n, rng, burn=burn, innovations=innovations
        )
        prices_m, r_star = _mean_scale_segment(
            p0, r_tilde, avg_end, mean_tol=mean_tol
        )
        prev_terminal = float(prices_m[-1])
        r_all.extend(r_star.tolist())
        dates_out.extend(cal[date_col].tolist())

        if mi == 0:
            prices_arr = np.asarray(prices_m, dtype=float)
        else:
            if not np.isclose(
                float(prices_m[0]),
                float(prices_arr[-1]),
                rtol=mean_tol,
                atol=mean_tol * max(abs(float(prices_arr[-1])), 1.0),
            ):
                raise RuntimeError(
                    f"month {mi}: segment start {prices_m[0]} vs chained {prices_arr[-1]}"
                )
            prices_arr = np.concatenate([prices_arr, prices_m[1:]])

    assert prices_arr is not None
    r_arr = np.asarray(r_all, dtype=float)

    return {
        "dates": pd.DatetimeIndex(dates_out),
        "r_star_log": r_arr,
        "prices": prices_arr,
        "max_drawdown_full": max_drawdown_from_prices(prices_arr),
    }


def partc2_monte_carlo(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    n_paths: int = 200,
    seed: int | None = None,
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    horizon_windows: dict[str, int] | None = None,
    date_col: str = "Date",
    price_col: str = "Close",
) -> dict[str, Any]:
    if horizon_windows is None:
        horizon_windows = {"1m": 21, "3m": 63, "6m": 126}

    month_table = partc2_month_table(
        monthly_avg_early, daily_full, date_col=date_col, price_col=price_col
    )
    if month_table.empty:
        raise ValueError("month_table is empty")

    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(n_paths)

    dd_full: list[float] = []
    dd_by_h: dict[str, list[float]] = {k: [] for k in horizon_windows}
    dd_by_h["full"] = []

    for p in range(n_paths):
        rng = np.random.default_rng(streams[p])
        path = simulate_partc2_path(
            month_table,
            daily_full,
            garch,
            rng,
            date_col=date_col,
            price_col=price_col,
            burn=burn,
            innovations=innovations,
        )
        dds = partb2_path_drawdown_horizons(path["prices"], horizon_windows)
        dd_full.append(dds["full"])
        dd_by_h["full"].append(dds["full"])
        for k in horizon_windows:
            dd_by_h[k].append(dds[k])

    pct = [1, 5, 50, 95, 99]
    rows = []
    for name in ["full", *list(horizon_windows.keys())]:
        sample = np.array(dd_by_h[name], dtype=float)
        row = {"horizon": name, "mean": float(np.mean(sample))}
        for q in pct:
            row[f"p{q}"] = float(np.percentile(sample, q))
        rows.append(row)
    summary = pd.DataFrame(rows)

    return {
        "month_table": month_table,
        "n_paths": n_paths,
        "innovations": innovations,
        "drawdowns_full": np.array(dd_full, dtype=float),
        "drawdowns_by_horizon": {k: np.array(v, dtype=float) for k, v in dd_by_h.items()},
        "drawdown_percentiles": summary,
        "seed": seed,
    }


##### IMPORTANT FUNCTIONS ARE DEFINED ABOVE ###################



def partc2_pool_rolling_simple_returns(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    windows: tuple[int, ...] = (30, 60, 90),
    n_paths: int = 100,
    seed: int | None = None,
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    date_col: str = "Date",
    price_col: str = "Close",
) -> dict[int, np.ndarray]:
    month_table = partc2_month_table(
        monthly_avg_early, daily_full, date_col=date_col, price_col=price_col
    )
    if month_table.empty:
        raise ValueError("month_table is empty")
    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(n_paths)
    accum: dict[int, list[np.ndarray]] = {w: [] for w in windows}

    for p in range(n_paths):
        rng = np.random.default_rng(streams[p])
        path = simulate_partc2_path(
            month_table,
            daily_full,
            garch,
            rng,
            date_col=date_col,
            price_col=price_col,
            burn=burn,
            innovations=innovations,
        )
        px = path["prices"]
        for w in windows:
            if len(px) <= w:
                continue
            r = px[w:] / px[:-w] - 1.0
            accum[w].append(r.astype(float, copy=False))

    out: dict[int, np.ndarray] = {}
    for w in windows:
        parts = accum[w]
        out[w] = np.concatenate(parts, axis=0) if parts else np.array([], dtype=float)
    return out


def _partc2_iter_simulated_paths(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    n_paths: int,
    seed: int | None,
    burn: int,
    innovations: InnovationKind,
    date_col: str,
    price_col: str,
):
    """Yield ``(path_index, path_dict)`` in lockstep with pooled calendar-month routines."""
    month_table = partc2_month_table(
        monthly_avg_early, daily_full, date_col=date_col, price_col=price_col
    )
    if month_table.empty:
        raise ValueError("month_table is empty")
    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(int(n_paths))
    for path_idx in range(int(n_paths)):
        rng = np.random.default_rng(streams[path_idx])
        path = simulate_partc2_path(
            month_table,
            daily_full,
            garch,
            rng,
            date_col=date_col,
            price_col=price_col,
            burn=burn,
            innovations=innovations,
        )
        yield path_idx, path


def simulate_partc2_path_at_pool_index(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    path_index: int,
    n_paths: int,
    seed: int | None = None,
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    date_col: str = "Date",
    price_col: str = "Close",
) -> dict[str, Any]:
    """
    Reconstruct the ``path_index``-th path from :func:`partc2_pool_calendar_month_simple_returns`
    (same ``seed``, ``n_paths``, GARCH settings).
    """
    if int(path_index) < 0 or int(path_index) >= int(n_paths):
        raise ValueError(f"path_index must be in [0, {n_paths})")
    month_table = partc2_month_table(
        monthly_avg_early, daily_full, date_col=date_col, price_col=price_col
    )
    if month_table.empty:
        raise ValueError("month_table is empty")
    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(int(n_paths))
    rng = np.random.default_rng(streams[int(path_index)])
    return simulate_partc2_path(
        month_table,
        daily_full,
        garch,
        rng,
        date_col=date_col,
        price_col=price_col,
        burn=burn,
        innovations=innovations,
    )


def partc_close_series_for_calendar_window(
    path: dict[str, Any],
    start_date,
    end_date,
) -> pd.DataFrame:
    """
    Simulated **daily** Close from ``start_date`` through ``end_date`` (inclusive),
    aligned with :func:`spx_rolling_buyhold.rolling_calendar_month_returns` windows.
    """
    dates = pd.DatetimeIndex(path["dates"])
    prices = np.asarray(path["prices"], dtype=float)
    px = prices[1:]
    df = pd.DataFrame({"Date": dates, "Close": px})
    d0 = pd.Timestamp(start_date)
    d1 = pd.Timestamp(end_date)
    return df[(df["Date"] >= d0) & (df["Date"] <= d1)].reset_index(drop=True)


def partc2_pool_calendar_month_simple_returns(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    horizons_months: tuple[int, ...] = (1, 3, 6),
    n_paths: int = 100,
    seed: int | None = None,
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    date_col: str = "Date",
    price_col: str = "Close",
) -> dict[int, np.ndarray]:
    from spx_rolling_buyhold import rolling_calendar_month_returns

    accum: dict[int, list[np.ndarray]] = {h: [] for h in horizons_months}

    for _path_idx, path in _partc2_iter_simulated_paths(
        monthly_avg_early,
        daily_full,
        garch,
        n_paths=n_paths,
        seed=seed,
        burn=burn,
        innovations=innovations,
        date_col=date_col,
        price_col=price_col,
    ):
        dates = path["dates"]
        prices = path["prices"]
        day_df = pd.DataFrame(
            {
                "Date": pd.to_datetime(dates),
                "Close": prices[1:].astype(float),
            }
        )
        for hm in horizons_months:
            rdf = rolling_calendar_month_returns(day_df, hm, price_col="Close")
            if rdf.empty:
                continue
            accum[hm].append(rdf["return"].to_numpy(dtype=float))

    out: dict[int, np.ndarray] = {}
    for h in horizons_months:
        parts = accum[h]
        out[h] = np.concatenate(parts, axis=0) if parts else np.array([], dtype=float)
    return out


def partc2_pool_calendar_month_returns_detailed(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    horizons_months: tuple[int, ...] = (1, 3, 6),
    n_paths: int = 100,
    seed: int | None = None,
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    date_col: str = "Date",
    price_col: str = "Close",
) -> dict[int, pd.DataFrame]:
    """
    Same simulation as :func:`partc2_pool_calendar_month_simple_returns`, but keep each
    rolling window’s ``start_date`` / ``end_date`` / prices / ``path_id``.
    """
    from spx_rolling_buyhold import rolling_calendar_month_returns

    accum: dict[int, list[pd.DataFrame]] = {h: [] for h in horizons_months}

    for path_idx, path in _partc2_iter_simulated_paths(
        monthly_avg_early,
        daily_full,
        garch,
        n_paths=n_paths,
        seed=seed,
        burn=burn,
        innovations=innovations,
        date_col=date_col,
        price_col=price_col,
    ):
        dates = path["dates"]
        prices = path["prices"]
        day_df = pd.DataFrame(
            {
                "Date": pd.to_datetime(dates),
                "Close": prices[1:].astype(float),
            }
        )
        for hm in horizons_months:
            rdf = rolling_calendar_month_returns(day_df, hm, price_col="Close")
            if rdf.empty:
                continue
            chunk = rdf.copy()
            chunk.insert(0, "path_id", int(path_idx))
            accum[hm].append(chunk)

    out: dict[int, pd.DataFrame] = {}
    for h in horizons_months:
        parts = accum[h]
        out[h] = (
            pd.concat(parts, ignore_index=True)
            if parts
            else pd.DataFrame(
                columns=[
                    "path_id",
                    "start_date",
                    "end_date",
                    "start_price",
                    "end_price",
                    "return",
                ]
            )
        )
    return out


def list_allowed_bridge_months_partc(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    *,
    date_col: str = "Date",
    price_col: str = "Close",
) -> list[tuple[int, int]]:
    mt = partc2_month_table(
        monthly_avg_early, daily_full, date_col=date_col, price_col=price_col
    )
    if mt.empty:
        return []
    de = pd.to_datetime(mt["date_end"])
    pairs = sorted({(int(y), int(m)) for y, m in zip(de.dt.year, de.dt.month)})
    return pairs


def simulate_partc2_month_paths(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    year: int,
    month: int,
    n_paths: int = 50,
    seed: int | None = 42,
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    date_col: str = "Date",
    price_col: str = "Close",
    mean_tol: float = 1e-6,
) -> dict[str, Any]:
    allowed = list_allowed_bridge_months_partc(
        monthly_avg_early, daily_full, date_col=date_col, price_col=price_col
    )
    if (year, month) not in allowed:
        raise ValueError(
            f"(year={year}, month={month}) is not an interval end in monthly_avg_early"
        )

    bi = bridge_interval_from_monthly_avg_early(
        monthly_avg_early,
        year,
        month,
        date_col=date_col,
        price_col=price_col,
        daily_full=daily_full,
    )
    d0 = bi["date_start"]
    d1 = bi["date_end"]
    a0 = float(bi["avg_start"])
    a1 = float(bi["avg_end"])

    cal = (
        daily_full.loc[
            (daily_full[date_col] > d0) & (daily_full[date_col] <= d1)
        ]
        .sort_values(date_col)
        .reset_index(drop=True)
    )
    n = len(cal)
    mt = partc2_month_table(monthly_avg_early, daily_full, date_col=date_col, price_col=price_col)
    mrow = mt.iloc[bi["month_table_row_index"]]
    if n != int(mrow["n_days"]):
        raise ValueError(
            f"trading day count mismatch: calendar {n} vs month_table n_days={mrow['n_days']}"
        )
    d_first = mrow["date_first_trading"]
    p1 = float(mrow["close_first_trading"])

    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(int(n_paths))
    prices_paths = np.empty((n_paths, n + 1), dtype=float)
    r_paths = np.empty((n_paths, n), dtype=float)
    mean_err = np.empty(n_paths, dtype=float)

    for p in range(n_paths):
        rng = np.random.default_rng(streams[p])
        r_tilde, _sig = simulate_tgarch_segment_log_units(
            garch, n, rng, burn=burn, innovations=innovations
        )
        prices_m, r_star = _mean_scale_segment(a0, r_tilde, a1, mean_tol=mean_tol)
        prices_paths[p, :] = prices_m
        r_paths[p, :] = r_star
        mean_err[p] = abs(float(np.mean(prices_m[1:])) - a1)

    dates = pd.DatetimeIndex(cal[date_col].to_numpy())

    return {
        "year": int(year),
        "month": int(month),
        "target_year_month": bi["target_year_month"],
        "previous_year_month": bi["previous_year_month"],
        "monthly_avg_early_iloc_start": bi["monthly_avg_early_iloc_start"],
        "monthly_avg_early_iloc_end": bi["monthly_avg_early_iloc_end"],
        "month_table_row_index": bi["month_table_row_index"],
        "date_start": d0,
        "date_end": d1,
        "date_first_trading": d_first,
        "close_first_trading": p1,
        "avg_start": a0,
        "avg_end": a1,
        "R_month_log_from_avgs": float(bi["R_month_log_from_avgs"]),
        "n_trading_days": n,
        "dates": dates,
        "prices_paths": prices_paths,
        "r_star_log_paths": r_paths,
        "max_abs_mean_error": float(np.max(mean_err)),
        "allowed_year_months": allowed,
        "innovations": innovations,
        # Aliases for plotting helpers that reference close_start/close_end
        "close_start": a0,
        "close_end": a1,
    }


def month_paths_plot_data_partc(month_mc: dict[str, Any]) -> dict[str, Any]:
    """Plot helper: shared reference ``avg_start``; paths need not share scaled P0."""
    dates = pd.to_datetime(month_mc["dates"])
    if len(dates) == 0:
        raise ValueError("month_mc has no trading dates")
    px = np.asarray(month_mc["prices_paths"], dtype=float)
    a0 = float(month_mc["avg_start"])
    a1 = float(month_mc["avg_end"])
    xs0 = pd.Timestamp(month_mc["date_start"])
    n_p = int(px.shape[0])
    horiz_x: list[pd.Timestamp] = [xs0, pd.Timestamp(dates[0])]
    horiz_y = [a0, a0]
    path_xys: list[tuple[list[pd.Timestamp], list[float]]] = []
    for p in range(n_p):
        d0 = pd.Timestamp(dates[0])
        xs_p: list[pd.Timestamp] = [d0, d0] + [pd.Timestamp(t) for t in dates[1:]]
        ys_p: list[float] = [float(px[p, 0]), float(px[p, 1])] + [
            float(x) for x in px[p, 2:]
        ]
        path_xys.append((xs_p, ys_p))
    return {
        "date_anchor": xs0,
        "avg_anchor": a0,
        "avg_target_mean": a1,
        "horizontal_x": horiz_x,
        "horizontal_y": horiz_y,
        "path_xys": path_xys,
        "n_paths": n_p,
        "xlim_left": xs0 - pd.Timedelta(days=3),
        "xlim_right": pd.Timestamp(dates.max()) + pd.Timedelta(days=2),
        "target_year_month": month_mc.get("target_year_month"),
        "year": month_mc.get("year"),
        "month": month_mc.get("month"),
    }


def _panel_avg_close_for_year_month(
    monthly_avg_early: pd.DataFrame,
    target_year_month: str,
    *,
    year_month_col: str = "year_month",
    price_col: str = "Close",
) -> float | None:
    """``Close`` on the ``monthly_avg_early`` row for ``target_year_month`` (calendar mean level)."""
    if monthly_avg_early.empty or year_month_col not in monthly_avg_early.columns:
        return None
    ym_n = _normalize_year_month_token(str(target_year_month))
    yms = monthly_avg_early[year_month_col].astype(str).map(_normalize_year_month_token)
    sub = monthly_avg_early[yms == ym_n]
    if sub.empty:
        return None
    if "Date" in sub.columns:
        sub = sub.sort_values("Date")
    return float(sub.iloc[0][price_col])


def plot_partc2_month_mc_paths(
    month_mc: dict[str, Any],
    *,
    monthly_avg_early: pd.DataFrame | None = None,
    title_suffix: str | None = None,
    figsize: tuple[float, float] = (10, 5),
):
    """
    Plot bridged paths. If ``monthly_avg_early`` is passed, the dashed horizontal
    is labeled using the panel’s ``Close`` for ``target_year_month`` (the value the
    simulation mean-matches).
    """
    import matplotlib.pyplot as plt

    d = month_paths_plot_data_partc(month_mc)
    n_p = d["n_paths"]
    fig, ax = plt.subplots(figsize=figsize)
    ym_key = d.get("target_year_month") or month_mc.get("target_year_month")
    if ym_key is None and d.get("year") is not None and d.get("month") is not None:
        ym_key = f"{int(d['year'])}-{int(d['month']):02d}"
    panel_avg: float | None = None
    if monthly_avg_early is not None and ym_key is not None:
        panel_avg = _panel_avg_close_for_year_month(
            monthly_avg_early, str(ym_key)
        )
    sim_avg = float(month_mc["avg_end"])
    if panel_avg is not None and not np.isclose(panel_avg, sim_avg, rtol=0.0, atol=1e-4):
        raise ValueError(
            f"monthly_avg_early Close for {ym_key!r} ({panel_avg}) != month_mc avg_end ({sim_avg})"
        )

    mean_label = (
        f"monthly_avg_early[{ym_key}] Close (target mean) = {panel_avg:.6f}"
        if panel_avg is not None
        else f"target mean Close (avg_end) = {sim_avg:.6f}"
    )
    ax.plot(
        d["horizontal_x"],
        d["horizontal_y"],
        color="forestgreen",
        lw=2.2,
        zorder=4,
        label=f"prev month avg (reference) = {d['avg_anchor']:.2f}",
    )
    ax.scatter(
        [d["date_anchor"]],
        [d["avg_anchor"]],
        color="navy",
        s=48,
        zorder=6,
        label="anchor date (reference)",
    )
    for xs, ys in d["path_xys"]:
        ax.plot(
            xs,
            ys,
            color="steelblue",
            alpha=max(0.08, min(0.5, 8.0 / n_p)),
            lw=0.9,
        )
    y_mean = panel_avg if panel_avg is not None else d["avg_target_mean"]
    ax.axhline(
        y_mean,
        color="darkred",
        ls="--",
        lw=1.2,
        label=mean_label,
    )
    ym_title = str(ym_key) if ym_key is not None else (
        f"{int(d['year'])}-{int(d['month']):02d}"
        if d.get("year") is not None and d.get("month") is not None
        else "?"
    )
    if panel_avg is not None:
        note = (
            f"Observed mean for {ym_title} (monthly_avg_early Close):\n"
            f"{panel_avg:.6f}\n"
            f"(matches simulation avg_end within tol)"
        )
    else:
        note = (
            f"Target mean for {ym_title} (avg_end from month_mc):\n{sim_avg:.6f}\n"
            f"(pass monthly_avg_early=… to label from panel)"
        )
    ax.text(
        0.02,
        0.98,
        note,
        transform=ax.transAxes,
        va="top",
        ha="left",
        fontsize=8,
        linespacing=1.25,
        bbox={"boxstyle": "round,pad=0.35", "facecolor": "wheat", "alpha": 0.88},
    )
    suff = f" — {title_suffix}" if title_suffix else ""
    ax.set_title(f"Part (c) mean-matched sim paths — {ym_title} (n_paths={n_p}){suff}")
    ax.set_xlabel("Date")
    ax.set_ylabel("Simulated Close")
    ax.set_xlim(left=d["xlim_left"], right=d["xlim_right"])
    ax.legend(loc="best", fontsize=8)
    fig.autofmt_xdate()
    plt.tight_layout()
    return fig, ax


def month_paths_to_long_df_partc(result: dict[str, Any]) -> pd.DataFrame:
    dates: pd.DatetimeIndex = result["dates"]
    px: np.ndarray = result["prices_paths"]
    n_paths, _n1 = px.shape
    d0 = pd.Timestamp(result["date_start"])
    a1 = float(result["avg_end"])
    rows: list[dict[str, Any]] = []
    for p in range(n_paths):
        rows.append(
            {
                "Date": d0,
                "path_id": p,
                "Close_sim": float(px[p, 0]),
                "row_kind": "pre_month_anchor_scaled",
            }
        )
        for k in range(len(dates)):
            rows.append(
                {
                    "Date": dates[k],
                    "path_id": p,
                    "Close_sim": float(px[p, k + 1]),
                    "row_kind": "eod",
                }
            )
        m_path = float(np.mean(px[p, 1:]))
        if not np.isclose(m_path, a1, rtol=1e-5, atol=1e-5 * max(abs(a1), 1.0)):
            raise RuntimeError(
                f"path {p}: in-month mean {m_path} vs avg_end {a1}"
            )
    out = pd.DataFrame(rows)
    return out.sort_values(["path_id", "Date", "row_kind"], kind="mergesort").reset_index(
        drop=True
    )


def partc_slice_month_table_calendar_year_span(
    month_table: pd.DataFrame,
    start_year: int,
    n_years: int = 3,
    *,
    date_end_col: str = "date_end",
) -> pd.DataFrame:
    """
    Rows whose target month (``date_end`` calendar year) lies in
    ``start_year … start_year + n_years - 1`` inclusive.
    """
    if month_table.empty:
        return month_table
    de = pd.to_datetime(month_table[date_end_col])
    y0 = int(start_year)
    y1 = y0 + int(n_years) - 1
    return month_table[(de.dt.year >= y0) & (de.dt.year <= y1)].reset_index(drop=True)


def partc_feasible_calendar_year_starts(
    month_table: pd.DataFrame,
    n_years: int = 3,
    *,
    date_end_col: str = "date_end",
) -> list[int]:
    """Calendar years ``Y`` such that the slice ``[Y, Y+n_years-1]`` has ≥1 month row."""
    if month_table.empty:
        return []
    de = pd.to_datetime(month_table[date_end_col])
    y_min = int(de.min().year)
    y_max = int(de.max().year)
    last_start = y_max - int(n_years) + 1
    if last_start < y_min:
        return []
    return list(range(y_min, last_start + 1))


def partc_pick_random_calendar_year_start(
    month_table: pd.DataFrame,
    rng: np.random.Generator,
    n_years: int = 3,
) -> int:
    opts = partc_feasible_calendar_year_starts(month_table, n_years=n_years)
    if not opts:
        raise ValueError(f"no {n_years}-year span fits month_table date_end range")
    return int(rng.choice(opts))


def validate_partc_path_monthly_means(
    path: dict[str, Any],
    month_table_slice: pd.DataFrame,
    *,
    mean_rtol: float = 1e-9,
    mean_atol: float = 1e-5,
) -> pd.DataFrame:
    """
    For each month row in ``month_table_slice``, compare the mean of simulated
    daily closes on that month’s trading days to ``avg_end`` (panel mean).
    """
    dates = pd.DatetimeIndex(path["dates"])
    prices = np.asarray(path["prices"], dtype=float)
    if prices.size != len(dates) + 1:
        raise ValueError(
            f"expected len(prices)==len(dates)+1; got {prices.size} vs {len(dates)}"
        )
    px = prices[1:]
    rows: list[dict[str, Any]] = []
    for _, row in month_table_slice.iterrows():
        d0 = pd.Timestamp(row["date_start"])
        d1 = pd.Timestamp(row["date_end"])
        target = float(row["avg_end"])
        ym = str(row["target_year_month"]) if "target_year_month" in row.index else d1.strftime("%Y-%m")
        mask = (dates > d0) & (dates <= d1)
        m_arr = np.asarray(mask, dtype=bool)
        n_hit = int(m_arr.sum())
        if n_hit == 0:
            raise ValueError(f"no simulated dates in ({d0}, {d1}] for {ym}")
        if n_hit != int(row["n_days"]):
            raise ValueError(
                f"{ym}: mask count {n_hit} vs month_table n_days {row['n_days']}"
            )
        sim_mean = float(np.mean(px[m_arr]))
        err = sim_mean - target
        tol = mean_atol * max(abs(target), 1.0)
        rows.append(
            {
                "target_year_month": ym,
                "date_end": d1,
                "n_days": n_hit,
                "avg_end_panel": target,
                "sim_mean_close": sim_mean,
                "error": err,
                "abs_error": abs(err),
                "ok": bool(np.isclose(sim_mean, target, rtol=mean_rtol, atol=tol)),
            }
        )
    return pd.DataFrame(rows)


def simulate_partc2_year_span_batch(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    start_year: int | None = None,
    n_years: int = 3,
    n_paths: int = 24,
    seed: int | None = None,
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    mean_tol: float = 1e-6,
    date_col: str = "Date",
    price_col: str = "Close",
    randomize_start_year: bool = False,
) -> dict[str, Any]:
    """
    Simulate ``n_paths`` chained paths over ``n_years`` consecutive calendar years
    (months taken from ``monthly_avg_early`` / ``partc2_month_table``).

    If ``start_year`` is None and ``randomize_start_year`` is True, picks a feasible
    start year with :func:`partc_pick_random_calendar_year_start`. If ``start_year``
    is None and ``randomize_start_year`` is False, uses the earliest feasible year.

    Returns per-path monthly validation tables; ``all_ok`` is True iff every
    month on every path passes the mean check.
    """
    month_full = partc2_month_table(
        monthly_avg_early, daily_full, date_col=date_col, price_col=price_col
    )
    if month_full.empty:
        raise ValueError("month_table is empty")

    rng_pick = np.random.default_rng(seed)
    if start_year is None:
        if randomize_start_year:
            start_year = partc_pick_random_calendar_year_start(
                month_full, rng_pick, n_years=n_years
            )
        else:
            opts = partc_feasible_calendar_year_starts(month_full, n_years=n_years)
            if not opts:
                raise ValueError("no feasible start year")
            start_year = opts[0]

    month_slice = partc_slice_month_table_calendar_year_span(
        month_full, int(start_year), n_years
    )
    if month_slice.empty:
        raise ValueError(
            f"empty slice for start_year={start_year}, n_years={n_years}"
        )

    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(int(n_paths))
    paths: list[dict[str, Any]] = []
    validations: list[pd.DataFrame] = []

    for p in range(n_paths):
        rng = np.random.default_rng(streams[p])
        path = simulate_partc2_path(
            month_slice,
            daily_full,
            garch,
            rng,
            date_col=date_col,
            price_col=price_col,
            burn=burn,
            innovations=innovations,
            mean_tol=mean_tol,
        )
        paths.append(path)
        v = validate_partc_path_monthly_means(path, month_slice)
        v.insert(0, "path_id", p)
        validations.append(v)

    val_long = pd.concat(validations, ignore_index=True)
    by_month = (
        val_long.groupby("target_year_month", sort=True)
        .agg(
            avg_end_panel=("avg_end_panel", "first"),
            sim_mean_min=("sim_mean_close", "min"),
            sim_mean_max=("sim_mean_close", "max"),
            abs_err_max=("abs_error", "max"),
            all_ok=("ok", "all"),
        )
        .reset_index()
    )

    return {
        "start_year": int(start_year),
        "n_years": int(n_years),
        "n_paths": int(n_paths),
        "month_table_full": month_full,
        "month_table_slice": month_slice,
        "paths": paths,
        "validation_long": val_long,
        "validation_by_month": by_month,
        "all_ok": bool(val_long["ok"].all()),
        "max_abs_error": float(val_long["abs_error"].max()),
        "seed": seed,
        "innovations": innovations,
    }


def plot_partc_year_span_validation(
    batch: dict[str, Any],
    *,
    max_paths_price: int = 10,
    figsize: tuple[float, float] = (11, 10),
    title_suffix: str | None = None,
):
    """
    Three panels: (1) simulated price paths vs ``monthly_avg_early`` monthly means
    at ``date_end``; (2) ribbon of sim monthly means across paths vs panel; (3) max
    absolute mean error per month across paths (should be ≈0).
    """
    import matplotlib.pyplot as plt

    mt = batch["month_table_slice"]
    val_long = batch["validation_long"]
    by_m = batch["validation_by_month"]
    paths = batch["paths"]
    y0 = batch["start_year"]
    ny = batch["n_years"]

    fig, axes = plt.subplots(3, 1, figsize=figsize, height_ratios=[2.0, 1.1, 1.0])
    ax0, ax1, ax2 = axes

    dates_panel = pd.to_datetime(mt["date_end"])
    y_panel = mt["avg_end"].to_numpy(dtype=float)
    ax0.step(
        dates_panel,
        y_panel,
        where="post",
        color="darkred",
        lw=2.0,
        label="monthly_avg_early avg_end (step)",
    )
    ax0.scatter(
        dates_panel,
        y_panel,
        color="darkred",
        s=22,
        zorder=5,
        label=None,
    )

    n_show = min(int(batch["n_paths"]), max_paths_price)
    for i in range(n_show):
        p = paths[i]
        d = pd.DatetimeIndex(p["dates"])
        px = np.asarray(p["prices"], dtype=float)[1:]
        ax0.plot(d, px, color="steelblue", alpha=0.35, lw=0.85, label=None)
    if n_show > 0:
        ax0.plot([], [], color="steelblue", lw=1.0, label=f"sim paths (n={n_show} shown)")

    ax0.set_ylabel("Close")
    ax0.set_title(
        f"Part (c) {ny}-year span from {y0} — prices vs panel monthly means"
        + (f" — {title_suffix}" if title_suffix else "")
    )
    ax0.legend(loc="upper left", fontsize=8)
    ax0.grid(True, alpha=0.25)

    x_ord = np.arange(len(by_m))
    panel_line = by_m["avg_end_panel"].to_numpy(dtype=float)
    sim_min = by_m["sim_mean_min"].to_numpy(dtype=float)
    sim_max = by_m["sim_mean_max"].to_numpy(dtype=float)
    ax1.fill_between(
        x_ord,
        sim_min,
        sim_max,
        color="steelblue",
        alpha=0.25,
        label="sim monthly mean (min–max over paths)",
    )
    ax1.plot(x_ord, panel_line, "k-", lw=2.0, label="panel avg_end")
    ax1.set_xticks(x_ord)
    ax1.set_xticklabels(by_m["target_year_month"], rotation=90, fontsize=7)
    ax1.set_ylabel("Monthly mean Close")
    ax1.legend(loc="upper left", fontsize=8)
    ax1.grid(True, alpha=0.25)
    ax1.set_title("Per-calendar-month: simulated mean range vs panel")

    err = by_m["abs_err_max"].to_numpy(dtype=float)
    ax2.bar(x_ord, err, color="teal", alpha=0.85)
    ax2.set_xticks(x_ord)
    ax2.set_xticklabels(by_m["target_year_month"], rotation=90, fontsize=7)
    ax2.set_ylabel("max |error| over paths")
    ax2.set_title("Mean constraint check (should be ≈0)")
    ax2.grid(True, axis="y", alpha=0.25)

    fig.tight_layout()
    return fig, axes


def run_partc2_demo(
    csv_path: str | None = None,
    *,
    n_paths: int = 20,
    seed: int = 42,
) -> dict[str, Any]:
    from partb import fit_t_garch_on_daily_recent

    from partc import build_part_c_split

    monthly_avg_early, daily_recent, _ = build_part_c_split(csv_path)
    daily_full = load_spx_daily(csv_path)
    garch = fit_t_garch_on_daily_recent(daily_recent)
    return partc2_monte_carlo(
        monthly_avg_early,
        daily_full,
        garch,
        n_paths=n_paths,
        seed=seed,
        innovations="parametric",
    )
    out = run_partc2_demo(n_paths=5, seed=0)
    print(out["drawdown_percentiles"].to_string())
    print("full drawdowns:", out["drawdowns_full"])
