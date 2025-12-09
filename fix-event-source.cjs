const fs = require('fs');

const files = [
  {
    path: './client/src/components/GlobalAgentMonitor.tsx',
    imports: "import { getApiUrl } from '@/lib/api';",
    replacements: [
      { from: "new EventSource('/api/sse/agent-activity')", to: "new EventSource(getApiUrl('/api/sse/agent-activity'))" }
    ]
  },
  {
    path: './client/src/components/LogViewer.tsx',
    imports: "import { getApiUrl } from '@/lib/api';",
    replacements: [
      { from: "new EventSource('/api/logs', { withCredentials: true })", to: "new EventSource(getApiUrl('/api/logs'), { withCredentials: true })" }
    ]
  },
  {
    path: './client/src/components/TerminalOutput.tsx',
    imports: "import { getApiUrl } from '../lib/api';",
    replacements: [
      { from: "new EventSource(", to: "new EventSource(getApiUrl(" }
    ]
  },
  {
    path: './client/src/services/BackgroundTaskService.ts',
    imports: "import { getApiUrl } from '../lib/api';",
    replacements: [
      { from: "this.eventSource = new EventSource(sseUrl);", to: "this.eventSource = new EventSource(getApiUrl(sseUrl));" }
    ]
  }
];

files.forEach(({ path, imports, replacements }) => {
  try {
    let content = fs.readFileSync(path, 'utf8');

    // Add import if not present
    if (!content.includes('getApiUrl')) {
      const firstImport = content.match(/^import .+;$/m);
      if (firstImport) {
        const insertIndex = firstImport.index + firstImport[0].length;
        content = content.slice(0, insertIndex) + `\n${imports}` + content.slice(insertIndex);
      }
    }

    // Apply replacements
    replacements.forEach(({ from, to }) => {
      content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
    });

    fs.writeFileSync(path, content, 'utf8');
    console.log(`✅ Fixed ${path}`);
  } catch (err) {
    console.error(`❌ Error processing ${path}:`, err.message);
  }
});

console.log('\n✅ All EventSource calls fixed!');
