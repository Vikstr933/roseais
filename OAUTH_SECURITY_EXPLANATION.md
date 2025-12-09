# OAuth Security - Hur Credentials Fungerar

## 🔐 Kort Svar

**JA, det är helt säkert!** Varje användare får sitt eget access token och kan bara komma åt sina egna data.

**Detta gäller för ALLA plugins:**
- ✅ Gmail
- ✅ Google Calendar
- ✅ GitHub
- ✅ Slack

## 📋 Två Typer av Credentials

### 1. **App-Level Credentials** (DELADE - i Environment Variables)

Dessa är **samma för alla användare** och identifierar din applikation:

```env
# Dessa ligger i .env och på Render/Vercel
# Gmail & Google Calendar
GOOGLE_CLIENT_ID=din_client_id_här
GOOGLE_CLIENT_SECRET=din_client_secret_här

# GitHub
GITHUB_CLIENT_ID=din_client_id_här
GITHUB_CLIENT_SECRET=din_client_secret_här

# Slack
SLACK_CLIENT_ID=din_client_id_här
SLACK_CLIENT_SECRET=din_client_secret_här
```

**Vad gör dessa?**
- Identifierar din applikation hos Google/GitHub/Slack
- Används för att starta OAuth-flödet
- **DELADE** för alla användare (samma för hela plattformen)

**Var sparas de?**
- I environment variables på backend (Render/Vercel)
- **INTE** i databasen
- **INTE** per användare

### 2. **User-Level Access Tokens** (PER ANVÄNDARE - i Databasen)

Dessa är **UNIKA för varje användare** och ger åtkomst till deras egna data:

```typescript
// I databasen: plugin_configs tabellen
{
  userId: "20057a55-6b77-4c33-836d-f01c76b283a4",  // UNIK per användare
  pluginId: "gmail",
  credentials: "encrypted_access_token_här",        // Krypterat access token
  enabled: true
}
```

**Vad gör dessa?**
- Ger åtkomst till **endast den användarens** Gmail/GitHub/Slack
- Varje användare får sitt eget token när de kopplar sitt konto
- **KRYPTERADE** i databasen
- **ISOLERADE** - användare A kan INTE se användare B:s data

## 🔄 Hur OAuth Flödet Fungerar

### Steg 1: Användare Klickar "Connect Gmail"
```
Användare → Frontend → Backend
Backend använder GOOGLE_CLIENT_ID (delad) för att skapa auth URL
```

### Steg 2: Användare Autentiserar Sig
```
Användare → Google Login → Godkänner åtkomst
Google ger ett CODE tillbaka
```

### Steg 3: Backend Får Access Token
```
Backend → Google API (med CODE + GOOGLE_CLIENT_SECRET)
Google → Ger tillbaka ACCESS_TOKEN (unikt för denna användare)
```

### Steg 4: Token Sparas Per Användare
```typescript
// I server/routes/plugins.ts - Gmail callback
await pluginRegistry.enablePlugin(
  userId,           // ← UNIK per användare
  'gmail',
  {
    accessToken: token,    // ← UNIK per användare
    refreshToken: refresh, // ← UNIK per användare
    expiresAt: expires
  }
);

// Sparas i databasen med userId
await db.insert(pluginConfigs).values({
  userId: userId,        // ← ISOLERAR data per användare
  pluginId: 'gmail',
  credentials: encrypted // ← Krypterat access token
});
```

## ✅ Säkerhetsgarantier

### 1. **Data Isolation**
```typescript
// När användare A använder Gmail-plugin:
const userACredentials = await getCredentials(userA.id);
// → Får ENDAST användare A:s access token
// → Kan ENDAST läsa användare A:s mail

// När användare B använder Gmail-plugin:
const userBCredentials = await getCredentials(userB.id);
// → Får ENDAST användare B:s access token
// → Kan ENDAST läsa användare B:s mail
```

### 2. **Kryptering**
```typescript
// I server/services/PluginRegistry.ts
const encryptedCredentials = this.encryptCredentials(credentials);
// → Access tokens är krypterade i databasen
```

### 3. **User-Specific OAuth Clients**

**Gmail/Google Calendar:**
```typescript
// I server/plugins/GmailPlugin.ts
public async enable(userId: string, credentials: PluginCredentials) {
  // Skapar OAuth client för SPECIFIK användare
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,      // ← Delad (app identifier)
    process.env.GOOGLE_CLIENT_SECRET,  // ← Delad (app secret)
    redirectUri
  );
  
  // Sätter användarens UNIKA credentials
  oauth2Client.setCredentials({
    access_token: credentials.accessToken,  // ← UNIK per användare
    refresh_token: credentials.refreshToken // ← UNIK per användare
  });
  
  // Spara i userStates map med userId som key
  this.userStates.set(userId, {
    oauth2Client,
    gmail,
    credentials
  });
}
```

**GitHub:**
```typescript
// I server/plugins/GitHubPlugin.ts
public async enable(userId: string, credentials: PluginCredentials) {
  // Skapar Octokit för SPECIFIK användare med deras UNIKA token
  const octokit = new Octokit({
    auth: credentials.accessToken  // ← UNIK per användare
  });
  
  // Spara i userStates map med userId som key
  this.userStates.set(userId, {
    octokit,
    credentials,
    user: { login: user.login, ... }
  });
}
```

**Slack:**
```typescript
// I server/plugins/SlackPlugin.ts
public async enable(userId: string, credentials: PluginCredentials) {
  // Skapar WebClient för SPECIFIK användare med deras UNIKA token
  const client = new WebClient(credentials.accessToken);  // ← UNIK per användare
  
  // Spara i userStates map med userId som key
  this.userStates.set(userId, {
    client,
    credentials,
    teamInfo: { id: teamInfo.team.id, ... }
  });
}
```

## 🎯 Sammanfattning

| Credential Typ | Var Sparas | Delad/Unik | Gäller För |
|---------------|------------|------------|------------|
| **Client ID** | Environment Variables | **DELAD** (samma för alla) | Gmail, Calendar, GitHub, Slack |
| **Client Secret** | Environment Variables | **DELAD** (samma för alla) | Gmail, Calendar, GitHub, Slack |
| **Access Token** | Databas (`plugin_configs`) | **UNIK** (per användare) | Gmail, Calendar, GitHub, Slack |
| **Refresh Token** | Databas (`plugin_configs`) | **UNIK** (per användare) | Gmail, Calendar (GitHub/Slack använder långlivade tokens) |

## 🔍 Var i Koden?

### App-Level Credentials (Delade)
```95:99:server/plugins/GmailPlugin.ts
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );
```

### User-Level Credentials (Unika)
```141:159:server/services/PluginRegistry.ts
      const existingConfig = await db.query.pluginConfigs.findFirst({
        where: (configs, { eq, and }) => and(
          eq(configs.userId, userId),
          eq(configs.pluginId, pluginId)
        )
      });

      if (existingConfig) {
        // Update existing config
        await db.update(pluginConfigs)
          .set({
            enabled: true,
            credentials: encryptedCredentials,
            updatedAt: new Date()
          })
          .where(and(
            eq(pluginConfigs.userId, userId),
            eq(pluginConfigs.pluginId, pluginId)
          ));
```

## ✅ Slutsats

**När du lägger in Client ID och Client Secret i environment variables:**
- ✅ Det är bara för att låta användare koppla sina egna konton
- ✅ Varje användare får sitt eget access token (Gmail, Calendar, GitHub, Slack)
- ✅ Varje användare kan bara komma åt sina egna data
- ✅ Ingen användare kan se andra användares:
  - Gmail/Google Calendar
  - GitHub repositories och kod
  - Slack workspaces och meddelanden

**Detta är standard OAuth 2.0 och är helt säkert!** 🔒

**Alla plugins (Gmail, Calendar, GitHub, Slack) använder exakt samma säkerhetsmodell.**

