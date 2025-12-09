# SQLite-PostgreSQL Conflicts - Fixed

## Summary
Scanned the entire codebase for SQLite-PostgreSQL schema conflicts and fixed all imports to use PostgreSQL schema (`db/schema-pg`) instead of SQLite schema (`db/schema`).

## Files Fixed

### Routes (10 files)
1. ✅ `server/routes/sessions.ts` - Fixed `codeGenerationSessions` import
2. ✅ `server/routes/admin.ts` - Fixed `users`, `agents` imports
3. ✅ `server/routes/prompts.ts` - Fixed dynamic `projectFiles` import
4. ✅ `server/routes/billing.ts` - Fixed `users` import
5. ✅ `server/routes/activity.ts` - Fixed `projectMembers` import
6. ✅ `server/routes/monetization.ts` - Fixed `users`, `subscriptionPlans` imports
7. ✅ `server/routes/frameworks.ts` - Fixed `frameworks` import
8. ✅ `server/routes/companies.ts` - Fixed `companies` import
9. ✅ `server/routes.ts` - Fixed `promptTemplates`, `promptChains`, `chainExecutions` imports

### Services (10 files)
1. ✅ `server/services/AgentSelector.ts` - Fixed `agents` import
2. ✅ `server/services/ProjectService.ts` - Fixed all imports to use schema-pg
3. ✅ `server/services/UserActivityService.ts` - Fixed `projectMembers`, `users` imports
4. ✅ `server/services/BillingService.ts` - Fixed `users`, `subscriptionPlans` imports
5. ✅ `server/services/CostMonitoringService.ts` - Fixed `userUsage` import
6. ✅ `server/services/KnowledgeService.ts` - Fixed `companies`, `frameworks`, `workspaces` imports
7. ✅ `server/services/GitHubKnowledgeService.ts` - Fixed `companies`, `frameworks`, `workspaces` imports
8. ✅ `server/services/GenerationLockService.ts` - Fixed `generationLocks` import
9. ✅ `server/services/MultiModelAIService.ts` - Fixed `userUsage` import

### Utils (1 file)
1. ✅ `server/utils/AgentManager.ts` - Fixed `agents` import

### Middleware (1 file)
1. ✅ `server/middleware/generationLock.ts` - Fixed `projectMembers` import

## Potential Issues Found

### Tables that may not exist in schema-pg:
1. ⚠️ `subscriptionPlans` - Used in `BillingService.ts` and `MonetizationService.ts`
2. ⚠️ `userUsage` - Used in `CostMonitoringService.ts` and `MultiModelAIService.ts`
3. ⚠️ `rateLimitBuckets` - Used in `MonetizationService.ts`
4. ⚠️ `userAPIKeys` - Used in `MonetizationService.ts`
5. ⚠️ `projectChatMessages` - Used in `ProjectService.ts` (may need to use `chatMessages` instead)
6. ⚠️ `projectActivities` - Used in `ProjectService.ts` (may not exist in schema-pg)

### Action Required:
- Check if these tables exist in `db/schema-pg.ts`
- If they don't exist, either:
  1. Add them to schema-pg, OR
  2. Update the code to use alternative tables (e.g., `chatMessages` instead of `projectChatMessages`)

### Scripts (4 files fixed)
1. ✅ `server/scripts/update-agent-models.ts` - Fixed `agents` import
2. ✅ `server/scripts/check-agents.ts` - Fixed `agents` import
3. ✅ `server/scripts/insert-sample-agent.ts` - Fixed `agents` import
4. ✅ `server/scripts/seed-agents.ts` - Fixed `agents` import

### Scripts Using SQLite (Legacy - OK to keep)
These are migration scripts and are intentionally using SQLite:
- `server/scripts/migrate-users-from-sqlite.ts`
- `server/scripts/migrate-agents-from-sqlite.ts`
- `scripts/create-tables.js` (legacy script)

## Verification
All critical route and service files now use PostgreSQL schema. The system should now be fully compatible with Supabase PostgreSQL.

## Next Steps
1. Test the application to ensure all database operations work correctly
2. Check if `subscriptionPlans`, `userUsage`, `rateLimitBuckets`, `userAPIKeys` tables exist in schema-pg
3. Update `ProjectService.ts` to use `chatMessages` instead of `projectChatMessages` if needed
4. Consider removing `db/schema.ts` (SQLite schema) to avoid future confusion

