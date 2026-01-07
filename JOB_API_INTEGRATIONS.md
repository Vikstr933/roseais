# Jobb-API:er och Integrationsmöjligheter

Detta dokument beskriver tillgängliga jobb-API:er och integrationsmöjligheter för att visa fler jobb på plattformen.

## Nuvarande Integrationer

### ✅ JobTech API (Aktiv)
- **Status**: Aktiv och fungerar
- **Omfattning**: Svenska jobb från flera källor
- **API**: Gratis, ingen API-nyckel krävs för grundläggande sökningar
- **Dokumentation**: https://jobtechdev.se/
- **Fördelar**:
  - Strukturerade skills (must_have, nice_to_have)
  - Omfattande täckning av svenska jobb
  - Geolokalisering och filtrering
  - Application details (email, URL, via_af)

### ⏸️ LinkedIn (Temporärt inaktiverad)
- **Status**: Förberedd men inaktiverad
- **Anledning**: LinkedIn Job Search API är deprecated
- **Alternativ**: Web scraping (kräver Playwright/Puppeteer)
- **Fördelar**: Internationella jobb, stort utbud

---

## Ytterligare Jobb-API:er att Integrera

### 1. Arbetsförmedlingen API
**Status**: ⚠️ Begränsad tillgänglighet

- **Beskrivning**: Sveriges officiella jobbportal
- **API**: Begränsat offentligt API (kan kräva särskilt avtal)
- **Dokumentation**: Kontakta Arbetsförmedlingen för API-åtkomst
- **Fördelar**:
  - Officiell källa för svenska jobb
  - Omfattande täckning
  - Strukturerad data
- **Nackdelar**:
  - Kan kräva avtal/partnerskap
  - Begränsad dokumentation
- **Implementation**: Kräver kontakt med Arbetsförmedlingen för API-åtkomst

### 2. Adzuna API
**Status**: ✅ Gratis tier tillgänglig

- **Beskrivning**: Jobb-aggregator som samlar jobb från flera källor
- **API**: Gratis tier med begränsningar
- **Dokumentation**: https://developer.adzuna.com/
- **Fördelar**:
  - Internationella jobb (inkl. Sverige)
  - Gratis tier (1000 requests/månad)
  - Enkel integration
  - JSON API
- **Nackdelar**:
  - Begränsningar på gratis tier
  - Kan innehålla duplicerade jobb från JobTech
- **Implementation**: 
  ```typescript
  // Exempel
  const response = await axios.get('https://api.adzuna.com/v1/api/jobs/se/search/1', {
    params: {
      app_id: process.env.ADZUNA_APP_ID,
      app_key: process.env.ADZUNA_APP_KEY,
      results_per_page: 50,
      what: keywords,
      where: location
    }
  });
  ```

### 3. Reed API (UK/EU)
**Status**: ✅ Tillgänglig

- **Beskrivning**: Största jobbportalen i UK, expanderar i EU
- **API**: Gratis tier tillgänglig
- **Dokumentation**: https://www.reed.co.uk/developers
- **Fördelar**:
  - Stort utbud i UK
  - Gratis API-tier
  - Bra för internationella jobb
- **Nackdelar**:
  - Primärt UK-fokuserad
  - Begränsad svensk täckning
- **Implementation**: Kräver API-nyckel från Reed

### 4. Indeed API
**Status**: ⚠️ Begränsad tillgänglighet

- **Beskrivning**: En av världens största jobbportaler
- **API**: Indeed Publisher API (kräver godkännande)
- **Dokumentation**: https://ads.indeed.com/jobroll/xmlfeed
- **Fördelar**:
  - Omfattande täckning
  - Internationella jobb
- **Nackdelar**:
  - Kräver godkännande som publisher
  - XML-baserat (inte JSON)
  - Kan vara komplext att integrera
- **Implementation**: Kräver publisher-konto och godkännande

### 5. StepStone API
**Status**: ⚠️ Begränsad tillgänglighet

- **Beskrivning**: Största jobbportalen i Tyskland, aktiv i flera EU-länder
- **API**: Partner API (kräver partnerskap)
- **Fördelar**:
  - Stort utbud i Tyskland och EU
  - Strukturerad data
- **Nackdelar**:
  - Kräver partnerskap
  - Begränsad svensk täckning
- **Implementation**: Kräver kontakt med StepStone för partnerskap

### 6. Academic Work API
**Status**: ❓ Okänt

- **Beskrivning**: Svensk jobbportal fokuserad på akademiker och unga talanger
- **API**: Kontakta Academic Work för API-åtkomst
- **Fördelar**:
  - Svensk fokus
  - Bra för akademiker och unga talanger
- **Nackdelar**:
  - Okänt om API finns tillgängligt
  - Begränsad till specifika målgrupper
- **Implementation**: Kräver kontakt med Academic Work

### 7. Monster API
**Status**: ⚠️ Begränsad tillgänglighet

- **Beskrivning**: Global jobbportal
- **API**: Monster Search API (kräver partnerskap)
- **Fördelar**:
  - Global täckning
  - Stort utbud
- **Nackdelar**:
  - Kräver partnerskap
  - Begränsad svensk täckning
- **Implementation**: Kräver kontakt med Monster för partnerskap

---

## Web Scraping som Alternativ

För jobbportaler utan API kan web scraping användas:

### LinkedIn (via Scraping)
- **Status**: ⚠️ Komplext, risk för blockering
- **Verktyg**: Playwright, Puppeteer
- **Fördelar**: Stort utbud av jobb
- **Nackdelar**:
  - Bryter mot LinkedIn ToS
  - Risk för IP-blockering
  - Kräver hantering av inloggning
  - Komplext att underhålla
- **Rekommendation**: Inte rekommenderat för produktion

### Arbetsförmedlingen (via Scraping)
- **Status**: ⚠️ Komplext, risk för blockering
- **Verktyg**: Playwright, Puppeteer
- **Fördelar**: Omfattande svenska jobb
- **Nackdelar**:
  - Kan bryta mot ToS
  - Risk för blockering
  - Kräver regelbundna uppdateringar
- **Rekommendation**: Kontakta Arbetsförmedlingen för API istället

### Blocket Jobb (via Scraping)
- **Status**: ⚠️ Möjligt men riskfyllt
- **Beskrivning**: Svensk jobbportal
- **Fördelar**: Svensk fokus
- **Nackdelar**: Samma risker som ovan

---

## Rekommenderad Implementation-Ordning

### Prioritet 1: Adzuna API ⭐
**Varför**: 
- Enkel integration
- Gratis tier
- Internationella jobb
- JSON API
- Snabb att implementera

**Implementation-steg**:
1. Registrera konto på Adzuna Developer Portal
2. Hämta App ID och App Key
3. Skapa `AdzunaJobService.ts` (liknande `JobMatchingService.ts`)
4. Integrera i `JobMatchingService.searchJobs()`
5. Lägg till deduplicering (kan ha överlapp med JobTech)

### Prioritet 2: Arbetsförmedlingen API
**Varför**:
- Officiell källa
- Omfattande svenska jobb
- Strukturerad data

**Implementation-steg**:
1. Kontakta Arbetsförmedlingen för API-åtkomst
2. Få API-nyckel/autentisering
3. Skapa `ArbetsformedlingenJobService.ts`
4. Integrera i `JobMatchingService.searchJobs()`

### ✅ Reed API (Implementerad)
**Status**: Implementerad och redo att användas
**Varför**:
- Bra för UK/EU jobb
- Gratis tier
- Kompletterar svenska jobb

**Konfiguration**:
1. Lägg till i `.env`:
   ```env
   REED_API_KEY=d56f6e8f-edfd-46f5-aeb7-a7695e28b050
   ENABLE_REED=true
   ```
2. Använd i API-anrop:
   ```
   GET /api/resumes/:id/job-matches?sources=jobtech,adzuna,reed
   ```

---

## Teknisk Implementation

### Arkitektur för Multi-Source Job Search

```typescript
// server/services/JobMatchingService.ts
export class JobMatchingService {
  private sources: Map<string, JobSource> = new Map();

  constructor() {
    // Registrera alla jobbkällor
    this.sources.set('jobtech', new JobTechSource());
    this.sources.set('adzuna', new AdzunaSource());
    this.sources.set('reed', new ReedSource());
    // ... fler källor
  }

  async searchJobs(
    keywords: string,
    location?: string,
    limit: number = 100,
    sources?: string[]
  ): Promise<JobListing[]> {
    const searchSources = sources || ['jobtech', 'adzuna']; // Default sources
    
    // Sök parallellt från alla källor
    const searchPromises = searchSources
      .filter(source => this.sources.has(source))
      .map(source => 
        this.sources.get(source)!.search(keywords, location, limit)
          .catch(error => {
            logger.error(`Failed to search ${source}`, error);
            return []; // Returnera tom array vid fel
          })
      );

    const results = await Promise.all(searchPromises);
    const allJobs = results.flat();

    // Deduplicera jobb (baserat på title + company)
    const uniqueJobs = this.removeDuplicateJobs(allJobs);

    // Sortera och begränsa
    return uniqueJobs.slice(0, limit);
  }
}
```

### Interface för Job Sources

```typescript
interface JobSource {
  search(keywords: string, location?: string, limit?: number): Promise<JobListing[]>;
  isConfigured(): boolean;
  getName(): string;
}
```

### Deduplicering

```typescript
private removeDuplicateJobs(jobs: JobListing[]): JobListing[] {
  const seen = new Set<string>();
  const unique: JobListing[] = [];

  for (const job of jobs) {
    // Skapa unik nyckel baserat på title + company + location
    const key = `${job.title.toLowerCase()}_${job.company?.toLowerCase() || ''}_${job.location?.toLowerCase() || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(job);
    }
  }

  return unique;
}
```

---

## Miljövariabler

Lägg till i `.env`:

```env
# Adzuna API
ADZUNA_APP_ID=1fcd4908
ADZUNA_APP_KEY=9303564ef0c5d6509f8d0f0c1ffb363e
ENABLE_ADZUNA=true

# Reed API
REED_API_KEY=d56f6e8f-edfd-46f5-aeb7-a7695e28b050
ENABLE_REED=true

# Arbetsförmedlingen API (om tillgängligt)
ARBETSFORMEDLINGEN_API_KEY=your_api_key
ENABLE_ARBETSFORMEDLINGEN=false

# LinkedIn (temporärt inaktiverad)
ENABLE_LINKEDIN_JOBS=false
```

---

## Kostnader och Begränsningar

### Gratis Tiers
- **JobTech**: Obegränsat (ingen API-nyckel)
- **Adzuna**: 1000 requests/månad
- **Reed**: Varierar (kolla dokumentation)

### Betalda Tiers
- **Adzuna**: Från $99/månad för fler requests
- **Reed**: Kontakta för priser
- **Indeed**: Varierar beroende på användning

---

## Rekommendationer

1. **Starta med Adzuna**: Enkel integration, gratis tier, bra täckning
2. **Kontakta Arbetsförmedlingen**: För officiell svensk källa
3. **Undvik web scraping**: Riskfyllt och svårt att underhålla
4. **Implementera deduplicering**: Viktigt när flera källor används
5. **Hantera fel gracefully**: Om en källa misslyckas, fortsätt med andra
6. **Caching**: Överväg att cach:a resultat för att minska API-anrop
7. **Rate limiting**: Respektera rate limits för varje API

---

## Nästa Steg

1. ✅ **Adzuna API implementerad** - Konfigurera med API-nycklar
2. ✅ **Reed API implementerad** - Konfigurera med API-nyckel
3. ✅ **Deduplicering implementerad** - Automatisk borttagning av dubbletter
4. ✅ **Standardbeteende uppdaterat** - JobTech och Adzuna används tillsammans som standard
5. **Kontakta Arbetsförmedlingen** för API-åtkomst (valfritt)
6. **Överväg fler källor** (Indeed, StepStone) om behov finns

---

## Uppdateringar

- **2025-01-XX**: Dokument skapat
- **2025-01-XX**: LinkedIn temporärt inaktiverad
- **Framtida**: Adzuna integration planerad

