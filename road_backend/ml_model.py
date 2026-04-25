import numpy as np
from sklearn.ensemble import RandomForestRegressor

class DriveScoreHybrid:
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=50, random_state=42)
        self._train_initial_model()
        
        # MATLAB-style weights (per drive mode: 0=Comfort, 1=Power, 2=Sprint)
        self.w_thr = np.array([0.4, 0.5, 0.6])
        self.w_v = np.array([0.4, 0.5, 0.6])
        self.w_rgn = np.array([
            [0.4, 0.3, 0.2],
            [0.3, 0.2, 0.1],
            [0.2, 0.1, 0.05]
        ])
        self.w_bs = 0.4
        self.v_ref = 60.0  # Reference velocity (km/h)
        self.thr_ref = 0.5  # Reference throttle
        
    def _train_initial_model(self):
        np.random.seed(42)
        X_train = np.random.rand(500, 5)
        X_train[:, 0] *= 60
        X_train[:, 1] *= 20
        X_train[:, 2] *= 100
        X_train[:, 3] *= 80
        X_train[:, 4] *= 5

        y_train = []
        for row in X_train:
            t_idx = min((row[0] / 40.0) * 100, 100)
            a_idx = min((row[1] / 15.0) * 100, 100)
            s_idx = row[2]
            w_idx = min((row[3] / 50.0) * 100, 100)
            score = (0.35 * t_idx) + (0.25 * a_idx) + (0.20 * s_idx) + (0.20 * w_idx)
            y_train.append(score)

        self.model.fit(X_train, y_train)

    def _get_col(self, df, *names):
        """Find column by trying multiple possible names (including prefixed ones)"""
        for name in names:
            if name in df.columns:
                return name
        for col in df.columns:
            col_lower = col.lower()
            for name in names:
                if name.lower() in col_lower:
                    return col
        return None

    def calculate_penalties(self, df):
        """Vectorized penalty calculation - handles missing/prefixed columns, bad data"""
        n = len(df)
        if n == 0:
            return {"p_thr_max": 0, "p_v_max": 0, "p_rgn_max": 0, "p_bs_max": 0, 
                    "p_thr_mean": 0, "p_v_mean": 0, "bs_count": 0, "penalty_total": 0}
        
        rd_mode_col = self._get_col(df, 'Drive_Mode')
        thr_col = self._get_col(df, 'Throttle')
        v_col = self._get_col(df, 'Front_Speed [kph]')
        rgn_col = self._get_col(df, 'Regen_Level')
        bs_col = self._get_col(df, 'BrakeSw', 'Brake_Switch')
        
        rd_mode = np.zeros(n, dtype=int)
        if rd_mode_col:
            try:
                rd_mode = pd.to_numeric(df[rd_mode_col], errors='coerce').fillna(0).astype(int).values
            except:
                pass
        
        thr = np.zeros(n)
        if thr_col:
            try:
                thr = pd.to_numeric(df[thr_col], errors='coerce').fillna(0).clip(lower=0).values
            except:
                pass
        
        v = np.zeros(n)
        if v_col:
            try:
                v = pd.to_numeric(df[v_col], errors='coerce').fillna(0).clip(lower=0).values
            except:
                pass
        
        rgn = np.zeros(n, dtype=int)
        if rgn_col:
            try:
                rgn = pd.to_numeric(df[rgn_col], errors='coerce').fillna(0).astype(int).values
            except:
                pass
        
        bs = np.zeros(n, dtype=int)
        if bs_col:
            try:
                bs_raw = pd.to_numeric(df[bs_col], errors='coerce').fillna(0)
                bs = bs_raw.astype(int).values
            except:
                pass
        
        # Vectorized throttle penalty
        p_thr = np.where(thr > self.thr_ref, 
                        np.minimum(100, 100 * self.w_thr[rd_mode] * (thr / self.thr_ref)),
                        np.roll(np.where(thr > self.thr_ref, 
                                        np.minimum(100, 100 * self.w_thr[rd_mode] * (thr / self.thr_ref)), 
                                        0), 1))
        p_thr[0] = 0
        
        p_v = np.where(v > self.v_ref,
                      np.minimum(100, 100 * self.w_v[rd_mode] * ((v - self.v_ref) / self.v_ref) ** 2),
                      0)
        
        p_rgn = np.minimum(100, 100 * self.w_rgn[rd_mode.clip(max=2), rgn.clip(max=2)])
        
        p_bs = self.w_bs * 100 * bs
        
        bs_count = int(np.sum((bs[1:] == 1) & (bs[:-1] == 0)))
        
        return {
            "p_thr_max": float(np.max(p_thr)),
            "p_v_max": float(np.max(p_v)),
            "p_rgn_max": float(np.max(p_rgn)),
            "p_bs_max": float(np.max(p_bs)),
            "p_thr_mean": float(np.mean(p_thr)),
            "p_v_mean": float(np.mean(p_v)),
            "bs_count": bs_count,
            "penalty_total": float(np.max(p_thr) + np.max(p_v) + np.max(p_rgn) + np.max(p_bs))
        }

    def predict_score(self, features, penalties=None):
        """features: [avg_torque, accel_freq_per_min, pct_sprint, overall_wh_km, spd_osc]
           penalties: dict from calculate_penalties() - optional adjustment"""
        base_score = round(self.model.predict([features])[0], 1)
        
        if penalties is None:
            return base_score
        
        # Hybrid: ML base score adjusted by penalty factors
        penalty_factor = 1.0 - (penalties.get("penalty_total", 0) / 400.0)
        penalty_factor = np.clip(penalty_factor, 0.3, 1.0)
        
        final_score = base_score * penalty_factor
        return round(final_score, 1)

ml_engine = DriveScoreHybrid()