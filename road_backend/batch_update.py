import os
import sys

db_path = os.path.join(os.path.dirname(__file__), '..')
sys.path.insert(0, db_path)

import db_bridge
from thermal_ride import ThermalRide

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE_DIR, "Raw_Data")
DB_NAME = os.path.join(BASE_DIR, "raptee_rides.db")

def update_single(file_name):
    try:
        ride = ThermalRide(os.path.join(RAW_DIR, file_name))
        ride.ingest().sync().compute_features().compute_ride_metrics()
        
        k = ride.ride_metrics
        
        db_bridge.execute_sql('''
            INSERT OR REPLACE INTO ride_summaries (
                Ride_Name, 
                Total_Distance_km, Total_Energy_Wh, Overall_Wh_km,
                Max_Motor_Temp_C, Max_IGBT_Temp_C, Max_Pack_Temp_C, Max_Pack_Spread_C,
                Max_IGBT_Rise_C, Max_Motor_Rise_C, Max_Pack_Rise_C,
                Start_Motor_Temp_C, Start_IGBT_Temp_C, Start_Pack_Temp_C, Start_Pack_Delta_T_C,
                Time_in_Comfort_min, Time_in_Power_min, Time_in_Sprint_min, 
                High_Torque_Time_sec,
                Rider, Ambient_Temp_C, Location, Bike_ID,
                Avg_Torque_Nm, Peak_Torque_Bursts, Accel_Freq, 
                Speed_Osc_Index, Pct_Sprint, Torque_Burst_Idx, 
                Drive_Score, Ride_Class,
                Penalty_Throttle, Penalty_Velocity, Penalty_Regen, 
                Penalty_Brake, Brake_Switch_Count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', params=(
            file_name, 
            k['Total_Distance_km'], k['Total_Energy_Wh'], k['Overall_Wh_km'],
            k['Max_Motor_Temp_C'], k['Max_IGBT_Temp_C'], k['Max_Pack_Temp_C'], k['Max_Pack_Spread_C'],
            k['Max_IGBT_Rise_C'], k['Max_Motor_Rise_C'], k['Max_Pack_Rise_C'],
            k['Start_Motor_Temp_C'], k['Start_IGBT_Temp_C'], k['Start_Pack_Temp_C'], k['Start_Pack_Delta_T_C'],
            k['Time_in_Comfort_min'], k['Time_in_Power_min'], k['Time_in_Sprint_min'], 
            k['High_Torque_Time_sec'],
            'Unknown', 25.0, 'Unknown', 'Unknown',
            k['Avg_Torque_Nm'], k['Peak_Torque_Bursts'], k['Accel_Freq'], 
            k['Speed_Osc_Index'], k['Pct_Sprint'], k['Torque_Burst_Idx'], 
            k['Drive_Score'], k['Ride_Class'],
            k.get('Penalty_Throttle', 0), k.get('Penalty_Velocity', 0), k.get('Penalty_Regen', 0),
            k.get('Penalty_Brake', 0), k.get('Brake_Switch_Count', 0)
        ), db_path=DB_NAME)
        
        print(f"OK: {file_name} -> {k['Drive_Score']:.1f}", flush=True)
    except Exception as e:
        print(f"ERROR: {file_name} -> {e}", flush=True)

if __name__ == "__main__":
    file_name = sys.argv[1] if len(sys.argv) > 1 else None
    if file_name:
        update_single(file_name)
    else:
        files = [f for f in os.listdir(RAW_DIR) if f.endswith('.xlsx')]
        for f in files:
            update_single(f)