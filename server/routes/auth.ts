import { Router } from 'express';
import { userService } from '../services/APIKeyService';
import type { User } from '../../db/schema';

const router = Router();

// Authentication Routes
/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const logger = req.app.locals.logger;
    const { username, email, displayName, password } = req.body;

    await logger?.info('Auth', `User registration attempt`, {
      username,
      email,
      displayName,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });

    // Validate input
    if (!username || !email || !displayName || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = await userService.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const existingEmail = await userService.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Create user
    const user = (await userService.createUser({
      username,
      email,
      displayName,
      password,
    })) as User;

    // Create session
    const { sessionToken, expiresAt } = await userService.createSession(
      user.id,
      req.ip,
      req.get('User-Agent')
    );

    await logger?.info('Auth', `User registered successfully`, {
      userId: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role || 'user',
        createdAt: user.createdAt,
      },
      sessionToken,
      expiresAt,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: 'Username and password are required' });
    }

    // Find user by username or email
    let user = (await userService.getUserByUsername(username)) as User | null;
    if (!user) {
      user = (await userService.getUserByEmail(username)) as User | null;
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await userService.verifyPassword(user, password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last active
    await userService.updateUserLastActive(user.id);

    // Create session
    const { sessionToken, expiresAt } = await userService.createSession(
      user.id,
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role || 'user',
        createdAt: user.createdAt,
      },
      sessionToken,
      expiresAt,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (sessionToken) {
      await userService.invalidateSession(sessionToken);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    const user = (await userService.getUserFromSession(sessionToken)) as User | null;
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Parse preferences safely
    let preferences: any = user.preferences;
    if (typeof preferences === 'string') {
      try {
        preferences = JSON.parse(preferences);
      } catch (e) {
        preferences = {};
      }
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role || 'user',
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        preferences: preferences,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export default router;
