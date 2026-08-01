import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

/**
 * Supabase configuration utility for Expo SDK 54+
 *
 * IMPORTANT: We MUST use static property access for process.env.EXPO_PUBLIC_*
 * variables to ensure they are correctly inlined by the Expo build pipeline.
 */

// 1. Static access (Primary method for Expo)
const EXPO_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const EXPO_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// 2. Constants fallback (Primary method for EAS Build / Expo Go if process.env fails)
const extra = Constants.expoConfig?.extra || {};
const CONSTANTS_URL = extra.EXPO_PUBLIC_SUPABASE_URL || extra.VITE_SUPABASE_URL;
const CONSTANTS_KEY = extra.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.VITE_SUPABASE_ANON_KEY;

// 3. Final resolution with validation
const supabaseUrl = (EXPO_URL || CONSTANTS_URL || '').trim();
const supabaseAnonKey = (EXPO_ANON_KEY || CONSTANTS_KEY || '').trim();

export const getSupabaseRuntimeConfig = () => ({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
});

export interface AuthCallbackParams {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export function parseAuthCallbackParams(url: string): AuthCallbackParams {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return {};

  // Supabase returns tokens in the URL hash fragment: #access_token=...
  // We need to convert this to a query string format so URLSearchParams can read it.
  const hashIndex = trimmedUrl.indexOf('#');
  const queryIndex = trimmedUrl.indexOf('?');

  let searchPart = '';

  if (hashIndex >= 0) {
    // If there's a hash, it usually contains the tokens
    searchPart = trimmedUrl.slice(hashIndex + 1);
  } else if (queryIndex >= 0) {
    // Otherwise check query params (for 'code' flow)
    searchPart = trimmedUrl.slice(queryIndex + 1);
  }

  const params = new URLSearchParams(searchPart);

  return {
    code: params.get('code') || params.get('auth_code') || undefined,
    access_token: params.get('access_token') || undefined,
    refresh_token: params.get('refresh_token') || undefined,
    error: params.get('error') || undefined,
    error_description: params.get('error_description') || params.get('error_msg') || undefined,
  };
}

export async function finalizeSupabaseAuthFromUrl(url: string, logPrefix = '[Auth]') {
  const params = parseAuthCallbackParams(url);
  console.log(`${logPrefix} OAuth callback payload:`, {
    hasCode: Boolean(params.code),
    hasAccessToken: Boolean(params.access_token),
    hasRefreshToken: Boolean(params.refresh_token),
    error: params.error || null,
    errorDescription: params.error_description || null,
  });

  if (params.error_description || params.error) {
    throw new Error(params.error_description || params.error || 'Authentication failed');
  }

  let sessionData;

  if (params.access_token && params.refresh_token) {
    console.log(`${logPrefix} Establishing session from access/refresh tokens...`);
    sessionData = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
  } else if (params.code) {
    console.log(`${logPrefix} Exchanging code for Supabase session...`);
    sessionData = await supabase.auth.exchangeCodeForSession(params.code);
  } else {
    console.log(`${logPrefix} Checking existing Supabase session...`);
    const { data: existingSession, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!existingSession.session) {
      throw new Error('No session established');
    }
    return existingSession.session;
  }

  if (sessionData?.error) {
    throw sessionData.error;
  }

  if (!sessionData?.data?.session) {
    throw new Error('No session established');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }

  console.log(`${logPrefix} Session established for user:`, userData.user?.email || sessionData.data.session.user?.email);
  return sessionData.data.session;
}

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [];
  if (!supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  const errorMsg = `
CRITICAL CONFIGURATION ERROR:
Missing environment variables: ${missing.join(', ')}

[Context]
Platform: ${Platform.OS}
EXPO_URL: ${EXPO_URL ? 'PRESENT' : 'MISSING'}
CONSTANTS_URL: ${CONSTANTS_URL ? 'PRESENT' : 'MISSING'}

Ensure your .env file exists and variables are prefixed with EXPO_PUBLIC_.
  `.trim();

  if (__DEV__) {
    console.error(errorMsg);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export default supabase;
