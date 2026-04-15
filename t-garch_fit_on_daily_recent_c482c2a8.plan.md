---
name: t-GARCH fit on daily_recent
overview: Use `daily_recent` from [partb.py](partb.py) (last ~10 years of daily closes) to compute log returns, fit Student-t GARCH with the `arch` package (default GARCH(1,1), with optional order selection vs GARCH(2,1)/(1,2)), and return fitted parameters plus the fit object for later simulation (PARTB_1/2).
todos:
  - id: returns
    content: Add log-return helper from daily_recent[Close] sorted by Date
    status: in_progress
  - id: arch-fit
    content: Add fit_t_garch_on_daily_recent using arch GARCH(1,1)-t; return params + cond vol + fit object
    status: pending
  - id: garch-selection
    content: Optional helper to fit small grid (1,1), (2,1), (1,2); compare AIC/BIC; Ljung-Box on squared standardized residuals; document chosen order
    status: pending
  - id: deps-doc
    content: Document pip install arch; optional requirements snippet for venv
    status: pending
isProject: false
---

# Fit t-GARCH on `daily_recent` for Part B

## Context

- [partb.py](partb.py) already defines `**daily_recent**`: all trading days from `daily_start = first_date + 40 years` through the end of `[spx_50yr.csv](spx_50yr.csv)` (~2.5k rows), with `**Close**` and `**Date**`.
- [part b solution.txt](part%20b%20solution.txt) (lines 24–27) and PARTB_2 use **log returns** at the monthly level (`R_m^{(M)} = \log(M_{m+1}/M_m)`). For comparability, **daily returns fed to GARCH should be log returns**:  
`r_t = log(C_t / C_{t-1})` on `**daily_recent["Close"]`**, after sorting by `Date`.

## Model choice

- **GARCH(1,1)** with **Student-t** innovations (“t-GARCH”): default baseline for daily equity index returns (volatility clustering + fat tails with few parameters).
- Python: `**arch`** library (`[arch.univariate.arch_model](https://arch.readthedocs.io/)`) — `mean='Zero'` or `mean='Constant'`, `vol='Garch'`, `p=1`, `q=1`, `dist='t'`.
- Optional: scale returns by **100** (percent units) during fit for numerical stability; store that convention so simulation uses the same scaling.

## GARCH order selection (is (1,1) enough?)

**Default:** proceed with **GARCH(1,1)-t** unless evidence favors extra lags.

**When higher `p` or `q` might matter:** standardized residuals still show **ARCH** in squares (volatility dynamics not fully captured); AIC/BIC favor a larger model after penalizing parameters; rarely needed for a simple SPX daily exercise if **t** innovations are already used.

**How to decide (implement or report in write-up):**

1. **Small grid** on the same `daily_recent` log-return sample: at least **(1,1)**, plus **(2,1)** and **(1,2)**; optionally **(2,2)** if time permits (avoid huge grids).
2. **Information criteria:** compare **AIC** and **BIC** (same likelihood scale). **BIC** penalizes complexity more (parsimony); **AIC** leans toward fit.
3. **Nested models:** **likelihood ratio tests** are possible for nested pairs; note **boundary** issues (e.g. extra ARCH coefficient at zero).
4. **Diagnostics** on standardized residuals `z_t = ε̂_t / σ̂_t`: **Ljung–Box** (or similar) on **z_t²** should not show strong serial correlation if the variance spec is adequate; optional **ARCH-LM** on residuals.
5. **Interpretation:** large parameter instability across rolling windows suggests **structural change** rather than fixing with very high `p,q`.

**Deliverable:** In code or notebook, either (a) **select** the winning `(p,q)` by BIC (or AIC) and fit that model for simulation, or (b) **fit (1,1) only** but **tabulate** AIC/BIC for (1,1) vs (2,1)/(1,2) and state that extra lags were **not** justified — sufficient for most coursework.

## Implementation shape (new code in `partb.py` or `partb_garch.py`)

1. `**compute_log_returns(daily_recent: pd.DataFrame, price_col="Close") -> pd.Series`**
  - Sort by `Date`, `np.log(close / close.shift(1))`, drop NaN.
2. `**fit_t_garch_on_daily_recent(daily_recent, p=1, q=1, ...)`**
  - Build log-return series as above.  
  - Instantiate and `fit()` the model (optionally `update_freq=0`, `disp="off"`).  
  - Optional companion: `**compare_garch_orders(daily_recent)`** — small grid (1,1), (2,1), (1,2); report log-likelihood, AIC, BIC; run **Ljung–Box** on squared standardized residuals for the chosen fit (see *GARCH order selection* above).
  - Return a small **struct** (e.g. dataclass or dict) with:
    - **Parameters**: e.g. `mu` (if constant mean), `omega`, `alpha_1`, `beta_1`, `nu` (t df), plus any `arch` names you standardize.
    - `**conditional_volatility`** (in-sample σ̃ series aligned to return index) — needed later for PARTB_2 weights `w_{m,j} ∝ σ̃`.
    - **Reference to fitted model** (or `fit` result) for `**simulate()`** in the next step.
  - Document that **simulation of the missing 40 years** will consume these params (not in this micro-step if you only want “fitted params” first).
3. **Dependency**
  - Add `**arch`** to the project venv / document `pip install arch` (and note `numpy`/`pandas` versions `arch` supports).

## Notebook / API

- In [Part(b).ipynb](Part(b).ipynb):  
`_, daily_recent, _ = build_part_b_split()`  
then `fit_t_garch_on_daily_recent(daily_recent)`.

## Pitfalls to mention in docstrings

- **Alignment**: returns index must match trading days only (no calendar fill).
- **Mean spec**: `Constant` vs `Zero` slightly changes interpretation; pick one and keep it for simulation.
- **PARTB_2** expects **simulated daily log returns and volatilities** from this model; ensuring the **same return definition (log)** end-to-end avoids inconsistent monthly aggregation.

```mermaid
flowchart LR
  daily_recent[daily_recent Close]
  logret[log returns]
  tgarch[t-GARCH1-1 t fit]
  params[fitted params and vol series]
  daily_recent --> logret --> tgarch --> params
```



