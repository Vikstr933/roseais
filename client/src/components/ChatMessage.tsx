import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Brain, MessageSquare, Copy, Check, AlertTriangle, AlertCircle, Info, Wrench, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { BrowserAnalysisResult } from './BrowserAnalysisResult';

interface CodeError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  category: 'syntax' | 'type' | 'import' | 'runtime' | 'build' | 'other';
  suggestion?: string;
  fixable: boolean;
}

interface ErrorSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  fixable: number;
}

interface BrowserAnalysisData {
  url: string;
  viewport: { width: number; height: number };
  issuesFound: number;
  issues: Array<{
    type: 'layout' | 'css' | 'responsive' | 'accessibility' | 'performance' | 'visual';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    element?: string;
    suggestion?: string;
  }>;
  metrics?: {
    loadTime: string;
    firstContentfulPaint?: string;
  };
  accessibility?: {
    score: number;
    violations: number;
  };
  summary: string;
  screenshot?: string;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  errors?: CodeError[];
  warnings?: CodeError[];
  errorSummary?: ErrorSummary;
  browserAnalysis?: BrowserAnalysisData;
}

// Helper function to clean message content
function cleanMessageContent(content: string): string {
  // Remove ANSI color codes
  let cleaned = content.replace(/\x1b\[[0-9;]*m/g, '');
  cleaned = cleaned.replace(/\[(\d+)m/g, '');
  cleaned = cleaned.replace(/\[[0-9;]+m/g, '');

  // Remove other ANSI escape sequences
  cleaned = cleaned.replace(/\x1b\[[\d;]*[A-Za-z]/g, '');

  // Fix emoji encoding issues (UTF-8 double encoding)
  // Replace common broken emoji patterns
  cleaned = cleaned.replace(/ðŸ'‹/g, '👋');
  cleaned = cleaned.replace(/âœ…/g, '✅');
  cleaned = cleaned.replace(/ðŸŽ¨/g, '🎨');
  cleaned = cleaned.replace(/âš¡/g, '⚡');
  cleaned = cleaned.replace(/ðŸš€/g, '🚀');
  cleaned = cleaned.replace(/ðŸ'¡/g, '💡');
  cleaned = cleaned.replace(/âš ï¸/g, '⚠️');
  cleaned = cleaned.replace(/âŒ/g, '❌');
  cleaned = cleaned.replace(/ðŸ"§/g, '🔧');
  cleaned = cleaned.replace(/ðŸ"¥/g, '🔥');
  cleaned = cleaned.replace(/ðŸ'ª/g, '💪');

  // Remove console log formatting artifacts
  cleaned = cleaned.replace(/\[1m/g, '');
  cleaned = cleaned.replace(/\[22m/g, '');
  cleaned = cleaned.replace(/\[32m/g, '');
  cleaned = cleaned.replace(/\[36m/g, '');
  cleaned = cleaned.replace(/\[39m/g, '');
  cleaned = cleaned.replace(/\[2m/g, '');
  cleaned = cleaned.replace(/\[0m/g, '');
  cleaned = cleaned.replace(/\[90m/g, '');

  // Remove Vite console output patterns
  cleaned = cleaned.replace(/\s+ready in\s+\[0m\[1m\d+\[22m\[2m\[0m ms\[22m/g, '');
  cleaned = cleaned.replace(/\[32m\[1mVITE\[22m[^\n]*/g, '');

  // Trim excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();

  return cleaned;
}

export function ChatMessage({ role, content, timestamp, errors, warnings, errorSummary, browserAnalysis }: ChatMessageProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(true);
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const isAssistant = role === 'assistant';
  const displayName = isAssistant ? 'Elon' : 'You';

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleFixError = async (error: CodeError) => {
    // TODO: Implement error fixing
    console.log('Fix error:', error);
  };

  // Clean the content before rendering
  const cleanedContent = cleanMessageContent(content);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'syntax':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'type':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'import':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'build':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex gap-4 transition-smooth ${isAssistant ? 'justify-start' : 'justify-end'}`}
    >
      {isAssistant && (
        <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0 shadow-lg hover-lift">
          <Brain className="icon-sm text-white" />
        </div>
      )}

      <div
        className={`rounded-xl px-4 py-3 max-w-[85%] transition-smooth ${
          !isAssistant
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl'
            : 'chat-message-assistant hover:shadow-md'
        }`}
      >
        {isAssistant ? (
          <div className="prose prose-sm max-w-none chat-message-assistant rounded-lg p-4 transition-smooth hover:shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {displayName}
            </div>
            <ReactMarkdown
              components={{
                code({ node, className, children, ...props }: any) {
                  const inline = !className || !className.includes('language-');
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');

                  return !inline && match ? (
                    <div className="relative group">
                      <button
                        onClick={() => handleCopyCode(codeString)}
                        className="absolute right-2 top-2 p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="Copy code"
                      >
                        {copiedCode === codeString ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-300" />
                        )}
                      </button>
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: '0',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                        } as React.CSSProperties}
                        {...props}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code
                      className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-xs font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                // Text formatting - **bold** and *italic*
                strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                // Paragraphs and lists
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                // Headings
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                h4: ({ children }) => <h4 className="text-sm font-semibold mb-1">{children}</h4>,
                // Other elements
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-violet-500 pl-4 italic my-2">{children}</blockquote>
                ),
                a: ({ children, href }) => (
                  <a href={href} className="text-violet-600 hover:text-violet-700 underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                // Horizontal rule
                hr: () => <hr className="my-4 border-border" />,
              }}
            >
              {cleanedContent}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="space-y-2 text-white">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/80">
              {displayName}
            </div>
            <p className="text-sm whitespace-pre-wrap">{cleanedContent}</p>
          </div>
        )}

        {/* Error Display */}
        {errors && errors.length > 0 && (
          <div className="mt-4 space-y-2">
            <Collapsible open={errorsExpanded} onOpenChange={setErrorsExpanded}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {errors.length} Error{errors.length !== 1 ? 's' : ''}
                </span>
                {errorsExpanded ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {errors.map((error, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getSeverityIcon(error.severity)}
                          <span className="font-medium text-sm">{error.file}</span>
                          {error.line && (
                            <span className="text-xs text-muted-foreground">
                              Line {error.line}{error.column ? `:${error.column}` : ''}
                            </span>
                          )}
                          <Badge variant="outline" className={`text-xs ${getCategoryColor(error.category)}`}>
                            {error.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground mb-1">{error.message}</p>
                        {error.suggestion && (
                          <p className="text-xs text-muted-foreground italic">💡 {error.suggestion}</p>
                        )}
                      </div>
                      {/* Auto-fix is handled automatically by backend - no manual fix button needed */}
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Warnings Display */}
        {warnings && warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            <Collapsible open={warningsExpanded} onOpenChange={setWarningsExpanded}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
                </span>
                {warningsExpanded ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {warnings.map((warning, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getSeverityIcon(warning.severity)}
                          <span className="font-medium text-sm">{warning.file}</span>
                          {warning.line && (
                            <span className="text-xs text-muted-foreground">
                              Line {warning.line}{warning.column ? `:${warning.column}` : ''}
                            </span>
                          )}
                          <Badge variant="outline" className={`text-xs ${getCategoryColor(warning.category)}`}>
                            {warning.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground mb-1">{warning.message}</p>
                        {warning.suggestion && (
                          <p className="text-xs text-muted-foreground italic">💡 {warning.suggestion}</p>
                        )}
                      </div>
                      {/* Auto-fix is handled automatically by backend - no manual fix button needed */}
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Browser Analysis Result */}
        {browserAnalysis && isAssistant && (
          <div className="mt-4">
            <BrowserAnalysisResult result={browserAnalysis} />
          </div>
        )}

        {timestamp && (
          <div className={`mt-1 text-xs ${isAssistant ? 'text-muted-foreground' : 'opacity-80'}`}>
            {new Date(timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>

      {!isAssistant && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center flex-shrink-0 shadow-lg">
          <MessageSquare className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </div>
      )}
    </motion.div>
  );
}
