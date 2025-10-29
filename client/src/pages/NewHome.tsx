import { motion } from 'framer-motion';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  ArrowRight,
  Zap,
  Brain,
  Rocket,
  Code,
  Users,
  Network,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';

export default function NewHome() {
  const [, setLocation] = useLocation();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [prompt, setPrompt] = useState('');
  const { user } = useAuth();

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    if (!user) {
      // Not logged in - show auth dialog
      setShowAuthDialog(true);
      // Store prompt in localStorage to retrieve after login
      localStorage.setItem('pendingPrompt', prompt);
    } else {
      // Logged in - go to playground with prompt
      setLocation(`/playground?prompt=${encodeURIComponent(prompt)}`);
    }
  };

  const features = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: 'Lightning Fast',
      description: 'See your ideas come to life in seconds with real-time code streaming',
    },
    {
      icon: <Brain className="h-6 w-6" />,
      title: 'AI-Powered',
      description: 'Multiple specialized AI agents working together on your project',
    },
    {
      icon: <Code className="h-6 w-6" />,
      title: 'Production Ready',
      description: 'Generate complete, working applications with best practices',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Collaborative',
      description: 'Build together with your team in shared workspaces',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent"></div>
        <div className="absolute inset-0">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute bg-blue-500/10 rounded-full"
              style={{
                width: Math.random() * 4 + 1 + 'px',
                height: Math.random() * 4 + 1 + 'px',
                left: Math.random() * 100 + '%',
                top: Math.random() * 100 + '%',
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Hero Section with Prompt Banner - Optimized for 14" screens */}
        <section className="container mx-auto px-4 lg:px-6 pt-16 lg:pt-24 xl:pt-32 pb-12 lg:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-6xl mx-auto"
          >
            {/* Title */}
            <div className="text-center mb-8 lg:mb-12">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4 lg:mb-6"
              >
                <Sparkles className="h-3 w-3 lg:h-4 lg:w-4 text-blue-400" />
                <span className="text-blue-300 text-xs lg:text-sm font-medium">
                  Powered by Advanced AI
                </span>
              </motion.div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-white mb-4 lg:mb-6 leading-tight px-4">
                Build Anything
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  In Seconds
                </span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-blue-200/80 mb-8 lg:mb-12 max-w-3xl mx-auto px-4">
                Transform your ideas into reality with AI-powered development.
                No code? No problem.
              </p>
            </div>

            {/* Futuristic Prompt Banner */}
            <motion.form
              onSubmit={handlePromptSubmit}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="relative group"
            >
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition duration-500"></div>

              {/* Main Input Container - Compact on small screens */}
              <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-xl lg:rounded-2xl border border-blue-500/30 p-4 lg:p-6 xl:p-8 shadow-2xl">
                <div className="flex items-center gap-2 lg:gap-4 mb-3 lg:mb-4">
                  <div className="p-2 lg:p-3 rounded-lg lg:rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                    <Rocket className="h-4 w-4 lg:h-6 lg:w-6 text-blue-400" />
                  </div>
                  <label className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-white">
                    Start building by telling me what you envision
                  </label>
                </div>

                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Build a modern todo app with animations and dark mode..."
                  className="w-full h-24 lg:h-32 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 text-sm lg:text-base xl:text-lg resize-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 rounded-lg lg:rounded-xl"
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 lg:gap-4 mt-4 lg:mt-6">
                  <div className="flex items-center gap-2 text-xs lg:text-sm text-slate-400">
                    <Network className="h-3 w-3 lg:h-4 lg:w-4" />
                    <span className="hidden sm:inline">Powered by multi-agent AI orchestration</span>
                    <span className="sm:hidden">AI Orchestration</span>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={!prompt.trim()}
                    className="w-full sm:w-auto px-6 lg:px-8 py-4 lg:py-6 text-base lg:text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {user ? 'Generate' : 'Get Started'}
                    <ArrowRight className="ml-2 h-4 w-4 lg:h-5 lg:w-5" />
                  </Button>
                </div>
              </div>
            </motion.form>

            {/* Quick Stats - Compact on small screens */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap justify-center gap-4 lg:gap-8 mt-8 lg:mt-12 text-blue-300/70 text-xs lg:text-sm"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span>Real-time code streaming</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span>WebContainer runtime</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span>Instant preview</span>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Features Grid - Better spacing on laptop screens */}
        <section className="container mx-auto px-4 lg:px-6 pb-12 lg:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-6xl mx-auto"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group relative"
              >
                {/* Card Glow */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-0 group-hover:opacity-30 transition duration-500"></div>

                {/* Card Content */}
                <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-xl p-6 hover:border-blue-500/30 transition-all duration-300">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 w-fit mb-4 group-hover:from-blue-500/20 group-hover:to-purple-500/20 transition-all duration-300">
                    <div className="text-blue-400">{feature.icon}</div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* How It Works Section */}
        <section className="container mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-8">
              How It Works
            </h2>
            <p className="text-xl text-blue-200/80 max-w-3xl mx-auto">
              From idea to reality in three simple steps
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative bg-slate-900/60 backdrop-blur-xl rounded-3xl p-12 border border-slate-800/50 max-w-6xl mx-auto"
          >
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-20"></div>
            
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  1. Share Your Vision
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Describe what you want to build. Our AI understands context and your requirements.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Network className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  2. AI Orchestration
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Specialized agents work together, each bringing unique skills to your project.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Rocket className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  3. Deploy Instantly
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  See your creation come to life instantly with live preview and iteration.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center max-w-4xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Create Something Amazing?
            </h2>
            <p className="text-xl text-blue-200/80 mb-8">
              Join developers who are building the future with AI-powered tools
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Button
                  size="lg"
                  className="px-8 py-6 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white"
                  asChild
                >
                  <a href="/playground">
                    <Rocket className="h-5 w-5 mr-2" />
                    Go to Playground
                  </a>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="px-8 py-6 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white"
                  onClick={() => setShowAuthDialog(true)}
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start Building Free
                </Button>
              )}
            </div>
          </motion.div>
        </section>
      </div>

      {/* Auth Dialog */}
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}

