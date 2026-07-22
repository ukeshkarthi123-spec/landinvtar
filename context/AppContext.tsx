import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Linking, AppState, Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import { Profile } from '@/types/database';

interface AppContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isLocked: boolean;
  unlockApp: () => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  setWalletBalance: (balance: number) => void;
}

const AppContext = createContext<AppContextType>({
  session: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  isLocked: false,
  unlockApp: async () => false,
  refreshProfile: async () => {},
  signOut: async () => {},
  setWalletBalance: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const initialized = useRef(false);
  const isMounted = useRef(true);

  // Helper to safely update state only if component is mounted
  const safeUpdate = useCallback((updater: () => void) => {
    if (isMounted.current) {
      updater();
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string, retryAttempt = 0): Promise<Profile | null> => {
    if (!isMounted.current) return null;

    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 10000;
    const REQUIRED_FIELDS = 'id, name, email, phone, avatar, kyc_status, wallet_balance, is_admin, created_at, updated_at';

    try {
      const result = await withTimeout(
        Promise.resolve(supabase.from('profiles').select(REQUIRED_FIELDS).eq('id', userId).maybeSingle()),
        TIMEOUT_MS
      ) as any;

      const { data, error } = result;

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(error.message);
      }

      if (data && isMounted.current) {
        safeUpdate(() => setProfile(data as Profile));
        return data as Profile;
      }

      return null;
    } catch (err) {
      if (retryAttempt < MAX_RETRIES && isMounted.current) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchProfile(userId, retryAttempt + 1);
      }
      return null;
    }
  }, [safeUpdate]);

  const autoCreateProfile = useCallback(async (userId: string, email: string): Promise<Profile | null> => {
    if (!isMounted.current) return null;

    try {
      const newProfile: Partial<Profile> = {
        id: userId,
        name: email.split('@')[0] || 'User',
        email: email,
        kyc_status: 'Not Started',
        wallet_balance: 0,
        is_admin: false,
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert([newProfile], { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;

      if (data && isMounted.current) {
        safeUpdate(() => setProfile(data as Profile));
      }
      return data as Profile;
    } catch (err) {
      console.error('[Profile] Auto-create failed:', err);
      return null;
    }
  }, [safeUpdate]);

  const refreshProfile = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const userId = currentSession?.user?.id;
    if (!userId) return;

    const existingProfile = await fetchProfile(userId);
    if (existingProfile === null && isMounted.current) {
      await autoCreateProfile(userId, currentSession.user.email || '');
    }
  }, [fetchProfile, autoCreateProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
    safeUpdate(() => {
      setProfile(null);
      setSession(null);
      setIsLocked(false);
    });
  }, [safeUpdate]);

  const setWalletBalance = useCallback((balance: number) => {
    safeUpdate(() => {
      setProfile(prev => prev ? { ...prev, wallet_balance: balance } : prev);
    });
  }, [safeUpdate]);

  const unlockApp = useCallback(async () => {
    try {
      const isBiometricEnabled = await SecureStore.getItemAsync('biometrics_enabled');
      if (isBiometricEnabled !== 'true') {
        safeUpdate(() => setIsLocked(false));
        return true;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to unlock',
      });

      if (result.success) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          safeUpdate(() => {
            setSession(currentSession);
            setIsLocked(false);
          });
          return true;
        } else {
          safeUpdate(() => setIsLocked(false));
          router.replace('/login');
          return false;
        }
      }
      return false;
    } catch (err) {
      safeUpdate(() => setIsLocked(false));
      return true;
    }
  }, [safeUpdate]);

  const handleUrl = useCallback(async (url: string) => {
    if (!url || !isMounted.current) return;

    try {
      const queryString = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
      if (!queryString) return;

      const params: Record<string, string> = {};
      queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) params[key] = decodeURIComponent(value);
      });

      if (params.access_token && params.refresh_token) {
        const { data } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (data.session) {
          safeUpdate(() => setSession(data.session));
        }
      } else if (params.code) {
        const { data } = await supabase.auth.exchangeCodeForSession(params.code);
        if (data.session) {
          safeUpdate(() => setSession(data.session));
        }
      }
    } catch (err) {
      console.error('URL handle error:', err);
    }
  }, [safeUpdate]);

  useEffect(() => {
    isMounted.current = true;

    const initialize = async () => {
      if (initialized.current) return;
      initialized.current = true;

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!isMounted.current) return;

        if (currentSession) {
          safeUpdate(() => setSession(currentSession));
          await fetchProfile(currentSession.user.id);

          if (Platform.OS !== 'web') {
            const isBiometricEnabled = await SecureStore.getItemAsync('biometrics_enabled');
            if (isBiometricEnabled === 'true') {
              safeUpdate(() => setIsLocked(true));
            }
          }
        }

        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await handleUrl(initialUrl);

      } catch (err) {
        console.error('[App] Init error:', err);
      } finally {
        safeUpdate(() => setLoading(false));
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      safeUpdate(() => setSession(nextSession));

      if (event === 'SIGNED_IN' && nextSession) {
        await fetchProfile(nextSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        safeUpdate(() => setProfile(null));
      }
    });

    const urlListener = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      urlListener.remove();
    };
  }, [handleUrl, fetchProfile, safeUpdate]);

  return (
    <AppContext.Provider
      value={{
        session,
        profile,
        loading,
        isAuthenticated: !!session,
        isLocked,
        unlockApp,
        refreshProfile,
        signOut,
        setWalletBalance,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
