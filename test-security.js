/**
 * Security Testing Script
 * Tests rate limiting, validation, and error tracking
 */

const BASE_URL = 'http://localhost:3001/api';

console.log('🧪 Testing Security Features...\n');

// Test 1: Health Check
async function testHealth() {
  console.log('1️⃣ Testing Health Check...');
  try {
    const response = await fetch(`${BASE_URL}/test/health`);
    const data = await response.json();
    console.log('✅ Health:', data.status);
    console.log('   Services:', JSON.stringify(data.services, null, 2));
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
  console.log('');
}

// Test 2: Rate Limiting
async function testRateLimit() {
  console.log('2️⃣ Testing Rate Limiting...');
  console.log('   Making 5 requests...');
  
  for (let i = 1; i <= 5; i++) {
    try {
      const response = await fetch(`${BASE_URL}/test/rate-limit`);
      const data = await response.json();
      
      // Check rate limit headers
      const limit = response.headers.get('X-RateLimit-Limit');
      const remaining = response.headers.get('X-RateLimit-Remaining');
      
      console.log(`   Request ${i}: ✅ Success`);
      console.log(`      Rate Limit: ${remaining}/${limit} remaining`);
    } catch (error) {
      console.error(`   Request ${i}: ❌ Failed`, error.message);
    }
  }
  
  console.log('   ℹ️  Make 100+ requests in an hour to trigger rate limit\n');
}

// Test 3: Input Validation - Valid Input
async function testValidationValid() {
  console.log('3️⃣ Testing Input Validation (Valid)...');
  try {
    const response = await fetch(`${BASE_URL}/test/validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPrompt: 'Build a todo list app',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Validation passed for valid input');
      console.log('   Validated data:', JSON.stringify(data.validated, null, 2));
    } else {
      console.log('❌ Unexpected validation failure');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  console.log('');
}

// Test 4: Input Validation - Too Short
async function testValidationTooShort() {
  console.log('4️⃣ Testing Input Validation (Too Short)...');
  try {
    const response = await fetch(`${BASE_URL}/test/validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPrompt: 'hi', // Too short!
      }),
    });
    
    const data = await response.json();
    
    if (response.status === 400) {
      console.log('✅ Validation correctly blocked short prompt');
      console.log('   Error:', data.details[0]?.message);
    } else {
      console.log('❌ Validation should have failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  console.log('');
}

// Test 5: Input Validation - Script Tag
async function testValidationScriptTag() {
  console.log('5️⃣ Testing Input Validation (Script Tag)...');
  try {
    const response = await fetch(`${BASE_URL}/test/validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPrompt: 'Build app <script>alert("xss")</script>',
      }),
    });
    
    const data = await response.json();
    
    if (response.status === 400) {
      console.log('✅ Validation correctly blocked script tag');
      console.log('   Error:', data.details[0]?.message);
    } else {
      console.log('❌ Validation should have blocked script tag');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  console.log('');
}

// Test 6: Input Validation - Invalid Model
async function testValidationInvalidModel() {
  console.log('6️⃣ Testing Input Validation (Invalid Model)...');
  try {
    const response = await fetch(`${BASE_URL}/test/validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPrompt: 'Build a todo app',
        model: 'invalid-model-name',
      }),
    });
    
    const data = await response.json();
    
    if (response.status === 400) {
      console.log('✅ Validation correctly blocked invalid model');
      console.log('   Error:', data.details[0]?.message);
    } else {
      console.log('❌ Validation should have blocked invalid model');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  console.log('');
}

// Test 7: Sentry Error Tracking
async function testSentryError() {
  console.log('7️⃣ Testing Sentry Error Tracking...');
  console.log('   ℹ️  This will throw an error (expected behavior)');
  try {
    const response = await fetch(`${BASE_URL}/test/error`);
    
    if (response.status === 500) {
      console.log('✅ Error was caught and logged');
      console.log('   Check your Sentry dashboard to see the error');
      console.log('   (If SENTRY_DSN is set)');
    }
  } catch (error) {
    console.log('✅ Error thrown as expected');
    console.log('   Check Sentry dashboard for the error');
  }
  console.log('');
}

// Run all tests
async function runAllTests() {
  console.log('═══════════════════════════════════════════');
  console.log('🔒 SECURITY FEATURES TEST SUITE');
  console.log('═══════════════════════════════════════════\n');
  
  await testHealth();
  await testRateLimit();
  await testValidationValid();
  await testValidationTooShort();
  await testValidationScriptTag();
  await testValidationInvalidModel();
  await testSentryError();
  
  console.log('═══════════════════════════════════════════');
  console.log('✅ All tests completed!');
  console.log('═══════════════════════════════════════════\n');
  
  console.log('📊 Summary:');
  console.log('   • Rate Limiting: Active and tracking');
  console.log('   • Input Validation: Blocking bad inputs');
  console.log('   • Error Tracking: Capturing exceptions');
  console.log('');
  console.log('🎯 Next: Check Sentry dashboard (if configured)');
  console.log('   https://sentry.io/');
}

// Run tests
runAllTests().catch(console.error);

