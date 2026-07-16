import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Image,
} from 'react-native';
import {
  ShieldCheck, FileText, CreditCard, Camera, CheckCircle2,
  Clock, XCircle, Upload, AlertCircle, Trash2, Smartphone,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import type { KycDocument } from '@/types/database';

export default function KycScreen() {
  const { colors, isDark } = useTheme();
  const { profile, refreshProfile } = useApp();
  const [kyc, setKyc] = useState<KycDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [panImage, setPanImage] = useState<string | null>(null);
  const [aadhaarImage, setAadhaarImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizeStatus = useCallback((value?: string | null) => {
    if (!value) return 'Not Started';
    const v = value.toLowerCase();
    if (v === 'approved' || v === 'verified') return 'Verified';
    if (v === 'pending') return 'Pending';
    if (v === 'rejected') return 'Rejected';
    return value;
  }, []);

  const fetchKyc = useCallback(async () => {
    const userId = profile?.id;
    if (!userId) {
      setKyc(null);
      setPan('');
      setAadhaar('');
      setPanImage(null);
      setAadhaarImage(null);
      setSelfieImage(null);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        const record = data as KycDocument & { pan_url?: string | null; aadhaar_url?: string | null };
        setKyc(data as KycDocument);
        setPan(record.pan_number || '');
        setAadhaar(record.aadhaar_number || '');
        setPanImage(record.pan_file_url || record.pan_url || null);
        setAadhaarImage(record.aadhaar_file_url || record.aadhaar_url || null);
        setSelfieImage(record.selfie_url || null);
      } else {
        setKyc(null);
        setPan('');
        setAadhaar('');
        setPanImage(null);
        setAadhaarImage(null);
        setSelfieImage(null);
      }
    } catch (err) {
      console.error('Error fetching KYC:', err);
      setError('Unable to load your KYC information right now.');
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchKyc().finally(() => setLoading(false));
  }, [fetchKyc]);

  const formatAadhaar = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < cleaned.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += cleaned[i];
    }
    setAadhaar(formatted);
  };

  const pickImage = async (type: 'pan' | 'aadhaar' | 'selfie') => {
    const permissionResult = type === 'selfie'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera or photo access is required to upload documents.');
      return;
    }

    const options = {
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    };

    let result;
    if (type === 'selfie') {
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets[0].uri) {
      if (type === 'pan') setPanImage(result.assets[0].uri);
      if (type === 'aadhaar') setAadhaarImage(result.assets[0].uri);
      if (type === 'selfie') setSelfieImage(result.assets[0].uri);
    }
  };

  const uploadFile = async (uri: string, type: string) => {
    const fileName = `${profile?.id}_${type}_${Date.now()}.jpg`;

    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      // Ensure content type is set correctly for Android/iOS variations
      const { data, error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (err) {
      console.error(`[KYC] Upload error for ${type}:`, err);
      throw new Error(`Failed to upload ${type}. Please check your connection.`);
    }
  };

  const handleSubmit = async () => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan.trim().toUpperCase())) {
      setError('Please enter a valid PAN number.');
      return;
    }

    const aadhaarClean = aadhaar.replace(/\s/g, '');
    if (aadhaarClean.length !== 12) {
      setError('Please enter a valid 12-digit Aadhaar number.');
      return;
    }

    const phoneClean = phone.replace(/\D/g, '');
    if (phoneClean.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!panImage || !aadhaarImage || !selfieImage) {
      setError('Please upload all required documents and a selfie.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user?.id) throw new Error('User not found');

      // 1. Upload images if they are local URIs
      let panUrl = panImage;
      let aadhaarUrl = aadhaarImage;
      let selfieUrl = selfieImage;

      if (panImage.startsWith('file://') || panImage.startsWith('content://')) {
        panUrl = await uploadFile(panImage, 'pan');
      }
      if (aadhaarImage.startsWith('file://') || aadhaarImage.startsWith('content://')) {
        aadhaarUrl = await uploadFile(aadhaarImage, 'aadhaar');
      }
      if (selfieImage.startsWith('file://') || selfieImage.startsWith('content://')) {
        selfieUrl = await uploadFile(selfieImage, 'selfie');
      }

      // 2. Upsert KYC record
      const payload = {
        user_id: user.id,
        pan_number: pan.trim().toUpperCase(),
        aadhaar_number: aadhaarClean,
        pan_file_url: panUrl,
        aadhaar_file_url: aadhaarUrl,
        selfie_url: selfieUrl,
        status: 'Pending',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('kyc_documents')
        .upsert(payload, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;

      // 3. Update profile with phone and pending status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          kyc_status: 'Pending',
          phone: phoneClean,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      await fetchKyc();
      await refreshProfile();
      Alert.alert('Success', 'KYC submitted successfully. We will review it shortly.');
    } catch (err: any) {
      console.error('KYC Submission Error:', err);
      setError(err.message || 'Failed to submit KYC. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const status = normalizeStatus(kyc?.status ?? profile?.kyc_status ?? 'Not Started');
  const dynamicStyles = getDynamicStyles(colors, isDark);

  const renderUploadCard = (label: string, icon: any, image: string | null, onPress: () => void, onClear: () => void) => (
    <View style={dynamicStyles.uploadContainer}>
      <TouchableOpacity
        style={[dynamicStyles.uploadCard, image && dynamicStyles.uploadCardActive]}
        onPress={onPress}
      >
        {image ? (
          <Image source={{ uri: image }} style={dynamicStyles.previewImage} />
        ) : (
          <>
            {icon}
            <Text style={dynamicStyles.uploadLabel}>{label}</Text>
            <Text style={dynamicStyles.uploadHint}>Tap to upload</Text>
          </>
        )}
      </TouchableOpacity>
      {image && (
        <TouchableOpacity style={dynamicStyles.clearImageBtn} onPress={onClear}>
          <Trash2 size={14} color={colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={dynamicStyles.container}>
      <ScreenHeader title="KYC Verification" />

      {loading ? (
        <View style={dynamicStyles.centered}>
          <ActivityIndicator color={colors.emerald} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scroll}>
          <View style={[
            dynamicStyles.statusCard,
            status === 'Verified' && dynamicStyles.statusVerified,
            status === 'Pending' && dynamicStyles.statusPending,
            status === 'Rejected' && dynamicStyles.statusRejected,
          ]}>
            {status === 'Verified' && <CheckCircle2 size={24} color={colors.success} />}
            {status === 'Pending' && <Clock size={24} color={colors.warning} />}
            {status === 'Rejected' && <XCircle size={24} color={colors.error} />}
            {status === 'Not Started' && <ShieldCheck size={24} color={colors.textMuted} />}
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.statusTitle}>KYC {status}</Text>
              <Text style={dynamicStyles.statusMsg}>
                {status === 'Verified' && 'Your KYC is verified. You can invest in all projects.'}
                {status === 'Pending' && 'Your documents are under review. This usually takes 24-48 hours.'}
                {status === 'Rejected' && (kyc?.rejection_reason ?? 'Your KYC was rejected. Please re-submit with correct documents.')}
                {status === 'Not Started' && 'Complete your KYC to start investing in land projects.'}
              </Text>
            </View>
          </View>

          {status !== 'Verified' && status !== 'Pending' && (
            <View style={dynamicStyles.formSection}>
              <Text style={dynamicStyles.sectionTitle}>Submit Documents</Text>

              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>PAN Number</Text>
                <View style={dynamicStyles.inputWrapper}>
                  <FileText size={16} color={colors.textMuted} />
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="ABCDE1234F"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    maxLength={10}
                    value={pan}
                    onChangeText={(t) => setPan(t.toUpperCase())}
                  />
                </View>
              </View>

              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>Mobile Number</Text>
                <View style={dynamicStyles.inputWrapper}>
                  <Smartphone size={16} color={colors.textMuted} />
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="9876543210"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>Aadhaar Number</Text>
                <View style={dynamicStyles.inputWrapper}>
                  <CreditCard size={16} color={colors.textMuted} />
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="1234 5678 9012"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    maxLength={14}
                    value={aadhaar}
                    onChangeText={formatAadhaar}
                  />
                </View>
              </View>

              <View style={dynamicStyles.uploadRow}>
                {renderUploadCard('PAN Card', <Upload size={20} color={colors.textMuted} />, panImage, () => pickImage('pan'), () => setPanImage(null))}
                {renderUploadCard('Aadhaar', <Upload size={20} color={colors.textMuted} />, aadhaarImage, () => pickImage('aadhaar'), () => setAadhaarImage(null))}
                {renderUploadCard('Selfie', <Camera size={20} color={colors.textMuted} />, selfieImage, () => pickImage('selfie'), () => setSelfieImage(null))}
              </View>

              <Text style={dynamicStyles.uploadNote}>
                • Make sure images are clear and text is readable.{'\n'}
                • Documents must belong to you.{'\n'}
                • Max file size: 5MB.
              </Text>

              {error && (
                <View style={dynamicStyles.errorBox}>
                  <AlertCircle size={14} color={colors.error} />
                  <Text style={dynamicStyles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[dynamicStyles.submitBtn, submitting && dynamicStyles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={dynamicStyles.submitBtnText}>Submit for Verification</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {status === 'Pending' && (
            <View style={dynamicStyles.pendingNotice}>
              <Clock size={40} color={colors.warning} />
              <Text style={dynamicStyles.pendingTitle}>Under Review</Text>
              <Text style={dynamicStyles.pendingText}>
                We are currently verifying your identity. This usually takes less than 24 hours. You will receive a notification once the process is complete.
              </Text>
            </View>
          )}

          <View style={dynamicStyles.infoCard}>
            <Text style={dynamicStyles.infoTitle}>Why KYC is required?</Text>
            <Text style={dynamicStyles.infoText}>
              As per SEBI regulations, we require KYC verification to ensure the safety and legality of all investments. Your data is encrypted and stored securely.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function getDynamicStyles(colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    statusVerified: { borderColor: colors.success + '44', backgroundColor: colors.emeraldGlow2 },
    statusPending: { borderColor: colors.warning + '44', backgroundColor: 'rgba(245,158,11,0.06)' },
    statusRejected: { borderColor: colors.error + '44', backgroundColor: 'rgba(239,68,68,0.06)' },
    statusTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    statusMsg: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
    formSection: { gap: 16, marginBottom: 20 },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    inputGroup: { gap: 8 },
    inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.bgInput,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    input: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
    uploadRow: { flexDirection: 'row', gap: 10 },
    uploadContainer: { flex: 1, position: 'relative' },
    uploadCard: {
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: colors.bgCard,
      borderRadius: 14,
      padding: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    uploadCardActive: { borderStyle: 'solid', borderColor: colors.emerald },
    previewImage: { width: '100%', height: '100%', borderRadius: 10 },
    clearImageBtn: {
      position: 'absolute', top: -5, right: -5,
      backgroundColor: colors.bgCard, borderRadius: 10, padding: 4,
      borderWidth: 1, borderColor: colors.border,
      elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2, shadowRadius: 2,
    },
    uploadLabel: { color: colors.textPrimary, fontSize: 11, fontWeight: '700' },
    uploadHint: { color: colors.textMuted, fontSize: 9 },
    uploadNote: { color: colors.textMuted, fontSize: 11, lineHeight: 18, marginTop: 4 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: 'rgba(239,68,68,0.1)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.error + '33',
    },
    errorText: { color: colors.error, fontSize: 13, lineHeight: 18, flex: 1 },
    submitBtn: {
      backgroundColor: colors.emerald,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    pendingNotice: {
      alignItems: 'center',
      padding: 30,
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
      gap: 12,
    },
    pendingTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
    pendingText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
    infoCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 6 },
    infoText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  });
}
