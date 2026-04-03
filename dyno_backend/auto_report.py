import os
import pandas as pd
from docxtpl import DocxTemplate

# ==========================================
# CONFIGURATION
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MASTER_SUMMARY_FILE = os.path.join(BASE_DIR, "master", "master_summary.xlsx")
PROCESSED_FOLDER = os.path.join(BASE_DIR, "processed_individual")
ENVELOPE_FILE = os.path.join(BASE_DIR, "master", "baseline_envelope.xlsx")
TEMPLATE_PATH = os.path.join(BASE_DIR, "VCH_Report_Template.docx")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "final_reports")

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

SNAPSHOT_TIME = 120  # 2 mins
TOLERANCE_PCT = 20   # 20% Envelope bounds

# Exact same golden bikes as your engine
GOLDEN_BIKES = ["2025_10_22-07-BK", "2025_10_09-14-BK", "2025_10_25-09-BK (Nw-BB)", 
                "2025_10_20-15-BK", "2025_10_19-17-BK", "2025_10_25-04-BK (Nw-BB)"]

def generate_reports():
    print("🔥 Starting VCH Auto-Report Generator...")
    
    if not os.path.exists(MASTER_SUMMARY_FILE) or not os.path.exists(TEMPLATE_PATH):
        print("🚨 Error: Master Summary or Template.docx not found!")
        return

    summary_df = pd.read_excel(MASTER_SUMMARY_FILE)
    
    # 1. CALCULATE GOLDEN MASTER POWER (from the summary file)
    golden_powers = []
    for index, row in summary_df.iterrows():
        if any(gold in row["Test_Name"] for gold in GOLDEN_BIKES):
            pwr = row.get("Power_Avg_120s", 0)
            if 19 <= pwr <= 20.5:
                golden_powers.append(pwr)
                
    master_golden_power = sum(golden_powers)/len(golden_powers) if golden_powers else 19.5
    pwr_upper = master_golden_power * 1.10
    pwr_lower = master_golden_power * 0.90

    # 2. LOAD ENVELOPE BOUNDS
    env_data = {}
    if os.path.exists(ENVELOPE_FILE):
        for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
            df_env = pd.read_excel(ENVELOPE_FILE, sheet_name=ch)
            env_row = df_env[df_env["Time (s)"] == SNAPSHOT_TIME]
            if not env_row.empty:
                env_data[ch] = {
                    "up_dtdt": env_row[f"dTdt_Upper_{TOLERANCE_PCT}Pct"].values[0],
                    "low_dtdt": env_row[f"dTdt_Lower_{TOLERANCE_PCT}Pct"].values[0],
                    "up_dt": env_row[f"dT_Upper_{TOLERANCE_PCT}Pct"].values[0],
                    "low_dt": env_row[f"dT_Lower_{TOLERANCE_PCT}Pct"].values[0]
                }

    # 3. GENERATE REPORTS FOR EACH BIKE
    for index, row in summary_df.iterrows():
        test_id = str(row["Test_Name"])
        
        # Parse metadata
        parts = test_id.split('-')
        test_date = parts[0] if len(parts) > 0 else "Unknown"
        bike_no = parts[1] if len(parts) > 1 else "Unknown"
        
        # Load Individual Processed File for Snapshot Data
        proc_file = os.path.join(PROCESSED_FOLDER, f"{test_id}_processed.xlsx")
        if not os.path.exists(proc_file):
            continue
        
        proc_df = pd.read_excel(proc_file)
        t_eval_row = proc_df[proc_df["Time (s)"] == SNAPSHOT_TIME]
        if t_eval_row.empty: continue
        
        total_duration = int(proc_df["Time (s)"].max())
        bike_power = row.get("Power_Avg_120s", 0)

        # Build Context Dictionary
        ctx = {
            "test_id": test_id, "test_date": test_date, "bike_no": bike_no,
            "total_duration": total_duration, "snapshot_time": SNAPSHOT_TIME,
            "env_tol": f"± {TOLERANCE_PCT}%",
            "golden_power": f"{master_golden_power:.2f}",
            "pwr_lower": f"{pwr_lower:.2f}", "pwr_upper": f"{pwr_upper:.2f}",
            "bike_power": f"{bike_power:.2f}",
            "power_status": "✅ PASS" if (pwr_lower <= bike_power <= pwr_upper) else "❌ FAIL"
        }

        # Check Derations & Top Summary Cards
        first_deration_time = None
        first_deration_comp = None
        failed_dt = []
        failed_dtdt = []

        channels = ["IGBT", "Motor", "HighCell", "AFE"]
        for ch in channels:
            # Summary Data (Top Cards)
            raw_max = row.get(f"{ch}_Raw_Max", "NA")
            peak_time = row.get(f"{ch}_Peak_Time", "NA")
            deration = row.get(f"{ch}_Deration_Time", "SAFE")
            
            status = "✅ PASS"
            if str(deration) != "SAFE":
                status = "❌ FAIL"
                d_time = float(deration)
                if first_deration_time is None or d_time < first_deration_time:
                    first_deration_time = d_time
                    first_deration_comp = ch

            ctx[f"{ch.lower()}_raw"] = raw_max
            ctx[f"{ch.lower()}_peak_time"] = peak_time
            ctx[f"{ch.lower()}_deration"] = deration
            ctx[f"{ch.lower()}_status"] = status
            
            if ch == "HighCell":
                cell_num = row.get("HighCell_Peak_Cell_No", "")
                ctx["highcell_cell"] = f"(Cell #{int(cell_num)})" if pd.notna(cell_num) else ""

            # Snapshot Data (120s)
            val_dtdt = t_eval_row[f"{ch}_dTdt" if ch != "AFE" else "AFE_Mean_dTdt"].values[0]
            val_dt = t_eval_row[f"{ch}_dT" if ch != "AFE" else "AFE_Mean_dT"].values[0]
            
            ctx[f"{ch.lower()}_dtdt"] = f"{val_dtdt:.3f}"
            ctx[f"{ch.lower()}_dt"] = f"{val_dt:.2f}"
            
            env_eval = "Within Limits"
            if ch in env_data:
                e = env_data[ch]
                if not (e["low_dtdt"] * 0.98 <= val_dtdt <= e["up_dtdt"]): 
                    failed_dtdt.append(ch)
                    env_eval = "Out of Bounds (dT/dt)"
                if not (e["low_dt"] * 0.98 <= val_dt <= e["up_dt"]): 
                    failed_dt.append(ch)
                    env_eval = "Out of Bounds (ΔT)"
            
            ctx[f"{ch.lower()}_env_eval"] = env_eval

        # First Deration Logic
        ctx["first_deration_text"] = "None"
        derated_early = False
        if first_deration_comp and first_deration_time < SNAPSHOT_TIME:
            ctx["first_deration_text"] = f"{first_deration_comp} at {first_deration_time}s"
            derated_early = True

        # Master QC Conclusion
        if derated_early: ctx["final_conclusion"] = "❌ FAIL (Early Deration)"
        elif failed_dt: ctx["final_conclusion"] = f"❌ FAIL (Cumm Temp: {', '.join(failed_dt)})"
        elif failed_dtdt: ctx["final_conclusion"] = f"❌ FAIL (Rise Rate: {', '.join(failed_dtdt)})"
        elif ctx["power_status"] == "❌ FAIL": ctx["final_conclusion"] = f"❌ FAIL (Power Dev: {bike_power:.1f}kW)"
        else: ctx["final_conclusion"] = "✅ PASS"

        if row.get("Type") == "Golden Baseline":
            ctx["final_conclusion"] = "✅ PASS (Golden Base)"

        # Render Word Doc
        doc = DocxTemplate(TEMPLATE_PATH)
        doc.render(ctx)
        out_path = os.path.join(OUTPUT_FOLDER, f"VCH_Report_{test_id}.docx")
        doc.save(out_path)
        print(f"✅ Auto-Generated: {out_path}")

if __name__ == "__main__":
    generate_reports()