import os
import sqlite3
import db_bridge
import pandas as pd
from thermal_ride import ThermalRide 

class DatabaseManager:
    def __init__(self, db_name="raptee_rides.db", processed_folder="Processed_Rides"):
        self.db_name = db_name
        self.processed_folder = processed_folder
        if not os.path.exists(self.processed_folder): os.makedirs(self.processed_folder)
        self._initialize_db()

    def _initialize_db(self):
        db_bridge.execute_sql('''
            CREATE TABLE IF NOT EXISTS ride_summaries (
                Ride_Name TEXT PRIMARY KEY,
                Total_Distance_km REAL, Total_Energy_Wh REAL, Overall_Wh_km REAL,
                Max_Motor_Temp_C REAL, Max_IGBT_Temp_C REAL, Max_Pack_Temp_C REAL, Max_Pack_Spread_C REAL,
                Max_IGBT_Rise_C REAL, Max_Motor_Rise_C REAL, Max_Pack_Rise_C REAL,
                Start_Motor_Temp_C REAL, Start_IGBT_Temp_C REAL, Start_Pack_Temp_C REAL, Start_Pack_Delta_T_C REAL,
                Time_in_Comfort_min REAL, Time_in_Power_min REAL, Time_in_Sprint_min REAL, 
                High_Torque_Time_sec REAL, Processed_CSV_Path TEXT,
                Rider TEXT, Ambient_Temp_C REAL, Location TEXT, Bike_ID TEXT,
                Avg_Torque_Nm REAL, Peak_Torque_Bursts INTEGER, Accel_Freq INTEGER, 
                Speed_Osc_Index REAL, Pct_Sprint REAL, Torque_Burst_Idx REAL, 
                Drive_Score REAL, Ride_Class TEXT
            )
        ''', db_path=self.db_name)
        
        db_bridge.execute_sql('''
            CREATE TABLE IF NOT EXISTS ride_events (
                Ride_Name TEXT, Event_Type TEXT, Start_Time REAL, End_Time REAL, Max_Value REAL, Description TEXT
            )
        ''', db_path=self.db_name)

    def process_new_files(self, raw_data_folder, metadata=None):
        if metadata is None: metadata = {"rider": "Unknown", "temp": 25.0, "loc": "Unknown"}
        raw_files = [f for f in os.listdir(raw_data_folder) if f.endswith('.xlsx')]
        for file_name in raw_files:
            df_exists = db_bridge.query_to_df("SELECT Ride_Name FROM ride_summaries WHERE Ride_Name = ?", params=(file_name,), db_path=self.db_name)
            if not df_exists.empty: continue
                
            print(f"New file detected! Processing {file_name}...")
            file_path = os.path.join(raw_data_folder, file_name)
            
            try:
                ride = ThermalRide(file_path)
                ride.ingest().sync().compute_features().compute_ride_metrics()
                
                # 🚀 PARQUET ENGINE SAVE
                parquet_filename = f"{file_name.replace('.xlsx', '')}_2Hz.parquet"
                processed_csv_path = os.path.join(self.processed_folder, parquet_filename)
                ride.master_2hz.to_parquet(processed_csv_path, index=False, engine='pyarrow')
                
                clean_name = file_name.replace("_Route-Office", "").replace("_Route-Road", "")
                bike_id = clean_name[11:].replace('.xlsx', '') if len(clean_name) > 11 else "Unknown"

                k = ride.ride_metrics
                
                db_bridge.execute_sql('''
                    INSERT INTO ride_summaries VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )
                ''', params=(
                    file_name, k['Total_Distance_km'], k['Total_Energy_Wh'], k['Overall_Wh_km'],
                    k['Max_Motor_Temp_C'], k['Max_IGBT_Temp_C'], k['Max_Pack_Temp_C'], k['Max_Pack_Spread_C'],
                    k['Max_IGBT_Rise_C'], k['Max_Motor_Rise_C'], k['Max_Pack_Rise_C'],
                    k['Start_Motor_Temp_C'], k['Start_IGBT_Temp_C'], k['Start_Pack_Temp_C'], k['Start_Pack_Delta_T_C'],
                    k['Time_in_Comfort_min'], k['Time_in_Power_min'], k['Time_in_Sprint_min'],
                    k['High_Torque_Time_sec'], processed_csv_path,
                    metadata["rider"], metadata["temp"], metadata["loc"], bike_id,
                    k['Avg_Torque_Nm'], k['Peak_Torque_Bursts'], k['Accel_Freq'], k['Speed_Osc_Index'], 
                    k['Pct_Sprint'], k['Torque_Burst_Idx'], k['Drive_Score'], k['Ride_Class']
                ), db_path=self.db_name)
                
                for ev in ride.ride_events:
                    db_bridge.execute_sql('''
                        INSERT INTO ride_events VALUES (?, ?, ?, ?, ?, ?)
                    ''', params=(file_name, ev["Event_Type"], ev["Start_Time"], ev["End_Time"], ev["Max_Value"], ev["Description"]), db_path=self.db_name)
            except Exception as e: print(f"Failed to process {file_name}: {e}")

        conn.close()