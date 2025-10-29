import { describe, it, expect } from 'vitest';
import { AgentCache } from '../../utils/AgentCache';

describe('AgentCache', () => {
  it('stores and retrieves values', () => {
    const cache = new AgentCache(1000);
    cache.set('agent', 'prompt', { value: 42 });

    const result = cache.get('agent', 'prompt');
    expect(result).toEqual({ value: 42 });
  });
});


