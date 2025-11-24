# 🟡 Issue #3: Stripe Configuration - SETUP GUIDE

**Priority:** 🟡 **MEDIUM**  
**Status:** ⚠️ **Needs Configuration**  
**Impact:** Billing/subscription features won't work without Stripe setup

---

## Problem

Stripe is not configured, which means:
- ❌ Users cannot subscribe to Pro/Enterprise plans
- ❌ Payment processing won't work
- ❌ Subscription management unavailable
- ⚠️ Pricing page will show errors when users try to subscribe

**Required Configuration:**
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_PRO_PRICE_ID` - Pro plan price ID
- `STRIPE_ENTERPRISE_PRICE_ID` - Enterprise plan price ID
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (for production)

---

## Solution

### Option 1: Quick Setup (Using Setup Script) ⚡ **RECOMMENDED**

We have an automated script that creates the products and prices for you!

#### Step 1: Get Stripe API Key

1. Go to https://dashboard.stripe.com/
2. Click **"Developers"** → **"API keys"**
3. Copy your **Secret key** (starts with `sk_test_...` for test mode)
4. Add to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
   ```

#### Step 2: Run Setup Script

```powershell
# Set PATH (if needed)
$env:Path = "C:\Program Files\nodejs;" + $env:Path

# Run the setup script
npm run setup:stripe
```

**What it does:**
- ✅ Creates Pro Plan product ($29/month)
- ✅ Creates Enterprise Plan product ($99/month)
- ✅ Creates prices for both plans
- ✅ Outputs the Price IDs you need

#### Step 3: Add Price IDs to .env

After running the script, you'll see output like:
```
✅ Pro price created: price_1234567890abcdef
✅ Enterprise price created: price_0987654321fedcba
```

Add these to your `.env`:
```env
STRIPE_PRO_PRICE_ID=price_1234567890abcdef
STRIPE_ENTERPRISE_PRICE_ID=price_0987654321fedcba
```

---

### Option 2: Manual Setup (Via Stripe Dashboard)

#### Step 1: Get Stripe API Keys

1. Go to https://dashboard.stripe.com/
2. Click **"Developers"** → **"API keys"**
3. Copy your **Secret key** (starts with `sk_test_...`)
4. Add to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
   ```

#### Step 2: Create Products in Stripe Dashboard

1. Go to https://dashboard.stripe.com/products
2. Click **"Add product"**

**Create Pro Plan:**
- **Name:** Pro Plan
- **Description:** 500 AI generations per month with advanced features
- **Pricing:** Standard pricing
- **Price:** $29.00 USD
- **Billing period:** Monthly
- Click **"Save product"**
- **Copy the Price ID** (starts with `price_...`)

**Create Enterprise Plan:**
- **Name:** Enterprise Plan
- **Description:** 2000 AI generations per month with all features
- **Price:** $99.00 USD
- **Billing period:** Monthly
- Click **"Save product"**
- **Copy the Price ID**

#### Step 3: Add Price IDs to .env

```env
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_PRO_PRICE_ID=price_YOUR_PRO_PRICE_ID
STRIPE_ENTERPRISE_PRICE_ID=price_YOUR_ENTERPRISE_PRICE_ID
```

---

## Complete .env Configuration

Add these lines to your `.env` file:

```env
# ============================================================================
# Stripe Payment Processing
# ============================================================================
# Get from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE

# Price IDs (created via setup script or manually)
# Get from: https://dashboard.stripe.com/products
STRIPE_PRO_PRICE_ID=price_YOUR_PRO_PRICE_ID
STRIPE_ENTERPRISE_PRICE_ID=price_YOUR_ENTERPRISE_PRICE_ID

# Webhook Secret (for production - optional for development)
# Get from: https://dashboard.stripe.com/webhooks
# STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

---

## Testing

After configuration:

1. **Restart your dev server:**
   ```powershell
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Test Pricing Page:**
   - Navigate to `/pricing`
   - Click "Subscribe" on Pro or Enterprise plan
   - Should redirect to Stripe checkout

3. **Test Checkout:**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Should complete checkout successfully

---

## Webhook Setup (For Production)

For production, you'll need to set up webhooks:

1. Go to https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. Enter URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** and add to `.env` as `STRIPE_WEBHOOK_SECRET`

---

## Verification Checklist

- [ ] Stripe account created
- [ ] `STRIPE_SECRET_KEY` added to `.env`
- [ ] Products created (Pro + Enterprise)
- [ ] `STRIPE_PRO_PRICE_ID` added to `.env`
- [ ] `STRIPE_ENTERPRISE_PRICE_ID` added to `.env`
- [ ] Dev server restarted
- [ ] Pricing page tested
- [ ] Checkout flow tested

---

## Troubleshooting

### "Stripe is not configured" error

**Solution:** Make sure `STRIPE_SECRET_KEY` is set in `.env` and server is restarted

### "Price ID not found" error

**Solution:** 
- Verify Price IDs are correct in `.env`
- Check they start with `price_`
- Ensure products exist in Stripe dashboard

### Checkout redirects to error page

**Solution:**
- Verify `FRONTEND_URL` is set in `.env`
- Check Stripe API key is valid
- Ensure Price IDs match your Stripe account

---

## Next Steps

After Stripe is configured:
1. ✅ Test subscription flow
2. ✅ Move to Issue #4 (OAuth Token Refresh)
3. ✅ Continue with other issues

---

**Status:** Ready to configure  
**Estimated Time:** 5-10 minutes  
**Difficulty:** Easy (script) or Medium (manual)

