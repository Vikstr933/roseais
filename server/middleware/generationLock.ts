import { Request, Response, NextFunction } from 'express';
import { generationLockService } from '../services/GenerationLockService';
import { projectMembers } from '../../db/schema';
import { db } from '../../db';
import { eq, and } from 'drizzle-orm';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    displayName: string;
  };
}

/**
 * Middleware to check if generation is allowed for a project
 */
export const checkGenerationLock = (
  lockType: 'component_generation' | 'agent_generation' | 'code_generation'
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const projectId = parseInt(req.params.id || req.body.projectId);
      const userId = req.user?.id;

      if (!projectId || !userId) {
        return res.status(400).json({
          error: 'Project ID and user authentication required',
        });
      }

      // Check if user has access to the project
      const [member] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, userId),
            eq(projectMembers.isActive, 1)
          )
        )
        .limit(1);

      if (!member) {
        return res.status(403).json({
          error: 'Access denied to project',
        });
      }

      // Check if generation is allowed
      const canStart = await generationLockService.canStartGeneration(
        projectId,
        userId,
        lockType
      );

      if (!canStart.canStart) {
        return res.status(409).json({
          error: 'Generation in progress',
          message: canStart.reason,
          existingLock: canStart.existingLock,
          lockType,
        });
      }

      // Store project info for later use
      req.projectId = projectId;
      next();
    } catch (error) {
      console.error('Error in generation lock middleware:', error);
      res.status(500).json({
        error: 'Failed to check generation status',
      });
    }
  };
};

/**
 * Middleware to create a generation lock
 */
export const createGenerationLock = (
  lockType: 'component_generation' | 'agent_generation' | 'code_generation'
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const projectId =
        req.projectId || parseInt(req.params.id || req.body.projectId);
      const userId = req.user?.id;
      const sessionId = req.body.sessionId;

      if (!projectId || !userId) {
        return res.status(400).json({
          error: 'Project ID and user authentication required',
        });
      }

      // Create the lock
      const lockResult = await generationLockService.createLock({
        projectId,
        userId,
        lockType,
        sessionId,
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          endpoint: req.path,
          method: req.method,
        },
      });

      if (!lockResult.success) {
        return res.status(409).json({
          error: 'Generation in progress',
          message: lockResult.error,
          existingLock: lockResult.existingLock,
          lockType,
        });
      }

      // Store lock info for cleanup
      req.generationLock = lockResult.lock;
      next();
    } catch (error) {
      console.error('Error creating generation lock:', error);
      res.status(500).json({
        error: 'Failed to create generation lock',
      });
    }
  };
};

/**
 * Middleware to release a generation lock
 */
export const releaseGenerationLock = (
  status: 'completed' | 'failed' = 'completed'
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (req.generationLock) {
        await generationLockService.releaseLock(req.generationLock.id, status);
        console.log(
          `Released generation lock ${req.generationLock.id} with status ${status}`
        );
      }
      next();
    } catch (error) {
      console.error('Error releasing generation lock:', error);
      // Don't fail the request if lock release fails
      next();
    }
  };
};

/**
 * Express middleware to handle generation lock cleanup on response end
 */
export const handleGenerationLockCleanup = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const originalEnd = res.end;

  res.end = function (chunk?: any, encoding?: any) {
    // Release lock when response ends
    if (req.generationLock) {
      const status =
        res.statusCode >= 200 && res.statusCode < 300 ? 'completed' : 'failed';
      generationLockService
        .releaseLock(req.generationLock.id, status)
        .catch(error => {
          console.error('Error releasing lock on response end:', error);
        });
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Extend Request interface to include our custom properties
declare global {
  namespace Express {
    interface Request {
      projectId?: number;
      generationLock?: any;
    }
  }
}
