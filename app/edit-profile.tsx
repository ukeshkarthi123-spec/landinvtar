import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Modal, Image,
} from 'react-native';
import { User, Mail, Phone, Camera, Check, X, ShieldCheck } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import Toast, { ToastRef } from '@/components/Toast';

const OFFLINE_QUEUE_KEY = 'offline_profile_updates';

export default function EditProfileScreen() {
  const { colors, isDark } = useTheme();
  const { profile, refreshProfile } = useApp();
  const toastRef = React.useRef<ToastRef>(null);

  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? '');

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Email/Phone Update State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setPhone(profile.phone);
      setAvatar(profile.avatar);
    }
  }, [profile]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processOfflineQueue();
      }
    });
    return () => unsubscribe();
  }, []);

  const processOfflineQueue = async () => {
    try {
      const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!existing) return;

      const queue = JSON.parse(existing);
      if (queue.length === 0) return;

      toastRef.current?.show(`Syncing ${queue.length} offline changes...`, 'info');

      for (const updates of queue) {
        const { timestamp, ...data } = updates;
        const { error } = await supabase
          .from('profiles')
          .update({ ...data, updated_at: new Date(timestamp).toISOString() })
          .eq('id', profile?.id);

        if (error) console.error('Sync error:', error);
      }

      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      await refreshProfile();
      toastRef.current?.show('Offline changes synced successfully', 'success');
    } catch (err) {
      console.error('Process offline queue error:', err);
    }
  };

  const validateName = (val: string) => val.trim().length >= 3;
  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const validatePhone = (val: string) => /^[6-9]\d{9}$/.test(val.replace(/\D/g, '').slice(-10));

  const pickImage = async (useCamera: boolean) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission Denied', `We need ${useCamera ? 'camera' : 'gallery'} access to update your profile photo.`);
        return;
      }

      const result = await (useCamera
        ? ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          })
        : ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          })
      );

      if (!result.canceled && result.assets[0].uri) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Pick image error:', err);
      toastRef.current?.show('Failed to pick image', 'error');
    }
  };

  const uploadAvatar = async (uri: string) => {
    setUploading(true);
    setUploadProgress(0.1);
    try {
      // 1. Compress and get Base64
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!manipResult.base64) throw new Error('Failed to process image');

      setUploadProgress(0.3);

      // 2. Convert Base64 to Blob via fetch (RN supported)
      const response = await fetch(`data:image/jpeg;base64,${manipResult.base64}`);
      const blob = await response.blob();

      setUploadProgress(0.5);

      // 3. Upload to Supabase Storage
      const filename = `${profile?.id}/${Date.now()}.jpg`;
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filename, blob, {
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      setUploadProgress(0.7);

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filename);

      // 4. Update Profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      setAvatar(publicUrl);
      await refreshProfile();
      toastRef.current?.show('Profile photo updated', 'success');
    } catch (err: any) {
      console.error('Upload error:', err);
      toastRef.current?.show(err.message || 'Failed to upload photo', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const saveOffline = async (updates: any) => {
    try {
      const existing = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const queue = existing ? JSON.parse(existing) : [];
      queue.push({ ...updates, timestamp: Date.now() });
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      toastRef.current?.show('Changes saved locally. Will sync when online.', 'info');
    } catch (err) {
      console.error('Save offline error:', err);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!validateName(name)) {
      toastRef.current?.show('Name must be at least 3 characters', 'error');
      return;
    }

    const netInfo = await NetInfo.fetch();
    const isOnline = netInfo.isConnected;

    const updates: any = {};
    if (name !== profile.name) updates.name = name.trim();

    // Email and Phone changes are handled separately via Auth
    const emailChanged = email.trim().toLowerCase() !== profile.email;
    const phoneChanged = phone.trim().replace(/\D/g, '') !== profile.phone?.replace(/\D/g, '');

    if (Object.keys(updates).length === 0 && !emailChanged && !phoneChanged) {
      toastRef.current?.show('No changes detected', 'info');
      return;
    }

    if (!isOnline) {
      await saveOffline(updates);
      return;
    }

    setSaving(true);
    try {
      // 1. Update Profile (Name)
      if (updates.name) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', profile.id);

        if (updateError) throw updateError;
      }

      // 2. Update Email
      if (emailChanged) {
        if (!validateEmail(email)) {
          toastRef.current?.show('Invalid email format', 'error');
          setSaving(false);
          return;
        }
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) throw emailError;
        toastRef.current?.show('Verification email sent to new address', 'info');
      }

      // 3. Update Phone (Triggers OTP)
      if (phoneChanged) {
        if (!validatePhone(phone)) {
          toastRef.current?.show('Invalid Indian mobile number', 'error');
          setSaving(false);
          return;
        }
        const formattedPhone = `+91${phone.replace(/\D/g, '').slice(-10)}`;
        setNewPhone(formattedPhone);
        const { error: phoneError } = await supabase.auth.updateUser({ phone: formattedPhone });
        if (phoneError) throw phoneError;
        setShowOtpModal(true);
      }

      if (!phoneChanged) {
        await refreshProfile();
        toastRef.current?.show('Profile updated successfully', 'success');
      }
    } catch (err: any) {
      toastRef.current?.show(err.message || 'Failed to update profile', 'error');
    } finally {
      if (!phoneChanged) setSaving(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;

    setVerifyingOtp(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: newPhone,
        token: otp,
        type: 'phone_change',
      });

      if (error) throw error;

      setShowOtpModal(false);
      setOtp('');
      await refreshProfile();
      toastRef.current?.show('Phone number updated successfully', 'success');
    } catch (err: any) {
      toastRef.current?.show(err.message || 'OTP verification failed', 'error');
    } finally {
      setVerifyingOtp(false);
      setSaving(false);
    }
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <ScreenHeader title="Edit Profile" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scroll}>
        <View style={dynamicStyles.avatarSection}>
          <TouchableOpacity
            style={dynamicStyles.avatarContainer}
            onPress={() => {
              Alert.alert(
                'Profile Photo',
                'Change your profile photo',
                [
                  { text: 'Camera', onPress: () => pickImage(true) },
                  { text: 'Gallery', onPress: () => pickImage(false) },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={dynamicStyles.avatarImage} />
            ) : (
              <View style={dynamicStyles.avatarCircle}>
                <Text style={dynamicStyles.avatarText}>
                  {name.trim() ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                </Text>
              </View>
            )}
            <View style={dynamicStyles.cameraBtn}>
              <Camera size={16} color="#fff" />
            </View>
            {uploading && (
              <View style={dynamicStyles.uploadOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.form}>
          <View style={dynamicStyles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>Full Name</Text>
            <View style={dynamicStyles.inputWrapper}>
              <User size={16} color={colors.textMuted} />
              <TextInput
                style={dynamicStyles.input}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={dynamicStyles.inputGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={dynamicStyles.inputLabel}>Email Address</Text>
              {profile?.email === email && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={12} color={colors.emerald} />
                  <Text style={{ color: colors.emerald, fontSize: 10, fontWeight: '600' }}>Verified</Text>
                </View>
              )}
            </View>
            <View style={dynamicStyles.inputWrapper}>
              <Mail size={16} color={colors.textMuted} />
              <TextInput
                style={dynamicStyles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={dynamicStyles.inputGroup}>
            <Text style={dynamicStyles.inputLabel}>Phone Number</Text>
            <View style={dynamicStyles.inputWrapper}>
              <Phone size={16} color={colors.textMuted} />
              <TextInput
                style={dynamicStyles.input}
                placeholder="98765 43210"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, ''))}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[dynamicStyles.saveBtn, saving && dynamicStyles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving || uploading}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={dynamicStyles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* OTP Modal */}
      <Modal visible={showOtpModal} animationType="slide" transparent>
        <View style={dynamicStyles.modalOverlay}>
          <View style={[dynamicStyles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={[dynamicStyles.modalTitle, { color: colors.textPrimary }]}>Verify Phone Number</Text>
              <TouchableOpacity onPress={() => setShowOtpModal(false)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={[dynamicStyles.modalSub, { color: colors.textSecondary }]}>
              Enter the 6-digit OTP sent to your new phone number {newPhone}
            </Text>

            <TextInput
              style={[dynamicStyles.otpInput, { backgroundColor: colors.bgInput, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />

            <TouchableOpacity
              style={[dynamicStyles.verifyBtn, { backgroundColor: colors.emerald }, (verifyingOtp || otp.length !== 6) && { opacity: 0.6 }]}
              onPress={handleVerifyOtp}
              disabled={verifyingOtp || otp.length !== 6}
            >
              {verifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={dynamicStyles.verifyBtnText}>Verify OTP</Text>}
            </TouchableOpacity>
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
    avatarSection: { alignItems: 'center', marginBottom: 30 },
    avatarContainer: { position: 'relative' },
    avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: colors.emerald + '44' },
    avatarCircle: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: colors.bgCard, borderWidth: 2, borderColor: colors.emerald + '44',
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: colors.emerald, fontSize: 36, fontWeight: '900' },
    cameraBtn: {
      position: 'absolute', bottom: 0, right: 0,
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: colors.emerald, borderWidth: 3, borderColor: colors.bg,
      alignItems: 'center', justifyContent: 'center',
    },
    uploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 50,
      alignItems: 'center', justifyContent: 'center',
    },
    form: { gap: 20 },
    inputGroup: { gap: 8 },
    inputLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginLeft: 4 },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.bgInput, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 14,
    },
    input: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    saveBtn: {
      backgroundColor: colors.emerald, borderRadius: 16,
      paddingVertical: 18, alignItems: 'center', marginTop: 10,
      shadowColor: colors.emerald, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '800' },
    modalSub: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
    otpInput: {
      width: '100%', padding: 18, borderRadius: 16, borderWidth: 1,
      fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: 12, marginBottom: 24,
    },
    verifyBtn: { padding: 18, borderRadius: 16, alignItems: 'center' },
    verifyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}
