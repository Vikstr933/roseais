# OmniAssistant Project Context & Playground Integration

## Overview
This document describes the implementation of project context awareness for OmniAssistant and the integration with the Playground AI assistant.

## Features Implemented

### 1. ✅ Fixed Text Color in OmniAssistant
- **Issue**: Assistant messages had `bg-black text-white` which was hard to read
- **Fix**: Changed to `bg-muted text-foreground border border-border` for better visibility
- **Location**: `client/src/components/OmniAssistant/OmniAssistant.tsx` line ~856

### 2. ✅ Project Selection UI
- **Feature**: Added project selector dropdown when not on playground page
- **Behavior**: 
  - Only shows when user has projects and is NOT on `/playground` page
  - Displays all user's projects in a dropdown
  - Shows file count badge when project is selected
- **Location**: `client/src/components/OmniAssistant/OmniAssistant.tsx` lines ~542-562
- **UI Components**: Uses Shadcn Select component with FolderOpen icon

### 3. ✅ Project Context Fetching
- **Feature**: Automatically fetches project files when a project is selected
- **API Endpoint**: `GET /api/workspaces/:id/files`
- **Flow**:
  1. User selects project from dropdown
  2. Frontend fetches files via API
  3. Files are stored in component state
  4. Files are passed to OmniAssistant backend via `playgroundContext`
- **Location**: 
  - Frontend: `client/src/components/OmniAssistant/OmniAssistant.tsx` lines ~89-116
  - Backend: `server/routes/workspaces.ts` lines 518-547

### 4. ✅ Enhanced buildPlaygroundContext Function
- **Feature**: Builds context from multiple sources
- **Priority Order**:
  1. Playground page with active session files (highest priority)
  2. Selected project with fetched files
  3. No context (undefined)
- **Optimization**: 
  - Top 5 files: Full content (up to 2000 chars)
  - Next 5 files: Summary only (200 chars preview)
  - Files prioritized by type: .tsx, .ts, .jsx, .js, .css, .json, .md, .html
- **Location**: `client/src/components/OmniAssistant/OmniAssistant.tsx` lines ~132-195

### 5. ✅ "Apply to Playground" Button
- **Feature**: Button appears on assistant messages containing code blocks
- **Behavior**: Extracts code blocks and sends them to playground for application
- **Location**: `client/src/components/OmniAssistant/OmniAssistant.tsx` lines ~932-951

### 6. ✅ "Send to Playground" Button
- **Feature**: Button appears on assistant messages WITHOUT code blocks
- **Behavior**: Forwards the entire message as a prompt to playground
- **Location**: `client/src/components/OmniAssistant/OmniAssistant.tsx` lines ~932-951

### 7. ✅ Prompt Forwarding to Playground
- **Mechanism**: Uses localStorage + Custom Events
- **Flow**:
  1. User clicks "Send to Playground" or "Apply to Playground"
  2. Prompt/code saved to `localStorage` with key `omniassistant_pending_prompt`
  3. If not on playground, navigate to `/playground/:projectId`
  4. Dispatch custom event `omniassistant-prompt-ready`
  5. Playground receives event and auto-fills + triggers generation
- **Locations**:
  - OmniAssistant sender: `client/src/components/OmniAssistant/OmniAssistant.tsx` lines ~235-267
  - Playground receiver: `client/src/pages/PromptPlayground.tsx` lines ~2121-2158

### 8. ✅ Backend Support for Project Context
- **Feature**: Backend already fully supports project context
- **System Prompt Enhancement**: Informs AI when in playground with project context
- **Message Enhancement**: Includes actual file contents in AI context
- **Locations**:
  - System prompt: `server/agents/PersonalAssistantAgent.ts` lines ~244-294
  - Enhanced message: `server/agents/PersonalAssistantAgent.ts` lines ~380-460

## How It Works

### Scenario 1: User on Any Page (Not Playground)

1. User opens OmniAssistant
2. Sees project selector dropdown
3. Selects a project (e.g., "My React App")
4. System fetches project files automatically
5. User asks: "What improvements can I make to my authentication system?"
6. OmniAssistant has full project context including all files
7. AI responds with specific suggestions based on actual code
8. User clicks "Send to Playground" on the suggestion
9. Navigated to playground, prompt auto-filled and generation starts

### Scenario 2: User Already on Playground

1. User is working on playground
2. Opens OmniAssistant (no project selector shown - using active session)
3. OmniAssistant automatically has context of current playground session
4. User asks: "How can I improve the styling of my button component?"
5. AI sees actual Button component code and suggests improvements
6. User clicks "Apply to Playground"
7. Code changes sent to playground AI for implementation

### Scenario 3: Code Generation Request

1. User on home page, selects project "E-commerce Site"
2. Asks OmniAssistant: "Add a shopping cart feature with add/remove functionality"
3. OmniAssistant generates code suggestions with file paths
4. Code blocks appear in message with syntax highlighting
5. "Apply to Playground" button appears (showing file count)
6. User clicks button
7. Navigated to playground for selected project
8. Code generation starts automatically with OmniAssistant's suggestions

## API Endpoints Used

### GET /api/workspaces
- **Purpose**: Fetch user's projects for dropdown
- **Auth**: Required
- **Response**: Array of projects with id, name, description

### GET /api/workspaces/:id/files
- **Purpose**: Fetch files for selected project
- **Auth**: Required (checks project membership)
- **Response**: Array of files with id, projectId, filePath, content, language

### POST /api/omniassistant/chat
- **Purpose**: Send message to OmniAssistant
- **Body**:
  ```json
  {
    "message": "User message",
    "sessionId": "session-id",
    "currentPage": "/current-path",
    "workspaceId": 123,
    "playgroundContext": {
      "currentProject": "Project Name",
      "projectId": "123",
      "filesCount": 10,
      "filePaths": ["src/App.tsx", "src/index.tsx"],
      "files": [
        {
          "path": "src/App.tsx",
          "content": "...",
          "language": "typescript",
          "fullContent": true
        }
      ]
    },
    "features": {
      "useContextEngine": true
    }
  }
  ```

## Testing Guide

### Test 1: Text Color Fix
1. Open OmniAssistant
2. Send a message
3. Verify assistant response is readable with light text on dark background

### Test 2: Project Selection
1. Open OmniAssistant from home page (not playground)
2. Verify project selector dropdown appears
3. Select a project
4. Verify file count badge appears

### Test 3: Project Context
1. Select a project with files
2. Ask: "What files do I have in this project?"
3. Verify AI lists actual files from the project

### Test 4: Code Suggestions
1. Select a project
2. Ask: "Review my App.tsx file and suggest improvements"
3. Verify AI references actual code from the file
4. Verify specific function/component names mentioned

### Test 5: Send to Playground (Text)
1. Ask OmniAssistant: "Create a user dashboard with charts"
2. Verify "Send to Playground" button appears
3. Click button
4. Verify navigation to playground
5. Verify prompt appears in playground input
6. Verify code generation starts automatically

### Test 6: Apply to Playground (Code)
1. Ask: "Show me code for a login form with validation"
2. Wait for code response
3. Verify "Apply to Playground" button appears
4. Click button
5. Verify code sent to playground
6. Verify playground receives and processes code

### Test 7: Context Awareness
1. On playground with active project
2. Open OmniAssistant
3. Ask: "What am I working on?"
4. Verify AI describes current project and files

### Test 8: Cross-Page Context
1. Create/select project A
2. Ask OmniAssistant about project A
3. Navigate to different page
4. OmniAssistant should remember project A context
5. Switch to project B in selector
6. Verify context updates to project B

## File Structure

```
client/src/components/OmniAssistant/
├── OmniAssistant.tsx          # Main component (updated)

server/agents/
├── PersonalAssistantAgent.ts  # AI agent with context support

server/routes/
├── workspaces.ts             # Project files API endpoint
├── omniassistant.ts          # OmniAssistant chat endpoint

server/services/
├── OmniAssistantService.ts   # OmniAssistant service layer
├── ProjectService.ts         # Project files service
```

## Key Technologies

- **React Query**: For fetching projects and files
- **Shadcn UI**: Select, Button, Badge components
- **LocalStorage**: For prompt forwarding
- **Custom Events**: For cross-component communication
- **Framer Motion**: For animations
- **React Markdown**: For rendering AI responses
- **Syntax Highlighter**: For code blocks

## Future Enhancements

1. **Project Search**: Add search functionality to project selector
2. **Recent Projects**: Show recently selected projects at top
3. **File Preview**: Show file preview on hover in file list
4. **Context Indicators**: Visual indicator showing active context source
5. **Multi-Project Context**: Allow selecting multiple projects for comparison
6. **Context Size Warning**: Warn when project has too many files
7. **Smart File Selection**: Allow user to manually select which files to include
8. **Diff View**: Show diff when applying code changes
9. **Undo/Redo**: Allow undoing applied changes
10. **Context History**: Remember recent project selections per user

## Notes

- Project context is optimized to avoid token limits (top 5 files full, rest summarized)
- File fetching happens automatically when project is selected
- Playground integration uses existing infrastructure (no new endpoints needed)
- All backend support was already in place, only frontend integration was needed
- Text color fix improves accessibility for dark mode users

