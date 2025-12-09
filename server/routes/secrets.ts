import { Router } from 'express';
import { db } from '../../db';
import { eq, and } from 'drizzle-orm';
import { authenticateUser } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// Simple encryption for secrets (in production, use a proper KMS)
const ENCRYPTION_KEY = process.env.SECRETS_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

// In-memory store (for production, use a database table)
interface UserSecret {
  id: string;
  name: string;
  key: string;
  encryptedValue: string;
  type: string;
  service?: string;
  createdAt: Date;
  lastUsed?: Date;
}

const userSecrets = new Map<string, UserSecret[]>();

/**
 * GET /api/secrets - Get all secrets for user (values are masked)
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const secrets = userSecrets.get(userId) || [];
    
    // Return secrets with masked values
    const maskedSecrets = secrets.map(s => ({
      id: s.id,
      name: s.name,
      key: s.key,
      value: '••••••••', // Masked
      type: s.type,
      service: s.service,
      lastUsed: s.lastUsed,
    }));
    
    res.json({ secrets: maskedSecrets });
  } catch (error) {
    console.error('Error fetching secrets:', error);
    res.status(500).json({ error: 'Failed to fetch secrets' });
  }
});

/**
 * GET /api/secrets/:id - Get a specific secret (with actual value)
 */
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const secretId = req.params.id;
    
    const secrets = userSecrets.get(userId) || [];
    const secret = secrets.find(s => s.id === secretId);
    
    if (!secret) {
      return res.status(404).json({ error: 'Secret not found' });
    }
    
    // Update last used
    secret.lastUsed = new Date();
    
    // Decrypt and return
    res.json({
      id: secret.id,
      name: secret.name,
      key: secret.key,
      value: decrypt(secret.encryptedValue),
      type: secret.type,
      service: secret.service,
    });
  } catch (error) {
    console.error('Error fetching secret:', error);
    res.status(500).json({ error: 'Failed to fetch secret' });
  }
});

/**
 * POST /api/secrets - Create a new secret
 */
router.post('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id, name, key, value, type, service } = req.body;
    
    if (!name || !key || !value) {
      return res.status(400).json({ error: 'Name, key, and value are required' });
    }
    
    const newSecret: UserSecret = {
      id: id || `secret-${Date.now()}`,
      name,
      key,
      encryptedValue: encrypt(value),
      type: type || 'api_key',
      service,
      createdAt: new Date(),
    };
    
    if (!userSecrets.has(userId)) {
      userSecrets.set(userId, []);
    }
    
    userSecrets.get(userId)!.push(newSecret);
    
    res.status(201).json({
      id: newSecret.id,
      name: newSecret.name,
      key: newSecret.key,
      type: newSecret.type,
      service: newSecret.service,
      message: 'Secret stored securely',
    });
  } catch (error) {
    console.error('Error creating secret:', error);
    res.status(500).json({ error: 'Failed to create secret' });
  }
});

/**
 * DELETE /api/secrets/:id - Delete a secret
 */
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const secretId = req.params.id;
    
    const secrets = userSecrets.get(userId) || [];
    const index = secrets.findIndex(s => s.id === secretId);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Secret not found' });
    }
    
    secrets.splice(index, 1);
    
    res.json({ message: 'Secret deleted' });
  } catch (error) {
    console.error('Error deleting secret:', error);
    res.status(500).json({ error: 'Failed to delete secret' });
  }
});

/**
 * POST /api/secrets/use/:id - Get secret value for use (increments usage counter)
 */
router.post('/use/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const secretId = req.params.id;
    
    const secrets = userSecrets.get(userId) || [];
    const secret = secrets.find(s => s.id === secretId);
    
    if (!secret) {
      return res.status(404).json({ error: 'Secret not found' });
    }
    
    secret.lastUsed = new Date();
    
    res.json({
      key: secret.key,
      value: decrypt(secret.encryptedValue),
    });
  } catch (error) {
    console.error('Error using secret:', error);
    res.status(500).json({ error: 'Failed to use secret' });
  }
});

export default router;

