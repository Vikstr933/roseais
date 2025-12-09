# Agent Security & Plugins Implementation Plan

## 🔒 SÄKERHETSPROBLEM LÖST

### Problem: Användare kan förstöra system-agenter
**Status:** ✅ DELVIS SKYDDAT, nu komplett

### Vad som redan fanns:
- ✅ System-agenter kan bara raderas av admins
- ✅ Användare kan bara se system-agenter + sina egna
- ❌ **SAKNAS:** Skydd mot att UPPDATERA system-agenter

### Vad som fixats:
- ✅ **Lagt till skydd:** System-agenter kan nu bara uppdateras av admins
- ✅ Vanliga användare kan fortfarande skapa sina egna agenter
- ✅ System-agenter är nu helt skyddade från vanliga användare

---

## 🔌 PLUGIN-STATUS

### Nuvarande status:

| Plugin | Status | Vad som behövs |
|--------|--------|----------------|
| **Gmail** | ✅ Fungerar | Inget - klar! |
| **Google Calendar** | ✅ Fungerar | Inget - klar! |
| **Slack** | ❌ Saknas | Skapa SlackPlugin.ts |
| **GitHub** | ⚠️ Existerar men fungerar inte | Fixa OAuth + lägg till import-funktion |

---

## 📋 IMPLEMENTATION PLAN

### 1. ✅ Agent Security (KLAR)
- [x] Lägg till skydd mot att uppdatera system-agenter
- [x] Endast admins kan modifiera system-agenter

### 2. 🔄 Slack Plugin (PÅGÅENDE)
**Behöver:**
- Skapa `server/plugins/SlackPlugin.ts`
- OAuth 2.0 integration med Slack
- Tools: `send_message`, `read_messages`, `list_channels`, `create_channel`
- Lägg till routes i `server/routes/plugins.ts`

### 3. 🔄 GitHub Plugin (PÅGÅENDE)
**Behöver:**
- Fixa OAuth-flöde (samma som Gmail/Calendar)
- Lägg till `import_repository` tool som:
  - Klonar ett GitHub-repo
  - Skapar ett workspace i playground
  - Importerar alla filer
  - Varnar användare om att välja rätt agent

### 4. ⏳ Varning för importerade projekt
**Behöver:**
- När användare importerar ett repo, visa varning:
  ```
  "⚠️ Viktigt: Välj rätt agent för ditt projekt!
  
  Detta projekt verkar vara [Python/React/etc]. 
  Se till att använda en agent som är specialiserad på [språk/ramverk].
  
  Exempel: För Python-projekt, använd 'Python Expert' agenten."
  ```

### 5. ⏳ Registrera alla plugins
**Behöver:**
- Se till att alla 4 plugins registreras i `PluginRegistry`
- Uppdatera integrations-sidan för att visa alla 4

---

## 🎯 SLACK PLUGIN - FUNKTIONALITET

### Tools som behövs:
1. **send_message** - Skicka meddelande till kanal/DM
2. **read_messages** - Läsa meddelanden från kanal
3. **list_channels** - Lista alla kanaler
4. **create_channel** - Skapa ny kanal
5. **search_messages** - Sök i meddelanden

### OAuth Setup:
- Client ID: `SLACK_CLIENT_ID`
- Client Secret: `SLACK_CLIENT_SECRET`
- Redirect URI: `/api/plugins/slack/callback`
- Scopes: `chat:write`, `channels:read`, `channels:write`, `users:read`

---

## 🎯 GITHUB PLUGIN - FUNKTIONALITET

### Tools som behövs:
1. **import_repository** - Importera externt repo till playground
   - Input: `owner`, `repo`, `branch` (optional)
   - Output: `workspaceId`, `filesImported`, `warning`
   
2. **list_repositories** - Lista användarens repos
3. **create_repository** - Skapa nytt repo
4. **commit_code** - Committa kod
5. **create_pull_request** - Skapa PR

### Import Repository Flow:
```
1. User: "Importera mitt repo github.com/user/my-python-project"
2. Elon: Använder import_repository tool
3. System:
   - Klonar repo
   - Detekterar språk/ramverk (Python, React, etc.)
   - Skapar workspace
   - Importerar filer
   - Visar varning om rätt agent
4. User: Får workspace med alla filer + varning
```

---

## ⚠️ VARNING FÖR IMPORTERADE PROJEKT

### När användare importerar repo:
1. **Detektera språk/ramverk** automatiskt
2. **Visa varning:**
   ```
   "⚠️ Viktigt: Välj rätt agent!
   
   Detta projekt är: [Python/React/Node.js/etc]
   
   Rekommenderade agenter:
   - Python Expert (för Python-projekt)
   - React Developer (för React-projekt)
   - etc.
   
   Användning av fel agent kan leda till dåliga resultat."
   ```

3. **Lägg till i workspace metadata:**
   - `detectedLanguage`
   - `detectedFramework`
   - `recommendedAgents`

---

## 📝 NÄSTA STEG

1. ✅ Fixa agent-säkerhet (KLAR)
2. 🔄 Skapa SlackPlugin
3. 🔄 Fixa GitHub-plugin OAuth
4. 🔄 Lägg till import_repository funktion
5. ⏳ Lägg till varning för importerade projekt
6. ⏳ Registrera alla plugins

Vill du att jag fortsätter med implementationen?

