import subprocess
import os

# The exact path to your bat file
bat_path = r"D:\Hare Karthik\Dashboard\Streamlit\VCH_Streamlit_Project - ML Based\run_server.bat"

# This magic code forces Windows to run it completely invisibly!
CREATE_NO_WINDOW = 0x08000000

# Execute the bat file silently in the background
subprocess.Popen(bat_path, creationflags=CREATE_NO_WINDOW)