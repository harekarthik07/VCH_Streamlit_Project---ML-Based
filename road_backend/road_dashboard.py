import streamlit as st
import sqlite3
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
import os
import shutil
import time

# ==========================================================
# 1. APP CONFIG & STYLING
# ==========================================================
st.set_page_config(page_title="Raptee VCH Road Monitor", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
<style>
    .metric-card {
        background-color: #1E1E1E; border: 1px solid #333; border-radius: 8px;
        padding: 15px; margin-bottom: 10px; box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
    }
    .metric-title { color: #888; font-size: 14px; margin-bottom: 5px; }
    .metric-value { color: #FFF; font-size: 26px; font-weight: bold; }
    .metric-sub { color: #666; font-size: 12px; margin-top: 5px; }
    .highlight-red { border-left: 4px solid #FF4B4B; }
    .highlight-green { border-left: 4px solid #00CC96; }
    .highlight-gold { border: 1px solid #FFD700; }
    .deration-banner {
        background-color: #490202; border: 1px solid #FF4B4B; color: #ffb4b4;
        padding: 12px 20px; border-radius: 6px; font-weight: 600;
        margin-bottom: 20px; box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
    }
    .stButton>button { width: 100%; border-radius: 5px; height: 3em; }
    .raptee-logo { font-family: 'Arial Black', sans-serif; font-size: 28px; font-style: italic; font-weight: 900; color: white; letter-spacing: 1px; }
    .raptee-hv { color: #00cc96; }
</style>
""", unsafe_allow_html=True)

# ==========================================================
# HELPER FUNCTIONS
# ==========================================================
def safe_clear_data():
    try:
        st.cache_data.clear()
        time.sleep(0.5)
        if os.path.exists("raptee_rides.db"): os.remove("raptee_rides.db")
        if os.path.exists("Raw_Data"): shutil.rmtree("Raw_Data")
        if os.path.exists("Processed_Rides"): shutil.rmtree("Processed_Rides")
        return True
    except Exception as e:
        st.error(f"Reset Error: {e}")
        return False

def get_route_type(filename):
    if "_Route-Office" in filename: return "Office Full Push"
    elif "_Route-Road" in filename: return "Road Full Push"
    return "Untagged / Legacy"

def get_clean_bike_no(filename):
    clean_name = filename.replace("_Route-Office", "").replace("_Route-Road", "")
    return clean_name[11:].replace('.xlsx', '') if len(clean_name) > 11 else "Unknown"

# ==========================================================
# 2. SIDEBAR: NAVIGATION
# ==========================================================
st.sidebar.title("VCH Suite V4 (Road)")
app_mode = st.sidebar.radio("Navigation", ["📊 Monitor Dashboard", "🛠️ Data Engine"])
st.sidebar.markdown("---")

if st.sidebar.button("🔄 Refresh Data"):
    st.cache_data.clear()
    st.rerun()

st.sidebar.markdown("---")

# ==========================================================
# 3. DATA ENGINE MODULE
# ==========================================================
if app_mode == "🛠️ Data Engine":
    st.title("🛠️ Road Test Data Engine")
    st.info("Upload raw Road Test `.xlsx` files here. Tag them appropriately before saving!", icon="ℹ️")
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("1️⃣ Upload & Tag Data")
        route_tag = st.radio("🛣️ Select Test Route:", ["Office Full Push", "Road Full Push"])
        uploaded_files = st.file_uploader("Drop .xlsx file(s) here", type=["xlsx"], accept_multiple_files=True)

        if uploaded_files:
            file_count = len(uploaded_files)
            if st.button(f"💾 Tag & Save {file_count} File(s)"):
                raw_folder = "Raw_Data"
                os.makedirs(raw_folder, exist_ok=True)
                suffix = "_Route-Office" if route_tag == "Office Full Push" else "_Route-Road"
                for uploaded_file in uploaded_files:
                    original_name = uploaded_file.name
                    name_parts = original_name.rsplit('.', 1)
                    new_name = f"{name_parts[0]}{suffix}.{name_parts[1]}"
                    save_path = os.path.join(raw_folder, new_name)
                    with open(save_path, "wb") as f: f.write(uploaded_file.getbuffer())
                st.toast(f"✅ Successfully tagged and saved {file_count} files as {route_tag}!", icon="💾")

    with col2:
        st.subheader("2️⃣ Engine Controls")
        if st.button("🚀 Process & Sync Database", type="primary"):
            with st.status("⚙️ Processing Engine Logic...", expanded=True) as status:
                try:
                    from db_manager import DatabaseManager
                    db = DatabaseManager()
                    db.process_new_files("Raw_Data")
                    status.update(label="✅ Complete! Database updated.", state="complete", expanded=False)
                    st.cache_data.clear()
                    st.toast("🚀 Processing Complete!", icon="✅")
                except Exception as e:
                    st.error(f"Error Details: {e}\n\nMake sure `db_manager.py` and `thermal_ride.py` are in this folder!")
                    status.update(label="❌ Failed", state="error")
        
        st.markdown("---")
        with st.expander("⚠️ Danger Zone: Factory Reset"):
            st.warning("This will permanently delete the Database, Raw Data, and Processed CSVs.")
            if st.button("🗑️ CLEAR ALL DATA"):
                if safe_clear_data():
                    st.toast("💥 Factory Reset Complete!", icon="🗑️")
                    time.sleep(1)
                    st.rerun()

# ==========================================================
# 4. MONITOR DASHBOARD MODULE
# ==========================================================
elif app_mode == "📊 Monitor Dashboard":
    
    @st.cache_data
    def load_ride_database():
        try:
            conn = sqlite3.connect("raptee_rides.db")
            df = pd.read_sql_query("SELECT * FROM ride_summaries", conn)
            conn.close()
            return df
        except: return pd.DataFrame()

    @st.cache_data
    def load_2hz_data(csv_path):
        return pd.read_csv(csv_path)

    db_table = load_ride_database()
    
    if db_table.empty:
        st.error("🚨 Master Database Not Found or Empty! Please go to the 'Data Engine' tab and process your files.")
        st.stop()

    # --- DYNAMIC FILTERS ---
    st.sidebar.markdown("### 🎯 Test Selection")
    all_tests = db_table['Ride_Name'].tolist()
    available_dates = sorted(list(set([t[:10] for t in all_tests])), reverse=True)
    selected_dates = st.sidebar.multiselect("📅 Filter by Date:", ["All Dates"] + available_dates, default=["All Dates"])
    available_routes = sorted(list(set([get_route_type(t) for t in all_tests])))
    selected_routes = st.sidebar.multiselect("🛣️ Filter by Route:", ["All Routes"] + available_routes, default=["All Routes"])
    available_bikes = sorted(list(set([get_clean_bike_no(t) for t in all_tests])))
    selected_bikes = st.sidebar.multiselect("🏍️ Filter by Bike No:", ["All Bikes"] + available_bikes, default=["All Bikes"])
    
    filtered_df = db_table.copy()
    if "All Dates" not in selected_dates: filtered_df = filtered_df[filtered_df['Ride_Name'].str[:10].isin(selected_dates)]
    if "All Routes" not in selected_routes: filtered_df = filtered_df[filtered_df['Ride_Name'].apply(get_route_type).isin(selected_routes)]
    if "All Bikes" not in selected_bikes: filtered_df = filtered_df[filtered_df['Ride_Name'].apply(get_clean_bike_no).isin(selected_bikes)]
        
    if filtered_df.empty:
        st.sidebar.warning("⚠️ No tests found for the selected filters.")
        st.stop()

    selected_ride = st.sidebar.selectbox("⭐ Primary Test Log:", filtered_df['Ride_Name'].tolist())
    ride_kpis = filtered_df[filtered_df['Ride_Name'] == selected_ride].iloc[0]
    current_route_type = get_route_type(selected_ride)
    
    # --- CHANNEL SELECTORS ---
    st.sidebar.divider()
    st.sidebar.markdown("### 📊 Channels")
    channel_view = st.sidebar.radio("Select Domain:", [
        "🌡️ Channel 1: Thermal Systems", 
        "⚡ Channel 2: Dynamic Systems",
        "🎯 Channel 3: Ride Analytics",
        "🔋 Channel 4: Battery & Range"
    ])
    st.sidebar.markdown("---")
    
    if "Channel 1" in channel_view:
        st.sidebar.markdown("### 🎛️ Manual Channel Input")
        active_channels = st.sidebar.multiselect("Select Thermal Channels:", ["IGBT", "Motor", "HighCell", "AFE"], default=["IGBT", "Motor", "HighCell", "AFE"])
    elif "Channel 2" in channel_view:
        st.sidebar.markdown("### 🎛️ Manual Channel Input")
        dynamic_opts = ["RPM [RPM]", "Front_Speed [kph]", "Throttle", "soc", "Instant_Power [W]", "DC_Volatge [V]", "Motor_Torque [Nm]"]
        active_channels = st.sidebar.multiselect("Select Dynamic Channels:", dynamic_opts, default=["Front_Speed [kph]", "RPM [RPM]", "Instant_Power [W]"])

    try:
        df = load_2hz_data(ride_kpis['Processed_CSV_Path'])
    except Exception as e:
        st.error("Error loading 2Hz data.")
        st.stop()

    # --- HEADER METADATA & CSS LOGO ---
    col_logo, col_title = st.columns([2, 8])
    with col_logo:
        st.markdown("<div style='margin-top: 15px;'></div>", unsafe_allow_html=True)
        if os.path.exists("raptee_logo.png"):
            st.image("raptee_logo.png", width=220)
        else:
            st.markdown("<div class='raptee-logo'>RAPTEE<span class='raptee-hv'>.HV</span></div>", unsafe_allow_html=True)
        
    with col_title:
        st.markdown(f"<h1 style='margin-top: -20px; padding-bottom: 0px;'>VCH - Road Test Thermal Monitor</h1>", unsafe_allow_html=True)
        st.markdown(f"**Target:** `{selected_ride}`")
        
    # --- DYNAMIC INTRO BANNER ---
    test_date = selected_ride[:10]
    total_duration = df['Time'].max()
    dist = ride_kpis['Total_Distance_km']
    route_icon = "🏢" if "Office" in current_route_type else "🛣️" if "Road" in current_route_type else "❓"
    
    st.markdown(f"""
    <div style="background-color: #1E1E1E; border: 1px solid #333; border-radius: 6px; padding: 10px 20px; margin-top: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 1px 1px 4px rgba(0,0,0,0.2);">
        <div style="text-align: center;"><div style="color: #888; font-size: 11px; text-transform: uppercase;">Test Date</div><div style="color: #FFF; font-weight: bold; font-size: 14px;">📅 {test_date}</div></div>
        <div style="border-left: 1px solid #333; height: 30px;"></div>
        <div style="text-align: center;"><div style="color: #888; font-size: 11px; text-transform: uppercase;">Test Route</div><div style="color: #00cc96; font-weight: bold; font-size: 14px;">{route_icon} {current_route_type}</div></div>
        <div style="border-left: 1px solid #333; height: 30px;"></div>
        <div style="text-align: center;"><div style="color: #888; font-size: 11px; text-transform: uppercase;">Total Distance</div><div style="color: #FFF; font-weight: bold; font-size: 14px;">📍 {dist} km</div></div>
        <div style="border-left: 1px solid #333; height: 30px;"></div>
        <div style="text-align: center;"><div style="color: #888; font-size: 11px; text-transform: uppercase;">Total Duration</div><div style="color: #FFF; font-weight: bold; font-size: 14px;">⏱️ {int(total_duration)} s</div></div>
    </div>
    """, unsafe_allow_html=True)

    # --- TABBED INTERFACE ---
    if "Channel 1" in channel_view:
        tab_main, tab_delta, tab_custom = st.tabs(["📊 Primary Dashboard", "📈 Cumulative Rise (ΔT)", "🛠️ Custom Multi-Plot Overlay"])
    else:
        tab_main, tab_custom = st.tabs(["📊 Primary Dashboard", "🛠️ Custom Multi-Plot Overlay"])

    with tab_main:
        # ==========================================
        # CHANNEL 1: THERMALS
        # ==========================================
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
                    cols[i].markdown(f"""<div class="{card_style}"><div class="metric-title">{ch} Raw Max Temp</div><div class="metric-value" style="color:{val_color}">{data['val']:.1f} °C</div><div class="metric-sub">Peak @ {data['time']:.1f}s {extra_info}</div><div class="metric-sub" style="border-top:1px solid #444; margin-top:8px; padding-top:5px;">Limit: {data['limit']}°C | {status_text}</div></div>""", unsafe_allow_html=True)

                if deration_msg: st.markdown(f"<div class='deration-banner'>{deration_msg}</div>", unsafe_allow_html=True)
                st.divider()
                st.markdown("### 📈 Individual Thermal Curves")
                graph_cols = st.columns(2)
                for i, ch in enumerate(active_channels):
                    with graph_cols[i % 2]:
                        fig = go.Figure()
                        limit = thermal_map[ch]["limit"]
                        fig.add_trace(go.Scatter(x=df['Time'], y=df[thermal_map[ch]["col"]], mode='lines', name=ch, line=dict(color=thermal_map[ch]["color"], width=2)))
                        fig.add_hline(y=limit, line_dash="dash", line_color="red", annotation_text=f"Limit: {limit}°C")
                        fig.update_layout(title=f"{ch} Temperature Profile", plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font=dict(color='#aaa'), hovermode="x unified", height=350, margin=dict(l=20, r=20, t=40, b=20), xaxis=dict(showgrid=True, gridcolor='#333'), yaxis=dict(showgrid=True, gridcolor='#333'))
                        st.plotly_chart(fig, use_container_width=True)
                        
                st.divider()
                st.markdown("### 📊 Combined Thermal Overlay")
                fig_combined = go.Figure()
                for ch in active_channels: fig_combined.add_trace(go.Scatter(x=df['Time'], y=df[thermal_map[ch]["col"]], mode='lines', name=ch, line=dict(color=thermal_map[ch]["color"], width=2)))
                fig_combined.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font=dict(color='#aaa'), hovermode="x unified", height=450, margin=dict(l=20, r=20, t=40, b=20), xaxis=dict(showgrid=True, gridcolor='#333', title="Time (s)"), yaxis=dict(showgrid=True, gridcolor='#333', title="Temperature (°C)"), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
                st.plotly_chart(fig_combined, use_container_width=True)

        # ==========================================
        # CHANNEL 2: DYNAMIC SYSTEMS
        # ==========================================
        elif "Channel 2" in channel_view:
            st.markdown("### ⚡ Dynamic System Overview")
            d1, d2, d3 = st.columns(3)
            d1.metric("Total Distance", f"{ride_kpis['Total_Distance_km']} km")
            d2.metric("Energy Consumed", f"{ride_kpis['Total_Energy_Wh']} Wh")
            d3.metric("High Torque Demands", f"{ride_kpis['High_Torque_Time_sec']} sec")
            st.divider()
            if not active_channels: st.info("👆 Please select at least one Dynamic Channel from the sidebar.")
            else:
                st.markdown("### 📈 Individual Dynamic Curves")
                graph_cols = st.columns(2)
                colors = px.colors.qualitative.Plotly
                for i, ch in enumerate(active_channels):
                    with graph_cols[i % 2]:
                        fig = go.Figure()
                        fig.add_trace(go.Scatter(x=df['Time'], y=df[ch], mode='lines', name=ch, line=dict(color=colors[i % len(colors)], width=2)))
                        fig.update_layout(title=f"{ch} Profile", plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font=dict(color='#aaa'), hovermode="x unified", height=350, margin=dict(l=20, r=20, t=40, b=20), xaxis=dict(showgrid=True, gridcolor='#333'), yaxis=dict(showgrid=True, gridcolor='#333'))
                        st.plotly_chart(fig, use_container_width=True)

        # ==========================================
        # CHANNEL 3: RIDE ANALYTICS
        # ==========================================
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
                st.markdown("#### 🚀 Drive Mode Distribution")
                labels_mode = ['Comfort', 'Power', 'Sprint']
                vals_mode = [ride_kpis['Time_in_Comfort_min'], ride_kpis['Time_in_Power_min'], ride_kpis['Time_in_Sprint_min']]
                fig_mode = go.Figure(data=[go.Pie(labels=labels_mode, values=vals_mode, hole=.4, marker_colors=['#00cc96', '#ab63fa', '#ff4b4b'])])
                fig_mode.update_layout(template='plotly_dark', plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(t=20, b=20, l=20, r=20), height=350)
                st.plotly_chart(fig_mode, use_container_width=True)

            with col_d2:
                st.markdown("#### 🔋 Powertrain State (Regen vs. Coast vs. Push)")
                if 'Motor_Torque [Nm]' in df.columns:
                    accel_time_min = len(df[df['Motor_Torque [Nm]'] > 2]) * 0.5 / 60
                    regen_time_min = len(df[df['Motor_Torque [Nm]'] < -2]) * 0.5 / 60
                    coast_time_min = len(df[(df['Motor_Torque [Nm]'] >= -2) & (df['Motor_Torque [Nm]'] <= 2)]) * 0.5 / 60
                    labels_pwr = ['Acceleration (> 2Nm)', 'Coasting (± 2Nm)', 'Regen Braking (< -2Nm)']
                    vals_pwr = [accel_time_min, coast_time_min, regen_time_min]
                    fig_pwr = go.Figure(data=[go.Pie(labels=labels_pwr, values=vals_pwr, hole=.4, marker_colors=['#ff4b4b', '#888888', '#00cc96'])])
                    fig_pwr.update_layout(template='plotly_dark', plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', margin=dict(t=20, b=20, l=20, r=20), height=350)
                    st.plotly_chart(fig_pwr, use_container_width=True)
                else:
                    st.error("Motor_Torque [Nm] data missing.")

            st.divider()
            st.markdown("### ⚠️ Motor Torque vs. Thermal Deration Map")
            
            if 'Motor_Torque [Nm]' in df.columns and 'Motor_Temp [C]' in df.columns:
                fig_derate = go.Figure()
                fig_derate.add_trace(go.Scatter(x=df['Time'], y=df['Motor_Torque [Nm]'], mode='lines', fill='tozeroy', name='Motor Torque Demanded (Nm)', line=dict(color='#1f77b4', width=1), opacity=0.4))
                fig_derate.add_trace(go.Scatter(x=df['Time'], y=df['Motor_Temp [C]'], mode='lines', name='Motor Temp (°C)', yaxis='y2', line=dict(color='#ff4b4b', width=3)))
                fig_derate.add_hline(y=125.0, line_dash="dash", line_color="gold", annotation_text="Safety Limit (125°C)", yref="y2")
                fig_derate.update_layout(template='plotly_dark', plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', hovermode="x unified", height=500, margin=dict(t=30, b=30, l=30, r=50), xaxis=dict(title="Time (s)", showgrid=True, gridcolor='#333'), yaxis=dict(title="Motor Torque (Nm)", showgrid=True, gridcolor='#333'), yaxis2=dict(title="Motor Temperature (°C)", overlaying='y', side='right', showgrid=False, range=[0, df['Motor_Temp [C]'].max() + 15]), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
                st.plotly_chart(fig_derate, use_container_width=True)

        # ==========================================
        # CHANNEL 4: BATTERY & RANGE (NEW)
        # ==========================================
        elif "Channel 4" in channel_view:
            st.markdown("### 🔋 Battery Drain & Efficiency Mapping")
            
            if "soc" in df.columns and "Front_Speed [kph]" in df.columns and "Instant_Power [W]" in df.columns:
                start_soc = df["soc"].iloc[0]
                end_soc = df["soc"].iloc[-1]
                drain = start_soc - end_soc
                
                b1, b2, b3 = st.columns(3)
                b1.metric("SOC Consumed", f"{drain:.1f} %", f"Start: {start_soc}% → End: {end_soc}%", delta_color="inverse")
                b2.metric("Total Energy Extracted", f"{ride_kpis['Total_Energy_Wh']} Wh")
                b3.metric("Average Wh/km", f"{ride_kpis['Overall_Wh_km']} Wh/km")
                
                st.divider()
                st.markdown("#### 📉 SOC Drop vs Speed Profile")
                
                fig_soc = go.Figure()
                fig_soc.add_trace(go.Scatter(x=df['Time'], y=df['Front_Speed [kph]'], mode='lines', name='Speed (kph)', line=dict(color='#00cc96', width=1), opacity=0.5))
                fig_soc.add_trace(go.Scatter(x=df['Time'], y=df['soc'], mode='lines', name='SOC (%)', yaxis='y2', line=dict(color='#ab63fa', width=3)))
                fig_soc.update_layout(
                    template='plotly_dark', plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', hovermode="x unified", height=450,
                    xaxis=dict(title="Time (s)", showgrid=True, gridcolor='#333'), yaxis=dict(title="Vehicle Speed (kph)", showgrid=True, gridcolor='#333'),
                    yaxis2=dict(title="State of Charge (%)", overlaying='y', side='right', showgrid=False, range=[end_soc - 5, start_soc + 5]),
                    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
                )
                st.plotly_chart(fig_soc, use_container_width=True)

                st.divider()
                st.markdown("#### 🌡️ Thermal-Efficiency Correlation (Wh/km vs Motor Temp)")
                st.write("Does the bike consume more battery when the motor is heat-soaked? This engine calculates efficiency dynamically based on temperature brackets.")

                # Calculate instantaneous metrics per 0.5s row
                df['Inst_Energy_Wh'] = df['Instant_Power [W]'] * (0.5 / 3600)
                df['Inst_Dist_km'] = df['Front_Speed [kph]'] * (0.5 / 3600)
                
                # Filter out pure regen/idle noise for a true consumption calculation (optional)
                df_consume = df[df['Inst_Energy_Wh'] > 0]
                
                # Create Temperature Brackets
                conditions = [
                    (df_consume['Motor_Temp [C]'] < 90),
                    (df_consume['Motor_Temp [C]'] >= 90) & (df_consume['Motor_Temp [C]'] <= 110),
                    (df_consume['Motor_Temp [C]'] > 110)
                ]
                choices = ['< 90°C (Optimal)', '90-110°C (Soaking)', '> 110°C (Critical)']
                df_consume['Temp_Bracket'] = np.select(conditions, choices, default='Unknown')
                
                # Group and aggregate
                eff_data = []
                for bracket in choices:
                    b_df = df_consume[df_consume['Temp_Bracket'] == bracket]
                    tot_energy = b_df['Inst_Energy_Wh'].sum()
                    tot_dist = b_df['Inst_Dist_km'].sum()
                    wh_km = (tot_energy / tot_dist) if tot_dist > 0 else 0
                    if tot_dist > 0.5: # Only plot if we actually rode at least 0.5km in this bracket
                        eff_data.append({"Temperature State": bracket, "Efficiency (Wh/km)": wh_km, "Distance Driven (km)": tot_dist})
                
                eff_df = pd.DataFrame(eff_data)
                
                if not eff_df.empty:
                    fig_eff = px.bar(eff_df, x="Temperature State", y="Efficiency (Wh/km)", color="Temperature State", text_auto='.1f',
                                     color_discrete_map={'< 90°C (Optimal)': '#00cc96', '90-110°C (Soaking)': '#ffa500', '> 110°C (Critical)': '#ff4b4b'})
                    fig_eff.update_layout(template='plotly_dark', plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', height=400)
                    st.plotly_chart(fig_eff, use_container_width=True)
                else:
                    st.info("Not enough distance driven under active power to calculate bracketed efficiency.")

            else:
                st.error("Required telemetry columns (SOC, Speed, or Power) missing for Battery Analytics.")

    # --- CUMULATIVE RISE (ΔT) TAB ---
    if "Channel 1" in channel_view:
        with tab_delta:
            if not active_channels: st.info("👆 Please select at least one Thermal Channel.")
            else:
                st.markdown("### 📈 Cumulative Thermal Rise (ΔT)")
                max_time = df['Time'].max()
                target_times = np.arange(0, max_time + 10, 10)
                df_sorted = df.sort_values("Time")
                df_10s = pd.merge_asof(pd.DataFrame({"Time": target_times}), df_sorted, on="Time", direction="nearest")
                thermal_map = {"IGBT": "IGBT_Temp [C]", "Motor": "Motor_Temp [C]", "HighCell": "highest_temp [C]", "AFE": "Pack_Overall_Temp [C]"}
                for ch in active_channels: df_10s[f"{ch}_dT"] = df_10s[thermal_map[ch]] - df_10s[thermal_map[ch]].iloc[0]
                    
                st.markdown("#### 🎯 Snapshot Evaluator")
                snap_time = st.slider("Select Evaluation Timestamp (seconds):", min_value=10, max_value=int((max_time//10)*10), value=120, step=10)
                snap_row = df_10s[df_10s["Time"] == snap_time]
                if not snap_row.empty:
                    metric_cols = st.columns(len(active_channels))
                    for i, ch in enumerate(active_channels): metric_cols[i].metric(label=f"🔥 {ch} Accumulated Heat @ {snap_time}s", value=f"+{snap_row[f'{ch}_dT'].values[0]:.2f} °C")
                st.divider()
                plot_cols = st.columns(2)
                for i, ch in enumerate(active_channels):
                    with plot_cols[i % 2]:
                        fig_dt = go.Figure()
                        fig_dt.add_trace(go.Scatter(x=df_10s['Time'], y=df_10s[f"{ch}_dT"], mode='lines+markers', name=f"{ch} ΔT", line=dict(color="#FF4081", width=2), marker=dict(size=4)))
                        fig_dt.add_vline(x=snap_time, line_width=1, line_dash="dash", line_color="cyan", annotation_text=f"Snapshot ({snap_time}s)")
                        fig_dt.update_layout(title=f"{ch} Cumulative Rise Profile", plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font=dict(color='#aaa'), hovermode="x unified", height=350, margin=dict(l=20, r=20, t=40, b=20), xaxis=dict(showgrid=True, gridcolor='#333', title="Time (s)"), yaxis=dict(showgrid=True, gridcolor='#333', title="ΔT (°C)"))
                        st.plotly_chart(fig_dt, use_container_width=True)

    # --- CUSTOM MULTI-PLOT ---
    with tab_custom:
        st.markdown("### 🛠️ Custom Multi-Plot Overlay Sandbox")
        col_sel1, col_sel2 = st.columns([3, 1])
        with col_sel1:
            custom_y = st.multiselect("📊 Select Y-Axis Parameters to Overlay:", df.columns.tolist(), default=["Motor_Temp [C]", "Front_Speed [kph]", "Motor_Torque [Nm]"])
        if custom_y:
            fig_multi = go.Figure()
            custom_colors = px.colors.qualitative.Vivid
            for i, y_col in enumerate(custom_y): fig_multi.add_trace(go.Scatter(x=df['Time'], y=df[y_col], mode='lines', name=y_col, line=dict(width=2, color=custom_colors[i % len(custom_colors)])))
            fig_multi.update_layout(plot_bgcolor='rgba(0,0,0,0)', paper_bgcolor='rgba(0,0,0,0)', font=dict(color='#aaa'), hovermode="x unified", height=600, xaxis=dict(showgrid=True, gridcolor='#333', title="Time (seconds)"), yaxis=dict(showgrid=True, gridcolor='#333', title="Values"), legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1))
            st.plotly_chart(fig_multi, use_container_width=True)
        else: st.info("Select parameters from the dropdown above to build your custom overlay.")