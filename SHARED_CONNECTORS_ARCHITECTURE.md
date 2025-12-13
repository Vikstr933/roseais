# Shared Connectors Architecture

## Problem
Användare behöver ange API-nycklar (t.ex. Vercel, Stripe) när de genererar appar. Dessa API-nycklar borde hanteras som "Shared Connectors" (workspace-wide) eller "Personal Connectors" (user-specific).

## Nuvarande Situation

### API Keys System
- Sparas i `apiKeys` tabellen
- Kan vara user-wide (`projectId = null`) eller project-specific (`projectId = number`)
- Hanteras via `/api/api-keys` endpoints
- Används av `APIKeyService`

### Connectors/Plugins System
- Sparas i `pluginConfigs` tabellen
- OAuth-baserade tjänster (Gmail, Notion, etc.)
- Hanteras via `/api/plugins` endpoints
- Används av `PluginRegistry`

## Lösning: Integrera API Keys med Connectors Hub

### 1. Shared Connectors (Workspace-wide API Keys)
- **Vercel API Token**: Konfigureras av admin, används av alla i workspace
- **Stripe API Key**: Konfigureras av admin, används av alla i workspace
- **GitHub Token**: Konfigureras av admin, används av alla i workspace
- Sparas i `apiKeys` tabellen med `projectId = null` och markerade som `isShared = true`
- Visas i "Shared Connectors" tab i Integrations

### 2. Personal Connectors (User-specific API Keys)
- **User's Vercel Token**: Om användaren vill använda sin egen Vercel account
- **User's Stripe Key**: Om användaren vill använda sin egen Stripe account
- Sparas i `apiKeys` tabellen med `projectId = null` och `isShared = false`
- Visas i "Personal Connectors" tab i Integrations

### 3. Flow när API Key behövs

1. **System detekterar att API key saknas** (t.ex. vid deployment till Vercel)
2. **Kollar först Shared Connectors** (workspace-wide)
   - Om finns → använd den
   - Om inte finns → gå till steg 3
3. **Kollar Personal Connectors** (user-specific)
   - Om finns → använd den
   - Om inte finns → gå till steg 4
4. **Visa dialog för att ange API key**
   - Fråga: "Workspace-wide (Shared) eller Personal?"
   - Om Shared → kräv admin-rättigheter
   - Om Personal → spara som user-specific
5. **Spara API key** i `apiKeys` tabellen med rätt flaggor

### 4. Database Schema Ändringar

```sql
-- Lägg till kolumner i apiKeys tabellen
ALTER TABLE api_keys ADD COLUMN is_shared BOOLEAN DEFAULT false;
ALTER TABLE api_keys ADD COLUMN workspace_id TEXT; -- För shared connectors
ALTER TABLE api_keys ADD COLUMN configured_by TEXT; -- User ID som konfigurerade
```

### 5. UI Integration

**Integrations Page:**
- **Shared Connectors Tab**: Visar workspace-wide API keys (Vercel, Stripe, GitHub)
  - Admin kan konfigurera/uppdatera
  - Andra användare ser status men kan inte ändra
- **Personal Connectors Tab**: Visar user-specific API keys
  - Användaren kan konfigurera sina egna

**API Key Dialog:**
- När API key behövs, visa dialog med val:
  - "Use workspace API key (if available)"
  - "Configure workspace API key (admin only)"
  - "Use my personal API key"
  - "Configure my personal API key"

### 6. Backend Logic

**ProductionDeploymentService:**
```typescript
async getVercelToken(userId: string, workspaceId?: string): Promise<string | null> {
  // 1. Kolla workspace-wide (shared)
  if (workspaceId) {
    const sharedKey = await db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.serviceName, 'vercel'),
        eq(apiKeys.isShared, true),
        eq(apiKeys.workspaceId, workspaceId)
      ))
      .limit(1);
    
    if (sharedKey[0]) {
      return decryptKey(sharedKey[0].encryptedKey);
    }
  }
  
  // 2. Kolla user-specific (personal)
  const personalKey = await db.select()
    .from(apiKeys)
    .where(and(
      eq(apiKeys.serviceName, 'vercel'),
      eq(apiKeys.userId, userId),
      eq(apiKeys.isShared, false)
    ))
    .limit(1);
  
  if (personalKey[0]) {
    return decryptKey(personalKey[0].encryptedKey);
  }
  
  // 3. Fallback till environment variable (för backward compatibility)
  return process.env.VERCEL_TOKEN || null;
}
```

## Implementation Steps

1. ✅ Uppdatera database schema för `apiKeys`
2. ✅ Skapa migration för nya kolumner
3. ✅ Uppdatera `APIKeyService` för att hantera shared/personal
4. ✅ Uppdatera `Integrations` page för att visa API keys som connectors
5. ✅ Uppdatera `ProductionDeploymentService` för att kolla shared/personal keys
6. ✅ Uppdatera API key dialogs för att fråga om shared/personal
7. ✅ Lägg till admin-kontroller för shared connectors

## Benefits

- **Konsekvent UX**: API keys och OAuth connectors hanteras på samma sätt
- **Workspace Efficiency**: En admin konfigurerar Vercel en gång, alla använder
- **Flexibilitet**: Användare kan fortfarande använda sina egna API keys
- **Säkerhet**: Shared connectors kräver admin-rättigheter
- **Transparency**: Tydligt vad som är workspace-wide vs personal

