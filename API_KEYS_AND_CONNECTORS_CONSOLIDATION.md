# API Keys & Connectors Consolidation Plan

## 🔍 Current State Analysis

Vi har **4 olika system** för att hantera API keys och secrets:

### 1. **CredentialVault** (Settings → API Keys)
- **Endpoint**: `/api/credentials`
- **Purpose**: OAuth credentials för plugins (Discord, Slack, Trello, Notion, GitHub, etc.)
- **Storage**: `credentials` tabellen
- **Use Case**: Plugin-autentisering via OAuth

### 2. **SecretsVault** (DesktopView)
- **Endpoint**: `/api/secrets`
- **Purpose**: Generella secrets/API keys för användare
- **Storage**: `secrets` tabellen (eller localStorage fallback)
- **Use Case**: Snabb åtkomst till secrets i desktop view

### 3. **APIKeyManager** (Settings → API Keys)
- **Endpoint**: `/api/api-keys/user/${userId}`
- **Purpose**: Generella API keys för användare
- **Storage**: `api_keys` tabellen
- **Use Case**: API keys för olika tjänster

### 4. **Connectors** (Integrations page)
- **Endpoints**: `/api/shared-connectors`, `/api/tool-permissions`
- **Purpose**: Shared och Personal connectors
- **Storage**: `shared_connectors` tabellen + `api_keys` med `isShared: true`
- **Use Case**: Workspace-wide connectors (Stripe, Vercel, etc.)

## ⚠️ Problems Identified

1. **Duplication**: SecretsVault och APIKeyManager gör samma sak
2. **Confusion**: Användare vet inte var de ska lägga sina API keys
3. **Missing Features**: Inga färdiga connectors med env variable management
4. **No Integration**: SecretsVault och Connectors är inte kopplade

## ✅ Proposed Solution

### Unified System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Connectors Hub (Integrations)              │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Shared Connectors │  │ Personal Connectors│         │
│  │ (Stripe, Vercel)  │  │ (Gmail, Notion)   │         │
│  │                   │  │                   │         │
│  │ - Env Variables   │  │ - OAuth Tokens    │         │
│  │ - API Keys        │  │ - API Keys        │         │
│  │ - Config          │  │ - Config          │         │
│  └──────────────────┘  └──────────────────┘         │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │   Unified API Keys Storage     │
        │   (api_keys table)             │
        │                                │
        │   - userId (personal)          │
        │   - projectId (project-specific)│
        │   - isShared (workspace-wide)  │
        │   - connectorId (linked)       │
        └───────────────────────────────┘
```

### Changes Needed

#### 1. **Consolidate Storage**
- **Keep**: `api_keys` table as single source of truth
- **Add**: `connectorId` field to link API keys to connectors
- **Remove**: `secrets` table (migrate to `api_keys`)
- **Keep**: `credentials` table (for OAuth tokens only)

#### 2. **Update SecretsVault**
- **Change**: Use `/api/api-keys` instead of `/api/secrets`
- **Display**: Show all user's API keys (personal + project-specific)
- **Filter**: Allow filtering by connector/service

#### 3. **Add Pre-built Connectors**
- **Stripe**: 
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- **Vercel**:
  - `VERCEL_TOKEN`
  - `VERCEL_TEAM_ID` (optional)
- **GitHub**:
  - `GITHUB_TOKEN` (personal access token)
- **OpenAI**:
  - `OPENAI_API_KEY`
- **Anthropic**:
  - `ANTHROPIC_API_KEY`

#### 4. **Env Variable Management**
- **For Shared Connectors**: Admins can set env variables that are available to all users
- **For Personal Connectors**: Users can set their own env variables
- **For Projects**: Project-specific env variables (for deployment)

#### 5. **Update CredentialVault**
- **Keep**: For OAuth credentials only
- **Remove**: API key management (move to Connectors)
- **Rename**: "OAuth Credentials" instead of "API Keys"

## 📋 Implementation Steps

### Phase 1: Database Schema Updates
1. ✅ `api_keys` table already has:
   - `serviceName` (can link to connectors)
   - `isShared` (for workspace-wide)
   - `projectId` (for project-specific)
   - `keyType` (api_key, secret, token, password)
2. Add `connectorId` to `api_keys` table (optional, for explicit linking)
3. Add `envVariables` JSONB field to `shared_connectors` table
4. **Note**: `/api/secrets` uses in-memory Map - needs migration to `api_keys`

### Phase 2: Backend Updates
1. Update `/api/secrets` to use `api_keys` table instead of in-memory Map
2. Update `/api/api-keys` to support filtering by `serviceName` (connector)
3. Add `/api/connectors/:id/env-variables` endpoint for env variable management
4. Add pre-built connector definitions (Stripe, Vercel, GitHub, OpenAI, Anthropic)
5. Update `APIKeyService` to support connector linking

### Phase 3: Frontend Updates
1. Update `SecretsVault` to use `/api/api-keys` instead of `/api/secrets`
2. Add env variable management UI to Connectors page
3. Update `CredentialVault` to only show OAuth (rename to "OAuth Credentials")
4. Add pre-built connectors to Integrations page with env variable config
5. Show API keys from connectors in SecretsVault

### Phase 4: Migration
1. Migrate in-memory secrets to `api_keys` table (if any exist)
2. Link existing API keys to connectors via `serviceName`
3. Update all frontend references

## 🎯 User Experience

### For Users:
1. **Go to Integrations** → See all connectors (Shared + Personal)
2. **Click on Stripe** → Configure API keys and env variables
3. **Use in Projects** → Env variables automatically available
4. **Desktop Secrets Vault** → Shows all your API keys in one place

### For Admins:
1. **Configure Shared Connectors** → Set workspace-wide API keys
2. **Manage Env Variables** → Set default env variables for all users
3. **Override Project Settings** → Can override project-specific settings

## 🔒 Security Considerations

1. **Encryption**: All API keys encrypted at rest
2. **Access Control**: 
   - Personal: Only user can see
   - Project: Only project members can see
   - Shared: Only admins can configure, all users can use
3. **Audit Log**: Track who accessed/modified API keys

## 📝 Next Steps

1. Review and approve this plan
2. Create database migration
3. Update backend APIs
4. Update frontend components
5. Test migration
6. Deploy

