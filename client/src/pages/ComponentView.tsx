import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useLocation } from 'wouter';
import { ComponentPreview } from '../components/ComponentPreview/ComponentPreview';

interface ComponentData {
  files: {
    path: string;
    content: string;
  }[];
  preview: {
    url: string;
    editorUrl: string;
  };
}

export default function ComponentView() {
  const [location] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [componentData, setComponentData] = useState<ComponentData | null>(
    null
  );

  // Extract component name from URL
  const componentName =
    location
      .split('/')
      .pop()
      ?.replace(/-(preview|editor)$/, '') || '';
  const isPreview = location.endsWith('-preview');

  useEffect(() => {
    if (!componentName) {
      setError('Invalid component name');
      setLoading(false);
      return;
    }

    const fetchComponentData = async () => {
      try {
        setLoading(true);
        // In a real app, this would fetch from your API endpoint
        // For now, we'll use mock data
        const response = await apiFetch(`/api/components/${componentName}`);
        if (!response.ok) {
          throw new Error('Failed to fetch component data');
        }
        const data = await response.json();
        setComponentData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (componentName) {
      fetchComponentData();
    }
  }, [componentName]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !componentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{error || 'Component not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ComponentPreview
        componentName={componentName}
        files={componentData.files}
      />
    </div>
  );
}
