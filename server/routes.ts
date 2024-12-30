import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { aiModels, companies, frameworks, workspaces, agentScripts, orchestrationPatterns } from "@db/schema";
import { eq, like, or } from "drizzle-orm";
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from "openai";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// OpenAI client for GPT-4 orchestration
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// DeepSeek API configuration
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

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


  // Agent Scripts routes
  app.get("/api/agent-scripts", async (req, res) => {
    try {
      const { category, language } = req.query;
      let query = db.select().from(agentScripts);

      if (category) {
        query = query.where(eq(agentScripts.category, category as string));
      }
      if (language) {
        query = query.where(eq(agentScripts.language, language as string));
      }

      const scripts = await query;
      res.json(scripts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent scripts" });
    }
  });

  app.get("/api/agent-scripts/:id", async (req, res) => {
    try {
      const script = await db
        .select()
        .from(agentScripts)
        .where(eq(agentScripts.id, parseInt(req.params.id)))
        .limit(1);

      if (!script[0]) {
        return res.status(404).json({ error: "Agent script not found" });
      }

      res.json(script[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent script" });
    }
  });

  app.get("/api/agent-scripts/:id/download", async (req, res) => {
    try {
      const [script] = await db
        .select()
        .from(agentScripts)
        .where(eq(agentScripts.id, parseInt(req.params.id)))
        .limit(1);

      if (!script) {
        return res.status(404).json({ error: "Agent script not found" });
      }

      // Generate the script with the user's configuration
      const config = req.query.config ? JSON.parse(req.query.config as string) : {};
      const generatedScript = script.scriptTemplate.replace(
        "{{CONFIG}}",
        JSON.stringify(config, null, 2)
      );

      res.setHeader("Content-Type", "text/plain");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${script.name.toLowerCase().replace(/\s+/g, "-")}.py`
      );
      res.send(generatedScript);
    } catch (error) {
      res.status(500).json({ error: "Failed to download agent script" });
    }
  });

  app.post("/api/agent-scripts", async (req, res) => {
    try {
      const result = await db.insert(agentScripts).values(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to create agent script" });
    }
  });

  // Orchestration Patterns routes
  app.get("/api/orchestration-patterns", async (req, res) => {
    try {
      const { category } = req.query;
      let query = db.select().from(orchestrationPatterns);

      if (category) {
        query = query.where(eq(orchestrationPatterns.category, category as string));
      }

      const patterns = await query;
      res.json(patterns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orchestration patterns" });
    }
  });

  app.post("/api/orchestration-patterns", async (req, res) => {
    try {
      const result = await db.insert(orchestrationPatterns).values(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to create orchestration pattern" });
    }
  });

  // Enhanced prompt generation endpoint that supports agent orchestration
  app.post("/api/prompts/generate", async (req, res) => {
    try {
      const { systemPrompt, userPrompt, model, orchestration } = req.body;

      let response;
      if (orchestration) {
        // Check if OpenAI client is available for orchestration
        if (!openai) {
          return res.status(400).json({ error: "OpenAI API key not configured for orchestration" });
        }

        // Use GPT-4 for orchestration decisions
        const orchestrationResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are an AI orchestrator. Analyze the task and determine:
                1. How to break it down into subtasks
                2. Which types of agents to assign to each subtask
                3. How the agents should coordinate
                4. What the success criteria are for each subtask
                Respond in JSON format with these components.`
            },
            {
              role: "user",
              content: userPrompt
            }
          ],
          response_format: { type: "json_object" }
        });

        const orchestrationPlan = JSON.parse(orchestrationResponse.choices[0].message.content);

        // Now execute the orchestration plan using the specified model
        if (model === 'claude-3') {
          response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: `${systemPrompt}\nOrchestration Plan: ${JSON.stringify(orchestrationPlan, null, 2)}\n\n${userPrompt}`
              }
            ],
          });

          res.json({ response: response.content[0].text, orchestrationPlan });
        } else if (model === 'deepseek') {
          const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: `${systemPrompt}\nOrchestration Plan: ${JSON.stringify(orchestrationPlan, null, 2)}`
                },
                {
                  role: "user",
                  content: userPrompt
                }
              ],
              temperature: 0.7,
              max_tokens: 1024
            })
          });

          if (!deepseekResponse.ok) {
            throw new Error(`DeepSeek API error: ${deepseekResponse.statusText}`);
          }

          const data = await deepseekResponse.json();
          res.json({ response: data.choices[0].message.content, orchestrationPlan });
        } else {
          res.status(400).json({ error: "Model not yet supported" });
        }
      } else {
        // Handle non-orchestration prompts as before
        if (model === 'claude-3') {
          response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: `${systemPrompt}\n\n${userPrompt}`
              }
            ],
          });

          res.json({ response: response.content[0].text });
        } else if (model === 'deepseek') {
          const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: systemPrompt
                },
                {
                  role: "user",
                  content: userPrompt
                }
              ],
              temperature: 0.7,
              max_tokens: 1024
            })
          });

          if (!deepseekResponse.ok) {
            throw new Error(`DeepSeek API error: ${deepseekResponse.statusText}`);
          }

          const data = await deepseekResponse.json();
          res.json({ response: data.choices[0].message.content });
        } else {
          res.status(400).json({ error: "Model not yet supported" });
        }
      }
    } catch (error) {
      console.error('Error generating response:', error);
      res.status(500).json({ error: "Failed to generate response" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}