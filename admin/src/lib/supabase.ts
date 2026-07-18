import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

const getEnvVar = (key: string): string | undefined => {
  const env = import.meta.env as Record<string, string | boolean | undefined>;

  const value = [
    env[`VITE_${key}`],
    env[`NEXT_PUBLIC_${key}`],
    env[`EXPO_PUBLIC_${key}`],
    env[key],
  ].find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);

  return value?.trim();
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
    supabaseClient = createClient(url, anonKey);
  }

  return supabaseClient;
};

export const supabase = getSupabaseClient();

export default supabase;