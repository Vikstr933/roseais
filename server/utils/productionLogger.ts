/**
 * Production-Safe Logger Utility
 * 
 * This utility provides a way to log messages that respects the NODE_ENV setting.
 * In production, only errors and warnings are logged to console.
 * In development, all log levels are shown.
 * 
 * Usage:
 *   import { prodLog } from './utils/productionLogger';
 *   prodLog.info('This only shows in development');
 *   prodLog.error('This always shows');
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const prodLog = {
  /**
   * Log info messages (only in development)
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log debug messages (only in development)
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Log warnings (always shown, but can be throttled in production)
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Log errors (always shown)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Log only in development with a label
   */
  dev: (label: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[DEV] ${label}:`, ...args);
    }
  },
};

