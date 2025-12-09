import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { apiFetch, getApiUrl } from '../../lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, User, MessageSquare, CheckCircle2, Copy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UserProfile {
  name: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

interface DiscordLink {
  linked: boolean;
  mapping?: {
    discordUserId: string;
    discordUsername?: string;
  };
}

export function AccountSettings() {
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [discordLink, setDiscordLink] = useState<DiscordLink>({ linked: false });
  const [discordUserId, setDiscordUserId] = useState('');
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    displayName: '',
    avatarUrl: ''
  });

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.username || '',
        email: user.email || '',
        displayName: user.username || '',
        avatarUrl: user.avatarUrl || ''
      });
    }
  }, [user]);

  // Handle Discord OAuth callback
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const oauthStatus = searchParams.get('discord_oauth');
    if (oauthStatus) {
      if (oauthStatus === 'success') {
        toast({
          title: 'Success',
          description: 'Discord account linked successfully! You can now chat with Elon in Discord.',
        });
        // Reload Discord status
        loadDiscordStatus();
      } else {
        const error = searchParams.get('error');
        toast({
          title: 'Error',
          description: error || 'Failed to link Discord account',
          variant: 'destructive',
        });
      }
      // Clean up URL
      setLocation('/settings');
    }
  }, [location, toast, setLocation]);

  const loadDiscordStatus = async () => {
    try {
      const response = await apiFetch('/api/discord/link/status', {
        headers: getAuthHeaders(sessionToken)
      });
      const data = await response.json();
      if (data.success) {
        setDiscordLink({
          linked: data.linked,
          mapping: data.mapping
        });
        if (data.mapping?.discordUserId) {
          setDiscordUserId(data.mapping.discordUserId);
        }
      }
    } catch (error) {
      console.error('Failed to load Discord status:', error);
    }
  };

  // Load Discord link status
  useEffect(() => {
    if (sessionToken) {
      loadDiscordStatus();
    }
  }, [sessionToken]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/user/profile', {
        method: 'PUT',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({
          username: profile.name,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      toast({
        title: 'Success',
        description: 'Your profile has been updated successfully'
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLinkDiscord = async () => {
    setDiscordLoading(true);
    try {
      // Get OAuth URL from backend
      const response = await apiFetch('/api/discord/oauth/start', {
        headers: getAuthHeaders(sessionToken)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start Discord OAuth flow');
      }

      // Open Discord OAuth in new window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.authUrl,
        'Discord OAuth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        // If popup blocked, redirect directly
        window.location.href = data.authUrl;
      } else {
        // Listen for popup close or message
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            // Reload status to check if linking succeeded
            setTimeout(() => {
              loadDiscordStatus();
            }, 1000);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error linking Discord:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start Discord OAuth flow',
        variant: 'destructive'
      });
    } finally {
      setDiscordLoading(false);
    }
  };

  const handleUnlinkDiscord = async () => {
    if (!confirm('Are you sure you want to unlink your Discord account? You will no longer be able to chat with Elon in Discord.')) {
      return;
    }

    setDiscordLoading(true);
    try {
      const response = await apiFetch('/api/discord/link', {
        method: 'DELETE',
        headers: getAuthHeaders(sessionToken)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlink Discord account');
      }

      setDiscordLink({ linked: false });
      setDiscordUserId('');

      toast({
        title: 'Success',
        description: 'Discord account unlinked successfully'
      });
    } catch (error) {
      console.error('Error unlinking Discord:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unlink Discord account',
        variant: 'destructive'
      });
    } finally {
      setDiscordLoading(false);
    }
  };

  const copyDiscordId = () => {
    if (discordLink.mapping?.discordUserId) {
      navigator.clipboard.writeText(discordLink.mapping.discordUserId);
      toast({
        title: 'Copied',
        description: 'Discord User ID copied to clipboard'
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your account details and how others see you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatarUrl} alt={profile.name} />
              <AvatarFallback className="text-2xl">
                {profile.name ? getInitials(profile.name) : <User className="h-12 w-12" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <div className="flex gap-2">
                <Input
                  id="avatarUrl"
                  placeholder="https://example.com/avatar.jpg"
                  value={profile.avatarUrl}
                  onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
                />
                <Button variant="outline" size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter a URL or upload an image (JPG, PNG, max 2MB)
              </p>
            </div>
          </div>

          {/* Name Fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="johndoe"
                value={profile.displayName}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                This is how your name will be displayed
              </p>
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              disabled
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground">
              Email cannot be changed. Contact support if you need to update it.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Discord Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Discord Integration
          </CardTitle>
          <CardDescription>
            Link your Discord account to chat with Elon in Discord servers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {discordLink.linked && discordLink.mapping ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <strong>Discord account linked!</strong> You can now chat with Elon in Discord by mentioning @Elon.
                </AlertDescription>
              </Alert>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Discord Username</Label>
                  <p className="text-sm mt-1 font-medium">
                    {discordLink.mapping.discordUsername || 'Not set'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Discord User ID</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-sm">{discordLink.mapping.discordUserId}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={copyDiscordId}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                variant="destructive"
                onClick={handleUnlinkDiscord}
                disabled={discordLoading}
              >
                {discordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unlink Discord Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  To chat with Elon in Discord, you need to link your Discord account. Click the button below to authorize with Discord.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleLinkDiscord}
                disabled={discordLoading}
                className="w-full"
              >
                {discordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <MessageSquare className="mr-2 h-4 w-4" />
                Link Discord Account with OAuth
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Status */}
      <Card>
        <CardHeader>
          <CardTitle>Account Status</CardTitle>
          <CardDescription>
            Your account information and status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Account ID</Label>
              <p className="font-mono text-sm mt-1">{user?.id}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Member Since</Label>
              <p className="text-sm mt-1">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
