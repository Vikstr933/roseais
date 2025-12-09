import { motion, useScroll, useTransform } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
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
  Play,
  Star,
  Globe,
  Shield,
  Layers,
  Terminal,
  Palette,
  Database,
  FileCode,
  GitBranch,
  Eye,
  Heart,
  Github,
  Image as ImageIcon,
  Video,
  ChevronDown,
  MessageCircle,
  Smartphone,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';
import { apiFetch } from '../lib/api';

const techStack = [
  { icon: <Code className="h-5 w-5" />, name: 'React' },
  { icon: <Palette className="h-5 w-5" />, name: 'Tailwind' },
  { icon: <Database className="h-5 w-5" />, name: 'PostgreSQL' },
  { icon: <Terminal className="h-5 w-5" />, name: 'Node.js' },
  { icon: <Layers className="h-5 w-5" />, name: 'TypeScript' },
  { icon: <Globe className="h-5 w-5" />, name: 'Vercel' },
];

const categoryColors: Record<string, string> = {
  web_app: 'from-blue-500 to-cyan-500',
  mobile_app: 'from-purple-500 to-pink-500',
  api: 'from-emerald-500 to-teal-500',
  dashboard: 'from-amber-500 to-orange-500',
  e_commerce: 'from-rose-500 to-pink-500',
  portfolio: 'from-violet-500 to-indigo-500',
};

const categoryLabels: Record<string, string> = {
  web_app: 'Web App',
  mobile_app: 'Mobile App',
  api: 'API',
  dashboard: 'Dashboard',
  e_commerce: 'E-commerce',
  portfolio: 'Portfolio',
};

interface PlatformStats {
  totalUsers: number;
  totalProjects: number;
  totalFiles: number;
  activeProjects: number;
}

interface ShowcaseProject {
  id: number;
  name: string;
  description: string;
  category: string;
  fileCount: number;
  screenshotUrl?: string | null;
  thumbnailUrl?: string | null;
  remixCount: number;
  voteCount: number;
  viewCount: number;
}

export default function NewHome() {
  const [, setLocation] = useLocation();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [prompt, setPrompt] = useState('');
  const { user } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [showcaseProjects, setShowcaseProjects] = useState<ShowcaseProject[]>([]);
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  // Fetch real platform stats and public projects
  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch platform stats
        const statsResponse = await apiFetch('/api/stats/platform');
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          if (statsData.success) {
            setStats(statsData.stats);
          }
        }

        // Fetch featured public projects for showcase
        const projectsResponse = await apiFetch('/api/public-projects?featured=true&sort=popular&limit=6');
        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          if (projectsData.success) {
            setShowcaseProjects(projectsData.projects || []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    }
    fetchStats();
  }, []);

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    if (!user) {
      setShowAuthDialog(true);
      localStorage.setItem('pendingPrompt', prompt);
    } else {
      setLocation(`/playground?prompt=${encodeURIComponent(prompt)}`);
    }
  };

  const features = [
    {
      title: 'Multi-Agent Orchestration',
      shortDescription: 'Multiple specialized agents work together on each task',
      fullDescription: 'Our system automatically selects and coordinates multiple agents based on the task complexity. You can also create custom agents in the agent manager, and they\'ll be used when needed.',
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      title: 'Elon',
      shortDescription: 'Your AI assistant available everywhere you work',
      fullDescription: 'Access Elon from your phone, desktop, or directly in Discord servers. She can leverage your custom plugins, command agents to modify code, manage your emails, and assist with productivity tasks.',
      gradient: 'from-indigo-500 to-blue-600',
    },
    {
      title: 'Mobile Responsive',
      shortDescription: 'All projects are built mobile-first from day one',
      fullDescription: 'Every generated application is optimized for mobile devices from the start. Responsive breakpoints, touch-friendly interfaces, and adaptive layouts ensure a perfect experience on any screen size.',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Work on Existing Projects',
      shortDescription: 'Import GitHub repositories and continue development here',
      fullDescription: 'Bring your existing GitHub projects into the platform and work on them seamlessly. No desktop IDE required—everything runs in your browser with full AI assistance.',
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Smart Cost Optimization',
      shortDescription: 'Automatically selects the most efficient AI models',
      fullDescription: 'Our intelligent system chooses the most cost-effective AI model for each task, helping you save on API costs while maintaining high-quality results.',
      gradient: 'from-rose-500 to-pink-600',
    },
    {
      title: 'Real-Time Collaboration',
      shortDescription: 'Work together without conflicts or code collisions',
      fullDescription: 'Multiple team members can collaborate on the same project simultaneously. Our system prevents conflicting code changes and ensures smooth concurrent generations.',
      gradient: 'from-cyan-500 to-blue-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-cyan-50 text-gray-900 overflow-x-hidden">
      {/* Gradient Mesh Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Primary gradient orbs - bright and vibrant */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-400/40 rounded-full blur-[120px] animate-float" />
        <div className="absolute top-[20%] right-[-15%] w-[500px] h-[500px] bg-pink-400/40 rounded-full blur-[100px] animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] bg-cyan-400/40 rounded-full blur-[80px] animate-float" style={{ animationDelay: '2s' }} />
        
        {/* Grid overlay - more visible on light background */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px'
          }}
        />
        
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.02] bg-noise" />
      </div>

      {/* Hero Section */}
      <motion.section 
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-32"
      >
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 border border-purple-200/50 backdrop-blur-sm mb-8 shadow-lg"
          >
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 text-sm font-medium">Live</span>
            </div>
            <div className="w-px h-4 bg-purple-300/50" />
            <span className="text-purple-700 text-sm font-medium">Powered by Multi-Agent AI</span>
          </motion.div>

          {/* Main Headline - Bolt.new inspired */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6"
          >
            <span className="text-gray-900">What will you</span>
            <br />
            <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              build today?
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg sm:text-xl text-gray-700 max-w-2xl mx-auto mb-12"
          >
            Describe your vision. Watch it become reality. 
            No coding required—just your imagination.
          </motion.p>

          {/* Main Input - Premium Design */}
          <motion.form
            onSubmit={handlePromptSubmit}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative max-w-3xl mx-auto"
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-400/30 via-purple-400/30 to-indigo-400/30 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
            
            {/* Input container */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl border border-purple-200/50 p-2 shadow-2xl">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Build me a modern SaaS dashboard with user authentication, real-time analytics, and a beautiful bright theme..."
                className="w-full min-h-[140px] bg-transparent border-0 text-gray-900 placeholder:text-gray-400 text-lg resize-none focus:ring-2 focus:ring-purple-400 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-0 p-4"
              />
              
              <div className="flex items-center justify-between p-3 pt-0">
                <div className="flex items-center gap-3 text-gray-600 text-sm">
                  <kbd className="px-2 py-1 bg-purple-100 rounded text-xs text-purple-700 font-medium">⌘K</kbd>
                  <span>for quick actions</span>
                </div>
                
                <Button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="px-8 py-6 text-base font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 rounded-xl shadow-lg shadow-violet-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  {user ? 'Generate' : 'Start Building'}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </div>
          </motion.form>

          {/* Tech Stack Pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 mt-10"
          >
            <span className="text-gray-600 text-sm mr-2">Built with</span>
            {techStack.map((tech, i) => (
              <motion.div
                key={tech.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.05 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/90 rounded-full border border-purple-200/50 text-purple-700 text-sm hover:bg-purple-50 hover:text-purple-800 transition-colors cursor-default shadow-sm"
              >
                {tech.icon}
                <span>{tech.name}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Real Platform Stats */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto"
            >
              {[
                { value: stats.totalProjects, label: 'Projects Created', icon: <FileCode className="h-5 w-5" /> },
                { value: stats.totalFiles, label: 'Files Generated', icon: <Code className="h-5 w-5" /> },
                { value: stats.activeProjects, label: 'Active Projects', icon: <Zap className="h-5 w-5" /> },
                { value: stats.totalUsers, label: 'Developers', icon: <Users className="h-5 w-5" /> },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9 + i * 0.05 }}
                  className="text-center"
                >
                  <div className="flex items-center justify-center gap-2 mb-2 text-violet-600">
                    {stat.icon}
                    <span className="text-3xl font-bold text-gray-900">{stat.value.toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-purple-300/50 flex items-start justify-center p-2"
          >
            <div className="w-1 h-2 bg-purple-500 rounded-full" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Project Showcase Section - Real data from database */}
      {showcaseProjects.length > 0 && (
        <section className="relative py-32 px-4">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                <span className="text-gray-900">See what others are</span>{' '}
                <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                  building
                </span>
              </h2>
              <p className="text-lg text-gray-700 max-w-2xl mx-auto">
                Real projects created by our community
              </p>
            </motion.div>

            {/* Project Grid - Real projects */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {showcaseProjects.slice(0, 6).map((project, index) => {
                const categoryGradient = categoryColors[project.category] || categoryColors.web_app;
                const categoryLabel = categoryLabels[project.category] || project.category;
                const hasScreenshot = project.screenshotUrl || project.thumbnailUrl;
                
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="group relative"
                  >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-400/40 to-indigo-400/40 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl border border-purple-200/50 overflow-hidden hover:border-purple-300/70 transition-all duration-500 shadow-lg hover:shadow-xl">
                      {/* Screenshot or gradient header */}
                      <div className={`aspect-[4/3] relative overflow-hidden ${
                        hasScreenshot ? '' : `bg-gradient-to-br ${categoryGradient}`
                      }`}>
                        {hasScreenshot ? (
                          <img
                            src={project.screenshotUrl || project.thumbnailUrl || ''}
                            alt={project.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to gradient if image fails
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.className = `aspect-[4/3] relative overflow-hidden bg-gradient-to-br ${categoryGradient}`;
                              }
                            }}
                          />
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(139,92,246,0.2)_100%)]" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="p-6 rounded-2xl bg-white/90 backdrop-blur-sm border border-purple-200/50 shadow-lg">
                                <FileCode className="h-12 w-12 text-purple-600" />
                              </div>
                            </div>
                          </>
                        )}
                        {/* Stats badges */}
                        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm border border-purple-200/50 text-purple-700 text-xs flex items-center gap-1.5 shadow-md">
                              <Code className="h-3.5 w-3.5" />
                              <span>{project.fileCount} files</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {project.remixCount > 0 && (
                              <div className="px-2 py-1 rounded-full bg-white/95 backdrop-blur-sm text-purple-700 text-xs flex items-center gap-1 shadow-md border border-purple-200/50">
                                <GitBranch className="h-3 w-3" />
                                <span>{project.remixCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-purple-600/90 via-purple-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6 gap-2">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white"
                            onClick={() => setLocation(`/playground/${project.id}`)}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Open Project
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white/90 hover:bg-white text-purple-700 border-purple-200/50"
                            onClick={() => setLocation(`/public-projects`)}
                          >
                            <GitBranch className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-gray-900 font-semibold text-lg group-hover:text-violet-600 transition-colors truncate">{project.name}</h3>
                            <p className="text-gray-600 text-sm capitalize">{categoryLabel}</p>
                          </div>
                        </div>
                        {project.description && (
                          <p className="text-gray-700 text-sm line-clamp-2 mb-3">{project.description}</p>
                        )}
                        {/* Stats */}
                        <div className="flex items-center gap-4 text-gray-600 text-xs pt-3 border-t border-purple-200/30">
                          <div className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            <span>{project.viewCount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <GitBranch className="h-3.5 w-3.5" />
                            <span>{project.remixCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Heart className="h-3.5 w-3.5" />
                            <span>{project.voteCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* View All Button */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mt-12"
            >
              <Button 
                variant="outline" 
                size="lg" 
                className="border-purple-300/50 text-purple-700 hover:bg-purple-50 bg-white/90"
                onClick={() => setLocation('/public-projects')}
              >
                View All Projects
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </section>
      )}

      {/* Features Grid */}
      <section className="relative py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              <span className="text-gray-900">Built for</span>{' '}
              <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                speed & scale
              </span>
            </h2>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              Everything you need to go from idea to production in minutes
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const isExpanded = expandedFeature === index;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-200/30 to-pink-200/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl border border-purple-200/50 overflow-hidden hover:border-purple-300/70 transition-all duration-300 shadow-lg hover:shadow-xl">
                    {/* Header - Clickable */}
                    <button
                      onClick={() => setExpandedFeature(isExpanded ? null : index)}
                      className="w-full text-left p-6 md:p-8 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded-t-2xl"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                          <p className="text-gray-700 text-base md:text-lg leading-relaxed">{feature.shortDescription}</p>
                        </div>
                        <div className={`flex-shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown className="h-5 w-5 text-purple-600" />
                        </div>
                      </div>
                    </button>
                    
                    {/* Expandable Content */}
                    <motion.div
                      initial={false}
                      animate={{
                        height: isExpanded ? 'auto' : 0,
                        opacity: isExpanded ? 1 : 0,
                      }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 md:px-8 pb-6 md:pb-8 pt-0">
                        <div className="pt-4 border-t border-purple-200/50">
                          <p className="text-gray-700 text-sm md:text-base leading-relaxed">{feature.fullDescription}</p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Visual Demo Section */}
      <section className="relative py-32 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              <span className="text-gray-900">See it in</span>{' '}
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                action
              </span>
            </h2>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              Watch how our platform transforms ideas into reality
            </p>
          </motion.div>

          {/* Demo Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Main Demo Video */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-400/40 to-indigo-400/40 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl border border-purple-200/50 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="aspect-video bg-gradient-to-br from-purple-100 to-pink-100 relative flex items-center justify-center overflow-hidden rounded-t-2xl">
                  {/* Video placeholder - replace with your video */}
                  <video
                    id="main-demo-video"
                    className="w-full h-full object-cover"
                    controls
                    poster="/demos/main-demo-poster.jpg"
                    onError={(e) => {
                      // Hide video if it fails to load and show fallback
                      const target = e.target as HTMLVideoElement;
                      target.style.display = 'none';
                      const fallback = target.parentElement?.querySelector('.video-fallback') as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                    onLoadedData={(e) => {
                      // Hide fallback if video loads successfully
                      const target = e.target as HTMLVideoElement;
                      const fallback = target.parentElement?.querySelector('.video-fallback') as HTMLElement;
                      if (fallback) fallback.style.display = 'none';
                    }}
                  >
                    <source src="/demos/main-demo.mp4" type="video/mp4" />
                    <source src="/demos/main-demo.webm" type="video/webm" />
                    Your browser does not support the video tag.
                  </video>
                  {/* Fallback if video doesn't exist */}
                  <div className="video-fallback absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-200 to-pink-200" style={{ display: 'none' }}>
                    <div className="text-center p-8">
                      <Video className="h-16 w-16 text-purple-600 mx-auto mb-4" />
                      <p className="text-gray-700 font-semibold mb-2">Main Platform Demo</p>
                      <p className="text-sm text-gray-600">
                        Add your video to: <code className="bg-purple-100 px-2 py-1 rounded text-xs">/public/demos/main-demo.mp4</code>
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Optional poster: <code className="bg-purple-100 px-2 py-1 rounded">/public/demos/main-demo-poster.jpg</code>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Platform Overview</h3>
                  <p className="text-gray-700">
                    See how to build a complete application from scratch in minutes
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Secondary Demo - Image/GIF */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="group relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-400/40 to-indigo-400/40 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl border border-purple-200/50 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="aspect-video bg-gradient-to-br from-cyan-100 to-blue-100 relative flex items-center justify-center">
                  {/* Image/GIF placeholder - replace with your image or GIF */}
                  <img
                    src="/demos/feature-demo.gif"
                    alt="Feature demonstration"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Show placeholder if image doesn't exist
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {/* Fallback if image doesn't exist */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyan-200 to-blue-200">
                    <div className="text-center p-8">
                      <ImageIcon className="h-16 w-16 text-cyan-600 mx-auto mb-4" />
                      <p className="text-gray-700 font-semibold mb-2">Feature Demo</p>
                      <p className="text-sm text-gray-600">
                        Add your GIF/image to: <code className="bg-cyan-100 px-2 py-1 rounded text-xs">/public/demos/feature-demo.gif</code>
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Supports: GIF, PNG, JPG, WebP
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">AI in Action</h3>
                  <p className="text-gray-700">
                    Watch AI agents collaborate to build your project
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Additional Demo Slots */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="group relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-400/40 to-indigo-400/40 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl border border-purple-200/50 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="aspect-video bg-gradient-to-br from-emerald-100 to-teal-100 relative flex items-center justify-center">
                  <img
                    src="/demos/demo-3.jpg"
                    alt="Additional demo"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-200 to-teal-200">
                    <div className="text-center p-8">
                      <ImageIcon className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                      <p className="text-gray-700 font-semibold mb-2 text-sm">Demo Slot 3</p>
                      <p className="text-xs text-gray-600">
                        <code className="bg-emerald-100 px-2 py-1 rounded">/public/demos/demo-3.jpg</code>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Git Import Demo</h3>
                  <p className="text-gray-700">
                    See how easy it is to import and enhance existing repositories
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="group relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-400/40 to-indigo-400/40 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl border border-purple-200/50 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="aspect-video bg-gradient-to-br from-rose-100 to-pink-100 relative flex items-center justify-center">
                  <img
                    src="/demos/demo-4.jpg"
                    alt="Additional demo"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-200 to-pink-200">
                    <div className="text-center p-8">
                      <ImageIcon className="h-12 w-12 text-rose-600 mx-auto mb-3" />
                      <p className="text-gray-700 font-semibold mb-2 text-sm">Demo Slot 4</p>
                      <p className="text-xs text-gray-600">
                        <code className="bg-rose-100 px-2 py-1 rounded">/public/demos/demo-4.jpg</code>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Deployment Demo</h3>
                  <p className="text-gray-700">
                    One-click deployment to production with Vercel integration
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-gray-900">
              Three steps to magic
            </h2>
          </motion.div>

          <div className="relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-300/50 to-transparent -translate-y-1/2" />
            
            <div className="grid md:grid-cols-3 gap-12 md:gap-8">
              {[
                { step: '01', title: 'Describe', desc: 'Tell us what you want to build in plain English', icon: <Sparkles className="h-8 w-8" /> },
                { step: '02', title: 'Generate', desc: 'Watch our AI agents create your project in real-time', icon: <Network className="h-8 w-8" /> },
                { step: '03', title: 'Deploy', desc: 'Ship to production with one click on Vercel', icon: <Rocket className="h-8 w-8" /> },
              ].map((item, index) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                  className="relative text-center"
                >
                  <div className="relative z-10 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-6 shadow-lg shadow-violet-500/25">
                    <div className="text-white">{item.icon}</div>
                  </div>
                  <div className="text-violet-600 text-sm font-mono mb-2">{item.step}</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-700 max-w-xs mx-auto">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {/* Glow background */}
            <div className="absolute inset-0 bg-gradient-to-r from-violet-300/30 via-purple-300/30 to-indigo-300/30 blur-3xl" />
            
            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl border border-purple-200/50 p-12 md:p-16 shadow-2xl">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                <span className="text-gray-900">Ready to create</span>{' '}
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  something amazing?
                </span>
              </h2>
              <p className="text-xl text-gray-700 mb-10 max-w-2xl mx-auto">
                Join thousands of builders who are shipping faster with AI
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {user ? (
                  <Button
                    size="lg"
                    className="px-10 py-7 text-lg font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30"
                    onClick={() => setLocation('/playground')}
                  >
                    <Rocket className="h-5 w-5 mr-2" />
                    Open Playground
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="px-10 py-7 text-lg font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0 rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30"
                    onClick={() => setShowAuthDialog(true)}
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    Start Building Free
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  className="px-10 py-7 text-lg border-purple-300/50 text-purple-700 hover:bg-purple-50 rounded-xl bg-white/90"
                >
                  Watch Demo
                  <Play className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer spacer */}
      <div className="h-20" />

      {/* Auth Dialog */}
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}
