from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import sqlite3
import pandas as pd
import shutil
import io
import sys

# Import backend modules
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "dyno_backend"))
import dyno_db_manager as dyno_engine

app = FastAPI(title="VCH Master Dashboard API", description="High Performance Data Pipeline")

# Paths
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DYNO_DB = os.path.join(ROOT_DIR, "dyno_backend", "raptee_dyno.db")
ROAD_DB = os.path.join(ROOT_DIR, "road_backend", "raptee_rides.db")

# Allow Next.js frontend (ports 3000 and 3001) to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "success", "message": "FastAPI VCH Bridge is actively running."}

# ---------- Fleet Registry ----------
@app.get("/api/fleet")
def get_fleet():
    """Return the list of all bikes from the bike registry as JSON."""
    from bike_backend.bike_db_manager import load_bike_registry
    return load_bike_registry()

# ---------- Dyno Suite: Test Summaries ----------
@app.get("/api/dyno/summaries")
def get_dyno_summaries():
    """Return all dyno test summaries from the SQLite database."""
    if not os.path.exists(DYNO_DB):
        return []
    try:
        conn = sqlite3.connect(DYNO_DB)
        df = pd.read_sql_query("SELECT * FROM dyno_summaries", conn)
        conn.close()
        # Convert DataFrame to list of dicts for JSON
        return df.to_dict(orient="records")
    except Exception as e:
        return {"error": str(e)}

# ---------- Dyno Suite: Envelope Data ----------
@app.get("/api/dyno/envelope/{channel}")
def get_dyno_envelope(channel: str):
    """Return the golden envelope data for a specific channel (IGBT, Motor, HighCell, AFE)."""
    if not os.path.exists(DYNO_DB):
        return []
    try:
        conn = sqlite3.connect(DYNO_DB)
        df = pd.read_sql_query(f"SELECT * FROM envelope_{channel}", conn)
        conn.close()
        return df.to_dict(orient="records")
    except Exception as e:
        return {"error": str(e)}

# ---------- Dyno Suite: Individual Test Telemetry ----------
@app.get("/api/dyno/telemetry/{test_name}")
def get_dyno_telemetry(test_name: str):
    """Load the processed parquet/csv for a specific test and return as JSON."""
    if not os.path.exists(DYNO_DB):
        return {"error": "Database not found"}
    try:
        conn = sqlite3.connect(DYNO_DB)
        row = pd.read_sql_query(f"SELECT Processed_CSV_Path FROM dyno_summaries WHERE Test_Name = ?", conn, params=(test_name,))
        conn.close()
        if row.empty:
            return {"error": f"Test '{test_name}' not found"}
        
        csv_path = row.iloc[0]["Processed_CSV_Path"]
        p_path = csv_path.replace('.csv', '.parquet')
        
        if os.path.exists(p_path):
            df = pd.read_parquet(p_path, engine='pyarrow')
        elif os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
        else:
            return {"error": f"Processed data file not found at {csv_path}"}
        
        # Return as columnar format (more efficient for Plotly)
        return {col: df[col].tolist() for col in df.columns}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/dyno/raw_telemetry/{test_name}")
def get_dyno_raw_telemetry(test_name: str):
    """Load the raw Excel telemetry for full-resolution plotting; fallback to processed data."""
    import glob
    try:
        for folder in [dyno_engine.BASELINE_FOLDER, dyno_engine.EVAL_FOLDER]:
            pattern = os.path.join(folder, f"*{test_name}*.xlsx")
            matches = glob.glob(pattern)
            if matches:
                df = pd.read_excel(matches[0])
                df.columns = [str(c).strip() for c in df.columns]
                return {col: df[col].tolist() for col in df.columns}

        conn = sqlite3.connect(DYNO_DB)
        row = pd.read_sql_query("SELECT Processed_CSV_Path FROM dyno_summaries WHERE Test_Name = ?", conn, params=(test_name,))
        conn.close()
        if row.empty:
            return {"error": f"Test '{test_name}' not found"}

        csv_path = row.iloc[0]["Processed_CSV_Path"]
        p_path = csv_path.replace('.csv', '.parquet')
        if os.path.exists(p_path):
            df = pd.read_parquet(p_path, engine='pyarrow')
        elif os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
        else:
            return {"error": f"Processed data file not found at {csv_path}"}
        return {col: df[col].tolist() for col in df.columns}
    except Exception as e:
        return {"error": str(e)}

# ---------- Road Suite: Ride Summaries ----------
@app.get("/api/road/summaries")
def get_road_summaries():
    """Return all road ride summaries from the SQLite database."""
    if not os.path.exists(ROAD_DB):
        return []
    try:
        conn = sqlite3.connect(ROAD_DB)
        df = pd.read_sql_query("SELECT * FROM ride_summaries", conn)
        conn.close()
        return df.to_dict(orient="records")
    except Exception as e:
        return {"error": str(e)}

# ---------- Dyno Suite: Battery Raw Data (for DCIR diagnostics) ----------
@app.get("/api/dyno/battery/{test_name}")
def get_battery_raw(test_name: str):
    """Load the RAW Excel for full-resolution battery DCIR diagnostics."""
    import glob
    for folder in [dyno_engine.BASELINE_FOLDER, dyno_engine.EVAL_FOLDER]:
        pattern = os.path.join(folder, f"*{test_name}*.xlsx")
        matches = glob.glob(pattern)
        if matches:
            try:
                df = pd.read_excel(matches[0])
                df.columns = [str(c).strip() for c in df.columns]
                # Only return essential columns to keep payload light
                keep = ["Time (s)"]
                for kw in ["voltage", "volatge", "current", "temp", "Temp"]:
                    keep += [c for c in df.columns if kw.lower() in c.lower() and c not in keep]
                keep = [c for c in keep if c in df.columns]
                return {col: df[col].dropna().tolist() for col in keep}
            except Exception as e:
                return {"error": str(e)}
    # Fallback: use processed CSV
    try:
        conn = sqlite3.connect(DYNO_DB)
        row = pd.read_sql_query("SELECT Processed_CSV_Path FROM dyno_summaries WHERE Test_Name = ?", conn, params=(test_name,))
        conn.close()
        if row.empty:
            return {"error": "Test not found"}
        csv_path = row.iloc[0]["Processed_CSV_Path"]
        df = pd.read_csv(csv_path) if os.path.exists(csv_path) else pd.DataFrame()
        return {col: df[col].tolist() for col in df.columns}
    except Exception as e:
        return {"error": str(e)}

# ---------- Dyno Suite: QC Gatekeeper Evaluation ----------
from pydantic import BaseModel
class QCRequest(BaseModel):
    time_s: int = 120
    env_method: str = "Tolerance (%)"
    tolerance_pct: int = 20
    target: str = "All Data"
    metric: str = "All Assessments"

@app.post("/api/dyno/qc_eval")
def dyno_qc_eval(req: QCRequest):
    """Run the QC gatekeeper evaluation across all tests for the given snapshot parameters."""
    if not os.path.exists(DYNO_DB):
        return {"error": "Database not found"}
    try:
        conn = sqlite3.connect(DYNO_DB)
        summary_df = pd.read_sql_query("SELECT * FROM dyno_summaries", conn)
        conn.close()
    except Exception as e:
        return {"error": str(e)}

    # Load envelopes
    envelope_data = {}
    for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
        try:
            conn = sqlite3.connect(DYNO_DB)
            env_df = pd.read_sql_query(f"SELECT * FROM envelope_{ch}", conn)
            conn.close()
            envelope_data[ch] = env_df
        except Exception:
            pass

    dtdt_map = {"IGBT": "IGBT_dTdt", "Motor": "Motor_dTdt", "HighCell": "HighCell_dTdt", "AFE": "AFE_Mean_dTdt"}
    deltat_map = {"IGBT": "IGBT_dT", "Motor": "Motor_dT", "HighCell": "HighCell_dT", "AFE": "AFE_Mean_dT"}

    # Compute golden power bounds
    golden_powers = []
    for _, row in summary_df.iterrows():
        if any(g in str(row.get("Test_Name", "")) for g in dyno_engine.GOLDEN_BIKES):
            pwr = row.get("Power_Avg_120s", 0) or 0
            if 19 <= pwr <= 20.5:
                golden_powers.append(pwr)
    master_golden_power = sum(golden_powers) / len(golden_powers) if golden_powers else 19.5
    pwr_upper = master_golden_power * 1.10
    pwr_lower = master_golden_power * 0.90

    results = []
    for _, row in summary_df.iterrows():
        test_name = str(row.get("Test_Name", ""))
        bike_type = str(row.get("Type", "Evaluation"))
        bike_power = float(row.get("Power_Avg_120s", 0) or 0)
        csv_path = str(row.get("Processed_CSV_Path", ""))

        # Load processed CSV for this test
        df_test = pd.DataFrame()
        p_path = csv_path.replace(".csv", ".parquet")
        try:
            if os.path.exists(p_path):
                df_test = pd.read_parquet(p_path, engine="pyarrow")
            elif os.path.exists(csv_path):
                df_test = pd.read_csv(csv_path)
        except Exception:
            pass

        if df_test.empty:
            continue

        # Find nearest row to the requested timestamp
        if "Time (s)" not in df_test.columns:
            continue
        df_test = df_test.sort_values("Time (s)")
        t_near = pd.merge_asof(
            pd.DataFrame({"Time (s)": [float(req.time_s)]}),
            df_test,
            on="Time (s)",
            direction="nearest"
        )
        if t_near.empty:
            continue

        repo_row = {"Test Name": test_name, "Type": bike_type}
        failed_dt, failed_dtdt = [], []

        for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
            val_dtdt = float(t_near[dtdt_map[ch]].values[0]) if dtdt_map[ch] in t_near.columns else 0
            val_dt = float(t_near[deltat_map[ch]].values[0]) if deltat_map[ch] in t_near.columns else 0
            repo_row[f"{ch} dTdt"] = round(val_dtdt, 3)
            repo_row[f"{ch} dT"] = round(val_dt, 2)

            if req.target not in ["All Data", ch] or req.metric == "Power Based":
                continue

            if ch in envelope_data:
                env_df = envelope_data[ch]
                env_row = env_df[env_df["Time (s)"] == req.time_s]
                if not env_row.empty:
                    tol = req.tolerance_pct
                    if req.env_method == "Tolerance (%)":
                        up_dtdt = env_row[f"dTdt_Upper_{tol}Pct"].values[0]
                        low_dtdt = env_row[f"dTdt_Lower_{tol}Pct"].values[0]
                        up_dt = env_row[f"dT_Upper_{tol}Pct"].values[0]
                        low_dt = env_row[f"dT_Lower_{tol}Pct"].values[0]
                    else:
                        up_dtdt = env_row["dTdt_Upper_2Sigma"].values[0]
                        low_dtdt = env_row["dTdt_Lower_2Sigma"].values[0]
                        up_dt = env_row["dT_Upper_2Sigma"].values[0]
                        low_dt = env_row["dT_Lower_2Sigma"].values[0]

                    if req.metric in ["All Assessments", "dT/dt"] and val_dtdt > up_dtdt:
                        failed_dtdt.append(ch)
                    if req.metric in ["All Assessments", "dT"] and val_dt > up_dt:
                        failed_dt.append(ch)

        repo_row["Power Rating (kW)"] = round(bike_power, 2)

        # Check early deration
        derated_early = False
        if req.metric != "Power Based":
            for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
                if req.target in ["All Data", ch]:
                    der_val = row.get(f"{ch}_Deration_Time", "SAFE")
                    if str(der_val) != "SAFE" and der_val is not None:
                        try:
                            if float(der_val) < req.time_s:
                                derated_early = True
                                break
                        except (ValueError, TypeError):
                            pass

        power_passed = True
        if req.target in ["All Data", "Electrical Power"] and req.metric in ["All Assessments", "Power Based"]:
            if not (pwr_lower <= bike_power <= pwr_upper):
                power_passed = False

        # Golden baseline bikes always pass
        if any(g in test_name for g in dyno_engine.GOLDEN_BIKES):
            repo_row["Final Conclusion"] = "PASS (Golden Base)"
        elif derated_early:
            repo_row["Final Conclusion"] = "FAIL (Early Deration)"
        elif failed_dt:
            repo_row["Final Conclusion"] = f"FAIL (Cumm Temp: {', '.join(failed_dt)})"
        elif failed_dtdt:
            repo_row["Final Conclusion"] = f"FAIL (Rise Rate: {', '.join(failed_dtdt)})"
        elif not power_passed:
            repo_row["Final Conclusion"] = f"FAIL (Power Dev: {bike_power:.1f}kW)"
        else:
            repo_row["Final Conclusion"] = "PASS"

        results.append(repo_row)

    return results

# ---------- Dyno Suite: Data Engine ----------
@app.post("/api/dyno/upload")
async def dyno_upload_file(file: UploadFile = File(...), mode: str = Form(...)):
    """Upload a raw .xlsx file to either the baseline or evaluation folder."""
    if mode == "Baseline (Calibration)":
        target_dir = dyno_engine.BASELINE_FOLDER
    else:
        target_dir = dyno_engine.EVAL_FOLDER
        
    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"message": f"Successfully uploaded {file.filename} to {mode}"}

@app.post("/api/dyno/process")
async def dyno_process_files():
    """Trigger the dyno engine processing cycle and capture logs."""
    import sys, io
    captured_output = io.StringIO()
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    sys.stdout = captured_output
    sys.stderr = captured_output
    
    try:
        result = dyno_engine.run_processing_cycle()
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        logs = captured_output.getvalue()
        return {"result": result, "logs": logs}
    except Exception as e:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        return {"error": str(e), "logs": captured_output.getvalue()}

@app.post("/api/dyno/reset")
async def dyno_reset_db():
    if os.path.exists(dyno_engine.DB_PATH):
        os.remove(dyno_engine.DB_PATH)
    if os.path.exists(dyno_engine.PROCESSED_FOLDER):
        shutil.rmtree(dyno_engine.PROCESSED_FOLDER)
        os.makedirs(dyno_engine.PROCESSED_FOLDER)
    if os.path.exists(dyno_engine.REGISTRY_FILE):
        os.remove(dyno_engine.REGISTRY_FILE)
    return {"message": "Factory Reset Complete"}

# ---------- Dyno Suite: Fleet Registry ----------
@app.get("/api/dyno/fleet")
def dyno_get_fleet():
    """Fetch the bike hardware registry."""
    try:
        from bike_backend.bike_db_manager import load_bike_registry
        return load_bike_registry()
    except Exception as e:
        return {"error": str(e)}

# ---------- Dyno Suite: Dev Access ----------
@app.get("/api/dyno/processed_tests")
def list_processed_tests():
    """List all processed test names from the database."""
    if not os.path.exists(DYNO_DB):
        return []
    try:
        conn = sqlite3.connect(DYNO_DB)
        df = pd.read_sql_query("SELECT Test_Name, Processed_CSV_Path FROM dyno_summaries", conn)
        conn.close()
        return df.to_dict(orient="records")
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/dyno/delete_test")
async def dyno_delete_test(payload: dict):
    """Delete a specific test from the database, processed files, and registry."""
    test_name = payload.get("test_name", "")
    if not test_name:
        return {"error": "No test_name provided"}
    try:
        conn = sqlite3.connect(DYNO_DB)
        row = pd.read_sql_query("SELECT Processed_CSV_Path FROM dyno_summaries WHERE Test_Name = ?", conn, params=(test_name,))
        cursor = conn.cursor()
        cursor.execute("DELETE FROM dyno_summaries WHERE Test_Name = ?", (test_name,))
        conn.commit()
        conn.close()

        if not row.empty:
            file_path = row.iloc[0]["Processed_CSV_Path"]
            for ext_path in [file_path, file_path.replace(".csv", ".parquet")]:
                if os.path.exists(ext_path):
                    os.remove(ext_path)

        # Clean from raw folders
        for folder in [dyno_engine.EVAL_FOLDER, dyno_engine.BASELINE_FOLDER]:
            if os.path.exists(folder):
                for rf in os.listdir(folder):
                    if rf.split('.')[0] in test_name:
                        os.remove(os.path.join(folder, rf))

        # Clean registry
        import json
        if os.path.exists(dyno_engine.REGISTRY_FILE):
            with open(dyno_engine.REGISTRY_FILE, "r") as f:
                reg = json.load(f)
            reg["processed_files"] = [pf for pf in reg.get("processed_files", []) if pf.split('.')[0] not in test_name]
            with open(dyno_engine.REGISTRY_FILE, "w") as f:
                json.dump(reg, f, indent=4)

        return {"message": f"Deleted {test_name} successfully"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/dyno/promote_test")
async def dyno_promote_test(payload: dict):
    """Move a test's raw file from Evaluation to Baseline folder."""
    test_name = payload.get("test_name", "")
    if not test_name:
        return {"error": "No test_name provided"}
    moved = False
    if os.path.exists(dyno_engine.EVAL_FOLDER):
        for rf in os.listdir(dyno_engine.EVAL_FOLDER):
            if rf.split('.')[0] in test_name:
                src = os.path.join(dyno_engine.EVAL_FOLDER, rf)
                dst = os.path.join(dyno_engine.BASELINE_FOLDER, rf)
                shutil.move(src, dst)
                moved = True
    if moved:
        return {"message": f"Promoted {test_name} to Golden Baseline"}
    else:
        return {"error": "Could not find the original .xlsx file in the Evaluation folder"}

if __name__ == "__main__":
    import uvicorn
    print("Booting FastAPI Data Core on port 8001...")
    uvicorn.run("fastapi_server:app", host="0.0.0.0", port=8001, reload=False)
