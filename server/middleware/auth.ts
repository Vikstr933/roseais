import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/APIKeyService';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        displayName: string;
        tier: string;
        role: 'user' | 'admin' | 'superadmin';
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies session token and adds user to request object
 */
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await userService.getUserFromSession(sessionToken);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Add user to request object
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      tier: user.tier || 'free',
      role: user.role || 'user',
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication middleware
 * Adds user to request if token is valid, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (sessionToken) {
      const user = await userService.getUserFromSession(sessionToken);
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          tier: user.tier || 'free',
          role: user.role || 'user',
        };
      }
    }

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    // Continue without user if there's an error
    next();
  }
};

/**
 * API Key validation middleware
 * Checks if user has required API keys for the service
 */
export const requireAPIKeys = (requiredServices: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const missingKeys = await userService.getMissingAPIKeys(
        req.user.id,
        requiredServices
      );

      if (missingKeys.length > 0) {
        return res.status(400).json({
          error: 'Missing required API keys',
          missingServices: missingKeys,
          message: `Please add API keys for: ${missingKeys.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      console.error('API key validation error:', error);
      res.status(500).json({ error: 'API key validation failed' });
    }
  };
};
