import os
import pandas as pd
import numpy as np

# 🎯 CROSS-REFERENCE THE NEW ML ENGINE
from ml_model import ml_engine

class ThermalRide:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.base_filename = os.path.basename(file_path) 
        self.raw_signals = {}
        self.master_2hz = None
        self.ride_metrics = {}
        self.ride_events = []

    def ingest(self):
        print(f"[{self.base_filename}] Loading entire Excel workbook into memory...")
        try:
            xls = pd.ExcelFile(self.file_path)
            
            # 🛡️ THE ULTIMATE BULLETPROOF & DYNAMIC LOADER
            def load_sheet(sheet_name, core_cols):
                if sheet_name not in xls.sheet_names:
                    print(f"  ⚠️ Warning: Sheet '{sheet_name}' is missing! Injecting Ghost Sheet.")
                    ghost_data = {col: [100.0] if col == 'soh' else [0.0] for col in core_cols}
                    if 'Time' not in ghost_data: ghost_data['Time'] = [0.0]
                    df = pd.DataFrame(ghost_data)
                else:
                    df = pd.read_excel(xls, sheet_name=sheet_name)
                    
                    # 1. STANDARDIZE TIME FIRST (Prevents duplicate 'Time' columns!)
                    t_col = [c for c in df.columns if 'time' in str(c).lower() and c != 'Time']
                    if t_col: 
                        df.rename(columns={t_col[0]: 'Time'}, inplace=True)
                    
                    if 'Time' not in df.columns:
                        df['Time'] = 0.0
                        
                    # 2. INJECT MISSING CORE COLUMNS
                    for col in core_cols:
                        if col not in df.columns:
                            df[col] = 100.0 if col == 'soh' else 0.0
                
                # 3. SMART TAGGING: Prefix all non-core columns with their CAN ID for Streamlit
                rename_dict = {}
                for c in df.columns:
                    if c != 'Time' and c not in core_cols:
                        rename_dict[c] = f"[{sheet_name}] {c}"
                df.rename(columns=rename_dict, inplace=True)
                
                # 🛡️ FATAL TRAP PREVENTER: Destroy any accidental duplicate columns
                df = df.loc[:, ~df.columns.duplicated()]
                
                # 🔥 FORCE TIME TO BE STRICT NUMERIC TO PREVENT MERGE CRASHES
                df['Time'] = pd.to_numeric(df['Time'], errors='coerce').astype('float64')
                df.dropna(subset=['Time'], inplace=True)
                
                return df
            
            # Load the Core Sheets (Keeps original column names for math stability)
            df_soc = load_sheet('0x111_SOC', ['Time', 'cumulative_totv [V]', 'current [A]', 'soc', 'soh'])
            df_vol = load_sheet('0x112_VOLTAGE', ['Time', 'highest_vol [V]', 'lowest_vol [V]'])
            df_temp = load_sheet('0x113_TEMP', ['Time', 'highest_temp [C]', 'hight_cellno', 'lowest_temp [C]', 'lowt_cellno'])
            # --- EXTENDED AFE TEMP FALLBACK ---
            if '0x118_Segment_temp' in xls.sheet_names:
                df_afe = load_sheet('0x118_Segment_temp', ['Time', 'afe_temp1', 'afe_temp2', 'afe_temp3', 'afe_temp4'])
                afe_cols = [c for c in df_afe.columns if 'afe_temp' in c and not c.startswith('[')]
                if afe_cols: df_afe[afe_cols] = df_afe[afe_cols] / 8.0 
            elif '0x8_String_temp_1to8' in xls.sheet_names:
                df_afe1 = load_sheet('0x8_String_temp_1to8', ['Time'])
                df_afe2 = load_sheet('0x9_String_temp_9to16', ['Time'])
                df_afe3 = load_sheet('0xA_String_temp_17to24', ['Time'])
                df_afe4 = load_sheet('0xB_String_temp_25to32', ['Time'])
                
                df_afe = df_afe1[['Time']].copy()
                
                def sum_string_cols(df_str):
                    cols = [c for c in df_str.columns if 'Time' not in str(c)]
                    return df_str[cols].sum(axis=1) if cols else pd.Series(0, index=df_str.index)

                df_afe['afe_temp1'] = sum_string_cols(df_afe1) * 0.1 / 8.0
                df_afe['afe_temp2'] = sum_string_cols(df_afe2) * 0.1 / 8.0
                df_afe['afe_temp3'] = sum_string_cols(df_afe3) * 0.1 / 8.0
                df_afe['afe_temp4'] = sum_string_cols(df_afe4) * 0.1 / 8.0
            else:
                df_afe = load_sheet('0x118_Segment_temp', ['Time', 'afe_temp1', 'afe_temp2', 'afe_temp3', 'afe_temp4'])
            # -----------------------------------
            
            df_mc_stat = load_sheet('0x123_MC_Status', ['Time', 'IGBT_Temp [C]', 'Motor_Temp [C]', 'Motor_Torque [Nm]', 'Drive_Mode'])
            
            df_mc_pwr = load_sheet('0x121_Power_Params', ['Time', 'Throttle', 'RPM [RPM]', 'DC_Volatge [V]', 'DC_Current [A]'])
            df_abs = load_sheet('0x12B_ABS_Info', ['Time', 'Front_Speed [kph]'])
            df_vcu = load_sheet('0x125_VcuStatus', ['Time', 'ModeSw', 'BrakeSw'])

            # Load the NEW Requested Sheets (Automatically grabs ALL columns and prefixes them)
            # --- EXTENDED STRINGS VOLTAGE FALLBACK ---
            if '0x116_Segment_voltage' in xls.sheet_names:
                df_seg_vol = load_sheet('0x116_Segment_voltage', ['Time'])
            elif '0x0_String_voltage_1to8' in xls.sheet_names:
                df_v1 = load_sheet('0x0_String_voltage_1to8', ['Time'])
                df_v2 = load_sheet('0x1_String_voltage_9to16', ['Time'])
                df_v3 = load_sheet('0x2_String_voltage_17to24', ['Time'])
                df_v4 = load_sheet('0x3_String_voltage_25to32', ['Time'])
                df_v5 = load_sheet('0x4_String_voltage_33to40', ['Time'])
                df_v6 = load_sheet('0x5_String_voltage_41to48', ['Time'])
                df_v7 = load_sheet('0x6_String_voltage_49to56', ['Time'])
                df_v8 = load_sheet('0x7_String_voltage_57to64', ['Time'])
                
                df_seg_vol = df_v1[['Time']].copy()
                
                # AFE 1: Strings 1to8 (0x0) & 9to16 (0x1) 
                df_seg_vol['[0x116_Segment_voltage] afe_voltage1'] = (sum_string_cols(df_v1) + sum_string_cols(df_v2)) * 0.1 / 16.0
                df_seg_vol['[0x116_Segment_voltage] afe_voltage2'] = (sum_string_cols(df_v3) + sum_string_cols(df_v4)) * 0.1 / 16.0
                df_seg_vol['[0x116_Segment_voltage] afe_voltage3'] = (sum_string_cols(df_v5) + sum_string_cols(df_v6)) * 0.1 / 16.0
                df_seg_vol['[0x116_Segment_voltage] afe_voltage4'] = (sum_string_cols(df_v7) + sum_string_cols(df_v8)) * 0.1 / 16.0
            else:
                df_seg_vol = load_sheet('0x116_Segment_voltage', ['Time'])
            # ----------------------------------------
            
            mc_err_name = '0x120_MC_Erros'
            if mc_err_name not in xls.sheet_names and '0x120_FCAN_Send_ID_7' in xls.sheet_names:
                mc_err_name = '0x120_FCAN_Send_ID_7'
            df_mc_err = load_sheet(mc_err_name, ['Time'])
            
            df_dq = load_sheet('0x122_DQ_Params', ['Time'])
            df_mc_cnt = load_sheet('0x124_MC_Counters', ['Time'])

            # Store mapping so sync() can merge them all dynamically
            self.raw_signals = {
                "0x111_SOC": df_soc, "0x112_VOLTAGE": df_vol, "0x113_TEMP": df_temp, 
                "0x118_Segment_temp": df_afe, "0x123_MC_Status": df_mc_stat, 
                "0x121_Power_Params": df_mc_pwr, "0x12B_ABS_Info": df_abs, 
                "0x125_VcuStatus": df_vcu, "0x116_Segment_voltage": df_seg_vol,
                "0x120_MC_Erros": df_mc_err, "0x122_DQ_Params": df_dq, 
                "0x124_MC_Counters": df_mc_cnt
            }
        except Exception as e:
            print(f"❌ Ingestion Error: {e}")
        return self

    def sync(self):
        valid_dfs = [df for df in self.raw_signals.values() if not df.empty]
        if not valid_dfs: return self

        start_time = min([df['Time'].min() for df in valid_dfs])
        end_time = max([df['Time'].max() for df in valid_dfs])
        
        master_time_arr = np.arange(start_time, end_time, 0.5, dtype='float64')
        df_master = pd.DataFrame({'Time': master_time_arr})

        for sheet_name, df in self.raw_signals.items():
            if df.empty: continue
            df['Time'] = df['Time'].astype('float64')
            df.sort_values(by='Time', inplace=True)
            
            # Prevent duplicate column conflicts during merge
            cols_to_use = ['Time'] + [c for c in df.columns if c != 'Time' and c not in df_master.columns]
            df = df[cols_to_use]

            if sheet_name == '0x12B_ABS_Info':
                bins = np.append(master_time_arr, master_time_arr[-1] + 0.5)
                df['Time_Bin'] = pd.cut(df['Time'], bins=bins, labels=master_time_arr, include_lowest=True)
                num_cols = [c for c in df.columns if c not in ['Time', 'Time_Bin'] and pd.api.types.is_numeric_dtype(df[c])]
                abs_downsampled = df.groupby('Time_Bin', observed=False)[num_cols].mean().reset_index()
                abs_downsampled.rename(columns={'Time_Bin': 'Time'}, inplace=True)
                
                # 🔥 THE BUG KILLER: pd.cut creates an "Object/Category". We MUST cast it back to float64!
                abs_downsampled['Time'] = abs_downsampled['Time'].astype('float64') 
                
                df_master = pd.merge(df_master, abs_downsampled, on='Time', how='left')
            else:
                df_master = pd.merge_asof(df_master, df, on='Time', direction='backward', tolerance=1.0)

        # Forward fill to ensure ML models and graphs don't break on NaN gaps
        df_master.ffill(inplace=True)
        
        # 🔥 THE ZERO-DROP FIX: Backfill the start of the ride before we inject zeros!
        df_master.bfill(inplace=True) 
        
        # 🛡️ THE STRING COLUMN BUG FIX
        for col in df_master.columns:
            if pd.api.types.is_numeric_dtype(df_master[col]):
                df_master[col] = df_master[col].fillna(0.0)
            else:
                df_master[col] = df_master[col].fillna("UNKNOWN").astype(str)

        self.master_2hz = df_master
        return self

    def compute_features(self):
        if self.master_2hz is None: return self
        df = self.master_2hz.copy()
        
        df['Pack_Overall_Temp [C]'] = (df['afe_temp1'] + df['afe_temp2'] + df['afe_temp3'] + df['afe_temp4']) / 4.0
        t0_high, t0_low, t0_pack = df['highest_temp [C]'].iloc[0], df['lowest_temp [C]'].iloc[0], df['Pack_Overall_Temp [C]'].iloc[0]
        t0_motor, t0_igbt = df['Motor_Temp [C]'].iloc[0], df['IGBT_Temp [C]'].iloc[0]
        
        df['High_Cell_Rise_from_T0 [C]'] = df['highest_temp [C]'] - t0_high
        df['Low_Cell_Rise_from_T0 [C]'] = df['lowest_temp [C]'] - t0_low
        df['Pack_Temp_Rise_from_T0 [C]'] = df['Pack_Overall_Temp [C]'] - t0_pack
        df['Motor_Temp_Rise_from_T0 [C]'] = df['Motor_Temp [C]'] - t0_motor
        df['IGBT_Temp_Rise_from_T0 [C]'] = df['IGBT_Temp [C]'] - t0_igbt
        df['Delta_T_Pack [C]'] = df['highest_temp [C]'] - df['lowest_temp [C]']
        
        df['Instant_Power [W]'] = df['cumulative_totv [V]'] * df['current [A]'].abs()
        df['Energy_Consumed [Wh]'] = (df['Instant_Power [W]'] * (0.5 / 3600)).cumsum()
        df['Distance_km'] = (df['Front_Speed [kph]'] * (0.5 / 3600)).cumsum()
        df['Wh/km_Cumulative'] = np.where(df['Distance_km'] > 0.01, df['Energy_Consumed [Wh]'] / df['Distance_km'], 0)
        
        rolling_energy_wh = (df['Instant_Power [W]'] * (0.5 / 3600)).rolling(window=20, min_periods=1).sum()
        rolling_dist_km = (df['Front_Speed [kph]'] * (0.5 / 3600)).rolling(window=20, min_periods=1).sum()
        df['Wh/km_Rolling_10s'] = np.where(rolling_dist_km > 0.001, rolling_energy_wh / rolling_dist_km, 0)
        
        df['Accel [kph/s]'] = df['Front_Speed [kph]'].diff() / 0.5
        
        self.master_2hz = df
        return self

    def compute_ride_metrics(self):
        if self.master_2hz is None: return self
        df = self.master_2hz
        
        total_distance = df['Distance_km'].iloc[-1]
        total_energy = df['Energy_Consumed [Wh]'].iloc[-1]
        overall_wh_km = total_energy / total_distance if total_distance > 0 else 0
        total_time = df['Time'].max()
        total_mins = total_time / 60.0
        
        time_comfort_sec = len(df[df['Drive_Mode'] == 0]) * 0.5
        time_power_sec = len(df[df['Drive_Mode'] == 1]) * 0.5
        time_sprint_sec = len(df[df['Drive_Mode'] == 2]) * 0.5
        pct_sprint = (time_sprint_sec / total_time) * 100 if total_time > 0 else 0
        
        avg_torque = df['Motor_Torque [Nm]'].abs().mean()
        torque_burst_idx = (len(df[df['Motor_Torque [Nm]'] > 40]) / len(df)) * 100 
        high_torque_bursts = len(df[df['Motor_Torque [Nm]'] > 50]) * 0.5 
        torque_flag = (df['Motor_Torque [Nm]'] > 50).astype(int)
        peak_torque_burst_count = int((torque_flag.diff() == 1).sum())
        
        accel_freq = int(len(df[df['Accel [kph/s]'] > 3.0]))
        accel_freq_per_min = accel_freq / total_mins if total_mins > 0 else 0
        spd_osc = df['Accel [kph/s]'].std()

        feature_vector = [float(avg_torque), float(accel_freq_per_min), float(pct_sprint), float(overall_wh_km), float(spd_osc)]
        
        # Calculate MATLAB-style penalties from raw telemetry
        penalty_dict = ml_engine.calculate_penalties(df)
        
        # Hybrid score: ML base adjusted by penalties
        drive_score = float(ml_engine.predict_score(feature_vector, penalty_dict))

        if drive_score <= 30: ride_class = "Efficient"
        elif drive_score <= 60: ride_class = "Road Mixed"
        else: ride_class = "Office Push"

        self.ride_metrics = {
            "Total_Distance_km": float(round(total_distance, 2)), 
            "Total_Energy_Wh": float(round(total_energy, 2)), 
            "Overall_Wh_km": float(round(overall_wh_km, 2)),
            "Max_Motor_Temp_C": float(round(df['Motor_Temp [C]'].max(), 1)), 
            "Max_IGBT_Temp_C": float(round(df['IGBT_Temp [C]'].max(), 1)), 
            "Max_Pack_Temp_C": float(round(df['highest_temp [C]'].max(), 1)),
            "Max_Pack_Spread_C": float(round(df['Delta_T_Pack [C]'].max(), 1)), 
            "Max_IGBT_Rise_C": float(round(df['IGBT_Temp_Rise_from_T0 [C]'].max(), 1)),
            "Max_Motor_Rise_C": float(round(df['Motor_Temp_Rise_from_T0 [C]'].max(), 1)), 
            "Max_Pack_Rise_C": float(round(df['Pack_Temp_Rise_from_T0 [C]'].max(), 1)),
            "Start_Motor_Temp_C": float(round(df['Motor_Temp [C]'].iloc[0], 1)), 
            "Start_IGBT_Temp_C": float(round(df['IGBT_Temp [C]'].iloc[0], 1)),
            "Start_Pack_Temp_C": float(round(df['lowest_temp [C]'].iloc[0], 1)), 
            "Start_Pack_Delta_T_C": float(round(df['Delta_T_Pack [C]'].iloc[0], 1)),
            "Time_in_Comfort_min": float(round(time_comfort_sec / 60, 2)), 
            "Time_in_Power_min": float(round(time_power_sec / 60, 2)), 
            "Time_in_Sprint_min": float(round(time_sprint_sec / 60, 2)),
            "High_Torque_Time_sec": float(high_torque_bursts),
            "Pct_Sprint": float(round(pct_sprint, 1)), 
            "Avg_Torque_Nm": float(round(avg_torque, 1)), 
            "Peak_Torque_Bursts": int(peak_torque_burst_count),
            "Accel_Freq": int(accel_freq), 
            "Speed_Osc_Index": float(round(spd_osc, 2)), 
            "Torque_Burst_Idx": float(round(torque_burst_idx, 1)),
            "Drive_Score": float(drive_score), 
            "Ride_Class": str(ride_class),
            "Penalty_Throttle": penalty_dict.get("p_thr_max", 0),
            "Penalty_Velocity": penalty_dict.get("p_v_max", 0),
            "Penalty_Regen": penalty_dict.get("p_rgn_max", 0),
            "Penalty_Brake": penalty_dict.get("p_bs_max", 0),
            "Brake_Switch_Count": penalty_dict.get("bs_count", 0)
        }
        
        events = []
        def extract_events(cond_series, ev_type, val_series, desc_fmt):
            blocks = df[cond_series].groupby((~cond_series).cumsum())
            for _, block in blocks:
                if len(block) > 0:
                    events.append({
                        "Event_Type": str(ev_type), 
                        "Start_Time": float(round(block['Time'].iloc[0], 1)), 
                        "End_Time": float(round(block['Time'].iloc[-1], 1)),
                        "Max_Value": float(round(block[val_series.name].max(), 2)), 
                        "Description": str(desc_fmt.format(round(block[val_series.name].max(), 1)))
                    })
        
        extract_events(df['Motor_Temp [C]'] > 125, "Motor Deration", df['Motor_Temp [C]'], "Peak Temp: {}°C")
        extract_events(df['IGBT_Temp [C]'] > 95, "IGBT Deration", df['IGBT_Temp [C]'], "Peak Temp: {}°C")
        extract_events(df['Motor_Torque [Nm]'] > 50, "Torque Burst", df['Motor_Torque [Nm]'], "Peak Torque: {}Nm")
        extract_events(df['Wh/km_Rolling_10s'] > 65, "High Drain Window", df['Wh/km_Rolling_10s'], "Peak Wh/km: {}")
        
        self.ride_events = events
        return self