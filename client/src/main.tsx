import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { frontendSentryService, ErrorBoundary } from './services/SentryService';
import App from './App';
import './index.css';

// Initialize Sentry for error tracking
frontendSentryService.initialize();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      fallback={({ error }) => (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md p-6 bg-destructive/10 border border-destructive rounded-lg">
            <h2 className="text-xl font-semibold text-destructive mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}
    >
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
