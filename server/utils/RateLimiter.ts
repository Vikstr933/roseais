import { SimpleLogger } from './SimpleLogger';

type Task<T> = () => Promise<T>;

export class RateLimiter {
  private readonly queue: Array<{
    task: Task<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  private active = 0;
  private readonly logger = new SimpleLogger('RateLimiter');

  constructor(private readonly concurrency = 5) {}

  async run<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ 
        task: task as Task<unknown>, 
        resolve: resolve as (value: unknown) => void, 
        reject 
      });
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.active >= this.concurrency) {
      return;
    }

    const next = this.queue.shift();
    if (!next) {
      return;
    }

    this.active += 1;
    next.task()
      .then(result => {
        next.resolve(result);
      })
      .catch(error => {
        next.reject(error);
      })
      .finally(() => {
        this.active -= 1;
        this.processQueue();
      });
  }

  stats() {
    return {
      active: this.active,
      queued: this.queue.length,
    };
  }
}


