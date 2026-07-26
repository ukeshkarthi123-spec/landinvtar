import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Image, Dimensions, Linking, StatusBar
} from 'react-native';
import {
  ShieldCheck, FileText, CreditCard, Camera, CheckCircle2,
  Clock, XCircle, Upload, AlertCircle, Trash2, Smartphone,
  Check,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';

const { width } = Dimensions.get('window');

interface KycData {
  id: string;
  user_id: string;
  pan_number: string;
  aadhaar_number: string;
  mobile_number: string | null;
  pan_file_url: string | null;
  aadhaar_file_url: string | null;
  aadhaar_back_file_url: string | null;
  selfie_file_url: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejection_reason: string | null;
  submitted_at: string;
}

export default function KycScreen() {
  const { colors, isDark } = useTheme();
  const { profile, refreshProfile } = useApp();
  const [kycRecord, setKycRecord] = useState<KycData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [phone, setPhone] = useState('');
  const [panImage, setPanImage] = useState<string | null>(null);
  const [panBase64, setPanBase64] = useState<string | null>(null);
  const [aadhaarImage, setAadhaarImage] = useState<string | null>(null);
  const [aadhaarBase64, setAadhaarBase64] = useState<string | null>(null);
  const [aadhaarBackImage, setAadhaarBackImage] = useState<string | null>(null);
  const [aadhaarBackBase64, setAadhaarBackBase64] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchKycData = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setKycRecord(data);
        setPan(data.pan_number || '');
        setAadhaar(data.aadhaar_number || '');
        setPhone(data.mobile_number || profile.phone || '');
        setPanImage(data.pan_file_url);
        setAadhaarImage(data.aadhaar_file_url);
        setAadhaarBackImage(data.aadhaar_back_file_url);
        setSelfieImage(data.selfie_file_url);
      }
    } catch (err) {
      console.error('[KYC] Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.phone]);

  useEffect(() => {
    fetchKycData();
  }, [fetchKycData]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan.trim().toUpperCase())) {
      newErrors.pan = 'Invalid PAN format (e.g., ABCDE1234F)';
    }

    const aadhaarClean = aadhaar.replace(/\s/g, '');
    if (aadhaarClean.length !== 12 || !/^\d+$/.test(aadhaarClean)) {
      newErrors.aadhaar = 'Aadhaar must be 12 digits';
    }

    const phoneClean = phone.replace(/\D/g, '');
    if (phoneClean.length !== 10) {
      newErrors.phone = 'Mobile must be 10 digits';
    }

    if (!panImage) newErrors.panImage = 'PAN image is required';
    if (!aadhaarImage) newErrors.aadhaarImage = 'Aadhaar Front image is required';
    if (!aadhaarBackImage) newErrors.aadhaarBackImage = 'Aadhaar Back image is required';
    if (!selfieImage) newErrors.selfieImage = 'Selfie is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera access is required to capture documents.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }
    return true;
  };

  const captureImage = async (type: 'pan' | 'aadhaar_front' | 'aadhaar_back' | 'selfie') => {
    const hasPermission = await handleCameraPermission();
    if (!hasPermission) return;

    const isSelfie = type === 'selfie';
    const options: ImagePicker.ImagePickerOptions = {
      allowsEditing: true,
      aspect: isSelfie ? [1, 1] : [4, 3],
      quality: 0.7,
      base64: true,
      cameraType: isSelfie ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    };

    try {
      const result = await ImagePicker.launchCameraAsync(options);

      if (!result.canceled && result.assets[0]) {
        const { uri, base64 } = result.assets[0];
        if (type === 'pan') {
          setPanImage(uri);
          setPanBase64(base64 || null);
        } else if (type === 'aadhaar_front') {
          setAadhaarImage(uri);
          setAadhaarBase64(base64 || null);
        } else if (type === 'aadhaar_back') {
          setAadhaarBackImage(uri);
          setAadhaarBackBase64(base64 || null);
        } else {
          setSelfieImage(uri);
          setSelfieBase64(base64 || null);
        }
        setErrors(prev => ({ ...prev, [`${type}Image`]: '' }));
      }
    } catch (err) {
      console.error('[KYC] Camera error:', err);
      Alert.alert('Error', 'Failed to launch camera.');
    }
  };

  const uploadToSupabase = async (base64Data: string, docType: string) => {
    const bucketName = 'kyc-documents';

    // 1. Verify Authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user?.id) {
        console.error('[KYC Storage] Auth Check Failed:', sessionError);
        throw new Error('Authentication failed. Please log in again to upload documents.');
    }

    const userId = session.user.id;
    // Format path exactly as required by user and folder-scoped RLS policies
    const fileName = `${docType}-${Date.now()}.jpg`;
    const filePath = `${userId}/${fileName}`;

    console.log('[KYC Storage] DEBUG START');
    console.log('Bucket:', bucketName);
    console.log('Path:', filePath);
    console.log('User ID:', userId);
    console.log('Session Status:', session ? 'Active' : 'Missing');

    try {
      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, decode(base64Data), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('[KYC Storage] ERROR OBJECT:', JSON.stringify(uploadError, null, 2));
        console.error('[KYC Storage] MESSAGE:', uploadError.message);
        console.error('[KYC Storage] STATUS:', (uploadError as any).status || 'Unknown');
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      console.log('[KYC Storage] UPLOAD SUCCESS:', publicUrl);
      return publicUrl;
    } catch (err: any) {
      console.error(`[KYC Storage] Final Catch for ${docType}:`, err);
      throw new Error(`Storage upload failed for ${docType}: ${err.message || 'Unknown RLS or Network Error'}`);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      // 1. Upload images using verified session user id and correct bucket
      const panUrl = panBase64 ? await uploadToSupabase(panBase64, 'pan') : panImage;
      const aadhaarFrontUrl = aadhaarBase64 ? await uploadToSupabase(aadhaarBase64, 'aadhaar') : aadhaarImage;
      const aadhaarBackUrl = aadhaarBackBase64 ? await uploadToSupabase(aadhaarBackBase64, 'aadhaar-back') : aadhaarBackImage;
      const selfieUrl = selfieBase64 ? await uploadToSupabase(selfieBase64, 'selfie') : selfieImage;

      // 2. Upsert to database
      const { error: dbError } = await supabase
        .from('kyc_documents')
        .upsert({
          user_id: profile?.id,
          pan_number: pan.toUpperCase(),
          aadhaar_number: aadhaar.replace(/\s/g, ''),
          mobile_number: phone,
          pan_file_url: panUrl,
          aadhaar_file_url: aadhaarFrontUrl,
          aadhaar_back_file_url: aadhaarBackUrl,
          selfie_file_url: selfieUrl,
          status: 'Pending',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (dbError) throw dbError;

      Alert.alert('KYC Submitted', 'Documents submitted successfully. Verification takes 24-48 hours.');
      await fetchKycData();
      await refreshProfile();
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const status = kycRecord?.status || 'none';
  const dynamicStyles = getDynamicStyles(colors, isDark);

  if (loading) {
    return (
      <View style={dynamicStyles.centered}>
        <ActivityIndicator size="large" color={colors.emerald} />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScreenHeader title="Identity Verification" />

      <ScrollView contentContainerStyle={dynamicStyles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[
          dynamicStyles.statusCard,
          status === 'Approved' && dynamicStyles.statusApproved,
          status === 'Pending' && dynamicStyles.statusPending,
          status === 'Rejected' && dynamicStyles.statusRejected,
        ]}>
          <View style={dynamicStyles.statusIconContainer}>
            {status === 'Approved' ? <CheckCircle2 size={28} color={colors.success} /> :
             status === 'Pending' ? <Clock size={28} color={colors.warning} /> :
             status === 'Rejected' ? <XCircle size={28} color={colors.error} /> :
             <ShieldCheck size={28} color={colors.emerald} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={dynamicStyles.statusTitle}>
              {status === 'Approved' ? 'KYC Verified' :
               status === 'Pending' ? 'Verification Pending' :
               status === 'Rejected' ? 'KYC Rejected' :
               'Complete Your KYC'}
            </Text>
            <Text style={dynamicStyles.statusDesc}>
              {status === 'Approved' ? 'Your identity is verified. You can now start investing.' :
               status === 'Pending' ? 'Documents are under review. This takes 24-48 hours.' :
               status === 'Rejected' ? `Rejected: ${kycRecord?.rejection_reason || 'Re-upload clear documents.'}` :
               'Submit documents to access investments.'}
            </Text>
          </View>
        </View>

        {status !== 'Approved' && status !== 'Pending' && (
          <View style={dynamicStyles.form}>
            <View style={dynamicStyles.field}>
              <Text style={dynamicStyles.label}>PAN Card Number</Text>
              <View style={[dynamicStyles.inputBox, errors.pan && dynamicStyles.inputError]}>
                <FileText size={20} color={colors.textSecondary} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="ABCDE1234F"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  maxLength={10}
                  value={pan}
                  onChangeText={setPan}
                />
              </View>
              {errors.pan && <Text style={dynamicStyles.errorText}>{errors.pan}</Text>}
            </View>

            <View style={dynamicStyles.field}>
              <Text style={dynamicStyles.label}>Aadhaar Number</Text>
              <View style={[dynamicStyles.inputBox, errors.aadhaar && dynamicStyles.inputError]}>
                <CreditCard size={20} color={colors.textSecondary} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="1234 5678 9012"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={12}
                  value={aadhaar}
                  onChangeText={setAadhaar}
                />
              </View>
              {errors.aadhaar && <Text style={dynamicStyles.errorText}>{errors.aadhaar}</Text>}
            </View>

            <View style={dynamicStyles.field}>
              <Text style={dynamicStyles.label}>Mobile Number</Text>
              <View style={[dynamicStyles.inputBox, errors.phone && dynamicStyles.inputError]}>
                <Smartphone size={20} color={colors.textSecondary} />
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
              {errors.phone && <Text style={dynamicStyles.errorText}>{errors.phone}</Text>}
            </View>

            <Text style={dynamicStyles.sectionTitle}>Capture Documents</Text>

            <View style={dynamicStyles.uploadGrid}>
              <View style={dynamicStyles.uploadItem}>
                <TouchableOpacity
                  style={[dynamicStyles.uploadBox, panImage && dynamicStyles.uploadBoxActive, errors.panImage && dynamicStyles.uploadBoxError]}
                  onPress={() => captureImage('pan')}
                >
                  {panImage ? (
                    <Image source={{ uri: panImage }} style={dynamicStyles.imagePreview} />
                  ) : (
                    <>
                      <Camera size={24} color={colors.textMuted} />
                      <Text style={dynamicStyles.uploadText}>PAN Card</Text>
                    </>
                  )}
                </TouchableOpacity>
                {panImage && (
                  <TouchableOpacity style={dynamicStyles.removeImg} onPress={() => { setPanImage(null); setPanBase64(null); }}>
                    <Trash2 size={12} color="#fff" />
                  </TouchableOpacity>
                )}
                {errors.panImage && <Text style={dynamicStyles.errorTextSmall}>{errors.panImage}</Text>}
              </View>

              <View style={dynamicStyles.uploadItem}>
                <TouchableOpacity
                  style={[dynamicStyles.uploadBox, aadhaarImage && dynamicStyles.uploadBoxActive, errors.aadhaarImage && dynamicStyles.uploadBoxError]}
                  onPress={() => captureImage('aadhaar_front')}
                >
                  {aadhaarImage ? (
                    <Image source={{ uri: aadhaarImage }} style={dynamicStyles.imagePreview} />
                  ) : (
                    <>
                      <Camera size={24} color={colors.textMuted} />
                      <Text style={dynamicStyles.uploadText}>Aadhaar Front</Text>
                    </>
                  )}
                </TouchableOpacity>
                {aadhaarImage && (
                  <TouchableOpacity style={dynamicStyles.removeImg} onPress={() => { setAadhaarImage(null); setAadhaarBase64(null); }}>
                    <Trash2 size={12} color="#fff" />
                  </TouchableOpacity>
                )}
                {errors.aadhaarImage && <Text style={dynamicStyles.errorTextSmall}>{errors.aadhaarImage}</Text>}
              </View>
            </View>

            <View style={dynamicStyles.uploadGrid}>
              <View style={dynamicStyles.uploadItem}>
                <TouchableOpacity
                  style={[dynamicStyles.uploadBox, aadhaarBackImage && dynamicStyles.uploadBoxActive, errors.aadhaarBackImage && dynamicStyles.uploadBoxError]}
                  onPress={() => captureImage('aadhaar_back')}
                >
                  {aadhaarBackImage ? (
                    <Image source={{ uri: aadhaarBackImage }} style={dynamicStyles.imagePreview} />
                  ) : (
                    <>
                      <Camera size={24} color={colors.textMuted} />
                      <Text style={dynamicStyles.uploadText}>Aadhaar Back</Text>
                    </>
                  )}
                </TouchableOpacity>
                {aadhaarBackImage && (
                  <TouchableOpacity style={dynamicStyles.removeImg} onPress={() => { setAadhaarBackImage(null); setAadhaarBackBase64(null); }}>
                    <Trash2 size={12} color="#fff" />
                  </TouchableOpacity>
                )}
                {errors.aadhaarBackImage && <Text style={dynamicStyles.errorTextSmall}>{errors.aadhaarBackImage}</Text>}
              </View>

              <View style={dynamicStyles.uploadItem}>
                <TouchableOpacity
                  style={[dynamicStyles.uploadBox, selfieImage && dynamicStyles.uploadBoxActive, errors.selfieImage && dynamicStyles.uploadBoxError]}
                  onPress={() => captureImage('selfie')}
                >
                  {selfieImage ? (
                    <Image source={{ uri: selfieImage }} style={dynamicStyles.imagePreview} />
                  ) : (
                    <>
                      <Camera size={24} color={colors.textMuted} />
                      <Text style={dynamicStyles.uploadText}>Selfie</Text>
                    </>
                  )}
                </TouchableOpacity>
                {selfieImage && (
                  <TouchableOpacity style={dynamicStyles.removeImg} onPress={() => { setSelfieImage(null); setSelfieBase64(null); }}>
                    <Trash2 size={12} color="#fff" />
                  </TouchableOpacity>
                )}
                {errors.selfieImage && <Text style={dynamicStyles.errorTextSmall}>{errors.selfieImage}</Text>}
              </View>
            </View>

            <TouchableOpacity
              style={[dynamicStyles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Check size={20} color="#fff" />
                  <Text style={dynamicStyles.submitText}>Submit for Verification</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {status === 'Pending' && (
          <View style={dynamicStyles.pendingInfo}>
            <ActivityIndicator color={colors.warning} size="large" style={{ marginBottom: 15 }} />
            <Text style={dynamicStyles.pendingInfoTitle}>Verification in Progress</Text>
            <Text style={dynamicStyles.pendingInfoText}>
              Our team is verifying your documents. You will be notified once activated.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    statusCard: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 24, gap: 15 },
    statusApproved: { backgroundColor: colors.success + '10', borderColor: colors.success + '40' },
    statusPending: { backgroundColor: colors.warning + '10', borderColor: colors.warning + '40' },
    statusRejected: { backgroundColor: colors.error + '10', borderColor: colors.error + '40' },
    statusIconContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    statusTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    statusDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
    form: { gap: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 10 },
    field: { gap: 8 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgInput, borderRadius: 15, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, height: 56, gap: 12 },
    inputError: { borderColor: colors.error },
    input: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '500' },
    uploadGrid: { flexDirection: 'row', gap: 12 },
    uploadItem: { flex: 1, position: 'relative' },
    uploadBox: { height: 110, backgroundColor: colors.bgInput, borderRadius: 15, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 },
    uploadBoxActive: { borderStyle: 'solid', borderColor: colors.emerald },
    uploadBoxError: { borderColor: colors.error },
    imagePreview: { width: '100%', height: '100%', borderRadius: 14 },
    uploadText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
    removeImg: { position: 'absolute', top: -8, right: -8, backgroundColor: colors.error, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    errorText: { color: colors.error, fontSize: 12, marginLeft: 4 },
    errorTextSmall: { color: colors.error, fontSize: 10, textAlign: 'center', marginTop: 4 },
    submitBtn: { backgroundColor: colors.emerald, height: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20 },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    pendingInfo: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    pendingInfoTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    pendingInfoText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  });
}
