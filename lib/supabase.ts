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
