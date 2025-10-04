'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.selectPromptChainSchema =
  exports.insertPromptChainSchema =
  exports.selectPromptTemplateSchema =
  exports.insertPromptTemplateSchema =
  exports.selectAgentSchema =
  exports.insertAgentSchema =
  exports.promptChainsRelations =
  exports.promptTemplatesRelations =
  exports.chainExecutions =
  exports.promptChains =
  exports.promptTemplates =
  exports.selectOrchestrationPatternSchema =
  exports.insertOrchestrationPatternSchema =
  exports.selectAgentScriptSchema =
  exports.insertAgentScriptSchema =
  exports.agents =
  exports.orchestrationPatterns =
  exports.agentScripts =
  exports.workspaces =
  exports.frameworks =
  exports.companies =
  exports.aiModels =
    void 0;
const pg_core_1 = require('drizzle-orm/pg-core');
const drizzle_orm_1 = require('drizzle-orm');
const drizzle_zod_1 = require('drizzle-zod');
exports.aiModels = (0, pg_core_1.pgTable)('ai_models', {
  id: (0, pg_core_1.serial)('id').primaryKey(),
  name: (0, pg_core_1.text)('name').notNull(),
  creator: (0, pg_core_1.text)('creator').notNull(),
  description: (0, pg_core_1.text)('description').notNull(),
  capabilities: (0, pg_core_1.jsonb)('capabilities').notNull(),
  releaseDate: (0, pg_core_1.timestamp)('release_date').notNull(),
  category: (0, pg_core_1.text)('category').notNull(),
  imageUrl: (0, pg_core_1.text)('image_url'),
  documentationUrl: (0, pg_core_1.text)('documentation_url'),
  parameters: (0, pg_core_1.jsonb)('parameters').notNull(),
});
exports.companies = (0, pg_core_1.pgTable)('companies', {
  id: (0, pg_core_1.serial)('id').primaryKey(),
  name: (0, pg_core_1.text)('name').notNull(),
  description: (0, pg_core_1.text)('description').notNull(),
  founded: (0, pg_core_1.timestamp)('founded').notNull(),
  website: (0, pg_core_1.text)('website').notNull(),
  logoUrl: (0, pg_core_1.text)('logo_url'),
  products: (0, pg_core_1.jsonb)('products').notNull(),
});
exports.frameworks = (0, pg_core_1.pgTable)('frameworks', {
  id: (0, pg_core_1.serial)('id').primaryKey(),
  name: (0, pg_core_1.text)('name').notNull(),
  description: (0, pg_core_1.text)('description').notNull(),
  language: (0, pg_core_1.text)('language').notNull(),
  githubUrl: (0, pg_core_1.text)('github_url'),
  documentation: (0, pg_core_1.text)('documentation'),
  features: (0, pg_core_1.jsonb)('features').notNull(),
});
exports.workspaces = (0, pg_core_1.pgTable)('workspaces', {
  id: (0, pg_core_1.serial)('id').primaryKey(),
  name: (0, pg_core_1.text)('name').notNull(),
  description: (0, pg_core_1.text)('description').notNull(),
  createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
  updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
  agentConfig: (0, pg_core_1.jsonb)('agent_config').notNull(),
  testCases: (0, pg_core_1.jsonb)('test_cases'),
  collaborators: (0, pg_core_1.jsonb)('collaborators').notNull(),
  status: (0, pg_core_1.text)('status').notNull(),
});
exports.agentScripts = (0, pg_core_1.pgTable)('agent_scripts', {
  id: (0, pg_core_1.serial)('id').primaryKey(),
  name: (0, pg_core_1.text)('name').notNull(),
  description: (0, pg_core_1.text)('description').notNull(),
  language: (0, pg_core_1.text)('language').notNull(),
  version: (0, pg_core_1.text)('version').notNull(),
  createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
  updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
  scriptTemplate: (0, pg_core_1.text)('script_template').notNull(),
  configSchema: (0, pg_core_1.jsonb)('config_schema').notNull(),
  requirements: (0, pg_core_1.jsonb)('requirements').notNull(),
  category: (0, pg_core_1.text)('category').notNull(),
  tags: (0, pg_core_1.jsonb)('tags').notNull(),
});
exports.orchestrationPatterns = (0, pg_core_1.pgTable)(
  'orchestration_patterns',
  {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description').notNull(),
    pattern: (0, pg_core_1.jsonb)('pattern').notNull(),
    taskDecomposition: (0, pg_core_1.jsonb)('task_decomposition').notNull(),
    agentRoles: (0, pg_core_1.jsonb)('agent_roles').notNull(),
    coordinationRules: (0, pg_core_1.jsonb)('coordination_rules').notNull(),
    category: (0, pg_core_1.text)('category').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
  }
);
exports.agents = (0, pg_core_1.pgTable)('agents', {
  id: (0, pg_core_1.serial)('id').primaryKey(),
  name: (0, pg_core_1.text)('name').notNull(),
  description: (0, pg_core_1.text)('description').notNull(),
  role: (0, pg_core_1.text)('role').notNull(),
  model: (0, pg_core_1.text)('model').notNull(),
  systemPrompt: (0, pg_core_1.text)('system_prompt').notNull(),
  temperature: (0, pg_core_1.text)('temperature').notNull(),
  customInstructions: (0, pg_core_1.jsonb)('custom_instructions'),
  capabilities: (0, pg_core_1.jsonb)('capabilities').notNull(),
  expertise: (0, pg_core_1.jsonb)('expertise').notNull(),
  frameworks: (0, pg_core_1.jsonb)('frameworks').notNull(),
  libraries: (0, pg_core_1.jsonb)('libraries').notNull(),
  bestPractices: (0, pg_core_1.jsonb)('best_practices').notNull(),
  createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
  updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
  isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
});
exports.insertAgentScriptSchema = (0, drizzle_zod_1.createInsertSchema)(
  exports.agentScripts
);
exports.selectAgentScriptSchema = (0, drizzle_zod_1.createSelectSchema)(
  exports.agentScripts
);
exports.insertOrchestrationPatternSchema = (0,
drizzle_zod_1.createInsertSchema)(exports.orchestrationPatterns);
exports.selectOrchestrationPatternSchema = (0,
drizzle_zod_1.createSelectSchema)(exports.orchestrationPatterns);
exports.promptTemplates = (0, pg_core_1.pgTable)('prompt_templates', {
  id: (0, pg_core_1.serial)('id').primaryKey(),
  name: (0, pg_core_1.text)('name').notNull(),
  description: (0, pg_core_1.text)('description').notNull(),
  template: (0, pg_core_1.text)('template').notNull(),
  variables: (0, pg_core_1.jsonb)('variables').notNull(),
  category: (0, pg_core_1.text)('category').notNull(),
  tags: (0, pg_core_1.jsonb)('tags').notNull(),
  createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
  updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
  bestPractices: (0, pg_core_1.jsonb)('best_practices').notNull(),
  version: (0, pg_core_1.text)('version').notNull(),
});
exports.promptChains = (0, pg_core_1.pgTable)('prompt_chains', {
  id: (0, pg_core_1.serial)('id').primaryKey(),
  name: (0, pg_core_1.text)('name').notNull(),
  description: (0, pg_core_1.text)('description').notNull(),
  steps: (0, pg_core_1.jsonb)('steps').notNull(), // Array of steps with template refs and variable mappings
  inputSchema: (0, pg_core_1.jsonb)('input_schema').notNull(),
  outputSchema: (0, pg_core_1.jsonb)('output_schema').notNull(),
  createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
  updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
  version: (0, pg_core_1.text)('version').notNull(),
  isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
  retryStrategy: (0, pg_core_1.jsonb)('retry_strategy'),
  errorHandling: (0, pg_core_1.jsonb)('error_handling'),
  timeout: (0, pg_core_1.integer)('timeout'),
  maxTokens: (0, pg_core_1.integer)('max_tokens'),
});
exports.chainExecutions = (0, pg_core_1.pgTable)('chain_executions', {
  id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
  chainId: (0, pg_core_1.integer)('chain_id')
    .notNull()
    .references(function () {
      return exports.promptChains.id;
    }),
  startedAt: (0, pg_core_1.timestamp)('started_at').notNull().defaultNow(),
  completedAt: (0, pg_core_1.timestamp)('completed_at'),
  status: (0, pg_core_1.text)('status').notNull(), // 'running', 'completed', 'failed'
  input: (0, pg_core_1.jsonb)('input').notNull(),
  output: (0, pg_core_1.jsonb)('output'),
  error: (0, pg_core_1.jsonb)('error'),
  stepResults: (0, pg_core_1.jsonb)('step_results').notNull(), // Detailed results from each step
  metrics: (0, pg_core_1.jsonb)('metrics'), // Performance metrics, token usage, etc
  agentId: (0, pg_core_1.integer)('agent_id').references(function () {
    return exports.agents.id;
  }),
});
exports.promptTemplatesRelations = (0, drizzle_orm_1.relations)(
  exports.promptTemplates,
  function (_a) {
    const many = _a.many;
    return {
      chains: many(exports.promptChains),
    };
  }
);
exports.promptChainsRelations = (0, drizzle_orm_1.relations)(
  exports.promptChains,
  function (_a) {
    const many = _a.many,
      one = _a.one;
    return {
      templates: many(exports.promptTemplates),
      executions: many(exports.chainExecutions),
      agent: one(exports.agents, {
        fields: [exports.promptChains.id],
        references: [exports.agents.id],
      }),
    };
  }
);
exports.insertAgentSchema = (0, drizzle_zod_1.createInsertSchema)(
  exports.agents
);
exports.selectAgentSchema = (0, drizzle_zod_1.createSelectSchema)(
  exports.agents
);
exports.insertPromptTemplateSchema = (0, drizzle_zod_1.createInsertSchema)(
  exports.promptTemplates
);
exports.selectPromptTemplateSchema = (0, drizzle_zod_1.createSelectSchema)(
  exports.promptTemplates
);
exports.insertPromptChainSchema = (0, drizzle_zod_1.createInsertSchema)(
  exports.promptChains
);
exports.selectPromptChainSchema = (0, drizzle_zod_1.createSelectSchema)(
  exports.promptChains
);
