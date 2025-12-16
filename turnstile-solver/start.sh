#!/bin/bash
# Start Turnstile-Solver API Server

echo "🚀 Starting Turnstile-Solver API Server..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Install browser
echo "🌐 Installing Chromium browser..."
python -m patchright install chromium

# Start API server
echo "✅ Starting API server on http://127.0.0.1:5000"
python api_solver.py --host 127.0.0.1 --port 5000 --debug True

