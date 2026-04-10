# Project Structure & Recent Changes Summary

This document outlines the current file structure of the **VCH Streamlit Project - ML Based** and details the major changes we've implemented in recent sessions. You can use this guide to ensure you have all the necessary files when working with the Gemini web version.

## 📁 Key File Structure

Here are the core files and folders you should carry over when working elsewhere (you can safely ignore large datasets, `node_modules`, `build`, `dist`, and `__pycache__` unless explicitly needed):

```text
VCH_Streamlit_Project - ML Based/
│
├── master_app.py               # Main entry point for the Streamlit dashboard
├── auth_utils.py               # [NEW] Authentication logic and user management
├── users_db.json               # [NEW] Database for storing user credentials (e.g., admin)
├── session_db.json             # [NEW] Database tracking active user login sessions
│
├── .streamlit/
│   └── config.toml             # Streamlit configuration for styling and server rules
│
├── pages/                      # Dashboard sub-pages
│   ├── 1_Dyno_Suite.py         # Tabular data visualization, Custom Plot, Battery Health
│   └── 2_Road_Suite.py         # Road Test analytics pipeline
│
├── dyno_backend/               # Backend logic for Dyno operations
│   ├── dyno_db_manager.py      # Database operations & dynamic file loading
│   ├── thermal_engine.py       # Telemetry parsing & calculations
│   └── ...
│
└── road_backend/               # Backend logic for Road Suite operations
```

---

## 🛠️ Summary of Recent Changes

If you are transferring this project to a new environment or continuing with the web version, here are the key modifications we've made recently:

### 1. Robust Authentication System (`auth_utils.py` & `master_app.py`)
- **What we did:** Replaced anonymous session tracking with a fully functional login system. Added `users_db.json` and `session_db.json` files to persistent user states.
- **Admin Setup:** Created an administrative account (Password: `test@123`) to restrict access to the Dyno and Road Suites.
- **Security:** Added routing guards inside `pages/1_Dyno_Suite.py` and `pages/2_Road_Suite.py` to prevent users from bypassing the login via direct URL access.

### 2. High-Resolution Data Loading (`dyno_backend/dyno_db_manager.py`)
- **What we did:** Modified the Dyno Suite backend to support dynamic loading of full-resolution 2Hz raw telemetry.
- **Impact:** Ensures the *Custom Plot* and *Battery Health* tabs show high-precision data fetched directly from raw log files (`evaluation_raw` / `baseline_raw`), without disrupting the 10-second binning used in other analytics.

### 3. UI and Aesthetic Polishing (`pages/1_Dyno_Suite.py`)
- **What we did:** Refined the dashboard's visual style. Cleaned up the CSS rules to remove previously applied glowing effects (`box-shadow` and `text-shadow`) on metric cards and banners, achieving a cleaner, modern, financial-dashboard aesthetic.

### 4. Code & Database Stabilizations 
- **What we did:** Fixed several data processing anomalies. Removed incorrect hardcoded offsets in the backend calculations and stabilized database connections so uploaded files via the Data Engine correctly reflect in the dashboard.
- **Git Basics:** Added a `.gitignore` file to ensure large datasets (`baseline_raw`, `evaluation_raw`), local builds, and caches aren't accidentally tracked when saving your code.

### 💡 Recommendation for the Web Version
When interacting with the Gemini Web version seamlessly:
1. Always upload/mention `master_app.py`, `auth_utils.py`, `1_Dyno_Suite.py`, and `dyno_db_manager.py` if you intend to modify login logic or Dyno visuals.
2. Let the web LLM know that **user data is persistently handled in local JSON files** (`users_db.json` and `session_db.json`).
