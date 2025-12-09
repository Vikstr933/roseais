# GitHub Integration Setup Guide

## Overview

The GitHub integration is your platform's **killer feature** - it allows seamless deployment of AI-generated code directly to users' GitHub repositories. This integration bridges the gap between code generation and deployment.

## What It Does

### For Users:
- **One-Click Repository Creation**: Generate React app → Push to GitHub → Deploy
- **Automatic Branch Management**: Create feature branches for each generation
- **Pull Request Automation**: Generate code, create PR, review, merge
- **Code Search**: Search across all repositories
- **Issue Tracking**: Create and manage issues

### For Your Platform:
- **OrchestrationAgent Integration**: Automatically push generated components
- **CodeGeneratorAgent Integration**: Commit code changes with proper messages
- **UIDesignerAgent Integration**: Deploy UI components to repos
- **Version Control**: Track every generation with commits

## Setup Instructions

### Step 1: Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in the details:
   - **Application name**: `AI Library Builder` (or your app name)
   - **Homepage URL**: `http://localhost:5173` (or your frontend URL)
   - **Authorization callback URL**: `http://localhost:3001/api/plugins/github/callback`
   - **Description**: `AI-powered development platform`
4. Click **"Register application"**
5. Copy the **Client ID**
6. Click **"Generate a new client secret"** and copy it

### Step 2: Update Environment Variables

Update your `.env` file:

```bash
# GitHub integration OAuth
GITHUB_CLIENT_ID=your_actual_client_id_here
GITHUB_CLIENT_SECRET=your_actual_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:3001/api/plugins/github/callback
```

### Step 3: Restart Server

```bash
npm run dev
```

### Step 4: Connect GitHub

1. Go to http://localhost:5173/integrations
2. Find the **GitHub** card
3. Click **"Connect GitHub"**
4. Authorize the OAuth app (you'll be redirected to GitHub)
5. Grant the requested permissions:
   - **repo**: Full control of repositories (needed to push code)
   - **read:user**: Read user profile
   - **user:email**: Access email addresses
6. You'll be redirected back with a success message

## Usage Examples

### For Personal Assistant

Users can now ask:

```
"Create a new repository called my-todo-app"
"Push the generated code to GitHub"
"Create a pull request for the new feature"
"Search my repositories for the authentication code"
"Create an issue to fix the login bug"
```

### For Code Generation Workflow

Your `OrchestrationAgent` can now:

1. **Generate Component** → User describes app
2. **Create Repository** → Auto-create GitHub repo
3. **Push Code** → Commit all generated files
4. **Create PR** → Open PR with description
5. **Deploy** → Vercel picks up from GitHub

### Example: Full Workflow

```typescript
// User request: "Create a todo list app and deploy it"

// 1. OrchestrationAgent generates the app
const generatedFiles = await orchestrationAgent.generate(...)

// 2. Create GitHub repository
await githubPlugin.createRepository(userId, 'todo-list-app', 'AI-generated todo app', false, true)

// 3. Commit files
await githubPlugin.commitFiles(
  userId,
  'username',
  'todo-list-app',
  'main',
  'Initial commit: AI-generated todo list app\n\n🤖 Generated with AI Library',
  generatedFiles.map(f => ({ path: f.path, content: f.content }))
)

// 4. User can now deploy to Vercel via GitHub
```

## Available Tools

The GitHub plugin provides these tools to AI agents:

### Repository Management
- `list_repositories` - List user's repos
- `create_repository` - Create new repo
- `get_file_content` - Read files from repos

### Branch Operations
- `create_branch` - Create new branch from base
- `commit_files` - Commit multiple files at once
- `push_code` - Push committed changes

### Collaboration
- `create_pull_request` - Open PRs with descriptions
- `create_issue` - Create GitHub issues
- `search_code` - Search across all repos

## Integration with Your Agents

### OrchestrationAgent
```typescript
// In your component generation workflow
const deployToGithub = async (generatedCode: GeneratedComponent) => {
  // Get user's GitHub plugin instance
  const githubPlugin = await pluginRegistry.getPlugin('github');

  // Create repo or use existing
  const repo = await githubPlugin.createRepository(
    userId,
    generatedCode.name,
    generatedCode.description
  );

  // Push all files
  await githubPlugin.commitFiles(
    userId,
    userGithubUsername,
    repo.name,
    'main',
    `Add ${generatedCode.name}\n\n🤖 Generated with AI Library`,
    generatedCode.files
  );

  return repo.html_url;
};
```

### CompletionAgent
```typescript
// After refining generated code
const createFeaturePR = async (refinedCode: RefinedCode) => {
  // Create feature branch
  await githubPlugin.createBranch(
    userId,
    owner,
    repo,
    'feature/ai-refinement',
    'main'
  );

  // Commit refinements
  await githubPlugin.commitFiles(
    userId,
    owner,
    repo,
    'feature/ai-refinement',
    'Refine: Apply AI code review suggestions',
    refinedCode.files
  );

  // Create PR
  await githubPlugin.createPullRequest(
    userId,
    owner,
    repo,
    'AI Code Refinements',
    'Applied automated code review suggestions:\n- Fixed type safety\n- Improved performance\n- Added error handling',
    'feature/ai-refinement',
    'main'
  );
};
```

## Knowledge Base Integration

The GitHub plugin syncs data to your knowledge base:

- **Repositories**: All user repos with metadata
- **Pull Requests**: Recent PRs with status
- **Code Content**: Searchable across repos

The Personal Assistant can use this context:

```
User: "What React projects do I have?"
Assistant: "I found 5 React projects in your GitHub:
1. my-todo-app (updated 2 days ago)
2. portfolio-site (updated 1 week ago)
..."
```

## Production Deployment

### Update OAuth App for Production

1. Go to your GitHub OAuth app settings
2. Update URLs to production:
   - **Homepage URL**: `https://your-domain.com`
   - **Callback URL**: `https://your-domain.com/api/plugins/github/callback`

3. Update `.env` for production:
```bash
GITHUB_REDIRECT_URI=https://your-domain.com/api/plugins/github/callback
FRONTEND_URL=https://your-domain.com
```

## Security Notes

- OAuth tokens are stored encrypted in your database
- Never commit `.env` with actual credentials
- GitHub tokens have the scopes you request (we request `repo`, `read:user`, `user:email`)
- Users can revoke access anytime from GitHub settings

## Troubleshooting

### "OAuth not configured" Error
- Check that `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set in `.env`
- Restart your server after updating `.env`

### "Repository not found" Error
- Ensure user has connected their GitHub account
- Check repository permissions

### Commit Failed
- Verify user has write access to the repository
- Check branch exists before committing

## Next Steps

1. **Test the integration**: Connect your GitHub and try creating a repo
2. **Integrate with agents**: Update OrchestrationAgent to push generated code
3. **Add UI prompts**: Let users choose "Deploy to GitHub" after generation
4. **Set up webhooks**: Listen for GitHub events (optional, advanced)

## API Rate Limits

- **5,000 requests/hour** for authenticated requests
- Commits count as multiple API calls (blob creation + tree + commit)
- Plugin automatically handles rate limits and retries

## Advanced: GitHub Webhooks (Optional)

You can set up webhooks to listen for:
- Push events → Trigger rebuilds
- PR events → Notify user
- Issue events → Create tasks

This makes your platform even more powerful!

---

## You're All Set! 🚀

Your users can now:
- Generate apps with AI
- Push to GitHub with one command
- Create PRs for review
- Deploy from GitHub to Vercel

This integration makes your platform a complete development workflow tool!
