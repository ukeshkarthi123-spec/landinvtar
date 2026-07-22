/**
 * Expo Configuration for SDK 54
 *
 * This file handles environment variable injection into the native bundle via 'extra'.
 */

// Load .env files for use within this config file
try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional in some build environments
}

module.exports = ({ config }) => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

  return {
    ...config,
    extra: {
      ...config.extra,
      EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: googleWebClientId,
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: googleAndroidClientId,
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: googleIosClientId,
      eas: {
        projectId: "61496cb4-5282-456f-9633-f7db5b1dca3d"
      }
    },
  };
};
