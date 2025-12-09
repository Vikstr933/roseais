import * as fs from 'fs';
import * as path from 'path';

const journal = {
  version: '5',
  dialect: 'pg',
  entries: [],
};

const dir = path.join(process.cwd(), 'drizzle', 'meta');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, '_journal.json'),
  JSON.stringify(journal, null, 2)
);
