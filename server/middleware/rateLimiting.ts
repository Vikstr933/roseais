import { Request, Response, NextFunction } from 'express';
import { rateLimitService } from '../services/RateLimitService';

/**
 * Get user identifier for rate limiting
 * Uses user ID if authenticated, otherwise uses IP address
 */
function getUserIdentifier(req: Request): string {
  // Try to get user ID from auth
  const userId = (req as any).user?.id || (req as any).userId;
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fallback to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Rate limit middleware for AI calls
 * Limits: 100 calls per hour per user (free tier)
 */
export const rateLimitAI = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserIdentifier(req);
    
    // Check if user is premium (you can add your logic here)
    const isPremium = (req as any).user?.isPremium || false;
    
    if (isPremium) {
      await rateLimitService.checkAICallPremium(userId);
    } else {
      await rateLimitService.checkAICall(userId);
    }
    
    // Add rate limit info to headers
    const remaining = await rateLimitService.getAICallsRemaining(userId);
    res.setHeader('X-RateLimit-Limit', remaining.total.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.remaining.toString());
    res.setHeader('X-RateLimit-Reset', remaining.resetIn.toString());
    
    next();
  } catch (error: any) {
    console.error('Rate limit exceeded:', error.message);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: error.message,
      type: 'RATE_LIMIT_ERROR',
    });
  }
};

/**
 * Rate limit middleware for builds/deployments
 * Limits: 10 builds per minute per user
 */
export const rateLimitBuild = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserIdentifier(req);
    await rateLimitService.checkBuild(userId);
    next();
  } catch (error: any) {
    console.error('Build rate limit exceeded:', error.message);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: error.message,
      type: 'RATE_LIMIT_ERROR',
    });
  }
};

/**
 * Rate limit middleware for general API calls
 * Limits: 100 requests per minute per user
 */
export const rateLimitAPI = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserIdentifier(req);
    await rateLimitService.checkAPI(userId);
    next();
  } catch (error: any) {
    console.error('API rate limit exceeded:', error.message);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: error.message,
      type: 'RATE_LIMIT_ERROR',
    });
  }
};

/**
 * Endpoint to check rate limit status
 */
export const getRateLimitStatus = async (req: Request, res: Response) => {
  try {
    const userId = getUserIdentifier(req);
    const aiLimits = await rateLimitService.getAICallsRemaining(userId);
    
    return res.json({
      aiCalls: {
        remaining: aiLimits.remaining,
        total: aiLimits.total,
        resetIn: aiLimits.resetIn,
      },
      isPremium: (req as any).user?.isPremium || false,
    });
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    return res.status(500).json({
      error: 'Failed to get rate limit status',
    });
  }
};
