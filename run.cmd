@echo off
rem Launch the TBH XP tracker overlay (no console window).
cd /d "%~dp0"
start "" ".venv\Scripts\pythonw.exe" -m tbh_xp
