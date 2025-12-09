export interface OrchestrationMetrics {
  workflowId: string;
  duration: number;
  agentsUsed: number;
  warnings: number;
  success: boolean;
  timestamp: number;
}

export class MetricsCollector {
  private readonly records: OrchestrationMetrics[] = [];

  record(entry: OrchestrationMetrics): void {
    this.records.push(entry);
    if (this.records.length > 500) {
      this.records.shift();
    }
  }

  recent(count = 50): OrchestrationMetrics[] {
    return this.records.slice(-count);
  }

  summary(count = 50) {
    const recent = this.recent(count);
    if (recent.length === 0) {
      return {
        averageDuration: 0,
        averageAgents: 0,
        successRate: 0,
      };
    }

    const totals = recent.reduce(
      (acc, item) => {
        acc.duration += item.duration;
        acc.agents += item.agentsUsed;
        acc.success += item.success ? 1 : 0;
        return acc;
      },
      { duration: 0, agents: 0, success: 0 }
    );

    return {
      averageDuration: totals.duration / recent.length,
      averageAgents: totals.agents / recent.length,
      successRate: totals.success / recent.length,
    };
  }
}


