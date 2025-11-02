/**
 * Redis Connection Test Script
 * Tests both standard Redis and Upstash REST API connections
 */

import IORedis from 'ioredis';
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';

dotenv.config();

async function testRedisConnections() {
  console.log('🔍 Testing Redis connections...\n');

  // Test 1: Standard Redis URL (if provided)
  if (process.env.REDIS_URL) {
    console.log('📡 Testing REDIS_URL connection...');
    console.log(`URL: ${process.env.REDIS_URL.replace(/:[^:@]+@/, ':****@')}\n`);

    try {
      const redis = new IORedis(process.env.REDIS_URL);

      await new Promise((resolve, reject) => {
        redis.on('connect', () => {
          console.log('✅ REDIS_URL: Connected successfully!');
          resolve(true);
        });

        redis.on('error', (err) => {
          console.error('❌ REDIS_URL: Connection failed');
          console.error(`Error: ${err.message}\n`);
          reject(err);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);
      }).catch((err) => {
        console.error(`Connection error: ${err.message}\n`);
      });

      // Test a simple operation
      try {
        await redis.set('test-key', 'test-value');
        const value = await redis.get('test-key');
        console.log(`✅ Read/Write test passed: ${value}\n`);
        await redis.del('test-key');
      } catch (err: any) {
        console.error(`❌ Read/Write test failed: ${err.message}\n`);
      }

      await redis.quit();
    } catch (error: any) {
      console.error(`❌ REDIS_URL test failed: ${error.message}\n`);
    }
  } else {
    console.log('⚠️  REDIS_URL not set in environment\n');
  }

  // Test 2: Upstash REST API
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log('📡 Testing Upstash REST API...');
    console.log(`URL: ${process.env.UPSTASH_REDIS_REST_URL}`);
    console.log(`Token: ${process.env.UPSTASH_REDIS_REST_TOKEN.substring(0, 20)}...\n`);

    try {
      const upstash = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      // Test read/write
      await upstash.set('test-key', 'test-value');
      const value = await upstash.get('test-key');

      if (value === 'test-value') {
        console.log('✅ Upstash REST API: Connected and working!');
        console.log(`✅ Read/Write test passed: ${value}\n`);
      } else {
        console.error('❌ Upstash REST API: Read/Write test failed\n');
      }

      await upstash.del('test-key');
    } catch (error: any) {
      console.error(`❌ Upstash REST API test failed: ${error.message}\n`);
    }
  } else {
    console.log('⚠️  Upstash credentials not set in environment\n');
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (process.env.REDIS_URL) {
    console.log('REDIS_URL: Check results above');
  } else {
    console.log('REDIS_URL: Not configured');
  }

  if (process.env.UPSTASH_REDIS_REST_URL) {
    console.log('Upstash REST: Check results above');
  } else {
    console.log('Upstash REST: Not configured');
  }

  console.log('\n💡 Recommendation:');
  console.log('For production rate limiting, ensure REDIS_URL works correctly.');
  console.log('Get the correct URL from: https://console.upstash.com/redis');
}

testRedisConnections()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
