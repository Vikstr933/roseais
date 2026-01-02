# CV Parsing & Formatting - Förbättringsmöjligheter

## Nuvarande Situation
- PDF/DOCX parsas till raw text (ResumeParserService)
- Basic structured data extraheras (email, phone, sections)
- Frontend formaterar text med regex-baserade funktioner
- Problem: CV-text från PDF är ofta helt utan radbrytningar

## Förbättringsmöjligheter

### 1. AI-baserad Strukturering (Backend)
**Metod**: Använda AI (MultiModelAIService) för att extrahera strukturerad JSON från CV-text

**Fördelar**:
- Bättre detektion av sektioner, jobb, utbildning
- Strukturerad data som kan renderas på ett snyggt sätt
- Kan hantera olika CV-format automatiskt

**Implementation**:
```typescript
// I ResumeParserService
async enhanceWithAI(rawText: string): Promise<StructuredResume> {
  const prompt = `Extrahera strukturerad data från CV-text och returnera som JSON:
  {
    "name": "string",
    "contact": { "email": "...", "phone": "...", "location": "..." },
    "summary": "string",
    "experience": [{ "title": "...", "company": "...", "dates": "...", "description": "..." }],
    "education": [{ "degree": "...", "school": "...", "dates": "..." }],
    "skills": ["skill1", "skill2"],
    "formattedText": "Markdown-formaterad version av CV"
  }`;
  
  const aiResponse = await multiModelAI.generate({ prompt, ... });
  return JSON.parse(aiResponse.content);
}
```

**Kostnad**: ~$0.01-0.02 per CV (beroende på längd)

---

### 2. Markdown-formatering (Backend/Frontend)
**Metod**: Konvertera CV-text till Markdown för bättre rendering

**Fördelar**:
- Enkel att rendera med react-markdown
- Stöd för headers, lists, bold, italic
- Bevarar struktur

**Implementation**:
```typescript
// Backend: Generera markdown
const markdownCV = convertToMarkdown(rawText);

// Frontend: Rendera med react-markdown
import ReactMarkdown from 'react-markdown';
<ReactMarkdown>{markdownCV}</ReactMarkdown>
```

**Kostnad**: Minimal (endast processing)

---

### 3. HTML-formatering (Backend)
**Metod**: Generera formaterad HTML från CV-text

**Fördelar**:
- Full kontroll över styling
- Kan inkludera CSS-klasser
- Bättre för printing/PDF export

**Implementation**:
```typescript
const htmlCV = generateFormattedHTML(rawText);
// Returnera som { formattedHtml: "...", rawText: "..." }
```

**Kostnad**: Minimal

---

### 4. Strukturerad Komponent-rendering (Frontend)
**Metod**: Använda parsedData.sections för att rendera strukturerade komponenter

**Fördelar**:
- Mycket bättre UX - tydlig struktur
- Kan styla varje sektion separat
- Lättare att läsa och navigera

**Implementation**:
```typescript
// Om parsedData.sections finns
{parsedData.sections?.experience && (
  <div className="experience-section">
    <h3>Erfarenhet</h3>
    {parsedData.sections.experience.map((job, i) => (
      <div key={i} className="job-entry">
        <h4>{job.title} - {job.company}</h4>
        <p className="dates">{job.dates}</p>
        <p>{job.description}</p>
      </div>
    ))}
  </div>
)}

// Fallback till formaterad text
{!parsedData.sections && (
  <pre>{formatResumeText(rawText)}</pre>
)}
```

**Kostnad**: Ingen (använder befintlig data)

---

### 5. Hybrid Approach (Rekommenderad)
**Metod**: Kombinera flera metoder

**Steg**:
1. Försök använda parsedData.sections för strukturerad rendering
2. Om sections saknas/för ofullständig, använd AI för att strukturera
3. Fallback till formaterad markdown/text om AI misslyckas

**Implementation**:
```typescript
// Backend: Förbättra ResumeParserService
async parseResume(...) {
  const basicData = await this.extractStructuredData(rawText);
  
  // Om basic parsing är för ofullständig, använd AI
  if (!basicData.sections.experience || basicData.sections.experience.length === 0) {
    const aiEnhanced = await this.enhanceWithAI(rawText);
    return { ...basicData, ...aiEnhanced };
  }
  
  return basicData;
}

// Frontend: Smart rendering
{hasStructuredData(parsedData) ? (
  <StructuredResumeView data={parsedData} />
) : (
  <FormattedTextView text={formatResumeText(rawText)} />
)}
```

**Kostnad**: Beroende på användning (~$0.01-0.02 per CV som behöver AI)

---

### 6. PDF Structure Preservation (Backend)
**Metod**: Förbättra PDF-parsing för att bevara struktur

**Fördelar**:
- Bevarar ursprunglig layout bättre
- Kan extrahera font-storlekar, headers, etc.

**Implementation**:
```typescript
// Använd pdf-parse med options för bättre struktur
const data = await pdfParse(buffer, {
  max: 0, // Ingen max-längd
  version: 'v2.0.550',
});

// Extrahera struktur från PDF metadata/structure
const structuredText = extractPDFStructure(data);
```

**Kostnad**: Ingen (använder befintlig library)

---

## Rekommendation

**Första steg** (Snabb fix):
1. Förbättra `extractStructuredData()` i ResumeParserService med bättre regex
2. Använd structured rendering i frontend när data finns
3. Fallback till förbättrad text-formatering

**Andra steg** (Medel-term):
1. Lägg till AI-baserad strukturering som optional enhancement
2. Markdown-formatering för bättre rendering
3. Hybrid approach som standard

**Tredje steg** (Lång-term):
1. Fullständig AI-baserad parsing som standard
2. Structured component rendering för alla CVs
3. Export-funktionalitet (PDF, DOCX) med formatering

