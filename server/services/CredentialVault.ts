import crypto from 'crypto';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('CredentialVault');

/**
 * CredentialVault
 *
 * Secure storage for user credentials with AES-256-GCM encryption.
 * Supports API keys, OAuth tokens, and custom credentials.
 */
export class CredentialVault {
  private algorithm = 'aes-256-gcm';
  private encryptionKey: Buffer;

  constructor() {
    const key = process.env.CREDENTIAL_ENCRYPTION_KEY || this.generateDefaultKey();

    if (!process.env.CREDENTIAL_ENCRYPTION_KEY) {
      logger.warn('CREDENTIAL_ENCRYPTION_KEY not set, using default key. This is insecure for production!');
    }

    // Ensure key is 32 bytes for AES-256
    this.encryptionKey = Buffer.from(key.padEnd(32, '0').substring(0, 32));
  }

  /**
   * Encrypt credentials
   */
  encrypt(credentials: Record<string, any>): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv) as crypto.CipherGCM;

      const jsonString = JSON.stringify(credentials);
      let encrypted = cipher.update(jsonString, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Return format: iv:authTag:encryptedData
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('Encryption failed', error as Error);
      throw new Error('Failed to encrypt credentials');
    }
  }

  /**
   * Decrypt credentials
   */
  decrypt(encryptedData: string): Record<string, any> {
    try {
      // Validate input
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error(`Invalid encrypted data: expected string, got ${typeof encryptedData}`);
      }

      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Decryption failed', error as Error);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Validate credential structure based on service type
   */
  validateCredentials(serviceName: string, credentials: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const schemas: Record<string, { required: string[]; optional?: string[] }> = {
      discord: {
        required: ['clientId', 'clientSecret'],
        optional: ['botToken'],
      },
      slack: {
        required: ['clientId', 'clientSecret'],
        optional: ['botToken'],
      },
      trello: {
        required: ['apiKey', 'apiToken'],
      },
      notion: {
        required: ['apiKey'],
      },
      github: {
        required: ['clientId', 'clientSecret'],
        optional: ['personalAccessToken'],
      },
      gitlab: {
        required: ['personalAccessToken'],
      },
      linear: {
        required: ['apiKey'],
      },
      asana: {
        required: ['personalAccessToken'],
      },
      todoist: {
        required: ['apiToken'],
      },
      custom: {
        required: [], // Custom services can have any structure
      },
    };

    const schema = schemas[serviceName.toLowerCase()] || schemas.custom;

    // Check required fields
    for (const field of schema.required) {
      if (!credentials[field] || credentials[field].trim() === '') {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate field formats
    if (credentials.apiKey && credentials.apiKey.length < 10) {
      errors.push('API key appears to be too short');
    }

    if (credentials.clientId && credentials.clientId.length < 10) {
      errors.push('Client ID appears to be too short');
    }

    if (credentials.clientSecret && credentials.clientSecret.length < 10) {
      errors.push('Client Secret appears to be too short');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a default encryption key (insecure, only for development)
   */
  private generateDefaultKey(): string {
    return 'default-encryption-key-change-in-production';
  }

  /**
   * Hash credential for comparison (for detecting duplicate credentials)
   */
  hashCredential(credential: string): string {
    return crypto
      .createHash('sha256')
      .update(credential)
      .digest('hex');
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Mask sensitive credential for display
   */
  maskCredential(credential: string, visibleChars: number = 4): string {
    if (credential.length <= visibleChars * 2) {
      return '*'.repeat(credential.length);
    }

    const start = credential.substring(0, visibleChars);
    const end = credential.substring(credential.length - visibleChars);
    const masked = '*'.repeat(credential.length - visibleChars * 2);

    return `${start}${masked}${end}`;
  }
}

// Singleton instance
let vaultInstance: CredentialVault | null = null;

export function getCredentialVault(): CredentialVault {
  if (!vaultInstance) {
    vaultInstance = new CredentialVault();
  }
  return vaultInstance;
}
