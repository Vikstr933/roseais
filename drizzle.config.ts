import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Drizzle Configuration
 * Uses PostgreSQL exclusively (Supabase)
 */

if (!process.env.DATABASE_URL) {
  throw new Error('❌ DATABASE_URL is not set in environment variables!');
}

if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
  throw new Error('❌ DATABASE_URL must be a PostgreSQL connection string!');
}

export default {
  schema: "./db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  verbose: true,
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL
  }
} satisfies Config;
