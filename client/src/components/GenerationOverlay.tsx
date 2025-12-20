/**
 * Generation Overlay Component
 * 
 * Creative loading states to showcase during code generation
 * Multiple styles available - can be switched or combined
 */

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Code2, 
  Sparkles, 
  Zap, 
  Brain, 
  FileCode, 
  Layers, 
  Cpu,
  GitBranch,
  Terminal,
  Rocket,
  Wand2,
  Loader2
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface GenerationOverlayProps {
  isLoading: boolean;
  currentStep?: string;
  progress?: number;
  style?: 'matrix' | 'particles' | 'circuit' | 'code-rain' | 'hologram' | 'minimal';
}

// Technical symbols/icons that can be animated
const TECH_SYMBOLS = [
  { icon: Code2, label: 'Code', color: 'text-blue-400' },
  { icon: FileCode, label: 'Files', color: 'text-green-400' },
  { icon: Layers, label: 'Components', color: 'text-purple-400' },
  { icon: Cpu, label: 'Processing', color: 'text-yellow-400' },
  { icon: GitBranch, label: 'Structure', color: 'text-pink-400' },
  { icon: Terminal, label: 'Build', color: 'text-cyan-400' },
  { icon: Rocket, label: 'Launch', color: 'text-orange-400' },
  { icon: Wand2, label: 'Magic', color: 'text-violet-400' },
];

export function GenerationOverlay({ 
  isLoading, 
  currentStep, 
  progress = 0,
  style = 'hologram' 
}: GenerationOverlayProps) {
  if (!isLoading) return null;

  switch (style) {
    case 'matrix':
      return <MatrixStyle currentStep={currentStep} progress={progress} />;
    case 'particles':
      return <ParticleStyle currentStep={currentStep} progress={progress} />;
    case 'circuit':
      return <CircuitStyle currentStep={currentStep} progress={progress} />;
    case 'code-rain':
      return <CodeRainStyle currentStep={currentStep} progress={progress} />;
    case 'hologram':
      return <HologramStyle currentStep={currentStep} progress={progress} />;
    case 'minimal':
      return <MinimalStyle currentStep={currentStep} progress={progress} />;
    default:
      return <HologramStyle currentStep={currentStep} progress={progress} />;
  }
}

// Style 1: Hologram/Neon Effect (Recommended - Most impressive)
function HologramStyle({ currentStep, progress }: { currentStep?: string; progress: number }) {
  const [activeSymbol, setActiveSymbol] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSymbol((prev) => (prev + 1) % TECH_SYMBOLS.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const ActiveIcon = TECH_SYMBOLS[activeSymbol].icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
    >
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}>
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-blue-500/20"
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%'],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center space-y-8 px-8">
        {/* Rotating tech symbols */}
        <div className="flex justify-center gap-8">
          {TECH_SYMBOLS.map((symbol, index) => {
            const Icon = symbol.icon;
            const isActive = index === activeSymbol;
            return (
              <motion.div
                key={index}
                className="relative"
                animate={{
                  scale: isActive ? 1.2 : 0.8,
                  opacity: isActive ? 1 : 0.3,
                }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className={`p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border ${
                    isActive ? 'border-purple-400/50' : 'border-purple-400/20'
                  }`}
                  animate={{
                    boxShadow: isActive
                      ? [
                          '0 0 20px rgba(139, 92, 246, 0.5)',
                          '0 0 40px rgba(139, 92, 246, 0.3)',
                          '0 0 20px rgba(139, 92, 246, 0.5)',
                        ]
                      : '0 0 0px rgba(139, 92, 246, 0)',
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Icon className={`h-8 w-8 ${symbol.color}`} />
                </motion.div>
                {isActive && (
                  <motion.div
                    className="absolute -inset-2 border-2 border-purple-400/50 rounded-xl"
                    animate={{
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Central brain icon with pulse */}
        <motion.div
          className="flex justify-center"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <div className="relative">
            <motion.div
              className="absolute inset-0 bg-purple-500/30 rounded-full blur-xl"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            />
            <Brain className="h-16 w-16 text-purple-400 relative z-10" />
          </div>
        </motion.div>

        {/* Status text */}
        <div className="space-y-2">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-semibold text-purple-300"
          >
            {currentStep || 'Generating your application...'}
          </motion.div>
          <div className="flex items-center justify-center gap-2 text-sm text-purple-400/80">
            <Sparkles className="h-4 w-4 animate-pulse" />
            <span>AI agents are crafting your code</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-md mx-auto">
          <div className="h-2 bg-purple-900/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="mt-2 text-xs text-purple-400/60 text-center">
            {Math.round(progress)}% complete
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Style 2: Matrix-style falling code
function MatrixStyle({ currentStep, progress }: { currentStep?: string; progress: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center"
    >
      <div className="relative w-full h-full">
        {/* Falling code characters */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-green-400 font-mono text-xs opacity-70"
              style={{
                left: `${(i * 5) % 100}%`,
                top: '-20px',
              }}
              animate={{
                y: ['0vh', '100vh'],
                opacity: [0.7, 0, 0.7],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: 'linear',
              }}
            >
              {Array.from({ length: 10 }).map(() =>
                String.fromCharCode(0x30A0 + Math.random() * 96)
              ).join('')}
            </motion.div>
          ))}
        </div>

        {/* Center content */}
        <div className="relative z-10 text-center space-y-4">
          <Code2 className="h-12 w-12 text-green-400 mx-auto animate-pulse" />
          <div className="text-green-400 font-mono text-lg">
            {currentStep || 'GENERATING...'}
          </div>
          <div className="w-64 h-1 bg-green-900/30 mx-auto rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-green-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Style 3: Floating particles
function ParticleStyle({ currentStep, progress }: { currentStep?: string; progress: number }) {
  const particles = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 2,
    duration: Math.random() * 3 + 2,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center"
    >
      {/* Floating particles */}
      <div className="absolute inset-0">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-2 h-2 bg-purple-400 rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Center content */}
      <div className="relative z-10 text-center space-y-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <Zap className="h-16 w-16 text-purple-400 mx-auto" />
        </motion.div>
        <div className="text-xl font-semibold text-purple-200">
          {currentStep || 'Building your app...'}
        </div>
        <div className="w-80 h-2 bg-purple-900/30 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// Style 4: Circuit board pattern
function CircuitStyle({ currentStep, progress }: { currentStep?: string; progress: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center"
    >
      <div className="relative w-full h-full">
        {/* Circuit pattern overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-30">
          {Array.from({ length: 50 }).map((_, i) => (
            <motion.line
              key={i}
              x1={Math.random() * 100 + '%'}
              y1={Math.random() * 100 + '%'}
              x2={Math.random() * 100 + '%'}
              y2={Math.random() * 100 + '%'}
              stroke="rgb(34, 197, 94)"
              strokeWidth="1"
              animate={{
                opacity: [0.2, 0.8, 0.2],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </svg>

        {/* Center content */}
        <div className="relative z-10 text-center space-y-6">
          <Cpu className="h-16 w-16 text-green-400 mx-auto animate-pulse" />
          <div className="text-green-400 font-mono text-lg">
            {currentStep || 'PROCESSING...'}
          </div>
          <div className="w-64 h-1 bg-green-900/30 mx-auto rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-green-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Style 5: Code rain (like Matrix but with actual code)
function CodeRainStyle({ currentStep, progress }: { currentStep?: string; progress: number }) {
  const codeSnippets = [
    'const app = () => {',
    'function Component() {',
    'export default function',
    'import React from',
    '<div className=',
    'useState(',
    'useEffect(() =>',
    'return (',
    '</div>',
    'export {',
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center"
    >
      <div className="relative w-full h-full">
        {/* Falling code */}
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-blue-400 font-mono text-xs opacity-60"
            style={{
              left: `${(i * 6.67) % 100}%`,
            }}
            animate={{
              y: ['-10%', '110%'],
            }}
            transition={{
              duration: Math.random() * 2 + 3,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: 'linear',
            }}
          >
            {codeSnippets[Math.floor(Math.random() * codeSnippets.length)]}
          </motion.div>
        ))}

        {/* Center content */}
        <div className="relative z-10 text-center space-y-4">
          <FileCode className="h-12 w-12 text-blue-400 mx-auto animate-pulse" />
          <div className="text-blue-400 font-mono text-lg">
            {currentStep || 'GENERATING CODE...'}
          </div>
          <div className="w-64 h-1 bg-blue-900/30 mx-auto rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Style 6: Minimal (clean and professional)
function MinimalStyle({ currentStep, progress }: { currentStep?: string; progress: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
    >
      <div className="text-center space-y-6 max-w-md px-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="h-12 w-12 text-primary mx-auto" />
        </motion.div>
        <div className="space-y-2">
          <div className="text-lg font-semibold text-foreground">
            {currentStep || 'Generating your application...'}
          </div>
          <div className="text-sm text-muted-foreground">
            Our AI agents are working on your code
          </div>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

