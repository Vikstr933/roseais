import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '../../db/index.js';
import { Logger } from '../utils/Logger';

const router = Router();
const logger = new Logger(process.cwd());

// Initialize Stripe with your secret key (you'll need to add this to your .env file)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    })
  : null;

// Subscription plans configuration
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    credits: 10,
    features: [
      '10 AI generations per month',
      'Basic components',
      'Community support',
      'Public projects only'
    ]
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID, // Monthly subscription
    price: 29,
    credits: 500,
    features: [
      '500 AI generations per month',
      'Advanced components',
      'Priority support',
      'Private projects',
      'Custom domains',
      'Team collaboration'
    ]
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    price: 99,
    credits: 2000,
    features: [
      '2000 AI generations per month',
      'All Pro features',
      'Dedicated support',
      'Custom AI training',
      'SLA guarantee',
      'Advanced analytics',
      'Unlimited team members'
    ]
  }
};

// Create a checkout session for subscription
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  const { priceId, userId } = req.body;

  if (!priceId || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        userId: userId.toString(),
      },
      customer_email: req.body.email,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    logger.error('StripeRoute', 'Failed to create checkout session', { error });
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create a customer portal session for managing subscriptions
router.post('/create-portal-session', async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  const { customerId } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'Missing customer ID' });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    });

    res.json({ url: session.url });
  } catch (error) {
    logger.error('StripeRoute', 'Failed to create portal session', { error });
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Webhook handler for Stripe events
router.post('/webhook', async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  const sig = req.headers['stripe-signature'];

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ error: 'Missing signature or webhook secret' });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('StripeWebhook', 'Webhook signature verification failed', { error: err });
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        logger.info('StripeWebhook', `Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('StripeWebhook', 'Error processing webhook', { error, eventType: event.type });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get current subscription status
router.get('/subscription/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // Query your database for the user's subscription
    const result = await db.query(
      `SELECT
        stripe_customer_id,
        stripe_subscription_id,
        subscription_plan,
        subscription_status,
        credits_remaining,
        subscription_period_end
      FROM users
      WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const plan = PLANS[user.subscription_plan as keyof typeof PLANS] || PLANS.free;

    res.json({
      customerId: user.stripe_customer_id,
      subscriptionId: user.stripe_subscription_id,
      plan: user.subscription_plan,
      status: user.subscription_status,
      creditsRemaining: user.credits_remaining,
      periodEnd: user.subscription_period_end,
      planDetails: plan
    });
  } catch (error) {
    logger.error('StripeRoute', 'Failed to get subscription', { error });
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Helper functions for webhook handlers
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  // Get subscription details
  if (stripe && subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0].price.id;

    // Determine plan based on price ID
    let plan = 'free';
    if (priceId === PLANS.pro.priceId) plan = 'pro';
    if (priceId === PLANS.enterprise.priceId) plan = 'enterprise';

    const planDetails = PLANS[plan as keyof typeof PLANS];

    // Update user in database
    await db.query(
      `UPDATE users
       SET stripe_customer_id = $1,
           stripe_subscription_id = $2,
           subscription_plan = $3,
           subscription_status = $4,
           credits_remaining = $5,
           subscription_period_end = $6
       WHERE id = $7`,
      [
        customerId,
        subscriptionId,
        plan,
        subscription.status,
        planDetails.credits,
        new Date(subscription.current_period_end * 1000),
        userId
      ]
    );

    logger.info('StripeWebhook', 'Checkout completed', { userId, plan });
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find user by customer ID
  const result = await db.query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (result.rows.length === 0) return;

  const userId = result.rows[0].id;
  const priceId = subscription.items.data[0].price.id;

  // Determine plan
  let plan = 'free';
  if (priceId === PLANS.pro.priceId) plan = 'pro';
  if (priceId === PLANS.enterprise.priceId) plan = 'enterprise';

  const planDetails = PLANS[plan as keyof typeof PLANS];

  // Update subscription
  await db.query(
    `UPDATE users
     SET subscription_plan = $1,
         subscription_status = $2,
         subscription_period_end = $3,
         credits_remaining = $4
     WHERE id = $5`,
    [
      plan,
      subscription.status,
      new Date(subscription.current_period_end * 1000),
      planDetails.credits,
      userId
    ]
  );

  logger.info('StripeWebhook', 'Subscription updated', { userId, plan, status: subscription.status });
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const result = await db.query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (result.rows.length === 0) return;

  const userId = result.rows[0].id;

  // Downgrade to free plan
  await db.query(
    `UPDATE users
     SET subscription_plan = 'free',
         subscription_status = 'canceled',
         credits_remaining = $1
     WHERE id = $2`,
    [PLANS.free.credits, userId]
  );

  logger.info('StripeWebhook', 'Subscription canceled', { userId });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const result = await db.query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (result.rows.length === 0) return;

  const userId = result.rows[0].id;

  logger.info('StripeWebhook', 'Payment succeeded', { userId, amount: invoice.amount_paid });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const result = await db.query(
    'SELECT id, email FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (result.rows.length === 0) return;

  const user = result.rows[0];

  // TODO: Send email notification about failed payment
  logger.error('StripeWebhook', 'Payment failed', { userId: user.id, email: user.email });
}

// Get available plans
router.get('/plans', (req: Request, res: Response) => {
  res.json({ plans: PLANS });
});

export default router;
