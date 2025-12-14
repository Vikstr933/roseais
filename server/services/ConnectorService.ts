/**
 * ConnectorService - Manages workspace connectors and their environment variables
 * Provides connector context for agents and env vars for generated apps
 */

import { db } from '../../db';
import { apiKeys } from '../../db/schema-pg';
import { eq, and, isNull } from 'drizzle-orm';
import { apiKeyService } from './APIKeyService';
import { getAllPreBuiltConnectors } from '../data/pre-built-connectors';

export interface ConnectorInfo {
  id: string;
  serviceName: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  envVariables: Record<string, string>; // Decrypted env variables
  apiKeys: Record<string, string>; // Decrypted API keys (for reference, not for code)
  isShared: boolean;
  configuredBy?: string;
}

export interface ConnectorContext {
  availableConnectors: ConnectorInfo[];
  envVarsForCode: Record<string, string>; // Env vars that should be injected into generated code
  deploymentCredentials: {
    vercel?: string;
    github?: string;
  };
}

export class ConnectorService {
  /**
   * Get all connectors for a workspace (shared + user's personal)
   */
  static async getWorkspaceConnectors(
    userId: string,
    workspaceId?: number
  ): Promise<ConnectorContext> {
    const availableConnectors: ConnectorInfo[] = [];
    const envVarsForCode: Record<string, string> = {};
    const deploymentCredentials: { vercel?: string; github?: string } = {};

    try {
      // 1. Get shared connectors (user-level, not workspace-level for security)
      // SECURITY: Each user has their own connectors - they're not shared across users
      // The "shared" name refers to them being available across all user's projects, not across users
      const sharedKeys = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.userId, userId), // SECURITY: Only this user's connectors
            eq(apiKeys.isShared, true),
            eq(apiKeys.isActive, true),
            isNull(apiKeys.projectId) // User-wide connectors only
          )
        );

        for (const key of sharedKeys) {
          try {
            // Get decrypted key value using the service name
            const decrypted = await apiKeyService.getAPIKey(userId, key.serviceName || '');
            if (decrypted) {
              const preBuilt = getAllPreBuiltConnectors().find(
                c => c.id === key.serviceName?.toLowerCase()
              );

              if (preBuilt) {
                const connectorInfo: ConnectorInfo = {
                  id: key.id.toString(),
                  serviceName: key.serviceName || 'unknown',
                  name: preBuilt.name,
                  icon: preBuilt.icon,
                  category: preBuilt.category,
                  description: preBuilt.description,
                  envVariables: {},
                  apiKeys: {},
                  isShared: true,
                  configuredBy: key.configuredBy || undefined,
                };

                // Extract env variables from metadata
                const metadata = (key.metadata as any) || {};
                if (metadata.envVariables) {
                  connectorInfo.envVariables = metadata.envVariables;
                  // Add to envVarsForCode (these will be injected into generated apps)
                  Object.assign(envVarsForCode, metadata.envVariables);
                }

                // Store API key for deployment credentials if it's Vercel/GitHub
                if (decrypted) {
                  if (key.serviceName?.toLowerCase() === 'vercel') {
                    deploymentCredentials.vercel = decrypted;
                  } else if (key.serviceName?.toLowerCase() === 'github') {
                    deploymentCredentials.github = decrypted;
                  }
                }

                availableConnectors.push(connectorInfo);
              }
            }
          } catch (error) {
            console.error(`Failed to decrypt shared connector ${key.id}:`, error);
          }
        }

      // 2. Get personal connectors (user-level)
      const personalKeys = await db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.userId, userId),
            eq(apiKeys.isShared, false),
            eq(apiKeys.isActive, true),
            isNull(apiKeys.projectId) // User-wide, not project-specific
          )
        );

      for (const key of personalKeys) {
        try {
          // Get decrypted key value using the service name
          const decrypted = await apiKeyService.getAPIKey(userId, key.serviceName || '');
          if (decrypted) {
            const preBuilt = getAllPreBuiltConnectors().find(
              c => c.id === key.serviceName?.toLowerCase()
            );

            if (preBuilt) {
              const connectorInfo: ConnectorInfo = {
                id: key.id.toString(),
                serviceName: key.serviceName || 'unknown',
                name: preBuilt.name,
                icon: preBuilt.icon,
                category: preBuilt.category,
                description: preBuilt.description,
                envVariables: {},
                apiKeys: {},
                isShared: false,
              };

              // Extract env variables from metadata
              const metadata = (key.metadata as any) || {};
              if (metadata.envVariables) {
                connectorInfo.envVariables = metadata.envVariables;
                // Add to envVarsForCode
                Object.assign(envVarsForCode, metadata.envVariables);
              }

              // Store API key for deployment credentials if it's Vercel/GitHub
              if (decrypted) {
                if (key.serviceName?.toLowerCase() === 'vercel') {
                  deploymentCredentials.vercel = decrypted;
                } else if (key.serviceName?.toLowerCase() === 'github') {
                  deploymentCredentials.github = decrypted;
                }
              }

              availableConnectors.push(connectorInfo);
            }
          }
        } catch (error) {
          console.error(`Failed to decrypt personal connector ${key.id}:`, error);
        }
      }

      return {
        availableConnectors,
        envVarsForCode,
        deploymentCredentials,
      };
    } catch (error) {
      console.error('Error getting workspace connectors:', error);
      return {
        availableConnectors: [],
        envVarsForCode: {},
        deploymentCredentials: {},
      };
    }
  }

  /**
   * Build connector context string for agent prompts
   */
  static buildConnectorContextString(connectors: ConnectorInfo[]): string {
    if (connectors.length === 0) {
      return '';
    }

    const connectorDescriptions = connectors.map(connector => {
      const envVarList = Object.keys(connector.envVariables).length > 0
        ? `\n  - Available env vars: ${Object.keys(connector.envVariables).join(', ')}`
        : '';
      
      return `- **${connector.name}** (${connector.icon}): ${connector.description}${envVarList}`;
    }).join('\n');

    return `\n\n**Available Connectors & Services:**
The workspace has the following connectors configured. You can use these in your code generation:
${connectorDescriptions}

**Important Notes:**
- When generating code that uses these services, reference the env vars (e.g., \`process.env.STRIPE_SECRET_KEY\`)
- The env vars will be automatically available in the deployed app
- You don't need to hardcode API keys - use environment variables
- If a connector is available, you can generate code that uses it (e.g., Stripe for payments, Vercel for deployment)`;
  }

  /**
   * Get environment variables that should be injected into generated code
   */
  static getEnvVarsForCode(connectors: ConnectorInfo[]): Record<string, string> {
    const envVars: Record<string, string> = {};
    
    for (const connector of connectors) {
      Object.assign(envVars, connector.envVariables);
    }
    
    return envVars;
  }
}

