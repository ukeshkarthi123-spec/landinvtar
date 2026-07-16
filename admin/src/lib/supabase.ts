import { createClient } from '@supabase/supabase-js';

console.log('VITE_SUPABASE_URL =', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY =', import.meta.env.VITE_SUPABASE_ANON_KEY);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  document.body.innerHTML = `
    <h1>Environment Variables Missing</h1>
    <pre>${JSON.stringify(import.meta.env, null, 2)}</pre>
  `;
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);