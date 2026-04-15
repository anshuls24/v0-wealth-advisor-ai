"""
Peaks-over-threshold (POT) and GPD helpers for **EVT**.

- **Part (a):** conditional EVT — apply to GARCH **standardized residuals** (or a
  loss transform), not raw returns.
- **Parts (b)/(c):** :func:`evt_summary_pooled_simple_returns` for **pooled simple
  returns** (e.g. bootstrap-simulated calendar-month buy-hold) with ``Y = -R``.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import stats


def loss_from_std_residual(z: pd.Series | np.ndarray) -> pd.Series | np.ndarray:
    """
    Loss-oriented innovation: ``Y = -z`` so large **positive** Y corresponds to
    large negative standardized residual (bad return day relative to volatility).

    Returns a :class:`pandas.Series` when ``z`` is a Series (same index); otherwise
    a NumPy array.
    """
    arr = -np.asarray(z, dtype=float)
    if isinstance(z, pd.Series):
        return pd.Series(arr, index=z.index, name="loss_from_z")
    return arr


def mean_excess_curve(y: np.ndarray, u_grid: np.ndarray, *, min_exceedances: int = 10) -> pd.DataFrame:
    """
    Sample mean excess e(u) = mean(Y - u | Y > u) for each threshold u.

    Parameters
    ----------
    y
        Nonnegative or arbitrary positive tail; typically ``loss_from_std_residual(z)``.
    u_grid
        Ascending candidate thresholds (same units as ``y``).
    """
    y = np.asarray(y, dtype=float)
    rows: list[dict[str, float | int]] = []
    for u in np.asarray(u_grid, dtype=float):
        above = y[y > u]
        if len(above) < min_exceedances:
            continue
        exc = above - u
        rows.append({"u": float(u), "n_exc": int(len(above)), "mean_excess": float(exc.mean())})
    return pd.DataFrame(rows)


@dataclass
class GPDFitResult:
    xi: float
    sigma: float
    n_exceedances: int
    threshold: float


def fit_gpd_exceedances(
    y: np.ndarray,
    u: float,
    *,
    min_exceedances: int = 30,
) -> GPDFitResult:
    """
    MLE of GPD on exceedances ``W = Y - u`` for observations with ``Y > u``.

    Uses ``scipy.stats.genpareto`` with ``floc=0`` (standard POT parameterization).
    """
    y = np.asarray(y, dtype=float)
    w = y[y > u] - u
    w = w[w > 0]
    if len(w) < min_exceedances:
        raise ValueError(
            f"need at least {min_exceedances} positive exceedances; got {len(w)} for u={u}"
        )
    xi, _loc, sigma = stats.genpareto.fit(w, floc=0.0)
    return GPDFitResult(xi=float(xi), sigma=float(sigma), n_exceedances=len(w), threshold=float(u))


def gpd_stability(
    y: np.ndarray,
    u_grid: np.ndarray,
    *,
    min_exceedances: int = 40,
) -> pd.DataFrame:
    """MLE (xi, sigma) for each threshold u (parameter stability / threshold choice)."""
    y = np.asarray(y, dtype=float)
    records: list[dict[str, float | int]] = []
    for u in np.asarray(u_grid, dtype=float):
        w = y[y > u] - u
        w = w[w > 0]
        if len(w) < min_exceedances:
            records.append({"u": float(u), "xi": np.nan, "sigma": np.nan, "n_exc": int(len(w))})
            continue
        try:
            xi, _loc, sigma = stats.genpareto.fit(w, floc=0.0)
            records.append(
                {
                    "u": float(u),
                    "xi": float(xi),
                    "sigma": float(sigma),
                    "n_exc": int(len(w)),
                }
            )
        except (RuntimeError, ValueError):
            records.append({"u": float(u), "xi": np.nan, "sigma": np.nan, "n_exc": int(len(w))})
    return pd.DataFrame(records)


def gpd_qq_points(exceedances: np.ndarray, xi: float, sigma: float) -> tuple[np.ndarray, np.ndarray]:
    """
    Order statistics of positive exceedances W vs GPD theoretical quantiles
    (uniform plotting positions).
    """
    w = np.sort(np.asarray(exceedances, dtype=float))
    w = w[w > 0]
    n = len(w)
    if n == 0:
        return w, w
    probs = (np.arange(1, n + 1) - 0.5) / n
    theo = stats.genpareto.ppf(probs, xi, loc=0, scale=sigma)
    return w, theo


def hybrid_upper_quantile_y(
    y: np.ndarray,
    u: float,
    xi: float,
    sigma: float,
    p: float,
) -> float:
    """
    Semiparametric quantile: empirical cdf below ``u``, GPD cdf for the tail.

    Returns ``q`` such that **P(Y <= q) ≈ p** (mixing empirical below threshold
    and fitted GPD above ``u``).

    Parameters
    ----------
    p
        Cdf level in (0, 1), e.g. ``0.99`` for the 99th percentile of ``Y``.
    """
    if not 0 < p < 1:
        raise ValueError("p must be in (0, 1)")
    y = np.asarray(y, dtype=float)
    fu = float(np.mean(y <= u))
    if p <= fu:
        return float(np.quantile(y, p))
    g_target = (p - fu) / (1.0 - fu + 1e-15)
    g_target = float(np.clip(g_target, 1e-9, 1.0 - 1e-9))
    w = float(stats.genpareto.ppf(g_target, xi, loc=0, scale=sigma))
    return float(u + w)


def z_left_quantile_from_loss_upper(
    y_loss: np.ndarray,
    u: float,
    xi: float,
    sigma: float,
    alpha: float,
) -> float:
    """
    If ``Y = -z`` (loss from standardized residual ``z``), the left ``alpha``
    quantile of ``z`` is ``z_alpha = -Q_Y(1 - alpha)`` where ``Q_Y`` is the
    upper-tail quantile function of ``Y`` under the hybrid model.
    """
    if not 0 < alpha < 1:
        raise ValueError("alpha must be in (0, 1)")
    qy = hybrid_upper_quantile_y(y_loss, u, xi, sigma, 1.0 - alpha)
    return float(-qy)


def evt_summary_pooled_simple_returns(
    r_simple: np.ndarray,
    *,
    horizon_m: int | None = None,
    u_quantile: float = 0.92,
    min_exceedances: int = 80,
) -> dict[str, float | int]:
    """
    Empirical tail percentiles plus POT/GPD hybrid quantiles for **simple** returns.

    Uses **Y = −R** (loss orientation). Threshold **u** at ``u_quantile`` of **Y**;
    fits GPD to exceedances; reports hybrid **0.99** and **0.995** quantiles of **Y**.

    Parameters
    ----------
    r_simple
        Pooled simple returns (e.g. ``cal_bh_bootstrap[h][\"returns_array\"]``).
    horizon_m
        Optional calendar-month horizon label (stored in output dict).
    u_quantile
        Quantile of **Y** for POT threshold (default **0.92**, same spirit as Part (a)).
    min_exceedances
        Minimum positive exceedances required for GPD MLE.

    Returns
    -------
    dict
        Keys aligned with Part (a) ``horizon_evt`` table: ``horizon_m``, ``n``,
        ``empirical_return_p1``, ``empirical_loss_mag_1pct_tail``, ``GPD_u``,
        ``GPD_xi``, ``n_exceed``, ``hybrid_q99_loss_Y``, ``hybrid_q99.5_loss_Y``.

    Notes
    -----
    Pooled simulation returns are **not** iid (overlap within paths, shared seed
    structure); treat GPD output as **descriptive** Monte Carlo tail smoothing.
    """
    from spx_rolling_buyhold import tail_loss_percentiles

    r = np.asarray(r_simple, dtype=float)
    r = r[np.isfinite(r)]
    if len(r) < max(min_exceedances + 20, 100):
        raise ValueError(
            f"need enough finite simple returns for EVT; got {len(r)} "
            f"(min_exceedances={min_exceedances})"
        )
    Y = -r
    emp = tail_loss_percentiles(r)
    u_star = float(np.quantile(Y, u_quantile))
    fit = fit_gpd_exceedances(Y, u_star, min_exceedances=min_exceedances)
    q99 = hybrid_upper_quantile_y(Y, u_star, fit.xi, fit.sigma, 0.99)
    q995 = hybrid_upper_quantile_y(Y, u_star, fit.xi, fit.sigma, 0.995)
    out: dict[str, float | int] = {
        "n": int(len(r)),
        "empirical_return_p1": float(emp["return_p1"]),
        "empirical_loss_mag_1pct_tail": float(emp["loss_magnitude_p99"]),
        "GPD_u": fit.threshold,
        "GPD_xi": fit.xi,
        "n_exceed": fit.n_exceedances,
        "hybrid_q99_loss_Y": float(q99),
        "hybrid_q99.5_loss_Y": float(q995),
    }
    if horizon_m is not None:
        out = {"horizon_m": int(horizon_m), **out}
    return out


def conditional_var_one_day_log_return(
    mu_forecast: float,
    sigma_forecast: float,
    y_loss: np.ndarray,
    u: float,
    xi: float,
    sigma_gpd: float,
    alpha: float,
) -> float:
    """
    One-day **VaR** as a **positive loss** number for log return r = mu + sigma*z:

    ``VaR_alpha = -(mu_forecast + sigma_forecast * z_alpha)`` with ``z_alpha``
    the left-tail quantile of standardized residuals from the POT hybrid on ``Y=-z``.
    """
    z_a = z_left_quantile_from_loss_upper(y_loss, u, xi, sigma_gpd, alpha)
    return float(-(mu_forecast + sigma_forecast * z_a))
