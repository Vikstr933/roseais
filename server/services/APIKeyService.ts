import { db } from '../../db';
import {
  users,
  sessions,
  apiKeys,
  workspaces,
} from '../../db/schema-pg';
import { eq, and, desc, sql } from 'drizzle-orm';
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
      .set({ lastActive: new Date().toISOString() })
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
    const result = await db
      .select()
      .from(sessions as any)
      .where(eq((sessions as any).id, sessionToken))
      .limit(1);

    return result[0] || null;
  }

  async getUserFromSession(sessionToken: string) {
    const session = await this.getSessionByToken(sessionToken);
    if (!session) return null;

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await this.invalidateSession(sessionToken);
      return null;
    }

    return await this.getUserById(session.userId);
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
    const encryptedKey = this.encryptKey(keyData.keyValue);

    const newAPIKey = {
      userId,
      serviceName: keyData.serviceName,
      keyName: keyData.keyName,
      encryptedKey,
      keyType: keyData.keyType,
      description: keyData.description,
      website: keyData.website,
    };

    await db.insert(apiKeys).values(newAPIKey);
    return newAPIKey;
  }

  async getapiKeys(userId: string) {
    const result = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, 1)))
      .orderBy(desc(apiKeys.createdAt));

    return result.map(key => ({
      ...key,
      keyValue: this.decryptKey(key.encryptedKey),
    }));
  }

  async getAPIKey(userId: string, serviceName: string) {
    const result = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.userId, userId),
          eq(apiKeys.serviceName, serviceName),
          eq(apiKeys.isActive, 1)
        )
      )
      .limit(1);

    if (result.length === 0) return null;

    const key = result[0];

    // Update usage stats
    await db
      .update(apiKeys)
      .set({
        lastUsed: new Date().toISOString(),
        usageCount: key.usageCount + 1,
      })
      .where(eq(apiKeys.id, key.id));

    return this.decryptKey(key.encryptedKey);
  }

  async removeAPIKey(userId: string, keyId: number) {
    await db
      .update(apiKeys)
      .set({ isActive: 0 })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));
  }

  async getMissingAPIKeys(
    userId: string,
    requiredServices: string[]
  ): Promise<string[]> {
    const userKeys = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, 1)));

    const userServiceNames = userKeys.map(key => key.serviceName);
    return requiredServices.filter(
      service => !userServiceNames.includes(service)
    );
  }

  // Workspace Management
  async addUserWorkspace(
    userId: string,
    workspaceData: {
      workspaceName: string;
      componentName: string;
      workspacePath: string;
      metadata?: any;
    }
  ) {
    const newWorkspace = {
      userId,
      workspaceName: workspaceData.workspaceName,
      componentName: workspaceData.componentName,
      workspacePath: workspaceData.workspacePath,
      metadata: JSON.stringify(workspaceData.metadata || {}),
    };

    await db.insert(workspaces).values(newWorkspace);
    return newWorkspace;
  }

  async getworkspaces(userId: string) {
    const result = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.userId, userId),
          eq(workspaces.status, 'active')
        )
      )
      .orderBy(desc(workspaces.lastModified));

    return result.map(workspace => ({
      ...workspace,
      metadata: JSON.parse(workspace.metadata),
    }));
  }

  async updateWorkspaceStatus(
    userId: string,
    workspaceId: number,
    status: 'active' | 'archived' | 'deleted'
  ) {
    await db
      .update(workspaces)
      .set({
        status,
        lastModified: new Date().toISOString(),
      })
      .where(
        and(
          eq(workspaces.id, workspaceId),
          eq(workspaces.userId, userId)
        )
      );
  }

  // Cleanup methods
  async cleanupExpiredSessions() {
    const now = new Date().toISOString();
    await db
      .update(userSessions)
      .set({ isActive: 0 })
      .where(eq(userSessions.expiresAt, now));
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
    website?: string
  ): Promise<APIKey> {
    try {
      const encryptedKey = this.encryptKey(keyValue);
      const now = new Date().toISOString();

      const result = await db
        .insert(apiKeys)
        .values({
          userId,
          serviceName,
          keyName,
          encryptedKey,
          keyType,
          description,
          website,
          isActive: 1,
          createdAt: now,
          updatedAt: now,
          usageCount: 0,
        })
        .returning();

      console.log(`Stored API key for user ${userId}, service: ${serviceName}`);
      return result[0];
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
      const result = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.userId, userId),
            eq(apiKeys.serviceName, serviceName),
            eq(apiKeys.keyName, keyName),
            eq(apiKeys.isActive, 1)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const apiKey = result[0];
      const decryptedKey = this.decryptKey(apiKey.encryptedKey);

      // Update usage statistics
      await this.updateUsageStats(apiKey.id);

      return decryptedKey;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  /**
   * Get all API keys for user (without values)
   */
  async getapiKeys(
    userId: string
  ): Promise<Omit<APIKey, 'encryptedKey'>[]> {
    try {
      const result = await db
        .select({
          id: apiKeys.id,
          userId: apiKeys.userId,
          serviceName: apiKeys.serviceName,
          keyName: apiKeys.keyName,
          keyType: apiKeys.keyType,
          description: apiKeys.description,
          website: apiKeys.website,
          isActive: apiKeys.isActive,
          createdAt: apiKeys.createdAt,
          updatedAt: apiKeys.updatedAt,
          lastUsed: apiKeys.lastUsed,
          usageCount: apiKeys.usageCount,
        })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));

      return result;
    } catch (error) {
      console.error('Error getting user API keys:', error);
      return [];
    }
  }

  /**
   * Check if user has required API keys for a service
   */
  async checkRequiredAPIKeys(
    userId: string,
    requiredKeys: APIKeyRequest[]
  ): Promise<{
    hasAllKeys: boolean;
    missingKeys: APIKeyRequest[];
    existingKeys: string[];
  }> {
    try {
      const userKeys = await this.getapiKeys(userId);
      const existingKeyNames = userKeys.map(
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
  private async updateUsageStats(keyId: number): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db
        .update(apiKeys)
        .set({
          lastUsed: now,
          usageCount: sql`usage_count + 1`,
          updatedAt: now,
        })
        .where(eq(apiKeys.id, keyId));
    } catch (error) {
      console.error('Error updating usage stats:', error);
    }
  }

  /**
   * Delete API key
   */
  async deleteAPIKey(userId: string, keyId: number): Promise<boolean> {
    try {
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
  async deactivateAPIKey(userId: string, keyId: number): Promise<boolean> {
    try {
      const result = await db
        .update(apiKeys)
        .set({
          isActive: 0,
          updatedAt: new Date().toISOString(),
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
}

export const apiKeyService = new APIKeyService();
