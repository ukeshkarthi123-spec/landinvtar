import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, StatusBar, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Mail, ArrowLeft, AlertCircle, ArrowRight } from 'lucide-react-native';
import * as AuthSession from 'expo-auth-session';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetRequest = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'myapp',
        path: 'reset-password',
      });

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });

      if (resetError) throw resetError;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <KeyboardAvoidingView style={dynamicStyles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient colors={[colors.bg, colors.bg]} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={dynamicStyles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={dynamicStyles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={dynamicStyles.heroTitle}>Forgot Password?</Text>
        <Text style={dynamicStyles.heroSub}>
          Enter your registered email address and we'll send you a link to reset your password.
        </Text>

        {error && (
          <View style={dynamicStyles.errorBox}>
            <AlertCircle size={16} color={colors.error} />
            <Text style={dynamicStyles.errorText}>{error}</Text>
          </View>
        )}

        {success ? (
          <View style={dynamicStyles.successBox}>
            <Text style={dynamicStyles.successTitle}>Reset link sent!</Text>
            <Text style={dynamicStyles.successText}>
              Please check your email (including spam folder) for the reset link.
            </Text>
            <TouchableOpacity style={dynamicStyles.mainBtn} onPress={() => router.replace('/login')}>
              <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.mainBtnGrad}>
                <Text style={dynamicStyles.mainBtnText}>Back to Login</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={dynamicStyles.form}>
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
                  editable={!loading}
                />
              </View>
            </View>

            <TouchableOpacity style={dynamicStyles.mainBtn} onPress={handleResetRequest} disabled={loading}>
              <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.mainBtnGrad}>
                {loading ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Text style={dynamicStyles.mainBtnText}>Send Reset Link</Text>
                    <ArrowRight size={18} color="#000" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={dynamicStyles.loginLink} onPress={() => router.back()}>
              <Text style={dynamicStyles.loginLinkText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingHorizontal: 24, paddingTop: 60 },
    backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', marginBottom: 32, borderWidth: 1, borderColor: colors.border },
    heroTitle: { color: colors.textPrimary, fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 40, marginBottom: 12 },
    heroSub: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 32 },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
    errorText: { color: colors.error, fontSize: 13, fontWeight: '600', flex: 1 },
    successBox: { backgroundColor: colors.bgCard, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: colors.emerald + '33' },
    successTitle: { color: colors.emerald, fontSize: 20, fontWeight: '800', marginBottom: 8 },
    successText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 },
    form: { gap: 20 },
    inputContainer: { gap: 8 },
    inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: colors.border, gap: 12 },
    input: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    mainBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 12 },
    mainBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, gap: 10 },
    mainBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
    loginLink: { alignSelf: 'center', marginTop: 20 },
    loginLinkText: { color: colors.emerald, fontSize: 14, fontWeight: '700' },
  });
}
