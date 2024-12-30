import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const aiModels = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  creator: text("creator").notNull(),
  description: text("description").notNull(),
  capabilities: jsonb("capabilities").notNull(),
  releaseDate: timestamp("release_date").notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  documentationUrl: text("documentation_url"),
  parameters: jsonb("parameters").notNull(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  founded: timestamp("founded").notNull(),
  website: text("website").notNull(),
  logoUrl: text("logo_url"),
  products: jsonb("products").notNull(),
});

export const frameworks = pgTable("frameworks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  language: text("language").notNull(),
  githubUrl: text("github_url"),
  documentation: text("documentation"),
  features: jsonb("features").notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  agentConfig: jsonb("agent_config").notNull(),
  testCases: jsonb("test_cases"),
  collaborators: jsonb("collaborators").notNull(),
  status: text("status").notNull(),
});

export const agentScripts = pgTable("agent_scripts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  language: text("language").notNull(),
  version: text("version").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  scriptTemplate: text("script_template").notNull(),
  configSchema: jsonb("config_schema").notNull(),
  requirements: jsonb("requirements").notNull(),
  category: text("category").notNull(),
  tags: jsonb("tags").notNull(),
});

export type AiModel = typeof aiModels.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Framework = typeof frameworks.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type AgentScript = typeof agentScripts.$inferSelect;

export const insertAgentScriptSchema = createInsertSchema(agentScripts);
export const selectAgentScriptSchema = createSelectSchema(agentScripts);