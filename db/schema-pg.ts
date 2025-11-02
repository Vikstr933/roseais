import { pgTable, text, integer, real, timestamp, boolean, serial, jsonb, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const aiModels = pgTable('ai_models', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  creator: text('creator').notNull(),
  description: text('description').notNull(),
  capabilities: jsonb('capabilities').notNull(), // JSON column instead of text
  releaseDate: text('release_date').notNull(), // ISO string
  category: text('category').notNull(),
  imageUrl: text('image_url'),
  documentationUrl: text('documentation_url'),
  parameters: jsonb('parameters').notNull(), // JSON column instead of text
});

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  founded: text('founded').notNull(), // ISO string
  website: text('website').notNull(),
  logoUrl: text('logo_url'),
  products: jsonb('products').notNull(), // JSON column instead of text
});

export const frameworks = pgTable('frameworks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  language: text('language').notNull(),
  githubUrl: text('github_url'),
  documentation: text('documentation'),
  features: jsonb('features').notNull(), // JSON column instead of text
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  lastActive: timestamp('last_active').defaultNow(),
  preferences: jsonb('preferences').default({
    theme: 'light',
    autoSave: true,
    defaultLanguage: 'typescript'
  }),
  isActive: boolean('is_active').default(true),
  role: text('role').default('user'), // user, admin, superadmin
  tier: text('tier').default('free'), // free, pro, enterprise
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionStatus: text('subscription_status').default('inactive'), // active, inactive, canceled, past_due
  subscriptionId: text('subscription_id'),
  trialEndsAt: timestamp('trial_ends_at'),
});

export const workspaces = pgTable('workspaces', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  agentConfig: jsonb('agent_config').default({}),
  testCases: jsonb('test_cases').default([]),
  collaborators: jsonb('collaborators').default([]),
  status: text('status').notNull().default('active'),
  ownerId: text('owner_id').references(() => users.id),
  workspaceType: text('workspace_type').notNull().default('personal'), // 'personal' or 'team'
  projectType: text('project_type').notNull().default('web_app'),
  projectStatus: text('project_status').default('active'),
  inviteCode: text('invite_code').unique(),
  settings: jsonb('settings').default({}),
  lastActivity: timestamp('last_activity').defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  model: text('model').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  temperature: real('temperature').default(0.7),
  maxTokens: integer('max_tokens').default(4096),
  tools: jsonb('tools').default([]),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').default(true),
  // Enhanced agent fields (added in migration 2016a)
  description: text('description'),
  role: text('role'),
  capabilities: jsonb('capabilities').default({}),
  expertise: jsonb('expertise').default({}),
  frameworks: jsonb('frameworks').default({}),
  libraries: jsonb('libraries').default({}),
  bestPractices: jsonb('best_practices').default({}),
  enabledPlugins: jsonb('enabled_plugins').default([]),
});

export const projectFiles = pgTable('project_files', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  fileContent: text('file_content').notNull(),
  fileType: text('file_type'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  lastModifiedBy: text('last_modified_by').references(() => users.id, { onDelete: 'set null' }),
  version: integer('version').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').default(true),
}, (table) => ({
  // Unique constraint to prevent duplicate files in same project
  uniqueProjectFile: unique().on(table.projectId, table.filePath),
}));

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  metadata: jsonb('metadata').default({}),
});

export const generationLocks = pgTable('generation_locks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lockType: text('lock_type').notNull(),
  sessionId: text('session_id'),
  startedAt: timestamp('started_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  status: text('status').default('active'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const codeGenerationSessions = pgTable('code_generation_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  inputPrompt: text('input_prompt').notNull(),
  generatedCode: text('generated_code').notNull(),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  workspaceId: integer('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  status: text('status').default('completed'),
  metadata: jsonb('metadata').default({}),
});

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),
  name: text('name').notNull(),
  lastUsed: timestamp('last_used'),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true),
});

export const rateLimits = pgTable('rate_limits', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  count: integer('count').default(0),
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usageTracking = pgTable('usage_tracking', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actionType: text('action_type').notNull(),
  tokensUsed: integer('tokens_used').default(0),
  costCents: integer('cost_cents').default(0),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

export const eventLogs = pgTable('event_logs', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

// Plugin System Tables (must be defined before relations)
export const pluginConfigs = pgTable('plugin_configs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pluginId: text('plugin_id').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  credentials: jsonb('credentials'),
  settings: jsonb('settings').default({}),
  lastSync: timestamp('last_sync'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const pluginKnowledge = pgTable('plugin_knowledge', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pluginId: text('plugin_id').notNull(),
  externalId: text('external_id').notNull(),
  type: text('type').notNull(), // 'email', 'calendar_event', 'task', 'document', etc.
  title: text('title').notNull(),
  content: text('content'),
  metadata: jsonb('metadata').default({}),
  relevanceScore: real('relevance_score'),
  timestamp: timestamp('timestamp').notNull(),
  syncedAt: timestamp('synced_at').defaultNow(),
});

export const pluginActions = pgTable('plugin_actions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pluginId: text('plugin_id').notNull(),
  actionType: text('action_type').notNull(),
  parameters: jsonb('parameters').default({}),
  result: jsonb('result'),
  status: text('status').notNull().default('pending'), // 'pending', 'success', 'failed'
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const pluginSyncLogs = pgTable('plugin_sync_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pluginId: text('plugin_id').notNull(),
  syncType: text('sync_type').notNull().default('incremental'), // 'full', 'incremental'
  itemsSynced: integer('items_synced').notNull().default(0),
  itemsCreated: integer('items_created').notNull().default(0),
  itemsUpdated: integer('items_updated').notNull().default(0),
  itemsDeleted: integer('items_deleted').notNull().default(0),
  status: text('status').notNull().default('in_progress'), // 'in_progress', 'success', 'failed'
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),
  metadata: jsonb('metadata').default({}),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  workspaces: many(workspaces),
  agents: many(agents),
  apiKeys: many(apiKeys),
  pluginConfigs: many(pluginConfigs),
  pluginKnowledge: many(pluginKnowledge),
  pluginActions: many(pluginActions),
  conversations: many(conversations),
  userPreferences: many(userPreferences),
  aiInsights: many(aiInsights),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  projectFiles: many(projectFiles),
  chatMessages: many(chatMessages),
  generationLocks: many(generationLocks),
  codeGenerationSessions: many(codeGenerationSessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  creator: one(users, { fields: [agents.createdBy], references: [users.id] }),
  codeGenerationSessions: many(codeGenerationSessions),
}));

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  workspace: one(workspaces, { fields: [projectFiles.projectId], references: [workspaces.id] }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  workspace: one(workspaces, { fields: [chatMessages.projectId], references: [workspaces.id] }),
  user: one(users, { fields: [chatMessages.userId], references: [users.id] }),
}));

export const pluginConfigsRelations = relations(pluginConfigs, ({ one }) => ({
  user: one(users, { fields: [pluginConfigs.userId], references: [users.id] }),
}));

export const pluginKnowledgeRelations = relations(pluginKnowledge, ({ one }) => ({
  user: one(users, { fields: [pluginKnowledge.userId], references: [users.id] }),
}));

export const pluginActionsRelations = relations(pluginActions, ({ one }) => ({
  user: one(users, { fields: [pluginActions.userId], references: [users.id] }),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertWorkspaceSchema = createInsertSchema(workspaces);
export const selectWorkspaceSchema = createSelectSchema(workspaces);
export const insertAgentSchema = createInsertSchema(agents);
export const selectAgentSchema = createSelectSchema(agents);
export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type NewProjectFile = typeof projectFiles.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type PluginConfig = typeof pluginConfigs.$inferSelect;
export type NewPluginConfig = typeof pluginConfigs.$inferInsert;
export type PluginKnowledge = typeof pluginKnowledge.$inferSelect;
export type NewPluginKnowledge = typeof pluginKnowledge.$inferInsert;
export type PluginAction = typeof pluginActions.$inferSelect;
export type NewPluginAction = typeof pluginActions.$inferInsert;
export type PluginSyncLog = typeof pluginSyncLogs.$inferSelect;
export type NewPluginSyncLog = typeof pluginSyncLogs.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
export type AIInsight = typeof aiInsights.$inferSelect;
export type NewAIInsight = typeof aiInsights.$inferInsert;

// Legacy exports for backward compatibility
export const promptChains = pgTable('prompt_chains', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  steps: jsonb('steps').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

export const promptTemplates = pgTable('prompt_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  template: text('template').notNull(),
  variables: jsonb('variables').default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

// OmniAssistant Tables - Fas 1: Digital Office Platform

// Persistent conversation memory for context-aware AI assistance
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contextType: text('context_type').notNull(), // 'general', 'coding', 'marketing', 'crm', 'analytics', etc.
  summary: text('summary').notNull(), // AI-generated summary of conversation
  keyPoints: jsonb('key_points').default([]), // Important takeaways
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastReferenced: timestamp('last_referenced').defaultNow(),
});

// AI-learned user preferences and patterns
export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  preferenceType: text('preference_type').notNull(), // 'coding_style', 'communication_tone', 'work_hours', etc.
  value: jsonb('value').notNull(), // Flexible JSON storage for any preference type
  confidenceScore: real('confidence_score').default(0.5), // 0-1, how confident AI is about this preference
  learnedAt: timestamp('learned_at').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow(),
});

// Proactive AI-generated insights and suggestions
export const aiInsights = pgTable('ai_insights', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  insightType: text('insight_type').notNull(), // 'opportunity', 'warning', 'suggestion', 'trend', etc.
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: jsonb('data').default({}), // Supporting data (metrics, charts, links)
  priority: integer('priority').default(1).notNull(), // 1-5, where 5 is highest
  dismissed: boolean('dismissed').default(false),
  actionTaken: boolean('action_taken').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // Optional expiration for time-sensitive insights
});

// OmniAssistant Relations
export const conversationsRelations = relations(conversations, ({ one }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, { fields: [userPreferences.userId], references: [users.id] }),
}));

export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
  user: one(users, { fields: [aiInsights.userId], references: [users.id] }),
}));