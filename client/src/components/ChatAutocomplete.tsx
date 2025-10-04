import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Zap, Brain, ChevronRight } from 'lucide-react';
import { Badge } from './ui/badge';

interface AutocompleteSuggestion {
  id: string;
  text: string;
  type: 'message' | 'knowledge';
  confidence: number;
  category?: string;
  description?: string;
}

interface KnowledgeSuggestion {
  id: string;
  name: string;
  type: 'company' | 'framework' | 'workspace' | 'github';
  relevanceScore: number;
  description: string;
}

interface ChatAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSuggestionSelect: (suggestion: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatAutocomplete({
  value,
  onChange,
  onSuggestionSelect,
  disabled = false,
  placeholder = 'Describe what you want to build...',
}: ChatAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [knowledgeSuggestions, setKnowledgeSuggestions] = useState<
    KnowledgeSuggestion[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showAbove, setShowAbove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Dynamic message suggestions based on user input
  const generateContextualSuggestions = (
    query: string
  ): AutocompleteSuggestion[] => {
    const queryLower = query.toLowerCase();
    const suggestions: AutocompleteSuggestion[] = [];

    // Camera/Video related suggestions
    if (
      queryLower.includes('camera') ||
      queryLower.includes('video') ||
      queryLower.includes('stream')
    ) {
      suggestions.push(
        {
          id: 'camera-python',
          text: 'Build a real-time IP camera application using Python with OpenCV',
          type: 'message',
          confidence: 0.95,
          category: 'Computer Vision',
          description:
            'Create a Python app that streams video from IP cameras using OpenCV and requests',
        },
        {
          id: 'camera-webapp',
          text: 'Build a real-time camera streaming web application',
          type: 'message',
          confidence: 0.9,
          category: 'Web App',
          description: 'Create a web app for live camera streaming with WebRTC',
        },
        {
          id: 'camera-mobile',
          text: 'Build a mobile camera app with real-time processing',
          type: 'message',
          confidence: 0.85,
          category: 'Mobile',
          description:
            'Create a mobile app with camera functionality and real-time image processing',
        }
      );
    }

    // AI/ML related suggestions
    if (
      queryLower.includes('ai') ||
      queryLower.includes('machine learning') ||
      queryLower.includes('ml')
    ) {
      suggestions.push(
        {
          id: 'ai-chatbot',
          text: 'Build an AI-powered chatbot application',
          type: 'message',
          confidence: 0.9,
          category: 'AI/ML',
          description:
            'Create a conversational AI chatbot with natural language processing',
        },
        {
          id: 'ai-image-recognition',
          text: 'Build an AI image recognition system',
          type: 'message',
          confidence: 0.85,
          category: 'AI/ML',
          description:
            'Create an application that can identify and classify images using AI',
        }
      );
    }

    // E-commerce related suggestions
    if (
      queryLower.includes('shop') ||
      queryLower.includes('ecommerce') ||
      queryLower.includes('store')
    ) {
      suggestions.push(
        {
          id: 'ecommerce-platform',
          text: 'Build a complete e-commerce platform',
          type: 'message',
          confidence: 0.9,
          category: 'E-commerce',
          description:
            'Create a full-featured online store with payment processing',
        },
        {
          id: 'ecommerce-mobile',
          text: 'Build a mobile e-commerce application',
          type: 'message',
          confidence: 0.85,
          category: 'Mobile',
          description:
            'Create a mobile shopping app with React Native or Flutter',
        }
      );
    }

    // Social/Communication related suggestions
    if (
      queryLower.includes('social') ||
      queryLower.includes('chat') ||
      queryLower.includes('messaging')
    ) {
      suggestions.push(
        {
          id: 'social-platform',
          text: 'Build a social media platform',
          type: 'message',
          confidence: 0.9,
          category: 'Social',
          description:
            'Create a social networking platform with user profiles and interactions',
        },
        {
          id: 'chat-app',
          text: 'Build a real-time chat application',
          type: 'message',
          confidence: 0.85,
          category: 'Real-time',
          description: 'Create a messaging app with WebSocket support',
        }
      );
    }

    // Data/Analytics related suggestions
    if (
      queryLower.includes('data') ||
      queryLower.includes('analytics') ||
      queryLower.includes('dashboard')
    ) {
      suggestions.push(
        {
          id: 'data-dashboard',
          text: 'Build a data analytics dashboard',
          type: 'message',
          confidence: 0.9,
          category: 'Analytics',
          description:
            'Create an interactive dashboard for data visualization and analysis',
        },
        {
          id: 'data-pipeline',
          text: 'Build a data processing pipeline',
          type: 'message',
          confidence: 0.85,
          category: 'Data Engineering',
          description:
            'Create a system for processing and transforming large datasets',
        }
      );
    }

    // Game related suggestions
    if (queryLower.includes('game') || queryLower.includes('gaming')) {
      suggestions.push(
        {
          id: 'web-game',
          text: 'Build a web-based game',
          type: 'message',
          confidence: 0.9,
          category: 'Gaming',
          description: 'Create an interactive game using HTML5 Canvas or WebGL',
        },
        {
          id: 'mobile-game',
          text: 'Build a mobile game application',
          type: 'message',
          confidence: 0.85,
          category: 'Mobile',
          description: 'Create a mobile game using React Native or Unity',
        }
      );
    }

    // Default suggestions if no specific context is detected
    if (suggestions.length === 0) {
      suggestions.push(
        {
          id: 'react-component',
          text: 'Create a React component for',
          type: 'message',
          confidence: 0.8,
          category: 'Frontend',
          description: 'Generate a React component',
        },
        {
          id: 'api-endpoint',
          text: 'Build an API endpoint for',
          type: 'message',
          confidence: 0.8,
          category: 'Backend',
          description: 'Create a REST API endpoint',
        },
        {
          id: 'full-stack-app',
          text: 'Build a full-stack web application',
          type: 'message',
          confidence: 0.75,
          category: 'Full Stack',
          description:
            'Create a complete web application with frontend and backend',
        },
        {
          id: 'mobile-app',
          text: 'Build a mobile application',
          type: 'message',
          confidence: 0.7,
          category: 'Mobile',
          description: 'Create a React Native or Flutter mobile app',
        }
      );
    }

    return suggestions;
  };

  // Debounced function to fetch suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setKnowledgeSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Generate contextual suggestions based on user input
      const contextualSuggestions = generateContextualSuggestions(query);

      // Filter suggestions based on query relevance
      const filteredSuggestions = contextualSuggestions.filter(
        suggestion =>
          suggestion.text.toLowerCase().includes(query.toLowerCase()) ||
          suggestion.category?.toLowerCase().includes(query.toLowerCase()) ||
          suggestion.description?.toLowerCase().includes(query.toLowerCase()) ||
          query.toLowerCase().includes(suggestion.category?.toLowerCase() || '')
      );

      // Get knowledge suggestions
      const knowledgeResponse = await fetch(
        '/api/knowledge/calculate-relevance',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        }
      );

      if (knowledgeResponse.ok) {
        const relevanceScores = await knowledgeResponse.json();

        // Get all knowledge items to match with scores
        const allKnowledgeResponse = await fetch('/api/knowledge/all');
        if (allKnowledgeResponse.ok) {
          const allKnowledge = await allKnowledgeResponse.json();

          const knowledgeSuggestions: KnowledgeSuggestion[] = [];

          // Process companies
          allKnowledge.companies?.forEach((company: any) => {
            const score = relevanceScores[`company-${company.id}`];
            if (score && score > 0.3) {
              knowledgeSuggestions.push({
                id: `company-${company.id}`,
                name: company.name,
                type: 'company',
                relevanceScore: score,
                description: company.description,
              });
            }
          });

          // Process frameworks
          allKnowledge.frameworks?.forEach((framework: any) => {
            const score = relevanceScores[`framework-${framework.id}`];
            if (score && score > 0.3) {
              knowledgeSuggestions.push({
                id: `framework-${framework.id}`,
                name: framework.name,
                type: 'framework',
                relevanceScore: score,
                description: framework.description,
              });
            }
          });

          // Process workspaces
          allKnowledge.workspaces?.forEach((workspace: any) => {
            const score = relevanceScores[`workspace-${workspace.id}`];
            if (score && score > 0.3) {
              knowledgeSuggestions.push({
                id: `workspace-${workspace.id}`,
                name: workspace.name,
                type: 'workspace',
                relevanceScore: score,
                description: workspace.description,
              });
            }
          });

          // Sort by relevance score and filter for high relevance
          knowledgeSuggestions.sort(
            (a, b) => b.relevanceScore - a.relevanceScore
          );
          const highRelevanceKnowledge = knowledgeSuggestions.filter(
            k => k.relevanceScore > 0.4
          );
          setKnowledgeSuggestions(highRelevanceKnowledge.slice(0, 4)); // Top 4 high-relevance items
        }
      }

      setSuggestions(filteredSuggestions.slice(0, 5)); // Top 5 message suggestions
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // Fallback to contextual suggestions only
      const contextualSuggestions = generateContextualSuggestions(query);
      const filteredSuggestions = contextualSuggestions.filter(suggestion =>
        suggestion.text.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filteredSuggestions.slice(0, 5));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check if dropdown should show above input
  const checkDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const inputRect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - inputRect.bottom;
      const spaceAbove = inputRect.top;

      // Show above if there's more space above and less than 300px below
      setShowAbove(spaceAbove > spaceBelow && spaceBelow < 300);
    }
  }, []);

  // Debounce the fetch function
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, fetchSuggestions]);

  // Listen for window resize and scroll to recalculate dropdown position
  useEffect(() => {
    const handleResize = () => {
      if (showSuggestions) {
        checkDropdownPosition();
      }
    };

    const handleScroll = () => {
      if (showSuggestions) {
        checkDropdownPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true); // Use capture to catch all scroll events
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showSuggestions, checkDropdownPosition]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(newValue.length > 1);
    setSelectedIndex(-1);
    if (newValue.length > 1) {
      checkDropdownPosition();
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: AutocompleteSuggestion) => {
    onSuggestionSelect(suggestion.text);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    // Focus back to input after selection
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    const totalSuggestions = suggestions.length + knowledgeSuggestions.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalSuggestions);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev <= 0 ? totalSuggestions - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < suggestions.length) {
            handleSuggestionSelect(suggestions[selectedIndex]);
          } else {
            const knowledgeIndex = selectedIndex - suggestions.length;
            const knowledgeSuggestion = knowledgeSuggestions[knowledgeIndex];
            // Add knowledge context to the message
            onSuggestionSelect(
              `${value} (using ${knowledgeSuggestion.name} knowledge)`
            );
            setShowSuggestions(false);
            setSelectedIndex(-1);
          }
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Get suggestion icon
  const getSuggestionIcon = (suggestion: AutocompleteSuggestion) => {
    switch (suggestion.category) {
      case 'Frontend':
        return '⚛️';
      case 'Backend':
        return '🔧';
      case 'Database':
        return '🗄️';
      case 'Security':
        return '🔒';
      case 'UI/UX':
        return '🎨';
      case 'Mobile':
        return '📱';
      case 'E-commerce':
        return '🛒';
      case 'Real-time':
        return '⚡';
      case 'Computer Vision':
        return '📹';
      case 'Web App':
        return '🌐';
      case 'AI/ML':
        return '🤖';
      case 'Social':
        return '👥';
      case 'Analytics':
        return '📊';
      case 'Data Engineering':
        return '⚙️';
      case 'Gaming':
        return '🎮';
      case 'Full Stack':
        return '🔄';
      default:
        return '💡';
    }
  };

  // Get knowledge type icon
  const getKnowledgeIcon = (type: string) => {
    switch (type) {
      case 'company':
        return '🏢';
      case 'framework':
        return '⚙️';
      case 'workspace':
        return '💼';
      case 'github':
        return '🐙';
      default:
        return '📚';
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setShowSuggestions(value.length > 1);
            if (value.length > 1) {
              checkDropdownPosition();
            }
          }}
          onBlur={() => {
            // Delay hiding to allow for clicks on suggestions
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-12 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSuggestions &&
          (suggestions.length > 0 || knowledgeSuggestions.length > 0) && (
            <motion.div
              ref={suggestionsRef}
              initial={{ opacity: 0, y: showAbove ? 10 : -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: showAbove ? 10 : -10 }}
              transition={{ duration: 0.2 }}
              className={`absolute left-0 right-0 bg-background border border-border rounded-lg shadow-lg z-[9999] max-h-80 overflow-y-auto ${
                showAbove ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
            >
              {/* Message Suggestions */}
              {suggestions.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    Message Suggestions
                  </div>
                  {suggestions.map((suggestion, index) => (
                    <motion.button
                      key={suggestion.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center gap-3 ${
                        selectedIndex === index ? 'bg-muted' : ''
                      }`}
                    >
                      <span className="text-lg">
                        {getSuggestionIcon(suggestion)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {suggestion.text}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {suggestion.description}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.category}
                      </Badge>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Knowledge Suggestions */}
              {knowledgeSuggestions.length > 0 && (
                <div className="p-2 border-t border-border">
                  <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                    <Brain className="h-3 w-3" />
                    Relevant Knowledge
                  </div>
                  {knowledgeSuggestions.map((knowledge, index) => {
                    const suggestionIndex = suggestions.length + index;
                    return (
                      <motion.button
                        key={knowledge.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: (suggestions.length + index) * 0.05,
                        }}
                        onClick={() => {
                          onSuggestionSelect(
                            `${value} (using ${knowledge.name} knowledge)`
                          );
                          setShowSuggestions(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center gap-3 ${
                          selectedIndex === suggestionIndex ? 'bg-muted' : ''
                        }`}
                      >
                        <span className="text-lg">
                          {getKnowledgeIcon(knowledge.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {knowledge.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {knowledge.description}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              knowledge.relevanceScore > 0.7
                                ? 'default'
                                : knowledge.relevanceScore > 0.5
                                  ? 'secondary'
                                  : 'outline'
                            }
                            className="text-xs"
                          >
                            {Math.round(knowledge.relevanceScore * 100)}% match
                          </Badge>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
