import { describe, it, expect } from 'vitest';
import { FileOrchestrator } from '../../utils/FileOrchestrator';

describe('FileOrchestrator', () => {
  it('prevents conflicting locks', () => {
    const orchestrator = new FileOrchestrator();
    orchestrator.register('src/App.tsx', 'agent-1', 'component');

    const first = orchestrator.requestLock('agent-1', 'src/App.tsx');
    const second = orchestrator.requestLock('agent-2', 'src/App.tsx');

    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});


