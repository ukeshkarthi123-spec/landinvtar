import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string | undefined => {
  const env = import.meta.env as Record<string, string | boolean | undefined>;

  return [
    env[`VITE_${key}`],
    env[`NEXT_PUBLIC_${key}`],
    env[`EXPO_PUBLIC_${key}`],
    env[key],
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
};

const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || getEnvVar('SUPABASE_ANON_KEY'))?.trim();

if (!supabaseAnonKey) {
  const errorMsg = `
Supabase configuration error in Admin Panel:
Missing environment variables.
Anon Key: MISSING

Ensure VITE_SUPABASE_ANON_KEY is set.
  `.trim();

  console.error('[Supabase Admin]', errorMsg);

  if (typeof document !== 'undefined') {
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `<div style="padding: 2rem; color: red; font-family: sans-serif;"><h2>Configuration Error</h2><pre style="background: #fee; padding: 1rem; border-radius: 8px;">${errorMsg}</pre></div>`;
    }
  }

  throw new Error(errorMsg);
}

const supabase = createClient(
  'https://sodzuknsemsqaiakevjp.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export { supabase };
export default supabase;
