import subprocess
import webbrowser
import time
import os
import sys

def main():
    # 1. Determine the base directory
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
    # 2. Point to the master app file
    app_path = os.path.join(base_dir, "master_app.py")

    # 3. Path to the logo (optional, just for completeness)
    logo_path = os.path.join(base_dir, "raptee_logo.png")

    print(f"🚀 Launching VCH Thermal Suite...")
    print(f"📂 App Path: {app_path}")
    
    # 4. CONSTRUCT THE COMMAND
    # We use "python" directly. This assumes Python is installed and in the system PATH.
    cmd = ["python", "-m", "streamlit", "run", app_path, "--server.headless", "true"]
    
    try:
        # 5. Start Streamlit
        # We allow it to create a visible window for a second so you can see if errors pop up
        process = subprocess.Popen(
            cmd,
            cwd=base_dir,
            shell=True
        )
        
        # 6. Wait for server to spin up
        print("⏳ Waiting for server...")
        time.sleep(3)
        
        # 7. Open the Dashboard
        print("✅ Opening Dashboard...")
        webbrowser.open("http://localhost:8501")
        
        # 8. Keep alive
        process.wait()
        
    except Exception as e:
        # Create an error log so we can see what happened if it crashes
        with open("launcher_error_log.txt", "w") as f:
            f.write(str(e))

if __name__ == "__main__":
    main()