# Plugin OAuth Setup Guide - GitHub & Slack

## 📋 Översikt

Denna guide visar hur du konfigurerar OAuth för GitHub och Slack plugins.

---

## 🔧 GITHUB OAUTH SETUP

### Steg 1: Skapa GitHub OAuth App

1. **Gå till GitHub Developer Settings**
   - Besök: https://github.com/settings/developers
   - Eller: GitHub → Settings → Developer settings → OAuth Apps

2. **Skapa ny OAuth App**
   - Klicka på "New OAuth App"
   - Fyll i formuläret:

   **Application name:**
   ```
   AI Library Platform
   ```

   **Homepage URL:**
   ```
   https://newai-sigma.vercel.app
   ```

   **Authorization callback URL:**
   ```
   https://ai-library-backend.onrender.com/api/plugins/github/callback
   ```
   
   **ELLER för lokal utveckling:**
   ```
   http://localhost:5000/api/plugins/github/callback
   ```

3. **OAuth App Settings (VIKTIGT)**
   - **Enable Device Flow:** ❌ **LÄMNAR DU AVSTÄNGT**
     - Device Flow är för enheter utan webbläsare (smart-TV, IoT, etc.)
     - Vår app använder standard Authorization Code Flow
     - Du behöver INTE aktivera detta
   - **Callback URL:** Se ovan

4. **Spara Client ID och Client Secret**
   - Efter att du skapat appen får du:
     - **Client ID** (t.ex. `Iv1.8a61f9b3a7a8f4c1`)
     - **Client Secret** (t.ex. `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
   
   **🔐 VIKTIGT:** Dessa credentials är **DELADE** för alla användare (app-level). Varje användare får sitt eget access token när de kopplar sitt konto. Se `OAUTH_SECURITY_EXPLANATION.md` för detaljer.

### Steg 2: Lägg till Environment Variables

Lägg till dessa i din `.env` fil och på Render/Vercel:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=din_client_id_här
GITHUB_CLIENT_SECRET=din_client_secret_här
GITHUB_REDIRECT_URI=https://ai-library-backend.onrender.com/api/plugins/github/callback
```

**OBS:** `GITHUB_REDIRECT_URI` är valfritt - systemet konstruerar den automatiskt om den saknas.

### Steg 3: Verifiera Scopes

GitHub-plugin använder dessa scopes:
- `repo` - Full control of private repositories
- `read:user` - Read user profile data
- `user:email` - Access user email addresses

Dessa sätts automatiskt i koden, inget extra behöver göras.

---

## 💬 SLACK OAUTH SETUP

### Steg 1: Skapa Slack App

1. **Gå till Slack API**
   - Besök: https://api.slack.com/apps
   - Klicka på "Create New App" → "From scratch"

2. **Konfigurera App**
   - **App Name:** `AI Library Platform`
   - **Pick a workspace:** Välj ditt workspace
   - Klicka "Create App"

3. **Konfigurera OAuth & Permissions**
   - I vänstermenyn: "OAuth & Permissions"
   - Scrolla ner till "Redirect URLs"
   - Klicka "Add New Redirect URL"
   - Lägg till:
     ```
     https://ai-library-backend.onrender.com/api/plugins/slack/callback
     ```
   - Klicka "Save URLs"

4. **Lägg till Bot Token Scopes**
   - I samma "OAuth & Permissions" sektion
   - Under "Scopes" → "Bot Token Scopes"
   - Lägg till dessa scopes:
     - `chat:write` - Send messages
     - `channels:read` - View basic information about public channels
     - `channels:write` - Manage public channels
     - `users:read` - View people in a workspace
     - `search:read` - Search messages and files

5. **Install App to Workspace**
   - Klicka på "Install to Workspace" (överst på sidan)
   - Godkänn permissions
   - Du får nu:
     - **Client ID** (t.ex. `1234567890.1234567890123`)
     - **Client Secret** (t.ex. `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

### Steg 2: Lägg till Environment Variables

Lägg till dessa i din `.env` fil och på Render/Vercel:

```env
# Slack OAuth
SLACK_CLIENT_ID=din_client_id_här
SLACK_CLIENT_SECRET=din_client_secret_här
SLACK_REDIRECT_URI=https://ai-library-backend.onrender.com/api/plugins/slack/callback
```

**OBS:** `SLACK_REDIRECT_URI` är valfritt - systemet konstruerar den automatiskt om den saknas.

---

## 🔍 VAR HITTAR JAG DETALJERNA?

### GitHub OAuth Details

**I koden:**
- `server/routes/plugins.ts` - OAuth routes (rad 704-850)
- `server/plugins/GitHubPlugin.ts` - Plugin implementation

**Miljövariabler:**
- `GITHUB_CLIENT_ID` - Från GitHub OAuth App
- `GITHUB_CLIENT_SECRET` - Från GitHub OAuth App
- `GITHUB_REDIRECT_URI` - Valfritt (auto-genereras)

**Redirect URI Format:**
```
{backendUrl}/api/plugins/github/callback
```

**Exempel:**
- Production: `https://ai-library-backend.onrender.com/api/plugins/github/callback`
- Local: `http://localhost:5000/api/plugins/github/callback`

---

### Slack OAuth Details

**I koden:**
- `server/routes/plugins.ts` - OAuth routes (efter GitHub routes)
- `server/plugins/SlackPlugin.ts` - Plugin implementation

**Miljövariabler:**
- `SLACK_CLIENT_ID` - Från Slack App
- `SLACK_CLIENT_SECRET` - Från Slack App
- `SLACK_REDIRECT_URI` - Valfritt (auto-genereras)

**Redirect URI Format:**
```
{backendUrl}/api/plugins/slack/callback
```

**Exempel:**
- Production: `https://ai-library-backend.onrender.com/api/plugins/slack/callback`
- Local: `http://localhost:5000/api/plugins/slack/callback`

**Scopes som används:**
- `chat:write` - Send messages
- `channels:read` - View channels
- `channels:write` - Manage channels
- `users:read` - View users
- `search:read` - Search messages

---

## 📝 QUICK REFERENCE

### GitHub OAuth URLs

| Miljö | Redirect URI |
|-------|--------------|
| **Production** | `https://ai-library-backend.onrender.com/api/plugins/github/callback` |
| **Local** | `http://localhost:5000/api/plugins/github/callback` |

### Slack OAuth URLs

| Miljö | Redirect URI |
|-------|--------------|
| **Production** | `https://ai-library-backend.onrender.com/api/plugins/slack/callback` |
| **Local** | `http://localhost:5000/api/plugins/slack/callback` |

---

## ✅ CHECKLIST

### GitHub Setup
- [ ] Skapat GitHub OAuth App
- [ ] Lagt till redirect URI i GitHub
- [ ] Kopierat Client ID och Client Secret
- [ ] Lagt till `GITHUB_CLIENT_ID` i environment variables
- [ ] Lagt till `GITHUB_CLIENT_SECRET` i environment variables
- [ ] (Valfritt) Lagt till `GITHUB_REDIRECT_URI` i environment variables

### Slack Setup
- [ ] Skapat Slack App
- [ ] Lagt till redirect URI i Slack
- [ ] Lagt till alla required scopes
- [ ] Installerat app till workspace
- [ ] Kopierat Client ID och Client Secret
- [ ] Lagt till `SLACK_CLIENT_ID` i environment variables
- [ ] Lagt till `SLACK_CLIENT_SECRET` i environment variables
- [ ] (Valfritt) Lagt till `SLACK_REDIRECT_URI` i environment variables

---

## 🔗 LINKS

### GitHub
- **OAuth Apps:** https://github.com/settings/developers
- **Documentation:** https://docs.github.com/en/apps/oauth-apps/building-oauth-apps

### Slack
- **Apps:** https://api.slack.com/apps
- **OAuth Guide:** https://api.slack.com/authentication/oauth-v2
- **Scopes:** https://api.slack.com/scopes

---

## 🐛 TROUBLESHOOTING

### GitHub OAuth fungerar inte
1. Kontrollera att redirect URI i GitHub matchar exakt med backend URL
2. Verifiera att `GITHUB_CLIENT_ID` och `GITHUB_CLIENT_SECRET` är korrekt
3. Kolla backend logs för felmeddelanden

### Slack OAuth fungerar inte
1. Kontrollera att redirect URI i Slack matchar exakt med backend URL
2. Verifiera att alla scopes är lagda till
3. Kontrollera att appen är installerad till workspace
4. Kolla backend logs för felmeddelanden

### Redirect URI mismatch
- **Problem:** "redirect_uri_mismatch" error
- **Lösning:** 
  1. Kopiera exakt redirect URI från backend logs
  2. Lägg till den i GitHub/Slack OAuth app settings
  3. Spara och försök igen

---

## 📍 VAR I KODEN?

### GitHub OAuth Routes
**Fil:** `server/routes/plugins.ts`
- Rad 704-745: `/github/auth/start` - Startar OAuth flow
- Rad 750-850: `/github/callback` - Hanterar OAuth callback

### Slack OAuth Routes
**Fil:** `server/routes/plugins.ts`
- Efter GitHub routes: `/slack/auth/start` - Startar OAuth flow
- Efter GitHub callback: `/slack/callback` - Hanterar OAuth callback

### Plugin Implementation
- **GitHub:** `server/plugins/GitHubPlugin.ts`
- **Slack:** `server/plugins/SlackPlugin.ts`

### Environment Variables
- **Backend:** `.env` fil i root
- **Render:** Environment variables i dashboard
- **Vercel:** Environment variables i project settings

