# OAuth Configuration - Quick Reference

## 📍 VAR HITTAR JAG ALLT?

### 🔍 I KODEN

#### GitHub OAuth Routes
**Fil:** `server/routes/plugins.ts`

**Start OAuth:**
- **Rad:** ~704-745
- **Route:** `GET /api/plugins/github/auth/start`
- **Miljövariabler:**
  - `GITHUB_CLIENT_ID` (required)
  - `GITHUB_REDIRECT_URI` (optional, auto-genereras)

**OAuth Callback:**
- **Rad:** ~750-850
- **Route:** `GET /api/plugins/github/callback`
- **Miljövariabler:**
  - `GITHUB_CLIENT_ID` (required)
  - `GITHUB_CLIENT_SECRET` (required)
  - `GITHUB_REDIRECT_URI` (optional, auto-genereras)

#### Slack OAuth Routes
**Fil:** `server/routes/plugins.ts`

**Start OAuth:**
- **Rad:** ~560-597
- **Route:** `GET /api/plugins/slack/auth/start`
- **Miljövariabler:**
  - `SLACK_CLIENT_ID` (required)
  - `SLACK_REDIRECT_URI` (optional, auto-genereras)

**OAuth Callback:**
- **Rad:** ~598-697
- **Route:** `GET /api/plugins/slack/callback`
- **Miljövariabler:**
  - `SLACK_CLIENT_ID` (required)
  - `SLACK_CLIENT_SECRET` (required)
  - `SLACK_REDIRECT_URI` (optional, auto-genereras)

---

## 🔑 MILJÖVARIABLER

### GitHub

```env
# Required
GITHUB_CLIENT_ID=din_client_id_här
GITHUB_CLIENT_SECRET=din_client_secret_här

# Optional (auto-genereras om saknas)
GITHUB_REDIRECT_URI=https://ai-library-backend-3mmv.onrender.com/api/plugins/github/callback
```

**Var hittar du dessa?**
1. Gå till: https://github.com/settings/developers
2. Skapa OAuth App
3. Kopiera Client ID och Client Secret

### Slack

```env
# Required
SLACK_CLIENT_ID=din_client_id_här
SLACK_CLIENT_SECRET=din_client_secret_här

# Optional (auto-genereras om saknas)
SLACK_REDIRECT_URI=https://ai-library-backend-3mmv.onrender.com/api/plugins/slack/callback
```

**Var hittar du dessa?**
1. Gå till: https://api.slack.com/apps
2. Skapa App
3. Installera till workspace
4. Kopiera Client ID och Client Secret från "Basic Information"

---

## 🌐 REDIRECT URIs

### Production (Render)
```
GitHub:  https://ai-library-backend-3mmv.onrender.com/api/plugins/github/callback
Slack:   https://ai-library-backend-3mmv.onrender.com/api/plugins/slack/callback
Gmail:   https://ai-library-backend-3mmv.onrender.com/api/plugins/gmail/callback
Calendar: https://ai-library-backend-3mmv.onrender.com/api/plugins/google-calendar/callback
```

### Local Development
```
GitHub:  http://localhost:5000/api/plugins/github/callback
Slack:   http://localhost:5000/api/plugins/slack/callback
Gmail:   http://localhost:5000/api/plugins/gmail/callback
Calendar: http://localhost:5000/api/plugins/google-calendar/callback
```

---

## 📋 SCOPES & PERMISSIONS

### GitHub Scopes (sätts automatiskt)
- `repo` - Full control of private repositories
- `read:user` - Read user profile data
- `user:email` - Access user email addresses

**Var i koden:** `server/routes/plugins.ts` rad ~722-726

### Slack Scopes (sätts automatiskt)
- `chat:write` - Send messages
- `channels:read` - View channels
- `channels:write` - Manage channels
- `users:read` - View users
- `search:read` - Search messages

**Var i koden:** `server/routes/plugins.ts` rad ~575-581

---

## 🛠️ SETUP STEG-FÖR-STEG

### GitHub

1. **Skapa OAuth App**
   - URL: https://github.com/settings/developers
   - Klicka "New OAuth App"
   - Fyll i:
     - Name: `AI Library Platform`
     - Homepage: `https://newai-sigma.vercel.app`
     - Callback: `https://ai-library-backend.onrender.com/api/plugins/github/callback`

2. **OAuth App Settings**
   - **Enable Device Flow:** ❌ **LÄMNAR DU AVSTÄNGT**
     - Device Flow är för enheter utan webbläsare
     - Vår app använder standard web flow
     - Du behöver INTE aktivera detta

3. **Kopiera Credentials**
   - Client ID: Kopiera från OAuth App sidan
   - Client Secret: Klicka "Generate a new client secret"

4. **Lägg till i Environment**
   - Lägg till i `.env` och Render dashboard

### Slack

1. **Skapa App**
   - URL: https://api.slack.com/apps
   - Klicka "Create New App" → "From scratch"
   - Name: `AI Library Platform`
   - Workspace: Välj ditt workspace

2. **Konfigurera OAuth**
   - Gå till "OAuth & Permissions"
   - Lägg till Redirect URL: `https://ai-library-backend.onrender.com/api/plugins/slack/callback`
   - Lägg till Bot Token Scopes (se ovan)

3. **Installera App**
   - Klicka "Install to Workspace"
   - Godkänn permissions

4. **Kopiera Credentials**
   - Gå till "Basic Information"
   - Kopiera "Client ID" och "Client Secret"

5. **Lägg till i Environment**
   - Lägg till i `.env` och Render dashboard

---

## 📂 FILSTRUKTUR

```
server/
├── routes/
│   └── plugins.ts          # OAuth routes för alla plugins
├── plugins/
│   ├── GitHubPlugin.ts     # GitHub plugin implementation
│   ├── SlackPlugin.ts      # Slack plugin implementation
│   ├── GmailPlugin.ts      # Gmail plugin (redan fungerar)
│   └── GoogleCalendarPlugin.ts  # Calendar plugin (redan fungerar)
└── services/
    └── PluginRegistry.ts   # Plugin registration och management
```

---

## 🔗 EXTERNA LINKS

### GitHub
- **OAuth Apps:** https://github.com/settings/developers
- **Create App:** https://github.com/settings/developers/new
- **Documentation:** https://docs.github.com/en/apps/oauth-apps

### Slack
- **Apps Dashboard:** https://api.slack.com/apps
- **OAuth Guide:** https://api.slack.com/authentication/oauth-v2
- **Scopes Reference:** https://api.slack.com/scopes

---

## ✅ VERIFIERING

### Testa GitHub OAuth
1. Gå till integrations-sidan
2. Klicka "Connect" på GitHub
3. Du ska redirectas till GitHub
4. Efter godkännande, redirectas tillbaka
5. Status ska ändras till "Connected"

### Testa Slack OAuth
1. Gå till integrations-sidan
2. Klicka "Connect" på Slack
3. Du ska redirectas till Slack
4. Efter godkännande, redirectas tillbaka
5. Status ska ändras till "Connected"

---

## 🐛 VANLIGA PROBLEM

### "redirect_uri_mismatch"
**Lösning:**
1. Kolla backend logs för exakt redirect URI som används
2. Kopiera den EXAKTA URI:n
3. Lägg till den i GitHub/Slack OAuth app settings
4. Spara och försök igen

### "Client ID not found"
**Lösning:**
1. Kontrollera att miljövariablerna är satta korrekt
2. Verifiera att de är tillgängliga i production (Render dashboard)
3. Restart backend efter att ha lagt till variabler

### "Invalid client secret"
**Lösning:**
1. Kontrollera att Client Secret är korrekt kopierad
2. För GitHub: Generera ny secret om den är gammal
3. För Slack: Kopiera från "Basic Information" sektionen

