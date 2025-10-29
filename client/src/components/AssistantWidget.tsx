import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Send,
  Sparkles,
  Minimize2,
  Maximize2,
  X,
  MessageSquare,
  Maximize
} from 'lucide-react';
import { MapEmbed } from './MapEmbed';
import { BackgroundTaskService } from '@/services/BackgroundTaskService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  suggestions?: string[];
  mapQuery?: string; // Location to show on map
  isCodeGeneration?: boolean; // Indicates if this triggered code generation
}

interface AssistantWidgetProps {
  /**
   * Optional callback when assistant generates code
   * Allows integration with Playground's orchestrator
   */
  onCodeGenerated?: (code: string, metadata?: any) => void;

  /**
   * Optional context to provide to assistant
   * e.g., current workspace, selected code, etc.
   */
  contextData?: {
    currentPage?: string;
    workspaceId?: number | string;
    selectedCode?: string;
    generationInProgress?: boolean;
    generatedFiles?: Array<{ path: string; content: string }>;
    currentPrompt?: string;
    lastGenerationResult?: {
      filesGenerated: number;
      files: Array<{ path: string; content: string }>;
    };
  };
}

export default function AssistantWidget({
  onCodeGenerated,
  contextData
}: AssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
    formatted?: string;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [locationRequestResponded, setLocationRequestResponded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load Personal Assistant agent configuration from database
  useEffect(() => {
    const loadAgentConfig = async () => {
      try {
        const response = await fetch('/api/agents/personal-assistant', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          }
        });

        if (response.ok) {
          const config = await response.json();
          setAgentConfig(config);
          console.log('Loaded Personal Assistant config from database:', config);
        } else {
          console.warn('Failed to load Personal Assistant config, using defaults');
        }
      } catch (err) {
        console.error('Error loading Personal Assistant config:', err);
      }
    };

    loadAgentConfig();
  }, []);

  // Request user location when assistant opens
  useEffect(() => {
    if (!isOpen || userLocation || locationRequestResponded) return;

    // Check if geolocation is available
    if ('geolocation' in navigator) {
      // Check permission status first
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
          setLocationPermission(result.state as 'granted' | 'denied' | 'prompt');

          if (result.state === 'granted') {
            requestLocation();
            setLocationRequestResponded(true);
          } else if (result.state === 'prompt') {
            // Show a friendly message before requesting
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: '📍 Jag kan ge dig bättre platsbaserade förslag om du delar din plats. Vill du tillåta det?',
              timestamp: new Date(),
              suggestions: ['Ja, dela plats', 'Nej tack']
            }]);
          } else if (result.state === 'denied') {
            // User has denied - mark as responded
            setLocationRequestResponded(true);
          }
        });
      } else {
        // Fallback if permissions API not available
        requestLocation();
        setLocationRequestResponded(true);
      }
    }
  }, [isOpen, userLocation, locationRequestResponded]);

  const requestLocation = () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Reverse geocode using Google Maps Geocoding API
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
          const response = await fetch(geocodeUrl);
          const data = await response.json();

          if (data.results && data.results[0]) {
            const result = data.results[0];
            const addressComponents = result.address_components;

            // Extract city and country
            const city = addressComponents.find((c: any) =>
              c.types.includes('locality') || c.types.includes('postal_town')
            )?.long_name;

            const country = addressComponents.find((c: any) =>
              c.types.includes('country')
            )?.long_name;

            const location = {
              latitude,
              longitude,
              city,
              country,
              formatted: result.formatted_address
            };

            setUserLocation(location);
            setLocationPermission('granted');

            console.log('✅ User location detected:', location);

            // Confirm to user
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `✅ Perfekt! Jag vet nu att du är i ${city || 'ditt område'}, ${country}. Jag kan nu ge dig bättre lokala rekommendationer!`,
              timestamp: new Date()
            }]);
          }
        } catch (error) {
          console.error('Failed to reverse geocode:', error);
          // Still set location with coords only
          setUserLocation({ latitude, longitude });
          setLocationPermission('granted');
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationPermission('denied');

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '📍 Jag kunde inte få din plats. Du kan fortfarande berätta för mig var du är!',
          timestamp: new Date()
        }]);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // Cache for 5 minutes
      }
    );
  };

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Track which generation we've notified the user about
  const lastNotifiedGenerationRef = useRef<number | null>(null);
  const lastGenerationCheckRef = useRef<number>(0);

  // Add system message when context changes (e.g., generation completes)
  useEffect(() => {
    if (!contextData?.lastGenerationResult || !isOpen) return;

    const fileCount = contextData.lastGenerationResult.filesGenerated;

    // Create a unique generation ID combining file count and a check counter
    // This prevents showing notifications for stale data from previous sessions
    const currentTime = Date.now();
    const timeSinceLastCheck = currentTime - lastGenerationCheckRef.current;

    // Only show notification if this is a fresh generation (detected within 30 seconds of opening)
    // OR if we haven't checked yet (first open)
    const isFreshGeneration = lastGenerationCheckRef.current === 0 || timeSinceLastCheck < 30000;

    // Check if we already notified for this generation
    if (lastNotifiedGenerationRef.current === fileCount) {
      return;
    }

    // Don't show notification for stale data from previous sessions
    if (!isFreshGeneration) {
      // Mark as seen without notifying
      lastNotifiedGenerationRef.current = fileCount;
      return;
    }

    lastGenerationCheckRef.current = currentTime;
    lastNotifiedGenerationRef.current = fileCount;

    const systemMessage: Message = {
      role: 'assistant',
      content: `I noticed you just completed a code generation. The system generated ${
        fileCount || 'some'
      } files. Would you like me to help you understand the code, suggest improvements, or deploy it?`,
      timestamp: new Date(),
      suggestions: [
        'Explain the generated code',
        'Suggest improvements',
        'Help me deploy this',
        'Add tests to this code'
      ]
    };

    setMessages(prev => {
      // Don't duplicate if already exists
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.content.includes('completed a code generation')) {
        return prev;
      }
      return [...prev, systemMessage];
    });
  }, [contextData?.lastGenerationResult, isOpen]);

  // Detect if user is requesting code generation or modification
  const detectCodeGenerationIntent = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    const hasExistingCode = (contextData?.generatedFiles?.length || 0) > 0;

    // Keywords for new code generation
    const codeGenKeywords = [
      'create app', 'build app', 'make app', 'generate app',
      'create component', 'build component', 'make component',
      'create website', 'build website', 'make website',
      'create page', 'build page', 'make page',
      'write code', 'generate code', 'create code',
      'build a', 'create a', 'make a', 'generate a',
      'todo app', 'calculator', 'dashboard', 'landing page',
      'react app', 'react component',
      'with react', 'using react', 'in react'
    ];

    // Keywords for code modification (when code already exists)
    const modificationKeywords = [
      'change', 'update', 'modify', 'edit', 'fix',
      'add', 'remove', 'delete', 'replace',
      'improve', 'enhance', 'refactor',
      'make it', 'change the', 'add a', 'add an',
      'turn', 'convert', 'transform'
    ];

    // UI/Feature keywords that suggest code changes
    const featureKeywords = [
      'button', 'form', 'input', 'modal', 'navbar', 'sidebar',
      'card', 'table', 'header', 'footer', 'menu', 'search',
      'filter', 'sort', 'pagination', 'authentication', 'login',
      'signup', 'profile', 'settings', 'dashboard', 'chart'
    ];

    // Check for modification request if code exists
    if (hasExistingCode) {
      const hasModificationKeyword = modificationKeywords.some(keyword =>
        lowerText.includes(keyword)
      );

      const hasFeatureKeyword = featureKeywords.some(keyword =>
        new RegExp(`\\b${keyword}s?\\b`).test(lowerText)
      );

      // If they mention modifying something OR want to add a feature
      if (hasModificationKeyword || hasFeatureKeyword) {
        return true;
      }
    }

    // Check for new generation keywords
    const hasCodeGenKeyword = codeGenKeywords.some(keyword =>
      lowerText.includes(keyword)
    );

    // Count feature mentions
    const featureKeywordCount = featureKeywords.filter(keyword =>
      new RegExp(`\\b${keyword}s?\\b`).test(lowerText)
    ).length;

    // Generate if: explicit keyword OR multiple features mentioned
    return hasCodeGenKeyword || featureKeywordCount >= 2;
  };

  // Detect location queries ONLY in assistant responses with strict format
  // Format must be: "thing near/in location" on its own line
  // Examples: "pizza near Lövestad, Sweden" or "restaurants in Stockholm"
  const detectLocationQuery = (text: string): string | null => {
    // Split by newlines to check each line
    const lines = text.split('\n').map(line => line.trim());

    for (const line of lines) {
      // Clean up the line - remove markdown formatting and emojis
      let cleanLine = line
        .replace(/\*\*/g, '') // Remove bold **
        .replace(/[🍕☕🗺️📍🚂🍽️✅📧⚡🎉😊]/g, '') // Remove common emojis
        .replace(/[:\[\]]/g, '') // Remove colons and brackets
        .trim();

      // More flexible pattern: extract "something near/in location" from anywhere in the line
      // Matches patterns like "pizza near Stockholm", "cafes in Paris", etc.
      const flexiblePattern = /([a-zA-ZåäöÅÄÖ\s]+)\s+(near|in)\s+([a-zA-ZåäöÅÄÖ,\s]+)/i;
      const match = cleanLine.match(flexiblePattern);

      if (match) {
        // Extract just the location query part (e.g., "pizza near Stockholm")
        const query = `${match[1].trim()} ${match[2]} ${match[3].trim()}`;

        // Validate it's not just a sentence fragment
        // Check that the query has reasonable length (at least 2 words + "near/in" + location)
        const words = query.split(/\s+/);
        if (words.length >= 3 && match[3].trim().length > 0) {
          console.log('✅ Detected location query:', query);
          return query;
        }
      }
    }

    return null;
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const inputText = input;

    // Check if this is a code generation request
    const isCodeGenRequest = detectCodeGenerationIntent(inputText);

    const userMessage: Message = {
      role: 'user',
      content: inputText,
      timestamp: new Date(),
      isCodeGeneration: isCodeGenRequest
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Handle code generation separately
    if (isCodeGenRequest) {
      setLoading(true);

      const hasExistingCode = (contextData?.generatedFiles?.length || 0) > 0;
      const fileCount = contextData?.generatedFiles?.length || 0;

      const confirmMessage: Message = {
        role: 'assistant',
        content: hasExistingCode
          ? `🔧 Updating your code with the requested changes...\n\nI can see you have ${fileCount} file${fileCount !== 1 ? 's' : ''} already. I'll modify them based on your request.\n\nYou can continue using the app while I work on this!\n\nCheck the background tasks panel (bottom right) for progress.`
          : `🚀 Starting code generation in the background...\n\nI'll use the playground's AI agents to build what you requested. You can continue using the app while I work on this.\n\nCheck the background tasks panel (bottom right) for progress!`,
        timestamp: new Date(),
        suggestions: ['View background tasks', 'Go to playground']
      };

      setMessages(prev => [...prev, confirmMessage]);

      try {
        // Build enhanced prompt with existing code context
        let enhancedPrompt = inputText;
        if (hasExistingCode && contextData?.generatedFiles) {
          enhancedPrompt = `EXISTING PROJECT CONTEXT:\nYou previously generated ${fileCount} files.\n\nCurrent files:\n${contextData.generatedFiles.map(f => `- ${f.path}`).join('\n')}\n\nUSER REQUEST:\n${inputText}\n\nIMPORTANT: This is a modification request for existing code. Update the existing files as needed to implement the requested changes.`;
        }

        // Start background code generation with context
        const taskId = await BackgroundTaskService.startCodeGeneration(enhancedPrompt, {
          useOrchestration: true
        });

        console.log('✅ Background task started:', taskId);

        const successMessage: Message = {
          role: 'assistant',
          content: `✅ Code generation task started!\n\nTask ID: ${taskId.substring(0, 12)}...\n\nI'll notify you when it's complete.`,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, successMessage]);
      } catch (err) {
        console.error('Failed to start background task:', err);
        const errorMessage: Message = {
          role: 'assistant',
          content: `❌ Failed to start code generation: ${err instanceof Error ? err.message : 'Unknown error'}\n\nPlease try again or use the Playground directly.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }

      return; // Don't send to normal chat
    }

    // Normal assistant chat flow
    setLoading(true);

    try {
      // Build enhanced message with context
      let enhancedMessage = inputText;
      const contextParts: string[] = [];

      // Add current date and time
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      contextParts.push(`Current date and time: ${dateStr} at ${timeStr}`);

      // Add user location to context
      if (userLocation) {
        if (userLocation.city && userLocation.country) {
          contextParts.push(`User is currently in ${userLocation.city}, ${userLocation.country}`);
        } else if (userLocation.formatted) {
          contextParts.push(`User is currently at ${userLocation.formatted}`);
        } else {
          contextParts.push(`User location: ${userLocation.latitude}, ${userLocation.longitude}`);
        }
      }

      // Add other context data
      if (contextData) {
        if (contextData.currentPage) {
          contextParts.push(`User is currently on the ${contextData.currentPage} page`);
        }

        if (contextData.generationInProgress) {
          contextParts.push('There is a code generation in progress');
        }

        if (contextData.selectedCode) {
          contextParts.push(`Selected code: ${contextData.selectedCode.substring(0, 200)}...`);
        }

        // CRITICAL: Add generated files context so assistant can see the code
        if (contextData.generatedFiles && contextData.generatedFiles.length > 0) {
          contextParts.push(`User has generated code with ${contextData.generatedFiles.length} files`);

          // Include file list
          const fileList = contextData.generatedFiles.map(f => f.path).join(', ');
          contextParts.push(`Generated files: ${fileList}`);

          // If user is asking about the code, include the actual code content
          const codeRelatedKeywords = [
            'explain', 'what does', 'how does', 'show me', 'look at',
            'code', 'function', 'component', 'file', 'improve', 'review',
            'suggest', 'change', 'fix', 'bug', 'error'
          ];

          const isAskingAboutCode = codeRelatedKeywords.some(keyword =>
            inputText.toLowerCase().includes(keyword)
          );

          if (isAskingAboutCode) {
            // Include file contents (truncated for main files)
            contextParts.push('\n\nGENERATED CODE:\n');
            contextData.generatedFiles.forEach(file => {
              // Include full content for small files, truncated for large ones
              const content = file.content.length > 1000
                ? file.content.substring(0, 1000) + '\n... (truncated)'
                : file.content;
              contextParts.push(`\n**File: ${file.path}**\n\`\`\`${file.language || 'typescript'}\n${content}\n\`\`\``);
            });
          }
        }
      }

      if (contextParts.length > 0) {
        enhancedMessage = `${inputText}\n\n[Context: ${contextParts.join('. ')}]`;
      }

      const response = await fetch('/api/plugins/assistant/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: enhancedMessage,
          includeContext: true,
          maxContextItems: 5
        })
      });

      const data = await response.json();

      if (data.success) {
        // Detect location query in assistant response too
        const assistantLocationQuery = detectLocationQuery(data.response);

        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          toolsUsed: data.toolsUsed,
          suggestions: data.suggestions,
          mapQuery: assistantLocationQuery || undefined
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Check if assistant generated code
        // Simple heuristic: check for code blocks in response
        const codeBlockMatch = data.response.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch && onCodeGenerated) {
          onCodeGenerated(codeBlockMatch[1], {
            toolsUsed: data.toolsUsed,
            contextUsed: data.contextUsed
          });
        }
      } else {
        const errorMessage: Message = {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered a network error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    // Handle location permission request
    if (suggestion === 'Ja, dela plats') {
      setLocationRequestResponded(true);
      requestLocation();
      return;
    }

    if (suggestion === 'Nej tack') {
      setLocationRequestResponded(true);
      setLocationPermission('denied');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Okej, inget problem! Du kan alltid berätta för mig var du är om du vill ha lokala rekommendationer.',
        timestamp: new Date()
      }]);
      return;
    }

    // Default behavior - fill input with suggestion
    setInput(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Determine widget dimensions based on state
  const widgetClasses = isExpanded
    ? 'w-[800px] h-[80vh] max-w-[90vw] max-h-[90vh]'
    : 'w-96 h-[600px]';

  // Floating button when closed
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg"
          onClick={() => setIsOpen(true)}
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Card className="w-64 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <CardTitle className="text-sm">AI Assistant</CardTitle>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsMinimized(false)}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Full widget
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className={`${widgetClasses} shadow-2xl flex flex-col transition-all duration-300`}>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">AI Assistant</CardTitle>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                <Maximize className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
          {/* Messages Area */}
          <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Sparkles className="w-12 h-12 text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">I'm here to help!</h3>
                <p className="text-xs text-muted-foreground mb-4 px-4">
                  Ask me anything about your code, emails, tasks, find places, or let me help you with productivity.
                </p>
                <div className="space-y-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setInput('What should I work on today?')}
                  >
                    What should I work on?
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setInput('Check my emails')}
                  >
                    Check my emails
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setInput('Find coffee shops near me')}
                  >
                    Find places nearby
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`${isExpanded ? 'max-w-[70%]' : 'max-w-[85%]'} w-full`}
                    >
                      <div
                        className={`rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="text-xs font-semibold mb-1">
                          {message.role === 'user' ? 'You' : 'Assistant'}
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </div>

                        {message.toolsUsed && message.toolsUsed.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {message.toolsUsed.map((tool, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-xs"
                              >
                                {tool.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {message.suggestions.slice(0, 2).map((suggestion, i) => (
                              <Button
                                key={i}
                                variant="outline"
                                size="sm"
                                className="w-full text-xs justify-start"
                                onClick={() => handleSuggestionClick(suggestion)}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground mt-1">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>

                      {/* Embed map if location detected */}
                      {message.mapQuery && (
                        <div className="mt-2">
                          <MapEmbed query={message.mapQuery} height={isExpanded ? 400 : 250} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3 flex items-center space-x-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t p-3">
            <div className="flex space-x-2">
              <Textarea
                placeholder="Ask me anything... Try 'find restaurants near me'"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="resize-none text-sm min-h-[60px]"
                rows={2}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || loading}
                size="icon"
                className="h-[60px] w-[60px] shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
