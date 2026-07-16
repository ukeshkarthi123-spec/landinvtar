# Profile Fetch Architecture & Data Flow

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Native App (Expo)                     │
│                                                                   │
│  ┌──────────────────┐                                            │
│  │   App Provider   │                                            │
│  │  (AppContext)    │                                            │
│  └────────┬─────────┘                                            │
│           │                                                      │
│  ┌────────▼──────────────────────────────────────────────┐      │
│  │           Profile Fetch & Session Management           │      │
│  │                                                        │      │
│  │  • fetchProfile(userId, retryAttempt)                │      │
│  │    - 15s timeout                                      │      │
│  │    - 3 automatic retries                              │      │
│  │    - Exponential backoff (1s, 2s, 4s)                │      │
│  │    - Request cancellation (AbortController)           │      │
│  │    - Detailed logging & timing                        │      │
│  │                                                        │      │
│  │  • autoCreateProfile(userId, email)                  │      │
│  │    - Auto-create on missing                           │      │
│  │    - Same timeout & error handling                    │      │
│  │                                                        │      │
│  │  • refreshProfile()                                   │      │
│  │    - Calls fetchProfile + autoCreateProfile           │      │
│  │                                                        │      │
│  └────────┬───────────────────────────────────────────────┘      │
│           │                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            │ (via Supabase Client)
            │
┌───────────▼──────────────────────────────────────────────────────┐
│                      Supabase Backend                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐        │
│  │                   PostgreSQL Database                 │        │
│  │                                                       │        │
│  │  profiles table:                                      │        │
│  │  ┌─────────────────────────────────────────────────┐ │        │
│  │  │ id (PK, FK to auth.users)                      │ │        │
│  │  │ name                                             │ │        │
│  │  │ email                                            │ │        │
│  │  │ phone                                            │ │        │
│  │  │ avatar                                           │ │        │
│  │  │ kyc_status                                       │ │        │
│  │  │ wallet_balance                                   │ │        │
│  │  │ is_admin                                         │ │        │
│  │  │ created_at (indexed)                             │ │        │
│  │  │ updated_at (auto-updated)                        │ │        │
│  │  └─────────────────────────────────────────────────┘ │        │
│  │                                                       │        │
│  │  Row Level Security (RLS) Policies:                  │        │
│  │  ✓ Users can view their own profile                  │        │
│  │  ✓ Users can insert their own profile                │        │
│  │  ✓ Users can update their own profile                │        │
│  │  ✓ Admins can update any profile                     │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Profile Fetch Flow Diagram

### Happy Path (Success in 1st Attempt)

```
User Login
    │
    ▼
Auth Success
    │
    ▼
fetchProfile(userId)
    │
    ├─ Check: User ID exists? ✓
    ├─ Start timer
    ├─ Query: SELECT required_fields FROM profiles WHERE id = userId
    │
    ▼
Supabase Query (< 2s)
    │
    ▼
Response with data
    │
    ├─ Parse: { id, name, email, ... }
    ├─ setProfile(data)
    ├─ Log: "[Profile] Successfully fetched profile"
    │
    ▼
✅ SUCCESS - Profile loaded, app continues
```

### Retry Path (Fails, Then Recovers)

```
fetchProfile(userId) - Attempt 1
    │
    ├─ Query timeout or error
    ├─ Log: "[Profile] Error fetching profile (attempt 1/3): ..."
    │
    ▼
Wait 1000ms (exponential backoff)
    │
    ▼
fetchProfile(userId) - Attempt 2 (retry call)
    │
    ├─ Query timeout or error again
    ├─ Log: "[Profile] Retrying in 2000ms..."
    │
    ▼
Wait 2000ms
    │
    ▼
fetchProfile(userId) - Attempt 3
    │
    ├─ Query succeeds ✓
    ├─ setProfile(data)
    │
    ▼
✅ SUCCESS - Recovered after retries
```

### Auto-Create Path (New User)

```
fetchProfile(userId) - New user has no profile
    │
    ├─ Query returns: null (profile doesn't exist)
    ├─ Return: null (signal to auto-create)
    │
    ▼
refreshProfile() detects null
    │
    ▼
autoCreateProfile(userId, email)
    │
    ├─ Create new Profile object:
    │  {
    │    id: userId,
    │    name: email.split('@')[0],
    │    email: email,
    │    kyc_status: 'Not Started',
    │    wallet_balance: 0,
    │    is_admin: false,
    │    created_at: now(),
    │    updated_at: now()
    │  }
    │
    ├─ INSERT into profiles (with RLS INSERT policy check)
    ├─ setProfile(newProfile)
    ├─ Log: "[Profile] Profile auto-created successfully"
    │
    ▼
✅ SUCCESS - New profile created automatically
```

### Failure Path (Network Unavailable)

```
fetchProfile(userId) - Attempt 1
    │
    └─ Network error / Connection timeout
       
Wait 1000ms
    │
fetchProfile(userId) - Attempt 2
    │
    └─ Network still unavailable / Supabase down
       
Wait 2000ms
    │
fetchProfile(userId) - Attempt 3
    │
    └─ Network still unavailable
       
All retries exhausted
    │
    ▼
Throw error: "Supabase is temporarily unavailable..."
    │
    ▼
Show user-friendly error message
    │
    ▼
⚠️  GRACEFUL FAILURE - App continues, user can retry
```

---

## 📡 Request Timing & Timeouts

### Normal Network Conditions

```
Time: 0ms         - fetchProfile called
Time: 100-200ms   - Query reaches Supabase
Time: 200-500ms   - Database processes query
Time: 500-800ms   - Response sent back
Time: 800-1000ms  - Data parsed and set in state
Time: 1000-2000ms - UI updates with profile data

Total: ~1-2 seconds ✅ (within timeout)
```

### Slow Network (3G)

```
Time: 0ms          - fetchProfile called
Time: 2000-3000ms  - Query reaches Supabase (delayed)
Time: 3000-5000ms  - Database processes
Time: 5000-8000ms  - Response sent (delayed)
Time: 8000-9000ms  - Data parsed
Time: 9000-10000ms - UI updates

Total: ~8-10 seconds ✅ (within 15s timeout)
```

### Timeout & Retry Scenario

```
Time: 0ms         - fetchProfile attempt 1 start
Time: 15000ms     - TIMEOUT! (15 second limit reached)
Time: 15000ms     - Log error, queue retry
Time: 16000ms     - Wait 1 second delay
Time: 17000ms     - fetchProfile attempt 2 start
Time: 17500ms     - Connection established
Time: 18000ms     - Query processes
Time: 19000ms     - Response received
Time: 19500ms     - UI updates with profile

Total: ~19.5 seconds (took 2 attempts)
✅ Still succeeds (before giving up)
```

---

## 🔐 RLS Policy Flow

### User Authentication Check

```
User logs in
    │
    ▼
Auth token issued (JWT)
    │
    ▼
Profile Query sent with auth token
    │
    ├─ Supabase extracts: auth.uid() from token
    │
    ▼
RLS Policy Evaluation: WHERE auth.uid() = id
    │
    ├─ Policy checks: Does current user ID match profile ID?
    │  ├─ Yes ✓ - Allow query
    │  └─ No ✗ - Permission denied
    │
    ▼
Return results (or error)
```

---

## 🧪 Testing Architecture

### Diagnostic Utilities

```
runFullDiagnostic()
    │
    ├─ testSupabaseConnection()
    │  └─ Check: Can reach Supabase? Measure response time
    │
    ├─ testAuthentication()
    │  └─ Check: Is user logged in? Get session info
    │
    ├─ testProfilesTableAccess()
    │  └─ Check: Can access profiles table? Count rows
    │
    ├─ testRLSReadPolicy()
    │  └─ Check: Can read own profile? Test SELECT
    │
    ├─ testRLSInsertPolicy()
    │  └─ Check: Can insert own profile? Test INSERT
    │
    └─ Aggregate results
       └─ Return: PASS/FAIL/WARNING with specific issues
```

---

## 📋 Error Handling Decision Tree

```
Is error.code === '42501'? (permission denied)
    ├─ Yes → "Permission denied. Please contact support."
    └─ No ↓

Is error.code === 'PGRST116'? (row not found)
    ├─ Yes → Signal to auto-create profile
    └─ No ↓

Does error.message include 'timeout' or 'ETIMEDOUT'?
    ├─ Yes → "Network timeout: ..." (can retry)
    └─ No ↓

Does error.code include 'CONN' or message include 'unavailable'?
    ├─ Yes → "Supabase is temporarily unavailable..."
    └─ No ↓

Does error.code === '42P01'? (table doesn't exist)
    ├─ Yes → "Profile table does not exist in database"
    └─ No ↓

Catch-all → "Database error: {error.message}"
```

---

## 🎯 State Management

### AppContext State

```typescript
{
  session: Session | null           // Auth session
  profile: Profile | null           // Current user profile
  loading: boolean                  // Overall app loading
  isAuthenticated: boolean          // Auth status
  isLocked: boolean                 // App lock for biometric
  
  // Refs (not in state, but tracked)
  profileFetchInProgress: boolean   // Prevent concurrent fetches
  profileFetchAbortController       // Cancel pending requests
  profileFetchStartTime: number     // Track response time
}
```

### Profile Fetch State Machine

```
IDLE
  ├─ fetchProfile called
  │
  ├─ ▼ 
  └─> FETCHING (timeout: 15s)
      ├─ Success ──────────────┐
      │                         ▼
      ├─ Error (retryable) ─> RETRY_DELAY (1s, 2s, 4s)
      │                         │
      │                         ▼
      │                     FETCHING (attempt N+1)
      │
      └─ Error (not retryable) ──┐
                                   ▼
                              ERROR (user sees message)
                                   │
                                   ▼
                                  IDLE
```

---

## 📊 Performance Targets

```
Metric                 Target      Acceptable   Unacceptable
──────────────────────────────────────────────────────────
First fetch time       1-2s        <5s          >15s
Slow network time      5-10s       <15s         >15s (timeout)
Retry recovery time    <20s        <30s         >30s
Profile auto-create    <3s         <5s          >10s
Error message display  Immediate   <1s          >3s
Memory cleanup         On unmount  <1s after    Leak
Request cancellation   Immediate   <100ms       Hangs
```

---

## 🔍 Debug Logging Pattern

```
[Component] Message format:
[Profile] Fetching profile for user abc123 (attempt 1/3)
[Profile] Response received in 234ms { userId: 'abc123', hasData: true, ... }
[Profile] Successfully fetched profile for user abc123
[Profile] Error fetching profile (attempt 2/3): Network timeout
[Profile] Retrying in 2000ms...

[App] Initializing auth state (attempt 1/1)
[App] Auth state change event: SIGNED_IN
[App] Profile fetch failed during init: Permission denied

Patterns:
- [Profile] = Profile fetch operations
- [App] = App initialization and auth events
- Always include: timestamp, attempt number, response time
- Always log: success, errors, retries
```

---

**Version:** 1.0  
**Last Updated:** 2026-07-10  
**Status:** ✅ Complete Architecture Documentation
