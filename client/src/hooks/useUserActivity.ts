import { useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface TrackActivityParams {
  projectId: number;
  activityType: 'generating' | 'chatting' | 'viewing' | 'editing';
  lockType?: 'component_generation' | 'agent_generation' | 'code_generation';
  metadata?: any;
}

export const useUserActivity = () => {
  const { user } = useAuth();
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentActivityRef = useRef<TrackActivityParams | null>(null);

  const trackActivity = useCallback(
    async (params: TrackActivityParams) => {
      if (!user) return;

      try {
        const response = await apiFetch('/api/activity/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          // Silently fail - activity tracking is optional
        }
      } catch (error) {
        // Silently fail - activity tracking is optional
      }
    },
    [user]
  );

  const updateActivity = useCallback(
    async (projectId: number, activityType: string) => {
      if (!user) return;

      try {
        const response = await apiFetch('/api/activity/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projectId, activityType }),
        });

        if (!response.ok) {
          // Silently fail - activity tracking is optional
        }
      } catch (error) {
        // Silently fail - activity tracking is optional
      }
    },
    [user]
  );

  const removeActivity = useCallback(
    async (projectId: number, activityType: string) => {
      if (!user) return;

      try {
        const response = await apiFetch('/api/activity/remove', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projectId, activityType }),
        });

        if (!response.ok) {
          // Silently fail - activity tracking is optional
        }
      } catch (error) {
        // Silently fail - activity tracking is optional
      }
    },
    [user]
  );

  const startActivityTracking = useCallback(
    (params: TrackActivityParams) => {
      if (!user) return;

      // Clear any existing activity
      if (currentActivityRef.current) {
        removeActivity(
          currentActivityRef.current.projectId,
          currentActivityRef.current.activityType
        );
      }

      // Start new activity
      trackActivity(params);
      currentActivityRef.current = params;

      // Set up periodic updates
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }

      activityIntervalRef.current = setInterval(() => {
        updateActivity(params.projectId, params.activityType);
      }, 30000); // Update every 30 seconds
    },
    [user, trackActivity, updateActivity, removeActivity]
  );

  const stopActivityTracking = useCallback(() => {
    if (currentActivityRef.current) {
      removeActivity(
        currentActivityRef.current.projectId,
        currentActivityRef.current.activityType
      );
      currentActivityRef.current = null;
    }

    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }
  }, [removeActivity]);

  const trackViewing = useCallback(
    (projectId: number) => {
      startActivityTracking({
        projectId,
        activityType: 'viewing',
      });
    },
    [startActivityTracking]
  );

  const trackGenerating = useCallback(
    (
      projectId: number,
      lockType: 'component_generation' | 'agent_generation' | 'code_generation',
      metadata?: any
    ) => {
      startActivityTracking({
        projectId,
        activityType: 'generating',
        lockType,
        metadata,
      });
    },
    [startActivityTracking]
  );

  const trackChatting = useCallback(
    (projectId: number, metadata?: any) => {
      startActivityTracking({
        projectId,
        activityType: 'chatting',
        metadata,
      });
    },
    [startActivityTracking]
  );

  const trackEditing = useCallback(
    (projectId: number, metadata?: any) => {
      startActivityTracking({
        projectId,
        activityType: 'editing',
        metadata,
      });
    },
    [startActivityTracking]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopActivityTracking();
    };
  }, [stopActivityTracking]);

  // Cleanup on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      stopActivityTracking();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [stopActivityTracking]);

  return {
    trackViewing,
    trackGenerating,
    trackChatting,
    trackEditing,
    stopActivityTracking,
    trackActivity,
    updateActivity,
    removeActivity,
  };
};
