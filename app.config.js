const fs = require('fs');
const path = require('path');

let dotenv;
try {
  dotenv = require('dotenv');
} catch {
  dotenv = null;
}

const loadEnvFile = (fileName) => {
  if (!dotenv) return;

  const envPath = path.resolve(__dirname, fileName);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
};

loadEnvFile('.env');
loadEnvFile('.env.local');

const appJson = require('./app.json');

/**
 * Dynamics configuration for Expo.
 * This file allows us to inject environment variables into the app
 * using Constants.expoConfig.extra.
 */
const normalizeSupabaseUrl = (value) => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return '';

  try {
    return new URL(trimmedValue).origin;
  } catch {
    return trimmedValue.replace(/\/+$/, '').replace(/\/(?:auth|rest|storage|functions|realtime|graphql)(?:\/v1)?\/?$/i, '');
  }
};

const getSupabaseValue = (key) => {
  return [
    process.env[key],
    process.env[`EXPO_PUBLIC_${key}`],
    process.env[`VITE_${key}`],
    process.env[`NEXT_PUBLIC_${key}`],
  ].find((value) => typeof value === 'string' && value.trim().length > 0);
};

const getSupabaseUrl = () => {
  return normalizeSupabaseUrl(getSupabaseValue('SUPABASE_URL'));
};

const getSupabaseAnonKey = () => {
  return getSupabaseValue('SUPABASE_ANON_KEY')?.trim() || '';
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

