import { useState, useEffect, useRef } from 'react';
import Editor from "@monaco-editor/react";

interface TypewriterEditorProps {
  targetContent: string;
  language: string;
  theme: 'vs-dark' | 'light';
  height?: string;
  speed?: number; // characters per second
  onComplete?: () => void;
}

export function TypewriterEditor({
  targetContent,
  language,
  theme,
  height = "100%",
  speed = 50, // 50 characters per second
  onComplete
}: TypewriterEditorProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const animationRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    // Reset when target content changes
    if (targetContent && targetContent !== displayedContent) {
      setIsTyping(true);
      currentIndexRef.current = 0;
      lastUpdateRef.current = Date.now();

      const animate = () => {
        const now = Date.now();
        const elapsed = now - lastUpdateRef.current;
        const charsToAdd = Math.floor((elapsed / 1000) * speed);

        if (charsToAdd > 0) {
          const newIndex = Math.min(
            currentIndexRef.current + charsToAdd,
            targetContent.length
          );

          setDisplayedContent(targetContent.substring(0, newIndex));
          currentIndexRef.current = newIndex;
          lastUpdateRef.current = now;

          if (newIndex >= targetContent.length) {
            setIsTyping(false);
            onComplete?.();
            return;
          }
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [targetContent, speed, onComplete]);

  return (
    <div className="relative h-full">
      {isTyping && (
        <div className="absolute top-4 right-4 z-10 bg-blue-500/90 text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 shadow-lg">
          <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
          AI is writing code...
        </div>
      )}
      <Editor
        height={height}
        defaultLanguage={language}
        language={language}
        value={displayedContent}
        theme={theme}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: "on",
          roundedSelection: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          readOnly: true, // Read-only during typewriter effect
          wordWrap: "on",
          suggestOnTriggerCharacters: false,
          formatOnPaste: false,
          formatOnType: false,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: true,
          folding: true,
          glyphMargin: true,
          bracketPairColorization: {
            enabled: true
          },
          cursorStyle: 'line',
          cursorBlinking: 'blink',
        }}
      />
    </div>
  );
}
