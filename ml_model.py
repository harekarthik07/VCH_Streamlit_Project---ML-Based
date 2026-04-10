# Placeholder ML model used by road_backend.thermal_ride

class _MLModel:
    """Very simple mock model that returns a deterministic score.
    In production replace this with your actual trained model logic.
    """
    def predict_score(self, feature_vector):
        # Ensure we have a list of numbers
        try:
            total = sum(float(v) for v in feature_vector)
        except Exception:
            total = 0.0
        # Produce a score between 0 and 100 (modulo for safety)
        score = int(total) % 101
        return score

# Expose a singleton instance matching the original import style
ml_engine = _MLModel()
