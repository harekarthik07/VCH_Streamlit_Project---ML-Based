import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import os
import shutil
import time
import io
import gc
from docxtpl import DocxTemplate    
import thermal_engine

# ==========================================================
# 1. APP CONFIG & STYLING
# ==========================================================
st.set_page_config(layout="wide", page_title="VCH Thermal Suite V4", page_icon="📊")

st.markdown("""
<style>
    .metric-card {
        background-color: #1E1E1E;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 10px;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.5);
    }
    .metric-title { color: #888; font-size: 14px; margin-bottom: 5px; }
    .metric-value { color: #FFF; font-size: 26px; font-weight: bold; }
    .metric-sub { color: #666; font-size: 12px; margin-top: 5px; }
    .highlight-red { border-left: 4px solid #FF4B4B; }
    .highlight-green { border-left: 4px solid #00CC96; }
    .highlight-gold { border: 1px solid #FFD700; }
    .stButton>button { width: 100%; border-radius: 5px; height: 3em; }
    /* Smaller font for metric labels in repo tab */
    [data-testid="stMetricLabel"] { font-size: 14px; color: #888; }
</style>
""", unsafe_allow_html=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MASTER_PROCESSED = thermal_engine.MASTER_PROCESSED_FILE
MASTER_SUMMARY = thermal_engine.MASTER_SUMMARY_FILE
BASELINE_ENVELOPE = os.path.join(thermal_engine.MASTER_FOLDER, "baseline_envelope.xlsx")
LOGO_PATH = os.path.join(BASE_DIR, "raptee_logo.png")
TEMPLATE_PATH = os.path.join(BASE_DIR, "VCH_Report_Template.docx")

def convert_df_to_excel(df):
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='GraphData')
    return output.getvalue()

def safe_clear_data():
    try:
        st.cache_data.clear()
        gc.collect()
        time.sleep(1)
        folders_to_clear = [thermal_engine.MASTER_FOLDER, thermal_engine.PROCESSED_FOLDER]
        for folder in folders_to_clear:
            if os.path.exists(folder):
                for filename in os.listdir(folder):
                    file_path = os.path.join(folder, filename)
                    try:
                        if os.path.isfile(file_path) or os.path.islink(file_path): os.unlink(file_path)
                        elif os.path.isdir(file_path): shutil.rmtree(file_path)
                    except: pass
        if os.path.exists(thermal_engine.REGISTRY_FILE): os.remove(thermal_engine.REGISTRY_FILE)
        return True
    except Exception as e:
        st.error(f"Reset Error: {e}")
        return False

st.sidebar.title("VCH Suite V4")
app_mode = st.sidebar.radio("Navigation", ["📊 Monitor Dashboard", "🛠️ Data Engine"])
st.sidebar.markdown("---")

# ==========================================================
# DATA ENGINE MODULE
# ==========================================================
if app_mode == "🛠️ Data Engine":
    st.title("🛠️ VCH Data Engine")
    golden_list_str = ", ".join(thermal_engine.GOLDEN_BIKES)
    st.info(f"👑 **Active Golden Standard:** The Engine is hardcoded to build the Master Curve using ONLY these bikes: **{golden_list_str}**. All other uploads will be evaluated against them.", icon="ℹ️")
    st.markdown("---")
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("1️⃣ Upload Raw Data")
        data_type = st.radio("Select Test Type", ["Evaluation (Test)", "Baseline (Calibration)"])
        uploaded_files = st.file_uploader("Drop .xlsx file(s) here", type=["xlsx"], accept_multiple_files=True)

        if uploaded_files:
            file_count = len(uploaded_files)
            if st.button(f"💾 Save {file_count} File(s)"):
                target_folder = thermal_engine.BASELINE_FOLDER if data_type.startswith("Baseline") else thermal_engine.EVAL_FOLDER
                for uploaded_file in uploaded_files:
                    save_path = os.path.join(target_folder, uploaded_file.name)
                    with open(save_path, "wb") as f: f.write(uploaded_file.getbuffer())
                st.toast(f"✅ Successfully saved {file_count} files to {data_type}!", icon="💾")

    with col2:
        st.subheader("2️⃣ Engine Controls")
        if st.button("🚀 Run Processing Cycle", type="primary"):
            with st.status("⚙️ Processing Engine Logic...", expanded=True) as status:
                try:
                    results = thermal_engine.run_processing_cycle()
                    st.write(f"🔹 Total Files Processed: {results.get('Processed', 0)}")
                    status.update(label="✅ Complete!", state="complete", expanded=False)
                    st.cache_data.clear()
                    st.toast("🚀 Processing Complete!", icon="✅")
                except Exception as e:
                    st.error(f"Error Details: {e}")
                    status.update(label="❌ Failed", state="error")

        st.markdown("---")
        with st.expander("⚠️ Danger Zone: Factory Reset"):
            if st.button("🗑️ CLEAR ALL DATA"):
                if safe_clear_data():
                    st.toast("💥 Factory Reset Complete!", icon="🗑️")
                    time.sleep(1)
                    st.rerun()

# ==========================================================
# MONITOR DASHBOARD MODULE
# ==========================================================
elif app_mode == "📊 Monitor Dashboard":
    if not os.path.exists(MASTER_PROCESSED):
        st.error("🚨 Master Data Not Found! Please process data first.")
        st.stop()

    if st.sidebar.button("🔄 Refresh Data"):
        st.cache_data.clear()
        st.rerun()

    @st.cache_data
    def load_data():
        try:
            master = pd.read_excel(MASTER_PROCESSED, sheet_name=None)
            envelope = pd.read_excel(BASELINE_ENVELOPE, sheet_name=None) if os.path.exists(BASELINE_ENVELOPE) else None
            summary_df = pd.read_excel(MASTER_SUMMARY) if os.path.exists(MASTER_SUMMARY) else pd.DataFrame()
            return master, envelope, summary_df
        except: return None, None, None

    master_data, envelope_data, master_summary_df = load_data()
    if not master_data:
        st.error("Error loading data.")
        st.stop()

    all_tests = [t for t in master_data.keys() if t != "Baseline_Envelope"]

    st.sidebar.markdown("### 🎯 Test Selection")
    
    # ==========================================
    # DYNAMIC DATE & BIKE FILTERS
    # ==========================================
    available_dates = sorted(list(set([t[:10] for t in all_tests])), reverse=True)
    selected_dates = st.sidebar.multiselect(
        "📅 Filter by Date:", 
        options=["All Dates"] + available_dates, 
        default=["All Dates"]
    )
    
    def get_bike_no(test_name):
        parts = test_name.split('-')
        return parts[1] if len(parts) > 1 else "Unknown"
        
    available_bikes = sorted(list(set([get_bike_no(t) for t in all_tests if get_bike_no(t) != "Unknown"])))
    selected_bikes = st.sidebar.multiselect(
        "🏍️ Filter by Bike No:", 
        options=["All Bikes"] + available_bikes, 
        default=["All Bikes"]
    )
    
    filtered_tests = all_tests
    if "All Dates" not in selected_dates and len(selected_dates) > 0:
        filtered_tests = [t for t in filtered_tests if t[:10] in selected_dates]
    if "All Bikes" not in selected_bikes and len(selected_bikes) > 0:
        filtered_tests = [t for t in filtered_tests if get_bike_no(t) in selected_bikes]
        
    if not filtered_tests:
        st.sidebar.warning("⚠️ No tests found for the selected filters.")
        st.stop()

    primary_test = st.sidebar.selectbox("⭐ Primary Test", filtered_tests)
    compare_tests = st.sidebar.multiselect("🔄 Compare Tests", [t for t in filtered_tests if t != primary_test])
    channels = st.sidebar.multiselect("📊 Channels", ["IGBT", "Motor", "HighCell", "AFE"], default=["IGBT", "Motor"])

    with st.sidebar.expander("⚙️ Advanced Settings"):
        st.markdown("**📏 Envelope Setup**")
        envelope_mode = st.radio("Method:", ["Statistical (2-Sigma)", "Tolerance (%)"])
        tol_pct = 5
        if envelope_mode == "Tolerance (%)": tol_pct = st.selectbox("Tolerance Range", [5, 10, 15, 20], format_func=lambda x: f"± {x}%")
        
        st.markdown("---")
        st.markdown("**⏱️ Snapshot Setup**")
        duration_option = st.selectbox("Snapshot Duration", ["1 min", "2 min", "3 min"], index=1)
        duration_seconds = {"1 min": 60, "2 min": 120, "3 min": 180}[duration_option]

        st.markdown("---")
        st.markdown("**📊 Graph Scaling**")
        enable_manual_y = st.checkbox("Manual Y-Axis")
        y_min = st.number_input("Y-Min", value=0.0)
        y_max = st.number_input("Y-Max", value=2.0)
        enable_manual_x = st.checkbox("Manual X-Axis")
        x_min = st.number_input("X-Min", value=0.0)
        x_max = st.number_input("X-Max", value=300.0)
        
        theme = st.radio("Theme", ["Dark", "Light"])
        template_style = "plotly_dark" if theme == "Dark" else "plotly_white"

    card_bg, border_color, text_color, sub_text_color = ("#1E1E1E", "#333", "#FFF", "#888") if theme == "Dark" else ("#F0F2F6", "#D1D5DB", "#31333F", "#555")

    dtdt_map = {"IGBT": "IGBT_dTdt", "Motor": "Motor_dTdt", "HighCell": "HighCell_dTdt", "AFE": "AFE_Mean_dTdt"}
    deltat_map = {"IGBT": "IGBT_dT", "Motor": "Motor_dT", "HighCell": "HighCell_dT", "AFE": "AFE_Mean_dT"}
    limit_map = {"IGBT": 95, "Motor": 125, "HighCell": 50, "AFE": 50}
    df_primary = master_data[primary_test]

    # ==========================================================
    # HEADER SECTION (Logo & Title)
    # ==========================================================
    col_logo, col_title = st.columns([1.5, 8.5])
    
    with col_logo:
        st.markdown("<div style='margin-top: 15px;'></div>", unsafe_allow_html=True)
        if os.path.exists(LOGO_PATH): st.image(LOGO_PATH, width=180)
        
    with col_title:
        st.markdown(f"<h1 style='margin-top: -20px; padding-bottom: 0px;'>VCH - Dyno - Based Thermal Monitor</h1>", unsafe_allow_html=True)
        st.markdown(f"**Target:** `{primary_test}`")

    # ==========================================================
    # PUBLIC VIEWER HELP SECTION
    # ==========================================================
    with st.expander("📖 Welcome! Click here for the Quick Start Guide & Toolbar Help"):
        st.markdown("""
        **Welcome to the VCH Thermal Suite V4**
        This dashboard is a strict Quality Control (QC) gatekeeper designed to evaluate Dyno Thermal Telemetry against a mathematically calculated Golden Standard.
        
        ### 🛠️ Navigation & Toolbar Guide
        * **Sidebar Controls:** Use the left sidebar to select your **Primary Test** (the bike you are actively evaluating). You can also select **Compare Tests** to overlay multiple runs on the graphs, and isolate specific **Channels** (IGBT, Motor, etc.).
        * **Top Summary Cards:** These cards display the *Absolute Raw Maximums* from the high-resolution telemetry before any mathematical smoothing is applied. If a component derates early, it will trigger a red warning here.
        * **Rise Rate (dT/dt) & Cumulative Rise (ΔT) Tabs:** These tabs visualize the thermodynamic curves. The dashed cyan boundaries represent the dynamically generated **Golden Envelope** (the acceptable threshold derived from baseline bikes).
        * **🔋 Power Analysis Tab:** Validates whether the evaluation bike maintained the required electrical load (kW) during the test.
        * **📋 Test Repository (QC Gatekeeper):** The final evaluation matrix. It enforces strict, hierarchical validation rules to definitively grade a bike as **PASS** or **FAIL**. Use the dropdowns in this tab to dynamically isolate specific thermal variables.
        """)

    test_date = primary_test[:10]
    total_duration = int(df_primary["Time (s)"].max())
    avg_power = f"{df_primary['Electrical Power (kW)'].max():.2f} kW (Max)" if "Electrical Power (kW)" in df_primary.columns else "Data Not Found"

    st.markdown(f"""
    <div style="background-color: {card_bg}; border: 1px solid {border_color}; border-radius: 6px; padding: 10px 20px; margin-top: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 1px 1px 4px rgba(0,0,0,0.2);">
        <div style="text-align: center;"><div style="color: {sub_text_color}; font-size: 11px; text-transform: uppercase;">Test Date</div><div style="color: {text_color}; font-weight: bold; font-size: 14px;">📅 {test_date}</div></div>
        <div style="border-left: 1px solid {border_color}; height: 30px;"></div>
        <div style="text-align: center;"><div style="color: {sub_text_color}; font-size: 11px; text-transform: uppercase;">Test Type</div><div style="color: {text_color}; font-weight: bold; font-size: 14px;">🏍️ Dyno 4min Thermal</div></div>
        <div style="border-left: 1px solid {border_color}; height: 30px;"></div>
        <div style="text-align: center;"><div style="color: {sub_text_color}; font-size: 11px; text-transform: uppercase;">Dyno Set Speed</div><div style="color: {text_color}; font-weight: bold; font-size: 14px;">🏁 60 kmph</div></div>
        <div style="border-left: 1px solid {border_color}; height: 30px;"></div>
        <div style="text-align: center;"><div style="color: {sub_text_color}; font-size: 11px; text-transform: uppercase;">Electrical Power</div><div style="color: {text_color}; font-weight: bold; font-size: 14px;">⚡ {avg_power}</div></div>
        <div style="border-left: 1px solid {border_color}; height: 30px;"></div>
        <div style="text-align: center;"><div style="color: {sub_text_color}; font-size: 11px; text-transform: uppercase;">Total Duration</div><div style="color: {text_color}; font-weight: bold; font-size: 14px;">⏱️ {total_duration} s</div></div>
    </div>
    """, unsafe_allow_html=True)

    # ==========================================================
    # RAW DATA TOP SUMMARY CARDS
    # ==========================================================
    cols = st.columns(4)
    first_deration_comp, first_deration_time = None, None
    first_deration_cell_str = ""

    summary_row = master_summary_df[master_summary_df["Test_Name"] == primary_test]
    if not summary_row.empty:
        summary_row = summary_row.iloc[0]
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
                if pd.notna(cell_num) and cell_num > 0:
                    extra_info = f" | Cell: <b>#{int(cell_num)}</b>"

            is_breach = str(deration_val) != "SAFE"
            
            if is_breach:
                status_text, card_style, val_color, duration_str = "⚠️ BREACH", "metric-card highlight-red", "#FF4B4B", f"Derated @ <b>{deration_val}s</b>"
                deration_time_float = float(deration_val)
                if first_deration_time is None or deration_time_float < first_deration_time:
                    first_deration_time, first_deration_comp = deration_time_float, ch
                    first_deration_cell_str = f" **(Caused by Cell #{int(cell_num)})**" if ch == "HighCell" and pd.notna(cell_num) and cell_num > 0 else ""
            else:
                status_text, card_style, val_color, duration_str = "✅ SAFE", "metric-card highlight-green", "#00CC96", "0s"

            if ch == dominant_channel:
                card_style += " highlight-gold"
                status_text += " | 🔥 DOMINANT"

            with cols[i]:
                st.markdown(f"""
                <div class="{card_style}">
                    <div class="metric-title">{ch} Raw Max Temp</div>
                    <div class="metric-value" style="color:{val_color}">{max_val} °C</div>
                    <div class="metric-sub">Peak @ {t_max}s {extra_info}</div>
                    <div class="metric-sub" style="border-top:1px solid #444; margin-top:8px; padding-top:5px;">
                        Limit: {limit}°C | {status_text} <br> {duration_str}
                    </div>
                </div>
                """, unsafe_allow_html=True)

        if first_deration_comp:
            st.error(f"⚠️ **First Deration Detected:** {first_deration_comp} crossed safety limit at **{first_deration_time} s**{first_deration_cell_str}")
    else:
        st.warning("⚠️ No Raw Summary Data found. Please clear cache and re-run Processing Cycle.")

    st.markdown("---")

    # ==========================================================
    # TABBED INTERFACE
    # ==========================================================
    tab_dtdt, tab_delta, tab_custom, tab_power, tab_repo = st.tabs(["⚡ Rise Rate (dT/dt)", "📈 Cumulative Rise (ΔT)", "🛠️ Custom Plot", "🔋 Power Analysis", "📋 Test Repository"])

    with tab_dtdt:
        st.markdown(f"### ⚡ Rise Rate Snapshot @ {duration_option}")
        snap_row = df_primary[df_primary["Time (s)"] == duration_seconds]
        if not snap_row.empty:
            metric_cols = st.columns(len(channels))
            for i, ch in enumerate(channels):
                val = snap_row[dtdt_map[ch]].values[0]
                metric_cols[i].metric(label=f"🎯 {ch} Value @ {duration_seconds}s", value=f"{val:.3f} °C/s")
        st.markdown("---")
        
        plot_cols = st.columns(2)
        for i, ch in enumerate(channels):
            col_name = dtdt_map[ch]
            with plot_cols[i % 2]:
                fig = go.Figure()
                export_df = pd.DataFrame({"Time (s)": df_primary["Time (s)"], f"{primary_test}": df_primary[col_name]})
                if envelope_data and ch in envelope_data:
                    env = envelope_data[ch]
                    mean_col = "dTdt_Mean"
                    upper_col, lower_col, env_label = (f"dTdt_Upper_2Sigma", f"dTdt_Lower_2Sigma", "2-Sigma") if envelope_mode == "Statistical (2-Sigma)" else (f"dTdt_Upper_{tol_pct}Pct", f"dTdt_Lower_{tol_pct}Pct", f"±{tol_pct}%")
                    if mean_col in env.columns:
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[mean_col], name="Mean", line=dict(color="white" if theme=="Dark" else "black", width=2, dash="dash")))
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[upper_col], name=f"Upper ({env_label})", line=dict(color="cyan", width=1, dash="dot")))
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[lower_col], name=f"Lower ({env_label})", line=dict(color="cyan", width=1, dash="dot"), fill='tonexty', fillcolor='rgba(0,255,255,0.1)'))
                        export_df = pd.merge(export_df, env[["Time (s)", mean_col, upper_col, lower_col]].rename(columns={mean_col: "Env_Mean", upper_col: "Env_Upper", lower_col: "Env_Lower"}), on="Time (s)", how="left")
                fig.add_trace(go.Scatter(x=df_primary["Time (s)"], y=df_primary[col_name], name=f"{primary_test}", line=dict(color="#B2FF59", width=3)))
                for test in compare_tests:
                    fig.add_trace(go.Scatter(x=master_data[test]["Time (s)"], y=master_data[test][col_name], name=test, line=dict(width=1), opacity=0.7))
                    export_df[test] = master_data[test][col_name]
                fig.update_layout(title=f"{ch} Rise Rate", xaxis_title="Time (s)", yaxis_title="°C/s", height=400, hovermode="x unified", template=template_style)
                if enable_manual_y: fig.update_yaxes(range=[y_min, y_max])
                if enable_manual_x: fig.update_xaxes(range=[x_min, x_max])
                st.plotly_chart(fig, use_container_width=True)
                st.download_button(label=f"📥 Export {ch} dT/dt", data=convert_df_to_excel(export_df), file_name=f"{ch}_RiseRate.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", key=f"dl_dtdt_{ch}")

    with tab_delta:
        st.markdown(f"### 📈 Cumulative Rise Snapshot @ {duration_option}")
        snap_row = df_primary[df_primary["Time (s)"] == duration_seconds]
        if not snap_row.empty:
            metric_cols = st.columns(len(channels))
            for i, ch in enumerate(channels):
                val = snap_row[deltat_map[ch]].values[0]
                metric_cols[i].metric(label=f"🎯 {ch} Rise @ {duration_seconds}s", value=f"{val:.2f} °C")
        st.markdown("---")
        
        plot_cols = st.columns(2)
        for i, ch in enumerate(channels):
            col_name = deltat_map[ch]
            with plot_cols[i % 2]:
                fig = go.Figure()
                export_df = pd.DataFrame({"Time (s)": df_primary["Time (s)"], f"{primary_test}": df_primary[col_name]})
                if envelope_data and ch in envelope_data:
                    env = envelope_data[ch]
                    mean_col = "dT_Mean"
                    upper_col, lower_col, env_label = (f"dT_Upper_2Sigma", f"dT_Lower_2Sigma", "2-Sigma") if envelope_mode == "Statistical (2-Sigma)" else (f"dT_Upper_{tol_pct}Pct", f"dT_Lower_{tol_pct}Pct", f"±{tol_pct}%")
                    if mean_col in env.columns:
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[mean_col], name="Mean", line=dict(color="white" if theme=="Dark" else "black", width=2, dash="dash")))
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[upper_col], name=f"Upper ({env_label})", line=dict(color="cyan", width=1, dash="dot")))
                        fig.add_trace(go.Scatter(x=env["Time (s)"], y=env[lower_col], name=f"Lower ({env_label})", line=dict(color="cyan", width=1, dash="dot"), fill='tonexty', fillcolor='rgba(0,255,255,0.1)'))
                        export_df = pd.merge(export_df, env[["Time (s)", mean_col, upper_col, lower_col]].rename(columns={mean_col: "Env_Mean", upper_col: "Env_Upper", lower_col: "Env_Lower"}), on="Time (s)", how="left")
                fig.add_trace(go.Scatter(x=df_primary["Time (s)"], y=df_primary[col_name], name=f"{primary_test}", line=dict(color="#FF4081", width=3)))
                for test in compare_tests:
                    fig.add_trace(go.Scatter(x=master_data[test]["Time (s)"], y=master_data[test][col_name], name=test, line=dict(width=1), opacity=0.7))
                    export_df[test] = master_data[test][col_name]
                fig.update_layout(title=f"{ch} Cumulative Rise", xaxis_title="Time (s)", yaxis_title="ΔT (°C)", height=400, hovermode="x unified", template=template_style)
                if enable_manual_y: fig.update_yaxes(range=[y_min, y_max])
                if enable_manual_x: fig.update_xaxes(range=[x_min, x_max])
                st.plotly_chart(fig, use_container_width=True)
                st.download_button(label=f"📥 Export {ch} ΔT", data=convert_df_to_excel(export_df), file_name=f"{ch}_Cumulative.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", key=f"dl_dT_{ch}")

    with tab_custom:
        st.markdown("### 🛠️ Custom Telemetry Plotter (Multi-Bike Overlay)")
        st.write("Compare the Primary Test against any selected Compare Tests across dynamic mechanical/electrical channels.")
        
        if 'df_primary' in locals() and not df_primary.empty:
            available_columns = df_primary.columns.tolist()
            default_x = "Time (s)" if "Time (s)" in available_columns else available_columns[0]
            
            default_y = []
            search_keywords = ["power", "rpm", "torque", "voltage", "volatge", "current", "highest_temp", "lowt_cellno", "lowest_temp", "cumm_volatge"]
            
            for kw in search_keywords:
                for col in available_columns:
                    if kw.lower() in col.lower() and col not in default_y:
                        default_y.append(col)
                        break
            
            if not default_y and len(available_columns) > 1:
                default_y = [available_columns[1]]

            col_x, col_y = st.columns([1, 3])
            with col_x: x_axis = st.selectbox("⚙️ X-Axis", available_columns, index=available_columns.index(default_x))
            with col_y: y_axes = st.multiselect("📊 Y-Axis (Select multiple channels)", available_columns, default=default_y)

            if y_axes:
                fig_custom = go.Figure()
                colors = px.colors.qualitative.Plotly

                for i, y_axis in enumerate(y_axes):
                    c = colors[i % len(colors)]
                    fig_custom.add_trace(go.Scatter(
                        x=df_primary[x_axis], y=df_primary[y_axis], 
                        mode='lines+markers', name=f"⭐ {primary_test} [{y_axis}]", 
                        line=dict(width=3, color=c)
                    ))

                for test in compare_tests:
                    if test in master_data:
                        test_df = master_data[test]
                        for i, y_axis in enumerate(y_axes):
                            if y_axis in test_df.columns and x_axis in test_df.columns:
                                c = colors[i % len(colors)]
                                fig_custom.add_trace(go.Scatter(
                                    x=test_df[x_axis], y=test_df[y_axis], 
                                    mode='lines', name=f"🔄 {test} [{y_axis}]", 
                                    line=dict(width=1.5, dash='dot', color=c), opacity=0.7
                                ))

                fig_custom.update_layout(
                    plot_bgcolor='rgba(0,0,0,0)', 
                    paper_bgcolor='rgba(0,0,0,0)', 
                    font=dict(color=text_color), 
                    hovermode="x unified", 
                    margin=dict(l=40, r=40, t=40, b=40),
                    template=template_style,
                    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
                )
                fig_custom.update_yaxes(showgrid=True, gridwidth=1, gridcolor=border_color)
                fig_custom.update_xaxes(title=x_axis, showgrid=True, gridwidth=1, gridcolor=border_color)

                if enable_manual_y: fig_custom.update_yaxes(range=[y_min, y_max])
                if enable_manual_x: fig_custom.update_xaxes(range=[x_min, x_max])

                st.plotly_chart(fig_custom, use_container_width=True)
                
                st.markdown("---")
                
                export_df = df_primary[[x_axis] + y_axes].copy()
                export_df.rename(columns={col: f"Target_{col}" for col in y_axes}, inplace=True)
                
                for test in compare_tests:
                    if test in master_data:
                        test_df = master_data[test]
                        for y_axis in y_axes:
                            if y_axis in test_df.columns:
                                export_df[f"{test}_{y_axis}"] = test_df[y_axis]
                                
                st.download_button(label="📥 Export Custom Overlay Data", data=convert_df_to_excel(export_df), file_name=f"{primary_test}_MultiBike_Custom.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", key="dl_custom_plot")
            else: 
                st.info("👆 Please select at least one Y-Axis parameter.")

    with tab_power:
        st.markdown(f"### 🔋 Electrical Power Analysis @ {duration_option}")
        st.write(f"Visualizing the dynamic load maintained from 0s to {duration_seconds}s to validate test integrity.")
        
        golden_powers_tab = []
        for test_name, df_iter in master_data.items():
            if test_name == "Baseline_Envelope": continue
            if any(gold in test_name for gold in thermal_engine.GOLDEN_BIKES):
                df_cut = df_iter[df_iter["Time (s)"] <= duration_seconds]
                if "Electrical Power (kW)" in df_cut.columns:
                    avg_pwr = df_cut["Electrical Power (kW)"].mean()
                    if 19 <= avg_pwr <= 20.5: 
                        golden_powers_tab.append(avg_pwr)
        
        master_golden_power_tab = sum(golden_powers_tab)/len(golden_powers_tab) if golden_powers_tab else 19.5
        pwr_upper_tab, pwr_lower_tab = master_golden_power_tab * 1.10, master_golden_power_tab * 0.90
        
        col_p1, col_p2, col_p3 = st.columns(3)
        col_p1.metric("👑 Golden Mean Power", f"{master_golden_power_tab:.2f} kW")
        col_p2.metric("🔼 Upper Boundary (+10%)", f"{pwr_upper_tab:.2f} kW")
        col_p3.metric("🔽 Lower Boundary (-10%)", f"{pwr_lower_tab:.2f} kW")
        
        power_records = []
        for test_name, df_iter in master_data.items():
            if test_name == "Baseline_Envelope": continue
            df_cut = df_iter[df_iter["Time (s)"] <= duration_seconds]
            bike_power = df_cut["Electrical Power (kW)"].mean() if "Electrical Power (kW)" in df_cut.columns else 0
            
            status = "✅ PASS" if pwr_lower_tab <= bike_power <= pwr_upper_tab else "❌ FAIL"
            is_golden_str = "⭐ Golden" if any(gold in test_name for gold in thermal_engine.GOLDEN_BIKES) else "Evaluation"
            
            power_records.append({
                "Test Name": test_name,
                "Type": is_golden_str,
                "Avg Power (kW)": round(bike_power, 2),
                "Status": status
            })
            
        power_df = pd.DataFrame(power_records)
        
        if not power_df.empty:
            color_map = {"✅ PASS": "#00CC96", "❌ FAIL": "#FF4B4B"}
            fig_pwr = px.bar(power_df, x="Test Name", y="Avg Power (kW)", color="Status", color_discrete_map=color_map, text="Avg Power (kW)")
            fig_pwr.add_hline(y=pwr_upper_tab, line_dash="dash", line_color="cyan", annotation_text="Upper Limit")
            fig_pwr.add_hline(y=pwr_lower_tab, line_dash="dash", line_color="cyan", annotation_text="Lower Limit")
            fig_pwr.add_hline(y=master_golden_power_tab, line_color="gold", annotation_text="Golden Mean")
            fig_pwr.update_layout(template=template_style, xaxis_title="Bike ID", yaxis_title="Mean Power (kW)", height=400, hovermode="x unified")
            fig_pwr.update_traces(textposition='auto')
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

    # ==========================================================
    # 🎯 TEST REPOSITORY GATEKEEPER
    # ==========================================================
    with tab_repo:
        st.markdown("### 📂 Quality Control (QC) Gatekeeper")
        st.write("Dynamic Pass/Fail Evaluation based on thermal envelope, cumulative rise, early derations, and active power constraints.")
        
        col_f1, col_f2, col_f3, col_f4, col_f5 = st.columns(5)
        with col_f1:
            repo_time = st.selectbox("⏳ QC Timestamp", ["1 min (60s)", "2 min (120s)", "3 min (180s)"], index=1, key="repo_time")
            repo_time_s = {"1 min (60s)": 60, "2 min (120s)": 120, "3 min (180s)": 180}[repo_time]
        with col_f2:
            repo_env = st.selectbox("📏 Env Method", ["Tolerance (%)", "Statistical (2-Sigma)"], key="repo_env")
        with col_f3:
            repo_tol = 20
            if repo_env == "Tolerance (%)": 
                repo_tol = st.selectbox("Tolerance Range", [5, 10, 15, 20], index=3, format_func=lambda x: f"± {x}%", key="repo_tol")
        with col_f4:
            repo_target = st.selectbox("🎯 Target Data", ["All Data", "IGBT", "Motor", "HighCell", "AFE", "Electrical Power"], key="repo_target")
        with col_f5:
            repo_metric = st.selectbox("📉 Assessment", ["All Assessments", "dT/dt", "dT", "Power Based"], key="repo_metric")

        try:
            # ==========================================
            # 🚨 NEW: MASTER GOLDEN CRITERIA UI
            # ==========================================
            
            # 1. Calculate the dynamic Power Limits First
            golden_powers = []
            for test_name, df in master_data.items():
                if test_name == "Baseline_Envelope": continue
                if any(gold in test_name for gold in thermal_engine.GOLDEN_BIKES):
                    df_cut = df[df["Time (s)"] <= repo_time_s]
                    if "Electrical Power (kW)" in df_cut.columns:
                        avg_pwr = df_cut["Electrical Power (kW)"].mean()
                        if 19 <= avg_pwr <= 20.5: 
                            golden_powers.append(avg_pwr)
            
            master_golden_power = sum(golden_powers)/len(golden_powers) if golden_powers else 19.5
            pwr_upper, pwr_lower = master_golden_power * 1.10, master_golden_power * 0.90
            
            # 2. Render the Golden Rulebook
            st.markdown(f"### Master Golden Criteria @ {repo_time}")
            st.write(f"Strict Pass/Fail limits for the selected snapshot. Format: **[ Upper Limit &nbsp;|&nbsp; Mean &nbsp;|&nbsp; Lower Limit ]**")
            
            st.markdown(f"""
            <div style="background-color: #1E1E1E; border-left: 4px solid gold; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 2px 2px 5px rgba(0,0,0,0.5);">
                <div style="color: #888; font-size: 14px; margin-bottom: 5px;">⚡ Electrical Power Validation (0s to {repo_time_s}s)</div>
                <div style="color: cyan; font-size: 20px; font-weight: bold;">{pwr_upper:.2f} kW <span style='color:#FFF'>&nbsp;|&nbsp; {master_golden_power:.2f} kW &nbsp;|&nbsp;</span> {pwr_lower:.2f} kW</div>
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
                            # Rise Rate Panel
                            mean_dtdt = env_row["dTdt_Mean"].values[0]
                            up_dtdt = env_row[f"dTdt_Upper_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dTdt_Upper_2Sigma"].values[0]
                            low_dtdt = env_row[f"dTdt_Lower_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dTdt_Lower_2Sigma"].values[0]
                            
                            cols_dtdt[i].markdown(f"""
                            <div style="background-color: #1E1E1E; border: 1px solid #333; border-radius: 8px; padding: 10px; text-align: center; margin-bottom: 10px;">
                                <div style="color: #888; font-size: 12px; margin-bottom: 5px;">{ch} Rise Rate (°C/s)</div>
                                <div style="color: cyan; font-size: 16px; font-weight: bold;">{up_dtdt:.3f} | <span style='color:#FFF'>{mean_dtdt:.3f}</span> | {low_dtdt:.3f}</div>
                            </div>
                            """, unsafe_allow_html=True)

                            # Cumulative Rise Panel
                            mean_dt = env_row["dT_Mean"].values[0]
                            up_dt = env_row[f"dT_Upper_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dT_Upper_2Sigma"].values[0]
                            low_dt = env_row[f"dT_Lower_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dT_Lower_2Sigma"].values[0]
                            
                            cols_dt[i].markdown(f"""
                            <div style="background-color: #1E1E1E; border: 1px solid #333; border-radius: 8px; padding: 10px; text-align: center; margin-bottom: 10px;">
                                <div style="color: #888; font-size: 12px; margin-bottom: 5px;">{ch} Cumulative Rise (°C)</div>
                                <div style="color: #FF4081; font-size: 16px; font-weight: bold;">{up_dt:.2f} | <span style='color:#FFF'>{mean_dt:.2f}</span> | {low_dt:.2f}</div>
                            </div>
                            """, unsafe_allow_html=True)
            st.markdown("---")

            # 3. Process the Pass/Fail Logic Table
            repo_results = []
            for test_name, df in master_data.items():
                if test_name == "Baseline_Envelope": continue
                
                sum_row = master_summary_df[master_summary_df["Test_Name"] == test_name].iloc[0] if not master_summary_df[master_summary_df["Test_Name"] == test_name].empty else None
                bike_type = sum_row["Type"] if sum_row is not None else "Unknown"
                
                t0_row = df[df["Time (s)"] == 0]
                t_eval_row = df[df["Time (s)"] == repo_time_s]
                
                if t_eval_row.empty or t0_row.empty: continue
                
                df_cut = df[df["Time (s)"] <= repo_time_s]
                bike_power = df_cut["Electrical Power (kW)"].mean() if "Electrical Power (kW)" in df_cut.columns else 0
                
                row = {
                    "Test Name": test_name,
                    "Type": bike_type,
                    "IGBT Start Temp": round(t0_row["IGBT Temp (oC)"].values[0], 2) if "IGBT Temp (oC)" in t0_row else "NA",
                    "Motor Start Temp": round(t0_row["Motor_Temp (oC)"].values[0], 2) if "Motor_Temp (oC)" in t0_row else "NA",
                    "High Cell Start Temp": round(t0_row["highest_temp (oC)"].values[0], 2) if "highest_temp (oC)" in t0_row else "NA",
                    "Afe Start Temp": round(t0_row["AFE_Mean_Temp"].values[0], 2) if "AFE_Mean_Temp" in t0_row else "NA",
                }
                
                failed_dt = []
                failed_dtdt = []

                for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
                    val_dtdt = t_eval_row[dtdt_map[ch]].values[0]
                    val_dt = t_eval_row[deltat_map[ch]].values[0]
                    
                    row[f"{ch} dTdt"] = round(val_dtdt, 3)
                    row[f"{ch} dT"] = round(val_dt, 2)
                    
                    if repo_target not in ["All Data", ch]: continue
                    if repo_metric == "Power Based": continue

                    if envelope_data and ch in envelope_data:
                        env_row = envelope_data[ch][envelope_data[ch]["Time (s)"] == repo_time_s]
                        if not env_row.empty:
                            up_dtdt = env_row[f"dTdt_Upper_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dTdt_Upper_2Sigma"].values[0]
                            low_dtdt = env_row[f"dTdt_Lower_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dTdt_Lower_2Sigma"].values[0]
                            up_dt = env_row[f"dT_Upper_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dT_Upper_2Sigma"].values[0]
                            low_dt = env_row[f"dT_Lower_{repo_tol}Pct"].values[0] if repo_env == "Tolerance (%)" else env_row["dT_Lower_2Sigma"].values[0]
                            
                            if repo_metric in ["All Assessments", "dT/dt"]:
                                if not (low_dtdt * 0.98 <= val_dtdt <= up_dtdt): failed_dtdt.append(ch)
                            if repo_metric in ["All Assessments", "dT"]:
                                if not (low_dt * 0.98 <= val_dt <= up_dt): failed_dt.append(ch)

                row["Power Rating (kW)"] = round(bike_power, 2)

                derated_early = False
                if sum_row is not None and repo_metric != "Power Based":
                    for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
                        if repo_target in ["All Data", ch]:
                            if sum_row.get(f"{ch}_Deration_Time", "SAFE") != "SAFE" and float(sum_row.get(f"{ch}_Deration_Time")) < repo_time_s:
                                derated_early = True
                                break

                power_passed = True
                if repo_target in ["All Data", "Electrical Power"] and repo_metric in ["All Assessments", "Power Based"]:
                    if not (pwr_lower <= bike_power <= pwr_upper): 
                        power_passed = False

                if derated_early: row["Final Conclusion"] = "FAIL (Early Deration)"
                elif len(failed_dt) > 0: row["Final Conclusion"] = f"FAIL (Cumm Temp: {', '.join(failed_dt)})"
                elif len(failed_dtdt) > 0: row["Final Conclusion"] = f"FAIL (Rise Rate: {', '.join(failed_dtdt)})"
                elif not power_passed: row["Final Conclusion"] = f"FAIL (Power Dev: {bike_power:.1f}kW)"
                else: row["Final Conclusion"] = "PASS"

                if bike_type == "Golden Baseline": row["Final Conclusion"] = "PASS (Golden Base)"
                
                repo_results.append(row)
                
            final_repo_df = pd.DataFrame(repo_results)
            
            cols_order = ["Test Name", "Type"]
            active_channels = ["IGBT", "Motor", "HighCell", "AFE"]
            if repo_target in active_channels: active_channels = [repo_target]
            elif repo_target == "Electrical Power": active_channels = []

            if repo_metric != "Power Based":
                for ch in active_channels:
                    if ch == "HighCell": cols_order.append("High Cell Start Temp")
                    elif ch == "AFE": cols_order.append("Afe Start Temp")
                    else: cols_order.append(f"{ch} Start Temp")
                    if repo_metric in ["All Assessments", "dT/dt"]: cols_order.append(f"{ch} dTdt")
                    if repo_metric in ["All Assessments", "dT"]: cols_order.append(f"{ch} dT")

            if repo_target in ["All Data", "Electrical Power"] or repo_metric == "Power Based":
                cols_order.append("Power Rating (kW)")

            cols_order.append("Final Conclusion")
            final_repo_df = final_repo_df[[c for c in cols_order if c in final_repo_df.columns]]
            
            st.markdown("---")
            all_bike_names = final_repo_df["Test Name"].tolist()
            selected_repo_bikes = st.multiselect(
                "🏍️ Filter Table by Bike ID:", 
                options=["All Bikes"] + all_bike_names, 
                default=["All Bikes"],
                key="repo_bike_filter"
            )
            
            # Filter logic
            if "All Bikes" not in selected_repo_bikes and len(selected_repo_bikes) > 0:
                display_df = final_repo_df[final_repo_df["Test Name"].isin(selected_repo_bikes)]
            else:
                display_df = final_repo_df
            
            def color_cells(val):
                if 'PASS' in str(val): return 'background-color: rgba(0, 204, 150, 0.2); color: #00CC96; font-weight: bold;'
                elif 'FAIL' in str(val): return 'background-color: rgba(255, 75, 75, 0.2); color: #FF4B4B; font-weight: bold;'
                return ''
                
            styled_df = display_df.style.map(color_cells, subset=['Final Conclusion'])
            st.dataframe(styled_df, use_container_width=True, hide_index=True)

            st.info("""
            📝 **NOTE: Automated Pass/Fail Criteria Evaluation Rules**
            
            The final conclusion is hierarchically evaluated based on the following strict criteria:
            1. **Early Deration (Absolute Fail):** The bike must survive until the evaluated timestamp (e.g., 2 mins) with ZERO thermal derations. If any component exceeds safety limits before this time, it fails instantly.
            2. **Cumulative Temp Limit (ΔT):** The component's soaked heat must remain within the dynamically selected envelope limit. A **2% tolerance** is mathematically permitted below the lower bound.
            3. **Rise Rate Limit (dT/dt):** If the cumulative temp is safe, the heating slope is checked. It must not exceed the dynamically selected upper envelope boundary.
            4. **Electrical Power Delivery:** If the thermals are safe, the tool verifies the dyno load. The bike must maintain an average power delivery within **± 10%** of the Master Golden Power (which is dynamically calculated from Golden bikes maintaining a 19-20kW load).
            """)

            st.markdown("---")
            st.download_button(label=f"📥 Export QC Report ({repo_time_s}s)", data=convert_df_to_excel(final_repo_df), file_name=f"VCH_QC_Report_{repo_time_s}s.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", key="dl_repo_report")

        except Exception as e:
            st.error(f"🚨 Error building QC repository: {e}")

        # ==========================================================
        # 📄 AUTO-WORD REPORT GENERATOR (INTEGRATION)
        # ==========================================================
        st.markdown("---")
        st.markdown("### 📄 Auto-Generate Executive Word Report")
        st.write(f"Instantly generate a fully formatted, math-backed Word document for **{primary_test}** based on the {repo_time_s}s snapshot.")

        if os.path.exists(TEMPLATE_PATH):
            try:
                # 1. Grab Primary Test Data
                sum_row_pri = master_summary_df[master_summary_df["Test_Name"] == primary_test].iloc[0]
                t_eval_row_pri = df_primary[df_primary["Time (s)"] == repo_time_s]
                
                df_cut_pri = df_primary[df_primary["Time (s)"] <= repo_time_s]
                bike_power_pri = df_cut_pri["Electrical Power (kW)"].mean() if "Electrical Power (kW)" in df_cut_pri.columns else 0

                parts = primary_test.split('-')
                test_date_val = parts[0] if len(parts) > 0 else "Unknown"
                bike_no_val = parts[1] if len(parts) > 1 else "Unknown"
                
                # Get final conclusion from the repo table we just built
                final_conc = final_repo_df[final_repo_df["Test Name"] == primary_test]["Final Conclusion"].values[0] if not final_repo_df[final_repo_df["Test Name"] == primary_test].empty else "Unknown"

                ctx = {
                    "test_id": primary_test, "test_date": test_date_val, "bike_no": bike_no_val,
                    "total_duration": int(df_primary["Time (s)"].max()), "snapshot_time": repo_time_s,
                    "env_tol": f"± {repo_tol}%" if repo_env == "Tolerance (%)" else "2-Sigma",
                    "golden_power": f"{master_golden_power:.2f}",
                    "pwr_lower": f"{pwr_lower:.2f}", "pwr_upper": f"{pwr_upper:.2f}",
                    "bike_power": f"{bike_power_pri:.2f}",
                    "power_status": "✅ PASS" if (pwr_lower <= bike_power_pri <= pwr_upper) else "❌ FAIL",
                    "final_conclusion": final_conc
                }

                first_deration_time = None
                first_deration_comp = None

                # 2. Extract Channel Data
                for ch in ["IGBT", "Motor", "HighCell", "AFE"]:
                    ch_low = ch.lower()
                    # Raw Data
                    ctx[f"{ch_low}_raw"] = sum_row_pri.get(f"{ch}_Raw_Max", "NA")
                    ctx[f"{ch_low}_peak_time"] = sum_row_pri.get(f"{ch}_Peak_Time", "NA")
                    deration = sum_row_pri.get(f"{ch}_Deration_Time", "SAFE")
                    ctx[f"{ch_low}_deration"] = deration
                    
                    status = "✅ PASS"
                    if str(deration) != "SAFE":
                        status = "❌ FAIL"
                        d_time = float(deration)
                        if first_deration_time is None or d_time < first_deration_time:
                            first_deration_time, first_deration_comp = d_time, ch
                    ctx[f"{ch_low}_status"] = status
                    
                    if ch == "HighCell":
                        cell_num = sum_row_pri.get("HighCell_Peak_Cell_No", "")
                        ctx["highcell_cell"] = f"(Cell #{int(cell_num)})" if pd.notna(cell_num) else ""

                    # Snapshot Data
                    val_dtdt = t_eval_row_pri[dtdt_map[ch]].values[0] if not t_eval_row_pri.empty else 0
                    val_dt = t_eval_row_pri[deltat_map[ch]].values[0] if not t_eval_row_pri.empty else 0
                    ctx[f"{ch_low}_dtdt"] = f"{val_dtdt:.3f}"
                    ctx[f"{ch_low}_dt"] = f"{val_dt:.2f}"
                    
                    # Envelope Assessment
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

                # First Deration Logic
                ctx["first_deration_text"] = "None"
                if first_deration_comp and first_deration_time < repo_time_s:
                    ctx["first_deration_text"] = f"{first_deration_comp} at {first_deration_time}s"

                # 3. Generate Word Doc in Memory
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
            st.warning("⚠️ Cannot generate report: `VCH_Report_Template.docx` is missing from the main folder. Please add the template file.")