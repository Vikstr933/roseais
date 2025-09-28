import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const aiModels = sqliteTable("ai_models", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  creator: text("creator").notNull(),
  description: text("description").notNull(),
  capabilities: text("capabilities").notNull(), // JSON stored as text
  releaseDate: text("release_date").notNull(), // ISO string
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  documentationUrl: text("documentation_url"),
  parameters: text("parameters").notNull(), // JSON stored as text
});

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  founded: text("founded").notNull(), // ISO string
  website: text("website").notNull(),
  logoUrl: text("logo_url"),
  products: text("products").notNull(), // JSON stored as text
});

export const frameworks = sqliteTable("frameworks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  language: text("language").notNull(),
  githubUrl: text("github_url"),
  documentation: text("documentation"),
  features: text("features").notNull(), // JSON stored as text
});

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  agentConfig: text("agent_config").notNull(), // JSON stored as text
  testCases: text("test_cases"), // JSON stored as text
  collaborators: text("collaborators").notNull(), // JSON stored as text
  status: text("status").notNull(),
});

export const agentScripts = sqliteTable("agent_scripts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  language: text("language").notNull(),
  version: text("version").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  scriptTemplate: text("script_template").notNull(),
  configSchema: text("config_schema").notNull(), // JSON stored as text
  requirements: text("requirements").notNull(), // JSON stored as text
  category: text("category").notNull(),
  tags: text("tags").notNull(), // JSON stored as text
});

export const orchestrationPatterns = sqliteTable("orchestration_patterns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  pattern: text("pattern").notNull(), // JSON stored as text
  taskDecomposition: text("task_decomposition").notNull(), // JSON stored as text
  agentRoles: text("agent_roles").notNull(), // JSON stored as text
  coordinationRules: text("coordination_rules").notNull(), // JSON stored as text
  category: text("category").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const agents = sqliteTable("agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  role: text("role").notNull(),
  model: text("model").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  temperature: text("temperature").notNull(),
  customInstructions: text("custom_instructions"), // JSON stored as text
  capabilities: text("capabilities").notNull(), // JSON stored as text
  expertise: text("expertise").notNull(), // JSON stored as text
  frameworks: text("frameworks").notNull(), // JSON stored as text
  libraries: text("libraries").notNull(), // JSON stored as text
  bestPractices: text("best_practices").notNull(), // JSON stored as text
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  isActive: integer("is_active").notNull().default(1), // 1 for true, 0 for false
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
export const insertOrchestrationPatternSchema = createInsertSchema(orchestrationPatterns);
export const selectOrchestrationPatternSchema = createSelectSchema(orchestrationPatterns);
export const promptTemplates = sqliteTable("prompt_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  template: text("template").notNull(),
  variables: text("variables").notNull(), // JSON stored as text
  category: text("category").notNull(),
  tags: text("tags").notNull(), // JSON stored as text
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  bestPractices: text("best_practices").notNull(), // JSON stored as text
  version: text("version").notNull(),
});

export const promptChains = sqliteTable("prompt_chains", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  steps: text("steps").notNull(), // JSON stored as text
  inputSchema: text("input_schema").notNull(), // JSON stored as text
  outputSchema: text("output_schema").notNull(), // JSON stored as text
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  version: text("version").notNull(),
  isActive: integer("is_active").notNull().default(1), // 1 for true, 0 for false
  retryStrategy: text("retry_strategy"), // JSON stored as text
  errorHandling: text("error_handling"), // JSON stored as text
  timeout: integer("timeout"),
  maxTokens: integer("max_tokens"),
});

export const chainExecutions = sqliteTable("chain_executions", {
  id: text("id").primaryKey(), // UUID as text
  chainId: integer("chain_id").notNull().references(() => promptChains.id),
  startedAt: text("started_at").notNull().default("CURRENT_TIMESTAMP"),
  completedAt: text("completed_at"),
  status: text("status").notNull(), // 'running', 'completed', 'failed'
  input: text("input").notNull(), // JSON stored as text
  output: text("output"), // JSON stored as text
  error: text("error"), // JSON stored as text
  stepResults: text("step_results").notNull(), // JSON stored as text
  metrics: text("metrics"), // JSON stored as text
  agentId: integer("agent_id").references(() => agents.id),
});

export const promptTemplatesRelations = relations(promptTemplates, ({ many }) => ({
  chains: many(promptChains),
}));

export const promptChainsRelations = relations(promptChains, ({ many, one }) => ({
  templates: many(promptTemplates),
  executions: many(chainExecutions),
  agent: one(agents, {
    fields: [promptChains.id],
    references: [agents.id],
  }),
}));

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type PromptChain = typeof promptChains.$inferSelect;
export type ChainExecution = typeof chainExecutions.$inferSelect;

export const codeGenerationSessions = sqliteTable("code_generation_sessions", {
  id: text("id").primaryKey(), // UUID as text
  title: text("title").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  inputPrompt: text("input_prompt").notNull(),
  generatedCode: text("generated_code").notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  status: text("status").notNull().default("completed"),
  metadata: text("metadata").default("{}").notNull(), // JSON stored as text
});

export type CodeGenerationSession = typeof codeGenerationSessions.$inferSelect;
export const insertCodeGenerationSessionSchema = createInsertSchema(codeGenerationSessions);
export const selectCodeGenerationSessionSchema = createSelectSchema(codeGenerationSessions);

export const insertAgentSchema = createInsertSchema(agents);
export const selectAgentSchema = createSelectSchema(agents);
export const insertPromptTemplateSchema = createInsertSchema(promptTemplates);
export const selectPromptTemplateSchema = createSelectSchema(promptTemplates);
export const insertPromptChainSchema = createInsertSchema(promptChains);
export const selectPromptChainSchema = createSelectSchema(promptChains);
