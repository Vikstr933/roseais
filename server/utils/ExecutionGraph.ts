import { SimpleLogger } from './SimpleLogger';

export interface ExecutionNode {
  id: string;
  dependsOn?: string[];
}

export interface ExecutionPhase {
  index: number;
  nodes: ExecutionNode[];
}

export class ExecutionGraph {
  private readonly logger = new SimpleLogger('ExecutionGraph');
  private readonly adjacency = new Map<string, Set<string>>();
  private readonly indegree = new Map<string, number>();

  constructor(nodes: ExecutionNode[]) {
    nodes.forEach(node => {
      this.adjacency.set(node.id, new Set());
      this.indegree.set(node.id, 0);
    });

    nodes.forEach(node => {
      (node.dependsOn ?? []).forEach(dep => {
        const dependencySet = this.adjacency.get(dep);
        if (!dependencySet) {
          throw new Error(`ExecutionGraph: dependency "${dep}" missing for node "${node.id}"`);
        }
        dependencySet.add(node.id);
        this.indegree.set(node.id, (this.indegree.get(node.id) ?? 0) + 1);
      });
    });
  }

  computePhases(): ExecutionPhase[] {
    const phases: ExecutionPhase[] = [];
    const indegreeCopy = new Map(this.indegree.entries());
    let phaseIndex = 0;

    while (true) {
      const availableNodes = Array.from(indegreeCopy.entries())
        .filter(([, degree]) => degree === 0)
        .map(([id]) => id);

      if (availableNodes.length === 0) {
        break;
      }

      phases.push({
        index: phaseIndex,
        nodes: availableNodes.map(id => ({
          id,
          dependsOn: Array.from(this.adjacency.entries())
            .filter(([, targets]) => targets.has(id))
            .map(([source]) => source),
        })),
      });

      availableNodes.forEach(nodeId => {
        indegreeCopy.delete(nodeId);
        const targets = this.adjacency.get(nodeId) ?? new Set();
        targets.forEach(targetId => {
          const currentDegree = indegreeCopy.get(targetId);
          if (currentDegree !== undefined) {
            indegreeCopy.set(targetId, currentDegree - 1);
          }
        });
      });

      phaseIndex += 1;
    }

    if (indegreeCopy.size > 0) {
      const remaining = Array.from(indegreeCopy.keys()).join(', ');
      this.logger.error('ExecutionGraph contains cycles', { remaining });
      throw new Error(`ExecutionGraph contains cyclic dependencies: ${remaining}`);
    }

    this.logger.debug('Execution graph phases computed', {
      phaseCount: phases.length,
      nodeCount: this.indegree.size,
    });

    return phases;
  }
}


