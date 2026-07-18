const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env.local'), override: true });

const appJson = require('./app.json');

/**
 * Dynamics configuration for Expo.
 * This file allows us to inject environment variables into the app
 * using Constants.expoConfig.extra.
 */
const getSupabaseValue = (key) => {
  return [
    process.env[key],
    process.env[`EXPO_PUBLIC_${key}`],
    process.env[`VITE_${key}`],
    process.env[`NEXT_PUBLIC_${key}`],
  ].find((value) => typeof value === 'string' && value.trim().length > 0);
};

const getSupabaseUrl = () => {
  const value = getSupabaseValue('SUPABASE_URL')?.trim();
  if (!value) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  return value;
};

const getSupabaseAnonKey = () => {
  const value = getSupabaseValue('SUPABASE_ANON_KEY')?.trim();
  if (!value) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  return value;
};

module.exports = {
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra || {}),
    EXPO_PUBLIC_SUPABASE_URL: getSupabaseUrl(),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: getSupabaseAnonKey(),
    VITE_SUPABASE_URL: getSupabaseUrl(),
    VITE_SUPABASE_ANON_KEY: getSupabaseAnonKey(),
    NEXT_PUBLIC_SUPABASE_URL: getSupabaseUrl(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: getSupabaseAnonKey(),
  },
};

