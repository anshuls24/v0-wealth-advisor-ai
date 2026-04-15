import warnings

import numpy as np
import pandas as pd


def time_to_recover(results_df):
    """
    Calculate recovery times from drawdowns, marking the point of recovery.

    At each point in the profit series that is a recovery
    to/above a previous peak, this function returns the number of periods from
    that peak to the recovery point. If there's an unrecovered drawdown at the
    end, it's returned separately.

    This function now leverages get_drawdown_episodes() for consistent
    drawdown detection logic across the module.

    :param results_df: DataFrame with columns 'datetime' and 'profit'
    :type results_df: pandas.DataFrame
    :returns: Tuple of (recovery_times, unrecovered_info) where:
        - recovery_times: Series indexed by datetime with recovery times (in days)
          for recovered drawdowns only. At position i, if position i represents a
          recovery to/above a previous peak, the value shows how many days elapsed
          from that peak to the recovery point. Returns np.nan for all other points.
        - unrecovered_info: Dict with 'days_elapsed' (float or None) and
          'start_datetime' (str or None) for any unrecovered drawdown at the end.
    :rtype: tuple[pandas.Series, dict]

    Examples
    --------
    >>> import pandas as pd
    >>> from slbacktest.utils import time_to_recover
    >>> data = {
    ...     'datetime': pd.date_range('2024-01-01', periods=11, freq='D'),
    ...     'profit': [1, 2, 3, 4, 5, 6, 3, -2, 7, 4, 8],
    ... }
    >>> df = pd.DataFrame(data)
    >>> recovery, unrecovered = time_to_recover(df)
    >>> # At index 8 (recovery to 7): shows 3.0 (3 days from peak at index 5 to recovery at index 8)
    >>> # At index 10 (recovery to 8): shows 2.0 (2 days from peak at index 8 to recovery at index 10)
    """
    # Use get_drawdown_episodes for consistent drawdown detection
    episodes = get_drawdown_episodes(results_df, period=None, funds=None)

    # Initialize result series with NaN
    datetime_index = pd.to_datetime(results_df['datetime'])
    recovery_times = pd.Series(index=datetime_index, dtype=float)
    recovery_times[:] = np.nan

    # Populate recovery times for recovered episodes
    for episode in episodes:
        if episode['is_recovered'] and episode['end_datetime'] is not None:
            recovery_times.loc[episode['end_datetime']] = episode[
                'drawdown_days'
            ]

    # Handle unrecovered drawdown at the end
    unrecovered_info = {'days_elapsed': None, 'start_datetime': None}
    if episodes and not episodes[-1]['is_recovered']:
        last_episode = episodes[-1]
        drawdown_days = last_episode.get('drawdown_days')
        unrecovered_info = {
            'days_elapsed': round(drawdown_days, 2),
            'start_datetime': str(last_episode['start_datetime']),
        }

    return recovery_times, unrecovered_info


def get_time_to_recovery_stats(results_df):
    """
    Calculate statistical summary of recovery times from drawdowns.

    This function computes quantile statistics for the time it takes to recover
    from drawdowns, separating recovered drawdowns from any unrecovered drawdown.
    If computation fails or no recovery data is available, returns NaN values
    for all statistics.

    :param results_df: DataFrame with columns 'datetime' and 'profit'
    :type results_df: pandas.DataFrame
    :returns: Dictionary containing two keys:
        - 'recovered': dict with stats for recovered drawdowns ('1p', '5p', '25p',
          '50p', '75p', '95p', '99p', 'max', 'mean'). All values in days,
          rounded to 2 decimal places.
        - 'unrecovered': dict with 'days_elapsed' (float or None) and 'start_datetime'
          (str or None) for the unrecovered drawdown, if one exists.
    :rtype: dict[str, dict]

    Examples
    --------
    >>> import pandas as pd
    >>> from slbacktest.performance import get_time_to_recovery_stats
    >>> data = {
    ...     'datetime': pd.date_range('2024-01-01', periods=100, freq='D'),
    ...     'profit': [100 + i - (i % 20) * 2 for i in range(100)],
    ... }
    >>> df = pd.DataFrame(data)
    >>> stats = get_time_to_recovery_stats(df)
    >>> isinstance(stats, dict)
    True
    >>> 'recovered' in stats and 'unrecovered' in stats
    True
    """
    # Define stat keys and their corresponding quantiles
    quantile_stats = [
        ('1p', 0.01),
        ('5p', 0.05),
        ('25p', 0.25),
        ('50p', 0.50),
        ('75p', 0.75),
        ('95p', 0.95),
        ('99p', 0.99),
    ]
    stat_keys = [key for key, _ in quantile_stats] + ['max', 'mean']

    # Helper to create NaN dictionary
    nan_stats = {key: np.nan for key in stat_keys}

    try:
        recovery_times, unrecovered_info = time_to_recover(results_df)
        recovery_times_clean = recovery_times.dropna()

        if len(recovery_times_clean) == 0:
            return {'recovered': nan_stats, 'unrecovered': unrecovered_info}

        # Compute all statistics for recovered drawdowns
        stats = {
            key: round(recovery_times_clean.quantile(q), 2)
            for key, q in quantile_stats
        }
        stats['max'] = round(recovery_times_clean.max(), 2)
        stats['mean'] = round(recovery_times_clean.mean(), 2)

        return {'recovered': stats, 'unrecovered': unrecovered_info}
    except Exception:
        warnings.warn(
            'Error calculating drawdown recovery stats in get_time_to_recovery_stats',
            RuntimeWarning,
        )
        return {
            'recovered': nan_stats,
            'unrecovered': {'days_elapsed': None, 'start_datetime': None},
            'all_times_recovery': recovery_times_clean.values.tolist(),
        }


def prepare_profit_series(results_df):
    """Build datetime-indexed profit series from ``results_df`` (profit used as given)."""
    profit_df = results_df[['datetime', 'profit']].copy()
    profit_df['datetime'] = pd.to_datetime(profit_df['datetime'])
    profit_df.set_index('datetime', inplace=True)
    s = profit_df['profit']
    return s, s


def _compute_drawdown_series(
    profit_ref,
    profit_actual,
    period=None,
):
    if not isinstance(profit_ref.index, pd.DatetimeIndex):
        try:
            converted_index = pd.to_datetime(profit_ref.index, errors='raise')
        except Exception as exc:
            raise TypeError(
                'profit_ref index must be DatetimeIndex or datetime-convertible'
            ) from exc
        profit_ref = profit_ref.copy()
        profit_ref.index = converted_index

    if not isinstance(profit_actual.index, pd.DatetimeIndex):
        try:
            converted_actual_index = pd.to_datetime(
                profit_actual.index, errors='raise'
            )
        except Exception as exc:
            raise TypeError(
                'profit_actual index must be DatetimeIndex or datetime-convertible'
            ) from exc
        profit_actual = profit_actual.copy()
        profit_actual.index = converted_actual_index

    if period:
        window = f'{period}D'
        rolling_max = profit_ref.rolling(window=window, closed='left').max()
        rolling_max = rolling_max.fillna(profit_ref)
        lookback = pd.Timedelta(days=period)
        index_ns = profit_ref.index.to_numpy(dtype='datetime64[ns]').astype(
            'int64'
        )
        index_dt = profit_ref.index.to_numpy(dtype='datetime64[ns]')
        profit_vals = pd.to_numeric(profit_ref, errors='coerce').to_numpy(
            dtype=float
        )
        lookback_ns = lookback.value

        peak_dt_vals = np.empty(len(profit_vals), dtype='datetime64[ns]')
        for i in range(len(profit_vals)):
            left = np.searchsorted(
                index_ns, index_ns[i] - lookback_ns, side='left'
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
            peak_dt_vals, index=profit_ref.index, dtype='datetime64[ns]'
        )
    else:
        rolling_max = profit_ref.cummax()
        running_max_ignore_na = profit_ref.where(
            profit_ref.notna(), -np.inf
        ).cummax()
        prev_cummax = running_max_ignore_na.shift(1).fillna(-np.inf)
        new_peak_mask = profit_ref.notna() & profit_ref.gt(prev_cummax)
        peak_datetimes = pd.Series(
            pd.NaT, index=profit_ref.index, dtype='datetime64[ns]'
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
    Drawdown vs a rolling calendar-day peak for each window length in ``periods``.

    Typical use with daily SPX data (``spx_50yr.csv``): build ``results_df`` with
    ``datetime`` = parsed ``Date`` and ``profit`` = ``Close`` (treat close as the
    equity level). Then ``get_drawdowns(df, periods=[30, 90, 180], return_series=True)``
    gives, per window, the time series ``drawdown_t = profit_t - rolling_max_t`` where
    the rolling max uses the prior P **calendar** days (``closed='left'``). Values are
    usually ≤ 0; more negative means further below the recent peak.

    :param results_df: DataFrame with columns ``datetime`` and ``profit`` (e.g. SPX close).
    :type results_df: pandas.DataFrame
    :param periods: Day windows P (e.g. ``[30, 90, 180]`` for ~1M/3M/6M). Rolling max over P calendar days.
    :type periods: list[int], optional
    :param return_series: If True, each value is a ``pd.Series`` of daily drawdowns. If False,
        each value is the single minimum (most negative) drawdown over the sample for that P.
    :type return_series: bool, optional
    :returns: Dict keyed by P → drawdown series or scalar minimum.
    :rtype: dict[int, pd.Series] or dict[int, float]

    Notes
    -----
    - Index is calendar time, not a fixed count of rows.
    - If ``len(results_df) <= P``, the entry for P is ``np.nan``.

    Examples
    --------
    >>> import pandas as pd
    >>> from drawdowns import get_drawdowns
    >>> data = {
    ...     'datetime': [
    ...         '2024-01-01 00:00:00', '2024-01-02 00:00:00', '2024-01-03 00:00:00',
    ...         '2024-01-04 00:00:00', '2024-01-05 00:00:00'
    ...     ],
    ...     'profit': [100.0, 105.0, 103.0, 110.0, 108.0],
    ... }
    >>> df = pd.DataFrame(data)
    >>> dd = get_drawdowns(df)
    >>> isinstance(dd, dict)
    True

    >>> dd_custom = get_drawdowns(df, periods=[2, 3])
    >>> set(dd_custom.keys()) == {2, 3}
    True

    >>> short_df = df.iloc[:2]
    >>> dd_short = get_drawdowns(short_df, periods=[1, 3])
    >>> pd.isna(dd_short[3])
    True
    """
    if periods is None:
        periods = [30, 90, 180]

    profit_ref, profit_actual = prepare_profit_series(results_df)

    drawdowns = {}

    for period in periods:
        if len(profit_actual) > period:
            dd_series, _, _ = _compute_drawdown_series(
                profit_ref,
                profit_actual,
                period=period,
            )

            drawdowns[period] = dd_series if return_series else dd_series.min()
        else:
            drawdowns[period] = np.nan

    return drawdowns


def get_drawdown_episodes(
    results_df,
    period=None,
    funds=None,
):
    """
    Extract peak-to-peak drawdown episodes from a profit time series.

    A drawdown episode follows a peak-to-peak definition:

    - The episode starts at a peak (start_datetime = peak_datetime).
    - Drawdown occurs when profit falls below that peak.
    - The episode ends when profit recovers back to or above that peak.
    - end_datetime is None and is_recovered is False if recovery does not occur (within the allowed window if period is set).

    Parameters
    ----------
    results_df : pd.DataFrame
        Must contain:
        - 'datetime' column
        - 'profit' column (cumulative profit / equity), used as provided

    period : int, optional
        If provided, rolling calendar-day peaks are used (closed='left').
        Recovery is only considered within `period` days after the peak.
        If None, cumulative (all-time) peaks are used and recovery is
        evaluated over the full remaining series.

    funds : float, optional
        Initial capital for percentage calculation.
        If None, drawdown percentage is calculated relative to peak profit.

    Returns
    -------
    list[dict]
        A list of drawdown episode dictionaries. Each dictionary contains:

        id : str
            Sequential unique identifier of the drawdown episode
            (e.g., "0", "1", "2"). Episodes are ordered chronologically.

        start_datetime : pd.Timestamp
            Timestamp of the peak that begins the drawdown episode.
            This represents the peak from which the decline starts
            (peak-to-peak convention).

        end_datetime : pd.Timestamp or None
            Timestamp when profit first recovers to or exceeds the same
            peak level. If recovery does not occur within the allowed
            window (or before the series ends), this is set to None.
            None if unrecovered.

        peak_datetime : pd.Timestamp
            Timestamp of the peak preceding the drawdown.
            Equivalent to start_datetime; included for clarity.

        peak_profit : float
            Profit value at the peak. This is the reference level used
            to measure the drawdown.

        trough_datetime : pd.Timestamp
            Timestamp at which the lowest profit value occurs between
            the peak and the recovery (or end of evaluation window).

        trough_profit : float
            Profit value at the trough (minimum during the episode).

        drawdown_amount : float
            Absolute loss from peak to trough:
                trough_profit - peak_profit
            This value is typically negative.

        drawdown_percentage : float
            Percentage loss from peak to trough.
            If funds is provided, this is calculated relative to funds.
            Otherwise, it is calculated relative to peak_profit.

        decline_days : int
            Number of calendar days from peak_datetime to trough_datetime.
            Represents time taken to reach maximum loss.

        recovery_days : int or None
            Number of calendar days from trough_datetime to end_datetime.
            Represents time required to recover from trough back to peak.
            None if the episode never recovers.

        drawdown_days : int
            Number of calendar days from peak_datetime to end_datetime.
            Represents time taken to reach maximum loss and recover.

        recovery_datetime : pd.Timestamp or None
            Timestamp when recovery occurs (same as end_datetime).
            None if unrecovered.

        is_recovered : bool
            True if profit recovers back to or exceeds the peak level
            within the allowed evaluation window. False otherwise.
    """

    if results_df.empty or len(results_df) < 2:
        return []

    profit_ref, profit_actual = prepare_profit_series(results_df)

    sim_end_datetime = profit_actual.index[-1]

    drawdowns, rolling_max, peak_datetimes = _compute_drawdown_series(
        profit_ref, profit_actual, period=period
    )

    valid = (
        profit_actual.notna()
        & rolling_max.notna()
        & drawdowns.notna()
        & pd.notna(peak_datetimes)
    )
    if not valid.any():
        return []

    indexes = profit_actual.index[valid]
    profits = profit_actual[valid].to_numpy(dtype=float)
    dds = drawdowns[valid].to_numpy(dtype=float)
    peak_vals = rolling_max[valid].to_numpy(dtype=float)
    peak_dts = pd.to_datetime(peak_datetimes[valid]).to_numpy(
        dtype='datetime64[ns]'
    )

    index_ns = indexes.to_numpy(dtype='int64', copy=False)

    lookahead_ns = (
        pd.Timedelta(days=period).value if period is not None else None
    )

    n = len(indexes)

    # Find positions where drawdown < 0
    negative_positions = np.flatnonzero(dds < 0.0)
    if len(negative_positions) == 0:
        return []

    episodes = []
    episode_id = 0
    slider = 0

    while slider < n:
        pos_in_neg = np.searchsorted(negative_positions, slider, side='left')
        if pos_in_neg >= len(negative_positions):
            break

        start_index = int(negative_positions[pos_in_neg])

        ep_peak_profit = float(peak_vals[start_index])
        ep_peak_datetime = pd.Timestamp(peak_dts[start_index])

        # Episode starts at the peak
        start_datetime = ep_peak_datetime

        if lookahead_ns is not None:
            limit_ns = ep_peak_datetime.value + lookahead_ns
            forced_end = np.searchsorted(index_ns, limit_ns, side='right') - 1
            scan_end_index = min(max(forced_end, start_index), n - 1)
        else:
            scan_end_index = n - 1

        recovery_rel = np.flatnonzero(
            profits[start_index : scan_end_index + 1] >= ep_peak_profit
        )

        if len(recovery_rel) > 0:
            end_index = start_index + int(recovery_rel[0])
            end_datetime = indexes[end_index]
            is_recovered = True
        else:
            end_index = scan_end_index
            end_datetime = None
            is_recovered = False

        # Find trough within episode window
        trough_slice = profits[start_index : end_index + 1]
        ep_trough_index = start_index + int(np.argmin(trough_slice))
        trough_datetime = indexes[ep_trough_index]
        trough_profit = float(profits[ep_trough_index])

        # Compute recovery length only if recovered
        if is_recovered:
            recovery_days = (end_datetime - trough_datetime).days
            recovery_datetime = end_datetime
            drawdown_days = (end_datetime - ep_peak_datetime).days
        else:
            recovery_days = None
            recovery_datetime = None
            drawdown_days = (sim_end_datetime - ep_peak_datetime).days

        # Compute drawdown amount
        drawdown_amount = trough_profit - ep_peak_profit

        # Compute percentage
        if funds is not None:
            drawdown_pct = (
                (drawdown_amount / funds) * 100 if funds != 0 else np.nan
            )
        else:
            drawdown_pct = (
                (drawdown_amount / ep_peak_profit) * 100
                if ep_peak_profit != 0
                else np.nan
            )
        decline_days = (trough_datetime - ep_peak_datetime).days
        # Store episode
        episodes.append(
            {
                'id': str(episode_id),
                'start_datetime': start_datetime,
                'end_datetime': end_datetime,
                'peak_datetime': ep_peak_datetime,
                'peak_profit': ep_peak_profit,
                'trough_datetime': trough_datetime,
                'trough_profit': trough_profit,
                'drawdown_amount': round(drawdown_amount, 2),
                'drawdown_percentage': (
                    round(drawdown_pct, 2) if pd.notna(drawdown_pct) else np.nan
                ),
                'decline_days': int(decline_days),
                'recovery_days': (
                    int(recovery_days) if recovery_days is not None else None
                ),
                'drawdown_days': int(drawdown_days),
                'recovery_datetime': recovery_datetime,
                'is_recovered': is_recovered,
            }
        )

        episode_id += 1
        slider = end_index + 1

    return episodes
