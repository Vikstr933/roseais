import { SimpleLogger } from './SimpleLogger';

export interface FileAssignment {
  path: string;
  type: string;
  owner: string;
  status: 'pending' | 'locked' | 'completed';
  content?: string;
  lockedAt?: number;
}

export class FileOrchestrator {
  private readonly assignments = new Map<string, FileAssignment>();
  private readonly logger = new SimpleLogger('FileOrchestrator');
  private readonly lockTimeout = 1000 * 60 * 5;

  register(path: string, owner: string, type: string): void {
    if (!this.assignments.has(path)) {
      this.assignments.set(path, { path, owner, type, status: 'pending' });
      this.logger.debug('Registered file assignment', { path, owner, type });
    }
  }

  requestLock(agentId: string, path: string): boolean {
    const assignment = this.assignments.get(path);
    if (!assignment) {
      this.logger.warn('Lock requested for unregistered file; registering automatically', {
        path,
        agentId,
      });
      this.assignments.set(path, {
        path,
        owner: agentId,
        type: 'unclassified',
        status: 'locked',
        lockedAt: Date.now(),
      });
      return true;
    }

    if (assignment.owner !== agentId) {
      this.logger.error('Agent attempted to lock file owned by another agent', {
        path,
        owner: assignment.owner,
        agentId,
      });
      return false;
    }

    if (assignment.status === 'locked') {
      const expired = assignment.lockedAt && Date.now() - assignment.lockedAt > this.lockTimeout;
      if (!expired) {
        this.logger.warn('Lock already held for file', { path, agentId });
        return false;
      }
      this.logger.warn('Lock timeout exceeded; reassigning lock', { path, agentId });
    }

    assignment.status = 'locked';
    assignment.lockedAt = Date.now();
    this.assignments.set(path, assignment);
    return true;
  }

  releaseLock(agentId: string, path: string, content: string): void {
    const assignment = this.assignments.get(path);
    if (!assignment) {
      this.logger.warn('Release requested for unregistered file', { path, agentId });
      return;
    }

    if (assignment.owner !== agentId) {
      this.logger.error('Agent attempted to release lock for file owned by another agent', {
        path,
        owner: assignment.owner,
        agentId,
      });
      return;
    }

    assignment.status = 'completed';
    assignment.content = content;
    assignment.lockedAt = undefined;
    this.assignments.set(path, assignment);
  }

  getCompletedFiles(): { path: string; content: string }[] {
    return Array.from(this.assignments.values())
      .filter(entry => entry.status === 'completed' && entry.content)
      .map(entry => ({ path: entry.path, content: entry.content! }));
  }

  getConflicts(): FileAssignment[] {
    return Array.from(this.assignments.values()).filter(
      entry => entry.status === 'locked' && entry.lockedAt && Date.now() - entry.lockedAt > this.lockTimeout
    );
  }

  reset(): void {
    this.assignments.clear();
  }
}


