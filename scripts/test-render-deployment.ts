/**
 * Test Render deployment to verify routes are registered
 *
 * Usage: npx tsx scripts/test-render-deployment.ts
 */

const RENDER_URL = 'https://ai-library-backend-3mmv.onrender.com';

async function testDeployment() {
  console.log('🧪 Testing Render Deployment\n');
  console.log(`📍 Backend URL: ${RENDER_URL}\n`);

  // Test 1: Health check
  console.log('1️⃣  Testing health endpoint...');
  try {
    const healthResponse = await fetch(`${RENDER_URL}/api/health`);
    console.log(`   Status: ${healthResponse.status} ${healthResponse.statusText}`);
    if (healthResponse.ok) {
      console.log('   ✅ Health check passed\n');
    } else {
      console.log('   ❌ Health check failed\n');
    }
  } catch (error) {
    console.error('   ❌ Health check error:', error);
    console.log('');
  }

  // Test 2: Check if user-plugins route exists (OPTIONS request)
  console.log('2️⃣  Testing if /api/user-plugins route exists...');
  try {
    const optionsResponse = await fetch(`${RENDER_URL}/api/user-plugins/stats/overview`, {
      method: 'OPTIONS',
    });
    console.log(`   Status: ${optionsResponse.status} ${optionsResponse.statusText}`);

    if (optionsResponse.status === 405) {
      console.log('   ❌ Route exists but method not allowed (this is the error you\'re seeing!)');
      console.log('   This means the old backend without user-plugins routes is still running.\n');
    } else if (optionsResponse.status === 404) {
      console.log('   ❌ Route does not exist at all\n');
    } else if (optionsResponse.status === 204 || optionsResponse.status === 200) {
      console.log('   ✅ Route exists and CORS is configured!\n');
    }
  } catch (error) {
    console.error('   ❌ Error:', error);
    console.log('');
  }

  // Test 3: Try accessing the endpoint without auth (should get 401, not 405)
  console.log('3️⃣  Testing /api/user-plugins/stats/overview without auth...');
  try {
    const statsResponse = await fetch(`${RENDER_URL}/api/user-plugins/stats/overview`);
    console.log(`   Status: ${statsResponse.status} ${statsResponse.statusText}`);

    if (statsResponse.status === 401) {
      console.log('   ✅ Route exists! (Got 401 Unauthorized, which is expected without auth)');
      console.log('   The new routes ARE deployed!\n');
    } else if (statsResponse.status === 405) {
      console.log('   ❌ Got 405 Method Not Allowed');
      console.log('   The user-plugins routes are NOT deployed yet.\n');
    } else if (statsResponse.status === 404) {
      console.log('   ❌ Got 404 Not Found');
      console.log('   The user-plugins routes are NOT deployed yet.\n');
    } else {
      console.log(`   ⚠️  Unexpected status: ${statsResponse.status}\n`);
    }
  } catch (error) {
    console.error('   ❌ Error:', error);
    console.log('');
  }

  console.log('\n📋 Summary:');
  console.log('If you see 405 errors above, the old code is still deployed.');
  console.log('If you see 401 errors, the NEW code with routes IS deployed!');
  console.log('\nNext steps if routes are missing:');
  console.log('1. Go to Render dashboard: https://dashboard.render.com');
  console.log('2. Find your backend service');
  console.log('3. Check "Events" tab to see if deployment succeeded');
  console.log('4. Check "Logs" tab during deployment for build errors');
  console.log('5. Try "Clear build cache & deploy" if needed');
}

testDeployment().catch(console.error);
