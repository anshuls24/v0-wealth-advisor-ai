"""
PARTB_2: simulate daily log returns from a fitted t-GARCH, bridge to observed
month-end levels, rebuild prices, and summarize drawdowns (Monte Carlo).

Uses the same **scaled** estimation convention as :class:`partb.TGarchFitResult`
(``scale`` e.g. 100); simulated ``data`` / volatility from ``arch`` are in
scaled units and are converted to **log-return** units by dividing by ``scale``.

**Innovations**

- ``parametric`` (default): iid standardized Student‑t with df ``nu`` from the
  fit (matches ``arch``'s standardized t: ``standard_t(nu) / sqrt(nu/(nu-2))``).
  Implemented in NumPy for reproducible ``Generator`` streams when ``p=q=1``.
- ``bootstrap``: resample in-sample ``TGarchFitResult.standardized_residuals``
  with replacement through the same GARCH(1,1) recursion (**only** for
  ``p=q=1``); otherwise raises ``ValueError`` (use parametric or extend code).

**Early sample (case study): month-end data only**

For the first 40 years, only **end-of-month** levels exist in ``monthly_early``.
Simulations therefore **anchor each calendar month** at two observed month-ends
only: the level at the **last trading day of the previous calendar month**
(``close_start`` / ``date_start``) and the **last trading day of the current
month** (``close_end`` / ``date_end``). Bridged GARCH daily returns fill the
interior; drawdowns, pooled returns, and percentiles are computed **after** this
construction. **Every path shares the previous month-end** (same date and
``close_start``); the **first trading EOD of the target month** is simulated and
may differ across Monte Carlo draws. Optional ``use_first_trading_day_close_anchor=True`` pins that first day to ``daily_full`` (off by default so we do not pretend that
day was observed in the low-frequency panel). For plots, use
:func:`month_paths_plot_data` or :func:`plot_partb2_month_mc_paths` so the anchor
is visible (do not plot only ``prices_paths[:, 1:]`` vs ``dates``).

See ``part b solution.txt`` lines 32–41.
"""

from __future__ import annotations

from typing import Any, Literal

import numpy as np
import pandas as pd

from partb import (
    TGarchFitResult,
    build_part_b_split,
    load_monthly_early_csv,
    load_spx_daily,
)

InnovationKind = Literal["parametric", "bootstrap"]




### each row tells the simulator the observed start 
# and end levels for a calendar month span and how many trading 
# days fall in that span.

def partb2_month_table(
    monthly_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    *,
    price_col: str = "Close",
    date_col: str = "Date",
) -> pd.DataFrame:
    """
    One row per **month interval** between consecutive month-end rows.

    For interval from month-end ``i`` to ``i+1``: trading days satisfy
    ``date_start < Date <= date_end``; ``R_month_log = log(close_end/close_start)``.

    Consecutive rows satisfy ``close_start[k] == close_end[k-1]`` (same as
    ``me[i+1].Close``): each month **starts** at the previous month-end close and
    **ends** at the current month-end close, except the very first ``close_start``
    which anchors the sample (no prior month-end in ``monthly_early``).

    **Month-beginning (first trading day)** columns come from ``daily_full``: the
    first row inside the interval is the first trading day of the target calendar
    month; its observed ``Close`` is ``close_first_trading`` (used **only** when
    :func:`simulate_partb2_path` runs with ``use_first_trading_day_close_anchor=True``;
    default is **False** for the monthly-only early-sample convention).
    """
    if monthly_early.empty:
        return pd.DataFrame()
    me = monthly_early.sort_values(date_col).reset_index(drop=True)
    rows: list[dict[str, Any]] = []
    for i in range(len(me) - 1):
        d0 = me.loc[i, date_col]
        d1 = me.loc[i + 1, date_col]
        c0 = float(me.loc[i, price_col])
        c1 = float(me.loc[i + 1, price_col])
        if i > 0 and rows:
            prev_c1 = float(rows[-1]["close_end"])
            if not np.isclose(c0, prev_c1, rtol=1e-9, atol=1e-6 * max(abs(c0), 1.0)):
                raise ValueError(
                    f"month_table chain broken at i={i}: close_start {c0} vs "
                    f"previous close_end {prev_c1}"
                )
        r_m = float(np.log(c1 / c0))
        mask = (daily_full[date_col] > d0) & (daily_full[date_col] <= d1)
        n_days = int(mask.sum())
        cal_slice = daily_full.loc[mask].sort_values(date_col).reset_index(drop=True)
        if n_days == 0:
            d_first = pd.NaT
            c_first = float("nan")
        else:
            d_first = cal_slice.iloc[0][date_col]
            c_first = float(cal_slice.iloc[0][price_col])
        rows.append(
            {
                "date_start": d0,
                "date_end": d1,
                "close_start": c0,
                "close_end": c1,
                "R_month_log": r_m,
                "n_days": n_days,
                "date_first_trading": d_first,
                "close_first_trading": c_first,
            }
        )
    return pd.DataFrame(rows)


def _normalize_year_month_token(s: str) -> str:
    p = str(s).strip()
    if "-" not in p:
        return p
    y, m = p.split("-", 1)
    return f"{int(y)}-{int(m):02d}"



### a single dictionary of bridge targets for one chosen calendar month 
# (the “target” month), using the same convention as partb2_month_table, but 
# looked up by (target_year, target_month) instead of looping over the whole history.

def bridge_interval_from_monthly_early(
    monthly_early: pd.DataFrame,
    target_year: int,
    target_month: int,
    *,
    date_col: str = "Date",
    price_col: str = "Close",
    year_month_col: str = "year_month",
    daily_full: pd.DataFrame | None = None,
) -> dict[str, Any]:
    """
    Bridge targets for simulating **one calendar month** (the *target* month).

    Uses consecutive ``monthly_early`` rows keyed by ``year_month`` (same as
    ``monthly_early.csv``):

    - **End** month row: ``target_year`` / ``target_month`` (e.g. ``1996-03`` →
      last trading day in March, ``Close`` = month-end level to hit).
    - **Start** month row: the **previous** row in date order (e.g. ``1996-02`` →
      ``Close`` = anchor ``close_start``).

    Example (``monthly_early.csv``): March 1996 uses row **239** ``1996-02-29``
    ``Close=640.43`` as start and row **240** ``1996-03-29`` ``Close=645.5`` as
    end.

    Returns the same ``date_start`` / ``close_start`` / ``date_end`` /
    ``close_end`` / ``R_month_log`` as the matching row of :func:`partb2_month_table`
    when ``daily_full`` is passed (cross-checked); ``month_table_row_index`` is
    the row index in that table (``me`` start index for the interval).
    """
    if monthly_early.empty:
        raise ValueError("monthly_early is empty")
    if year_month_col not in monthly_early.columns:
        raise ValueError(
            f"monthly_early must have column {year_month_col!r} (e.g. from build_part_b_split or load_monthly_early_csv)"
        )
    ym_end = f"{int(target_year)}-{int(target_month):02d}"
    me = monthly_early.sort_values(date_col).reset_index(drop=True)
    yms = me[year_month_col].astype(str).map(_normalize_year_month_token)
    hit = np.flatnonzero((yms == ym_end).to_numpy())
    if hit.size == 0:
        avail = sorted(yms.unique().tolist())[:8]
        raise ValueError(
            f"no monthly_early row with {year_month_col}={ym_end!r}; "
            f"sample of available: {avail!r}"
        )
    if hit.size > 1:
        raise ValueError(f"ambiguous: multiple rows for target {ym_end!r}")
    i_end = int(hit[0])
    if i_end < 1:
        raise ValueError(
            f"target {ym_end!r} is the first month-end in monthly_early; "
            "there is no previous month-end for close_start"
        )
    i_start = i_end - 1
    row_prev = me.iloc[i_start]
    row_cur = me.iloc[i_end]
    d0 = row_prev[date_col]
    d1 = row_cur[date_col]
    c0 = float(row_prev[price_col])
    c1 = float(row_cur[price_col])
    r_m = float(np.log(c1 / c0))
    ym_start = _normalize_year_month_token(str(row_prev[year_month_col]))
    out: dict[str, Any] = {
        "target_year_month": ym_end,
        "previous_year_month": ym_start,
        "date_start": d0,
        "date_end": d1,
        "close_start": c0,
        "close_end": c1,
        "R_month_log": r_m,
        "monthly_early_iloc_start": i_start,
        "monthly_early_iloc_end": i_end,
        "month_table_row_index": i_start,
    }
    if daily_full is not None:
        mt = partb2_month_table(me, daily_full, date_col=date_col, price_col=price_col)
        if mt.empty or i_start >= len(mt):
            raise RuntimeError("month_table shorter than expected for cross-check")
        mr = mt.iloc[i_start]
        if not np.isclose(float(mr["close_start"]), c0, rtol=1e-9, atol=1e-6):
            raise RuntimeError(
                f"month_table vs bridge_interval close_start mismatch: {mr['close_start']} vs {c0}"
            )
        if not np.isclose(float(mr["close_end"]), c1, rtol=1e-9, atol=1e-6):
            raise RuntimeError(
                f"month_table vs bridge_interval close_end mismatch: {mr['close_end']} vs {c1}"
            )
        if pd.Timestamp(mr["date_start"]) != pd.Timestamp(
            d0
        ) or pd.Timestamp(mr["date_end"]) != pd.Timestamp(d1):
            raise RuntimeError("month_table vs bridge_interval date mismatch")
        out["date_first_trading"] = mr["date_first_trading"]
        out["close_first_trading"] = float(mr["close_first_trading"])
    return out



### draws standardized innovations from the GARCH model
# for the simulator to use.
def _draw_standardized_innovations(
    garch: TGarchFitResult,
    n_total: int,
    rng: np.random.Generator,
    innovations: InnovationKind,
) -> np.ndarray:
    ## parametric case: draw from the fitted t distribution
    if innovations == "parametric":
        nu = float(garch.params["nu"])
        std_dev = np.sqrt(nu / (nu - 2.0)) # standard deviation of the t distribution
        return rng.standard_t(nu, size=n_total) / std_dev
    pool = garch.standardized_residuals.dropna().to_numpy(dtype=float)
    
    ## bootstrap case: resample with replacement from the in-sample standardized residuals
    if pool.size == 0:
        raise ValueError("no standardized residuals for bootstrap")
    return rng.choice(pool, size=n_total, replace=True)




# simulates a single segment of log returns and conditional volatility using z innovations 
# from the GARCH model
# using the GARCH(1,1) model.

def _simulate_garch11_const_mean_scaled(
    params: dict[str, float],
    nobs: int,
    burn: int,
    errors: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """
    GARCH(1,1) with constant mean; ``errors`` are standardized innovations.
    Returns simulated **scaled** ``y`` and conditional volatility ``sigma``
    (sqrt variance), each length ``nobs`` after burn.
    """
    mu = float(params["mu"])
    omega = float(params["omega"])
    alpha = float(params["alpha[1]"])
    beta = float(params["beta[1]"])
    n = nobs + burn
    if errors.shape[0] != n:
        raise ValueError("errors length must equal nobs + burn")
    persistence = alpha + beta
    if persistence >= 1.0:
        initial_value = omega
    else:
        initial_value = omega / (1.0 - persistence)

    sigma2 = np.zeros(n)
    eps_path = np.zeros(n)
    max_lag = 1
    sigma2[:max_lag] = initial_value
    eps_path[:max_lag] = np.sqrt(np.maximum(sigma2[:max_lag], 0.0)) * errors[:max_lag]
    for t in range(max_lag, n):
        h = omega + alpha * eps_path[t - 1] ** 2 + beta * sigma2[t - 1]
        sigma2[t] = h
        eps_path[t] = errors[t] * np.sqrt(max(h, 0.0))
    y_scaled = mu + eps_path
    vol_scaled = np.sqrt(np.maximum(sigma2, 0.0))
    return y_scaled[burn:].copy(), vol_scaled[burn:].copy()



### simulates a single segment of log returns and conditional volatility
def simulate_tgarch_segment_log_units(
    garch: TGarchFitResult,
    nobs: int,
    rng: np.random.Generator,
    *,
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    initial_value_vol: float | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Simulate ``nobs`` days of **log returns** and conditional vol (log units).

    For GARCH(1,1), uses NumPy + ``rng`` (reproducible). For other orders,
    delegates to ``arch`` (``initial_value_vol`` passed through); stochastic
    stream is **not** controlled by ``rng``.
    """
    scale = float(garch.scale) 
    if garch.p == 1 and garch.q == 1:
        if initial_value_vol is not None:
            raise NotImplementedError(
                "initial_value_vol for manual GARCH(1,1) sim not implemented; "
                "omit or use arch-backed simulation."
            )
        total = nobs + burn
        z = _draw_standardized_innovations(garch, total, rng, innovations)
        y_s, v_s = _simulate_garch11_const_mean_scaled(garch.params, nobs, burn, z)
        return y_s / scale, v_s / scale

    if innovations != "parametric":
        raise ValueError(
            "bootstrap innovations require GARCH(1,1); "
            "refit with p=q=1 or use innovations='parametric'."
        )
    sim = garch.fit.model.simulate(
        np.asarray(garch.fit.params, dtype=float),
        nobs=nobs,
        burn=burn,
        initial_value_vol=initial_value_vol,
    )
    y_s = sim["data"].to_numpy(dtype=float, copy=True)
    v_s = sim["volatility"].to_numpy(dtype=float, copy=True)

# the model was estimated on scaled data, simulation without rescaling would 
# output numbers that are scale times too large for log-return space. 
# Dividing undoes the × scale used only for numerical stability in arch, so 
# the rest of Part (b) (bridge weights, cumulating to prices, drawdowns) 
# stays in real log-return units.

    return y_s / scale, v_s / scale


#### bridges the gap between the simulated log returns and 
# the observed month-end log return
# CORRECTS FOR THE GAP BETWEEN THE SIMULATED LOG RETURNS AND 
# THE OBSERVED MONTH-END LOG RETURN
def bridge_month_returns(
    R_month_log: float,
    r_tilde: np.ndarray,
    sigma_tilde: np.ndarray,
    *,
    assert_tol: float = 1e-5,
) -> tuple[np.ndarray, np.ndarray]:
    """
    PARTB_2 correction: gap on log returns, weights proportional to ``sigma_tilde``.
    Returns ``r_star`` (log) and ``prices`` length ``len(r_tilde)+1`` with
    ``prices[0]`` caller-provided separately.
    """
    r_tilde = np.asarray(r_tilde, dtype=float)
    sigma_tilde = np.asarray(sigma_tilde, dtype=float)
    if r_tilde.shape != sigma_tilde.shape:
        raise ValueError("r_tilde and sigma_tilde must match shape")
    r_sum = float(r_tilde.sum())
    delta = R_month_log - r_sum
    ssum = float(sigma_tilde.sum())
    if ssum <= 0.0 or not np.isfinite(ssum):
        w = np.full_like(r_tilde, 1.0 / len(r_tilde))
    else:
        w = sigma_tilde / ssum
    r_star = r_tilde + w * delta
    if not np.isclose(r_star.sum(), R_month_log, atol=assert_tol, rtol=0.0):
        raise RuntimeError(
            f"bridge invariant failed: sum(r*)={r_star.sum()} vs R={R_month_log}"
        )
    return r_star, w


def prices_from_log_returns(start_level: float, r_star: np.ndarray) -> np.ndarray:
    """Levels ``P_j = P_{j-1} * exp(r_star_j)``, length ``len(r_star)+1``."""
    p = np.empty(len(r_star) + 1, dtype=float)
    p[0] = float(start_level)
    for j in range(len(r_star)):
        p[j + 1] = p[j] * np.exp(r_star[j])
    return p


def max_drawdown_from_prices(prices: np.ndarray) -> float:
    """Peak-to-trough return: min_t (P_t / running_max - 1)."""
    px = np.asarray(prices, dtype=float)
    if px.size < 2:
        return float("nan")
    peak = np.maximum.accumulate(px)
    dd = px / peak - 1.0
    return float(np.min(dd))


def worst_rolling_max_drawdown(prices: np.ndarray, window: int) -> float:
    """
    Worst (most negative) full-sample max drawdown inside any contiguous
    window of ``window`` **trading days** (window prices, so window+1 points).
    """
    px = np.asarray(prices, dtype=float)
    if window < 2 or px.size < window:
        return float("nan")
    worst = 0.0
    for start in range(0, px.size - window):
        sub = px[start : start + window + 1]
        worst = min(worst, max_drawdown_from_prices(sub))
    return float(worst)


###################  ALL IMPORTANT FUNCTIONS ARE DEFINED ABOVE ###################

### simulates a single Monte Carlo path
### CHAINED MONTH-TO-MONTH AT OBSERVED MONTH-ENDS COMBINES ALL THE ABOVE FUNCTIONS

def simulate_partb2_path(
    month_table: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    rng: np.random.Generator,
    *,
    date_col: str = "Date",
    price_col: str = "Close",
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    price_tol: float = 1e-4,
    use_first_trading_day_close_anchor: bool = False,
) -> dict[str, Any]:
    """
    One Monte Carlo path: bridged daily log returns and reconstructed prices
    on observed trading calendars per month.

    **Month boundaries (default; matches monthly-only early sample)**

    - The **first** interval uses ``close_start`` from the first month-end in
      ``monthly_early`` (no earlier month in that panel).
    - Every **later** month starts at the **previous month-end close**:
      ``close_start`` equals the prior row's ``close_end``, and we require the
      simulated terminal level of the previous month to match that anchor before
      advancing (so the path is chained month-to-month at observed month-ends).
    - Each month **ends** at ``close_end`` (that month’s last trading day) via the
      log bridge over ``n_days`` GARCH draws. No intra-month level from
      ``daily_full`` is imposed unless you opt in below.

    **Optional: first trading day pin**

    If ``use_first_trading_day_close_anchor`` is True, the first daily log return
    is **fixed** so the level after the first trading day matches ``daily_full``
    ``Close`` (``close_first_trading``); remaining days bridge to ``close_end``.
    Default **False**: only the two month-end closes anchor the segment.
    """
    r_all: list[float] = []
    dates_out: list[pd.Timestamp] = []
    prev_terminal: float | None = None

    for mi, (_, row) in enumerate(month_table.iterrows()):
        d0 = row["date_start"]
        d1 = row["date_end"]
        c0 = float(row["close_start"])
        c1 = float(row["close_end"])
        r_m = float(row["R_month_log"])
        n = int(row["n_days"])
        if mi == 0:
            anchor_start = c0
        else:
            assert prev_terminal is not None
            if not np.isclose(
                prev_terminal,
                c0,
                rtol=price_tol,
                atol=price_tol * max(abs(c0), 1.0),
            ):
                raise RuntimeError(
                    f"month {mi}: simulated end of previous month {prev_terminal} "
                    f"does not match this month's close_start {c0} (prev month-end close)"
                )
            # Use table ``close_start`` as the numerical anchor so
            # ``sum(r*) = R_month_log = log(c1/c0)`` lands exactly on ``c1``.
            anchor_start = c0

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
        if use_first_trading_day_close_anchor:
            p1 = float(row["close_first_trading"])
            if n == 0:
                raise ValueError("n_days=0 with first-day anchor")
            if n == 1:
                r_star = np.array([float(np.log(c1 / c0))], dtype=float)
                if not np.isclose(p1, c1, rtol=price_tol, atol=price_tol * max(abs(c1), 1.0)):
                    raise RuntimeError(
                        f"single-day month: close_first_trading {p1} vs close_end {c1}"
                    )
            else:
                if not np.isfinite(p1) or p1 <= 0.0 or c0 <= 0.0 or c1 <= 0.0:
                    raise ValueError(
                        f"invalid prices for first-day anchor: c0={c0} p1={p1} c1={c1}"
                    )
                r_first = float(np.log(p1 / c0))
                r_rem_target = float(np.log(c1 / p1))
                r_tilde, sig_tilde = simulate_tgarch_segment_log_units(
                    garch, n - 1, rng, burn=burn, innovations=innovations
                )
                r_rem, _w = bridge_month_returns(r_rem_target, r_tilde, sig_tilde)
                r_star = np.concatenate([np.array([r_first], dtype=float), r_rem])
            prices_m = prices_from_log_returns(anchor_start, r_star)
            if not np.isclose(
                prices_m[1], p1, rtol=price_tol, atol=price_tol * max(abs(p1), 1.0)
            ):
                raise RuntimeError(
                    f"first-day anchor: price after day1 {prices_m[1]} vs daily {p1}"
                )
        else:
            r_tilde, sig_tilde = simulate_tgarch_segment_log_units(
                garch, n, rng, burn=burn, innovations=innovations
            )
            r_star, _w = bridge_month_returns(r_m, r_tilde, sig_tilde)
            prices_m = prices_from_log_returns(anchor_start, r_star)
        if not np.isclose(prices_m[-1], c1, rtol=price_tol, atol=price_tol * c1):
            raise RuntimeError(
                f"price bridge end {prices_m[-1]} vs target close {c1} for month ending {d1}"
            )
        prev_terminal = float(prices_m[-1])
        r_all.extend(r_star.tolist())
        dates_out.extend(cal[date_col].tolist())

    r_arr = np.asarray(r_all, dtype=float)
    p0 = float(month_table.iloc[0]["close_start"])
    prices_arr = prices_from_log_returns(p0, r_arr)

    # Each segment starts at ``close_start`` and ends at ``close_end`` on the cumulative path
    idx = 0
    for _, row in month_table.iterrows():
        n = int(row["n_days"])
        c0r = float(row["close_start"])
        c1 = float(row["close_end"])
        if not np.isclose(
            prices_arr[idx], c0r, rtol=price_tol, atol=price_tol * max(abs(c0r), 1.0)
        ):
            raise RuntimeError(
                f"cumulative price at month start (index {idx}) {prices_arr[idx]} "
                f"vs close_start {c0r}"
            )
        if not np.isclose(prices_arr[idx + n], c1, rtol=price_tol, atol=price_tol * c1):
            raise RuntimeError(
                f"cumulative price at month end {prices_arr[idx+n]} vs {c1}"
            )
        idx += n

    return {
        "dates": pd.DatetimeIndex(dates_out),
        "r_star_log": r_arr,
        "prices": prices_arr,
        "max_drawdown_full": max_drawdown_from_prices(prices_arr),
    }


def partb2_path_drawdown_horizons(
    prices: np.ndarray,
    horizon_windows: dict[str, int],
) -> dict[str, float]:
    out: dict[str, float] = {"full": max_drawdown_from_prices(prices)}
    for name, w in horizon_windows.items():
        out[name] = worst_rolling_max_drawdown(prices, w)
    return out


def partb2_monte_carlo(
    monthly_early: pd.DataFrame,
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
    use_first_trading_day_close_anchor: bool = False,
) -> dict[str, Any]:
    """
    Repeat bridged simulation ``n_paths`` times; return drawdown samples and
    percentiles by horizon.

    ``horizon_windows`` maps labels to trading-day window lengths (defaults
    ~1m/3m/6m).
    """
    if horizon_windows is None:
        horizon_windows = {"1m": 21, "3m": 63, "6m": 126}

    month_table = partb2_month_table(
        monthly_early, daily_full, date_col=date_col, price_col=price_col
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
        path = simulate_partb2_path(
            month_table,
            daily_full,
            garch,
            rng,
            date_col=date_col,
            price_col=price_col,
            burn=burn,
            innovations=innovations,
            use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
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


def partb2_pool_rolling_simple_returns(
    monthly_early: pd.DataFrame,
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
    use_first_trading_day_close_anchor: bool = False,
) -> dict[int, np.ndarray]:
    """
    Simulate ``n_paths`` bridged price paths; for each trading window ``w`` in
    ``windows``, concatenate overlapping **simple** buy-and-hold returns
    ``P_t/P_{t-w}-1`` across paths (pooled sample for histograms / tail stats).

    Same simple returns as ``expm1(sum of w daily log returns)`` on each path.
    """
    month_table = partb2_month_table(
        monthly_early, daily_full, date_col=date_col, price_col=price_col
    )
    if month_table.empty:
        raise ValueError("month_table is empty")
    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(n_paths)
    accum: dict[int, list[np.ndarray]] = {w: [] for w in windows}

    for p in range(n_paths):
        rng = np.random.default_rng(streams[p])
        path = simulate_partb2_path(
            month_table,
            daily_full,
            garch,
            rng,
            date_col=date_col,
            price_col=price_col,
            burn=burn,
            innovations=innovations,
            use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
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


def partb2_pool_calendar_month_simple_returns(
    monthly_early: pd.DataFrame,
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
    use_first_trading_day_close_anchor: bool = False,
) -> dict[int, np.ndarray]:
    """
    For each simulated bridged path, run the same **calendar-month** rolling
    buy-hold as :func:`spx_rolling_buyhold.rolling_calendar_month_returns`, then
    concatenate returns across paths (pooled sample for histograms / tails).

    Path ``Close`` on each trading day is ``prices[1:]`` aligned to ``dates``
    from :func:`simulate_partb2_path` (end-of-day level after that date's log
    return).
    """
    from spx_rolling_buyhold import rolling_calendar_month_returns

    month_table = partb2_month_table(
        monthly_early, daily_full, date_col=date_col, price_col=price_col
    )
    if month_table.empty:
        raise ValueError("month_table is empty")
    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(n_paths)
    accum: dict[int, list[np.ndarray]] = {h: [] for h in horizons_months}

    for path_idx in range(n_paths):
        rng = np.random.default_rng(streams[path_idx])
        path = simulate_partb2_path(
            month_table,
            daily_full,
            garch,
            rng,
            date_col=date_col,
            price_col=price_col,
            burn=burn,
            innovations=innovations,
            use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
        )
        dates = path["dates"]
        prices = path["prices"]
        if len(prices) != len(dates) + 1:
            raise ValueError(
                f"expected len(prices) == len(dates) + 1; got {len(prices)} vs {len(dates)}"
            )
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


def _partb2_iter_simulated_paths(
    monthly_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    n_paths: int,
    seed: int | None,
    burn: int,
    innovations: InnovationKind,
    date_col: str,
    price_col: str,
    use_first_trading_day_close_anchor: bool = False,
):
    """Yield ``(path_index, path_dict)`` in lockstep with pooled calendar-month routines."""
    month_table = partb2_month_table(
        monthly_early, daily_full, date_col=date_col, price_col=price_col
    )
    if month_table.empty:
        raise ValueError("month_table is empty")
    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(int(n_paths))
    for path_idx in range(int(n_paths)):
        rng = np.random.default_rng(streams[path_idx])
        path = simulate_partb2_path(
            month_table,
            daily_full,
            garch,
            rng,
            date_col=date_col,
            price_col=price_col,
            burn=burn,
            innovations=innovations,
            use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
        )
        yield path_idx, path


def simulate_partb2_path_at_pool_index(
    monthly_early: pd.DataFrame,
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
    use_first_trading_day_close_anchor: bool = False,
) -> dict[str, Any]:
    """
    Reconstruct the ``path_index``-th path from :func:`partb2_pool_calendar_month_simple_returns`
    (same ``seed``, ``n_paths``, GARCH settings).
    """
    if int(path_index) < 0 or int(path_index) >= int(n_paths):
        raise ValueError(f"path_index must be in [0, {n_paths})")
    month_table = partb2_month_table(
        monthly_early, daily_full, date_col=date_col, price_col=price_col
    )
    if month_table.empty:
        raise ValueError("month_table is empty")
    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(int(n_paths))
    rng = np.random.default_rng(streams[int(path_index)])
    return simulate_partb2_path(
        month_table,
        daily_full,
        garch,
        rng,
        date_col=date_col,
        price_col=price_col,
        burn=burn,
        innovations=innovations,
        use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
    )


def partb_close_series_for_calendar_window(
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


def partb2_pool_calendar_month_returns_detailed(
    monthly_early: pd.DataFrame,
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
    use_first_trading_day_close_anchor: bool = False,
) -> dict[int, pd.DataFrame]:
    """
    Same simulation as :func:`partb2_pool_calendar_month_simple_returns`, but keep each
    rolling window’s ``start_date`` / ``end_date`` / prices / ``path_id``.
    """
    from spx_rolling_buyhold import rolling_calendar_month_returns

    accum: dict[int, list[pd.DataFrame]] = {h: [] for h in horizons_months}

    for path_idx, path in _partb2_iter_simulated_paths(
        monthly_early,
        daily_full,
        garch,
        n_paths=n_paths,
        seed=seed,
        burn=burn,
        innovations=innovations,
        date_col=date_col,
        price_col=price_col,
        use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
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


def list_allowed_bridge_months(
    monthly_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    *,
    date_col: str = "Date",
    price_col: str = "Close",
) -> list[tuple[int, int]]:
    """
    Calendar ``(year, month)`` values for which a **single** bridged month segment
    exists: each is the month of ``date_end`` in :func:`partb2_month_table`
    (last trading day of that month in ``monthly_early``). The first month-end
    in ``monthly_early`` is never an interval **end** (no prior month-end start),
    so it is excluded.
    """
    mt = partb2_month_table(
        monthly_early, daily_full, date_col=date_col, price_col=price_col
    )
    if mt.empty:
        return []
    de = pd.to_datetime(mt["date_end"])
    pairs = sorted({(int(y), int(m)) for y, m in zip(de.dt.year, de.dt.month)})
    return pairs


def simulate_partb2_month_paths(
    monthly_early: pd.DataFrame,
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
    price_tol: float = 1e-4,
    use_first_trading_day_close_anchor: bool = False,
) -> dict[str, Any]:
    """
    Monte Carlo **one-month** bridged paths for the interval in ``monthly_early``
    identified by **target** calendar ``year``/``month`` (the month you simulate
    *into*), using the same rule as ``monthly_early.csv`` / ``year_month``:

    - ``close_start`` / ``date_start`` come from the **previous** month-end row
      (e.g. ``1996-02`` → ``1996-02-29``, ``Close=640.43``).
    - ``close_end`` / ``date_end`` come from the **target** month-end row
      (e.g. ``1996-03`` → ``1996-03-29``, ``Close=645.5``).

    With ``use_first_trading_day_close_anchor=True``, the first trading day’s
    simulated **Close** matches ``daily_full`` (same as :func:`simulate_partb2_path`).
    Default **False**: only month-end ``close_start`` / ``close_end`` anchor the month.

    See :func:`bridge_interval_from_monthly_early` for the authoritative mapping.

    Returned ``prices_paths[p, 0]`` is **identical** for all paths ``p`` (equals
    ``close_start``). With first-day anchoring, ``prices_paths[p, 1]`` matches the
    observed first-day ``Close`` for all paths; otherwise day-1 EOD varies by draw.
    Use :func:`plot_partb2_month_mc_paths` (or :func:`month_paths_plot_data`) so the
    shared previous month-end anchor appears on figures.

    Raises
    ------
    ValueError
        If ``(year, month)`` is not in :func:`list_allowed_bridge_months`.
    """
    allowed = list_allowed_bridge_months(
        monthly_early, daily_full, date_col=date_col, price_col=price_col
    )
    if (year, month) not in allowed:
        raise ValueError(
            f"(year={year}, month={month}) is not an interval end in monthly_early; "
            f"allowed (year, month) count={len(allowed)} "
            f"(first few: {allowed[:5]!r} … last: {allowed[-3:]!r})"
        )

    bi = bridge_interval_from_monthly_early(
        monthly_early,
        year,
        month,
        date_col=date_col,
        price_col=price_col,
        daily_full=daily_full,
    )
    d0 = bi["date_start"]
    d1 = bi["date_end"]
    c0 = float(bi["close_start"])
    c1 = float(bi["close_end"])
    r_m = float(bi["R_month_log"])

    cal = (
        daily_full.loc[
            (daily_full[date_col] > d0) & (daily_full[date_col] <= d1)
        ]
        .sort_values(date_col)
        .reset_index(drop=True)
    )
    n = len(cal)
    mt = partb2_month_table(monthly_early, daily_full, date_col=date_col, price_col=price_col)
    mrow = mt.iloc[bi["month_table_row_index"]]
    n_tbl = int(mrow["n_days"])
    if n != n_tbl:
        raise ValueError(
            f"trading day count mismatch: calendar {n} vs month_table n_days={n_tbl}"
        )
    p1 = float(mrow["close_first_trading"])
    d_first = mrow["date_first_trading"]

    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(int(n_paths))
    prices_paths = np.empty((n_paths, n + 1), dtype=float)
    r_paths = np.empty((n_paths, n), dtype=float)
    end_err = np.empty(n_paths, dtype=float)

    for p in range(n_paths):
        rng = np.random.default_rng(streams[p])
        if use_first_trading_day_close_anchor:
            if n == 0:
                raise ValueError("n_days=0")
            if n == 1:
                r_star = np.array([float(np.log(c1 / c0))], dtype=float)
                if not np.isclose(p1, c1, rtol=price_tol, atol=price_tol * max(abs(c1), 1.0)):
                    raise RuntimeError(
                        f"single-day month: close_first_trading {p1} vs close_end {c1}"
                    )
            else:
                if not np.isfinite(p1) or p1 <= 0.0 or c0 <= 0.0 or c1 <= 0.0:
                    raise ValueError(
                        f"invalid prices for first-day anchor: c0={c0} p1={p1} c1={c1}"
                    )
                r_first = float(np.log(p1 / c0))
                r_rem_target = float(np.log(c1 / p1))
                r_tilde, sig_tilde = simulate_tgarch_segment_log_units(
                    garch, n - 1, rng, burn=burn, innovations=innovations
                )
                r_rem, _w = bridge_month_returns(r_rem_target, r_tilde, sig_tilde)
                r_star = np.concatenate([np.array([r_first], dtype=float), r_rem])
            prices_m = prices_from_log_returns(c0, r_star)
            if not np.isclose(
                prices_m[1], p1, rtol=price_tol, atol=price_tol * max(abs(p1), 1.0)
            ):
                raise RuntimeError(
                    f"path {p}: first-day price {prices_m[1]} vs daily {p1}"
                )
        else:
            r_tilde, sig_tilde = simulate_tgarch_segment_log_units(
                garch, n, rng, burn=burn, innovations=innovations
            )
            r_star, _w = bridge_month_returns(r_m, r_tilde, sig_tilde)
            prices_m = prices_from_log_returns(c0, r_star)
        if not np.isclose(prices_m[-1], c1, rtol=price_tol, atol=price_tol * c1):
            raise RuntimeError(
                f"path {p}: bridge end {prices_m[-1]} vs target {c1} "
                f"for month ending {d1}"
            )
        prices_paths[p, :] = prices_m
        r_paths[p, :] = r_star
        end_err[p] = abs(prices_m[-1] - c1)

    dates = pd.DatetimeIndex(cal[date_col].to_numpy())

    return {
        "year": int(year),
        "month": int(month),
        "target_year_month": bi["target_year_month"],
        "previous_year_month": bi["previous_year_month"],
        "monthly_early_iloc_start": bi["monthly_early_iloc_start"],
        "monthly_early_iloc_end": bi["monthly_early_iloc_end"],
        "month_table_row_index": bi["month_table_row_index"],
        "date_start": d0,
        "date_end": d1,
        "date_first_trading": d_first,
        "close_first_trading": p1,
        "use_first_trading_day_close_anchor": use_first_trading_day_close_anchor,
        "close_start": c0,
        "close_end": c1,
        "R_month_log": r_m,
        "n_trading_days": n,
        "dates": dates,
        "prices_paths": prices_paths,
        "r_star_log_paths": r_paths,
        "max_abs_end_error": float(np.max(end_err)),
        "allowed_year_months": allowed,
        "innovations": innovations,
    }


def month_paths_plot_data(month_mc: dict[str, Any]) -> dict[str, Any]:
    """
    Matplotlib-ready coordinates for :func:`simulate_partb2_month_paths` output.

    **Contract** (default ``use_first_trading_day_close_anchor=False``): all paths
    share ``(date_start, close_start)``; column ``prices_paths[:, 0]`` equals
    ``close_start``; ``prices_paths[:, 1]`` is the first **trading** EOD of the
    target month and may vary by path; the last column hits ``close_end``.

    Plotting ``dates`` against ``prices_paths[:, 1:]`` alone hides the common
    anchor and makes the left edge look path-random.
    """
    dates = pd.to_datetime(month_mc["dates"])
    if len(dates) == 0:
        raise ValueError("month_mc has no trading dates")
    px = np.asarray(month_mc["prices_paths"], dtype=float)
    c0 = float(month_mc["close_start"])
    c1 = float(month_mc["close_end"])
    xs0 = pd.Timestamp(month_mc["date_start"])
    n_p = int(px.shape[0])
    horiz_x: list[pd.Timestamp] = [xs0, pd.Timestamp(dates[0])]
    horiz_y = [c0, c0]
    path_xys: list[tuple[list[pd.Timestamp], list[float]]] = []
    for p in range(n_p):
        d0 = pd.Timestamp(dates[0])
        xs_p: list[pd.Timestamp] = [d0, d0] + [pd.Timestamp(t) for t in dates[1:]]
        ys_p: list[float] = [c0, float(px[p, 1])] + [float(x) for x in px[p, 2:]]
        path_xys.append((xs_p, ys_p))
    return {
        "date_anchor": xs0,
        "close_anchor": c0,
        "close_end": c1,
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


def plot_partb2_month_mc_paths(
    month_mc: dict[str, Any],
    *,
    title_suffix: str | None = None,
    figsize: tuple[float, float] = (10, 5),
):
    """
    Plot Monte Carlo bridged paths with the **previous month-end** anchor drawn
    explicitly (same rule as :func:`simulate_partb2_month_paths`).
    """
    import matplotlib.pyplot as plt

    d = month_paths_plot_data(month_mc)
    n_p = d["n_paths"]
    fig, ax = plt.subplots(figsize=figsize)
    ax.plot(
        d["horizontal_x"],
        d["horizontal_y"],
        color="forestgreen",
        lw=2.2,
        zorder=4,
        label=f"prev month-end close_start = {d['close_anchor']:.2f}",
    )
    ax.scatter(
        [d["date_anchor"]],
        [d["close_anchor"]],
        color="navy",
        s=48,
        zorder=6,
        label="anchor (date_start)",
    )
    for xs, ys in d["path_xys"]:
        ax.plot(
            xs,
            ys,
            color="steelblue",
            alpha=max(0.08, min(0.5, 8.0 / n_p)),
            lw=0.9,
        )
    ax.axhline(
        d["close_end"],
        color="darkred",
        ls="--",
        lw=1.2,
        label=f"close_end = {d['close_end']:.2f}",
    )
    ym = d.get("target_year_month") or (
        f"{int(d['year'])}-{int(d['month']):02d}"
        if d.get("year") is not None and d.get("month") is not None
        else "?"
    )
    suff = f" — {title_suffix}" if title_suffix else ""
    ax.set_title(f"Bridged sim paths — {ym} (n_paths={n_p}){suff}")
    ax.set_xlabel("Date")
    ax.set_ylabel("Simulated Close")
    ax.set_xlim(left=d["xlim_left"], right=d["xlim_right"])
    ax.legend(loc="best", fontsize=8)
    fig.autofmt_xdate()
    plt.tight_layout()
    return fig, ax


def month_paths_to_long_df(result: dict[str, Any]) -> pd.DataFrame:
    """
    Long-format ``Date``, ``path_id``, ``Close_sim``.

    Includes one **anchor** row per path at ``date_start`` with
    ``Close_sim = close_start`` (previous month-end close from ``monthly_early``).

    If the path was built with ``use_first_trading_day_close_anchor=True``, the
    first **trading** row’s ``Close_sim`` matches ``daily_full`` for **all** paths.
    With the default **False** (month-end-only anchoring), the first trading row
    also varies by simulation draw.

    The last row’s date should match ``date_end`` with ``Close_sim ≈ close_end``.
    """
    dates: pd.DatetimeIndex = result["dates"]
    px: np.ndarray = result["prices_paths"]
    n_paths, _n1 = px.shape
    d0 = pd.Timestamp(result["date_start"])
    d1 = pd.Timestamp(result["date_end"])
    c0 = float(result["close_start"])
    c1 = float(result["close_end"])
    rows: list[dict[str, Any]] = []
    for p in range(n_paths):
        if not np.isclose(px[p, 0], c0, rtol=1e-9, atol=1e-6 * max(abs(c0), 1.0)):
            raise RuntimeError(
                f"path {p}: prices_paths[p,0]={px[p, 0]} vs close_start {c0}"
            )
        rows.append(
            {
                "Date": d0,
                "path_id": p,
                "Close_sim": c0,
                "row_kind": "month_start_anchor",
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
        if not np.isclose(px[p, -1], c1, rtol=1e-4, atol=1e-4 * max(abs(c1), 1.0)):
            raise RuntimeError(
                f"path {p}: terminal price {px[p, -1]} vs close_end {c1}"
            )
    out = pd.DataFrame(rows)
    return out.sort_values(["path_id", "Date", "row_kind"], kind="meresort").reset_index(
        drop=True
    )


def partb_slice_month_table_calendar_year_span(
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


def partb_feasible_calendar_year_starts(
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


def partb_pick_random_calendar_year_start(
    month_table: pd.DataFrame,
    rng: np.random.Generator,
    n_years: int = 3,
) -> int:
    opts = partb_feasible_calendar_year_starts(month_table, n_years=n_years)
    if not opts:
        raise ValueError(f"no {n_years}-year span fits month_table date_end range")
    return int(rng.choice(opts))


def validate_partb_path_month_end_closes(
    path: dict[str, Any],
    month_table_slice: pd.DataFrame,
    *,
    price_tol: float = 1e-4,
) -> pd.DataFrame:
    """
    For each month row in ``month_table_slice``, compare the simulated **month-end**
    Close (last trading day in the interval) to ``close_end`` from ``monthly_early``.
    """
    dates = pd.DatetimeIndex(path["dates"])
    prices = np.asarray(path["prices"], dtype=float)
    if prices.size != len(dates) + 1:
        raise ValueError(
            f"expected len(prices)==len(dates)+1; got {prices.size} vs {len(dates)}"
        )
    rows: list[dict[str, Any]] = []
    for _, row in month_table_slice.iterrows():
        d0 = pd.Timestamp(row["date_start"])
        d1 = pd.Timestamp(row["date_end"])
        target = float(row["close_end"])
        ym = d1.strftime("%Y-%m")
        mask = (dates > d0) & (dates <= d1)
        m_arr = np.asarray(mask, dtype=bool)
        n_hit = int(m_arr.sum())
        if n_hit == 0:
            raise ValueError(f"no simulated dates in ({d0}, {d1}] for {ym}")
        if n_hit != int(row["n_days"]):
            raise ValueError(
                f"{ym}: mask count {n_hit} vs month_table n_days {row['n_days']}"
            )
        idxs = np.flatnonzero(m_arr)
        last_k = int(idxs[-1])
        sim_close_end = float(prices[last_k + 1])
        err = sim_close_end - target
        tol = price_tol * max(abs(target), 1.0)
        rows.append(
            {
                "target_year_month": ym,
                "date_end": d1,
                "n_days": n_hit,
                "close_end_panel": target,
                "sim_close_end": sim_close_end,
                "error": err,
                "abs_error": abs(err),
                "ok": bool(np.isclose(sim_close_end, target, rtol=price_tol, atol=tol)),
            }
        )
    return pd.DataFrame(rows)


def simulate_partb2_year_span_batch(
    monthly_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    start_year: int | None = None,
    n_years: int = 3,
    n_paths: int = 24,
    seed: int | None = None,
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    date_col: str = "Date",
    price_col: str = "Close",
    randomize_start_year: bool = False,
    use_first_trading_day_close_anchor: bool = False,
) -> dict[str, Any]:
    """
    Simulate ``n_paths`` chained bridged paths over ``n_years`` consecutive calendar years
    (months from :func:`partb2_month_table`). Validates each path hits ``close_end`` every month.
    """
    month_full = partb2_month_table(
        monthly_early, daily_full, date_col=date_col, price_col=price_col
    )
    if month_full.empty:
        raise ValueError("month_table is empty")

    rng_pick = np.random.default_rng(seed)
    if start_year is None:
        if randomize_start_year:
            start_year = partb_pick_random_calendar_year_start(
                month_full, rng_pick, n_years=n_years
            )
        else:
            opts = partb_feasible_calendar_year_starts(month_full, n_years=n_years)
            if not opts:
                raise ValueError("no feasible start year")
            start_year = opts[0]

    month_slice = partb_slice_month_table_calendar_year_span(
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
        path = simulate_partb2_path(
            month_slice,
            daily_full,
            garch,
            rng,
            date_col=date_col,
            price_col=price_col,
            burn=burn,
            innovations=innovations,
            use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
        )
        paths.append(path)
        v = validate_partb_path_month_end_closes(path, month_slice)
        v.insert(0, "path_id", p)
        validations.append(v)

    val_long = pd.concat(validations, ignore_index=True)
    by_month = (
        val_long.groupby("target_year_month", sort=True)
        .agg(
            close_end_panel=("close_end_panel", "first"),
            sim_close_min=("sim_close_end", "min"),
            sim_close_max=("sim_close_end", "max"),
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
        "use_first_trading_day_close_anchor": use_first_trading_day_close_anchor,
    }


def plot_partb_year_span_validation(
    batch: dict[str, Any],
    *,
    max_paths_price: int = 10,
    figsize: tuple[float, float] = (11, 10),
    title_suffix: str | None = None,
):
    """
    Three panels: (1) simulated price paths vs ``close_end`` at ``date_end``; (2) ribbon of
    simulated month-end closes across paths vs panel; (3) max absolute month-end error per
    month across paths (should be ≈0).
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
    y_panel = mt["close_end"].to_numpy(dtype=float)
    ax0.step(
        dates_panel,
        y_panel,
        where="post",
        color="darkred",
        lw=2.0,
        label="monthly_early close_end (step)",
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
        f"Part (b) {ny}-year span from {y0} — prices vs panel month-end closes"
        + (f" — {title_suffix}" if title_suffix else "")
    )
    ax0.legend(loc="upper left", fontsize=8)
    ax0.grid(True, alpha=0.25)

    x_ord = np.arange(len(by_m))
    panel_line = by_m["close_end_panel"].to_numpy(dtype=float)
    sim_min = by_m["sim_close_min"].to_numpy(dtype=float)
    sim_max = by_m["sim_close_max"].to_numpy(dtype=float)
    ax1.fill_between(
        x_ord,
        sim_min,
        sim_max,
        color="steelblue",
        alpha=0.25,
        label="sim month-end Close (min–max over paths)",
    )
    ax1.plot(x_ord, panel_line, "k-", lw=2.0, label="panel close_end")
    ax1.set_xticks(x_ord)
    ax1.set_xticklabels(by_m["target_year_month"], rotation=90, fontsize=7)
    ax1.set_ylabel("Month-end Close")
    ax1.legend(loc="upper left", fontsize=8)
    ax1.grid(True, alpha=0.25)
    ax1.set_title("Per calendar month: simulated month-end range vs panel")

    err = by_m["abs_err_max"].to_numpy(dtype=float)
    ax2.bar(x_ord, err, color="teal", alpha=0.85)
    ax2.set_xticks(x_ord)
    ax2.set_xticklabels(by_m["target_year_month"], rotation=90, fontsize=7)
    ax2.set_ylabel("max |error| over paths")
    ax2.set_title("Month-end anchor check (should be ≈0)")
    ax2.grid(True, axis="y", alpha=0.25)

    fig.tight_layout()
    return fig, axes


def run_partb2_demo(
    csv_path: str | None = None,
    *,
    n_paths: int = 20,
    seed: int = 42,
) -> dict[str, Any]:
    """Convenience: load split, fit t-GARCH, run a small Monte Carlo."""
    from partb import fit_t_garch_on_daily_recent

    monthly_early, daily_recent, _ = build_part_b_split(csv_path)
    daily_full = load_spx_daily(csv_path)
    garch = fit_t_garch_on_daily_recent(daily_recent)
    return partb2_monte_carlo(
        monthly_early,
        daily_full,
        garch,
        n_paths=n_paths,
        seed=seed,
        innovations="parametric",
    )


if __name__ == "__main__":
    out = run_partb2_demo(n_paths=5, seed=0)
    print(out["drawdown_percentiles"].to_string())
    print("full drawdowns:", out["drawdowns_full"])
