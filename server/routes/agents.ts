import { Router } from 'express';
import { db } from '../../db';
import { agents } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { authenticateUser, optionalAuth } from '../middleware/auth';

import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Function to generate agent configuration based on user prompt using Claude
async function generateAgentConfig(prompt: string) {
  const systemPrompt = `You are an expert AI system designer. Analyze the following request for an AI agent and generate a complete configuration that will best serve the user's needs. Consider the specific requirements, domain expertise needed, and best practices for the task.

The configuration should include:
1. A clear name and description for the agent
2. The most appropriate role and AI model selection
3. A well-crafted system prompt that will guide the agent's behavior
4. Relevant capabilities and areas of expertise
5. Appropriate frameworks and libraries for the task
6. Important best practices to follow

Return ONLY a JSON object with these fields, no markdown formatting or additional text:
{
  "name": "string - a clear, descriptive name",
  "description": "string - detailed description of the agent's purpose",
  "role": "string - specific role/function of the agent",
  "model": "string - one of: claude-sonnet-4-5-20250929, claude-3-5-sonnet-20241022 (only current Claude models)",
  "systemPrompt": "string - clear instructions for the agent's behavior",
  "temperature": "string - value between 0 and 1",
  "capabilities": ["string array - key capabilities"],
  "expertise": ["string array - areas of expertise"],
  "frameworks": ["string array - relevant frameworks"],
  "libraries": ["string array - relevant libraries"],
  "bestPractices": ["string array - important best practices"]
}

Important: Return ONLY the JSON object, no markdown formatting, no explanations, no additional text.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate an AI agent configuration for this request: ${prompt}`,
        },
      ],
    });

    // Extract the response text from the message content
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';
    if (!responseText) {
      throw new Error('Failed to get valid response from Claude');
    }

    // Extract JSON content from the response, handling potential markdown formatting
    const jsonMatch =
      responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/) ||
      responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Could not find valid JSON in the response');
    }

    const jsonContent = jsonMatch[1] || jsonMatch[0];

    let config;
    try {
      config = JSON.parse(jsonContent);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      throw new Error('Failed to parse agent configuration');
    }

    // Ensure all required fields are present
    const requiredFields = [
      'name',
      'description',
      'role',
      'model',
      'systemPrompt',
      'temperature',
      'capabilities',
      'expertise',
      'frameworks',
      'libraries',
      'bestPractices',
    ];

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate model selection - only current Claude models
    const validModels = [
      'claude-sonnet-4-5-20250929',
      'claude-3-5-sonnet-20241022',
    ];
    if (!validModels.includes(config.model)) {
      config.model = 'claude-sonnet-4-5-20250929'; // Default to Claude 4.5 if invalid
    }

    // Validate temperature
    const temp = parseFloat(config.temperature);
    if (isNaN(temp) || temp < 0 || temp > 1) {
      config.temperature = '0.7'; // Default temperature if invalid
    }

    // Convert arrays to Record<string, boolean> format for capabilities, frameworks, libraries, bestPractices
    const booleanFields = [
      'capabilities',
      'frameworks',
      'libraries',
      'bestPractices',
    ];
    for (const field of booleanFields) {
      if (Array.isArray(config[field])) {
        config[field] = config[field].reduce(
          (acc: Record<string, boolean>, item: string) => {
            acc[item.trim()] = true;
            return acc;
          },
          {}
        );
      } else if (typeof config[field] === 'string') {
        config[field] = config[field]
          .split(',')
          .reduce((acc: Record<string, boolean>, item: string) => {
            acc[item.trim()] = true;
            return acc;
          }, {});
      } else {
        config[field] = {};
      }
    }

    // Handle expertise separately as it's Record<string, string>
    if (Array.isArray(config.expertise)) {
      config.expertise = config.expertise.reduce(
        (acc: Record<string, string>, item: string) => {
          acc[item.trim()] = 'expert';
          return acc;
        },
        {}
      );
    } else if (typeof config.expertise === 'string') {
      config.expertise = config.expertise
        .split(',')
        .reduce((acc: Record<string, string>, item: string) => {
          acc[item.trim()] = 'expert';
          return acc;
        }, {});
    } else {
      config.expertise = {};
    }

    return {
      ...config,
      isActive: true,
    };
  } catch (error) {
    console.error('Error generating agent configuration:', error);
    throw new Error('Failed to generate agent configuration');
  }
}

// Middleware to check if agent is active
const checkAgentStatus = async (req: any, res: any, next: any) => {
  try {
    const agentId = req.params.id || req.body.agentId;
    if (!agentId) return next();

    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, Number(agentId)));

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (!agent[0].isActive) {
      return res.status(403).json({
        error: 'Agent is inactive',
        message:
          'This agent has been deactivated and cannot be used in tasks. Please activate the agent first.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const router = Router();

// GET /api/agents - Get all agents (default system agents available to all users)
router.get('/agents', optionalAuth, async (req, res) => {
  try {
    console.log('GET /api/agents - Fetching all agents');
    const allAgents = await db.select().from(agents);

    // Transform the data to match the frontend format
    const transformedAgents = allAgents.map(agent => ({
      ...agent,
      capabilities:
        typeof agent.capabilities === 'string'
          ? JSON.parse(agent.capabilities)
          : agent.capabilities,
      expertise:
        typeof agent.expertise === 'string'
          ? JSON.parse(agent.expertise)
          : agent.expertise,
      frameworks:
        typeof agent.frameworks === 'string'
          ? JSON.parse(agent.frameworks)
          : agent.frameworks,
      libraries:
        typeof agent.libraries === 'string'
          ? JSON.parse(agent.libraries)
          : agent.libraries,
      bestPractices:
        typeof agent.bestPractices === 'string'
          ? JSON.parse(agent.bestPractices)
          : agent.bestPractices,
      customInstructions: agent.customInstructions
        ? typeof agent.customInstructions === 'string'
          ? JSON.parse(agent.customInstructions)
          : agent.customInstructions
        : null,
      enabledPlugins:
        typeof agent.enabledPlugins === 'string'
          ? JSON.parse(agent.enabledPlugins)
          : agent.enabledPlugins || [],
      isActive: Boolean(agent.isActive),
    }));

    console.log(
      `Fetched ${transformedAgents.length} agents for user:`,
      req.user?.id || 'anonymous'
    );
    res.json(transformedAgents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// GET /api/agents/personal-assistant - Get Personal Assistant agent
router.get('/agents/personal-assistant', optionalAuth, async (req, res) => {
  try {
    console.log('GET /api/agents/personal-assistant - Fetching Personal Assistant agent');

    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, 'personal-assistant'));

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Personal Assistant agent not found' });
    }

    // Transform the data to match the frontend format
    const transformedAgent = {
      ...agent[0],
      capabilities:
        typeof agent[0].capabilities === 'string'
          ? JSON.parse(agent[0].capabilities)
          : agent[0].capabilities,
      expertise:
        typeof agent[0].expertise === 'string'
          ? JSON.parse(agent[0].expertise)
          : agent[0].expertise,
      frameworks:
        typeof agent[0].frameworks === 'string'
          ? JSON.parse(agent[0].frameworks)
          : agent[0].frameworks,
      libraries:
        typeof agent[0].libraries === 'string'
          ? JSON.parse(agent[0].libraries)
          : agent[0].libraries,
      bestPractices:
        typeof agent[0].bestPractices === 'string'
          ? JSON.parse(agent[0].bestPractices)
          : agent[0].bestPractices,
      enabledPlugins:
        typeof agent[0].enabledPlugins === 'string'
          ? JSON.parse(agent[0].enabledPlugins)
          : agent[0].enabledPlugins || [],
      isActive: Boolean(agent[0].isActive),
    };

    console.log('Fetched Personal Assistant agent:', transformedAgent);
    res.json(transformedAgent);
  } catch (error) {
    console.error('Error fetching Personal Assistant agent:', error);
    res.status(500).json({ error: 'Failed to fetch Personal Assistant agent' });
  }
});

// GET /api/agents/:id - Get single agent by ID
router.get('/agents/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`GET /api/agents/${id} - Fetching agent`);

    // Support both numeric and text IDs
    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, isNaN(Number(id)) ? id : Number(id)));

    if (agent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Transform the data to match the frontend format
    const transformedAgent = {
      ...agent[0],
      capabilities:
        typeof agent[0].capabilities === 'string'
          ? JSON.parse(agent[0].capabilities)
          : agent[0].capabilities,
      expertise:
        typeof agent[0].expertise === 'string'
          ? JSON.parse(agent[0].expertise)
          : agent[0].expertise,
      frameworks:
        typeof agent[0].frameworks === 'string'
          ? JSON.parse(agent[0].frameworks)
          : agent[0].frameworks,
      libraries:
        typeof agent[0].libraries === 'string'
          ? JSON.parse(agent[0].libraries)
          : agent[0].libraries,
      bestPractices:
        typeof agent[0].bestPractices === 'string'
          ? JSON.parse(agent[0].bestPractices)
          : agent[0].bestPractices,
      customInstructions: agent[0].customInstructions
        ? typeof agent[0].customInstructions === 'string'
          ? JSON.parse(agent[0].customInstructions)
          : agent[0].customInstructions
        : null,
      enabledPlugins:
        typeof agent[0].enabledPlugins === 'string'
          ? JSON.parse(agent[0].enabledPlugins)
          : agent[0].enabledPlugins || [],
      isActive: Boolean(agent[0].isActive),
    };

    console.log('Fetched agent:', transformedAgent);
    res.json(transformedAgent);
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// POST /api/agents/generate - Generate agent from prompt
router.post('/agents/generate', authenticateUser, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const agentConfig = await generateAgentConfig(prompt);
    res.json(agentConfig);
  } catch (error) {
    console.error('Error generating agent config:', error);
    res.status(500).json({ error: 'Failed to generate agent configuration' });
  }
});

// POST /api/agents - Create a new agent
router.post('/agents', async (req, res) => {
  try {
    console.log('POST /api/agents - Creating new agent:', req.body);

    // Validate and transform the data
    const {
      name,
      description,
      role,
      model,
      systemPrompt,
      temperature,
      customInstructions,
      capabilities,
      expertise,
      frameworks,
      libraries,
      bestPractices,
    } = req.body;

    // Transform Record fields to ensure correct format
    const transformedData: typeof agents.$inferInsert = {
      name: name || '',
      description: description || '',
      role: role || '',
      model: model || '',
      systemPrompt: systemPrompt || '',
      temperature: temperature || '',
      customInstructions,
      capabilities: typeof capabilities === 'object' ? capabilities : {},
      expertise: typeof expertise === 'object' ? expertise : {},
      frameworks: typeof frameworks === 'object' ? frameworks : {},
      libraries: typeof libraries === 'object' ? libraries : {},
      bestPractices: typeof bestPractices === 'object' ? bestPractices : {},
      isActive: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date(),
    };

    // Validate required fields
    const requiredFields = [
      'name',
      'description',
      'role',
      'model',
      'systemPrompt',
      'temperature',
    ] as const;
    const missingFields = requiredFields.filter(
      field => !transformedData[field]
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        fields: missingFields,
      });
    }

    const newAgent = await db
      .insert(agents)
      .values(transformedData)
      .returning();

    console.log('Created new agent:', newAgent[0]);
    res.json(newAgent[0]);
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// PUT /api/agents/:id - Update an agent
router.put('/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const logger = req.app.locals.logger;

    await logger?.info('AgentManager', `Updating agent ${id}`, {
      agentId: id,
      updateFields: Object.keys(req.body),
      isActiveChange:
        req.body.isActive !== undefined
          ? `from ${req.body.isActive ? 'active' : 'inactive'} to ${!req.body.isActive ? 'active' : 'inactive'}`
          : undefined,
      timestamp: new Date().toISOString(),
    });

    console.log(`PUT /api/agents/${id} - Updating agent:`, req.body);

    // If we're deactivating an agent, check for any active tasks
    if (req.body.isActive === false) {
      // Here you would add logic to check if the agent is currently being used in any tasks
      // For now, we'll just proceed with deactivation
      console.log(`Deactivating agent ${id}`);
    }

    // Extract and transform the data
    const {
      name,
      description,
      role,
      model,
      systemPrompt,
      temperature,
      customInstructions,
      capabilities,
      expertise,
      frameworks,
      libraries,
      bestPractices,
      isActive,
    } = req.body;

    const updateData: Partial<typeof agents.$inferInsert> = {
      updatedAt: new Date(),
    };

    // Transform and include fields that are present in the request
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (role !== undefined) updateData.role = role;
    if (model !== undefined) updateData.model = model;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
    if (temperature !== undefined) updateData.temperature = temperature;
    if (customInstructions !== undefined)
      updateData.customInstructions = customInstructions;

    // Transform Record fields to ensure correct format
    if (capabilities !== undefined) {
      updateData.capabilities =
        typeof capabilities === 'object' ? capabilities : {};
    }
    if (expertise !== undefined) {
      updateData.expertise = typeof expertise === 'object' ? expertise : {};
    }
    if (frameworks !== undefined) {
      updateData.frameworks = typeof frameworks === 'object' ? frameworks : {};
    }
    if (libraries !== undefined) {
      updateData.libraries = typeof libraries === 'object' ? libraries : {};
    }
    if (bestPractices !== undefined) {
      updateData.bestPractices =
        typeof bestPractices === 'object' ? bestPractices : {};
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive ? 1 : 0;
      console.log(`Setting isActive to ${updateData.isActive} for agent ${id}`);
    }

    console.log('Update data:', updateData);

    const updatedAgent = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, Number(id)))
      .returning();

    if (updatedAgent.length === 0) {
      await logger?.warning(
        'AgentManager',
        `Agent ${id} not found for update`,
        {
          agentId: id,
          timestamp: new Date().toISOString(),
        }
      );
      return res.status(404).json({ error: 'Agent not found' });
    }

    await logger?.info('AgentManager', `Successfully updated agent ${id}`, {
      agentId: id,
      agentName: updatedAgent[0].name,
      updatedFields: Object.keys(updateData),
      timestamp: new Date().toISOString(),
    });

    res.json(updatedAgent[0]);
  } catch (error) {
    console.error('Error updating agent:', error);
    let errorMessage = 'Failed to update agent';

    // Check if it's a database error
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.message.includes('violates foreign key constraint')) {
        errorMessage =
          'Cannot update agent: it is being referenced by other components';
      } else if (error.message.includes('invalid input syntax')) {
        errorMessage = 'Invalid data format provided';
      }
    }

    res.status(500).json({
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/agents/:id - Delete an agent
router.delete('/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`DELETE /api/agents/${id} - Deleting agent`);

    const deletedAgent = await db
      .delete(agents)
      .where(eq(agents.id, Number(id)))
      .returning();

    if (deletedAgent.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    console.log('Deleted agent:', deletedAgent[0]);
    res.json({ message: 'Agent deleted successfully', agent: deletedAgent[0] });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// GET /api/agents/validate/:id - Validate if an agent can be used
router.get('/agents/validate/:id', checkAgentStatus, (req, res) => {
  res.json({ valid: true, message: 'Agent is active and can be used' });
});

export default router as Router;
