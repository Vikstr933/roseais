// Fix all .toISOString() calls in database .set() operations
const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing timestamp issues in database operations...\n');

// Patterns to fix - replace .toISOString() with just Date object
const patterns = [
  { from: /updatedAt: new Date\(\)\.toISOString\(\)/g, to: 'updatedAt: new Date()' },
  { from: /lastUsed: new Date\(\)\.toISOString\(\)/g, to: 'lastUsed: new Date()' },
  { from: /lastModified: new Date\(\)\.toISOString\(\)/g, to: 'lastModified: new Date()' },
  { from: /completedAt: new Date\(\)\.toISOString\(\)/g, to: 'completedAt: new Date()' },
  { from: /lastActivity: new Date\(\)\.toISOString\(\)/g, to: 'lastActivity: new Date()' },
  { from: /joinedAt: new Date\(\)\.toISOString\(\)/g, to: 'joinedAt: new Date()' },
  { from: /lastActive: new Date\(\)\.toISOString\(\)/g, to: 'lastActive: new Date()' },
];

// Find all TypeScript files in server directory
const files = glob.sync('server/**/*.ts', { ignore: ['server/node_modules/**', '**/*.d.ts'] });

let totalFixes = 0;
let filesFixed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  let fixCount = 0;

  patterns.forEach(pattern => {
    const matches = content.match(pattern.from);
    if (matches) {
      fixCount += matches.length;
      content = content.replace(pattern.from, pattern.to);
    }
  });

  if (fixCount > 0) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`✅ Fixed ${fixCount} issues in ${file}`);
    totalFixes += fixCount;
    filesFixed++;
  }
});

console.log(`\n🎉 Done! Fixed ${totalFixes} timestamp issues in ${filesFixed} files\n`);
