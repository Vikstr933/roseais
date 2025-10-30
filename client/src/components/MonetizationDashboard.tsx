import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  Zap,
  Crown,
  Building,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  tokensUsedThisMonth: number;
  remainingTokens: number;
  monthlyTokenLimit: number;
  usagePercentage: number;
}

interface SubscriptionPlan {
  id: number;
  name: string;
  tier: string;
  price: number;
  features: Record<string, any>;
  limits: Record<string, any>;
}

interface RateLimitConfig {
  free: {
    monthlyTokens: number;
    features: string[];
  };
  pro: {
    monthlyTokens: number;
    features: string[];
  };
  team: {
    monthlyTokens: number;
    features: string[];
  };
  enterprise: {
    monthlyTokens: number;
    features: string[];
    allowOwnAPIKeys: boolean;
  };
}

interface MonetizationDashboardProps {
  userId: string;
  userTier?: string;
}

export function MonetizationDashboard({
  userId,
  userTier = 'free',
}: MonetizationDashboardProps) {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [rateLimitConfig, setRateLimitConfig] =
    useState<RateLimitConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usageResponse, plansResponse, configResponse] = await Promise.all([
        apiFetch('/api/monetization/usage'),
        apiFetch('/api/monetization/plans'),
        apiFetch('/api/monetization/rate-limits'),
      ]);

      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        setUsageStats(usageData.data);
      }

      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.data);
      }

      if (configResponse.ok) {
        const configData = await configResponse.json();
        setRateLimitConfig(configData.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load monetization data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    setIsUpgrading(true);
    try {
      const response = await apiFetch('/api/monetization/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Successfully upgraded to ${tier} tier`,
        });
        loadData(); // Reload data
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Upgrade failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Upgrade failed',
        variant: 'destructive',
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleDowngrade = async () => {
    try {
      const response = await apiFetch('/api/monetization/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Successfully downgraded to free tier',
        });
        loadData(); // Reload data
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Downgrade failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Downgrade failed',
        variant: 'destructive',
      });
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'free':
        return <Zap className="h-4 w-4" />;
      case 'pro':
        return <Crown className="h-4 w-4" />;
      case 'team':
        return <Building className="h-4 w-4" />;
      case 'enterprise':
        return <Building className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'bg-gray-100 text-gray-800';
      case 'pro':
        return 'bg-blue-100 text-blue-800';
      case 'team':
        return 'bg-green-100 text-green-800';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUsagePercentage = () => {
    if (!usageStats) return 0;
    return usageStats.usagePercentage;
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Monetization Dashboard</h2>
          <p className="text-gray-600">Manage your subscription and usage</p>
        </div>
        <div className="flex items-center space-x-2">
          {getTierIcon(userTier)}
          <Badge className={getTierColor(userTier)}>
            {userTier.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Usage Overview */}
      {usageStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Monthly Tokens
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usageStats.tokensUsedThisMonth.toLocaleString()}
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Progress value={getUsagePercentage()} className="flex-1" />
                <span className="text-xs text-muted-foreground">
                  {usageStats.remainingTokens > 0
                    ? `${usageStats.remainingTokens.toLocaleString()} left`
                    : 'Limit reached'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Token Limit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usageStats.monthlyTokenLimit === -1
                  ? '∞'
                  : usageStats.monthlyTokenLimit.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {usageStats.monthlyTokenLimit === -1
                  ? 'Unlimited'
                  : 'Monthly limit'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Tokens
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usageStats.totalTokens.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">All time usage</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${usageStats.totalCost.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Your API usage cost
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage Warning */}
      {usageStats &&
        usageStats.remainingTokens <= 0 &&
        usageStats.monthlyTokenLimit !== -1 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You've reached your monthly token limit. Upgrade your plan to
              continue using the service.
            </AlertDescription>
          </Alert>
        )}

      {/* Plans */}
      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">Subscription Plans</TabsTrigger>
          <TabsTrigger value="usage">Usage Details</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map(plan => (
              <Card
                key={plan.id}
                className={`relative ${plan.tier === userTier ? 'ring-2 ring-blue-500' : ''}`}
              >
                {plan.tier === userTier && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500">Current Plan</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      {getTierIcon(plan.tier)}
                      <span>{plan.name}</span>
                    </CardTitle>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {plan.price === 0 ? 'Free' : `$${plan.price}`}
                      </div>
                      {plan.price > 0 && (
                        <div className="text-sm text-muted-foreground">
                          /month
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Features:</h4>
                    <ul className="space-y-1 text-sm">
                      {Object.entries(plan.features).map(([key, value]) => (
                        <li key={key} className="flex items-center space-x-2">
                          {value ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className={value ? '' : 'text-gray-500'}>
                            {key.replace(/_/g, ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Limits:</h4>
                    <ul className="space-y-1 text-sm">
                      {Object.entries(plan.limits).map(([key, value]) => (
                        <li key={key} className="flex justify-between">
                          <span>{key.replace(/_/g, ' ')}:</span>
                          <span className="font-medium">
                            {value === -1 ? 'Unlimited' : value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4">
                    {plan.tier === userTier ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : plan.tier === 'free' ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleDowngrade}
                        disabled={userTier === 'free'}
                      >
                        Downgrade
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleUpgrade(plan.tier)}
                        disabled={isUpgrading}
                      >
                        {isUpgrading
                          ? 'Upgrading...'
                          : `Upgrade to ${plan.name}`}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Usage history will be available soon</p>
                <p className="text-sm">Track your API usage over time</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
