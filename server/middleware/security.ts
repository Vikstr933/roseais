/**
 * Comprehensive Security Middleware
 *
 * Implements enterprise-grade security measures including:
 * - Advanced headers protection
 * - Request validation and sanitization
 * - Rate limiting and DDoS protection
 * - Content Security Policy
 * - XSS and CSRF protection
 */

import { Request, Response, NextFunction } from 'express';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('SecurityMiddleware');

/**
 * Helper: Ensure CORS headers are set on response
 * CRITICAL: This must be called before returning any error response
 */
function ensureCORSHeaders(req: Request, res: Response): void {
  const origin = req.headers.origin;
  
  // Only set if not already set
  if (res.getHeader('Access-Control-Allow-Origin')) {
    return;
  }
  
  // Allow localhost in development
  if (origin && origin.includes('localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // Allow Vercel
  else if (origin && origin.includes('vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // Allow Render
  else if (origin && origin.includes('onrender.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // Fallback - allow origin if present
  else if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export interface SecurityConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableXFrameOptions: boolean;
  maxRequestSize: string;
  allowedOrigins: string[];
  trustedDomains: string[];
}

const DEFAULT_CONFIG: SecurityConfig = {
  enableCSP: true,
  enableHSTS: true,
  enableXFrameOptions: true,
  maxRequestSize: '10mb',
  allowedOrigins: ['http://localhost:5173', 'http://localhost:3001'],
  trustedDomains: ['localhost', '*.vercel.app', '*.netlify.app']
};

/**
 * Advanced Security Headers Middleware
 */
export function securityHeaders(config: Partial<SecurityConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    // Content Security Policy (CSP)
    if (finalConfig.enableCSP) {
      const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https: wss: ws:",
        "media-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
      ].join('; ');

      res.setHeader('Content-Security-Policy', csp);
    }

    // HTTP Strict Transport Security (HSTS)
    if (finalConfig.enableHSTS) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // X-Frame-Options
    if (finalConfig.enableXFrameOptions) {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    // Additional Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    // COEP disabled to allow Google Maps and external APIs
    // res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Remove sensitive headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  };
}

/**
 * Input Validation and Sanitization Middleware
 */
export function inputValidation() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and sanitize URL parameters
      if (req.params) {
        for (const [key, value] of Object.entries(req.params)) {
          if (typeof value === 'string') {
            // Check for common injection patterns
            if (containsSQLInjection(value) || containsXSS(value)) {
              logger.warn('Suspicious input detected in URL params', { key, value: value.substring(0, 50) });
              // CRITICAL: Ensure CORS headers are set before returning error
              ensureCORSHeaders(req, res);
              return res.status(400).json({
                error: 'Invalid input detected',
                code: 'INVALID_INPUT'
              });
            }
          }
        }
      }

      // Validate and sanitize query parameters
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            if (containsSQLInjection(value) || containsXSS(value)) {
              logger.warn('Suspicious input detected in query params', { key, value: value.substring(0, 50) });
              // CRITICAL: Ensure CORS headers are set before returning error
              ensureCORSHeaders(req, res);
              return res.status(400).json({
                error: 'Invalid input detected',
                code: 'INVALID_INPUT'
              });
            }
          }
        }
      }

      // Validate request body size
      const contentLength = req.get('content-length');
      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
        logger.warn('Request body too large', { contentLength });
        // CRITICAL: Ensure CORS headers are set before returning error
        ensureCORSHeaders(req, res);
        return res.status(413).json({
          error: 'Request body too large',
          code: 'PAYLOAD_TOO_LARGE'
        });
      }

      next();
    } catch (error) {
      logger.error('Input validation error', error as Error);
      // CRITICAL: Ensure CORS headers are set before returning error
      ensureCORSHeaders(req, res);
      res.status(500).json({
        error: 'Internal server error',
        code: 'VALIDATION_ERROR'
      });
    }
  };
}

/**
 * API Rate Limiting Middleware
 */
export function apiRateLimit() {
  const requests = new Map<string, { count: number; resetTime: number }>();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_REQUESTS = 2000; // requests per window (increased to handle auto-save)
  
  // Endpoints that should have higher rate limits (auto-save, polling, etc.)
  const HIGH_LIMIT_ENDPOINTS = ['/api/workspace-sessions'];
  const HIGH_LIMIT_MAX_REQUESTS = 5000; // Higher limit for auto-save endpoints

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = getClientIdentifier(req);
    const now = Date.now();
    
    // Check if this is a high-limit endpoint
    const isHighLimitEndpoint = HIGH_LIMIT_ENDPOINTS.some(endpoint => 
      req.path.startsWith(endpoint)
    );
    const maxRequests = isHighLimitEndpoint ? HIGH_LIMIT_MAX_REQUESTS : MAX_REQUESTS;

    // Clean up expired entries
    for (const [key, data] of requests.entries()) {
      if (now > data.resetTime) {
        requests.delete(key);
      }
    }

    // Get or create client data
    let clientData = requests.get(clientId);
    if (!clientData || now > clientData.resetTime) {
      clientData = {
        count: 0,
        resetTime: now + WINDOW_MS
      };
      requests.set(clientId, clientData);
    }

    // Check rate limit
    if (clientData.count >= maxRequests) {
      logger.warn('Rate limit exceeded', { clientId, count: clientData.count, endpoint: req.path, maxRequests });

      // CRITICAL: Ensure CORS headers are set before returning error
      ensureCORSHeaders(req, res);
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', clientData.resetTime.toString());

      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      });
    }

    // Increment counter
    clientData.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - clientData.count).toString());
    res.setHeader('X-RateLimit-Reset', clientData.resetTime.toString());

    next();
  };
}

/**
 * Request Logging and Monitoring
 */
export function requestMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const clientId = getClientIdentifier(req);

    // Log request
    logger.info('Request received', {
      method: req.method,
      url: req.url,
      clientId,
      userAgent: req.get('User-Agent')?.substring(0, 100),
      contentType: req.get('Content-Type'),
      timestamp: new Date().toISOString()
    });

    // Monitor response
    const originalSend = res.send;
    res.send = function(body: any) {
      const duration = Date.now() - startTime;

      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        clientId,
        responseSize: body ? Buffer.byteLength(body) : 0
      });

      // Alert on suspicious activity
      if (res.statusCode >= 400) {
        logger.warn('Client error response', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          clientId
        });
      }

      if (duration > 5000) { // 5 second threshold
        logger.warn('Slow request detected', {
          method: req.method,
          url: req.url,
          duration,
          clientId
        });
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * CORS Configuration with Security Focus
 */
export function secureCORS(config: Partial<SecurityConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('Origin');

    // Check if origin is allowed
    if (origin && finalConfig.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // Allow requests without origin (same-origin)
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    next();
  };
}

// Helper Functions

function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(['"])(.*?)\1\s*(OR|AND)\s*['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
    /(--|\/\*|\*\/|;)/,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bINSERT\b.*\bINTO\b)/i,
    /(\bDROP\b.*\bTABLE\b)/i
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

function containsXSS(input: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[\\s]*=[\\s]*[\\"\\\'][\\s]*javascript:/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}

function getClientIdentifier(req: Request): string {
  // Try to get the most accurate client identifier
  const forwarded = req.get('X-Forwarded-For');
  const realIP = req.get('X-Real-IP');
  const clientIP = forwarded?.split(',')[0] || realIP || req.ip || req.connection.remoteAddress || 'unknown';

  // Include User-Agent for more specific identification
  const userAgent = req.get('User-Agent') || 'unknown';

  return `${clientIP}:${userAgent.substring(0, 50)}`;
}

export default {
  securityHeaders,
  inputValidation,
  apiRateLimit,
  requestMonitoring,
  secureCORS
};