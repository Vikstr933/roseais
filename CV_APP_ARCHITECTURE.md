# Workme CV-App Arkitektur & Flöde

## Översikt
Workme är en AI-driven karriärcoach-app som hjälper användare att analysera CV:n, hitta matchade jobb, anpassa CV:n och spåra jobbansökningar.

## Systemarkitektur

### Backend (Node.js + Express + PostgreSQL)

#### Databas-schema (PostgreSQL via Drizzle ORM)
1. **`users`** - Användarkonton
2. **`resumes`** - Uppladdade CV:n med parsed data
3. **`resume_analyses`** - AI-analys av CV:n (ATS-score, förbättringsförslag)
4. **`job_matches`** - Matchade jobb baserat på CV
5. **`job_applications`** - Spårade ansökningar med status
6. **`saved_jobs`** - Bokmärkta jobb

#### API Routes
- `/api/resumes` - CV-uppladdning, analys, anpassning
- `/api/job-applications` - Skapa, uppdatera, hämta ansökningar
- `/api/job-applications/stats` - Statistik över ansökningar
- `/api/saved-jobs` - Spara/ta bort bokmärkta jobb
- `/api/auto-apply` - Auto-ansökningsinställningar

#### Services
- `ResumeParserService` - Parsar PDF/DOCX till text
- `ResumeScoringService` - AI-analys och poängsättning
- `JobMatchingService` - Matchar CV mot jobbannonser
- `ResumeAdaptationService` - Anpassar CV för specifika jobb
- `JobApplicationService` - Hanterar ansökningsstatus
- `AutoApplyService` - Automatiserar ansökningar

### Frontend (React + TypeScript)

#### Huvudkomponenter
- `ResumeAnalysisApp.tsx` - Huvudapplikation
- `WorkmeLanding.tsx` - Landningssida (upload/create CV)
- `CVBuilderForm.tsx` - Steg-för-steg CV-byggare
- `JobFeed.tsx` - Jobblista med sök/filter
- `ApplicationDashboard.tsx` - Ansöknings-tracker
- `AutoApplySettings.tsx` - Auto-ansökningsinställningar

## Användarflöde

### 1. Start (Inget CV)
**Landningssida** (`WorkmeLanding`)
- Val: "Jag har ett CV" → Upload
- Val: "Skapa nytt CV" → CV-byggare

### 2. CV Uppladdat
**Huvudvy** (`ResumeAnalysisApp`)
- Snabbstart-kort (3 steg: Analysera → Anpassa → Logga)
- ROI-statistik (ansökningar, matcher, intervjuer, erbjudanden)
- CV Upload-sektion (om inget CV)

### 3. CV Analyserat
- CV-poäng och kategorier (ATS, Innehåll, Nyckelord, etc.)
- Jobb-matchningar (JobFeed)
- Förbättringsförslag

### 4. Jobbansökningar
- **Logga Ansökan**: När användare klickar "Logga Ansökan" → sparas i `job_applications` med status `'applied'`
- **Tracker**: Alla ansökningar visas i `ApplicationDashboard`
- **Status-uppdatering**: Användare måste manuellt uppdatera status (intervju, erbjudande, etc.)

## Status-hantering - Nuvarande Problem

### Problem
Systemet kan **INTE** automatiskt veta om användare fått:
- Intervju
- Erbjudande
- Avslag

### Lösning: Manuell Status-uppdatering
Användare måste själva uppdatera status när de får svar. Detta är standard i branschen eftersom:
1. Rekryterare kontaktar via olika kanaler (email, telefon, LinkedIn)
2. Det finns ingen universell API för att spåra ansökningsstatus
3. Integritet - användare kontrollerar sin egen data

### Implementering
1. **UI för status-uppdatering** i `ApplicationDashboard`
2. **Dropdown/Select** för att ändra status
3. **Datum-fält** för intervjudatum
4. **Noter-fält** för att spara information

## Databas-schema för Job Applications

```sql
job_applications:
- id (PK)
- user_id (FK → users)
- resume_id (FK → resumes, nullable)
- status: 'applied' | 'viewed' | 'interview' | 'rejected' | 'offer' | 'accepted' | 'declined'
- applied_at (timestamp)
- company_name
- job_title
- location
- application_method: 'email' | 'form' | 'linkedin' | 'website' | 'manual'
- job_url
- recruiter_email
- email_sent, email_opened, email_replied (boolean + timestamps)
- interview_scheduled (boolean)
- interview_date (timestamp)
- notes (text)
- created_at, updated_at
```

## API Endpoints

### GET `/api/job-applications`
Hämta alla ansökningar för användaren

### POST `/api/job-applications`
Skapa ny ansökan (status: 'applied')

### PATCH `/api/job-applications/:id`
Uppdatera ansökan (status, notes, interview_date, etc.)

### GET `/api/job-applications/stats`
Hämta statistik (totalt, per status, intervjufrekvens, etc.)

## Framtida Förbättringar

### Automatisk Status-uppdatering (Framtida)
1. **Email-tracking**: Om ansökan skickas via email → spåra öppningar/svar
2. **LinkedIn-integration**: Spåra ansökningar via LinkedIn
3. **ATS-integration**: Vissa ATS-system har API:er
4. **AI Email-parsing**: Analysera inkommande email för att detektera intervjuer/erbjudanden

### För nu: Manuell uppdatering är standard
Alla konkurrenter (LoopCV, AiApply) kräver manuell status-uppdatering.

