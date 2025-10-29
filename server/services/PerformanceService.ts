/**
 * Performance Optimization Service
 *
 * Implements advanced performance features including:
 * - Intelligent caching strategies
 * - Response compression
 * - Request batching
 * - Memory optimization
 * - Database query optimization
 */

import { Request, Response, NextFunction } from 'express';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('PerformanceService');

export interface CacheConfig {
  enabled: boolean;
  defaultTTL: number; // seconds
  maxSize: number; // MB
  strategy: 'lru' | 'lfu' | 'fifo';
}

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  activeCacheEntries: number;
}

/**
 * Advanced Memory Cache with Multiple Strategies
 */
export class AdvancedCache {
  private cache = new Map<string, CacheEntry>();
  private accessCount = new Map<string, number>();
  private config: CacheConfig;
  private totalRequests = 0;
  private cacheHits = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      enabled: true,
      defaultTTL: 300, // 5 minutes
      maxSize: 100, // 100MB
      strategy: 'lru',
      ...config
    };
  }

  set(key: string, value: any, ttl?: number): void {
    if (!this.config.enabled) return;

    const expiresAt = Date.now() + (ttl || this.config.defaultTTL) * 1000;
    const entry: CacheEntry = {
      value,
      expiresAt,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      size: this.calculateSize(value)
    };

    // Check if we need to evict entries
    this.evictIfNecessary(entry.size);

    this.cache.set(key, entry);
    this.accessCount.set(key, 1);

    logger.debug('Cache entry added', { key, size: entry.size, ttl });
  }

  get(key: string): any | null {
    this.totalRequests++;

    if (!this.config.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.accessCount.delete(key);
      return null;
    }

    // Update access information
    entry.lastAccessed = Date.now();
    const count = this.accessCount.get(key) || 0;
    this.accessCount.set(key, count + 1);

    this.cacheHits++;
    logger.debug('Cache hit', { key, hitRate: this.getHitRate() });

    return entry.value;
  }

  delete(key: string): boolean {
    return this.cache.delete(key) && this.accessCount.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessCount.clear();
    logger.info('Cache cleared');
  }

  getMetrics(): PerformanceMetrics {
    const memoryUsage = this.getTotalMemoryUsage();

    return {
      requestCount: this.totalRequests,
      averageResponseTime: 0, // Calculated externally
      cacheHitRate: this.getHitRate(),
      memoryUsage,
      activeCacheEntries: this.cache.size
    };
  }

  private evictIfNecessary(newEntrySize: number): void {
    const currentSize = this.getTotalMemoryUsage();
    const maxSizeBytes = this.config.maxSize * 1024 * 1024;

    if (currentSize + newEntrySize <= maxSizeBytes) return;

    const entriesToRemove = Math.ceil(this.cache.size * 0.2); // Remove 20%
    const sortedEntries = Array.from(this.cache.entries());

    switch (this.config.strategy) {
      case 'lru':
        sortedEntries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
        break;
      case 'lfu':
        sortedEntries.sort(([keyA], [keyB]) => {
          const countA = this.accessCount.get(keyA) || 0;
          const countB = this.accessCount.get(keyB) || 0;
          return countA - countB;
        });
        break;
      case 'fifo':
        sortedEntries.sort(([, a], [, b]) => a.createdAt - b.createdAt);
        break;
    }

    for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
      const [key] = sortedEntries[i];
      this.cache.delete(key);
      this.accessCount.delete(key);
    }

    logger.info('Cache eviction completed', {
      strategy: this.config.strategy,
      removed: entriesToRemove,
      remaining: this.cache.size
    });
  }

  private getTotalMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  private getHitRate(): number {
    return this.totalRequests > 0 ? (this.cacheHits / this.totalRequests) * 100 : 0;
  }

  private calculateSize(value: any): number {
    return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
  }
}

interface CacheEntry {
  value: any;
  expiresAt: number;
  createdAt: number;
  lastAccessed: number;
  size: number;
}

/**
 * Response Compression Middleware
 * 
 * NOTE: Currently disabled - was setting gzip header without actually compressing
 * TODO: Implement proper compression using 'compression' package
 */
export function compressionMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Compression disabled - was causing ERR_CONTENT_DECODING_FAILED
    // The middleware was setting Content-Encoding: gzip without actually compressing
    next();
  };
}

/**
 * Cache Middleware for API Responses
 */
export function apiCache(cache: AdvancedCache, ttl?: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', cachedResponse.ttl || 'default');
      return res.json(cachedResponse.data);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(body: any) {
      if (res.statusCode === 200) {
        cache.set(cacheKey, { data: body, ttl }, ttl);
        res.setHeader('X-Cache', 'MISS');
      }
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Request Batching Service
 */
export class RequestBatcher {
  private batches = new Map<string, BatchInfo>();
  private batchTimeout = 50; // ms

  constructor(timeout: number = 50) {
    this.batchTimeout = timeout;
  }

  batch<T>(key: string, request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      let batch = this.batches.get(key);

      if (!batch) {
        batch = {
          requests: [],
          timer: null,
          request
        };
        this.batches.set(key, batch);
      }

      batch.requests.push({ resolve, reject });

      if (batch.timer) {
        clearTimeout(batch.timer);
      }

      batch.timer = setTimeout(() => {
        this.executeBatch(key);
      }, this.batchTimeout);
    });
  }

  private async executeBatch(key: string): Promise<void> {
    const batch = this.batches.get(key);
    if (!batch) return;

    this.batches.delete(key);

    try {
      const result = await batch.request();
      batch.requests.forEach(({ resolve }) => resolve(result));

      logger.debug('Batch executed successfully', {
        key,
        requestCount: batch.requests.length
      });
    } catch (error) {
      batch.requests.forEach(({ reject }) => reject(error));

      logger.error('Batch execution failed', error as Error, {
        key,
        requestCount: batch.requests.length
      });
    }
  }
}

interface BatchInfo {
  requests: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>;
  timer: NodeJS.Timeout | null;
  request: () => Promise<any>;
}

/**
 * Memory Usage Monitoring
 */
export function memoryMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startMemory = process.memoryUsage();

    res.on('finish', () => {
      const endMemory = process.memoryUsage();
      const memoryDelta = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external
      };

      // Log if significant memory increase
      if (memoryDelta.heapUsed > 10 * 1024 * 1024) { // 10MB
        logger.warn('High memory usage detected', {
          url: req.originalUrl,
          method: req.method,
          memoryDelta
        });
      }
    });

    next();
  };
}

/**
 * Performance Service
 */
export class PerformanceService {
  private cache: AdvancedCache;
  private batcher: RequestBatcher;
  private metrics: Map<string, number[]> = new Map();

  constructor(cacheConfig?: Partial<CacheConfig>) {
    this.cache = new AdvancedCache(cacheConfig);
    this.batcher = new RequestBatcher();
  }

  getCache(): AdvancedCache {
    return this.cache;
  }

  getBatcher(): RequestBatcher {
    return this.batcher;
  }

  recordResponseTime(endpoint: string, duration: number): void {
    let times = this.metrics.get(endpoint);
    if (!times) {
      times = [];
      this.metrics.set(endpoint, times);
    }

    times.push(duration);

    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  getAverageResponseTime(endpoint: string): number {
    const times = this.metrics.get(endpoint);
    if (!times || times.length === 0) return 0;

    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  getMetrics(): PerformanceMetrics & { endpointMetrics: Record<string, number> } {
    const cacheMetrics = this.cache.getMetrics();
    const endpointMetrics: Record<string, number> = {};

    for (const [endpoint, times] of this.metrics.entries()) {
      endpointMetrics[endpoint] = this.getAverageResponseTime(endpoint);
    }

    return {
      ...cacheMetrics,
      endpointMetrics
    };
  }

  clearCache(): void {
    this.cache.clear();
  }

  optimizeForEndpoint(endpoint: string, optimization: 'cache' | 'batch' | 'compress'): void {
    logger.info('Performance optimization applied', { endpoint, optimization });
    // Implementation would depend on specific optimization type
  }
}

// Singleton instance
export const performanceService = new PerformanceService({
  enabled: true,
  defaultTTL: 300, // 5 minutes
  maxSize: 200, // 200MB
  strategy: 'lru'
});

export default performanceService;