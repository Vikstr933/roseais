import { db } from '../db';
import { agents, promptChains, promptTemplates } from '../db/schema';
import { eq } from 'drizzle-orm';

async function verifyMigration() {
  try {
    // Verify QA Engineer agent
    const qaEngineer = await db.select()
      .from(agents)
      .where(eq(agents.role, 'QA Engineer'));
    
    console.log('QA Engineer agent:', qaEngineer.length > 0 ? 'Exists' : 'Missing');

    // Verify Component Generation chain steps
    interface ChainStep {
      agent: string;
      task: string;
      template?: string;
    }
    
    const componentChain = await db.select()
      .from(promptChains)
      .where(eq(promptChains.name, 'Component Generation'));
    
    const steps = componentChain[0]?.steps as ChainStep[];
    const hasTestingStep = steps?.some(step => 
      step.agent === 'QA Engineer' && step.template === 'Component Testing'
    );
    console.log('Testing step in chain:', hasTestingStep ? 'Exists' : 'Missing');

    // Verify Component Testing template
    const testingTemplate = await db.select()
      .from(promptTemplates)
      .where(eq(promptTemplates.name, 'Component Testing'));
    
    console.log('Component Testing template:', testingTemplate.length > 0 ? 'Exists' : 'Missing');
  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    process.exit();
  }
}

verifyMigration();
