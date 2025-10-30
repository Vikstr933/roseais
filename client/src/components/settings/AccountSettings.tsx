import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, User } from 'lucide-react';

interface UserProfile {
  name: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export function AccountSettings() {
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
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
