import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { SharedMemory } from '../../utils/SharedMemory';

vi.mock('../../index', () => ({
  agentEventEmitter: new EventEmitter(),
}));

const { agentEventEmitter } = await import('../../index');
const agentEvents = agentEventEmitter as EventEmitter;
import { OrchestrationAgent } from '../../agents/OrchestrationAgent';

describe('OrchestrationAgent integration', () => {
  const events: unknown[] = [];

  beforeEach(() => {
    events.length = 0;
    agentEvents.removeAllListeners();
    agentEvents.on('agent-event', payload => events.push(payload));
  });

  it('runs phases with stubbed agents and emits events', async () => {
    const orchestrator = new OrchestrationAgent();

    (orchestrator as any).requirementsAgent.executeTask = vi
      .fn()
      .mockImplementation(async ({ sharedMemory }: { sharedMemory: SharedMemory }) => {
        sharedMemory.set('requirements', {
          functionalRequirements: ['todo list'],
        });
        return { success: true };
      });

    (orchestrator as any).componentArchitectAgent.executeTask = vi
      .fn()
      .mockImplementation(async ({ sharedMemory }: { sharedMemory: SharedMemory }) => {
        sharedMemory.set('architecture', {
          fileAssignments: [{ path: 'src/App.tsx', type: 'component', assignedAgent: 'component-generator-0' }],
        });
        return { success: true };
      });

    (orchestrator as any).styleGeneratorAgent.executeTask = vi
      .fn()
      .mockImplementation(async ({ sharedMemory }: { sharedMemory: SharedMemory }) => {
        sharedMemory.set('styles', {});
        return {
          success: true,
          files: [{ path: 'tailwind.config.ts', content: 'export default {}' }],
        };
      });

    (orchestrator as any).uiDesignerAgent.executeTask = vi
      .fn()
      .mockResolvedValue({ success: true });

    (orchestrator as any).codeGeneratorAgent.executeTask = vi
      .fn()
      .mockResolvedValue({
        success: true,
        files: [
          { path: 'src/App.tsx', content: 'export const App = () => null;' },
          { path: 'src/main.tsx', content: 'console.log("main")' },
        ],
      });

    (orchestrator as any).completionAgent.executeTask = vi
      .fn()
      .mockResolvedValue({ success: true });

    const result = await orchestrator.executeTask(
      {
        prompt: 'Create a todo list app',
        features: { name: 'TodoApp', features: [], styling: { animations: false, theme: 'light' } },
      }
    );

    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
    expect(events.some(event => (event as any).type === 'phase:start')).toBe(true);
    expect(events.some(event => (event as any).type === 'orchestration:complete')).toBe(true);
  });
});


