import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, Platform, KeyboardAvoidingView
} from 'react-native';
import { Lock, KeyRound, Eye, EyeOff, Check, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';

export default function ChangePasswordScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useApp();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validatePassword = (pw: string) => {
    return pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[0-9]/.test(pw) &&
      /[!@#$%^&*]/.test(pw);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (!validatePassword(newPassword)) {
      setError('Password must be 8+ chars with uppercase, number, and symbol');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Verify current password by signing in
      if (!profile?.email) throw new Error('User email not found');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <KeyboardAvoidingView
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={dynamicStyles.header}>
        <TouchableOpacity style={dynamicStyles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Change Password</Text>
      </View>

      <ScrollView contentContainerStyle={dynamicStyles.scroll} keyboardShouldPersistTaps="handled">
        <View style={dynamicStyles.card}>
          <Text style={dynamicStyles.instructionText}>
            Protect your account with a strong password.
          </Text>

          {/* Current Password */}
          <View style={dynamicStyles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>Current Password</Text>
            <View style={dynamicStyles.inputWrapper}>
              <Lock size={18} color={colors.textMuted} />
              <TextInput
                style={dynamicStyles.input}
                placeholder="Enter current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showCurrent}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                editable={!loading && !success}
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={dynamicStyles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>New Password</Text>
            <View style={dynamicStyles.inputWrapper}>
              <KeyRound size={18} color={colors.textMuted} />
              <TextInput
                style={dynamicStyles.input}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!loading && !success}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={dynamicStyles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>Confirm New Password</Text>
            <View style={dynamicStyles.inputWrapper}>
              <KeyRound size={18} color={colors.textMuted} />
              <TextInput
                style={dynamicStyles.input}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading && !success}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View style={dynamicStyles.errorBox}>
              <AlertCircle size={16} color={colors.error} />
              <Text style={dynamicStyles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={dynamicStyles.successBox}>
              <Check size={16} color={colors.emerald} />
              <Text style={dynamicStyles.successText}>Password updated successfully! Redirecting...</Text>
            </View>
          )}

          <TouchableOpacity
            style={[dynamicStyles.submitBtn, (loading || success) && { opacity: 0.7 }]}
            onPress={handleChangePassword}
            disabled={loading || success}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={dynamicStyles.submitBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.securityNote}>
          <Text style={dynamicStyles.noteText}>
            Requirements: 8+ characters, uppercase letter, number, and special character.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 16,
      paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20,
    },
    backBtn: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: colors.bgCard, alignItems: 'center',
      justifyContent: 'center', borderWidth: 1, borderColor: colors.border
    },
    headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    card: {
      backgroundColor: colors.bgCard, borderRadius: 24, padding: 24,
      borderWidth: 1, borderColor: colors.border, marginBottom: 20,
    },
    instructionText: { color: colors.textSecondary, fontSize: 14, marginBottom: 24, fontWeight: '600' },
    inputGroup: { marginBottom: 20 },
    inputLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.bgInput, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 14,
    },
    input: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    submitBtn: {
      backgroundColor: colors.emerald, borderRadius: 16,
      paddingVertical: 16, alignItems: 'center', marginTop: 10,
    },
    submitBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12,
      padding: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)'
    },
    errorText: { color: colors.error, fontSize: 13, fontWeight: '600', flex: 1 },
    successBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: 'rgba(0, 227, 140, 0.1)', borderRadius: 12,
      padding: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0, 227, 140, 0.2)'
    },
    successText: { color: colors.emerald, fontSize: 13, fontWeight: '700', flex: 1 },
    securityNote: { paddingHorizontal: 12 },
    noteText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  });
}
