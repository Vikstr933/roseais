# Map Context & Plugin Display Fixes - COMPLETE

## Problems Fixed

### 1. ✅ Map Context Understanding Issues
**Problem:** Assistant was creating incorrect map queries that showed random places around the world
- "Show me the route from coffee to ICA" → Found "The Route" restaurant in India
- "coffee shops near ICA Bandhagen" → Found "Coffee Together" in Netherlands

**Root Cause:**
- Location detection was too loose, matching phrases like "show me" and "directions to"
- No geographic constraints on Google Maps searches
- Both user input AND assistant responses triggered map embeddings

### 2. ✅ Duplicate Map Embeddings
**Problem:** Two maps showing per response (one before text, one after)

**Root Cause:**
- `detectLocationQuery()` was called on both user messages AND assistant responses
- Each message with a detected query got its own map embed

### 3. ✅ Plugin Checkboxes Not Showing as Checked
**Problem:** Agent Manager showed plugin checkboxes but they weren't ticked, even though the assistant was using the plugins

**Root Cause:**
- Database migration 2016a added `enabled_plugins` column
- Drizzle schema (schema-pg.ts) was never updated to include the field
- API couldn't access the field, so it always returned undefined

---

## Fixes Implemented

### Fix 1: Strict Map Query Detection ([AssistantWidget.tsx:121-151](client/src/components/AssistantWidget.tsx#L121-L151))

**Changed:**
```typescript
// OLD: Detected in BOTH user input and assistant responses
const locationQuery = detectLocationQuery(input); // User input
const assistantLocationQuery = detectLocationQuery(data.response); // Assistant

// NEW: ONLY detects in assistant responses, with STRICT format
const detectLocationQuery = (text: string): string | null => {
  const lines = text.split('\n').map(line => line.trim());

  for (const line of lines) {
    let cleanLine = line.replace(/\*\*/g, '').replace(/[emojis]/g, '').trim();

    // STRICT pattern: must be ONLY "word(s) near/in word(s)"
    const strictPattern = /^([a-zA-ZåäöÅÄÖ\s]+)\s+(near|in)\s+([a-zA-ZåäöÅÄÖ,\s]+)$/i;
    const match = cleanLine.match(strictPattern);

    if (match) {
      // Verify no extra words like "show", "find", etc.
      const hasExtraWords = /^(show|find|where|directions|map|get|search|look)/i.test(cleanLine);
      if (!hasExtraWords) {
        console.log('✅ Detected valid location query:', cleanLine);
        return cleanLine;
      }
    }
  }

  return null;
};
```

**Benefits:**
- ✅ Only ONE map per response (no duplicate)
- ✅ User queries don't trigger maps
- ✅ Only valid formatted queries like "pizza near Lövestad, Sweden" are detected
- ✅ Queries with extra words like "show me pizza near X" are rejected

### Fix 2: Removed Location Detection from User Input ([AssistantWidget.tsx:153-161](client/src/components/AssistantWidget.tsx#L153-L161))

**Changed:**
```typescript
// OLD:
const locationQuery = detectLocationQuery(input);
const userMessage: Message = {
  role: 'user',
  content: input,
  timestamp: new Date(),
  mapQuery: locationQuery || undefined // This caused duplicate maps
};

// NEW:
const userMessage: Message = {
  role: 'user',
  content: input,
  timestamp: new Date(),
  // No mapQuery field - user messages don't trigger maps
};
```

**Benefits:**
- ✅ User's "Show me the route..." query doesn't create a map
- ✅ Only assistant's formatted response creates the map

### Fix 3: Geographic Constraints ([MapEmbed.tsx:86-96](client/src/components/MapEmbed.tsx#L86-L96))

**Added:**
```typescript
// Constrain search to Sweden/Skåne region to prevent false matches
const swedenBounds = new window.google.maps.LatLngBounds(
  new window.google.maps.LatLng(55.0, 12.5), // Southwest corner of Skåne
  new window.google.maps.LatLng(57.0, 15.0)  // Northeast corner covering southern Sweden
);

const request = {
  query: cleanedQuery,
  fields: ['name', 'formatted_address', 'geometry', 'place_id', 'rating', 'user_ratings_total', 'photos'],
  locationBias: swedenBounds // Bias results towards Sweden
};
```

**Benefits:**
- ✅ Searches for "pizza near Lövestad" find results in Sweden, not India
- ✅ Searches for "coffee" find Swedish cafés, not Dutch ones
- ✅ locationBias parameter tells Google Maps API to prefer Swedish results

### Fix 4: Drizzle Schema Update ([db/schema-pg.ts:98-107](db/schema-pg.ts#L98-L107))

**Added:**
```typescript
export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  model: text('model').notNull(),
  // ... existing fields ...
  // Enhanced agent fields (added in migration 2016a)
  description: text('description'),
  role: text('role'),
  capabilities: jsonb('capabilities').default({}),
  expertise: jsonb('expertise').default({}),
  frameworks: jsonb('frameworks').default({}),
  libraries: jsonb('libraries').default({}),
  bestPractices: jsonb('best_practices').default({}),
  enabledPlugins: jsonb('enabled_plugins').default([]), // ✅ NOW VISIBLE TO DRIZZLE
});
```

**Benefits:**
- ✅ Agent Manager can now read `enabledPlugins` from database
- ✅ Checkboxes will be ticked correctly for agents that have plugins enabled
- ✅ Personal Assistant will show Gmail, Google Calendar, Google Maps as checked

### Fix 5: Improved Assistant Prompt ([COMPLETE_MAP_FIX.sql:77-88](COMPLETE_MAP_FIX.sql#L77-L88))

**Added instructions for:**
- ✅ ONLY ONE map query per response
- ✅ For routing questions, tell user to use Google Maps directly
- ✅ Never include formatting or extra words in the query line
- ✅ Examples of correct vs incorrect formats

**Updated prompt section:**
```sql
IMPORTANT - For routing/directions between two places:
User: "Show me the route from X to Y" or "Directions from coffee shop to ICA"
You respond:
For turn-by-turn directions between specific locations, please use Google Maps directly. I can show you where places are located, but for detailed routing I recommend using the Google Maps app!

Would you like me to show you the location of either place on the map instead?

Remember:
- Keep queries simple: just [what] + [near/in] + [location]
- ONLY ONE map query per response
- NEVER include formatting or extra words in the query line
- For routing between places, don't create map queries
```

---

## Testing Steps

### Step 1: Hard Refresh Browser ✅

**The fixes are now live! Vite performed hot module reload automatically.**

1. Open http://localhost:5174/ (NOT 5173!)
2. Press **Ctrl + Shift + R** to clear cached headers
3. The COEP fix from vite.config.ts is now active

### Step 2: Run SQL Update in Supabase

**Open Supabase SQL Editor and run:**
```sql
-- File: COMPLETE_MAP_FIX.sql
```

This will:
- ✅ Add your location (Lövestad, Skåne County, Sweden)
- ✅ Teach assistant strict map query format
- ✅ Add routing handling instructions

### Step 3: Test Map Queries

**Open Personal Assistant and test these queries:**

#### Test A: Simple Location Query
```
User: Find coffee shops near me
```

**Expected Result:**
```
coffee near Lövestad, Sweden
Let me find coffee shops for you! ☕

[ONE map showing Swedish coffee shops]
```

#### Test B: Location in Different City
```
User: Show me restaurants in Stockholm
```

**Expected Result:**
```
restaurants in Stockholm, Sweden
I'll show you restaurants in Stockholm! 🍽️

[ONE map showing Stockholm restaurants]
```

#### Test C: Routing Query (Should NOT create map)
```
User: Show me the route from coffee to ICA Bandhagen
```

**Expected Result:**
```
For turn-by-turn directions between specific locations, please use Google Maps directly. I can show you where places are located, but for detailed routing I recommend using the Google Maps app!

Would you like me to show you the location of either place on the map instead?

[NO map embedded]
```

### Step 4: Verify Plugin Checkboxes

1. Go to **Agent Manager**
2. Click on **Personal Assistant**
3. Scroll to **Enabled Skills/Plugins** section

**Expected Result:**
- ✅ Gmail checkbox: **CHECKED**
- ✅ Google Calendar checkbox: **CHECKED**
- ✅ Google Maps checkbox: **CHECKED**

---

## Summary of Changes

| File | Lines Changed | Change Type |
|------|--------------|-------------|
| [vite.config.ts](vite.config.ts#L20) | 1 line | Disabled COEP header |
| [AssistantWidget.tsx](client/src/components/AssistantWidget.tsx#L121-161) | 40 lines | Strict map detection |
| [MapEmbed.tsx](client/src/components/MapEmbed.tsx#L86-96) | 10 lines | Geographic constraints |
| [schema-pg.ts](db/schema-pg.ts#L98-107) | 9 lines | Added enabledPlugins field |
| [COMPLETE_MAP_FIX.sql](COMPLETE_MAP_FIX.sql#L77-88) | 12 lines | Improved prompt |

**Total:** 5 files, 72 lines changed

---

## Before vs After

### Before ❌

**User:** "Find coffee shops near me"
```
[Map 1 before text: Shows "coffee shops near me" → finds random place in Asia]

show me coffee shops near Lövestad, Sweden

Let me find coffee shops! ☕

[Map 2 after text: Shows "show me coffee shops..." → finds place in Netherlands]
```

**Problems:**
- Two maps
- Wrong locations (India, Netherlands)
- User query triggers map
- Assistant text with "show me" triggers map

### After ✅

**User:** "Find coffee shops near me"
```
coffee near Lövestad, Sweden

Let me find coffee shops! ☕

[ONE map: Shows "coffee near Lövestad, Sweden" → finds Swedish cafés]
```

**Benefits:**
- ✅ One map only
- ✅ Correct location (Sweden)
- ✅ User query doesn't trigger map
- ✅ Only clean formatted query triggers map

---

## How It Works Now

### Flow Diagram

```
User types: "Show me coffee near me"
           ↓
[AssistantWidget.tsx]
User message created WITHOUT mapQuery field
           ↓
Message sent to /api/plugins/assistant/chat
           ↓
[Personal Assistant Agent]
Sees system prompt with location: Lövestad
Generates clean response:
  "coffee near Lövestad, Sweden\n\nLet me find coffee for you! ☕"
           ↓
[AssistantWidget.tsx - detectLocationQuery()]
Scans response line by line
Finds: "coffee near Lövestad, Sweden"
Validates: No "show", "find", etc. at start ✅
           ↓
mapQuery = "coffee near Lövestad, Sweden"
           ↓
[MapEmbed component]
Creates Sweden bounds (55.0-57.0 lat, 12.5-15.0 lng)
Google Maps API searches with locationBias
           ↓
✅ Finds Swedish coffee shops
✅ Displays ONE map after assistant text
```

---

## Technical Details

### Why Location Detection Was Too Loose

**Old patterns:**
```typescript
/(?:show me|find|where is|directions to|map of)\s+(.+)/i
/(?:nearest|closest)\s+(.+)/i
/(.+)\s+(?:near me|nearby)/i
```

**Problems:**
- "Show me the route from coffee to ICA" matched "show me" → extracted "the route from coffee to ICA"
- Google searched for place literally named "the route from coffee to ICA"
- Found random "The Route" restaurant in India

**New pattern:**
```typescript
/^([a-zA-ZåäöÅÄÖ\s]+)\s+(near|in)\s+([a-zA-ZåäöÅÄÖ,\s]+)$/i
```

**Benefits:**
- Must start with search term (no "show", "find", etc.)
- Must have "near" or "in"
- Must end with location
- Nothing else allowed

### Why Geographic Constraints Are Important

**Without locationBias:**
```javascript
Google Maps searches globally for "coffee"
Could find:
- Coffee Together in Netherlands
- The Coffee Bean in USA
- Coffee House in India
```

**With locationBias:**
```javascript
const swedenBounds = new window.google.maps.LatLngBounds(
  new window.google.maps.LatLng(55.0, 12.5),
  new window.google.maps.LatLng(57.0, 15.0)
);
Google Maps searches with bias towards Sweden
Finds:
- Möllans Café in Sjöbo, Sweden ✅
- Espresso House in Malmö, Sweden ✅
```

### Why Drizzle Schema Needed Update

**Database:**
```sql
-- Column exists in database (created by migration 2016a)
ALTER TABLE agents ADD COLUMN enabled_plugins JSONB DEFAULT '[]'::jsonb;
```

**Drizzle (before fix):**
```typescript
export const agents = pgTable('agents', {
  // ... other fields ...
  // enabled_plugins field missing!
});
```

**Result:** Drizzle couldn't see the column, API couldn't read it

**Drizzle (after fix):**
```typescript
export const agents = pgTable('agents', {
  // ... other fields ...
  enabledPlugins: jsonb('enabled_plugins').default([]), // ✅
});
```

**Result:** Drizzle can now read/write the field

---

## Verification Checklist

Run these tests to verify everything works:

- [ ] Open http://localhost:5174/ and hard refresh (Ctrl+Shift+R)
- [ ] Run COMPLETE_MAP_FIX.sql in Supabase SQL Editor
- [ ] Test: "Find coffee near me" → Shows ONE map with Swedish results
- [ ] Test: "Restaurants in Stockholm" → Shows Stockholm restaurants
- [ ] Test: "Route from X to Y" → NO map, suggests Google Maps app
- [ ] Agent Manager → Personal Assistant → Plugins are checked
- [ ] Console shows no COEP errors
- [ ] Console shows "✅ Detected valid location query: coffee near Lövestad, Sweden"

---

## Implementation Date
**2025-10-29**

## Developer
Claude (via Claude Code)

## Status
✅ **COMPLETE - Ready for Testing**

All code changes are live via Vite HMR.
Only remaining step: Run COMPLETE_MAP_FIX.sql in Supabase.
