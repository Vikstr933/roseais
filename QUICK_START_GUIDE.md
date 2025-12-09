# Quick Start Guide - Plugin System & Assistant

## ✅ Prerequisites Completed

You've already added the Google OAuth credentials to `.env`:
```env
GOOGLE_CLIENT_ID=90937617179-tal9dn7tqr164iv133v4hs3arolsq3lm.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:5000/api/plugins/gmail/callback
```

## 🚀 Getting Started

### Step 1: Run Database Migration

Create the new plugin tables:

```bash
npm run db:migrate
```

Or manually run the SQL migration:
```bash
psql $DATABASE_URL -f migrations/2010_add_plugin_system_tables.sql
```

### Step 2: Start the Server

```bash
npm run dev
```

The server should start without the schema error now!

### Step 3: Verify Plugin System

Open your browser and check:

1. **Check plugins endpoint**:
   - Go to: http://localhost:5000/api/plugins
   - Should return: `{ success: true, plugins: [{ id: 'gmail', name: 'Gmail', ... }] }`

2. **Check health**:
   - Go to: http://localhost:5000/api/health
   - Should return: `{ status: 'ok' }`

### Step 4: Add Assistant Widget to UI

Open `client/src/App.tsx` and add the AssistantWidget:

```typescript
import AssistantWidget from '@/components/AssistantWidget';
import { useState } from 'react';

function App() {
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  return (
    <>
      {/* Your existing routes */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/playground" element={
          <Playground
            onGenerationStart={() => setIsGenerating(true)}
            onGenerationComplete={(result) => {
              setIsGenerating(false);
              setLastResult(result);
            }}
          />
        } />
        {/* ... other routes ... */}
      </Routes>

      {/* Assistant Widget - available everywhere */}
      <AssistantWidget
        contextData={{
          currentPage: window.location.pathname,
          workspaceId: currentWorkspace?.id,
          generationInProgress: isGenerating,
          lastGenerationResult: lastResult
        }}
        onCodeGenerated={(code, metadata) => {
          console.log('Assistant generated code:', code);
          // Optionally handle code insertion
        }}
      />
    </>
  );
}
```

### Step 5: Connect Gmail Plugin

1. **Navigate to Integrations**:
   - Go to: http://localhost:3000/integrations

2. **Click "Connect Gmail"**:
   - You'll be redirected to Google OAuth
   - Sign in with your Google account
   - Grant permissions for Gmail access
   - You'll be redirected back to the app

3. **Wait for Initial Sync**:
   - The plugin will automatically sync your emails
   - AI analysis will be performed on each email
   - Check the plugin status card for progress

### Step 6: Test the Assistant

1. **Open Assistant Widget**:
   - Click the floating chat button (bottom-right corner)

2. **Try these commands**:
   ```
   "What are my high priority emails?"
   "Create a contact form with validation"
   "Check my unread emails"
   "Send an email to test@example.com"
   ```

3. **Watch the Magic**:
   - Assistant queries your Gmail plugin for context
   - Generates code using the orchestrator
   - Executes actions via tools

## 🧪 Testing the Integration

### Test 1: Basic Assistant Chat

```bash
# From your terminal or Postman
curl -X POST http://localhost:5000/api/plugins/assistant/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are my emails about?",
    "includeContext": true
  }'
```

### Test 2: Plugin Status

```bash
curl http://localhost:5000/api/plugins/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 3: Manual Gmail Sync

```bash
curl -X POST http://localhost:5000/api/plugins/gmail/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "fullSync": false }'
```

## 🎯 Common Use Cases

### Use Case 1: Natural Language Code Generation

**You**: (in assistant widget) "Create a blog app with dark mode"

**Assistant**:
- Gathers requirements through conversation
- Uses `generate_app` tool
- Triggers OrchestrationAgent
- Returns preview link

### Use Case 2: Email-Driven Development

**Scenario**: You receive email from PM about new feature

**Assistant** (proactive):
"I noticed a high-priority email from Sarah about a dashboard feature. Want me to build it?"

**You**: "Yes"

**Assistant**:
- Extracts requirements from email
- Generates code via orchestrator
- Offers to reply to Sarah with preview link

### Use Case 3: Code Explanation

**You**: (after generating app) "Explain how useState works in this code"

**Assistant**:
- Uses `explain_generated_code` tool
- Analyzes workspace files
- Provides interactive explanation with code snippets

## 🐛 Troubleshooting

### Error: "Plugin not initialized"

**Fix**: Make sure you've connected the plugin first:
1. Go to `/integrations`
2. Click "Connect Gmail"
3. Complete OAuth flow

### Error: "Failed to sync plugin"

**Possible causes**:
- OAuth token expired → Re-connect plugin
- Gmail API quota exceeded → Wait and try again
- Network issue → Check internet connection

**Fix**:
```bash
# Check plugin status
curl http://localhost:5000/api/plugins/status -H "Authorization: Bearer YOUR_TOKEN"

# Force re-sync
curl -X POST http://localhost:5000/api/plugins/gmail/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{ "fullSync": true }'
```

### Error: "Tool not found"

**Cause**: Assistant's code generation tools not registered

**Fix**: Ensure server startup initializes the bridge:

```typescript
// server/index.ts
import { assistantOrchestratorBridge } from './services/AssistantOrchestratorBridge';

// After server starts
assistantOrchestratorBridge.registerCodeGenerationTools('*');
```

### Widget Not Showing

**Checklist**:
- [ ] AssistantWidget imported in App.tsx
- [ ] Component rendered in JSX
- [ ] No console errors
- [ ] z-index not conflicting (widget uses z-50)

## 📊 Monitoring

### Check Plugin Health

```sql
-- See all plugin configs
SELECT * FROM plugin_configs;

-- Check sync logs
SELECT * FROM plugin_sync_logs ORDER BY started_at DESC LIMIT 10;

-- View synced knowledge
SELECT
  plugin_id,
  type,
  COUNT(*) as item_count
FROM plugin_knowledge
GROUP BY plugin_id, type;
```

### Check Assistant Activity

```sql
-- Plugin actions executed
SELECT
  plugin_id,
  action_type,
  status,
  COUNT(*)
FROM plugin_actions
GROUP BY plugin_id, action_type, status;
```

## 🎨 Customization

### Change Widget Position

Edit `client/src/components/AssistantWidget.tsx`:

```typescript
// Change from bottom-right to bottom-left
<div className="fixed bottom-6 left-6 z-50">  {/* was: right-6 */}
```

### Add Custom Tools

```typescript
// server/services/AssistantOrchestratorBridge.ts
const customTools: Tool[] = [
  {
    name: 'deploy_to_vercel',
    description: 'Deploy the application to Vercel',
    parameters: { /* ... */ },
    execute: async (params) => {
      // Your deployment logic
    }
  }
];

personalAssistantAgent.registerToolsForUser(userId, customTools);
```

### Customize Assistant Personality

Edit `server/agents/PersonalAssistantAgent.ts` → `buildSystemPrompt()`:

```typescript
const basePrompt = `You are a highly capable personal AI assistant...

// Add custom traits:
- Be more casual and use emojis
- Focus on code quality and best practices
- Always suggest testing strategies
`;
```

## 🔐 Security Notes

### Important: Credential Encryption

**Current State**: Credentials stored as plaintext JSONB

**TODO for Production**:
```typescript
// server/services/PluginRegistry.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const algorithm = 'aes-256-cbc';

private encryptCredentials(credentials: PluginCredentials): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    algorithm,
    crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32),
    iv
  );

  let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return JSON.stringify({ iv: iv.toString('hex'), data: encrypted });
}
```

### OAuth Token Refresh

Gmail tokens expire after 1 hour. Implement auto-refresh:

```typescript
// server/plugins/GmailPlugin.ts
private async refreshTokenIfNeeded(): Promise<void> {
  const tokens = this.oauth2Client.credentials;

  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    this.oauth2Client.setCredentials(credentials);

    // Update in database
    await this.updateStoredCredentials(credentials);
  }
}
```

## 📈 Next Steps

1. **Add More Plugins**:
   - Google Calendar
   - Todoist/Tasks
   - Notion
   - Slack

2. **Enhance Assistant**:
   - Voice commands
   - Proactive notifications
   - Learning from user patterns
   - Multi-step workflows

3. **Improve Code Generation**:
   - Assistant suggests prompt improvements
   - Iterative refinement through conversation
   - Auto-testing generated code

4. **Deploy**:
   - Set up production database
   - Enable credential encryption
   - Configure OAuth production URLs
   - Set up monitoring (Sentry)

## 🎉 You're Ready!

Your AI Library now has:
- ✅ Multi-agent code generation
- ✅ Personal assistant with Gmail integration
- ✅ Floating assistant widget
- ✅ Natural language development
- ✅ Email-driven workflows

Start by connecting Gmail, then try: **"What should I work on today?"**

The assistant will check your emails, calendar (when connected), and provide intelligent suggestions!

---

**Need Help?**
- Check logs: `tail -f server.log`
- Review docs: `PLUGIN_SYSTEM_IMPLEMENTATION.md`
- Use cases: `INTEGRATED_SYSTEM_USE_CASES.md`
