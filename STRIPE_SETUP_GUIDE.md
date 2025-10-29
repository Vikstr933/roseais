# 🚀 Stripe Payment Integration Setup Guide

This guide will walk you through setting up Stripe payments for your AI code generation platform.

## 📋 Prerequisites

- A Stripe account (sign up at https://stripe.com)
- Access to your Stripe Dashboard
- PostgreSQL database (already configured)
- Node.js application (already set up)

## 🔧 Step 1: Get Your Stripe API Keys

1. Go to https://dashboard.stripe.com/
2. Click on "Developers" in the left sidebar
3. Click on "API keys"
4. You'll see two keys:
   - **Publishable key** (starts with `pk_test_...` or `pk_live_...`)
   - **Secret key** (starts with `sk_test_...` or `sk_live_...`)

⚠️ **IMPORTANT**: Never commit your secret key to version control!

## 🔑 Step 2: Add Environment Variables

Add these to your `.env` file in the root directory:

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Stripe Price IDs (you'll create these in Step 3)
STRIPE_PRO_PRICE_ID=price_YOUR_PRO_PRICE_ID
STRIPE_ENTERPRISE_PRICE_ID=price_YOUR_ENTERPRISE_PRICE_ID

# Your application URLs
FRONTEND_URL=http://localhost:5173
```

## 💳 Step 3: Create Your Products and Prices in Stripe

### Method 1: Via Stripe Dashboard (Recommended for beginners)

1. Go to https://dashboard.stripe.com/products
2. Click "Add product"
3. Create the **Pro Plan**:
   - **Name**: Pro Plan
   - **Description**: 500 AI generations per month with advanced features
   - **Pricing model**: Standard pricing
   - **Price**: $29.00 USD
   - **Billing period**: Monthly
   - Click "Save product"
   - **Copy the Price ID** (starts with `price_...`) and add it to your `.env` file as `STRIPE_PRO_PRICE_ID`

4. Repeat for **Enterprise Plan**:
   - **Name**: Enterprise Plan
   - **Description**: 2000 AI generations per month with all features
   - **Price**: $99.00 USD
   - **Billing period**: Monthly
   - **Copy the Price ID** and add it to your `.env` as `STRIPE_ENTERPRISE_PRICE_ID`

### Method 2: Via Stripe CLI (For developers)

Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop install stripe

# Linux
# Download from https://github.com/stripe/stripe-cli/releases
```

Create products:
```bash
# Login to Stripe
stripe login

# Create Pro Plan
stripe products create \
  --name="Pro Plan" \
  --description="500 AI generations per month"

# Create price for Pro Plan (replace prod_XXX with your product ID)
stripe prices create \
  --product=prod_XXX \
  --unit-amount=2900 \
  --currency=usd \
  --recurring[interval]=month

# Create Enterprise Plan
stripe products create \
  --name="Enterprise Plan" \
  --description="2000 AI generations per month"

# Create price for Enterprise Plan
stripe prices create \
  --product=prod_YYY \
  --unit-amount=9900 \
  --currency=usd \
  --recurring[interval]=month
```

## 🔔 Step 4: Setup Stripe Webhooks

Webhooks allow Stripe to notify your application about payment events.

### For Local Development:

1. Install Stripe CLI (if not already installed)
2. Forward webhooks to your local server:
```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
```

3. Copy the webhook signing secret (starts with `whsec_...`)
4. Add it to your `.env` file as `STRIPE_WEBHOOK_SECRET`

### For Production:

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Select the following events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the **Signing secret** and add it to your production `.env` file

## 🗄️ Step 5: Update Database Schema

Add subscription-related columns to your users table:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 10;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_plan, subscription_status);
```

Run the migration:
```bash
# Connect to your database
psql $DATABASE_URL

# Or if using Supabase
psql "postgresql://postgres:[YOUR-PASSWORD]@db.hngwzhlhlaggzzmgcwys.supabase.co:5432/postgres"

# Then paste the SQL above
```

## 🎨 Step 6: Update Frontend Stripe Keys

Update the Pricing page with your actual Price IDs:

Open `client/src/pages/Pricing.tsx` and replace the price IDs:

```typescript
const plans: Plan[] = [
  // ... Free plan stays the same
  {
    name: 'Pro',
    price: 29,
    priceId: 'price_YOUR_ACTUAL_PRO_PRICE_ID', // ← Replace this
    // ...
  },
  {
    name: 'Enterprise',
    price: 99,
    priceId: 'price_YOUR_ACTUAL_ENTERPRISE_PRICE_ID', // ← Replace this
    // ...
  }
];
```

## 🔗 Step 7: Add Stripe Route to Server

Open `server/index.ts` and add the Stripe routes:

```typescript
import stripeRoutes from './routes/stripe';

// Add this with your other routes
app.use('/api/stripe', stripeRoutes);
```

## 🔗 Step 8: Add Pricing Route to Frontend

Open `client/src/App.tsx` and add the route:

```typescript
import Pricing from './pages/Pricing';

// Add this to your routes
<Route path="/pricing" component={Pricing} />
```

## 🧪 Step 9: Test Your Integration

### Test Mode Testing:

1. Start your local development server:
```bash
cd server && npm run dev
```

2. In another terminal, start the Stripe webhook listener:
```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
```

3. Navigate to http://localhost:5173/pricing

4. Click "Get Started" on the Pro plan

5. Use Stripe test cards:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - **3D Secure**: `4000 0027 6000 3184`
   - Use any future expiry date, any 3-digit CVC, and any ZIP code

6. Check your terminal for webhook events

7. Verify the database was updated:
```sql
SELECT id, email, subscription_plan, subscription_status, credits_remaining
FROM users
WHERE stripe_customer_id IS NOT NULL;
```

## 🚀 Step 10: Go Live

When you're ready to accept real payments:

1. **Activate your Stripe account**:
   - Go to https://dashboard.stripe.com/settings/account
   - Complete the business verification process
   - Add your bank account details for payouts

2. **Switch to live mode**:
   - In the Stripe Dashboard, toggle from "Test mode" to "Live mode" (top right)
   - Get your live API keys (they start with `pk_live_...` and `sk_live_...`)
   - Update your production `.env` file with live keys

3. **Create live products and prices**:
   - Repeat Step 3 in live mode
   - Update your frontend with live price IDs

4. **Setup production webhooks**:
   - Follow the "For Production" instructions in Step 4

5. **Test with a real card** (you can refund it later):
   - Make a test purchase
   - Verify the webhook is received
   - Check the database
   - Issue a refund from the Stripe Dashboard

## 💡 Additional Features

### Customer Portal

Allow users to manage their subscriptions:

```typescript
// Add this to your Settings page
const handleManageSubscription = async () => {
  const response = await fetch('/api/stripe/create-portal-session', {
    method: 'POST',
    headers: getAuthHeaders(sessionToken),
    body: JSON.stringify({ customerId: user.stripeCustomerId })
  });

  const { url } = await response.json();
  window.location.href = url;
};
```

### Usage-Based Billing

Track AI generation usage:

```typescript
// Decrement credits after each generation
await db.query(
  'UPDATE users SET credits_remaining = credits_remaining - 1 WHERE id = $1',
  [userId]
);

// Block if out of credits
const user = await getUserById(userId);
if (user.credits_remaining <= 0) {
  throw new Error('Out of credits. Please upgrade your plan.');
}
```

### Email Notifications

Send emails when:
- Subscription created
- Payment succeeded
- Payment failed
- Subscription canceled
- Low credits warning

## 🔒 Security Best Practices

1. ✅ Never expose your secret key in frontend code
2. ✅ Always verify webhook signatures
3. ✅ Use HTTPS in production
4. ✅ Validate all data from Stripe webhooks
5. ✅ Log all payment events for auditing
6. ✅ Implement rate limiting on payment endpoints
7. ✅ Handle failed payments gracefully
8. ✅ Use Stripe's test mode during development

## 🐛 Troubleshooting

### Webhook not receiving events:

```bash
# Check Stripe CLI is running
stripe listen --forward-to localhost:5000/api/stripe/webhook

# Check your endpoint is accessible
curl -X POST http://localhost:5000/api/stripe/webhook

# View webhook logs
stripe webhooks tail
```

### Database not updating:

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# View recent webhook events in Stripe Dashboard
# https://dashboard.stripe.com/test/webhooks

# Check server logs for errors
npm run dev
```

### Payment failing:

- Verify you're using test mode keys with test cards
- Check the Stripe Dashboard → Payments for error details
- Ensure the price ID matches your product
- Verify your business is activated for live mode

## 📚 Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

## 🎉 You're Done!

Your payment system is now set up! Users can subscribe to paid plans and your application will automatically handle:

- ✅ Subscription creation
- ✅ Payment processing
- ✅ Credit allocation
- ✅ Subscription updates
- ✅ Cancellations
- ✅ Failed payments

Need help? Check the Stripe Dashboard or contact Stripe Support.

## 📞 Support

If you encounter issues:

1. Check the [Troubleshooting section](#-troubleshooting)
2. View Stripe logs in the Dashboard
3. Check your server logs
4. Contact Stripe Support (they're excellent!)
5. Refer to the [Stripe Documentation](https://stripe.com/docs)

Happy billing! 💰
