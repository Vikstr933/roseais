# Settings Architecture

## Problem
Currently, settings are scattered across multiple locations:
- `/settings` - User settings (Account, Security, Billing, etc.)
- Playground gear icon - Project-specific settings (Publishing Policy)
- `/integrations` - Shared Connectors
- CredentialVault - API Keys (OAuth)
- SecretsVault (Desktop) - User secrets

This creates confusion about where to find specific settings.

## Solution: Two-Tier Settings System

### 1. **User Settings** (`/settings`)
Global settings that apply to the user across all projects.

| Tab | Content | Current Status |
|-----|---------|----------------|
| **Account** | Profile, display name, email | ✅ Exists |
| **Security** | Password, 2FA, sessions | ✅ Exists |
| **Connectors** | Shared & Personal connectors overview | 🆕 NEW |
| **API Keys** | Project-specific API key overview | 🆕 NEW |
| **Company** | Company info, VAT, address | ✅ Exists |
| **Billing** | Subscription, invoices | ✅ Exists |
| **Preferences** | Theme, notifications, code style | ✅ Exists |

#### 🆕 New "Connectors" Tab
Shows:
- **Shared Connectors** (e.g., Stripe, Vercel, GitHub)
  - Configured by admin
  - Available to all projects
  - Click to view/edit
- **Personal Connectors** (e.g., Notion, Linear)
  - User-specific OAuth connections
  - Used across user's projects

#### 🆕 New "API Keys" Tab
Shows:
- Overview table of all API keys across projects
- Columns: Project Name | Service | Key Type | Created | Last Used
- Click project name → navigate to Project Settings
- Allows user to see which projects use which keys

### 2. **Project Settings** (Playground gear icon)
Settings specific to the currently active project.

| Section | Content | Current Status |
|---------|---------|----------------|
| **General** | Project name, description, visibility | 🆕 NEW |
| **Publishing** | External publishing policy | ✅ Exists |
| **API Keys** | Project-specific API keys | 🆕 NEW |
| **Deployment** | Vercel/GitHub deployment config | 🆕 NEW |
| **Members** | Collaborators, permissions | 🆕 NEW |
| **Advanced** | Delete project, archive | 🆕 NEW |

#### Project Settings Dialog Structure
```
┌─────────────────────────────────────────┐
│  Project Settings: "My Dashboard"       │
├─────────────────────────────────────────┤
│  [General] [Publishing] [API Keys]      │
│  [Deployment] [Members] [Advanced]      │
├─────────────────────────────────────────┤
│                                          │
│  Content for selected tab                │
│                                          │
└─────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Enhance User Settings ✅ (Current PR)
1. Add "Connectors" tab to `/settings`
   - Move Shared Connectors overview from Integrations
   - Show Personal Connectors
   - Link to Integrations page for adding new

2. Add "API Keys" tab to `/settings`
   - Fetch all API keys for user's projects
   - Display in table format
   - Allow navigation to project settings

### Phase 2: Create Project Settings Dialog
1. Replace simple Publishing Policy dialog with comprehensive Project Settings
2. Add tabs for different settings categories
3. Implement each tab's content

### Phase 3: Data Flow
```
User Settings (Global)
  ├─ Connectors → Shared (all projects) + Personal (all projects)
  └─ API Keys → Overview of all project keys

Project Settings (Per-Project)
  ├─ General → Basic project info
  ├─ Publishing → Who can publish
  ├─ API Keys → Keys specific to THIS project
  ├─ Deployment → Deploy config for THIS project
  └─ Members → Collaborators for THIS project
```

## User Journeys

### Journey 1: "I want to add a Stripe connector for all my projects"
1. Go to `/settings`
2. Click "Connectors" tab
3. See "Shared Connectors" section (admin only)
4. Click "Configure New Connector"
5. Select Stripe → Enter API key
6. Now available in ALL projects

### Journey 2: "I want to see which projects use API keys"
1. Go to `/settings`
2. Click "API Keys" tab
3. See table:
   ```
   Project          | Service | Key Type | Created    | Last Used
   My Dashboard     | Stripe  | API Key  | 2025-01-10 | 2 hours ago
   E-commerce Site  | Vercel  | Token    | 2025-01-05 | 1 day ago
   ```
4. Click "My Dashboard" → Opens Project Settings dialog

### Journey 3: "I want to configure deployment for this specific project"
1. In Playground with project open
2. Click gear icon (⚙️) in top right
3. Project Settings dialog opens
4. Click "Deployment" tab
5. Configure Vercel/GitHub settings for THIS project only

## Benefits

✅ **Clear Separation**: User settings vs Project settings
✅ **Discoverability**: All settings in logical locations
✅ **Efficiency**: No need to hunt for specific settings
✅ **Scalability**: Easy to add new settings categories
✅ **Consistency**: Same pattern across the platform

