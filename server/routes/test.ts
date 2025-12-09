import { Router } from 'express';
import { rateLimitAI } from '../middleware/rateLimiting';
import { validateRequest } from '../middleware/validation';
import { userPromptSchema } from '../validation/schemas';
import { sentryService } from '../services/SentryService';

const router = Router();

/**
 * Test endpoint for rate limiting
 */
router.get('/test/rate-limit', rateLimitAI, (req, res) => {
  res.json({
    message: '✅ Rate limit check passed!',
    timestamp: new Date().toISOString(),
    info: 'Call this endpoint 100+ times in an hour to trigger rate limit',
  });
});

/**
 * Test endpoint for validation
 */
router.post('/test/validation', validateRequest(userPromptSchema), (req, res) => {
  res.json({
    message: '✅ Validation passed!',
    validated: req.body,
  });
});

/**
 * Test endpoint for Sentry error tracking
 */
router.get('/test/error', (req, res) => {
  // This will be caught by Sentry
  throw new Error('🧪 Test error for Sentry - Everything is working correctly!');
});

/**
 * Test endpoint for Sentry message
 */
router.get('/test/sentry-message', (req, res) => {
  sentryService.captureMessage('Test message from API', 'info');
  res.json({
    message: '✅ Sentry message sent! Check your Sentry dashboard.',
  });
});

/**
 * Health check endpoint
 */
router.get('/test/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      rateLimit: '✅ Active',
      validation: '✅ Active',
      errorTracking: '✅ Active',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;

