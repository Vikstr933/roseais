import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { aiModels, companies, frameworks, workspaces } from "@db/schema";
import { eq, like, or, and } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  // GET routes
  app.get("/api/models", async (req, res) => {
    try {
      const { category, creator } = req.query;
      let query = db.select().from(aiModels);

      if (category) {
        query = query.where(eq(aiModels.category, category as string));
      }
      if (creator) {
        query = query.where(eq(aiModels.creator, creator as string));
      }

      const models = await query;
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch models" });
    }
  });

  app.get("/api/workspaces", async (req, res) => {
    try {
      const workspacesList = await db.select().from(workspaces);
      res.json(workspacesList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  app.get("/api/workspaces/:id", async (req, res) => {
    try {
      const workspace = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, parseInt(req.params.id)))
        .limit(1);

      if (!workspace[0]) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      res.json(workspace[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workspace" });
    }
  });

  app.get("/api/models/:id", async (req, res) => {
    try {
      const model = await db
        .select()
        .from(aiModels)
        .where(eq(aiModels.id, parseInt(req.params.id)))
        .limit(1);

      if (!model[0]) {
        return res.status(404).json({ error: "Model not found" });
      }

      res.json(model[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch model" });
    }
  });

  app.get("/api/models/search/:term", async (req, res) => {
    try {
      const searchTerm = `%${req.params.term}%`;
      const results = await db
        .select()
        .from(aiModels)
        .where(
          or(
            like(aiModels.name, searchTerm),
            like(aiModels.description, searchTerm)
          )
        );
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to search models" });
    }
  });

  app.get("/api/companies", async (_req, res) => {
    try {
      const allCompanies = await db.select().from(companies);
      res.json(allCompanies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch companies" });
    }
  });

  app.get("/api/frameworks", async (_req, res) => {
    try {
      const allFrameworks = await db.select().from(frameworks);
      res.json(allFrameworks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch frameworks" });
    }
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

  app.post("/api/workspaces", async (req, res) => {
    try {
      const newWorkspace = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
        collaborators: req.body.collaborators || [],
        status: 'active'
      };

      const result = await db.insert(workspaces).values(newWorkspace);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to create workspace" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}