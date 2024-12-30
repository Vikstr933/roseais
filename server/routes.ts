import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { aiModels, companies, frameworks, workspaces, agentScripts, orchestrationPatterns, agents } from "@db/schema";
import { eq, like, or } from "drizzle-orm";
import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

  // POST endpoint for prompt generation and orchestration
  app.post("/api/prompts/generate", async (req, res) => {
    try {
      const { systemPrompt, userPrompt, model, orchestration } = req.body;

      let response;
      if (userPrompt.toLowerCase().includes("landing page") || userPrompt.toLowerCase().includes("link in bio")) {
        const systemInstructions = `You are a web development expert. When asked to create a landing page or link-in-bio page:
        1. Generate clean, modern HTML with inline Tailwind CSS
        2. Use semantic HTML5 elements
        3. Ensure the page is responsive
        4. Include placeholder images using https://placehold.co/
        5. Make the design visually appealing and professional
        6. Add smooth animations using Framer Motion
        7. Ensure proper color contrast - never use light text on light backgrounds or dark text on dark backgrounds
        8. Use a consistent color scheme
        9. Include proper viewport meta tags and content scaling
        10. Only output the HTML code without any markdown or explanation

        Here's the base template to start with:
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://unpkg.com/framer-motion@latest/dist/framer-motion.js"></script>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              /* Ensure text contrast */
              .text-on-dark { color: rgb(229 231 235); }
              .text-on-light { color: rgb(17 24 39); }
            </style>
        </head>
        <body>

        Respond with only the complete HTML code.`;

        if (model === 'claude-3') {
          response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content: `${systemInstructions}\n\n${userPrompt}`
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
                  content: systemInstructions
                },
                {
                  role: "user",
                  content: userPrompt
                }
              ],
              temperature: 0.7,
              max_tokens: 4096
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
      } else if (orchestration) {
        if (!DEEPSEEK_API_KEY) {
          return res.status(400).json({
            error: "DeepSeek API configuration required for orchestration",
            suggestion: "Please contact administrator to configure the DeepSeek API"
          });
        }

        let orchestrationPlan;
        try {
          // Use DeepSeek for orchestration planning
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
              temperature: 0.7,
              max_tokens: 1024
            })
          });

          if (!deepseekResponse.ok) {
            throw new Error(`DeepSeek API error: ${deepseekResponse.statusText}`);
          }

          const data = await deepseekResponse.json();
          orchestrationPlan = JSON.parse(data.choices[0].message.content);
        } catch (error) {
          console.error('Orchestration planning failed:', error);
          return res.status(503).json({
            error: "DeepSeek orchestration planning failed.",
            suggestion: "Please try again in a few minutes or use single-agent mode for now.",
            details: error.message
          });
        }

        // Execute the task with the specified model
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
        // Handle non-orchestration prompts
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
      let errorMessage = "Failed to generate response";
      let suggestion = "Please try again later";

      if (error.message.includes('rate limit')) {
        errorMessage = "DeepSeek API rate limit exceeded";
        suggestion = "Please try again in a few minutes or switch to a different model";
      }

      res.status(500).json({
        error: errorMessage,
        suggestion,
        details: error.message
      });
    }
  });

  // Agent Management Routes
  app.get("/api/agents", async (_req, res) => {
    try {
      const allAgents = await db.select().from(agents);
      res.json(allAgents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const result = await db.insert(agents).values({
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id", async (req, res) => {
    try {
      const result = await db
        .update(agents)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, parseInt(req.params.id)))
        .returning();

      if (!result[0]) {
        return res.status(404).json({ error: "Agent not found" });
      }

      res.json(result[0]);
    } catch (error) {
      console.error('Failed to update agent:', error);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    try {
      await db
        .update(agents)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(agents.id, parseInt(req.params.id)));
      res.json({ message: "Agent deactivated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to deactivate agent" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}