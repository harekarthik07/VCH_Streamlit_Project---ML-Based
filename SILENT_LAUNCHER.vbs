Set WshShell = CreateObject("WScript.Shell")
' Run the batch file with 0 as the window style (hidden)
WshShell.Run "cmd /c LAUNCH_VCH_JS.bat", 0, False
