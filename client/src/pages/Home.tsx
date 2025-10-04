import { motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Zap,
  Users,
  Code,
  Brain,
  Terminal,
  ArrowRight,
  CheckCircle,
  Play,
  Github,
  Shield,
  Globe,
  BookOpen,
  Network,
  Lightbulb,
  Rocket,
  Target,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';

export default function Home() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { user } = useAuth();

  const features = [
    {
      icon: <Rocket className="h-6 w-6" />,
      title: 'Create Anything',
      description:
        'From simple components to complex applications, build whatever you can imagine with intelligent AI assistance.',
      highlight: 'Unlimited Creation',
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Collaborate Seamlessly',
      description:
        'Work together on projects with real-time collaboration, shared workspaces, and team coordination tools.',
      highlight: 'Team Projects',
    },
    {
      icon: <BookOpen className="h-6 w-6" />,
      title: 'Knowledge Base',
      description:
        "Build and maintain your team's knowledge repository. Teach AI your patterns, preferences, and domain expertise.",
      highlight: 'Smart Learning',
    },
    {
      icon: <Network className="h-6 w-6" />,
      title: 'AI Orchestration',
      description:
        'Deploy specialized sub-agents that work together, each with unique skills and knowledge for complex projects.',
      highlight: 'Multi-Agent System',
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: 'Live Development',
      description:
        'See your ideas come to life instantly with integrated development server and real-time preview.',
      highlight: 'Instant Results',
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: 'Context-Aware AI',
      description:
        'AI that understands your project context, team knowledge, and goals to provide relevant, intelligent assistance.',
      highlight: 'Contextual Intelligence',
    },
  ];

  const stats = [
    {
      label: 'Projects Created',
      value: 'Unlimited',
      icon: <Rocket className="h-5 w-5" />,
    },
    {
      label: 'Team Members',
      value: 'Unlimited',
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: 'Knowledge Base',
      value: 'Growing',
      icon: <BookOpen className="h-5 w-5" />,
    },
    {
      label: 'AI Agents',
      value: 'Specialized',
      icon: <Network className="h-5 w-5" />,
    },
  ];

  const pricingTiers = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      description: 'Perfect for getting started',
      features: [
        '100,000 tokens/month',
        'Basic AI assistance',
        'Community support',
        'Public projects',
        'Standard agents',
      ],
      cta: 'Get Started Free',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$20',
      period: '/month',
      description: 'For professional developers',
      features: [
        '1M tokens/month',
        'Advanced AI orchestration',
        'Priority support',
        'Private projects',
        'Custom agents',
        'Team collaboration',
      ],
      cta: 'Start Pro Trial',
      popular: true,
    },
    {
      name: 'Team',
      price: '$50',
      period: '/month',
      description: 'For growing teams',
      features: [
        '3M tokens/month',
        'Custom knowledge bases',
        'Advanced analytics',
        'Team workspaces',
        'Custom integrations',
        'Priority support',
      ],
      cta: 'Start Team Trial',
      popular: false,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For organizations',
      features: [
        'Unlimited tokens',
        'Dedicated support',
        'Custom deployments',
        'Advanced security',
        'SLA guarantee',
        'On-premise options',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10"></div>
        </div>
        <div className="container mx-auto px-6 py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-5xl mx-auto"
          >
            <Badge
              variant="secondary"
              className="mb-8 px-6 py-3 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Intelligent Development Platform
            </Badge>

            <h1 className="text-6xl md:text-8xl font-bold text-white mb-8 leading-tight">
              Create Anything
              <br />
              <span className="text-5xl md:text-6xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Together
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-4xl mx-auto leading-relaxed font-light">
              Build anything you can imagine with intelligent AI assistance,
              seamless team collaboration, and a growing knowledge base that
              learns from your work.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
              {user ? (
                <Button
                  size="lg"
                  className="px-10 py-5 text-lg bg-white text-slate-900 hover:bg-gray-100 font-semibold shadow-xl"
                  asChild
                >
                  <a href="/playground">
                    <Terminal className="h-5 w-5 mr-3" />
                    Go to Playground
                    <ArrowRight className="h-5 w-5 ml-3" />
                  </a>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="px-10 py-5 text-lg bg-white text-slate-900 hover:bg-gray-100 font-semibold shadow-xl"
                  onClick={() => setShowAuthDialog(true)}
                >
                  <Sparkles className="h-5 w-5 mr-3" />
                  Start Building Free
                  <ArrowRight className="h-5 w-5 ml-3" />
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="px-10 py-5 text-lg border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
              >
                <Play className="h-5 w-5 mr-3" />
                Watch Demo
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-12 text-base text-blue-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                No credit card required
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                100K tokens free monthly
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                Team collaboration
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center group"
              >
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl group-hover:from-blue-100 group-hover:to-indigo-200 transition-all duration-300">
                    <div className="text-blue-600">{stat.icon}</div>
                  </div>
                </div>
                <div className="text-4xl font-bold text-slate-900 mb-2">
                  {stat.value}
                </div>
                <div className="text-slate-600 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Capabilities Section */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-8">
              How It Works
            </h2>
            <p className="text-xl text-slate-600 max-w-4xl mx-auto leading-relaxed">
              From idea to reality in three simple steps. Build, collaborate,
              and scale with intelligent assistance.
            </p>
          </motion.div>

          {/* Process Flow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl p-12 shadow-2xl border border-slate-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Lightbulb className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">
                  1. Share Your Vision
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Describe what you want to build. Our AI understands context
                  and leverages your team's knowledge base.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Network className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">
                  2. AI Orchestration
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Specialized agents work together, each bringing unique skills
                  and knowledge to your project.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Rocket className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">
                  3. Deploy & Iterate
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  See your creation come to life instantly. Collaborate with
                  your team and refine together.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold text-slate-900 mb-8">
              Everything You Need to Create Together
            </h2>
            <p className="text-xl text-slate-600 max-w-4xl mx-auto leading-relaxed">
              From simple ideas to complex applications, our platform provides
              all the tools you need for collaborative, intelligent development.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-2 border-slate-100 hover:border-blue-200 group">
                  <CardHeader className="pb-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl group-hover:from-blue-100 group-hover:to-indigo-200 transition-all duration-300">
                        <div className="text-blue-600">{feature.icon}</div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-700 border-blue-200"
                      >
                        {feature.highlight}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl text-slate-900">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 leading-relaxed text-lg">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Large Container 2 - Platform Demo */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              See the Platform in Action
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Watch how teams are building amazing applications with our
              intelligent development platform
            </p>
          </motion.div>

          {/* Large Container for Platform Demo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 mb-16 border border-gray-700"
          >
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-4">
                Interactive Platform Demo
              </h3>
              <p className="text-gray-300">
                Place your platform screenshots, GIFs, or interactive demos here
              </p>
            </div>

            {/* Placeholder for Platform Demo Content */}
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <div className="flex items-center justify-center h-64 bg-gray-700 rounded-xl">
                <div className="text-center text-gray-400">
                  <Terminal className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Platform Demo Content</p>
                  <p className="text-sm">
                    Screenshots, GIFs, or interactive demos
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Video Banner Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Watch How It Works
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              See how teams are using our platform to build amazing applications
              in minutes
            </p>
          </motion.div>

          {/* Video Banner Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative bg-black rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="aspect-video bg-gray-900 flex items-center justify-center">
              <div className="text-center text-white">
                <Play className="h-20 w-20 mx-auto mb-4 opacity-50" />
                <p className="text-2xl font-semibold mb-2">
                  Product Demo Video
                </p>
                <p className="text-gray-400">Place your video content here</p>
              </div>
            </div>

            {/* Video overlay with play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                size="lg"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
              >
                <Play className="h-6 w-6 mr-2" />
                Watch Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-4">
              Start free, scale as you grow. No hidden fees, no surprises.
            </p>
            <p className="text-sm text-gray-500 max-w-2xl mx-auto">
              Tokens are consumed based on the complexity of your projects.
              Simple components use fewer tokens, while complex applications
              with multiple agents use more.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card
                  className={`h-full relative ${tier.popular ? 'border-primary shadow-lg scale-105' : ''}`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary text-white">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                    <div className="text-4xl font-bold text-primary">
                      {tier.price}
                      <span className="text-lg text-gray-500">
                        {tier.period}
                      </span>
                    </div>
                    <p className="text-gray-600">{tier.description}</p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {tier.features.map((feature, featureIndex) => (
                        <li
                          key={featureIndex}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={tier.popular ? 'default' : 'outline'}
                      onClick={() => setShowAuthDialog(true)}
                    >
                      {tier.cta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Create Something Amazing?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Join teams who are building the future together with intelligent
              AI assistance. Start creating today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Button
                  size="lg"
                  className="px-8 py-4 text-lg bg-white text-blue-600 hover:bg-gray-100"
                  asChild
                >
                  <a href="/playground">
                    <Terminal className="h-5 w-5 mr-2" />
                    Go to Playground
                  </a>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="px-8 py-4 text-lg bg-white text-blue-600 hover:bg-gray-100"
                  onClick={() => setShowAuthDialog(true)}
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start Building Free
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="px-8 py-4 text-lg border-white text-white hover:bg-white/10"
              >
                <Github className="h-5 w-5 mr-2" />
                View on GitHub
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Auth Dialog */}
      {showAuthDialog && (
        <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
      )}
    </div>
  );
}
