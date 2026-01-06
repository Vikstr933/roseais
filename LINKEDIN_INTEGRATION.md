# LinkedIn Integration Guide

## ⚠️ STATUS: INAKTIVERAD TILLSVIDARE

**LinkedIn-integrationen är för närvarande inaktiverad i systemet.**

För att aktivera igen, ändra följande:
- `server/services/LinkedInJobService.ts`: Sätt `LINKEDIN_DISABLED = false`
- `server/services/LinkedInAWLIService.ts`: Sätt `LINKEDIN_AWLI_DISABLED = false`
- `server/services/JobMatchingService.ts`: Ändra `this.useLinkedIn = false` till `this.useLinkedIn = process.env.ENABLE_LINKEDIN_JOBS === 'true'`
- `server/services/AutoApplyService.ts`: Avkommentera LinkedIn-koden

## Översikt

Detta dokument beskriver hur man konfigurerar LinkedIn-integrationer i systemet. Det finns två huvudfunktioner:

1. **LinkedIn Job Search** - Söka jobb från LinkedIn
2. **Apply with LinkedIn (AWLI)** - Förenkla ansökningsprocessen med LinkedIn-profil

## Viktigt: LinkedIn API-status

⚠️ **LinkedIn Job Search API**: LinkedIn har tagit bort sitt publika Job Search API (2023). Denna integration är förberedd för framtida API.

⚠️ **Apply with LinkedIn (AWLI)**: LinkedIn accepterar för närvarande **inte nya partners** för AWLI. Denna integration är förberedd för när tillgång beviljas.

## Konfiguration

### 1. LinkedIn API-nycklar

För att använda LinkedIn Job Search (när API blir tillgängligt), behöver du:

1. **Skapa en LinkedIn-applikation:**
   - Gå till [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
   - Klicka på "My Apps" → "Create App"
   - Fyll i applikationsinformation
   - Under "Auth"-fliken hittar du:
     - **Client ID** (API-nyckel)
     - **Client Secret**

2. **Lägg till environment variables:**

Lägg till följande i din `.env`-fil eller server environment:

```bash
# LinkedIn API Configuration
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here

# Enable LinkedIn job search (set to 'true' to enable)
ENABLE_LINKEDIN_JOBS=true
```

### 2. OAuth 2.0 Setup

LinkedIn kräver OAuth 2.0-autentisering. Du behöver:

1. **Konfigurera Redirect URL:**
   - I LinkedIn Developer Portal, under "Auth"
   - Lägg till: `https://yourdomain.com/api/plugins/linkedin/callback`
   - För lokal utveckling: `http://localhost:3001/api/plugins/linkedin/callback`

2. **Requested Scopes:**
   - `r_liteprofile` - Basic profile access
   - `r_emailaddress` - Email access
   - `r_jobsearch` - Job search access (om tillgängligt)

## Var API-nycklarna hanteras

### Backend (Server)

API-nycklarna läses från environment variables i:
- `server/services/LinkedInJobService.ts` - Läser `LINKEDIN_CLIENT_ID` och `LINKEDIN_CLIENT_SECRET`
- `server/services/JobMatchingService.ts` - Kontrollerar `ENABLE_LINKEDIN_JOBS` för att aktivera LinkedIn-sökning

### Säkerhet

⚠️ **VIKTIGT:**
- **ALDRIG** committa API-nycklar till Git
- Använd environment variables eller secrets management
- I produktion: Använd Render/Vercel environment variables eller liknande

## Hur det fungerar

### Jobbsökning

1. **JobMatchingService** söker från flera källor:
   - JobTech (svenska jobb) - alltid aktiverat
   - LinkedIn (om konfigurerat) - valfritt

2. **AutoApplyService** använder kombinerade resultat:
   - Söker från båda källor om LinkedIn är aktiverat
   - Kombinerar och deduplicerar resultat
   - Filtrerar enligt användarens kriterier

### Ansökningsmetoder

- **Email**: Skickas automatiskt via Gmail-plugin med PDF-bilaga
- **LinkedIn**: Spåras i systemet, kräver manuell ansökan (tills LinkedIn API är tillgängligt)
- **Website/Form**: Spåras i systemet, kräver manuell ansökan

## Aktuell Status

- ✅ LinkedInJobService skapad
- ✅ Integration med JobMatchingService
- ✅ Environment variable-konfiguration
- ⚠️ OAuth 2.0 flow - TODO (kräver användarautentisering)
- ⚠️ LinkedIn API - Inte tillgängligt (deprecated 2023)

## Apply with LinkedIn (AWLI)

### Översikt

AWLI låter jobbsökare ansöka till jobb med sin LinkedIn-profil, vilket förenklar ansökningsprocessen genom att automatiskt fylla i formulär med profilinformation.

### Konfiguration

Lägg till följande environment variables:

```bash
# LinkedIn AWLI Configuration
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_AWLI_REDIRECT_URI=https://yourdomain.com/api/linkedin/awli/callback
LINKEDIN_AWLI_SCOPES=openid,profile,email
```

### OAuth 2.0 Setup

1. **Konfigurera Redirect URL i LinkedIn Developer Portal:**
   - Gå till din LinkedIn-applikation
   - Under "Auth" → "Redirect URLs"
   - Lägg till: `https://yourdomain.com/api/linkedin/awli/callback`
   - För lokal utveckling: `http://localhost:3001/api/linkedin/awli/callback`

2. **Requested Scopes:**
   - `openid` - OpenID Connect authentication
   - `profile` - Basic profile information
   - `email` - Email address

### Användning

1. **Frontend-komponent:**
   ```tsx
   import { LinkedInAWLIButton } from '@/components/LinkedInAWLIButton';
   
   <LinkedInAWLIButton
     jobId="job-123"
     jobTitle="Software Engineer"
     companyName="Tech Corp"
     onSuccess={(profileData) => {
       // Pre-populate form with profileData
       setFormData({
         firstName: profileData.firstName,
         lastName: profileData.lastName,
         email: profileData.email,
         // ... etc
       });
     }}
   />
   ```

2. **OAuth Flow:**
   - Användare klickar på "Ansök med LinkedIn"-knappen
   - Omdirigeras till LinkedIn för autentisering
   - Ger tillstånd att dela profilinformation
   - Omdirigeras tillbaka med profil-data
   - Formulär fylls automatiskt i

### API Endpoints

- `GET /api/linkedin/awli/status` - Kontrollera om AWLI är tillgängligt
- `POST /api/linkedin/awli/initiate` - Initiera OAuth-flow
- `GET /api/linkedin/awli/callback` - OAuth callback handler
- `GET /api/linkedin/awli/profile` - Hämta profil-data

### Var AWLI hanteras

- **Frontend**: `client/src/components/LinkedInAWLIButton.tsx`
- **Backend Service**: `server/services/LinkedInAWLIService.ts`
- **Backend Routes**: `server/routes/linkedin-awli.ts`

## Nästa Steg

### För Job Search:
1. **När LinkedIn API blir tillgängligt:**
   - Implementera OAuth 2.0 flow
   - Implementera token refresh
   - Testa API-anrop

2. **Alternativ: Web Scraping (med varningar):**
   - Implementera med Playwright/Puppeteer
   - Rate limiting (max 1 request/5 sekunder)
   - Tydliga ToS-varningar
   - Användarconsent krävs

### För AWLI:
1. **När LinkedIn beviljar tillgång:**
   - Fyll i Onboarding Request Form
   - Implementera Module 1 (Customer Applications & ATS Integrations) - om partner
   - Implementera Module 2 (Apply with LinkedIn Plugin)
   - Genomför certifiering enligt LinkedIn's test cases
   - Demo i certifieringsinspelningar

## Felsökning

### LinkedIn returnerar inga jobb

1. Kontrollera att `ENABLE_LINKEDIN_JOBS=true` är satt
2. Kontrollera att `LINKEDIN_CLIENT_ID` och `LINKEDIN_CLIENT_SECRET` är korrekt
3. Kontrollera att OAuth-token är giltig (om implementerat)
4. LinkedIn API kan vara otillgängligt (deprecated)

### API-nycklar fungerar inte

1. Verifiera att nycklarna är korrekta i LinkedIn Developer Portal
2. Kontrollera att Redirect URL matchar exakt
3. Verifiera att scopes är korrekt konfigurerade
4. Kontrollera att applikationen inte är pausad i LinkedIn Developer Portal

