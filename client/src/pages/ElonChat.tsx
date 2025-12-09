/**
 * Dedicated Elon Chat Page for PWA
 * A standalone chat interface similar to ChatGPT app
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { OmniAssistant } from '@/components/OmniAssistant/OmniAssistant';
import { useAuth } from '@/contexts/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';
import { useState } from 'react';

export default function ElonChat() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    // If not logged in, show auth dialog
    if (!isLoading && !user) {
      setShowAuthDialog(true);
    }
  }, [user, isLoading]);

  // Auto-open Elon when component mounts
  useEffect(() => {
    if (user) {
      // Dispatch event to open Elon
      const event = new CustomEvent('openElon');
      window.dispatchEvent(event);
    }
  }, [user]);

  const handleAuthSuccess = () => {
    setShowAuthDialog(false);
    // Open Elon after successful auth
    setTimeout(() => {
      const event = new CustomEvent('openElon');
      window.dispatchEvent(event);
    }, 100);
  };

  return (
    <div className="h-screen w-screen bg-background overflow-hidden">
      {/* Minimal header - only show if not logged in */}
      {!user && !isLoading && (
        <div className="h-16 border-b border-border flex items-center justify-center bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            Elon AI Assistant
          </h1>
        </div>
      )}

      {/* Main content - Elon chat takes full screen */}
      <div className={user ? "h-screen" : "h-[calc(100vh-4rem)]"}>
        <OmniAssistant />
      </div>

      {/* Auth Dialog */}
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

