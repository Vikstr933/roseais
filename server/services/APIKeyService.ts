import { db } from '../../db';
import {
  users,
  sessions,
  apiKeys,
  workspaces,
} from '../../db/schema-pg';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Type definitions
type APIKey = {
  id: number;
  userId: string;
  serviceName: string;
  keyName: string;
  encryptedKey: string;
  keyType: string;
  description?: string | null;
  website?: string | null;
  lastUsed?: string | null;
  usageCount: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

// User Service - Comprehensive user management with API keys
export class UserService {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey =
      process.env.ENCRYPTION_KEY ||
      'default-encryption-key-change-in-production';
  }

  // User Management
  async createUser(userData: {
    username: string;
    email: string;
    displayName: string;
    password: string;
  }) {
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(userData.password, 12);

    const newUser = {
      id: userId,
      username: userData.username,
      email: userData.email,
      displayName: userData.displayName,
      passwordHash,
      preferences: JSON.stringify({
        theme: 'light',
        autoSave: true,
        defaultLanguage: 'typescript',
      }),
    };

    await db.insert(users).values(newUser);
    return newUser;
  }

  async getUserById(userId: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return result[0] || null;
  }

  async getUserByUsername(username: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return result[0] || null;
  }

  async getUserByEmail(email: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0] || null;
  }

  async verifyPassword(user: any, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.passwordHash);
  }

  async updateUserLastActive(userId: string) {
    await db
      .update(users)
      .set({ lastActive: new Date() })  // Fixed: Drizzle expects Date object, not string
      .where(eq(users.id, userId));
  }

  // Session Management
  async createSession(userId: string, ipAddress?: string, userAgent?: string) {
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ); // 7 days

    const newSession = {
      id: sessionId,
      userId,
      expiresAt,
    };

    await db.insert(sessions as any).values(newSession);
    return { sessionId, sessionToken: sessionId, expiresAt: expiresAt.toISOString() };
  }

  async getSessionByToken(sessionToken: string) {
    const { retryDbOperation } = await import('../utils/dbRetry');
    return await retryDbOperation(async () => {
      const result = await db
        .select()
        .from(sessions as any)
        .where(eq((sessions as any).id, sessionToken))
        .limit(1);

      return result[0] || null;
    });
  }

  async getUserFromSession(sessionToken: string) {
    const { retryDbOperation } = await import('../utils/dbRetry');
    return await retryDbOperation(async () => {
      const session = await this.getSessionByToken(sessionToken);
      if (!session) return null;

      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        await this.invalidateSession(sessionToken);
        return null;
      }

      return await this.getUserById(session.userId);
    });
  }

  async invalidateSession(sessionToken: string) {
    await db
      .delete(sessions as any)
      .where(eq((sessions as any).id, sessionToken));
  }

  async invalidateAllUserSessions(userId: string) {
    await db
      .delete(sessions as any)
      .where(eq((sessions as any).userId, userId));
  }

  // API Key Management
  private encryptKey(key: string): string {
    const algorithm = 'aes-256-cbc';
    const keyHash = crypto
      .createHash('sha256')
      .update(this.encryptionKey)
      .digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, keyHash, iv);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptKey(encryptedKey: string): string {
    const algorithm = 'aes-256-cbc';
    const keyHash = crypto
      .createHash('sha256')
      .update(this.encryptionKey)
      .digest();

    // Check if it's the new format with IV
    if (encryptedKey.includes(':')) {
      const parts = encryptedKey.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, keyHash, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } else {
      // Backward compatibility with old format (deprecated)
      const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
      let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
  }

  async addAPIKey(
    userId: string,
    keyData: {
      serviceName: string;
      keyName: string;
      keyValue: string;
      keyType: 'api_key' | 'secret' | 'token' | 'password';
      description?: string;
      website?: string;
    }
  ) {
    // Note: apiKeys table has: id (text), userId (text), keyHash (text), name (text), isActive (boolean)
    // We need to adapt to this schema
    const keyHash = crypto.createHash('sha256').update(keyData.keyValue).digest('hex');
    const id = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const name = keyData.serviceName || keyData.keyName || 'API Key';

    const newAPIKey = {
      id,
      userId,
      keyHash,
      name,
      isActive: true,
    };

    await db.insert(apiKeys).values(newAPIKey);
    return { ...newAPIKey, serviceName: keyData.serviceName, keyName: keyData.keyName };
  }


  async getAPIKey(userId: string, serviceName: string) {
    // Note: apiKeys table uses 'name' field, not 'serviceName'
    const result = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.userId, userId),
          eq(apiKeys.name, serviceName), // Use name field to match serviceName
          eq(apiKeys.isActive, true)
        )
      )
      .limit(1);

    if (result.length === 0) return null;

    const key = result[0];

    // Update lastUsed (usageCount doesn't exist in schema)
    await db
      .update(apiKeys)
      .set({
        lastUsed: new Date(),
      })
      .where(eq(apiKeys.id, key.id));

    // Note: We can't decrypt keyHash back to the original value
    // This method needs to be refactored to use a different table or approach
    console.warn('getAPIKey: Cannot retrieve key value from keyHash. Schema limitation.');
    return null;
  }

  async removeAPIKey(userId: string, keyId: string) {
    // Note: apiKeys.id is text, not number
    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));
  }

  async getMissingAPIKeys(
    userId: string,
    requiredServices: string[]
  ): Promise<string[]> {
    const userKeys = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)));

    // Use 'name' field instead of 'serviceName'
    const userServiceNames = userKeys.map(key => key.name || '');
    return requiredServices.filter(
      service => !userServiceNames.includes(service)
    );
  }

  // Workspace Management
  // Note: This method is deprecated - workspaces should be managed through ProjectService
  async addUserWorkspace(
    userId: string,
    workspaceData: {
      workspaceName: string;
      componentName: string;
      workspacePath: string;
      metadata?: any;
    }
  ) {
    // Note: workspaces table has: name, ownerId (not userId), status, etc.
    // This method needs to be refactored to use the correct schema
    console.warn('addUserWorkspace: This method is deprecated. Use ProjectService instead.');
    throw new Error('addUserWorkspace is deprecated. Use ProjectService to manage workspaces.');
  }

  async getworkspaces(userId: string) {
    // Note: workspaces table uses ownerId, not userId; no lastModified field
    const result = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.ownerId, userId), // Use ownerId instead of userId
          eq(workspaces.status, 'active')
        )
      )
      .orderBy(desc(workspaces.updatedAt)); // Use updatedAt instead of lastModified

    return result.map(workspace => ({
      ...workspace,
      // metadata field doesn't exist in workspaces schema
    }));
  }

  async updateWorkspaceStatus(
    userId: string,
    workspaceId: number,
    status: 'active' | 'archived' | 'deleted'
  ) {
    // Note: workspaces table uses ownerId, not userId; no lastModified field
    await db
      .update(workspaces)
      .set({
        status,
        updatedAt: new Date(), // Use updatedAt instead of lastModified
      })
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.ownerId, userId) // Use ownerId instead of userId
        )
      );
  }

  // Cleanup methods
  async cleanupExpiredSessions() {
    // Note: Use 'sessions' table, not 'userSessions'
    const now = new Date();
    // Note: sessions table structure may differ - this method may need refactoring
    console.warn('cleanupExpiredSessions: This method may need refactoring for the sessions table schema.');
    // This method is not implemented as sessions table structure is unclear
  }
}

export const userService = new UserService();

export interface APIKeyRequest {
  serviceName: string;
  keyName: string;
  keyType: 'api_key' | 'secret' | 'token' | 'password';
  description?: string;
  website?: string;
  requiredFor: string; // What the key is needed for
  promptMessage: string; // Message to show user when requesting key
}

export class APIKeyService {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey =
      process.env.API_KEY_ENCRYPTION_KEY ||
      'default-encryption-key-change-in-production';
  }

  /**
   * Get all API keys for user (without values)
   * @param projectId - Optional: null = user-wide only, number = project-specific only, undefined = all keys
   */
  async getapiKeys(userId: string, projectId?: number | null): Promise<Omit<APIKey, 'encryptedKey'>[]> {
    const conditions = [
      eq(apiKeys.userId, userId),
      eq(apiKeys.isActive, true)
    ];

    // Filter by project if specified
    if (projectId !== undefined) {
      if (projectId === null) {
        // Only user-wide keys (projectId IS NULL)
        conditions.push(isNull(apiKeys.projectId));
      } else {
        // Only project-specific keys for this project
        conditions.push(eq(apiKeys.projectId, projectId));
      }
    }

    const result = await db
      .select({
        id: apiKeys.id,
        userId: apiKeys.userId,
        projectId: apiKeys.projectId,
        name: apiKeys.name,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
        lastUsed: apiKeys.lastUsed,
      })
      .from(apiKeys)
      .where(and(...conditions))
      .orderBy(desc(apiKeys.createdAt));

    // Map to expected format (with defaults for missing fields)
    return result.map(key => ({
      id: parseInt(key.id) || 0, // Convert text id to number if possible
      userId: key.userId,
      projectId: key.projectId || undefined, // Include projectId if set
      serviceName: key.name || 'unknown', // Use name as serviceName
      keyName: key.name || 'default', // Use name as keyName
      keyType: 'api_key' as const,
      description: null,
      website: null,
      isActive: key.isActive ? 1 : 0, // Convert boolean to number
      createdAt: key.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: key.createdAt?.toISOString() || new Date().toISOString(),
      lastUsed: key.lastUsed?.toISOString() || null,
      usageCount: 0, // Not available in current schema
    }));
  }

  /**
   * Encrypt API key
   */
  private encryptKey(key: string): string {
    const algorithm = 'aes-256-cbc';
    const keyHash = crypto
      .createHash('sha256')
      .update(this.encryptionKey)
      .digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, keyHash, iv);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt API key
   */
  private decryptKey(encryptedKey: string): string {
    const algorithm = 'aes-256-cbc';
    const keyHash = crypto
      .createHash('sha256')
      .update(this.encryptionKey)
      .digest();

    // Check if it's the new format with IV
    if (encryptedKey.includes(':')) {
      const parts = encryptedKey.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, keyHash, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } else {
      // Backward compatibility with old format (deprecated)
      const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
      let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
  }

  /**
   * Store API key for user
   */
  async storeAPIKey(
    userId: string,
    serviceName: string,
    keyName: string,
    keyValue: string,
    keyType: 'api_key' | 'secret' | 'token' | 'password',
    description?: string,
    website?: string,
    projectId?: number | null // null = user-wide, number = project-specific
  ): Promise<APIKey> {
    try {
      const encryptedKey = this.encryptKey(keyValue);
      const now = new Date().toISOString();

      // Note: apiKeys table schema: id (text), userId (text), keyHash (text), name (text), isActive (boolean)
      const keyHash = crypto.createHash('sha256').update(keyValue).digest('hex');
      const id = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const name = serviceName || keyName || 'API Key';

      const result = await db
        .insert(apiKeys)
        .values({
          id,
          userId,
          projectId: projectId || null, // null = user-wide, number = project-specific
          keyHash,
          name,
          isActive: true,
        })
        .returning();

      console.log(`Stored API key for user ${userId}, service: ${serviceName}`);
      // Map result to expected APIKey type format
      const apiKey = result[0];
      return {
        id: parseInt(apiKey.id) || 0, // Convert text id to number for compatibility
        userId: apiKey.userId,
        serviceName: apiKey.name || serviceName,
        keyName: apiKey.name || keyName,
        encryptedKey: '', // Cannot store encrypted key in current schema
        keyType: keyType || 'api_key',
        description: description || null,
        website: website || null,
        isActive: apiKey.isActive ? 1 : 0,
        createdAt: apiKey.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: apiKey.createdAt?.toISOString() || new Date().toISOString(),
        lastUsed: apiKey.lastUsed?.toISOString() || null,
        usageCount: 0, // Not available in schema
      };
    } catch (error) {
      console.error('Error storing API key:', error);
      throw new Error('Failed to store API key');
    }
  }

  /**
   * Get API key for user (decrypted)
   */
  async getAPIKey(
    userId: string,
    serviceName: string,
    keyName: string
  ): Promise<string | null> {
    try {
      // Note: apiKeys table doesn't have serviceName/keyName/encryptedKey fields
      // It has: id, userId, keyHash, name
      // For now, match by name field
      const result = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.userId, userId),
            eq(apiKeys.name, serviceName), // Use name field to match serviceName
            eq(apiKeys.isActive, true)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      // The apiKeys table stores keyHash, not encryptedKey
      // We can't decrypt it without the original key value
      // Return null for now - this needs to be refactored to use the correct table
      console.warn(`getAPIKey: apiKeys table structure doesn't support decryption. serviceName: ${serviceName}, keyName: ${keyName}`);
      return null;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  /**
   * Get all API keys for user (without values)
   * Alias for getUserAPIKeys for consistency
   */
  async getUserAPIKeys(
    userId: string,
    projectId?: number | null
  ): Promise<Omit<APIKey, 'encryptedKey'>[]> {
    return this.getapiKeys(userId, projectId);
  }


  /**
   * Check if user has required API keys for a service
   */
  async checkRequiredAPIKeys(
    userId: string,
    requiredKeys: APIKeyRequest[],
    projectId?: number | null // Optional: check project-specific keys first, then fall back to user-wide
  ): Promise<{
    hasAllKeys: boolean;
    missingKeys: APIKeyRequest[];
    existingKeys: string[];
  }> {
    try {
      // Get all relevant keys: project-specific first (if projectId provided), then user-wide
      let allKeys: Omit<APIKey, 'encryptedKey'>[] = [];
      
      if (projectId !== undefined && projectId !== null) {
        // Get project-specific keys
        const projectKeys = await this.getapiKeys(userId, projectId);
        allKeys.push(...projectKeys);
      }
      
      // Get user-wide keys (projectId IS NULL)
      const userWideKeys = await this.getapiKeys(userId, null);
      allKeys.push(...userWideKeys);
      
      // Remove duplicates (same serviceName:keyName combination)
      const uniqueKeys = Array.from(
        new Map(
          allKeys.map((key: Omit<APIKey, 'encryptedKey'>) => [`${key.serviceName}:${key.keyName}`, key])
        ).values()
      );
      
      const existingKeyNames = uniqueKeys.map(
        key => `${key.serviceName}:${key.keyName}`
      );

      const missingKeys: APIKeyRequest[] = [];

      for (const requiredKey of requiredKeys) {
        const keyIdentifier = `${requiredKey.serviceName}:${requiredKey.keyName}`;
        if (!existingKeyNames.includes(keyIdentifier)) {
          missingKeys.push(requiredKey);
        }
      }

      return {
        hasAllKeys: missingKeys.length === 0,
        missingKeys,
        existingKeys: existingKeyNames,
      };
    } catch (error) {
      console.error('Error checking required API keys:', error);
      return {
        hasAllKeys: false,
        missingKeys: requiredKeys,
        existingKeys: [],
      };
    }
  }

  /**
   * Update API key usage statistics
   */
  private async updateUsageStats(keyId: string): Promise<void> {
    try {
      // Note: apiKeys table doesn't have usageCount or updatedAt fields
      await db
        .update(apiKeys)
        .set({
          lastUsed: new Date(),
        })
        .where(eq(apiKeys.id, keyId));
    } catch (error) {
      console.error('Error updating usage stats:', error);
    }
  }

  /**
   * Delete API key
   */
  async deleteAPIKey(userId: string, keyId: string): Promise<boolean> {
    try {
      // Note: apiKeys.id is text, not number
      const result = await db
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error('Error deleting API key:', error);
      return false;
    }
  }

  /**
   * Deactivate API key
   */
  async deactivateAPIKey(userId: string, keyId: string): Promise<boolean> {
    try {
      // Note: apiKeys.id is text, not number; isActive is boolean, not integer; no updatedAt field
      const result = await db
        .update(apiKeys)
        .set({
          isActive: false,
        })
        .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error('Error deactivating API key:', error);
      return false;
    }
  }

  /**
   * Get predefined API key requirements for common services
   */
  getCommonAPIKeyRequirements(): Record<string, APIKeyRequest[]> {
    return {
      openai: [
        {
          serviceName: 'openai',
          keyName: 'api_key',
          keyType: 'api_key',
          description: 'OpenAI API key for GPT models',
          website: 'https://platform.openai.com/api-keys',
          requiredFor: 'AI text generation and chat functionality',
          promptMessage:
            'To use AI features, you need an OpenAI API key. Please provide your OpenAI API key:',
        },
      ],
      anthropic: [
        {
          serviceName: 'anthropic',
          keyName: 'api_key',
          keyType: 'api_key',
          description: 'Anthropic API key for Claude models',
          website: 'https://console.anthropic.com/',
          requiredFor: 'Claude AI model access',
          promptMessage:
            'To use Claude AI features, you need an Anthropic API key. Please provide your Anthropic API key:',
        },
      ],
      huggingface: [
        {
          serviceName: 'huggingface',
          keyName: 'api_token',
          keyType: 'token',
          description: 'Hugging Face API token',
          website: 'https://huggingface.co/settings/tokens',
          requiredFor: 'Access to Hugging Face models and datasets',
          promptMessage:
            'To use Hugging Face models, you need an API token. Please provide your Hugging Face API token:',
        },
      ],
      github: [
        {
          serviceName: 'github',
          keyName: 'personal_access_token',
          keyType: 'token',
          description: 'GitHub Personal Access Token',
          website: 'https://github.com/settings/tokens',
          requiredFor: 'Access to private repositories and higher rate limits',
          promptMessage:
            'To access GitHub repositories, you need a Personal Access Token. Please provide your GitHub token:',
        },
      ],
      stripe: [
        {
          serviceName: 'stripe',
          keyName: 'secret_key',
          keyType: 'secret',
          description: 'Stripe Secret Key for payments',
          website: 'https://dashboard.stripe.com/apikeys',
          requiredFor: 'Payment processing functionality',
          promptMessage:
            'To enable payment features, you need a Stripe Secret Key. Please provide your Stripe secret key:',
        },
      ],
    };
  }

  /**
   * Analyze prompt to determine required API keys
   */
  analyzePromptForAPIKeys(prompt: string): APIKeyRequest[] {
    const promptLower = prompt.toLowerCase();
    const requirements: APIKeyRequest[] = [];
    const commonRequirements = this.getCommonAPIKeyRequirements();

    // Check for AI/LLM usage
    if (
      promptLower.includes('ai') ||
      promptLower.includes('gpt') ||
      promptLower.includes('claude') ||
      promptLower.includes('generate') ||
      promptLower.includes('chat')
    ) {
      requirements.push(...commonRequirements.openai);
    }

    // Check for Anthropic/Claude specific
    if (promptLower.includes('claude') || promptLower.includes('anthropic')) {
      requirements.push(...commonRequirements.anthropic);
    }

    // Check for Hugging Face
    if (
      promptLower.includes('hugging face') ||
      promptLower.includes('transformers') ||
      promptLower.includes('huggingface')
    ) {
      requirements.push(...commonRequirements.huggingface);
    }

    // Check for GitHub integration
    if (
      promptLower.includes('github') ||
      promptLower.includes('repository') ||
      promptLower.includes('repo') ||
      promptLower.includes('git')
    ) {
      requirements.push(...commonRequirements.github);
    }

    // Check for payment processing
    if (
      promptLower.includes('payment') ||
      promptLower.includes('stripe') ||
      promptLower.includes('billing') ||
      promptLower.includes('subscription')
    ) {
      requirements.push(...commonRequirements.stripe);
    }

    return requirements;
  }

  /**
   * Check if user has a specific API key
   * Checks project-specific keys first, then falls back to user-wide keys
   */
  async hasAPIKey(userId: string, serviceName: string, projectId?: number | null): Promise<boolean> {
    try {
      // First check project-specific keys if projectId is provided
      if (projectId !== undefined && projectId !== null) {
        const projectKeys = await this.getapiKeys(userId, projectId);
        const serviceNameLower = serviceName.toLowerCase().replace(/_api_key$/, '').replace(/_/g, '');
        
        const hasProjectKey = projectKeys.some((key: Omit<APIKey, 'encryptedKey'>) => {
          const keyServiceLower = key.serviceName.toLowerCase().replace(/_/g, '');
          return keyServiceLower === serviceNameLower || 
                 keyServiceLower.includes(serviceNameLower) ||
                 serviceNameLower.includes(keyServiceLower);
        });
        
        if (hasProjectKey) return true;
      }
      
      // Fall back to user-wide keys
      const userKeys = await this.getapiKeys(userId, null); // null = user-wide only
      // Check if user has a key for this service
      // serviceName format might be "OPENAI_API_KEY" or "openai" or "OPENAI"
      const serviceNameLower = serviceName.toLowerCase().replace(/_api_key$/, '').replace(/_/g, '');
      
      return userKeys.some((key: Omit<APIKey, 'encryptedKey'>) => {
        const keyServiceLower = key.serviceName.toLowerCase().replace(/_/g, '');
        return keyServiceLower === serviceNameLower || 
               keyServiceLower.includes(serviceNameLower) ||
               serviceNameLower.includes(keyServiceLower);
      });
    } catch (error) {
      console.error('Error checking API key:', error);
      return false;
    }
  }
}

export const apiKeyService = new APIKeyService();
export default apiKeyService;
