import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const resolveSupabaseUrl = (value?: string): string | undefined => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return undefined;

  try {
    return new URL(trimmedValue).origin;
  } catch {
    return trimmedValue;
  }
};

/**
 * Supabase configuration utility
 *
 * IMPORTANT: Expo requires static access to process.env.EXPO_PUBLIC_*
 * variables for them to be correctly injected during build time.
 * Dynamic access like process.env[key] will often return undefined in
 * mobile environments.
 */

// 1. Static extraction of primary Expo environment variables
// These MUST be written as full literals for static replacement
const EXPO_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const EXPO_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// 2. Robust fallback mechanism for other platforms (Vercel, Vite, EAS)
const getEnvVar = (key: string): string | undefined => {
  const expoKey = `EXPO_PUBLIC_${key}`;
  const viteKey = `VITE_${key}`;
  const nextKey = `NEXT_PUBLIC_${key}`;

  const processValue = [
    process.env[expoKey],
    process.env[viteKey],
    process.env[nextKey],
    process.env[key],
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (processValue) return processValue.trim();

  const extraConfig = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const extraValue = [
    extraConfig?.[expoKey],
    extraConfig?.[viteKey],
    extraConfig?.[nextKey],
    extraConfig?.[key],
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return extraValue?.trim();
};

// 3. Final resolution logic
const supabaseUrl = resolveSupabaseUrl(EXPO_URL || getEnvVar('SUPABASE_URL'));
const supabaseAnonKey = (EXPO_KEY || getEnvVar('SUPABASE_ANON_KEY'))?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `
CRITICAL CONFIGURATION ERROR:
Missing Supabase environment variables:
URL: ${supabaseUrl ? 'OK' : 'MISSING'}
Anon Key: ${supabaseAnonKey ? 'OK' : 'MISSING'}

Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set correctly.
  `.trim();

  if (__DEV__) {
    console.error(errorMsg);
  }

  throw new Error(errorMsg);
}

if (__DEV__) {
  console.log('[Supabase] Initializing client...');
  console.log('[Supabase] URL:', supabaseUrl);
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
