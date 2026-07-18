import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

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

  if (processValue) {
    return processValue.trim();
  }

  const extraConfig = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const extraValue = [
    extraConfig?.[expoKey],
    extraConfig?.[viteKey],
    extraConfig?.[nextKey],
    extraConfig?.[key],
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return extraValue?.trim();
};

export const getSupabaseRuntimeConfig = (): SupabaseConfig => ({
  url: getEnvVar('SUPABASE_URL')?.trim() || '',
  anonKey: getEnvVar('SUPABASE_ANON_KEY')?.trim() || '',
});

const validateSupabaseConfig = (): SupabaseConfig => {
  const { url, anonKey } = getSupabaseRuntimeConfig();

  if (!url || !anonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  return { url, anonKey };
};

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    const { url, anonKey } = validateSupabaseConfig();
    supabaseClient = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
      },
    });
  }

  return supabaseClient;
};

export const getSupabaseUrl = () => validateSupabaseConfig().url;
export const getSupabaseAnonKey = () => validateSupabaseConfig().anonKey;

if (__DEV__) {
  const { url, anonKey } = getSupabaseRuntimeConfig();
  console.log('[Supabase Config] Platform:', Platform.OS);
  console.log('[Supabase Config] URL Loaded:', url ? '✅ Yes' : '❌ No');
  console.log('[Supabase Config] Key Loaded:', anonKey ? '✅ Yes' : '❌ No');
}

export const supabase = getSupabaseClient();

export const signInWithGoogle = async (redirectUri?: string) => {
  return getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });
};

export default supabase;
