# Database Provisioning & Agent Security - Implementation Guide

## Summary of Findings

### 1. ✅ Agents ARE Used in Code Generation

**Yes, the system fully uses agents from the database:**

- **`component-architect`**: Used by `AnalysisAgent` for planning and architecture
- **`component-developer`**: Used by `IncrementalOrchestrator` for all code generation phases
- **`component-qa`**: Available for QA phases (can be integrated)
- **`component-stylist`**: Available for styling phases

**How it works:**
1. System loads agent from database: `SELECT * FROM agents WHERE id = 'component-architect'`
2. Uses agent's `systemPrompt`, `model`, and `temperature` settings
3. Caches agent config for performance
4. Falls back to defaults if agent not found

**Location:**
- `server/services/AnalysisAgent.ts` - loads `component-architect`
- `server/services/IncrementalOrchestrator.ts` - loads `component-developer` (and others)

---

### 2. 🔒 Agent Security Status

**Current Protection:**
- ✅ System agents (`isSystem = 1`) can only be modified/deleted by admins
- ✅ Non-admins cannot update system agents
- ✅ Non-admins cannot delete system agents
- ✅ Users can only edit their own agents

**Security Checks:**
```typescript
// In server/routes/agents.ts
const isSystemAgent = agentData.isSystem === 1;
if (isSystemAgent && !isAdmin) {
  return res.status(403).json({
    error: 'Forbidden',
    message: 'System agents can only be modified by administrators'
  });
}
```

**Recommendation:** ✅ Security is already in place, but we should verify all system agents have `isSystem = 1`.

---

### 3. 🗄️ DatabaseProvisioningService Explained

**What it does:**
1. **Checks for API keys** (backend environment variables):
   - `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_DB_PASSWORD`
   - `NEON_API_KEY`, `NEON_PROJECT_ID`
   - `MONGODB_ATLAS_API_KEY`, `MONGODB_ATLAS_PROJECT_ID`

2. **Provisions databases** via cloud provider APIs:
   - Creates database instance
   - Gets connection string
   - Encrypts connection string using `CredentialVault`
   - Stores encrypted connection string in `project_databases` table

3. **Uses CredentialVault** to encrypt project-specific connection strings (NOT API keys)

**Flow:**
```
User imports/generates project
  ↓
System detects database needed
  ↓
Check: Are API keys configured? (process.env)
  ↓
If NO → Emit API_KEY_REQUIRED event → Show dialog → User provides keys → Retry
  ↓
If YES → Call provider API → Get connection string → Encrypt → Store in DB
```

**Important:** 
- API keys are **backend environment variables** (set by admin)
- Connection strings are **per-project** and stored encrypted in `project_databases` table
- CredentialVault is used to encrypt connection strings, NOT API keys

---

### 4. 🔄 Auto-Resume Implementation Plan

**Scenario 1: Generate Webshop App**
1. User asks: "Generate a webshop application"
2. AI detects database needed → Checks API keys
3. If missing → Emit `API_KEY_REQUIRED` → Show dialog
4. User provides API keys → Save to backend env vars
5. **Auto-resume:** System automatically retries database provisioning
6. Database provisioned → App works on first launch

**Scenario 2: Import GitHub Project**
1. User imports project → System detects database needed
2. Check API keys → If missing → Emit `API_KEY_REQUIRED` → Show dialog
3. User provides API keys → Save to backend env vars
4. **Auto-resume:** System automatically retries database provisioning
5. Database provisioned → Imported app works fully

**Implementation:**
1. Add endpoint: `POST /api/projects/:projectId/provision-database`
2. Store pending provisioning requests in database
3. When API keys are saved, automatically retry provisioning
4. Update `DatabaseAPIKeyDialog` to trigger retry after keys are saved

---

## Implementation Tasks

- [ ] Add `retryDatabaseProvisioning` endpoint
- [ ] Store pending provisioning requests
- [ ] Update `DatabaseAPIKeyDialog` to call retry endpoint
- [ ] Add auto-resume logic when API keys are configured
- [ ] Verify all system agents have `isSystem = 1`
- [ ] Add migration to ensure system agents are protected

