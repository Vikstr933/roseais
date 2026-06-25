import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth, getAuthHeaders } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard, Zap, Crown, Sparkles, ArrowRight, Download, ExternalLink } from 'lucide-react';
import { useLocation } from 'wouter';

interface SubscriptionData {
  customerId: string;
  subscriptionId: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: string;
  creditsRemaining: number | null;
  creditsUsed?: number;
  periodEnd: string | null;
  planDetails: {
    name: string;
    price: number;
    priceId?: string;
    credits: number;
    features: string[];
  };
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: string;
  invoiceUrl: string;
}

export function BillingSettings() {
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [invoices] = useState<Invoice[]>([]);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      const response = await apiFetch(`/api/stripe/subscription/${user?.id}`, {
        headers: getAuthHeaders(sessionToken)
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

  const handleManageBilling = async () => {
    if (!subscription?.customerId) {
      toast({
        title: 'Error',
        description: 'No active subscription found',
        variant: 'destructive'
      });
      return;
    }

    setPortalLoading(true);
    try {
      const response = await apiFetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({
          customerId: subscription.customerId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      toast({
        title: 'Error',
        description: 'Failed to open billing portal. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No subscription information available</p>
        </CardContent>
      </Card>
    );
  }

  const creditsRemaining = subscription.creditsRemaining ?? subscription.planDetails.credits;
  const creditsUsed = subscription.creditsUsed ?? Math.max(0, subscription.planDetails.credits - creditsRemaining);
  const creditPercentage = (creditsRemaining / subscription.planDetails.credits) * 100;
  const isLowCredits = creditPercentage < 20;
  const isFreePlan = subscription.plan === 'free';

  const planConfig = {
    free: {
      icon: Zap,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300',
      gradient: 'from-gray-400 to-gray-600'
    },
    pro: {
      icon: Sparkles,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300',
      gradient: 'from-blue-500 to-purple-600'
    },
    enterprise: {
      icon: Crown,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-300',
      gradient: 'from-purple-500 to-pink-600'
    }
  };

  const config = planConfig[subscription.plan];
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card className={`${config.borderColor} border-2`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`${config.bgColor} p-3 rounded-lg`}>
                <Icon className={`h-6 w-6 ${config.color}`} />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {subscription.planDetails.name} Plan
                </CardTitle>
                <CardDescription>
                  {isFreePlan ? (
                    <Badge variant="outline" className="mt-1 border-gray-400 text-gray-700">
                      Free
                    </Badge>
                  ) : subscription.status === 'active' || subscription.status === 'trialing' ? (
                    <Badge variant="outline" className="mt-1 border-green-500 text-green-700">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1 border-red-500 text-red-700">
                      {subscription.status}
                    </Badge>
                  )}
                </CardDescription>
              </div>
            </div>
            {subscription.plan !== 'free' && (
              <div className="text-right">
                <div className="text-3xl font-bold">${subscription.planDetails.price}</div>
                <div className="text-sm text-muted-foreground">per month</div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Credits Usage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">App Generations</span>
              <span className={`text-sm font-semibold ${isLowCredits ? 'text-red-600' : 'text-muted-foreground'}`}>
                {creditsRemaining} / {subscription.planDetails.credits}
              </span>
            </div>
            <Progress
              value={creditPercentage}
              className={`h-3 ${isLowCredits ? '[&>*]:bg-red-500' : ''}`}
            />
            {isLowCredits && (
              <p className="text-xs text-red-600 mt-2">
                You're running low on app generations. Upgrade to keep building.
              </p>
            )}
          </div>

          {/* Renewal Date */}
          {subscription.periodEnd && subscription.plan !== 'free' && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Next billing date</span>
              <span className="text-sm">
                {new Date(subscription.periodEnd).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          )}

          {/* Plan Features */}
          <div>
            <p className="text-sm font-semibold mb-3">Plan includes:</p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {subscription.planDetails.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            {subscription.plan === 'free' ? (
              <Button
                onClick={() => setLocation('/pricing')}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                Upgrade Plan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLocation('/pricing')}
                >
                  Change Plan
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                >
                  {portalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Billing
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Method */}
      {subscription.plan !== 'free' && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>
              Manage your payment methods and billing information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Stripe Billing Portal</p>
                  <p className="text-sm text-muted-foreground">View payment methods, invoices, and billing details securely in Stripe.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={portalLoading}>
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Open
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>
            View and download your past invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {new Date(invoice.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(invoice.invoiceUrl, '_blank', 'noopener,noreferrer')}
                        disabled={!invoice.invoiceUrl}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {subscription.plan === 'free'
                ? 'No invoices yet. Upgrade to a paid plan when you are ready.'
                : 'Invoices will appear in the Stripe billing portal after your first paid invoice.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>
            Track your app generation usage over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">This Month</p>
              <p className="text-2xl font-bold">
                {creditsUsed}
              </p>
              <p className="text-xs text-muted-foreground">app generations used</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Remaining</p>
              <p className="text-2xl font-bold">{creditsRemaining}</p>
              <p className="text-xs text-muted-foreground">app generations left</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Usage Rate</p>
              <p className="text-2xl font-bold">{Math.round(100 - creditPercentage)}%</p>
              <p className="text-xs text-muted-foreground">of monthly quota</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
