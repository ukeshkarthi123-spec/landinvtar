import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, StatusBar, Image, Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Mail, ChevronRight, Eye, EyeOff, ArrowLeft, AlertCircle, Lock, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { finalizeSupabaseAuthFromUrl, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, profile, refreshProfile } = useApp();
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handleGoogleSignIn = async () => {
    console.log('[Google Auth] Initializing Google Sign-In flow...');
    setLoading(true);
    setError(null);
    try {
      // 1. Resolve redirect URI
      const scheme = 'investland';
      const redirectTo = AuthSession.makeRedirectUri({ scheme, path: 'login' });
      console.log('[Google Auth] Redirect URI:', redirectTo);

      // 2. Start Supabase OAuth session
      console.log('[Google Auth] Requesting OAuth URL from Supabase...');
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
          },
        },
      });

      if (signInError) {
        console.error('[Google Auth] Supabase OAuth Error:', signInError);
        throw signInError;
      }
      if (!data?.url) {
        console.error('[Google Auth] No OAuth URL returned from Supabase');
        throw new Error('OAuth URL not returned');
      }

      console.log('[Google Auth] Opening browser session at:', data.url);
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
        showInRecents: true,
        preferEphemeralSession: false,
      });
      console.log('[Google Auth] WebBrowser result type:', result.type);

      if (result.type === 'success' && result.url) {
        console.log('[Google Auth] Browser completed with callback URL:', result.url);
        const session = await finalizeSupabaseAuthFromUrl(result.url, '[Google Auth]');
        console.log('[Google Auth] Session established for user:', session?.user?.email);
        await refreshProfile();
        if (isMounted.current) {
          router.replace('/(tabs)');
        }
      } else if (result.type === 'cancel') {
        console.log('[Google Auth] User cancelled the browser session.');
      } else if (result.type === 'dismiss') {
        console.log('[Google Auth] Browser session was dismissed.');
      } else {
        const fallbackUrl = await Linking.getInitialURL();
        if (fallbackUrl) {
          console.log('[Google Auth] Falling back to initial URL:', fallbackUrl);
          const session = await finalizeSupabaseAuthFromUrl(fallbackUrl, '[Google Auth]');
          console.log('[Google Auth] Session established from fallback URL for user:', session?.user?.email);
          await refreshProfile();
        } else {
          throw new Error('Google authentication completed without a session');
        }
      }
    } catch (err: any) {
      console.error('[Google Auth] Fatal Exception:', err);
      setError(err?.message || 'Google sign-in failed');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || (!isSignIn && !password) || (isSignIn && !password)) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isSignIn) {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (err) throw err;
      } else {
        if (!name.trim()) throw new Error('Please enter your name.');
        const { error: err } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { name: name.trim() } }
        });
        if (err) throw err;
        Alert.alert('Success', 'Account created! Please check your email for verification.');
        setIsSignIn(true);
      }
      await refreshProfile();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && profile) {
      const isAdmin = profile.is_admin || (profile as any).role === 'admin';
      router.replace(isAdmin ? '/admin' : '/(tabs)');
    }
  }, [isAuthenticated, profile]);

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <KeyboardAvoidingView style={dynamicStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient colors={[colors.bg, colors.bg]} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={dynamicStyles.scroll} showsVerticalScrollIndicator={false}>
        <View style={dynamicStyles.header}>
            <LinearGradient
                colors={colors.gradientGreen}
                style={dynamicStyles.logoCircle}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Text style={dynamicStyles.logoText}>IL</Text>
            </LinearGradient>
            <Text style={dynamicStyles.brandName}><Text style={{ color: colors.emerald }}>Invest</Text><Text style={{ color: colors.textPrimary }}>Land</Text></Text>
        </View>

        <Text style={dynamicStyles.heroTitle}>
            {isSignIn ? 'Welcome Back,\nInvestor' : 'Start Your Land\nJourney Today'}
        </Text>
        <Text style={dynamicStyles.heroSub}>
            {isSignIn ? 'Sign in to manage your fractional holdings.' : 'Create an account and start investing with ₹500.'}
        </Text>

        <View style={dynamicStyles.tabRow}>
            <TouchableOpacity
                style={[dynamicStyles.tab, isSignIn && dynamicStyles.tabActive]}
                onPress={() => setIsSignIn(true)}
            >
                <Text style={[dynamicStyles.tabText, isSignIn && { color: colors.emerald }]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[dynamicStyles.tab, !isSignIn && dynamicStyles.tabActive]}
                onPress={() => setIsSignIn(false)}
            >
                <Text style={[dynamicStyles.tabText, !isSignIn && { color: colors.emerald }]}>Register</Text>
            </TouchableOpacity>
        </View>

        {error && (
            <View style={dynamicStyles.errorBox}>
                <AlertCircle size={16} color={colors.error} />
                <Text style={dynamicStyles.errorText}>{error}</Text>
            </View>
        )}

        <View style={dynamicStyles.form}>
            {!isSignIn && (
                <View style={dynamicStyles.inputContainer}>
                    <Text style={dynamicStyles.inputLabel}>Full Name</Text>
                    <View style={dynamicStyles.inputWrapper}>
                        <TextInput
                            style={dynamicStyles.input}
                            placeholder="John Doe"
                            placeholderTextColor={colors.textMuted}
                            value={name}
                            onChangeText={setName}
                        />
                    </View>
                </View>
            )}

            <View style={dynamicStyles.inputContainer}>
                <Text style={dynamicStyles.inputLabel}>Email Address</Text>
                <View style={dynamicStyles.inputWrapper}>
                    <Mail size={18} color={colors.textMuted} />
                    <TextInput
                        style={dynamicStyles.input}
                        placeholder="name@email.com"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />
                </View>
            </View>

            <View style={dynamicStyles.inputContainer}>
                <Text style={dynamicStyles.inputLabel}>Password</Text>
                <View style={dynamicStyles.inputWrapper}>
                    <Lock size={18} color={colors.textMuted} />
                    <TextInput
                        style={dynamicStyles.input}
                        placeholder="••••••••"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
                    </TouchableOpacity>
                </View>
            </View>

            {isSignIn && (
                <TouchableOpacity style={dynamicStyles.forgotBtn} onPress={() => router.push('/forgot-password')}>
                    <Text style={dynamicStyles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity
              style={dynamicStyles.mainBtn}
              onPress={handleAuth}
              disabled={loading}
            >
                <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.mainBtnGrad}>
                    {loading ? <ActivityIndicator color="#000" /> : (
                        <>
                            <Text style={dynamicStyles.mainBtnText}>
                              {isSignIn ? 'Sign In' : 'Create Account'}
                            </Text>
                            <ArrowRight size={18} color="#000" />
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </View>

        <View style={dynamicStyles.dividerRow}>
            <View style={dynamicStyles.divider} />
            <Text style={dynamicStyles.dividerText}>OR</Text>
            <View style={dynamicStyles.divider} />
        </View>

        <TouchableOpacity
          style={dynamicStyles.googleBtn}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
            <Image
              source={{ uri: 'https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png' }}
              style={dynamicStyles.googleIcon}
            />
            <Text style={dynamicStyles.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={dynamicStyles.disclaimer}>
            By continuing, you agree to InvestLand's Terms of Service and Privacy Policy.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: 24, paddingTop: 60 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 40 },
    logoCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    logoText: { color: '#000', fontSize: 18, fontWeight: '900' },
    brandName: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    heroTitle: { color: colors.textPrimary, fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 40, marginBottom: 12 },
    heroSub: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 32 },
    tabRow: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 16, padding: 6, gap: 4, marginBottom: 32, borderWidth: 1, borderColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    tabActive: { backgroundColor: isDark ? '#212932' : '#F1F5F9' },
    tabText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
    errorText: { color: colors.error, fontSize: 13, fontWeight: '600', flex: 1 },
    form: { gap: 20 },
    inputContainer: { gap: 8 },
    inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: colors.border, gap: 12 },
    input: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    forgotBtn: { alignSelf: 'flex-end', marginTop: -8 },
    forgotText: { color: colors.emerald, fontSize: 13, fontWeight: '700' },
    mainBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 12 },
    mainBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, gap: 10 },
    mainBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 32 },
    divider: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
    googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 18, backgroundColor: isDark ? '#FFFFFF' : '#F1F5F9', gap: 12, borderWidth: isDark ? 0 : 1, borderColor: colors.border },
    googleIcon: { width: 24, height: 24 },
    googleBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
    disclaimer: { color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 32 },
  });
}
