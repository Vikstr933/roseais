import * as Sentry from '@sentry/node';

/**
 * Sentry Error Tracking Service
 * Monitors errors, performance, and user issues in production
 */
export class SentryService {
  private initialized = false;

  /**
   * Initialize Sentry for backend error tracking
   */
  initialize() {
    if (this.initialized) return;

    const dsn = process.env.SENTRY_DSN;
    
    if (!dsn) {
      console.warn('⚠️ SENTRY_DSN not set. Error tracking disabled.');
      console.warn('   Get your DSN at: https://sentry.io/');
      return;
    }

    try {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        
        // Performance Monitoring
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
        
        // Profiling (optional - removed ProfilingIntegration as it's causing import issues)
        profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        integrations: [
          // ProfilingIntegration removed - can be added later if needed
        ],

        // Don't send errors in development
        enabled: process.env.NODE_ENV === 'production',

        // Release tracking
        release: process.env.npm_package_version || '1.0.0',

        // Ignore common errors
        ignoreErrors: [
          'ECONNREFUSED',
          'ETIMEDOUT',
          'ENOTFOUND',
          'socket hang up',
        ],

        // Before sending, clean sensitive data
        beforeSend(event, hint) {
          // Remove sensitive data
          if (event.request?.cookies) {
            delete event.request.cookies;
          }
          if (event.request?.headers?.['authorization']) {
            event.request.headers['authorization'] = '[REDACTED]';
          }
          return event;
        },
      });

      this.initialized = true;
      console.log('✅ Sentry error tracking initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error);
    }
  }

  /**
   * Capture an exception
   */
  captureException(error: Error, context?: Record<string, any>) {
    if (!this.initialized) return;

    Sentry.captureException(error, {
      extra: context,
    });
  }

  /**
   * Capture a message (not an error)
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    if (!this.initialized) return;

    Sentry.captureMessage(message, level);
  }

  /**
   * Set user context for error tracking
   */
  setUser(userId: string, email?: string, username?: string) {
    if (!this.initialized) return;

    Sentry.setUser({
      id: userId,
      email,
      username,
    });
  }

  /**
   * Clear user context
   */
  clearUser() {
    if (!this.initialized) return;
    Sentry.setUser(null);
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
    if (!this.initialized) return;

    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Start a performance transaction (span)
   * Modern Sentry API uses startSpan instead of startTransaction
   */
  startTransaction(name: string, op: string) {
    if (!this.initialized) return null;

    // Modern Sentry v8+ uses startSpan
    return Sentry.startSpan({
      name,
      op,
    }, (span) => span);
  }

  /**
   * Flush events (useful before shutdown)
   */
  async flush(timeout = 2000): Promise<boolean> {
    if (!this.initialized) return true;
    
    try {
      return await Sentry.flush(timeout);
    } catch (error) {
      console.error('Error flushing Sentry:', error);
      return false;
    }
  }

  /**
   * Close Sentry
   */
  async close(): Promise<void> {
    if (!this.initialized) return;
    
    try {
      await Sentry.close(2000);
      console.log('✅ Sentry closed');
    } catch (error) {
      console.error('Error closing Sentry:', error);
    }
  }
}

// Export singleton instance
export const sentryService = new SentryService();

// Also export Sentry for middleware use
export { Sentry };

