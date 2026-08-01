import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Image, Dimensions, StatusBar
} from 'react-native';
import {
  ShieldCheck, FileText, CreditCard, Camera, CheckCircle2,
  Clock, XCircle, Trash2, Check, User
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';
import { getFreshKycStatus } from '@/lib/kyc-service';
import type { KycStatusResult } from '@/lib/kyc-service';
import { isKycVerified } from '@/types/database';
import type { KycDocument } from '@/types/database';

const { width } = Dimensions.get('window');

export default function KycScreen() {
  const { colors, isDark } = useTheme();
  const { profile, refreshProfile } = useApp();

  const [kycRecord, setKycRecord] = useState<KycDocument | null>(null);
  const [kycStatus, setKycStatus] = useState<KycStatusResult>({
    isVerified: false,
    isPending: false,
    status: 'not_started'
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');

  const [images, setImages] = useState<Record<string, { uri: string, base64: string | null }>>({
    selfie: { uri: '', base64: null },
    pan_image: { uri: '', base64: null },
    aadhaar_front: { uri: '', base64: null },
    aadhaar_back: { uri: '', base64: null },
  });

  const isMounted = useRef(true);

  const fetchKyc = useCallback(async () => {
    if (!profile?.id) return;
    try {
      // 1. Fetch the consolidated status using the shared service
      const status = await getFreshKycStatus(profile.id);
      if (isMounted.current) {
        setKycStatus(status);
      }

      // 2. Fetch the raw record for form fields and image previews
      const { data, error } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;
      if (data && isMounted.current) {
        setKycRecord(data as KycDocument);
        setPan(data.pan_number);
        setAadhaar(data.aadhaar_number);
        setImages({
          selfie: { uri: data.selfie, base64: null },
          pan_image: { uri: data.pan_image, base64: null },
          aadhaar_front: { uri: data.aadhaar_front, base64: null },
          aadhaar_back: { uri: data.aadhaar_back, base64: null },
        });
      }
    } catch (err) {
      console.error('[KYC] Fetch error:', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    isMounted.current = true;
    fetchKyc();

    const channel = supabase
      .channel('kyc-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kyc_documents', filter: `user_id=eq.${profile?.id}` }, (payload) => {
        console.log('[KYC Realtime] Status updated, refreshing...');
        fetchKyc();
        refreshProfile();
      })
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchKyc, profile?.id, refreshProfile]);

  const capture = async (key: string) => {
    const isSelfie = key === 'selfie';
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: isSelfie ? [1, 1] : [4, 3],
      quality: 0.5,
      base64: true,
      cameraType: isSelfie ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });

    if (!result.canceled && result.assets[0]) {
      setImages(prev => ({
        ...prev,
        [key]: { uri: result.assets[0].uri, base64: result.assets[0].base64 || null }
      }));
    }
  };

  /**
   * Internal upload helper with strict RLS debugging
   */
  const uploadFile = async (userId: string, base64: string, key: string) => {
    const bucketName = 'kyc-final';
    const fileName = `${key}_${Date.now()}.jpg`;
    const filePath = `${userId}/${fileName}`; // RLS usually requires path to start with user ID

    // Debug logging as requested
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();

    console.log('[KYC DEBUG] Starting Upload:', {
        bucket: bucketName,
        path: filePath,
        userId: userId,
        authenticatedUser: user?.id,
        hasSession: !!session,
        contentType: 'image/jpeg'
    });

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, decode(base64), {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error('[KYC UPLOAD ERROR] Full Object:', error);

      let friendlyMsg = error.message;
      if (error.message.includes('row-level security')) {
        friendlyMsg = `Security Access Denied (RLS). Ensure your account has upload permissions and the bucket '${bucketName}' is correctly configured.`;
      }
      throw new Error(friendlyMsg);
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const submit = async () => {
    // 1. Initial Validation
    if (!pan || !aadhaar) return Alert.alert('Error', 'Please enter your identity numbers');
    if (!images.selfie.uri || !images.pan_image.uri || !images.aadhaar_front.uri || !images.aadhaar_back.uri) {
      return Alert.alert('Error', 'Please upload all 4 required identity proofs');
    }

    setSubmitting(true);

    try {
      // 2. Explicit Auth Check before starting the sequence
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication expired. Please log in again to submit KYC.');
      }

      const userId = user.id;
      const uploadedUrls: Record<string, string> = {};

      // 3. Sequential Uploads with per-file error tracking
      for (const key of Object.keys(images)) {
        if (images[key].base64) {
          uploadedUrls[key] = await uploadFile(userId, images[key].base64!, key);
        } else if (images[key].uri.startsWith('http')) {
          // If it's already a URL, it's from a previous submission, reuse it
          uploadedUrls[key] = images[key].uri;
        } else {
            throw new Error(`Missing image data for ${key}. Please re-capture.`);
        }
      }

      // 4. Record insertion using standard schema
      const { error: dbError } = await supabase.from('kyc_documents').upsert({
        user_id: userId,
        pan_number: pan.toUpperCase(),
        aadhaar_number: aadhaar.replace(/\s/g, ''),
        selfie: uploadedUrls.selfie,
        pan_image: uploadedUrls.pan_image,
        aadhaar_front: uploadedUrls.aadhaar_front,
        aadhaar_back: uploadedUrls.aadhaar_back,
        status: 'pending',
        rejection_reason: null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      if (dbError) throw dbError;

      Alert.alert('Success', 'KYC submitted successfully. Status: PENDING');
      refreshProfile();
      fetchKyc();
    } catch (err: any) {
      console.error('[KYC SUBMISSION FAILED]', err);
      Alert.alert('Submission Failed', err.message || 'An unexpected error occurred during KYC processing.');
    } finally {
      setSubmitting(false);
    }
  };

  const isApproved = kycStatus.isVerified;
  const isPending = kycStatus.isPending;
  const statusStr = kycStatus.status;
  const dynamicStyles = getDynamicStyles(colors);

  if (loading) return <View style={dynamicStyles.centered}><ActivityIndicator color={colors.emerald} /></View>;

  return (
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScreenHeader title="KYC Verification" />
      <ScrollView contentContainerStyle={dynamicStyles.scroll} showsVerticalScrollIndicator={false}>

        {/* Unified Status Header */}
        <View style={[dynamicStyles.card, dynamicStyles.statusCard, isApproved && dynamicStyles.approved, isPending && dynamicStyles.pending, statusStr === 'rejected' && dynamicStyles.rejected]}>
          {isApproved ? <CheckCircle2 size={32} color={colors.success} /> :
           isPending ? <Clock size={32} color={colors.warning} /> :
           statusStr === 'rejected' ? <XCircle size={32} color={colors.error} /> :
           <ShieldCheck size={32} color={colors.emerald} />}
          <View style={{ flex: 1 }}>
            <Text style={dynamicStyles.statusTitle}>
              {isApproved ? 'KYC Verified' : isPending ? 'Audit in Progress' : statusStr === 'rejected' ? 'KYC Rejected' : 'Identify Verification'}
            </Text>
            <Text style={dynamicStyles.statusDesc}>
              {statusStr === 'rejected' ? `Reason: ${kycStatus.rejectionReason || kycRecord?.rejection_reason}` : isApproved ? 'Identity confirmed. Digital ledger access granted.' : 'Required for fractional land ownership.'}
            </Text>
          </View>
        </View>

        {!isApproved && !isPending && (
          <View style={dynamicStyles.form}>
            <View style={dynamicStyles.field}>
              <Text style={dynamicStyles.label}>PAN Card</Text>
              <TextInput style={dynamicStyles.input} value={pan} onChangeText={setPan} autoCapitalize="characters" maxLength={10} placeholder="ABCDE1234F" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={dynamicStyles.field}>
              <Text style={dynamicStyles.label}>Aadhaar Number</Text>
              <TextInput style={dynamicStyles.input} value={aadhaar} onChangeText={setAadhaar} keyboardType="numeric" maxLength={12} placeholder="123456789012" placeholderTextColor={colors.textMuted} />
            </View>

            <Text style={dynamicStyles.sectionTitle}>Identity Proofs</Text>
            <View style={dynamicStyles.grid}>
              {[
                { key: 'selfie', label: 'Selfie' },
                { key: 'pan_image', label: 'PAN Front' },
                { key: 'aadhaar_front', label: 'Aadhaar Front' },
                { key: 'aadhaar_back', label: 'Aadhaar Back' },
              ].map(item => (
                <TouchableOpacity key={item.key} style={[dynamicStyles.uploadBox, images[item.key].uri && dynamicStyles.activeUpload]} onPress={() => capture(item.key)}>
                  {images[item.key].uri ? (
                    <Image source={{ uri: images[item.key].uri }} style={dynamicStyles.preview} />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Camera size={24} color={colors.textMuted} />
                      <Text style={dynamicStyles.uploadLabel}>{item.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={dynamicStyles.btn} onPress={submit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#000" /> : <Text style={dynamicStyles.btnText}>Submit Credentials</Text>}
            </TouchableOpacity>
          </View>
        )}

        {isPending && (
          <View style={dynamicStyles.pendingState}>
            <Clock size={64} color={colors.warning} />
            <Text style={dynamicStyles.pTitle}>Compliance Audit</Text>
            <Text style={dynamicStyles.pText}>Our team is currently auditing your identity credentials. This process ensures regulatory compliance for land investments.</Text>
            <ActivityIndicator color={colors.warning} style={{ marginTop: 20 }} />
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function getDynamicStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 20 },
    card: { backgroundColor: colors.bgCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border },
    statusCard: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 24 },
    approved: { backgroundColor: colors.success + '10', borderColor: colors.success + '30' },
    pending: { backgroundColor: colors.warning + '10', borderColor: colors.warning + '30' },
    rejected: { backgroundColor: colors.error + '10', borderColor: colors.error + '30' },
    statusTitle: { fontSize: 18, fontWeight: '900', color: colors.textPrimary },
    statusDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    form: { gap: 20 },
    field: { gap: 8 },
    label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginLeft: 4 },
    input: { backgroundColor: colors.bgInput, borderRadius: 16, height: 60, paddingHorizontal: 16, fontSize: 16, fontWeight: '700', color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.textPrimary, marginTop: 10 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    uploadBox: { width: (width - 52) / 2, height: 120, backgroundColor: colors.bgInput, borderRadius: 20, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    activeUpload: { borderStyle: 'solid', borderColor: colors.emerald },
    preview: { width: '100%', height: '100%' },
    uploadLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 8 },
    btn: { backgroundColor: colors.emerald, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    btnText: { color: '#000', fontSize: 16, fontWeight: '900' },
    pendingState: { alignItems: 'center', paddingVertical: 80, gap: 16 },
    pTitle: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
    pText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 30, lineHeight: 22 },
  });
}
