import os
import json
import pickle
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

BASELINE_FOLDER = os.path.join(BASE_DIR, "baseline_raw")
EVAL_FOLDER = os.path.join(BASE_DIR, "evaluation_raw")
PROCESSED_FOLDER = os.path.join(BASE_DIR, "processed_individual")
MASTER_FOLDER = os.path.join(BASE_DIR, "master")

REGISTRY_FILE = os.path.join(BASE_DIR, "registry.json")
BASELINE_STATS_FILE = os.path.join(MASTER_FOLDER, "baseline_stats.pkl")
MASTER_PROCESSED_FILE = os.path.join(MASTER_FOLDER, "master_processed.xlsx")
MASTER_SUMMARY_FILE = os.path.join(MASTER_FOLDER, "master_summary.xlsx")

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
            
    # 🎯 NEW: Dynamic Electrical/Mechanical Column Hunter
    required_columns = [
        "Time (s)", "IGBT Temp (oC)", "Motor_Temp (oC)", "highest_temp (oC)", 
        "AFE1-Temp", "AFE2-Temp", "AFE3-Temp", "AFE4-Temp"
    ]
    
    for col in df.columns:
        c_lower = str(col).lower()
        # 🚨 ADDED YOUR NEW KEYWORDS HERE (Including 'volatge', 'lowest_temp', 'lowt_cellno')
        search_terms = ["power", "rpm", "torque", "voltage", "volatge", "current", "lowest_temp", "lowt_cellno", "cumm_volatge"]
        if any(kw in c_lower for kw in search_terms) and col not in required_columns:
            required_columns.append(col)
    
    if cell_col and cell_col not in required_columns:
        required_columns.append(cell_col)

    cols_to_keep = [c for c in required_columns if c in df.columns]
    
    # Dropna only on critical thermal columns to prevent dropping rows just because voltage is missing
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
    
    # Check for actual power column name dynamically
    pwr_col = next((c for c in df.columns if "power" in str(c).lower()), None)
    if pwr_col:
        raw_stats["Power_Avg_120s"] = round(df_120[pwr_col].mean(), 2)
    else:
        raw_stats["Power_Avg_120s"] = 0

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

def save_individual(df, file_name):
    out_name = file_name.replace(".xlsx", "_processed.xlsx")
    df.to_excel(os.path.join(PROCESSED_FOLDER, out_name), index=False)

def update_master_processed(df, file_name):
    sheet_name = file_name.replace(".xlsx", "")[:31]
    if not os.path.exists(MASTER_PROCESSED_FILE):
        with pd.ExcelWriter(MASTER_PROCESSED_FILE, engine="openpyxl") as writer: df.to_excel(writer, sheet_name=sheet_name, index=False)
    else:
        with pd.ExcelWriter(MASTER_PROCESSED_FILE, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer: df.to_excel(writer, sheet_name=sheet_name, index=False)

def update_master_summary(df, file_name, raw_stats, test_type="Evaluation", eval_results=None):
    if eval_results is None:
        eval_results = {"Result_2Sigma": "NA", "Result_5Pct": "NA", "Result_10Pct": "NA", "Result_15Pct": "NA", "Result_20Pct": "NA"}

    summary_row = {
        "Test_Name": file_name.replace(".xlsx", ""), 
        "Type": test_type,
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
    
    new_row_df = pd.DataFrame([summary_row])
    if not os.path.exists(MASTER_SUMMARY_FILE):
        new_row_df.to_excel(MASTER_SUMMARY_FILE, index=False)
    else:
        existing = pd.read_excel(MASTER_SUMMARY_FILE)
        existing = existing[existing["Test_Name"] != summary_row["Test_Name"]]
        pd.concat([existing, new_row_df], ignore_index=True).to_excel(MASTER_SUMMARY_FILE, index=False)

def build_golden_envelope():
    print("\nBuilding Master Envelope using ONLY Hardcoded Golden Bikes...")
    dfs = []
    
    for f in os.listdir(PROCESSED_FOLDER):
        if f.endswith("_processed.xlsx"):
            is_golden = any(gold in f for gold in GOLDEN_BIKES)
            if is_golden:
                dfs.append(pd.read_excel(os.path.join(PROCESSED_FOLDER, f)))

    if not dfs: return

    combined = pd.concat(dfs)
    BASELINE_ENVELOPE_FILE = os.path.join(MASTER_FOLDER, "baseline_envelope.xlsx")
    components = {"IGBT": {"dTdt": "IGBT_dTdt", "dT": "IGBT_dT"}, "Motor": {"dTdt": "Motor_dTdt", "dT": "Motor_dT"}, "HighCell": {"dTdt": "HighCell_dTdt", "dT": "HighCell_dT"}, "AFE": {"dTdt": "AFE_Mean_dTdt", "dT": "AFE_Mean_dT"}}
    stats_for_eval = {} 

    with pd.ExcelWriter(BASELINE_ENVELOPE_FILE, engine="openpyxl") as writer:
        for comp_name, metrics in components.items():
            grouped = combined.groupby("Time (s)")
            col_time = grouped.mean().index
            out_df = pd.DataFrame({"Time (s)": col_time})

            for metric_type, col_name in metrics.items():
                mean = grouped[col_name].mean().values
                std = grouped[col_name].std().fillna(0).values

                out_df[f"{metric_type}_Mean"] = mean
                out_df[f"{metric_type}_Upper_2Sigma"] = mean + (2 * std)
                out_df[f"{metric_type}_Lower_2Sigma"] = mean - (2 * std)
                stats_for_eval[col_name] = {"Upper_2Sigma": pd.Series(mean + (2 * std), index=col_time), "Lower_2Sigma": pd.Series(mean - (2 * std), index=col_time)}

                for pct in [5, 10, 15, 20]:
                    factor = pct / 100.0
                    up_val = mean + (np.abs(mean) * factor)
                    low_val = mean - (np.abs(mean) * factor)
                    out_df[f"{metric_type}_Upper_{pct}Pct"] = up_val
                    out_df[f"{metric_type}_Lower_{pct}Pct"] = low_val
                    stats_for_eval[col_name][f"Upper_{pct}Pct"] = pd.Series(up_val, index=col_time)
                    stats_for_eval[col_name][f"Lower_{pct}Pct"] = pd.Series(low_val, index=col_time)

            out_df.to_excel(writer, sheet_name=comp_name, index=False)

    with open(BASELINE_STATS_FILE, "wb") as f: pickle.dump(stats_for_eval, f)

def evaluate_test(df):
    if not os.path.exists(BASELINE_STATS_FILE): return {"Result_2Sigma": "NA", "Result_5Pct": "NA", "Result_10Pct": "NA", "Result_15Pct": "NA", "Result_20Pct": "NA"}
    with open(BASELINE_STATS_FILE, "rb") as f: stats = pickle.load(f)
        
    results = {"Result_2Sigma": "PASS", "Result_5Pct": "PASS", "Result_10Pct": "PASS", "Result_15Pct": "PASS", "Result_20Pct": "PASS"}
    modes = [("2Sigma", "Upper_2Sigma"), ("5Pct", "Upper_5Pct"), ("10Pct", "Upper_10Pct"), ("15Pct", "Upper_15Pct"), ("20Pct", "Upper_20Pct")]
    
    for channel in stats:
        for mode_name, up_key in modes:
            if results[f"Result_{mode_name}"] == "FAIL": continue 
            
            upper = stats[channel][up_key]
            merged = df.merge(upper.rename("upper"), on="Time (s)")
            
            # 🔥 ONLY FAIL IF IT CROSSES THE UPPER BOUNDARY (LOWER IS ALWAYS BETTER!)
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

        save_individual(df, file_name)
        update_master_processed(df, file_name)
        
        is_golden = any(gold in file_name for gold in GOLDEN_BIKES)
        
        if is_golden:
            update_master_summary(df, file_name, raw_stats, test_type="Golden Baseline")
            golden_files_processed = True
        else:
            update_master_summary(df, file_name, raw_stats, test_type="Evaluation", eval_results=evaluate_test(df))
            
        registry["processed_files"].append(file_name)

    if golden_files_processed:
        build_golden_envelope()

    save_registry(registry)
    return {"Processed": len(all_new_files)}

if __name__ == "__main__":
    run_processing_cycle()