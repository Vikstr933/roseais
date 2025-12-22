#!/usr/bin/env node

/**
 * Monitor Render backend deployment by checking CORS headers
 * This script polls the backend until CORS headers are present for Vercel origin
 */

const BACKEND_URL = 'https://ai-library-backend-3mmv.onrender.com/api/health';
const VERCEL_ORIGIN = 'https://newai-sigma.vercel.app';
const POLL_INTERVAL = 10000; // 10 seconds
const MAX_ATTEMPTS = 60; // 10 minutes total

async function checkCORS(): Promise<boolean> {
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'HEAD',
      headers: {
        'Origin': VERCEL_ORIGIN
      }
    });

    const corsHeader = response.headers.get('access-control-allow-origin');
    const hasCORS = corsHeader === VERCEL_ORIGIN || corsHeader === '*';

    if (hasCORS) {
      console.log(`✅ CORS headers found! Backend is updated and ready.`);
      console.log(`   Access-Control-Allow-Origin: ${corsHeader}`);
      return true;
    } else {
      console.log(`⏳ CORS headers not found yet. Backend still deploying...`);
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Error checking backend: ${error.message}`);
    return false;
  }
}

async function monitor() {
  console.log(`🔍 Monitoring Render backend deployment...`);
  console.log(`   Backend: ${BACKEND_URL}`);
  console.log(`   Checking for CORS support for: ${VERCEL_ORIGIN}`);
  console.log(`   Poll interval: ${POLL_INTERVAL / 1000}s\n`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[Attempt ${attempt}/${MAX_ATTEMPTS}] Checking backend...`);

    const isReady = await checkCORS();

    if (isReady) {
      console.log(`\n🎉 Deployment complete! OAuth authentication should now work.`);
      console.log(`   You can now test the OAuth flow at: https://newai-sigma.vercel.app`);
      process.exit(0);
    }

    if (attempt < MAX_ATTEMPTS) {
      console.log(`   Waiting ${POLL_INTERVAL / 1000}s before next check...\n`);
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  console.log(`\n⚠️  Max attempts reached. Deployment may still be in progress.`);
  console.log(`   Check Render dashboard or try running this script again.`);
  process.exit(1);
}

monitor();
