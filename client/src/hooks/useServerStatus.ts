import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useToast } from './use-toast';

export type ServerStatus = 'running' | 'stopped' | 'error';

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>('stopped');
  const [isLoading, setIsLoading] = useState(false); // Changed from true
  const { toast } = useToast();

  const checkStatus = async () => {
    try {
      const response = await apiFetch('/api/server/status');
      if (!response.ok) {
        // If API doesn't exist, assume stopped
        setStatus('stopped');
        return;
      }
      const data = await response.json();
      setStatus(data.status || 'stopped');
    } catch (error) {
      console.error('Server status check failed:', error);
      setStatus('stopped'); // Default to stopped on error
    } finally {
      setIsLoading(false);
    }
  };

  const startServer = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/api/server/start', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to start server');
      const data = await response.json();
      setStatus(data.status);
      toast({ title: 'Server Started' });
    } catch (error) {
      console.error('Failed to start server:', error);
      toast({
        title: 'Error',
        description: 'Failed to start server',
        variant: 'destructive',
      });
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const stopServer = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/api/server/stop', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to stop server');
      const data = await response.json();
      setStatus(data.status);
      toast({ title: 'Server Stopped' });
    } catch (error) {
      console.error('Failed to stop server:', error);
      toast({
        title: 'Error',
        description: 'Failed to stop server',
        variant: 'destructive',
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
      // Only poll when tab is visible to reduce unnecessary requests
      if (document.hidden) return;

      try {
        await checkStatus();
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Initial check
    pollStatus();

    // Set up polling with a longer interval (reduced frequency to avoid rate limits)
    const interval = setInterval(pollStatus, 30000);

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
    checkStatus,
  };
}
