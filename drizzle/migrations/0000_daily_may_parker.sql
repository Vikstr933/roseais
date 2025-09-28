CREATE TABLE IF NOT EXISTS "agent_scripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"language" text NOT NULL,
	"version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"script_template" text NOT NULL,
	"config_schema" jsonb NOT NULL,
	"requirements" jsonb NOT NULL,
	"category" text NOT NULL,
	"tags" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"role" text NOT NULL,
	"model" text NOT NULL,
	"system_prompt" text NOT NULL,
	"temperature" text NOT NULL,
	"custom_instructions" jsonb,
	"capabilities" jsonb NOT NULL,
	"expertise" jsonb NOT NULL,
	"frameworks" jsonb NOT NULL,
	"libraries" jsonb NOT NULL,
	"best_practices" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"creator" text NOT NULL,
	"description" text NOT NULL,
	"capabilities" jsonb NOT NULL,
	"release_date" timestamp NOT NULL,
	"category" text NOT NULL,
	"image_url" text,
	"documentation_url" text,
	"parameters" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chain_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"error" jsonb,
	"step_results" jsonb NOT NULL,
	"metrics" jsonb,
	"agent_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_generation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"input_prompt" text NOT NULL,
	"generated_code" text NOT NULL,
	"agent_id" integer,
	"workspace_id" integer,
	"status" text DEFAULT 'completed' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"founded" timestamp NOT NULL,
	"website" text NOT NULL,
	"logo_url" text,
	"products" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "frameworks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"language" text NOT NULL,
	"github_url" text,
	"documentation" text,
	"features" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orchestration_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"pattern" jsonb NOT NULL,
	"task_decomposition" jsonb NOT NULL,
	"agent_roles" jsonb NOT NULL,
	"coordination_rules" jsonb NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prompt_chains" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"steps" jsonb NOT NULL,
	"input_schema" jsonb NOT NULL,
	"output_schema" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"retry_strategy" jsonb,
	"error_handling" jsonb,
	"timeout" integer,
	"max_tokens" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prompt_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"template" text NOT NULL,
	"variables" jsonb NOT NULL,
	"category" text NOT NULL,
	"tags" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"best_practices" jsonb NOT NULL,
	"version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"agent_config" jsonb NOT NULL,
	"test_cases" jsonb,
	"collaborators" jsonb NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chain_executions" ADD CONSTRAINT "chain_executions_chain_id_prompt_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."prompt_chains"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chain_executions" ADD CONSTRAINT "chain_executions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_generation_sessions" ADD CONSTRAINT "code_generation_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_generation_sessions" ADD CONSTRAINT "code_generation_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
