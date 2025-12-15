import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log detailed error info for debugging
    console.error('🚨 ErrorBoundary caught an error:');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Log current URL for context
    console.error('Current URL:', window.location.href);
    
    // Log any auth state if available
    const sessionToken = localStorage.getItem('sessionToken') || sessionStorage.getItem('sessionToken');
    console.error('Has session token:', !!sessionToken);
    
    this.setState({
      error,
      errorInfo,
    });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * Ritar ut detaljerad felinfo så att vi kan se det faktiska felet
   * även i produktion (även om console.log råkar vara avstängt).
   */
  private renderDebugDetails() {
    const { error, errorInfo } = this.state;
    if (!error && !errorInfo) return null;

    return (
      <div className="mt-4 p-3 border border-border/60 rounded bg-background/80 text-left text-xs font-mono whitespace-pre-wrap break-words max-h-64 overflow-auto">
        {error && (
          <>
            <div className="font-semibold mb-1">Error</div>
            <div className="mb-2">{error.toString()}</div>
            {error.stack && (
              <details className="mb-2">
                <summary className="cursor-pointer font-semibold">Stack trace</summary>
                <pre className="mt-1 whitespace-pre-wrap">{error.stack}</pre>
              </details>
            )}
          </>
        )}
        {errorInfo?.componentStack && (
          <details>
            <summary className="cursor-pointer font-semibold">Component stack</summary>
            <pre className="mt-1 whitespace-pre-wrap">{errorInfo.componentStack}</pre>
          </details>
        )}
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        // Om ett anpassat fallback-UI används (t.ex. i main.tsx) så
        // wrappar vi det och lägger till debug-info under, så att
        // vi kan se det riktiga felet på skärmen.
        if (React.isValidElement(this.props.fallback)) {
          return (
            <div className="flex flex-col items-stretch min-h-[300px]">
              {this.props.fallback}
              {this.renderDebugDetails()}
            </div>
          );
        }
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <Alert variant="destructive" className="max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-4">
              <p className="mb-4">
                An unexpected error occurred. This has been logged and we'll look into it.
              </p>
              {this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium mb-2">
                    Error Details
                  </summary>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack && (
                      <div className="mt-2 pt-2 border-t">
                        {this.state.errorInfo.componentStack}
                      </div>
                    )}
                  </pre>
                </details>
              )}
              <div className="mt-4 flex gap-2">
                <Button onClick={this.handleReset} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="destructive"
                  size="sm"
                >
                  Reload Page
                </Button>
              </div>
              {this.renderDebugDetails()}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

