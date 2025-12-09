import { describe, it, expect, beforeEach } from 'vitest';
import { RequirementsAgent } from '../../agents/RequirementsAgent';
import { SharedMemory } from '../../utils/SharedMemory';

describe('RequirementsAgent', () => {
  let agent: RequirementsAgent;
  let sharedMemory: SharedMemory;

  beforeEach(() => {
    agent = new RequirementsAgent();
    sharedMemory = new SharedMemory('test');
  });

  it('stores requirements analysis in shared memory', async () => {
    const prompt = 'Build a todo list app with dark mode and local storage';
    await agent.executeTask({ prompt, sharedMemory });

    const requirements = sharedMemory.get('requirements');
    expect(requirements).toBeDefined();
    expect(requirements?.functionalRequirements).toBeInstanceOf(Array);
  });
});


