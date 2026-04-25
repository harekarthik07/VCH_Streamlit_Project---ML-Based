import sys
import os
import streamlit as st
import sqlite3
import db_bridge
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import shutil
import time
import io
import gc
from contextlib import redirect_stdout, redirect_stderr
from docxtpl import DocxTemplate    
from plotly.subplots import make_subplots

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.dirname(CURRENT_DIR))
import auth_utils

auth_utils.enforce_login()
ROOT_DIR = os.path.dirname(CURRENT_DIR)
DYNO_DIR = os.path.join(ROOT_DIR, "dyno_backend")
if DYNO_DIR not in sys.path: sys.path.append(DYNO_DIR)
import dyno_db_manager as dyno_engine

BIKE_DIR = os.path.join(ROOT_DIR, "bike_backend")
if BIKE_DIR not in sys.path: sys.path.append(BIKE_DIR)
import bike_db_manager as bike_engine

st.set_page_config(page_title="Raptee Thermal Suite", page_icon="⚡", layout="wide", initial_sidebar_state="expanded")

# ==========================================================
# APP STYLING: DISTINCT BORDERS + BENTO BOX + LIGHT/DARK
# ==========================================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;900&display=swap');

    html, body, [class*="css"] { font-family: 'Outfit', sans-serif !important; }
    footer {visibility: hidden;}
    .stDeployButton {display:none;}

    :root {
        /* DARK MODE DEFAULTS */
        --bg-color: #0b0c10; 
        --card-bg: rgba(25, 25, 30, 0.4); 
        --card-border: rgba(255, 255, 255, 0.08); 
        --card-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        --text-main: #FFFFFF;
        --text-title: #B4B4C0;
        --text-sub: #A0A0AB;
        --btn-bg: rgba(45, 45, 51, 0.6);
        --btn-border: rgba(255, 255, 255, 0.15);
        --sidebar-bg: #0b0c10;
        --scroll-thumb: #3A3A40;
        --raptee-logo: #FFFFFF;
        --banner-text: #FF4B4B;
    }



    /* Ambient animated background for glass effect to show up */
    .stApp { 
        background: radial-gradient(circle at 50% -20%, #1e2430 0%, var(--bg-color) 70%) !important; 
        background-color: var(--bg-color); 
    }
    
    .block-container { animation: fade-in-up 0.6s ease-out forwards; }
    @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }

    /* LIQUID GLASS CARDS */
    .metric-card, [data-testid="stMetric"] {
        background: var(--card-bg) !important; 
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        border-radius: 16px !important; 
        padding: 24px 20px !important; margin-bottom: 15px !important;
        border: 1px solid var(--card-border) !important; 
        border-top: 1px solid rgba(255, 255, 255, 0.2) !important;
        box-shadow: var(--card-shadow) !important; 
        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s ease !important;
    }
    .metric-card:hover, [data-testid="stMetric"]:hover { transform: translateY(-5px) !important; box-shadow: 0 15px 40px rgba(0, 204, 150, 0.2) !important; border-top: 1px solid rgba(0, 204, 150, 0.5) !important;}
    
    .metric-title, [data-testid="stMetricLabel"] > div { color: var(--text-title) !important; font-size: 13px !important; text-transform: uppercase !important; letter-spacing: 1.5px !important; margin-bottom: 8px !important; font-weight: 700 !important; text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important; }
    .metric-value, [data-testid="stMetricValue"] > div { color: var(--text-main) !important; font-size: 34px !important; font-weight: 800 !important; letter-spacing: -1px !important; text-shadow: 0 2px 10px rgba(0,0,0,0.3) !important; }
    .metric-sub, [data-testid="stMetricDelta"] > div { color: var(--text-sub) !important; font-size: 13px !important; margin-top: 10px !important; font-weight: 500 !important; }
    
    /* STRONGER GRADIENTS FOR METRIC STATES */
    .highlight-red { 
        background: linear-gradient(160deg, rgba(255,75,75,0.2) 0%, rgba(255,75,75,0.02) 100%) !important; 
        border-top: 2px solid rgba(255,75,75,0.8) !important; 
        box-shadow: 0 8px 32px rgba(255,75,75,0.15) !important;
    }
    .highlight-green { 
        background: linear-gradient(160deg, rgba(0,204,150,0.2) 0%, rgba(0,204,150,0.02) 100%) !important; 
        border-top: 2px solid rgba(0,204,150,0.8) !important; 
        box-shadow: 0 8px 32px rgba(0,204,150,0.15) !important;
    }
    .highlight-gold { 
        background: linear-gradient(160deg, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.02) 100%) !important; 
        border-top: 2px solid rgba(255,215,0,0.8) !important; 
        box-shadow: 0 8px 32px rgba(255,215,0,0.15) !important;
    }

    [data-baseweb="tab-list"] { gap: 15px; background-color: var(--card-bg); padding: 10px; border-radius: 16px; border: 1px solid var(--card-border); }
    [data-baseweb="tab"] { background-color: transparent !important; border-radius: 10px !important; padding: 8px 16px !important; border: none !important; color: var(--text-title) !important; transition: all 0.3s ease; }
    [data-baseweb="tab"]:hover { color: var(--text-main) !important; background-color: rgba(128,128,128,0.1) !important; }
    [aria-selected="true"] { background-color: rgba(0, 204, 150, 0.15) !important; color: #00CC96 !important; font-weight: bold !important; }
    
    .stButton>button { background-color: var(--btn-bg) !important; color: var(--text-main) !important; border: 1px solid var(--btn-border) !important; border-radius: 12px; height: 3em; font-weight: 700; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .stButton>button:hover { background-color: rgba(0,204,150,0.1) !important; color: #00CC96 !important; border-color: #00CC96 !important; transform: scale(1.02); }
    .stButton>button:active { transform: scale(0.95); }
    button[kind="primary"] { background-color: #00CC96 !important; color: #0E0E10 !important; border: none !important; }
    button[kind="primary"]:hover { box-shadow: 0 0 15px rgba(0, 204, 150, 0.5) !important; background-color: #00b383 !important; color: #0E0E10 !important;}

    [data-testid="stSidebar"] { background-color: var(--sidebar-bg) !important; border-right: 1px solid var(--card-border) !important; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #00CC96; }

    /* Disable Streamlit's annoying white pulsating skeleton loader */
    [data-testid="stSkeleton"], .stSkeleton, .stAppSkeleton {
        display: none !important;
        animation: none !important;
        background: transparent !important;
        opacity: 0 !important;
    }

    @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0.4); } 70% { box-shadow: 0 0 15px 10px rgba(255, 75, 75, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0); } }
    
    /* 🌟 RESTORED GRADIENT DERATION BANNER 🌟 */
    .deration-banner { 
        background: linear-gradient(90deg, rgba(255,75,75,0.25) 0%, rgba(255,75,75,0.02) 100%) !important; 
        backdrop-filter: blur(16px); 
        border: 1px solid rgba(255,75,75,0.3); 
        border-left: 4px solid #FF4B4B; 
        color: #FF4B4B; 
        padding: 15px 20px; 
        border-radius: 12px; 
        font-weight: 800; 
        animation: pulse-red 2s infinite; 
        margin-top: 25px; 
        margin-bottom: 25px; 
        text-align: center; 
    }
    
    .stPlotlyChart { 
        background-color: var(--card-bg) !important; 
        border-radius: 16px !important; 
        box-shadow: var(--card-shadow) !important; 
        border: 1px solid var(--card-border) !important; 
        transition: box-shadow 0.4s ease !important;
        overflow: hidden !important;
    }
    .stPlotlyChart > div { overflow: hidden !important; }
    .stPlotlyChart iframe { overflow: hidden !important; }
    .stPlotlyChart:hover { box-shadow: 0 15px 40px rgba(0, 204, 150, 0.15) !important; }
    
    .raptee-logo { font-family: 'Outfit', sans-serif; font-size: 28px; font-style: italic; font-weight: 900; color: var(--text-main); letter-spacing: 1px; }
    .raptee-hv { color: #00cc96; }
    
    [data-testid="stSidebarNav"] { padding-top: 1.5rem; }
    [data-testid="stSidebarNav"]::before { content: "⚡ VCH SYSTEMS"; color: #00cc96; font-weight: 900; font-size: 1.1rem; letter-spacing: 2px; padding-left: 20px; margin-bottom: 20px; display: block; }
    [data-testid="stSidebarNav"] a { text-transform: uppercase !important; font-weight: 700 !important; font-size: 0.85rem !important; letter-spacing: 1.5px !important; padding: 12px 15px !important; border-radius: 6px !important; margin: 0px 15px 8px 15px !important; transition: all 0.3s ease-in-out !important; color: var(--text-title) !important; }
    [data-testid="stSidebarNav"] a:hover {
        background-color: rgba(255, 255, 255, 0.05) !important;
        color: #FFFFFF !important;
        transform: translateX(6px) !important;
    }
    [data-testid="stSidebarNav"] a[aria-current="page"] {
        background-color: rgba(0, 204, 150, 0.1) !important;
        color: #00cc96 !important;
        border-left: 4px solid #00cc96 !important;
    }
    [data-testid="stSidebarNav"] a[aria-current="page"]::before {
        content: "●";
        color: #00cc96;
        text-shadow: 0 0 8px #00cc96, 0 0 15px #00cc96;
        margin-right: 12px;
        font-size: 1.2rem;
        vertical-align: middle;
    }
    
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #00cc96; box-shadow: 0 0 10px #00cc96; }

    [data-testid="stTabs"] button[role="tab"] {
        font-size: 1.15rem !important;
        font-weight: 800 !important;
        letter-spacing: 0.5px !important;
        padding: 12px 24px !important;
        transition: all 0.2s ease !important;
    }
    [data-testid="stTabs"] button[role="tab"][aria-selected="true"] {
        color: #00cc96 !important;
        border-bottom: 3px solid #00cc96 !important;
    }
    [data-testid="stTabs"] button[role="tab"]:hover {
        color: #fff !important;
        background: rgba(255,255,255,0.05) !important;
    }

</style>
""", unsafe_allow_html=True)

DB_PATH = dyno_engine.DB_PATH
LOGO_PATH = os.path.join(CURRENT_DIR, "raptee_logo.png")
TEMPLATE_PATH = os.path.join(DYNO_DIR, "VCH_Report_Template.docx")

def safe_clear_data():
    try:
        st.cache_data.clear(); gc.collect(); time.sleep(0.5)
        for folder in [dyno_engine.MASTER_FOLDER, dyno_engine.PROCESSED_FOLDER, dyno_engine.BASELINE_FOLDER, dyno_engine.EVAL_FOLDER]:
            if os.path.exists(folder): shutil.rmtree(folder); os.makedirs(folder, exist_ok=True)
        if os.path.exists(dyno_engine.REGISTRY_FILE): os.remove(dyno_engine.REGISTRY_FILE)
        if os.path.exists(DB_PATH): os.remove(DB_PATH)
        return True
    except Exception as e: return False

st.sidebar.title("Dyno VCH Suite")
app_mode = st.sidebar.radio("Navigation", ["Monitor Dashboard", "Data Engine"], key="dyno_app_mode")
st.sidebar.markdown("---")

if app_mode == "Data Engine":
    st.title("Data Engine")
    golden_list_str = ", ".join(dyno_engine.GOLDEN_BIKES)
    st.info(f"👑 **Active Golden Standard:** The Engine uses these bikes to build the Statistical Envelope: **{golden_list_str}**.", icon="ℹ️")
    st.markdown("---")
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("1️⃣ Upload Raw Data")
        data_type = st.radio("Select Test Type", ["Evaluation (Test)", "Baseline (Calibration)"])
        uploaded_files = st.file_uploader("Drop .xlsx file(s) here", type=["xlsx"], accept_multiple_files=True)

        if uploaded_files:
            file_count = len(uploaded_files)
            if st.button(f"💾 Save {file_count} File(s)"):
                target_folder = dyno_engine.BASELINE_FOLDER if data_type.startswith("Baseline") else dyno_engine.EVAL_FOLDER
                for uploaded_file in uploaded_files:
                    save_path = os.path.join(target_folder, uploaded_file.name)
                    with open(save_path, "wb") as f: f.write(uploaded_file.getbuffer())
                st.toast(f"✅ Successfully saved {file_count} files!", icon="💾")

    with col2:
        st.subheader("2️⃣ Engine Controls")
        log_file_path = os.path.join(DYNO_DIR, "engine_logs.txt")

        if st.button("🚀 Run Processing & DB Sync", type="primary"):
            log_stream = io.StringIO()
            with st.status("⚙️ Processing Engine Logic...", expanded=True) as status:
                with redirect_stdout(log_stream), redirect_stderr(log_stream):
                    try:
                        results = dyno_engine.run_processing_cycle()
                        print("✅ Engine Processing Pipeline Complete.")
                        status.update(label="✅ Complete!", state="complete", expanded=False)
                        st.cache_data.clear(); st.success("🚀 Processing Complete!")
                    except Exception as e: 
                        print(f"\\n❌ CRITICAL PIPELINE ERROR: {e}")
                        status.update(label="❌ Failed", state="error")
                with open(log_file_path, "w", encoding="utf-8") as f: f.write(log_stream.getvalue())
                time.sleep(1.5); st.rerun()

        st.markdown("---")
        with st.expander("🗄️ Factory Reset Database"):
            if os.path.exists(DB_PATH):
                with open(DB_PATH, "rb") as f:
                    st.download_button("💾 Download Master SQLite DB", f, file_name="raptee_dyno.db", type="primary")
            st.markdown("---")
            st.warning("Wiping deletes all databases and registries!")
            if st.button("🗑️ CLEAR ALL DATA"):
                if safe_clear_data(): 
                    if os.path.exists(log_file_path): os.remove(log_file_path)
                    st.success("💥 Factory Reset Complete!"); time.sleep(1.5); st.rerun()

        st.markdown("---")
        st.subheader("📜 System Processing Logs")
        if os.path.exists(log_file_path):
            with open(log_file_path, "r", encoding="utf-8") as f: logs = f.read()
            if logs.strip() == "": logs = "No errors or print statements detected in the last run."
            st.text_area("Live Terminal Output:", value=logs, height=250)
        else: st.info("No logs generated yet. Hit Process to capture the terminal output.")

    # 🌟 DEVELOPER ACCESS PANEL
    st.markdown("---")
    st.subheader("🔐 Developer Access: Test Management")
    dev_pass = st.text_input("Enter Developer Password:", type="password", key="dyno_dev_pass")
    
    if dev_pass == "test@123":
        st.success("✅ Access Granted: Developer Mode Unlocked")
        col_d1, col_d2 = st.columns(2)
        
        try:
            sum_df = db_bridge.query_to_df("SELECT Test_Name, Processed_CSV_Path FROM dyno_summaries", db_path=DB_PATH)
            all_processed_tests = sum_df["Test_Name"].tolist()
        except:
            all_processed_tests = []
            sum_df = pd.DataFrame()

        with col_d1:
            st.markdown("#### 🗑️ Delete Specific Test")
            del_test = st.selectbox("Select Test to Delete:", all_processed_tests, key="del_test_sel")
            if st.button("🗑️ Delete Selected Test"):
                if not sum_df.empty:
                    db_bridge.execute_sql("DELETE FROM dyno_summaries WHERE Test_Name=?", params=(del_test,), db_path=DB_PATH)
                    
                    file_path = sum_df[sum_df["Test_Name"] == del_test]["Processed_CSV_Path"].iloc[0]
                    if os.path.exists(file_path): os.remove(file_path)
                    p_path = file_path.replace('.csv', '.parquet')
                    if os.path.exists(p_path): os.remove(p_path)
                    
                    for temp_folder in [dyno_engine.EVAL_FOLDER, dyno_engine.BASELINE_FOLDER]:
                        raw_files = os.listdir(temp_folder) if os.path.exists(temp_folder) else []
                        for rf in raw_files:
                            if rf.split('.')[0] in del_test:
                                os.remove(os.path.join(temp_folder, rf))
                    
                    try:
                        import json
                        registry_file = dyno_engine.REGISTRY_FILE
                        if os.path.exists(registry_file):
                            with open(registry_file, "r") as f:
                                reg = json.load(f)
                            reg["processed_files"] = [f for f in reg.get("processed_files", []) if f.split('.')[0] not in del_test]
                            with open(registry_file, "w") as f:
                                json.dump(reg, f, indent=4)
                    except Exception:
                        pass
                    
                    st.success(f"✅ Deleted {del_test} entirely!")
                    time.sleep(1.5); st.rerun()

        with col_d2:
            st.markdown("#### ⭐ Promote to Golden Baseline")
            st.info("Moves an evaluated test into the Calibration folder to widen the statistical envelope.")
            promo_test = st.selectbox("Select Passing Test to Promote:", all_processed_tests, key="promo_test_sel")
            if st.button("⭐ Promote & Reprocess"):
                raw_files = os.listdir(dyno_engine.EVAL_FOLDER) if os.path.exists(dyno_engine.EVAL_FOLDER) else []
                moved = False
                for rf in raw_files:
                    if rf.split('.')[0] in promo_test:
                        src = os.path.join(dyno_engine.EVAL_FOLDER, rf)
                        dst = os.path.join(dyno_engine.BASELINE_FOLDER, rf)
                        shutil.move(src, dst)
                        moved = True
                if moved:
                    st.success(f"✅ Successfully moved {promo_test} to Baseline! Please click 'Run Processing & DB Sync' above to recalculate the envelope.")
                else:
                    st.warning("⚠️ Could not find the original `.xlsx` file in the Evaluation folder. It may have already been moved.")

elif app_mode == "Monitor Dashboard":
    @st.cache_data(max_entries=3, ttl=1800)
    def load_db_summary():
        if not db_bridge.DATABASE_URL and not os.path.exists(DB_PATH): return pd.DataFrame()
        try:
            return db_bridge.query_to_df("SELECT * FROM dyno_summaries", db_path=DB_PATH)
        except: return pd.DataFrame()

    @st.cache_data(max_entries=3, ttl=1800)
    def load_envelope_data():
        if not db_bridge.DATABASE_URL and not os.path.exists(DB_PATH): return None
        env_data = {}
        for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
            try: 
                env_data[ch] = db_bridge.query_to_df(f"SELECT * FROM envelope_{ch}", db_path=DB_PATH)
            except: pass
        return env_data if env_data else None

    @st.cache_data(max_entries=3, ttl=1800)
    def load_test_data(path):
        p_path = path.replace('.csv', '.parquet')
        if os.path.exists(p_path): return pd.read_parquet(p_path, engine='pyarrow')
        if os.path.exists(path): return pd.read_csv(path)
        return pd.DataFrame()

    @st.cache_data(max_entries=3, ttl=1800)
    def load_raw_data(test_name):
        base_file = f"{test_name}.xlsx"
        path_eval = os.path.join(dyno_engine.EVAL_FOLDER, base_file)
        path_base = os.path.join(dyno_engine.BASELINE_FOLDER, base_file)
        
        target_path = None
        if os.path.exists(path_eval): target_path = path_eval
        elif os.path.exists(path_base): target_path = path_base
        
        if target_path:
            try: return dyno_engine.limit_time_window(dyno_engine.process_raw_file(target_path))
            except Exception: pass
        return pd.DataFrame()

    summary_df = load_db_summary()
    if summary_df.empty: st.error("🚨 SQL Database is empty! Please upload files in the Data Engine first."); st.stop()

    if st.sidebar.button("🔄 Refresh Data"): st.cache_data.clear(); st.rerun()

    envelope_data = load_envelope_data()
    all_tests = summary_df['Test_Name'].tolist()

    # REFACTORED SIDEBAR UX
    with st.sidebar.expander("📂 Mission Control & Navigation", expanded=True):
        st.markdown("##### 1. Data Browser")
        available_timeframes = sorted(list(set([t[:7] for t in all_tests])), reverse=True)
        selected_timeframes = st.multiselect("Timeframe (YYYY-MM)", ["All Timeframes"] + available_timeframes, default=["All Timeframes"])
        
        time_filtered_tests = all_tests
        if "All Timeframes" not in selected_timeframes:
            time_filtered_tests = [t for t in all_tests if t[:7] in selected_timeframes]
            
        def get_bike_no(test_name): return test_name.split('-')[1] if len(test_name.split('-')) > 1 else test_name
        available_bikes = sorted(list(set([get_bike_no(t) for t in time_filtered_tests])))
        selected_bikes = st.multiselect("Vehicle ID", ["All Vehicles"] + available_bikes, default=["All Vehicles"])
        
        bike_filtered_tests = time_filtered_tests
        if "All Vehicles" not in selected_bikes:
            bike_filtered_tests = [t for t in time_filtered_tests if get_bike_no(t) in selected_bikes]
            
        if not bike_filtered_tests: 
            st.warning("No tests found for the selected criteria.")
            st.stop()

        st.markdown("---")
        st.markdown("##### 2. Active Selection")
        primary_test = st.selectbox("Primary Test Overlay", bike_filtered_tests)
        compare_tests = st.multiselect("Comparison Overlays", [t for t in bike_filtered_tests if t != primary_test])

    with st.sidebar.expander("⚙️ Diagnostic & Hardware Config", expanded=False):
        st.markdown("##### 1. Channels")
        channels = st.multiselect("Telemetry Channels", ["IGBT", "Motor", "HighCell", "AFE"], default=["IGBT", "Motor"])
        
        st.markdown("---")
        st.markdown("##### 2. Advanced Settings")
        envelope_mode = st.radio("Method:", ["Statistical (2-Sigma)", "Tolerance (%)"], key="dyno_env_mode")
        tol_pct = 5
        if envelope_mode == "Tolerance (%)": tol_pct = st.selectbox("Tolerance Range", [5, 10, 15, 20], index=3, format_func=lambda x: f"± {x}%")
        duration_option = st.selectbox("Snapshot Duration", ["1 min", "2 min", "3 min"], index=1)
        duration_seconds = {"1 min": 60, "2 min": 120, "3 min": 180}[duration_option]

    dtdt_map = {"IGBT": "IGBT_dTdt", "Motor": "Motor_dTdt", "HighCell": "HighCell_dTdt", "AFE": "AFE_Mean_dTdt"}
    deltat_map = {"IGBT": "IGBT_dT", "Motor": "Motor_dT", "HighCell": "HighCell_dT", "AFE": "AFE_Mean_dT"}
    limit_map = {"IGBT": 95, "Motor": 125, "HighCell": 50, "AFE": 50}
    
    summary_row = summary_df[summary_df["Test_Name"] == primary_test].iloc[0]
    primary_csv_path = summary_row["Processed_CSV_Path"]
    df_primary = load_test_data(primary_csv_path)

    col_logo, col_title, col_exp = st.columns([1.5, 6.5, 2])
    with col_logo:
        st.markdown("<div style='margin-top: 15px;'></div>", unsafe_allow_html=True)
        if os.path.exists(LOGO_PATH): st.image(LOGO_PATH, width=180)
        else: st.markdown("<div class='raptee-logo'>RAPTEE<span class='raptee-hv'>.HV</span></div>", unsafe_allow_html=True)
    with col_title:
        st.markdown(f"<h1 style='margin-top: -20px; padding-bottom: 0px;'>VCH - Dyno Thermal Monitor</h1>", unsafe_allow_html=True)
        st.markdown(f"**Target:** `{primary_test}`")
    with col_exp:
        st.markdown("<div style='margin-top: 15px;'></div>", unsafe_allow_html=True)
        st.download_button("📥 Export FULL 2Hz Trace", df_primary.to_csv(index=False).encode('utf-8'), file_name=f"{primary_test[:10]}_full_trace.csv", mime="text/csv", use_container_width=True)

    test_date, total_duration = primary_test[:10], int(df_primary["Time (s)"].max()) if "Time (s)" in df_primary.columns else 0
    avg_power = f"{df_primary['Electrical Power (kW)'].max():.2f} kW (Max)" if "Electrical Power (kW)" in df_primary.columns else "Data Not Found"

    # 🌟 FETCH DCIR METRIC FROM DB
    dcir_val = summary_row.get("Pack_DCIR_mOhm", 0.0)
    dcir_display = f"{dcir_val} mΩ" if pd.notna(dcir_val) and dcir_val > 0 else "N/A"

    st.markdown(f"""
    <div style="background: #191A20; border: 1px solid var(--card-border); border-radius: 12px; padding: 15px 20px; margin-top: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: none !important;">
        <div style="text-align: center;"><div style="color: var(--text-title); font-size: 11px; text-transform: uppercase; font-weight: 700; text-shadow: none !important;">Test Date</div><div style="color: var(--text-main); font-weight: bold; font-size: 14px; text-shadow: none !important;">📅 {test_date}</div></div>
        <div style="border-left: 1px solid var(--card-border); height: 30px;"></div>
        <div style="text-align: center;"><div style="color: var(--text-title); font-size: 11px; text-transform: uppercase; font-weight: 700; text-shadow: none !important;">Test Type</div><div style="color: var(--text-main); font-weight: bold; font-size: 14px; text-shadow: none !important;">🏍️ Dyno Thermal</div></div>
        <div style="border-left: 1px solid var(--card-border); height: 30px;"></div>
        <div style="text-align: center;"><div style="color: var(--text-title); font-size: 11px; text-transform: uppercase; font-weight: 700; text-shadow: none !important;">Dyno Set Speed</div><div style="color: var(--text-main); font-weight: bold; font-size: 14px; text-shadow: none !important;">🏁 60 kmph</div></div>
        <div style="border-left: 1px solid var(--card-border); height: 30px;"></div>
        <div style="text-align: center;"><div style="color: var(--text-title); font-size: 11px; text-transform: uppercase; font-weight: 700; text-shadow: none !important;">Electrical Power</div><div style="color: var(--text-main); font-weight: bold; font-size: 14px; text-shadow: none !important;">⚡ {avg_power}</div></div>
        <div style="border-left: 1px solid var(--card-border); height: 30px;"></div>
        <div style="text-align: center;"><div style="color: var(--text-title); font-size: 11px; text-transform: uppercase; font-weight: 700; text-shadow: none !important;">Pack DCIR</div><div style="color: #00CC96; font-weight: bold; font-size: 14px; text-shadow: none !important;">🔋 {dcir_display}</div></div>
        <div style="border-left: 1px solid var(--card-border); height: 30px;"></div>
        <div style="text-align: center;"><div style="color: var(--text-title); font-size: 11px; text-transform: uppercase; font-weight: 700; text-shadow: none !important;">Total Duration</div><div style="color: var(--text-main); font-weight: bold; font-size: 14px; text-shadow: none !important;">⏱️ {total_duration} s</div></div>
    </div>
    """, unsafe_allow_html=True)

    cols = st.columns(4)
    first_deration_comp, first_deration_time = None, None
    first_deration_cell_str = ""

    max_temps = {ch: summary_row.get(f"{ch}_Raw_Max", 0) for ch in channels}
    dominant_channel = max(max_temps, key=max_temps.get) if max_temps else None

    for i, ch in enumerate(channels):
        limit = limit_map[ch]
        max_val = summary_row.get(f"{ch}_Raw_Max", 0)
        t_max = summary_row.get(f"{ch}_Peak_Time", 0)
        deration_val = summary_row.get(f"{ch}_Deration_Time", "SAFE")
        
        extra_info = ""
        if ch == "HighCell":
            cell_num = summary_row.get("HighCell_Peak_Cell_No", pd.NA)
            if pd.notna(cell_num) and cell_num > 0: extra_info = f" | Cell: <b>#{int(cell_num)}</b>"

        is_breach = str(deration_val) != "SAFE"
        if is_breach:
            status_text, card_style, val_color, duration_str = "⚠️ BREACH", "metric-card highlight-red", "#FF4B4B", f"Derated @ <b>{deration_val}s</b>"
            deration_time_float = float(deration_val)
            if first_deration_time is None or deration_time_float < first_deration_time:
                first_deration_time, first_deration_comp = deration_time_float, ch
                first_deration_cell_str = f" **(Caused by Cell #{int(cell_num)})**" if ch == "HighCell" and pd.notna(cell_num) and cell_num > 0 else ""
        else:
            status_text, card_style, val_color, duration_str = "✅ SAFE", "metric-card highlight-green", "#00CC96", "0s"

        if ch == dominant_channel: card_style += " highlight-gold"

        with cols[i]:
            st.markdown(f"""
            <div class="{card_style}">
                <div class="metric-title">{ch} Raw Max Temp</div>
                <div class="metric-value" style="color:{val_color}">{max_val} °C</div>
                <div class="metric-sub">Peak @ {t_max}s {extra_info}</div>
                <div class="metric-sub" style="border-top:1px solid var(--card-border); margin-top:8px; padding-top:5px;">
                    Limit: {limit}°C | {status_text} <br> {duration_str}
                </div>
            </div>
            """, unsafe_allow_html=True)

    if first_deration_comp: st.markdown(f"<div class='deration-banner'>⚠️ First Deration Detected: {first_deration_comp} crossed safety limit at {first_deration_time} s {first_deration_cell_str}</div>", unsafe_allow_html=True)
    st.markdown("---")

    tab_dtdt, tab_delta, tab_custom, tab_power, tab_battery, tab_repo, tab_fleet = st.tabs(["⚡ Rise Rate (dT/dt)", "📈 Cumulative Rise (ΔT)", "🗺️ Dynamic 3D Plotter", "🔋 Power Analysis", "🪫 Battery Health", "📋 Test Repository", "🏍️ Fleet Registry"])

    with tab_dtdt:
        st.subheader(f"⚡ Rise Rate Snapshot @ {duration_option}", help="Displays the rate of temperature change (dT/dt) over time. Comparing this to the golden statistical envelope helps identify anomalous heating behaviors early in the test.")
        plot_cols = st.columns(2)
        for i, ch in enumerate(channels):
            col_name = dtdt_map[ch]
            with plot_cols[i % 2]:
                fig = go.Figure()
                if envelope_data and ch in envelope_data:
                    env = envelope_data[ch]
                    mean_col = "dTdt_Mean"
                    upper_col, lower_col, env_label = (f"dTdt_Upper_2Sigma", f"dTdt_Lower_2Sigma", "2-Sigma") if envelope_mode == "Statistical (2-Sigma)" else (f"dTdt_Upper_{tol_pct}Pct", f"dTdt_Lower_{tol_pct}Pct", f"±{tol_pct}%")
                    if mean_col in env.columns:
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[mean_col], name="Mean", line=dict(color="#8A8A93", width=2, dash="dash", shape='spline', smoothing=0.8)))
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[upper_col], name=f"Upper ({env_label})", line=dict(color="cyan", width=1, dash="dot", shape='spline', smoothing=0.8)))
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[lower_col], name=f"Lower ({env_label})", line=dict(color="cyan", width=1, dash="dot", shape='spline', smoothing=0.8), fill='tonexty', fillcolor='rgba(0,255,255,0.05)'))
                fig.add_trace(go.Scatter(x=df_primary["Time (s)"], y=df_primary[col_name], name=f"⭐ {primary_test}", line=dict(color="#00CC96", width=3, shape='spline', smoothing=0.8)))
                
                for test in compare_tests:
                    cmp_path = summary_df[summary_df["Test_Name"] == test]["Processed_CSV_Path"].iloc[0]
                    df_cmp = load_test_data(cmp_path)
                    if not df_cmp.empty and col_name in df_cmp.columns: fig.add_trace(go.Scatter(x=df_cmp["Time (s)"], y=df_cmp[col_name], name=f"🔄 {test}", line=dict(width=1.5, dash='dot', shape='spline', smoothing=0.8), opacity=0.7))
                
                fig.update_layout(
                    title=f"{ch} Rise Rate", xaxis_title="Time (s)", yaxis_title="°C/s", height=400, hovermode="x unified",
                    plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=40, b=10),
                    xaxis=dict(showgrid=False, zeroline=False), yaxis=dict(showgrid=True, gridcolor='rgba(128,128,128,0.2)', zeroline=False)
                )
                st.plotly_chart(fig, use_container_width=True)
                
                export_df_dtdt = df_primary[['Time (s)', col_name]].to_csv(index=False).encode('utf-8')
                st.download_button(label=f"📥 Export {ch} dT/dt Data", data=export_df_dtdt, file_name=f"{primary_test[:10]}_{ch}_dTdt.csv", mime="text/csv", key=f"dl_dtdt_{ch}_{i}", use_container_width=True)

    with tab_delta:
        st.subheader(f"📈 Cumulative Rise Snapshot @ {duration_option}", help="Tracks the total accumulated heat from the start of the test (T=0s). Evaluates if the component's heat-soak remains within acceptable historical limits.")
        plot_cols = st.columns(2)
        for i, ch in enumerate(channels):
            col_name = deltat_map[ch]
            with plot_cols[i % 2]:
                fig = go.Figure()
                if envelope_data and ch in envelope_data:
                    env = envelope_data[ch]
                    mean_col = "dT_Mean"
                    upper_col, lower_col, env_label = (f"dT_Upper_2Sigma", f"dT_Lower_2Sigma", "2-Sigma") if envelope_mode == "Statistical (2-Sigma)" else (f"dT_Upper_{tol_pct}Pct", f"dT_Lower_{tol_pct}Pct", f"±{tol_pct}%")
                    if mean_col in env.columns:
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[mean_col], name="Mean", line=dict(color="#8A8A93", width=2, dash="dash", shape='spline', smoothing=0.8)))
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[upper_col], name=f"Upper ({env_label})", line=dict(color="cyan", width=1, dash="dot", shape='spline', smoothing=0.8)))
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[lower_col], name=f"Lower ({env_label})", line=dict(color="cyan", width=1, dash="dot", shape='spline', smoothing=0.8), fill='tonexty', fillcolor='rgba(0,255,255,0.05)'))
                fig.add_trace(go.Scatter(x=df_primary["Time (s)"], y=df_primary[col_name], name=f"⭐ {primary_test}", line=dict(color="#FF4B4B", width=3, shape='spline', smoothing=0.8)))
                
                for test in compare_tests:
                    cmp_path = summary_df[summary_df["Test_Name"] == test]["Processed_CSV_Path"].iloc[0]
                    df_cmp = load_test_data(cmp_path)
                    if not df_cmp.empty and col_name in df_cmp.columns: fig.add_trace(go.Scatter(x=df_cmp["Time (s)"], y=df_cmp[col_name], name=f"🔄 {test}", line=dict(width=1.5, dash='dot', shape='spline', smoothing=0.8), opacity=0.7))
                
                fig.update_layout(
                    title=f"{ch} Cumulative Rise", xaxis_title="Time (s)", yaxis_title="ΔT (°C)", height=400, hovermode="x unified",
                    plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=40, b=10),
                    xaxis=dict(showgrid=False, zeroline=False), yaxis=dict(showgrid=True, gridcolor='rgba(128,128,128,0.2)', zeroline=False)
                )
                st.plotly_chart(fig, use_container_width=True)
                
                export_df_dt = df_primary[['Time (s)', col_name]].to_csv(index=False).encode('utf-8')
                st.download_button(label=f"📥 Export {ch} ΔT Data", data=export_df_dt, file_name=f"{primary_test[:10]}_{ch}_DeltaT.csv", mime="text/csv", key=f"dl_dt_{ch}_{i}", use_container_width=True)

    with tab_custom:
        st.subheader("🗺️ Dynamic Multi-Plot & 3D Sandbox")

        df_raw = load_raw_data(primary_test)
        if not df_raw.empty:
            st.caption(f"🔬 **Full Resolution Mode:** Plotting {len(df_raw)} raw data points from native telemetry (2Hz).")
        else:
            df_raw = df_primary.copy()
            st.caption("⚠️ Raw Excel file not found in Source Folders. Showing 10s sampled data for now.")

        col_x, col_y1, col_y2, col_z = st.columns([1, 1.5, 1.5, 1])
        with col_x: x_axis = st.selectbox("⚙️ X-Axis", df_raw.columns.tolist(), index=df_raw.columns.tolist().index("Time (s)") if "Time (s)" in df_raw.columns else 0)
        with col_y1: 
            default_y = ["Motor_Temp (oC)"]
            y_axes = st.multiselect("📊 Left Y-Axis", df_raw.columns.tolist(), default=[dy for dy in default_y if dy in df_raw.columns])
        with col_y2: y_axes_sec = st.multiselect("📈 Right Y-Axis (Secondary)", df_raw.columns.tolist(), default=[])
        with col_z: z_axis = st.selectbox("🗺️ Z-Axis (3D Mode)", ["None"] + df_raw.columns.tolist(), index=0)
            
        if y_axes or y_axes_sec:
            if z_axis != "None":
                plot_y = y_axes[0] if y_axes else y_axes_sec[0]
                fig_multi = px.scatter_3d(df_raw, x=x_axis, y=plot_y, z=z_axis, color=z_axis, color_continuous_scale='Turbo', opacity=0.7)
                fig_multi.update_layout(margin=dict(l=0, r=0, b=0, t=0), height=600, plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)')
                st.plotly_chart(fig_multi, use_container_width=True)
                if len(y_axes) + len(y_axes_sec) > 1: st.warning("⚠️ 3D Mode only visualizes the first selected Y-Axis.")
            else:
                fig_multi = go.Figure()
                for y_col in y_axes: 
                    fig_multi.add_trace(go.Scatter(x=df_raw[x_axis], y=df_raw[y_col], mode='lines', name=f"{y_col} (L)", line=dict(shape='spline', smoothing=0.8)))
                for y_col in y_axes_sec: 
                    fig_multi.add_trace(go.Scatter(x=df_raw[x_axis], y=df_raw[y_col], mode='lines', name=f"{y_col} (R)", yaxis="y2", line=dict(dash='dot', shape='spline', smoothing=0.8)))
                
                fig_multi.update_layout(
                    hovermode="x unified", height=600, xaxis_title=x_axis,
                    plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=30, b=10),
                    xaxis=dict(showgrid=False, zeroline=False),
                    yaxis=dict(title="Left Axis (Primary)", showgrid=True, gridcolor='rgba(255,255,255,0.05)', zeroline=False),
                    yaxis2=dict(title="Right Axis (Secondary)", overlaying="y", side="right", showgrid=False)
                )
                st.plotly_chart(fig_multi, use_container_width=True)
                
            cols_to_export = [x_axis] + y_axes + y_axes_sec
            if z_axis != "None" and z_axis not in cols_to_export: cols_to_export.append(z_axis)
            export_custom_df = df_raw[list(set(c for c in cols_to_export if c in df_raw.columns))].to_csv(index=False).encode('utf-8')
            st.download_button(label="📥 Export Full Resolution Data", data=export_custom_df, file_name=f"{primary_test[:10]}_FullRes_Plot.csv", mime="text/csv", key="dl_custom_sandbox")

    with tab_power:
        st.subheader(f"🔋 Electrical Power Analysis @ {duration_option}", help=f"Visualizes the dynamic load maintained from 0s to {duration_seconds}s. Ensures the vehicle was tested under the correct electrical load compared to the Golden Baseline.")
        golden_powers_tab = []
        for index, row in summary_df.iterrows():
            test_name = row["Test_Name"]
            if any(gold in test_name for gold in dyno_engine.GOLDEN_BIKES):
                pwr = row.get("Power_Avg_120s", 0)
                if 19 <= pwr <= 20.5: golden_powers_tab.append(pwr)
        master_golden_power_tab = sum(golden_powers_tab)/len(golden_powers_tab) if golden_powers_tab else 19.5
        pwr_upper_tab, pwr_lower_tab = master_golden_power_tab * 1.10, master_golden_power_tab * 0.90
        
        col_p1, col_p2, col_p3 = st.columns(3)
        col_p1.metric("👑 Golden Mean Power", f"{master_golden_power_tab:.2f} kW")
        col_p2.metric("🔼 Upper Boundary (+10%)", f"{pwr_upper_tab:.2f} kW")
        col_p3.metric("🔽 Lower Boundary (-10%)", f"{pwr_lower_tab:.2f} kW")
        
        power_records = []
        for index, row in summary_df.iterrows():
            test_name = row["Test_Name"]
            bike_power = row.get("Power_Avg_120s", 0)
            status = "✅ PASS" if pwr_lower_tab <= bike_power <= pwr_upper_tab else "❌ FAIL"
            is_golden_str = "⭐ Golden" if any(gold in test_name for gold in dyno_engine.GOLDEN_BIKES) else "Evaluation"
            power_records.append({"Test Name": test_name, "Type": is_golden_str, "Avg Power (kW)": round(bike_power, 2), "Status": status})
            
        power_df = pd.DataFrame(power_records)
        if not power_df.empty:
            color_map = {"✅ PASS": "#00CC96", "❌ FAIL": "#FF4B4B"}
            fig_pwr = px.bar(power_df, x="Test Name", y="Avg Power (kW)", color="Status", color_discrete_map=color_map, text="Avg Power (kW)")
            fig_pwr.add_hline(y=pwr_upper_tab, line_dash="dash", line_color="cyan", annotation_text="Upper Limit")
            fig_pwr.add_hline(y=pwr_lower_tab, line_dash="dash", line_color="cyan", annotation_text="Lower Limit")
            fig_pwr.add_hline(y=master_golden_power_tab, line_color="gold", annotation_text="Golden Mean")
            fig_pwr.update_layout(
                xaxis_title="Bike ID", yaxis_title="Mean Power (kW)", height=400, hovermode="x unified",
                plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=30, b=10),
                xaxis=dict(showgrid=False, zeroline=False), yaxis=dict(showgrid=True, gridcolor='rgba(128,128,128,0.2)', zeroline=False)
            )
            fig_pwr.update_traces(textposition='auto', marker_line_color='rgba(0,0,0,0)')
            st.plotly_chart(fig_pwr, use_container_width=True)
            
            st.markdown("#### 📋 Segregated Power Validation Results")
            col_pass, col_fail = st.columns(2)
            with col_pass:
                st.success("✅ **Passed Power Criteria**")
                pass_df = power_df[power_df["Status"] == "✅ PASS"].drop(columns=["Status"])
                st.dataframe(pass_df, hide_index=True, use_container_width=True)
            with col_fail:
                st.error("❌ **Failed Power Criteria**")
                fail_df = power_df[power_df["Status"] == "❌ FAIL"].drop(columns=["Status"])
                st.dataframe(fail_df, hide_index=True, use_container_width=True)
            
            export_pwr_df = power_df.to_csv(index=False).encode('utf-8')
            st.download_button(label="📥 Export Power Validation Data", data=export_pwr_df, file_name="Dyno_Power_Analysis.csv", mime="text/csv", key="dl_power_analysis")

    # 🌟 NEW: INTERACTIVE BATTERY DIAGNOSTICS TAB WITH TABLES 🌟
    with tab_battery:
        st.subheader("🪫 Interactive Battery Health & DCIR Diagnostics")
        st.markdown("Manually adjust the load brackets below to dynamically recalculate Direct Current Internal Resistance (DCIR) for the primary test.")

        # USE FULL RESOLUTION DATA FOR BATTERY HEALTH
        df_batt = load_raw_data(primary_test)
        if df_batt.empty: df_batt = df_primary.copy()
        else: st.caption(f"🔋 **Diagnostic Mode:** Analyzing {len(df_batt)} raw frames (2Hz) for absolute precision.")

        vol_col_candidates = ["Cumm_Volatge (V)", "Cumm_Voltage (V)", "DC_Volatge (V)", "DC_Voltage (V)"]
        vol_col = next((c for c in df_batt.columns if c in vol_col_candidates), None)
        if not vol_col:
            vol_col = next((c for c in df_batt.columns if ('voltage' in c.lower() or 'volatge' in c.lower()) and 'highest' not in c.lower() and 'lowest' not in c.lower()), None)
            
        cur_col_candidates = ["FG_Current (A)", "DC_Current (A)", "Current (A)"]
        cur_col = next((c for c in df_batt.columns if c in cur_col_candidates), None)
        if not cur_col:
            cur_col = next((c for c in df_batt.columns if 'current' in c.lower()), None)

        if vol_col and cur_col:
            dyn_dcir_mohm = 0.0
            v_load, i_load, t_load = 0.0, 0.0, 0.0
            v_rest, i_rest, t_rest = 0.0, 0.0, 0.0
            pts_found = False
            
            try:
                cur_abs = df_batt[cur_col].abs()
                # Step 1: Find the FIRST time current crosses above 30A (the load event)
                crossing_mask = cur_abs > 30.0
                if crossing_mask.any():
                    first_cross_idx = crossing_mask.idxmax()
                    
                    # Step 2: Look BACKWARD for the quietest rest point before the load
                    lookback = df_batt.index.get_loc(first_cross_idx)
                    start_bound_loc = max(0, lookback - 60)
                    pre_load = df_batt.iloc[start_bound_loc:lookback + 1]
                    rest_idx = pre_load[cur_col].abs().idxmin()
                    
                    # Step 3: Look FORWARD for the saturation peak current for this bike
                    end_bound_loc = min(len(df_batt), lookback + 60)
                    post_load = df_batt.iloc[lookback:end_bound_loc]
                    if df_batt[cur_col].mean() < 0:
                        load_idx = post_load[cur_col].idxmin()
                    else:
                        load_idx = post_load[cur_col].idxmax()

                    v_rest = df_batt.loc[rest_idx, vol_col]
                    i_rest = df_batt.loc[rest_idx, cur_col]
                    t_rest = df_batt.loc[rest_idx, 'Time (s)']
                    v_load = df_batt.loc[load_idx, vol_col]
                    i_load = df_batt.loc[load_idx, cur_col]
                    t_load = df_batt.loc[load_idx, 'Time (s)']
                    
                    delta_i = abs(i_load - i_rest)
                    if delta_i > 15.0:
                        dyn_dcir_mohm = round((abs(v_rest - v_load) / delta_i) * 1000, 2)
                        pts_found = True
            except Exception:
                pass
            
            st.metric("📊 Computed DCIR Result", f"{dyn_dcir_mohm} mΩ" if pts_found else "N/A")

            st.markdown("---")
            st.markdown("#### ⚡ Voltage Sag vs. Current Draw")
            fig_bat = go.Figure()
            fig_bat.add_trace(go.Scatter(x=df_batt["Time (s)"], y=df_batt[cur_col], mode='lines', name='Current (A)', line=dict(color='#FF4B4B', width=2, shape='spline', smoothing=0.8)))
            fig_bat.add_trace(go.Scatter(x=df_batt["Time (s)"], y=df_batt[vol_col], mode='lines', name='Voltage (V)', yaxis='y2', line=dict(color='#00CC96', width=2, shape='spline', smoothing=0.8)))

            # DYNAMIC CROSSHAIR MARKERS
            if pts_found:
                fig_bat.add_trace(go.Scatter(x=[t_load, t_rest], y=[i_load, i_rest], mode='markers', name='Selected Current Pts', marker=dict(color='yellow', size=12, symbol='x')))
                fig_bat.add_trace(go.Scatter(x=[t_load, t_rest], y=[v_load, v_rest], mode='markers', name='Selected Voltage Pts', yaxis='y2', marker=dict(color='yellow', size=12, symbol='circle-open', line_width=2)))

            fig_bat.update_layout(
                hovermode="x unified", height=450, legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=40, b=10),
                xaxis=dict(showgrid=False, zeroline=False, title="Time (s)"),
                yaxis=dict(showgrid=True, gridcolor='rgba(128,128,128,0.2)', title="Current (A)", zeroline=False),
                yaxis2=dict(title="Voltage (V)", overlaying="y", side="right", showgrid=False, zeroline=False)
            )
            st.plotly_chart(fig_bat, use_container_width=True)
            
            # ==========================================
            # 📋 SEGREGATED DCIR RESULTS TABLE
            # ==========================================
            st.markdown("---")
            st.markdown("#### 📋 Segregated DCIR Validation Results")
            st.write("Compare the Database DCIR values across all tests to flag pack degradation.")
            
            golden_dcirs = summary_df[summary_df["Test_Name"].apply(lambda x: any(g in x for g in dyno_engine.GOLDEN_BIKES))]["Pack_DCIR_mOhm"]
            golden_dcirs = golden_dcirs[golden_dcirs > 0]
            master_golden_dcir = golden_dcirs.mean() if not golden_dcirs.empty else 50.0 
            default_dcir_limit = master_golden_dcir * 1.15 # Default 15% degradation limit
            
            dcir_upper_limit = float(round(default_dcir_limit, 2))
            
            dcir_records = []
            for _, row in summary_df.iterrows():
                t_name = row["Test_Name"]
                d_val = row.get("Pack_DCIR_mOhm", 0.0)
                
                if d_val == 0:
                    status = "❌ FAIL (No Data)"
                elif d_val <= dcir_upper_limit:
                    status = "✅ PASS"
                else:
                    status = "❌ FAIL (High Res)"
                    
                t_type = "⭐ Golden" if any(g in t_name for g in dyno_engine.GOLDEN_BIKES) else "Evaluation"
                dcir_records.append({"Test Name": t_name, "Type": t_type, "DCIR (mΩ)": round(d_val, 2), "Status": status})
                    
            dcir_df = pd.DataFrame(dcir_records)
            
            col_dpass, col_dfail = st.columns(2)
            with col_dpass:
                st.success("✅ **Passed DCIR Criteria**")
                pass_df = dcir_df[dcir_df["Status"] == "✅ PASS"].drop(columns=["Status"])
                st.dataframe(pass_df, hide_index=True, use_container_width=True)
            with col_dfail:
                st.error("❌ **Failed DCIR Criteria**")
                fail_df = dcir_df[dcir_df["Status"].str.contains("FAIL")].drop(columns=["Status"])
                st.dataframe(fail_df, hide_index=True, use_container_width=True)
                
            export_dcir_df = dcir_df.to_csv(index=False).encode('utf-8')
            st.download_button(label="📥 Export Master DCIR Data", data=export_dcir_df, file_name="Dyno_DCIR_Analysis.csv", mime="text/csv", key="dl_dcir_analysis")

        else:
            st.info("Voltage and Current channels not found in this dataset to generate Interactive DCIR plots.")

    with tab_repo:
        st.subheader("📂 Quality Control (QC) Gatekeeper", help="Dynamic Pass/Fail Evaluation based on thermal envelope, cumulative rise, early derations, and active power constraints.")
        
        col_f1, col_f2, col_f3, col_f4, col_f5 = st.columns(5)
        with col_f1:
            repo_time = st.selectbox("⏳ QC Timestamp", ["1 min (60s)", "2 min (120s)", "3 min (180s)"], index=1)
            repo_time_s = {"1 min (60s)": 60, "2 min (120s)": 120, "3 min (180s)": 180}[repo_time]
        with col_f2: repo_env = st.selectbox("📏 Env Method", ["Tolerance (%)", "Statistical (2-Sigma)"])
        with col_f3:
            repo_tol = 20
            if repo_env == "Tolerance (%)": repo_tol = st.selectbox("Tolerance Range", [5, 10, 15, 20], index=3, format_func=lambda x: f"± {x}%")
        with col_f4: repo_target = st.selectbox("🎯 Target Data", ["All Data", "IGBT", "Motor", "HighCell", "AFE", "Electrical Power"])
        with col_f5: repo_metric = st.selectbox("📉 Assessment", ["All Assessments", "dT/dt", "dT", "Power Based"])

        try:
            golden_powers = []
            for index, row in summary_df.iterrows():
                test_name = row["Test_Name"]
                if any(gold in test_name for gold in dyno_engine.GOLDEN_BIKES):
                    pwr = row.get("Power_Avg_120s", 0)
                    if 19 <= pwr <= 20.5: golden_powers.append(pwr)
            
            master_golden_power = sum(golden_powers)/len(golden_powers) if golden_powers else 19.5
            pwr_upper, pwr_lower = master_golden_power * 1.10, master_golden_power * 0.90
            
            st.markdown(f"### Master Golden Criteria @ {repo_time}")
            st.markdown(f"""
            <div style="background: var(--card-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-top: 4px solid #FFD700; border-radius: 16px; padding: 20px; margin-bottom: 15px; box-shadow: var(--card-shadow);">
                <div style="color: var(--text-title); font-size: 14px; margin-bottom: 5px; text-transform: uppercase; font-weight: 600;">⚡ Electrical Power Validation (0s to 120s)</div>
                <div style="color: #00CC96; font-size: 24px; font-weight: 800;">{pwr_upper:.2f} kW <span style='color:var(--text-sub)'>&nbsp;|&nbsp;</span> <span style='color:var(--text-main)'>{master_golden_power:.2f} kW</span> <span style='color:var(--text-sub)'>&nbsp;|&nbsp;</span> {pwr_lower:.2f} kW</div>
            </div>
            """, unsafe_allow_html=True)
            
            qc_snapshot_channels = ["IGBT", "Motor", "HighCell", "AFE"]
            cols_dtdt = st.columns(4)
            cols_dt = st.columns(4)
            
            if envelope_data:
                for i, ch in enumerate(qc_snapshot_channels):
                    if ch in envelope_data:
                        env_df = envelope_data[ch]
                        env_row = env_df[env_df["Time (s)"] == repo_time_s]
                        if not env_row.empty:
                            mean_dtdt = env_row["dTdt_Mean"].values[0]
                            up_dtdt = env_row[f"dTdt_Upper_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dTdt_Upper_2Sigma"].values[0]
                            low_dtdt = env_row[f"dTdt_Lower_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dTdt_Lower_2Sigma"].values[0]
                            cols_dtdt[i].markdown(f"""
                            <div style="background: var(--card-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--card-border); border-radius: 12px; padding: 15px; text-align: center; margin-bottom: 10px; box-shadow: var(--card-shadow);">
                                <div style="color: var(--text-title); font-size: 12px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase;">{ch} Rise Rate (°C/s)</div>
                                <div style="color: #00CC96; font-size: 18px; font-weight: bold;">{up_dtdt:.3f} <span style='color:var(--text-sub)'>|</span> <span style='color:var(--text-main)'>{mean_dtdt:.3f}</span> <span style='color:var(--text-sub)'>|</span> {low_dtdt:.3f}</div>
                            </div>
                            """, unsafe_allow_html=True)

                            mean_dt = env_row["dT_Mean"].values[0]
                            up_dt = env_row[f"dT_Upper_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dT_Upper_2Sigma"].values[0]
                            low_dt = env_row[f"dT_Lower_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dT_Lower_2Sigma"].values[0]
                            cols_dt[i].markdown(f"""
                            <div style="background: var(--card-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--card-border); border-radius: 12px; padding: 15px; text-align: center; margin-bottom: 10px; box-shadow: var(--card-shadow);">
                                <div style="color: var(--text-title); font-size: 12px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase;">{ch} Cumulative Rise (°C)</div>
                                <div style="color: #FF4B4B; font-size: 18px; font-weight: bold;">{up_dt:.2f} <span style='color:var(--text-sub)'>|</span> <span style='color:var(--text-main)'>{mean_dt:.2f}</span> <span style='color:var(--text-sub)'>|</span> {low_dt:.2f}</div>
                            </div>
                            """, unsafe_allow_html=True)
            st.markdown("---")

            repo_results = []
            for index, row in summary_df.iterrows():
                test_name, bike_type, bike_power = row["Test_Name"], row["Type"], row.get("Power_Avg_120s", 0)
                csv_path = row["Processed_CSV_Path"]
                df_test = load_test_data(csv_path)
                if df_test.empty: continue
                
                t_eval_row = pd.merge_asof(pd.DataFrame({"Time (s)": [float(repo_time_s)]}), df_test.sort_values("Time (s)"), on="Time (s)", direction="nearest")
                if t_eval_row.empty: continue
                
                repo_row = {"Test Name": test_name, "Type": bike_type}
                failed_dt, failed_dtdt = [], []

                for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
                    val_dtdt = t_eval_row[dtdt_map[ch]].values[0] if dtdt_map[ch] in t_eval_row.columns else 0
                    val_dt = t_eval_row[deltat_map[ch]].values[0] if deltat_map[ch] in t_eval_row.columns else 0
                    repo_row[f"{ch} dTdt"] = round(val_dtdt, 3)
                    repo_row[f"{ch} dT"] = round(val_dt, 2)
                    
                    if repo_target not in ["All Data", ch] or repo_metric == "Power Based": continue

                    if envelope_data and ch in envelope_data:
                        env_row = envelope_data[ch][envelope_data[ch]["Time (s)"] == repo_time_s]
                        if not env_row.empty:
                            up_dtdt = env_row[f"dTdt_Upper_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dTdt_Upper_2Sigma"].values[0]
                            low_dtdt = env_row[f"dTdt_Lower_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dTdt_Lower_2Sigma"].values[0]
                            up_dt = env_row[f"dT_Upper_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dT_Upper_2Sigma"].values[0]
                            low_dt = env_row[f"dT_Lower_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dT_Lower_2Sigma"].values[0]
                            
                            if repo_metric in ["All Assessments", "dT/dt"] and val_dtdt > up_dtdt: failed_dtdt.append(ch)
                            if repo_metric in ["All Assessments", "dT"] and val_dt > up_dt: failed_dt.append(ch)

                repo_row["Power Rating (kW)"] = round(bike_power, 2)

                derated_early = False
                if repo_metric != "Power Based":
                    for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
                        if repo_target in ["All Data", ch] and str(row.get(f"{ch}_Deration_Time", "SAFE")) != "SAFE" and float(row[f"{ch}_Deration_Time"]) < repo_time_s:
                            derated_early = True; break

                power_passed = True
                if repo_target in ["All Data", "Electrical Power"] and repo_metric in ["All Assessments", "Power Based"]:
                    if not (pwr_lower <= bike_power <= pwr_upper): power_passed = False

                if derated_early: repo_row["Final Conclusion"] = "FAIL (Early Deration)"
                elif len(failed_dt) > 0: repo_row["Final Conclusion"] = f"FAIL (Cumm Temp: {', '.join(failed_dt)})"
                elif len(failed_dtdt) > 0: repo_row["Final Conclusion"] = f"FAIL (Rise Rate: {', '.join(failed_dtdt)})"
                elif not power_passed: repo_row["Final Conclusion"] = f"FAIL (Power Dev: {bike_power:.1f}kW)"
                else: repo_row["Final Conclusion"] = "PASS"

                if bike_type == "Golden Baseline": repo_row["Final Conclusion"] = "PASS (Golden Base)"
                repo_results.append(repo_row)
                
            final_repo_df = pd.DataFrame(repo_results)
            cols_order = ["Test Name", "Type"]
            active_channels = ["IGBT", "Motor", "HighCell", "AFE"] if repo_target == "All Data" else [repo_target] if repo_target in ["IGBT", "Motor", "HighCell", "AFE"] else []

            if repo_metric != "Power Based":
                for ch in active_channels:
                    if repo_metric in ["All Assessments", "dT/dt"]: cols_order.append(f"{ch} dTdt")
                    if repo_metric in ["All Assessments", "dT"]: cols_order.append(f"{ch} dT")

            if repo_target in ["All Data", "Electrical Power"] or repo_metric == "Power Based": cols_order.append("Power Rating (kW)")
            cols_order.append("Final Conclusion")
            
            final_repo_df = final_repo_df[[c for c in cols_order if c in final_repo_df.columns]]
            
            st.markdown("---")
            all_bike_names = final_repo_df["Test Name"].tolist()
            selected_repo_bikes = st.multiselect("🏍️ Filter Table by Bike ID:", options=["All Bikes"] + all_bike_names, default=["All Bikes"])
            display_df = final_repo_df[final_repo_df["Test Name"].isin(selected_repo_bikes)] if "All Bikes" not in selected_repo_bikes and len(selected_repo_bikes) > 0 else final_repo_df
            
            def color_cells(val):
                if 'PASS' in str(val): return 'background-color: rgba(0, 204, 150, 0.15); color: #00CC96; font-weight: bold;'
                elif 'FAIL' in str(val): return 'background-color: rgba(255, 75, 75, 0.15); color: #FF4B4B; font-weight: bold;'
                return ''
                
            styled_df = display_df.style.map(color_cells, subset=['Final Conclusion'])
            st.dataframe(styled_df, use_container_width=True, hide_index=True)

            # ==========================================================
            # 📄 AUTO-WORD REPORT GENERATOR (INTEGRATION)
            # ==========================================================
            st.markdown("---")
            st.markdown("### 📄 Auto-Generate Executive Word Report")
            st.write(f"Instantly generate a fully formatted, math-backed Word document for **{primary_test}** based on the {repo_time_s}s snapshot.")

            if os.path.exists(TEMPLATE_PATH):
                try:
                    t_eval_row_pri = pd.merge_asof(pd.DataFrame({"Time (s)": [float(repo_time_s)]}), df_primary.sort_values("Time (s)"), on="Time (s)", direction="nearest")
                    
                    df_cut_pri = df_primary[df_primary["Time (s)"] <= repo_time_s]
                    bike_power_pri = df_cut_pri["Electrical Power (kW)"].mean() if "Electrical Power (kW)" in df_cut_pri.columns else 0

                    parts = primary_test.split('-')
                    test_date_val = parts[0] if len(parts) > 0 else "Unknown"
                    bike_no_val = parts[1] if len(parts) > 1 else "Unknown"
                    
                    final_conc = final_repo_df[final_repo_df["Test Name"] == primary_test]["Final Conclusion"].values[0] if not final_repo_df[final_repo_df["Test Name"] == primary_test].empty else "Unknown"

                    ctx = {
                        "test_id": primary_test, "test_date": test_date_val, "bike_no": bike_no_val,
                        "total_duration": int(df_primary["Time (s)"].max()) if "Time (s)" in df_primary.columns else 0, 
                        "snapshot_time": repo_time_s,
                        "env_tol": f"± {repo_tol}%" if repo_env == "Tolerance (%)" else "2-Sigma",
                        "golden_power": f"{master_golden_power:.2f}",
                        "pwr_lower": f"{pwr_lower:.2f}", "pwr_upper": f"{pwr_upper:.2f}",
                        "bike_power": f"{bike_power_pri:.2f}",
                        "power_status": "✅ PASS" if (pwr_lower <= bike_power_pri <= pwr_upper) else "❌ FAIL",
                        "final_conclusion": final_conc
                    }

                    first_deration_time = None
                    first_deration_comp = None

                    for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
                        ch_low = ch.lower()
                        ctx[f"{ch_low}_raw"] = summary_row.get(f"{ch}_Raw_Max", "NA")
                        ctx[f"{ch_low}_peak_time"] = summary_row.get(f"{ch}_Peak_Time", "NA")
                        deration = summary_row.get(f"{ch}_Deration_Time", "SAFE")
                        ctx[f"{ch_low}_deration"] = deration
                        
                        status = "✅ PASS"
                        if str(deration) != "SAFE":
                            status = "❌ FAIL"
                            d_time = float(deration)
                            if first_deration_time is None or d_time < first_deration_time:
                                first_deration_time, first_deration_comp = d_time, ch
                        ctx[f"{ch_low}_status"] = status
                        
                        if ch == "HighCell":
                            cell_num = summary_row.get("HighCell_Peak_Cell_No", "")
                            ctx["highcell_cell"] = f"(Cell #{int(cell_num)})" if pd.notna(cell_num) else ""

                        val_dtdt = t_eval_row_pri[dtdt_map[ch]].values[0] if not t_eval_row_pri.empty and dtdt_map[ch] in t_eval_row_pri.columns else 0
                        val_dt = t_eval_row_pri[deltat_map[ch]].values[0] if not t_eval_row_pri.empty and deltat_map[ch] in t_eval_row_pri.columns else 0
                        ctx[f"{ch_low}_dtdt"] = f"{val_dtdt:.3f}"
                        ctx[f"{ch_low}_dt"] = f"{val_dt:.2f}"
                        
                        env_eval = "Within Limits"
                        if envelope_data and ch in envelope_data:
                            env_row = envelope_data[ch][envelope_data[ch]["Time (s)"] == repo_time_s]
                            if not env_row.empty:
                                up_dtdt = env_row[f"dTdt_Upper_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dTdt_Upper_2Sigma"].values[0]
                                low_dtdt = env_row[f"dTdt_Lower_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dTdt_Lower_2Sigma"].values[0]
                                up_dt = env_row[f"dT_Upper_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dT_Upper_2Sigma"].values[0]
                                low_dt = env_row[f"dT_Lower_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dT_Lower_2Sigma"].values[0]
                                
                                if not (low_dtdt * 0.98 <= val_dtdt <= up_dtdt): env_eval = "Out of Bounds (dT/dt)"
                                if not (low_dt * 0.98 <= val_dt <= up_dt): env_eval = "Out of Bounds (ΔT)"
                        ctx[f"{ch_low}_env_eval"] = env_eval

                    ctx["first_deration_text"] = "None"
                    if first_deration_comp and first_deration_time is not None and first_deration_time < repo_time_s:
                        ctx["first_deration_text"] = f"{first_deration_comp} at {first_deration_time}s"

                    doc = DocxTemplate(TEMPLATE_PATH)
                    doc.render(ctx)
                    
                    bio = io.BytesIO()
                    doc.save(bio)
                    
                    st.download_button(
                        label=f"📥 Download '{primary_test}' Word Report",
                        data=bio.getvalue(),
                        file_name=f"VCH_Report_{primary_test}_{repo_time_s}s.docx",
                        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        type="primary"
                    )

                except Exception as e:
                    st.error(f"🚨 Could not generate report. Error: {e}")
            else:
                st.warning("⚠️ Cannot generate report: `VCH_Report_Template.docx` is missing from the dyno_backend folder.")

        except Exception as e:
            st.error(f"⚠️ Error loading Quality Control repository data: {e}")

    with tab_fleet:
        st.subheader("🏍️ Fleet Hardware Registry")
        
        if "selected_bike" not in st.session_state:
            st.session_state["selected_bike"] = None

        registry = bike_engine.load_bike_registry()

        if st.session_state["selected_bike"] is None:
            st.markdown("<p style='color:#00cc96; font-weight:600; font-size:1.1rem; margin-top:-10px; margin-bottom: 20px;'>Select a vehicle below to analyze its complete hardware signature and performance metrics.</p>", unsafe_allow_html=True)
            
            all_fleet_bikes = sorted(list(registry.keys()))
            search_bikes = st.multiselect("🔍 Rapid Vehicle Filter:", options=["All Vehicles"] + all_fleet_bikes, default=["All Vehicles"])
            st.markdown("<div style='margin-bottom: 15px;'></div>", unsafe_allow_html=True)
            
            c1, c2, c3, c4 = st.columns(4)
            cols_f = [c1, c2, c3, c4]
            
            idx = 0
            for b_id, b_data in registry.items():
                if "All Vehicles" not in search_bikes and b_id not in search_bikes:
                    continue
                
                current_col = cols_f[idx % 4]
                try:
                    bike_num_str = str(int(b_id.split("-")[1]))
                    bike_tests_df = summary_df[summary_df["Test_Name"].apply(lambda x: get_bike_no(x) == bike_num_str)]
                    dynamic_tests_done = len(bike_tests_df)
                except:
                    bike_tests_df = pd.DataFrame()
                    dynamic_tests_done = 0

                with current_col:
                    html_card = f"""
                    <style>
                    .fleet-card {{ background: var(--card-bg); backdrop-filter: blur(16px); border: 1px solid var(--card-border); border-radius: 16px; padding: 20px; height: 100%; transition: all 0.3s ease-in-out; box-shadow: var(--card-shadow); margin-bottom: 15px; }}
                    .fleet-icon {{ margin-bottom: 15px; }}
                    .fleet-vin {{ font-size: 1.1rem; font-weight: 800; color: #FFF; margin-bottom: 5px; }}
                    .fleet-id {{ font-size: 0.9rem; font-weight: 600; color: #888; }}
                    </style>
                    <div class="fleet-card">
                        <div class="fleet-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00cc96" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="5.5" cy="17.5" r="3.5"></circle>
                                <circle cx="18.5" cy="17.5" r="3.5"></circle>
                                <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 5.5l1.5-3 4-1"></path>
                                <path d="M12 11.5l-3-4-3 1.5"></path>
                                <path d="M5.5 17.5l2.5-6h4l2.5 6"></path>
                            </svg>
                        </div>
                        <div class="fleet-vin">{b_data.get('vin', 'UNKNOWN_VIN')}</div>
                        <div class="fleet-id">{b_id} • {dynamic_tests_done} Dyno Tests</div>
                    </div>
                    """
                    st.markdown(html_card, unsafe_allow_html=True)
                    if st.button(f"Analyze Hardware", use_container_width=True, key=f"btn_{b_id}"):
                        st.session_state["selected_bike"] = b_id
                        st.rerun()
                idx += 1
        else:
            b_id = st.session_state["selected_bike"]
            b_data = registry.get(b_id, {})
            
            try:
                bike_num_str = str(int(b_id.split("-")[1]))
                bike_tests_df = summary_df[summary_df["Test_Name"].apply(lambda x: get_bike_no(x) == bike_num_str)]
                dynamic_tests_done = len(bike_tests_df)
            except:
                bike_tests_df = pd.DataFrame()
                dynamic_tests_done = 0
            
            if st.button("← Back to Fleet", key="btn_back_fleet"):
                st.session_state["selected_bike"] = None
                st.rerun()
            
            st.markdown(f"<h2 style='font-weight:900;'>{b_data.get('vin', 'UNKNOWN_VIN')} <span style='color: #888; font-weight:300;'>| {b_id}</span></h2>", unsafe_allow_html=True)
            
            st.markdown("### ⚙️ Hardware Registry Details")
            md_c1, md_c2, md_c3, md_c4 = st.columns(4)
            box_style = "background: rgba(255, 255, 255, 0.03); border-left: 3px solid #00cc96; padding: 15px; border-radius: 4px; margin-bottom: 15px;"
            tit_style = "color: #A0A0AB; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;"
            val_style = "color: #FFF; font-size: 1.1rem; font-weight: 500;"
            
            with md_c1:
                st.markdown(f"<div style='{box_style}'><div style='{tit_style}'>Tests Evaluated</div><div style='{val_style}'>{dynamic_tests_done}</div></div>", unsafe_allow_html=True)
                st.markdown(f"<div style='{box_style}'><div style='{tit_style}'>Motor ID</div><div style='{val_style}'>{b_data.get('motor_id', 'N/A')}</div></div>", unsafe_allow_html=True)
            with md_c2:
                st.markdown(f"<div style='{box_style}'><div style='{tit_style}'>Battery Box ID</div><div style='{val_style}'>{b_data.get('battery_box_id', 'N/A')}</div></div>", unsafe_allow_html=True)
            with md_c3:
                st.markdown(f"<div style='{box_style}'><div style='{tit_style}'>Left Module ID</div><div style='{val_style}'>{b_data.get('left_module_id', 'N/A')}</div></div>", unsafe_allow_html=True)
            with md_c4:
                st.markdown(f"<div style='{box_style}'><div style='{tit_style}'>Right Module ID</div><div style='{val_style}'>{b_data.get('right_module_id', 'N/A')}</div></div>", unsafe_allow_html=True)
                st.markdown(f"<div style='{box_style}'><div style='{tit_style}'>BMS Firmware ID</div><div style='{val_style}'>{b_data.get('bms_id', 'N/A')}</div></div>", unsafe_allow_html=True)

            st.markdown("---")
            st.markdown("#### 🔍 Historical Test Inspection")
            if not bike_tests_df.empty:
                test_list = bike_tests_df["Test_Name"].sort_values(ascending=False).tolist()
                selected_test = st.selectbox("Select a historical run to visualize:", test_list)
                
                test_row = bike_tests_df[bike_tests_df["Test_Name"] == selected_test].iloc[0]
                df_viz = load_test_data(test_row["Processed_CSV_Path"])
                
                if not df_viz.empty and "Time (s)" in df_viz.columns:
                    st.markdown("##### 📈 Thermal Profile")
                    fig_tri = make_subplots(specs=[[{"secondary_y": True}]])
                    
                    hc_col = next((c for c in df_viz.columns if "highcell" in c.lower()), "HighCell_Temp") if "HighCell_Temp" not in df_viz.columns else "HighCell_Temp"
                    igbt_col = next((c for c in df_viz.columns if "igbt" in c.lower()), "IGBT_Temp") if "IGBT_Temp" not in df_viz.columns else "IGBT_Temp"
                    motor_col = next((c for c in df_viz.columns if "motor" in c.lower()), "Motor_Temp") if "Motor_Temp" not in df_viz.columns else "Motor_Temp"
                    
                    if hc_col in df_viz.columns: fig_tri.add_trace(go.Scatter(x=df_viz["Time (s)"], y=df_viz[hc_col], name="HighCell (Primary)", line=dict(color="#FF4B4B", width=2)), secondary_y=False)
                    if igbt_col in df_viz.columns: fig_tri.add_trace(go.Scatter(x=df_viz["Time (s)"], y=df_viz[igbt_col], name="IGBT (Secondary)", line=dict(color="#00CC96", width=2)), secondary_y=True)
                    if motor_col in df_viz.columns: fig_tri.add_trace(go.Scatter(x=df_viz["Time (s)"], y=df_viz[motor_col], name="Motor (Secondary)", line=dict(color="cyan", width=2)), secondary_y=True)
                    
                    fig_tri.update_layout(
                        height=500, hovermode="x unified", plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)',
                        margin=dict(l=10, r=10, t=10, b=10),
                        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
                    )
                    fig_tri.update_xaxes(title_text="Time (s)", showgrid=False, zeroline=False)
                    fig_tri.update_yaxes(title_text="HighCell Temp (°C)", secondary_y=False, showgrid=True, gridcolor='rgba(128,128,128,0.2)', zeroline=False)
                    fig_tri.update_yaxes(title_text="Powertrain Temp (°C)", secondary_y=True, showgrid=False, zeroline=False)
                    
                    st.plotly_chart(fig_tri, use_container_width=True)
                    
                    st.markdown("##### 📋 QC Verdict (120s @ 20% Tolerance)")
                    
                    failed = []
                    passed = True
                    t_eval = pd.merge_asof(pd.DataFrame({"Time (s)": [120.0]}), df_viz.sort_values("Time (s)"), on="Time (s)", direction="nearest")
                    
                    bike_power = test_row.get("Power_Avg_120s", 0)
                    
                    golden_powers = []
                    for _, r in summary_df.iterrows():
                        if any(gold in r["Test_Name"] for gold in dyno_engine.GOLDEN_BIKES):
                            p = r.get("Power_Avg_120s", 0)
                            if 19 <= p <= 20.5: golden_powers.append(p)
                    mgp = sum(golden_powers)/len(golden_powers) if golden_powers else 19.5
                    p_up, p_dn = mgp * 1.10, mgp * 0.90
                    
                    if not (p_dn <= bike_power <= p_up):
                        passed = False
                        failed.append(f"Power={bike_power:.1f}kW")

                    for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
                        d_time = test_row.get(f"{ch}_Deration_Time", "SAFE")
                        if str(d_time) != "SAFE" and float(d_time) < 120.0:
                            passed = False
                            failed.append(f"Early Deration ({ch})")
                            
                        c_dtdt = dtdt_map.get(ch, f"{ch}_dTdt")
                        c_dt = deltat_map.get(ch, f"{ch}_dT")
                        if envelope_data and ch in envelope_data:
                            env_df = envelope_data[ch]
                            env_row = env_df[env_df["Time (s)"] == 120]
                            if not env_row.empty and not t_eval.empty:
                                up_dtdt = env_row["dTdt_Upper_20Pct"].values[0] if "dTdt_Upper_20Pct" in env_row.columns else 999
                                up_dt = env_row["dT_Upper_20Pct"].values[0] if "dT_Upper_20Pct" in env_row.columns else 999
                                
                                val_dtdt = t_eval[c_dtdt].values[0] if c_dtdt in t_eval.columns else 0
                                val_dt = t_eval[c_dt].values[0] if c_dt in t_eval.columns else 0
                                
                                if val_dtdt > up_dtdt: passed = False; failed.append(f"{ch} dT/dt")
                                if val_dt > up_dt: passed = False; failed.append(f"{ch} ΔT")
                    
                    if "Golden" in test_row.get("Type", "Evaluation"): 
                        passed = True
                        failed = ["Baseline"]
                        
                    verdict_color = "rgba(0, 204, 150, 0.15)" if passed else "rgba(255, 75, 75, 0.15)"
                    verdict_text_color = "#00CC96" if passed else "#FF4B4B"
                    verdict_icon = "✅" if passed else "❌"
                    fail_str = "" if passed else f"<br><span style='font-size:0.9rem; color:#A0A0AB;'>Failed Rules: {', '.join(failed)}</span>"
                    if "Baseline" in failed:
                        verdict_color = "rgba(255, 215, 0, 0.15)"
                        verdict_text_color = "#FFD700"
                        verdict_icon = "👑"
                        fail_str = "<br><span style='font-size:0.9rem; color:#A0A0AB;'>Automated pass (Golden Reference Vehicle)</span>"
                    
                    st.markdown(f"""
                    <div style="background: {verdict_color}; border-left: 4px solid {verdict_text_color}; padding: 15px; border-radius: 8px;">
                        <span style="color: {verdict_text_color}; font-size: 1.2rem; font-weight: 800;">{verdict_icon} {"PASS" if passed else "FAIL"}</span>
                        {fail_str}
                    </div>
                    """, unsafe_allow_html=True)
            else:
                st.info("No recorded Dyno tests found for this specific vehicle yet.")