from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import os
import sqlite3
import pandas as pd
import shutil
import io
import sys
import logging
import psutil  # New: For Admin Panel system health
import re      # New: For smarter date parsing
import numpy as np # For NaN/Inf handling
import math
import orjson
import db_bridge  # New: Centralized database bridge

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import backend modules
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "dyno_backend"))
import dyno_db_manager as dyno_engine

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "road_backend"))
import db_manager as road_engine

app = FastAPI(title="VCH Master Dashboard API", description="High Performance Data Pipeline")

# Add GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Paths
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DYNO_DB = os.path.join(ROOT_DIR, "dyno_backend", "raptee_dyno.db")
ROAD_DB = os.path.join(ROOT_DIR, "road_backend", "raptee_rides.db")
ROAD_RAW = os.path.join(ROOT_DIR, "road_backend", "Raw_Data")
ROAD_PROCESSED = os.path.join(ROOT_DIR, "road_backend", "Processed_Rides")

logger.info(f"Root directory: {ROOT_DIR}")
logger.info(f"Dyno DB path: {DYNO_DB} (exists: {os.path.exists(DYNO_DB)})")
logger.info(f"Road DB path: {ROAD_DB} (exists: {os.path.exists(ROAD_DB)})")

# 🚨 THE MAGIC HANDSHAKE: Allow Next.js (port 3000/3001) to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development, allow all origins to prevent "Failed to fetch"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    logger.info("Health check called")
    return {
        "status": "success", 
        "message": "FastAPI VCH Bridge is actively running.",
        "dyno_db_exists": os.path.exists(DYNO_DB),
        "road_db_exists": os.path.exists(ROAD_DB)
    }

def sanitize_data(df):
    """Sanitize DataFrame for JSON compliance, serialised via orjson (5-10x faster)."""
    clean_df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
    return Response(orjson.dumps(clean_df.to_dict(orient="list")), media_type="application/json")

def sanitize_records(df):
    """Sanitize DataFrame records for JSON compliance, serialised via orjson."""
    records = df.replace({np.nan: None, np.inf: None, -np.inf: None}).to_dict(orient="records")
    return Response(orjson.dumps(records), media_type="application/json")

# ====================================================================
# 🏠 NEW: MASTER DASHBOARD & ADMIN ENDPOINTS
# ====================================================================

@app.get("/api/master/overview")
def get_master_overview():
    """Optimized SQL counts and combined activity for the Master Dashboard."""
    try:
        recent_activity = []
        dyno_count, road_count, golden_count = 0, 0, 0

        # 1. ⚡ ULTRA-FAST DYNO SQL QUERY
        if db_bridge.DATABASE_URL or os.path.exists(DYNO_DB):
            df_dyno = db_bridge.query_to_df("SELECT COUNT(*) as count FROM dyno_summaries", db_path=DYNO_DB)
            dyno_count = int(df_dyno["count"].iloc[0]) if not df_dyno.empty else 0
            
            df_golden = db_bridge.query_to_df("SELECT COUNT(*) as count FROM dyno_summaries WHERE Type LIKE '%Golden%'", db_path=DYNO_DB)
            golden_count = int(df_golden["count"].iloc[0]) if not df_golden.empty else 0
            
            df_recent = db_bridge.query_to_df("SELECT Test_Name, Type FROM dyno_summaries ORDER BY Test_Name DESC LIMIT 5", db_path=DYNO_DB)
            for _, row in df_recent.iterrows():
                raw_name = row["Test_Name"]
                date_match = re.search(r'(\d{2}_\d{2}_\d{4}|\d{4}_\d{2}_\d{2})', raw_name)
                recent_activity.append({
                    "id": raw_name, "suite": "Dyno", "type": row["Type"],
                    "date": date_match.group(0).replace('_', '/') if date_match else "Recent"
                })

        # 2. ⚡ ULTRA-FAST ROAD SQL QUERY
        if db_bridge.DATABASE_URL or os.path.exists(ROAD_DB):
            df_road_count = db_bridge.query_to_df("SELECT COUNT(*) as count FROM ride_summaries", db_path=ROAD_DB)
            road_count = int(df_road_count["count"].iloc[0]) if not df_road_count.empty else 0
            
            df_recent_road = db_bridge.query_to_df("SELECT Ride_Name, Drive_Score FROM ride_summaries ORDER BY Ride_Name DESC LIMIT 5", db_path=ROAD_DB)
            for _, row in df_recent_road.iterrows():
                raw_name = row["Ride_Name"]
                date_match = re.search(r'(\d{2}_\d{2}_\d{4}|\d{4}_\d{2}_\d{2})', raw_name)
                recent_activity.append({
                    "id": raw_name, "suite": "Road", 
                    "type": f"Score: {row['Drive_Score'] if row['Drive_Score'] is not None else 'N/A'}",
                    "date": date_match.group(0).replace('_', '/') if date_match else "Recent"
                })

        recent_activity.sort(key=lambda x: x["date"], reverse=True)
        return {
            "status": "success",
            "dyno_total": dyno_count,
            "road_total": road_count,
            "golden_count": golden_count,
            "recent_activity": recent_activity[:8]
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/admin/status")
def get_system_status():
    """Monitor system health for the Admin Controls panel."""
    return {
        "db_healthy": os.path.exists(DYNO_DB),
        "cpu_usage": psutil.cpu_percent(),
        "memory_usage": psutil.virtual_memory().percent,
        "uptime": "Operational"
    }

# ====================================================================
# 🏍️ ORIGINAL TELEMETRY MODULES (DYN0 & ROAD)
# ====================================================================

@app.get("/api/fleet")
def get_fleet():
    from bike_backend.bike_db_manager import load_bike_registry
    return load_bike_registry()

@app.post("/api/bike/upload_manifest")
async def upload_bike_manifest(file: UploadFile = File(...)):
    from bike_backend.bike_db_manager import update_hardware_registry
    import io
    content = await file.read()
    ok, msg, count = update_hardware_registry(io.BytesIO(content), file.filename)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"ok": True, "message": msg, "updated": count}

@app.post("/api/bike/manual_update")
async def manual_bike_update(payload: dict):
    from bike_backend.bike_db_manager import load_bike_registry, save_bike_registry, BIKE_REGISTRY_FILE
    import shutil
    from datetime import datetime
    bike_no = payload.get("bike_no")
    if not bike_no:
        raise HTTPException(status_code=400, detail="bike_no is required")
    bike_id = f"BIKE-{int(bike_no)}"
    fields = {k: v for k, v in payload.items() if k != "bike_no" and v and str(v).strip()}
    if os.path.exists(BIKE_REGISTRY_FILE):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy2(BIKE_REGISTRY_FILE, BIKE_REGISTRY_FILE.replace(".json", f"_backup_{ts}.json"))
    reg = load_bike_registry()
    if bike_id not in reg:
        reg[bike_id] = {"tests_done": 0, "status": "Offline"}
    reg[bike_id].update(fields)
    save_bike_registry(reg)
    return {"ok": True, "bike_id": bike_id, "updated_fields": list(fields.keys())}

@app.get("/api/dyno/summaries")
def get_dyno_summaries(response: Response):
    if not db_bridge.DATABASE_URL and not os.path.exists(DYNO_DB):
        return []
    df = db_bridge.query_to_df("SELECT * FROM dyno_summaries ORDER BY Test_Name DESC", db_path=DYNO_DB)
    response.headers["Cache-Control"] = "max-age=30"
    return sanitize_records(df)

@app.get("/api/dyno/processed_tests")
def get_processed_tests():
    """Get list of tests for the Data Engine deletion/promotion tools."""
    if not db_bridge.DATABASE_URL and not os.path.exists(DYNO_DB):
        return []
    df = db_bridge.query_to_df("SELECT Test_Name FROM dyno_summaries ORDER BY Test_Name DESC", db_path=DYNO_DB)
    return df.to_dict(orient="records")

@app.post("/api/dyno/upload")
async def upload_dyno_data(file: UploadFile = File(...), mode: str = Form("Evaluation (Test)")):
    """Upload a new dyno XLSX file."""
    base_dir = os.path.join(ROOT_DIR, "dyno_backend")
    target_folder = os.path.join(base_dir, "baseline_raw") if "Baseline" in mode else os.path.join(base_dir, "evaluation_raw")
    os.makedirs(target_folder, exist_ok=True)
    
    file_path = os.path.join(target_folder, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"status": "success", "message": f"Uploaded {file.filename} to {mode}."}

@app.post("/api/dyno/process")
async def process_dyno_data():
    """Trigger the dyno ML/QC processing engine."""
    try:
        # Capture logs
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        
        # Process files
        result = dyno_engine.run_processing_cycle()
        
        logs = sys.stdout.getvalue()
        sys.stdout = old_stdout
        return {"status": "success", "result": result, "logs": logs}
    except Exception as e:
        if 'old_stdout' in locals(): sys.stdout = old_stdout
        return {"status": "error", "message": str(e)}

@app.post("/api/dyno/reset")
async def reset_dyno_db():
    """Wipe the dyno database and folders."""
    try:
        if os.path.exists(DYNO_DB): os.remove(DYNO_DB)
        # Clear raw and processed folders
        base_dir = os.path.join(ROOT_DIR, "dyno_backend")
        for folder in ["baseline_raw", "evaluation_raw", "Processed_Dyno"]:
            path = os.path.join(base_dir, folder)
            if os.path.exists(path): shutil.rmtree(path)
            os.makedirs(path, exist_ok=True)
        
        # Reset registry
        registry_path = os.path.join(base_dir, "dyno_registry.json")
        if os.path.exists(registry_path):
            with open(registry_path, "w") as f:
                json.dump({"processed_files": []}, f)
                
        return {"status": "success", "message": "Dyno database and folders reset."}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/dyno/telemetry/{test_name}")
def get_dyno_telemetry(test_name: str):
    if not db_bridge.DATABASE_URL and not os.path.exists(DYNO_DB): return {"error": "Database not found"}
    df_row = db_bridge.query_to_df("SELECT Processed_CSV_Path FROM dyno_summaries WHERE Test_Name = ?", params=(test_name,), db_path=DYNO_DB)
    if df_row.empty: return {"error": f"Test '{test_name}' not found"}
    csv_path = df_row.iloc[0]["Processed_CSV_Path"]
    p_path = csv_path.replace('.csv', '.parquet')
    df = pd.read_parquet(p_path) if os.path.exists(p_path) else pd.read_csv(csv_path)
    return sanitize_data(df)

@app.get("/api/dyno/envelope/{channel}")
def get_dyno_envelope(channel: str):
    """Get golden baseline envelope for a specific channel (IGBT, Motor, HighCell, AFE)"""
    if not db_bridge.DATABASE_URL and not os.path.exists(DYNO_DB):
        return {"error": "Database not found"}
    
    table_name = f"envelope_{channel}"
    try:
        # Note: we are using the bridge's query_to_df which handles the connection
        df = db_bridge.query_to_df(f'SELECT * FROM "{table_name}"', db_path=DYNO_DB)
        return sanitize_data(df)
    except Exception as e:
        return {"error": f"Failed to load envelope for {channel}: {str(e)}"}

@app.get("/api/dyno/raw_telemetry/{test_name}")
def get_dyno_raw_telemetry(test_name: str):
    """Get full-resolution raw telemetry for a test"""
    base_dir = os.path.join(ROOT_DIR, "dyno_backend")
    eval_raw = os.path.join(base_dir, "evaluation_raw", f"{test_name}.xlsx")
    base_raw = os.path.join(base_dir, "baseline_raw", f"{test_name}.xlsx")
    
    raw_path = None
    if os.path.exists(eval_raw):
        raw_path = eval_raw
    elif os.path.exists(base_raw):
        raw_path = base_raw
        
    if not raw_path:
        # Fallback to check via DB Processed_CSV_Path and replace processed with appropriate suffix if it was saved locally
        if db_bridge.DATABASE_URL or os.path.exists(DYNO_DB):
            row = db_bridge.query_to_df("SELECT Processed_CSV_Path FROM dyno_summaries WHERE Test_Name = ?", params=(test_name,), db_path=DYNO_DB)
            if not row.empty and row.iloc[0]["Processed_CSV_Path"]:
                # Sometimes a raw CSV is generated next to Processed
                p = row.iloc[0]["Processed_CSV_Path"].replace("_Processed", "_Raw")
                if os.path.exists(p): raw_path = p
                
    if not raw_path: return {"error": f"Raw file not found for '{test_name}'"}
    
    df = pd.read_excel(raw_path) if raw_path.endswith('.xlsx') else pd.read_csv(raw_path)
    return sanitize_data(df)

@app.get("/api/dyno/fleet")
def get_dyno_fleet():
    """Get fleet data"""
    from bike_backend.bike_db_manager import load_bike_registry
    return load_bike_registry()

# ====================================================================
# 🛣️ ROAD SUITE ENDPOINTS
# ====================================================================

@app.get("/api/road/summaries")
def get_road_summaries(response: Response):
    """Get all road ride summaries"""
    logger.info("Road summaries endpoint called")
    if not db_bridge.DATABASE_URL and not os.path.exists(ROAD_DB):
        logger.warning(f"Road DB not found at {ROAD_DB}")
        return []
    try:
        df = db_bridge.query_to_df("SELECT * FROM ride_summaries", db_path=ROAD_DB)

        # Dynamically inject Route column based on filename conventions
        def get_route(name):
            name_lower = name.lower()
            if "route-office" in name_lower: return "Office Full Push"
            if "route-road" in name_lower: return "Road Full Push"
            return "Custom/Unknown"

        if not df.empty:
            df['Route'] = df['Ride_Name'].apply(get_route)

        response.headers["Cache-Control"] = "max-age=30"
        logger.info(f"Returning {len(df)} road summaries with dynamic routes")
        return sanitize_records(df)
    except Exception as e:
        logger.error(f"Error getting road summaries: {e}")
        return {"error": str(e)}

@app.get("/api/road/telemetry/{ride_name}")
def get_road_telemetry(ride_name: str):
    """Get telemetry data for a specific ride"""
    logger.info(f"Road telemetry requested for: {ride_name}")
    if not os.path.exists(ROAD_DB):
        logger.warning(f"Road DB not found at {ROAD_DB}")
        return {"error": "Road database not found"}
    
    try:
        import urllib.parse
        decoded_name = urllib.parse.unquote(ride_name)
        row = db_bridge.query_to_df("SELECT Processed_CSV_Path FROM ride_summaries WHERE Ride_Name = ?", params=(decoded_name,), db_path=ROAD_DB)
        
        if row.empty:
            logger.warning(f"Ride not found: {decoded_name}")
            return {"error": f"Ride '{decoded_name}' not found"}
        
        csv_path = row.iloc[0]["Processed_CSV_Path"]
        logger.info(f"CSV path from DB: {csv_path}")
        
        if not csv_path or not os.path.exists(csv_path):
            logger.warning(f"Processed file not found: {csv_path}")
            return {"error": f"Processed file not found for '{decoded_name}'"}
        
        # Try parquet first, then CSV
        p_path = csv_path.replace('.csv', '.parquet')
        if os.path.exists(p_path):
            df = pd.read_parquet(p_path)
            logger.info(f"Loaded parquet with {len(df)} rows")
        else:
            df = pd.read_csv(csv_path)
            logger.info(f"Loaded CSV with {len(df)} rows")
        
        logger.info(f"Returning sanitized data with {len(df.columns)} columns")
        return sanitize_data(df)
    except Exception as e:
        import traceback
        logger.error(f"Error loading telemetry: {e}")
        logger.error(traceback.format_exc())
        return {"error": str(e)}

@app.get("/api/road/events/{ride_name}")
def get_road_events(ride_name: str):
    """Get events for a specific ride"""
    if not db_bridge.DATABASE_URL and not os.path.exists(ROAD_DB):
        return []
    try:
        df = db_bridge.query_to_df("SELECT * FROM ride_events WHERE Ride_Name = ?", params=(ride_name,), db_path=ROAD_DB)
        return df.to_dict(orient="records")
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/road/upload")
async def upload_road_data(
    file: UploadFile = File(...),
    rider: str = Form("System Test"),
    temp: str = Form("25"),
    location: str = Form("Chennai"),
    route: str = Form("Office Full Push")
):
    """Upload a new road ride XLSX file."""
    os.makedirs(ROAD_RAW, exist_ok=True)
    file_path = os.path.join(ROAD_RAW, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Store metadata for processing
    metadata_file = file_path + ".meta"
    import json
    with open(metadata_file, "w") as f:
        json.dump({"rider": rider, "temp": temp, "location": location, "route": route}, f)
        
    return {"status": "success", "message": f"Uploaded {file.filename} with metadata."}

@app.post("/api/road/process")
async def process_road_data():
    """Trigger the road ML processing engine."""
    try:
        manager = road_engine.DatabaseManager(db_name=ROAD_DB, processed_folder=ROAD_PROCESSED)
        # Capture logs
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        
        # Process files
        # Note: We need to handle metadata from .meta files if they exist
        result = manager.process_new_files(ROAD_RAW)
        
        logs = sys.stdout.getvalue()
        sys.stdout = old_stdout
        return {"status": "success", "result": result, "logs": logs}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/road/delete_ride")
async def delete_road_ride(payload: dict):
    """Delete a specific ride and its files."""
    ride_name = payload.get("ride_name")
    if not ride_name: return {"error": "No ride name provided"}
    
    try:
        # Get paths from DB before deleting
        row = db_bridge.query_to_df("SELECT Processed_CSV_Path FROM ride_summaries WHERE Ride_Name = ?", params=(ride_name,), db_path=ROAD_DB)
        if not row.empty and row.iloc[0]["Processed_CSV_Path"]:
            csv_path = row.iloc[0]["Processed_CSV_Path"]
            if os.path.exists(csv_path): os.remove(csv_path)
            p_path = csv_path.replace('.csv', '.parquet')
            if os.path.exists(p_path): os.remove(p_path)
            
        # Delete from DB
        db_bridge.execute_sql("DELETE FROM ride_summaries WHERE Ride_Name = ?", params=(ride_name,), db_path=ROAD_DB)
        db_bridge.execute_sql("DELETE FROM ride_events WHERE Ride_Name = ?", params=(ride_name,), db_path=ROAD_DB)
        
        return {"status": "success", "message": f"Deleted ride '{ride_name}'"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/road/reset")
async def reset_road_db():
    """Wipe the road database and folders."""
    try:
        if os.path.exists(ROAD_DB): os.remove(ROAD_DB)
        if os.path.exists(ROAD_RAW): shutil.rmtree(ROAD_RAW)
        if os.path.exists(ROAD_PROCESSED): shutil.rmtree(ROAD_PROCESSED)
        os.makedirs(ROAD_RAW, exist_ok=True)
        os.makedirs(ROAD_PROCESSED, exist_ok=True)
        return {"status": "success", "message": "Road database and folders reset."}
    except Exception as e:
        return {"error": str(e)}

# ====================================================================
# 📦 DATABASE EXPORT ENDPOINTS
# ====================================================================

@app.get("/api/dyno/export_db")
def export_dyno_db():
    """Download the master Dyno SQLite database file."""
    if not os.path.exists(DYNO_DB):
        return {"error": "Dyno database not found"}
    return FileResponse(DYNO_DB, media_type="application/octet-stream", filename="raptee_dyno.db")

@app.get("/api/road/export_db")
def export_road_db():
    """Download the master Road SQLite database file."""
    if not os.path.exists(ROAD_DB):
        return {"error": "Road database not found"}
    return FileResponse(ROAD_DB, media_type="application/octet-stream", filename="raptee_rides.db")

# ====================================================================
# 📊 QC EVALUATION ENDPOINT
# ====================================================================

CHANNEL_LIMITS = {"IGBT": 95, "Motor": 125, "HighCell": 50, "AFE": 50}
GOLDEN_BIKES = ["2025_10_22-07-BK", "2025_10_09-14-BK", "2025_10_25-09-BK", "2025_10_20-15-BK", "2025_10_19-17-BK", "2025_10_25-04-BK"]

@app.post("/api/dyno/qc_eval")
def run_qc_eval(payload: dict):
    """Run QC evaluation across all dyno tests and return pass/fail verdicts."""
    time_s = int(payload.get("time_s", 120))
    env_method = payload.get("env_method", "Tolerance (%)")
    tolerance_pct = int(payload.get("tolerance_pct", 20))
    target = payload.get("target", "All Data")
    metric = payload.get("metric", "All Assessments")

    if not db_bridge.DATABASE_URL and not os.path.exists(DYNO_DB):
        return {"error": "Dyno database not found"}

    try:
        df = db_bridge.query_to_df("SELECT * FROM dyno_summaries", db_path=DYNO_DB)
        if df.empty:
            return []

        # Load envelopes for each channel
        envelopes = {}
        for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
            try:
                env_df = db_bridge.query_to_df(f'SELECT * FROM "envelope_{ch}"', db_path=DYNO_DB)
                if not env_df.empty:
                    envelopes[ch] = env_df
            except Exception:
                pass

        # Compute golden power range
        golden_powers = []
        for _, row in df.iterrows():
            if any(g in str(row.get("Test_Name", "")) for g in GOLDEN_BIKES):
                p = float(row.get("Power_Avg_120s") or 0)
                if 19 <= p <= 20.5:
                    golden_powers.append(p)
        mgp = sum(golden_powers) / len(golden_powers) if golden_powers else 19.5
        pwr_upper, pwr_lower = mgp * 1.10, mgp * 0.90

        results = []
        for _, row in df.iterrows():
            test_name = row.get("Test_Name", "")
            is_golden = any(g in str(test_name) for g in GOLDEN_BIKES)
            bike_power = float(row.get("Power_Avg_120s") or 0)

            row_result = {
                "Test Name": test_name,
                "Type": row.get("Type", "Evaluation"),
                "Power Rating (kW)": round(bike_power, 2),
            }

            # Add per-channel dT values
            for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
                dt_key = f"{ch}_dT" if ch != "AFE" else "AFE_Mean_dT"
                row_result[f"{ch}_dT"] = row.get(dt_key)

            if is_golden:
                row_result["Final Conclusion"] = "PASS (Golden Reference)"
                results.append(row_result)
                continue

            failures = []

            # Check envelope breach (rise rate + cumulative rise)
            if metric != "Power Based":
                for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
                    if target not in ["All Data", ch]:
                        continue
                    if ch not in envelopes:
                        continue
                    env_df = envelopes[ch]
                    env_row = env_df[env_df["Time (s)"] == time_s]
                    if env_row.empty:
                        continue

                    tol_key = f"_{tolerance_pct}Pct" if env_method == "Tolerance (%)" else "_2Sigma"
                    up_dtdt_col = f"dTdt_Upper{tol_key}"
                    up_dt_col = f"dT_Upper{tol_key}"

                    ch_dtdt_col = f"{ch}_dTdt_Max"
                    ch_dt_col = f"{ch}_dT_Max"

                    val_dtdt = float(row.get(ch_dtdt_col) or 0)
                    val_dt = float(row.get(ch_dt_col) or 0)
                    up_dtdt = float(env_row[up_dtdt_col].values[0]) if up_dtdt_col in env_row else 999
                    up_dt = float(env_row[up_dt_col].values[0]) if up_dt_col in env_row else 999

                    if metric in ["All Assessments", "dT/dt"] and val_dtdt > up_dtdt:
                        failures.append(f"{ch} Rise Rate {val_dtdt:.3f} > {up_dtdt:.3f}°C/s")
                    if metric in ["All Assessments", "dT"] and val_dt > up_dt:
                        failures.append(f"{ch} Cumm Rise {val_dt:.2f} > {up_dt:.2f}°C")

            # Check power
            if target in ["All Data", "Electrical Power"] and metric in ["All Assessments", "Power Based"]:
                if not (pwr_lower <= bike_power <= pwr_upper):
                    failures.append(f"Power {bike_power:.1f}kW outside {pwr_lower:.1f}–{pwr_upper:.1f}kW range")

            if failures:
                row_result["Final Conclusion"] = f"FAIL ({failures[0]})"
            else:
                row_result["Final Conclusion"] = "PASS"

            results.append(row_result)

        # Sanitize for JSON
        clean = []
        for r in results:
            cr = {}
            for k, v in r.items():
                if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                    cr[k] = None
                else:
                    cr[k] = v
            clean.append(cr)
        return clean

    except Exception as e:
        import traceback
        logger.error(traceback.format_exc())
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    # 🎯 Running on 8001 as per your terminal logs
    print("Booting VCH Data Core on port 8001...")
    uvicorn.run("fastapi_server:app", host="0.0.0.0", port=8001, reload=False)