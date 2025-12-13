# API Keys & Connectors Consolidation - Summary

## 🔍 Current Situation

Vi har **3 olika system** för API keys/secrets:

1. **`/api/secrets`** (SecretsVault i DesktopView)
   - Använder **in-memory Map** (inte databas!)
   - För snabb åtkomst till secrets
   - **Problem**: Data går förlorad vid restart

2. **`/api/api-keys`** (APIKeyManager i Settings)
   - Använder **`api_keys` tabellen**
   - Har stöd för: `projectId`, `isShared`, `serviceName`, `keyType`
   - **Detta är huvudsystemet vi ska använda**

3. **`/api/credentials`** (CredentialVault i Settings)
   - Använder **`user_credentials` tabellen**
   - För OAuth credentials (Discord, Slack, etc.)
   - **Ska behållas för OAuth endast**

## ✅ Solution: Unified System

### 1. Migrate SecretsVault to use `api_keys`
- **Change**: `/api/secrets` → `/api/api-keys`
- **Benefit**: Alla API keys på ett ställe, persisterad i databas

### 2. Add Pre-built Connectors
Lägg till färdiga connectors i Integrations page:
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Vercel**: `VERCEL_TOKEN`, `VERCEL_TEAM_ID`
- **GitHub**: `GITHUB_TOKEN`
- **OpenAI**: `OPENAI_API_KEY`
- **Anthropic**: `ANTHROPIC_API_KEY`

### 3. Env Variable Management
- **For Shared Connectors**: Admins kan sätta env variables som är tillgängliga för alla
- **For Personal Connectors**: Användare kan sätta sina egna env variables
- **For Projects**: Project-specific env variables (för deployment)

### 4. Update CredentialVault
- **Rename**: "OAuth Credentials" (istället för "API Keys")
- **Keep**: Endast för OAuth credentials
- **Remove**: API key management (flytta till Connectors)

## 📋 Quick Implementation Plan

### Step 1: Update SecretsVault (DesktopView)
- Ändra från `/api/secrets` till `/api/api-keys`
- Visa alla användarens API keys (personal + project-specific)
- Filtrera på service/connector

### Step 2: Add Pre-built Connectors
- Lägg till Stripe, Vercel, GitHub, OpenAI, Anthropic i Integrations
- Varje connector har:
  - API key input fields
  - Env variable management
  - Status indicator

### Step 3: Add Env Variable Management
- Lägg till `envVariables` JSONB field i `shared_connectors` (om den finns) eller använd `api_keys` med `isShared: true`
- UI för att hantera env variables per connector

### Step 4: Update CredentialVault
- Visa endast OAuth credentials
- Ta bort API key management

## 🎯 User Flow After Changes

1. **Användare går till Integrations**
   - Ser alla connectors (Shared + Personal)
   - Klickar på "Stripe" → Konfigurerar API keys och env variables

2. **Användare öppnar Secrets Vault (DesktopView)**
   - Ser alla sina API keys på ett ställe
   - Kan filtrera på connector/service

3. **Användare går till Settings → OAuth Credentials**
   - Ser endast OAuth credentials (Discord, Slack, etc.)

## ⚠️ Important Notes

- **`/api/secrets` använder in-memory Map** - måste migreras till `api_keys`
- **`api_keys` tabellen har redan allt vi behöver** - `serviceName`, `isShared`, `projectId`, `keyType`
- **Ingen separat `shared_connectors` tabell** - använder `api_keys` med `isShared: true`

