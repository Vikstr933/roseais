import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, X, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';
const DISMISSED_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('[PWA] App already installed (standalone mode)');
      setIsInstalled(true);
      return;
    }

    // Check if user has dismissed the prompt recently
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const now = Date.now();
      if (now - dismissedTime < DISMISSED_TTL) {
        console.log('[PWA] Prompt dismissed recently, not showing');
        return; // Don't show if dismissed within last 7 days
      }
    }

    // Detect iOS Safari - more robust detection
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    // Check for iOS - iPhone 16 might have different user agent patterns
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    // Also check platform for iOS (works on newer iOS versions)
    const isIOSPlatform = /iPhone|iPad|iPod/.test(navigator.platform) || 
                          ((navigator as any).maxTouchPoints && (navigator as any).maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
    const isIOSDevice = isIOS || isIOSPlatform;
    // Also check for iOS in other ways
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isIOSDisplayMode = window.matchMedia('(display-mode: standalone)').matches && isIOSDevice;
    const isStandalone = isIOSStandalone || isIOSDisplayMode;
    
    console.log('[PWA] Device detection:', { 
      isIOS, 
      isIOSPlatform,
      isIOSDevice,
      isStandalone, 
      isIOSStandalone,
      isIOSDisplayMode,
      platform: navigator.platform,
      maxTouchPoints: (navigator as any).maxTouchPoints,
      userAgent: userAgent.substring(0, 100) // Truncate for logging
    });
    
    let fallbackTimeout: NodeJS.Timeout | null = null;
    let iosTimeout: NodeJS.Timeout | null = null;
    
    if (isIOSDevice && !isStandalone) {
      // iOS Safari doesn't support beforeinstallprompt
      // Show manual install instructions after a delay
      console.log('[PWA] iOS detected, will show prompt in 2 seconds');
      iosTimeout = setTimeout(() => {
        console.log('[PWA] Showing iOS install prompt');
        setShowPrompt(true);
        // Store a special flag for iOS
        (window as any).isIOSInstallPrompt = true;
      }, 2000); // Show after 2 seconds
      
      // Still set up cleanup for iOS timeout
      return () => {
        if (iosTimeout) clearTimeout(iosTimeout);
      };
    }
    
    // For Android/Desktop, also show prompt after delay if beforeinstallprompt doesn't fire
    // This handles cases where the event doesn't trigger immediately
    const isAndroid = /Android/.test(userAgent);
    if (isAndroid) {
      console.log('[PWA] Android detected, will show prompt in 5 seconds if beforeinstallprompt does not fire');
      fallbackTimeout = setTimeout(() => {
        console.log('[PWA] Fallback timeout fired, checking if should show Android prompt');
        // Use functional update to check current state
        setShowPrompt(prev => {
          // Check current installed state
          const currentlyInstalled = window.matchMedia('(display-mode: standalone)').matches;
          console.log('[PWA] Fallback timeout - state check:', { prev, currentlyInstalled });
          // Only show if not already shown and not installed
          if (!prev && !currentlyInstalled) {
            console.log('[PWA] Showing Android install prompt');
            (window as any).isAndroidInstallPrompt = true;
            return true;
          }
          console.log('[PWA] Not showing Android prompt:', { prev, currentlyInstalled });
          return prev;
        });
      }, 5000); // Show after 5 seconds if no beforeinstallprompt event
    }

    // Listen for beforeinstallprompt event (Android Chrome, Desktop Chrome/Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWA] beforeinstallprompt event fired');
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setShowPrompt(true);
      // Clear fallback timeout if event fires
      if (fallbackTimeout) {
        console.log('[PWA] Clearing fallback timeout because beforeinstallprompt fired');
        clearTimeout(fallbackTimeout);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
      if (iosTimeout) {
        clearTimeout(iosTimeout);
      }
    };
  }, []);

  const handleInstall = async () => {
    // iOS Safari - show manual instructions
    if ((window as any).isIOSInstallPrompt) {
      handleDismiss();
      // Show iOS instructions
      alert('För att installera Elon på iOS:\n\n1. Tryck på delningsknappen (fyrkant med pil)\n2. Välj "Lägg till på hemskärm"\n3. Tryck "Lägg till"');
      return;
    }

    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt');
      setShowPrompt(false);
      setDeferredPrompt(null);
    } else {
      console.log('[PWA] User dismissed the install prompt');
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDeferredPrompt(null);
    // Remember dismissal for 7 days
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  // Don't show if already installed
  // For iOS, show even without deferredPrompt (we handle it manually)
  // For Android, show even without deferredPrompt (fallback timeout)
  // For Desktop Chrome/Edge, need deferredPrompt
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  const isIOSPlatform = /iPhone|iPad|iPod/.test(navigator.platform) || 
                        ((navigator as any).maxTouchPoints && (navigator as any).maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
  const isIOSDevice = isIOS || isIOSPlatform;
  const isAndroid = /Android/.test(userAgent);
  const shouldShow = !isInstalled && showPrompt && (isIOSDevice || isAndroid || deferredPrompt);
  
  // Debug logging - only log when actually showing prompt
  if (shouldShow && process.env.NODE_ENV === 'development') {
    console.log('[PWA] Render state:', { 
      isInstalled, 
      showPrompt, 
      isIOSDevice,
      isAndroid, 
      hasDeferredPrompt: !!deferredPrompt,
      shouldShow
    });
  }
  
  if (!shouldShow) {
    return null;
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-purple-800">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span>Install Elon AI Assistant</span>
          </DialogTitle>
          <DialogDescription className="pt-2">
            {(window as any).isIOSInstallPrompt ? (
              <>
                Installera Elon som en app på din enhet för snabbare åtkomst och bättre upplevelse.
                <br /><br />
                <strong>iOS instruktioner:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-left">
                  <li>Tryck på delningsknappen (fyrkant med pil) längst ner</li>
                  <li>Välj "Lägg till på hemskärm"</li>
                  <li>Tryck "Lägg till"</li>
                </ol>
              </>
            ) : (window as any).isAndroidInstallPrompt ? (
              <>
                Installera Elon som en app på din enhet för snabbare åtkomst och bättre upplevelse.
                <br /><br />
                <strong>Android instruktioner:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-left">
                  <li>Tryck på menyn (tre prickar) i webbläsaren</li>
                  <li>Välj "Lägg till på startskärmen" eller "Installera app"</li>
                  <li>Bekräfta installationen</li>
                </ol>
              </>
            ) : (
              'Installera Elon som en app på din enhet för snabbare åtkomst och bättre upplevelse. Du kan använda den offline och komma åt den direkt från din hemskärm.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <Button
            onClick={handleInstall}
            className="w-full brand-gradient text-white hover:opacity-90"
          >
            <Download className="mr-2 h-4 w-4" />
            Install Now
          </Button>
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="w-full"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

