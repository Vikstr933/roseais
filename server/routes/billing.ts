import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { billingService } from '../services/BillingService';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * POST /api/billing/create-customer
 * Create a Stripe customer for the user
 */
router.post('/create-customer', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email and name are required',
      });
    }

    const customerId = await billingService.createCustomer(userId, email, name);

    res.json({
      success: true,
      data: { customerId },
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer',
    });
  }
});

/**
 * POST /api/billing/create-subscription
 * Create a subscription for the user
 */
router.post('/create-subscription', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { priceId, trialDays } = req.body;

    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: 'Price ID is required',
      });
    }

    // Get user's Stripe customer ID
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0] || !user[0].stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error:
          'User does not have a Stripe customer ID. Please create a customer first.',
      });
    }

    const subscription = await billingService.createSubscription(
      user[0].stripeCustomerId,
      priceId,
      trialDays
    );

    // Update user's subscription info
    await db
      .update(users)
      .set({
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
      })
      .where(eq(users.id, userId));

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription',
    });
  }
});

/**
 * POST /api/billing/cancel-subscription
 * Cancel a subscription
 */
router.post('/cancel-subscription', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { subscriptionId, immediately = false } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'Subscription ID is required',
      });
    }

    await billingService.cancelSubscription(subscriptionId, immediately);

    // Update user's subscription status
    await db
      .update(users)
      .set({
        subscriptionStatus: immediately ? 'canceled' : 'past_due',
        tier: 'free',
      })
      .where(eq(users.id, userId));

    res.json({
      success: true,
      message: 'Subscription canceled successfully',
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
    });
  }
});

/**
 * POST /api/billing/create-checkout-session
 * Create a Stripe checkout session
 */
router.post('/create-checkout-session', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { priceId, successUrl, cancelUrl } = req.body;

    if (!priceId || !successUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        error: 'Price ID, success URL, and cancel URL are required',
      });
    }

    // Get user's Stripe customer ID
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0] || !user[0].stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error:
          'User does not have a Stripe customer ID. Please create a customer first.',
      });
    }

    const session = await billingService.createCheckoutSession(
      user[0].stripeCustomerId,
      priceId,
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
    });
  }
});

/**
 * POST /api/billing/create-portal-session
 * Create a Stripe billing portal session
 */
router.post('/create-portal-session', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { returnUrl } = req.body;

    if (!returnUrl) {
      return res.status(400).json({
        success: false,
        error: 'Return URL is required',
      });
    }

    // Get user's Stripe customer ID
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0] || !user[0].stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error:
          'User does not have a Stripe customer ID. Please create a customer first.',
      });
    }

    const session = await billingService.createBillingPortalSession(
      user[0].stripeCustomerId,
      returnUrl
    );

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create portal session',
    });
  }
});

/**
 * GET /api/billing/customer
 * Get customer information
 */
router.get('/customer', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get user's Stripe customer ID
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0] || !user[0].stripeCustomerId) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    const customer = await billingService.getCustomer(user[0].stripeCustomerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer',
    });
  }
});

/**
 * GET /api/billing/subscription
 * Get subscription information
 */
router.get('/subscription', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get user's subscription ID
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0] || !user[0].subscriptionId) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found',
      });
    }

    const subscription = await billingService.getSubscription(
      user[0].subscriptionId
    );

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription',
    });
  }
});

/**
 * POST /api/billing/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;

    await billingService.handleWebhook(event);

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      error: 'Webhook handling failed',
    });
  }
});

export default router;
