import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const aiModels = sqliteTable('ai_models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  creator: text('creator').notNull(),
  description: text('description').notNull(),
  capabilities: text('capabilities').notNull(), // JSON stored as text
  releaseDate: text('release_date').notNull(), // ISO string
  category: text('category').notNull(),
  imageUrl: text('image_url'),
  documentationUrl: text('documentation_url'),
  parameters: text('parameters').notNull(), // JSON stored as text
});

export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  founded: text('founded').notNull(), // ISO string
  website: text('website').notNull(),
  logoUrl: text('logo_url'),
  products: text('products').notNull(), // JSON stored as text
});

export const frameworks = sqliteTable('frameworks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  language: text('language').notNull(),
  githubUrl: text('github_url'),
  documentation: text('documentation'),
  features: text('features').notNull(), // JSON stored as text
});

export const workspaces = sqliteTable('workspaces', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  agentConfig: text('agent_config').notNull(), // JSON stored as text
  testCases: text('test_cases'), // JSON stored as text
  collaborators: text('collaborators').notNull(), // JSON stored as text
  status: text('status').notNull(),
  // New collaboration fields
  ownerId: text('owner_id').references(() => users.id),
  projectType: text('project_type').notNull().default('web_app'),
  projectStatus: text('project_status').notNull().default('active'),
  inviteCode: text('invite_code').unique(),
  settings: text('settings').notNull().default('{}'), // JSON stored as text
  lastActivity: text('last_activity').notNull().default('CURRENT_TIMESTAMP'),
});

export const agentScripts = sqliteTable('agent_scripts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  language: text('language').notNull(),
  version: text('version').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  scriptTemplate: text('script_template').notNull(),
  configSchema: text('config_schema').notNull(), // JSON stored as text
  requirements: text('requirements').notNull(), // JSON stored as text
  category: text('category').notNull(),
  tags: text('tags').notNull(), // JSON stored as text
});

export const orchestrationPatterns = sqliteTable('orchestration_patterns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  pattern: text('pattern').notNull(), // JSON stored as text
  taskDecomposition: text('task_decomposition').notNull(), // JSON stored as text
  agentRoles: text('agent_roles').notNull(), // JSON stored as text
  coordinationRules: text('coordination_rules').notNull(), // JSON stored as text
  category: text('category').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const agents = sqliteTable('agents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  role: text('role').notNull(),
  model: text('model').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  temperature: text('temperature').notNull(),
  customInstructions: text('custom_instructions'), // JSON stored as text
  capabilities: text('capabilities').notNull(), // JSON stored as text
  expertise: text('expertise').notNull(), // JSON stored as text
  frameworks: text('frameworks').notNull(), // JSON stored as text
  libraries: text('libraries').notNull(), // JSON stored as text
  bestPractices: text('best_practices').notNull(), // JSON stored as text
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  isActive: integer('is_active').notNull().default(1), // 1 for true, 0 for false
});

export type AiModel = typeof aiModels.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Framework = typeof frameworks.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type AgentScript = typeof agentScripts.$inferSelect;
export type OrchestrationPattern = typeof orchestrationPatterns.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

export const insertAgentScriptSchema = createInsertSchema(agentScripts);
export const selectAgentScriptSchema = createSelectSchema(agentScripts);
export const insertOrchestrationPatternSchema = createInsertSchema(
  orchestrationPatterns
);
export const selectOrchestrationPatternSchema = createSelectSchema(
  orchestrationPatterns
);
export const promptTemplates = sqliteTable('prompt_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  template: text('template').notNull(),
  variables: text('variables').notNull(), // JSON stored as text
  category: text('category').notNull(),
  tags: text('tags').notNull(), // JSON stored as text
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  bestPractices: text('best_practices').notNull(), // JSON stored as text
  version: text('version').notNull(),
});

export const promptChains = sqliteTable('prompt_chains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  steps: text('steps').notNull(), // JSON stored as text
  inputSchema: text('input_schema').notNull(), // JSON stored as text
  outputSchema: text('output_schema').notNull(), // JSON stored as text
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  version: text('version').notNull(),
  isActive: integer('is_active').notNull().default(1), // 1 for true, 0 for false
  retryStrategy: text('retry_strategy'), // JSON stored as text
  errorHandling: text('error_handling'), // JSON stored as text
  timeout: integer('timeout'),
  maxTokens: integer('max_tokens'),
});

export const chainExecutions = sqliteTable('chain_executions', {
  id: text('id').primaryKey(), // UUID as text
  chainId: integer('chain_id')
    .notNull()
    .references(() => promptChains.id),
  startedAt: text('started_at').notNull().default('CURRENT_TIMESTAMP'),
  completedAt: text('completed_at'),
  status: text('status').notNull(), // 'running', 'completed', 'failed'
  input: text('input').notNull(), // JSON stored as text
  output: text('output'), // JSON stored as text
  error: text('error'), // JSON stored as text
  stepResults: text('step_results').notNull(), // JSON stored as text
  metrics: text('metrics'), // JSON stored as text
  agentId: integer('agent_id').references(() => agents.id),
});

export const promptTemplatesRelations = relations(
  promptTemplates,
  ({ many }) => ({
    chains: many(promptChains),
  })
);

export const promptChainsRelations = relations(
  promptChains,
  ({ many, one }) => ({
    templates: many(promptTemplates),
    executions: many(chainExecutions),
    agent: one(agents, {
      fields: [promptChains.id],
      references: [agents.id],
    }),
  })
);

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type PromptChain = typeof promptChains.$inferSelect;
export type ChainExecution = typeof chainExecutions.$inferSelect;

export const codeGenerationSessions = sqliteTable('code_generation_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  inputPrompt: text('input_prompt').notNull(),
  generatedCode: text('generated_code').notNull(),
  status: text('status').default('pending'),
  metadata: text('metadata').default('{}'), // JSON stored as text
  createdAt: text('created_at'),
  completedAt: text('completed_at'),
  title: text('title').notNull(),
  description: text('description'),
  updatedAt: text('updated_at').notNull(),
  agentId: text('agent_id'),
});

export type CodeGenerationSession = typeof codeGenerationSessions.$inferSelect;
export const insertCodeGenerationSessionSchema = createInsertSchema(
  codeGenerationSessions
);
export const selectCodeGenerationSessionSchema = createSelectSchema(
  codeGenerationSessions
);

// User Authentication Tables
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID as text
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  lastActive: text('last_active').notNull().default('CURRENT_TIMESTAMP'),
  preferences: text('preferences').notNull().default('{}'), // JSON stored as text
  isActive: integer('is_active').notNull().default(1), // 1 for true, 0 for false
  role: text('role').notNull().default('user'), // user, admin, superadmin
  // Monetization fields
  tier: text('tier').notNull().default('free'), // free, pro, enterprise
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionStatus: text('subscription_status').default('inactive'), // active, inactive, canceled, past_due
  subscriptionId: text('subscription_id'),
  trialEndsAt: text('trial_ends_at'),
});

export const userSessions = sqliteTable('user_sessions', {
  id: text('id').primaryKey(), // UUID as text
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: text('session_token').notNull().unique(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  lastActivity: text('last_activity').notNull().default('CURRENT_TIMESTAMP'),
  expiresAt: text('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  isActive: integer('is_active').notNull().default(1), // 1 for true, 0 for false
});

export const userAPIKeys = sqliteTable('user_api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  serviceName: text('service_name').notNull(),
  keyName: text('key_name').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  keyType: text('key_type').notNull().default('api_key'), // api_key, secret, token, password
  description: text('description'),
  website: text('website'),
  lastUsed: text('last_used'),
  usageCount: integer('usage_count').notNull().default(0),
  isActive: integer('is_active').notNull().default(1), // 1 for true, 0 for false
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const userWorkspaces = sqliteTable('user_workspaces', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  workspaceName: text('workspace_name').notNull(),
  componentName: text('component_name').notNull(),
  workspacePath: text('workspace_path').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  lastModified: text('last_modified').notNull().default('CURRENT_TIMESTAMP'),
  status: text('status').notNull().default('active'), // active, archived, deleted
  metadata: text('metadata').notNull().default('{}'), // JSON stored as text
});

// New collaboration tables
export const projectMembers = sqliteTable('project_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('collaborator'), // owner, collaborator, viewer
  joinedAt: text('joined_at').notNull().default('CURRENT_TIMESTAMP'),
  permissions: text('permissions').notNull().default('{}'), // JSON stored as text
  isActive: integer('is_active').notNull().default(1),
});

export const projectChatMessages = sqliteTable('project_chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  messageType: text('message_type').notNull().default('text'), // text, system, file_share, code_share
  metadata: text('metadata').notNull().default('{}'), // JSON stored as text
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  isEdited: integer('is_edited').notNull().default(0),
  editedAt: text('edited_at'),
});

export const projectActivities = sqliteTable('project_activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  activityType: text('activity_type').notNull(), // file_added, file_modified, agent_used, chat_message, etc.
  description: text('description').notNull(),
  metadata: text('metadata').notNull().default('{}'), // JSON stored as text
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const projectFiles = sqliteTable('project_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  fileContent: text('file_content'),
  fileType: text('file_type'), // component, style, config, etc.
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lastModifiedBy: text('last_modified_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  version: integer('version').notNull().default(1),
  isActive: integer('is_active').notNull().default(1),
});

// Usage tracking and rate limiting tables
export const userUsage = sqliteTable('user_usage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  serviceName: text('service_name').notNull(), // anthropic, openai, etc.
  requestType: text('request_type').notNull(), // component_generation, chat, etc.
  tokensUsed: integer('tokens_used').notNull().default(0),
  cost: real('cost').notNull().default(0), // Cost in USD
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  sessionId: text('session_id'),
  metadata: text('metadata').notNull().default('{}'), // JSON stored as text
});

export const rateLimitBuckets = sqliteTable('rate_limit_buckets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bucketType: text('bucket_type').notNull(), // daily, monthly, per_request
  requestCount: integer('request_count').notNull().default(0),
  windowStart: text('window_start').notNull(), // ISO timestamp
  windowEnd: text('window_end').notNull(), // ISO timestamp
  lastReset: text('last_reset').notNull().default('CURRENT_TIMESTAMP'),
});

export const subscriptionPlans = sqliteTable('subscription_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // Free, Pro, Enterprise
  tier: text('tier').notNull(), // free, pro, enterprise
  price: real('price').notNull().default(0), // Monthly price in USD
  stripePriceId: text('stripe_price_id'),
  features: text('features').notNull().default('{}'), // JSON stored as text
  limits: text('limits').notNull().default('{}'), // JSON stored as text
  isActive: integer('is_active').notNull().default(1),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const generationLocks = sqliteTable('generation_locks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lockType: text('lock_type').notNull(), // 'component_generation', 'agent_generation', 'code_generation'
  sessionId: text('session_id'), // Optional session identifier
  startedAt: text('started_at').notNull().default('CURRENT_TIMESTAMP'),
  expiresAt: text('expires_at').notNull(), // When the lock should expire
  status: text('status').notNull().default('active'), // 'active', 'completed', 'failed', 'expired'
  metadata: text('metadata').notNull().default('{}'), // JSON metadata about the generation
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(userSessions),
  apiKeys: many(userAPIKeys),
  workspaces: many(userWorkspaces),
  ownedProjects: many(workspaces),
  projectMemberships: many(projectMembers),
  chatMessages: many(projectChatMessages),
  projectActivities: many(projectActivities),
  createdFiles: many(projectFiles),
  generationLocks: many(generationLocks),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(projectMembers),
  chatMessages: many(projectChatMessages),
  activities: many(projectActivities),
  files: many(projectFiles),
  generationLocks: many(generationLocks),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(workspaces, {
    fields: [projectMembers.projectId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const projectChatMessagesRelations = relations(
  projectChatMessages,
  ({ one }) => ({
    project: one(workspaces, {
      fields: [projectChatMessages.projectId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [projectChatMessages.userId],
      references: [users.id],
    }),
  })
);

export const projectActivitiesRelations = relations(
  projectActivities,
  ({ one }) => ({
    project: one(workspaces, {
      fields: [projectActivities.projectId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [projectActivities.userId],
      references: [users.id],
    }),
  })
);

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(workspaces, {
    fields: [projectFiles.projectId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [projectFiles.createdBy],
    references: [users.id],
  }),
  lastModifier: one(users, {
    fields: [projectFiles.lastModifiedBy],
    references: [users.id],
  }),
}));

export const generationLocksRelations = relations(
  generationLocks,
  ({ one }) => ({
    project: one(workspaces, {
      fields: [generationLocks.projectId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [generationLocks.userId],
      references: [users.id],
    }),
  })
);

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const userAPIKeysRelations = relations(userAPIKeys, ({ one }) => ({
  user: one(users, {
    fields: [userAPIKeys.userId],
    references: [users.id],
  }),
}));

export const userUsageRelations = relations(userUsage, ({ one }) => ({
  user: one(users, {
    fields: [userUsage.userId],
    references: [users.id],
  }),
}));

export const rateLimitBucketsRelations = relations(
  rateLimitBuckets,
  ({ one }) => ({
    user: one(users, {
      fields: [rateLimitBuckets.userId],
      references: [users.id],
    }),
  })
);

export const userWorkspacesRelations = relations(userWorkspaces, ({ one }) => ({
  user: one(users, {
    fields: [userWorkspaces.userId],
    references: [users.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;
export type UserAPIKey = typeof userAPIKeys.$inferSelect;
export type InsertUserAPIKey = typeof userAPIKeys.$inferInsert;
export type UserWorkspace = typeof userWorkspaces.$inferSelect;
export type InsertUserWorkspace = typeof userWorkspaces.$inferInsert;

// New collaboration types
export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;
export type ProjectChatMessage = typeof projectChatMessages.$inferSelect;
export type InsertProjectChatMessage = typeof projectChatMessages.$inferInsert;
export type ProjectActivity = typeof projectActivities.$inferSelect;
export type InsertProjectActivity = typeof projectActivities.$inferInsert;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type InsertProjectFile = typeof projectFiles.$inferInsert;
export type GenerationLock = typeof generationLocks.$inferSelect;
export type InsertGenerationLock = typeof generationLocks.$inferInsert;

// Monetization types
export type UserUsage = typeof userUsage.$inferSelect;
export type InsertUserUsage = typeof userUsage.$inferInsert;
export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
export type InsertRateLimitBucket = typeof rateLimitBuckets.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// Schema exports
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertUserSessionSchema = createInsertSchema(userSessions);
export const selectUserSessionSchema = createSelectSchema(userSessions);
export const insertUserAPIKeySchema = createInsertSchema(userAPIKeys);
export const selectUserAPIKeySchema = createSelectSchema(userAPIKeys);
export const insertUserWorkspaceSchema = createInsertSchema(userWorkspaces);
export const selectUserWorkspaceSchema = createSelectSchema(userWorkspaces);

// New collaboration schemas
export const insertProjectMemberSchema = createInsertSchema(projectMembers);
export const selectProjectMemberSchema = createSelectSchema(projectMembers);
export const insertProjectChatMessageSchema =
  createInsertSchema(projectChatMessages);
export const selectProjectChatMessageSchema =
  createSelectSchema(projectChatMessages);
export const insertProjectActivitySchema =
  createInsertSchema(projectActivities);
export const selectProjectActivitySchema =
  createSelectSchema(projectActivities);
export const insertProjectFileSchema = createInsertSchema(projectFiles);
export const selectProjectFileSchema = createSelectSchema(projectFiles);
export const insertGenerationLockSchema = createInsertSchema(generationLocks);
export const selectGenerationLockSchema = createSelectSchema(generationLocks);

// Monetization schemas
export const insertUserUsageSchema = createInsertSchema(userUsage);
export const selectUserUsageSchema = createSelectSchema(userUsage);
export const insertRateLimitBucketSchema = createInsertSchema(rateLimitBuckets);
export const selectRateLimitBucketSchema = createSelectSchema(rateLimitBuckets);
export const insertSubscriptionPlanSchema =
  createInsertSchema(subscriptionPlans);
export const selectSubscriptionPlanSchema =
  createSelectSchema(subscriptionPlans);

export const insertAgentSchema = createInsertSchema(agents);
export const selectAgentSchema = createSelectSchema(agents);
export const insertPromptTemplateSchema = createInsertSchema(promptTemplates);
export const selectPromptTemplateSchema = createSelectSchema(promptTemplates);
export const insertPromptChainSchema = createInsertSchema(promptChains);
export const selectPromptChainSchema = createSelectSchema(promptChains);
