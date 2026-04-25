from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import FileResponse
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
    """Sanitize DataFrame for JSON compliance: Replace NaN/Inf with None (null in JSON)."""
    # Replace NaN, Inf, -Inf with None
    clean_df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
    return {col: [v if not (isinstance(v, float) and (math.isnan(v) or math.isinf(v))) else None for v in clean_df[col].tolist()] for col in clean_df.columns}

def sanitize_records(df):
    """Sanitize DataFrame records for JSON compliance."""
    return df.replace({np.nan: None, np.inf: None, -np.inf: None}).to_dict(orient="records")

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

@app.get("/api/dyno/summaries")
def get_dyno_summaries():
    if not db_bridge.DATABASE_URL and not os.path.exists(DYNO_DB):
        return []
    df = db_bridge.query_to_df("SELECT * FROM dyno_summaries", db_path=DYNO_DB)
    return sanitize_records(df)

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
def get_road_summaries():
    """Get all road ride summaries"""
    logger.info("Road summaries endpoint called")
    if not db_bridge.DATABASE_URL and not os.path.exists(ROAD_DB):
        logger.warning(f"Road DB not found at {ROAD_DB}")
        return []
    try:
        df = db_bridge.query_to_df("SELECT * FROM ride_summaries", db_path=ROAD_DB)
        logger.info(f"Returning {len(df)} road summaries")
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

# (All other existing upload, process, and road routes from your original file go here...)

if __name__ == "__main__":
    import uvicorn
    # 🎯 Running on 8001 as per your terminal logs
    print("Booting VCH Data Core on port 8001...")
    uvicorn.run("fastapi_server:app", host="0.0.0.0", port=8001, reload=False)