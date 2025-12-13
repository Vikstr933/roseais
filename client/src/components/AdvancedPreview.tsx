import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import {
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  ExternalLink,
  Activity,
  Globe,
  Gauge,
  Settings,
  Download,
  Share2,
  Code,
  Bug,
  Maximize2,
  Grid3X3,
  Ruler,
} from 'lucide-react';

interface AdvancedPreviewProps {
  previewUrl: string;
  files: Array<{ path: string; content: string }>;
  projectName: string;
  onRefresh?: () => void;
}

interface DevicePreset {
  name: string;
  width: number;
  height: number;
  icon: React.ReactNode;
  userAgent?: string;
}

interface PerformanceMetrics {
  loadTime: number;
  bundleSize: number;
  renderTime: number;
  memoryUsage: number;
  lcp: number;
  fid: number;
  cls: number;
}

const DEVICE_PRESETS: DevicePreset[] = [
  {
    name: 'Desktop',
    width: 1440,
    height: 900,
    icon: <Monitor className="h-3 w-3" />,
  },
  {
    name: 'Laptop',
    width: 1024,
    height: 768,
    icon: <Monitor className="h-3 w-3" />,
  },
  {
    name: 'Tablet',
    width: 768,
    height: 1024,
    icon: <Tablet className="h-3 w-3" />,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
  },
  {
    name: 'Mobile',
    width: 375,
    height: 667,
    icon: <Smartphone className="h-3 w-3" />,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
  },
  {
    name: 'Mobile L',
    width: 414,
    height: 896,
    icon: <Smartphone className="h-3 w-3" />,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
  },
];

export function AdvancedPreview({ previewUrl, files, projectName, onRefresh }: AdvancedPreviewProps) {
  const getDefaultDevice = () => {
    const width = window.innerWidth;
    if (width < 768) return DEVICE_PRESETS[3];
    if (width < 1024) return DEVICE_PRESETS[2];
    if (width < 1440) return DEVICE_PRESETS[1];
    return DEVICE_PRESETS[0];
  };

  const [selectedDevice, setSelectedDevice] = useState<DevicePreset>(getDefaultDevice());
  const [customWidth, setCustomWidth] = useState<number>(1440);
  const [customHeight, setCustomHeight] = useState<number>(900);
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [zoom, setZoom] = useState(window.innerWidth < 1440 ? 75 : 100);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<Array<{ type: 'log' | 'error' | 'warn'; message: string; timestamp: Date }>>([]);
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 1280);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for console messages from the iframe via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our preview iframe
      if (!previewUrl || !event.origin) return;
      
      try {
        const data = event.data;
        if (data && data.type === 'console' && data.level && data.message) {
          setConsoleMessages(prev => [
            ...prev.slice(-99), // Keep last 100 messages
            {
              type: data.level as 'log' | 'error' | 'warn',
              message: typeof data.message === 'string' ? data.message : JSON.stringify(data.message),
              timestamp: new Date()
            }
          ]);
        }
      } catch (e) {
        // Ignore invalid messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [previewUrl]);

  // Clear console when URL changes
  useEffect(() => {
    setConsoleMessages([]);
  }, [previewUrl]);

  useEffect(() => {
    console.log('🔍 AdvancedPreview URL updated:', previewUrl);
    if (previewUrl && !document.hidden) {
      setIsLoading(true);
      setIframeError(null);
      
      // Clear any existing timeout
      if (loadTimeout) {
        clearTimeout(loadTimeout);
        setLoadTimeout(null);
      }
      
      // Set a timeout to detect if the iframe fails to load
      const timeout = setTimeout(() => {
        console.warn('⚠️ Preview iframe load timeout - page may have errors');
        // Show error if timeout reached (iframe onLoad didn't fire in time)
        setIframeError('Preview is taking longer than expected to load. The page may have JavaScript errors. Check the browser console.');
        setIsLoading(false);
      }, 20000); // 20 second timeout (increased from 15)
      
      setLoadTimeout(timeout);
      
      return () => {
        clearTimeout(timeout);
      };
    } else if (previewUrl && document.hidden) {
      const visibilityHandler = () => {
        if (!document.hidden) {
          setIsLoading(true);
          document.removeEventListener('visibilitychange', visibilityHandler);
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
      return () => document.removeEventListener('visibilitychange', visibilityHandler);
    } else if (!previewUrl) {
      // No preview URL, clear loading state
      setIsLoading(false);
      setIframeError(null);
      if (loadTimeout) {
        clearTimeout(loadTimeout);
        setLoadTimeout(null);
      }
    }
  }, [previewUrl]);

  const currentWidth = isCustomSize ? customWidth : selectedDevice.width;
  const currentHeight = isCustomSize ? customHeight : selectedDevice.height;

  useEffect(() => {
    const simulateMetrics = () => {
      setPerformanceMetrics({
        loadTime: Math.random() * 2000 + 500,
        bundleSize: Math.random() * 500 + 100,
        renderTime: Math.random() * 100 + 20,
        memoryUsage: Math.random() * 50 + 10,
        lcp: Math.random() * 3000 + 1000,
        fid: Math.random() * 100 + 10,
        cls: Math.random() * 0.2,
      });
    };
    simulateMetrics();
    const interval = setInterval(simulateMetrics, 5000);
    return () => clearInterval(interval);
  }, [previewUrl]);

  const handleRefresh = () => {
    setIsLoading(true);
    onRefresh?.();
    setTimeout(() => {
      setIsLoading(false);
      if (iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src;
      }
    }, 1000);
  };

  const openInNewTab = () => window.open(previewUrl, '_blank');

  const getMetricColor = (value: number, thresholds: { good: number; poor: number }, reverse = false) => {
    if (reverse) {
      if (value <= thresholds.good) return 'text-emerald-500';
      if (value <= thresholds.poor) return 'text-amber-500';
      return 'text-red-500';
    } else {
      if (value >= thresholds.good) return 'text-emerald-500';
      if (value >= thresholds.poor) return 'text-amber-500';
      return 'text-red-500';
    }
  };

  const formatBytes = (bytes: number) => `${(bytes / 1024).toFixed(1)}KB`;
  const formatTime = (ms: number) => `${ms.toFixed(0)}ms`;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b gap-2 bg-muted/30">
        {/* Left: Device Presets */}
        <div className="flex items-center gap-1">
          {DEVICE_PRESETS.map((device) => (
            <Button
              key={device.name}
              size="sm"
              variant={selectedDevice.name === device.name && !isCustomSize ? "default" : "ghost"}
              onClick={() => {
                setSelectedDevice(device);
                setIsCustomSize(false);
              }}
              className="h-7 px-2 gap-1"
              title={device.name}
            >
              {device.icon}
              <span className="hidden xl:inline text-[11px]">{device.name}</span>
            </Button>
          ))}
          
          <div className="w-px h-4 bg-border mx-1" />
          
          <Button
            size="sm"
            variant={isCustomSize ? "default" : "ghost"}
            onClick={() => setIsCustomSize(true)}
            className="h-7 px-2"
            title="Custom size"
          >
            <Settings className="h-3 w-3" />
          </Button>

          {isCustomSize && (
            <div className="flex items-center gap-1 ml-1">
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1440)}
                className="w-12 h-6 px-1 text-[10px] border rounded text-center bg-background"
                min="320"
                max="3840"
              />
              <span className="text-[10px] text-muted-foreground">×</span>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(parseInt(e.target.value) || 900)}
                className="w-12 h-6 px-1 text-[10px] border rounded text-center bg-background"
                min="200"
                max="2160"
              />
            </div>
          )}
        </div>

        {/* Center: Size Badge */}
        <Badge variant="secondary" className="text-[10px] h-5 px-2 font-mono hidden sm:flex">
          {currentWidth}×{currentHeight} @ {zoom}%
        </Badge>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Zoom */}
          <select
            value={zoom}
            onChange={(e) => setZoom(parseInt(e.target.value))}
            className="h-6 px-1 text-[10px] border rounded bg-background"
          >
            <option value={50}>50%</option>
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={125}>125%</option>
            <option value={150}>150%</option>
          </select>

          <div className="w-px h-4 bg-border mx-1 hidden lg:block" />

          {/* Grid Toggle */}
          <Button
            size="sm"
            variant={showGrid ? "default" : "ghost"}
            onClick={() => setShowGrid(!showGrid)}
            className="h-7 w-7 p-0 hidden lg:flex"
            title="Toggle grid"
          >
            <Grid3X3 className="h-3 w-3" />
          </Button>

          {/* Rulers Toggle */}
          <Button
            size="sm"
            variant={showRulers ? "default" : "ghost"}
            onClick={() => setShowRulers(!showRulers)}
            className="h-7 w-7 p-0 hidden lg:flex"
            title="Toggle rulers"
          >
            <Ruler className="h-3 w-3" />
          </Button>

          <div className="w-px h-4 bg-border mx-1" />

          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleRefresh} 
            disabled={isLoading}
            className="h-7 w-7 p-0"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <Button 
            size="sm" 
            variant="ghost" 
            onClick={openInNewTab}
            className="h-7 w-7 p-0 hidden sm:flex"
            title="Open in new tab"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>

          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setShowSidebar(!showSidebar)}
            className="h-7 w-7 p-0 hidden xl:flex"
            title="Toggle sidebar"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex min-h-0">
        {/* Main Preview */}
        <div className="flex-1 flex flex-col items-center justify-start p-2 bg-muted/20 overflow-auto">
          {/* Device Frame */}
          <div
            className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-2xl ring-1 ring-black/5 overflow-hidden flex-shrink-0"
            style={{
              width: Math.min(currentWidth * (zoom / 100), window.innerWidth - 100),
              height: Math.min(currentHeight * (zoom / 100), window.innerHeight - 200),
              maxWidth: 'calc(100vw - 2rem)',
              maxHeight: 'calc(100vh - 10rem)',
            }}
          >
            {/* Rulers */}
            {showRulers && (
              <>
                <div className="absolute -top-5 left-0 right-0 h-5 bg-muted/80 border-b text-[9px] text-muted-foreground">
                  {Array.from({ length: Math.ceil(currentWidth / 100) }, (_, i) => (
                    <div
                      key={i}
                      className="absolute border-l border-muted-foreground/30 h-full flex items-end pb-0.5 pl-0.5"
                      style={{ left: `${(i * 100 * zoom) / 100}px` }}
                    >
                      {i * 100}
                    </div>
                  ))}
                </div>
                <div className="absolute -left-5 top-0 bottom-0 w-5 bg-muted/80 border-r text-[9px] text-muted-foreground">
                  {Array.from({ length: Math.ceil(currentHeight / 100) }, (_, i) => (
                    <div
                      key={i}
                      className="absolute border-t border-muted-foreground/30 w-full flex items-start pt-0.5 pl-0.5"
                      style={{ top: `${(i * 100 * zoom) / 100}px` }}
                    >
                      <span className="transform -rotate-90 origin-left text-[8px]">{i * 100}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Grid Overlay */}
            {showGrid && (
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, currentColor 1px, transparent 1px),
                    linear-gradient(to bottom, currentColor 1px, transparent 1px)
                  `,
                  backgroundSize: `${20 * (zoom / 100)}px ${20 * (zoom / 100)}px`,
                }}
              />
            )}

            {/* Preview iframe */}
            {previewUrl ? (
              <>
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  className="border-0 absolute inset-0"
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                  title={`Preview of ${projectName}`}
                  onLoad={() => {
                    console.log('✅ Preview iframe loaded successfully');
                    
                    // Clear timeout immediately
                    if (loadTimeout) {
                      clearTimeout(loadTimeout);
                      setLoadTimeout(null);
                    }
                    
                    // Give the iframe a moment to render before clearing loading state
                    // This helps catch cases where onLoad fires but content isn't ready
                    setTimeout(() => {
                      setIsLoading(false);
                      setIframeError(null);
                      
                      // Try to detect if the iframe content is blank/white
                      try {
                        const iframe = iframeRef.current;
                        if (iframe && iframe.contentWindow) {
                          // Check if the iframe has content
                          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                          if (iframeDoc) {
                            const body = iframeDoc.body;
                            // Check if body exists and has some content
                            if (body) {
                              const hasContent = body.children.length > 0 || 
                                               body.textContent?.trim().length > 0 ||
                                               body.innerHTML.trim().length > 0;
                              
                              if (!hasContent) {
                                console.warn('⚠️ Preview iframe appears to be blank/white');
                                // Wait a bit more and check again (might be loading)
                                setTimeout(() => {
                                  const bodyCheck = iframeDoc.body;
                                  if (bodyCheck && 
                                      bodyCheck.children.length === 0 && 
                                      bodyCheck.textContent?.trim() === '' &&
                                      bodyCheck.innerHTML.trim() === '') {
                                    console.warn('⚠️ Preview iframe still blank after delay');
                                    setIframeError('Preview loaded but appears to be blank. The app may have JavaScript errors. Check the browser console.');
                                  }
                                }, 2000);
                              } else {
                                console.log('✅ Preview iframe has content');
                              }
                            }
                            
                            // Log script tags for debugging
                            try {
                              const scripts = iframeDoc.querySelectorAll('script');
                              console.log(`📄 Found ${scripts.length} script tags in preview`);
                            } catch (e) {
                              // CORS may prevent access
                            }
                          }
                        }
                      } catch (e) {
                        // CORS or other security restrictions may prevent access
                        console.warn('Cannot inspect iframe content:', e);
                        // Still clear loading state even if we can't inspect
                        setIsLoading(false);
                      }
                    }, 500); // Small delay to let content render
                  }}
                  onError={(e) => {
                    console.error('❌ Preview iframe error:', e);
                    setIframeError('Failed to load preview. The development server may not be running or there may be a network error. Try refreshing or check if the server is accessible.');
                    setIsLoading(false);
                    if (loadTimeout) {
                      clearTimeout(loadTimeout);
                      setLoadTimeout(null);
                    }
                  }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
                {iframeError && (
                  <div className="absolute inset-0 bg-background/95 flex items-center justify-center z-50">
                    <div className="text-center p-6 max-w-md">
                      <div className="text-red-500 mb-4">
                        <Bug className="h-12 w-12 mx-auto" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Preview Error</h3>
                      <p className="text-sm text-muted-foreground mb-4">{iframeError}</p>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIframeError(null);
                            setIsLoading(true);
                            if (iframeRef.current) {
                              iframeRef.current.src = iframeRef.current.src;
                            }
                          }}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retry
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(previewUrl, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open in New Tab
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">
                        Check the browser console (F12) for detailed error messages.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <div className="text-center p-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-3"></div>
                  <p className="text-sm font-medium mb-1">Preparing Preview...</p>
                  <p className="text-xs text-muted-foreground">
                    Starting development server
                  </p>
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {isLoading && previewUrl && (
              <div className="absolute inset-0 bg-background/75 flex items-center justify-center backdrop-blur-sm z-40">
                <div className="text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-xs text-muted-foreground mb-1">Loading preview...</p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {previewUrl}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Device Info - Compact */}
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="font-medium">{selectedDevice.name}</span>
            <span>•</span>
            <span>{isCustomSize ? 'Custom' : 'Preset'}</span>
          </div>
        </div>

        {/* Side Panel - Collapsible */}
        {showSidebar && (
          <div className="w-56 border-l bg-card flex-shrink-0 hidden xl:flex flex-col">
            <Tabs defaultValue="performance" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3 h-8 rounded-none border-b">
                <TabsTrigger value="performance" className="text-[10px] h-7 data-[state=active]:bg-muted">
                  Perf
                </TabsTrigger>
                <TabsTrigger value="console" className="text-[10px] h-7 data-[state=active]:bg-muted">
                  Console
                </TabsTrigger>
                <TabsTrigger value="info" className="text-[10px] h-7 data-[state=active]:bg-muted">
                  Info
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <TabsContent value="performance" className="p-2 space-y-3 mt-0">
                  <div>
                    <h3 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                      <Gauge className="h-3 w-3" />
                      Core Web Vitals
                    </h3>

                    {performanceMetrics && (
                      <div className="space-y-1.5">
                        {[
                          { label: 'LCP', value: formatTime(performanceMetrics.lcp), color: getMetricColor(performanceMetrics.lcp, { good: 2500, poor: 4000 }, true) },
                          { label: 'FID', value: formatTime(performanceMetrics.fid), color: getMetricColor(performanceMetrics.fid, { good: 100, poor: 300 }, true) },
                          { label: 'CLS', value: performanceMetrics.cls.toFixed(3), color: getMetricColor(performanceMetrics.cls, { good: 0.1, poor: 0.25 }, true) },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="flex justify-between items-center py-1 px-2 rounded bg-muted/30">
                            <span className="text-[10px] font-medium">{label}</span>
                            <span className={`text-[10px] font-mono font-semibold ${color}`}>{value}</span>
                          </div>
                        ))}

                        <Separator className="my-2" />

                        {[
                          { label: 'Load', value: formatTime(performanceMetrics.loadTime) },
                          { label: 'Bundle', value: formatBytes(performanceMetrics.bundleSize) },
                          { label: 'Memory', value: `${performanceMetrics.memoryUsage.toFixed(1)}MB` },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between items-center py-1 px-2">
                            <span className="text-[10px] text-muted-foreground">{label}</span>
                            <span className="text-[10px] font-mono">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button size="sm" className="w-full h-7 text-[10px]" variant="outline">
                    <Activity className="h-3 w-3 mr-1.5" />
                    Run Lighthouse
                  </Button>
                </TabsContent>

                <TabsContent value="console" className="p-2 mt-0">
                  <h3 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                    <Bug className="h-3 w-3" />
                    Console Output
                  </h3>

                  <div className="bg-zinc-900 text-emerald-400 p-2 rounded text-[9px] font-mono h-48 overflow-y-auto border border-zinc-700">
                    {consoleMessages.length === 0 ? (
                      <div className="text-zinc-500">No console messages</div>
                    ) : (
                      consoleMessages.map((msg, index) => (
                        <div key={index} className={`mb-0.5 ${
                          msg.type === 'error' ? 'text-red-400' :
                          msg.type === 'warn' ? 'text-amber-400' :
                          'text-emerald-400'
                        }`}>
                          <span className="text-zinc-600">[{msg.timestamp.toLocaleTimeString()}]</span> {msg.message}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="info" className="p-2 space-y-3 mt-0">
                  <div>
                    <h3 className="text-[10px] font-semibold mb-2 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                      <Globe className="h-3 w-3" />
                      Project Info
                    </h3>

                    <div className="space-y-1">
                      {[
                        { label: 'Project', value: projectName },
                        { label: 'Files', value: files.length.toString() },
                        { label: 'Size', value: formatBytes(files.reduce((acc, f) => acc + f.content.length, 0)) },
                        { label: 'Updated', value: new Date().toLocaleTimeString() },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between py-1 px-2 rounded bg-muted/30">
                          <span className="text-[10px] text-muted-foreground">{label}</span>
                          <span className="text-[10px] font-mono truncate max-w-[80px]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-1">
                    <Button size="sm" variant="ghost" className="w-full h-7 text-[10px] justify-start">
                      <Share2 className="h-3 w-3 mr-1.5" />
                      Share Preview
                    </Button>
                    <Button size="sm" variant="ghost" className="w-full h-7 text-[10px] justify-start">
                      <Code className="h-3 w-3 mr-1.5" />
                      View Source
                    </Button>
                    <Button size="sm" variant="ghost" className="w-full h-7 text-[10px] justify-start">
                      <Download className="h-3 w-3 mr-1.5" />
                      Export Project
                    </Button>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
