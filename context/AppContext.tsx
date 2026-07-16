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

  // Fetch profile with timeout, retry, and auto-create - NOT memoized to avoid dependency issues
  const fetchProfile = async (userId: string, retryAttempt = 0): Promise<Profile | null> => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 15000; // 15 seconds
    const REQUIRED_FIELDS = 'id, name, email, phone, avatar, kyc_status, wallet_balance, is_admin, created_at, updated_at';

    // Prevent concurrent fetches
    if (profileFetchInProgress.current) {
      console.log(`[Profile] Fetch already in progress, skipping attempt ${retryAttempt + 1}/${MAX_RETRIES}`);
      return null;
    }
    profileFetchInProgress.current = true;
    profileFetchStartTime.current = Date.now();

    // Cancel previous request if any
    if (profileFetchAbortController.current) {
      profileFetchAbortController.current.abort();
    }
    profileFetchAbortController.current = new AbortController();

    try {
      console.log(`[Profile] Fetching profile for user ${userId} (attempt ${retryAttempt + 1}/${MAX_RETRIES})`);

      // Verify user is authenticated
      if (!userId) {
        throw new Error('User ID is required to fetch profile');
      }

      // Fetch with timeout wrapper
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
      const responseTime = Date.now() - profileFetchStartTime.current;

      // Log detailed response info for debugging
      console.log(`[Profile] Response received in ${responseTime}ms`, {
        userId,
        hasData: !!data,
        hasError: !!error,
        errorMessage: error?.message,
        httpStatus: error?.code,
      });

      // Handle errors
      if (error) {
        if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
          throw new Error(`Network timeout: ${error.message}`);
        }
        if (error.code === 'PGRST116') {
          // Row doesn't exist
          console.warn(`[Profile] Profile does not exist for user ${userId}, will auto-create`);
          return null; // Signal to auto-create
        }
        if (error.code?.includes('CONN') || error.message?.includes('connection') || error.message?.includes('unavailable')) {
          throw new Error('Supabase is temporarily unavailable. Please check your internet connection.');
        }
        if (error.code === '42P01') {
          throw new Error('Profile table does not exist in database');
        }
        if (error.code === '42501' || error.message?.includes('permission')) {
          throw new Error('Permission denied. Please contact support.');
        }
        throw new Error(`Database error: ${error.message}`);
      }

      // Profile found - update state
      if (data) {
        console.log(`[Profile] Successfully fetched profile for user ${userId}`);
        if (setProfile) {
          setProfile(data as Profile);
        }
        return data as Profile;
      }

      // Profile doesn't exist - signal for auto-create
      console.warn(`[Profile] No profile found for user ${userId}, will auto-create`);
      return null;
    } catch (err) {
      const responseTime = Date.now() - profileFetchStartTime.current;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      console.error(`[Profile] Error fetching profile (attempt ${retryAttempt + 1}/${MAX_RETRIES}):`, {
        error: errorMessage,
        userId,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      });

      // Determine if we should retry
      const isRetryableError = errorMessage.includes('timeout') || 
                               errorMessage.includes('temporarily unavailable') ||
                               errorMessage.includes('Network');

      if (isRetryableError && retryAttempt < MAX_RETRIES - 1) {
        const delayMs = Math.min(1000 * Math.pow(2, retryAttempt), 5000); // Exponential backoff, max 5s
        console.log(`[Profile] Retrying in ${delayMs}ms...`);
        
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Recursive retry
        return fetchProfile(userId, retryAttempt + 1);
      }

      // Max retries exceeded or non-retryable error
      throw err;
    } finally {
      profileFetchInProgress.current = false;
      // Don't clear abort controller - keep for next request
    }
  };

  // Auto-create profile for new users using UPSERT to prevent duplicates
  const autoCreateProfile = async (userId: string, email: string): Promise<Profile | null> => {
    // Prevent concurrent profile creation attempts (race condition guard)
    if (profileCreateInProgress.current) {
      console.log(`[Profile] Profile creation already in progress for user ${userId}, skipping duplicate attempt`);
      return null;
    }
    profileCreateInProgress.current = true;

    try {
      console.log(`[Profile] Auto-creating profile for new user ${userId}`);

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

      // Use UPSERT to handle duplicates gracefully
      // This will insert if new, update if already exists (same ID)
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
        console.error('[Profile] Error auto-creating profile:', {
          error: error.message,
          code: error.code,
          userId,
        });
        
        // Handle duplicate key error gracefully
        if (error.code === '23505') {
          console.warn('[Profile] Duplicate profile detected, fetching existing profile...');
          // Try to fetch the existing profile instead
          try {
            const existing = await fetchProfile(userId);
            if (existing) {
              return existing;
            }
          } catch (fetchErr) {
            console.error('[Profile] Failed to fetch existing profile after conflict:', fetchErr);
          }
        }
        throw new Error(`Failed to create profile: ${error.message}`);
      }

      console.log(`[Profile] Profile auto-created/verified successfully for user ${userId}`);
      if (data && setProfile) {
        setProfile(data as Profile);
      }
      return data as Profile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Profile] Auto-create profile failed:`, errorMessage);
      throw err;
    } finally {
      profileCreateInProgress.current = false;
    }
  };

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      console.warn('[Profile] Cannot refresh profile: no user session');
      return;
    }
    try {
      console.log('[Profile] Manual refresh requested by user');
      const profile = await fetchProfile(session.user.id);
      // If profile is null, auto-create it (only if not already in progress)
      if (profile === null && !profileCreateInProgress.current) {
        console.log('[Profile] Profile not found during refresh, triggering auto-create');
        await autoCreateProfile(session.user.id, session.user.email || '');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh profile';
      console.error('[Profile] Refresh failed:', errorMessage);
      // Don't throw - let app continue, user can retry
    }
  }, [session?.user?.id, session?.user?.email]);

  const processOfflineQueue = useCallback(async () => {
    try {
      const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!existing) return;

      const queue = JSON.parse(existing);
      if (queue.length === 0) return;

      console.log(`Syncing ${queue.length} offline changes...`);

      for (const updates of queue) {
        const { timestamp, ...data } = updates;
        try {
          await withTimeout(
            Promise.resolve(supabase
              .from('profiles')
              .update({ ...data, updated_at: new Date(timestamp).toISOString() })
              .eq('id', session?.user?.id)),
            10000
          );
        } catch (err) {
          console.error('Error syncing offline update:', err);
        }
      }

      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      if (session?.user?.id) {
        await fetchProfile(session.user.id);
      }
    } catch (err) {
      console.error('Process offline queue error:', err);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && session) {
        processOfflineQueue();
      }
    });
    return () => unsubscribe();
  }, [session, processOfflineQueue]);

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
    console.log('Biometric: unlockApp started');
    try {
      const isBiometricEnabled = await SecureStore.getItemAsync('biometrics_enabled');
      console.log('Biometric: enabled status:', isBiometricEnabled);

      if (isBiometricEnabled !== 'true') {
        console.log('Biometric: not enabled, skipping');
        setIsLocked(false);
        return true;
      }

      console.log('Biometric: starting prompt');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to unlock InvestLand',
        fallbackLabel: 'Use Passcode',
      });

      console.log('Biometric: prompt result:', result.success);

      if (result.success) {
        console.log('Biometric: Authentication success');

        // Ensure session is loaded
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        console.log('Biometric: Session loaded:', currentSession ? 'Yes' : 'No');

        if (currentSession) {
          setSession(currentSession);
          setIsLocked(false);
          console.log('Biometric: isLocked set to false');
          return true;
        } else {
          console.log('Biometric: Success but no session found, redirecting to login');
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

  const handleUrl = useCallback(async (url: string) => {
    if (!url) return;

    try {
      // Extract tokens from URL (either query params or hash fragment)
      const queryString = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
      if (!queryString) return;

      const params = queryString.split('&').reduce((acc: any, curr) => {
        const [key, value] = curr.split('=');
        if (key && value) acc[key] = value;
        return acc;
      }, {});

      if (params.access_token && params.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (data.session) {
          setSession(data.session);
          await fetchProfile(data.session.user.id);
        }
      }
    } catch (err) {
      console.error('Error handling URL:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let safetyTimer: any = null;
    let retryCount = 0;
    const MAX_RETRIES = 2;

    // Safety timeout to ensure loading is set to false even if Supabase hangs
    const startSafetyTimer = () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      safetyTimer = setTimeout(() => {
        if (isMounted && loading) {
          console.warn('[App] Safety timeout hit: Forcefully setting loading to false');
          setLoading(false);
        }
      }, 15000); // 15 seconds
    };

    const initialize = async () => {
      if (initialized.current) {
        console.log('[App] Already initialized, skipping');
        return;
      }

      initialized.current = true;
      startSafetyTimer();

      try {
        console.log('[App] Initializing auth state (attempt', retryCount + 1, ')');

        // Get session with timeout
        let currentSession: Session | null = null;
        try {
          const result: any = await withTimeout(
            Promise.resolve(supabase.auth.getSession()),
            10000,
            'Get session timeout'
          );
          const { data, error } = result;
          if (error) {
            console.error('[App] Error getting session:', error);
          } else {
            currentSession = data?.session;
          }
        } catch (err) {
          console.error('[App] Timeout getting session:', err);
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            initialized.current = false; // Allow retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            return initialize();
          }
        }

        if (!isMounted) return;

        if (currentSession) {
          console.log('[App] Existing session found for user:', currentSession.user.id);
          setSession(currentSession);
          
          // Fetch profile with auto-create on missing
          try {
            console.log('[App] Fetching profile after auth initialization');
            const profile = await fetchProfile(currentSession.user.id);
            
            // Auto-create profile if it doesn't exist
            if (profile === null && currentSession.user.email) {
              console.log('[App] Profile not found, auto-creating...');
              await autoCreateProfile(currentSession.user.id, currentSession.user.email);
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile';
            console.error('[App] Profile fetch failed during init:', errorMessage);
            // Don't block initialization if profile fetch fails - user can retry from app
          }

          // Check for biometrics
          if (Platform.OS !== 'web') {
            try {
              const isBiometricEnabled = await SecureStore.getItemAsync('biometrics_enabled');
              if (isBiometricEnabled === 'true') {
                console.log('[App] Biometrics enabled, locking app');
                if (isMounted) setIsLocked(true);
              }
            } catch (err) {
              console.error('[App] Error checking biometrics:', err);
            }
          }
        } else {
          console.log('[App] No existing session found');
        }

        // Check for initial URL (if app was opened via deep link)
        try {
          const initialUrl = Platform.OS === 'web' ? window.location.href : await Linking.getInitialURL();
          if (initialUrl && isMounted) {
            console.log('[App] Handling initial URL');
            await handleUrl(initialUrl);
          }
        } catch (err) {
          console.error('[App] Error handling initial URL:', err);
        }
      } catch (err) {
        console.error('[App] Initialization unexpected error:', err);
      } finally {
        if (isMounted) {
          console.log('[App] Initialization complete, setting loading to false');
          setLoading(false);
          if (safetyTimer) clearTimeout(safetyTimer);
        }
      }
    };

    initialize();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) return;

      console.log('[App] Auth state change event:', event);

      // Prevent redundant updates
      const sessionChanged = nextSession?.user?.id !== session?.user?.id;
      const isSignEvent = event === 'SIGNED_IN' || event === 'SIGNED_OUT';

      if (sessionChanged || isSignEvent) {
        setSession(nextSession);
        if (nextSession?.user?.id) {
          try {
            console.log('[App] Fetching profile after auth state change');
            const profile = await fetchProfile(nextSession.user.id);
            
            // Auto-create profile if it doesn't exist
            if (profile === null && nextSession.user.email) {
              console.log('[App] Profile not found after auth change, auto-creating...');
              await autoCreateProfile(nextSession.user.id, nextSession.user.email);
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile';
            console.error('[App] Profile fetch failed on auth change:', errorMessage);
            // Don't block - user can retry
          }
        } else {
          setProfile(null);
        }
      }

      // Ensure loading is false after initialization
      if (initialized.current && loading) {
        console.log('[App] Auth state change event, ensuring loading is false');
        setLoading(false);
      }
    });

    // Listen for deep links while app is running
    const urlListener = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    // Listen for AppState changes to refresh session (important for mobile)
    const appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isMounted && session) {
        console.log('[App] App became active, refreshing session');
        withTimeout(supabase.auth.refreshSession(), 10000).catch(err =>
          console.error('[App] Error refreshing session:', err)
        );
      }
    });

    return () => {
      isMounted = false;
      if (safetyTimer) clearTimeout(safetyTimer);
      
      // Cancel any pending profile fetch requests
      if (profileFetchAbortController.current) {
        console.log('[Profile] Cancelling pending profile fetch on unmount');
        profileFetchAbortController.current.abort();
      }
      
      subscription.unsubscribe();
      urlListener.remove();
      appStateListener.remove();
    };
  }, [handleUrl]);

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
