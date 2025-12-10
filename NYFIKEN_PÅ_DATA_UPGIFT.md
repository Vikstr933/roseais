# Nyfiken på data

Jag har analyserat data från vår egen plattform **OmniAssistant** - en AI-powered development platform som använder multi-agent orchestration för kodgenerering. Systemet består av flera specialiserade AI-agenter som samarbetar: 

**Chap-ZPT (PlaygroundAssistantAgent)** fungerar som orchestrator i playground-miljön. Den analyserar användarens prompt, förbättrar den automatiskt genom att lägga till tekniska specifikationer, best practices, och UI/UX-överväganden innan kodgenerering, och väljer sedan automatiskt rätt agenter från en databas med 20+ specialiserade agenter. Chap-ZPT använder ett intent detection-system som försöker förstå vad användaren verkligen vill ha - inte bara vad de säger.

**Elon (PersonalAssistantAgent)** är en allmän assistent med tillgång till verktyg som web search, Discord-integration, Gmail (email management), Google Calendar, Notion, och användar-genererade plugins. Elon kan samarbeta med Chap-ZPT och trigga kodgenerering, men är också tillgänglig överallt i systemet för allmänna uppgifter.

**IncrementalOrchestrator** är kärnan som faktiskt genererar koden genom att samordna flera specialiserade agenter. Den analyserar komplexitet, väljer rätt agenter, och kör dem parallellt när möjligt för att optimera hastighet och kostnad.

**Prompt Lab** är ett verktyg i Desktop view som låter användare testa samma prompt på flera olika AI-modeller parallellt (Claude Sonnet 4.5, Claude 3.5 Sonnet, GPT-4o, GPT-4o Mini) och jämföra resultaten sida vid sida. Detta gör det möjligt att experimentera med olika formuleringar, se hur olika modeller tolkar samma prompt, och förstå skillnaderna mellan modeller. Systemet mäter även response time, token usage, och kostnad för varje modell, vilket ger konkret data på prestanda och effektivitet.

Det intressanta är att systemet samlar in omfattande data på hur dessa agenter presterar, när kodgenerering lyckas eller misslyckas, hur intent detection fungerar i praktiken, vilka tidsmönster som finns i användning, hur olika modeller presterar på samma prompts, och hur användare faktiskt interagerar med AI i praktiken.

Några mönster jag hittat som är relevanta för AI i undervisning:

**Agent-specialisering visar värdet av rätt verktyg för rätt uppgift** - Analysen av vår data visar tydliga skillnader i framgångsfrekvens mellan olika agenter. Vissa agenter har 80%+ framgångsfrekvens medan andra ligger på 40-60%. Detta tyder på att specialisering faktiskt fungerar - precis som i mänskliga team. I undervisningssammanhang skulle detta kunna betyda att vi behöver lära elever när olika AI-verktyg är lämpliga - inte bara hur man använder dem. En generalist-agent som försöker göra allt presterar sämre än en orchestrator som väljer rätt specialiserad agent för varje uppgift.

**Verktyg skapar möjligheter men kräver förståelse** - Agenter med tillgång till verktyg som web search (Elon), email (Gmail-plugin), eller Discord-integration kan lösa mer komplexa uppgifter, men datan visar också fler failure points. När en agent har tillgång till 5+ verktyg ökar success rate för komplexa uppgifter men också risken för fel. Detta belyser vikten av att förstå vad AI faktiskt gör - inte bara att "den fixar det". Elever behöver lära sig att verktyg är kraftfulla men kräver förståelse för hur de fungerar och när de är lämpliga.

**Orchestration visar framtidens AI - flera specialiserade AI:er som samarbetar** - Det mest fascinerande är hur orchestrator-systemet fungerar: Chap-ZPT tar emot en förfrågan, analyserar komplexitet, väljer rätt agenter från en databas, och samordnar resultatet genom IncrementalOrchestrator. Detta är inte en enskild AI som gör allt - det är flera specialiserade AI:er som samarbetar. Systemet använder även smart caching och parallell körning för att optimera kostnad och hastighet. I framtidens klassrum kommer elever behöva förstå dessa system, inte bara enskilda verktyg. Det handlar om att förstå hur AI-system faktiskt fungerar - som en orkester där varje agent spelar sin roll.

**Tidsmönster reflekterar mänsklig produktivitet** - Genom att analysera när kod genereras ser vi tydliga toppar vid vissa timmar (t.ex. 10:00, 14:00, 20:00). Detta visar att AI-användning följer mänskliga produktivitetsmönster - vi använder verktyg när vi faktiskt arbetar, inte jämnt fördelat. Detta är en viktig insikt: AI är ett verktyg som förstärker vår produktivitet, inte ersätter våra naturliga arbetsmönster.

**Kvalitet på input är viktigare än kvantitet** - Analysen visar att längre prompts inte automatiskt genererar bättre kod. Korta, tydliga prompts kan faktiskt generera bättre resultat än långa, otydliga prompts. Detta tyder på att AI:ns förståelse är bättre när input är fokuserad och tydlig, snarare än när den är lång och innehåller mycket "brus". För elever betyder detta att lära sig formulera tydliga, specifika instruktioner är avgörande - det handlar om kommunikation, inte magi. Genom Prompt Lab kan elever experimentera med olika formuleringar av samma prompt och se hur olika modeller reagerar - detta ger konkret förståelse för hur prompt engineering faktiskt fungerar i praktiken.

**Projektaktivitet följer "burst"-mönster** - Projekt har aktivitet i koncentrerade perioder, sedan paus. Nya projekt skapas ofta i början av veckor, och aktivitet ökar mot deadlines. Detta visar att AI-användning är kontextuell - vi använder verktyg när vi faktiskt behöver dem för att lösa problem, inte som en abstrakt övning. I klassrummet betyder detta att AI-verktyg bäst lärs ut i samband med verkliga projekt och problem, inte som isolerade övningar.

**Iterativt arbete är normen, inte undantaget** - Genom att analysera projektaktivitet ser vi att användare arbetar i cykler: submit → resultat → justering → ny submit. Genomsnittligt projekt har 8-12 iterationer innan användaren är nöjd. Detta visar att AI-assisterat arbete inte är "skriv prompt, få färdigt resultat" utan en process som kräver reflektion och anpassning - precis det kritiska tänkande vi vill se i klassrummet. Varje iteration är en möjlighet att lära sig mer om vad AI faktiskt gör och hur man kommunicerar bättre med den.

**Korrelationer avslöjar intressanta samband** - Data visar korrelationer mellan olika faktorer: agenter med högre framgångsfrekvens tenderar att generera längre kod (kanske för att de faktiskt löser mer komplexa problem), och prompt-längd korrelerar med kod-längd (men inte perfekt linjärt - kvalitet spelar roll). Genom att identifiera dessa mönster kan vi förbättra systemet baserat på faktisk data, inte bara antaganden.

Det viktigaste jag lärt mig från denna analys är att AI-verktyg inte fungerar som vi ofta tror. De kräver tydlig kommunikation, förståelse för deras begränsningar, och iterativt arbete. Genom att analysera hur människor faktiskt använder dessa verktyg kan vi bättre förbereda elever för att arbeta med AI - inte bara använda dem, utan förstå dem.

**Vilken är den mest intressanta data jag har hittat?**

Den mest intressanta datan är kombinationen av agentprestanda och tidsmönster. Detta visar att AI-system inte är "magiska svarta lådor" - de följer faktiska mönster som vi kan analysera och förbättra. Genom att förstå vilka agenter som presterar bäst, när vi är mest produktiva, och hur olika faktorer korrelerar, kan vi faktiskt förbättra vårt system baserat på data - inte bara gissningar.

Detta är precis vad maskininlärning gör - den hittar mönster i data som vi kanske inte ser direkt. Genom att analysera vår egen data manuellt får vi en känsla för vad algoritmerna faktiskt gör när de "lär sig".

**Har datan etiketter?**

Ja! Datamängden är strukturerad med tydliga etiketter:
- Status (completed/failed/pending) - visar om kodgenerering lyckades
- Agent ID och namn - identifierar vilken agent som användes
- Timestamps - för tidsanalys (när kod genererades)
- User ID - för användaranalys
- Code length - antal tecken i genererad kod
- Success rate - framgångsfrekvens per agent
- Project activity - projektaktivitet över tid

Alla dessa etiketter gör det möjligt att analysera mönster, korrelationer och trender - precis som en maskininlärningsalgoritm skulle göra.

