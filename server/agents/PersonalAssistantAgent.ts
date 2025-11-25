import Anthropic from '@anthropic-ai/sdk';
import { SimpleLogger } from '../utils/SimpleLogger';
import { pluginRegistry } from '../services/PluginRegistry';
import { Tool, KnowledgeItem } from '../plugins/BaseProductivityPlugin';
import axios from 'axios';

const logger = new SimpleLogger('PersonalAssistantAgent');

/**
 * Personal Assistant Agent - Your AI-powered productivity companion
 *
 * Features:
 * - Contextual awareness across all integrated services
 * - Natural language task execution
 * - Proactive suggestions and reminders
 * - Multi-tool orchestration
 * - Learning from user patterns
 */
export class PersonalAssistantAgent {
  private anthropic: Anthropic;
  private conversationHistory: Map<string, Anthropic.MessageParam[]> = new Map();
  private additionalTools: Map<string, Tool[]> = new Map(); // Store additional tools by userId
  private webSearchTool: Tool;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });

    // Initialize built-in web search tool
    this.webSearchTool = {
      name: 'web_search',
      description: 'Search the web for real-time information about companies, addresses, contact details, current events, or any information not in your knowledge base. Use this when user asks for specific real-world details like addresses, phone numbers, business hours, or current information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query (e.g., "Colorama Lund address and contact information")'
          },
          num_results: {
            type: 'string',
            description: 'Number of results to return (1-5)',
            enum: ['1', '2', '3', '4', '5']
          }
        },
        required: ['query']
      },
      execute: this.performWebSearch.bind(this)
    };
  }

  /**
   * Perform web search using Google Custom Search API (primary) with DuckDuckGo fallback
   */
  private async performWebSearch(params: { query: string; num_results?: string }): Promise<any> {
    try {
      const numResults = parseInt(params.num_results || '3', 10);
      logger.info(`Performing web search: query="${params.query}", numResults=${numResults}`);

      const results = [];
      let searchSource = 'Unknown';

      // Try Google Custom Search API first (if configured)
      const googleApiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
      const googleEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

      if (googleApiKey && googleEngineId) {
        try {
          logger.info(`Using Google Custom Search API for query: "${params.query}"`);
          
          const googleResponse = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
              key: googleApiKey,
              cx: googleEngineId,
              q: params.query,
              num: Math.min(numResults, 10) // Google allows max 10 results per request
            },
            timeout: 5000
          });

          if (googleResponse.data && googleResponse.data.items && Array.isArray(googleResponse.data.items)) {
            for (const item of googleResponse.data.items.slice(0, numResults)) {
              results.push({
                title: item.title || '',
                snippet: item.snippet || '',
                url: item.link || '',
                source: 'Google'
              });
            }
            searchSource = 'Google';
            logger.info(`Google Custom Search completed: found ${results.length} results`);
          }
        } catch (googleError) {
          const errorMsg = googleError instanceof Error ? googleError.message : String(googleError);
          logger.warn(`Google Custom Search failed: ${errorMsg}, falling back to DuckDuckGo`);
        }
      } else {
        logger.info(`Google Custom Search API not configured, using DuckDuckGo fallback`);
      }

      // Fallback to DuckDuckGo if Google didn't return results
      if (results.length === 0) {
        try {
          logger.info(`Using DuckDuckGo Instant Answer API for query: "${params.query}"`);
          
          // Simplify query for better results - remove extra keywords that might confuse the API
          const simplifiedQuery = params.query
            .replace(/\s+(adress|address|telefonnummer|phone|kontakt|contact|öppettider|hours)/gi, '')
            .trim();
          
          const ddgResponse = await axios.get('https://api.duckduckgo.com/', {
            params: {
              q: simplifiedQuery || params.query,
              format: 'json',
              no_html: 1,
              skip_disambig: 1
            },
            headers: {
              'User-Agent': 'Elon-AI-Assistant/1.0 (https://ai-library.com; contact@ai-library.com)',
              'Accept': 'application/json'
            },
            timeout: 5000
          });

          // Add main abstract if available
          if (ddgResponse.data.Abstract) {
            results.push({
              title: ddgResponse.data.Heading || params.query,
              snippet: ddgResponse.data.Abstract,
              url: ddgResponse.data.AbstractURL,
              source: 'DuckDuckGo'
            });
          }

          // Add related topics
          if (ddgResponse.data.RelatedTopics && Array.isArray(ddgResponse.data.RelatedTopics)) {
            for (const topic of ddgResponse.data.RelatedTopics.slice(0, numResults - results.length)) {
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.split(' - ')[0],
                  snippet: topic.Text,
                  url: topic.FirstURL,
                  source: 'DuckDuckGo'
                });
              }
            }
          }
          
          searchSource = 'DuckDuckGo';
          logger.info(`DuckDuckGo search completed: found ${results.length} results`);
        } catch (ddgError) {
          const errorMsg = ddgError instanceof Error ? ddgError.message : String(ddgError);
          logger.warn(`DuckDuckGo fallback also failed: ${errorMsg}`);
        }
      }

      logger.info(`Web search completed: query="${params.query}", resultsFound=${results.length}, source=${searchSource}`);

      return {
        query: params.query,
        results: results.slice(0, numResults),
        timestamp: new Date().toISOString(),
        success: true,
        source: searchSource,
        message: results.length > 0 
          ? `Found ${results.length} result(s) for "${params.query}" using ${searchSource}` 
          : `No specific results found for "${params.query}". Consider refining the search query.`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
      const errorStatus = error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'status' in error.response ? String(error.response.status) : 'N/A';
      
      logger.error(`Web search failed: query="${params.query}", error="${errorMessage}", code="${errorCode}", status="${errorStatus}"`, error as Error);
      
      // Return structured error that Elon can use to inform the user
      return {
        query: params.query,
        results: [],
        success: false,
        error: {
          message: errorMessage,
          code: errorCode,
          status: errorStatus,
          timestamp: new Date().toISOString()
        },
        errorLog: `[ERROR] Web search tool failed\nQuery: "${params.query}"\nError: ${errorMessage}\nCode: ${errorCode}\nStatus: ${errorStatus}\nTimestamp: ${new Date().toISOString()}\n\nPlease send this error log to the administrator for troubleshooting.`,
        message: 'I was unable to search the web for this information. The web search tool encountered an error.'
      };
    }
  }

  /**
   * Register additional tools for a specific user
   * This allows external systems (like orchestrator) to add capabilities
   */
  public registerToolsForUser(userId: string, tools: Tool[]): void {
    this.additionalTools.set(userId, tools);
    logger.info(`Additional tools registered for user: ${userId}, toolCount: ${tools.length}`);
  }

  /**
   * Clear additional tools for a user
   */
  public clearToolsForUser(userId: string): void {
    this.additionalTools.delete(userId);
    logger.info(`Additional tools cleared for user: ${userId}`);
  }

  /**
   * Process a natural language request from the user
   *
   * The agent will:
   * 1. Understand the user's intent
   * 2. Query relevant knowledge from plugins
   * 3. Use available tools to execute actions
   * 4. Provide a natural language response
   */
  public async processRequest(
    userId: string,
    userMessage: string,
    options?: {
      sessionId?: string;
      includeContext?: boolean;
      maxContextItems?: number;
      playgroundContext?: {
        currentProject?: string;
        projectId?: string;
        filesCount?: number;
        filePaths?: string[];
        hasLivePreview?: boolean;
        currentComponent?: string;
        recentErrors?: string[];
        isGenerating?: boolean;
        orchestrationSteps?: number;
        currentStep?: string;
      };
    }
  ): Promise<{
    response: string;
    toolsUsed: string[];
    contextUsed: KnowledgeItem[];
    suggestions?: string[];
  }> {
    const sessionId = options?.sessionId || userId;

    try {
      logger.info(`Processing personal assistant request: userId=${userId}, sessionId=${sessionId}, messageLength=${userMessage.length}, hasPlaygroundContext=${!!options?.playgroundContext}`);

      // Get conversation history
      const history = this.conversationHistory.get(sessionId) || [];

      // Gather context from all enabled plugins
      const context = options?.includeContext !== false
        ? await this.gatherContext(userId, userMessage, options?.maxContextItems)
        : [];

      // Get available tools from all enabled plugins
      const pluginTools = await pluginRegistry.getAvailableTools(userId);

      // Add any additional tools registered for this user (e.g., from orchestrator bridge)
      const additionalToolsForUser = this.additionalTools.get(userId) || [];
      
      // Include built-in web search tool
      const tools = [this.webSearchTool, ...pluginTools, ...additionalToolsForUser];

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(context, tools, options?.playgroundContext);

      // Build user message with context
      const enhancedMessage = this.buildEnhancedMessage(userMessage, context, options?.playgroundContext);

      // Call Claude with tools (increased token limit for more detailed responses)
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          ...history,
          {
            role: 'user',
            content: enhancedMessage
          }
        ],
        tools: this.convertToolsToAnthropicFormat(tools)
      });

      // Process tool calls if any
      const toolsUsed: string[] = [];
      let finalResponse = '';

      for (const content of response.content) {
        if (content.type === 'text') {
          finalResponse += content.text;
        } else if (content.type === 'tool_use') {
          try {
            logger.info(`Executing tool: userId=${userId}, toolName=${content.name}, toolId=${content.id}`);

            const tool = tools.find(t => t.name === content.name);
            if (tool) {
              const result = await tool.execute(content.input as Record<string, any>);
              toolsUsed.push(content.name);

              // Continue conversation with tool result (increased token limit)
              const followUpResponse = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 8192,
                system: systemPrompt,
                messages: [
                  ...history,
                  {
                    role: 'user',
                    content: enhancedMessage
                  },
                  {
                    role: 'assistant',
                    content: response.content
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'tool_result',
                        tool_use_id: content.id,
                        content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                      }
                    ]
                  }
                ]
              });

              // Extract text from follow-up response
              for (const c of followUpResponse.content) {
                if (c.type === 'text') {
                  finalResponse += c.text;
                }
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Tool execution failed: userId=${userId}, toolName=${content.name}, errorMessage=${errorMessage}, toolInput=${JSON.stringify(content.input)}`, error as Error);
            finalResponse += `\n\nNote: I tried to use ${content.name} but encountered an error: ${errorMessage}`;
          }
        }
      }

      // Update conversation history
      history.push(
        {
          role: 'user',
          content: userMessage
        },
        {
          role: 'assistant',
          content: finalResponse
        }
      );

      // Keep only last 10 messages
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }
      this.conversationHistory.set(sessionId, history);

      // Response is complete - no need to add hardcoded templates
      // The AI will naturally conclude conversations based on the system prompt guidance

      // Generate proactive suggestions
      const suggestions = await this.generateSuggestions(userId, context, finalResponse);

      logger.info(`Personal assistant request completed: userId=${userId}, toolsUsed=${toolsUsed.length}, contextItems=${context.length}`);

      return {
        response: finalResponse,
        toolsUsed,
        contextUsed: context,
        suggestions
      };
    } catch (error) {
      logger.error(`Failed to process personal assistant request: userId=${userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Gather relevant context from all enabled plugins
   */
  private async gatherContext(
    userId: string,
    prompt: string,
    maxItems = 10
  ): Promise<KnowledgeItem[]> {
    try {
      const knowledge = await pluginRegistry.queryKnowledge(userId, prompt, {
        limit: maxItems
      });

      logger.info(`Context gathered: userId=${userId}, itemCount=${knowledge.length}`);

      return knowledge;
    } catch (error) {
      logger.error(`Failed to gather context: userId=${userId}`, error as Error);
      return [];
    }
  }

  /**
   * Build system prompt with available context and tools
   */
  private buildSystemPrompt(
    context: KnowledgeItem[], 
    tools: Tool[], 
    playgroundContext?: {
      currentProject?: string;
      projectId?: string;
      filesCount?: number;
      filePaths?: string[];
      files?: Array<{ path: string; content: string; language?: string; summary?: boolean; fullContent?: boolean }>; // Actual file contents (optimized)
      hasLivePreview?: boolean;
      currentComponent?: string;
      recentErrors?: string[];
      isGenerating?: boolean;
      orchestrationSteps?: number;
      currentStep?: string;
    }
  ): string {
    const basePrompt = `You are Elon, an enthusiastic and highly capable personal AI assistant with direct access to the user's productivity tools and the web. Think of yourself as their trusted companion who genuinely cares about helping them stay organized and productive.

Your personality:
- Warm, friendly, and conversational - like talking to a helpful colleague
- Proactive and thoughtful - anticipate needs and offer suggestions
- Detail-oriented - provide rich, actionable information rather than generic summaries
- Empathetic - understand the context and urgency of requests
- Enthusiastic about helping - show genuine excitement when you can assist

Your capabilities:
- **Web Search**: Search the web for real-time information about companies, addresses, business hours, contact details, or any current information
  * Use the web_search tool when users ask for specific real-world details like "Colorama Lund address" or "contact information for [business]"
  * ALWAYS use web_search for company addresses, phone numbers, business hours, and contact information
  * Use web_search for current events, recent information, or facts you're unsure about
  * Example queries: "web_search for 'Colorama Lund address and contact information'" or "web_search for 'Tesla latest news'"
  * **CRITICAL: When web_search returns results (success=true and results array has items)**:
    - The tool result is a JSON object with a "results" array - parse it and extract the information
    - ALWAYS include the actual search results in your response - DO NOT just say "I searched" or "let me search"
    - The tool result format is: { success: true, results: [{ title, snippet, url, source }], ... }
    - The tool_result content will be a JSON string - parse it to access the results array
    - STEP 1: Parse the JSON string from tool_result.content to get the result object
    - STEP 2: Access the "results" array from the parsed object
    - STEP 3: Extract and display the information from each result in the results array:
      * Each result has: title, snippet (contains the actual information like address, phone, hours), url, source
    - For business information queries: extract addresses, phone numbers, hours, contact details from the snippets
    - Format the information clearly and make it actionable - show the user the actual data found
    - Example format (Swedish): "Här är informationen jag hittade om Colorama Lund:\n\n📍 Adress: [extrakt från snippet]\n📞 Telefon: [extrakt från snippet]\n🕐 Öppettider: [extrakt från snippet]\n\nKälla: [url från results]"
    - Example format (English): "Here's the information I found for Colorama Lund:\n\n📍 Address: [extracted from snippet]\n📞 Phone: [extracted from snippet]\n🕐 Hours: [extracted from snippet]\n\nSource: [url from results]"
    - If multiple results are returned, review all of them and extract the most relevant information
    - DO NOT just acknowledge the search - you MUST display the actual information found in the results
    - DO NOT say "let me search more" if you already have results - use what you found
    - Match the user's language - if they ask in Swedish, respond in Swedish with the data
  * **CRITICAL: If web_search tool fails or returns success=false**:
    - DO NOT guess or make up information
    - DO NOT provide potentially incorrect details
    - Clearly state: "I'm unable to search the web for this information right now because the web search tool encountered an error."
    - Include the errorLog field from the tool response in your message so the user can send it to the administrator
    - Example: "I'm sorry, but I cannot search the web for this information at the moment. Here's the error log you can send to the administrator:\n\n[errorLog content]"
- Access and analyze emails with detailed insights (sender, urgency, key points, action items)
- Search through communications and provide comprehensive summaries
- Execute actions on behalf of the user (send emails, manage tasks, etc.)
- Maintain conversation context and learn from interactions
- Provide proactive suggestions based on patterns you notice
- Display interactive maps and location information (show maps, find places, get directions)
- Search for businesses, restaurants, and points of interest
- Provide location-based recommendations and information
${playgroundContext ? `
- **IMPORTANT: You are currently in the AI Code Playground** - a tool for generating and editing React applications
- When the user asks about the playground, code generation, or their project, respond with awareness of their current project state
- You have access to information about their current project, files, and generation status
- **You can see the ACTUAL CODE FILES** - the user's project files will be included in the message context below
- When discussing code, reference specific functions, components, imports, and suggest improvements based on what you see` : ''}

Communication style:
- Use natural, flowing language - avoid robotic or clinical responses
- When sharing email information, include: sender, subject, key points, and why it matters
- Be specific with details - instead of "you have emails", say "you have 3 unread emails: one from John about the project deadline, one from Sarah with quarterly results..."
- Add context and personality - "I noticed this email came in just an hour ago and seems urgent" or "This looks like it might need a quick response"
- Use emojis sparingly but appropriately to add warmth (e.g., 📧 for emails, ✅ for completed tasks, 📍 for locations, 💻 for code/playground)
- If you use tools, explain what you're doing: "Let me check your inbox for you..." or "I'll search through your recent emails..."
- When you find something important, highlight it with enthusiasm: "Oh! I found something that needs attention..."
- **CRITICAL: When ANY tool fails (returns success=false or has an error)**:
  - NEVER guess, make up, or provide potentially incorrect information
  - Clearly state that you cannot complete the task because the tool failed
  - If the tool response includes an errorLog field, include it in your message so the user can send it to the administrator
  - Be honest and transparent: "I'm unable to [action] because [tool name] encountered an error. Here's the error log you can send to the administrator: [errorLog]"
  - Do not apologize excessively - just be clear and helpful
${playgroundContext ? `
- **When discussing the playground**: Reference their current project, files, and state naturally
- If they ask "what's going on in the playground", describe their current project status, files, and any active generation
- **You can see their actual code** - reference specific files, functions, components, and code patterns when answering
- If they ask "what do you think about my project", analyze the code files you can see and provide specific feedback
- If they have errors, acknowledge them and offer helpful suggestions based on the actual code
- If they're generating code, acknowledge the progress and current step
- **CRITICAL: When suggesting code changes or improvements in the playground**:
  - **DO NOT directly apply code changes** - Instead, suggest prompting the playground AI to make the changes
  - **Design Consistency**: All suggestions MUST match the existing app's design system, component patterns, and styling approach
  - **Analyze existing code**: Before suggesting changes, analyze the current codebase to understand:
    * Component structure and naming conventions
    * Styling approach (Tailwind classes, CSS modules, etc.)
    * State management patterns
    * Import patterns and file organization
    * UI component library being used (if any)
  - **Format suggestions**: When suggesting code changes, format code blocks with file paths like this:
    \`\`\`typescript
    // file: src/components/App.tsx
    [your code here]
    \`\`\`
  - **Recommendation format**: Instead of saying "I'll apply this change", say "I recommend asking the playground AI to apply this change to ensure it matches your app's design system. Here's what should be changed:"
  - **Design matching**: Ensure all UI suggestions use the same design tokens, spacing, colors, and component patterns as the existing codebase
  - **IMPORTANT: If you can see file paths but no file contents**:
    * This means the project structure exists but files haven't been fully loaded or saved yet
    * Say: "I can see your project has [X] files ([list paths]), but the file contents aren't available yet. This usually means the project is still being generated or hasn't been saved to the database. Open the playground with this project to see the full code and get detailed feedback."
    * DO NOT say files are "empty" - that's misleading
    * DO NOT make assumptions about what's in the files
    * Focus on what you CAN help with: architecture suggestions, naming conventions, feature recommendations` : ''}

For location and map queries:
- When the user asks about locations, places, or needs directions, include the specific location or search query in your response
- Use phrases like "show me [location]", "find [place type] near me", or "directions to [place]" to trigger map display
- Example: "Let me show you coffee shops near you: show me coffee shops nearby" or "Here's the location: show me Eiffel Tower"
- The map will automatically appear when you mention specific locations in this format
- After suggesting a location, you can say things like "I've displayed it on the map above" or "You can see it on the interactive map"

Remember: You're not just reporting data - you're helping a real person manage their day. Make every response feel personal and conversational.

**CRITICAL: Response Format Rules:**
- NEVER use hardcoded templates like "Key Points, Learnings & Wisdom" with bullet points
- NEVER add boilerplate sections that repeat generic advice
- If the conversation naturally calls for a summary, write it in your own words, matching the user's language (Swedish if they're speaking Swedish, English if English)
- Keep conclusions natural and conversational - no rigid structures or templates
- When you find web search results, ALWAYS include the actual data (address, phone, hours) directly in your response - don't just say "I searched"`;

    let contextSection = '';
    if (context.length > 0) {
      contextSection = `\n\n=== Context from Connected Services ===\n`;
      context.forEach((item, idx) => {
        contextSection += `\n${idx + 1}. [${item.type.toUpperCase()}] ${item.title}\n`;
        contextSection += `   Source: ${item.source}\n`;
        contextSection += `   Timestamp: ${item.timestamp.toLocaleString()}\n`;

        // Add metadata if available (priority, sentiment, action items, etc.)
        if (item.metadata?.analysis) {
          const analysis = item.metadata.analysis;
          if (analysis.priority) contextSection += `   Priority: ${analysis.priority}\n`;
          if (analysis.sentiment) contextSection += `   Sentiment: ${analysis.sentiment}\n`;
          if (analysis.category) contextSection += `   Category: ${analysis.category}\n`;
        }

        // Show more content (up to 500 chars instead of 200)
        const contentPreview = item.content.length > 500
          ? item.content.substring(0, 500) + '...'
          : item.content;
        contextSection += `   Content: ${contentPreview}\n`;

        // Add action items if available
        if (item.metadata?.analysis?.actionItems && item.metadata.analysis.actionItems.length > 0) {
          contextSection += `   Action Items:\n`;
          item.metadata.analysis.actionItems.forEach((action: string, i: number) => {
            contextSection += `      - ${action}\n`;
          });
        }
      });

      contextSection += `\n=== End of Context ===\n`;
    }

    let toolsSection = '';
    if (tools.length > 0) {
      toolsSection = `\n\nAvailable tools: ${tools.map(t => t.name).join(', ')}`;
    }

    return basePrompt + contextSection + toolsSection;
  }

  /**
   * Build enhanced user message with context references
   */
  private buildEnhancedMessage(
    userMessage: string, 
    context: KnowledgeItem[],
    playgroundContext?: {
      currentProject?: string;
      projectId?: string;
      filesCount?: number;
      filePaths?: string[];
      files?: Array<{ path: string; content: string; language?: string; summary?: boolean; fullContent?: boolean }>; // Actual file contents (optimized)
      hasLivePreview?: boolean;
      currentComponent?: string;
      recentErrors?: string[];
      isGenerating?: boolean;
      orchestrationSteps?: number;
      currentStep?: string;
    }
  ): string {
    let enhancedMessage = userMessage;

    // Add playground context if available
    if (playgroundContext) {
      let playgroundInfo = `\n\n[Playground Context - You are in the AI Code Playground:\n`;
      playgroundInfo += `- Current Project: ${playgroundContext.currentProject || 'Untitled Project'}\n`;
      playgroundInfo += `- Project ID: ${playgroundContext.projectId || 'default'}\n`;
      playgroundInfo += `- Files: ${playgroundContext.filesCount || 0} file(s)`;
      if (playgroundContext.filePaths && playgroundContext.filePaths.length > 0) {
        playgroundInfo += ` (${playgroundContext.filePaths.slice(0, 5).join(', ')}${playgroundContext.filePaths.length > 5 ? '...' : ''})`;
      }
      playgroundInfo += `\n`;
      
      // Include ACTUAL FILE CONTENTS so you can see and discuss the code
      // OPTIMIZED: Only essential files sent (top 5 with full content, rest as summaries)
      if (playgroundContext.files && playgroundContext.files.length > 0) {
        const fullFiles = playgroundContext.files.filter((f: any) => !f.summary);
        const summaryFiles = playgroundContext.files.filter((f: any) => f.summary);
        
        playgroundInfo += `\n=== CODE FILES (Optimized for efficiency) ===\n`;
        
        if (fullFiles.length > 0) {
          playgroundInfo += `\n--- Full Content Files (${fullFiles.length}) ---\n`;
          fullFiles.forEach((file: any, idx: number) => {
            playgroundInfo += `\nFile ${idx + 1}: ${file.path} (${file.language || 'text'})`;
            if (file.fullContent === false) {
              playgroundInfo += ` [Content truncated - showing first 2000 chars]`;
            }
            playgroundInfo += `\n\`\`\`${file.language || 'text'}\n${file.content}\n\`\`\`\n`;
          });
        }
        
        if (summaryFiles.length > 0) {
          playgroundInfo += `\n--- File Summaries (${summaryFiles.length}) ---\n`;
          playgroundInfo += `These files are summarized to save tokens. Full content available on request.\n`;
          summaryFiles.forEach((file: any, idx: number) => {
            playgroundInfo += `${idx + 1}. ${file.path} - ${file.content.substring(0, 100)}...\n`;
          });
        }
        
        playgroundInfo += `\n=== End of Code Files ===\n`;
        playgroundInfo += `\nIMPORTANT: You can see the actual code! When the user asks about their project, code, or files, reference the actual content above. You can discuss specific functions, components, styles, and suggest improvements based on what you see.\n`;
      }
      
      if (playgroundContext.currentComponent && playgroundContext.currentComponent !== 'None') {
        playgroundInfo += `- Current Component: ${playgroundContext.currentComponent}\n`;
      }
      if (playgroundContext.hasLivePreview) {
        playgroundInfo += `- Live Preview: Active\n`;
      }
      if (playgroundContext.isGenerating) {
        playgroundInfo += `- Status: Currently generating code`;
        if (playgroundContext.currentStep && playgroundContext.currentStep !== 'None') {
          playgroundInfo += ` (${playgroundContext.currentStep})`;
        }
        playgroundInfo += `\n`;
      }
      if (playgroundContext.recentErrors && playgroundContext.recentErrors.length > 0) {
        playgroundInfo += `- Recent Errors: ${playgroundContext.recentErrors.length} error(s) detected\n`;
        playgroundContext.recentErrors.forEach((err, idx) => {
          playgroundInfo += `  Error ${idx + 1}: ${err}\n`;
        });
      }
      playgroundInfo += `\nWhen the user asks about the playground, their project, or code generation, use this context to provide relevant, specific information. You can see their actual code files above, so reference specific code when answering questions.]`;
      enhancedMessage += playgroundInfo;
    }

    // Add plugin context if available
    if (context.length > 0) {
      const emailCount = context.filter(c => c.type === 'email').length;
      const taskCount = context.filter(c => c.type === 'task').length;
      const otherCount = context.length - emailCount - taskCount;

      let contextSummary = `\n\n[Assistant Note: I have access to `;
      const parts: string[] = [];
      if (emailCount > 0) parts.push(`${emailCount} email${emailCount > 1 ? 's' : ''}`);
      if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`);
      if (otherCount > 0) parts.push(`${otherCount} other item${otherCount > 1 ? 's' : ''}`);

      contextSummary += parts.join(', ') + ' from your connected services that are relevant to this request. Use this information to provide a detailed, personalized response.]';
      enhancedMessage += contextSummary;
    }

    return enhancedMessage;
  }

  /**
   * Convert plugin tools to Anthropic tool format
   */
  private convertToolsToAnthropicFormat(tools: Tool[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Tool.InputSchema
    }));
  }

  /**
   * Generate proactive suggestions based on context and conversation
   */
  private async generateSuggestions(
    userId: string,
    context: KnowledgeItem[],
    response: string
  ): Promise<string[]> {
    try {
      // Use Claude to generate contextually relevant follow-up suggestions
      const suggestionPrompt = `Based on this conversation with the user, suggest 3 short, actionable follow-up questions or commands they might want to ask next.

Your response: "${response}"

Context available: ${context.length} items from their connected services (${context.filter(c => c.type === 'email').length} emails, ${context.filter(c => c.type === 'task').length} tasks)

Requirements for suggestions:
- Make them directly related to what you just discussed
- Keep each suggestion under 10 words
- Make them actionable and specific
- They should feel like natural next steps
- Don't repeat information already provided
- Focus on what the user might want to do next

Examples of GOOD suggestions after discussing emails:
- "Draft a reply to Sarah's email"
- "Show me more details about that project"
- "What other urgent emails do I have?"

Examples of BAD suggestions:
- Generic: "Check my emails" (when we just did that)
- Too vague: "Tell me more"
- Not actionable: "You have emails"

Respond with ONLY 3 suggestions, one per line, no numbering, no extra text.`;

      const suggestionResponse = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: suggestionPrompt
        }]
      });

      const suggestionText = suggestionResponse.content[0].type === 'text'
        ? suggestionResponse.content[0].text
        : '';

      // Parse suggestions (one per line)
      const suggestions = suggestionText
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.match(/^\d+\./)) // Remove numbering if present
        .slice(0, 3); // Limit to 3

      logger.info(`Generated contextual suggestions: userId=${userId}, suggestionCount=${suggestions.length}`);

      return suggestions;
    } catch (error) {
      logger.error(`Failed to generate suggestions: userId=${userId}`, error as Error);

      // Fallback to simple context-based suggestions
      const fallbackSuggestions: string[] = [];

      const emailCount = context.filter(c => c.type === 'email').length;
      if (emailCount > 0) {
        fallbackSuggestions.push('Show me more email details');
      }

      const hasActionItems = context.some(c =>
        c.metadata?.analysis?.actionItems?.length > 0
      );
      if (hasActionItems) {
        fallbackSuggestions.push('What should I work on first?');
      }

      fallbackSuggestions.push('What else can you help me with?');

      return fallbackSuggestions.slice(0, 3);
    }
  }


  /**
   * Clear conversation history for a session
   */
  public clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
    logger.info(`Conversation history cleared: sessionId=${sessionId}`);
  }

  /**
   * Get conversation history for a session
   */
  public getHistory(sessionId: string): Anthropic.MessageParam[] {
    return this.conversationHistory.get(sessionId) || [];
  }

  /**
   * Process a batch of requests (for scheduled tasks, etc.)
   */
  public async processBatch(
    userId: string,
    requests: string[]
  ): Promise<Array<{
    request: string;
    response: string;
    error?: string;
  }>> {
    const results: Array<{
      request: string;
      response: string;
      error?: string;
    }> = [];

    for (const request of requests) {
      try {
        const result = await this.processRequest(userId, request);
        results.push({
          request,
          response: result.response
        });
      } catch (error) {
        results.push({
          request,
          response: '',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get summary of user's day based on connected services
   */
  public async getDailySummary(userId: string): Promise<string> {
    try {
      // Get knowledge from all plugins
      const knowledge = await pluginRegistry.queryKnowledge(userId, 'today', {
        limit: 50
      });

      if (knowledge.length === 0) {
        return "Good morning! 🌅 I don't have any data from your connected services yet. Once you connect services like Gmail, I'll be able to provide you with a comprehensive daily summary including important emails, upcoming events, and action items.";
      }

      // Build detailed context for summary
      let contextDetails = '';
      knowledge.forEach((item, idx) => {
        contextDetails += `\n${idx + 1}. [${item.type.toUpperCase()}] ${item.title}\n`;
        contextDetails += `   Time: ${item.timestamp.toLocaleString()}\n`;

        if (item.metadata?.analysis) {
          const { priority, sentiment, category, actionItems } = item.metadata.analysis;
          if (priority) contextDetails += `   Priority: ${priority}\n`;
          if (sentiment) contextDetails += `   Sentiment: ${sentiment}\n`;
          if (category) contextDetails += `   Category: ${category}\n`;
          if (actionItems && actionItems.length > 0) {
            contextDetails += `   Action Items: ${actionItems.join(', ')}\n`;
          }
        }

        contextDetails += `   Content: ${item.content.substring(0, 300)}\n`;
      });

      const prompt = `You are a helpful personal assistant providing a morning briefing. Based on the user's connected services data, create a warm, detailed daily summary.

Your summary should:
- Start with a friendly greeting and overview
- Highlight high-priority emails with sender names and key points
- Mention any urgent action items that need attention
- Note important patterns (lots of emails from someone, recurring themes, etc.)
- Use emojis appropriately (📧 for emails, ⚡ for urgent, ✅ for completed, etc.)
- Be conversational and personable, not robotic
- End with an encouraging note or helpful suggestion

Here's the information from their services:
${contextDetails}

Make this feel personal and helpful, like a briefing from a trusted assistant who knows their needs.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const summary = response.content[0].type === 'text' ? response.content[0].text : '';

      logger.info(`Daily summary generated: userId=${userId}, itemCount=${knowledge.length}`);

      return summary;
    } catch (error) {
      logger.error(`Failed to generate daily summary: userId=${userId}`, error as Error);
      throw error;
    }
  }
}

export const personalAssistantAgent = new PersonalAssistantAgent();
export default personalAssistantAgent;
