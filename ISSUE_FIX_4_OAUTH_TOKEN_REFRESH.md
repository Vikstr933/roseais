# 🟡 Issue #4: OAuth Token Refresh - STATUS & IMPROVEMENTS

**Priority:** 🟡 **MEDIUM**  
**Status:** ✅ **PARTIALLY IMPLEMENTED** (Needs GitHub support)  
**Impact:** Tokens expire, causing plugin disconnections

---

## Current Status

### ✅ Already Implemented

**Gmail Plugin** (`server/plugins/GmailPlugin.ts`):
- ✅ Reactive token refresh (refreshes when token is about to expire)
- ✅ Checks expiry within 5-minute buffer
- ✅ Automatically refreshes using `refresh_token`
- ✅ Saves refreshed tokens to database
- ✅ Error handling for missing refresh tokens

**Google Calendar Plugin** (`server/plugins/GoogleCalendarPlugin.ts`):
- ✅ Same implementation as Gmail
- ✅ Reactive token refresh
- ✅ 5-minute expiry buffer
- ✅ Database persistence

### ⚠️ Missing Implementation

**GitHub Plugin** (`server/plugins/GitHubPlugin.ts`):
- ❌ No token refresh logic
- ❌ No expiry checking
- ❌ Tokens can expire without warning
- ⚠️ GitHub tokens don't expire the same way (they're long-lived), but can be revoked

---

## Analysis

### How It Currently Works

1. **Reactive Refresh (Gmail/Calendar)**:
   - When a plugin method is called, `ensureValidToken()` checks expiry
   - If token expires within 5 minutes, it refreshes automatically
   - Refresh happens synchronously before the API call
   - Works well for frequently-used plugins

2. **Limitations**:
   - Only refreshes when plugin is actively used
   - If user doesn't use plugin for days, token might expire
   - No proactive background refresh
   - GitHub plugin has no refresh mechanism

### GitHub Token Behavior

GitHub OAuth tokens are **long-lived** and don't expire automatically, BUT:
- Users can revoke them manually
- Apps can be uninstalled
- Tokens can be invalidated
- Need to handle 401 errors gracefully

---

## Recommended Improvements

### Option 1: Add GitHub Token Validation (Quick Fix) ✅ **RECOMMENDED**

Add token validation and error handling to GitHub plugin:

```typescript
// server/plugins/GitHubPlugin.ts
private async ensureValidToken(userId: string, userState: UserGitHubState): Promise<void> {
  try {
    // Test token by making a lightweight API call
    await userState.octokit.users.getAuthenticated();
  } catch (error: any) {
    if (error.status === 401) {
      logger.error('GitHub token invalid or revoked', { userId });
      throw new Error('GitHub token is invalid. Please reconnect your GitHub account.');
    }
    throw error;
  }
}
```

### Option 2: Proactive Background Refresh (Future Enhancement)

Add scheduled background job to refresh tokens before expiry:

```typescript
// server/services/TokenRefreshService.ts
class TokenRefreshService {
  async refreshExpiringTokens() {
    // Find all tokens expiring in next hour
    // Refresh them proactively
    // Update database
  }
}

// Run every hour
setInterval(() => refreshExpiringTokens(), 60 * 60 * 1000);
```

**Note:** This requires:
- Background job system (Bull, Agenda, or simple cron)
- Database query to find expiring tokens
- Error handling and retry logic

---

## Implementation Plan

### Phase 1: Add GitHub Token Validation (Quick)

1. Add `ensureValidToken()` method to GitHubPlugin
2. Call it before API operations
3. Handle 401 errors gracefully
4. Show user-friendly error messages

### Phase 2: Proactive Refresh (Optional)

1. Create `TokenRefreshService`
2. Add scheduled job (every hour)
3. Query database for expiring tokens
4. Refresh proactively
5. Log refresh attempts

---

## Current Code Status

### ✅ Gmail Plugin - Token Refresh

```typescript:203:241:server/plugins/GmailPlugin.ts
private async ensureValidToken(userId: string, userState: UserGmailState): Promise<void> {
  const { oauth2Client } = userState;
  const tokens = oauth2Client.credentials;

  // Check if token is expired or about to expire (within 5 minutes)
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes
  if (tokens.expiry_date && tokens.expiry_date < Date.now() + expiryBuffer) {
    logger.info('Token expired or expiring soon, refreshing', {
      userId,
      expiresAt: new Date(tokens.expiry_date)
    });

    if (!tokens.refresh_token) {
      logger.error('No refresh token available', { userId });
      throw new Error('Gmail token expired and no refresh token available. Please reconnect your Gmail account.');
    }

    try {
      // Refresh the token
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Update in user state
      userState.credentials.accessToken = credentials.access_token || userState.credentials.accessToken;
      userState.credentials.refreshToken = credentials.refresh_token || userState.credentials.refreshToken;
      userState.credentials.expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : userState.credentials.expiresAt;

      // Save to database
      await this.saveCredentialsToDatabase(userId, userState.credentials);

      logger.info('Token refreshed successfully', { userId, newExpiry: userState.credentials.expiresAt });
    } catch (error) {
      logger.error('Failed to refresh token', error as Error, { userId });
      throw new Error('Failed to refresh Gmail token. Please reconnect your Gmail account.');
    }
  }
}
```

### ⚠️ GitHub Plugin - Missing Token Validation

Currently, GitHub plugin doesn't validate tokens before use. Should add:

```typescript
private async ensureValidToken(userId: string, userState: UserGitHubState): Promise<void> {
  try {
    // Lightweight check - just verify token is valid
    await userState.octokit.users.getAuthenticated();
  } catch (error: any) {
    if (error.status === 401) {
      logger.error('GitHub token invalid or revoked', { userId });
      throw new Error('GitHub token is invalid. Please reconnect your GitHub account.');
    }
    // Re-throw other errors
    throw error;
  }
}
```

---

## Recommendations

### Immediate Action (Recommended)

**Add GitHub token validation** - Quick fix, improves reliability

**Benefits:**
- ✅ Catches invalid tokens early
- ✅ Better error messages
- ✅ Consistent with Gmail/Calendar pattern

**Effort:** ~30 minutes

### Future Enhancement (Optional)

**Proactive background refresh** - Nice to have, not critical

**Benefits:**
- ✅ Tokens refreshed before expiry
- ✅ Better user experience
- ✅ Fewer disconnections

**Effort:** ~2-3 hours (requires background job system)

---

## Conclusion

**Current Status:**
- ✅ Gmail/Calendar: Token refresh working (reactive)
- ⚠️ GitHub: No token validation (should add)

**Recommendation:**
- Add GitHub token validation (quick win)
- Consider proactive refresh later (optional enhancement)

**Priority:** 🟡 **MEDIUM** - Works for most cases, GitHub validation would improve reliability

---

**Status:** ✅ **MOSTLY WORKING** - Gmail/Calendar refresh implemented, GitHub needs validation

