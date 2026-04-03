import numpy as np
from sklearn.ensemble import RandomForestRegressor

class DriveScoreML:
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=50, random_state=42)
        self._train_initial_model()

    def _train_initial_model(self):
        # Bootstraps the ML model using synthetic limits based on physical testing
        np.random.seed(42)
        # Features: [Avg_Torque, Accel_Freq, Sprint_Pct, Wh_km, Spd_Osc]
        X_train = np.random.rand(500, 5)
        X_train[:, 0] *= 60   # Torque 0-60 Nm
        X_train[:, 1] *= 20   # Accel Freq 0-20 per min
        X_train[:, 2] *= 100  # Sprint 0-100%
        X_train[:, 3] *= 80   # Wh/km 0-80
        X_train[:, 4] *= 5    # Oscillation Index 0-5

        y_train = []
        for row in X_train:
            t_idx = min((row[0] / 40.0) * 100, 100)
            a_idx = min((row[1] / 15.0) * 100, 100)
            s_idx = row[2]
            w_idx = min((row[3] / 50.0) * 100, 100)
            # The baseline logic formula
            score = (0.35 * t_idx) + (0.25 * a_idx) + (0.20 * s_idx) + (0.20 * w_idx)
            y_train.append(score)

        self.model.fit(X_train, y_train)

    def predict_score(self, features):
        """ Expects a list: [avg_torque, accel_freq_per_min, pct_sprint, overall_wh_km, spd_osc] """
        return round(self.model.predict([features])[0], 1)

# Global model instance (loads once into memory when imported)
ml_engine = DriveScoreML()