import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { sentryService } from '../services/SentryService';

// Note: Sentry Handlers API was removed in v8. Using manual instrumentation instead.

/**
 * Sentry request handler middleware
 * Must be added BEFORE all routes
 */
export const sentryRequestHandler = () => {
  // Modern Sentry SDK uses automatic instrumentation
  // This middleware adds request context manually
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.SENTRY_DSN) {
      Sentry.setContext('request', {
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.get('user-agent'),
        },
      });
    }
    next();
  };
};

/**
 * Sentry tracing middleware
 * Adds performance monitoring
 */
export const sentryTracingHandler = () => {
  // Modern Sentry uses automatic instrumentation for tracing
  return (req: Request, res: Response, next: NextFunction) => next();
};

/**
 * Sentry error handler middleware
 * Must be added AFTER all routes but BEFORE error handlers
 */
export const sentryErrorHandler = () => {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err);
    }
    next(err);
  };
};

/**
 * Custom error logging middleware
 * Logs errors with context
 */
export const errorLogger = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Add context to Sentry
  Sentry.setContext('request', {
    method: req.method,
    url: req.url,
    query: req.query,
    body: req.body,
  });

  // Set user context if available
  const user = (req as any).user;
  if (user) {
    sentryService.setUser(user.id, user.email, user.username);
  }

  // Add breadcrumb
  sentryService.addBreadcrumb(
    `Error in ${req.method} ${req.url}`,
    'error',
    {
      statusCode: res.statusCode,
      errorMessage: err.message,
    }
  );

  // Capture the error
  sentryService.captureException(err, {
    method: req.method,
    url: req.url,
    userId: user?.id,
  });

  console.error('❌ Server Error:', err);

  next(err);
};

/**
 * Final error response handler
 * Sends user-friendly error messages
 */
export const errorResponder = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Don't send if response already started
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = (err as any).statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    error: isProduction ? 'Internal Server Error' : err.message,
    message: isProduction
      ? 'Something went wrong. Our team has been notified.'
      : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
};

