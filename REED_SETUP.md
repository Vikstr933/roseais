# Reed API Konfiguration

## Snabbstart

Reed API är nu integrerat i systemet! Följ dessa steg för att aktivera det.

## 1. API-nyckel

Du har redan fått din API-nyckel:
- **API Key**: `d56f6e8f-edfd-46f5-aeb7-a7695e28b050`

## 2. Konfigurera miljövariabler

Lägg till följande i din `.env` fil (i root-mappen):

```env
# Reed API Configuration
REED_API_KEY=d56f6e8f-edfd-46f5-aeb7-a7695e28b050
ENABLE_REED=true
```

**Viktigt**: 
- Skapa `.env` filen i root-mappen om den inte finns
- Se till att det inte finns extra mellanslag runt `=` tecknet
- `.env` filen är redan i `.gitignore` så den kommer inte committas till Git

## 3. Starta om servern

Efter att ha lagt till miljövariablerna, starta om backend-servern:

```bash
npm run dev
# eller
npm start
```

## 4. Verifiera att det fungerar

När servern startar, leta efter detta i loggarna:
```
[ReedJobService] Reed Job Service enabled
```

Om du ser detta meddelande istället:
```
[ReedJobService] Reed Job Service disabled
```

Kontrollera att:
- `.env` filen finns i root-mappen
- Miljövariablerna är korrekt skrivna (inga extra mellanslag)
- `ENABLE_REED=true` är satt

## 5. Använda Reed i jobbsökningar

### Via API

Sök jobb från alla källor (JobTech, Adzuna, Reed):
```
GET /api/resumes/:id/job-matches?sources=jobtech,adzuna,reed
```

Sök endast från Reed:
```
GET /api/resumes/:id/job-matches?sources=reed
```

### Standardbeteende

**Standard**: JobTech och Adzuna används tillsammans som standard. För att inkludera Reed, lägg till `?sources=jobtech,adzuna,reed`.

## 6. API Parametrar

Reed API stödjer flera sökparametrar:
- `keywords` - Sökord
- `locationName` - Plats
- `distanceFromLocation` - Avstånd från plats i miles (standard: 10)
- `permanent`, `contract`, `temp` - Anställningstyp
- `partTime`, `fullTime` - Arbetstid
- `minimumSalary`, `maximumSalary` - Lön
- `resultsToTake` - Max antal resultat (max 100)
- `resultsToSkip` - För paginering

Se Reed API dokumentation för alla parametrar: https://www.reed.co.uk/developers

## 7. Rate Limits

Kontrollera Reed API dokumentation för aktuella rate limits: https://www.reed.co.uk/developers

Om du får ett 429-fel (rate limit exceeded), har du överskridit den månatliga gränsen.

## 8. Felsökning

### Problem: "Reed not configured"
**Lösning**: Kontrollera att båda miljövariablerna är satta i `.env` filen.

### Problem: "Reed API authentication failed"
**Lösning**: Kontrollera att `REED_API_KEY` är korrekt (inga extra mellanslag).

### Problem: Inga jobb returneras från Reed
**Möjliga orsaker**:
- Inga jobb matchar sökningen (Reed är primärt UK-fokuserad)
- API-nyckeln är felaktig
- Rate limit har överskridits

Kontrollera serverloggarna för mer information.

## 9. Ytterligare information

- **Reed Developer Portal**: https://www.reed.co.uk/developers
- **API Dokumentation**: https://www.reed.co.uk/developers/jobseeker
- **Jobb-API Integrations Guide**: Se `JOB_API_INTEGRATIONS.md`

## 10. Nästa steg

Efter att Reed är konfigurerat och fungerar, kan du:
1. Testa jobbsökningar med alla tre källor (JobTech, Adzuna, Reed)
2. Verifiera att deduplicering fungerar (samma jobb från flera källor ska bara visas en gång)
3. Observera att Reed primärt returnerar UK/EU jobb, vilket kan vara användbart för internationella sökningar

