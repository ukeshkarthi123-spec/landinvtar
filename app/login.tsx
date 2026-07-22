import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  Animated, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Mail, ChevronRight, Eye, EyeOff, ArrowLeft, AlertCircle, UserPlus } from 'lucide-react-native';

// Standard requirement for AuthSession in Expo
WebBrowser.maybeCompleteAuthSession();

import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

// React Native (Hermes) doesn't reliably support the global URL/URLSearchParams
// APIs, so we extract query/hash params with a small regex helper instead.
function getQueryParam(url: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`[?#&]${escapedKey}=([^&]*)`);
  const match = url.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

type AuthMode = 'options' | 'email' | 'forgot' | 'mfa';
type EmailTab = 'signin' | 'signup';

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, profile, refreshProfile } = useApp();
  const [mode, setMode] = useState<AuthMode>('options');
  const [emailTab, setEmailTab] = useState<EmailTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const safeSetLoading = useCallback((val: boolean) => {
    if (isMounted.current) setLoading(val);
  }, []);

  // After a web OAuth redirect, Supabase auto-parses the session from the
  // URL on load (detectSessionInUrl). Pick that session up here and refresh
  // the profile so the isAuthenticated/profile effect below can navigate.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const checkRedirectSession = async () => {
      const hasAuthParams =
        window.location.hash.includes('access_token') ||
        window.location.search.includes('code=') ||
        window.location.hash.includes('code=');
      if (!hasAuthParams) return;

      safeSetLoading(true);
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }
        if (session && isMounted.current) {
          await refreshProfile();
        } else if (isMounted.current) {
          setError('Sign-in did not complete. Please try again.');
        }
      } catch (err: any) {
        if (isMounted.current) {
          setError(err?.message ?? 'Google sign-in failed.');
        }
      } finally {
        safeSetLoading(false);
      }
    };

    checkRedirectSession();
  }, [refreshProfile, safeSetLoading]);

  const handleGoogleSignIn = async () => {
    safeSetLoading(true);
    if (isMounted.current) {
      setError(null);
    }
    try {
      if (Platform.OS === 'web') {
        // On web there's no native app to catch a custom-scheme redirect,
        // so let Supabase do a normal full-page redirect. supabase-js
        // automatically picks up the session from the URL on reload
        // (detectSessionInUrl defaults to true), so nothing else to do here
        // — the auth listener elsewhere in the app (or the effect below)
        // will pick up the session once the browser comes back.
        const { error: webSignInError } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/login',
          },
        });
        if (webSignInError) {
          throw webSignInError;
        }
        return;
      }

      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'myapp',
        path: 'login',
      });
      const {
        data,
        error: signInError,
      } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (signInError) {
        throw signInError;
      }
      if (!data?.url) {
        throw new Error('Google OAuth URL was not returned.');
      }
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );
      if (result.type !== 'success' || !result.url) {
        return;
      }

      const accessToken = getQueryParam(result.url, 'access_token');
      const refreshToken = getQueryParam(result.url, 'refresh_token');
      const code = getQueryParam(result.url, 'code');

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setSessionError) {
          throw setSessionError;
        }
      } else if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          throw exchangeError;
        }
      } else {
        throw new Error('Authorization code not found.');
      }
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }
      if (!session) {
        throw new Error('No active Supabase session.');
      }
      if (isMounted.current) {
        await refreshProfile();
      }
    } catch (err: any) {
      if (isMounted.current) {
        setError(err?.message ?? 'Google sign-in failed.');
      }
    } finally {
      safeSetLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    safeSetLoading(true);
    if (isMounted.current) setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        if (isMounted.current) setError(authError.message);
        return;
      }

      if (data.session && isMounted.current) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verifiedFactor = factors?.all.find(f => f.factor_type === 'totp' && f.status === 'verified');

        if (verifiedFactor && isMounted.current) {
          setMfaFactorId(verifiedFactor.id);
          setMode('mfa');
          return;
        }
      }

      if (isMounted.current) await refreshProfile();
    } catch (err: any) {
      if (isMounted.current) setError('Something went wrong. Please try again.');
    } finally {
      safeSetLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && profile && isMounted.current) {
      const isAdmin = profile.is_admin || (profile as any).role === 'admin';
      router.replace(isAdmin ? '/admin' : '/(tabs)');
    }
  }, [isAuthenticated, profile]);

  const switchMode = (newMode: AuthMode) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      if (!isMounted.current) return;
      setMode(newMode);
      setError(null);
      setInfo(null);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  const gradientColors: [string, string, string] = isDark
    ? [colors.bg, '#0D1A13', colors.bg]
    : [colors.bg, '#FFFFFF', colors.bg];

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <KeyboardAvoidingView style={dynamicStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      <ScrollView contentContainerStyle={dynamicStyles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps='always'>
        <View style={dynamicStyles.header}>
          {mode !== 'options' && (
            <TouchableOpacity style={dynamicStyles.backBtn} onPress={() => switchMode('options')} disabled={loading}>
              <ArrowLeft size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={dynamicStyles.logoRow}>
            <LinearGradient colors={[colors.emerald, colors.forest]} style={dynamicStyles.logoCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={dynamicStyles.logoText}>IL</Text>
            </LinearGradient>
            <Text style={dynamicStyles.brandName}><Text style={{ color: colors.emerald }}>Invest</Text>Land</Text>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {mode === 'options' && (
            <View>
              <Text style={dynamicStyles.heroTitle}>Grow Your Wealth{'\n'}Through Land</Text>

              {error && (
                <View style={dynamicStyles.errorBox}>
                  <AlertCircle size={14} color={colors.error} />
                  <Text style={dynamicStyles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity style={[dynamicStyles.socialBtn, loading && dynamicStyles.authBtnDisabled]} onPress={handleGoogleSignIn} disabled={loading}>
                <View style={dynamicStyles.socialBtnInner}>
                  {loading ? <ActivityIndicator size="small" color={colors.emerald} /> : <Text style={dynamicStyles.googleG}>G</Text>}
                  <Text style={dynamicStyles.socialBtnText}>Continue with Google</Text>
                  <ChevronRight size={16} color={colors.textMuted} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[dynamicStyles.authBtn, loading && dynamicStyles.authBtnDisabled]} onPress={() => switchMode('email')} disabled={loading}>
                <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.authBtnGrad}>
                  <Mail size={18} color='#fff' />
                  <Text style={dynamicStyles.authBtnText}>Continue with Email</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'email' && (
            <View>
              <View style={dynamicStyles.tabRow}>
                <TouchableOpacity style={[dynamicStyles.tab, emailTab === 'signin' && dynamicStyles.tabActive]} onPress={() => setEmailTab('signin')} disabled={loading}>
                  <Text style={[dynamicStyles.tabText, emailTab === 'signin' && { color: colors.emerald }]}>Sign In</Text>
                </TouchableOpacity>
              </View>

              {error && (
                <View style={dynamicStyles.errorBox}>
                  <AlertCircle size={14} color={colors.error} />
                  <Text style={dynamicStyles.errorText}>{error}</Text>
                </View>
              )}

              <View style={dynamicStyles.inputGroup}>
                <View style={dynamicStyles.inputWrapper}>
                  <Mail size={16} color={colors.textMuted} />
                  <TextInput style={dynamicStyles.input} placeholder='Email' keyboardType='email-address' autoCapitalize='none' value={email} onChangeText={setEmail} editable={!loading} />
                </View>
              </View>

              <View style={dynamicStyles.inputGroup}>
                <View style={dynamicStyles.inputWrapper}>
                  <Eye size={16} color={colors.textMuted} />
                  <TextInput style={dynamicStyles.input} placeholder='Password' secureTextEntry={!showPassword} value={password} onChangeText={setPassword} editable={!loading} />
                </View>
              </View>

              <TouchableOpacity style={[dynamicStyles.authBtn, loading && dynamicStyles.authBtnDisabled]} onPress={handleSignIn} disabled={loading}>
                <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.authBtnGrad}>
                  {loading ? <ActivityIndicator color='#fff' /> : <Text style={dynamicStyles.authBtnText}>Sign In</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flexGrow: 1, padding: 24, paddingTop: 52 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: colors.border },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    logoText: { color: '#fff', fontSize: 14, fontWeight: '900' },
    brandName: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
    heroTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', lineHeight: 34, marginBottom: 20 },
    tabRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    tab: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
    tabActive: { borderColor: colors.emerald },
    tabText: { color: colors.textMuted, fontWeight: '700' },
    errorBox: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginBottom: 16 },
    errorText: { color: colors.error, fontSize: 13, flex: 1 },
    socialBtn: { backgroundColor: colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    socialBtnInner: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
    googleG: { fontSize: 18, fontWeight: '800', color: '#4285F4', width: 24, textAlign: 'center' },
    socialBtnText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
    authBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
    authBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
    authBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    authBtnDisabled: { opacity: 0.6 },
    inputGroup: { marginBottom: 16 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgInput, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 14 },
    input: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  });
}
