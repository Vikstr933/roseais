# Cloudflare R2 Setup Guide

## Why Cloudflare R2?

R2 is perfect for file storage because:
- ✅ **Zero egress fees** - Free data transfer out
- ✅ **S3 compatible** - Use standard S3 SDKs
- ✅ **Fast global CDN** - Low latency worldwide
- ✅ **Cheap storage** - $0.015/GB/month
- ✅ **Simple setup** - No complex configuration

## Your R2 Bucket

You already have a bucket! 🎉

**Bucket URL**: `https://e56218adb4e6e94177bd34676020da0f.r2.cloudflarestorage.com/builder`

## Setup Instructions

### 1. Get Your R2 Credentials

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. Go to **R2** → **Overview**
4. Click **Manage R2 API Tokens**
5. Click **Create API Token**
6. Permissions: **Object Read & Write**
7. Copy the credentials:
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID** (from the URL: `e56218adb4e6e94177bd34676020da0f`)

### 2. Add Environment Variables

Add to your `.env` file:

```bash
# Cloudflare R2 Storage
R2_ACCOUNT_ID=e56218adb4e6e94177bd34676020da0f
R2_ACCESS_KEY_ID=your_  access_key_here
R2_SECRET_ACCESS_KEY=your_secret_key_here
R2_BUCKET_NAME=builder

# Optional: Public URL (if you enable public access)
R2_PUBLIC_URL=https://your-custom-domain.com
```

### 3. Verify Connection

Run the test script:

```bash
npx tsx server/scripts/test-r2-connection.ts
```

You should see:
```
✅ Cloudflare R2 connected
   Bucket: builder
   Endpoint: https://e56218adb4e6e94177bd34676020da0f.r2.cloudflarestorage.com
✅ Test file uploaded successfully
✅ Test file retrieved successfully
✅ Test file deleted successfully
```

### 4. How It Works

**Current (Database Storage):**
```
File → PostgreSQL JSONB column → Database size grows
```

**With R2 (Better!):**
```
File → R2 bucket → Database stores only URL
```

**Benefits:**
- 📉 Database stays small and fast
- 🚀 Faster file retrieval (CDN)
- 💰 Cheaper storage costs
- 🌍 Global distribution
- ♾️  Unlimited file sizes

## File Organization

Files will be stored in R2 with this structure:

```
builder/
├── projects/
│   ├── 1/
│   │   ├── a1b2c3d4/
│   │   │   ├── App.tsx
│   │   │   ├── index.html
│   │   │   └── package.json
│   │   └── e5f6g7h8/
│   │       └── ...
│   ├── 2/
│   └── ...
└── avatars/
    └── user123.png
```

## Usage in Code

### Upload a File

```typescript
import { r2StorageService } from './services/R2StorageService';

// Upload single file
const url = await r2StorageService.uploadFile(
  'projects/123/App.tsx',
  fileContent,
  'text/typescript'
);

// Upload multiple files
const results = await r2StorageService.uploadFiles([
  { path: 'projects/123/App.tsx', content: '...', contentType: 'text/typescript' },
  { path: 'projects/123/index.html', content: '...', contentType: 'text/html' },
]);
```

### Get a File

```typescript
const content = await r2StorageService.getFile('projects/123/App.tsx');
```

### Generate Signed URL (Temporary Access)

```typescript
// URL expires in 1 hour
const url = await r2StorageService.getSignedUrl('projects/123/App.tsx', 3600);
```

## Migration Strategy

### Phase 1: Dual Storage (Recommended)
- Continue storing files in database
- Also store in R2
- Database has backup
- Test R2 reliability

### Phase 2: R2 Primary
- Store new files in R2 only
- Database stores just URLs
- Migrate old files gradually

### Phase 3: Full Migration
- All files in R2
- Database cleanup
- Maximum performance

## Cost Estimation

**Cloudflare R2 Pricing:**
- Storage: $0.015/GB/month
- Class A Operations (write): $4.50 per million
- Class B Operations (read): $0.36 per million
- **Egress: FREE** ✨

**Example Project:**
- 100 files × 10KB = 1MB storage
- Storage cost: **$0.000015/month** (basically free!)
- 1000 reads/month: **$0.00036**
- Total: **~$0.001/month per project**

**For 1000 projects: ~$1/month**

## Public Access (Optional)

To make files publicly accessible:

1. In Cloudflare Dashboard:
   - R2 → Select bucket "builder"
   - Settings → Enable **Public Access**
   - Set custom domain (optional)

2. Files will be accessible at:
   ```
   https://builder.your-custom-domain.com/projects/123/App.tsx
   ```

## Fallback Behavior

If R2 is not configured:
- ⚠️ Falls back to **database storage**
- ⚠️ Slower performance with large files
- ⚠️ Database size grows
- ✅ Still works, just not optimized

The service automatically detects R2 availability and uses the best option!

## Security

- ✅ **Private by default** - Files not publicly accessible
- ✅ **Signed URLs** - Temporary access with expiration
- ✅ **Access control** - Only authenticated users
- ✅ **Encryption** - Data encrypted at rest

## Next Steps

1. Get R2 API credentials from Cloudflare
2. Add to `.env` file
3. Restart server
4. Files will automatically use R2!
5. Monitor usage in Cloudflare dashboard

Your file storage will be **production-ready** and **cost-effective**! 🚀

