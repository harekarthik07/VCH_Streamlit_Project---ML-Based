import os
import json
import pickle
import pandas as pd
import numpy as np
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Folders
BASELINE_FOLDER = os.path.join(BASE_DIR, "baseline_raw")
EVAL_FOLDER = os.path.join(BASE_DIR, "evaluation_raw")
PROCESSED_FOLDER = os.path.join(BASE_DIR, "Processed_Dyno")
MASTER_FOLDER = os.path.join(BASE_DIR, "master")

# Files
REGISTRY_FILE = os.path.join(BASE_DIR, "dyno_registry.json")
BASELINE_STATS_FILE = os.path.join(MASTER_FOLDER, "baseline_stats.pkl")
DB_PATH = os.path.join(BASE_DIR, "raptee_dyno.db") 

os.makedirs(BASELINE_FOLDER, exist_ok=True)
os.makedirs(EVAL_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(MASTER_FOLDER, exist_ok=True)

# =====================================================
# 🚨 STRICT GOLDEN BIKE LIST
# =====================================================
GOLDEN_BIKES = [
    "2025_10_22-07-BK",
    "2025_10_09-14-BK",
    "2025_10_25-09-BK (Nw-BB)",
    "2025_10_20-15-BK",
    "2025_10_19-17-BK",
    "2025_10_25-04-BK (Nw-BB)"
]

def load_registry():
    if not os.path.exists(REGISTRY_FILE): return {"processed_files": []}
    with open(REGISTRY_FILE, "r") as f: return json.load(f)

def save_registry(registry):
    with open(REGISTRY_FILE, "w") as f: json.dump(registry, f, indent=4)

def scan_new_files(registry):
    processed = registry["processed_files"]
    baseline_files = [f for f in os.listdir(BASELINE_FOLDER) if f.endswith(".xlsx") and f not in processed]
    eval_files = [f for f in os.listdir(EVAL_FOLDER) if f.endswith(".xlsx") and f not in processed]
    return baseline_files, eval_files

def process_raw_file(path):
    print(f"\nProcessing file: {os.path.basename(path)}")
    df = pd.read_excel(path)
    
    cell_col = None
    for c in df.columns:
        if "hight_cellno" in str(c).strip().lower() or "highest cell" in str(c).lower() or "cell no" in str(c).lower():
            cell_col = c
            break
            
    required_columns = [
        "Time (s)", "IGBT Temp (oC)", "Motor_Temp (oC)", "highest_temp (oC)", 
        "AFE1-Temp", "AFE2-Temp", "AFE3-Temp", "AFE4-Temp"
    ]
    
    for col in df.columns:
        c_lower = str(col).lower()
        search_terms = ["power", "rpm", "torque", "voltage", "volatge", "current", "lowest_temp", "lowt_cellno", "cumm_volatge"]
        if any(kw in c_lower for kw in search_terms) and col not in required_columns:
            required_columns.append(col)
    
    if cell_col and cell_col not in required_columns: required_columns.append(cell_col)

    cols_to_keep = [c for c in required_columns if c in df.columns]
    crit_cols = [c for c in ["Time (s)", "IGBT Temp (oC)", "Motor_Temp (oC)"] if c in df.columns]
    df = df[cols_to_keep].dropna(subset=crit_cols).reset_index(drop=True)
    
    if cell_col:
        df[cell_col] = pd.to_numeric(df[cell_col], errors='coerce').fillna(0)
        df = df.rename(columns={cell_col: "Highest_Cell_No"})
        
    return df

def limit_time_window(df, max_time=240): return df[df["Time (s)"] <= max_time].reset_index(drop=True)

def extract_raw_stats(df):
    limits = {"IGBT": 95, "Motor": 125, "HighCell": 50, "AFE": 50}
    temp_cols = {"IGBT": "IGBT Temp (oC)", "Motor": "Motor_Temp (oC)", "HighCell": "highest_temp (oC)"}
    
    if all(c in df.columns for c in ["AFE1-Temp", "AFE2-Temp", "AFE3-Temp", "AFE4-Temp"]):
        df["Raw_AFE_Mean"] = (df["AFE1-Temp"] + df["AFE2-Temp"] + df["AFE3-Temp"] + df["AFE4-Temp"]) / 4
        temp_cols["AFE"] = "Raw_AFE_Mean"

    raw_stats = {}
    for ch, col in temp_cols.items():
        if col not in df.columns: continue
        max_idx = df[col].idxmax()
        raw_stats[f"{ch}_Raw_Max"] = round(df.loc[max_idx, col], 2)
        raw_stats[f"{ch}_Peak_Time"] = round(df.loc[max_idx, "Time (s)"], 1)
        breaches = df[df[col] > limits[ch]]
        raw_stats[f"{ch}_Deration_Time"] = round(breaches.iloc[0]["Time (s)"], 1) if not breaches.empty else "SAFE"

        if ch == "HighCell" and "Highest_Cell_No" in df.columns:
            raw_stats["HighCell_Peak_Cell_No"] = int(df.loc[max_idx, "Highest_Cell_No"])
            
    df_120 = df[df["Time (s)"] <= 120]
    pwr_col = next((c for c in df.columns if "power" in str(c).lower()), None)
    if pwr_col:
        raw_stats["Power_Avg_120s"] = round(df_120[pwr_col].mean(), 2)
    else:
        raw_stats["Power_Avg_120s"] = 0

    # 🌟 NEW: SMART DCIR (PACK RESISTANCE) CALCULATOR
    vol_col_candidates = ["Cumm_Volatge (V)", "Cumm_Voltage (V)", "DC_Volatge (V)", "DC_Voltage (V)"]
    vol_col = next((c for c in df.columns if c in vol_col_candidates), None)
    if not vol_col:
        vol_col = next((c for c in df.columns if ('voltage' in c.lower() or 'volatge' in c.lower()) and 'highest' not in c.lower() and 'lowest' not in c.lower()), None)
        
    cur_col_candidates = ["FG_Current (A)", "DC_Current (A)", "Current (A)"]
    cur_col = next((c for c in df.columns if c in cur_col_candidates), None)
    if not cur_col:
        cur_col = next((c for c in df.columns if 'current' in c.lower()), None)
    
    dcir_mohm = 0.0
    if vol_col and cur_col:
        try:
            cur_abs = df[cur_col].abs()
            # Step 1: Find the FIRST time current crosses above 30A (the load application event)
            threshold = 30.0
            crossing_mask = cur_abs > threshold
            if crossing_mask.any():
                first_cross_idx = crossing_mask.idxmax()
                
                # Step 2: Look BACKWARD from the crossing for the lowest absolute current
                #         (the true quiet rest point just before load was applied)
                lookback = df.index.get_loc(first_cross_idx)
                start_bound_loc = max(0, lookback - 60)  # look back up to 60 samples (~30s at 2Hz)
                pre_load = df.iloc[start_bound_loc:lookback + 1]
                rest_idx = pre_load[cur_col].abs().idxmin()
                
                # Step 3: Look FORWARD from the crossing for the saturation peak
                #         (the actual peak current value for this specific bike)
                end_bound_loc = min(len(df), lookback + 60)  # look forward up to 60 samples
                post_load = df.iloc[lookback:end_bound_loc]
                if df[cur_col].mean() < 0:
                    load_idx = post_load[cur_col].idxmin()
                else:
                    load_idx = post_load[cur_col].idxmax()
                
                v_rest = df.loc[rest_idx, vol_col]
                i_rest = df.loc[rest_idx, cur_col]
                v_load = df.loc[load_idx, vol_col]
                i_load = df.loc[load_idx, cur_col]
                
                delta_i = abs(i_load - i_rest)
                if delta_i > 15.0:  # sanity check: minimum valid load step is 15A
                    dcir_mohm = round((abs(v_rest - v_load) / delta_i) * 1000, 2)
        except Exception:
            pass
                    
    raw_stats["Pack_DCIR_mOhm"] = dcir_mohm

    return raw_stats

def extract_10s_intervals(df):
    target_times = np.arange(0, df["Time (s)"].max() + 10, 10)
    target_df = pd.DataFrame({"Time (s)": target_times})
    df_sorted = df.sort_values("Time (s)")
    extracted = pd.merge_asof(target_df, df_sorted, on="Time (s)", direction="forward")
    return extracted.dropna(subset=["IGBT Temp (oC)"]).reset_index(drop=True)

def compute_afe_mean(df):
    df["AFE_Mean_Temp"] = (df["AFE1-Temp"] + df["AFE2-Temp"] + df["AFE3-Temp"] + df["AFE4-Temp"]) / 4
    return df

def compute_slope(df, col):
    slope = (df[col] - df[col].shift(1)) / 10
    slope.iloc[0] = 0   
    return slope

def save_individual_csv(df, file_name):
    parquet_filename = file_name.replace(".xlsx", "_processed.parquet")
    save_path = os.path.join(PROCESSED_FOLDER, parquet_filename)
    df.to_parquet(save_path, index=False, engine='pyarrow')
    return save_path

def update_db_summary(file_name, raw_stats, df, csv_path, test_type="Evaluation", eval_results=None):
    if eval_results is None:
        eval_results = {"Result_2Sigma": "NA", "Result_5Pct": "NA", "Result_10Pct": "NA", "Result_15Pct": "NA", "Result_20Pct": "NA"}

    summary_row = {
        "Test_Name": file_name.replace(".xlsx", ""), 
        "Type": test_type,
        "Processed_CSV_Path": csv_path,
        **raw_stats,
        "IGBT_dTdt_Max": round(df["IGBT_dTdt"].max(), 3),
        "Motor_dTdt_Max": round(df["Motor_dTdt"].max(), 3),
        "HighCell_dTdt_Max": round(df["HighCell_dTdt"].max(), 3),
        "AFE_dTdt_Max": round(df["AFE_Mean_dTdt"].max(), 3),
        "IGBT_dT_Max": round(df["IGBT_dT"].max(), 2),
        "Motor_dT_Max": round(df["Motor_dT"].max(), 2),
        "HighCell_dT_Max": round(df["HighCell_dT"].max(), 2),
        "AFE_dT_Max": round(df["AFE_Mean_dT"].max(), 2),
        **eval_results
    }
    
    conn = sqlite3.connect(DB_PATH)
    new_row_df = pd.DataFrame([summary_row])
    new_row_df.to_sql("dyno_summaries", conn, if_exists="append", index=False)
    conn.close()

def build_golden_envelope():
    print("\nBuilding Master Envelope using ONLY Hardcoded Golden Bikes...")
    dfs = []
    
    for f in os.listdir(PROCESSED_FOLDER):
        if f.endswith("_processed.parquet"):
            is_golden = any(gold in f for gold in GOLDEN_BIKES)
            if is_golden: 
                dfs.append(pd.read_parquet(os.path.join(PROCESSED_FOLDER, f), engine='pyarrow'))

    if not dfs: 
        print("⚠️ No Golden Bikes found in Processed folder. Envelope not built.")
        return

    combined = pd.concat(dfs)
    components = {"IGBT": {"dTdt": "IGBT_dTdt", "dT": "IGBT_dT"}, "Motor": {"dTdt": "Motor_dTdt", "dT": "Motor_dT"}, "HighCell": {"dTdt": "HighCell_dTdt", "dT": "HighCell_dT"}, "AFE": {"dTdt": "AFE_Mean_dTdt", "dT": "AFE_Mean_dT"}}
    stats_for_eval = {} 
    
    conn = sqlite3.connect(DB_PATH)

    for comp_name, metrics in components.items():
        grouped = combined.groupby("Time (s)")
        col_time = grouped.mean().index
        out_df = pd.DataFrame({"Time (s)": col_time})

        for metric_type, col_name in metrics.items():
            mean = grouped[col_name].mean().values
            std = grouped[col_name].std().fillna(0).values

            out_df[f"dTdt_Mean" if metric_type == "dTdt" else "dT_Mean"] = mean
            out_df[f"dTdt_Upper_2Sigma" if metric_type == "dTdt" else "dT_Upper_2Sigma"] = mean + (2 * std)
            out_df[f"dTdt_Lower_2Sigma" if metric_type == "dTdt" else "dT_Lower_2Sigma"] = mean - (2 * std)
            stats_for_eval[col_name] = {"Upper_2Sigma": pd.Series(mean + (2 * std), index=col_time), "Lower_2Sigma": pd.Series(mean - (2 * std), index=col_time)}

            for pct in [5, 10, 15, 20]:
                factor = pct / 100.0
                up_val = mean + (np.abs(mean) * factor)
                low_val = mean - (np.abs(mean) * factor)
                out_df[f"dTdt_Upper_{pct}Pct" if metric_type == "dTdt" else f"dT_Upper_{pct}Pct"] = up_val
                out_df[f"dTdt_Lower_{pct}Pct" if metric_type == "dTdt" else f"dT_Lower_{pct}Pct"] = low_val
                stats_for_eval[col_name][f"Upper_{pct}Pct"] = pd.Series(up_val, index=col_time)
                stats_for_eval[col_name][f"Lower_{pct}Pct"] = pd.Series(low_val, index=col_time)

        out_df.to_sql(f"envelope_{comp_name}", conn, if_exists="replace", index=False)

    conn.close()
    with open(BASELINE_STATS_FILE, "wb") as f: pickle.dump(stats_for_eval, f)
    print("✅ Master Golden Envelope successfully built and saved to SQL!")

def evaluate_test(df):
    if not os.path.exists(BASELINE_STATS_FILE): return {"Result_2Sigma": "NA", "Result_5Pct": "NA", "Result_10Pct": "NA", "Result_15Pct": "NA", "Result_20Pct": "NA"}
    with open(BASELINE_STATS_FILE, "rb") as f: stats = pickle.load(f)
        
    results = {"Result_2Sigma": "PASS", "Result_5Pct": "PASS", "Result_10Pct": "PASS", "Result_15Pct": "PASS", "Result_20Pct": "PASS"}
    modes = [("2Sigma", "Upper_2Sigma", "Lower_2Sigma"), ("5Pct", "Upper_5Pct", "Lower_5Pct"), ("10Pct", "Upper_10Pct", "Lower_10Pct"), ("15Pct", "Upper_15Pct", "Lower_15Pct"), ("20Pct", "Upper_20Pct", "Lower_20Pct")]
    
    for channel in stats:
        for mode_name, up_key, low_key in modes:
            if results[f"Result_{mode_name}"] == "FAIL": continue 
            
            upper = stats[channel][up_key]
            merged = df.merge(upper.rename("upper"), on="Time (s)")
            
            if len(merged[merged[channel] > merged["upper"]]) > 0:
                results[f"Result_{mode_name}"] = "FAIL"
                
    return results

def run_processing_cycle():
    registry = load_registry()
    new_baseline, new_eval = scan_new_files(registry)
    all_new_files = new_baseline + new_eval
    
    golden_files_processed = False

    for file_name in all_new_files:
        folder_path = BASELINE_FOLDER if file_name in new_baseline else EVAL_FOLDER
        
        raw_df = limit_time_window(process_raw_file(os.path.join(folder_path, file_name)))
        raw_stats = extract_raw_stats(raw_df)
        df = compute_afe_mean(extract_10s_intervals(raw_df))
        
        df["IGBT_dTdt"] = compute_slope(df, "IGBT Temp (oC)")
        df["Motor_dTdt"] = compute_slope(df, "Motor_Temp (oC)")
        df["HighCell_dTdt"] = compute_slope(df, "highest_temp (oC)")
        df["AFE_Mean_dTdt"] = compute_slope(df, "AFE_Mean_Temp")
        df["IGBT_dT"] = df["IGBT Temp (oC)"] - df["IGBT Temp (oC)"].iloc[0]
        df["Motor_dT"] = df["Motor_Temp (oC)"] - df["Motor_Temp (oC)"].iloc[0]
        df["HighCell_dT"] = df["highest_temp (oC)"] - df["highest_temp (oC)"].iloc[0]
        df["AFE_Mean_dT"] = df["AFE_Mean_Temp"] - df["AFE_Mean_Temp"].iloc[0]
        df.loc[0, ["IGBT_dT", "Motor_dT", "HighCell_dT", "AFE_Mean_dT"]] = 0

        csv_path = save_individual_csv(df, file_name)
        
        is_golden = any(gold in file_name for gold in GOLDEN_BIKES)
        
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.execute("DELETE FROM dyno_summaries WHERE Test_Name = ?", (file_name.replace(".xlsx", ""),))
            conn.commit()
            conn.close()
        except sqlite3.OperationalError:
            pass

        if is_golden:
            update_db_summary(file_name, raw_stats, df, csv_path, test_type="Golden Baseline")
            golden_files_processed = True
        else:
            update_db_summary(file_name, raw_stats, df, csv_path, test_type="Evaluation", eval_results=evaluate_test(df))
            
        registry["processed_files"].append(file_name)

    if golden_files_processed:
        build_golden_envelope()

    save_registry(registry)
    return {"Processed": len(all_new_files)}

class DynoDBManager:
    """Minimal wrapper exposing dyno test loading for FastAPI.
    In a full implementation this would query the SQLite DB or load processed CSVs.
    For now it returns a placeholder dict with the requested test_id.
    """
    def __init__(self, db_path=None):
        self.db_path = db_path or DB_PATH
    def load_test(self, test_id: str):
        """Return a minimal representation of a dyno test.
        Args:
            test_id: Identifier of the dyno test.
        Returns:
            dict with placeholder data.
        """
        return {"test_id": test_id, "message": "Dyno test data placeholder"}


if __name__ == "__main__":
    run_processing_cycle()