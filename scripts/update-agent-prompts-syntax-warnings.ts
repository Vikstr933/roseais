/**
 * Update all code generation agents with critical syntax warnings
 *
 * This script adds explicit warnings about syntax errors that Claude keeps making,
 * especially the "return {;" and "return (;" patterns.
 *
 * ⚠️ DATABASE: PostgreSQL (NOT SQLite)
 * - Uses: pg (node-postgres)
 * - Connects via: DATABASE_URL environment variable
 * - Schema: agents table with system_prompt column
 */

import { Pool } from 'pg'; // ✅ PostgreSQL - this project uses PostgreSQL ONLY
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// PostgreSQL connection pool (NOT SQLite)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Must be PostgreSQL connection string
});

const SYNTAX_WARNINGS = `

🚨 CRITICAL SYNTAX RULES - VERIFY ALL CODE BEFORE RESPONDING 🚨

ABSOLUTELY NO SYNTAX ERRORS ALLOWED:
❌ NEVER write "return (;" - this is a CRITICAL ERROR that breaks compilation
❌ NEVER write "return {;" - this is a CRITICAL ERROR that breaks compilation
❌ NEVER write "return [;" - this breaks compilation
❌ NEVER put semicolons immediately after opening parentheses: (;
❌ NEVER put semicolons immediately after opening braces: {;
❌ NEVER put semicolons immediately after opening brackets: [;
❌ NEVER put semicolons BEFORE closing parentheses in if/while conditions: if (x === 1; )
❌ NEVER put semicolons inside conditional expressions: if (a || b; )

CORRECT EXAMPLES:
✅ return ( <div>...</div> )
✅ return { foo: bar, baz: qux }
✅ return [ item1, item2 ]
✅ if (condition) { ... }
✅ setState(prev => ({ ...prev, newValue }))

ALWAYS:
✅ Verify ALL code has valid JavaScript/TypeScript syntax
✅ Check that ALL parentheses, braces, and brackets are properly closed
✅ Double-check every return statement for correct syntax before responding
✅ Triple-check that if/while/for conditions do NOT have semicolons inside parentheses
✅ Review your generated code line-by-line before submitting`;

async function updateAgentPrompts() {
  const client = await pool.connect();

  try {
    // Find all code generation agents
    const result = await client.query(`
      SELECT id, name, role, system_prompt as "systemPrompt"
      FROM agents
      WHERE role IN ('code_generation', 'component_developer', 'code_generator')
      OR name LIKE '%Developer%'
      OR name LIKE '%Generator%'
      OR name LIKE '%Code%'
    `);

    const agents = result.rows;
    console.log(`Found ${agents.length} code generation agents to update:`);

    for (const agent of agents) {
      // Check if prompt already has the warnings
      if (agent.systemPrompt.includes('CRITICAL SYNTAX RULES')) {
        console.log(`✓ Agent "${agent.name}" already has syntax warnings, skipping`);
        continue;
      }

      // Append warnings to system prompt
      const updatedPrompt = agent.systemPrompt + SYNTAX_WARNINGS;

      await client.query(
        'UPDATE agents SET system_prompt = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [updatedPrompt, agent.id]
      );

      console.log(`✅ Updated agent "${agent.name}" (ID: ${agent.id})`);
    }

    console.log(`\n🎉 Successfully updated ${agents.length} agents with syntax warnings!`);
  } catch (error) {
    console.error('❌ Error updating agents:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the update
updateAgentPrompts();
