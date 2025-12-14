import { Request, Response, NextFunction } from 'express';

/**
 * Admin Role-Based Access Control (RBAC) Middleware
 * Ensures only users with admin or superadmin role can access protected routes
 */

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    role: 'user' | 'admin' | 'superadmin';
    tier: 'free' | 'pro' | 'enterprise';
  };
}

/**
 * Check if user is admin or superadmin
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  const { role } = req.user;

  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required. Your role: ' + role
    });
  }

  // User is admin, proceed
  next();
};

/**
 * Check if user is superadmin (highest privilege)
 */
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  const { role } = req.user;

  if (role !== 'superadmin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Superadmin access required. Your role: ' + role
    });
  }

  // User is superadmin, proceed
  next();
};

/**
 * Check if user is admin OR viewing their own resource
 * Use this for endpoints where users can view/edit their own data, but admins can view/edit any
 */
export const requireAdminOrOwner = (resourceUserIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const { role, id: userId } = req.user;

    // Admins and superadmins can access any resource
    if (role === 'admin' || role === 'superadmin') {
      return next();
    }

    // Regular users can only access their own resources
    // Check params, body, or query for the resource owner ID
    const resourceOwnerId =
      req.params[resourceUserIdField] ||
      req.body[resourceUserIdField] ||
      req.query[resourceUserIdField];

    if (resourceOwnerId && resourceOwnerId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

/**
 * Add admin flag to request for conditional logic
 */
export const checkAdminStatus = (req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    (req as any).isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    (req as any).isSuperAdmin = req.user.role === 'superadmin';
  } else {
    (req as any).isAdmin = false;
    (req as any).isSuperAdmin = false;
  }

  next();
};
