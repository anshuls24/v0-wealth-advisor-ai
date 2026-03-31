"""
Rolling buy-and-hold returns on SPX daily closes (spx_50yr.csv).

For each trading day, buy at Close, hold until the last trading day on or before
start + N calendar months. Repeat for 1, 3, and 6 months.

Histograms, worst-to-best ranking, and tail stats: empirical quantiles on
returns sorted worst-to-best (left: 1st / 5th / 10th; right: 90th / 95th / 99th).
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

DEFAULT_CSV = Path(__file__).resolve().parent / "spx_50yr.csv"


def load_spx(csv_path: str | Path | None = None) -> pd.DataFrame:
    path = Path(csv_path) if csv_path is not None else DEFAULT_CSV
    df = pd.read_csv(path)
    df["Date"] = pd.to_datetime(df["Date"], format="%m/%d/%Y")
    df = df.sort_values("Date").reset_index(drop=True)
    return df


def rolling_calendar_month_returns(
    df: pd.DataFrame,
    n_months: int,
    price_col: str = "Close",
) -> pd.DataFrame:
    """
    For each row (start date), total return from that day's close to the close on
    the last trading day with Date in (start, start + n_months].
    """
    s = df.set_index("Date")[price_col].sort_index()
    idx = s.index
    rows: list[dict] = []

    for i, start_d in enumerate(idx):
        start_p = s.iloc[i]
        end_target = start_d + pd.DateOffset(months=n_months)
        after = s[(s.index > start_d) & (s.index <= end_target)]
        if after.empty:
            continue
        end_d = after.index[-1]
        end_p = after.iloc[-1]
        r = end_p / start_p - 1.0
        rows.append(
            {
                "start_date": start_d,
                "end_date": end_d,
                "start_price": float(start_p),
                "end_price": float(end_p),
                "return": float(r),
            }
        )

    return pd.DataFrame(rows)


def _fmt_return_label(x: float) -> str:
    return f"{x:.4f}\n({x * 100:+.2f}%)"


def moment_summary(x: np.ndarray) -> dict[str, float]:
    """
    Mean, median, skew, excess kurtosis (pandas ``kurt()`` = Fisher, excess).
    """
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


def tail_loss_percentiles(returns: np.ndarray) -> dict[str, float]:
    """
    Left- and right-tail empirical quantiles on returns sorted worst → best.

    Left (~loss tail): 10th / 5th / 1st percentile returns plus loss magnitudes.
    Right (~gain tail): 90th / 95th / 99th percentile returns plus gain magnitudes
    when positive.

    ``np.percentile`` is order-equivalent to using the worst-to-best ranking.
    """
    r = np.asarray(returns, dtype=float)
    r = r[np.isfinite(r)]
    if r.size == 0:
        return {}

    r_worst_to_best = np.sort(r)
    p1, p5, p10 = np.percentile(r_worst_to_best, [1, 5, 10])
    p90, p95, p99 = np.percentile(r_worst_to_best, [90, 95, 99])

    return {
        "return_p1": float(p1),
        "return_p5": float(p5),
        "return_p10": float(p10),
        "loss_magnitude_p99": float(max(0.0, -p1)),
        "loss_magnitude_p95": float(max(0.0, -p5)),
        "loss_magnitude_p90": float(max(0.0, -p10)),
        "return_p90": float(p90),
        "return_p95": float(p95),
        "return_p99": float(p99),
        "gain_magnitude_p90": float(max(0.0, p90)),
        "gain_magnitude_p95": float(max(0.0, p95)),
        "gain_magnitude_p99": float(max(0.0, p99)),
    }


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


def analyze_spx_rolling(
    csv_path: str | Path | None = None,
    horizons_months: tuple[int, ...] = (1, 3, 6),
    show_plots: bool = True,
    savefig_path: str | Path | None = None,
) -> dict[int, dict]:
    """
    Run rolling buy-hold analysis for each horizon; plot histograms; print ranks
    and tail percentiles.

    Returns
    -------
    dict[int, dict]
        Per horizon: ``returns_df``, ``tail_metrics``, ``returns_array``,
        ``full_moments`` (mean, median, skew, kurtosis on **all** rolling returns).
    """
    df = load_spx(csv_path)
    results: dict[int, dict] = {}

    n_plots = len(horizons_months)
    fig, axes = plt.subplots(n_plots, 1, figsize=(10, 4.0 * n_plots), squeeze=False)
    axes_flat = axes.ravel()

    for ax, hm in zip(axes_flat, horizons_months):
        rets_df = rolling_calendar_month_returns(df, hm)
        r = rets_df["return"].to_numpy()
        sorted_idx = np.argsort(r)
        rets_df = rets_df.iloc[sorted_idx].reset_index(drop=True)
        rets_df.insert(0, "worst_to_best_rank", np.arange(1, len(rets_df) + 1))

        tail = tail_loss_percentiles(r)
        full_m = moment_summary(r)

        results[hm] = {
            "returns_df": rets_df,
            "tail_metrics": tail,
            "returns_array": r,
            "full_moments": full_m,
        }

        ax.hist(r, bins=60, color="steelblue", edgecolor="white", alpha=0.85)
        ax.axvline(0, color="black", linewidth=0.8, linestyle="--", zorder=3)
        ymax = ax.get_ylim()[1]

        # Left tail: stagger label heights so text does not overlap
        left_specs = (
            (tail["return_p10"], "darkorange", 0.88, "p10"),
            (tail["return_p5"], "red", 0.78, "p5"),
            (tail["return_p1"], "darkred", 0.68, "p1"),
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

        mtxt = (
            f"mean={full_m['mean'] * 100:.4f}%  median={full_m['median'] * 100:.4f}%  "
            f"skew={full_m['skew']:.4f}  kurtosis(excess)={full_m['kurtosis']:.4f}"
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

        ax.set_title(f"{hm}-month rolling buy-hold total return (n={len(r)})")
        ax.set_xlabel("Total return")
        ax.set_ylabel("Count")
        ax.legend(
            handles=[
                plt.Line2D([0], [0], color="darkorange", lw=2, label="Left tail p10/p5/p1"),
                plt.Line2D([0], [0], color="darkgreen", lw=2, label="Right tail p90/p95/p99"),
            ],
            loc="upper left",
            fontsize=8,
        )

        def _print_moments(title: str, d: dict[str, float]) -> None:
            print(f"  {title} (n={int(d['n'])}):")
            print(
                f"    mean={d['mean']:.6f}  median={d['median']:.6f}  "
                f"skew={d['skew']:.6f}  kurtosis(excess)={d['kurtosis']:.6f}"
            )

        print(f"\n=== {hm}-month horizon ===")
        print(f"Observations: {len(r)}")
        _print_moments("Entire histogram (all rolling returns)", full_m)

        print("Left-tail return quantiles (worst→best; ~99% / 95% / 90% loss levels):")
        print(
            f"  p1:  {_fmt_return_label(tail['return_p1']).replace(chr(10), ' ')}  "
            f"loss_mag: {tail['loss_magnitude_p99']:.4f}"
        )
        print(
            f"  p5:  {_fmt_return_label(tail['return_p5']).replace(chr(10), ' ')}  "
            f"loss_mag: {tail['loss_magnitude_p95']:.4f}"
        )
        print(
            f"  p10: {_fmt_return_label(tail['return_p10']).replace(chr(10), ' ')}  "
            f"loss_mag: {tail['loss_magnitude_p90']:.4f}"
        )

        print("Right-tail return quantiles (~90% / 95% / 99% gain levels):")
        print(
            f"  p90: {_fmt_return_label(tail['return_p90']).replace(chr(10), ' ')}  "
            f"gain_mag: {tail['gain_magnitude_p90']:.4f}"
        )
        print(
            f"  p95: {_fmt_return_label(tail['return_p95']).replace(chr(10), ' ')}  "
            f"gain_mag: {tail['gain_magnitude_p95']:.4f}"
        )
        print(
            f"  p99: {_fmt_return_label(tail['return_p99']).replace(chr(10), ' ')}  "
            f"gain_mag: {tail['gain_magnitude_p99']:.4f}"
        )

        print("Best / worst single-period return:")
        print(f"  Worst: {r.min():.4f}  Best: {r.max():.4f}")

    plt.tight_layout()
    if savefig_path is not None:
        plt.savefig(savefig_path, dpi=150, bbox_inches="tight")
    if show_plots:
        plt.show()
    else:
        plt.close(fig)

    return results


if __name__ == "__main__":
    analyze_spx_rolling()
