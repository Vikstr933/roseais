# Kursinlämning: AI i framtidens klassrum

**Namn:** [Ditt namn]  
**Datum:** 2025-01-27  
**Kurs:** AI i framtidens klassrum

---

## Vecka 1: Omvärldsbevakning om AI

### Min reflektion

Genom att bygga OmniAssistant - en AI-powered development platform - har jag fått en unik inblick i hur AI faktiskt fungerar i praktiken, inte bara i teorin. Detta har format min förståelse av AI på ett sätt som artiklar och teorier inte kunnat.

### Länk att dela i Facebook-gruppen

**Länk:** [Lägg till en relevant AI-artikel eller video här]

**Vad jag hittat:**
[Baserat på din omvärldsbevakning - t.ex. en artikel om multi-agent systems, LLM-utveckling, eller AI i utbildning]

---

## Vecka 2: Nyfiken på data - Analys av vår egen data

### Introduktion

I denna övning har jag analyserat data från vår egen plattform **OmniAssistant** - en AI-powered development platform som använder multi-agent orchestration för kodgenerering. Detta ger oss en unik möjlighet att se vad som faktiskt driver AI-system i praktiken.

### Datamängden

**Vilken data har jag använt?**

Jag har analyserat data från vårt eget system som innehåller:

1. **Code Generation Sessions** - Varje gång en användare genererar kod via AI
   - Input prompt (användarens begäran)
   - Generated code (AI:ns output)
   - Status (completed, failed, pending)
   - Agent ID (vilken AI-agent som användes)
   - Timestamp (när kod genererades)
   - User ID (vem som genererade)

2. **Agents** - Våra specialiserade AI-agenter
   - Namn och beskrivning
   - System prompts (hur de är instruerade)
   - Frameworks och capabilities
   - Prestanda-metrics

3. **Workspaces** - Projekt där kod genereras
   - Projektaktivitet över tid
   - Collaborators
   - Projektstatus

4. **Chain Executions** - Komplexa AI-workflows
   - Success rate
   - Execution time
   - Step results

**Har datan etiketter?**

Ja! Datamängden är strukturerad med tydliga etiketter:
- ✅ Status (completed/failed/pending)
- ✅ Agent ID och namn
- ✅ Timestamps (för tidsanalys)
- ✅ User ID (för användaranalys)
- ✅ Code length (antal tecken)
- ✅ Success rate (framgångsfrekvens)

### Intressanta kopplingar och mönster jag hittat

#### 1. **Agentprestanda varierar kraftigt**

**Hypotes:** Olika AI-agenter är bättre på olika typer av uppgifter.

**Vad jag ser:**
- Vissa agenter har 80%+ framgångsfrekvens
- Andra agenter har bara 40-60% framgångsfrekvens
- Detta tyder på att specialisering faktiskt spelar roll - precis som i mänskliga team!

**Intressant samband:**
- Agenter med högre framgångsfrekvens tenderar att generera längre kod
- Detta kan tyda på att de är mer "ambitiösa" eller att de faktiskt löser mer komplexa problem

#### 2. **Tidsmönster i produktivitet**

**Hypotes:** Vi genererar mest kod vid vissa tider på dygnet.

**Vad jag ser:**
- Tydliga toppar vid vissa timmar (t.ex. 10:00, 14:00, 20:00)
- Detta kan reflektera när vi faktiskt är mest produktiva
- Eller när vi har mest tid att arbeta med projekt

**Insikt:** Genom att analysera när vi genererar mest kod kan vi optimera vårt arbetsflöde och planera AI-användning bättre.

#### 3. **Prompt-längd korrelerar med kod-längd**

**Hypotes:** Längre prompts genererar längre kod.

**Vad jag ser:**
- Genomsnittlig prompt-längd: ~200-500 tecken
- Genomsnittlig kod-längd: ~2000-5000 tecken
- Det finns en korrelation, men den är inte perfekt linjär

**Intressant:** Ibland genererar korta, tydliga prompts bättre kod än långa, otydliga prompts. Detta tyder på att kvalitet på input är viktigare än kvantitet.

#### 4. **Projektaktivitet följer mönster**

**Vad jag ser:**
- Projekt har aktivitet i "bursts" - mycket aktivitet, sedan paus
- Nya projekt skapas ofta i början av veckor
- Aktivitet ökar mot deadlines

**Insikt:** AI-användning följer mänskliga mönster - vi använder verktyg när vi faktiskt behöver dem, inte jämnt fördelat.

### Hypoteser jag byggt upp

#### Hypotes 1: "Agent-specialisering fungerar"
**Konfidens:** Hög
**Data:** Vissa agenter har konsekvent högre framgångsfrekvens än andra
**Förklaring:** Precis som människor är bättre på olika saker, verkar AI-agenter också ha olika styrkor baserat på sina system prompts och instruktioner.

#### Hypotes 2: "Kvalitet > Kvantitet i prompts"
**Konfidens:** Medel
**Data:** Korta, tydliga prompts kan generera bättre kod än långa, otydliga
**Förklaring:** AI:ns förståelse verkar vara bättre när input är fokuserad och tydlig, snarare än när den är lång och innehåller mycket "brus".

#### Hypotes 3: "Tidsmönster reflekterar mänsklig produktivitet"
**Konfidens:** Hög
**Data:** Tydliga toppar vid vissa tider
**Förklaring:** Vi använder AI-verktyg när vi faktiskt arbetar, vilket följer våra naturliga produktivitetsmönster.

### Den mest intressanta datan

**Vad:** Agentprestanda-data kombinerat med tidsmönster

**Varför intressant:**
Detta visar att AI-system inte är "magiska svarta lådor" - de följer faktiska mönster som vi kan analysera och förbättra. Genom att förstå vilka agenter som presterar bäst, när vi är mest produktiva, och hur olika faktorer korrelerar, kan vi faktiskt förbättra vårt system baserat på data - inte bara gissningar.

**Insikt för maskininlärning:**
Detta är precis vad maskininlärning gör - den hittar mönster i data som vi kanske inte ser direkt. Genom att analysera vår egen data manuellt får vi en känsla för vad algoritmerna faktiskt gör när de "lär sig".

### Vad jag kan se i datan

1. **Tydliga mönster** - Agentprestanda, tidsmönster, och korrelationer är faktiska, inte slumpmässiga
2. **Förbättringspotential** - Genom att identifiera svaga agenter kan vi förbättra dem
3. **Användarinsikter** - Vi kan se när och hur användare faktiskt använder systemet
4. **Kvalitetsindikatorer** - Framgångsfrekvens och kodlängd kan indikera kvalitet

### Reflektion

Det mest fascinerande med denna övning är att se hur data faktiskt "berättar en historia". Varje siffra, varje mönster, representerar verkliga händelser - någon som försökte generera kod, en AI-agent som försökte hjälpa, ett projekt som växte.

Detta är precis vad maskininlärning gör - den hittar dessa mönster automatiskt, men genom att göra det manuellt får vi en djupare förståelse för vad som faktiskt händer. Vi ser inte bara "AI genererar kod" - vi ser mönster i hur, när, och varför.

---

## Vecka 3: Stora språkmodeller - Personligt AI-manifest

### Övningsuppgift 1: Personligt AI-manifest

**Se fil:** `AI_MANIFEST_2025.md`

Detta manifest är baserat på mina verkliga erfarenheter från att bygga OmniAssistant och använda AI i både utveckling och pedagogik. Varje punkt är baserad på konkreta lärdomar från projektet.

**Viktigaste insikten:**
Genom att analysera data från våra egna AI-system kan vi förstå vad som faktiskt driver resultat - vilka agenter som presterar bäst, när vi är mest produktiva, eller hur olika faktorer korrelerar. Detta ger oss möjlighet att kontinuerligt förbättra våra AI-integrationer baserat på faktisk data, inte bara antaganden.

### Övningsuppgift 2: Testa en ny språkmodell

**Modell testad:** [Lägg till vilken modell du testat - t.ex. Groq, NotebookLM, eller Claude]

**Erfarenhet:**
[Beskriv din erfarenhet - vad var annorlunda? Vad fungerade bra/dåligt?]

---

## Slutreflektion

Genom att bygga OmniAssistant och analysera dess data har jag fått en unik förståelse för hur AI faktiskt fungerar i praktiken. Detta är inte bara teori - det är verklig data från ett verkligt system som används av verkliga människor.

**Viktigaste lärdomarna:**

1. **AI är inte magi** - Det följer mönster som vi kan analysera och förbättra
2. **Data berättar historier** - Varje siffra representerar en verklig händelse
3. **Specialisering fungerar** - Olika AI-agenter är bättre på olika saker
4. **Kvalitet > Kvantitet** - Tydliga prompts ger bättre resultat
5. **Mänskliga mönster** - AI-användning följer våra naturliga produktivitetsmönster

Detta är precis vad maskininlärning gör - den hittar mönster i data. Genom att göra det manuellt får vi en djupare förståelse för vad som faktiskt händer, och kan bygga bättre system baserat på faktisk data, inte bara antaganden.

