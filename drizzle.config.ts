import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config();

export default {
  schema: "./db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  verbose: true,
  strict: true,
  dbCredentials: {
    url: "./db/db.sqlite"
  }
} satisfies Config;
