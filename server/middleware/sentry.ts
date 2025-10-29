import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { sentryService } from '../services/SentryService';

/**
 * Sentry request handler middleware
 * Must be added BEFORE all routes
 */
export const sentryRequestHandler = () => {
  // Only enable if Sentry is configured and Handlers are available
  if (!process.env.SENTRY_DSN || !Sentry.Handlers) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }
  
  try {
    return Sentry.Handlers.requestHandler({
      user: ['id', 'username', 'email'],
      ip: true,
      transaction: 'methodPath',
    });
  } catch (error) {
    console.warn('⚠️ Sentry request handler unavailable:', error);
    return (req: Request, res: Response, next: NextFunction) => next();
  }
};

/**
 * Sentry tracing middleware
 * Adds performance monitoring
 */
export const sentryTracingHandler = () => {
  // Only enable if Sentry is configured and Handlers are available
  if (!process.env.SENTRY_DSN || !Sentry.Handlers) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }
  
  try {
    return Sentry.Handlers.tracingHandler();
  } catch (error) {
    console.warn('⚠️ Sentry tracing handler unavailable:', error);
    return (req: Request, res: Response, next: NextFunction) => next();
  }
};

/**
 * Sentry error handler middleware
 * Must be added AFTER all routes but BEFORE error handlers
 */
export const sentryErrorHandler = () => {
  // Only enable if Sentry is configured and Handlers are available
  if (!process.env.SENTRY_DSN || !Sentry.Handlers) {
    return (err: Error, req: Request, res: Response, next: NextFunction) => next(err);
  }
  
  try {
    return Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture all errors with status >= 500
        return true;
      },
    });
  } catch (error) {
    console.warn('⚠️ Sentry error handler unavailable:', error);
    return (err: Error, req: Request, res: Response, next: NextFunction) => next(err);
  }
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

