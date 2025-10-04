import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { sentryService } from '../services/SentryService';

/**
 * Validation Middleware
 * Validates request body against Zod schema
 */
export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      const validated = await schema.parseAsync(req.body);
      
      // Replace request body with validated data
      req.body = validated;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        console.warn('❌ Validation failed:', errors);
        
        // Log to Sentry for monitoring
        sentryService.addBreadcrumb(
          'Validation failed',
          'validation',
          { errors }
        );
        
        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
          type: 'VALIDATION_ERROR',
        });
      }
      
      // Unexpected error
      console.error('Validation error:', error);
      sentryService.captureException(error as Error);
      
      return res.status(500).json({
        error: 'Validation error',
        message: 'An unexpected error occurred during validation',
      });
    }
  };
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        return res.status(400).json({
          error: 'Query validation failed',
          details: errors,
        });
      }
      
      return res.status(500).json({
        error: 'Validation error',
      });
    }
  };
}

/**
 * Validate route parameters
 */
export function validateParams(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        return res.status(400).json({
          error: 'Parameter validation failed',
          details: errors,
        });
      }
      
      return res.status(500).json({
        error: 'Validation error',
      });
    }
  };
}

/**
 * Sanitize AI-generated code
 * Removes dangerous patterns and validates structure
 */
export async function sanitizeAIResponse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.body || !req.body.files) {
      return next();
    }
    
    const { detectMaliciousCode, sanitizeFileContent } = await import(
      '../validation/schemas'
    );
    
    // Validate each file
    const sanitizedFiles = req.body.files.map((file: any) => {
      // Detect malicious code
      const issues = detectMaliciousCode(file.content);
      
      if (issues.length > 0) {
        console.warn(`⚠️ Security issues detected in ${file.path}:`, issues);
        sentryService.addBreadcrumb(
          'Malicious code detected',
          'security',
          { file: file.path, issues }
        );
        
        // Log but don't block (can be configured to block)
        // throw new Error(`Security issues: ${issues.join(', ')}`);
      }
      
      return {
        ...file,
        content: sanitizeFileContent(file.content),
      };
    });
    
    req.body.files = sanitizedFiles;
    next();
  } catch (error) {
    console.error('Sanitization error:', error);
    sentryService.captureException(error as Error);
    
    return res.status(500).json({
      error: 'Failed to sanitize code',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Validate file uploads
 */
export function validateFileUpload(maxSize = 10 * 1024 * 1024) {
  // 10MB default
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next();
    }
    
    const { isAllowedFileExtension } = require('../validation/schemas');
    
    // Check file size
    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: 'File too large',
        maxSize: `${maxSize / 1024 / 1024}MB`,
      });
    }
    
    // Check file extension
    if (!isAllowedFileExtension(req.file.originalname)) {
      return res.status(400).json({
        error: 'File type not allowed',
        allowed: ['.ts', '.tsx', '.js', '.jsx', '.css', '.json'],
      });
    }
    
    next();
  };
}

/**
 * Validate and limit request body size
 */
export function validateBodySize(maxSize = 5 * 1024 * 1024) {
  // 5MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('content-length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        error: 'Request body too large',
        maxSize: `${maxSize / 1024 / 1024}MB`,
      });
    }
    
    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  );
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
}

