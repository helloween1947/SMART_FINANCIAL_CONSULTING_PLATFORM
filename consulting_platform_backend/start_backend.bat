@echo off
cd /d "C:\Users\marka\OneDrive\Documents\consulting_platform_backend"
"C:\Users\marka\OneDrive\Documents\consulting_platform_backend\venv\Scripts\uvicorn.exe" app.main:app --host 127.0.0.1 --port 8001 --reload
