CREATE TABLE `agent_scripts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`language` text NOT NULL,
	`version` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`script_template` text NOT NULL,
	`config_schema` text NOT NULL,
	`requirements` text NOT NULL,
	`category` text NOT NULL,
	`tags` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`role` text NOT NULL,
	`model` text NOT NULL,
	`system_prompt` text NOT NULL,
	`temperature` text NOT NULL,
	`custom_instructions` text,
	`capabilities` text NOT NULL,
	`expertise` text NOT NULL,
	`frameworks` text NOT NULL,
	`libraries` text NOT NULL,
	`best_practices` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`creator` text NOT NULL,
	`description` text NOT NULL,
	`capabilities` text NOT NULL,
	`release_date` text NOT NULL,
	`category` text NOT NULL,
	`image_url` text,
	`documentation_url` text,
	`parameters` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chain_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`chain_id` integer NOT NULL,
	`started_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`error` text,
	`step_results` text NOT NULL,
	`metrics` text,
	`agent_id` integer,
	FOREIGN KEY (`chain_id`) REFERENCES `prompt_chains`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `code_generation_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`input_prompt` text NOT NULL,
	`generated_code` text NOT NULL,
	`agent_id` integer,
	`workspace_id` integer,
	`status` text DEFAULT 'completed' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`founded` text NOT NULL,
	`website` text NOT NULL,
	`logo_url` text,
	`products` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `frameworks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`language` text NOT NULL,
	`github_url` text,
	`documentation` text,
	`features` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orchestration_patterns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`pattern` text NOT NULL,
	`task_decomposition` text NOT NULL,
	`agent_roles` text NOT NULL,
	`coordination_rules` text NOT NULL,
	`category` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompt_chains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`steps` text NOT NULL,
	`input_schema` text NOT NULL,
	`output_schema` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`version` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`retry_strategy` text,
	`error_handling` text,
	`timeout` integer,
	`max_tokens` integer
);
--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`template` text NOT NULL,
	`variables` text NOT NULL,
	`category` text NOT NULL,
	`tags` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`best_practices` text NOT NULL,
	`version` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`agent_config` text NOT NULL,
	`test_cases` text,
	`collaborators` text NOT NULL,
	`status` text NOT NULL
);
