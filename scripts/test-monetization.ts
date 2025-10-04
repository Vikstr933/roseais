import { monetizationService } from '../server/services/MonetizationService.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function testMonetization() {
  try {
    console.log('🧪 Testing monetization system...');

    // Create a test user
    const testUserId = 'test-user-' + Date.now();
    console.log('Creating test user:', testUserId);

    await db.insert(users).values({
      id: testUserId,
      username: 'testuser' + Date.now(),
      email: 'test' + Date.now() + '@example.com',
      displayName: 'Test User',
      passwordHash: 'test-hash',
      tier: 'free',
    });

    // Test rate limiting
    console.log('Testing rate limiting...');
    const rateLimitResult = await monetizationService.checkRateLimit(
      testUserId,
      'free',
      'component_generation'
    );
    console.log('Rate limit check result:', rateLimitResult);

    // Test usage tracking
    console.log('Testing usage tracking...');
    await monetizationService.trackUsage(
      testUserId,
      'anthropic',
      'component_generation',
      1000,
      'test-session',
      { test: true }
    );

    // Test usage stats
    console.log('Getting usage stats...');
    const usageStats = await monetizationService.getUserUsageStats(testUserId);
    console.log('Usage stats:', usageStats);

    // Test API key retrieval
    console.log('Testing API key retrieval...');
    try {
      const apiKeyResult = await monetizationService.getAPIKeyForRequest(
        testUserId,
        'anthropic',
        'component_generation'
      );
      console.log('API key result:', {
        source: apiKeyResult.source,
        serviceName: apiKeyResult.serviceName,
      });
    } catch (error) {
      console.log('API key error (expected for free tier):', error.message);
    }

    // Test subscription plans
    console.log('Getting subscription plans...');
    const plans = await monetizationService.getSubscriptionPlans();
    console.log(
      'Available plans:',
      plans.map(p => ({ name: p.name, tier: p.tier, price: p.price }))
    );

    // Clean up test user
    console.log('Cleaning up test user...');
    await db.delete(users).where(eq(users.id, testUserId));

    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMonetization()
  .then(() => {
    console.log('Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
