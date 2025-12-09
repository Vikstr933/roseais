import React from 'react';
import { TodoList } from './components/TodoList';
import { TodoProvider } from './components/TodoProvider';

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
  return (
    <TodoProvider>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Todo List</h1>
          <TodoList />
        </div>
      </div>
    </TodoProvider>
  );
}