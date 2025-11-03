import * as Sentry from '@sentry/react';
import React from 'react';

/**
 * Sentry Error Tracking Service for Frontend
 * Monitors client-side errors and performance
 */
export class FrontendSentryService {
  private initialized = false;

  /**
   * Initialize Sentry for frontend error tracking
   */
  initialize() {
    if (this.initialized) return;

    const dsn = import.meta.env.VITE_SENTRY_DSN;
    
    if (!dsn) {
      console.warn('⚠️ VITE_SENTRY_DSN not set. Frontend error tracking disabled.');
      return;
    }

    try {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE || 'development',
        
        // Performance Monitoring
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
        
        // Sample rate
        tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
        
        // Replay for session recording (optional)
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
        
        // Enable in both development and production for testing
        enabled: true, // Change to: import.meta.env.MODE === 'production' for production-only

        // Release tracking
        release: import.meta.env.VITE_APP_VERSION || '1.0.0',

        // Before sending, clean sensitive data
        beforeSend(event, hint) {
          // Remove sensitive localStorage data
          if (event.breadcrumbs) {
            event.breadcrumbs = event.breadcrumbs.filter(
              (breadcrumb) => !breadcrumb.message?.includes('token')
            );
          }
          return event;
        },
      });

      this.initialized = true;
      console.log('✅ Frontend Sentry initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error);
    }
  }

  /**
   * Capture an exception
   */
  captureException(error: Error, context?: Record<string, any>) {
    if (!this.initialized) {
      console.error('Sentry Error:', error);
      return;
    }

    Sentry.captureException(error, {
      extra: context,
    });
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
    if (!this.initialized) return;

    Sentry.captureMessage(message, level);
  }

  /**
   * Set user context
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
   * Add breadcrumb
   */
  addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
    if (!this.initialized) return;

    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}

// Export singleton
export const frontendSentryService = new FrontendSentryService();

// Also export ErrorBoundary component with fallback
// If Sentry.ErrorBoundary is undefined, use a pass-through component
// This needs to be a proper React component that can accept props
export const ErrorBoundary = Sentry.ErrorBoundary || (({ children, fallback }: any) => {
  // Simple fallback that just renders children without error boundary functionality
  return React.createElement(React.Fragment, null, children);
});

