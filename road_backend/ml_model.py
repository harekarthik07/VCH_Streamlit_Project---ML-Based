import numpy as np
import pandas as pd

# ---------- Weight constants (MATLAB reference) ----------
W_THR = np.array([0.4, 0.5, 0.6])   # throttle weight per drive mode (0=Comfort,1=Power,2=Sprint)
W_V   = np.array([0.4, 0.5, 0.6])   # velocity weight per drive mode
W_RGN = np.array([                   # [rgn_lvl-1 (row), rd_mode (col)]
    [0.4, 0.3, 0.2],
    [0.3, 0.2, 0.1],
    [0.2, 0.1, 0.05]
])
W_BS  = 0.4
V_THR = 60.0   # km/h

def _get_col(df, *names):
    for name in names:
        if name in df.columns:
            return name
    for col in df.columns:
        for name in names:
            if name.lower() in col.lower():
                return col
    return None

def compute_drive_score(df: pd.DataFrame) -> dict:
    """
    Vectorised deterministic Drive Score engine.
    Direct translation of MATLAB reference logic — no ML, no black box.

    Penalty equations:
        p_thr : 100 * w_thr[mode] * (thr/0.5)   when thr > 0.5, else ffill
        p_v   : 100 * w_v[mode]  * max(0,(v-60)/60)^2
        p_rgn : 100 * w_rgn[rgn-1, mode]         when 1<=rgn<=3 and mode<=2
        p_bs  : 100 * w_bs * (0.5*bs_events/T + 0.5*bs_time/T)
        p_inst = p_thr + p_v - p_rgn + p_bs
        dr_score = 100 - mean(clip(p_inst, 0, inf))
    """
    n = len(df)
    if n == 0:
        return {"Drive_Score": 100.0, "Ride_Class": "Efficient",
                "Penalty_Throttle": 0.0, "Penalty_Velocity": 0.0,
                "Penalty_Regen": 0.0, "Penalty_Brake": 0.0, "Brake_Switch_Count": 0}

    def _arr(df, *names, dtype=float, default=0):
        c = _get_col(df, *names)
        if c is None:
            return np.full(n, default, dtype=dtype)
        return pd.to_numeric(df[c], errors='coerce').fillna(default).values.astype(dtype)

    rd_mode = np.clip(_arr(df, 'Drive_Mode', dtype=int), 0, 3)
    thr     = np.clip(_arr(df, 'Throttle'),             0, None)
    v       = np.clip(_arr(df, 'Front_Speed [kph]'),    0, None)
    rgn     = np.clip(_arr(df, 'Regen_Level', dtype=int), 0, 3)
    bs      = np.clip(_arr(df, 'BrakeSw', 'Brake_Switch', dtype=int), 0, 1)

    t_col = _get_col(df, 'Time')
    if t_col is not None:
        t_arr  = pd.to_numeric(df[t_col], errors='coerce').fillna(0).values.astype(float)
        dt_arr = np.concatenate(([0.0], np.diff(t_arr)))
    else:
        dt_arr = np.ones(n, dtype=float)
    t_total = max(float(np.sum(dt_arr)), 0.01)

    mode_safe = np.clip(rd_mode, 0, 2)   # mode 3 (Park/Neutral) → 0 penalty

    # ── Throttle penalty — ffill "hold previous" via pandas ──────────────
    active = (thr > 0.5) & (rd_mode <= 2)
    p_thr_raw = np.where(active,
                         np.minimum(100.0, 100.0 * W_THR[mode_safe] * (thr / 0.5)),
                         np.nan)
    p_thr = pd.Series(p_thr_raw).ffill().fillna(0.0).values

    # ── Velocity penalty ─────────────────────────────────────────────────
    p_v = np.where(rd_mode <= 2,
                   np.minimum(100.0, 100.0 * W_V[mode_safe] * np.maximum(0.0, (v - V_THR) / V_THR) ** 2),
                   0.0)

    # ── Regen penalty (negative = reduces total penalty) ─────────────────
    rgn_idx  = np.clip(rgn - 1, 0, 2)
    valid_rgn = (rgn >= 1) & (rgn <= 3) & (rd_mode <= 2)
    p_rgn = np.where(valid_rgn,
                     np.minimum(100.0, 100.0 * W_RGN[rgn_idx, mode_safe]),
                     0.0)

    # ── Brake penalty — scalar accumulated over ride ──────────────────────
    bs_events  = int(np.sum((bs[1:] == 1) & (bs[:-1] == 0)))
    bs_time    = float(np.sum(dt_arr[bs == 1]))
    p_bs_ride  = min(100.0, 100.0 * W_BS * (0.5 * (bs_events / t_total) + 0.5 * (bs_time / t_total)))

    # ── Instantaneous total penalty ───────────────────────────────────────
    p_inst = p_thr + p_v - p_rgn + p_bs_ride

    # ── Ride-level score ──────────────────────────────────────────────────
    p_mean      = float(np.mean(np.clip(p_inst, 0.0, None)))
    drive_score = round(max(0.0, min(100.0, 100.0 - p_mean)), 1)

    if   drive_score >= 70: ride_class = "Efficient"
    elif drive_score >= 40: ride_class = "Road Mixed"
    else:                   ride_class = "Office Push"

    return {
        "Drive_Score":        drive_score,
        "Ride_Class":         ride_class,
        "Penalty_Throttle":   round(float(np.mean(p_thr)),  2),
        "Penalty_Velocity":   round(float(np.mean(p_v)),    2),
        "Penalty_Regen":      round(float(np.mean(p_rgn)),  2),
        "Penalty_Brake":      round(p_bs_ride,               2),
        "Brake_Switch_Count": bs_events,
    }

# Shim — keeps thermal_ride.py import working without changes
class DriveScoreEngine:
    def compute(self, df):
        return compute_drive_score(df)

ml_engine = DriveScoreEngine()
