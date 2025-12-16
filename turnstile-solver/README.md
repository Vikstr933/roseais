# Turnstile Solver - Lokal Installation

Detta är en lokal kopia av Turnstile-Solver som kan användas direkt i projektet.

## Installation

1. **Installera Python dependencies:**
   ```bash
   cd turnstile-solver
   pip install quart patchright camoufox
   ```

2. **Installera browser (Chromium rekommenderas):**
   ```bash
   python -m patchright install chromium
   ```

## Användning

### API Server (Rekommenderat)

Starta API-servern:

```bash
cd turnstile-solver
python api_solver.py --host 127.0.0.1 --port 5000 --debug True
```

API-servern kommer att köra på `http://localhost:5000` och är automatiskt integrerad med `BrowserUseService`.

### Direkt användning (Async Solver)

För direkt användning utan API-server:

```python
import asyncio
from async_solver import get_turnstile_token

result = asyncio.run(get_turnstile_token(
    url="https://example.com",
    sitekey="0x4AAAAAAA",
    debug=True,
    headless=False,
    browser_type="chromium"
))

print(result)
```

## Konfiguration

API-servern stöder följande argument:

- `--headless`: Kör browser i headless mode (kräver --useragent)
- `--useragent`: Anpassad User-Agent string
- `--debug`: Aktivera debug logging
- `--browser_type`: Browser typ (chromium, chrome, msedge, camoufox)
- `--thread`: Antal browser threads (default: 1)
- `--proxy`: Aktivera proxy support (kräver proxies.txt)
- `--host`: IP-adress för API-servern (default: 127.0.0.1)
- `--port`: Port för API-servern (default: 5000)

## Integration med BrowserUseService

`BrowserUseService` är redan konfigurerad att använda Turnstile-Solver API automatiskt när det är tillgängligt. Se `TURNSTILE_SOLVER_SETUP.md` i root-mappen för mer information.

## Filer

- `api_solver.py`: API-server för Turnstile-lösning
- `async_solver.py`: Async solver-klass för direkt användning
- `README.md`: Denna fil

## Noteringar

- Detta är en lokal kopia av [Turnstile-Solver](https://github.com/Theyka/Turnstile-Solver)
- Se original repository för senaste uppdateringar
- Används på egen risk

