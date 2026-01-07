# Adzuna API Konfiguration

## Snabbstart

Adzuna API är nu integrerat i systemet! Följ dessa steg för att aktivera det.

## 1. API-nycklar

Du har redan fått dina API-nycklar:
- **Application ID**: `1fcd4908`
- **Application Key**: `9303564ef0c5d6509f8d0f0c1ffb363e`

## 2. Konfigurera miljövariabler

Lägg till följande i din `.env` fil (i root-mappen):

```env
# Adzuna API Configuration
ADZUNA_APP_ID=1fcd4908
ADZUNA_APP_KEY=9303564ef0c5d6509f8d0f0c1ffb363e
ENABLE_ADZUNA=true
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
[AdzunaJobService] Adzuna Job Service enabled
```

Om du ser detta meddelande istället:
```
[AdzunaJobService] Adzuna Job Service disabled
```

Kontrollera att:
- `.env` filen finns i root-mappen
- Miljövariablerna är korrekt skrivna (inga extra mellanslag)
- `ENABLE_ADZUNA=true` är satt

## 5. Använda Adzuna i jobbsökningar

### Via API

Sök jobb från både JobTech och Adzuna:
```
GET /api/resumes/:id/job-matches?sources=jobtech,adzuna
```

Sök endast från Adzuna:
```
GET /api/resumes/:id/job-matches?sources=adzuna
```

### Standardbeteende

**Standard**: JobTech, Adzuna och Reed används tillsammans som standard när inga källor anges.

Om du vill använda endast JobTech:
```
GET /api/resumes/:id/job-matches?sources=jobtech
```

Om du vill inkludera Reed också:
```
GET /api/resumes/:id/job-matches?sources=jobtech,adzuna,reed
```

## 6. Rate Limits

**Gratis tier**: 1000 requests/månad

Om du får ett 429-fel (rate limit exceeded), har du överskridit den månatliga gränsen. Du kan:
- Vänta till nästa månad
- Uppgradera till betald plan på https://developer.adzuna.com/

## 7. Felsökning

### Problem: "Adzuna not configured"
**Lösning**: Kontrollera att alla tre miljövariabler är satta i `.env` filen.

### Problem: "Adzuna API authentication failed"
**Lösning**: Kontrollera att `ADZUNA_APP_ID` och `ADZUNA_APP_KEY` är korrekta (inga extra mellanslag).

### Problem: Inga jobb returneras från Adzuna
**Möjliga orsaker**:
- Inga jobb matchar sökningen
- API-nycklarna är felaktiga
- Rate limit har överskridits

Kontrollera serverloggarna för mer information.

## 8. Ytterligare information

- **Adzuna Developer Portal**: https://developer.adzuna.com/
- **API Dokumentation**: https://developer.adzuna.com/overview
- **Jobb-API Integrations Guide**: Se `JOB_API_INTEGRATIONS.md`

## 9. Nästa steg

Efter att Adzuna är konfigurerat och fungerar, kan du:
1. Testa jobbsökningar med både JobTech och Adzuna
2. Verifiera att deduplicering fungerar (samma jobb från båda källor ska bara visas en gång)
3. Överväga att lägga till fler källor (se `JOB_API_INTEGRATIONS.md`)

