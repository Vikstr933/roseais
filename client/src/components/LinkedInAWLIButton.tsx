import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Linkedin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LinkedInAWLIButtonProps {
  jobId: string;
  jobTitle: string;
  companyName: string;
  onSuccess?: (profileData: LinkedInProfileData) => void;
  onError?: (error: string) => void;
  className?: string;
}

export interface LinkedInProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  currentPosition?: string;
  currentCompany?: string;
  experience?: Array<{
    title: string;
    company: string;
    duration: string;
  }>;
  education?: Array<{
    school: string;
    degree: string;
    field: string;
  }>;
  skills?: string[];
}

/**
 * Apply with LinkedIn (AWLI) Button Component
 * 
 * NOTE: LinkedIn AWLI is currently not accepting new partners.
 * This component is prepared for when access is granted.
 * 
 * When LinkedIn AWLI is available:
 * 1. User clicks button
 * 2. OAuth flow initiates
 * 3. User grants permission
 * 4. Profile data is returned and passed to onSuccess callback
 * 5. Form fields are pre-populated with LinkedIn data
 */
export function LinkedInAWLIButton({
  jobId,
  jobTitle,
  companyName,
  onSuccess,
  onError,
  className,
}: LinkedInAWLIButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLinkedInAvailable, setIsLinkedInAvailable] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if LinkedIn AWLI is configured
    checkLinkedInAvailability();
  }, []);

  const checkLinkedInAvailability = async () => {
    try {
      const response = await fetch('/api/linkedin/awli/status');
      if (response.ok) {
        const data = await response.json();
        setIsLinkedInAvailable(data.available === true);
      }
    } catch (error) {
      console.log('LinkedIn AWLI not available:', error);
      setIsLinkedInAvailable(false);
    }
  };

  const handleApplyWithLinkedIn = async () => {
    if (!isLinkedInAvailable) {
      toast({
        title: 'LinkedIn AWLI inte tillgängligt',
        description: 'LinkedIn accepterar för närvarande inte nya partners för Apply with LinkedIn. Funktionen kommer att aktiveras när tillgång beviljas.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Initiate OAuth flow
      const response = await fetch('/api/linkedin/awli/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          jobTitle,
          companyName,
          redirectUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate LinkedIn OAuth');
      }

      const data = await response.json();
      
      // Redirect to LinkedIn OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No auth URL received');
      }
    } catch (error) {
      console.error('Error initiating LinkedIn AWLI:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Fel',
        description: `Kunde inte initiera LinkedIn-ansökan: ${errorMessage}`,
        variant: 'destructive',
      });
      onError?.(errorMessage);
      setIsLoading(false);
    }
  };

  // Don't render if LinkedIn AWLI is not available
  if (!isLinkedInAvailable) {
    return null;
  }

  return (
    <Button
      type="button"
      onClick={handleApplyWithLinkedIn}
      disabled={isLoading}
      className={`bg-[#0077b5] hover:bg-[#005885] text-white ${className || ''}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Laddar...
        </>
      ) : (
        <>
          <Linkedin className="mr-2 h-4 w-4" />
          Ansök med LinkedIn
        </>
      )}
    </Button>
  );
}

