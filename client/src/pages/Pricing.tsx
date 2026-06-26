import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { motion } from 'framer-motion';
import { Check, Zap, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useAuth, getAuthHeaders } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';
import { useLocation } from 'wouter';

interface Plan {
  name: string;
  price: number;
  priceId?: string;
  credits: number;
  features: string[];
  popular?: boolean;
  icon: any;
  color: string;
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: 0,
    credits: 3,
    features: [
      '3 free app generations per month',
      '3 active projects',
      'Frontend web apps',
      'Community support',
      'Preview before upgrading'
    ],
    icon: Sparkles,
    color: 'from-gray-400 to-gray-600'
  },
  {
    name: 'Pro',
    price: 29,
    priceId: 'price_pro_monthly', // Replace with actual Stripe Price ID
    credits: 500,
    features: [
      '500 app generations per month',
      '50 active projects',
      'Project-specific API keys',
      'Fullstack apps with backend, auth, databases, and uploads',
      'Priority support',
      'Publish to community',
      'Export source code',
      'Deploy to production'
    ],
    popular: true,
    icon: Zap,
    color: 'from-blue-500 to-purple-600'
  },
  {
    name: 'Enterprise',
    price: 99,
    priceId: 'price_enterprise_monthly', // Replace with actual Stripe Price ID
    credits: 2000,
    features: [
      '2000 app generations per month',
      '250 active projects',
      'Project-specific and reusable API keys',
      'All Pro features',
      'Dedicated support',
      'Custom AI training',
      'SLA guarantee',
      'Advanced analytics',
      'Team collaboration'
    ],
    icon: Crown,
    color: 'from-purple-500 to-pink-600'
  }
];

export default function Pricing() {
  const { user, sessionToken } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: Plan) => {
    if (!user) {
      setLocation('/auth/login?redirect=/pricing');
      return;
    }

    if (plan.name === 'Free') {
      toast({
        title: 'Already on Free Plan',
        description: 'You are currently on the free plan. Upgrade to unlock more features!'
      });
      return;
    }

    setLoading(plan.name);

    try {
      const response = await apiFetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: getAuthHeaders(sessionToken),
        body: JSON.stringify({
          priceId: plan.priceId,
          userId: user.id,
          email: user.email
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Subscription error:', error);
      toast({
        title: 'Error',
        description: 'Failed to start checkout. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <Badge className="mb-4" variant="outline">
            Simple, Transparent Pricing
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start building amazing applications with AI. Upgrade anytime as your needs grow.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={plan.popular ? 'md:-mt-4' : ''}
              >
                <Card className={`relative ${
                  plan.popular
                    ? 'border-primary shadow-2xl shadow-primary/20 scale-105'
                    : 'border-border'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-4 left-0 right-0 flex justify-center">
                      <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-r ${plan.color}`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      {plan.popular && (
                        <Sparkles className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>
                      <div className="mt-4 flex items-baseline">
                        <span className="text-4xl font-bold text-foreground">
                          ${plan.price}
                        </span>
                        <span className="text-muted-foreground ml-2">/month</span>
                      </div>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="font-semibold">
                        {plan.credits} app generations/month
                      </span>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-sm font-semibold mb-3">Everything included:</p>
                      <ul className="space-y-3">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                          : ''
                      }`}
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleSubscribe(plan)}
                      disabled={loading !== null}
                    >
                      {loading === plan.name ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Processing...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {plan.name === 'Free' ? 'Current Plan' : 'Get Started'}
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-24 max-w-3xl mx-auto"
        >
          <h2 className="text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I change plans anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! You can upgrade, downgrade, or cancel your subscription at any time.
                  Changes take effect at the start of your next billing cycle.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What happens to unused credits?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Unused credits reset at the beginning of each monthly billing cycle.
                  We recommend choosing a plan that matches your expected usage.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Do you offer refunds?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes, we offer a 14-day money-back guarantee. If you're not satisfied with
                  your subscription, contact us within 14 days for a full refund.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Need a custom plan?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Enterprise customers with specific needs can contact us for a custom plan
                  tailored to your requirements. Reach out to sales@yourapp.com
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
