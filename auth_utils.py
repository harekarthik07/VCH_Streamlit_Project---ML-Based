import json
import os
import uuid
import datetime
import hashlib
import streamlit as st

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(ROOT_DIR, "session_db.json")
USERS_FILE = os.path.join(ROOT_DIR, "users_db.json")

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def _init_users_db():
    if not os.path.exists(USERS_FILE):
        # Create default admin user
        default_admin = {
            "admin": {
                "password": hash_password("test@123"),
                "role": "admin"
            }
        }
        with open(USERS_FILE, "w") as f:
            json.dump(default_admin, f, indent=4)

def load_users():
    _init_users_db()
    with open(USERS_FILE, "r") as f:
        return json.load(f)

def save_users(data):
    with open(USERS_FILE, "w") as f:
        json.dump(data, f, indent=4)

def authenticate_user(username, password):
    users = load_users()
    if username in users:
        if users[username]["password"] == hash_password(password):
            return True, users[username]["role"]
    return False, None

def create_user(username, password, role="user"):
    users = load_users()
    if username in users:
        return False
    users[username] = {"password": hash_password(password), "role": role}
    save_users(users)
    return True

def delete_user(username):
    users = load_users()
    if username in users and username != "admin": # Prevent deleting default admin
        del users[username]
        save_users(users)
        return True
    return False

def change_password(username, new_password):
    users = load_users()
    if username in users:
        users[username]["password"] = hash_password(new_password)
        save_users(users)
        return True
    return False

def get_all_users():
    return load_users()

def _init_db():
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, "w") as f:
            json.dump({}, f)

def load_sessions():
    _init_db()
    try:
        with open(DB_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}

def save_sessions(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

def register_session(username, role):
    """Registers an authenticated user session."""
    session_id = str(uuid.uuid4())
    db = load_sessions()
        
    db[session_id] = {
        "username": username,
        "login_time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": "active"
    }
    save_sessions(db)
    st.session_state["session_id"] = session_id
    st.session_state["username"] = username
    st.session_state["role"] = role
    st.session_state["logged_in"] = True

def is_session_active() -> bool:
    if "session_id" not in st.session_state:
        return False
        
    s_id = st.session_state["session_id"]
    db = load_sessions()
    
    if s_id not in db:
        return False
        
    if db[s_id].get("status") == "terminated":
        # Optionally clean up their local state
        for key in ["session_id", "username", "logged_in", "role"]:
            if key in st.session_state:
                del st.session_state[key]
        return False
        
    return True

def enforce_login():
    """To be placed at the absolute top of the suite pages."""
    if "logged_in" not in st.session_state or not st.session_state["logged_in"]:
        st.error("🔒 ACCESS DENIED: Please login from the Main Dashboard to access this suite.")
        if st.button("Go to Login Page"):
            st.switch_page("master_app.py")
        st.stop()
        
    if not is_session_active():
        st.error("ACCESS DENIED: Your connection was terminated by an administrator.")
        st.stop()
        
def terminate_session(session_id: str):
    """Admin function to kill a session."""
    db = load_sessions()
    if session_id in db:
        db[session_id]["status"] = "terminated"
        save_sessions(db)
