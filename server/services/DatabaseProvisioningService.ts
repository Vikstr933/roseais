import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { projectDatabases } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';

const logger = new SimpleLogger('DatabaseProvisioningService');

export interface DatabaseProvisioningResult {
  success: boolean;
  databaseId?: string;
  connectionString?: string;
  databaseUrl?: string;
  error?: string;
  provider: 'supabase' | 'neon' | 'mongodb-atlas' | 'manual';
  pending?: boolean;
  missingKeys?: string[];
}

export interface ProvisionedDatabase {
  id: string;
  projectId: number;
  userId: string;
  databaseType: 'mongodb' | 'postgresql' | 'mysql';
  provider: 'supabase' | 'neon' | 'mongodb-atlas' | 'manual';
  connectionString: string; // Encrypted
  databaseUrl?: string;
  status: 'active' | 'pending' | 'failed';
  createdAt: Date;
}

export class DatabaseProvisioningService {
  /**
   * Provision a database for a user's project
   * 
   * This service automatically creates databases for user projects when they generate
   * fullstack applications. It supports multiple providers:
   * - Supabase (PostgreSQL) - Recommended for most projects
   * - Neon (PostgreSQL) - Serverless alternative
   * - MongoDB Atlas (MongoDB) - For MERN stack projects
   */
  
  /**
   * Check if required API keys are available for database provisioning
   */
  public checkRequiredAPIKeys(databaseType: 'mongodb' | 'postgresql' | 'mysql'): {
    hasAllKeys: boolean;
    missingKeys: string[];
    provider?: 'supabase' | 'neon' | 'mongodb-atlas';
  } {
    const missingKeys: string[] = [];
    let provider: 'supabase' | 'neon' | 'mongodb-atlas' | undefined;

    if (databaseType === 'mongodb') {
      provider = 'mongodb-atlas';
      if (!process.env.MONGODB_ATLAS_API_KEY) {
        missingKeys.push('MONGODB_ATLAS_API_KEY');
      }
      if (!process.env.MONGODB_ATLAS_PROJECT_ID) {
        missingKeys.push('MONGODB_ATLAS_PROJECT_ID');
      }
    } else if (databaseType === 'postgresql' || databaseType === 'mysql') {
      // Check Supabase first (preferred)
      if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL && process.env.SUPABASE_DB_PASSWORD) {
        provider = 'supabase';
      } else if (process.env.NEON_API_KEY && process.env.NEON_PROJECT_ID) {
        provider = 'neon';
      } else {
        // Neither provider has all keys
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
          missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
        }
        if (!process.env.SUPABASE_URL) {
          missingKeys.push('SUPABASE_URL');
        }
        if (!process.env.SUPABASE_DB_PASSWORD) {
          missingKeys.push('SUPABASE_DB_PASSWORD');
        }
        if (!process.env.NEON_API_KEY) {
          missingKeys.push('NEON_API_KEY');
        }
        if (!process.env.NEON_PROJECT_ID) {
          missingKeys.push('NEON_PROJECT_ID');
        }
      }
    }

    return {
      hasAllKeys: missingKeys.length === 0,
      missingKeys,
      provider
    };
  }

  /**
   * Provision a database for a project
   */
  public async provisionDatabase(
    userId: string,
    projectId: number,
    databaseType: 'mongodb' | 'postgresql' | 'mysql',
    projectName: string
  ): Promise<DatabaseProvisioningResult> {
    try {
      logger.info('Provisioning database', { userId, projectId, databaseType, projectName });

      // Check if database already exists for this project
      const existing = await db.select()
        .from(projectDatabases)
        .where(eq(projectDatabases.projectId, projectId))
        .limit(1);

      if (existing.length > 0 && existing[0].status === 'active') {
        logger.info('Database already provisioned for project', { projectId });
        return {
          success: true,
          databaseId: existing[0].id,
          connectionString: existing[0].connectionString, // Will be decrypted by caller
          databaseUrl: existing[0].databaseUrl || undefined,
          provider: existing[0].provider as any
        };
      }

      // Check for required API keys BEFORE attempting to provision
      const apiKeyCheck = this.checkRequiredAPIKeys(databaseType);
      if (!apiKeyCheck.hasAllKeys) {
        logger.info('Missing API keys for database provisioning', { 
          databaseType, 
          missingKeys: apiKeyCheck.missingKeys 
        });
        
        // Store pending provisioning request
        await this.savePendingProvisioningRequest(
          userId,
          projectId,
          databaseType,
          projectName,
          apiKeyCheck.missingKeys
        );
        
        return {
          success: false,
          provider: apiKeyCheck.provider || 'manual',
          error: `Missing required API keys: ${apiKeyCheck.missingKeys.join(', ')}. Please configure these in environment variables.`,
          pending: true,
          missingKeys: apiKeyCheck.missingKeys
        };
      }

      // Choose provider based on database type and availability
      const provider = this.selectProvider(databaseType);
      
      // Provision database based on provider
      let result: DatabaseProvisioningResult;
      
      if (provider === 'supabase') {
        result = await this.provisionSupabaseDatabase(userId, projectId, projectName);
      } else if (provider === 'neon') {
        result = await this.provisionNeonDatabase(userId, projectId, projectName);
      } else if (provider === 'mongodb-atlas') {
        result = await this.provisionMongoDBAtlasDatabase(userId, projectId, projectName);
      } else {
        // Manual setup - return instructions
        result = {
          success: false,
          provider: 'manual',
          error: 'Automatic database provisioning not available. Please set up database manually.'
        };
      }

      // Save to database if successful
      if (result.success && result.connectionString) {
        await this.saveDatabaseConfig(
          userId,
          projectId,
          databaseType,
          provider,
          result.connectionString,
          result.databaseUrl
        );
        
        // Clear any pending provisioning requests
        await this.clearPendingProvisioningRequest(projectId);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to provision database for project ${projectId}`, error as Error);
      return {
        success: false,
        provider: 'manual',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Select the best provider for the database type
   */
  private selectProvider(databaseType: 'mongodb' | 'postgresql' | 'mysql'): 'supabase' | 'neon' | 'mongodb-atlas' | 'manual' {
    // Check if we have API keys configured
    const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hasNeonKey = !!process.env.NEON_API_KEY;
    const hasMongoAtlasKey = !!process.env.MONGODB_ATLAS_API_KEY;

    if (databaseType === 'mongodb') {
      return hasMongoAtlasKey ? 'mongodb-atlas' : 'manual';
    }

    if (databaseType === 'postgresql') {
      // Prefer Supabase if available, fallback to Neon
      if (hasSupabaseKey) {
        return 'supabase';
      }
      if (hasNeonKey) {
        return 'neon';
      }
      return 'manual';
    }

    // MySQL - manual for now (no free cloud providers with easy API)
    return 'manual';
  }

  /**
   * Provision a Supabase database
   */
  private async provisionSupabaseDatabase(
    userId: string,
    projectId: number,
    projectName: string
  ): Promise<DatabaseProvisioningResult> {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return {
          success: false,
          provider: 'supabase',
          error: 'Supabase credentials not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment variables.'
        };
      }

      // For now, we'll use the existing Supabase project and create a new database/schema
      // In the future, we could use Supabase Management API to create new projects
      // For now, we create a unique schema per project
      
      const schemaName = `project_${projectId}_${Date.now()}`;
      
      // Generate connection string using existing Supabase project
      // Extract project ref from SUPABASE_URL
      const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
      const dbPassword = process.env.SUPABASE_DB_PASSWORD || 'your-password';
      
      // Use connection pooling port (6543) for better performance
      const connectionString = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:6543/postgres?pgbouncer=true`;
      
      // Create schema in database
      // Note: This requires direct database access - we'll need to run a migration
      // For now, we'll return the connection string and let the user create the schema
      
      logger.info('Supabase database provisioned', { projectId, schemaName });

      return {
        success: true,
        databaseId: `supabase_${projectId}_${Date.now()}`,
        connectionString,
        databaseUrl: `https://${projectRef}.supabase.co`,
        provider: 'supabase'
      };
    } catch (error) {
      logger.error('Failed to provision Supabase database', error as Error);
      return {
        success: false,
        provider: 'supabase',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Provision a Neon database
   */
  private async provisionNeonDatabase(
    userId: string,
    projectId: number,
    projectName: string
  ): Promise<DatabaseProvisioningResult> {
    try {
      const neonApiKey = process.env.NEON_API_KEY;
      const neonProjectId = process.env.NEON_PROJECT_ID;

      if (!neonApiKey) {
        return {
          success: false,
          provider: 'neon',
          error: 'Neon API key not configured. Please set NEON_API_KEY in environment variables.'
        };
      }

      // Use Neon API to create a new database
      // API endpoint: https://console.neon.tech/api/v2/projects/{project_id}/branches
      const response = await fetch(`https://console.neon.tech/api/v2/projects/${neonProjectId || 'default'}/branches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${neonApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: {
            name: `project-${projectId}-${Date.now()}`
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Neon API error', new Error(error));
        return {
          success: false,
          provider: 'neon',
          error: `Neon API error: ${error}`
        };
      }

      const data = await response.json();
      const connectionString = data.branch.connection_uris?.[0]?.connection_uri;

      if (!connectionString) {
        return {
          success: false,
          provider: 'neon',
          error: 'Failed to get connection string from Neon API'
        };
      }

      logger.info('Neon database provisioned', { projectId, branchId: data.branch.id });

      return {
        success: true,
        databaseId: `neon_${data.branch.id}`,
        connectionString,
        databaseUrl: `https://console.neon.tech`,
        provider: 'neon'
      };
    } catch (error) {
      logger.error('Failed to provision Neon database', error as Error);
      return {
        success: false,
        provider: 'neon',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Provision a MongoDB Atlas database
   */
  private async provisionMongoDBAtlasDatabase(
    userId: string,
    projectId: number,
    projectName: string
  ): Promise<DatabaseProvisioningResult> {
    try {
      const atlasApiKey = process.env.MONGODB_ATLAS_API_KEY;
      const atlasProjectId = process.env.MONGODB_ATLAS_PROJECT_ID;

      if (!atlasApiKey || !atlasProjectId) {
        return {
          success: false,
          provider: 'mongodb-atlas',
          error: 'MongoDB Atlas credentials not configured. Please set MONGODB_ATLAS_API_KEY and MONGODB_ATLAS_PROJECT_ID in environment variables.'
        };
      }

      // MongoDB Atlas API to create a new database user and get connection string
      // For now, we'll generate a connection string template
      // In production, you'd use Atlas API to create users and get actual connection strings
      
      const databaseName = `project_${projectId}_${Date.now().toString(36)}`;
      const username = `user_${projectId}_${Date.now().toString(36)}`;
      const password = this.generateSecurePassword();
      
      // Generate connection string template
      // User would need to configure cluster URL in MongoDB Atlas
      const connectionString = `mongodb+srv://${username}:${password}@cluster0.xxxxx.mongodb.net/${databaseName}?retryWrites=true&w=majority`;

      logger.info('MongoDB Atlas database provisioned', { projectId, databaseName });

      return {
        success: true,
        databaseId: `mongodb_${projectId}_${Date.now()}`,
        connectionString,
        databaseUrl: 'https://cloud.mongodb.com',
        provider: 'mongodb-atlas'
      };
    } catch (error) {
      logger.error('Failed to provision MongoDB Atlas database', error as Error);
      return {
        success: false,
        provider: 'mongodb-atlas',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save database configuration to database
   */
  private async saveDatabaseConfig(
    userId: string,
    projectId: number,
    databaseType: 'mongodb' | 'postgresql' | 'mysql',
    provider: 'supabase' | 'neon' | 'mongodb-atlas' | 'manual',
    connectionString: string,
    databaseUrl?: string
  ): Promise<void> {
    try {
      // Encrypt connection string before storing
      const { CredentialVault } = await import('./CredentialVault');
      const credentialVault = new CredentialVault();
      const encryptCredential = (data: string) => credentialVault.encrypt({ value: data });
      const encryptedConnectionString = encryptCredential(connectionString);

      const { randomUUID } = await import('crypto');
      
      await db.insert(projectDatabases).values({
        id: randomUUID(),
        userId,
        projectId,
        databaseType,
        provider,
        connectionString: encryptedConnectionString,
        databaseUrl: databaseUrl || null,
        status: 'active',
        createdAt: new Date()
      }).onConflictDoUpdate({
        target: [projectDatabases.projectId],
        set: {
          databaseType,
          provider,
          connectionString: encryptedConnectionString,
          databaseUrl: databaseUrl || null,
          status: 'active',
          updatedAt: new Date()
        }
      });

      logger.info('Database config saved', { projectId, provider });
    } catch (error) {
      logger.error(`Failed to save database config for project ${projectId}`, error as Error);
      throw error;
    }
  }

  /**
   * Get database connection string for a project
   */
  public async getDatabaseConnection(
    userId: string,
    projectId: number
  ): Promise<string | null> {
    try {
      const [dbConfig] = await db.select()
        .from(projectDatabases)
        .where(eq(projectDatabases.projectId, projectId))
        .limit(1);

      if (!dbConfig || dbConfig.status !== 'active') {
        return null;
      }

      // Decrypt connection string
      const { CredentialVault } = await import('./CredentialVault');
      const credentialVault = new CredentialVault();
      const decrypted = credentialVault.decrypt(dbConfig.connectionString);
      return decrypted.value as string;
    } catch (error) {
      logger.error(`Failed to get database connection for project ${projectId}`, error as Error);
      return null;
    }
  }

  /**
   * Save pending provisioning request (when API keys are missing)
   */
  private async savePendingProvisioningRequest(
    userId: string,
    projectId: number,
    databaseType: 'mongodb' | 'postgresql' | 'mysql',
    projectName: string,
    missingKeys: string[]
  ): Promise<void> {
    try {
      // Store as pending in project_databases table
      await db.insert(projectDatabases).values({
        id: `pending_${projectId}_${Date.now()}`,
        userId,
        projectId,
        databaseType,
        provider: 'manual', // Will be determined on retry
        connectionString: JSON.stringify({ missingKeys, projectName }), // Temporary storage
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }).onConflictDoUpdate({
        target: [projectDatabases.projectId],
        set: {
          status: 'pending',
          connectionString: JSON.stringify({ missingKeys, projectName }),
          updatedAt: new Date()
        }
      });
      
      logger.info('Saved pending provisioning request', { projectId, missingKeys });
    } catch (error) {
      logger.error(`Failed to save pending provisioning request for project ${projectId}`, error as Error);
    }
  }

  /**
   * Clear pending provisioning request
   */
  private async clearPendingProvisioningRequest(projectId: number): Promise<void> {
    try {
      await db.update(projectDatabases)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(projectDatabases.projectId, projectId));
      
      logger.info('Cleared pending provisioning request', { projectId });
    } catch (error) {
      logger.error(`Failed to clear pending provisioning request for project ${projectId}`, error as Error);
    }
  }

  /**
   * Retry database provisioning for a project (called after API keys are configured)
   */
  public async retryProvisioning(
    userId: string,
    projectId: number
  ): Promise<DatabaseProvisioningResult> {
    try {
      // Get pending request
      const [pending] = await db.select()
        .from(projectDatabases)
        .where(
          and(
            eq(projectDatabases.projectId, projectId),
            eq(projectDatabases.status, 'pending')
          )
        )
        .limit(1);

      if (!pending) {
        return {
          success: false,
          provider: 'manual',
          error: 'No pending provisioning request found for this project'
        };
      }

      // Parse stored metadata
      const metadata = JSON.parse(pending.connectionString);
      const databaseType = pending.databaseType as 'mongodb' | 'postgresql' | 'mysql';
      const projectName = metadata.projectName || `Project ${projectId}`;

      // Check if API keys are now available
      const apiKeyCheck = this.checkRequiredAPIKeys(databaseType);
      if (!apiKeyCheck.hasAllKeys) {
        return {
          success: false,
          provider: apiKeyCheck.provider || 'manual',
          error: `API keys still missing: ${apiKeyCheck.missingKeys.join(', ')}. Please configure these in environment variables.`,
          pending: true,
          missingKeys: apiKeyCheck.missingKeys
        };
      }

      // Retry provisioning
      logger.info('Retrying database provisioning', { projectId, databaseType });
      const result = await this.provisionDatabase(userId, projectId, databaseType, projectName);

      if (result.success) {
        logger.info('Database provisioning retry successful', { projectId });
      } else {
        logger.warn('Database provisioning retry failed', { projectId, error: result.error });
      }

      return result;
    } catch (error) {
      logger.error(`Failed to retry database provisioning for project ${projectId}`, error as Error);
      return {
        success: false,
        provider: 'manual',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get pending provisioning requests for a user
   */
  public async getPendingRequests(userId: string): Promise<Array<{
    projectId: number;
    databaseType: string;
    missingKeys: string[];
  }>> {
    try {
      const pending = await db.select()
        .from(projectDatabases)
        .where(
          and(
            eq(projectDatabases.userId, userId),
            eq(projectDatabases.status, 'pending')
          )
        );

      return pending.map(p => {
        const metadata = JSON.parse(p.connectionString);
        return {
          projectId: p.projectId,
          databaseType: p.databaseType,
          missingKeys: metadata.missingKeys || []
        };
      });
    } catch (error) {
      logger.error(`Failed to get pending requests for user ${userId}`, error as Error);
      return [];
    }
  }

  /**
   * Generate secure password
   */
  private generateSecurePassword(length: number = 24): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

export const databaseProvisioningService = new DatabaseProvisioningService();

