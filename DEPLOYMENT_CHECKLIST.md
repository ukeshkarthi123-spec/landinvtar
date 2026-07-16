# Profile Fetch Fix - Deployment & Verification Commands

## 🚀 Step-by-Step Deployment

### Step 1: Deploy SQL Migration
**Location:** Supabase Dashboard → SQL Editor

```sql
-- Copy the entire contents of:
-- supabase/migrations/20260710_setup_profiles_rls.sql
-- 
-- Paste into SQL Editor and execute
```

**Verify execution:**
```sql
-- Run these queries to confirm:

-- Check table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'profiles';
-- Expected: profiles

-- Check RLS enabled
SELECT relname, relrowsecurity FROM pg_class 
WHERE relname = 'profiles';
-- Expected: relrowsecurity = true

-- Check policies created
SELECT policyname FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
-- Expected: 5 policies listed
```

### Step 2: Deploy Code Changes
```bash
# 1. Commit AppContext.tsx changes
git add context/AppContext.tsx
git commit -m "fix: improve profile fetch with timeout, retry, and auto-create logic"

# 2. Add new testing utilities
git add lib/profile-fetch-testing.ts
git add components/ProfileDiagnosticPanel.tsx
git commit -m "feat: add profile fetch diagnostic utilities"

# 3. Add migration and documentation
git add supabase/migrations/20260710_setup_profiles_rls.sql
git add PROFILE_FETCH_FIX.md PROFILE_FETCH_QUICK_REFERENCE.md IMPLEMENTATION_SUMMARY.md
git commit -m "docs: add profile fetch fix documentation"

# 4. Push to repository
git push origin main
```

### Step 3: Deploy to App
```bash
# If using Expo
npm run build

# Or for direct deployment
eas build --platform ios
eas build --platform android

# Or for web
npm run build:web
```

---

## ✅ Testing & Verification

### Test 1: Automatic Verification
```typescript
// In app console or browser developer tools:
import { runFullDiagnostic } from '@/lib/profile-fetch-testing';

const results = await runFullDiagnostic();
console.log(results);

// Expected output:
// {
//   timestamp: "2026-07-10T...",
//   supabase: { connected: true, responseTime: xxx },
//   auth: { authenticated: true, email: "user@example.com" },
//   profilesTable: { accessible: true, rowCount: N },
//   rlsRead: { canRead: true, profileExists: true },
//   rlsInsert: { canInsert: true },
//   overallStatus: "PASS",
//   summary: "✅ All tests passed! Profile fetch should work."
// }
```

### Test 2: Manual Verification
```bash
# Run expo dev server
npx expo start

# In app console, run each test:
```

```typescript
// Test 1: Check Supabase connection
import { testSupabaseConnection } from '@/lib/profile-fetch-testing';
const connTest = await testSupabaseConnection();
console.log('Connection:', connTest);
// Expected: { connected: true, responseTime: <number> }

// Test 2: Check authentication
import { testAuthentication } from '@/lib/profile-fetch-testing';
const authTest = await testAuthentication();
console.log('Auth:', authTest);
// Expected: { authenticated: true, email: "..." }

// Test 3: Check profiles table access
import { testProfilesTableAccess } from '@/lib/profile-fetch-testing';
const tableTest = await testProfilesTableAccess();
console.log('Table:', tableTest);
// Expected: { accessible: true, rowCount: <number> }

// Test 4: Check RLS read permissions
import { testRLSReadPolicy } from '@/lib/profile-fetch-testing';
const readTest = await testRLSReadPolicy(authTest.userId);
console.log('RLS Read:', readTest);
// Expected: { canRead: true, profileExists: true }

// Test 5: Check RLS insert permissions
import { testRLSInsertPolicy } from '@/lib/profile-fetch-testing';
const insertTest = await testRLSInsertPolicy(authTest.userId, authTest.email);
console.log('RLS Insert:', insertTest);
// Expected: { canInsert: true }
```

### Test 3: Real User Testing
```
1. New User Test:
   - Create new Supabase auth user
   - Login with that account
   - Expected: Profile auto-created, dashboard loads
   - Check: No errors in console, profile shows in Supabase

2. Existing User Test:
   - Login with existing account
   - Expected: Profile loads in 1-3 seconds
   - Check: Profile data displays correctly

3. Slow Network Test:
   - Open DevTools → Network
   - Throttle to "Slow 3G"
   - Logout and login
   - Expected: Takes 5-10 seconds but succeeds
   - Check: No timeout errors, data eventually loads

4. Offline Test:
   - Turn off internet
   - Try to login/refresh
   - Expected: "Unable to connect" message
   - Turn internet back on, retry
   - Expected: Works after retry
```

---

## 🐛 Troubleshooting Commands

### If Tests Fail - Check RLS Policies

```sql
-- List all policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Should see:
-- Users can insert their own profile
-- Users can update their own profile
-- Users can view their own profile
-- (and optional others)
```

### If Table Access Fails

```sql
-- Verify table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Should have all required columns:
-- id, name, email, phone, avatar, kyc_status, 
-- wallet_balance, is_admin, created_at, updated_at
```

### If Permission Errors Occur

```sql
-- Check RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'profiles';
-- Expected: relrowsecurity = true

-- Verify insert policy specifically
SELECT * FROM pg_policies
WHERE tablename = 'profiles'
AND policyname = 'Users can insert their own profile';

-- Check the policy condition (qual)
-- Should allow INSERT when auth.uid() = id
```

### If Profile Not Auto-Creating

```sql
-- Test insert manually (as authenticated user)
INSERT INTO profiles (id, email, name, kyc_status, wallet_balance)
VALUES (
  auth.uid(),
  'test@example.com',
  'Test User',
  'Not Started',
  0
);

-- If error: check RLS policy
-- If success: app should also work
```

---

## 📊 Monitoring After Deployment

### Check Logs for Errors
```
Search console for:
[Profile] - Profile fetch related operations
[App] - App initialization
Error - Any errors that occurred

Expected logs:
✅ [Profile] Fetching profile for user xxx
✅ [Profile] Response received in XXXms
✅ [Profile] Successfully fetched profile
✅ No Error logs

Problems:
❌ [Profile] Error fetching profile...
❌ Error: Permission denied
❌ Error: Profile fetch timeout
```

### Monitor Performance
```typescript
// Check response times
// Good: < 2 seconds
// Acceptable: < 5 seconds
// Poor: > 5 seconds
// Should retry and recover: if > 15 seconds

// Look for in logs:
// [Profile] Response received in 234ms (GOOD)
// [Profile] Response received in 8456ms (OK, slow)
// [Profile] Response received in 15000ms (TIMEOUT, will retry)
```

---

## 🚨 Rollback Procedure

If issues occur after deployment:

```bash
# 1. Revert code changes
git revert <commit-hash>
git push origin main

# 2. Rebuild and redeploy
npm run build
# or
eas build --platform ios

# 3. Keep SQL migration (safe to keep)
# - The profiles table and RLS setup is backward compatible
# - No data will be lost
```

---

## ✨ Post-Deployment Checklist

- [ ] SQL migration executed successfully
- [ ] `runFullDiagnostic()` shows all PASS
- [ ] New users can signup and profile auto-creates
- [ ] Existing users can login and profile loads
- [ ] No timeout errors in console
- [ ] Profile data displays correctly on dashboard
- [ ] Slow network test shows retry behavior
- [ ] Offline test shows friendly error message
- [ ] App never gets stuck in loading state
- [ ] Remove ProfileDiagnosticPanel from production code (optional - can leave if hidden)

---

## 📋 Quick Command Reference

```bash
# Build and deploy
npm run build
git push origin main

# Run diagnostic
# (In app console:)
await runFullDiagnostic()

# Deploy to specific platform
eas build --platform ios
eas build --platform android

# Check Git status
git status

# Revert if needed
git revert <commit-hash>
```

---

## 🎯 Success Criteria

✅ **Deployment is successful if:**

1. All SQL migration queries execute without errors
2. `runFullDiagnostic()` returns PASS for all tests
3. New users auto-create profiles on signup
4. Existing users' profiles load in < 3 seconds
5. No "timeout" errors in console
6. Slow network retries and succeeds
7. Offline handling shows user-friendly message
8. App never gets stuck on loading screen

---

## 📞 Need Help?

If issues after deployment:

1. Run `await runFullDiagnostic()` - shows exact problem
2. Check console for `[Profile]` and `[App]` logs
3. Verify SQL migration in Supabase dashboard
4. Check RLS policies exist and are correct
5. Try on different network (WiFi vs cellular)
6. Check internet connection status

---

**Version:** 1.0  
**Updated:** 2026-07-10  
**Status:** Ready for deployment ✅
