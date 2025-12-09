# Migration Scripts

## ⚠️ DATABASE TYPE: PostgreSQL

**ALL scripts in this directory use PostgreSQL exclusively.**

- **Library**: `pg` (node-postgres)
- **NOT SQLite**: Do NOT use `better-sqlite3`
- **NOT MySQL**: Do NOT use `mysql2`
- **Connection**: Uses `DATABASE_URL` environment variable

## Available Scripts

### Agent System Prompts

#### update-agent-prompts-syntax-warnings.ts
Updates all code generation agents with critical syntax warnings to prevent common code generation errors.

**Usage:**
```bash
npx tsx scripts/update-agent-prompts-syntax-warnings.ts
```

**Database Access:**
```typescript
import { Pool } from 'pg'; // ✅ PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

**What it does:**
1. Connects to PostgreSQL database
2. Queries `agents` table for code generation agents
3. Updates `system_prompt` column with syntax warnings
4. Uses parameterized queries to prevent SQL injection

### Plugin System

#### run-plugin-migration.ts
Runs database migrations for the plugin system (adds credentials_required column).

**Usage:**
```bash
npm run migrate:plugins
```

### Component Generation Setup

#### setup-component-generation.ts
Seeds the database with initial component generation configuration.

**Usage:**
```bash
npm run setup:components
```

### Stripe Setup

#### setup-stripe-products.ts
Creates Stripe products and price IDs for subscription tiers.

**Usage:**
```bash
npm run setup:stripe
```

## Creating New Migration Scripts

When creating new migration scripts, **ALWAYS use PostgreSQL**:

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ✅ CORRECT: PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    // Use parameterized queries
    const result = await client.query(
      'SELECT * FROM table_name WHERE id = $1',
      [id]
    );

    // Update with parameters
    await client.query(
      'UPDATE table_name SET column = $1 WHERE id = $2',
      [newValue, id]
    );

    console.log('✅ Migration completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
```

## ❌ NEVER Do This

```typescript
// ❌ WRONG: SQLite (this project doesn't use SQLite)
import Database from 'better-sqlite3';
const db = new Database('data.db');

// ❌ WRONG: MySQL (this project doesn't use MySQL)
import mysql from 'mysql2';
const connection = mysql.createConnection({...});

// ❌ WRONG: Direct SQL without parameters (SQL injection risk)
await client.query(`SELECT * FROM users WHERE email = '${userInput}'`);
```

## ✅ ALWAYS Do This

```typescript
// ✅ CORRECT: PostgreSQL with pg library
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ✅ CORRECT: Parameterized queries (prevents SQL injection)
await client.query('SELECT * FROM users WHERE email = $1', [userInput]);

// ✅ CORRECT: Error handling
try {
  await client.query('BEGIN');
  // ... your queries
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

## Database Connection Checklist

Before writing any migration script, verify:

- [ ] Using `import { Pool } from 'pg'` (PostgreSQL)
- [ ] NOT using `better-sqlite3` or any SQLite library
- [ ] Loading environment variables with `dotenv`
- [ ] Using parameterized queries ($1, $2, etc.)
- [ ] Proper error handling (try/catch/finally)
- [ ] Releasing connections (client.release())
- [ ] Closing pool (pool.end())

## Troubleshooting

### Error: "no such table: table_name"

This error means you're trying to use SQLite commands on a PostgreSQL database.

**Solution:**
- Check your imports: Should be `import { Pool } from 'pg'`
- Check your queries: Use PostgreSQL syntax, not SQLite syntax
- Check connection string: Must start with `postgresql://` or `postgres://`

### Error: "connection refused"

**Solution:**
- Verify DATABASE_URL in `.env` file
- Check PostgreSQL server is running (if local)
- Verify credentials are correct
- Check firewall settings

### Error: "SSL required"

**Solution:**
- Add `?sslmode=require` to DATABASE_URL
- Or configure SSL in Pool options:
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
```

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pg (node-postgres) Documentation](https://node-postgres.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [DATABASE.md](../DATABASE.md) - Complete database documentation

---

**Remember**: This project uses **PostgreSQL ONLY**. Never use SQLite, MySQL, or any other database library in migration scripts.
