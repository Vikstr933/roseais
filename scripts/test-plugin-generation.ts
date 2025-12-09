/**
 * Test script for plugin generation endpoint
 *
 * Usage: npx tsx scripts/test-plugin-generation.ts
 */

async function testPluginGeneration() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const SESSION_TOKEN = process.env.SESSION_TOKEN || '';

  if (!SESSION_TOKEN) {
    console.error('❌ SESSION_TOKEN environment variable is required');
    console.log('💡 Get your session token from browser localStorage and run:');
    console.log('   SESSION_TOKEN=your_token npx tsx scripts/test-plugin-generation.ts');
    process.exit(1);
  }

  console.log('🧪 Testing Plugin Generation Endpoint\n');
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`🔑 Using session token: ${SESSION_TOKEN.substring(0, 20)}...`);
  console.log('');

  try {
    // Test 1: Check stats endpoint
    console.log('1️⃣  Testing GET /api/user-plugins/stats/overview...');
    const statsResponse = await fetch(`${API_URL}/api/user-plugins/stats/overview`, {
      headers: {
        'Authorization': `Bearer ${SESSION_TOKEN}`,
      },
    });

    if (!statsResponse.ok) {
      console.error(`❌ Stats endpoint failed: ${statsResponse.status} ${statsResponse.statusText}`);
      const text = await statsResponse.text();
      console.error('Response:', text);
    } else {
      const stats = await statsResponse.json();
      console.log('✅ Stats endpoint working!');
      console.log('   Stats:', JSON.stringify(stats, null, 2));
    }
    console.log('');

    // Test 2: Generate a simple plugin
    console.log('2️⃣  Testing POST /api/user-plugins/generate...');
    const generateResponse = await fetch(`${API_URL}/api/user-plugins/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION_TOKEN}`,
      },
      body: JSON.stringify({
        prompt: 'Create a simple Discord plugin that can read and send messages in a channel',
        serviceName: 'discord',
        estimatedComplexity: 'simple',
      }),
    });

    console.log(`   Response Status: ${generateResponse.status} ${generateResponse.statusText}`);

    if (!generateResponse.ok) {
      const text = await generateResponse.text();
      console.error('❌ Generation endpoint failed');
      console.error('Response:', text);
    } else {
      const result = await generateResponse.json();
      console.log('✅ Generation endpoint working!');
      console.log('   Result:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(error);
  }
}

testPluginGeneration();
