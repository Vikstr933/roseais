import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Zap, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';

interface SubscriptionData {
  plan: 'free' | 'pro' | 'enterprise';
  status: string;
  creditsRemaining: number;
  periodEnd: string | null;
  planDetails: {
    name: string;
    price: number;
    credits: number;
    features: string[];
  };
}

export function SubscriptionStatus() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      const response = await fetch(`/api/stripe/subscription/${user?.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || loading) {
    return null;
  }

  if (!subscription) {
    return null;
  }

  const creditPercentage = (subscription.creditsRemaining / subscription.planDetails.credits) * 100;
  const isLowCredits = creditPercentage < 20;

  const planConfig = {
    free: {
      icon: Zap,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300'
    },
    pro: {
      icon: Sparkles,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300'
    },
    enterprise: {
      icon: Crown,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-300'
    }
  };

  const config = planConfig[subscription.plan];
  const Icon = config.icon;

  return (
    <Card className={`${config.borderColor} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`${config.bgColor} p-2 rounded-lg`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg">
                {subscription.planDetails.name} Plan
              </CardTitle>
              <CardDescription>
                {subscription.status === 'active' ? 'Active' : 'Inactive'}
              </CardDescription>
            </div>
          </div>
          {subscription.plan === 'free' && (
            <Badge variant="outline" className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-none">
              Upgrade Available
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Credits Display */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Generation Credits</span>
            <span className={`text-sm font-semibold ${isLowCredits ? 'text-red-600' : 'text-muted-foreground'}`}>
              {subscription.creditsRemaining} / {subscription.planDetails.credits}
            </span>
          </div>
          <Progress
            value={creditPercentage}
            className={`h-2 ${isLowCredits ? '[&>*]:bg-red-500' : ''}`}
          />
          {isLowCredits && (
            <p className="text-xs text-red-600 mt-1">
              Running low on credits! Consider upgrading.
            </p>
          )}
        </div>

        {/* Period End */}
        {subscription.periodEnd && subscription.plan !== 'free' && (
          <div className="text-xs text-muted-foreground">
            Renews on {new Date(subscription.periodEnd).toLocaleDateString()}
          </div>
        )}

        {/* Upgrade Button for Free Plan */}
        {subscription.plan === 'free' && (
          <Button
            onClick={() => setLocation('/pricing')}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            Upgrade to Pro
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {/* Manage Subscription for Paid Plans */}
        {subscription.plan !== 'free' && (
          <Button
            variant="outline"
            onClick={() => setLocation('/settings/billing')}
            className="w-full"
          >
            Manage Subscription
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
