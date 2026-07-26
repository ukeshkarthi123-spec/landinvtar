import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, Platform, Modal, TextInput, ActivityIndicator, StatusBar } from 'react-native';
import { Shield, Lock, Fingerprint, Eye, Smartphone, ChevronRight, ArrowLeft, X, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';

export default function SecurityScreen() {
  const { colors, isDark } = useTheme();
  const { privacyMode, setPrivacyMode, signOut, profile } = useApp();

  const [biometrics, setBiometrics] = useState(false);
  const [loading, setLoading] = useState(false);

  // PIN Modal State
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinStep, setPinStep] = useState<'current' | 'new' | 'confirm'>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const b = await storage.getItem('biometrics_enabled');
        setBiometrics(b === 'true');
      } catch (error) {
        console.error('Failed to load biometric settings:', error);
      }
    };
    loadSettings();
  }, []);

  const toggleBiometrics = async (val: boolean) => {
    if (val) {
      // Enabling biometrics
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert('Not Available', 'Biometric authentication is not set up on this device.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric unlock',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        setBiometrics(true);
        await storage.setItem('biometrics_enabled', 'true');
        Alert.alert('Success', 'Biometric unlock enabled.');
      }
    } else {
      // Disabling biometrics
      setBiometrics(false);
      await storage.setItem('biometrics_enabled', 'false');
    }
  };

  const handleChangePin = async () => {
    const storedPin = await storage.getItem('app_pin');
    if (!storedPin) {
      setPinStep('new');
    } else {
      setPinStep('current');
    }
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setShowPinModal(true);
  };

  const handlePinSubmit = async () => {
    setPinError('');
    if (pinStep === 'current') {
      const storedPin = await storage.getItem('app_pin');
      if (currentPin === storedPin) {
        setPinStep('new');
      } else {
        setPinError('Incorrect current PIN');
      }
    } else if (pinStep === 'new') {
      if (newPin.length < 4) {
        setPinError('PIN must be at least 4 digits');
      } else {
        setPinStep('confirm');
      }
    } else if (pinStep === 'confirm') {
      if (confirmPin !== newPin) {
        setPinError('PINs do not match');
      } else {
        setPinLoading(true);
        try {
          await storage.setItem('app_pin', newPin);
          setPinLoading(false);
          Alert.alert('Success', 'Security PIN updated successfully.');
          setShowPinModal(false);
        } catch (e) {
          setPinLoading(false);
          setPinError('Failed to save PIN');
        }
      }
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and all your investment data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // 1. In a real app, you'd call a Supabase Edge Function to delete the user
              // from auth.users and all related tables.
              // For now, we delete profile and sign out.
              if (profile?.id) {
                // Delete user data (RLS should handle permissions)
                await supabase.from('profiles').delete().eq('id', profile.id);

                // Sign out
                await signOut();

                Alert.alert('Account Deleted', 'Your account has been successfully removed.');
                router.replace('/login');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete account');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security & Privacy</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#00E38C" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.heroCard}>
              <View style={styles.heroIconBox}>
                  <Shield size={32} color="#00E38C" />
              </View>
              <Text style={styles.heroTitle}>Your Account is Secured</Text>
              <Text style={styles.heroSub}>Manage your security preferences and biometric authentication settings.</Text>
          </View>

          <Text style={styles.sectionTitle}>Authentication</Text>
          <View style={styles.menuCard}>
              <View style={styles.menuItem}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(0, 227, 140, 0.1)' }]}>
                      <Fingerprint size={20} color="#00E38C" />
                  </View>
                  <View style={{ flex: 1 }}>
                      <Text style={styles.menuLabel}>Biometric Unlock</Text>
                      <Text style={styles.menuSub}>Unlock app with Face ID or Fingerprint</Text>
                  </View>
                  <Switch
                      value={biometrics}
                      onValueChange={toggleBiometrics}
                      trackColor={{ false: '#2D333B', true: '#00E38C' }}
                      thumbColor="#FFFFFF"
                  />
              </View>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleChangePin}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                      <Lock size={20} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                      <Text style={styles.menuLabel}>Change PIN</Text>
                      <Text style={styles.menuSub}>Update your 4-digit security PIN</Text>
                  </View>
                  <ChevronRight size={16} color="#444" />
              </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.menuCard}>
              <View style={styles.menuItem}>
                  <View style={[styles.menuIcon, { backgroundColor: 'rgba(167, 139, 250, 0.1)' }]}>
                      <Eye size={20} color="#A78BFA" />
                  </View>
                  <View style={{ flex: 1 }}>
                      <Text style={styles.menuLabel}>Privacy Mode</Text>
                      <Text style={styles.menuSub}>Hide wallet balance on dashboard</Text>
                  </View>
                  <Switch
                      value={privacyMode}
                      onValueChange={setPrivacyMode}
                      trackColor={{ false: '#2D333B', true: '#00E38C' }}
                      thumbColor="#FFFFFF"
                  />
              </View>
          </View>

          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
              <Text style={styles.deleteText}>Delete Account Permanently</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* PIN Change Modal */}
      <Modal visible={showPinModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pinStep === 'current' ? 'Verify Current PIN' : pinStep === 'new' ? 'Set New PIN' : 'Confirm New PIN'}
              </Text>
              <TouchableOpacity onPress={() => setShowPinModal(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.pinInputContainer}>
              <TextInput
                style={styles.pinInput}
                value={pinStep === 'current' ? currentPin : pinStep === 'new' ? newPin : confirmPin}
                onChangeText={pinStep === 'current' ? setCurrentPin : pinStep === 'new' ? setNewPin : setConfirmPin}
                placeholder="****"
                placeholderTextColor="#444"
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                autoFocus
              />
              {pinError ? (
                <View style={styles.errorBox}>
                  <AlertCircle size={14} color="#EF4444" />
                  <Text style={styles.errorText}>{pinError}</Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handlePinSubmit}
              disabled={pinLoading}
            >
              {pinLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {pinStep === 'confirm' ? 'Update PIN' : 'Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#161B22', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2D333B' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 24, paddingTop: 10 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: { backgroundColor: '#161B22', borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#2D333B', marginBottom: 32 },
  heroIconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(0, 227, 140, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  heroSub: { color: '#A0A0A0', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  sectionTitle: { color: '#666', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  menuCard: { backgroundColor: '#161B22', borderRadius: 24, borderWidth: 1, borderColor: '#2D333B', overflow: 'hidden', marginBottom: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  menuSub: { color: '#666', fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#2D333B', marginLeft: 72 },
  deleteBtn: { marginTop: 24, alignItems: 'center', padding: 16 },
  deleteText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#161B22', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 48 : 32, borderWidth: 1, borderColor: '#2D333B' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  pinInputContainer: { marginBottom: 32, alignItems: 'center' },
  pinInput: { color: '#fff', fontSize: 32, fontWeight: '900', textAlign: 'center', letterSpacing: 20, width: '100%', height: 60, backgroundColor: '#0F1115', borderRadius: 16, borderWidth: 1, borderColor: '#2D333B' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  submitBtn: { backgroundColor: '#00E38C', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  submitBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
