# Code walkthrough — SPX Parts (a)–(c)

This document is a **guided tour** of the Python you built: what each layer does, how execution flows, and where to look when you extend or debug. For compact definitions of the Part (b)/(c) bridges, see **`README.md`**.

---

## 1. Big picture

```text
spx_50yr.csv
    │
    ├─► partb.load_spx_daily
    │
    ├─► Part (a)  ──► GARCH (partb) + EVT on residuals (parta_evt)
    │                 + baseline tails on full daily Close (spx_* helpers)
    │
    ├─► Part (b)  ──► Mixed panel: month-end early + daily tail (partb)
    │                 + bridged daily paths (partb_sim)
    │                 + drawdown / return tails on simulated paths
    │
    └─► Part (c)  ──► Mixed panel: monthly *average* early + daily tail (partc)
                      + mean-matched paths (partc_sim)
                      + optional OLS imputation from daily tail only (ml_c)
```

**Notebooks** (`Part(a).ipynb`, `Part(b).ipynb`, `Part(c).ipynb`) are the story: they import these modules, run fits, call simulation, and plot. **Reusable logic** lives in `.py` files so the same functions are importable and testable.

---

## 2. Shared data layer — `partb.py`

Everything starts from the same daily CSV.

| Step | Function / type | What it does |
|------|------------------|--------------|
| Load | `load_spx_daily` | Read `spx_50yr.csv`, parse `Date`, numeric OHLCV, sort by date. |
| Returns | `compute_log_returns` | Log returns from `Close` (used for GARCH). |
| Part (b) panel | `build_part_b_dataset`, `build_part_b_split` | **40y** month-end rows + **10y** daily rows from `daily_start`; adds `granularity`, `year_month`. |
| Sanity | `split_summary` | Counts and date ranges for notebooks. |
| GARCH | `fit_t_garch_on_daily`, `fit_t_garch_on_daily_recent` | Student-t GARCH on log returns; **recent** uses only the daily tail (case study). |
| Model handle | `TGarchFitResult` | Wraps `arch` fit, **`scale`**, params, standardized residuals, conditional vol — consumed by **`partb_sim`** / **`partc_sim`**. |
| Model choice | `compare_garch_orders` | Optional order comparison on the same sample. |
| Cached early panel | `load_monthly_early_csv` | Load saved month-end early segment when you do not rebuild from CSV. |

**Constants:** `MONTHLY_HISTORY_YEARS = 40`, `DAILY_TAIL_YEARS = 10` define the split.

---

## 3. Part (c) panel only — `partc.py`

Same split date as Part (b), different early observation:

| Function | Role |
|----------|------|
| `_monthly_average_ohlcv_from_daily` | Calendar-month **means** of O/H/L/C, **sum** of volume; row date = last trading day in month. |
| `build_part_c_dataset` | Concatenate early `monthly_avg` rows + `daily` tail; `granularity` labels. |
| `build_part_c_split` | Returns `(monthly_avg_early, daily_recent, combined)`. |
| `split_summary` | Same idea as Part (b). |
| `load_monthly_avg_csv` | Load persisted early average panel. |

Part (c) **imports `load_spx_daily` and constants from `partb`** so the 40/10 cut is identical to Part (b).

---

## 4. Part (a) — tails on residuals and on prices — `parta_evt.py` + helpers

**Principle (in module docstring):** Part (a) applies **POT / GPD to GARCH standardized residuals** (after `loss_from_std_residual` or similar), not to raw returns.

| Function | Role |
|----------|------|
| `loss_from_std_residual` | Map \(z \mapsto -z\) so the “loss” tail is in the upper tail of \(Y\). |
| `mean_excess_curve` | Mean excess \(e(u)\) over a grid of thresholds (threshold diagnostics). |
| `fit_gpd_exceedances`, `gpd_stability` | GPD fit on exceedances; stability over \(u\). |
| `hybrid_upper_quantile_y`, related helpers | Bridge empirical + GPD tail (as used in your notebook). |
| `evt_summary_pooled_simple_returns` | **Parts (b)/(c):** EVT-style summary when you pool **simple returns** (e.g. from simulated calendar-month buy-hold), with \(Y=-R\) for loss orientation. |

**Notebooks also use:**

- **`spx_rolling_buyhold`** — calendar-month rolling **simple** returns on observed data; tail percentiles; `analyze_spx_rolling`.
- **`spx_drawdown_severity`** — rolling **peak** fractional drawdowns on daily `Close` for observed history (`analyze_spx_drawdown_percentiles`).

These give **baselines** before you introduce missing daily data in (b)/(c).

---

## 5. Part (b) simulation — `partb_sim.py` (PARTB_2)

**Problem:** Early sample has only **month-end closes**. You want **daily** paths inside each month for drawdowns / return pooling, consistent with a **t-GARCH** estimated on the last 10 years.

**Walk through the call chain:**

1. **`partb2_month_table(monthly_early, daily_full)`**  
   Builds one row per **month interval**: `close_start` → `close_end`, `n_days` from the real calendar in `daily_full`, optional first-trading-day fields.

2. **`bridge_interval_from_monthly_early(...)`**  
   Single-month metadata for plots/diagnostics; cross-checks against the month table when `daily_full` is passed.

3. **`_draw_standardized_innovations`** → **`_simulate_garch11_const_mean_scaled`** (or `arch` simulate for higher order)  
   Internal machinery; exposed to you as **`simulate_tgarch_segment_log_units`**, which returns **`n` log returns + vol path** in **log-return units** (after dividing by `garch.scale`).

4. **`bridge_month_returns(R_month_log, r_tilde, sigma_tilde)`**  
   Adjusts the tentative GARCH returns so their **sum** equals the observed **month-end log return**; weights proportional to conditional vol (or uniform fallback).

5. **`prices_from_log_returns`**, **`max_drawdown_from_prices`**, **`partb2_path_drawdown_horizons`**  
   Turn bridged returns into prices and drawdown statistics (including rolling windows).

6. **`simulate_partb2_path`**  
   Loops over **all** intervals in the month table, chaining terminal price to the next month’s start. Optional **`use_first_trading_day_close_anchor`**.

7. **`partb2_monte_carlo`**  
   Many paths with **`SeedSequence`**-spawned RNGs; aggregates drawdown percentiles across paths.

**Also in this file:** pooled calendar-month simple returns across paths, **`simulate_partb2_path_at_pool_index`** for reproducibility, and **plotting** helpers (`plot_partb2_month_mc_paths`, year-span validation).

---

## 6. Part (c) simulation — `partc_sim.py` (PARTC_2)

**Problem:** Early sample has **monthly average** closes, not month-ends. You still simulate GARCH dailies on the true calendar, but you **match the observation** by forcing the **mean of intramonth levels** to equal **`avg_end`**.

**Walk through the call chain:**

1. **`partc2_month_table(monthly_avg_early, daily_full)`**  
   Intervals between consecutive average-panel rows: `avg_start`, `avg_end`, `n_days`, etc.

2. **`bridge_interval_from_monthly_avg_early`**  
   Target month metadata; aligns with one row of the month table.

3. **`simulate_tgarch_segment_log_units`** *(imported from `partb_sim`)*  
   Same GARCH draws as Part (b).

4. **`_mean_scale_segment(p0, r_tilde, avg_target)`**  
   Build prices from \(P_0\) and \(\tilde r\); scale **intramonth** levels so \(\text{mean}(P_{1:n}) = A\); back out implied **`r_star`**.

5. **`simulate_partc2_path`**  
   Full early-sample path, chaining \(P_0\) across months.

6. **`partc2_monte_carlo`**  
   Same pattern as Part (b) for drawdown distributions.

7. **`simulate_partc2_month_paths`**  
   Fan of paths for **one** calendar month (visualization).

Drawdown analytics reuse **`partb2_path_drawdown_horizons`** and **`max_drawdown_from_prices`** from `partb_sim` so Part (b) and Part (c) stay comparable.

---

## 7. Drawdowns and returns on observed vs simulated data

| Module | Role |
|--------|------|
| **`spx_drawdown_severity.py`** | Core rolling-peak fractional drawdown logic on `datetime`/`profit` (here `Close`). **`analyze_partb2_simulated_drawdown_percentiles`** and **`analyze_partc2_simulated_drawdown_percentiles`** apply the **same** definitions to simulated paths. |
| **`spx_rolling_buyhold.py`** | Calendar-month windows on **observed** daily data; tail tables. |
| **`spx_trading_day_buyhold.py`** | **Trading-day** count windows (e.g. 30/60/90); links log-return sums to simple returns; used in Part (b)-style analyses. |
| **`drawdowns.py`** | Generic drawdown episodes / time-to-recover utilities (portfolio-style API); some SPX analysis is duplicated in `spx_drawdown_severity` for a self-contained path. |

When you **walk through results**, the pattern is: build prices → same drawdown definition as real data → compare percentiles.

---

## 8. Optional supervised track — `ml_c.py` (Part (c))

This is **separate** from `partc_sim`: it uses **only the last 10 years of dailies** to learn a mapping from **monthly-average-based features** to **month-end vs average** (target \(r_m = \log(M_m/A_m)\)).

| Stage | Functions (representative) |
|-------|----------------------------|
| Build monthly table | `build_daily_recent`, `build_ml_c_monthly_table`, `_add_deployable_from_averages` |
| Features | `DEPLOYABLE_FEATURES`, optional nonlinear terms (`add_g_nonlinear_terms`, `nonlinear_g_feature_list`) |
| Fit | `fit_ols_deployable`, `fit_ols_g_nonlinear`, `fit_all_g_nonlinear_models` |
| CV | `sliding_window_cv_ols`, `compare_g_models_cv`, `paired_cv_metric_test` |
| Impute | `predict_month_end_from_averages`, `run_linear_g_only_impute_early`, `run_ml_c_pipeline` |

Use this when the write-up discusses **regression-based imputation** under data limitation; simulation remains in **`partc_sim`**.

---

## 9. How the notebooks typically progress

**Part (a)**  
Load daily → fit GARCH → extract \(z_t\) → POT/GPD on losses → optional forecast sigma for stress calibration → rolling buy-hold and drawdown baselines on full sample.

**Part (b)**  
`build_part_b_split` → fit GARCH on `daily_recent` → `partb2_month_table` → `partb2_monte_carlo` / pooled returns → `spx_drawdown_severity` on simulated paths → EVT on pooled simulated returns vs Part (a).

**Part (c)**  
`build_part_c_split` (or load CSV) → same GARCH calibration → `partc2_monte_carlo` / single-month path plots → drawdown + EVT comparison → optionally **`ml_c`** pipeline for imputation metrics.

---

## 10. File checklist (what you “built”)

| File | In walkthrough |
|------|----------------|
| `partb.py` | Data + GARCH + shared split |
| `partc.py` | Part (c) average panel |
| `parta_evt.py` | EVT / GPD |
| `partb_sim.py` | Log bridge + MC paths |
| `partc_sim.py` | Mean bridge + MC paths |
| `spx_drawdown_severity.py` | Drawdowns real + sim |
| `spx_rolling_buyhold.py` | Calendar-month returns |
| `spx_trading_day_buyhold.py` | Trading-day windows |
| `drawdowns.py` | Generic drawdown helpers |
| `ml_c.py` | Optional OLS / CV imputation |
| `Part(a|b|c).ipynb` | Narrative + figures |

---

## 11. Suggested order to read the source

1. `partb.py` — `build_part_b_split`, `TGarchFitResult`, `fit_t_garch_on_daily_recent`  
2. `partb_sim.py` — `partb2_month_table` → `bridge_month_returns` → `simulate_partb2_path`  
3. `partc.py` — `build_part_c_split`  
4. `partc_sim.py` — `partc2_month_table` → `_mean_scale_segment` → `simulate_partc2_path`  
5. `spx_drawdown_severity.py` — `analyze_partb2_*` / `analyze_partc2_*`  
6. `parta_evt.py` — residual pipeline then `evt_summary_pooled_simple_returns`  
7. `ml_c.py` — `build_ml_c_monthly_table` → `run_ml_c_pipeline` (if you use it)

This path follows **data → model → bridge → risk metrics → tail stats**, which matches how the analysis is presented in the notebooks.
