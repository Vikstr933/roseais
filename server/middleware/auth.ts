import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/APIKeyService';
import { pool } from '../../db';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        displayName: string;
        tier: 'free' | 'pro' | 'enterprise';
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
    // Validate and cast role to ensure type safety
    const validRole = (user.role === 'admin' || user.role === 'superadmin') 
      ? user.role 
      : 'user';
    
    // Validate and cast tier to ensure type safety
    const validTier = (user.tier === 'pro' || user.tier === 'enterprise') 
      ? user.tier 
      : 'free';
    
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      tier: validTier,
      role: validRole,
    };

    // Set user context for RLS (Row Level Security) policies
    // This allows database queries to filter by user automatically
    // Use set_config instead of SET because SET doesn't support parameterized queries
    try {
      await pool.query(`SELECT set_config('app.user_id', $1, false)`, [user.id]);
    } catch (error) {
      // If setting context fails, log but don't block the request
      // This allows the app to work even if RLS isn't fully configured
      console.warn('Failed to set database user context for RLS:', error);
    }

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
        // Validate and cast role to ensure type safety
        const validRole = (user.role === 'admin' || user.role === 'superadmin') 
          ? user.role 
          : 'user';
        
        // Validate and cast tier to ensure type safety
        const validTier = (user.tier === 'pro' || user.tier === 'enterprise') 
          ? user.tier 
          : 'free';
        
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          tier: validTier,
          role: validRole,
        };

        // Set user context for RLS if user is authenticated
        // Use set_config instead of SET because SET doesn't support parameterized queries
        try {
          await pool.query(`SELECT set_config('app.user_id', $1, false)`, [user.id]);
        } catch (error) {
          console.warn('Failed to set database user context for RLS:', error);
        }
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
