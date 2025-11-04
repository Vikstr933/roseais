# Plugin Credentials System - Implementation Guide

**Created:** 2025-11-04
**Purpose:** Document how the plugin credential system works and what's needed for full integration

---

## Current State

### What Works ✅
1. **System Plugins** (Gmail, Calendar, GitHub, etc.)
   - Hardcoded OAuth flows in `/api/plugins/{plugin}/auth/start`
   - Credentials stored in database via OAuth callback
   - Connection status tracked in PluginRegistry

2. **Credential Vault UI**
   - Accessible via Settings → API Keys
   - Manual credential entry for predefined services
   - Supports: Discord, Slack, Trello, Notion, GitHub, GitLab, Linear

3. **Plugin Generator**
   - Detects if plugin needs auth (`requiresAuth`, `authType`)
   - Generates secure plugin code
   - Stores in `user_generated_plugins` table

### What Needs Implementation ❌

#### 1. Dynamic Credential Detection
The plugin generator needs to analyze generated code and determine **exactly** what credentials are needed.

**Example Discord Plugin Needs:**
```json
{
  "webhookUrl": {
    "label": "Discord Webhook URL",
    "type": "url",
    "required": true,
    "description": "Get this from Server Settings → Integrations → Webhooks"
  },
  "botToken": {
    "label": "Bot Token (Optional)",
    "type": "password",
    "required": false,
    "description": "Only needed for reading messages"
  }
}
```

**Implementation Location:**
`server/agents/PluginGeneratorAgent.ts` - Add method to extract credential requirements from generated code

#### 2. User-Generated Plugin Connection Flow
Currently, clicking "Connect" on a user-generated plugin shows "Plugin not yet supported".

**Needed:**
- Update `client/src/pages/Integrations.tsx` → `handleConnectPlugin()`
- Check if plugin is user-generated (`isUserGenerated` flag)
- If yes: Open credential input dialog
- If no: Use OAuth flow (existing code)

**Connection Dialog Should:**
1. Show plugin name: "Connect Discord Plugin"
2. Display required credential fields (from `credentialsRequired`)
3. Allow user to enter values
4. Save to `/api/credentials` endpoint
5. Mark plugin as "connected" in `plugin_installations` table

#### 3. Dynamic Credential Vault
Make Credential Vault adapt to show fields for ANY plugin.

**Current Problem:**
`SERVICE_CONFIGS` in `CredentialVault.tsx` is hardcoded

**Solution:**
```typescript
// Fetch all plugins that need credentials
const { data: pluginsNeedingCreds } = useQuery({
  queryKey: ['plugins-needing-credentials'],
  queryFn: async () => {
    const res = await apiFetch('/api/plugins');
    const plugins = await res.json();
    return plugins.filter(p => p.requiresAuth || p.credentialsRequired);
  }
});

// Dynamically build service configs
const dynamicServiceConfigs = pluginsNeedingCreds.reduce((configs, plugin) => {
  if (plugin.credentialsRequired) {
    configs[plugin.id] = {
      name: plugin.name,
      icon: plugin.icon,
      type: plugin.authType || 'custom',
      fields: Object.entries(plugin.credentialsRequired).map(([key, config]) => ({
        name: key,
        label: config.label,
        type: config.type,
        required: config.required,
        description: config.description
      })),
      docsUrl: plugin.docsUrl
    };
  }
  return configs;
}, {});
```

#### 4. Plugin Installation Tracking
When user provides credentials, create installation record:

```sql
INSERT INTO plugin_installations (user_id, plugin_id, status, credentials_stored, installed_at)
VALUES ($1, $2, 'active', true, NOW());
```

---

## Database Schema

### Current Schema ✅
```sql
CREATE TABLE user_generated_plugins (
  ...
  requires_auth BOOLEAN DEFAULT FALSE,
  auth_type TEXT,
  auth_config JSONB,
  ...
);
```

### Added in Migration 2026 ✅
```sql
ALTER TABLE user_generated_plugins
ADD COLUMN credentials_required JSONB DEFAULT '{}';
```

### Example Data Structure
```json
{
  "credentials_required": {
    "webhookUrl": {
      "label": "Discord Webhook URL",
      "type": "url",
      "required": true,
      "description": "Get this from Server Settings → Integrations → Webhooks",
      "placeholder": "https://discord.com/api/webhooks/..."
    },
    "botToken": {
      "label": "Bot Token",
      "type": "password",
      "required": false,
      "description": "Only needed if you want to read messages"
    }
  }
}
```

---

## Implementation Priority

### Phase 1: Credential Detection (Plugin Generator)
**File:** `server/agents/PluginGeneratorAgent.ts`

Add method to analyze generated code:
```typescript
private detectCredentialRequirements(code: string, serviceName: string): Record<string, any> {
  const requirements: Record<string, any> = {};

  // Detect webhook URLs
  if (code.includes('webhook') || code.includes('Webhook')) {
    requirements.webhookUrl = {
      label: `${serviceName} Webhook URL`,
      type: 'url',
      required: true,
      description: `Webhook URL for ${serviceName}`,
      placeholder: 'https://...'
    };
  }

  // Detect API keys
  if (code.includes('apiKey') || code.includes('API_KEY')) {
    requirements.apiKey = {
      label: 'API Key',
      type: 'password',
      required: true,
      description: `API key for ${serviceName}`,
    };
  }

  // Detect bot tokens
  if (code.includes('botToken') || code.includes('BOT_TOKEN')) {
    requirements.botToken = {
      label: 'Bot Token',
      type: 'password',
      required: false,
      description: 'Optional bot token for enhanced features',
    };
  }

  // Detect OAuth
  if (code.includes('clientId') && code.includes('clientSecret')) {
    requirements.clientId = {
      label: 'Client ID',
      type: 'text',
      required: true,
    };
    requirements.clientSecret = {
      label: 'Client Secret',
      type: 'password',
      required: true,
    };
  }

  return requirements;
}
```

Then update the return type and call this in `generateSecureCode()`:
```typescript
const credentialsRequired = this.detectCredentialRequirements(code, params.serviceName);

return {
  code,
  pluginName,
  description,
  capabilities: params.capabilities,
  requiresAuth,
  authType,
  credentialsRequired,  // ADD THIS
  tokensUsed: ...
};
```

### Phase 2: Save Credentials Required
**File:** `server/routes/user-plugins.ts`

Update plugin creation (line ~220):
```typescript
await db.insert(userGeneratedPlugins).values({
  pluginId: result.pluginId,
  userId,
  name: result.metadata.pluginName,
  description: result.metadata.description,
  serviceName: body.serviceName || 'custom',
  generatedCode: result.generatedCode,
  pluginTemplate: 'base',
  capabilities: result.metadata.capabilities,
  securityScore: result.securityScore,
  securityIssues: result.flaggedIssues,
  sandboxConfig: { ... },
  status: result.status,
  rateLimits: { ... },
  resourceLimits: { ... },
  requiresAuth: result.metadata.requiresAuth,
  authType: result.metadata.authType,
  authConfig: null,
  credentialsRequired: result.metadata.credentialsRequired || {},  // ADD THIS
  version: '1.0.0',
});
```

### Phase 3: Update API Response
**File:** `server/routes/plugins.ts`

Already updated to include `credentialsRequired` in response (line ~170)

### Phase 4: Connection Flow
**File:** `client/src/pages/Integrations.tsx`

Update `handleConnectPlugin()`:
```typescript
const handleConnectPlugin = async (pluginId: string) => {
  try {
    setError(null);
    setSuccess(null);
    setConnecting(prev => new Set(prev).add(pluginId));

    // Find the plugin
    const plugin = availablePlugins.find(p => p.id === pluginId);
    if (!plugin) return;

    // Check if it's a user-generated plugin
    if (plugin.isUserGenerated && plugin.credentialsRequired) {
      // Open credential input dialog
      setCredentialServiceName(pluginId);
      setCredentialDialogOpen(true);
      setConnecting(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginId);
        return newSet;
      });
      return;
    }

    // For system plugins, use OAuth flow (existing code)
    if (pluginId === 'gmail') {
      // ... existing OAuth code
    }
    // ... etc
  } catch (error) {
    console.error(`Failed to connect ${pluginId}:`, error);
    setError(`Failed to connect plugin`);
    setConnecting(prev => {
      const newSet = new Set(prev);
      newSet.delete(pluginId);
      return newSet;
    });
  }
};
```

### Phase 5: Credential Input Dialog
**File:** `client/src/pages/Integrations.tsx`

Add dialog component:
```typescript
<Dialog open={credentialDialogOpen} onOpenChange={setCredentialDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Connect {selectedPlugin?.name}</DialogTitle>
      <DialogDescription>
        Enter your credentials to connect this plugin
      </DialogDescription>
    </DialogHeader>

    {selectedPlugin?.credentialsRequired && (
      <div className="space-y-4">
        {Object.entries(selectedPlugin.credentialsRequired).map(([key, config]) => (
          <div key={key}>
            <Label>{config.label}</Label>
            {config.description && (
              <p className="text-sm text-muted-foreground">{config.description}</p>
            )}
            <Input
              type={config.type}
              placeholder={config.placeholder}
              required={config.required}
              onChange={(e) => setCredentialFormData({
                ...credentialFormData,
                [key]: e.target.value
              })}
            />
          </div>
        ))}
      </div>
    )}

    <DialogFooter>
      <Button onClick={handleSaveCredentials}>Connect</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Testing Checklist

Once implemented, test this flow:

1. **Generate Plugin**
   - [ ] Generate a Discord webhook plugin
   - [ ] Verify `credentialsRequired` is populated in database
   - [ ] Check plugin appears in Integrations list

2. **View Plugin**
   - [ ] Navigate to Integrations
   - [ ] See Discord plugin with "AI Generated" badge
   - [ ] Click "Connect Discord"

3. **Enter Credentials**
   - [ ] Dialog opens with credential fields
   - [ ] Shows "Discord Webhook URL" field
   - [ ] Shows helpful description/placeholder
   - [ ] Enter valid webhook URL
   - [ ] Click "Connect"

4. **Verify Connection**
   - [ ] Plugin shows "Connected" badge
   - [ ] Can see credentials in Settings → API Keys
   - [ ] Can test/validate the credential
   - [ ] Can disconnect and reconnect

5. **Use Plugin**
   - [ ] Plugin appears in AI Assistant's available tools
   - [ ] Can execute plugin actions
   - [ ] Credentials are used correctly

---

## Error Messages to Fix

### Current Errors
1. `"Plugin plugin_93oWa9jQ1u9rU-Tz is not yet supported"`
   - **Cause:** `handleConnectPlugin()` doesn't handle user-generated plugins
   - **Fix:** Phase 4 above

2. `"Connect undefined"` button text
   - **Cause:** `plugin.name` is missing in some cases
   - **Fix:** Already fixed in commit 0b8e93c

---

## Summary

**The plugin generator can detect what kind of auth a plugin needs** (`requiresAuth`, `authType`)
**BUT** it doesn't yet extract the specific credential fields required.

**To complete the credential workflow:**
1. Teach the generator to extract credential field requirements from generated code
2. Save this in `credentialsRequired` field
3. Build UI to collect these credentials from users
4. Link credentials to plugin installations

**Priority:** Phase 1 (credential detection) is the foundation for everything else.
