"""
SPX daily drawdown distributions (``spx_50yr.csv``).

``get_drawdowns`` and its helpers are inlined here (same logic as ``drawdowns.py``)
so this file is self-contained. Uses ``Close`` as equity: ``datetime`` from ``Date``,
``profit`` = ``Close``. For each window (30, 90, 180 calendar days ≈ 1M / 3M / 6M), histograms and
fractional drawdown ``drawdown_amount / peak_profit`` =
``(profit - rolling_max) / rolling_max``. Histograms use **Drawdown%** (×100).
**Worst-case** tail metrics are the **1st, 5th, and 10th** percentiles of that
series (sort worst→best; ≈99% / 95% / 90% of days are less severe).

**Part (b):** :func:`analyze_partb2_simulated_drawdown_percentiles` runs the same
rolling-peak fractional drawdown on bridged GARCH paths (pooling observations
across paths, or optionally a cross-path mean price series).

**Part (c):** :func:`analyze_partc2_simulated_drawdown_percentiles` uses the same
machinery on mean-of-month–matched paths (``partc_sim``).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal 

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

DEFAULT_CSV = Path(__file__).resolve().parent / "spx_50yr.csv"

# Default rolling-peak windows: ~1M / 3M / 6M in calendar days (aligned with Part b/c).
DEFAULT_CALENDAR_HORIZON_DAYS: tuple[int, ...] = (30, 90, 180)

_HORIZON_PRINT_LABEL: dict[int, str] = {
    30: "1M (~30d)",
    90: "3M (~90d)",
    180: "6M (~180d)",
}

_HORIZON_TITLE_FRAGMENT: dict[int, str] = {
    30: "1-month (~30 calendar-day lookback)",
    90: "3-month (~90 calendar-day lookback)",
    180: "6-month (~180 calendar-day lookback)",
}


def prepare_profit_series(results_df):
    """Build datetime-indexed profit series from ``results_df`` (profit used as given)."""
    profit_df = results_df[["datetime", "profit"]].copy()
    profit_df["datetime"] = pd.to_datetime(profit_df["datetime"])
    profit_df.set_index("datetime", inplace=True)
    s = profit_df["profit"]
    return s, s


def _compute_drawdown_series(
    profit_ref,
    profit_actual,
    period=None,
):

    """Drawdown of ``profit_actual`` vs a peak from ``profit_ref``.
    Coerces indices to :class:`pandas.DatetimeIndex` (copying; raises if invalid).
    If ``period`` is set (days), peak is a calendar rolling max on ``profit_ref``
    (``closed="left"``) with early NaNs filled from ``profit_ref``; ``peak_datetimes``
    is the date of the max in that lookback (current row excluded). If ``period``
    is falsy, peak is ``cummax`` on ``profit_ref`` and ``peak_datetimes`` is the
    ffill’d date of new highs.
    Returns ``(profit_actual - rolling_max, rolling_max, peak_datetimes)``.
    """

    if not isinstance(profit_ref.index, pd.DatetimeIndex):
        try:
            converted_index = pd.to_datetime(profit_ref.index, errors="raise")
        except Exception as exc:
            raise TypeError(
                "profit_ref index must be DatetimeIndex or datetime-convertible"
            ) from exc
        profit_ref = profit_ref.copy()
        profit_ref.index = converted_index

    if not isinstance(profit_actual.index, pd.DatetimeIndex):
        try:
            converted_actual_index = pd.to_datetime(
                profit_actual.index, errors="raise"
            )
        except Exception as exc:
            raise TypeError(
                "profit_actual index must be DatetimeIndex or datetime-convertible"
            ) from exc
        profit_actual = profit_actual.copy()
        profit_actual.index = converted_actual_index

    if period:
        window = f"{period}D"
        rolling_max = profit_ref.rolling(window=window, closed="left").max()
        rolling_max = rolling_max.fillna(profit_ref)
        lookback = pd.Timedelta(days=period)
        index_ns = profit_ref.index.to_numpy(dtype="datetime64[ns]").astype(
            "int64"
        )
        index_dt = profit_ref.index.to_numpy(dtype="datetime64[ns]")
        profit_vals = pd.to_numeric(profit_ref, errors="coerce").to_numpy(
            dtype=float
        )
        lookback_ns = lookback.value

        peak_dt_vals = np.empty(len(profit_vals), dtype="datetime64[ns]")
        for i in range(len(profit_vals)):
            left = np.searchsorted(
                index_ns, index_ns[i] - lookback_ns, side="left"
            )
            if left >= i:
                peak_dt_vals[i] = index_dt[i]
                continue

            window_vals = profit_vals[left:i]
            valid_mask = ~np.isnan(window_vals)
            if not valid_mask.any():
                peak_dt_vals[i] = index_dt[i]
                continue

            valid_positions = np.flatnonzero(valid_mask)
            rel_best = int(np.argmax(window_vals[valid_positions]))
            peak_pos = left + int(valid_positions[rel_best])
            peak_dt_vals[i] = index_dt[peak_pos]

        peak_datetimes = pd.Series(
            peak_dt_vals, index=profit_ref.index, dtype="datetime64[ns]"
        )
    else:
        rolling_max = profit_ref.cummax()
        running_max_ignore_na = profit_ref.where(
            profit_ref.notna(), -np.inf
        ).cummax()
        prev_cummax = running_max_ignore_na.shift(1).fillna(-np.inf)
        new_peak_mask = profit_ref.notna() & profit_ref.gt(prev_cummax)
        peak_datetimes = pd.Series(
            pd.NaT, index=profit_ref.index, dtype="datetime64[ns]"
        )
        peak_datetimes.loc[new_peak_mask] = profit_ref.index[new_peak_mask]
        peak_datetimes = peak_datetimes.ffill()

    drawdown = profit_actual - rolling_max
    return drawdown, rolling_max, peak_datetimes


def get_drawdowns(
    results_df,
    periods=None,
    return_series=True,
):
    """
    Drawdown vs rolling calendar-day peak for each window in ``periods``.

    ``drawdown_t = profit_t - rolling_max_t`` over the prior P calendar days
    (``closed='left'``). If ``len(results_df) <= P``, returns ``np.nan`` for that P.
    """
    if periods is None:
        periods = list(DEFAULT_CALENDAR_HORIZON_DAYS)
    profit_ref, profit_actual = prepare_profit_series(results_df)

    drawdowns_out = {}

    for period in periods:
        if len(profit_actual) > period:
            dd_series, _, _ = _compute_drawdown_series(
                profit_ref,
                profit_actual,
                period=period,
            )

            drawdowns_out[period] = dd_series if return_series else dd_series.min()
        else:
            drawdowns_out[period] = np.nan

    return drawdowns_out


def load_spx_results_df(csv_path: str | Path | None = None) -> pd.DataFrame:
    """
    Build ``results_df`` for ``get_drawdowns``: ``datetime``, ``profit`` (= Close).
    """
    path = Path(csv_path) if csv_path is not None else DEFAULT_CSV
    raw = pd.read_csv(path)
    df = pd.DataFrame(
        {
            "datetime": pd.to_datetime(raw["Date"], format="%m/%d/%Y"),
            "profit": pd.to_numeric(raw["Close"], errors="coerce"),
        }
    )
    return df.sort_values("datetime").reset_index(drop=True)


def fractional_drawdown_from_components(
    drawdown: pd.Series, rolling_peak: pd.Series
) -> pd.Series:
    """
    ``drawdown_amount / peak_profit`` with peak = rolling high of profit.

    ``drawdown`` is ``profit - rolling_peak`` (from ``_compute_drawdown_series``);
    returns ``drawdown / rolling_peak`` where peak is non-zero; else NaN.
    """
    peak = rolling_peak.replace(0, np.nan)
    r = drawdown / peak
    return r.replace([np.inf, -np.inf], np.nan)


def worst_case_tail_percentiles(series: pd.Series) -> dict[str, float]:
    """
    Left-tail (worst) percentiles on fractional drawdown, sorted worst→best.

    Returns 1st / 5th / 10th percentiles (~99% / 95% / 90% of observations
    are *less* severe i.e. higher / less negative).
    """
    x = series.dropna().to_numpy(dtype=float)
    x = x[np.isfinite(x)]
    if x.size == 0:
        return {"p1": float("nan"), "p5": float("nan"), "p10": float("nan")}
    x_wb = np.sort(x)
    p1, p5, p10 = np.percentile(x_wb, [1, 5, 10])
    return {"p1": float(p1), "p5": float(p5), "p10": float(p10)}


def moment_summary(x: np.ndarray) -> dict[str, float]:
    """Mean, median, skew, excess kurtosis (pandas ``kurt()``)."""
    s = pd.Series(np.asarray(x, dtype=float))
    s = s[np.isfinite(s)]
    n = len(s)
    if n < 2:
        return {
            "mean": float("nan"),
            "median": float("nan"),
            "skew": float("nan"),
            "kurtosis": float("nan"),
            "n": float(n),
        }
    return {
        "mean": float(s.mean()),
        "median": float(s.median()),
        "skew": float(s.skew()),
        "kurtosis": float(s.kurtosis()),
        "n": float(n),
    }


def compute_fractional_drawdown_vs_rolling_peak(
    results_df: pd.DataFrame,
    period: int,
) -> tuple[pd.Series, pd.Series, pd.Series] | None:
    """
    Same construction as Part (a): for calendar window ``period`` (days),
    ``drawdown_t = Close_t - max(Close)`` over the prior ``period`` calendar days
    (``closed='left'``), then fractional ``drawdown / rolling_peak``.

    Returns ``None`` if ``len(series) <= period``. Otherwise returns
    ``(fractional_series, dollar_drawdown, rolling_peak)``.
    """
    profit_ref, profit_actual = prepare_profit_series(results_df)
    if len(profit_actual) <= period:
        return None
    dd, rolling_max, _ = _compute_drawdown_series(
        profit_ref, profit_actual, period=period
    )
    ser = fractional_drawdown_from_components(dd, rolling_max)
    return (ser, dd, rolling_max)


def _drawdown_hist_and_tail_on_ax(
    ax: Any,
    x_frac: np.ndarray,
    period: int,
    *,
    title_body: str,
    xlabel: str | None = None,
    hist_xlim_pct: tuple[float, float] | None = None,
    hist_bins: int | None = None,
) -> dict[str, Any]:
    """
    Histogram of drawdown %, vertical lines at p1/p5/p10, moment text box.
    ``x_frac`` are finite fractional draws (not %).

    ``hist_xlim_pct`` if set clamps the histogram to that **percent** range
    (e.g. ``(-50, 50)`` for −50%…+50%) and sets ``ax.set_xlim``; values outside
    accumulate in the edge bins. ``hist_bins`` overrides bin count (default 80,
    or 140 when ``hist_xlim_pct`` is set unless ``hist_bins`` is given).
    """
    xlab = (
        xlabel
        if xlabel is not None
        else "Drawdown % of peak = 100 × (Close − peak) / peak"
    )
    if x_frac.size == 0:
        ax.set_title(f"{period}-day window: insufficient data")
        return {
            "worst_case_percentiles": {
                "p1": float("nan"),
                "p5": float("nan"),
                "p10": float("nan"),
            },
            "moments": moment_summary(x_frac),
            "n": 0,
        }

    pct = worst_case_tail_percentiles(pd.Series(x_frac))
    moments = moment_summary(x_frac)
    x_pct = x_frac * 100.0
    n_bins = hist_bins
    if n_bins is None:
        n_bins = 140 if hist_xlim_pct is not None else 80
    hist_kw: dict[str, Any] = {}
    if hist_xlim_pct is not None:
        lo, hi = float(hist_xlim_pct[0]), float(hist_xlim_pct[1])
        hist_kw["range"] = (lo, hi)
    ax.hist(
        x_pct,
        bins=n_bins,
        color="steelblue",
        edgecolor="white",
        alpha=0.88,
        **hist_kw,
    )
    ax.axvline(0, color="black", linewidth=0.8, linestyle="--", zorder=2)
    ymax = ax.get_ylim()[1]
    specs = (
        (pct["p1"] * 100.0, "darkred", 0.90, "1st pct\n(~worst 1%)"),
        (pct["p5"] * 100.0, "red", 0.80, "5th pct\n(~worst 5%)"),
        (pct["p10"] * 100.0, "darkorange", 0.70, "10th pct\n(~worst 10%)"),
    )
    for val, color, y_frac, name in specs:
        if np.isfinite(val):
            ax.axvline(val, color=color, linewidth=1.3, zorder=4)
            ax.text(
                val,
                y_frac * ymax,
                f"{name}\n{val:.3f}%",
                ha="center",
                va="bottom",
                fontsize=7,
                color=color,
                zorder=5,
            )

    ax.set_ylim(top=ymax * 1.25)
    if hist_xlim_pct is not None:
        ax.set_xlim(float(hist_xlim_pct[0]), float(hist_xlim_pct[1]))
    horizon = _HORIZON_TITLE_FRAGMENT.get(period)
    if horizon is None:
        horizon = (
            "1 calendar-day lookback"
            if period == 1
            else f"{period} calendar-day lookback"
        )
    ax.set_title(f"Drawdown% — {horizon} ({title_body})")
    ax.set_xlabel(xlab)
    ax.set_ylabel("Count")

    mtxt = (
        f"mean={moments['mean'] * 100:.4f}%  median={moments['median'] * 100:.4f}%  "
        f"skew={moments['skew']:.4f}  kurtosis(excess)={moments['kurtosis']:.4f}"
    )
    ax.text(
        0.02,
        0.98,
        mtxt,
        transform=ax.transAxes,
        fontsize=8,
        verticalalignment="top",
        bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.35),
    )
    return {
        "worst_case_percentiles": pct,
        "moments": moments,
        "n": int(x_frac.size),
    }


def analyze_spx_drawdown_percentiles(
    csv_path: str | Path | None = None,
    periods: tuple[int, ...] = DEFAULT_CALENDAR_HORIZON_DAYS,
    show_plots: bool = True,
    savefig_path: str | Path | None = None,
) -> dict[int, dict]:
    """
    For each calendar window P, fractional drawdown vs rolling peak, then:

    - Histogram of **Drawdown%** (fraction × 100).
    - **Worst-case** tail: 1st / 5th / 10th percentiles (fraction), marked on plot in %.
    - **Moments**: mean, median, skew, excess kurtosis on the fractional series.

    Returns
    -------
    dict[int, dict]
        ``fractional_drawdown_series``, ``drawdown_series`` (alias), dollar/peak
        series, ``worst_case_percentiles`` (p1, p5, p10), ``moments``, ``n``.
    """
    results_df = load_spx_results_df(csv_path)
    _, profit_actual = prepare_profit_series(results_df)

    n_plots = len(periods)
    fig, axes = plt.subplots(n_plots, 1, figsize=(10, 3.8 * n_plots), squeeze=False)
    axes_flat = axes.ravel()
    out: dict[int, dict] = {}

    for ax, p in zip(axes_flat, periods):
        if len(profit_actual) <= p:
            ax.set_title(f"{p}-day window: insufficient data")
            out[p] = {
                "fractional_drawdown_series": pd.Series(dtype=float),
                "drawdown_series": pd.Series(dtype=float),
                "dollar_drawdown_series": pd.Series(dtype=float),
                "rolling_peak_series": pd.Series(dtype=float),
                "worst_case_percentiles": {},
                "moments": {},
                "n": 0,
            }
            continue

        tri = compute_fractional_drawdown_vs_rolling_peak(results_df, p)
        if tri is None:
            ax.set_title(f"{p}-day window: insufficient data")
            out[p] = {
                "fractional_drawdown_series": pd.Series(dtype=float),
                "drawdown_series": pd.Series(dtype=float),
                "dollar_drawdown_series": pd.Series(dtype=float),
                "rolling_peak_series": pd.Series(dtype=float),
                "worst_case_percentiles": {},
                "moments": {},
                "n": 0,
            }
            continue

        ser, dd, rolling_max = tri
        if ser.isna().all():
            ax.set_title(f"{p}-day window: insufficient data")
            out[p] = {
                "fractional_drawdown_series": ser,
                "drawdown_series": ser,
                "dollar_drawdown_series": dd,
                "rolling_peak_series": rolling_max,
                "worst_case_percentiles": {},
                "moments": {},
                "n": 0,
            }
            continue

        x = ser.dropna().to_numpy(dtype=float)
        x = x[np.isfinite(x)]
        meta = _drawdown_hist_and_tail_on_ax(
            ax,
            x,
            p,
            title_body=f"n={len(x)}; SPX Close vs rolling peak",
        )
        out[p] = {
            "fractional_drawdown_series": ser,
            "drawdown_series": ser,
            "dollar_drawdown_series": dd,
            "rolling_peak_series": rolling_max,
            "worst_case_percentiles": meta["worst_case_percentiles"],
            "moments": meta["moments"],
            "n": meta["n"],
        }

    plt.tight_layout()
    if savefig_path is not None:
        plt.savefig(savefig_path, dpi=150, bbox_inches="tight")
    if show_plots:
        plt.show()
    else:
        plt.close(fig)

    print(
        "Worst-case tail: 1st / 5th / 10th pct of drawdown/peak (more negative = worse); "
        "~99% / 95% / 90% of days are less severe. Moments on same series (fraction; ×100 = %)."
    )
    for p in periods:
        row = out.get(p, {})
        pc = row.get("worst_case_percentiles") or {}
        m = row.get("moments") or {}
        hlabel = _HORIZON_PRINT_LABEL.get(p, f"{p} calendar-day")
        print(
            f"  {hlabel}: n={row.get('n', 0)}  "
            f"p1={pc.get('p1', float('nan')) * 100:.3f}%  "
            f"p5={pc.get('p5', float('nan')) * 100:.3f}%  "
            f"p10={pc.get('p10', float('nan')) * 100:.3f}%  |  "
            f"mean={m.get('mean', float('nan')) * 100:.4f}%  "
            f"median={m.get('median', float('nan')) * 100:.4f}%  "
            f"skew={m.get('skew', float('nan')):.4f}  "
            f"kurtosis(excess)={m.get('kurtosis', float('nan')):.4f}"
        )

    return out


def analyze_partb2_simulated_drawdown_percentiles(
    monthly_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: Any,
    *,
    n_paths: int = 200,
    seed: int | None = 42,
    periods_calendar_days: tuple[int, ...] = (30, 90, 180),
    pool: Literal["pooled", "mean_path"] = "pooled",
    burn: int = 500,
    innovations: Literal["parametric", "bootstrap"] = "parametric",
    use_first_trading_day_close_anchor: bool = False,
    show_plots: bool = True,
    savefig_path: str | Path | None = None,
    hist_xlim_pct: tuple[float, float] | None = (-50.0, 50.0),
    hist_bins: int | None = 200,
) -> dict[int, dict]:
    """
    Rolling peak-to-trough **fractional** drawdown (same definition as Part (a)
    / :func:`analyze_spx_drawdown_percentiles`) on Part (b) bridged simulated paths.

    Uses **calendar-day** lookbacks ``periods_calendar_days`` (defaults ≈ 1m / 3m /
    6m as 30 / 90 / 180 days), matching :func:`_compute_drawdown_series`.

    Parameters
    ----------
    pool
        ``pooled`` (default): concatenate fractional drawdowns over **all dates and
        all paths** — captures dispersion both in time and across simulations
        (recommended for tail shape vs Part (a)).
        ``mean_path``: average simulated **Close** at each trading date, then one
        SPX-style series (smooths away cross-path noise; tails are **not** the
        same as pooled).
    hist_xlim_pct, hist_bins
        Histogram focus: default x-axis **−50%…+50%** with **200** bins. Pass
        ``hist_xlim_pct=None`` for automatic limits (full support); percentile
        markers outside the window may be off-screen.
    """
    from partb import TGarchFitResult
    from partb_sim import InnovationKind, partb2_month_table, simulate_partb2_path

    if not isinstance(garch, TGarchFitResult):
        raise TypeError("garch must be TGarchFitResult")
    if n_paths < 1:
        raise ValueError("n_paths must be >= 1")

    kind: InnovationKind = "bootstrap" if innovations == "bootstrap" else "parametric"
    mt = partb2_month_table(monthly_early, daily_full)
    if mt.empty:
        raise ValueError("month_table is empty")

    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(n_paths)

    path0 = simulate_partb2_path(
        mt,
        daily_full,
        garch,
        np.random.default_rng(streams[0]),
        burn=burn,
        innovations=kind,
        use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
    )
    dates = path0["dates"]
    stack = np.empty((n_paths, len(path0["prices"])), dtype=float)
    stack[0, :] = path0["prices"]
    for pi in range(1, n_paths):
        stack[pi, :] = simulate_partb2_path(
            mt,
            daily_full,
            garch,
            np.random.default_rng(streams[pi]),
            burn=burn,
            innovations=kind,
            use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
        )["prices"]

    n_plots = len(periods_calendar_days)
    fig, axes = plt.subplots(n_plots, 1, figsize=(10, 3.8 * n_plots), squeeze=False)
    axes_flat = axes.ravel()
    out: dict[int, dict] = {}

    for ax, p in zip(axes_flat, periods_calendar_days):
        empty_row = {
            "fractional_drawdown_series": pd.Series(dtype=float),
            "drawdown_series": pd.Series(dtype=float),
            "dollar_drawdown_series": pd.Series(dtype=float),
            "rolling_peak_series": pd.Series(dtype=float),
            "worst_case_percentiles": {
                "p1": float("nan"),
                "p5": float("nan"),
                "p10": float("nan"),
            },
            "moments": moment_summary(np.array([], dtype=float)),
            "n": 0,
            "pool": pool,
            "n_paths": n_paths,
        }

        if pool == "mean_path":
            mean_close = stack[:, 1:].mean(axis=0)
            rdf = pd.DataFrame(
                {"datetime": pd.to_datetime(dates), "profit": mean_close}
            )
            tri = compute_fractional_drawdown_vs_rolling_peak(rdf, p)
            if tri is None or tri[0].isna().all():
                ax.set_title(f"{p}-day window: insufficient data")
                out[p] = dict(empty_row)
                if tri is not None:
                    ser_e, dd_e, rm_e = tri
                    out[p].update(
                        {
                            "fractional_drawdown_series": ser_e,
                            "drawdown_series": ser_e,
                            "dollar_drawdown_series": dd_e,
                            "rolling_peak_series": rm_e,
                        }
                    )
                continue

            ser, dd, rolling_max = tri
            x = ser.dropna().to_numpy(dtype=float)
            x = x[np.isfinite(x)]
            title_body = (
                f"n={len(x)}; mean path over {n_paths} sims vs rolling peak "
                f"({p} calendar-day lookback)"
            )
            meta = _drawdown_hist_and_tail_on_ax(
                ax,
                x,
                p,
                title_body=title_body,
                hist_xlim_pct=hist_xlim_pct,
                hist_bins=hist_bins,
            )
            out[p] = {
                "fractional_drawdown_series": ser,
                "drawdown_series": ser,
                "dollar_drawdown_series": dd,
                "rolling_peak_series": rolling_max,
                "worst_case_percentiles": meta["worst_case_percentiles"],
                "moments": meta["moments"],
                "n": meta["n"],
                "pool": pool,
                "n_paths": n_paths,
            }
            continue

        # pooled: concatenate fractional DD over paths × dates
        chunks: list[np.ndarray] = []
        for pi in range(n_paths):
            rdf = pd.DataFrame(
                {
                    "datetime": pd.to_datetime(dates),
                    "profit": stack[pi, 1:],
                }
            )
            tri = compute_fractional_drawdown_vs_rolling_peak(rdf, p)
            if tri is None:
                continue
            ser_pi, _, _ = tri
            sub = ser_pi.dropna().to_numpy(dtype=float)
            sub = sub[np.isfinite(sub)]
            if sub.size:
                chunks.append(sub)

        if not chunks:
            ax.set_title(f"{p}-day window: insufficient data")
            out[p] = empty_row
            continue

        x = np.concatenate(chunks)
        title_body = (
            f"n={len(x)} pooled obs ({n_paths} paths × dates); vs rolling peak "
            f"({p} calendar-day lookback)"
        )
        meta = _drawdown_hist_and_tail_on_ax(
            ax,
            x,
            p,
            title_body=title_body,
            hist_xlim_pct=hist_xlim_pct,
            hist_bins=hist_bins,
        )
        out[p] = {
            "fractional_drawdown_series": pd.Series(x),
            "drawdown_series": pd.Series(x),
            "dollar_drawdown_series": pd.Series(dtype=float),
            "rolling_peak_series": pd.Series(dtype=float),
            "worst_case_percentiles": meta["worst_case_percentiles"],
            "moments": meta["moments"],
            "n": meta["n"],
            "pool": pool,
            "n_paths": n_paths,
        }

    plt.tight_layout()
    if savefig_path is not None:
        plt.savefig(savefig_path, dpi=150, bbox_inches="tight")
    if show_plots:
        plt.show()
    else:
        plt.close(fig)

    print(
        f"Part (b) sim — pool={pool!r}: same rolling-peak fractional DD as Part (a); "
        "1st/5th/10th pct = left tail (more negative = worse)."
    )
    for p in periods_calendar_days:
        row = out.get(p, {})
        pc = row.get("worst_case_percentiles") or {}
        m = row.get("moments") or {}
        hlabel = _HORIZON_PRINT_LABEL.get(p, f"{p} calendar-day")
        print(
            f"  {hlabel}: n={row.get('n', 0)}  "
            f"p1={pc.get('p1', float('nan')) * 100:.3f}%  "
            f"p5={pc.get('p5', float('nan')) * 100:.3f}%  "
            f"p10={pc.get('p10', float('nan')) * 100:.3f}%  |  "
            f"mean={m.get('mean', float('nan')) * 100:.4f}%  "
            f"median={m.get('median', float('nan')) * 100:.4f}%  "
            f"skew={m.get('skew', float('nan')):.4f}  "
            f"kurtosis(excess)={m.get('kurtosis', float('nan')):.4f}"
        )

    return out


def analyze_partc2_simulated_drawdown_percentiles(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: Any,
    *,
    n_paths: int = 200,
    seed: int | None = 42,
    periods_calendar_days: tuple[int, ...] = (30, 90, 180),
    pool: Literal["pooled", "mean_path"] = "pooled",
    burn: int = 500,
    innovations: Literal["parametric", "bootstrap"] = "parametric",
    show_plots: bool = True,
    savefig_path: str | Path | None = None,
    hist_xlim_pct: tuple[float, float] | None = (-50.0, 50.0),
    hist_bins: int | None = 200,
) -> dict[int, dict]:
    """
    Same rolling-peak fractional drawdown as :func:`analyze_partb2_simulated_drawdown_percentiles`,
    but simulated paths use **monthly mean Close** constraints (``partc_sim``).
    """
    from partb import TGarchFitResult
    from partc_sim import InnovationKind, partc2_month_table, simulate_partc2_path

    if not isinstance(garch, TGarchFitResult):
        raise TypeError("garch must be TGarchFitResult")
    if n_paths < 1:
        raise ValueError("n_paths must be >= 1")

    kind: InnovationKind = "bootstrap" if innovations == "bootstrap" else "parametric"
    mt = partc2_month_table(monthly_avg_early, daily_full)
    if mt.empty:
        raise ValueError("month_table is empty")

    seq = np.random.SeedSequence(seed)
    streams = seq.spawn(n_paths)

    path0 = simulate_partc2_path(
        mt,
        daily_full,
        garch,
        np.random.default_rng(streams[0]),
        burn=burn,
        innovations=kind,
    )
    dates = path0["dates"]
    stack = np.empty((n_paths, len(path0["prices"])), dtype=float)
    stack[0, :] = path0["prices"]
    for pi in range(1, n_paths):
        stack[pi, :] = simulate_partc2_path(
            mt,
            daily_full,
            garch,
            np.random.default_rng(streams[pi]),
            burn=burn,
            innovations=kind,
        )["prices"]

    n_plots = len(periods_calendar_days)
    fig, axes = plt.subplots(n_plots, 1, figsize=(10, 3.8 * n_plots), squeeze=False)
    axes_flat = axes.ravel()
    out: dict[int, dict] = {}

    for ax, p in zip(axes_flat, periods_calendar_days):
        empty_row = {
            "fractional_drawdown_series": pd.Series(dtype=float),
            "drawdown_series": pd.Series(dtype=float),
            "dollar_drawdown_series": pd.Series(dtype=float),
            "rolling_peak_series": pd.Series(dtype=float),
            "worst_case_percentiles": {
                "p1": float("nan"),
                "p5": float("nan"),
                "p10": float("nan"),
            },
            "moments": moment_summary(np.array([], dtype=float)),
            "n": 0,
            "pool": pool,
            "n_paths": n_paths,
        }

        if pool == "mean_path":
            mean_close = stack[:, 1:].mean(axis=0)
            rdf = pd.DataFrame(
                {"datetime": pd.to_datetime(dates), "profit": mean_close}
            )
            tri = compute_fractional_drawdown_vs_rolling_peak(rdf, p)
            if tri is None or tri[0].isna().all():
                ax.set_title(f"{p}-day window: insufficient data")
                out[p] = dict(empty_row)
                if tri is not None:
                    ser_e, dd_e, rm_e = tri
                    out[p].update(
                        {
                            "fractional_drawdown_series": ser_e,
                            "drawdown_series": ser_e,
                            "dollar_drawdown_series": dd_e,
                            "rolling_peak_series": rm_e,
                        }
                    )
                continue

            ser, dd, rolling_max = tri
            x = ser.dropna().to_numpy(dtype=float)
            x = x[np.isfinite(x)]
            title_body = (
                f"n={len(x)}; mean path over {n_paths} sims vs rolling peak "
                f"({p} calendar-day lookback)"
            )
            meta = _drawdown_hist_and_tail_on_ax(
                ax,
                x,
                p,
                title_body=title_body,
                hist_xlim_pct=hist_xlim_pct,
                hist_bins=hist_bins,
            )
            out[p] = {
                "fractional_drawdown_series": ser,
                "drawdown_series": ser,
                "dollar_drawdown_series": dd,
                "rolling_peak_series": rolling_max,
                "worst_case_percentiles": meta["worst_case_percentiles"],
                "moments": meta["moments"],
                "n": meta["n"],
                "pool": pool,
                "n_paths": n_paths,
            }
            continue

        chunks: list[np.ndarray] = []
        for pi in range(n_paths):
            rdf = pd.DataFrame(
                {
                    "datetime": pd.to_datetime(dates),
                    "profit": stack[pi, 1:],
                }
            )
            tri = compute_fractional_drawdown_vs_rolling_peak(rdf, p)
            if tri is None:
                continue
            ser_pi, _, _ = tri
            sub = ser_pi.dropna().to_numpy(dtype=float)
            sub = sub[np.isfinite(sub)]
            if sub.size:
                chunks.append(sub)

        if not chunks:
            ax.set_title(f"{p}-day window: insufficient data")
            out[p] = empty_row
            continue

        x = np.concatenate(chunks)
        title_body = (
            f"n={len(x)} pooled obs ({n_paths} paths × dates); vs rolling peak "
            f"({p} calendar-day lookback)"
        )
        meta = _drawdown_hist_and_tail_on_ax(
            ax,
            x,
            p,
            title_body=title_body,
            hist_xlim_pct=hist_xlim_pct,
            hist_bins=hist_bins,
        )
        out[p] = {
            "fractional_drawdown_series": pd.Series(x),
            "drawdown_series": pd.Series(x),
            "dollar_drawdown_series": pd.Series(dtype=float),
            "rolling_peak_series": pd.Series(dtype=float),
            "worst_case_percentiles": meta["worst_case_percentiles"],
            "moments": meta["moments"],
            "n": meta["n"],
            "pool": pool,
            "n_paths": n_paths,
        }

    plt.tight_layout()
    if savefig_path is not None:
        plt.savefig(savefig_path, dpi=150, bbox_inches="tight")
    if show_plots:
        plt.show()
    else:
        plt.close(fig)

    print(
        f"Part (c) sim — pool={pool!r}: same rolling-peak fractional DD as Part (a); "
        "1st/5th/10th pct = left tail (more negative = worse)."
    )
    for p in periods_calendar_days:
        row = out.get(p, {})
        pc = row.get("worst_case_percentiles") or {}
        m = row.get("moments") or {}
        hlabel = _HORIZON_PRINT_LABEL.get(p, f"{p} calendar-day")
        print(
            f"  {hlabel}: n={row.get('n', 0)}  "
            f"p1={pc.get('p1', float('nan')) * 100:.3f}%  "
            f"p5={pc.get('p5', float('nan')) * 100:.3f}%  "
            f"p10={pc.get('p10', float('nan')) * 100:.3f}%  |  "
            f"mean={m.get('mean', float('nan')) * 100:.4f}%  "
            f"median={m.get('median', float('nan')) * 100:.4f}%  "
            f"skew={m.get('skew', float('nan')):.4f}  "
            f"kurtosis(excess)={m.get('kurtosis', float('nan')):.4f}"
        )

    return out


if __name__ == "__main__":
    analyze_spx_drawdown_percentiles()
