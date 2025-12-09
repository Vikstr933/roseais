import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Search,
  Package,
  Layout,
  FileText,
  Navigation,
  Database,
  Zap,
  Copy,
  Eye,
  Plus
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface Component {
  id: string;
  name: string;
  description: string;
  category: 'layout' | 'form' | 'navigation' | 'data-display' | 'feedback' | 'input';
  tags: string[];
  code: string;
  preview: string;
  dependencies: string[];
  framework: 'react' | 'vue' | 'angular';
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'landing' | 'dashboard' | 'ecommerce' | 'blog' | 'portfolio' | 'saas';
  preview: string;
  files: Array<{ path: string; content: string }>;
  features: string[];
  techStack: string[];
}

interface ComponentLibraryProps {
  onSelectComponent?: (component: Component) => void;
  onSelectTemplate?: (template: Template) => void;
}

const SAMPLE_COMPONENTS: Component[] = [
  {
    id: 'hero-section',
    name: 'Hero Section',
    description: 'Modern hero section with gradient background and CTA buttons',
    category: 'layout',
    tags: ['hero', 'landing', 'gradient', 'responsive'],
    code: `export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
          Build Amazing Apps
        </h1>
        <p className="text-xl md:text-2xl mb-8 text-blue-100">
          Create stunning applications with our AI-powered platform
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-8 py-4 bg-white text-blue-600 rounded-full font-semibold hover:bg-blue-50 transition-colors">
            Get Started
          </button>
          <button className="px-8 py-4 border-2 border-white text-white rounded-full font-semibold hover:bg-white/10 transition-colors">
            Learn More
          </button>
        </div>
      </div>
    </section>
  );
}`,
    preview: 'https://via.placeholder.com/400x300/6366f1/ffffff?text=Hero+Section',
    dependencies: [],
    framework: 'react'
  },
  {
    id: 'pricing-cards',
    name: 'Pricing Cards',
    description: 'Clean pricing cards with features and popular badge',
    category: 'layout',
    tags: ['pricing', 'cards', 'subscription', 'features'],
    code: `const plans = [
  {
    name: 'Starter',
    price: '$9',
    period: 'month',
    features: ['Up to 5 projects', 'Basic support', '1GB storage'],
    popular: false
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'month',
    features: ['Unlimited projects', 'Priority support', '10GB storage', 'Advanced analytics'],
    popular: true
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: 'month',
    features: ['Everything in Pro', 'Custom integrations', 'Unlimited storage', '24/7 support'],
    popular: false
  }
];

export function PricingCards() {
  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
      {plans.map((plan) => (
        <div key={plan.name} className={\`relative rounded-2xl border-2 p-8 \${plan.popular ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}\`}>
          {plan.popular && (
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
              Most Popular
            </div>
          )}
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold">{plan.price}</span>
              <span className="text-gray-600">/{plan.period}</span>
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <button className={\`w-full py-3 rounded-lg font-semibold transition-colors \${plan.popular ? 'bg-blue-500 text-white hover:bg-blue-600' : 'border-2 border-gray-300 hover:border-gray-400'}\`}>
              Choose Plan
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}`,
    preview: 'https://via.placeholder.com/400x300/f3f4f6/374151?text=Pricing+Cards',
    dependencies: [],
    framework: 'react'
  },
  {
    id: 'contact-form',
    name: 'Contact Form',
    description: 'Beautiful contact form with validation and animations',
    category: 'form',
    tags: ['contact', 'form', 'validation', 'responsive'],
    code: `import { useState } from 'react';

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      alert('Message sent successfully!');
      setFormData({ name: '', email: '', message: '' });
    }, 2000);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">Get In Touch</h2>

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          required
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Email
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          required
        />
      </div>

      <div className="mb-6">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Message
        </label>
        <textarea
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 h-32"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}`,
    preview: 'https://via.placeholder.com/400x300/ffffff/4f46e5?text=Contact+Form',
    dependencies: [],
    framework: 'react'
  }
];

const SAMPLE_TEMPLATES: Template[] = [
  {
    id: 'saas-landing',
    name: 'SaaS Landing Page',
    description: 'Complete landing page for SaaS products with hero, features, pricing, and testimonials',
    category: 'saas',
    preview: 'https://via.placeholder.com/600x400/6366f1/ffffff?text=SaaS+Landing',
    features: ['Hero Section', 'Feature Cards', 'Pricing Tables', 'Testimonials', 'CTA Sections'],
    techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Framer Motion'],
    files: [
      {
        path: 'src/App.tsx',
        content: '// Complete SaaS landing page implementation...'
      }
    ]
  },
  {
    id: 'admin-dashboard',
    name: 'Admin Dashboard',
    description: 'Modern admin dashboard with charts, tables, and responsive layout',
    category: 'dashboard',
    preview: 'https://via.placeholder.com/600x400/1e293b/ffffff?text=Dashboard',
    features: ['Charts & Analytics', 'Data Tables', 'User Management', 'Settings', 'Responsive Sidebar'],
    techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Recharts'],
    files: [
      {
        path: 'src/App.tsx',
        content: '// Complete dashboard implementation...'
      }
    ]
  },
  {
    id: 'portfolio-site',
    name: 'Portfolio Website',
    description: 'Personal portfolio with projects showcase and contact form',
    category: 'portfolio',
    preview: 'https://via.placeholder.com/600x400/0f172a/ffffff?text=Portfolio',
    features: ['Project Gallery', 'About Section', 'Skills Display', 'Contact Form', 'Dark Mode'],
    techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Framer Motion'],
    files: [
      {
        path: 'src/App.tsx',
        content: '// Complete portfolio implementation...'
      }
    ]
  }
];

export function ComponentLibrary({ onSelectComponent, onSelectTemplate }: ComponentLibraryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { toast } = useToast();

  const filteredComponents = SAMPLE_COMPONENTS.filter(component => {
    const matchesSearch = component.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         component.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         component.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || component.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const filteredTemplates = SAMPLE_TEMPLATES.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.features.some(feature => feature.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code Copied!",
      description: "Component code has been copied to your clipboard.",
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'layout': return <Layout className="h-4 w-4" />;
      case 'form': return <FileText className="h-4 w-4" />;
      case 'navigation': return <Navigation className="h-4 w-4" />;
      case 'data-display': return <Database className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Layout className="h-4 w-4" />
          Template Library
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Production-Ready Templates
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[calc(90vh-100px)]">
          {/* Search Bar */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search components and templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Tabs defaultValue="templates" className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="templates">Full Templates</TabsTrigger>
              <TabsTrigger value="components">Components</TabsTrigger>
            </TabsList>

            <TabsContent value="components" className="mt-4 h-full overflow-hidden">
              <div className="flex gap-4 h-full">
                {/* Category Filter */}
                <div className="w-48 space-y-2">
                  <h3 className="font-semibold text-sm text-gray-700">Categories</h3>
                  {['all', 'layout', 'form', 'navigation', 'data-display', 'feedback', 'input'].map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                        selectedCategory === category
                          ? 'bg-blue-100 text-blue-700'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {category !== 'all' && getCategoryIcon(category)}
                      {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
                    </button>
                  ))}
                </div>

                {/* Components Grid */}
                <ScrollArea className="flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
                    {filteredComponents.map((component) => (
                      <Card key={component.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{component.name}</CardTitle>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(component.code)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <CardDescription>{component.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <img
                              src={component.preview}
                              alt={component.name}
                              className="w-full h-32 object-cover rounded-md bg-gray-100"
                            />
                            <div className="flex flex-wrap gap-1">
                              {component.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                onSelectComponent?.(component);
                                setIsOpen(false);
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Component
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="mt-4 h-full overflow-hidden">
              <ScrollArea className="h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
                  {filteredTemplates.map((template) => (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <img
                            src={template.preview}
                            alt={template.name}
                            className="w-full h-40 object-cover rounded-md bg-gray-100"
                          />

                          <div>
                            <h4 className="font-semibold text-sm mb-2">Features:</h4>
                            <div className="flex flex-wrap gap-1">
                              {template.features.slice(0, 3).map((feature) => (
                                <Badge key={feature} variant="outline" className="text-xs">
                                  {feature}
                                </Badge>
                              ))}
                              {template.features.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{template.features.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold text-sm mb-2">Tech Stack:</h4>
                            <div className="flex flex-wrap gap-1">
                              {template.techStack.map((tech) => (
                                <Badge key={tech} className="text-xs bg-blue-100 text-blue-700">
                                  {tech}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <Button
                            className="w-full"
                            onClick={() => {
                              onSelectTemplate?.(template);
                              setIsOpen(false);
                            }}
                          >
                            <Zap className="h-4 w-4 mr-2" />
                            Use Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}