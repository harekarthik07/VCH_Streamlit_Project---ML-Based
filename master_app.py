import streamlit as st
import os
import time
import auth_utils

# 1. SETUP MASTER CONFIG
st.set_page_config(
    page_title="Raptee Thermal Suite",   # <--- CHANGE THIS LINE
    page_icon="⚡", 
    layout="wide",
    initial_sidebar_state="expanded"
)

# 2. 🌟 MASS UI/UX OVERHAUL (GLOBAL CSS) 🌟
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;900&display=swap');

    html, body, [class*="css"] {
        font-family: 'Outfit', sans-serif !important;
    }

    /* Hide Streamlit Chrome for true web app feel */
    footer {visibility: hidden;}
    .stDeployButton {display:none;}

    /* =========================================
       1. STREAMLIT NATIVE SIDEBAR OVERHAUL
       ========================================= */
    
    /* Hide the default blank space at the top */
    [data-testid="stSidebarNav"] {
        padding-top: 1.5rem;
    }
    
    /* Inject a Custom Title above the navigation links */
    [data-testid="stSidebarNav"]::before {
        content: "⚡ VCH SYSTEMS";
        color: #00cc96;
        font-weight: 900;
        font-size: 1.1rem;
        letter-spacing: 2px;
        padding-left: 20px;
        margin-bottom: 20px;
        display: block;
    }

    /* Target all links in the sidebar */
    [data-testid="stSidebarNav"] a {
        text-transform: uppercase !important; /* FORCES CAPITALIZATION */
        font-weight: 700 !important;
        font-size: 0.85rem !important;
        letter-spacing: 1.5px !important;
        padding: 12px 15px !important;
        border-radius: 6px !important;
        margin: 0px 15px 8px 15px !important;
        transition: all 0.3s ease-in-out !important;
        color: #777777 !important;
    }

    /* Hover effect: Light up and slide right */
    [data-testid="stSidebarNav"] a:hover {
        background-color: rgba(255, 255, 255, 0.05) !important;
        color: #FFFFFF !important;
        transform: translateX(6px) !important;
    }

    /* 🔥 THE ACTIVE SELECTED PAGE 🔥 */
    [data-testid="stSidebarNav"] a[aria-current="page"] {
        background-color: rgba(0, 204, 150, 0.1) !important;
        color: #00cc96 !important;
        border-left: 4px solid #00cc96 !important;
    }

    /* 🟢 THE GLOWING ROUND INDICATOR 🟢 */
    [data-testid="stSidebarNav"] a[aria-current="page"]::before {
        content: "●";
        color: #00cc96;
        text-shadow: 0 0 8px #00cc96, 0 0 15px #00cc96;
        margin-right: 12px;
        font-size: 1.2rem;
        vertical-align: middle;
    }

    /* Ambient animated background for glass effect */
    .stApp { 
        background: radial-gradient(circle at 50% -20%, #1e2430 0%, #0b0c10 70%) !important; 
        background-color: #0b0c10; 
    }

    /* =========================================
       2. MAIN DASHBOARD CARDS
       ========================================= */
    .hero-title { font-size: 3.5rem; font-weight: 900; color: #FFF; margin-bottom: 0px; letter-spacing: 1px; text-shadow: 0 4px 10px rgba(0,0,0,0.5);}
    .hero-subtitle { font-size: 1.2rem; background: linear-gradient(90deg, #00cc96, #00b383); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-top: 0px; margin-bottom: 30px; font-weight: 800;}
    
    .nav-card {
        background: rgba(25, 25, 30, 0.4); 
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.08); /* Frosted Glass Border */
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 16px;
        padding: 40px 30px; 
        height: 100%;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .nav-card:hover {
        border-color: rgba(0, 204, 150, 0.3);
        border-top: 1px solid rgba(0, 204, 150, 0.8);
        box-shadow: 0 15px 40px rgba(0, 204, 150, 0.2);
        transform: translateY(-8px);
    }
    .card-icon { font-size: 3.5rem; margin-bottom: 15px; }
    .card-title { font-size: 1.8rem; font-weight: 900; color: #FFF; margin-bottom: 15px;}
    .card-text { color: #aaa; font-size: 1rem; line-height: 1.6; margin-bottom: 20px;}
    .feature-list { color: #888; font-size: 0.95rem; margin-top: 15px; list-style-type: none; padding-left: 0;}
    .feature-list li { margin-bottom: 8px; border-left: 2px solid #333; padding-left: 10px;}
    .feature-list li b { color: #ccc; }
    .raptee-logo { font-family: 'Outfit', sans-serif; font-size: 32px; font-style: italic; font-weight: 900; color: white; letter-spacing: 1px; }
    .raptee-hv { color: #00cc96; }
</style>
""", unsafe_allow_html=True)

# 3. BACKGROUND SESSION TRACKING
if "logged_in" not in st.session_state or not st.session_state["logged_in"]:
    st.markdown("""
    <style>
        /* Hide the sidebar completely on login page */
        [data-testid="stSidebar"] { display: none !important; }
        [data-testid="collapsedControl"] { display: none !important; }
        
        /* Make the form look like a premium glassmorphic card */
        [data-testid="stForm"] {
            background: rgba(25, 25, 30, 0.4) !important; 
            backdrop-filter: blur(24px) !important;
            -webkit-backdrop-filter: blur(24px) !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            border-top: 1px solid rgba(0, 204, 150, 0.4) !important;
            border-radius: 20px !important;
            padding: 40px !important;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(0, 204, 150, 0.05) !important;
        }
        
        /* Form Label Styling */
        [data-testid="stForm"] label {
            color: #A0A0AB !important;
            font-weight: 500 !important;
            letter-spacing: 0.5px !important;
        }
        
        /* Style the inputs */
        div[data-baseweb="input"] {
            background-color: rgba(0, 0, 0, 0.3) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 12px !important;
            transition: all 0.3s ease !important;
        }
        div[data-baseweb="input"]:focus-within {
            border-color: #00cc96 !important;
            box-shadow: 0 0 12px rgba(0, 204, 150, 0.15) !important;
            background-color: rgba(0, 0, 0, 0.5) !important;
        }
        div[data-baseweb="input"] input {
            color: white !important;
            font-size: 1.05rem !important;
            padding: 12px !important;
        }
        
        /* Style the submit button */
        [data-testid="stFormSubmitButton"] button {
            background: linear-gradient(90deg, #00cc96, #00b383) !important;
            color: #0b0c10 !important;
            font-weight: 900 !important;
            font-size: 1.1rem !important;
            letter-spacing: 1px !important;
            text-transform: uppercase !important;
            border: none !important;
            border-radius: 12px !important;
            padding: 12px !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            margin-top: 25px !important;
        }
        [data-testid="stFormSubmitButton"] button:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 20px rgba(0, 204, 150, 0.4) !important;
            background: linear-gradient(90deg, #00e6aa, #00cc96) !important;
        }
        [data-testid="stFormSubmitButton"] button:active {
            transform: translateY(1px) !important;
        }
        
        .login-title-wrapper {
            text-align: center;
            margin-bottom: 40px;
            animation: fade-in-up 0.8s ease-out forwards;
        }
        .login-title {
            font-size: 3.2rem;
            font-weight: 900;
            color: #FFFFFF;
            letter-spacing: 1px;
            text-shadow: 0 4px 10px rgba(0,0,0,0.5);
            margin-bottom: 5px;
        }
        .login-subtitle {
            background: linear-gradient(90deg, #00cc96, #00b383);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 1.2rem;
            font-weight: 800;
            letter-spacing: 3px;
            text-transform: uppercase;
        }
    </style>
    """, unsafe_allow_html=True)
    
    col_space1, col_main, col_space2 = st.columns([1, 1.2, 1])
    with col_main:
        st.markdown("<br><br><br>", unsafe_allow_html=True)
        st.markdown("""
            <div class="login-title-wrapper">
                <div class="login-title">
                    <span>VCH</span> 
                    <span style="background: linear-gradient(90deg, #00cc96, #00b383); -webkit-background-clip: text; -webkit-text-fill-color: transparent; padding-left: 10px;">Thermal Dashboard</span>
                </div>
            </div>
        """, unsafe_allow_html=True)
        
        with st.form("login_form"):
            st.markdown("<h4 style='color: #FFF; margin-bottom: 25px; font-weight: 700;'>Sign In</h4>", unsafe_allow_html=True)
            username = st.text_input("Username")
            password = st.text_input("Password", type="password")
            submit = st.form_submit_button("Authenticate Access", use_container_width=True)
            if submit:
                success, role = auth_utils.authenticate_user(username, password)
                if success:
                    auth_utils.register_session(username, role)
                    st.rerun()
                else:
                    st.error("❌ Invalid Credentials. Access Denied.")
    st.stop()
    
# Check if active session was killed by admin
if not auth_utils.is_session_active():
    st.error("ACCESS DENIED: Your connection was terminated by an administrator.")
    st.stop()
    
# Logout Button in sidebar
if st.sidebar.button("🚪 Logout"):
    if "session_id" in st.session_state:
        auth_utils.terminate_session(st.session_state["session_id"])
    for key in ["session_id", "username", "logged_in", "role"]:
        if key in st.session_state:
            del st.session_state[key]
    st.rerun()

# ====================================================================
# DASHBOARD UI 
# ====================================================================

# 5. HEADER & LOGO
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOGO_PATH = os.path.join(BASE_DIR, "pages", "raptee_logo.png")

col_logo, col_space = st.columns([2, 8])
with col_logo:
    if os.path.exists(LOGO_PATH):
        st.image(LOGO_PATH, width=220)
    else:
        st.markdown("<div class='raptee-logo'>RAPTEE<span class='raptee-hv'>.HV</span></div>", unsafe_allow_html=True)

st.markdown('<div class="hero-title">Raptee Thermal Suite</div>', unsafe_allow_html=True)
st.markdown('<div class="hero-subtitle">Thermal & Dynamics Analytics Engine V4</div>', unsafe_allow_html=True)
st.markdown(f"<div style='color: #888; margin-top: -20px; margin-bottom: 20px;'>Logged in as: <b style='color: #00cc96;'>{st.session_state.get('username', 'Unknown')}</b></div>", unsafe_allow_html=True)
st.markdown("---")

# 6. MODULE SELECTOR CARDS
st.markdown("### 🚀 Active Testing Environments")
st.write("Select a module below or use the sidebar to launch the dedicated evaluation suites.")
st.markdown("<br>", unsafe_allow_html=True)

col1, col2 = st.columns(2)

with col1:
    st.markdown("""
    <div class="nav-card">
        <div class="card-icon">⚙️</div>
        <div class="card-title">Dyno Suite</div>
        <div class="card-text">
            Strict Quality Control (QC) gatekeeper designed to evaluate stationary <b>Dewesoft Telemetry</b> against mathematically calculated <b>Golden Standards</b>.
        </div>
        <ul class="feature-list">
            <li><b>Statistical Envelopes:</b> Automated ±2-Sigma Boundaries.</li>
            <li><b>QC Gatekeeper:</b> Dynamic Power & Early Deration tracking.</li>
            <li><b>Automated Docs:</b> 1-Click Executive Word Report Generator.</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    st.page_link("pages/1_Dyno_Suite.py", label="Launch Dyno Engine", icon="▶️")

with col2:
    st.markdown("""
    <div class="nav-card">
        <div class="card-icon">🛣️</div>
        <div class="card-title">Road Suite</div>
        <div class="card-text">
            Dynamic telemetry processing engine. Ingests raw <b>CAN bus logs</b> to visualize real-world powertrain performance and battery efficiency maps.
        </div>
        <ul class="feature-list">
            <li><b>Universal Decoder:</b> Raw CAN & Excel to 2Hz Time-Series.</li>
            <li><b>Battery Analytics:</b> SOC Drain & Bracketed Wh/km tracking.</li>
            <li><b>Thermal Protection:</b> Motor Torque vs. Deration Overlay maps.</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    st.page_link("pages/2_Road_Suite.py", label="Launch Road Engine", icon="▶️")


# 7. ADMIN ZONE (PASSWORD PROTECTED MODULE)
st.markdown("<br><br>", unsafe_allow_html=True)
if st.session_state.get("role") == "admin":
    with st.expander("🛡️ **ADMINISTRATION ZONE**"):
        admin_tabs = st.tabs(["👥 User Management", "🌐 Active Sessions"])
        with admin_tabs[0]:
            st.markdown("#### System Users")
            users = auth_utils.get_all_users()
            st.dataframe([{"Username": u, "Role": data["role"]} for u, data in users.items()], hide_index=True)
            
            c1, c2 = st.columns(2)
            with c1:
                st.markdown("#### Add New User")
                with st.form("add_user_form"):
                    new_u = st.text_input("New Username")
                    new_p = st.text_input("Password", type="password")
                    new_r = st.selectbox("Role", ["user", "admin"])
                    if st.form_submit_button("Create User"):
                        if auth_utils.create_user(new_u, new_p, new_r):
                            st.success(f"User {new_u} created!")
                            time.sleep(1)
                            st.rerun()
                        else:
                            st.error("Username already exists or invalid.")
            with c2:
                st.markdown("#### Delete User")
                with st.form("del_user_form"):
                    del_u = st.selectbox("Select User", [u for u in users.keys() if u != "admin"])
                    if st.form_submit_button("Delete User"):
                        if auth_utils.delete_user(del_u):
                            st.success(f"User {del_u} deleted!")
                            time.sleep(1)
                            st.rerun()
                            
        with admin_tabs[1]:
            st.markdown("Monitor and terminate active user connections across the VCH Dashboard.")
            db = auth_utils.load_sessions()
            
            active_users = {sid: data for sid, data in db.items() if data.get("status") == "active"}
            
            if not active_users:
                st.info("No active sessions currently found.")
            else:
                c1, c2, c3, c4 = st.columns([2, 3, 3, 2])
                c1.markdown("**Visitor ID**")
                c2.markdown("**Session UUID**")
                c3.markdown("**Connection Time**")
                c4.markdown("**Action**")
                st.markdown("<hr style='margin: 5px 0 10px 0; border-color: rgba(255,255,255,0.1);'>", unsafe_allow_html=True)
                
                for s_id, data in active_users.items():
                    r1, r2, r3, r4 = st.columns([2, 3, 3, 2])
                    r1.write(f"🧑‍💻 {data.get('username', 'Unknown')}")
                    r2.code(s_id[:8] + "...", language=None)
                    r3.write(data.get('login_time', ''))
                    
                    if r4.button("Terminate Connection", key=f"term_{s_id}"):
                        auth_utils.terminate_session(s_id)
                        st.toast(f"🚨 Connection {s_id[:8]} terminated!", icon="🚨")
                        time.sleep(0.8)
                        st.rerun()

# 8. FOOTER
st.markdown("<br><br><br><hr>", unsafe_allow_html=True)
st.markdown("<div style='text-align:center; color:#555; font-size:0.8rem;'>Raptee.HV Engineering Systems | Developed for VCH Analysis</div>", unsafe_allow_html=True)