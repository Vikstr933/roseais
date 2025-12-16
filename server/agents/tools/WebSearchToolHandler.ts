/**
 * Web Search Tool Handler
 * 
 * Handles web search functionality
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';
import axios from 'axios';

export class WebSearchToolHandler extends BaseToolHandler {
  constructor() {
    super('web_search');
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
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
      execute: async (params: Record<string, any>) => {
        return await this.execute(params, context);
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    const query = params.query as string;
    const numResults = parseInt(params.num_results || '3', 10);

    if (!query) {
      return {
        success: false,
        error: 'Search query is required',
        retryable: false
      };
    }

    try {
      // Try Google Custom Search first
      const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
      const googleCx = process.env.GOOGLE_SEARCH_CX;

      if (googleApiKey && googleCx) {
        try {
          const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
              key: googleApiKey,
              cx: googleCx,
              q: query,
              num: Math.min(numResults, 5)
            },
            timeout: 10000
          });

          const data = response.data as any;
          if (data.items) {
            const results = data.items.map((item: any) => ({
              title: item.title,
              snippet: item.snippet,
              url: item.link,
              source: 'Google'
            }));

            return {
              success: true,
              data: {
                results,
                query,
                count: results.length
              }
            };
          }
        } catch (googleError) {
          // Fall through to DuckDuckGo
        }
      }

      // Fallback to DuckDuckGo
      try {
        const ddgResponse = await axios.get('https://api.duckduckgo.com/', {
          params: {
            q: query,
            format: 'json',
            no_html: '1',
            skip_disambig: '1'
          },
          timeout: 10000
        });

        const ddgData = ddgResponse.data as any;
        const results: Array<{title: string; snippet: string; url: string; source: string}> = [];
        if (ddgData.Results) {
          ddgData.Results.slice(0, numResults).forEach((result: any) => {
            results.push({
              title: result.Text,
              snippet: result.Text,
              url: result.FirstURL,
              source: 'DuckDuckGo'
            });
          });
        }

        if (results.length > 0) {
          return {
            success: true,
            data: {
              results,
              query,
              count: results.length
            }
          };
        }
      } catch (ddgError) {
        // Both failed
      }

      return {
        success: false,
        error: 'Web search failed. Both Google and DuckDuckGo searches failed.',
        retryable: true,
        fallbackSuggestion: 'You could try: 1) Check your internet connection, 2) Try a different search query, 3) Search manually on a search engine'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      };
    }
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    // Web search is always available (has fallbacks)
    return true;
  }

  getDescription(): string {
    return 'Search the web for real-time information, addresses, contact details, and current events.';
  }

  getUsageExamples(): string[] {
    return [
      'Search for Colorama Lund address',
      'Find contact information for a company',
      'Look up current events'
    ];
  }
}

