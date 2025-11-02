import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import {
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  ExternalLink,
  Zap,
  Activity,
  Globe,
  Gauge,
  Eye,
  Settings,
  Download,
  Share2,
  Code,
  Bug
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
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
}

const DEVICE_PRESETS: DevicePreset[] = [
  {
    name: 'Desktop',
    width: 1440,
    height: 900,
    icon: <Monitor className="h-4 w-4" />,
  },
  {
    name: 'Laptop',
    width: 1024,
    height: 768,
    icon: <Monitor className="h-4 w-4" />,
  },
  {
    name: 'Tablet',
    width: 768,
    height: 1024,
    icon: <Tablet className="h-4 w-4" />,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
  },
  {
    name: 'Mobile',
    width: 375,
    height: 667,
    icon: <Smartphone className="h-4 w-4" />,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
  },
  {
    name: 'Mobile L',
    width: 414,
    height: 896,
    icon: <Smartphone className="h-4 w-4" />,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
  },
];

export function AdvancedPreview({ previewUrl, files, projectName, onRefresh }: AdvancedPreviewProps) {
  // Auto-detect screen size for better default device
  const getDefaultDevice = () => {
    const width = window.innerWidth;
    if (width < 1024) return DEVICE_PRESETS[2]; // Tablet on small screens
    if (width < 1440) return DEVICE_PRESETS[1]; // Laptop
    return DEVICE_PRESETS[0]; // Desktop on large screens
  };

  const [selectedDevice, setSelectedDevice] = useState<DevicePreset>(getDefaultDevice());
  const [customWidth, setCustomWidth] = useState<number>(1440);
  const [customHeight, setCustomHeight] = useState<number>(900);
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  // Auto-scale zoom on smaller screens
  const [zoom, setZoom] = useState(window.innerWidth < 1440 ? 75 : 100);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<Array<{ type: 'log' | 'error' | 'warn'; message: string; timestamp: Date }>>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Debug: Log when preview URL changes
  useEffect(() => {
    console.log('🔍 AdvancedPreview URL updated:', previewUrl);

    // Only set loading state if document is visible and not hidden
    // This prevents race conditions when iframe loads while tab is hidden
    if (previewUrl && !document.hidden) {
      setIsLoading(true);
    } else if (previewUrl && document.hidden) {
      console.log('⚠️ Preview URL set while tab is hidden - deferring load');

      // Wait for tab to become visible before loading
      const visibilityHandler = () => {
        if (!document.hidden) {
          console.log('✅ Tab is now visible - loading preview');
          setIsLoading(true);
          document.removeEventListener('visibilitychange', visibilityHandler);
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);

      // Cleanup on unmount
      return () => {
        document.removeEventListener('visibilitychange', visibilityHandler);
      };
    }
  }, [previewUrl]);

  const currentWidth = isCustomSize ? customWidth : selectedDevice.width;
  const currentHeight = isCustomSize ? customHeight : selectedDevice.height;

  // Simulate performance metrics (in a real app, these would come from the iframe)
  useEffect(() => {
    const simulateMetrics = () => {
      const metrics: PerformanceMetrics = {
        loadTime: Math.random() * 2000 + 500,
        bundleSize: Math.random() * 500 + 100,
        renderTime: Math.random() * 100 + 20,
        memoryUsage: Math.random() * 50 + 10,
        lcp: Math.random() * 3000 + 1000,
        fid: Math.random() * 100 + 10,
        cls: Math.random() * 0.2,
      };
      setPerformanceMetrics(metrics);
    };

    simulateMetrics();
    const interval = setInterval(simulateMetrics, 5000);
    return () => clearInterval(interval);
  }, [previewUrl]);

  const handleRefresh = () => {
    setIsLoading(true);
    onRefresh?.();

    // Simulate loading time
    setTimeout(() => {
      setIsLoading(false);
      if (iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src;
      }
    }, 1000);
  };

  const openInNewTab = () => {
    window.open(previewUrl, '_blank');
  };

  const takeScreenshot = () => {
    // In a real implementation, this would capture the iframe content
    alert('Screenshot functionality would be implemented here');
  };

  const getMetricColor = (value: number, thresholds: { good: number; poor: number }, reverse = false) => {
    if (reverse) {
      if (value <= thresholds.good) return 'text-green-600';
      if (value <= thresholds.poor) return 'text-yellow-600';
      return 'text-red-600';
    } else {
      if (value >= thresholds.good) return 'text-green-600';
      if (value >= thresholds.poor) return 'text-yellow-600';
      return 'text-red-600';
    }
  };

  const formatBytes = (bytes: number) => {
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const formatTime = (ms: number) => {
    return `${ms.toFixed(0)}ms`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Controls Header - Compact on smaller screens */}
      <div className="flex items-center justify-between p-2 lg:p-4 border-b gap-2">
        <div className="flex items-center gap-4">
          {/* Device Presets - Compact on small screens */}
          <div className="flex items-center gap-1 lg:gap-2">
            {DEVICE_PRESETS.map((device) => (
              <Button
                key={device.name}
                size="sm"
                variant={selectedDevice.name === device.name && !isCustomSize ? "default" : "outline"}
                onClick={() => {
                  setSelectedDevice(device);
                  setIsCustomSize(false);
                }}
                className="flex items-center gap-1 px-2 lg:px-3"
              >
                {device.icon}
                <span className="hidden md:inline text-xs lg:text-sm">{device.name}</span>
              </Button>
            ))}

            <Button
              size="sm"
              variant={isCustomSize ? "default" : "outline"}
              onClick={() => setIsCustomSize(true)}
              className="flex items-center gap-1"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Custom</span>
            </Button>
          </div>

          {/* Custom Size Controls */}
          {isCustomSize && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1440)}
                className="w-16 px-2 py-1 border rounded text-center"
                min="320"
                max="3840"
              />
              <span>×</span>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(parseInt(e.target.value) || 900)}
                className="w-16 px-2 py-1 border rounded text-center"
                min="200"
                max="2160"
              />
            </div>
          )}

          {/* Zoom Control - Hide label on small screens */}
          <div className="flex items-center gap-2">
            <Label htmlFor="zoom" className="text-sm hidden lg:inline">Zoom:</Label>
            <select
              id="zoom"
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value))}
              className="px-2 py-1 border rounded text-xs lg:text-sm"
            >
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={100}>100%</option>
              <option value={125}>125%</option>
              <option value={150}>150%</option>
            </select>
          </div>
        </div>

        {/* Action Buttons - Compact on small screens */}
        <div className="flex items-center gap-1 lg:gap-2">
          {/* Grid/Rulers - Hide on very small screens */}
          <div className="hidden lg:flex items-center gap-2 mr-2">
            <Switch
              id="grid"
              checked={showGrid}
              onCheckedChange={setShowGrid}
            />
            <Label htmlFor="grid" className="text-xs lg:text-sm">Grid</Label>

            <Switch
              id="rulers"
              checked={showRulers}
              onCheckedChange={setShowRulers}
            />
            <Label htmlFor="rulers" className="text-xs lg:text-sm">Rulers</Label>
          </div>

          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-3 w-3 lg:h-4 lg:w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <Button size="sm" variant="outline" onClick={openInNewTab} className="hidden sm:flex">
            <ExternalLink className="h-3 w-3 lg:h-4 lg:w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Main Preview */}
        <div className="flex-1 flex flex-col items-center justify-center p-2 lg:p-4 xl:p-8 bg-gray-50">
          {/* Device Frame */}
          <div
            className="relative bg-white rounded-lg shadow-xl overflow-hidden"
            style={{
              width: currentWidth * (zoom / 100),
              height: currentHeight * (zoom / 100),
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            {/* Rulers */}
            {showRulers && (
              <>
                {/* Top Ruler */}
                <div className="absolute -top-6 left-0 right-0 h-6 bg-gray-200 border-b text-xs">
                  {Array.from({ length: Math.ceil(currentWidth / 100) }, (_, i) => (
                    <div
                      key={i}
                      className="absolute border-l border-gray-400 h-full flex items-end pb-1 pl-1"
                      style={{ left: `${(i * 100 * zoom) / 100}px` }}
                    >
                      {i * 100}
                    </div>
                  ))}
                </div>

                {/* Left Ruler */}
                <div className="absolute -left-6 top-0 bottom-0 w-6 bg-gray-200 border-r text-xs">
                  {Array.from({ length: Math.ceil(currentHeight / 100) }, (_, i) => (
                    <div
                      key={i}
                      className="absolute border-t border-gray-400 w-full flex items-start pt-1 pl-1"
                      style={{ top: `${(i * 100 * zoom) / 100}px` }}
                    >
                      <span className="transform -rotate-90 origin-left">{i * 100}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Grid Overlay */}
            {showGrid && (
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #000 1px, transparent 1px),
                    linear-gradient(to bottom, #000 1px, transparent 1px)
                  `,
                  backgroundSize: `${20 * (zoom / 100)}px ${20 * (zoom / 100)}px`,
                }}
              />
            )}

            {/* Preview iframe */}
            {previewUrl ? (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-full border-0"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top left',
                  width: `${(100 / zoom) * 100}%`,
                  height: `${(100 / zoom) * 100}%`,
                }}
                title={`Preview of ${projectName}`}
                onLoad={() => setIsLoading(false)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center p-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                  <p className="text-lg font-semibold mb-2">Preparing Preview...</p>
                  <p className="text-sm text-muted-foreground">
                    Starting development server in WebContainer
                  </p>
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Refreshing preview...</p>
                </div>
              </div>
            )}
          </div>

          {/* Device Info */}
          <div className="mt-4 text-center text-sm text-gray-600">
            <Badge variant="outline" className="mb-2">
              {currentWidth} × {currentHeight} ({zoom}%)
            </Badge>
            <p>{selectedDevice.name} • {isCustomSize ? 'Custom' : 'Preset'}</p>
          </div>
        </div>

        {/* Side Panel - Collapsible on small screens */}
        <div className="w-full lg:w-64 xl:w-80 border-t lg:border-l lg:border-t-0 bg-white max-h-64 lg:max-h-none">
          <Tabs defaultValue="performance" className="h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="console">Console</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Gauge className="h-4 w-4" />
                  Core Web Vitals
                </h3>

                {performanceMetrics && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">LCP</span>
                      <span className={`text-sm font-mono ${getMetricColor(performanceMetrics.lcp, { good: 2500, poor: 4000 }, true)}`}>
                        {formatTime(performanceMetrics.lcp)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm">FID</span>
                      <span className={`text-sm font-mono ${getMetricColor(performanceMetrics.fid, { good: 100, poor: 300 }, true)}`}>
                        {formatTime(performanceMetrics.fid)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm">CLS</span>
                      <span className={`text-sm font-mono ${getMetricColor(performanceMetrics.cls, { good: 0.1, poor: 0.25 }, true)}`}>
                        {performanceMetrics.cls.toFixed(3)}
                      </span>
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                      <span className="text-sm">Load Time</span>
                      <span className="text-sm font-mono">{formatTime(performanceMetrics.loadTime)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm">Bundle Size</span>
                      <span className="text-sm font-mono">{formatBytes(performanceMetrics.bundleSize)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm">Memory Usage</span>
                      <span className="text-sm font-mono">{performanceMetrics.memoryUsage.toFixed(1)} MB</span>
                    </div>
                  </div>
                )}
              </div>

              <Button size="sm" className="w-full" variant="outline">
                <Activity className="h-4 w-4 mr-2" />
                Run Lighthouse Audit
              </Button>
            </TabsContent>

            <TabsContent value="console" className="p-4">
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Console Output
                </h3>

                <div className="bg-black text-green-400 p-3 rounded text-xs font-mono h-64 overflow-y-auto">
                  {consoleMessages.length === 0 ? (
                    <div className="text-gray-500">No console messages</div>
                  ) : (
                    consoleMessages.map((msg, index) => (
                      <div key={index} className={`mb-1 ${
                        msg.type === 'error' ? 'text-red-400' :
                        msg.type === 'warn' ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        [{msg.timestamp.toLocaleTimeString()}] {msg.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="info" className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Project Info
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Project:</span>
                    <span className="font-mono">{projectName}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Files:</span>
                    <span className="font-mono">{files.length}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Total Size:</span>
                    <span className="font-mono">
                      {formatBytes(files.reduce((acc, f) => acc + f.content.length, 0))}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Last Updated:</span>
                    <span className="font-mono">{new Date().toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">Quick Actions</h3>
                <div className="space-y-2">
                  <Button size="sm" variant="outline" className="w-full justify-start">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Preview
                  </Button>
                  <Button size="sm" variant="outline" className="w-full justify-start">
                    <Code className="h-4 w-4 mr-2" />
                    View Source
                  </Button>
                  <Button size="sm" variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Export Project
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}