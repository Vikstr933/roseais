import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Brain, MessageSquare, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
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

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Clean the content before rendering
  const cleanedContent = cleanMessageContent(content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {role === 'assistant' && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
          <Brain className="h-4 w-4 text-white" />
        </div>
      )}

      <div
        className={`rounded-xl px-4 py-3 max-w-[85%] ${
          role === 'user'
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg'
            : 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700'
        }`}
      >
        {role === 'assistant' ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
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
                          margin: 0,
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                        }}
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
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-violet-500 pl-4 italic my-2">{children}</blockquote>
                ),
                a: ({ children, href }) => (
                  <a href={href} className="text-violet-600 hover:text-violet-700 underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {cleanedContent}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{cleanedContent}</p>
        )}

        {timestamp && (
          <div className="mt-1 text-xs opacity-60">
            {new Date(timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>

      {role === 'user' && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center flex-shrink-0 shadow-lg">
          <MessageSquare className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </div>
      )}
    </motion.div>
  );
}
