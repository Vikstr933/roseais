@echo off
REM Start Turnstile-Solver API Server (Windows)

echo 🚀 Starting Turnstile-Solver API Server...

REM Check if virtual environment exists
if not exist "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo 🔌 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📥 Installing dependencies...
pip install -r requirements.txt

REM Install browser
echo 🌐 Installing Chromium browser...
python -m patchright install chromium

REM Start API server
echo ✅ Starting API server on http://127.0.0.1:5000
python api_solver.py --host 127.0.0.1 --port 5000 --debug True

pause

