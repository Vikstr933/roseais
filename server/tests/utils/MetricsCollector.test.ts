import { describe, it, expect } from 'vitest';
import { MetricsCollector } from '../../utils/MetricsCollector';

describe('MetricsCollector', () => {
  it('tracks orchestration metrics', () => {
    const collector = new MetricsCollector();
    collector.record({
      workflowId: 'wf-1',
      duration: 1000,
      agentsUsed: 5,
      warnings: 0,
      success: true,
      timestamp: Date.now(),
    });

    const summary = collector.summary();
    expect(summary.averageDuration).toBeGreaterThan(0);
    expect(summary.successRate).toBeGreaterThan(0);
  });
});


