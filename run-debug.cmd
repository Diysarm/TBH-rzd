@echo off
rem Launch with a visible console so Python errors are shown.
cd /d "%~dp0"
".venv\Scripts\python.exe" -m tbh_xp
echo.
echo (window closed) press any key to exit...
pause >nul
