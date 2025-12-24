# Multi-stage Dockerfile för OmniAssistant Backend
# Installerar alla dependencies vid build-tid för production-ready deployment

FROM node:20-slim

# Installera system dependencies för Python, Playwright, och andra verktyg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    wget \
    curl \
    git \
    build-essential \
    libssl-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Installera faster-whisper direkt i system Python som primär metod
# Detta är mer pålitligt än att förlita sig på venv som kan kopieras felaktigt
RUN pip3 install --upgrade pip setuptools wheel && \
    pip3 install --no-cache-dir faster-whisper yt-dlp "youtube-transcript-api>=1.2.0" && \
    python3 -c "import faster_whisper; print('✅ faster-whisper installed in system Python')" && \
    python3 -c "from faster_whisper import WhisperModel; print('✅ WhisperModel importable in system Python')" && \
    python3 -c "import yt_dlp; print('✅ yt-dlp installed in system Python')" && \
    echo "✅ System Python packages verified" || (echo "❌ System Python package installation failed" && exit 1)

# Sätt arbetskatalog
WORKDIR /app

# Kopiera package files först (för bättre Docker layer caching)
COPY package*.json ./
COPY tsconfig.json ./

# Installera Node dependencies (inklusive dev dependencies för build)
RUN npm install

# Installera Playwright browsers (kritiskt för browser automation)
# Installera med system dependencies för att säkerställa att allt fungerar
RUN npx playwright install-deps chromium || true && \
    npx playwright install --with-deps chromium || \
    npx playwright install chromium || \
    (echo "❌ Playwright installation failed" && exit 1)

# Skapa Python virtual environment som fallback (används om system Python inte fungerar)
# System Python är nu primär metod (installerad ovan), venv är fallback
RUN python3 -m venv venv-whisper && \
    ./venv-whisper/bin/pip install --upgrade pip setuptools wheel && \
    ./venv-whisper/bin/pip install --no-cache-dir faster-whisper yt-dlp "youtube-transcript-api>=1.2.0" && \
    ./venv-whisper/bin/python3 -c "import faster_whisper; print('✅ faster-whisper installed in venv')" && \
    ./venv-whisper/bin/python3 -c "import yt_dlp; print('✅ yt-dlp installed in venv')" && \
    echo "✅ venv-whisper created as fallback" || (echo "⚠️ venv-whisper creation failed (non-critical, system Python is primary)" && true)

# turnstile-solver dependencies (camoufox) removed - not needed for core functionality

# Kopiera resten av applikationen (exkludera venv-whisper om den finns lokalt)
# Använd .dockerignore för att exkludera venv-whisper från COPY
# VIKTIGT: .dockerignore ska exkludera venv-whisper/ så att den som skapades ovan inte överskrivs
COPY . .

# Verifiera att venv-whisper INTE överskrevs av COPY (den ska fortfarande ha faster-whisper)
RUN test -f venv-whisper/bin/python3 && \
    venv-whisper/bin/python3 -c "import faster_whisper; print('✅ faster-whisper still present after COPY')" || \
    (echo "❌ CRITICAL: venv-whisper was overwritten or faster-whisper missing after COPY" && exit 1)

# Bygg backend
RUN npm run build:backend

# Verifiera att system Python har faster-whisper (primär metod)
RUN python3 -c "import faster_whisper; print('✅ faster-whisper verified in system Python')" && \
    python3 -c "from faster_whisper import WhisperModel; print('✅ WhisperModel verified in system Python')" && \
    python3 -c "import yt_dlp; print('✅ yt-dlp verified in system Python')" && \
    echo "✅ System Python fully verified - faster-whisper is ready" || \
    (echo "❌ CRITICAL: System Python verification failed - faster-whisper not installed" && exit 1)

# Behåll Playwright även om det är en dev dependency (behövs för runtime)
# Rensa cache men behåll alla dependencies som behövs
RUN npm cache clean --force

# Skapa directories för workspaces och temp files
# Använd relativ path för temp så att det matchar process.cwd()/temp
RUN mkdir -p /data/workspaces temp cache/whisper-models

# Sätt environment variables
ENV WORKSPACES_PATH=/data/workspaces
ENV NODE_ENV=production

# Exponera port
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:10000/api/health || exit 1

# Starta servern
# Använd node direkt istället för npm start för bättre signal handling
CMD ["node", "dist/index.js"]

