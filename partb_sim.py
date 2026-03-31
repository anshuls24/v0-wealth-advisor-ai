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

See ``part b solution.txt`` lines 32–41.
"""

from __future__ import annotations

from typing import Any, Literal

import numpy as np
import pandas as pd

from partb import TGarchFitResult, build_part_b_split, load_spx_daily

InnovationKind = Literal["parametric", "bootstrap"]


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
        r_m = float(np.log(c1 / c0))
        mask = (daily_full[date_col] > d0) & (daily_full[date_col] <= d1)
        n_days = int(mask.sum())
        rows.append(
            {
                "date_start": d0,
                "date_end": d1,
                "close_start": c0,
                "close_end": c1,
                "R_month_log": r_m,
                "n_days": n_days,
            }
        )
    return pd.DataFrame(rows)


def _draw_standardized_innovations(
    garch: TGarchFitResult,
    n_total: int,
    rng: np.random.Generator,
    innovations: InnovationKind,
) -> np.ndarray:
    if innovations == "parametric":
        nu = float(garch.params["nu"])
        std_dev = np.sqrt(nu / (nu - 2.0))
        return rng.standard_t(nu, size=n_total) / std_dev
    pool = garch.standardized_residuals.dropna().to_numpy(dtype=float)
    if pool.size == 0:
        raise ValueError("no standardized residuals for bootstrap")
    return rng.choice(pool, size=n_total, replace=True)


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
    return y_s / scale, v_s / scale


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


def simulate_partb2_path(
    month_table: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    rng: np.random.Generator,
    *,
    date_col: str = "Date",
    burn: int = 500,
    innovations: InnovationKind = "parametric",
    price_tol: float = 1e-4,
) -> dict[str, Any]:
    """
    One Monte Carlo path: bridged daily log returns and reconstructed prices
    on observed trading calendars per month.
    """
    r_all: list[float] = []
    dates_out: list[pd.Timestamp] = []

    for _, row in month_table.iterrows():
        d0 = row["date_start"]
        d1 = row["date_end"]
        c0 = float(row["close_start"])
        c1 = float(row["close_end"])
        r_m = float(row["R_month_log"])
        n = int(row["n_days"])
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
        r_tilde, sig_tilde = simulate_tgarch_segment_log_units(
            garch, n, rng, burn=burn, innovations=innovations
        )
        r_star, _w = bridge_month_returns(r_m, r_tilde, sig_tilde)
        prices_m = prices_from_log_returns(c0, r_star)
        if not np.isclose(prices_m[-1], c1, rtol=price_tol, atol=price_tol * c1):
            raise RuntimeError(
                f"price bridge end {prices_m[-1]} vs target close {c1} for month ending {d1}"
            )
        r_all.extend(r_star.tolist())
        dates_out.extend(cal[date_col].tolist())

    r_arr = np.asarray(r_all, dtype=float)
    p0 = float(month_table.iloc[0]["close_start"])
    prices_arr = prices_from_log_returns(p0, r_arr)

    # Spot-check each month-end level on the cumulative path
    idx = 0
    for _, row in month_table.iterrows():
        n = int(row["n_days"])
        c1 = float(row["close_end"])
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
) -> dict[str, Any]:
    """
    Repeat bridged simulation ``n_paths`` times; return drawdown samples and
    percentiles by horizon.

    ``horizon_windows`` maps labels to trading-day window lengths (defaults
    ~1m/3m/6m).
    """
    if horizon_windows is None:
        horizon_windows = {"1m": 21, "3m": 63, "6m": 126}

    month_table = partb2_month_table(monthly_early, daily_full, date_col=date_col)
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
) -> dict[int, np.ndarray]:
    """
    Simulate ``n_paths`` bridged price paths; for each trading window ``w`` in
    ``windows``, concatenate overlapping **simple** buy-and-hold returns
    ``P_t/P_{t-w}-1`` across paths (pooled sample for histograms / tail stats).

    Same simple returns as ``expm1(sum of w daily log returns)`` on each path.
    """
    month_table = partb2_month_table(monthly_early, daily_full, date_col=date_col)
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

    month_table = partb2_month_table(monthly_early, daily_full, date_col=date_col)
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
            burn=burn,
            innovations=innovations,
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
