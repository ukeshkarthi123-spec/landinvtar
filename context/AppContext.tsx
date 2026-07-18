import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Linking, AppState, Platform, Alert } from 'react-native';
import { Session } from '@supabase/supabase-js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import { Profile } from '@/types/database';

const OFFLINE_QUEUE_KEY = 'offline_profile_updates';

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
  const profileFetchInProgress = useRef(false);
  const profileCreateInProgress = useRef(false);
  const profileFetchAbortController = useRef<AbortController | null>(null);
  const profileFetchStartTime = useRef<number>(0);

  // Fetch profile with timeout, retry, and auto-create
  const fetchProfile = async (userId: string, retryAttempt = 0): Promise<Profile | null> => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 15000;
    const REQUIRED_FIELDS = 'id, name, email, phone, avatar, kyc_status, wallet_balance, is_admin, created_at, updated_at';

    if (profileFetchInProgress.current) return null;
    profileFetchInProgress.current = true;
    profileFetchStartTime.current = Date.now();

    if (profileFetchAbortController.current) {
      profileFetchAbortController.current.abort();
    }
    profileFetchAbortController.current = new AbortController();

    try {
      if (!userId) throw new Error('User ID is required to fetch profile');

      const result = await withTimeout(
        Promise.resolve(supabase
          .from('profiles')
          .select(REQUIRED_FIELDS)
          .eq('id', userId)
          .maybeSingle()),
        TIMEOUT_MS,
        `Profile fetch timeout after ${TIMEOUT_MS}ms`
      ) as any;

      const { data, error } = result;

      if (error) {
        if (error.code === 'PGRST116') return null; // Signal to auto-create
        throw new Error(`Database error: ${error.message}`);
      }

      if (data) {
        setProfile(data as Profile);
        return data as Profile;
      }

      return null;
    } catch (err) {
      console.error(`[Profile] Error fetching profile (attempt ${retryAttempt + 1}/${MAX_RETRIES}):`, err);

      if (retryAttempt < MAX_RETRIES - 1) {
        const delayMs = Math.min(1000 * Math.pow(2, retryAttempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return fetchProfile(userId, retryAttempt + 1);
      }
      throw err;
    } finally {
      profileFetchInProgress.current = false;
    }
  };

  const autoCreateProfile = async (userId: string, email: string): Promise<Profile | null> => {
    if (profileCreateInProgress.current) return null;
    profileCreateInProgress.current = true;

    try {
      const newProfile: Profile = {
        id: userId,
        name: email.split('@')[0] || 'User',
        email: email,
        phone: '',
        avatar: '',
        kyc_status: 'Not Started',
        wallet_balance: 0,
        role: 'user',
        is_admin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await withTimeout(
        Promise.resolve(supabase
          .from('profiles')
          .upsert([newProfile], { onConflict: 'id' })
          .select()
          .single()),
        15000,
        'Profile creation timeout'
      ) as any;

      const { data, error } = result;

      if (error) {
        if (error.code === '23505') {
          return await fetchProfile(userId);
        }
        throw new Error(`Failed to create profile: ${error.message}`);
      }

      if (data) {
        setProfile(data as Profile);
      }
      return data as Profile;
    } catch (err) {
      console.error(`[Profile] Auto-create profile failed:`, err);
      throw err;
    } finally {
      profileCreateInProgress.current = false;
    }
  };

  const refreshProfile = useCallback(async () => {
    // Get latest session first to be absolutely sure
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const userId = currentSession?.user?.id || session?.user?.id;
    const email = currentSession?.user?.email || session?.user?.email;

    if (!userId) {
      console.warn('[Profile] Cannot refresh profile: no user session');
      return;
    }

    try {
      const existingProfile = await fetchProfile(userId);
      if (existingProfile === null) {
        await autoCreateProfile(userId, email || '');
      }
    } catch (err) {
      console.error('[Profile] Refresh failed:', err);
    }
  }, [session]);

  const signOut = useCallback(async () => {
    try {
      await withTimeout(supabase.auth.signOut(), 5000);
    } catch (err) {
      console.error('Sign out error:', err);
    }
    setProfile(null);
    setSession(null);
    setIsLocked(false);
  }, []);

  const setWalletBalance = useCallback((balance: number) => {
    setProfile(prev => prev ? { ...prev, wallet_balance: balance } : prev);
  }, []);

  const unlockApp = useCallback(async () => {
    try {
      const isBiometricEnabled = await SecureStore.getItemAsync('biometrics_enabled');
      if (isBiometricEnabled !== 'true') {
        setIsLocked(false);
        return true;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to unlock InvestLand',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSession(currentSession);
          setIsLocked(false);
          return true;
        } else {
          setIsLocked(false);
          router.replace('/login');
          return false;
        }
      }
      return false;
    } catch (err) {
      console.error('Biometric: auth error:', err);
      setIsLocked(false);
      return true;
    }
  }, []);

  /**
   * ROBUST URL HANDLING FOR GOOGLE OAUTH
   */
  const handleUrl = useCallback(async (url: string) => {
    if (!url) return;

    try {
      console.log('[Auth] Deep link received:', url);

      // Extract parameters from hash fragment or query string
      const queryString = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
      if (!queryString) return;

      const params = queryString.split('&').reduce((acc: any, curr) => {
        const [key, value] = curr.split('=');
        if (key && value) acc[key] = decodeURIComponent(value);
        return acc;
      }, {});

      if (params.access_token && params.refresh_token) {
        console.log('[Auth] tokens found in URL, setting session...');
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (data.session) {
          setSession(data.session);
          // fetchProfile is handled by the onAuthStateChange listener
        }
      } else if (params.code) {
        console.log('[Auth] Code found in URL, exchanging...');
        const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (data.session) {
          setSession(data.session);
        }
      }
    } catch (err) {
      console.error('Error handling URL:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let safetyTimer: any = null;

    const startSafetyTimer = () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      safetyTimer = setTimeout(() => {
        if (isMounted && loading) {
          console.warn('[App] Safety timeout: Force loading to false');
          setLoading(false);
        }
      }, 10000);
    };

    const initialize = async () => {
      if (initialized.current) return;
      initialized.current = true;
      startSafetyTimer();

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (currentSession) {
          setSession(currentSession);
          await fetchProfile(currentSession.user.id).catch(() => {});

          if (Platform.OS !== 'web') {
            const isBiometricEnabled = await SecureStore.getItemAsync('biometrics_enabled');
            if (isBiometricEnabled === 'true') setIsLocked(true);
          }
        }

        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await handleUrl(initialUrl);

      } catch (err) {
        console.error('[App] Init error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
          if (safetyTimer) clearTimeout(safetyTimer);
        }
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) return;
      console.log('[App] Auth event:', event);

      setSession(nextSession);

      if (event === 'SIGNED_IN' && nextSession) {
        await fetchProfile(nextSession.user.id).catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }

      if (loading) setLoading(false);
    });

    const urlListener = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isMounted && session) {
        supabase.auth.refreshSession();
      }
    });

    return () => {
      isMounted = false;
      if (safetyTimer) clearTimeout(safetyTimer);
      subscription.unsubscribe();
      urlListener.remove();
      appStateListener.remove();
    };
  }, [handleUrl, loading]);

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
