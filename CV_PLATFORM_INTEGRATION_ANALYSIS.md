# CV-Analysplattform - Integration med Befintligt System

## 📊 Översikt

Denna analys visar hur CV-analysfunktionaliteten kan integreras med ert befintliga system.

---

## ✅ Vad Ni Redan Har (Kan Återanvändas)

### 1. **Backend-Infrastruktur** ✅
- ✅ PostgreSQL databas med Drizzle ORM (`db/schema-pg.ts`)
- ✅ Express.js backend med TypeScript
- ✅ User authentication system (`users`, `sessions` tables)
- ✅ File upload system via multer
- ✅ Cloudflare R2 storage service (`R2StorageService.ts`)
- ✅ Route-system med middleware för autentisering

### 2. **AI-integration** ✅
- ✅ Claude API integration (`@anthropic-ai/sdk`)
- ✅ AI services (`AICodeGenerator`, `PersonalAssistantAgent`, etc.)
- ✅ Multi-model support
- ✅ Token tracking och cost monitoring

### 3. **Frontend-Infrastruktur** ✅
- ✅ React + TypeScript
- ✅ Vite build system
- ✅ Tailwind CSS
- ✅ Radix UI components
- ✅ File upload UI patterns (från workspace systemet)

### 4. **Storage & Files** ✅
- ✅ R2StorageService för fil-lagring
- ✅ Project files system (`projectFiles` table)
- ✅ File metadata tracking

### 5. **API-integration** ✅
- ✅ Web search functionality (Google Custom Search, DuckDuckGo fallback)
- ✅ External API integration patterns
- ✅ OAuth system för externa tjänster

---

## ❌ Vad Som Behöver Byggas

### 1. **Database Schema** (Nya tabeller)

```sql
-- Resumes table
CREATE TABLE resumes (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(50), -- 'pdf', 'docx', 'doc'
  parsed_data JSONB, -- Strukturerad data från CV
  raw_text TEXT, -- Extrakterad text
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Resume analysis results
CREATE TABLE resume_analyses (
  id SERIAL PRIMARY KEY,
  resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL, -- 0-100
  ats_score INTEGER NOT NULL,
  content_score INTEGER NOT NULL,
  completeness_score INTEGER NOT NULL,
  keyword_score INTEGER NOT NULL,
  improvements JSONB, -- Array av förbättringsförslag
  analyzed_at TIMESTAMP DEFAULT NOW()
);

-- Job matches
CREATE TABLE job_matches (
  id SERIAL PRIMARY KEY,
  resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_title VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  location VARCHAR(255),
  match_percentage INTEGER NOT NULL, -- 0-100
  job_description TEXT,
  job_url TEXT,
  required_skills JSONB, -- Array av skills
  matched_skills JSONB, -- Array av matchade skills från CV
  matched_at TIMESTAMP DEFAULT NOW()
);

-- Job search queries (cache)
CREATE TABLE job_search_queries (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_keywords TEXT NOT NULL,
  location TEXT,
  results JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP -- Cache expiration
);
```

### 2. **Nya Dependencies** (package.json)

```json
{
  "dependencies": {
    // PDF parsing
    "pdf-parse": "^1.1.1",
    // DOCX parsing  
    "mammoth": "^1.6.0",
    // DOC parsing (optional, via LibreOffice eller online service)
    "docx": "^8.5.0"
  }
}
```

### 3. **Nya Services**

#### a) ResumeParserService
- `server/services/ResumeParserService.ts`
- Parsar PDF/DOCX filer
- Extraherar: kontaktinfo, erfarenhet, utbildning, skills
- Använder regex + AI för strukturerad parsing

#### b) ResumeScoringService  
- `server/services/ResumeScoringService.ts`
- Beräknar ATS-score, content-score, completeness-score
- Keyword matching
- Använder Claude API för kvalitativ analys

#### c) JobMatchingService
- `server/services/JobMatchingService.ts`
- Integrerar med svenska jobb-APIs (Arbetsförmedlingen, JobTech API)
- Keyword overlap beräkning
- Skill matching algorithm

### 4. **Nya Routes**

#### `server/routes/resumes.ts`
```typescript
POST   /api/resumes/upload          // Ladda upp CV
GET    /api/resumes                 // Lista alla CV:n för användare
GET    /api/resumes/:id             // Hämta specifikt CV
DELETE /api/resumes/:id             // Ta bort CV
POST   /api/resumes/:id/analyze     // Analysera CV
GET    /api/resumes/:id/analysis    // Hämta analysresultat
GET    /api/resumes/:id/job-matches // Hämta jobb-matchningar
POST   /api/resumes/:id/improve     // AI-powered förbättringsförslag
```

### 5. **Frontend Components**

#### Nya komponenter:
- `client/src/components/ResumeUpload.tsx` - File upload med drag & drop
- `client/src/components/ResumeAnalysis.tsx` - Visa analysresultat
- `client/src/components/ResumeScore.tsx` - Score visualization
- `client/src/components/JobMatches.tsx` - Visa matchade jobb
- `client/src/components/ResumeImprovements.tsx` - Förbättringsförslag
- `client/src/pages/Resumes.tsx` - Huvudsida för CV-hantering

---

## 🏗️ Implementation Roadmap

### Fas 1: Grundläggande CV-funktionalitet (Vecka 1-2)

1. **Database Setup**
   - ✅ Skapa migration för nya tabeller
   - ✅ Uppdatera `schema-pg.ts` med Drizzle definitions

2. **File Upload & Parsing**
   - ✅ Installera `pdf-parse` och `mammoth`
   - ✅ Skapa `ResumeParserService`
   - ✅ Implementera PDF/DOCX text extraction
   - ✅ Basic structured parsing (email, telefon, etc.)

3. **Basic API**
   - ✅ Skapa `/api/resumes` routes
   - ✅ File upload endpoint med multer
   - ✅ Store files i R2 eller local storage
   - ✅ Save metadata till databas

### Fas 2: Analys & Scoring (Vecka 3-4)

4. **Scoring Algorithm**
   - ✅ Skapa `ResumeScoringService`
   - ✅ Implementera ATS compatibility check
   - ✅ Content quality analysis med Claude API
   - ✅ Completeness scoring
   - ✅ Keyword density analysis

5. **Analysis Endpoints**
   - ✅ `/api/resumes/:id/analyze` endpoint
   - ✅ Store analysis results
   - ✅ Return detailed scores och improvements

### Fas 3: Job Matching (Vecka 5-6)

6. **Job Integration**
   - ✅ Research svenska jobb-APIs:
     - JobTech API (https://jobtechdev.se/)
     - Arbetsförmedlingen API
   - ✅ Skapa `JobMatchingService`
   - ✅ Implementera job search
   - ✅ Match algorithm (keywords, skills, experience)

7. **Match Endpoints**
   - ✅ `/api/resumes/:id/job-matches` endpoint
   - ✅ Cache job searches
   - ✅ Return matchade jobb med scores

### Fas 4: Frontend (Vecka 7-8)

8. **UI Components**
   - ✅ Resume upload interface
   - ✅ Analysis dashboard
   - ✅ Score visualization
   - ✅ Job matches list
   - ✅ Improvement suggestions UI

9. **Integration**
   - ✅ Integrera med befintlig routing
   - ✅ Add till navigation menu
   - ✅ User dashboard integration

---

## 🔌 Integration Points

### 1. **Använda R2StorageService**

```typescript
import { r2StorageService } from '../services/R2StorageService';

// Upload CV file
const filePath = `resumes/${userId}/${resumeId}/${filename}`;
const url = await r2StorageService.uploadFile(
  filePath,
  fileBuffer,
  file.mimetype
);
```

### 2. **Använda Claude API (via befintlig Anthropic client)**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Analysera CV med Claude
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 2000,
  messages: [{
    role: 'user',
    content: `Analysera detta CV och ge förbättringsförslag: ${resumeText}`
  }]
});
```

### 3. **Använda User Authentication**

```typescript
import { authenticateUser } from '../middleware/auth';

router.post('/upload', authenticateUser, async (req, res) => {
  const userId = req.user!.id;
  // ...
});
```

### 4. **Använda Usage Tracking**

```typescript
import { usageTracking } from '../services/UsageTrackingService';

// Track CV analysis usage
await usageTracking.track({
  userId,
  actionType: 'resume_analysis',
  tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  metadata: { resumeId, score: analysisResult.overallScore }
});
```

---

## 📋 Svenska Jobb-APIs

### JobTech API (Rekommenderad)
- **URL**: https://jobtechdev.se/api/jobs/search
- **Dokumentation**: https://jobtechdev.se/
- **Gratis**: Ja (med API-nyckel)
- **Features**: Sök jobb, filtrera på plats, kategori, etc.

### Arbetsförmedlingen API
- Kan kräva mer setup
- Ofta kräver registrering/API-nyckel

### Implementation:

```typescript
async function fetchSwedishJobs(keywords: string, location?: string) {
  const response = await axios.get('https://jobtechdev.se/api/jobs/search', {
    params: {
      q: keywords,
      ...(location && { location }),
      limit: 20
    },
    headers: {
      'api-key': process.env.JOBTECH_API_KEY // Om krävs
    }
  });
  
  return response.data.hits || [];
}
```

---

## 🎯 MVP Feature List (Prioriterad)

### Must Have (Launch Blockers)
1. ✅ Resume file upload (PDF/DOCX)
2. ✅ Basic resume parsing (text extraction)
3. ✅ Overall score calculation (0-100)
4. ✅ Top 3-5 improvement suggestions (via Claude)
5. ✅ Job matching med svenska jobb
6. ✅ User authentication integration

### Should Have (Viktigt men inte blockerande)
7. AI-powered content rewriting
8. Multiple resume versions
9. Export improved resume
10. Email notifications för job matches

### Nice to Have (Framtida releaser)
11. Cover letter generator
12. Interview preparation
13. Salary insights
14. Resume templates
15. Mobile app

---

## 🔒 Security Considerations

1. **File Upload Security**
   - ✅ Validera file types (endast PDF/DOCX)
   - ✅ Max file size limit (t.ex. 5MB)
   - ✅ Scan för malware (optional)
   - ✅ Sanitize filenamn

2. **Data Privacy**
   - ✅ CV-data är känslig PII
   - ✅ Encrypt stored files (R2 encryption at rest)
   - ✅ User kan ta bort sina CV:n
   - ✅ GDPR compliance (right to deletion)

3. **API Rate Limiting**
   - ✅ Limit CV analyses per user/day
   - ✅ Limit job searches per user/day
   - ✅ Använd befintlig `RateLimitService`

---

## 💰 Cost Estimation

### Storage (R2)
- 1000 CV:n × 500KB = ~500MB
- R2 storage: $0.015/GB/month ≈ **$0.0075/month**

### Claude API (Analysis)
- Per CV analysis: ~2000 tokens input + 1500 tokens output = 3500 tokens
- 1000 analyses/month: 3.5M tokens
- Claude Sonnet 4: ~$3 per 1M tokens
- **Cost: ~$10.50/month för 1000 analyser**

### Job Search API
- JobTech API: Gratis med API-nyckel
- Arbetsförmedlingen: Gratis (troligen)

**Total MVP cost: ~$15-20/month för 1000 användare**

---

## 🚀 Nästa Steg

1. **Review denna analys** med teamet
2. **Skapa GitHub issues** för varje fas
3. **Starta med Fas 1**: Database setup + File upload
4. **Iterativt bygga** en feature i taget
5. **Testa med riktiga CV:n** tidigt

---

## 📝 Exempel Implementation

Se separata filer:
- `CV_IMPLEMENTATION_PLAN.md` - Detaljerad implementation guide
- `RESUME_SERVICE_EXAMPLE.ts` - Exempel kod för ResumeService
- `DATABASE_MIGRATION.sql` - SQL migration script

