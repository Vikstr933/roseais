# KB-Whisper Integration Guide

## Vad är KB-Whisper?

KB-Whisper Base är en svensk taligenkänningsmodell från KBLab (National Library of Sweden) som är:
- **47% bättre** än OpenAI's whisper-large-v3 för svenska
- Tränad på **50,000 timmar** svensk tal
- Mycket lägre Word Error Rate (WER) för svenska

## Installation

### 1. Installera Python (om inte redan installerat)

#### Windows:
1. Ladda ner Python från [python.org](https://www.python.org/downloads/)
2. Under installationen, **kryssa i "Add Python to PATH"**
3. Välj "Install Now" eller "Customize installation"
4. Verifiera installation:
   ```powershell
   py --version
   # eller
   python --version
   ```

#### macOS/Linux:
```bash
# macOS (med Homebrew)
brew install python3

# Linux (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install python3 python3-pip

# Verifiera
python3 --version
```

### 2. Installera faster-whisper

#### Windows:
```powershell
# Använd py -m pip istället för pip direkt
py -m pip install faster-whisper

# Eller om python är i PATH:
python -m pip install faster-whisper
```

#### macOS/Linux:
```bash
pip3 install faster-whisper
# eller
python3 -m pip install faster-whisper
```

### 3. Verifiera installation

Backend kommer automatiskt att kontrollera om faster-whisper är installerat när `/api/whisper/status` anropas.

Du kan också testa manuellt:
```bash
python -c "import faster_whisper; print('faster-whisper installed successfully')"
```

## Användning

### Frontend (automatiskt)

Systemet använder automatiskt KB-Whisper om det är tillgängligt, annars fallback till Web Speech API.

### API Endpoints

#### POST `/api/whisper/transcribe`
Transkribera audio med KB-Whisper.

**Request:**
```json
{
  "audioData": "base64-encoded-audio-string",
  "language": "sv",
  "task": "transcribe",
  "returnTimestamps": false
}
```

**Response:**
```json
{
  "success": true,
  "text": "Transkriberad text här",
  "language": "sv",
  "languageProbability": 0.99
}
```

#### GET `/api/whisper/status`
Kontrollera om KB-Whisper är tillgängligt.

**Response:**
```json
{
  "success": true,
  "available": true,
  "model": "KBLab/kb-whisper-base",
  "language": "Swedish (sv)"
}
```

## Fördelar med KB-Whisper

| Feature | Web Speech API | KB-Whisper |
|---------|----------------|------------|
| Svenska stöd | Begränsat | Utmärkt (47% bättre) |
| Accuracy | ~60% WER | ~9% WER (base) |
| Offline | Nej | Ja (efter nedladdning) |
| Customization | Nej | Ja (olika modeller) |
| Latens | Låg (~200ms) | Medium (~1-3s) |

## Modellstorlekar

- **tiny**: Snabbast, minst minne (~39MB)
- **base**: Balanserad (rekommenderad) (~74MB)
- **small**: Bättre accuracy (~244MB)
- **medium**: Mycket bra accuracy (~769MB)
- **large-v3**: Bäst accuracy (~1550MB)

Vi använder **base** som standard - bra balans mellan hastighet och accuracy.

## Deployment Notes

### Render/Vercel
- Python måste vara tillgängligt i miljön
- faster-whisper installeras automatiskt vid första användning
- Modellen laddas ner vid första användning (~74MB för base)

### Lokal utveckling
```bash
# Installera Python dependencies
pip install faster-whisper

# Testa
curl -X GET http://localhost:3001/api/whisper/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### "faster-whisper not installed"

**Windows:**
```powershell
py -m pip install faster-whisper
```

**macOS/Linux:**
```bash
pip3 install faster-whisper
# eller
python3 -m pip install faster-whisper
```

### "Python3 not found" eller "pip is not recognized"

**Windows:**
1. Installera Python från [python.org](https://www.python.org/downloads/)
2. Se till att kryssa i "Add Python to PATH" under installationen
3. Använd `py -m pip` istället för `pip` direkt:
   ```powershell
   py -m pip install faster-whisper
   ```

**macOS/Linux:**
```bash
# Installera Python och pip
sudo apt-get install python3 python3-pip  # Ubuntu/Debian
brew install python3  # macOS med Homebrew

# Verifiera
python3 --version
pip3 --version
```

### Långsam första transkription
Modellen laddas ner vid första användning (~74MB). Efterföljande anrop är snabbare.

### Högt minnesanvändning
Använd `tiny` eller `base` modell istället för `large-v3`.

## Performance

- **Första anrop**: ~5-10s (nedladdning av modell)
- **Efterföljande**: ~1-3s per transkription
- **Minne**: ~200-500MB för base-modellen

## Framtida förbättringar

1. **Caching**: Cache modellen i minnet för snabbare svar
2. **GPU support**: Använd CUDA om tillgängligt
3. **Streaming**: Real-time transkription medan användaren pratar
4. **Model selection**: Låt användaren välja modellstorlek

