import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { apiKeyService } from '../services/APIKeyService';
import { db } from '../../db';
import { apiKeys } from '../../db/schema-pg';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { performanceService } from '../services/PerformanceService';

const router = Router();

// Helper to invalidate secrets cache
function invalidateSecretsCache(userId?: string) {
  const cache = performanceService.getCache();
  // Delete all cache entries containing /api/secrets
  const deleted = cache.deletePattern('/api/secrets');
  console.log(`[Cache] Invalidated ${deleted} secrets cache entries`);
}

/**
 * GET /api/secrets - Get all secrets for user (values are masked)
 * Now uses api_keys table via APIKeyService
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Get all API keys for user (user-wide only for secrets vault)
    const apiKeys = await apiKeyService.getapiKeys(userId, null);
    
    // Map to SecretsVault format
    const secrets = apiKeys.map(key => ({
      id: key.id.toString(),
      name: key.serviceName || key.keyName,
      key: key.keyName,
      value: '••••••••', // Masked
      type: key.keyType || 'api_key',
      service: key.serviceName?.toLowerCase() || 'custom',
      lastUsed: key.lastUsed ? new Date(key.lastUsed) : undefined,
    }));
    
    res.json({ secrets });
  } catch (error) {
    console.error('Error fetching secrets:', error);
    res.status(500).json({ error: 'Failed to fetch secrets' });
  }
});

/**
 * GET /api/secrets/:id - Get a specific secret (with actual value)
 * Now uses api_keys table via APIKeyService
 */
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const secretId = req.params.id;
    
    // Get API key directly from database
    const result = await db
      .select({
        id: apiKeys.id,
        encryptedKey: apiKeys.encryptedKey,
        serviceName: apiKeys.serviceName,
        name: apiKeys.name,
        keyType: apiKeys.keyType,
      })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, secretId),
          eq(apiKeys.userId, userId),
          eq(apiKeys.isActive, true),
          isNull(apiKeys.projectId) // Only user-wide secrets
        )
      )
      .limit(1);
    
    if (result.length === 0 || !result[0].encryptedKey) {
      return res.status(404).json({ error: 'Secret not found' });
    }
    
    const apiKey = result[0];
    
    // Decrypt the value using same method as APIKeyService
    const encryptionKey = process.env.API_KEY_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    const algorithm = 'aes-256-cbc';
    const keyHash = crypto.createHash('sha256').update(encryptionKey).digest();
    
    let decryptedValue: string;
    try {
      if (apiKey.encryptedKey.includes(':')) {
        const parts = apiKey.encryptedKey.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv(algorithm, keyHash, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        decryptedValue = decrypted;
      } else {
        // Fallback for old format
        const decipher = crypto.createDecipher(algorithm, encryptionKey);
        let decrypted = decipher.update(apiKey.encryptedKey, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        decryptedValue = decrypted;
      }
    } catch (error) {
      console.error('Decryption failed:', error);
      return res.status(500).json({ error: 'Failed to decrypt secret' });
    }
    
    // Update lastUsed
    await db
      .update(apiKeys)
      .set({ lastUsed: new Date() })
      .where(eq(apiKeys.id, secretId));
    
    res.json({
      id: apiKey.id,
      name: apiKey.serviceName || apiKey.name,
      key: apiKey.name,
      value: decryptedValue,
      type: apiKey.keyType || 'api_key',
      service: apiKey.serviceName?.toLowerCase() || 'custom',
    });
  } catch (error) {
    console.error('Error fetching secret:', error);
    res.status(500).json({ error: 'Failed to fetch secret' });
  }
});

/**
 * POST /api/secrets - Create a new secret
 * Now uses api_keys table via APIKeyService
 */
router.post('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, key, value, type, service } = req.body;
    
    if (!name || !key || !value) {
      return res.status(400).json({ error: 'Name, key, and value are required' });
    }
    
    // Store using APIKeyService
    const apiKey = await apiKeyService.storeAPIKey(
      userId,
      service || name, // serviceName
      key, // keyName
      value, // keyValue
      (type || 'api_key') as 'api_key' | 'secret' | 'token' | 'password',
      undefined, // description
      undefined, // website
      null // projectId (null = user-wide)
    );
    
    res.status(201).json({
      id: apiKey.id.toString(),
      name: apiKey.serviceName || name,
      key: apiKey.keyName,
      type: apiKey.keyType,
      service: apiKey.serviceName?.toLowerCase() || service || 'custom',
      message: 'Secret stored securely',
    });
  } catch (error) {
    console.error('Error creating secret:', error);
    res.status(500).json({ error: 'Failed to create secret' });
  }
});

/**
 * DELETE /api/secrets/:id - Delete a secret
 * Now uses api_keys table via APIKeyService
 */
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const secretId = req.params.id;
    
    // Get all user's API keys to find the one with matching ID
    const apiKeys = await apiKeyService.getapiKeys(userId, null);
    const apiKey = apiKeys.find(k => k.id.toString() === secretId);
    
    if (!apiKey) {
      return res.status(404).json({ error: 'Secret not found' });
    }
    
    // Delete using APIKeyService
    const deleted = await apiKeyService.deleteAPIKey(userId, secretId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Secret not found or could not be deleted' });
    }
    
    // Invalidate secrets cache so GET requests return fresh data
    invalidateSecretsCache(userId);
    
    res.json({ message: 'Secret deleted' });
  } catch (error) {
    console.error('Error deleting secret:', error);
    res.status(500).json({ error: 'Failed to delete secret' });
  }
});

/**
 * POST /api/secrets/use/:id - Get secret value for use (increments usage counter)
 * Now uses api_keys table via APIKeyService
 */
router.post('/use/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const secretId = req.params.id;
    
    // Get API key directly from database
    const result = await db
      .select({
        id: apiKeys.id,
        encryptedKey: apiKeys.encryptedKey,
        name: apiKeys.name,
      })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, secretId),
          eq(apiKeys.userId, userId),
          eq(apiKeys.isActive, true),
          isNull(apiKeys.projectId) // Only user-wide secrets
        )
      )
      .limit(1);
    
    if (result.length === 0 || !result[0].encryptedKey) {
      return res.status(404).json({ error: 'Secret not found' });
    }
    
    const apiKey = result[0];
    
    // Decrypt the value using same method as APIKeyService
    const encryptionKey = process.env.API_KEY_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    const algorithm = 'aes-256-cbc';
    const keyHash = crypto.createHash('sha256').update(encryptionKey).digest();
    
    let decryptedValue: string;
    try {
      if (apiKey.encryptedKey.includes(':')) {
        const parts = apiKey.encryptedKey.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv(algorithm, keyHash, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        decryptedValue = decrypted;
      } else {
        // Fallback for old format
        const decipher = crypto.createDecipher(algorithm, encryptionKey);
        let decrypted = decipher.update(apiKey.encryptedKey, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        decryptedValue = decrypted;
      }
    } catch (error) {
      console.error('Decryption failed:', error);
      return res.status(500).json({ error: 'Failed to decrypt secret' });
    }
    
    // Update lastUsed
    await db
      .update(apiKeys)
      .set({ lastUsed: new Date() })
      .where(eq(apiKeys.id, secretId));
    
    res.json({
      key: apiKey.name,
      value: decryptedValue,
    });
  } catch (error) {
    console.error('Error using secret:', error);
    res.status(500).json({ error: 'Failed to use secret' });
  }
});

export default router;

