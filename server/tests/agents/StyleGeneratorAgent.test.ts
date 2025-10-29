import { describe, it, expect, beforeEach } from 'vitest';
import { StyleGeneratorAgent } from '../../agents/StyleGeneratorAgent';
import { SharedMemory } from '../../utils/SharedMemory';

describe('StyleGeneratorAgent', () => {
  let agent: StyleGeneratorAgent;
  let sharedMemory: SharedMemory;

  beforeEach(() => {
    agent = new StyleGeneratorAgent();
    sharedMemory = new SharedMemory('test');
    sharedMemory.set('requirements', { features: ['responsive', 'accessible'] });
    sharedMemory.set('architecture', { hierarchy: [] });
  });

  it('generates style files and stores config', async () => {
    const result = await agent.executeTask({ prompt: 'Create a landing page', sharedMemory });

    expect(result.success).toBe(true);
    expect(result.files?.length).toBeGreaterThan(0);
    expect(sharedMemory.get('styles')).toBeDefined();
  });
});


