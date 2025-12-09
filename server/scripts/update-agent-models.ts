import { db } from '../../db/index';
import { agents } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';

async function updateAgentModels() {
  console.log('🔄 Updating agent models to claude-3-5-sonnet-20241022...');

  try {
    // Get all agents with the old model
    const allAgents = await db.select().from(agents);
    
    console.log(`Found ${allAgents.length} agents to check`);

    let updatedCount = 0;
    
    for (const agent of allAgents) {
      if (agent.model === 'claude-3-sonnet-20240229') {
        await db
          .update(agents)
          .set({ model: 'claude-3-5-sonnet-20241022' })
          .where(eq(agents.id, agent.id));
        
        console.log(`✅ Updated agent: ${agent.name}`);
        updatedCount++;
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} agents!`);
    console.log('All agents now use the correct model: claude-3-5-sonnet-20241022');
  } catch (error) {
    console.error('❌ Error updating agent models:', error);
    process.exit(1);
  }

  process.exit(0);
}

updateAgentModels();

