import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import db_manager
import pandas as pd

RAW_DIR = "Raw_Data"
PROCESSED_DIR = "Processed_Rides"

db = db_manager.DatabaseManager(db_name="raptee_rides.db", processed_folder=PROCESSED_DIR)

files = [f for f in os.listdir(RAW_DIR) if f.endswith('.xlsx')]
print(f"Found {len(files)} files to re-process...")

for file_name in files:
    try:
        ride = ThermalRide(os.path.join(RAW_DIR, file_name))
        ride.ingest().sync().compute_features().compute_ride_metrics()
        
        k = ride.ride_metrics
        print(f"  {file_name}: Score={k['Drive_Score']:.1f}, Thr={k.get('Penalty_Throttle', 0):.1f}, Vel={k.get('Penalty_Velocity', 0):.1f}")
    except Exception as e:
        print(f"  ERROR {file_name}: {e}")

print("Done!")