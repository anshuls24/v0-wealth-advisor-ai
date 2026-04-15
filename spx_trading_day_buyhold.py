"""
Rolling **trading-day** buy-and-hold simple returns (30 / 60 / 90 days).

Uses ``Close`` / ``Date`` like ``spx_rolling_buyhold`` and ``spx_drawdown_severity``,
but windows are **counts of trading days**, not calendar months.

**Simple return** over w trading days ending at day ``t``:

``R_simple = P_t / P_{t-w} - 1``

If you only have **daily log returns** ``r_k = log(P_{k+1}/P_k)`` (e.g. Part (b)
simulation), the same quantity is ``np.expm1(np.sum(r[(t-w):t]))`` — we verify
this matches the price ratio (up to float error).

Analysis mirrors ``spx_rolling_buyhold.analyze_spx_rolling``:

- Histogram of simple returns
- ``returns_df`` sorted **worst → best** with rank column
- ``tail_loss_percentiles`` (left: p1/p5/p10 ≈ 99%/95%/90% VaR-style loss tail;
  right: p90/p95/p99)
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from partb import TGarchFitResult
from spx_rolling_buyhold import moment_summary, tail_loss_percentiles

DEFAULT_CSV = Path(__file__).resolve().parent / "spx_50yr.csv"


def load_spx(csv_path: str | Path | None = None) -> pd.DataFrame:
    path = Path(csv_path) if csv_path is not None else DEFAULT_CSV
    df = pd.read_csv(path)
    df["Date"] = pd.to_datetime(df["Date"], format="%m/%d/%Y")
    return df.sort_values("Date").reset_index(drop=True)


def rolling_trading_day_simple_returns_table(
    df: pd.DataFrame,
    w: int,
    *,
    price_col: str = "Close",
    date_col: str = "Date",
) -> pd.DataFrame:
    """
    One row per end date with ``return_simple = Close_end / Close_start - 1``,
    ``w`` trading days apart (``w`` daily returns between them).
    """
    df = df.sort_values(date_col).reset_index(drop=True)
    close = df[price_col].to_numpy(dtype=float)
    dates = df[date_col].to_numpy()
    n = len(close)
    if n <= w:
        return pd.DataFrame(
            columns=[
                "worst_to_best_rank",
                "start_date",
                "end_date",
                "start_price",
                "end_price",
                "return_simple",
            ]
        )
    r_simple = close[w:] / close[:-w] - 1.0
    out = pd.DataFrame(
        {
            "start_date": dates[:-w],
            "end_date": dates[w:],
            "start_price": close[:-w],
            "end_price": close[w:],
            "return_simple": r_simple,
        }
    )
    order = np.argsort(out["return_simple"].to_numpy())
    out = out.iloc[order].reset_index(drop=True)
    out.insert(0, "worst_to_best_rank", np.arange(1, len(out) + 1))
    return out


def daily_log_returns_from_prices(close: np.ndarray) -> np.ndarray:
    """``log(P_t/P_{t-1})`` for adjacent closes; length ``len(close)-1``."""
    close = np.asarray(close, dtype=float)
    return np.log(close[1:] / close[:-1])


def rolling_simple_from_daily_log_returns(
    log_r: np.ndarray,
    w: int,
    n_prices: int,
) -> np.ndarray:
    """
    Same overlapping simple returns as ``rolling_trading_day_simple_returns_table``,
    but built from daily log returns via ``expm1(sum of w logs)``.

    ``n_prices`` is the length of the price series that generated ``log_r``
    (so ``len(log_r) == n_prices - 1``).
    """
    log_r = np.asarray(log_r, dtype=float)
    if n_prices != len(log_r) + 1:
        raise ValueError("n_prices must equal len(log_r) + 1")
    if w < 1 or n_prices <= w:
        return np.array([], dtype=float)
    out = np.empty(n_prices - w, dtype=float)
    for k in range(w, n_prices):
        out[k - w] = float(np.expm1(np.sum(log_r[k - w : k])))
    return out


def _fmt_return_label(x: float) -> str:
    return f"{x:.4f}\n({x * 100:+.2f}%)"


def _annotate_vline(
    ax: plt.Axes,
    x: float,
    y_frac: float,
    label: str,
    color: str,
    ymax: float,
) -> None:
    ax.axvline(x, color=color, linewidth=1.2, zorder=4)
    ax.text(
        x,
        y_frac * ymax,
        label,
        ha="center",
        va="bottom",
        fontsize=7,
        color=color,
        zorder=5,
        linespacing=0.9,
    )


def analyze_trading_day_buyhold_percentiles(
    csv_path: str | Path | None = None,
    trading_windows: tuple[int, ...] = (30, 60, 90),
    *,
    pooled_returns: dict[int, np.ndarray] | None = None,
    horizon_labels: dict[int, str] | None = None,
    xlabel: str | None = None,
    source_label: str | None = None,
    xlim: tuple[float, float] | None = None,
    xlim_percentiles: tuple[float, float] | None = None,
    xlim_symmetric_percentiles: tuple[float, float] | None = None,
    show_plots: bool = True,
    savefig_path: str | Path | None = None,
    title_prefix: str = "",
) -> dict[int, dict[str, object]]:
    """
    Histograms + tail metrics for each trading-day window.

    Parameters
    ----------
    csv_path
        SPX CSV (ignored if ``pooled_returns`` is provided for a window — use
        one or the other per call pattern; if ``pooled_returns`` is set, it
        supplies **all** windows and ``csv_path`` is unused).
    pooled_returns
        Optional ``{30: array, 60: array, ...}`` of **simple** returns already
        pooled (e.g. many simulated paths concatenated). If provided, **must**
        contain every key in ``trading_windows``.
    horizon_labels
        If set, titles / logs use ``horizon_labels[w]`` (e.g. ``{1: "1 calendar
        month", 3: "3 calendar months", ...}``) instead of ``"{w} trading days"``.
    xlabel
        Override x-axis label; default describes trading-day simple returns.
    source_label
        Plot/log label for the sample, e.g. ``"SPX historical"`` when passing
        pooled returns that are **not** simulated. Default: ``"SPX historical"``
        if not ``pooled_returns``, else ``"simulated pooled"``.
    xlim
        Fixed ``(left, right)`` x-axis limits. Highest priority.
    xlim_percentiles
        If set (and ``xlim`` is None), limits use
        ``(percentile(r, lo), percentile(r, hi))`` plus padding.
    xlim_symmetric_percentiles
        If set (and the above are None), limits are ``±M`` (plus padding) with
        ``M = max(|p_lo|, |p_hi|)`` so the view stays near **zero** and long-tail
        mass at large |x| is off-screen.
    trading_windows
        Keys for each horizon (trading days like 30, 60, 90 **or** months 1, 3, 6
        when using calendar-month pooled returns).

    Returns
    -------
    dict[int, dict]
        ``returns_df``, ``tail_metrics``, ``returns_array``, ``full_moments``,
        optionally ``log_vs_price_max_abs_diff`` for CSV path (sanity check).
    """
    results: dict[int, dict[str, object]] = {}
    use_pool = pooled_returns is not None

    if use_pool:
        for w in trading_windows:
            if w not in pooled_returns:
                raise KeyError(f"pooled_returns missing key {w}")

    n_plots = len(trading_windows)
    fig, axes = plt.subplots(n_plots, 1, figsize=(10, 4.0 * n_plots), squeeze=False)
    axes_flat = axes.ravel()

    default_src = "simulated pooled" if use_pool else "SPX historical"
    resolved_src = source_label if source_label is not None else default_src

    for ax, w in zip(axes_flat, trading_windows):
        if use_pool:
            r = np.asarray(pooled_returns[w], dtype=float)
            r = r[np.isfinite(r)]
            rets_df = pd.DataFrame({"return_simple": r})
            order = np.argsort(r)
            rets_df = rets_df.iloc[order].reset_index(drop=True)
            rets_df.insert(0, "worst_to_best_rank", np.arange(1, len(rets_df) + 1))
            log_check = None
        else:
            df = load_spx(csv_path)
            close = df["Close"].to_numpy(dtype=float)
            dates = df["Date"].to_numpy()
            chron_r = close[w:] / close[:-w] - 1.0
            log_r = daily_log_returns_from_prices(close)
            r_from_log = rolling_simple_from_daily_log_returns(log_r, w, len(close))
            log_check = (
                float(np.max(np.abs(chron_r - r_from_log)))
                if chron_r.size == r_from_log.size
                else None
            )
            rets_df = pd.DataFrame(
                {
                    "start_date": dates[:-w],
                    "end_date": dates[w:],
                    "start_price": close[:-w],
                    "end_price": close[w:],
                    "return_simple": chron_r,
                }
            )
            r = chron_r[np.isfinite(chron_r)]
            order = np.argsort(rets_df["return_simple"].to_numpy())
            rets_df = rets_df.iloc[order].reset_index(drop=True)
            rets_df.insert(0, "worst_to_best_rank", np.arange(1, len(rets_df) + 1))

        tail = tail_loss_percentiles(r)
        full_m = moment_summary(r)

        results[w] = {
            "returns_df": rets_df,
            "tail_metrics": tail,
            "returns_array": r,
            "full_moments": full_m,
            "log_vs_price_max_abs_diff": log_check,
        }

        # Match ``spx_rolling_buyhold.analyze_spx_rolling`` (bins=60). If we only
        # ``set_xlim`` after ``hist`` on data with huge outliers, all 60 bins span
        # min(r)…max(r) and the zoomed view shows one or two giant blocks — use
        # ``range=(x_lo, x_hi)`` so bins are dense inside the visible window.
        n_bins = 60
        x_lo: float | None = None
        x_hi: float | None = None
        if xlim is not None:
            x_lo, x_hi = float(xlim[0]), float(xlim[1])
        elif xlim_percentiles is not None:
            ql, qh = xlim_percentiles
            lo, hi = np.percentile(r, [ql, qh])
            span = float(hi - lo)
            pad = max(0.02 * span, 1e-8)
            x_lo, x_hi = float(lo - pad), float(hi + pad)
        elif xlim_symmetric_percentiles is not None:
            ql, qh = xlim_symmetric_percentiles
            lo, hi = np.percentile(r, [ql, qh])
            m = max(abs(float(lo)), abs(float(hi)))
            if m == 0.0:
                m = float(np.std(r) or 0.05)
            pad = max(0.05 * m, 1e-8)
            x_lo, x_hi = float(-m - pad), float(m + pad)

        if x_lo is not None and x_hi is not None and x_hi > x_lo:
            ax.hist(
                r,
                bins=n_bins,
                range=(x_lo, x_hi),
                color="steelblue",
                edgecolor="white",
                alpha=0.85,
            )
        else:
            ax.hist(r, bins=n_bins, color="steelblue", edgecolor="white", alpha=0.85)

        ax.axvline(0, color="black", linewidth=0.8, linestyle="--", zorder=3)
        ymax = ax.get_ylim()[1]

        left_specs = (
            (tail["return_p10"], "darkorange", 0.88, "p10\n(~90% VaR)"),
            (tail["return_p5"], "red", 0.78, "p5\n(~95% VaR)"),
            (tail["return_p1"], "darkred", 0.68, "p1\n(~99% VaR)"),
        )
        for val, color, yf, name in left_specs:
            if np.isfinite(val):
                _annotate_vline(
                    ax,
                    val,
                    yf,
                    f"{name}\n{_fmt_return_label(val)}",
                    color,
                    ymax,
                )

        right_specs = (
            (tail["return_p90"], "darkgreen", 0.88, "p90"),
            (tail["return_p95"], "forestgreen", 0.78, "p95"),
            (tail["return_p99"], "limegreen", 0.68, "p99"),
        )
        for val, color, yf, name in right_specs:
            if np.isfinite(val):
                _annotate_vline(
                    ax,
                    val,
                    yf,
                    f"{name}\n{_fmt_return_label(val)}",
                    color,
                    ymax,
                )

        ax.set_ylim(top=ymax * 1.14)

        if x_lo is not None and x_hi is not None and x_hi > x_lo:
            ax.set_xlim(x_lo, x_hi)

        src = resolved_src
        pre = f"{title_prefix} " if title_prefix else ""
        if horizon_labels is not None:
            w_desc = horizon_labels.get(w, str(w))
        else:
            w_desc = f"{w}-trading-day"
        ax.set_title(f"{pre}{w_desc} buy-hold simple return ({src}; n={len(r)})")
        ax.set_xlabel(
            xlabel
            if xlabel is not None
            else "Total simple return (expm1(sum log r) ≡ P_T/P_0 − 1)"
        )
        ax.set_ylabel("Count")
        mtxt = (
            f"mean={full_m['mean'] * 100:.4f}%  median={full_m['median'] * 100:.4f}%  "
            f"skew={full_m['skew']:.4f}  kurtosis(excess)={full_m['kurtosis']:.4f}"
        )
        if log_check is not None and log_check > 1e-8:
            mtxt += f"\nmax|price-ratio − expm1(Σlog)|={log_check:.2e}"
        ax.text(
            0.02,
            0.98,
            mtxt,
            transform=ax.transAxes,
            fontsize=8,
            verticalalignment="top",
            bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.35),
        )
        ax.legend(
            handles=[
                plt.Line2D(
                    [0],
                    [0],
                    color="darkorange",
                    lw=2,
                    label="Left tail p10/p5/p1",
                ),
                plt.Line2D(
                    [0],
                    [0],
                    color="darkgreen",
                    lw=2,
                    label="Right tail p90/p95/p99",
                ),
            ],
            loc="upper left",
            fontsize=8,
        )

        log_heading = (
            horizon_labels.get(w, str(w))
            if horizon_labels is not None
            else f"{w} trading days"
        )
        print(f"\n=== {log_heading} ({src}) ===")
        print(f"Observations: {len(r)}")
        if log_check is not None:
            print(
                f"  Sanity: max abs diff price-ratio vs expm1(sum log r) = {log_check:.3e}"
            )
        print(
            f"  mean={full_m['mean']:.6f}  median={full_m['median']:.6f}  "
            f"skew={full_m['skew']:.4f}  kurtosis(excess)={full_m['kurtosis']:.4f}"
        )
        print("  Left tail (worst returns; p10/p5/p1) ~ 90%/95%/99% VaR confidence:")
        for key, lab in [
            ("return_p10", "p10"),
            ("return_p5", "p5"),
            ("return_p1", "p1"),
        ]:
            print(f"    {lab}: {tail[key]:.6f}")
        print("  Right tail (p90/p95/p99):")
        for key, lab in [
            ("return_p90", "p90"),
            ("return_p95", "p95"),
            ("return_p99", "p99"),
        ]:
            print(f"    {lab}: {tail[key]:.6f}")

    plt.tight_layout()
    if savefig_path is not None:
        plt.savefig(savefig_path, dpi=150, bbox_inches="tight")
    if show_plots:
        plt.show()
    else:
        plt.close(fig)

    return results


def analyze_partb2_simulated_trading_buyhold(
    monthly_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    n_paths: int = 100,
    seed: int | None = 42,
    trading_windows: tuple[int, ...] = (30, 60, 90),
    show_plots: bool = True,
    savefig_path: str | Path | None = None,
    burn: int = 500,
    innovations: str = "parametric",
    price_col: str = "Close",
    use_first_trading_day_close_anchor: bool = False,
    xlim: tuple[float, float] | None = None,
    xlim_percentiles: tuple[float, float] | None = None,
    xlim_symmetric_percentiles: tuple[float, float] | None = (1.0, 99.0),
) -> dict[int, dict[str, object]]:
    """
    Pool rolling simple returns across many Part (b) simulated paths, then run
    the same histogram / tail analysis as historical SPX.

    Underlying paths use **consecutive month-end closes** from ``monthly_early``
    (previous month last trading day → current month last trading day) per
    ``partb_sim.partb2_month_table``; histograms and percentiles use pooled
    returns **after** that bridged simulation. Optional
    ``use_first_trading_day_close_anchor=True`` adds a pin to the first
    intra-month ``daily_full`` close.

    ``garch`` should be a :class:`partb.TGarchFitResult`.
    Default ``xlim_symmetric_percentiles=(1, 99)`` zooms the x-axis near 0;
    pass ``None`` for full auto-scale.
    """
    from partb_sim import InnovationKind, partb2_pool_rolling_simple_returns

    if not isinstance(garch, TGarchFitResult):
        raise TypeError("garch must be TGarchFitResult")
    kind: InnovationKind = (
        "bootstrap" if innovations == "bootstrap" else "parametric"
    )

    pooled = partb2_pool_rolling_simple_returns(
        monthly_early,
        daily_full,
        garch,
        windows=trading_windows,
        n_paths=n_paths,
        seed=seed,
        burn=burn,
        innovations=kind,
        price_col=price_col,
        use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
    )
    return analyze_trading_day_buyhold_percentiles(
        trading_windows=trading_windows,
        pooled_returns=pooled,
        show_plots=show_plots,
        savefig_path=savefig_path,
        title_prefix="Part (b) sim",
        xlim=xlim,
        xlim_percentiles=xlim_percentiles,
        xlim_symmetric_percentiles=xlim_symmetric_percentiles,
    )


_CAL_MONTH_LABELS = {
    1: "1 calendar month",
    3: "3 calendar months",
    6: "6 calendar months",
}




def analyze_partb2_simulated_calendar_month_buyhold(
    monthly_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    horizons_months: tuple[int, ...] = (1, 3, 6),
    n_paths: int = 100,
    seed: int | None = 42,
    show_plots: bool = True,
    savefig_path: str | Path | None = None,
    burn: int = 500,
    innovations: str = "parametric",
    price_col: str = "Close",
    use_first_trading_day_close_anchor: bool = False,
    xlim: tuple[float, float] | None = None,
    xlim_percentiles: tuple[float, float] | None = None,
    xlim_symmetric_percentiles: tuple[float, float] | None = (1.0, 99.0),
) -> dict[int, dict[str, object]]:
    """
    Pool **calendar-month** rolling simple returns across Part (b) simulated
    paths (same convention as ``rolling_calendar_month_returns`` on daily
    ``Date`` / ``Close``).

    Month-to-month simulation uses consecutive ``monthly_early`` rows (same as
    ``monthly_early.csv`` / ``year_month``): each bridged interval starts at the
    **previous** month-end ``Close`` and ends at the **current** month-end
    ``Close``. Example: target March 1996 uses February 1996-02-29 ``Close`` as
    ``close_start`` and March 1996-03-29 ``Close`` as ``close_end``; see
    ``partb_sim.bridge_interval_from_monthly_early``.

    By default (``use_first_trading_day_close_anchor=False``), each simulated month
    is anchored only at **two month-end closes** from ``monthly_early`` (previous
    month last day → current month last day), consistent with having only EOM
    data for the early 40 years; then GARCH + bridge fill trading days before
    percentiles. Set ``use_first_trading_day_close_anchor=True`` to also pin the
    first intra-month day to ``daily_full``.

    Default ``xlim_symmetric_percentiles=(1, 99)`` zooms near 0; pass ``None``
    for matplotlib auto limits.
    """
    from partb_sim import InnovationKind, partb2_pool_calendar_month_simple_returns

    if not isinstance(garch, TGarchFitResult):
        raise TypeError("garch must be TGarchFitResult")
    kind: InnovationKind = (
        "bootstrap" if innovations == "bootstrap" else "parametric"
    )

    pooled = partb2_pool_calendar_month_simple_returns(
        monthly_early,
        daily_full,
        garch,
        horizons_months=horizons_months,
        n_paths=n_paths,
        seed=seed,
        burn=burn,
        innovations=kind,
        price_col=price_col,
        use_first_trading_day_close_anchor=use_first_trading_day_close_anchor,
    )
    labels = {h: _CAL_MONTH_LABELS.get(h, f"{h} calendar months") for h in horizons_months}
    return analyze_trading_day_buyhold_percentiles(
        trading_windows=horizons_months,
        pooled_returns=pooled,
        horizon_labels=labels,
        xlabel="Total simple return (calendar-month rolling buy-hold)",
        show_plots=show_plots,
        savefig_path=savefig_path,
        title_prefix="Part (b) sim",
        xlim=xlim,
        xlim_percentiles=xlim_percentiles,
        xlim_symmetric_percentiles=xlim_symmetric_percentiles,
    )


def analyze_partc2_simulated_calendar_month_buyhold(
    monthly_avg_early: pd.DataFrame,
    daily_full: pd.DataFrame,
    garch: TGarchFitResult,
    *,
    horizons_months: tuple[int, ...] = (1, 3, 6),
    n_paths: int = 100,
    seed: int | None = 42,
    show_plots: bool = True,
    savefig_path: str | Path | None = None,
    burn: int = 500,
    innovations: str = "parametric",
    price_col: str = "Close",
    xlim: tuple[float, float] | None = None,
    xlim_percentiles: tuple[float, float] | None = None,
    xlim_symmetric_percentiles: tuple[float, float] | None = (1.0, 99.0),
) -> dict[int, dict[str, object]]:
    """
    Pool calendar-month rolling simple returns across Part (c) simulated paths
    (``partc_sim``: each month’s **mean daily Close** matches ``monthly_avg_early``).
    """
    from partc_sim import InnovationKind, partc2_pool_calendar_month_simple_returns

    if not isinstance(garch, TGarchFitResult):
        raise TypeError("garch must be TGarchFitResult")
    kind: InnovationKind = (
        "bootstrap" if innovations == "bootstrap" else "parametric"
    )

    pooled = partc2_pool_calendar_month_simple_returns(
        monthly_avg_early,
        daily_full,
        garch,
        horizons_months=horizons_months,
        n_paths=n_paths,
        seed=seed,
        burn=burn,
        innovations=kind,
        price_col=price_col,
    )
    labels = {h: _CAL_MONTH_LABELS.get(h, f"{h} calendar months") for h in horizons_months}
    return analyze_trading_day_buyhold_percentiles(
        trading_windows=horizons_months,
        pooled_returns=pooled,
        horizon_labels=labels,
        xlabel="Total simple return (calendar-month rolling buy-hold)",
        show_plots=show_plots,
        savefig_path=savefig_path,
        title_prefix="Part (c) sim",
        xlim=xlim,
        xlim_percentiles=xlim_percentiles,
        xlim_symmetric_percentiles=xlim_symmetric_percentiles,
    )


if __name__ == "__main__":
    analyze_trading_day_buyhold_percentiles()
