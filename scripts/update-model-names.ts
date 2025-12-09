import { db } from '../db';
import { agents } from '../db/schema';

async function updateModelNames() {
  try {
    console.log('Updating model names...');

    // Update all agents to use the Claude model
    await db.update(agents).set({
      model: 'claude-3-5-sonnet-20241022',
      updatedAt: new Date(),
    });

    console.log('Model names updated successfully');

    // Verify the updates
    const updatedAgents = await db.select().from(agents);
    console.log(
      'Updated agents:',
      updatedAgents.map(a => ({
        name: a.name,
        model: a.model,
      }))
    );
  } catch (error) {
    console.error('Error updating model names:', error);
  } finally {
    process.exit();
  }
}

updateModelNames();
