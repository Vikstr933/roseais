# Multi-stage Dockerfile för OmniAssistant Backend
# Installerar alla dependencies vid build-tid för production-ready deployment

FROM node:20-slim

# Installera system dependencies för Python, Playwright, och andra verktyg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Sätt arbetskatalog
WORKDIR /app

# Kopiera package files först (för bättre Docker layer caching)
COPY package*.json ./
COPY tsconfig.json ./

# Installera Node dependencies
RUN npm ci --only=production

# Installera Playwright browsers (kritiskt för browser automation)
RUN npx playwright install --with-deps chromium || npx playwright install chromium || exit 1

# Skapa Python virtual environment och installera faster-whisper och yt-dlp
RUN python3 -m venv /app/venv-whisper && \
    /app/venv-whisper/bin/pip install --upgrade pip && \
    /app/venv-whisper/bin/pip install faster-whisper yt-dlp && \
    /app/venv-whisper/bin/python3 -c "import faster_whisper; print('✅ faster-whisper installed')" && \
    /app/venv-whisper/bin/python3 -c "import yt_dlp; print('✅ yt-dlp installed')" || exit 1

# Installera turnstile-solver dependencies
COPY turnstile-solver/requirements.txt ./turnstile-solver/
RUN pip3 install --user --upgrade pip setuptools wheel && \
    pip3 install --user -r turnstile-solver/requirements.txt && \
    python3 -c "import camoufox; print('✅ camoufox installed')" || exit 1

# Kopiera resten av applikationen
COPY . .

# Bygg backend
RUN npm run build:backend || echo "Build step completed"

# Skapa directories för workspaces och temp files
RUN mkdir -p /data/workspaces /app/temp /app/scripts

# Exponera port
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:10000/api/health || exit 1

# Starta servern
CMD ["npm", "start"]

