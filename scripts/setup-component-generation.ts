import { db } from '../db';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import fs from 'fs/promises';
import { agents, promptChains, promptTemplates } from '../db/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupComponentGeneration() {
  try {
    console.log('\nSetting up component generation system...');
    
    // Read and execute migrations directly
    const projectRoot = path.join(__dirname, '..');
    const migrations = [
      '2000_add_component_agents.sql',
      '2001_add_component_orchestration.sql',
      '2002_add_component_templates.sql',
      '2003_add_component_chain.sql'
    ];

    for (const migration of migrations) {
      console.log(`\nExecuting migration: ${migration}`);
      const filePath = path.join(projectRoot, 'migrations', migration);
      const sql = await fs.readFile(filePath, 'utf-8');
      await db.execute(sql);
    }

    console.log('Component generation system setup complete!');
    
    // Verify setup
    const activeAgents = await db.select().from(agents).where(eq(agents.isActive, true));
    console.log('\nActive Agents:');
    activeAgents.forEach(agent => {
      console.log(`- ${agent.name} (${agent.role})`);
    });

    const componentChain = await db.select().from(promptChains)
      .where(eq(promptChains.name, 'Component Generation Chain'));
    if (componentChain.length > 0) {
      console.log('\nComponent Generation Chain installed successfully');
    }

    const installedTemplates = await db.select().from(promptTemplates);
    console.log('\nInstalled Templates:');
    installedTemplates.forEach(template => {
      console.log(`- ${template.name}`);
    });

    console.log('\nSetup complete! You can now use the component generation system in the Prompt Playground.');

  } catch (error) {
    console.error('Error setting up component generation:', error);
    process.exit(1);
  }
}

setupComponentGeneration().catch(console.error);
