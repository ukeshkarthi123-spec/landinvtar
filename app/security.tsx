import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Switch, Platform,
  Modal,
} from 'react-native';
import {
  Lock, KeyRound, Fingerprint, Eye, EyeOff, Shield,
  Bell, Check, AlertCircle, QrCode, X, Copy,
} from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { registerForPushNotificationsAsync } from '@/hooks/useNotifications';
import Toast, { ToastRef } from '@/components/Toast';

export default function SecurityScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useApp();
  const toastRef = React.useRef<ToastRef>(null);

  // Password State
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // Settings State
  const [loading, setLoading] = useState(true);
  const [twoFA, setTwoFA] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [investAlerts, setInvestAlerts] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [updatingSetting, setUpdatingSetting] = useState<string | null>(null);

  // 2FA Setup State
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaData, setMfaData] = useState<{ id: string; uri: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .single();

      if (!error && data) {
        setBiometric(data.biometrics_enabled);
        setNotifEnabled(data.push_notifications_enabled);
        setInvestAlerts(data.investment_alerts);
        setMarketingEmails(data.marketing_emails);
      }

      // Also check actual MFA status from Supabase Auth
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const isMfaEnabled = factors?.all.some(f => f.factor_type === 'totp' && f.status === 'verified');
      setTwoFA(!!isMfaEnabled);

    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: string, value: any) => {
    setUpdatingSetting(key);
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('id', profile?.id);

      if (error) throw error;

      // Update local state if successful
      if (key === 'two_factor_enabled') setTwoFA(value);
      if (key === 'biometrics_enabled') setBiometric(value);
      if (key === 'push_notifications_enabled') setNotifEnabled(value);
      if (key === 'investment_alerts') setInvestAlerts(value);
      if (key === 'marketing_emails') setMarketingEmails(value);

      toastRef.current?.show('Setting updated successfully', 'success');
    } catch (err: any) {
      toastRef.current?.show(err.message || 'Failed to update setting', 'error');
    } finally {
      setUpdatingSetting(null);
    }
  };

  const validatePassword = (pw: string) => {
    const minLength = pw.length >= 8;
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNumber = /[0-9]/.test(pw);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
    return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toastRef.current?.show('Please fill all password fields', 'error');
      return;
    }
    if (!validatePassword(newPassword)) {
      toastRef.current?.show('Password does not meet requirements', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastRef.current?.show('New passwords do not match', 'error');
      return;
    }

    setChanging(true);
    setPwError(null);
    setPwSuccess(false);

    try {
      // 1. Verify current password
      if (!profile?.email) throw new Error('User email not found');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: oldPassword,
      });

      if (signInError) {
        throw new Error('Incorrect current password');
      }

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setPwSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toastRef.current?.show('Password updated successfully', 'success');
      setTimeout(() => setPwSuccess(false), 5000);
    } catch (err: any) {
      setPwError(err.message);
      toastRef.current?.show(err.message, 'error');
    } finally {
      setChanging(false);
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (Platform.OS === 'web') {
      toastRef.current?.show('Biometric login is only available on mobile', 'error');
      return;
    }

    if (!value) {
      // Disable
      setUpdatingSetting('biometrics_enabled');
      await SecureStore.deleteItemAsync('biometrics_enabled');
      await updateSetting('biometrics_enabled', false);
      return;
    }

    // Enable
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      Alert.alert('Not Supported', 'Your device does not support biometrics or has no fingerprints/FaceID enrolled.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to enable biometric login',
    });

    if (result.success) {
      await SecureStore.setItemAsync('biometrics_enabled', 'true');
      updateSetting('biometrics_enabled', true);
    }
  };

  const handleTogglePush = async (value: boolean) => {
    setUpdatingSetting('push_notifications_enabled');
    if (!value) {
      await updateSetting('push_notifications_enabled', false);
      return;
    }

    const token = await registerForPushNotificationsAsync();
    if (token) {
      // Save token to DB
      const { error } = await supabase
        .from('user_settings')
        .update({ push_token: token, push_notifications_enabled: true, updated_at: new Date().toISOString() })
        .eq('id', profile?.id);

      if (!error) {
        setNotifEnabled(true);
        toastRef.current?.show('Push notifications enabled', 'success');
      } else {
        toastRef.current?.show('Failed to save push token', 'error');
      }
    } else {
      Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
    }
    setUpdatingSetting(null);
  };

  const handleToggle2FA = async (value: boolean) => {
    if (!value) {
      // Disable 2FA
      Alert.alert(
        'Disable 2FA',
        'Are you sure you want to disable two-factor authentication? This reduces your account security.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              // Supabase doesn't have a simple "unenroll" for TOTP via client API usually
              // unless we use MFA factors list.
              const { data: factors } = await supabase.auth.mfa.listFactors();
              const totpFactor = factors?.all.find(f => f.factor_type === 'totp' && f.status === 'verified');
              if (totpFactor) {
                await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
              }
              updateSetting('two_factor_enabled', false);
            }
          }
        ]
      );
      return;
    }

    // Enable 2FA flow
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'InvestLand',
        friendlyName: profile?.email || 'InvestLand User',
      });

      if (error) throw error;

      setMfaData({
        id: data.id,
        uri: (data.totp as any).uri || '', // Use the otpauth URI for generating the QR code
        secret: data.totp.secret,
      });
      setShowMfaModal(true);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const verifyAndEnableMfa = async () => {
    if (!mfaData || mfaCode.length !== 6) return;

    setVerifyingMfa(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaData.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaData.id,
        challengeId: challengeData.id,
        code: mfaCode,
      });

      if (verifyError) throw verifyError;

      setShowMfaModal(false);
      setMfaData(null);
      setMfaCode('');
      updateSetting('two_factor_enabled', true);
      Alert.alert('Success', 'Two-factor authentication has been enabled!');
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'The code you entered is invalid.');
    } finally {
      setVerifyingMfa(false);
    }
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <ScreenHeader title="Security & Privacy" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scroll}>
        {/* Password Section */}
        <Text style={dynamicStyles.sectionTitle}>Change Password</Text>
        <View style={dynamicStyles.card}>
          <View style={dynamicStyles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>Current Password</Text>
            <View style={dynamicStyles.inputWrapper}>
              <Lock size={16} color={colors.textMuted} />
              <TextInput
                style={dynamicStyles.input}
                placeholder="Enter current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showOld}
                value={oldPassword}
                onChangeText={setOldPassword}
              />
              <TouchableOpacity onPress={() => setShowOld(!showOld)}>
                {showOld ? <EyeOff size={16} color={colors.textMuted} /> : <Eye size={16} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={dynamicStyles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>New Password</Text>
            <View style={dynamicStyles.inputWrapper}>
              <KeyRound size={16} color={colors.textMuted} />
              <TextInput
                style={dynamicStyles.input}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff size={16} color={colors.textMuted} /> : <Eye size={16} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={dynamicStyles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>Confirm New Password</Text>
            <View style={dynamicStyles.inputWrapper}>
              <KeyRound size={16} color={colors.textMuted} />
              <TextInput
                style={dynamicStyles.input}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff size={16} color={colors.textMuted} /> : <Eye size={16} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>

          {pwError && (
            <View style={dynamicStyles.errorBox}>
              <AlertCircle size={14} color={colors.error} />
              <Text style={dynamicStyles.errorText}>{pwError}</Text>
            </View>
          )}
          {pwSuccess && (
            <View style={dynamicStyles.successBox}>
              <Check size={14} color={colors.emerald} />
              <Text style={dynamicStyles.successText}>Password updated!</Text>
            </View>
          )}

          <TouchableOpacity
            style={[dynamicStyles.actionBtn, changing && dynamicStyles.actionBtnDisabled]}
            onPress={handleChangePassword}
            disabled={changing}
            activeOpacity={0.85}
          >
            {changing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dynamicStyles.actionBtnText}>Update Password</Text>}
          </TouchableOpacity>
        </View>

        {/* Security Settings */}
        <Text style={dynamicStyles.sectionTitle}>Two-Factor Authentication</Text>
        <View style={dynamicStyles.card}>
          <View style={dynamicStyles.settingRow}>
            <View style={dynamicStyles.settingIcon}>
              <Shield size={18} color={colors.emerald} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.settingLabel}>2FA via Authenticator</Text>
              <Text style={dynamicStyles.settingHint}>Add an extra layer of security with TOTP</Text>
            </View>
            {updatingSetting === 'two_factor_enabled' ? (
              <ActivityIndicator size="small" color={colors.emerald} />
            ) : (
              <Switch
                value={twoFA}
                onValueChange={handleToggle2FA}
                trackColor={{ false: colors.border, true: colors.emerald + '66' }}
                thumbColor={twoFA ? colors.emerald : colors.textMuted}
              />
            )}
          </View>
          <View style={dynamicStyles.divider} />
          <View style={dynamicStyles.settingRow}>
            <View style={dynamicStyles.settingIcon}>
              <Fingerprint size={18} color='#60A5FA' />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.settingLabel}>Biometric Login</Text>
              <Text style={dynamicStyles.settingHint}>Use fingerprint or face ID to sign in</Text>
            </View>
            {updatingSetting === 'biometrics_enabled' ? (
              <ActivityIndicator size="small" color={colors.emerald} />
            ) : (
              <Switch
                value={biometric}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: colors.border, true: colors.emerald + '66' }}
                thumbColor={biometric ? colors.emerald : colors.textMuted}
              />
            )}
          </View>
        </View>

        {/* Privacy Section */}
        <Text style={dynamicStyles.sectionTitle}>Privacy & Notifications</Text>
        <View style={dynamicStyles.card}>
          <View style={dynamicStyles.settingRow}>
            <View style={dynamicStyles.settingIcon}>
              <Bell size={18} color={colors.emerald} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.settingLabel}>Push Notifications</Text>
              <Text style={dynamicStyles.settingHint}>Receive investment and wallet alerts</Text>
            </View>
            {updatingSetting === 'push_notifications_enabled' ? (
              <ActivityIndicator size="small" color={colors.emerald} />
            ) : (
              <Switch
                value={notifEnabled}
                onValueChange={handleTogglePush}
                trackColor={{ false: colors.border, true: colors.emerald + '66' }}
                thumbColor={notifEnabled ? colors.emerald : colors.textMuted}
              />
            )}
          </View>
          <View style={dynamicStyles.divider} />
          <View style={dynamicStyles.settingRow}>
            <View style={dynamicStyles.settingIcon}>
              <Bell size={18} color='#FBBF24' />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.settingLabel}>Investment Alerts</Text>
              <Text style={dynamicStyles.settingHint}>Notify on new projects and ROI updates</Text>
            </View>
            <Switch
              value={investAlerts}
              onValueChange={(v) => updateSetting('investment_alerts', v)}
              trackColor={{ false: colors.border, true: colors.emerald + '66' }}
              thumbColor={investAlerts ? colors.emerald : colors.textMuted}
              disabled={updatingSetting === 'investment_alerts'}
            />
          </View>
          <View style={dynamicStyles.divider} />
          <View style={dynamicStyles.settingRow}>
            <View style={dynamicStyles.settingIcon}>
              <Bell size={18} color='#A78BFA' />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.settingLabel}>Marketing Emails</Text>
              <Text style={dynamicStyles.settingHint}>Promotional offers and newsletters</Text>
            </View>
            <Switch
              value={marketingEmails}
              onValueChange={(v) => updateSetting('marketing_emails', v)}
              trackColor={{ false: colors.border, true: colors.emerald + '66' }}
              thumbColor={marketingEmails ? colors.emerald : colors.textMuted}
              disabled={updatingSetting === 'marketing_emails'}
            />
          </View>
        </View>

        <View style={dynamicStyles.infoCard}>
          <Shield size={14} color={colors.emerald} />
          <Text style={dynamicStyles.infoText}>
            Your data is protected with bank-grade encryption. We never share your personal information with third parties.
          </Text>
        </View>
      </ScrollView>

      {/* MFA Setup Modal */}
      <Modal visible={showMfaModal} animationType="slide" transparent>
        <View style={dynamicStyles.modalOverlay}>
          <View style={[dynamicStyles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={[dynamicStyles.modalTitle, { color: colors.textPrimary }]}>Setup Two-Factor Auth</Text>
              <TouchableOpacity onPress={() => setShowMfaModal(false)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.qrContainer}>
                {mfaData?.uri && (
                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={mfaData.uri}
                      size={200}
                    />
                  </View>
                )}
                <Text style={[styles.mfaStep, { color: colors.textPrimary }]}>
                  1. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </Text>

                <View style={[styles.secretBox, { backgroundColor: colors.bgInput }]}>
                  <Text style={[styles.secretLabel, { color: colors.textMuted }]}>Secret Key:</Text>
                  <View style={styles.secretRow}>
                    <Text style={[styles.secretText, { color: colors.textPrimary }]}>{mfaData?.secret}</Text>
                    <TouchableOpacity onPress={() => Clipboard.setStringAsync(mfaData?.secret || '')}>
                      <Copy size={16} color={colors.emerald} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[styles.mfaStep, { color: colors.textPrimary }]}>
                  2. Enter the 6-digit code from the app
                </Text>

                <TextInput
                  style={[styles.mfaInput, { backgroundColor: colors.bgInput, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="000 000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={mfaCode}
                  onChangeText={setMfaCode}
                />

                <TouchableOpacity
                  style={[styles.mfaVerifyBtn, { backgroundColor: colors.emerald }]}
                  onPress={verifyAndEnableMfa}
                  disabled={verifyingMfa || mfaCode.length !== 6}
                >
                  {verifyingMfa ? <ActivityIndicator color="#fff" /> : <Text style={styles.mfaVerifyText}>Verify and Enable</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Toast ref={toastRef} />
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20 },
    sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    card: {
      backgroundColor: colors.bgCard, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 20,
    },
    inputGroup: { marginBottom: 14 },
    inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.bgInput, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 14,
    },
    input: { flex: 1, color: colors.textPrimary, fontSize: 15 },
    errorBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: colors.error + '33', marginBottom: 12,
    },
    errorText: { color: colors.error, fontSize: 13, lineHeight: 18, flex: 1 },
    successBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.emeraldGlow, borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: colors.emerald + '33', marginBottom: 12,
    },
    successText: { color: colors.emerald, fontSize: 13, fontWeight: '600' },
    actionBtn: {
      backgroundColor: colors.emerald, borderRadius: 12, paddingVertical: 14,
      alignItems: 'center',
    },
    actionBtnDisabled: { opacity: 0.6 },
    actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    settingIcon: {
      width: 38, height: 38, borderRadius: 10,
      backgroundColor: colors.bgCard2, alignItems: 'center', justifyContent: 'center',
    },
    settingLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    settingHint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    infoCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: colors.bgCard, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    infoText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, flex: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '800' },
  });
}

const styles = StyleSheet.create({
  qrContainer: { alignItems: 'center', paddingVertical: 10 },
  qrWrapper: { padding: 20, backgroundColor: '#fff', borderRadius: 20, marginBottom: 20 },
  mfaStep: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginVertical: 10, paddingHorizontal: 20 },
  secretBox: { width: '100%', padding: 16, borderRadius: 12, marginVertical: 10 },
  secretLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  secretRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secretText: { fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  mfaInput: { width: '100%', padding: 16, borderRadius: 12, borderWidth: 1, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 8, marginVertical: 20 },
  mfaVerifyBtn: { width: '100%', padding: 16, borderRadius: 14, alignItems: 'center' },
  mfaVerifyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
