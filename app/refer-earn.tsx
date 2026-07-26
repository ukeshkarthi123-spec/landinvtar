import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Share, Alert, StatusBar, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Gift, Copy, Share2, Users, TrendingUp, Award,
  Check, AlertCircle, ArrowLeft
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

export default function ReferEarnScreen() {
  const { colors, isDark } = useTheme();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: existingRef } = await supabase
      .from('referrals')
      .select('*')
      .is('referred_email', null)
      .limit(1)
      .maybeSingle();

    if (existingRef) setReferralCode(existingRef.referral_code);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    const { data, error } = await supabase.rpc('generate_referral_code');
    if (error) {
      Alert.alert('Error', error.message);
    } else if (data) {
      setReferralCode(data as string);
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    if (!referralCode) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralCode) return;
    const shareText = `Join InvestLand - India's trusted fractional land investment platform! Use my referral code: ${referralCode} and get Rs. 500 wallet credit on your first investment.`;
    try {
      await Share.share({ message: shareText });
    } catch { }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient colors={['#161B22', '#0F1115']} style={styles.heroCard}>
            <View style={styles.heroIconBox}>
                <Gift size={40} color="#00E38C" />
            </View>
            <Text style={styles.heroTitle}>Refer & Earn ₹500</Text>
            <Text style={styles.heroSub}>Invite friends to InvestLand. When they make their first investment, you both earn ₹500 in wallet credits.</Text>
        </LinearGradient>

        <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
            {loading ? <ActivityIndicator color="#00E38C" /> : (
                referralCode ? (
                    <View style={styles.codeRow}>
                        <View style={styles.codeBox}>
                            <Text style={styles.codeText}>{referralCode}</Text>
                        </View>
                        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                            {copied ? <Check size={18} color="#00E38C" /> : <Copy size={18} color="#00E38C" />}
                            <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.genBtn} onPress={handleGenerate} disabled={generating}>
                        {generating ? <ActivityIndicator color="#000" /> : <Text style={styles.genBtnText}>Generate Code</Text>}
                    </TouchableOpacity>
                )
            )}
        </View>

        {referralCode && (
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <LinearGradient colors={['#00E38C', '#00C476']} style={styles.shareBtnGrad}>
                    <Share2 size={20} color="#000" />
                    <Text style={styles.shareBtnText}>Share with Friends</Text>
                </LinearGradient>
            </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={styles.stepsCard}>
            {[
                { title: 'Share Code', sub: 'Send your referral code to friends.' },
                { title: 'Friend Signs Up', sub: 'They register using your code.' },
                { title: 'Both Earn Rewards', sub: 'Get ₹500 when they invest.' }
            ].map((step, i) => (
                <View key={i} style={styles.stepItem}>
                    <View style={styles.stepNumBox}>
                        <Text style={styles.stepNum}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        <Text style={styles.stepSub}>{step.sub}</Text>
                    </View>
                </View>
            ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#161B22', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2D333B' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 24, paddingTop: 10 },
  heroCard: { padding: 32, borderRadius: 28, borderWidth: 1, borderColor: '#2D333B', alignItems: 'center', marginBottom: 24 },
  heroIconBox: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(0, 227, 140, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  heroSub: { color: '#A0A0A0', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  codeCard: { backgroundColor: '#161B22', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#2D333B', alignItems: 'center', marginBottom: 16 },
  codeLabel: { color: '#666', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 },
  codeRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  codeBox: { backgroundColor: '#0F1115', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: '#2D333B' },
  codeText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0, 227, 140, 0.05)', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0, 227, 140, 0.2)' },
  copyText: { color: '#00E38C', fontSize: 14, fontWeight: '800' },
  genBtn: { backgroundColor: '#00E38C', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
  genBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  shareBtn: { borderRadius: 20, overflow: 'hidden', marginBottom: 32 },
  shareBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 12 },
  shareBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  sectionTitle: { color: '#666', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  stepsCard: { backgroundColor: '#161B22', borderRadius: 24, borderWidth: 1, borderColor: '#2D333B', padding: 20, gap: 24 },
  stepItem: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  stepNumBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0, 227, 140, 0.1)', alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: '#00E38C', fontSize: 14, fontWeight: '900' },
  stepTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  stepSub: { color: '#666', fontSize: 12, fontWeight: '600' },
});
