import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, StatusBar, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const { colors, isDark } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validatePassword = (pw: string) => {
    return pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[0-9]/.test(pw) &&
      /[!@#$%^&*]/.test(pw);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!validatePassword(newPassword)) {
      setError('Password must be 8+ chars with uppercase, number, and symbol.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        router.replace('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
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
        <Text style={dynamicStyles.heroTitle}>Create New Password</Text>
        <Text style={dynamicStyles.heroSub}>
          Please enter your new password below. Ensure it is strong and secure.
        </Text>

        {error && (
          <View style={dynamicStyles.errorBox}>
            <AlertCircle size={16} color={colors.error} />
            <Text style={dynamicStyles.errorText}>{error}</Text>
          </View>
        )}

        {success ? (
          <View style={dynamicStyles.successBox}>
            <Check size={24} color={colors.emerald} />
            <Text style={dynamicStyles.successTitle}>Password reset successful!</Text>
            <Text style={dynamicStyles.successText}>
              You can now log in with your new password. Redirecting to login...
            </Text>
          </View>
        ) : (
          <View style={dynamicStyles.form}>
            <View style={dynamicStyles.inputContainer}>
              <Text style={dynamicStyles.inputLabel}>New Password</Text>
              <View style={dynamicStyles.inputWrapper}>
                <Lock size={18} color={colors.textMuted} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={dynamicStyles.inputContainer}>
              <Text style={dynamicStyles.inputLabel}>Confirm Password</Text>
              <View style={dynamicStyles.inputWrapper}>
                <Lock size={18} color={colors.textMuted} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!loading}
                />
              </View>
            </View>

            <TouchableOpacity style={dynamicStyles.mainBtn} onPress={handleResetPassword} disabled={loading}>
              <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.mainBtnGrad}>
                {loading ? <ActivityIndicator color="#000" /> : (
                  <Text style={dynamicStyles.mainBtnText}>Reset Password</Text>
                )}
              </LinearGradient>
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
    scroll: { paddingHorizontal: 24, paddingTop: 80 },
    heroTitle: { color: colors.textPrimary, fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 40, marginBottom: 12 },
    heroSub: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 32 },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
    errorText: { color: colors.error, fontSize: 13, fontWeight: '600', flex: 1 },
    successBox: { backgroundColor: colors.bgCard, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: colors.emerald + '33', alignItems: 'center' },
    successTitle: { color: colors.emerald, fontSize: 20, fontWeight: '800', marginBottom: 8, marginTop: 12 },
    successText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    form: { gap: 20 },
    inputContainer: { gap: 8 },
    inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: colors.border, gap: 12 },
    input: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    mainBtn: { borderRadius: 18, overflow: 'hidden', marginTop: 12 },
    mainBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60 },
    mainBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  });
}
