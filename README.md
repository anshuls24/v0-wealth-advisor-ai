# SPX case study: Parts (a)–(c)

This repository implements a mixed-frequency equity case study on **S&P 500** history (`spx_50yr.csv`): **Part (a)** tail modeling on GARCH residuals, **Part (b)** 40 years of month-end data plus 10 years of dailies with **log-sum bridging** to synthetic daily paths, and **Part (c)** the same split but early data are **monthly averages**, with **mean-on-levels** bridging instead.

The notebooks **`Part(a).ipynb`**, **`Part(b).ipynb`**, and **`Part(c).ipynb`** orchestrate analysis. The heaviest methodology for (b) and (c) lives in **`partb_sim.py`** (PARTB_2) and **`partc_sim.py`** (PARTC_2).

---

## Data and shared split

- **Source:** `spx_50yr.csv` — daily OHLCV, `Date` parsed as in `partb.load_spx_daily`.
- **Calendar cut:** `first_date` in sample → `daily_start = first_date + 40 years` (`MONTHLY_HISTORY_YEARS = 40`).
- **Part (b) early segment:** one row per calendar month at the **last trading day**, **month-end Close** (`partb.build_part_b_split`).
- **Part (c) early segment:** same month keys and dates, but OHLC are **monthly means** (volume summed) (`partc.build_part_c_split`).
- **Last 10 years:** full daily history, used to **fit t-GARCH** and to define **true trading calendars** inside each month for simulation.

---

## What each notebook uses

### `Part(a).ipynb`

- **`partb`:** `load_spx_daily`, `compute_log_returns`, `fit_t_garch_on_daily` — fit **Student-t GARCH** on daily log returns; standardized residuals drive EVT.
- **`parta_evt`:** POT / mean-excess, GPD fitting, loss transforms, hybrid quantiles, `evt_summary_pooled_simple_returns` where pooled monthly simple returns are analyzed.
- **`spx_rolling_buyhold`:** rolling calendar-month simple returns, tail percentiles, `analyze_spx_rolling`.
- **`spx_drawdown_severity`:** rolling-peak fractional drawdowns on observed daily `Close` (`analyze_spx_drawdown_percentiles`).

Part (a) does **not** call `partb_sim` / `partc_sim`; it establishes the **GARCH + EVT-on-residuals** recipe and baseline tail metrics on fully observed daily data.

### `Part(b).ipynb`

- **`partb`:** `build_part_b_dataset`, `build_part_b_split`, `split_summary`, `load_spx_daily`, `load_monthly_early_csv`, GARCH fit on the daily tail, exports like `TGarchFitResult`.
- **`partb_sim`:** `partb2_month_table`, `bridge_interval_from_monthly_early`, `simulate_partb2_path`, `partb2_monte_carlo`, pooled calendar-month return routines, plotting helpers (`plot_partb2_month_mc_paths`, `plot_partb_year_span_validation`, `simulate_partb2_year_span_batch`, etc.).
- **`parta_evt`:** EVT on **pooled** simulated simple returns where the notebook compares tail behavior to Part (a).
- **`spx_drawdown_severity`:** `analyze_partb2_simulated_drawdown_percentiles` — same drawdown machinery as on real data, applied to bridged paths.

### `Part(c).ipynb`

- **`partc`:** `build_part_c_dataset`, `build_part_c_split`, `split_summary`, `load_monthly_avg_csv`.
- **`partb`:** `load_spx_daily`, t-GARCH fit on `daily_recent` (same calibration idea as Part (b)).
- **`partc_sim`:** `partc2_month_table`, `bridge_interval_from_monthly_avg_early`, `simulate_partc2_path`, `partc2_monte_carlo`, `simulate_partc2_month_paths`, plotting (`plot_partc2_month_mc_paths`, year-span validation helpers mirroring Part (b)).
- **`parta_evt`:** pooled EVT on Part (c) simulated returns where applicable.
- **`spx_drawdown_severity`:** `analyze_partc2_simulated_drawdown_percentiles`.

Optional **supervised imputation** of month-end from monthly averages (using only the daily tail) is in **`ml_c.py`** if referenced from the notebook; it does not replace the simulation bridge in `partc_sim`.

---

## `partb_sim.py` — PARTB_2 (log bridge to month-end)

### Role

For the **month-end-only** early sample, the code **constructs plausible daily paths** between consecutive observed month-end closes using a **t-GARCH** fit from the last 10 years of dailies. Drawdowns, pooled returns, and tail statistics are computed **after** full paths exist.

### Month table (`partb2_month_table`)

- One row per **interval** between consecutive rows of `monthly_early`.
- Each row has `date_start`, `date_end`, `close_start`, `close_end`, trading-day count `n_days`, and (from `daily_full`) the first trading day of the target month (`date_first_trading`, `close_first_trading`) for optional anchoring.
- **Chaining:** for month \(k>0\), `close_start` equals the previous row’s `close_end` (continuous month-end levels).

### GARCH simulation (`simulate_tgarch_segment_log_units`)

- Uses `TGarchFitResult` from `partb` (including **`scale`**: `arch` outputs are divided by `scale` to get **log-return units**).
- **GARCH(1,1):** manual NumPy recursion + `np.random.Generator` for reproducibility.
- **Other orders:** delegates to `arch` simulation (parametric innovations only).
- **Innovations:** `parametric` — iid standardized Student-t with df `nu` from the fit. `bootstrap` — resample in-sample **standardized residuals** (only implemented for GARCH(1,1)).

### Log-sum bridge (`bridge_month_returns`)

For one month:

1. Draw `n_days` **tentative** log returns `r_tilde` and conditional volatilities `sigma_tilde` from the GARCH segment.
2. Observed month-end log return is \(R_{\text{month}} = \log(\text{close_end}/\text{close_start})\).
3. **Gap:** \(\delta = R_{\text{month}} - \sum \tilde r_t\).
4. **Allocate** \(\delta\) across days with weights \(w_t \propto \sigma_tilde_t\) (uniform if invalid), yielding **bridged** returns `r_star` with \(\sum r^\star_t = R_{\text{month}}\).
5. Rebuild prices: `prices_from_log_returns(close_start, r_star)`.

So the path **hits both month-end anchors**; interior dynamics are GARCH-shaped but **sum-corrected** to match data.

### Path and Monte Carlo (`simulate_partb2_path`, `partb2_monte_carlo`)

- Loops over the month table; each segment starts at the **previous segment’s terminal price** (after the first month, consistent with month-end chaining).
- Optional **`use_first_trading_day_close_anchor`:** first day’s return is adjusted so the level after the first trading day matches `daily_full` (default **False** — only two month-end anchors, matching “low-frequency panel” assumptions).

`partb2_monte_carlo` repeats for `n_paths` independent RNG streams (`numpy.random.SeedSequence`), collects **max drawdown** (and horizon windows via `partb2_path_drawdown_horizons`), and summarizes percentiles.

### Other exports

- **`bridge_interval_from_monthly_early`:** metadata for a single target month (for diagnostics / plots).
- **Pooled calendar-month simple returns** across paths share the same seeding convention as `partb2_monte_carlo` for reproducibility.
- Plot helpers visualize multi-path fan charts and year-span validation batches.

---

## `partc_sim.py` — PARTC_2 (mean-matched intramonth levels)

### Role

Early data are **monthly average closes**, not month-ends. The code still simulates **GARCH daily log returns** on each month’s **true trading calendar**, but instead of forcing the **sum of log returns** to match a month-end move, it **rescales intramonth price levels** so their **arithmetic mean** equals the observed monthly average **`avg_end`**.

### Month table (`partc2_month_table`)

- Analogous to Part (b): intervals between consecutive low-frequency rows, but anchors are **`avg_start`** / **`avg_end`** (means), with `R_month_log_from_avgs = log(avg_end/avg_start)` for reference only — the bridge does **not** impose this sum directly on GARCH draws.

### Mean scaling (`_mean_scale_segment`)

For one month with \(n\) trading days:

1. Fix **pre-month level** \(P_0\) (previous month’s simulated terminal close, or the first row’s `avg_start`).
2. Draw GARCH log returns \(\tilde r_{1:n}\), build raw prices \(P_j\) from \(P_0\).
3. Let \(m = \text{mean}(P_1,\ldots,P_n)\). Target monthly average \(A = \texttt{avg_end}\).
4. Scale factor \(c = A/m\). Set \(P^\star_0 = P_0\), \(P^\star_i = c \cdot P_i\) for \(i \ge 1\). Then \(\text{mean}(P^\star_{1:n}) = A\).
5. Implied bridged log returns: \(r^\star_j = \log(P^\star_j/P^\star_{j-1})\). GARCH **ratios** are preserved from day 2 onward; day 1 absorbs the level rescaling.

Paths **chain** across months: each segment’s \(P_0\) is the previous segment’s last close; the implementation checks continuity at joins.

### Path and Monte Carlo (`simulate_partc2_path`, `partc2_monte_carlo`)

- Same outer loop structure as Part (b), swapping **`_mean_scale_segment`** for **`bridge_month_returns`**.
- **`simulate_partc2_month_paths`:** many paths for a **single** target calendar month (fan charts), anchored by `bridge_interval_from_monthly_avg_early`.

### Shared code with `partb_sim`

- **`simulate_tgarch_segment_log_units`**, **`prices_from_log_returns`**, **`max_drawdown_from_prices`**, **`partb2_path_drawdown_horizons`**, innovation typing — imported from `partb_sim` so drawdown horizon logic stays aligned.

---

## Dependency sketch

| Package   | Typical use                          |
|----------|---------------------------------------|
| `pandas` | Panels, calendars                     |
| `numpy`  | Simulation, bridges                   |
| `matplotlib` | Plots in notebooks              |
| `arch`   | t-GARCH fit (`partb`)                 |
| `statsmodels` / `scipy` | `ml_c`, some EVT/stats |

Install `arch` as needed (`pip install arch`).

---

## Core Python modules (quick index)

| Module | Purpose |
|--------|---------|
| `partb.py` | Data construction Part (b), GARCH fit, shared loaders/constants |
| `partc.py` | Data construction Part (c) (monthly averages + daily tail) |
| `parta_evt.py` | EVT / GPD helpers for residuals and pooled returns |
| `partb_sim.py` | PARTB_2: log bridge, Monte Carlo paths, drawdown sampling |
| `partc_sim.py` | PARTC_2: mean bridge, Monte Carlo paths |
| `spx_drawdown_severity.py` | Rolling-peak drawdowns; real vs Part (b)/(c) simulated |
| `spx_rolling_buyhold.py` | Calendar-month rolling simple returns on observed data |
| `spx_trading_day_buyhold.py` | Trading-day-window simple returns (Part (b) workflows) |
| `ml_c.py` | Optional OLS / CV pipeline for \(r_m = \log(M_m/A_m)\) on daily tail |

---

## Reading order for the simulation logic

1. Module docstrings at the top of **`partb_sim.py`** and **`partc_sim.py`**.
2. **`partb2_month_table`** vs **`partc2_month_table`** (what is observed each month).
3. **`bridge_month_returns`** (Part b) vs **`_mean_scale_segment`** (Part c).
4. **`simulate_partb2_path`** / **`simulate_partc2_path`** (full early-sample paths).
5. **`partb2_monte_carlo`** / **`partc2_monte_carlo`** (distribution of drawdowns).

This matches the execution flow used in **`Part(b).ipynb`** and **`Part(c).ipynb`**.
