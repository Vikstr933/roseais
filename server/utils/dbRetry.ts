/**
 * Database retry utility for handling connection errors
 * Retries database queries when connection errors occur
 */

import { DrizzleError } from 'drizzle-orm';

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,  // Increased from 3 to 5 for better reliability
  retryDelay: 2000, // Increased from 1s to 2s for better stability
  retryableErrors: [
    'Connection terminated',
    'Connection terminated unexpectedly',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'Connection closed',
    'Connection lost',
    'server closed the connection',
    'terminating connection due to administrator command',
  ],
};

/**
 * Check if an error is retryable (connection-related)
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString() || '';
  const errorCode = error.code || '';
  
  // Check error message
  const isRetryable = DEFAULT_OPTIONS.retryableErrors.some(
    (pattern) => errorMessage.includes(pattern) || errorCode.includes(pattern)
  );
  
  // Drizzle errors that are connection-related
  if (error instanceof DrizzleError) {
    const cause = (error as any).cause;
    if (cause) {
      return isRetryableError(cause);
    }
  }
  
  return isRetryable;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a database operation with exponential backoff
 * 
 * @param operation - The database operation to retry
 * @param options - Retry options
 * @returns The result of the operation
 * @throws The last error if all retries fail
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // If not retryable, throw immediately
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // If this was the last attempt, throw
      if (attempt === opts.maxRetries) {
        break;
      }
      
      // Calculate exponential backoff delay
      const delay = opts.retryDelay * Math.pow(2, attempt);
      console.warn(
        `⚠️  Database connection error (attempt ${attempt + 1}/${opts.maxRetries + 1}), retrying in ${delay}ms...`,
        error instanceof Error ? error.message : String(error)
      );
      
      await sleep(delay);
    }
  }
  
  // All retries exhausted
  console.error(
    `❌ Database operation failed after ${opts.maxRetries + 1} attempts:`,
    lastError instanceof Error ? lastError.message : String(lastError)
  );
  throw lastError;
}

/**
 * Execute a database query with retry logic
 * Wrapper for common Drizzle operations
 */
export async function executeWithRetry<T>(
  queryFn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return retryDbOperation(queryFn, options);
}

