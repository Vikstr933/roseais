import type { Express } from "express";
import { createServer, type Server } from "http";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { type InsertAgent, agents } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Schema for prompt generation request
const generatePromptSchema = z.object({
  systemPrompt: z.string(),
  userPrompt: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(1),
  enableOrchestration: z.boolean().default(false),
});

function validateColorContrast(colors: { background: string; text: string }): boolean {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Calculate relative luminance
  const getLuminance = (r: number, g: number, b: number) => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const bg = hexToRgb(colors.background);
  const text = hexToRgb(colors.text);

  if (!bg || !text) return false;

  const l1 = getLuminance(bg.r, bg.g, bg.b);
  const l2 = getLuminance(text.r, text.g, text.b);

  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return ratio >= 4.5; // WCAG AA standard for normal text
}

export function registerRoutes(app: Express): Server {
  // Route for generating responses with optional orchestration
  app.post("/api/prompts/generate", async (req, res) => {
    try {
      const validatedData = generatePromptSchema.parse(req.body);

      let response: string;
      let orchestrationPlan = null;

      if (validatedData.enableOrchestration) {
        // Generate orchestration plan first
        const planResponse = await anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `Please analyze this task and create a detailed orchestration plan. Break it down into subtasks and specify dependencies. Task: ${validatedData.userPrompt}`
          }],
        });

        try {
          orchestrationPlan = {
            subtasks: JSON.parse(planResponse.content[0].text.match(/\{[\s\S]*\}/)?.[0] || "[]")
          };
        } catch (e) {
          return res.status(503).json({
            error: "DeepSeek orchestration planning failed",
            suggestion: "Please try again in a few minutes or use single-agent mode for now"
          });
        }
      }

      // Generate the main response
      const messageResponse = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        messages: [
          {
            role: "system",
            content: validatedData.systemPrompt
          },
          {
            role: "user",
            content: validatedData.userPrompt
          }
        ],
      });

      response = messageResponse.content[0].text;

      // If it's a landing page request, validate color contrast
      if (validatedData.userPrompt.toLowerCase().includes("landing page")) {
        const colorMatches = response.match(/#[a-f0-9]{6}/gi) || [];
        const colors = {
          background: colorMatches[0] || "#ffffff",
          text: colorMatches[1] || "#000000"
        };

        if (!validateColorContrast(colors)) {
          // Adjust colors for better contrast
          const adjustedResponse = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [
              {
                role: "system",
                content: "You are a design expert. Please adjust the colors in the landing page to ensure proper contrast for accessibility (WCAG AA compliance)."
              },
              {
                role: "user",
                content: response
              }
            ],
          });
          response = adjustedResponse.content[0].text;
        }
      }

      res.json({
        response,
        orchestrationPlan
      });
    } catch (error: any) {
      console.error("Error in /api/prompts/generate:", error);
      res.status(400).json({
        error: error.message,
        suggestion: "Please check your input and try again"
      });
    }
  });

  // Route for updating agent status
  app.patch("/api/agents/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const { isActive } = req.body;

      const [updatedAgent] = await db
        .update(agents)
        .set({ isActive })
        .where(eq(agents.id, agentId))
        .returning();

      if (!updatedAgent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      res.json(updatedAgent);
    } catch (error: any) {
      console.error("Error in /api/agents/:id:", error);
      res.status(500).json({ error: "Failed to update agent status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}