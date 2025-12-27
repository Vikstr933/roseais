import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Video,
  Youtube,
  Loader2,
  Download,
  Copy,
  ArrowLeft,
  FileText,
  Mic,
  Sparkles,
  Brain,
  HelpCircle,
  Upload,
  X,
  Settings,
  Radio,
  Waves,
  Lightbulb,
  TrendingUp,
  Zap,
  Clock,
  Award,
  BookOpen,
  Info,
  CheckCircle2,
  Target,
  BarChart3,
  Users,
  Eye,
  ThumbsUp,
  PlayCircle,
  Edit3,
  MessageSquare,
  Star,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, getApiUrl } from '../lib/api';
import { useToast } from '@/hooks/use-toast';
import { AuthDialog } from '@/components/AuthDialog';

interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface TranscriptionResult {
  transcription: string;
  script: string;
  videoTitle?: string;
  videoDuration?: number;
  segments?: TranscriptionSegment[];
}

interface AudioExtractionResult {
  audioId: string;
  audioPath: string | null;
  videoTitle?: string;
  videoDuration?: number;
  transcript?: string; // Direct transcript if available
  method?: 'direct_transcript' | 'audio_extraction';
}

// Interactive Waiting Room Component
function WaitingRoomContent({ 
  stage, 
  progress 
}: { 
  stage: 'idle' | 'uploading' | 'transcribing' | 'generating';
  progress: string;
}) {
  const [currentContentCategory, setCurrentContentCategory] = useState<'tips' | 'facts' | 'stats' | 'checklist'>('tips');
  const [currentContentIndex, setCurrentContentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [unlockedContent, setUnlockedContent] = useState<number[]>([]);
  const [checklistItems, setChecklistItems] = useState<Record<number, boolean>>({
    0: false,
    1: false,
    2: false,
    3: false,
  });

  // Comprehensive tips for better commentary
  const tips = [
    {
      icon: Lightbulb,
      title: 'Hook Your Audience Early',
      content: 'The first 15 seconds are crucial. Start with a compelling question or statement that makes viewers want to keep watching.',
      category: 'Engagement',
    },
    {
      icon: TrendingUp,
      title: 'Use Storytelling Structure',
      content: 'Follow the classic narrative arc: Setup → Conflict → Resolution. This keeps viewers engaged throughout the video.',
      category: 'Structure',
    },
    {
      icon: Zap,
      title: 'Vary Your Pacing',
      content: 'Mix slower, informative sections with faster-paced, exciting moments. This creates natural rhythm and maintains interest.',
      category: 'Delivery',
    },
    {
      icon: Brain,
      title: 'Add Context and Background',
      content: "Don't assume viewers know everything. Provide relevant background information to help them understand the situation better.",
      category: 'Content',
    },
    {
      icon: Award,
      title: 'Use Emphasis Markers',
      content: 'Mark important points with [EMPHASIS] in your script. This helps voice actors deliver key moments with more impact.',
      category: 'Formatting',
    },
    {
      icon: Clock,
      title: 'Include Natural Pauses',
      content: 'Add [PAUSE] markers for breathing and dramatic effect. This makes the narration feel more natural and gives viewers time to process information.',
      category: 'Formatting',
    },
    {
      icon: Target,
      title: 'Know Your Audience',
      content: 'Tailor your language and references to your target demographic. What resonates with one audience may not work for another.',
      category: 'Strategy',
    },
    {
      icon: MessageSquare,
      title: 'Ask Engaging Questions',
      content: 'Pose rhetorical questions throughout to keep viewers thinking. "What would you do in this situation?" creates engagement.',
      category: 'Engagement',
    },
    {
      icon: Eye,
      title: 'Use Visual Descriptions',
      content: 'Describe what viewers are seeing in detail. Even if footage shows it, verbal reinforcement helps mobile viewers.',
      category: 'Content',
    },
    {
      icon: Star,
      title: 'Create Memorable Moments',
      content: 'Build in 2-3 standout moments per video that viewers will remember and share. These become your video hooks.',
      category: 'Strategy',
    },
  ];

  // Fun facts about YouTube, AI, and transcription
  const facts = [
    {
      icon: Video,
      fact: 'The average YouTube commentary video is 8-12 minutes long, which is the sweet spot for viewer engagement.',
      category: 'YouTube',
    },
    {
      icon: Sparkles,
      fact: 'OpenAI Whisper can transcribe audio in 99 languages with near-human accuracy, even with background noise.',
      category: 'AI Technology',
    },
    {
      icon: Brain,
      fact: 'Commentary channels typically see 2-3x higher watch time when using well-structured scripts compared to improvised narration.',
      category: 'Performance',
    },
    {
      icon: TrendingUp,
      fact: 'Videos with commentary can generate up to 40% more views than raw footage alone, thanks to added context and storytelling.',
      category: 'Performance',
    },
    {
      icon: Mic,
      fact: 'Professional voice actors can record a 10-minute script in about 15-20 minutes, including retakes and adjustments.',
      category: 'Production',
    },
    {
      icon: Zap,
      fact: 'AI-generated scripts can help reduce scriptwriting time by up to 80%, allowing creators to focus on editing and production.',
      category: 'Efficiency',
    },
    {
      icon: Users,
      fact: 'Top commentary channels average 60-70% viewer retention, compared to 40-50% for unscripted content.',
      category: 'Performance',
    },
    {
      icon: BarChart3,
      fact: 'Videos with scripts see a 25% increase in subscriber conversion rates compared to off-the-cuff commentary.',
      category: 'Growth',
    },
    {
      icon: PlayCircle,
      fact: 'The best time to upload commentary videos is Tuesday-Thursday at 2-4 PM EST for maximum engagement.',
      category: 'Strategy',
    },
    {
      icon: ThumbsUp,
      fact: 'Commentary videos with scripts receive 35% more likes and comments, indicating higher viewer satisfaction.',
      category: 'Engagement',
    },
  ];

  // YouTube statistics
  const stats = [
    {
      icon: Eye,
      label: 'Avg. Views',
      value: '40% More',
      description: 'with commentary vs raw footage',
      color: 'blue',
    },
    {
      icon: Clock,
      label: 'Watch Time',
      value: '2-3x Higher',
      description: 'structured scripts vs improvised',
      color: 'purple',
    },
    {
      icon: ThumbsUp,
      label: 'Engagement',
      value: '35% More',
      description: 'likes & comments on scripted videos',
      color: 'pink',
    },
    {
      icon: TrendingUp,
      label: 'Subscribers',
      value: '25% More',
      description: 'conversion with scripted content',
      color: 'green',
    },
  ];

  // Checklist items
  const checklist = [
    {
      icon: Edit3,
      text: 'Plan your video title and description',
      tip: 'Use keywords that your audience searches for',
    },
    {
      icon: Video,
      text: 'Consider thumbnail ideas',
      tip: 'Bright colors and text work best',
    },
    {
      icon: Target,
      text: 'Identify key moments to highlight',
      tip: 'These become your video hooks',
    },
    {
      icon: MessageSquare,
      text: 'Think about questions to engage viewers',
      tip: 'Rhetorical questions boost comments',
    },
  ];

  // Get current content based on category
  const getCurrentContent = () => {
    switch (currentContentCategory) {
      case 'tips':
        return tips;
      case 'facts':
        return facts;
      case 'stats':
        return stats;
      case 'checklist':
        return checklist;
    }
  };

  const currentContent = getCurrentContent();

  // Rotate content categories and items
  useEffect(() => {
    if (stage === 'transcribing' || stage === 'generating') {
      // Rotate categories every 30 seconds
      const categoryInterval = setInterval(() => {
        setCurrentContentCategory((prev) => {
          const order: Array<'tips' | 'facts' | 'stats' | 'checklist'> = ['tips', 'facts', 'stats', 'checklist'];
          const currentIndex = order.indexOf(prev);
          return order[(currentIndex + 1) % order.length];
        });
        setCurrentContentIndex(0); // Reset index when changing category
      }, 30000);

      // Rotate items within category every 8 seconds
      const contentInterval = setInterval(() => {
        setCurrentContentIndex((prev) => (prev + 1) % currentContent.length);
      }, 8000);

      return () => {
        clearInterval(categoryInterval);
        clearInterval(contentInterval);
      };
    }
  }, [stage, currentContent.length]);

  // Track elapsed time and unlock content progressively
  useEffect(() => {
    if (stage === 'transcribing' || stage === 'generating') {
      const timer = setInterval(() => {
        setElapsedSeconds((prev) => {
          const newTime = prev + 1;
          // Unlock new content every 20 seconds
          const unlockIndex = Math.floor(newTime / 20);
          if (!unlockedContent.includes(unlockIndex) && unlockIndex < currentContent.length) {
            setUnlockedContent((prev) => [...prev, unlockIndex]);
          }
          return newTime;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setElapsedSeconds(0);
      setUnlockedContent([]);
    }
  }, [stage, currentContent.length, unlockedContent]);

  // Manual navigation
  const handleNext = () => {
    setCurrentContentIndex((prev) => (prev + 1) % currentContent.length);
  };

  const handlePrev = () => {
    setCurrentContentIndex((prev) => (prev - 1 + currentContent.length) % currentContent.length);
  };

  const handleCategoryChange = (category: 'tips' | 'facts' | 'stats' | 'checklist') => {
    setCurrentContentCategory(category);
    setCurrentContentIndex(0);
  };

  const toggleChecklistItem = (index: number) => {
    setChecklistItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'tips':
        return Lightbulb;
      case 'facts':
        return Info;
      case 'stats':
        return BarChart3;
      case 'checklist':
        return CheckCircle2;
      default:
        return Lightbulb;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'tips':
        return 'purple';
      case 'facts':
        return 'pink';
      case 'stats':
        return 'blue';
      case 'checklist':
        return 'green';
      default:
        return 'purple';
    }
  };

  const getCategoryClasses = (category: string, isActive: boolean) => {
    const baseClasses = 'p-3 rounded-xl border-2 transition-all text-center';
    if (!isActive) {
      return `${baseClasses} border-muted hover:border-purple-300 hover:bg-purple-50/50`;
    }
    
    switch (category) {
      case 'tips':
        return `${baseClasses} border-purple-600 bg-purple-50 shadow-md`;
      case 'facts':
        return `${baseClasses} border-pink-600 bg-pink-50 shadow-md`;
      case 'stats':
        return `${baseClasses} border-blue-600 bg-blue-50 shadow-md`;
      case 'checklist':
        return `${baseClasses} border-green-600 bg-green-50 shadow-md`;
      default:
        return `${baseClasses} border-purple-600 bg-purple-50 shadow-md`;
    }
  };

  const getCategoryIconClasses = (category: string, isActive: boolean) => {
    if (!isActive) return 'h-5 w-5 mx-auto mb-1 text-muted-foreground';
    
    switch (category) {
      case 'tips':
        return 'h-5 w-5 mx-auto mb-1 text-purple-600';
      case 'facts':
        return 'h-5 w-5 mx-auto mb-1 text-pink-600';
      case 'stats':
        return 'h-5 w-5 mx-auto mb-1 text-blue-600';
      case 'checklist':
        return 'h-5 w-5 mx-auto mb-1 text-green-600';
      default:
        return 'h-5 w-5 mx-auto mb-1 text-purple-600';
    }
  };

  const getCategoryTextClasses = (category: string, isActive: boolean) => {
    if (!isActive) return 'text-xs font-medium capitalize text-foreground';
    
    switch (category) {
      case 'tips':
        return 'text-xs font-medium capitalize text-purple-900';
      case 'facts':
        return 'text-xs font-medium capitalize text-pink-900';
      case 'stats':
        return 'text-xs font-medium capitalize text-blue-900';
      case 'checklist':
        return 'text-xs font-medium capitalize text-green-900';
      default:
        return 'text-xs font-medium capitalize text-purple-900';
    }
  };

  const getStatClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          container: 'p-4 rounded-xl border-2 border-blue-200 bg-blue-50',
          iconBg: 'p-2 bg-blue-100 rounded-lg',
          icon: 'h-5 w-5 text-blue-600',
          value: 'text-2xl font-bold text-blue-900 mb-1',
        };
      case 'purple':
        return {
          container: 'p-4 rounded-xl border-2 border-purple-200 bg-purple-50',
          iconBg: 'p-2 bg-purple-100 rounded-lg',
          icon: 'h-5 w-5 text-purple-600',
          value: 'text-2xl font-bold text-purple-900 mb-1',
        };
      case 'pink':
        return {
          container: 'p-4 rounded-xl border-2 border-pink-200 bg-pink-50',
          iconBg: 'p-2 bg-pink-100 rounded-lg',
          icon: 'h-5 w-5 text-pink-600',
          value: 'text-2xl font-bold text-pink-900 mb-1',
        };
      case 'green':
        return {
          container: 'p-4 rounded-xl border-2 border-green-200 bg-green-50',
          iconBg: 'p-2 bg-green-100 rounded-lg',
          icon: 'h-5 w-5 text-green-600',
          value: 'text-2xl font-bold text-green-900 mb-1',
        };
      default:
        return {
          container: 'p-4 rounded-xl border-2 border-blue-200 bg-blue-50',
          iconBg: 'p-2 bg-blue-100 rounded-lg',
          icon: 'h-5 w-5 text-blue-600',
          value: 'text-2xl font-bold text-blue-900 mb-1',
        };
    }
  };

  return (
    <div className="space-y-6 mb-6">
      {/* Progress Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-8"
      >
        <div className="flex flex-col items-center justify-center space-y-6">
          {/* Animated Loading Icon */}
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="h-20 w-20 rounded-full border-4 border-purple-200 border-t-purple-600"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              {stage === 'uploading' && (
                <Upload className="h-8 w-8 text-purple-600" />
              )}
              {stage === 'transcribing' && (
                <Mic className="h-8 w-8 text-purple-600" />
              )}
              {stage === 'generating' && (
                <Sparkles className="h-8 w-8 text-purple-600" />
              )}
            </div>
          </div>
          
          {/* Progress Text */}
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-foreground">{progress || 'Processing...'}</p>
            {stage === 'transcribing' && (
              <p className="text-sm text-muted-foreground">
                Analyzing audio and converting speech to text... This may take 2-3 minutes.
              </p>
            )}
            {stage === 'generating' && (
              <p className="text-sm text-muted-foreground">
                Creating engaging commentary script with AI... Almost done!
              </p>
            )}
            {stage === 'uploading' && (
              <p className="text-sm text-muted-foreground">
                Uploading your audio file to the server...
              </p>
            )}
            {(stage === 'transcribing' || stage === 'generating') && elapsedSeconds > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                <Clock className="h-3 w-3 inline mr-1" />
                Elapsed time: {formatTime(elapsedSeconds)}
              </p>
            )}
          </div>

          {/* Stage Indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={`h-2 w-2 rounded-full ${stage === 'uploading' ? 'bg-purple-600' : 'bg-purple-300'}`} />
            <div className={`h-1 w-8 ${stage === 'uploading' ? 'bg-purple-600' : 'bg-purple-300'}`} />
            <div className={`h-2 w-2 rounded-full ${stage === 'transcribing' ? 'bg-purple-600' : stage === 'generating' ? 'bg-purple-600' : 'bg-purple-300'}`} />
            <div className={`h-1 w-8 ${stage === 'generating' ? 'bg-purple-600' : 'bg-purple-300'}`} />
            <div className={`h-2 w-2 rounded-full ${stage === 'generating' ? 'bg-purple-600' : 'bg-purple-300'}`} />
          </div>
        </div>
      </motion.div>

      {/* Interactive Content - Only show during transcription/generation */}
      {(stage === 'transcribing' || stage === 'generating') && (
        <div className="space-y-6">
          {/* Category Tabs */}
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Explore Content</h3>
              <Badge variant="secondary" className="text-xs">
                Auto-rotates every 30s
              </Badge>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['tips', 'facts', 'stats', 'checklist'] as const).map((category) => {
                const CategoryIcon = getCategoryIcon(category);
                const isActive = currentContentCategory === category;
                return (
                  <motion.button
                    key={category}
                    onClick={() => handleCategoryChange(category)}
                    className={getCategoryClasses(category, isActive)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <CategoryIcon className={getCategoryIconClasses(category, isActive)} />
                    <p className={getCategoryTextClasses(category, isActive)}>
                      {category}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Main Content Card */}
          <motion.div
            key={`${currentContentCategory}-${currentContentIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card-elevated p-6"
          >
            {currentContentCategory === 'tips' && currentContentIndex < tips.length && (
              <div className="space-y-4">
                {(() => {
                  const tip = tips[currentContentIndex];
                  const TipIcon = tip.icon;
                  return (
                    <>
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-purple-100 rounded-xl">
                          <TipIcon className="h-6 w-6 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-foreground">Pro Tip</h3>
                            <Badge variant="secondary" className="text-xs">
                              {currentContentIndex + 1} / {tips.length}
                            </Badge>
                            <Badge variant="outline" className="text-xs ml-auto">
                              {tip.category}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-foreground mb-2">{tip.title}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{tip.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex gap-1">
                          {tips.map((_, index) => (
                            <div
                              key={index}
                              className={`h-1.5 rounded-full transition-all ${
                                index === currentContentIndex ? 'bg-purple-600 w-8' : 'bg-purple-200 w-1.5'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={handlePrev}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleNext}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {currentContentCategory === 'facts' && currentContentIndex < facts.length && (
              <div className="space-y-4">
                {(() => {
                  const fact = facts[currentContentIndex];
                  const FactIcon = fact.icon;
                  return (
                    <>
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-pink-100 rounded-xl">
                          <FactIcon className="h-6 w-6 text-pink-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-foreground">Did You Know?</h3>
                            <Badge variant="secondary" className="text-xs">
                              {currentContentIndex + 1} / {facts.length}
                            </Badge>
                            <Badge variant="outline" className="text-xs ml-auto">
                              {fact.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{fact.fact}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex gap-1">
                          {facts.map((_, index) => (
                            <div
                              key={index}
                              className={`h-1.5 rounded-full transition-all ${
                                index === currentContentIndex ? 'bg-pink-600 w-8' : 'bg-pink-200 w-1.5'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={handlePrev}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleNext}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {currentContentCategory === 'stats' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Performance Statistics</h3>
                  <Badge variant="secondary" className="text-xs">
                    Based on industry data
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {stats.map((stat, index) => {
                    const StatIcon = stat.icon;
                    const classes = getStatClasses(stat.color);
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className={classes.container}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={classes.iconBg}>
                            <StatIcon className={classes.icon} />
                          </div>
                          <span className="text-xs text-muted-foreground">{stat.label}</span>
                        </div>
                        <p className={classes.value}>{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.description}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {currentContentCategory === 'checklist' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Pre-Production Checklist</h3>
                  <Badge variant="secondary" className="text-xs">
                    {Object.values(checklistItems).filter(Boolean).length} / {checklist.length} completed
                  </Badge>
                </div>
                <div className="space-y-3">
                  {checklist.map((item, index) => {
                    const ItemIcon = item.icon;
                    const isChecked = checklistItems[index];
                    return (
                      <motion.button
                        key={index}
                        onClick={() => toggleChecklistItem(index)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                          isChecked
                            ? 'border-green-500 bg-green-50'
                            : 'border-muted hover:border-green-300 hover:bg-green-50/50'
                        }`}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 ${isChecked ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {isChecked ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <ItemIcon className={`h-4 w-4 ${isChecked ? 'text-green-600' : 'text-muted-foreground'}`} />
                              <p className={`text-sm font-medium ${isChecked ? 'text-green-900 line-through' : 'text-foreground'}`}>
                                {item.text}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground ml-6">{item.tip}</p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Sidebar Stats */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card-elevated p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Processing Time</p>
                  <p className="text-lg font-bold text-foreground">{formatTime(elapsedSeconds)}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </div>
            <div className="card-elevated p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Content Viewed</p>
                  <p className="text-lg font-bold text-foreground">{unlockedContent.length} / {currentContent.length}</p>
                </div>
                <Eye className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </div>
            <div className="card-elevated p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Checklist Progress</p>
                  <p className="text-lg font-bold text-foreground">
                    {Object.values(checklistItems).filter(Boolean).length} / {checklist.length}
                  </p>
                </div>
                <Target className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VideoTranscriptionApp() {
  const [, setLocation] = useLocation();
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [extractedAudio, setExtractedAudio] = useState<AudioExtractionResult | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [openAIScript, setOpenAIScript] = useState<string | null>(null);
  const [isGeneratingOpenAIScript, setIsGeneratingOpenAIScript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [transcriptionStage, setTranscriptionStage] = useState<'idle' | 'uploading' | 'transcribing' | 'generating'>('idle');
  
  // Transcription settings - initialized as empty to require user selection
  const [tone, setTone] = useState<string>('');
  const [style, setStyle] = useState<string>('');
  const [scriptLanguage, setScriptLanguage] = useState<string>('en'); // Default to English

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/m4a'];
      const validExtensions = ['.mp3', '.wav', '.ogg', '.webm', '.m4a'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an audio file (MP3, WAV, OGG, WebM, or M4A)',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (25MB max - OpenAI Whisper API limit)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (25MB)`,
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUploadAudio = async () => {
    if (!selectedFile) {
      toast({
        title: 'Error',
        description: 'Please select an audio file',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    setIsUploading(true);
    setError(null);
    setExtractedAudio(null);
    setProgress('Uploading audio file...');
    setTranscriptionStage('uploading');

    try {
      // Use FormData for efficient file upload (multipart/form-data)
      // This is much more memory-efficient than base64 JSON
      const formData = new FormData();
      formData.append('audio', selectedFile);

      // Get auth token for the request
      const token = sessionToken || localStorage.getItem('sessionToken');
      
      // Use getApiUrl helper to get correct URL (uses Vite proxy in dev, Render URL in prod)
      const apiUrl = getApiUrl('/api/video/upload-audio');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          // Don't set Content-Type - browser will set it with boundary for multipart/form-data
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include', // Important for CORS
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to upload audio (${response.status})`);
      }

      const data = await response.json();
      
      if (data.success) {
        const extractionResult: AudioExtractionResult = {
          audioId: data.audioId,
          audioPath: data.audioPath || null,
          videoTitle: selectedFile.name,
          videoDuration: undefined,
          transcript: undefined,
          method: 'audio_extraction',
        };
        
      setExtractedAudio(extractionResult);
      setProgress('');
      setTranscriptionStage('idle'); // Reset stage after successful upload
      // Reset tone and style to require user selection
      setTone('');
      setStyle('');
      
      toast({
        title: 'Audio Uploaded!',
        description: 'Please configure transcription settings and then start transcription.',
      });
      } else {
        throw new Error(data.error || 'Failed to upload audio');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload audio');
      setProgress('');
      setTranscriptionStage('idle'); // Reset stage on error too
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to upload audio',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!extractedAudio) {
      toast({
        title: 'Error',
        description: 'Please extract audio first',
        variant: 'destructive',
      });
      return;
    }

    // Validate that tone and style are selected
    if (!tone || !style) {
      toast({
        title: 'Settings Required',
        description: 'Please select both tone and style before starting transcription',
        variant: 'destructive',
      });
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setTranscriptionResult(null);
    setProgress('Transcribing audio...');
    setTranscriptionStage('transcribing');

    try {
      // If we have a direct transcript, send it to avoid re-fetching
      const requestBody: any = {
        audioId: extractedAudio.audioId,
        audioPath: extractedAudio.audioPath,
        scriptProvider: 'haiku', // Use Haiku by default
        tone: tone,
        style: style,
        scriptLanguage: scriptLanguage,
      };
      
      if (extractedAudio.transcript) {
        requestBody.transcript = extractedAudio.transcript;
        setProgress('Generating script from transcript...');
        setTranscriptionStage('generating');
      } else {
        setProgress('Transcribing audio...');
        setTranscriptionStage('transcribing');
      }

      const response = await apiFetch('/api/video/transcribe', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to transcribe audio (${response.status})`);
      }

      const data = await response.json();
      
      if (data.success) {
        setTranscriptionResult({
          transcription: data.transcription || '',
          script: data.script || '',
          videoTitle: extractedAudio.videoTitle || data.videoTitle,
          videoDuration: extractedAudio.videoDuration || data.videoDuration,
        });
        setProgress('');
        setTranscriptionStage('idle');
        toast({
          title: 'Success!',
          description: 'Audio transcribed and script generated successfully',
        });
      } else {
        throw new Error(data.error || 'Failed to transcribe audio');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe video';
      setError(errorMessage);
      setTranscriptionStage('idle');
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopy = (text: string, type: 'transcription' | 'script') => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${type === 'transcription' ? 'Transcription' : 'Script'} copied to clipboard`,
    });
  };

  const handleDownload = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Downloaded!',
      description: `${filename} downloaded successfully`,
    });
  };

  // Format time for display (MM:SS)
  const formatDisplayTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time in seconds to SRT format (HH:MM:SS,mmm)
  const formatSRTTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  };

  // Format time in seconds to VTT format (HH:MM:SS.mmm)
  const formatVTTTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  // Convert segments to SRT format
  const segmentsToSRT = (segments: TranscriptionSegment[]): string => {
    return segments.map((seg, index) => {
      const startTime = formatSRTTime(seg.start);
      const endTime = formatSRTTime(seg.end);
      return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
    }).join('\n');
  };

  // Convert segments to VTT format
  const segmentsToVTT = (segments: TranscriptionSegment[]): string => {
    let vtt = 'WEBVTT\n\n';
    segments.forEach((seg) => {
      const startTime = formatVTTTime(seg.start);
      const endTime = formatVTTTime(seg.end);
      vtt += `${startTime} --> ${endTime}\n${seg.text}\n\n`;
    });
    return vtt;
  };

  const handleGenerateOpenAIScript = async () => {
    if (!transcriptionResult?.transcription) {
      toast({
        title: 'Error',
        description: 'No transcription available. Please transcribe audio first.',
        variant: 'destructive',
      });
      return;
    }

    if (!extractedAudio) {
      toast({
        title: 'Error',
        description: 'No audio file available. Please upload and transcribe audio first.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingOpenAIScript(true);
    setError(null);

    try {
      // Send the existing transcription along with audio info to generate script with OpenAI
      const requestBody: any = {
        audioId: extractedAudio.audioId,
        audioPath: extractedAudio.audioPath,
        transcript: transcriptionResult.transcription, // Send existing transcription
        scriptProvider: 'openai',
        videoTitle: transcriptionResult.videoTitle,
        tone: tone,
        style: style,
        scriptLanguage: scriptLanguage,
      };

      const response = await apiFetch('/api/video/transcribe', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to generate OpenAI script (${response.status})`);
      }

      const data = await response.json();
      
      if (data.success && data.script) {
        setOpenAIScript(data.script);
        toast({
          title: 'Success!',
          description: 'OpenAI script generated successfully',
        });
      } else {
        throw new Error(data.error || 'Failed to generate OpenAI script');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate OpenAI script';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingOpenAIScript(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-purple-50/30 to-background">
      {/* Premium Header */}
      <div className="w-full border-b border-purple-200/30 bg-white/80 backdrop-blur-xl mt-20 sticky top-20 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg shadow-purple-500/30">
                <Mic className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white shadow-sm animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Audio Transcription Studio</p>
              <p className="text-xs text-muted-foreground">AI-Powered YouTube Commentary Script Generator</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/public-projects')}
            className="text-muted-foreground hover:text-foreground hover:bg-purple-50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-6">
        {/* Compact Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="text-center mb-4">
            <h1 className="text-2xl md:text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
              Transform Audio Into Commentary Scripts
            </h1>
            <div className="flex flex-wrap justify-center gap-2 text-xs">
              <div className="px-3 py-1 bg-purple-50 border border-purple-200 rounded-full font-medium text-purple-700 flex items-center gap-1.5">
                <Mic className="h-3 w-3" />
                OpenAI Whisper
              </div>
              <div className="px-3 py-1 bg-pink-50 border border-pink-200 rounded-full font-medium text-pink-700 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                AI Scripts
              </div>
              <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full font-medium text-blue-700 flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                YouTube Ready
              </div>
            </div>
          </div>
        </motion.div>

        {/* Unified Main Container - All content in one card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-elevated p-6 mb-6"
        >
          {/* Upload State */}
          {!extractedAudio && !isUploading && !isTranscribing && transcriptionStage === 'idle' && (
            <div className="space-y-4">
              <div>
                <label className="text-base font-semibold mb-3 block text-foreground">
                  Upload Audio File
                </label>
                <p className="text-sm text-muted-foreground mb-4">
                  Supported formats: MP3, WAV, OGG, WebM, M4A • Maximum size: 25MB
                </p>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="file"
                      accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a"
                      onChange={handleFileSelect}
                      className="cursor-pointer h-12 text-sm"
                      disabled={isUploading || isTranscribing}
                    />
                  </div>
                  <Button
                    onClick={handleUploadAudio}
                    disabled={isUploading || !selectedFile || isTranscribing}
                    className="min-w-[160px] h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium shadow-lg shadow-purple-500/25"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Audio
                      </>
                    )}
                  </Button>
                </div>
                {selectedFile && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <FileText className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-purple-100"
                        onClick={() => {
                          setSelectedFile(null);
                          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                          if (fileInput) fileInput.value = '';
                        }}
                        disabled={isUploading || isTranscribing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* Processing State */}
          {(isUploading || isTranscribing || transcriptionStage !== 'idle') && (
            <WaitingRoomContent 
              stage={transcriptionStage}
              progress={progress}
            />
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4"
            >
              <p className="text-sm font-medium text-red-900">{error}</p>
            </motion.div>
          )}

          {/* Audio Ready + Settings State */}
          {extractedAudio && !isTranscribing && transcriptionStage === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Audio Ready Indicator */}
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-900">Audio Ready for Transcription</p>
                    {extractedAudio.videoTitle && (
                      <p className="text-xs text-green-700 mt-0.5">
                        {extractedAudio.videoTitle}
                        {extractedAudio.videoDuration && ` • ${Math.round(extractedAudio.videoDuration / 60)} min`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Transcription Settings Panel */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-5 w-5 text-purple-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Transcription Settings</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Please select tone and style before starting transcription</p>
                  </div>
                </div>

                {/* Tone Selection */}
                <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Waves className="h-4 w-4 text-purple-600" />
                        Tone <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: 'professional', label: 'Professional', desc: 'Authoritative & polished' },
                          { value: 'conversational', label: 'Conversational', desc: 'Friendly & approachable' },
                          { value: 'dramatic', label: 'Dramatic', desc: 'Intense & engaging' },
                          { value: 'educational', label: 'Educational', desc: 'Clear & instructional' },
                          { value: 'casual', label: 'Casual', desc: 'Relaxed & informal' },
                          { value: 'energetic', label: 'Energetic', desc: 'Enthusiastic & dynamic' },
                        ].map((option) => (
                          <motion.button
                            key={option.value}
                            onClick={() => setTone(option.value)}
                            className={`p-4 rounded-xl border-2 transition-all text-left ${
                              tone === option.value
                                ? 'border-purple-600 bg-purple-50 shadow-md'
                                : 'border-muted hover:border-purple-300 hover:bg-purple-50/50'
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Radio className={`h-4 w-4 ${tone === option.value ? 'text-purple-600' : 'text-muted-foreground'}`} />
                              <span className={`text-sm font-semibold ${tone === option.value ? 'text-purple-900' : 'text-foreground'}`}>
                                {option.label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{option.desc}</p>
                          </motion.button>
                        ))}
                      </div>
                </div>

                {/* Style Selection */}
                <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Brain className="h-4 w-4 text-purple-600" />
                        Style <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'detailed', label: 'Detailed', desc: 'Comprehensive context & thorough explanations' },
                          { value: 'concise', label: 'Concise', desc: 'To-the-point while maintaining clarity' },
                          { value: 'storytelling', label: 'Storytelling', desc: 'Narrative flow & dramatic structure' },
                          { value: 'analytical', label: 'Analytical', desc: 'Deep insights & critical examination' },
                        ].map((option) => (
                          <motion.button
                            key={option.value}
                            onClick={() => setStyle(option.value)}
                            className={`p-4 rounded-xl border-2 transition-all text-left ${
                              style === option.value
                                ? 'border-purple-600 bg-purple-50 shadow-md'
                                : 'border-muted hover:border-purple-300 hover:bg-purple-50/50'
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Radio className={`h-4 w-4 ${style === option.value ? 'text-purple-600' : 'text-muted-foreground'}`} />
                              <span className={`text-sm font-semibold ${style === option.value ? 'text-purple-900' : 'text-foreground'}`}>
                                {option.label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{option.desc}</p>
                          </motion.button>
                        ))}
                      </div>
                </div>

                {/* Script Language Selection */}
                <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Globe className="h-4 w-4 text-purple-600" />
                        Script Language
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { code: 'en', name: 'English', flag: '🇬🇧' },
                          { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
                          { code: 'es', name: 'Español', flag: '🇪🇸' },
                          { code: 'fr', name: 'Français', flag: '🇫🇷' },
                          { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
                          { code: 'it', name: 'Italiano', flag: '🇮🇹' },
                          { code: 'pt', name: 'Português', flag: '🇵🇹' },
                          { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
                        ].map((lang) => (
                          <motion.button
                            key={lang.code}
                            onClick={() => setScriptLanguage(lang.code)}
                            className={`p-3 rounded-xl border-2 transition-all text-center ${
                              scriptLanguage === lang.code
                                ? 'border-purple-600 bg-purple-50 shadow-md'
                                : 'border-muted hover:border-purple-300 hover:bg-purple-50/50'
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="text-2xl mb-1">{lang.flag}</div>
                            <p className={`text-xs font-medium ${scriptLanguage === lang.code ? 'text-purple-900' : 'text-foreground'}`}>
                              {lang.name}
                            </p>
                          </motion.button>
                        ))}
                      </div>
                </div>

                {/* Start Transcription Button - Disabled until tone and style are selected */}
                <div className="pt-2">
                  <Button
                    onClick={handleTranscribe}
                    disabled={isTranscribing || !tone || !style}
                    size="lg"
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/25 h-12 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mic className="h-5 w-5 mr-2" />
                    {!tone || !style 
                      ? 'Please select tone and style' 
                      : 'Start Transcription'}
                  </Button>
                  {(!tone || !style) && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      You must select both tone and style to continue
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Compact Results Section - Side by Side Layout */}
        {transcriptionResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Transcription Card */}
            <div className="card-elevated p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Mic className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Raw Transcription</h2>
                    <p className="text-xs text-muted-foreground">Direct transcription</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {transcriptionResult.segments && transcriptionResult.segments.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(segmentsToSRT(transcriptionResult.segments!), 'subtitles.srt')}
                        className="hover:bg-purple-50 h-8 px-2 text-xs"
                        title="Export as SRT subtitle file"
                      >
                        SRT
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(segmentsToVTT(transcriptionResult.segments!), 'subtitles.vtt')}
                        className="hover:bg-purple-50 h-8 px-2 text-xs"
                        title="Export as VTT subtitle file"
                      >
                        VTT
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(transcriptionResult.transcription, 'transcription')}
                    className="hover:bg-purple-50 h-8 px-2"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(transcriptionResult.transcription, 'transcription.txt')}
                    className="hover:bg-purple-50 h-8 px-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {transcriptionResult.segments && transcriptionResult.segments.length > 0 ? (
                <div className="flex-1 min-h-[300px] max-h-[500px] overflow-auto border border-muted rounded-lg bg-muted/50 p-3">
                  <div className="space-y-2">
                    {transcriptionResult.segments.map((seg, index) => (
                      <div
                        key={index}
                        className="p-2 rounded hover:bg-muted/80 transition-colors cursor-pointer"
                        title={`Click to jump to ${formatDisplayTime(seg.start)}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                            {formatDisplayTime(seg.start)} → {formatDisplayTime(seg.end)}
                          </span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{seg.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Textarea
                  value={transcriptionResult.transcription}
                  readOnly
                  className="flex-1 min-h-[300px] max-h-[500px] font-mono text-xs bg-muted/50 border-muted resize-none"
                />
              )}
            </div>

            {/* Script Card with Tabs */}
            <div className="card-elevated p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <FileText className="h-4 w-4 text-pink-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Commentary Script</h2>
                  <p className="text-xs text-muted-foreground">YouTube-ready format</p>
                </div>
              </div>
              <Tabs defaultValue="haiku" className="w-full flex flex-col flex-1 min-h-0">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted p-1 h-9">
                  <TabsTrigger value="haiku" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs">
                    Claude Haiku
                  </TabsTrigger>
                  <TabsTrigger value="openai" className="data-[state=active]:bg-white data-[state=active]:shadow-sm relative text-xs">
                    OpenAI Mini
                    {!openAIScript && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-1 h-5 px-1.5 text-xs absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateOpenAIScript();
                        }}
                        disabled={isGeneratingOpenAIScript}
                      >
                        {isGeneratingOpenAIScript ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Generate'
                        )}
                      </Button>
                    )}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="haiku" className="space-y-3 flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(transcriptionResult.script, 'script')}
                      className="hover:bg-purple-50 h-8 px-2"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(transcriptionResult.script, 'commentary-script-haiku.txt')}
                      className="hover:bg-purple-50 h-8 px-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    value={transcriptionResult.script}
                    readOnly
                    className="flex-1 min-h-[300px] max-h-[500px] font-mono text-xs bg-muted/50 border-muted leading-relaxed resize-none"
                  />
                </TabsContent>
                <TabsContent value="openai" className="space-y-3 flex flex-col flex-1 min-h-0">
                  {openAIScript ? (
                    <>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(openAIScript, 'script')}
                          className="hover:bg-purple-50 h-8 px-2"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(openAIScript, 'commentary-script-openai.txt')}
                          className="hover:bg-purple-50 h-8 px-2"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Textarea
                        value={openAIScript}
                        readOnly
                        className="flex-1 min-h-[300px] max-h-[500px] font-mono text-xs bg-muted/50 border-muted leading-relaxed resize-none"
                      />
                    </>
                  ) : isGeneratingOpenAIScript ? (
                    <div className="flex-1 min-h-[300px] flex items-center justify-center border-2 border-purple-200 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50">
                      <div className="text-center max-w-md px-4 space-y-4">
                        <div className="relative">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="h-16 w-16 mx-auto rounded-full border-4 border-purple-200 border-t-purple-600"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles className="h-6 w-6 text-purple-600" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-foreground">Generating Script...</p>
                          <p className="text-xs text-muted-foreground">
                            Creating commentary script with OpenAI Mini
                          </p>
                        </div>
                        <div className="flex gap-2 justify-center">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="h-2 w-2 rounded-full bg-purple-600"
                              animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.5, 1, 0.5],
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                delay: i * 0.2,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-[300px] flex items-center justify-center border-2 border-dashed border-muted rounded-xl bg-muted/30">
                      <div className="text-center max-w-md px-4">
                        <div className="mb-3 flex justify-center">
                          <div className="p-3 bg-purple-100 rounded-full">
                            <Sparkles className="h-6 w-6 text-purple-600" />
                          </div>
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">Generate OpenAI Script</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Create alternative script with OpenAI Mini
                        </p>
                        <Button
                          onClick={handleGenerateOpenAIScript}
                          disabled={isGeneratingOpenAIScript}
                          size="sm"
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/25"
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                          Generate
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        )}

      </div>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}

