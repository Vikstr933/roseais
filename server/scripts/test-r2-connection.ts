/**
 * Test Cloudflare R2 connection
 */
import { r2StorageService } from '../services/R2StorageService';
import * as dotenv from 'dotenv';

dotenv.config();

async function testR2() {
  console.log('🔍 Testing Cloudflare R2 connection...\n');

  if (!r2StorageService.isEnabled()) {
    console.log('❌ R2 is not configured');
    console.log('\nMissing environment variables:');
    console.log('  - R2_ACCOUNT_ID');
    console.log('  - R2_ACCESS_KEY_ID');
    console.log('  - R2_SECRET_ACCESS_KEY');
    console.log('  - R2_BUCKET_NAME\n');
    console.log('See R2_SETUP.md for setup instructions');
    return;
  }

  try {
    // Test 1: Upload a file
    console.log('1️⃣ Testing file upload...');
    const testContent = `// Test file generated at ${new Date().toISOString()}\nconsole.log('Hello from R2!');`;
    const testPath = `test/connection-test-${Date.now()}.ts`;
    
    const url = await r2StorageService.uploadFile(
      testPath,
      testContent,
      'text/typescript'
    );
    console.log('✅ Test file uploaded successfully');
    console.log(`   URL: ${url}\n`);

    // Test 2: Retrieve the file
    console.log('2️⃣ Testing file retrieval...');
    const content = await r2StorageService.getFile(testPath);
    
    if (content === testContent) {
      console.log('✅ Test file retrieved successfully');
      console.log(`   Content matches! ✓\n`);
    } else {
      console.log('⚠️  Content mismatch');
      console.log(`   Expected: ${testContent.substring(0, 50)}...`);
      console.log(`   Got: ${content.substring(0, 50)}...`);
    }

    // Test 3: Generate signed URL
    console.log('3️⃣ Testing signed URL generation...');
    const signedUrl = await r2StorageService.getSignedUrl(testPath, 3600);
    console.log('✅ Signed URL generated');
    console.log(`   URL: ${signedUrl.substring(0, 100)}...\n`);

    // Test 4: List files
    console.log('4️⃣ Testing file listing...');
    const files = await r2StorageService.listFiles('test/');
    console.log('✅ File listing successful');
    console.log(`   Found ${files.length} test files\n`);

    // Test 5: Delete test file
    console.log('5️⃣ Testing file deletion...');
    await r2StorageService.deleteFile(testPath);
    console.log('✅ Test file deleted successfully\n');

    console.log('🎉 All R2 tests passed!\n');
    console.log('Your R2 storage is ready to use for:');
    console.log('  - Project files');
    console.log('  - User avatars');
    console.log('  - Generated assets');
    console.log('  - Any other file storage needs\n');

  } catch (error: any) {
    console.error('❌ R2 test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Check your R2_ACCOUNT_ID is correct');
    console.error('  2. Verify R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY');
    console.error('  3. Ensure bucket "builder" exists in your R2 account');
    console.error('  4. Check API token has "Object Read & Write" permissions\n');
  }
}

testR2()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });

