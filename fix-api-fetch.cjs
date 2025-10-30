const fs = require('fs');
const path = require('path');

const files = [
  './client/src/components/AgentMonitor/CircularAgentVisualization.tsx',
  './client/src/components/APIKeyManager.tsx',
  './client/src/components/AssistantWidget.tsx',
  './client/src/components/ChatAutocomplete.tsx',
  './client/src/components/ChatKnowledgeSelector.tsx',
  './client/src/components/ComponentPreview/ComponentPreview.tsx',
  './client/src/components/GitHubKnowledgeManager.tsx',
  './client/src/components/KnowledgeSourcesViewer.tsx',
  './client/src/components/LogViewer.tsx',
  './client/src/components/MonetizationDashboard.tsx',
  './client/src/components/OneClickDeployer.tsx',
  './client/src/components/ProductionDeployment.tsx',
  './client/src/components/SessionHistory.tsx',
  './client/src/components/settings/AccountSettings.tsx',
  './client/src/components/settings/BillingSettings.tsx',
  './client/src/components/settings/CompanySettings.tsx',
  './client/src/components/settings/PreferencesSettings.tsx',
  './client/src/components/settings/SecuritySettings.tsx',
  './client/src/contexts/AuthContext.tsx',
  './client/src/hooks/useServerStatus.ts',
  './client/src/hooks/useUserActivity.ts',
  './client/src/pages/AgentManager.tsx',
  './client/src/pages/Assistant.tsx',
  './client/src/pages/Integrations.tsx',
  './client/src/pages/Pricing.tsx',
  './client/src/pages/PromptPlayground.tsx',
  './client/src/pages/Workspaces.tsx',
  './client/src/services/BackgroundTaskService.ts',
  './client/src/utils/ClientLogger.ts',
];

function getRelativePath(from) {
  const fromDir = path.dirname(from);
  const to = './client/src/lib/api';
  const rel = path.relative(fromDir, to).replace(/\\/g, '/');
  return rel.startsWith('.') ? rel : './' + rel;
}

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Skip if already imports apiFetch
    if (content.includes('apiFetch')) {
      console.log(`✓ Skipping ${filePath} - already imports apiFetch`);
      return;
    }

    // Skip if doesn't use fetch('/api
    if (!content.includes("fetch('/api") && !content.includes('fetch(`/api')) {
      console.log(`✓ Skipping ${filePath} - no fetch('/api calls`);
      return;
    }

    // Calculate relative path to api.ts
    const importPath = getRelativePath(filePath);

    // Find first import statement
    const importRegex = /^import .+;$/m;
    const match = content.match(importRegex);

    if (match) {
      // Add import after the first import
      const insertIndex = match.index + match[0].length;
      content = content.slice(0, insertIndex) + `\nimport { apiFetch } from '${importPath}';` + content.slice(insertIndex);
    }

    // Replace fetch calls
    content = content.replace(/fetch\((['"`])\/api/g, 'apiFetch($1/api');

    // Write back
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${filePath}`);
  } catch (err) {
    console.error(`❌ Error processing ${filePath}:`, err.message);
  }
});

console.log('\n✅ All files processed!');
