# Cloudflare Turnstile Solver Integration

Detta projekt har stöd för att automatiskt lösa Cloudflare Turnstile med hjälp av [Turnstile-Solver](https://github.com/Theyka/Turnstile-Solver) API.

## Installation av Turnstile-Solver

1. **Klona Turnstile-Solver repository:**
   ```bash
   git clone https://github.com/Theyka/Turnstile-Solver.git
   cd Turnstile-Solver
   ```

2. **Skapa virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Aktivera virtual environment:**
   - **Windows:** `venv\Scripts\activate`
   - **macOS/Linux:** `source venv/bin/activate`

4. **Installera dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Installera browser (Chromium rekommenderas):**
   ```bash
   python -m patchright install chromium
   ```

6. **Starta API-servern:**
   ```bash
   python api_solver.py --host 127.0.0.1 --port 5000
   ```

   API-servern kommer nu att köra på `http://localhost:5000`

## Konfiguration

Sätt environment variable `TURNSTILE_SOLVER_API_URL` till din Turnstile-Solver API URL:

```bash
# I .env filen eller environment variables
TURNSTILE_SOLVER_API_URL=http://localhost:5000
```

Om variabeln inte är satt, kommer systemet automatiskt att försöka använda `http://localhost:5000` som standard.

## Hur det fungerar

1. När `browser_use` tool detekterar en Cloudflare Turnstile på en sida:
   - Extraherar den automatiskt `sitekey` från Turnstile-widgeten
   - Anropar Turnstile-Solver API för att lösa Turnstile
   - Sätter den lösta token i formuläret automatiskt

2. Om Turnstile-Solver API inte är tillgänglig eller misslyckas:
   - Systemet faller tillbaka till manuell Turnstile-hantering
   - Försöker vänta på att Turnstile löser sig automatiskt
   - Försöker interagera med Turnstile-widgeten manuellt

## API Endpoints

Turnstile-Solver API använder följande endpoints:

- **GET `/turnstile?url=<url>&sitekey=<sitekey>`** - Startar en Turnstile-lösning
  - Returnerar: `{ "task_id": "..." }`
  
- **GET `/result?id=<task_id>`** - Hämtar resultatet av en Turnstile-lösning
  - Returnerar: `{ "value": "<token>", "elapsed_time": 7.625 }` när klar

## Docker (Alternativ)

Om du föredrar att köra Turnstile-Solver i Docker:

```bash
docker run -d -p 3389:3389 -p 5000:5000 -e TZ=Asia/Baku --name turnstile_solver theyka/turnstile_solver:latest
```

API:et kommer att vara tillgängligt på `http://localhost:5000`.

## Troubleshooting

- **API inte tillgänglig:** Kontrollera att Turnstile-Solver API-servern körs
- **Timeout:** API:et kan ta upp till 2 minuter att lösa en Turnstile
- **Fel sitekey:** Kontrollera att sitekey extraheras korrekt från sidan
- **Fallback:** Om API misslyckas, använder systemet automatiskt manuell hantering

## Noteringar

- Turnstile-Solver är ett tredjepartsverktyg och används på egen risk
- Se [Turnstile-Solver repository](https://github.com/Theyka/Turnstile-Solver) för mer information
- Systemet fungerar även utan Turnstile-Solver API (använder manuell hantering)

