import crypto from 'crypto';
import { SimpleLogger } from './SimpleLogger';

interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  ttl: number;
}

export class AgentCache<T = unknown> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly logger = new SimpleLogger('AgentCache');

  constructor(private readonly defaultTtl = 1000 * 60 * 5) {}

  private generateKey(agentId: string, prompt: string, context?: Record<string, unknown>): string {
    const hash = crypto.createHash('sha1');
    hash.update(agentId);
    hash.update(prompt);
    if (context) {
      hash.update(JSON.stringify(context));
    }
    return hash.digest('hex');
  }

  get(agentId: string, prompt: string, context?: Record<string, unknown>): T | undefined {
    const key = this.generateKey(agentId, prompt, context);
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    const isExpired = Date.now() - entry.createdAt > entry.ttl;
    if (isExpired) {
      this.logger.debug('Cache entry expired, removing', { agentId, key });
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(agentId: string, prompt: string, value: T, options?: { ttl?: number; context?: Record<string, unknown> }): void {
    const key = this.generateKey(agentId, prompt, options?.context);
    this.store.set(key, {
      key,
      value,
      createdAt: Date.now(),
      ttl: options?.ttl ?? this.defaultTtl,
    });
  }

  stats() {
    return {
      size: this.store.size,
    };
  }

  clear(): void {
    this.store.clear();
  }
}


