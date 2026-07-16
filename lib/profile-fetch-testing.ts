/**
 * Profile Fetch Testing Utilities
 * 
 * Add these utilities to your app for debugging and testing profile fetch issues.
 * Usage: Import these functions and call them from your components or console.
 */

import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import type { Profile } from '@/types/database';

// ====================================================================
// TESTING UTILITIES
// ====================================================================

/**
 * Test 1: Check if Supabase is connected
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  responseTime: number;
}> {
  const startTime = Date.now();
  try {
    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      5000,
      'Connection test timeout'
    );
    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        connected: false,
        error: error.message,
        responseTime,
      };
    }

    return {
      connected: true,
      responseTime,
    };
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Test 2: Check if user is authenticated
 */
export async function testAuthentication(): Promise<{
  authenticated: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      return {
        authenticated: false,
        error: error.message,
      };
    }

    if (!session) {
      return {
        authenticated: false,
        error: 'No active session',
      };
    }

    return {
      authenticated: true,
      userId: session.user.id,
      email: session.user.email,
    };
  } catch (err) {
    return {
      authenticated: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Test 3: Check if profiles table exists and is accessible
 */
export async function testProfilesTableAccess(): Promise<{
  accessible: boolean;
  rowCount?: number;
  error?: string;
  responseTime: number;
}> {
  const startTime = Date.now();
  try {
    const result: any = await withTimeout(
      Promise.resolve(supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .limit(1)),
      5000,
      'Table access timeout'
    );

    const { count, error } = result;

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        accessible: false,
        error: error.message,
        responseTime,
      };
    }

    return {
      accessible: true,
      rowCount: count || 0,
      responseTime,
    };
  } catch (err) {
    return {
      accessible: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Test 4: Test RLS policy - can user read their own profile?
 */
export async function testRLSReadPolicy(userId: string): Promise<{
  canRead: boolean;
  profileExists: boolean;
  error?: string;
  responseTime: number;
}> {
  const startTime = Date.now();
  try {
    const result: any = await withTimeout(
      Promise.resolve(supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle()),
      5000,
      'RLS read test timeout'
    );

    const { data, error } = result;

    const responseTime = Date.now() - startTime;

    if (error?.code === '42501' || error?.message?.includes('permission')) {
      return {
        canRead: false,
        profileExists: false,
        error: 'Permission denied - RLS policy issue',
        responseTime,
      };
    }

    if (error) {
      return {
        canRead: false,
        profileExists: false,
        error: error.message,
        responseTime,
      };
    }

    return {
      canRead: true,
      profileExists: !!data,
      responseTime,
    };
  } catch (err) {
    return {
      canRead: false,
      profileExists: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Test 5: Test RLS policy - can user insert their own profile?
 */
export async function testRLSInsertPolicy(userId: string, email: string): Promise<{
  canInsert: boolean;
  error?: string;
  responseTime: number;
}> {
  const startTime = Date.now();
  try {
    const testProfile: Profile = {
      id: userId,
      name: 'Test User',
      email: email,
      phone: '',
      avatar: '',
      kyc_status: 'Not Started',
      wallet_balance: 0,
      role: 'user',
      is_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result: any = await withTimeout(
      Promise.resolve(supabase
        .from('profiles')
        .insert([testProfile])
        .select()
        .single()),
      5000,
      'RLS insert test timeout'
    );

    const { error } = result;

    const responseTime = Date.now() - startTime;

    // Check for specific errors
    if (error?.code === '23505' || error?.message?.includes('duplicate')) {
      return {
        canInsert: true, // Profile already exists
        responseTime,
      };
    }

    if (error?.code === '42501' || error?.message?.includes('permission')) {
      return {
        canInsert: false,
        error: 'Permission denied - insert RLS policy issue',
        responseTime,
      };
    }

    if (error) {
      return {
        canInsert: false,
        error: error.message,
        responseTime,
      };
    }

    return {
      canInsert: true,
      responseTime,
    };
  } catch (err) {
    return {
      canInsert: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Test 6: Full diagnostic - run all tests
 */
export async function runFullDiagnostic(): Promise<{
  timestamp: string;
  supabase: Awaited<ReturnType<typeof testSupabaseConnection>>;
  auth: Awaited<ReturnType<typeof testAuthentication>>;
  profilesTable: Awaited<ReturnType<typeof testProfilesTableAccess>>;
  rlsRead?: Awaited<ReturnType<typeof testRLSReadPolicy>>;
  rlsInsert?: Awaited<ReturnType<typeof testRLSInsertPolicy>>;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  summary: string;
}> {
  console.log('🔍 Starting Profile Fetch Diagnostic...\n');

  const results = {
    timestamp: new Date().toISOString(),
    supabase: await testSupabaseConnection(),
    auth: await testAuthentication(),
    profilesTable: await testProfilesTableAccess(),
    overallStatus: 'PASS' as const,
    summary: '',
    rlsRead: undefined as any,
    rlsInsert: undefined as any,
  };

  console.log('✅ Supabase:', results.supabase);
  console.log('✅ Auth:', results.auth);
  console.log('✅ Profiles Table:', results.profilesTable);

  if (!results.supabase.connected) {
    (results as any).overallStatus = 'FAIL';
    results.summary = '❌ Cannot connect to Supabase. Check internet connection.';
  } else if (!results.auth.authenticated) {
    (results as any).overallStatus = 'WARNING';
    results.summary = '⚠️  User not authenticated. Login required.';
  } else if (!results.profilesTable.accessible) {
    (results as any).overallStatus = 'FAIL';
    results.summary = '❌ Profiles table not accessible. Check RLS policies.';
  } else {
    // Run RLS tests
    results.rlsRead = await testRLSReadPolicy(results.auth.userId!);
    results.rlsInsert = await testRLSInsertPolicy(
      results.auth.userId!,
      results.auth.email!
    );

    console.log('✅ RLS Read:', results.rlsRead);
    console.log('✅ RLS Insert:', results.rlsInsert);

    if (!results.rlsRead.canRead || !results.rlsInsert.canInsert) {
      (results as any).overallStatus = 'FAIL';
      results.summary = '❌ RLS policies not configured correctly.';
    } else {
      results.summary = '✅ All tests passed! Profile fetch should work.';
    }
  }

  console.log('\n📊 Diagnostic Summary:');
  console.log(results.summary);
  console.log('\n' + JSON.stringify(results, null, 2));

  return results;
}

/**
 * Test 7: Simulate slow network and retry logic
 */
export async function testSlowNetworkRecovery(userId: string): Promise<{
  success: boolean;
  attempts: number;
  totalTime: number;
  error?: string;
}> {
  console.log('🌐 Testing slow network recovery...');

  const startTime = Date.now();
  let attempts = 0;
  let lastError: Error | null = null;

  for (let i = 0; i < 3; i++) {
    attempts++;
    try {
      const result: any = await withTimeout(
        Promise.resolve(supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle()),
        15000,
        'Slow network test timeout'
      );

      if (!result.error) {
        const totalTime = Date.now() - startTime;
        console.log(`✅ Success on attempt ${attempts} after ${totalTime}ms`);
        return {
          success: true,
          attempts,
          totalTime,
        };
      }

      lastError = new Error(result.error?.message);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
    }

    if (i < 2) {
      console.log(`⏳ Attempt ${attempts} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return {
    success: false,
    attempts,
    totalTime: Date.now() - startTime,
    error: lastError?.message,
  };
}

/**
 * USAGE IN CONSOLE:
 * 
 * // Run full diagnostic
 * await runFullDiagnostic();
 * 
 * // Test individual components
 * await testSupabaseConnection();
 * await testAuthentication();
 * await testProfilesTableAccess();
 * await testRLSReadPolicy(userId);
 * await testRLSInsertPolicy(userId, email);
 * 
 * // Test recovery from slow network
 * await testSlowNetworkRecovery(userId);
 * 
 * // Check specific user's profile
 * const { data } = await supabase.from('profiles').select('*').eq('id', 'user-id').single();
 * console.log(data);
 */
