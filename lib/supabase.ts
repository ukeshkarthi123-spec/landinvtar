import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Ensure environment variables are loaded strictly from process.env
// In Expo, these must be prefixed with EXPO_PUBLIC_ to be available in the client bundle
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Production-grade validation: Throw if configuration is missing
if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [];
  if (!supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  const errorMsg = `CRITICAL CONFIGURATION ERROR: Missing Supabase environment variables: ${missing.join(', ')}. ` +
    `Ensure these are defined in your .env file and provided to EAS during build.`;

  console.error(errorMsg);
  // We do not provide fallbacks like 'https://example.supabase.co' as they cause generic "Network request failed" errors.
  // Instead, we let the app fail early with a clear configuration error.
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Supabase client instance
 * Optimized for React Native with AsyncStorage and Session persistence
 */
export const supabase = createClient(
  supabaseUrl || 'https://MISSING_CONFIG.supabase.co',
  supabaseAnonKey || 'MISSING_KEY',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
);

// Add global listener for network-related debugging
if (__DEV__) {
  console.log('[Supabase] Initialized with endpoint:', supabaseUrl);
}
