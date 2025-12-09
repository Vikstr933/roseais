import { db } from '../db/index.js';
import { subscriptionPlans } from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function updateTokenBasedPricing() {
  try {
    console.log('🔄 Updating subscription plans to token-based pricing...\n');

    // Update Free tier
    await db
      .update(subscriptionPlans)
      .set({
        limits: JSON.stringify({ monthly_tokens: 100000 }),
        features: JSON.stringify({
          basic_component_generation: true,
          basic_chat: true,
          standard_agents: true,
        }),
      })
      .where(eq(subscriptionPlans.tier, 'free'));

    console.log('✓ Updated Free tier: 100K tokens/month');

    // Update Pro tier
    await db
      .update(subscriptionPlans)
      .set({
        price: 20,
        limits: JSON.stringify({ monthly_tokens: 1000000 }),
        features: JSON.stringify({
          advanced_component_generation: true,
          advanced_chat: true,
          custom_templates: true,
          priority_support: true,
          custom_agents: true,
          team_collaboration: true,
        }),
      })
      .where(eq(subscriptionPlans.tier, 'pro'));

    console.log('✓ Updated Pro tier: 1M tokens/month ($20)');

    // Add Team tier
    await db.insert(subscriptionPlans).values({
      name: 'Team',
      tier: 'team',
      price: 50,
      features: JSON.stringify({
        advanced_component_generation: true,
        advanced_chat: true,
        custom_templates: true,
        priority_support: true,
        custom_agents: true,
        team_collaboration: true,
        custom_knowledge_bases: true,
        advanced_analytics: true,
        team_workspaces: true,
        custom_integrations: true,
      }),
      limits: JSON.stringify({ monthly_tokens: 3000000 }),
    });

    console.log('✓ Added Team tier: 3M tokens/month ($50)');

    // Update Enterprise tier
    await db
      .update(subscriptionPlans)
      .set({
        limits: JSON.stringify({ monthly_tokens: -1 }),
        features: JSON.stringify({
          unlimited_generation: true,
          custom_api_keys: true,
          white_label: true,
          dedicated_support: true,
          custom_deployments: true,
          advanced_security: true,
          sla_guarantee: true,
          on_premise_options: true,
        }),
      })
      .where(eq(subscriptionPlans.tier, 'enterprise'));

    console.log('✓ Updated Enterprise tier: Unlimited tokens');

    console.log('\n🎉 Token-based pricing migration completed successfully!');
    console.log('\n📊 New pricing structure:');
    console.log('   Free: 100K tokens/month');
    console.log('   Pro: 1M tokens/month ($20)');
    console.log('   Team: 3M tokens/month ($50)');
    console.log('   Enterprise: Unlimited tokens');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
updateTokenBasedPricing()
  .then(() => {
    console.log('\n✅ All done! Your system now uses token-based pricing.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
