# LoopCV Analys och Rekommendationer för Vår App

## Datum: 2025-01-XX
## Analys av: https://loopcv.pro

---

## 🎯 LoopCV's Kärnfunktioner

### 1. **Automatiserad Jobbsökning ("Loops")**
- Användare skapar "loops" med jobbtitlar, platser och preferenser
- Systemet söker automatiskt på flera plattformar dagligen
- Avancerade filter: sökord, uteslutning av företag, etc.
- **Vårt nuvarande stöd**: Vi har `search_jobs` tool, men saknar:
  - Automatisk daglig sökning
  - "Loop"-konceptet (sparade sökningar)
  - Multi-plattform aggregering

### 2. **Automatisk Ansökan**
- AI fyller i ansökningsformulär automatiskt
- Alternativ: manuell granskning och "ansök med ett klick"
- **Vårt nuvarande stöd**: Vi har `adapt_resume` men saknar:
  - Automatisk formulärfyllning
  - "One-click apply" funktionalitet
  - Browser automation för ansökningsformulär

### 3. **Automatisk E-post till Rekryterare**
- Hittar rekryterarens e-postadress automatiskt
- Skickar personliga e-postmeddelanden
- Fördefinierade mallar + möjlighet att skapa egna
- **Vårt nuvarande stöd**: Vi har Gmail plugin men saknar:
  - E-postadress-sökning (enrichment)
  - Automatisk e-postgenerering baserat på jobbannons
  - E-postmallar för jobbansökningar

### 4. **Statistik och A/B-testning**
- Spårar: öppnade e-postmeddelanden, svar, CV-prestation
- A/B-testning av olika CV:n
- Testa olika nyckelord
- **Vårt nuvarande stöd**: Vi har `analyze_resume` men saknar:
  - E-post tracking (öppningar, klick)
  - CV A/B-testning
  - Statistisk dashboard
  - Prestanda-jämförelser mellan CV-versioner

### 5. **Jobbaggregator**
- Samlar jobb från flera plattformar
- Centraliserad vy över alla jobb
- **Vårt nuvarande stöd**: Vi har `search_jobs` men saknar:
  - Multi-källa aggregering
  - Centraliserad jobb-dashboard
  - Automatisk deduplicering

### 6. **AI-funktioner**
- AI CV Builder
- AI CV-kontroll
- AI Omslag Brev Generator
- AI-svar på rekryteringsfrågor
- AI-mockintervju
- **Vårt nuvarande stöd**: Vi har:
  - ✅ `create_resume_conversation` (AI CV Builder)
  - ✅ `analyze_resume` (AI CV-kontroll)
  - ✅ `adapt_resume` (anpassar CV)
  - ❌ Saknar: Omslag Brev Generator
  - ❌ Saknar: AI-svar på frågor
  - ❌ Saknar: Mockintervju

### 7. **Jobbansökning Tracker**
- Spårar alla ansökningar på ett ställe
- Status för varje ansökan
- **Vårt nuvarande stöd**: Vi saknar detta helt

---

## 💡 Rekommendationer för Vår App

### Prioritet 1: Högsta prioritet (Direkt konkurrenskraft)

#### 1.1 **Jobbansökning Tracker**
```typescript
// Ny databas-tabell
CREATE TABLE job_applications (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL,
  jobId INTEGER REFERENCES jobs(id),
  resumeId INTEGER REFERENCES resumes(id),
  status VARCHAR(50), // 'applied', 'viewed', 'interview', 'rejected', 'offer'
  appliedAt TIMESTAMP,
  companyName VARCHAR(255),
  jobTitle VARCHAR(255),
  applicationMethod VARCHAR(50), // 'email', 'form', 'linkedin'
  notes TEXT
);
```

**Funktioner:**
- Dashboard med alla ansökningar
- Status-tracking (ansökt → öppnad → intervju → erbjudande)
- Filter och sökning
- Integration med `search_jobs` och `adapt_resume`

#### 1.2 **E-post Enrichment & Automatisk E-post**
```typescript
// Ny service: EmailEnrichmentService
class EmailEnrichmentService {
  async findRecruiterEmail(companyName: string, jobTitle: string): Promise<string | null>
  async generateApplicationEmail(resume: Resume, job: Job): Promise<string>
  async sendApplicationEmail(to: string, subject: string, body: string, resume: File): Promise<boolean>
}
```

**Funktioner:**
- Hitta rekryterarens e-post via API (t.ex. Hunter.io, Clearbit)
- Generera personliga e-postmeddelanden med AI
- E-postmallar (fördefinierade + anpassade)
- Tracking av öppningar och svar (via tracking pixels)

#### 1.3 **"Loops" - Sparade Jobbsökningar**
```typescript
// Ny databas-tabell
CREATE TABLE job_search_loops (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL,
  name VARCHAR(255),
  jobTitles TEXT[], // Array av jobbtitlar
  locations TEXT[], // Array av platser
  keywords TEXT[],
  excludedCompanies TEXT[],
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP,
  lastRunAt TIMESTAMP
);
```

**Funktioner:**
- Skapa "loops" med jobbtitlar, platser, filter
- Automatisk daglig sökning (cron job)
- Notifikationer när nya jobb hittas
- Dashboard med alla loops och deras resultat

### Prioritet 2: Medel prioritet (Förbättrar användarupplevelse)

#### 2.1 **A/B-testning av CV:n**
```typescript
// Utöka resumes-tabellen
ALTER TABLE resumes ADD COLUMN abTestGroup VARCHAR(50);
ALTER TABLE resumes ADD COLUMN parentResumeId INTEGER REFERENCES resumes(id);

// Ny tabell för A/B-test statistik
CREATE TABLE resume_ab_test_stats (
  id SERIAL PRIMARY KEY,
  parentResumeId INTEGER REFERENCES resumes(id),
  variantResumeId INTEGER REFERENCES resumes(id),
  views INTEGER DEFAULT 0,
  applications INTEGER DEFAULT 0,
  interviews INTEGER DEFAULT 0,
  offers INTEGER DEFAULT 0
);
```

**Funktioner:**
- Skapa CV-varianter från samma bas-CV
- Spåra prestanda för varje variant
- Dashboard med jämförelser
- Rekommendationer baserat på data

#### 2.2 **Omslag Brev Generator**
```typescript
// Ny service: CoverLetterService
class CoverLetterService {
  async generateCoverLetter(resume: Resume, job: Job): Promise<string>
  async adaptCoverLetter(coverLetter: string, job: Job): Promise<string>
  async saveTemplate(userId: string, content: string, name: string): Promise<number>
}
```

**Funktioner:**
- AI-genererat omslagsbrev baserat på CV och jobbannons
- Mallar för olika typer av jobb
- Anpassning till specifika jobbannonser
- Integration med ansökningsprocessen

#### 2.3 **Jobbaggregator Dashboard**
```typescript
// Utöka jobs-tabellen
ALTER TABLE jobs ADD COLUMN source VARCHAR(50); // 'arbetsformedlingen', 'linkedin', 'indeed', etc.
ALTER TABLE jobs ADD COLUMN fetchedAt TIMESTAMP;
ALTER TABLE jobs ADD COLUMN isDuplicate BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN duplicateOf INTEGER REFERENCES jobs(id);
```

**Funktioner:**
- Aggregera jobb från flera källor
- Automatisk deduplicering
- Enhetlig vy över alla jobb
- Filter och sökning över alla källor

### Prioritet 3: Lägre prioritet (Nice-to-have)

#### 3.1 **AI Mockintervju**
```typescript
// Ny service: MockInterviewService
class MockInterviewService {
  async generateInterviewQuestions(job: Job, resume: Resume): Promise<string[]>
  async conductMockInterview(questions: string[], answers: string[]): Promise<Feedback>
  async provideFeedback(interview: Interview): Promise<string>
}
```

**Funktioner:**
- AI-genererade intervjufrågor baserat på jobbannons
- Interaktiv mockintervju via chatt
- Feedback och förbättringsförslag
- Övning inför riktiga intervjuer

#### 3.2 **AI-svar på Rekryteringsfrågor**
```typescript
// Utöka PersonalAssistantAgent med nytt tool
tool: answer_recruiter_question
description: "Svarar på vanliga rekryteringsfrågor baserat på användarens CV"
```

**Funktioner:**
- AI-genererade svar på vanliga intervjufrågor
- Anpassade efter användarens CV och erfarenhet
- Tips för hur man svarar professionellt

#### 3.3 **LinkedIn Auto-Apply Integration**
```typescript
// Integration med LinkedIn API
// Kräver: LinkedIn OAuth, browser automation
```

**Funktioner:**
- Automatisk ansökan via LinkedIn
- Browser automation för LinkedIn Easy Apply
- Integration med jobbansökning tracker

---

## 🏗️ Implementation Roadmap

### Fas 1: Grundläggande Tracking (2-3 veckor)
1. ✅ Jobbansökning Tracker (databas + API + UI)
2. ✅ Integration med befintliga tools (`search_jobs`, `adapt_resume`)
3. ✅ Dashboard för att se alla ansökningar

### Fas 2: Automatisering (3-4 veckor)
1. ✅ "Loops" - Sparade jobbsökningar
2. ✅ Automatisk daglig sökning (cron job)
3. ✅ E-post Enrichment Service
4. ✅ Automatisk e-postgenerering och sändning

### Fas 3: Avancerade Funktioner (4-5 veckor)
1. ✅ A/B-testning av CV:n
2. ✅ Omslag Brev Generator
3. ✅ Jobbaggregator med deduplicering
4. ✅ E-post tracking (öppningar, klick)

### Fas 4: AI-förbättringar (2-3 veckor)
1. ✅ AI Mockintervju
2. ✅ AI-svar på rekryteringsfrågor
3. ✅ Förbättrad AI för e-postgenerering

---

## 📊 Jämförelse: LoopCV vs Vår App

| Funktion | LoopCV | Vår App | Status |
|----------|--------|---------|--------|
| CV Upload & Parsing | ✅ | ✅ | ✅ Klar |
| AI CV Builder | ✅ | ✅ | ✅ Klar |
| AI CV Analysis | ✅ | ✅ | ✅ Klar |
| Jobb Matchning | ✅ | ✅ | ✅ Klar |
| CV Anpassning | ✅ | ✅ | ✅ Klar |
| PDF/LaTeX Export | ❌ | ✅ | ✅ Vi har mer! |
| Jobbansökning Tracker | ✅ | ❌ | 🔄 Rekommenderas |
| Automatisk Ansökan | ✅ | ❌ | 🔄 Rekommenderas |
| E-post till Rekryterare | ✅ | ❌ | 🔄 Rekommenderas |
| A/B-testning CV | ✅ | ❌ | 🔄 Rekommenderas |
| Omslag Brev Generator | ✅ | ❌ | 🔄 Rekommenderas |
| Jobbaggregator | ✅ | ⚠️ | ⚠️ Delvis |
| Mockintervju | ✅ | ❌ | 🔄 Rekommenderas |
| Statistik Dashboard | ✅ | ⚠️ | ⚠️ Begränsat |

---

## 🎯 Unika Fördelar Vi Har

1. **LaTeX Export** - LoopCV har inte detta
2. **Discord Integration** - LoopCV har inte detta
3. **OmniAssistant (Elon)** - Vår AI-assistent är mer integrerad
4. **Konversationsbaserad CV-skapande** - Mer naturlig än LoopCV's formulär

---

## 🚀 Nästa Steg

1. **Börja med Jobbansökning Tracker** - Detta är grunden för allt annat
2. **Implementera "Loops"** - Detta är LoopCV's kärnkoncept
3. **E-post Enrichment** - Detta ger stort värde för användare
4. **A/B-testning** - Detta differentierar oss från konkurrenter

---

## 📝 Tekniska Detaljer

### Databas Schema Förslag

```sql
-- Jobbansökningar
CREATE TABLE job_applications (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id),
  jobId INTEGER REFERENCES jobs(id),
  resumeId INTEGER REFERENCES resumes(id),
  status VARCHAR(50) NOT NULL DEFAULT 'applied',
  appliedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  companyName VARCHAR(255),
  jobTitle VARCHAR(255),
  applicationMethod VARCHAR(50),
  emailSent BOOLEAN DEFAULT false,
  emailOpened BOOLEAN DEFAULT false,
  emailReplied BOOLEAN DEFAULT false,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Jobbsökningar (Loops)
CREATE TABLE job_search_loops (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  jobTitles TEXT[] NOT NULL,
  locations TEXT[] NOT NULL,
  keywords TEXT[],
  excludedCompanies TEXT[],
  excludedKeywords TEXT[],
  isActive BOOLEAN DEFAULT true,
  autoApply BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW(),
  lastRunAt TIMESTAMP,
  nextRunAt TIMESTAMP
);

-- E-postmallar
CREATE TABLE email_templates (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  body TEXT NOT NULL,
  isDefault BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- A/B-test statistik
CREATE TABLE resume_ab_tests (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id),
  parentResumeId INTEGER NOT NULL REFERENCES resumes(id),
  variantResumeId INTEGER NOT NULL REFERENCES resumes(id),
  testName VARCHAR(255),
  startedAt TIMESTAMP DEFAULT NOW(),
  endedAt TIMESTAMP,
  views INTEGER DEFAULT 0,
  applications INTEGER DEFAULT 0,
  interviews INTEGER DEFAULT 0,
  offers INTEGER DEFAULT 0
);
```

---

## 💬 Användarfeedback LoopCV

Baserat på deras hemsida:
- **25k+ användare** har hittat jobb
- Fokus på **automatisering** och **tidsbesparing**
- **3x fler intervjuer** (deras claim)
- **Börja gratis** - freemium modell

**Våra fördelar:**
- Vi har redan bättre CV-funktionalitet (LaTeX, fler templates)
- Vi har Discord-integration (unik)
- Vi har mer avancerad AI (OmniAssistant)
- Vi kan bygga på vår befintliga styrka

---

## ✅ Slutsats

LoopCV är en stark konkurrent, men vi har redan många av deras funktioner. Genom att lägga till:
1. Jobbansökning Tracker
2. Automatisk ansökan och e-post
3. A/B-testning
4. Omslag Brev Generator

...så kan vi matcha eller överträffa LoopCV's funktionalitet, samtidigt som vi behåller våra unika fördelar (LaTeX, Discord, OmniAssistant).

