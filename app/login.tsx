import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  Animated, ActivityIndicator,
} from 'react-native';
import { createURL } from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Mail, ChevronRight, Eye, EyeOff, ArrowLeft, AlertCircle, UserPlus } from 'lucide-react-native';

WebBrowser.maybeCompleteAuthSession();
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

type AuthMode = 'options' | 'email' | 'forgot' | 'mfa';
type EmailTab = 'signin' | 'signup';

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, profile: appProfile } = useApp();
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
  const modeChangeId = useRef(0);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);
    console.log('[Auth] Attempting sign in for:', email.trim().toLowerCase());
    console.log('[Auth] Using Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'Configured' : 'MISSING');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        console.error('[Auth] Sign in error response:', JSON.stringify(authError, null, 2));
        if (authError.message.includes('Invalid login credentials') || authError.status === 400) {
          setError('Invalid email or password.');
        } else if (authError.message.includes('Network request failed')) {
          setError('Network error: Please check your internet connection or ensure the server is reachable.');
        } else {
          setError(authError.message);
        }
        return;
      }

      console.log('[Auth] Session created for user:', data.user?.id);

      if (data.session) {
        const { data: factors, error: mfaError } = await supabase.auth.mfa.listFactors();
        if (mfaError) console.error('[Auth] MFA list factors error:', mfaError);

        const verifiedFactor = factors?.all.find(f => f.factor_type === 'totp' && f.status === 'verified');

        if (verifiedFactor) {
          console.log('[Auth] MFA required, factor ID:', verifiedFactor.id);
          setMfaFactorId(verifiedFactor.id);
          switchMode('mfa');
          return;
        }
      }

      console.log('[Auth] Fetching user profile...');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) console.error('[Auth] Profile fetch error:', profileError);

      console.log('[Auth] Authentication successful');

      // JIT Creation if missing on mobile too
      let finalProfile = profile;
      if (!profile && !profileError) {
        const isAdminEmail = email.toLowerCase() === 'admin24@gmail.com';
        const { data: newProfile } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email?.toLowerCase(),
            name: data.user.user_metadata?.name || data.user.user_metadata?.full_name || email.split('@')[0],
            role: isAdminEmail ? 'admin' : 'user',
            is_admin: isAdminEmail
          }, { onConflict: 'id' })
          .select('role, is_admin')
          .single();
        finalProfile = newProfile;
      }

      const isAdmin = finalProfile?.role === 'admin' || finalProfile?.role === 'super_admin' || finalProfile?.is_admin;
      if (isAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('Login: Sign in error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    const changeId = ++modeChangeId.current;
    fadeAnim.stopAnimation(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        if (modeChangeId.current !== changeId) return;
        setMode(newMode);
        setError(null);
        setInfo(null);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    });
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
      );
      if (resetError) {
        setError(resetError.message);
      } else {
        setInfo('Password reset link sent! Check your email.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !validateEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim() },
        },
      });

      if (authError) {
        if (authError.message.includes('User already registered') || authError.status === 400) {
          setError('An account with this email already exists.');
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.user && data.session) {
        // Success
      } else if (data.user) {
        setInfo('Account created! Please check your email to confirm.');
        setEmailTab('signin');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaFactorId || mfaCode.length !== 6) return;

    setLoading(true);
    setError(null);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });

      if (verifyError) throw verifyError;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.is_admin;
      if (isAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectTo = createURL('login');
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError) throw oauthError;

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

        if (res.type === 'success' && res.url) {
          const queryString = res.url.includes('#') ? res.url.split('#')[1] : res.url.split('?')[1];
          if (queryString) {
            const params = queryString.split('&').reduce((acc: any, curr) => {
              const [key, value] = curr.split('=');
              if (key && value) acc[key] = value;
              return acc;
            }, {});

            if (params.access_token && params.refresh_token) {
              await supabase.auth.setSession({
                access_token: params.access_token,
                refresh_token: params.refresh_token,
              });
            }
          }

          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          if (sessionData.session) {
            router.replace('/(tabs)');
          }
        }
      }
    } catch (err) {
      console.error('OAuth Error:', err);
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && appProfile) {
      if (appProfile.is_admin || (appProfile as any).role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, appProfile]);

  const gradientColors: [string, string, string] = isDark
    ? [colors.bg, '#0D1A13', colors.bg]
    : [colors.bg, '#FFFFFF', colors.bg];

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <KeyboardAvoidingView style={dynamicStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      <View style={dynamicStyles.decorCircle1} />
      <View style={dynamicStyles.decorCircle2} />

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
              <View style={dynamicStyles.illustrationCard}>
                <LinearGradient colors={['rgba(22,199,132,0.08)', 'transparent']} style={dynamicStyles.illustBg}>
                  <View style={dynamicStyles.landscape}>
                    <View style={[dynamicStyles.mountain, isDark && { backgroundColor: colors.bgCard2 }]} />
                    <View style={[dynamicStyles.mountain2, isDark && { backgroundColor: colors.bgElevated }]} />
                    <View style={[dynamicStyles.building, isDark && { backgroundColor: colors.bgCard2 }]} />
                    <View style={[dynamicStyles.building2, isDark && { backgroundColor: colors.bgElevated }]} />
                    <View style={[dynamicStyles.building3, isDark && { backgroundColor: colors.bgCard }]} />
                    <View style={dynamicStyles.ground} />
                    <View style={dynamicStyles.tree} />
                    <View style={dynamicStyles.tree2} />
                  </View>
                  <View style={dynamicStyles.statsOverlay}>
                    <View style={dynamicStyles.floatingCard}>
                      <Text style={dynamicStyles.floatingValue}>+22.4%</Text>
                      <Text style={dynamicStyles.floatingLabel}>Annual Returns</Text>
                    </View>
                    <View style={dynamicStyles.floatingCard2}>
                      <Text style={dynamicStyles.floatingValue}>₹500</Text>
                      <Text style={dynamicStyles.floatingLabel}>Start Today</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>

              <Text style={dynamicStyles.heroTitle}>Grow Your Wealth{'\n'}Through Land</Text>
              <Text style={dynamicStyles.heroSub}>India's most trusted platform for fractional land investments</Text>

              <View style={dynamicStyles.trustRow}>
                {['SEBI Compliant', 'KYC Secured', 'Bank-grade Security'].map(t => (
                  <View key={t} style={dynamicStyles.trustBadge}>
                    <View style={dynamicStyles.trustDot} />
                    <Text style={dynamicStyles.trustText}>{t}</Text>
                  </View>
                ))}
              </View>

              <Text style={dynamicStyles.loginTitle}>Get Started</Text>
              <Text style={dynamicStyles.loginSub}>Create an account or sign in below</Text>

              {error && (
                <View style={dynamicStyles.errorBox}>
                  <AlertCircle size={14} color={colors.error} />
                  <Text style={dynamicStyles.errorText}>{error}</Text>
                </View>
              )}
              {info && (
                <View style={[dynamicStyles.errorBox, dynamicStyles.infoBox]}>
                  <AlertCircle size={14} color={colors.emerald} />
                  <Text style={dynamicStyles.infoText}>{info}</Text>
                </View>
              )}

              <TouchableOpacity style={[dynamicStyles.socialBtn, loading && dynamicStyles.authBtnDisabled]} onPress={handleGoogleSignIn} disabled={loading}>
                <View style={dynamicStyles.socialBtnInner}>
                  <Text style={dynamicStyles.googleG}>G</Text>
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

              <Text style={dynamicStyles.termsText}>
                By proceeding, you agree to our <Text style={dynamicStyles.termsLink}>Terms</Text> and <Text style={dynamicStyles.termsLink}>Privacy</Text>
              </Text>
            </View>
          )}

          {mode === 'email' && (
            <View>
              <View style={dynamicStyles.tabRow}>
                <TouchableOpacity style={[dynamicStyles.tab, emailTab === 'signin' && dynamicStyles.tabActive]} onPress={() => setEmailTab('signin')} disabled={loading}>
                  <Text style={[dynamicStyles.tabText, emailTab === 'signin' && { color: colors.emerald }]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[dynamicStyles.tab, emailTab === 'signup' && dynamicStyles.tabActive]} onPress={() => setEmailTab('signup')} disabled={loading}>
                  <Text style={[dynamicStyles.tabText, emailTab === 'signup' && { color: colors.emerald }]}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              {error && (
                <View style={dynamicStyles.errorBox}>
                  <AlertCircle size={14} color={colors.error} />
                  <Text style={dynamicStyles.errorText}>{error}</Text>
                </View>
              )}
              {info && (
                <View style={[dynamicStyles.errorBox, dynamicStyles.infoBox]}>
                  <AlertCircle size={14} color={colors.emerald} />
                  <Text style={dynamicStyles.infoText}>{info}</Text>
                </View>
              )}

              {emailTab === 'signup' && (
                <View style={dynamicStyles.inputGroup}>
                  <View style={dynamicStyles.inputWrapper}>
                    <UserPlus size={16} color={colors.textMuted} />
                    <TextInput style={dynamicStyles.input} placeholder='Full Name' value={name} onChangeText={setName} editable={!loading} />
                  </View>
                </View>
              )}

              <View style={dynamicStyles.inputGroup}>
                <View style={dynamicStyles.inputWrapper}>
                  <Mail size={16} color={colors.textMuted} />
                  <TextInput style={dynamicStyles.input} placeholder='Email' keyboardType='email-address' autoCapitalize='none' value={email} onChangeText={v => { setEmail(v); setError(null); }} editable={!loading} />
                </View>
              </View>

              <View style={dynamicStyles.inputGroup}>
                <View style={dynamicStyles.inputWrapper}>
                  <Eye size={16} color={colors.textMuted} />
                  <TextInput style={dynamicStyles.input} placeholder='Password' secureTextEntry={!showPassword} value={password} onChangeText={v => { setPassword(v); setError(null); }} editable={!loading} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={loading}>
                    {showPassword ? <EyeOff size={16} color={colors.textMuted} /> : <Eye size={16} color={colors.textMuted} />}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={[dynamicStyles.authBtn, loading && dynamicStyles.authBtnDisabled]} onPress={emailTab === 'signin' ? handleSignIn : handleSignUp} disabled={loading}>
                <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.authBtnGrad}>
                  {loading ? <ActivityIndicator color='#fff' /> : <Text style={dynamicStyles.authBtnText}>{emailTab === 'signin' ? 'Sign In' : 'Create Account'}</Text>}
                </LinearGradient>
              </TouchableOpacity>

              {emailTab === 'signin' && (
                <TouchableOpacity onPress={() => switchMode('forgot')} disabled={loading} style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={dynamicStyles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {mode === 'forgot' && (
            <View>
              <Text style={dynamicStyles.loginTitle}>Reset Password</Text>
              <View style={dynamicStyles.inputGroup}>
                <View style={dynamicStyles.inputWrapper}>
                  <Mail size={16} color={colors.textMuted} />
                  <TextInput style={dynamicStyles.input} placeholder='Email' value={email} onChangeText={v => { setEmail(v); setError(null); }} editable={!loading} />
                </View>
              </View>
              <TouchableOpacity style={[dynamicStyles.authBtn, loading && dynamicStyles.authBtnDisabled]} onPress={handleForgotPassword} disabled={loading}>
                <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.authBtnGrad}>
                  {loading ? <ActivityIndicator color='#fff' /> : <Text style={dynamicStyles.authBtnText}>Send Link</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchMode('email')} disabled={loading} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={dynamicStyles.forgotText}>Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'mfa' && (
            <View>
              <Text style={dynamicStyles.loginTitle}>Two-Factor Auth</Text>
              <Text style={dynamicStyles.loginSub}>Enter the 6-digit code from your authenticator app.</Text>

              {error && (
                <View style={dynamicStyles.errorBox}>
                  <AlertCircle size={14} color={colors.error} />
                  <Text style={dynamicStyles.errorText}>{error}</Text>
                </View>
              )}

              <View style={dynamicStyles.inputGroup}>
                <View style={dynamicStyles.inputWrapper}>
                  <TextInput
                    style={[dynamicStyles.input, { textAlign: 'center', fontSize: 24, fontWeight: '700', letterSpacing: 8 }]}
                    placeholder='000000'
                    keyboardType='number-pad'
                    maxLength={6}
                    value={mfaCode}
                    onChangeText={setMfaCode}
                    editable={!loading}
                  />
                </View>
              </View>
              <TouchableOpacity style={[dynamicStyles.authBtn, loading && dynamicStyles.authBtnDisabled]} onPress={handleVerifyMfa} disabled={loading || mfaCode.length !== 6}>
                <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.authBtnGrad}>
                  {loading ? <ActivityIndicator color='#fff' /> : <Text style={dynamicStyles.authBtnText}>Verify & Sign In</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchMode('email')} disabled={loading} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={dynamicStyles.forgotText}>Back to Sign In</Text>
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
    decorCircle1: { position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: colors.emerald + '08' },
    decorCircle2: { position: 'absolute', bottom: 60, left: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.forest + '08' },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: colors.border },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    logoText: { color: '#fff', fontSize: 14, fontWeight: '900' },
    brandName: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
    illustrationCard: { borderRadius: 24, overflow: 'hidden', height: 180, marginBottom: 20, borderWidth: 1, borderColor: colors.glassBorder },
    illustBg: { flex: 1, padding: 16 },
    landscape: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', position: 'relative' },
    mountain: { position: 'absolute', bottom: 40, left: 20, width: 80, height: 60, backgroundColor: isDark ? colors.bgCard2 : '#E2E8F0', borderRadius: 40 },
    mountain2: { position: 'absolute', bottom: 40, left: 60, width: 100, height: 80, backgroundColor: isDark ? colors.bgElevated : '#CBD5E1' },
    building: { position: 'absolute', bottom: 40, right: 30, width: 30, height: 80, backgroundColor: isDark ? colors.bgCard2 : '#E2E8F0', borderRadius: 4 },
    building2: { position: 'absolute', bottom: 40, right: 70, height: 60, width: 25, backgroundColor: isDark ? colors.bgElevated : '#CBD5E1' },
    building3: { position: 'absolute', bottom: 40, right: 110, height: 100, width: 35, backgroundColor: isDark ? colors.bgCard : '#F1F5F9' },
    ground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, backgroundColor: colors.emerald + '22', borderRadius: 8 },
    tree: { position: 'absolute', bottom: 38, left: 140, width: 10, height: 30, backgroundColor: colors.emerald + '66', borderRadius: 5 },
    tree2: { position: 'absolute', bottom: 38, left: 165, width: 10, height: 20, backgroundColor: colors.emerald + '66', borderRadius: 5 },
    statsOverlay: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', gap: 10 },
    floatingCard: { flex: 1, backgroundColor: colors.glass, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.glassBorder },
    floatingCard2: { flex: 1, backgroundColor: colors.emeraldGlow2, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.glassBorder },
    floatingValue: { color: colors.emerald, fontSize: 16, fontWeight: '800' },
    floatingLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '500', marginTop: 2 },
    heroTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', lineHeight: 34, marginBottom: 8 },
    heroSub: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 14 },
    trustRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
    trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
    trustDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.emerald },
    trustText: { color: colors.textSecondary, fontSize: 11, fontWeight: '500' },
    loginTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 4 },
    loginSub: { color: colors.textSecondary, fontSize: 13, marginBottom: 20 },
    tabRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    tab: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
    tabActive: { borderColor: colors.emerald },
    tabText: { color: colors.textMuted, fontWeight: '700' },
    errorBox: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginBottom: 16 },
    infoBox: { backgroundColor: colors.emerald + '10' },
    errorText: { color: colors.error, fontSize: 13, flex: 1 },
    infoText: { color: colors.emerald, fontSize: 13, flex: 1 },
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
    forgotText: { color: colors.emerald, fontSize: 13, fontWeight: '600' },
    termsText: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 16 },
    termsLink: { color: colors.emerald, fontWeight: '600' },
  });
}
