# OmniAssistant Project Context Issue - Files Appearing Empty

## 🔍 Problem

When user asks OmniAssistant about a project **from a different page** (not playground), the AI says files are "empty" even though they're not.

### User Experience:
1. User on home page
2. Selects project in OmniAssistant dropdown
3. Asks: "How is this project doing?"
4. OmniAssistant responds: "All your files appear empty" 
5. User confused - files aren't actually empty!

## 🎯 Root Cause

The issue is **NOT** that files are empty. The issue is:

1. **API Response**: `/api/workspaces/:id/files` returns file metadata but may not include full content
2. **File Content Field**: The API returns `content` field, but it might be:
   - Truncated for large files
   - Empty if files haven't been saved to DB yet
   - Only available when actively in the playground session

3. **Context Building Logic**: `buildPlaygroundContext()` has two paths:
   - **Playground page**: Uses `currentSession.generatedFiles` (has full content)
   - **Other pages**: Uses `projectFiles` from API (may not have full content)

## 🔬 Investigation Needed

Check what `/api/workspaces/:id/files` actually returns:

```typescript
// server/routes/workspaces.ts line 541
const files = await projectService.getProjectFiles(projectId);
res.json(files);
```

Does `projectService.getProjectFiles()` return the `content` field?

```typescript
// server/services/ProjectService.ts line 300-308
async getProjectFiles(projectId: number): Promise<ProjectFile[]> {
  return await db
    .select()
    .from(projectFiles)
    .where(
      and(eq(projectFiles.projectId, projectId), eq(projectFiles.isActive, 1))
    )
    .orderBy(projectFiles.filePath);
}
```

**Answer**: Yes! It returns full ProjectFile objects with `content` field.

## 💡 Possible Issues

### Issue 1: Files Not Saved to Database Yet
When code is generated in playground, it's in `currentSession.generatedFiles` (in-memory/localStorage) but might not be saved to `projectFiles` table in database yet.

**Solution**: Ensure auto-save to database is working (it should save every 5 seconds).

### Issue 2: Content Field is Empty in Database
Files might be saved with metadata but empty content.

**Solution**: Check database migration and ensure content is being persisted.

### Issue 3: Content is Too Large and Gets Truncated
API might be truncating large file contents.

**Solution**: Add pagination or summary mode for large files.

### Issue 4: Wrong Project ID Selected
User selects wrong project or project doesn't have files yet.

**Solution**: Show file count in project selector, handle empty states gracefully.

## ✅ Solutions

### Solution 1: Improve Error Messages (Immediate Fix)

Update PersonalAssistantAgent system prompt to handle this case:

```typescript
${playgroundContext && playgroundContext.filesCount > 0 && playgroundContext.files?.length === 0 ? `
- **IMPORTANT**: You can see the project structure (${playgroundContext.filesCount} files), but file contents are not available from this page
- This is normal when viewing projects outside the playground
- To see actual code and provide specific feedback:
  1. User should open the playground with this project, OR
  2. User should ask about specific aspects you CAN help with (architecture, naming, organization)
- **Do NOT say files are "empty"** - say "file contents aren't available from this page"
- **Do NOT invent code** - be honest about what you can and can't see
` : ''}
```

### Solution 2: Add File Content Check in buildPlaygroundContext

```typescript
// Priority 2: If user has selected a project
if (selectedProjectId && projectFiles.length > 0) {
  const selectedProject = userProjects.find(p => p.id === selectedProjectId);
  
  // Check if files actually have content
  const filesWithContent = projectFiles.filter(f => f.content && f.content.trim().length > 0);
  
  if (filesWithContent.length === 0) {
    // Files exist but don't have content - inform the user
    console.warn('⚠️ OmniAssistant: Project files loaded but no content available');
    
    return {
      currentProject: selectedProject?.name || 'Selected Project',
      projectId: selectedProjectId.toString(),
      filesCount: projectFiles.length,
      filePaths: projectFiles.map(f => f.filePath),
      files: [], // Empty - no content available
      hasLivePreview: false,
      currentComponent: 'None',
      recentErrors: [],
      isGenerating: false,
      orchestrationSteps: 0,
      currentStep: 'None',
      contentAvailable: false, // NEW FLAG
    };
  }
  
  // Files have content - proceed normally
  return {
    // ... existing return with optimized files
    contentAvailable: true, // NEW FLAG
  };
}
```

### Solution 3: Add Visual Indicator in UI

Show user when file content is/isn't available:

```typescript
{selectedProjectId && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    {projectFiles.length > 0 ? (
      projectFiles.some(f => f.content) ? (
        <Badge variant="success">
          ✓ {projectFiles.filter(f => f.content).length} files with content
        </Badge>
      ) : (
        <Badge variant="warning">
          ⚠️ {projectFiles.length} files (content not loaded)
        </Badge>
      )
    ) : (
      <span>No files in this project</span>
    )}
  </div>
)}
```

### Solution 4: Fetch Full Content When Needed

Add a "Load Full Context" button:

```typescript
const [loadingFullContext, setLoadingFullContext] = useState(false);

const loadFullProjectContext = async () => {
  if (!selectedProjectId) return;
  
  setLoadingFullContext(true);
  try {
    // Fetch full file contents (maybe a different endpoint)
    const response = await apiFetch(`/api/workspaces/${selectedProjectId}/files/full`, {
      headers: getAuthHeaders(sessionToken),
    });
    
    if (response.ok) {
      const fullFiles = await response.json();
      setProjectFiles(fullFiles);
    }
  } catch (error) {
    console.error('Failed to load full project context:', error);
  } finally {
    setLoadingFullContext(false);
  }
};

// In UI:
{selectedProjectId && projectFiles.length > 0 && !projectFiles.some(f => f.content) && (
  <Button 
    size="sm" 
    variant="outline" 
    onClick={loadFullProjectContext}
    disabled={loadingFullContext}
  >
    {loadingFullContext ? 'Loading...' : 'Load Full Context'}
  </Button>
)}
```

## 🧪 How to Test

1. **Verify API Returns Content**:
   - Open Network tab
   - Select a project in OmniAssistant
   - Check `/api/workspaces/:id/files` response
   - Verify `content` field has actual code

2. **Check Database**:
   ```sql
   SELECT id, file_path, LENGTH(content) as content_length 
   FROM project_files 
   WHERE project_id = 43 
   AND is_active = 1;
   ```

3. **Test Both Scenarios**:
   - **On Playground**: Ask about project → should see full content
   - **On Other Page**: Select project, ask about it → should see... what?

## 📊 Expected Behavior

### Scenario A: Project Files Saved to Database
- User selects project from dropdown
- Files fetched with content
- OmniAssistant can see code and provide feedback
- ✅ Works as expected

### Scenario B: Project Only in Session (Not Saved Yet)
- User selects project from dropdown
- Files fetched but content empty (not saved to DB yet)
- OmniAssistant says: "I can see your project structure but file contents aren't available from this page. Open the playground to get detailed feedback."
- ✅ Honest and helpful

### Scenario C: User on Playground
- currentSession.generatedFiles has full content
- OmniAssistant sees everything
- Can provide detailed feedback
- ✅ Works as expected

## 🎯 Recommended Action

1. **Immediate**: Update system prompt to handle "no content" case gracefully
2. **Short-term**: Add visual indicator showing when content is/isn't available
3. **Long-term**: Ensure auto-save to database works reliably so content is always available

The key insight: This isn't a bug in the code - it's a **UX/communication issue**. The AI needs to be honest about what it can and can't see rather than making assumptions.

