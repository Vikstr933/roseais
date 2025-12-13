# User Settings - Konfliktanalys

## Problem: Förvirrande överlappning

### Nuvarande struktur (FÖRVIRRANDE):
1. **Connectors** tab
   - Shared Connectors (Stripe, Vercel, GitHub)
   - Personal Connectors (Notion, Linear)

2. **API Keys** tab
   - Översikt av projekt-API-nycklar

3. **OAuth** tab (tidigare "Credentials")
   - OAuth credentials från CredentialVault

4. **Secrets Vault** (Desktop app)
   - User secrets/API keys
   - Helt separerat system

### Varför detta är förvirrande:
- ❌ 4 olika ställen för "nycklar och credentials"
- ❌ Användare vet inte skillnaden mellan Connectors, API Keys, OAuth, Secrets
- ❌ Samma funktionalitet duplicerad
- ❌ Ingen tydlig logik för vad som går var

---

## Lösning: Konsoliderad "Credentials & Keys" flik

### Ny struktur (TYDLIG):

```
Settings (Vertical Tabs)
├─ Account
├─ Security
├─ Credentials & Keys  ← ALLA nycklar här!
│  ├─ Shared Connectors (admin-configured)
│  ├─ Personal Connectors (OAuth)
│  ├─ Project API Keys (översikt)
│  └─ Personal Secrets (från Secrets Vault)
├─ Company
├─ Billing
└─ Preferences
```

### Varför detta är bättre:
- ✅ EN plats för allt som rör autentisering/nycklar
- ✅ Tydliga sektioner med förklaringar
- ✅ Vertical tabs = mer plats för innehåll
- ✅ Logisk gruppering

---

## Detaljerad layout: "Credentials & Keys"

### Section 1: Shared Connectors
**Vem ser:** Alla (admins kan konfigurera)
**Innehåll:** 
- Stripe, Vercel, GitHub, osv. (workspace-wide)
- Konfigurerad av admin
- Tillgänglig för alla projekt

### Section 2: Personal Connectors  
**Vem ser:** Alla
**Innehåll:**
- Notion, Linear, Miro (OAuth-baserade)
- Användarens personliga anslutningar
- Används i alla användarens projekt

### Section 3: Project API Keys
**Vem ser:** Alla
**Innehåll:**
- Tabell: Vilket projekt använder vilka nycklar
- Länka till Project Settings för att hantera

### Section 4: Personal Secrets
**Vem ser:** Alla
**Innehåll:**
- Användarens privata API-nycklar (från Secrets Vault)
- Används som fallback när projekt saknar specifika nycklar
- Migrerad från Secrets Vault desktop app

---

## Migration Plan

### Steg 1: Konsolidera komponenter
- Skapa `CredentialsAndKeysSettings.tsx`
- Kombinera ConnectorsSettings + APIKeysSettings + CredentialVault content
- Ta bort separata tabs

### Steg 2: Ändra till Vertical Layout
- Tabs på vänster sida
- Mer utrymme för innehåll till höger
- Bättre för många tabs

### Steg 3: Uppdatera Navigation
- Ta bort SecretsVault från desktop apps (duplicerat)
- Eller länka till Settings istället

---

## Ny Tab-struktur

### Behåll (6 tabs):
1. ✅ **Account** - Profil, email
2. ✅ **Security** - Lösenord, 2FA
3. ✅ **Credentials & Keys** - ALLT som rör nycklar (konsoliderad)
4. ✅ **Company** - Företagsinfo
5. ✅ **Billing** - Fakturering
6. ✅ **Preferences** - Tema, notifikationer

### Ta bort (överlappande):
- ❌ Connectors tab (flyttat till Credentials & Keys)
- ❌ API Keys tab (flyttat till Credentials & Keys)
- ❌ OAuth tab (flyttat till Credentials & Keys)

---

## Visual Layout

```
┌─────────────────────────────────────────────────────┐
│  Settings                                            │
├───────────────┬─────────────────────────────────────┤
│               │                                      │
│  Account      │  [Content for selected tab]         │
│  Security     │                                      │
│ ▶Credentials  │  ┌─ Shared Connectors ─────────┐   │
│  Company      │  │ ⚡ Stripe (Active)           │   │
│  Billing      │  │ 🚀 Vercel (Active)           │   │
│  Preferences  │  └──────────────────────────────┘   │
│               │                                      │
│               │  ┌─ Personal Connectors ────────┐   │
│               │  │ 📝 Notion (Connected)        │   │
│               │  │ 📊 Linear (Connected)        │   │
│               │  └──────────────────────────────┘   │
│               │                                      │
│               │  ┌─ Project API Keys ───────────┐   │
│               │  │ Table with all project keys  │   │
│               │  └──────────────────────────────┘   │
│               │                                      │
│               │  ┌─ Personal Secrets ───────────┐   │
│               │  │ Your private API keys        │   │
│               │  └──────────────────────────────┘   │
│               │                                      │
└───────────────┴─────────────────────────────────────┘
```

---

## Implementation Checklist

- [ ] Create `CredentialsAndKeysSettings.tsx` (consolidate all)
- [ ] Update `Settings.tsx` to use vertical layout
- [ ] Remove old separate tabs (Connectors, API Keys, OAuth)
- [ ] Update navigation links
- [ ] Test user flow
- [ ] Create Project Settings Dialog

