# PostgreSQL Migration Guide 🐘

## Why Migrate from SQLite to PostgreSQL?

**Current State (SQLite):**
- ❌ Limited concurrency (1 writer at a time)
- ❌ No Row Level Security (RLS) for multi-tenancy
- ❌ File-based (doesn't work with multiple servers)
- ❌ Maxes out at ~100-200 concurrent users
- ❌ No real-time subscriptions
- ❌ Limited for production use

**After Migration (PostgreSQL):**
- ✅ Unlimited concurrency (1000s of connections)
- ✅ Row Level Security for tenant isolation
- ✅ Network-based (works with load balancers)
- ✅ Scales to millions of users
- ✅ Real-time subscriptions (via Supabase)
- ✅ Production-ready

## Migration Options

### Option 1: Neon (Recommended - Easiest)
**Free Tier:**
- 0.5GB storage
- Always available
- Great for development/staging

**Pros:**
- ✅ Serverless (no server management)
- ✅ Auto-scaling
- ✅ Instant branching (like Git for databases)
- ✅ Free tier available
- ✅ Very fast setup (5 minutes)

**Cons:**
- ⚠️ Newer service (less proven than AWS)

**Setup:** https://neon.tech/

### Option 2: Supabase (Best for Full Stack)
**Free Tier:**
- 500MB database
- 2GB file storage
- Auth included
- Real-time included

**Pros:**
- ✅ PostgreSQL + Auth + Storage + Real-time
- ✅ Great free tier
- ✅ Built-in Row Level Security UI
- ✅ Excellent documentation

**Cons:**
- ⚠️ More features = more to learn

**Setup:** https://supabase.com/

### Option 3: AWS RDS (Enterprise)
**Cost:** ~$15-50/month minimum

**Pros:**
- ✅ Most battle-tested
- ✅ Enterprise support
- ✅ Full control

**Cons:**
- ❌ More expensive
- ❌ More complex setup
- ❌ No free tier

## Step-by-Step Migration (Using Neon)

### Step 1: Create Neon Account

1. Go to https://neon.tech/
2. Sign up (free)
3. Create a new project
4. Copy your connection string

It will look like:
```
postgresql://username:password@ep-name-123456.us-east-1.aws.neon.tech/dbname?sslmode=require
```

### Step 2: Update Environment Variables

Add to your `.env` file:
```bash
# NEW: PostgreSQL Connection
DATABASE_URL=postgresql://username:password@ep-name-123456.us-east-1.aws.neon.tech/dbname?sslmode=require

# Keep these
REDIS_URL=redis://localhost:6379
SENTRY_DSN=your_sentry_dsn
ANTHROPIC_API_KEY=your_key
```

### Step 3: Update Database Configuration

**We've already set this up for you!** The code now automatically detects whether to use PostgreSQL or SQLite based on the `DATABASE_URL`.

File: `db/index.ts`
```typescript
// Auto-detects database type
if (process.env.DATABASE_URL?.startsWith('postgresql://')) {
  // Use PostgreSQL (production)
  const client = neon(process.env.DATABASE_URL);
  db = drizzle(client, { schema });
} else {
  // Use SQLite (development)
  const sqlite = new Database('./db/db.sqlite');
  db = drizzle(sqlite, { schema });
}
```

### Step 4: Run Migrations

```bash
# Push your schema to PostgreSQL
npm run db:push

# Or run migrations
npm run db:migrate
```

### Step 5: Seed Data (Optional)

```bash
npm run db:seed
```

### Step 6: Test Connection

```bash
# Start your server
npm run dev:server

# Check logs for:
# ✅ "PostgreSQL database connected"
```

### Step 7: Verify in Production

```bash
# Make a test API call
curl http://localhost:3001/api/test/health
```

## Row Level Security (RLS)

Once you've migrated to PostgreSQL, add RLS policies for security:

### What is RLS?

Row Level Security ensures users can only see their own data, even if SQL injection occurs.

**Without RLS:**
```sql
SELECT * FROM projects; 
-- Returns ALL projects from ALL users (security risk!)
```

**With RLS:**
```sql
SELECT * FROM projects;
-- Returns only projects where user_id = current_user
```

### Adding RLS Policies

#### For Supabase (UI):
1. Go to Database → Policies
2. Click "New Policy"
3. Select table (e.g., `projects`)
4. Add policy: "Users can only see their own projects"

#### For Neon/Manual:
```sql
-- Enable RLS on tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users see only their projects
CREATE POLICY "Users see own projects"
  ON projects FOR SELECT
  USING (user_id = current_setting('app.user_id')::integer);

-- Policy: Users can insert own projects
CREATE POLICY "Users create own projects"
  ON projects FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::integer);

-- Policy: Users update own projects  
CREATE POLICY "Users update own projects"
  ON projects FOR UPDATE
  USING (user_id = current_setting('app.user_id')::integer);

-- Policy: Users delete own projects
CREATE POLICY "Users delete own projects"
  ON projects FOR DELETE
  USING (user_id = current_setting('app.user_id')::integer);
```

### Setting User Context

In your auth middleware:
```typescript
// server/middleware/auth.ts
export async function authenticateUser(req, res, next) {
  const user = await verifyToken(req.headers.authorization);
  
  // Set PostgreSQL user context for RLS
  await db.execute(
    sql`SET app.user_id = ${user.id}`
  );
  
  req.user = user;
  next();
}
```

## Connection Pooling

For production, use connection pooling to handle 1000s of connections:

### With Neon (Built-in):
Connection pooling is automatic - no setup needed!

### With Supabase:
Use the "connection pooling" URL instead of "direct connection":
```bash
# Direct connection (100 max)
DATABASE_URL=postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres

# Pooled connection (10,000 max)  
DATABASE_URL=postgresql://postgres:[password]@db.xxx.supabase.co:6543/postgres?pgbouncer=true
```

### Manual (PgBouncer):
```bash
# Install PgBouncer
sudo apt-get install pgbouncer

# Configure in /etc/pgbouncer/pgbouncer.ini
[databases]
mydb = host=localhost port=5432 dbname=mydb

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
pool_mode = transaction
max_client_conn = 10000
default_pool_size = 25
```

## Performance Optimization

### Indexes
Add indexes for frequently queried columns:

```sql
-- Index on user_id for faster filtering
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Index on created_at for sorting
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_projects_user_status ON projects(user_id, status);
```

### Query Optimization

Use `EXPLAIN ANALYZE` to check query performance:
```sql
EXPLAIN ANALYZE
SELECT * FROM projects WHERE user_id = 123;
```

### Vacuum and Analyze

Run regularly to maintain performance:
```sql
VACUUM ANALYZE projects;
VACUUM ANALYZE project_files;
```

## Backup Strategy

### Automated Backups (Neon/Supabase)
- ✅ Automatic daily backups
- ✅ Point-in-time recovery
- ✅ One-click restore

### Manual Backups
```bash
# Backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20250103.sql
```

### Backup to S3
```bash
# Backup and upload to S3
pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://my-backups/db_$(date +%Y%m%d).sql.gz
```

## Monitoring

### Key Metrics to Track

1. **Connection Count**
```sql
SELECT count(*) FROM pg_stat_activity;
```

2. **Slow Queries**
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

3. **Database Size**
```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

4. **Table Sizes**
```sql
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name)))
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;
```

### Alerts to Set Up

- Connection count > 80% of max
- Query time > 1 second
- Disk usage > 80%
- Replication lag > 1 minute

## Migration Checklist

- [ ] Create Neon/Supabase account
- [ ] Copy connection string to `.env`
- [ ] Run migrations (`npm run db:migrate`)
- [ ] Test connection
- [ ] Enable Row Level Security
- [ ] Add RLS policies
- [ ] Set up indexes
- [ ] Configure connection pooling
- [ ] Set up automated backups
- [ ] Add monitoring/alerts
- [ ] Test in staging
- [ ] Deploy to production
- [ ] Monitor for 24 hours
- [ ] Celebrate! 🎉

## Rollback Plan

If something goes wrong:

1. **Keep SQLite backup**:
```bash
cp db/db.sqlite db/db.sqlite.backup
```

2. **Switch back to SQLite**:
```bash
# Comment out DATABASE_URL in .env
# DATABASE_URL=postgresql://...
```

3. **Restart server**:
```bash
npm run dev:server
```

## Cost Estimates

### Development/Staging
- **Neon Free Tier**: $0/month
- **Supabase Free Tier**: $0/month

### Production (1,000 users)
- **Neon Scale**: $19/month
- **Supabase Pro**: $25/month
- **AWS RDS (t3.small)**: ~$30/month

### Production (10,000 users)
- **Neon Scale**: $69/month
- **Supabase Pro**: $25/month (+ usage)
- **AWS RDS (t3.medium)**: ~$60/month

### Production (100,000 users)
- **Neon Scale**: ~$200/month
- **Supabase Team**: $599/month
- **AWS RDS (r5.large)**: ~$200/month

## Common Issues

### Issue: Connection Timeout
**Solution**: Check firewall, add `?sslmode=require` to connection string

### Issue: Too Many Connections
**Solution**: Enable connection pooling or upgrade plan

### Issue: Slow Queries
**Solution**: Add indexes, use `EXPLAIN ANALYZE`, optimize queries

### Issue: RLS Not Working
**Solution**: Ensure policies are enabled and user context is set

## Next Steps After Migration

1. **Add Real-time Subscriptions** (if using Supabase)
2. **Set up Read Replicas** (for high traffic)
3. **Implement Caching** (Redis for query results)
4. **Add Full-Text Search** (PostgreSQL built-in)
5. **Set up Analytics** (pg_stat_statements)

## Summary

✅ **PostgreSQL Migration Guide - READY!**

**Impact:**
- 🚀 10-100x better performance
- 🔒 Proper security with RLS
- 📈 Scales to millions of users
- 💰 Cost-effective (free tier available)
- 🛡️ Production-ready architecture

**Time to Complete:** ~30 minutes

**Ready to migrate?** Follow the steps above! 🚀

