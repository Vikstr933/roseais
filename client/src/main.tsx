import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { frontendSentryService } from './services/SentryService';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import './index.css';

// Initialize Sentry for error tracking
frontendSentryService.initialize();

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Register Service Worker for PWA
// TEMPORARILY DISABLED: Service worker is causing caching conflicts with Vercel routing
// When re-enabling, uncomment this block and ensure service worker caching strategy
// doesn't interfere with static asset serving (JS/CSS/icons)
// 
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker
//       .register('/sw.js')
//       .then((registration) => {
//         console.log('[Service Worker] Registered successfully:', registration.scope);
//
//         // Check for updates periodically
//         setInterval(() => {
//           registration.update();
//         }, 60000); // Check every minute
//
//         // Handle service worker updates
//         registration.addEventListener('updatefound', () => {
//           const newWorker = registration.installing;
//           if (newWorker) {
//             newWorker.addEventListener('statechange', () => {
//               if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
//                 // New service worker available, show update notification
//                 console.log('[Service Worker] New version available');
//                 // You can dispatch a custom event here to show update prompt
//                 window.dispatchEvent(new CustomEvent('sw-update-available'));
//               }
//             });
//           }
//         });
//       })
//       .catch((error) => {
//         console.error('[Service Worker] Registration failed:', error);
//       });
//
//     // Listen for messages from service worker
//     navigator.serviceWorker.addEventListener('message', (event) => {
//       console.log('[Service Worker] Message received:', event.data);
//     });
//
//     // Handle service worker controller change (page refresh after update)
//     let refreshing = false;
//     navigator.serviceWorker.addEventListener('controllerchange', () => {
//       if (!refreshing) {
//         refreshing = true;
//         console.log('[Service Worker] New controller activated, reloading page...');
//         window.location.reload();
//       }
//     });
//   });
// }

// Unregister any existing service workers to clear old caches
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('[Service Worker] Unregistered successfully');
        }
      });
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found!');
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary
        fallback={
          <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
            <div className="text-center p-8">
              <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
              <p className="text-muted-foreground mb-4">Please refresh the page to try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                Reload Page
              </button>
            </div>
          </div>
        }
      >
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  );
} catch (error) {
  console.error('Failed to render app:', error);
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0a0a0a; color: #fff; padding: 2rem; text-align: center;">
      <div>
        <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Failed to load app</h1>
        <p style="color: #888; margin-bottom: 1rem;">${error instanceof Error ? error.message : 'Unknown error'}</p>
        <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; background: #9333ea; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">
          Reload Page
        </button>
      </div>
    </div>
  `;
}
