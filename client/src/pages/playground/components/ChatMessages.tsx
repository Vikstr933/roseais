/**
 * ChatMessages - Scrollable chat message list
 * Displays conversation history and loading state
 * Enhanced with typing indicators and "alive" animations
 */

import { memo, forwardRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, Code2, Zap, Wand2, MessageCircle, Loader2 } from 'lucide-react';
import { ChatMessage } from '../../../components/ChatMessage';
import type { WorkspaceChatMessage } from '../types';

interface ChatMessagesProps {
  chatHistory: WorkspaceChatMessage[];
  isLoading: boolean;
  isChatMode?: boolean;
}

// Rotating loading messages for CODE mode
const CODE_LOADING_MESSAGES = [
  { text: "Analyzing your request...", icon: Brain, duration: 2000 },
  { text: "Crafting the perfect solution...", icon: Wand2, duration: 3000 },
  { text: "Generating code structure...", icon: Code2, duration: 4000 },
  { text: "Optimizing components...", icon: Zap, duration: 3000 },
  { text: "Almost there...", icon: Sparkles, duration: 2000 },
];

// Rotating loading messages for CHAT mode
const CHAT_LOADING_MESSAGES = [
  { text: "Thinking...", icon: Brain, duration: 2000 },
  { text: "Processing your question...", icon: MessageCircle, duration: 3000 },
  { text: "Preparing response...", icon: Sparkles, duration: 2000 },
];

// Typing indicator dots
function TypingDots() {
  return (
    <div className="flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-primary/70"
          animate={{
            y: [0, -6, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Enhanced loading component for CODE mode
function CodeLoadingIndicator() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    // Rotate through messages
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % CODE_LOADING_MESSAGES.length);
    }, 3000);
    
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev; // Cap at 95% until complete
        return prev + Math.random() * 5;
      });
    }, 500);
    
    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, []);
  
  const CurrentIcon = CODE_LOADING_MESSAGES[messageIndex].icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex gap-4"
    >
      {/* Animated avatar */}
      <motion.div 
        className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 shadow-lg"
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(139, 92, 246, 0.4)",
            "0 0 0 12px rgba(139, 92, 246, 0)",
          ],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeOut",
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Brain className="h-5 w-5 text-white" />
        </motion.div>
      </motion.div>

      {/* Message content */}
      <div className="rounded-xl px-4 py-3 bg-gradient-to-br from-muted/80 to-muted border border-border/50 max-w-[85%] flex-1 backdrop-blur-sm">
        <div className="space-y-3">
          {/* Header with typing indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div
                key={messageIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-2"
              >
                <CurrentIcon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {CODE_LOADING_MESSAGES[messageIndex].text}
                </span>
              </motion.div>
            </div>
            <TypingDots />
          </div>
          
          {/* Progress bar */}
          <div className="relative h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
            {/* Shimmer effect */}
            <motion.div
              className="absolute top-0 h-full w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: [-80, 400] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </div>
          
          {/* Helpful tip */}
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Watch the Editor tab light up as code appears!
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// Simple loading component for CHAT mode
function ChatLoadingIndicator() {
  const [messageIndex, setMessageIndex] = useState(0);
  
  useEffect(() => {
    // Rotate through messages
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % CHAT_LOADING_MESSAGES.length);
    }, 2000);
    
    return () => {
      clearInterval(messageInterval);
    };
  }, []);
  
  const CurrentIcon = CHAT_LOADING_MESSAGES[messageIndex].icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex gap-4"
    >
      {/* Simple animated avatar for chat */}
      <motion.div 
        className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-md"
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <MessageCircle className="h-5 w-5 text-white" />
      </motion.div>

      {/* Simple message content */}
      <div className="rounded-xl px-4 py-3 bg-muted/50 border border-border/30 max-w-[85%] flex-1">
        <div className="flex items-center justify-between">
          <motion.div
            key={messageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <CurrentIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {CHAT_LOADING_MESSAGES[messageIndex].text}
            </span>
          </motion.div>
          <TypingDots />
        </div>
      </div>
    </motion.div>
  );
}

export const ChatMessages = memo(
  forwardRef<HTMLDivElement, ChatMessagesProps>(function ChatMessages(
    { chatHistory, isLoading, isChatMode = false },
    ref
  ) {
    return (
      <div
        ref={ref}
        className="flex-1 overflow-y-auto panel-padding min-h-0 relative bg-background/60"
      >
        <div className="item-gap">
          {/* Empty state with animation */}
          <AnimatePresence mode="wait">
            {chatHistory.length === 0 && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-xl border border-border bg-gradient-to-br from-muted/50 to-muted/30 p-6 text-muted-foreground"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-foreground font-medium">
                      {isChatMode 
                        ? "Ready to chat and help you plan?" 
                        : "Ready to build something amazing?"}
                    </p>
                    <p className="text-sm">
                      {isChatMode
                        ? "Ask me anything about your project, or let's brainstorm ideas together."
                        : "Start by describing what you want to create. I'll help you build it step by step."}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {isChatMode 
                        ? ["What can you help with?", "Explain this feature", "Best practices?"].map((suggestion) => (
                            <span 
                              key={suggestion}
                              className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 cursor-default"
                            >
                              {suggestion}
                            </span>
                          ))
                        : ["Build a dashboard", "Create a landing page", "Make a form"].map((suggestion) => (
                            <span 
                              key={suggestion}
                              className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 cursor-default"
                            >
                              {suggestion}
                            </span>
                          ))
                      }
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message list with staggered animation */}
          {chatHistory.map((message, index) => (
            <motion.div 
              key={`${message.timestamp}-${index}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.3, 
                delay: index === chatHistory.length - 1 ? 0 : 0,
                ease: "easeOut"
              }}
            >
              <ChatMessage
                role={message.role}
                content={message.content}
                timestamp={message.timestamp}
                errors={message.errors}
                warnings={message.warnings}
                errorSummary={message.errorSummary}
                browserAnalysis={message.browserAnalysis}
              />
            </motion.div>
          ))}

          {/* Conditional loading indicator based on mode */}
          <AnimatePresence mode="wait">
            {isLoading && (isChatMode ? <ChatLoadingIndicator /> : <CodeLoadingIndicator />)}
          </AnimatePresence>
        </div>
      </div>
    );
  })
);

