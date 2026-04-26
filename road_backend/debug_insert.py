import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, '..'))

import db_bridge
from thermal_ride import ThermalRide

DB_NAME = os.path.join(BASE_DIR, "raptee_rides.db")

test_file = "15_04_2026_BK-04_Route-Road_Route-Road.xlsx"
ride = ThermalRide(os.path.join(BASE_DIR, "Raw_Data", test_file))
ride.ingest().sync().compute_features().compute_ride_metrics()

k = ride.ride_metrics
print("Keys in metrics:", list(k.keys()))

# Check all values count
values = [
    test_file, 
    k['Total_Distance_km'], k['Total_Energy_Wh'], k['Overall_Wh_km'],
    k['Max_Motor_Temp_C'], k['Max_IGBT_Temp_C'], k['Max_Pack_Temp_C'], k['Max_Pack_Spread_C'],
    k['Max_IGBT_Rise_C'], k['Max_Motor_Rise_C'], k['Max_Pack_Rise_C'],
    k['Start_Motor_Temp_C'], k['Start_IGBT_Temp_C'], k['Start_Pack_Temp_C'], k['Start_Pack_Delta_T_C'],
    k['Time_in_Comfort_min'], k['Time_in_Power_min'], k['Time_in_Sprint_min'], 
    k['High_Torque_Time_sec'], "",
    'Unknown', 25.0, 'Unknown', 'BK-04',
    k['Avg_Torque_Nm'], k['Peak_Torque_Bursts'], k['Accel_Freq'], 
    k['Speed_Osc_Index'], k['Pct_Sprint'], k['Torque_Burst_Idx'], 
    k['Drive_Score'], k['Ride_Class'],
    k.get('Penalty_Throttle', 0), k.get('Penalty_Velocity', 0), k.get('Penalty_Regen', 0),
    k.get('Penalty_Brake', 0), k.get('Brake_Switch_Count', 0)
]
print("Values count:", len(values))