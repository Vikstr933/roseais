/**
 * List all R2 buckets in your account
 */
import { S3Client, ListBucketsCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config();

async function listBuckets() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('❌ Missing R2 credentials in environment');
    process.exit(1);
  }

  const endpoint = `https://${accountId}.eu.r2.cloudflarestorage.com`;
  
  const s3Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log('🔍 Listing R2 buckets...\n');

  try {
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);

    if (response.Buckets && response.Buckets.length > 0) {
      console.log('📦 Available buckets:');
      response.Buckets.forEach((bucket, index) => {
        console.log(`   ${index + 1}. ${bucket.Name}`);
        console.log(`      Created: ${bucket.CreationDate}`);
      });
      console.log();
    } else {
      console.log('⚠️  No buckets found in your R2 account');
      console.log('\n📝 Creating "builder" bucket...');
      
      try {
        const createCommand = new CreateBucketCommand({
          Bucket: 'builder',
        });
        await s3Client.send(createCommand);
        console.log('✅ Bucket "builder" created successfully!\n');
      } catch (createError: any) {
        console.error('❌ Failed to create bucket:', createError.message);
        console.log('\nPlease create it manually:');
        console.log('1. Go to Cloudflare Dashboard → R2');
        console.log('2. Click "Create bucket"');
        console.log('3. Name it "builder"');
        console.log('4. Location: European Union (EU)');
      }
    }
  } catch (error: any) {
    console.error('❌ Failed to list buckets:', error.message);
    console.log('\nTroubleshooting:');
    console.log('  1. Verify R2_ACCOUNT_ID is correct');
    console.log('  2. Check API token permissions');
    console.log('  3. Ensure credentials are valid');
  }
}

listBuckets()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

