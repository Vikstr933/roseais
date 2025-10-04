import React, { useState } from 'react';

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="error-boundary p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold">Something went wrong</h3>
        <p className="text-red-600">Please refresh the page to try again.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [message, setMessage] = useState('Hello from your generated app!');

  return (
    <div className="app">
      <header className="app-header">
        <h1>App</h1>
        <p>Generated from: "{task}"</p>
      </header>

      <main className="app-main">
        <div className="message-display">
          <p>{message}</p>
        </div>

        <div className="controls">
          <button
            onClick={() => setMessage('Button clicked!')}
            className="button primary"
          >
            Click me
          </button>
          <button
            onClick={() => setMessage('Hello from your generated app!')}
            className="button secondary"
          >
            Reset
          </button>
        </div>
      </main>
    </div>
  );
}