import { useState, useEffect } from 'react';
import { useToast } from './use-toast';

export type ServerStatus = 'running' | 'stopped' | 'error';

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>('stopped');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/server/status');
      if (!response.ok) throw new Error('Failed to fetch server status');
      const data = await response.json();
      setStatus(data.status);
    } catch (error) {
      console.error('Server status check failed:', error);
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const startServer = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/server/start', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to start server');
      const data = await response.json();
      setStatus(data.status);
      toast({ title: "Server Started" });
    } catch (error) {
      console.error('Failed to start server:', error);
      toast({ 
        title: "Error", 
        description: "Failed to start server",
        variant: "destructive"
      });
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const stopServer = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/server/stop', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to stop server');
      const data = await response.json();
      setStatus(data.status);
      toast({ title: "Server Stopped" });
    } catch (error) {
      console.error('Failed to stop server:', error);
      toast({ 
        title: "Error", 
        description: "Failed to stop server",
        variant: "destructive"
      });
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const pollStatus = async () => {
      if (!mounted) return;
      
      try {
        await checkStatus();
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Initial check
    pollStatus();

    // Set up polling with a longer interval
    const interval = setInterval(pollStatus, 10000);
    
    // Cleanup
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return {
    status,
    isLoading,
    startServer,
    stopServer,
    checkStatus
  };
}
