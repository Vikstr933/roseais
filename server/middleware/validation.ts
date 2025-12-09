import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { sentryService } from '../services/SentryService';
import { rateLimitService } from '../services/RateLimitService';
import crypto from 'crypto';

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
  
  // Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  
  // Strict Transport Security (HSTS) for production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  next();
}

/**
 * CSRF Token Generation and Validation
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function validateCSRFToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip CSRF for read-only methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] as string || req.body._csrf;
  const sessionToken = (req as any).session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      type: 'CSRF_ERROR',
    });
  }

  next();
}

/**
 * SQL Injection Prevention
 */
export function sanitizeSQLInput(input: string): string {
  // Remove or escape dangerous SQL characters
  return input
    .replace(/['";\\]/g, '') // Remove quotes and semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove multi-line comments
    .replace(/\*\//g, '')
    .trim();
}

/**
 * Path Traversal Prevention
 */
export function sanitizePath(filePath: string): string {
  // Remove directory traversal attempts
  return filePath
    .replace(/\.\./g, '')
    .replace(/^\//, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
}

/**
 * Command Injection Prevention
 */
export function sanitizeCommandInput(input: string): string {
  // Remove shell metacharacters
  const dangerous = /[;&|`$(){}[\]<>\\]/g;
  return input.replace(dangerous, '');
}

/**
 * XML/XXE Attack Prevention
 */
export function sanitizeXMLInput(input: string): string {
  // Remove DTD declarations and external entities
  return input
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!ENTITY[^>]*>/gi, '')
    .replace(/<\?xml[^>]*\?>/gi, '');
}

/**
 * Detect and prevent common web vulnerabilities
 */
export function detectVulnerabilities(input: string): string[] {
  const vulnerabilities: string[] = [];
  
  // XSS patterns
  if (/<script[^>]*>[\s\S]*?<\/script>/gi.test(input)) {
    vulnerabilities.push('Potential XSS: Script tags detected');
  }
  
  if (/on\w+\s*=\s*["'][^"']+["']/gi.test(input)) {
    vulnerabilities.push('Potential XSS: Event handlers detected');
  }
  
  // SQL Injection patterns
  if (/(\b(union|select|insert|update|delete|drop|create)\b[\s\S]*\b(from|into|where|table)\b)/gi.test(input)) {
    vulnerabilities.push('Potential SQL Injection: SQL keywords detected');
  }
  
  // Command Injection patterns
  if (/[;&|`$]/.test(input)) {
    vulnerabilities.push('Potential Command Injection: Shell metacharacters detected');
  }
  
  // Path Traversal
  if (/\.\.\/|\.\.\\/.test(input)) {
    vulnerabilities.push('Potential Path Traversal: Directory traversal detected');
  }
  
  return vulnerabilities;
}

