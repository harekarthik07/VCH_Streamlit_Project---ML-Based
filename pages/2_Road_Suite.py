import sys
import os
import streamlit as st
import sqlite3
import db_bridge
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
import shutil
import time
import io
from contextlib import redirect_stdout, redirect_stderr
from streamlit_option_menu import option_menu

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.dirname(CURRENT_DIR))
import auth_utils

auth_utils.enforce_login()
ROOT_DIR = os.path.dirname(CURRENT_DIR)
ROAD_DIR = os.path.join(ROOT_DIR, "road_backend") 
if ROAD_DIR not in sys.path: sys.path.append(ROAD_DIR)
from db_manager import DatabaseManager

# ==========================================================
# APP STYLING: DISTINCT BORDERS + BENTO BOX + LIGHT/DARK
# ==========================================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;900&display=swap');

    html, body, [class*="css"] {
        font-family: 'Outfit', sans-serif !important;
    }

    /* Hide Streamlit Chrome */
    footer {visibility: hidden;}
    .stDeployButton {display:none;}

    :root {
        /* DARK MODE DEFAULTS */
        --bg-color: #0b0c10; 
        --card-bg: rgba(25, 25, 30, 0.4); 
        --card-border: rgba(255, 255, 255, 0.08); /* Frosted Glass Border */
        --card-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        --text-main: #FFFFFF;
        --text-title: #B4B4C0;
        --text-sub: #A0A0AB;
        --btn-bg: rgba(45, 45, 51, 0.6);
        --btn-border: rgba(255, 255, 255, 0.15);
        --sidebar-bg: #0b0c10;
        --scroll-thumb: #3A3A40;
        --raptee-logo: #FFFFFF;
        --banner-bg: rgba(255, 75, 75, 0.15);
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
    .deration-banner { background-color: var(--banner-bg); backdrop-filter: blur(10px); border: 1px solid #FF4B4B; color: var(--banner-text); padding: 15px 20px; border-radius: 12px; font-weight: 800; animation: pulse-red 2s infinite; margin-top: 25px; margin-bottom: 25px; text-align: center; }    
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
    [data-testid="stSidebarNav"] a { text-transform: uppercase !important; font-weight: 700 !important; font-size: 0.85rem !important; letter-spacing: 1.5px !important; padding: 12px 15px !important; border-radius: 6px !important; margin: 0px 15px 8px 15px !important; transition: all 0.3s ease-in-out !important; color: var(--text-title) !important; opacity: 0.7; }
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
    /* =========================================
       3. CUSTOM SCROLLBARS
       ========================================= */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #00cc96; box-shadow: 0 0 10px #00cc96; }

    /* =========================================
       TAB LABEL STYLING
       ========================================= */
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

DB_PATH = os.path.join(ROAD_DIR, "raptee_rides.db")
RAW_FOLDER = os.path.join(ROAD_DIR, "Raw_Data")
PROCESSED_FOLDER = os.path.join(ROAD_DIR, "Processed_Rides")
LOGO_PATH = os.path.join(CURRENT_DIR, "raptee_logo.png")

def safe_clear_data():
    try:
        st.cache_data.clear(); time.sleep(0.5)
        if os.path.exists(DB_PATH): os.remove(DB_PATH)
        if os.path.exists(RAW_FOLDER): shutil.rmtree(RAW_FOLDER)
        if os.path.exists(PROCESSED_FOLDER): shutil.rmtree(PROCESSED_FOLDER)
        os.makedirs(RAW_FOLDER, exist_ok=True); os.makedirs(PROCESSED_FOLDER, exist_ok=True)
        return True
    except Exception as e: return False

def get_route_type(filename):
    if "_Route-Office" in filename: return "Office Full Push"
    elif "_Route-Road" in filename: return "Road Full Push"
    return "Untagged / Legacy"

st.sidebar.title("🛣️ Road VCH Suite")
app_mode = st.sidebar.radio("Navigation", ["📊 Monitor Dashboard", "🛠️ Data Engine"], key="road_app_mode")
st.sidebar.markdown("---")
if st.sidebar.button("🔄 Refresh Data"): st.cache_data.clear(); st.rerun()
st.sidebar.markdown("---")

if app_mode == "🛠️ Data Engine":
    st.title("🛠️ Road Test Data Engine")
    st.info("Upload raw Road Test `.xlsx` files here. ML Feature extraction runs automatically.", icon="ℹ️")
    st.markdown("---")
    col1, col2 = st.columns([1.5, 1])
    with col1:
        st.subheader("1️⃣ Upload & Tag Data")
        c_m1, c_m2, c_m3 = st.columns(3)
        rider_val = c_m1.text_input("👤 Rider Name", "Dev Team")
        amb_val = c_m2.number_input("🌡️ Ambient Temp (°C)", value=32.0)
        loc_val = c_m3.text_input("📍 Location", "Chennai")
        route_tag = st.radio("🛣️ Select Test Route:", ["Office Full Push", "Road Full Push"], horizontal=True, key="road_route_tag")
        uploaded_files = st.file_uploader("Drop .xlsx file(s) here", type=["xlsx"], accept_multiple_files=True)

        if uploaded_files:
            file_count = len(uploaded_files)
            if st.button(f"💾 Tag & Save {file_count} File(s)"):
                for uploaded_file in uploaded_files:
                    original_name = uploaded_file.name
                    name_parts = original_name.rsplit('.', 1)
                    new_name = f"{name_parts[0]}{'_Route-Office' if route_tag == 'Office Full Push' else '_Route-Road'}.{name_parts[1]}"
                    save_path = os.path.join(RAW_FOLDER, new_name)
                    with open(save_path, "wb") as f: f.write(uploaded_file.getbuffer())
                st.toast(f"✅ Successfully tagged and saved {file_count} files!", icon="💾")

    with col2:
        st.subheader("2️⃣ Engine Controls")
        log_file_path = os.path.join(ROAD_DIR, "engine_logs.txt")

        if st.button("🚀 Process & Train ML Layer", type="primary"):
            log_stream = io.StringIO()
            with st.status("⚙️ Processing & Inferencing...", expanded=True) as status:
                with redirect_stdout(log_stream), redirect_stderr(log_stream):
                    try:
                        db = DatabaseManager(db_name=DB_PATH, processed_folder=PROCESSED_FOLDER)
                        db.process_new_files(RAW_FOLDER, metadata={"rider": rider_val, "temp": amb_val, "loc": loc_val})
                        print("✅ ML Processing Pipeline Complete.")
                        status.update(label="✅ Complete! DB synced.", state="complete", expanded=False)
                        st.cache_data.clear()
                        st.success("🚀 ML Processing Complete!")
                    except Exception as e: 
                        print(f"\\n❌ CRITICAL PIPELINE ERROR: {e}")
                        status.update(label="❌ Failed", state="error")
                with open(log_file_path, "w", encoding="utf-8") as f: f.write(log_stream.getvalue())
                time.sleep(1.5); st.rerun()

        st.markdown("---")
        with st.expander("🗄️ Database Management & Factory Reset"):
            if os.path.exists(DB_PATH):
                with open(DB_PATH, "rb") as f: st.download_button("💾 Download SQLite DB", f, file_name="raptee_rides.db", type="primary")
            st.warning("Wiping deletes all databases and processed files!")
            if st.button("🗑️ CLEAR ALL DATA"):
                if safe_clear_data(): 
                    if os.path.exists(log_file_path): os.remove(log_file_path)
                    st.success("💥 Factory Reset Complete!"); time.sleep(1.5); st.rerun()

        # 🌟 NEW: DEVELOPER ACCESS PANEL
        st.markdown("---")
        st.subheader("🔐 Developer Access: Test Management")
        dev_pass = st.text_input("Enter Developer Password:", type="password", key="road_dev_pass")
        
        if dev_pass == "test@123":
            st.success("✅ Access Granted: Developer Mode Unlocked")
            
            try:
                sum_df = db_bridge.query_to_df("SELECT Ride_Name, Processed_CSV_Path FROM ride_summaries", db_path=DB_PATH)
                all_processed_tests = sum_df["Ride_Name"].tolist()
            except:
                all_processed_tests = []
                sum_df = pd.DataFrame()

            st.markdown("#### 🗑️ Delete Specific Ride")
            del_test = st.selectbox("Select Ride to Delete:", all_processed_tests, key="del_road_sel")
            if st.button("🗑️ Delete Selected Ride"):
                if not sum_df.empty and del_test:
                    try:
                        db_bridge.execute_sql("DELETE FROM ride_summaries WHERE Ride_Name=?", params=(str(del_test),), db_path=DB_PATH)
                        db_bridge.execute_sql("DELETE FROM ride_events WHERE Ride_Name=?", params=(str(del_test),), db_path=DB_PATH)
                        
                        file_path = sum_df[sum_df["Ride_Name"] == del_test]["Processed_CSV_Path"].iloc[0]
                        if file_path and os.path.exists(file_path): os.remove(file_path)
                        p_path = file_path.replace('.csv', '.parquet')
                        if p_path and os.path.exists(p_path): os.remove(p_path)
                        
                        raw_files = os.listdir(RAW_FOLDER) if os.path.exists(RAW_FOLDER) else []
                        for rf in raw_files:
                            if rf.split('.')[0] in str(del_test):
                                try: os.remove(os.path.join(RAW_FOLDER, rf))
                                except: pass
                        
                        st.success(f"✅ Deleted {del_test} entirely!")
                        time.sleep(1.5); st.rerun()
                    except Exception as e:
                        st.error(f"❌ Failed to delete from Database: {e}")

        st.markdown("---")
        st.subheader("📜 System Processing Logs")
        if os.path.exists(log_file_path):
            with open(log_file_path, "r", encoding="utf-8") as f: logs = f.read()
            if logs.strip() == "": logs = "No errors or print statements detected in the last run."
            st.text_area("Live Terminal Output:", value=logs, height=250)
        else: st.info("No logs generated yet. Hit Process to capture the terminal output.")

elif app_mode == "📊 Monitor Dashboard":
    @st.cache_data(max_entries=3, ttl=1800)
    def load_ride_database():
        if not db_bridge.DATABASE_URL and not os.path.exists(DB_PATH): return pd.DataFrame(), pd.DataFrame()
        try:
            df = db_bridge.query_to_df("SELECT * FROM ride_summaries", db_path=DB_PATH)
            df_ev = db_bridge.query_to_df("SELECT * FROM ride_events", db_path=DB_PATH)
            return df, df_ev
        except: return pd.DataFrame(), pd.DataFrame()

    @st.cache_data(max_entries=3, ttl=1800)
    def load_2hz_data(csv_path):
        p_path = csv_path.replace('.csv', '.parquet')
        if os.path.exists(p_path): return pd.read_parquet(p_path, engine='pyarrow')
        if os.path.exists(csv_path): return pd.read_csv(csv_path)
        base_name = os.path.basename(p_path)
        alt_path = os.path.join(PROCESSED_FOLDER, base_name)
        if os.path.exists(alt_path): return pd.read_parquet(alt_path, engine='pyarrow')
        return pd.DataFrame()

    db_table, db_events = load_ride_database()
    if db_table.empty: st.error("🚨 Master Database Not Found! Factory Reset and re-upload."); st.stop()

    with st.sidebar.expander("📂 Mission Control & Navigation", expanded=True):
        st.markdown("##### 1. Data Browser")
        all_tests = db_table['Ride_Name'].tolist()
        available_dates = sorted(list(set([t[:10] for t in all_tests])), reverse=True)
        selected_dates = st.multiselect("📅 Filter Date:", ["All Dates"] + available_dates, default=["All Dates"])
        available_routes = sorted(list(set([get_route_type(t) for t in all_tests])))
        selected_routes = st.multiselect("🛣️ Filter Route:", ["All Routes"] + available_routes, default=["All Routes"])
        
        filtered_df = db_table.copy()
        if "All Dates" not in selected_dates: filtered_df = filtered_df[filtered_df['Ride_Name'].str[:10].isin(selected_dates)]
        if "All Routes" not in selected_routes: filtered_df = filtered_df[filtered_df['Ride_Name'].apply(get_route_type).isin(selected_routes)]
        if filtered_df.empty: st.warning("⚠️ No tests found."); st.stop()

        st.markdown("---")
        st.markdown("##### 2. Active Selection")
        primary_test = st.selectbox("⭐ Primary Test Log:", filtered_df['Ride_Name'].tolist())
        selected_ride = primary_test
        compare_tests = st.multiselect("🔄 Compare Tests", [t for t in filtered_df['Ride_Name'].tolist() if t != primary_test])

    ride_kpis = filtered_df[filtered_df['Ride_Name'] == selected_ride].iloc[0]
    current_route_type = get_route_type(selected_ride)
    
    with st.sidebar.expander("⚙️ Diagnostic Config", expanded=False):
        selected_menu = option_menu(
            menu_title=None, 
            options=["Thermal Systems", "Dynamic Systems", "Ride Analytics", "Battery & Range", "Driver Diagnostics", "Ride Events & QC", "Master Repository"],
            icons=['thermometer-high', 'lightning-charge', 'speedometer2', 'battery-charging', 'cpu', 'exclamation-octagon', 'folder2-open'],
            menu_icon="cast", default_index=0,
            styles={
                "container": {"padding": "0!important", "background-color": "transparent"},
                "icon": {"color": "var(--text-color)", "font-size": "18px", "opacity": "0.6"},
                "nav-link": {"font-size": "14px", "text-align": "left", "margin": "4px 0px", "color": "var(--text-color)", "--hover-color": "rgba(128,128,128,0.1)", "border-radius": "6px", "transition": "all 0.3s ease-in-out", "opacity": "0.7"},
                "nav-link-selected": {"background-color": "rgba(0, 204, 150, 0.15)", "color": "#00cc96", "border-left": "4px solid #00cc96", "font-weight": "bold", "opacity": "1"},
            }
        )
        
        channel_mapping = {"Thermal Systems": "Channel 1", "Dynamic Systems": "Channel 2", "Ride Analytics": "Channel 3", "Battery & Range": "Channel 4", "Driver Diagnostics": "Channel 5", "Ride Events & QC": "Channel 6", "Master Repository": "Channel 7"}
        channel_view = channel_mapping[selected_menu]
        st.markdown("---")
        
        active_channels = []
        if "Channel 1" in channel_view: active_channels = st.multiselect("Select Thermal Channels:", ["IGBT", "Motor", "HighCell", "AFE"], default=["IGBT", "Motor", "HighCell", "AFE"])
        elif "Channel 2" in channel_view: active_channels = st.multiselect("Select Dynamic Channels:", ["RPM [RPM]", "Front_Speed [kph]", "Throttle", "soc", "Instant_Power [W]", "DC_Volatge [V]", "Motor_Torque [Nm]"], default=["Front_Speed [kph]", "RPM [RPM]", "Instant_Power [W]"])

    try: df = load_2hz_data(ride_kpis['Processed_CSV_Path'])
    except Exception: st.error("Error loading data."); st.stop()

    col_logo, col_title, col_exp = st.columns([1.5, 6.5, 2])
    with col_logo:
        st.markdown("<div style='margin-top: 15px;'></div>", unsafe_allow_html=True)
        if os.path.exists(LOGO_PATH): st.image(LOGO_PATH, width=180)
        else: st.markdown("<div class='raptee-logo'>RAPTEE<span class='raptee-hv'>.HV</span></div>", unsafe_allow_html=True)
    with col_title:
        st.markdown(f"<h1 style='margin-top: -20px; padding-bottom: 0px;'>VCH - Road Test Monitor</h1>", unsafe_allow_html=True)
        st.markdown(f"**Target:** `{selected_ride}`")
    with col_exp:
        st.markdown("<div style='margin-top: 15px;'></div>", unsafe_allow_html=True)
        st.download_button("📥 Export 2Hz Trace (CSV)", df.to_csv(index=False).encode('utf-8'), file_name=f"{selected_ride[:10]}_trace.csv", mime="text/csv", use_container_width=True)
        
    test_date, total_duration, dist = selected_ride[:10], df['Time'].max(), ride_kpis['Total_Distance_km']
    route_icon = "🏢" if "Office" in current_route_type else "🛣️" if "Road" in current_route_type else "❓"
    rider, amb_temp, ride_class = ride_kpis.get('Rider', 'Unknown'), ride_kpis.get('Ambient_Temp_C', 0), ride_kpis.get('Ride_Class', 'Unknown')
    drive_score = ride_kpis.get('Drive_Score', 0)
    score_color = "#00cc96" if drive_score < 30 else "#FFD700" if drive_score < 60 else "#FF4B4B"
    
    st.markdown(f"""
    <div style="background: #191A20; border: 1px solid var(--card-border); border-radius: 12px; padding: 15px 20px; margin-top: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: none !important;">
        <div style="text-align: center;"><div style="color: var(--text-title); font-size: 11px; text-transform: uppercase; font-weight: 700;">Test Route</div><div style="color: #00cc96; font-weight: bold; font-size: 14px;">{route_icon} {current_route_type}</div></div>
        <div style="border-left: 1px solid var(--card-border); height: 30px;"></div>
        <div style="text-align: center;"><div style="color: var(--text-title); font-size: 11px; text-transform: uppercase; font-weight: 700;">Metadata</div><div style="color: var(--text-main); font-weight: bold; font-size: 14px;">👤 {rider} | 🌡️ {amb_temp}°C</div></div>
        <div style="border-left: 1px solid var(--card-border); height: 30px;"></div>
        <div style="text-align: center;"><div style="color: var(--text-title); font-size: 11px; text-transform: uppercase; font-weight: 700;">Distance / Time</div><div style="color: var(--text-main); font-weight: bold; font-size: 14px;">📍 {dist} km | ⏱️ {int(total_duration)} s</div></div>
        <div style="border-left: 1px solid var(--card-border); height: 30px;"></div>
        <div style="text-align: center;"><div style="color: var(--text-title); font-size: 11px; text-transform: uppercase; font-weight: 700;">ML Drive Score</div><div style="color: {score_color}; font-weight: bold; font-size: 14px;">🤖 {drive_score} ({ride_class})</div></div>
    </div>
    """, unsafe_allow_html=True)

    if "Channel 1" in channel_view: tab_main, tab_delta, tab_custom = st.tabs(["📊 Primary Dashboard", "📈 Cumulative Rise (ΔT)", "🗺️ Dynamic 3D Plotter"])
    elif "Channel 5" in channel_view: tab_ml, = st.tabs(["🤖 ML Predictive Analytics"])
    elif "Channel 6" in channel_view: tab_events, = st.tabs(["🚨 Automated Event Detection"])
    elif "Channel 7" in channel_view: tab_repo, = st.tabs(["📂 Master Test Repository"])
    else: tab_main, tab_custom = st.tabs(["📊 Primary Dashboard", "🗺️ Dynamic 3D Plotter"])

    if "Channel 5" not in channel_view and "Channel 6" not in channel_view and "Channel 7" not in channel_view:
        with tab_main:
            if "Channel 1" in channel_view:
                if not active_channels: st.info("👆 Please select at least one Thermal Channel.")
                else:
                    thermal_map = {"IGBT": {"col": "IGBT_Temp [C]", "limit": 95.0, "color": "#ffa500"}, "Motor": {"col": "Motor_Temp [C]", "limit": 125.0, "color": "#ff4b4b"}, "HighCell": {"col": "highest_temp [C]", "limit": 50.0, "color": "#1f77b4", "cell_col": "hight_cellno"}, "AFE": {"col": "Pack_Overall_Temp [C]", "limit": 50.0, "color": "#00cc96"}}
                    peaks, deration_msg, first_breach_time = {}, None, 999999
                    for ch in active_channels:
                        col_name = thermal_map[ch]["col"]
                        idx_max = df[col_name].idxmax()
                        val, time_val = df.loc[idx_max, col_name], df.loc[idx_max, 'Time']
                        cell_no = df.loc[idx_max, thermal_map[ch]["cell_col"]] if "cell_col" in thermal_map[ch] else None
                        peaks[ch] = {"val": val, "time": time_val, "limit": thermal_map[ch]["limit"], "cell": cell_no}
                        breach_df = df[df[col_name] > thermal_map[ch]["limit"]]
                        if not breach_df.empty:
                            breach_time = breach_df.iloc[0]['Time']
                            if breach_time < first_breach_time:
                                first_breach_time, cause = breach_time, f"Cell #{int(cell_no)}" if ch == 'HighCell' else ch
                                deration_msg = f"⚠️ First Deration Detected: {ch} crossed safety limit at {breach_time:.2f} s (Caused by {cause})"

                    cols = st.columns(len(active_channels))
                    for i, ch in enumerate(active_channels):
                        data = peaks[ch]
                        is_breach = data['val'] >= data['limit']
                        card_style = "metric-card highlight-red" if is_breach else "metric-card highlight-green"
                        if is_breach and deration_msg and (ch in deration_msg): card_style += " highlight-gold"
                        val_color, status_text = ("#FF4B4B", "🔥 BREACH") if is_breach else ("#00CC96", "✅ SAFE")
                        extra_info = f" | Cell: <b>#{int(data['cell'])}</b>" if data['cell'] else ""
                        cols[i].markdown(f"""<div class="{card_style}"><div class="metric-title">{ch} Raw Max Temp</div><div class="metric-value" style="color:{val_color}">{data['val']:.1f} °C</div><div class="metric-sub">Peak @ {data['time']:.1f}s {extra_info}</div><div class="metric-sub" style="border-top:1px solid var(--card-border); margin-top:8px; padding-top:5px;">Limit: {data['limit']}°C | {status_text}</div></div>""", unsafe_allow_html=True)

                    if deration_msg: st.markdown(f"<div class='deration-banner'>{deration_msg}</div>", unsafe_allow_html=True)
                    st.divider()
                    
                    st.subheader("📈 Individual Thermal Curves")
                    graph_cols = st.columns(2)
                    for i, ch in enumerate(active_channels):
                        with graph_cols[i % 2]:
                            fig = go.Figure()
                            limit = thermal_map[ch]["limit"]
                            fig.add_trace(go.Scatter(x=df['Time'], y=df[thermal_map[ch]["col"]], mode='lines', name=f"⭐ {primary_test}", line=dict(color=thermal_map[ch]["color"], width=2)))
                            
                            # 🌟 ROAD COMPARE LOGIC
                            for test in compare_tests:
                                cmp_path = db_table[db_table["Ride_Name"] == test]["Processed_CSV_Path"].iloc[0]
                                df_cmp = load_2hz_data(cmp_path)
                                if not df_cmp.empty and thermal_map[ch]["col"] in df_cmp.columns:
                                    fig.add_trace(go.Scatter(x=df_cmp['Time'], y=df_cmp[thermal_map[ch]["col"]], mode='lines', name=f"🔄 {test}", line=dict(width=1.5, dash='dot'), opacity=0.7))

                            fig.add_hline(y=limit, line_dash="dash", line_color="red", annotation_text=f"Limit: {limit}°C")
                            fig.update_layout(
                                title=f"{ch} Temperature Profile", hovermode="x unified", height=350,
                                plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=40, b=10),
                                xaxis=dict(showgrid=False, zeroline=False), yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)', autorange=True, zeroline=False)
                            )
                            st.plotly_chart(fig, use_container_width=True)
                            export_df = df[['Time', thermal_map[ch]["col"]]].to_csv(index=False).encode('utf-8')
                            st.download_button(label=f"📥 Export {ch} Data", data=export_df, file_name=f"{selected_ride[:10]}_{ch}_Temp.csv", mime="text/csv", key=f"dl_t_{ch}_{i}", use_container_width=True)
                            
                    st.divider()
                    st.subheader("📊 Combined Thermal Overlay")
                    fig_combined = go.Figure()
                    export_cols_comb = ['Time']
                    for ch in active_channels: 
                        fig_combined.add_trace(go.Scatter(x=df['Time'], y=df[thermal_map[ch]["col"]], mode='lines', name=ch, line=dict(color=thermal_map[ch]["color"], width=2)))
                        export_cols_comb.append(thermal_map[ch]["col"])
                    fig_combined.update_layout(
                        hovermode="x unified", height=450, legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=40, b=10),
                        xaxis=dict(showgrid=False, zeroline=False, title="Time (s)"), yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)', title="Temperature (°C)", autorange=True, zeroline=False)
                    )
                    st.plotly_chart(fig_combined, use_container_width=True)
                    export_comb_csv = df[export_cols_comb].to_csv(index=False).encode('utf-8')
                    st.download_button(label="📥 Export Combined Thermal Overlay Data", data=export_comb_csv, file_name=f"{selected_ride[:10]}_Combined_Thermals.csv", mime="text/csv", key="dl_t_comb")

            elif "Channel 2" in channel_view:
                d1, d2, d3 = st.columns(3)
                d1.metric("Total Distance", f"{ride_kpis['Total_Distance_km']} km")
                d2.metric("Energy Consumed", f"{ride_kpis['Total_Energy_Wh']} Wh")
                d3.metric("High Torque Demands", f"{ride_kpis['High_Torque_Time_sec']} sec")
                st.divider()
                if active_channels:
                    st.subheader("📈 Individual Dynamic Curves")
                    graph_cols = st.columns(2)
                    colors = px.colors.qualitative.Plotly
                    for i, ch in enumerate(active_channels):
                        with graph_cols[i % 2]:
                            fig = go.Figure()
                            fig.add_trace(go.Scatter(x=df['Time'], y=df[ch], mode='lines', name=f"⭐ {primary_test}", line=dict(color=colors[i % len(colors)], width=2)))
                            
                            # 🌟 ROAD COMPARE LOGIC
                            for test in compare_tests:
                                cmp_path = db_table[db_table["Ride_Name"] == test]["Processed_CSV_Path"].iloc[0]
                                df_cmp = load_2hz_data(cmp_path)
                                if not df_cmp.empty and ch in df_cmp.columns:
                                    fig.add_trace(go.Scatter(x=df_cmp['Time'], y=df_cmp[ch], mode='lines', name=f"🔄 {test}", line=dict(width=1.5, dash='dot'), opacity=0.7))

                            fig.update_layout(
                                title=f"{ch} Profile", hovermode="x unified", height=350,
                                plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=40, b=10),
                                xaxis=dict(showgrid=False, zeroline=False), yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)', autorange=True, zeroline=False)
                            )
                            st.plotly_chart(fig, use_container_width=True)
                            export_df = df[['Time', ch]].to_csv(index=False).encode('utf-8')
                            clean_ch_name = ch.split(' ')[0]
                            st.download_button(label=f"📥 Export {clean_ch_name} Data", data=export_df, file_name=f"{selected_ride[:10]}_{clean_ch_name}.csv", mime="text/csv", key=f"dl_dyn_{ch}_{i}", use_container_width=True)

            elif "Channel 3" in channel_view:
                st.markdown("### 🎯 Ride Analytics & Telemetry Diagnostics")
                a1, a2, a3, a4 = st.columns(4)
                a1.metric("Total Ride Time", f"{int(total_duration / 60)} min")
                a2.metric("High Torque Demands (>50 Nm)", f"{ride_kpis['High_Torque_Time_sec']} sec")
                a3.metric("Overall Efficiency", f"{ride_kpis['Overall_Wh_km']} Wh/km")
                a4.metric("Start Pack Spread", f"{ride_kpis['Start_Pack_Delta_T_C']} °C")
                st.divider()

                col_d1, col_d2 = st.columns(2)
                with col_d1:
                    labels_mode = ['Comfort', 'Power', 'Sprint']
                    vals_mode = [ride_kpis['Time_in_Comfort_min'], ride_kpis['Time_in_Power_min'], ride_kpis['Time_in_Sprint_min']]
                    fig_mode = go.Figure(data=[go.Pie(labels=labels_mode, values=vals_mode, hole=.4, marker_colors=['#00cc96', '#ab63fa', '#ff4b4b'])])
                    fig_mode.update_layout(title="🚀 Drive Mode Distribution", plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(t=40, b=20, l=20, r=20), height=350)
                    st.plotly_chart(fig_mode, use_container_width=True)
                with col_d2:
                    if 'Motor_Torque [Nm]' in df.columns:
                        accel_time_min = len(df[df['Motor_Torque [Nm]'] > 2]) * 0.5 / 60
                        regen_time_min = len(df[df['Motor_Torque [Nm]'] < -2]) * 0.5 / 60
                        coast_time_min = len(df[(df['Motor_Torque [Nm]'] >= -2) & (df['Motor_Torque [Nm]'] <= 2)]) * 0.5 / 60
                        fig_pwr = go.Figure(data=[go.Pie(labels=['Acceleration (> 2Nm)', 'Coasting (± 2Nm)', 'Regen Braking (< -2Nm)'], values=[accel_time_min, coast_time_min, regen_time_min], hole=.4, marker_colors=['#ff4b4b', '#888888', '#00cc96'])])
                        fig_pwr.update_layout(title="🔋 Powertrain State", plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(t=40, b=20, l=20, r=20), height=350)
                        st.plotly_chart(fig_pwr, use_container_width=True)

                st.divider()
                st.subheader("⚠️ Motor Torque vs. Thermal Deration Map")
                if 'Motor_Torque [Nm]' in df.columns and 'Motor_Temp [C]' in df.columns:
                    fig_derate = go.Figure()
                    fig_derate.add_trace(go.Scatter(x=df['Time'], y=df['Motor_Torque [Nm]'], mode='lines', fill='tozeroy', name='Motor Torque Demanded (Nm)', line=dict(color='#1f77b4', width=1), opacity=0.4))
                    fig_derate.add_trace(go.Scatter(x=df['Time'], y=df['Motor_Temp [C]'], mode='lines', name='Motor Temp (°C)', yaxis='y2', line=dict(color='#ff4b4b', width=3)))
                    fig_derate.add_hline(y=125.0, line_dash="dash", line_color="gold", annotation_text="Safety Limit (125°C)", yref="y2")
                    
                    fig_derate.update_layout(
                        hovermode="x unified", height=500, legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(t=30, b=30, l=10, r=10), 
                        xaxis=dict(title="Time (s)", showgrid=False, zeroline=False), 
                        yaxis=dict(title="Motor Torque (Nm)", showgrid=True, gridcolor='rgba(255,255,255,0.05)', autorange=True, zeroline=False), 
                        yaxis2=dict(title="Motor Temperature (°C)", overlaying='y', side='right', showgrid=False, autorange=True, zeroline=False)
                    )
                    st.plotly_chart(fig_derate, use_container_width=True)

            elif "Channel 4" in channel_view:
                if "soc" in df.columns and "Front_Speed [kph]" in df.columns and "Instant_Power [W]" in df.columns:
                    start_soc, end_soc = df["soc"].iloc[0], df["soc"].iloc[-1]
                    b1, b2, b3 = st.columns(3)
                    b1.metric("SOC Consumed", f"{start_soc - end_soc:.1f} %", f"Start: {start_soc}% → End: {end_soc}%", delta_color="inverse")
                    b2.metric("Total Energy Extracted", f"{ride_kpis['Total_Energy_Wh']} Wh")
                    b3.metric("Average Wh/km", f"{ride_kpis['Overall_Wh_km']} Wh/km")
                    st.divider()
                    
                    st.subheader("📉 SOC Drop vs Speed Profile")
                    fig_soc = go.Figure()
                    fig_soc.add_trace(go.Scatter(x=df['Time'], y=df['Front_Speed [kph]'], mode='lines', name=f"⭐ {primary_test} Speed", line=dict(color='#00cc96', width=1), opacity=0.5))
                    fig_soc.add_trace(go.Scatter(x=df['Time'], y=df['soc'], mode='lines', name=f"⭐ {primary_test} SOC", yaxis='y2', line=dict(color='#ab63fa', width=3)))
                    
                    # 🌟 ROAD COMPARE LOGIC
                    for test in compare_tests:
                        cmp_path = db_table[db_table["Ride_Name"] == test]["Processed_CSV_Path"].iloc[0]
                        df_cmp = load_2hz_data(cmp_path)
                        if not df_cmp.empty and 'soc' in df_cmp.columns:
                            fig_soc.add_trace(go.Scatter(x=df_cmp['Time'], y=df_cmp['soc'], mode='lines', name=f"🔄 {test} SOC", yaxis='y2', line=dict(width=1.5, dash='dot'), opacity=0.7))

                    fig_soc.update_layout(
                        hovermode="x unified", height=450, legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=30, b=10),
                        xaxis=dict(title="Time (s)", showgrid=False, zeroline=False), 
                        yaxis=dict(title="Vehicle Speed (kph)", showgrid=True, gridcolor='rgba(255,255,255,0.05)', autorange=True, zeroline=False), 
                        yaxis2=dict(title="State of Charge (%)", overlaying='y', side='right', showgrid=False, autorange=True, zeroline=False) 
                    )
                    st.plotly_chart(fig_soc, use_container_width=True)

                    st.divider()
                    st.subheader("🌡️ Thermal-Efficiency Correlation")
                    df['Inst_Energy_Wh'] = df['Instant_Power [W]'] * (0.5 / 3600)
                    df['Inst_Dist_km'] = df['Front_Speed [kph]'] * (0.5 / 3600)
                    df_consume = df[df['Inst_Energy_Wh'] > 0].copy()
                    if not df_consume.empty and 'Motor_Temp [C]' in df_consume.columns:
                        conditions = [(df_consume['Motor_Temp [C]'] < 90), (df_consume['Motor_Temp [C]'] >= 90) & (df_consume['Motor_Temp [C]'] <= 110), (df_consume['Motor_Temp [C]'] > 110)]
                        choices = ['< 90°C (Optimal)', '90-110°C (Soaking)', '> 110°C (Critical)']
                        df_consume['Temp_Bracket'] = np.select(conditions, choices, default='Unknown')
                        eff_data = []
                        for bracket in choices:
                            b_df = df_consume[df_consume['Temp_Bracket'] == bracket]
                            tot_energy, tot_dist = b_df['Inst_Energy_Wh'].sum(), b_df['Inst_Dist_km'].sum()
                            wh_km = (tot_energy / tot_dist) if tot_dist > 0 else 0
                            if tot_dist > 0.1: eff_data.append({"Temperature State": bracket, "Efficiency (Wh/km)": wh_km, "Distance Driven (km)": tot_dist})
                        eff_df = pd.DataFrame(eff_data)
                        if not eff_df.empty:
                            fig_eff = px.bar(eff_df, x="Temperature State", y="Efficiency (Wh/km)", color="Temperature State", text_auto='.1f', color_discrete_map={'< 90°C (Optimal)': '#00cc96', '90-110°C (Soaking)': '#FFD700', '> 110°C (Critical)': '#ff4b4b'})
                            fig_eff.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', height=400)
                            st.plotly_chart(fig_eff, use_container_width=True)

        if "Channel 1" in channel_view:
            with tab_delta:
                if active_channels:
                    max_time = df['Time'].max()
                    df_10s = pd.merge_asof(pd.DataFrame({"Time": np.arange(0, max_time + 10, 10)}), df.sort_values("Time"), on="Time", direction="nearest")
                    thermal_map = {"IGBT": "IGBT_Temp [C]", "Motor": "Motor_Temp [C]", "HighCell": "highest_temp [C]", "AFE": "Pack_Overall_Temp [C]"}
                    for ch in active_channels: 
                        if thermal_map[ch] in df_10s.columns: df_10s[f"{ch}_dT"] = df_10s[thermal_map[ch]] - df_10s[thermal_map[ch]].iloc[0]
                    
                    st.markdown("#### 🎯 Snapshot Evaluator")
                    max_slider_val = max(10, int((max_time//10)*10))
                    snap_time = st.slider("Select Evaluation Timestamp (seconds):", min_value=10, max_value=max_slider_val, value=min(120, max_slider_val), step=10)
                    snap_row = df_10s[df_10s["Time"] == snap_time]
                    
                    if not snap_row.empty:
                        metric_cols = st.columns(len(active_channels))
                        for i, ch in enumerate(active_channels): metric_cols[i].metric(label=f"🔥 {ch} ΔT @ {snap_time}s", value=f"+{snap_row[f'{ch}_dT'].values[0] if f'{ch}_dT' in snap_row.columns else 0:.2f} °C")
                    st.divider()
                    
                    st.subheader("📈 Cumulative Thermal Rise (ΔT)")
                    plot_cols = st.columns(2)
                    for i, ch in enumerate(active_channels):
                        if f"{ch}_dT" in df_10s.columns:
                            with plot_cols[i % 2]:
                                fig_dt = go.Figure()
                                fig_dt.add_trace(go.Scatter(x=df_10s['Time'], y=df_10s[f"{ch}_dT"], mode='lines+markers', name=f"⭐ {primary_test}", line=dict(color="#FF4081", width=2), marker=dict(size=4)))
                                fig_dt.add_vline(x=snap_time, line_width=1, line_dash="dash", line_color="cyan", annotation_text=f"Snapshot ({snap_time}s)")
                                
                                # 🌟 ROAD COMPARE LOGIC
                                for test in compare_tests:
                                    cmp_path = db_table[db_table["Ride_Name"] == test]["Processed_CSV_Path"].iloc[0]
                                    df_cmp = load_2hz_data(cmp_path)
                                    if not df_cmp.empty and thermal_map[ch] in df_cmp.columns:
                                        # Calculate dT for compare test natively
                                        df_cmp_10s = pd.merge_asof(pd.DataFrame({"Time": np.arange(0, df_cmp['Time'].max() + 10, 10)}), df_cmp.sort_values("Time"), on="Time", direction="nearest")
                                        df_cmp_10s[f"{ch}_dT"] = df_cmp_10s[thermal_map[ch]] - df_cmp_10s[thermal_map[ch]].iloc[0]
                                        fig_dt.add_trace(go.Scatter(x=df_cmp_10s['Time'], y=df_cmp_10s[f"{ch}_dT"], mode='lines', name=f"🔄 {test}", line=dict(width=1.5, dash='dot'), opacity=0.7))

                                fig_dt.update_layout(
                                    title=f"{ch} Cumulative Rise Profile", hovermode="x unified", height=350,
                                    plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=40, b=10),
                                    xaxis=dict(showgrid=False, zeroline=False, title="Time (s)"), yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)', title="ΔT (°C)", autorange=True, zeroline=False)
                                )
                                st.plotly_chart(fig_dt, use_container_width=True)
                                export_df_dt = df_10s[['Time', f"{ch}_dT"]].to_csv(index=False).encode('utf-8')
                                st.download_button(label=f"📥 Export {ch} ΔT Data", data=export_df_dt, file_name=f"{selected_ride[:10]}_{ch}_DeltaT.csv", mime="text/csv", key=f"dl_dt_{ch}_{i}", use_container_width=True)

    if "Channel 1" in channel_view or "Channel 2" in channel_view or "Channel 3" in channel_view or "Channel 4" in channel_view:
        with tab_custom:
            st.subheader("🗺️ Dynamic Multi-Plot & 3D Sandbox")
            
            def get_can_id(col_name):
                if col_name.startswith('['): return col_name.split(']')[0][1:]
                core_map = {
                    "Front_Speed": "0x12B_ABS_Info", "Motor_Temp": "0x123_MC_Status", "IGBT_Temp": "0x123_MC_Status", 
                    "Motor_Torque": "0x123_MC_Status", "Drive_Mode": "0x123_MC_Status", "soc": "0x111_SOC", 
                    "soh": "0x111_SOC", "current [A]": "0x111_SOC", "cumulative_totv": "0x111_SOC",
                    "highest_vol": "0x112_VOLTAGE", "lowest_vol": "0x112_VOLTAGE", "highest_temp": "0x113_TEMP", 
                    "lowest_temp": "0x113_TEMP", "hight_cellno": "0x113_TEMP", "lowt_cellno": "0x113_TEMP",
                    "afe_temp": "0x118_Segment_temp", "Throttle": "0x121_Power_Params", "RPM": "0x121_Power_Params", 
                    "DC_Volatge": "0x121_Power_Params", "DC_Current": "0x121_Power_Params", "ModeSw": "0x125_VcuStatus", 
                    "BrakeSw": "0x125_VcuStatus"
                }
                for key, val in core_map.items():
                    if key in col_name: return val
                return "Derived / Processed Metrics"

            all_columns = df.columns.tolist()
            available_cans = sorted(list(set([get_can_id(c) for c in all_columns if c != "Time"])))
            
            selected_cans = st.multiselect("🗂️ Filter by CAN ID System (Leave blank to show all):", available_cans, default=[])
            filtered_cols = ["Time"] + [c for c in all_columns if c != "Time" and (not selected_cans or get_can_id(c) in selected_cans)]

            st.markdown("#### 📊 Primary Plot")
            col_x, col_y1, col_y2, col_z = st.columns([1, 1.5, 1.5, 1])
            with col_x: x_axis = st.selectbox("⚙️ X-Axis", filtered_cols, index=0 if "Time" in filtered_cols else 0)
            with col_y1:
                default_y = ["Motor_Temp [C]"]
                y_axes = st.multiselect("📊 Left Y-Axis", filtered_cols, default=[dy for dy in default_y if dy in filtered_cols])
            with col_y2: y_axes_sec = st.multiselect("📈 Right Y-Axis (Secondary)", filtered_cols, default=[])
            with col_z: z_axis = st.selectbox("🗺️ Z-Axis (3D Mode)", ["None"] + filtered_cols, index=0)

            if y_axes or y_axes_sec:
                with st.expander("📐 Custom Axis Scaling (Min / Max Limits)"):
                    scale_cols = st.columns(3)
                    
                    def safe_min(col): 
                        if pd.api.types.is_numeric_dtype(df[col]):
                            non_zero = df[col][df[col] != 0]
                            return float(non_zero.min()) if not non_zero.empty else 0.0
                        return 0.0
                        
                    def safe_max(col): return float(df[col].max()) if pd.api.types.is_numeric_dtype(df[col]) else 100.0

                    with scale_cols[0]:
                        scale_x = st.checkbox("🔒 Override X-Axis Range")
                        if scale_x:
                            x_min = st.number_input("X-Axis Min", value=safe_min(x_axis), key="x_min")
                            x_max = st.number_input("X-Axis Max", value=safe_max(x_axis), key="x_max")
                    
                    with scale_cols[1]:
                        scale_y = st.checkbox("🔒 Override Y-Axis Range (Left Axis)")
                        if scale_y:
                            y_min_def = min([safe_min(y) for y in y_axes]) if y_axes else 0.0
                            y_max_def = max([safe_max(y) for y in y_axes]) if y_axes else 100.0
                            y_min = st.number_input("Left Y-Axis Min", value=y_min_def, key="y_min")
                            y_max = st.number_input("Left Y-Axis Max", value=y_max_def, key="y_max")
                            
                    with scale_cols[2]:
                        if z_axis != "None":
                            scale_z = st.checkbox("🔒 Override Z-Axis Range")
                            if scale_z:
                                z_min = st.number_input("Z-Axis Min", value=safe_min(z_axis), key="z_min")
                                z_max = st.number_input("Z-Axis Max", value=safe_max(z_axis), key="z_max")
                        else:
                            scale_z = False
                            st.info("Z-Axis scaling disabled (2D Mode)")

                if z_axis != "None":
                    plot_y = y_axes[0] if y_axes else y_axes_sec[0]
                    fig_multi = px.scatter_3d(df, x=x_axis, y=plot_y, z=z_axis, color=z_axis, color_continuous_scale='Turbo', opacity=0.7)
                    fig_multi.update_layout(margin=dict(l=0, r=0, b=0, t=0), height=600, plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)')
                    if scale_x: fig_multi.update_scenes(xaxis_range=[x_min, x_max])
                    if scale_y: fig_multi.update_scenes(yaxis_range=[y_min, y_max])
                    if scale_z: fig_multi.update_scenes(zaxis_range=[z_min, z_max])
                    st.plotly_chart(fig_multi, use_container_width=True)
                    if len(y_axes) + len(y_axes_sec) > 1: st.warning("⚠️ 3D Mode only visualizes the first selected Y-Axis.")
                else:
                    fig_multi = go.Figure()
                    custom_colors = px.colors.qualitative.Vivid
                    plot_mode = 'lines' if x_axis == 'Time' else 'markers'
                    marker_settings = dict(size=4, opacity=0.5) if plot_mode == 'markers' else None
                    
                    color_idx = 0
                    for y_col in y_axes: 
                        fig_multi.add_trace(go.Scatter(x=df[x_axis], y=df[y_col], mode=plot_mode, name=f"⭐ {primary_test} {y_col} (L)", marker=marker_settings, line=dict(color=custom_colors[color_idx % len(custom_colors)]) if plot_mode == 'lines' else None))
                        for test in compare_tests:
                            cmp_path = db_table[db_table["Ride_Name"] == test]["Processed_CSV_Path"].iloc[0]
                            df_cmp = load_2hz_data(cmp_path)
                            if not df_cmp.empty and y_col in df_cmp.columns and x_axis in df_cmp.columns:
                                fig_multi.add_trace(go.Scatter(x=df_cmp[x_axis], y=df_cmp[y_col], mode=plot_mode, name=f"🔄 {test} {y_col} (L)", marker=marker_settings, line=dict(dash='dot', color=custom_colors[color_idx % len(custom_colors)]) if plot_mode == 'lines' else None, opacity=0.7))
                        color_idx += 1
                    for y_col in y_axes_sec:
                        fig_multi.add_trace(go.Scatter(x=df[x_axis], y=df[y_col], mode=plot_mode, name=f"⭐ {primary_test} {y_col} (R)", yaxis="y2", marker=marker_settings, line=dict(dash='dash', color=custom_colors[color_idx % len(custom_colors)]) if plot_mode == 'lines' else None))
                        for test in compare_tests:
                            cmp_path = db_table[db_table["Ride_Name"] == test]["Processed_CSV_Path"].iloc[0]
                            df_cmp = load_2hz_data(cmp_path)
                            if not df_cmp.empty and y_col in df_cmp.columns and x_axis in df_cmp.columns:
                                fig_multi.add_trace(go.Scatter(x=df_cmp[x_axis], y=df_cmp[y_col], mode=plot_mode, name=f"🔄 {test} {y_col} (R)", yaxis="y2", marker=marker_settings, line=dict(dash='dashdot', color=custom_colors[color_idx % len(custom_colors)]) if plot_mode == 'lines' else None, opacity=0.7))
                        color_idx += 1

                    fig_multi.update_layout(
                        hovermode="x unified", height=600, legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                        plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=30, b=10),
                        xaxis=dict(showgrid=False, zeroline=False, title=x_axis),
                        yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)', title="Left Axis", autorange=True, zeroline=False),
                        yaxis2=dict(title="Right Axis", overlaying="y", side="right", showgrid=False, autorange=True, zeroline=False)
                    )
                    
                    if scale_x: fig_multi.update_xaxes(range=[x_min, x_max])
                    if scale_y: fig_multi.update_yaxes(range=[y_min, y_max])
                    st.plotly_chart(fig_multi, use_container_width=True)
                
                cols_to_export = [x_axis] + y_axes + y_axes_sec
                if z_axis != "None" and z_axis not in cols_to_export: cols_to_export.append(z_axis)
                export_custom_df = df[list(set(cols_to_export))].to_csv(index=False).encode('utf-8')
                st.download_button(label="📥 Export Primary Sandbox Data", data=export_custom_df, file_name=f"{selected_ride[:10]}_Primary_Plot.csv", mime="text/csv", key="dl_custom_sandbox")

            st.markdown("---")
            if st.checkbox("➕ Add Second Plot Below", key="add_second_plot_road"):
                st.markdown("#### 📊 Secondary Plot")
                col_x2, col_y1_2, col_y2_2, col_z2 = st.columns([1, 1.5, 1.5, 1])
                with col_x2: x_axis2 = st.selectbox("⚙️ X-Axis 2", filtered_cols, index=0 if "Time" in filtered_cols else 0, key="x2")
                with col_y1_2: y_axes2 = st.multiselect("📊 Left Y-Axis 2", filtered_cols, default=[], key="yl2")
                with col_y2_2: y_axes_sec2 = st.multiselect("📈 Right Y-Axis 2", filtered_cols, default=[], key="yr2")
                with col_z2: z_axis2 = st.selectbox("🗺️ Z-Axis (3D Mode) 2", ["None"] + filtered_cols, index=0, key="z2")

                if y_axes2 or y_axes_sec2:
                    if z_axis2 != "None":
                        plot_y2 = y_axes2[0] if y_axes2 else y_axes_sec2[0]
                        fig_multi2 = px.scatter_3d(df, x=x_axis2, y=plot_y2, z=z_axis2, color=z_axis2, color_continuous_scale='Turbo', opacity=0.7)
                        fig_multi2.update_layout(margin=dict(l=0, r=0, b=0, t=0), height=600, plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)')
                        st.plotly_chart(fig_multi2, use_container_width=True)
                        if len(y_axes2) + len(y_axes_sec2) > 1: st.warning("⚠️ 3D Mode only visualizes the first selected Y-Axis.")
                    else:
                        fig_multi2 = go.Figure()
                        plot_mode2 = 'lines' if x_axis2 == 'Time' else 'markers'
                        marker_settings2 = dict(size=4, opacity=0.5) if plot_mode2 == 'markers' else None
                        custom_colors = px.colors.qualitative.Vivid
                        
                        c_idx = 0
                        for y_col in y_axes2: 
                            fig_multi2.add_trace(go.Scatter(x=df[x_axis2], y=df[y_col], mode=plot_mode2, name=f"⭐ {primary_test} {y_col} (L)", marker=marker_settings2, line=dict(color=custom_colors[c_idx % len(custom_colors)], shape='spline', smoothing=0.8) if plot_mode2 == 'lines' else None))
                            for test in compare_tests:
                                cmp_path = db_table[db_table["Ride_Name"] == test]["Processed_CSV_Path"].iloc[0]
                                df_cmp = load_2hz_data(cmp_path)
                                if not df_cmp.empty and y_col in df_cmp.columns and x_axis2 in df_cmp.columns:
                                    fig_multi2.add_trace(go.Scatter(x=df_cmp[x_axis2], y=df_cmp[y_col], mode=plot_mode2, name=f"🔄 {test} {y_col} (L)", marker=marker_settings2, line=dict(dash='dot', color=custom_colors[c_idx % len(custom_colors)], shape='spline', smoothing=0.8) if plot_mode2 == 'lines' else None, opacity=0.7))
                            c_idx += 1
                        for y_col in y_axes_sec2:
                            fig_multi2.add_trace(go.Scatter(x=df[x_axis2], y=df[y_col], mode=plot_mode2, name=f"⭐ {primary_test} {y_col} (R)", yaxis="y2", marker=marker_settings2, line=dict(dash='dash', color=custom_colors[c_idx % len(custom_colors)], shape='spline', smoothing=0.8) if plot_mode2 == 'lines' else None))
                            for test in compare_tests:
                                cmp_path = db_table[db_table["Ride_Name"] == test]["Processed_CSV_Path"].iloc[0]
                                df_cmp = load_2hz_data(cmp_path)
                                if not df_cmp.empty and y_col in df_cmp.columns and x_axis2 in df_cmp.columns:
                                    fig_multi2.add_trace(go.Scatter(x=df_cmp[x_axis2], y=df_cmp[y_col], mode=plot_mode2, name=f"🔄 {test} {y_col} (R)", yaxis="y2", marker=marker_settings2, line=dict(dash='dashdot', color=custom_colors[c_idx % len(custom_colors)], shape='spline', smoothing=0.8) if plot_mode2 == 'lines' else None, opacity=0.7))
                            c_idx += 1

                        fig_multi2.update_layout(
                            hovermode="x unified", height=600, legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
                            plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(l=10, r=10, t=30, b=10),
                            xaxis=dict(showgrid=False, zeroline=False, title=x_axis2),
                            yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.05)', title="Left Axis", autorange=True, zeroline=False),
                            yaxis2=dict(title="Right Axis", overlaying="y", side="right", showgrid=False, autorange=True, zeroline=False)
                        )
                        st.plotly_chart(fig_multi2, use_container_width=True)

    if "Channel 5" in channel_view:
        with tab_ml:
            st.subheader("🤖 Driver Diagnostics: Ride Aggression")
            col_g1, col_g2 = st.columns([1, 1.5])
            
            with col_g1:
                fig_gauge = go.Figure(go.Indicator(
                    mode = "gauge+number", value = drive_score, domain = {'x': [0, 1], 'y': [0, 1]},
                    title = {'text': f"<b>Predicted Aggression</b><br><span style='color:gray;font-size:0.8em'>RandomForest Inference</span>", 'font': {"size": 18}},
                    gauge = {
                        'axis': {'range': [None, 100], 'tickwidth': 1, 'tickcolor': "darkblue"},
                        'bar': {'color': "rgba(0,0,0,0)"}, 'bgcolor': "white",
                        'steps': [{'range': [0, 30], 'color': "#00cc96"}, {'range': [30, 60], 'color': "#FFD700"}, {'range': [60, 100], 'color': "#FF4B4B"}],
                        'threshold': {'line': {'color': "white", 'width': 4}, 'thickness': 0.75, 'value': drive_score}
                    }
                ))
                fig_gauge.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font={'family': "Arial"}, height=350, margin=dict(t=50, b=0))
                st.plotly_chart(fig_gauge, use_container_width=True)

            with col_g2:
                t_val = min((ride_kpis.get('Avg_Torque_Nm', 0) / 40.0) * 100, 100)
                a_val = min((ride_kpis.get('Accel_Freq', 0) / 15.0) * 100, 100)
                s_val = ride_kpis.get('Pct_Sprint', 0)
                w_val = min((ride_kpis.get('Overall_Wh_km', 0) / 50.0) * 100, 100)
                o_val = min((ride_kpis.get('Speed_Osc_Index', 0) / 3.0) * 100, 100)
                categories = ['Torque Usage', 'Acceleration Freq', 'Sprint Mode %', 'Energy Wh/km', 'Speed Oscillation']
                fig_radar = go.Figure()
                fig_radar.add_trace(go.Scatterpolar(r=[t_val, a_val, s_val, w_val, o_val], theta=categories, fill='toself', name='Ride Feature Vector', line_color=score_color, fillcolor=score_color, opacity=0.6))
                
                fig_radar.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', polar=dict(radialaxis=dict(visible=True, range=[0, 100])), showlegend=False, height=350, margin=dict(t=30, b=30))
                st.plotly_chart(fig_radar, use_container_width=True)

            st.divider()
            st.markdown("#### 📊 Extracted Feature Vector (Raw)")
            a1, a2, a3, a4, a5 = st.columns(5)
            a1.metric("Average Torque", f"{ride_kpis.get('Avg_Torque_Nm', 0)} Nm")
            a2.metric("Torque Bursts (>50Nm)", f"{ride_kpis.get('Peak_Torque_Bursts', 0)}")
            a3.metric("Accel Frequency", f"{ride_kpis.get('Accel_Freq', 0)}")
            a4.metric("Speed Oscillation", f"{ride_kpis.get('Speed_Osc_Index', 0)}")
            a5.metric("% Time in Sprint", f"{ride_kpis.get('Pct_Sprint', 0)} %")

    if "Channel 6" in channel_view:
        with tab_events:
            st.subheader("🚨 Automated Event Detection")
            if not db_events.empty:
                ride_ev = db_events[db_events["Ride_Name"] == selected_ride]
                if not ride_ev.empty:
                    def highlight_events(val):
                        if 'Deration' in str(val): return 'color: #FF4B4B; font-weight: bold;'
                        if 'Torque' in str(val): return 'color: #FFD700; font-weight: bold;'
                        if 'Drain' in str(val): return 'color: #ab63fa; font-weight: bold;'
                        return ''
                    styled_ev = ride_ev.drop(columns=["Ride_Name"]).style.map(highlight_events, subset=['Event_Type'])
                    st.dataframe(styled_ev, use_container_width=True, hide_index=True)
                else: st.success("✅ **Zero high-stress events detected!** This ride was clean.")
            else: st.warning("No events found in database.")

    if "Channel 7" in channel_view:
        with tab_repo:
            st.subheader("📂 Road Test Repository (QC Gatekeeper)")
            
            repo_data = []
            for index, row in db_table.iterrows():
                try:
                    m_mot = float(row["Max_Motor_Temp_C"])
                    m_igbt = float(row["Max_IGBT_Temp_C"])
                    m_pack = float(row["Max_Pack_Temp_C"])
                except:
                    m_mot, m_igbt, m_pack = 0.0, 0.0, 0.0

                failed_reasons = []
                if m_mot >= 125: failed_reasons.append("Motor")
                if m_igbt >= 95: failed_reasons.append("IGBT")
                if m_pack >= 50: failed_reasons.append("Pack")
                
                conclusion = "✅ PASS" if not failed_reasons else f"❌ FAIL ({', '.join(failed_reasons)})"
                
                repo_data.append({
                    "Test Name": row["Ride_Name"],
                    "Distance (km)": round(float(row["Total_Distance_km"]), 2),
                    "Efficiency (Wh/km)": round(float(row["Overall_Wh_km"]), 1),
                    "ML Drive Score": round(float(row.get("Drive_Score", 0)), 1),
                    "Ride Class": str(row.get("Ride_Class", "Unknown")),
                    "Max Motor (°C)": round(m_mot, 1),
                    "Max IGBT (°C)": round(m_igbt, 1),
                    "Max Pack (°C)": round(m_pack, 1),
                    "Final Conclusion": conclusion
                })
            
            repo_df = pd.DataFrame(repo_data)
            all_bikes_repo = repo_df["Test Name"].tolist()
            selected_repo_bikes = st.multiselect("🏍️ Filter by Test Log:", options=["All Rides"] + all_bikes_repo, default=["All Rides"], key="road_repo_filter")
            
            if "All Rides" not in selected_repo_bikes and selected_repo_bikes:
                repo_df = repo_df[repo_df["Test Name"].isin(selected_repo_bikes)]
                
            def color_cells(val):
                if 'PASS' in str(val): return 'background-color: rgba(0, 204, 150, 0.15); color: #00CC96; font-weight: bold;'
                elif 'FAIL' in str(val): return 'background-color: rgba(255, 75, 75, 0.15); color: #FF4B4B; font-weight: bold;'
                return ''
                
            st.dataframe(repo_df.style.map(color_cells, subset=['Final Conclusion']), use_container_width=True, hide_index=True)
            
            st.markdown("---")
            st.download_button(label="📥 Export Master Repository (CSV)", data=repo_df.to_csv(index=False).encode('utf-8'), file_name="Road_QC_Repository.csv", mime="text/csv", key="dl_road_repo")