const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'db', 'db.sqlite');
const migrationPath = path.join(
  __dirname,
  '..',
  'migrations',
  '2008_update_token_based_pricing.sql'
);

async function runMigration() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, err => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    // Read migration file
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    let completed = 0;
    const total = statements.length;

    statements.forEach((statement, index) => {
      db.run(statement, err => {
        if (err) {
          console.error(`Error executing statement ${index + 1}:`, err);
          console.error('Statement:', statement);
          reject(err);
          return;
        }

        completed++;
        console.log(`✓ Executed statement ${index + 1}/${total}`);

        if (completed === total) {
          console.log('\n🎉 Migration completed successfully!');
          console.log('\nUpdated subscription plans:');
          console.log('- Free: 100K tokens/month');
          console.log('- Pro: 1M tokens/month ($20)');
          console.log('- Team: 3M tokens/month ($50)');
          console.log('- Enterprise: Unlimited tokens');

          db.close(err => {
            if (err) {
              console.error('Error closing database:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        }
      });
    });
  });
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n✅ Token-based pricing migration completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
