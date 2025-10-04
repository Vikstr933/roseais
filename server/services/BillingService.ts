import { db } from '../../db';
import { users, subscriptionPlans } from '../../db/schema';
import { eq } from 'drizzle-orm';

export interface BillingCustomer {
  id: string;
  email: string;
  name: string;
  tier: string;
  subscriptionStatus: string;
  subscriptionId?: string;
  stripeCustomerId?: string;
}

export interface BillingSubscription {
  id: string;
  customerId: string;
  planId: string;
  status: 'active' | 'inactive' | 'canceled' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export class BillingService {
  private stripeSecretKey: string;
  private stripeWebhookSecret: string;

  constructor() {
    this.stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
    this.stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  /**
   * Create a Stripe customer
   */
  async createCustomer(
    userId: string,
    email: string,
    name: string
  ): Promise<string> {
    // In a real implementation, this would call Stripe API
    // For now, we'll simulate it
    const customerId = `cus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update user with Stripe customer ID
    await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, userId));

    return customerId;
  }

  /**
   * Create a subscription
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    trialDays?: number
  ): Promise<BillingSubscription> {
    // In a real implementation, this would call Stripe API
    // For now, we'll simulate it
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const subscription: BillingSubscription = {
      id: subscriptionId,
      customerId,
      planId: priceId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    };

    return subscription;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
  ): Promise<void> {
    // In a real implementation, this would call Stripe API
    console.log(
      `Canceling subscription ${subscriptionId}, immediately: ${immediately}`
    );
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    newPriceId: string
  ): Promise<BillingSubscription> {
    // In a real implementation, this would call Stripe API
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      id: subscriptionId,
      customerId: 'customer_id',
      planId: newPriceId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    };
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<BillingCustomer | null> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);

    if (!user[0]) {
      return null;
    }

    return {
      id: user[0].id,
      email: user[0].email,
      name: user[0].displayName,
      tier: user[0].tier,
      subscriptionStatus: user[0].subscriptionStatus || 'inactive',
      subscriptionId: user[0].subscriptionId,
      stripeCustomerId: user[0].stripeCustomerId,
    };
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(
    subscriptionId: string
  ): Promise<BillingSubscription | null> {
    // In a real implementation, this would call Stripe API
    // For now, return null
    return null;
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ url: string; sessionId: string }> {
    // In a real implementation, this would call Stripe API
    const sessionId = `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      url: `/checkout/success?session_id=${sessionId}`,
      sessionId,
    };
  }

  /**
   * Create billing portal session
   */
  async createBillingPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<{ url: string }> {
    // In a real implementation, this would call Stripe API
    return {
      url: `/billing/portal?customer_id=${customerId}`,
    };
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: any): Promise<void> {
    // In a real implementation, this would handle Stripe webhooks
    console.log('Handling webhook event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
    }
  }

  private async handleSubscriptionCreated(subscription: any): Promise<void> {
    // Update user's subscription status
    const user = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, subscription.customer))
      .limit(1);

    if (user[0]) {
      await db
        .update(users)
        .set({
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          tier: this.getTierFromPriceId(subscription.items.data[0].price.id),
        })
        .where(eq(users.id, user[0].id));
    }
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<void> {
    // Update user's subscription status
    const user = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, subscription.customer))
      .limit(1);

    if (user[0]) {
      await db
        .update(users)
        .set({
          subscriptionStatus: subscription.status,
          tier: this.getTierFromPriceId(subscription.items.data[0].price.id),
        })
        .where(eq(users.id, user[0].id));
    }
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<void> {
    // Downgrade user to free tier
    const user = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, subscription.customer))
      .limit(1);

    if (user[0]) {
      await db
        .update(users)
        .set({
          subscriptionStatus: 'canceled',
          tier: 'free',
        })
        .where(eq(users.id, user[0].id));
    }
  }

  private async handlePaymentSucceeded(invoice: any): Promise<void> {
    // Handle successful payment
    console.log('Payment succeeded for invoice:', invoice.id);
  }

  private async handlePaymentFailed(invoice: any): Promise<void> {
    // Handle failed payment
    console.log('Payment failed for invoice:', invoice.id);
  }

  private getTierFromPriceId(priceId: string): string {
    // Map Stripe price IDs to tiers
    // In a real implementation, this would be stored in the database
    const priceIdMap: Record<string, string> = {
      price_pro_monthly: 'pro',
      price_enterprise_monthly: 'enterprise',
    };

    return priceIdMap[priceId] || 'free';
  }

  /**
   * Get available subscription plans
   */
  async getAvailablePlans(): Promise<any[]> {
    return await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, 1))
      .orderBy(subscriptionPlans.price);
  }
}

export const billingService = new BillingService();
