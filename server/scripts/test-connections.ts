/**
 * Test script to verify Redis and Supabase connections
 */
import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';

dotenv.config();

async function testConnections() {
  console.log('🔍 Testing service connections...\n');

  // Test Upstash Redis
  console.log('1️⃣ Testing Upstash Redis...');
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });

      // Test basic operations
      const testKey = 'test:connection:' + Date.now();
      await redis.set(testKey, 'Hello from your app!');
      const value = await redis.get(testKey);
      await redis.del(testKey);

      if (value === 'Hello from your app!') {
        console.log('✅ Upstash Redis: Connected successfully!');
        console.log(`   URL: ${process.env.UPSTASH_REDIS_REST_URL}`);
      } else {
        console.log('⚠️  Upstash Redis: Connection works but data mismatch');
      }
    } catch (error: any) {
      console.log('❌ Upstash Redis: Connection failed');
      console.log(`   Error: ${error.message}`);
    }
  } else {
    console.log('⚠️  Upstash Redis: Not configured (missing env vars)');
  }

  console.log();

  // Test Supabase
  console.log('2️⃣ Testing Supabase...');
  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
    try {
      // Simple fetch test to verify Supabase is accessible
      const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': process.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      if (response.ok || response.status === 404) {
        // 404 is expected if no tables exist yet
        console.log('✅ Supabase: Connected successfully!');
        console.log(`   URL: ${process.env.VITE_SUPABASE_URL}`);
        console.log(`   Status: ${response.status} (${response.statusText})`);
      } else {
        console.log('⚠️  Supabase: Connection works but unexpected status');
        console.log(`   Status: ${response.status} (${response.statusText})`);
      }
    } catch (error: any) {
      console.log('❌ Supabase: Connection failed');
      console.log(`   Error: ${error.message}`);
    }
  } else {
    console.log('⚠️  Supabase: Not configured (missing env vars)');
  }

  console.log();

  // Test PostgreSQL (your main database)
  console.log('3️⃣ Testing PostgreSQL Database...');
  if (process.env.DATABASE_URL) {
    try {
      const { db } = await import('../../db');
      const { sql } = await import('drizzle-orm');
      
      const result = await db.execute(sql`SELECT 1 as test`);
      console.log('✅ PostgreSQL: Connected successfully!');
      console.log(`   Connection: ${process.env.DATABASE_URL.includes('supabase') ? 'Supabase PostgreSQL' : 'Local PostgreSQL'}`);
    } catch (error: any) {
      console.log('❌ PostgreSQL: Connection failed');
      console.log(`   Error: ${error.message}`);
    }
  } else {
    console.log('⚠️  PostgreSQL: Not configured (missing DATABASE_URL)');
  }

  console.log();
  console.log('🎉 Connection test complete!\n');
  console.log('Next steps:');
  console.log('1. For OAuth: Configure Google/GitHub OAuth in Supabase dashboard');
  console.log('2. For rate limiting: Redis is ready, limits will apply automatically');
  console.log('3. Restart your dev server to apply changes: npm run dev\n');
}

testConnections()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });

