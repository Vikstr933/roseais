/**
 * Stripe Product Setup Script
 * Automatically creates subscription products and prices in Stripe
 * Run with: npx tsx scripts/setup-stripe-products.ts
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment variables');
  console.error('Please add STRIPE_SECRET_KEY to your .env file');
  process.exit(1);
}

// Initialize Stripe
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

async function createStripeProducts() {
  console.log('🚀 Setting up Stripe subscription products...\n');

  try {
    // ========== PRO PLAN ==========
    console.log('📦 Creating Pro Plan product...');
    const proProduct = await stripe.products.create({
      name: 'Pro Plan',
      description: 'Perfect for professionals and small teams - 500 AI generations per month',
      metadata: {
        credits: '500',
        tier: 'pro',
        max_projects: 'unlimited',
        features: 'advanced_components,priority_support,private_projects,custom_domains,team_collaboration',
      },
    });

    console.log('✅ Pro product created:', proProduct.id);

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 2900, // $29.00 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        plan: 'pro',
      },
    });

    console.log('✅ Pro price created:', proPrice.id);
    console.log(`   Price: $${proPrice.unit_amount! / 100}/month\n`);

    // ========== ENTERPRISE PLAN ==========
    console.log('📦 Creating Enterprise Plan product...');
    const enterpriseProduct = await stripe.products.create({
      name: 'Enterprise Plan',
      description: 'Advanced features for large teams - 2000 AI generations per month',
      metadata: {
        credits: '2000',
        tier: 'enterprise',
        max_projects: 'unlimited',
        dedicated_support: 'true',
        sla: 'true',
        features: 'all_pro_features,dedicated_support,custom_ai_training,sla_guarantee,advanced_analytics,unlimited_team',
      },
    });

    console.log('✅ Enterprise product created:', enterpriseProduct.id);

    const enterprisePrice = await stripe.prices.create({
      product: enterpriseProduct.id,
      unit_amount: 9900, // $99.00 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        plan: 'enterprise',
      },
    });

    console.log('✅ Enterprise price created:', enterprisePrice.id);
    console.log(`   Price: $${enterprisePrice.unit_amount! / 100}/month\n`);

    // ========== OUTPUT RESULTS ==========
    console.log('🎉 All products created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ADD THESE TO YOUR .env FILE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`);
    console.log(`STRIPE_ENTERPRISE_PRICE_ID=${enterprisePrice.id}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Next steps:');
    console.log('1. Copy the price IDs above to your .env file');
    console.log('2. Add them to your Render environment variables');
    console.log('3. Restart your server to load the new values');
    console.log('\n🔗 View your products at:');
    console.log(`https://dashboard.stripe.com/products/${proProduct.id}`);
    console.log(`https://dashboard.stripe.com/products/${enterpriseProduct.id}`);

    return {
      pro: {
        productId: proProduct.id,
        priceId: proPrice.id,
      },
      enterprise: {
        productId: enterpriseProduct.id,
        priceId: enterprisePrice.id,
      },
    };
  } catch (error: any) {
    console.error('\n❌ Error creating Stripe products:', error.message);

    if (error.type === 'StripeAuthenticationError') {
      console.error('\n🔑 Authentication failed. Check your STRIPE_SECRET_KEY');
    } else if (error.code === 'resource_already_exists') {
      console.error('\n⚠️  Products may already exist. Check your Stripe dashboard.');
    }

    throw error;
  }
}

// Run the script
createStripeProducts()
  .then(() => {
    console.log('\n✅ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  });
