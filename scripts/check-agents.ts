import { db } from '../db';
import { agents } from '../db/schema';

async function checkAgents() {
  try {
    const allAgents = await db.select().from(agents);
    console.log('All agents in database:', JSON.stringify(allAgents, null, 2));
  } catch (error) {
    console.error('Error querying agents:', error);
  }
}

checkAgents();
