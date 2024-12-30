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

export type AiModel = typeof aiModels.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Framework = typeof frameworks.$inferSelect;
