import { SimpleLogger } from './SimpleLogger';

export type SharedMemorySnapshot = Record<string, unknown>;

export class SharedMemory {
  private readonly store = new Map<string, unknown>();
  private readonly logger: SimpleLogger;

  constructor(private readonly namespace = 'default') {
    this.logger = new SimpleLogger(`SharedMemory:${namespace}`);
  }

  set<T>(key: string, value: T): void {
    this.logger.debug('Setting value in shared memory', {
      key,
      type: typeof value,
    });
    this.store.set(key, value as unknown);
  }

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  require<T>(key: string, message?: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new Error(message ?? `Shared memory key "${key}" not found`);
    }
    return value;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): boolean {
    this.logger.debug('Deleting value from shared memory', { key });
    return this.store.delete(key);
  }

  clear(): void {
    this.logger.debug('Clearing shared memory');
    this.store.clear();
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  snapshot(): SharedMemorySnapshot {
    return Object.fromEntries(this.store.entries());
  }
}


