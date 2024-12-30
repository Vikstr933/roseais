import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { aiModels, companies, frameworks } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  app.get("/api/models", async (_req, res) => {
    const models = await db.select().from(aiModels);
    res.json(models);
  });

  app.get("/api/models/:id", async (req, res) => {
    const model = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.id, parseInt(req.params.id)))
      .limit(1);
    res.json(model[0]);
  });

  app.get("/api/companies", async (_req, res) => {
    const allCompanies = await db.select().from(companies);
    res.json(allCompanies);
  });

  app.get("/api/frameworks", async (_req, res) => {
    const allFrameworks = await db.select().from(frameworks);
    res.json(allFrameworks);
  });

  const httpServer = createServer(app);
  return httpServer;
}
