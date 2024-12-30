import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { aiModels, companies, frameworks } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  // GET routes
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

  // POST routes for adding data
  app.post("/api/models", async (req, res) => {
    try {
      const result = await db.insert(aiModels).values(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to insert model" });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const result = await db.insert(companies).values(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to insert company" });
    }
  });

  app.post("/api/frameworks", async (req, res) => {
    try {
      const result = await db.insert(frameworks).values(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to insert framework" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}