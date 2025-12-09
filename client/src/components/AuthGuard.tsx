import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthDialog } from './AuthDialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Lock, Sparkles, Users, Zap } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return <AuthRequiredScreen />;
  }

  return <>{children}</>;
}

function AuthRequiredScreen() {
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to AI Playground
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Sign in to start building amazing components with AI
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <FeatureCard
            icon={<Sparkles className="h-6 w-6" />}
            title="AI-Powered Generation"
            description="Generate React components, Python apps, and more with advanced AI models"
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="Real-time Preview"
            description="See your creations come to life instantly with live preview and hot reload"
          />
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title="Collaborative Workspace"
            description="Share projects, collaborate with teams, and manage your AI-generated code"
          />
        </div>

        <div className="text-center">
          <Button
            size="lg"
            onClick={() => setShowAuthDialog(true)}
            className="px-8 py-3 text-lg"
          >
            Get Started - Sign In
          </Button>
          <p className="text-sm text-gray-500 mt-4">
            Free tier includes 10 requests per day • No credit card required
          </p>
        </div>

        {showAuthDialog && (
          <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
        )}
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="text-center">
      <CardHeader>
        <div className="flex justify-center mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">{description}</p>
      </CardContent>
    </Card>
  );
}
