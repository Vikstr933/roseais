import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentArchitectAgent } from '../../agents/ComponentArchitectAgent';
import { SharedMemory } from '../../utils/SharedMemory';

describe('ComponentArchitectAgent', () => {
  let agent: ComponentArchitectAgent;
  let sharedMemory: SharedMemory;

  beforeEach(() => {
    agent = new ComponentArchitectAgent();
    sharedMemory = new SharedMemory('test');
    sharedMemory.set('requirements', {
      functionalRequirements: ['todo list'],
      features: ['dark mode'],
    });
  });

  it('produces architecture assignments', async () => {
    await agent.executeTask({ prompt: 'Create a todo list app', sharedMemory });

    const architecture = sharedMemory.get('architecture');
    expect(architecture).toBeDefined();
    expect(architecture?.fileAssignments).toBeInstanceOf(Array);
  });
});


