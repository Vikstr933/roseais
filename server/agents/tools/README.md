# Modular Tool System

En modulär, skalbar arkitektur för tool handlers i PersonalAssistantAgent.

## Arkitektur

### BaseToolHandler
Alla tool handlers ärver från `BaseToolHandler` som ger:
- ✅ Lazy loading av tools
- ✅ Automatisk error recovery
- ✅ Retry-logik för retryable errors
- ✅ Fallback-strategier
- ✅ Caching

### ToolFactory
Centraliserad factory för att hantera tool handlers:
- ✅ Dynamisk registrering av handlers
- ✅ Caching av tools (5 min TTL)
- ✅ Lazy loading
- ✅ Batch operations

### SystemPromptBuilder
Intelligent system prompt builder med:
- ✅ Meta-kognitiv medvetenhet
- ✅ Aldrig säger bara "nej" - alltid alternativ
- ✅ Dynamisk tool-kategorisering
- ✅ Kontextmedveten prompt-building

## Användning

### 1. Skapa en ny Tool Handler

```typescript
import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';

export class MyToolHandler extends BaseToolHandler {
  constructor() {
    super('my_tool');
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'my_tool',
      description: 'Description of what the tool does',
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'Parameter description'
          }
        },
        required: ['param1']
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
    // Your tool logic here
    try {
      // Do something
      return {
        success: true,
        data: { result: 'success' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true, // If error is retryable
        fallbackSuggestion: 'Alternative approach suggestion'
      };
    }
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    // Check if tool is available
    return true;
  }

  getDescription(): string {
    return 'Tool description for system prompt';
  }

  getUsageExamples(): string[] {
    return [
      'Example usage 1',
      'Example usage 2'
    ];
  }
}
```

### 2. Registrera Tool Handler

```typescript
import { toolFactory } from './ToolFactory';
import { MyToolHandler } from './MyToolHandler';

// I din initialization kod:
const handler = new MyToolHandler();
toolFactory.registerHandler(handler);
// eller
await toolFactory.registerHandlerByToolName(handler);
```

### 3. Använda i PersonalAssistantAgent

```typescript
import { toolFactory } from './tools/ToolFactory';
import { systemPromptBuilder } from './tools/SystemPromptBuilder';

// Hämta alla tools
const tools = await toolFactory.getAllTools({
  userId,
  sessionId,
  options: {}
});

// Bygg system prompt
const systemPrompt = await systemPromptBuilder.buildPrompt({
  userId,
  sessionId,
  tools,
  knowledgeItems: context,
  memories: memories,
  discordContext: options?.discordContext
});

// Exekvera tool
const result = await toolFactory.executeTool(
  'browser_use',
  { url: 'https://example.com', task: 'Do something' },
  { userId, sessionId }
);
```

## Fördelar

1. **Modularitet**: Varje tool är sin egen klass - lätt att underhålla
2. **Skalbarhet**: Lägg till nya tools genom att skapa nya handlers
3. **Performance**: Lazy loading och caching
4. **Error Recovery**: Automatisk retry och fallback-strategier
5. **Intelligent Prompts**: Meta-kognitiv system prompt som aldrig säger bara "nej"
6. **Separation of Concerns**: Tydlig ansvarsfördelning

## Exempel Tool Handlers

- `BrowserUseToolHandler` - Browser automation med Playwright
- Ytterligare handlers kan läggas till enkelt...

## Nästa Steg

1. Migrera befintliga tools till handlers
2. Lägg till fler handlers (Discord, File Operations, Git, etc.)
3. Integrera med PersonalAssistantAgent
4. Lägg till mer avancerad error recovery
5. Förbättra caching-strategier

