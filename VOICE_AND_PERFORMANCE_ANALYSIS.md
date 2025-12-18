# Voice Features & Performance Analysis

## 🎤 Voice Features - Vad mer kan man göra?

### Nuvarande implementation
- ✅ Speech-to-text (Web Speech API)
- ✅ Text-to-speech (Web Speech API)
- ✅ Call mode (kontinuerlig lyssning)
- ✅ Automatisk kvinnlig röstval

### Ytterligare voice-funktioner man kan lägga till:

#### 1. **ElevenLabs Integration** 🚀
**Vad är ElevenLabs?**
- AI-röstsyntesplattform med naturligt ljudande röster
- Stöd för 29+ språk med låg latens
- Flash v2.5-modell optimerad för realtidsapplikationer
- Emotionell röstsyntes (glad, ledsen, arg, etc.)
- Custom voice cloning (skapa unika röster)

**Fördelar:**
- Mycket mer naturlig röst än Web Speech API
- Bättre svenska stöd
- Låg latens (~200-500ms)
- Emotionell expressivitet
- Kan skapa en unik "Elon-röst"

**Implementation:**
```typescript
// Exempel: ElevenLabs API integration
const elevenLabsSpeak = async (text: string) => {
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID', {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_flash_v2_5", // Snabb modell
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    })
  });
  
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.play();
};
```

#### 2. **Voice Commands & Shortcuts**
- "Stop" - stoppa uppläsning
- "Repeat" - upprepa senaste meddelandet
- "Faster/Slower" - ändra hastighet
- "Louder/Quieter" - ändra volym
- "Switch language" - byt språk

#### 3. **Voice Activity Detection (VAD)**
- Automatisk detektering när användaren slutar prata
- Förbättrad paus-detektering
- Mindre falska positiva (bakgrundsljud)

#### 4. **Real-time Voice Streaming**
- Streama röst direkt från AI-svaret (inte vänta på hela svaret)
- Börja prata medan texten fortfarande genereras
- Kombinera med streaming text-to-speech

#### 5. **Multi-language Support**
- Automatisk språkdetektering
- Byt språk under samtal
- Code-switching (blanda svenska/engelska)

#### 6. **Voice Profiles**
- Spara användarens röstpreferenser
- Olika röster för olika kontexter (arbete vs. personligt)
- Röstkloning för användare (valfritt)

---

## ⚡ Performance Analysis - Varför tar det lång tid?

### De tre största orsakerna till lång svarstid:

### 1. **Sekventiell databas- och context-hämtning** 🔴 KRITISKT

**Problem:**
```typescript
// Nuvarande kod gör detta sekventiellt:
history = await this.loadConversationHistory(userId, sessionId);  // ~100-300ms
memories = await this.loadUserMemories(userId);                    // ~50-200ms
context = await this.gatherContext(userId, userMessage, 5);        // ~200-500ms
tools = await pluginRegistry.getAvailableTools(userId);            // ~100-300ms
await this.initializeToolHandlers();                               // ~50-150ms
handlerTools = await this.getToolsFromHandlers(...);               // ~100-300ms
```

**Total tid: ~600-1750ms INNAN AI-anropet ens börjar!**

**Lösning:**
```typescript
// Gör allt parallellt:
const [history, memories, context, pluginTools] = await Promise.all([
  this.loadConversationHistory(userId, sessionId),
  this.loadUserMemories(userId),
  this.gatherContext(userId, userMessage, maxContextItems),
  pluginRegistry.getAvailableTools(userId)
]);

// Initialisera tool handlers parallellt
await Promise.all([
  this.initializeToolHandlers(),
  // Andra init-operationer
]);
```

**Förväntad förbättring: 60-70% snabbare (600-1750ms → 200-500ms)**

---

### 2. **Falsk streaming - väntar på hela svaret** 🟡 VIKTIGT

**Problem:**
```typescript
// I handleOmniAssistantStreaming:
const result = await omniAssistant.processRequest(...);  // Väntar på HELA svaret
// Först DÅ börjar vi streama:
for (let i = 0; i < words.length; i++) {
  sendSSE('chunk', { text: word });
}
```

**Detta är INTE riktig streaming!** Användaren väntar på hela AI-svaret innan något visas.

**Lösning - Riktig streaming från Anthropic:**
```typescript
// Använd Anthropic's streaming API direkt:
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 8192,
  system: systemPrompt,
  messages: conversationMessages,
  tools: anthropicTools
});

// Streama direkt när text kommer:
for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    const text = event.delta.text;
    sendSSE('chunk', { text }); // Skicka direkt till frontend
  }
}
```

**Förväntad förbättring: Användaren ser text efter 200-500ms istället för 3-10 sekunder**

---

### 3. **System prompt-byggning och tool-konvertering** 🟡 VIKTIGT

**Problem:**
```typescript
// buildSystemPrompt kan vara långsam:
systemPrompt = await systemPromptBuilder.buildPrompt({
  userId, sessionId, knowledgeItems: context, memories, 
  playgroundContext, discordContext, tools
});
// Detta kan ta 100-500ms beroende på antal tools/context

// convertToolsToAnthropicFormat kan också vara långsam:
anthropicTools = this.convertToolsToAnthropicFormat(tools);
// Med 40+ tools kan detta ta 50-200ms
```

**Lösningar:**

**A. Cache system prompts:**
```typescript
const promptCache = new Map<string, { prompt: string; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minut

const getCachedPrompt = (key: string) => {
  const cached = promptCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.prompt;
  }
  return null;
};
```

**B. Optimera tool-konvertering:**
```typescript
// Konvertera tools parallellt med andra operationer
const [systemPrompt, anthropicTools] = await Promise.all([
  this.buildSystemPrompt(...),
  Promise.resolve(this.convertToolsToAnthropicFormat(tools))
]);
```

**C. Lazy load tools:**
```typescript
// Ladda bara tools som faktiskt behövs baserat på användarens meddelande
const relevantTools = await this.selectRelevantTools(userMessage, allTools);
```

**Förväntad förbättring: 100-700ms snabbare**

---

## 📊 Sammanfattning av förbättringar

| Problem | Nuvarande tid | Efter optimering | Förbättring |
|---------|---------------|------------------|-------------|
| Sekventiell datahämtning | 600-1750ms | 200-500ms | **60-70%** |
| Falsk streaming | 3-10s (första tecknet) | 200-500ms | **85-95%** |
| System prompt + tools | 150-700ms | 50-200ms | **30-70%** |
| **TOTALT** | **3.75-12.45s** | **0.45-1.2s** | **~80-90% snabbare** |

---

## 🚀 Rekommenderade åtgärder (prioritering)

### Prioritet 1: Implementera riktig streaming ⚡
- Använd Anthropic's streaming API direkt
- Skicka text till frontend så snart den genereras
- **Impact: Användaren ser svar 10-20x snabbare**

### Prioritet 2: Parallellisera datahämtning 🔄
- Gör alla databas-queries parallellt
- Cache ofta använda data
- **Impact: 60-70% snabbare startup**

### Prioritet 3: Optimera system prompt & tools 🛠️
- Cache system prompts
- Lazy load tools
- **Impact: 100-700ms snabbare**

### Prioritet 4: ElevenLabs integration (valfritt) 🎤
- Förbättrad röstkvalitet
- Bättre svenska stöd
- **Impact: Bättre UX, inte nödvändigtvis snabbare**

---

## 💡 Ytterligare optimeringar

1. **Connection pooling** för databas
2. **Redis cache** för conversation history
3. **CDN** för statiska assets
4. **Edge functions** för snabbare första byte
5. **Request deduplication** (samma request = samma svar)

---

## 📝 Implementation Checklist

- [ ] Implementera riktig streaming från Anthropic
- [ ] Parallellisera alla databas-queries
- [ ] Cache system prompts
- [ ] Optimera tool-konvertering
- [ ] Lägg till performance monitoring
- [ ] (Valfritt) Integrera ElevenLabs API

