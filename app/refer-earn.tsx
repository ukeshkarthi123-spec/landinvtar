import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Share, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Gift, Copy, Share2, Users, TrendingUp, Award,
  Check, AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import type { Referral } from '@/types/database';

export default function ReferEarnScreen() {
  const { colors, isDark } = useTheme();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const { data: existingRef } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (existingRef && existingRef.length > 0) {
      const ownRef = existingRef.find(r => r.referred_email === null);
      if (ownRef) setReferralCode(ownRef.referral_code);
      setReferrals(existingRef as Referral[]);
    }
    setError(null);
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('generate_referral_code');
    if (rpcError) {
      setError(rpcError.message);
    } else if (data) {
      setReferralCode(data as string);
      await fetchData();
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    if (!referralCode) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(referralCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralCode) return;
    const shareText = `Join InvestLand - India's trusted fractional land investment platform! Use my referral code: ${referralCode} and get Rs. 500 wallet credit on your first investment.`;
    try {
      await Share.share({ message: shareText });
    } catch {
      // User cancelled share
    }
  };

  const completedReferrals = referrals.filter(r => r.status === 'Completed' || r.status === 'Rewarded');
  const totalRewards = referrals.reduce((s, r) => s + (r.reward_amount ?? 0), 0);

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <ScreenHeader title="Refer & Earn" />

      {loading ? (
        <View style={dynamicStyles.centered}>
          <ActivityIndicator color={colors.emerald} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scroll}>
          <LinearGradient
            colors={['rgba(22,199,132,0.12)', 'rgba(14,159,110,0.04)']}
            style={dynamicStyles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Gift size={36} color={colors.emerald} />
            <Text style={dynamicStyles.heroTitle}>Refer & Earn Rs. 500</Text>
            <Text style={dynamicStyles.heroSub}>
              Invite friends to InvestLand. When they make their first investment, you both earn Rs. 500 in wallet credits.
            </Text>
          </LinearGradient>

          <View style={dynamicStyles.codeCard}>
            <Text style={dynamicStyles.codeLabel}>Your Referral Code</Text>
            {referralCode ? (
              <View style={dynamicStyles.codeRow}>
                <View style={dynamicStyles.codeBox}>
                  <Text style={dynamicStyles.codeText}>{referralCode}</Text>
                </View>
                <TouchableOpacity style={dynamicStyles.copyBtn} onPress={handleCopy}>
                  {copied ? <Check size={16} color={colors.emerald} /> : <Copy size={16} color={colors.emerald} />}
                  <Text style={dynamicStyles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[dynamicStyles.generateBtn, generating && dynamicStyles.generateBtnDisabled]}
                onPress={handleGenerate}
                disabled={generating}
                activeOpacity={0.85}
              >
                {generating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dynamicStyles.generateBtnText}>Generate Code</Text>}
              </TouchableOpacity>
            )}
            {referralCode && (
              <TouchableOpacity style={dynamicStyles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                <Share2 size={16} color="#fff" />
                <Text style={dynamicStyles.shareBtnText}>Share with Friends</Text>
              </TouchableOpacity>
            )}
            {error && (
              <View style={dynamicStyles.errorBox}>
                <AlertCircle size={14} color={colors.error} />
                <Text style={dynamicStyles.errorText}>{error}</Text>
              </View>
            )}
          </View>

          <View style={dynamicStyles.statsRow}>
            <View style={dynamicStyles.statCard}>
              <Users size={18} color='#60A5FA' />
              <Text style={dynamicStyles.statVal}>{referrals.filter(r => r.referred_email).length}</Text>
              <Text style={dynamicStyles.statLbl}>Invited</Text>
            </View>
            <View style={dynamicStyles.statCard}>
              <Check size={18} color={colors.success} />
              <Text style={dynamicStyles.statVal}>{completedReferrals.length}</Text>
              <Text style={dynamicStyles.statLbl}>Completed</Text>
            </View>
            <View style={dynamicStyles.statCard}>
              <Award size={18} color='#FBBF24' />
              <Text style={dynamicStyles.statVal}>Rs. {totalRewards}</Text>
              <Text style={dynamicStyles.statLbl}>Earned</Text>
            </View>
          </View>

          <Text style={dynamicStyles.sectionTitle}>How It Works</Text>
          <View style={dynamicStyles.stepsCard}>
            <View style={dynamicStyles.stepRow}>
              <View style={dynamicStyles.stepNum}><Text style={dynamicStyles.stepNumText}>1</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.stepTitle}>Share Your Code</Text>
                <Text style={dynamicStyles.stepDesc}>Send your referral code to friends</Text>
              </View>
            </View>
            <View style={dynamicStyles.stepDivider} />
            <View style={dynamicStyles.stepRow}>
              <View style={dynamicStyles.stepNum}><Text style={dynamicStyles.stepNumText}>2</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.stepTitle}>Friend Signs Up</Text>
                <Text style={dynamicStyles.stepDesc}>They register using your code</Text>
              </View>
            </View>
            <View style={dynamicStyles.stepDivider} />
            <View style={dynamicStyles.stepRow}>
              <View style={dynamicStyles.stepNum}><Text style={dynamicStyles.stepNumText}>3</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.stepTitle}>Both Earn Rs. 500</Text>
                <Text style={dynamicStyles.stepDesc}>When they make their first investment</Text>
              </View>
            </View>
          </View>

          {referrals.filter(r => r.referred_email).length > 0 && (
            <>
              <Text style={dynamicStyles.sectionTitle}>Referral History</Text>
              {referrals.filter(r => r.referred_email).map((ref) => (
                <View key={ref.id} style={dynamicStyles.historyCard}>
                  <View style={dynamicStyles.historyIcon}>
                    <TrendingUp size={16} color={colors.emerald} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dynamicStyles.historyEmail}>{ref.referred_email}</Text>
                    <Text style={dynamicStyles.historyDate}>{new Date(ref.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  </View>
                  <View style={[dynamicStyles.historyStatus, { backgroundColor: (ref.status === 'Rewarded' ? colors.success : ref.status === 'Completed' ? '#60A5FA' : colors.warning) + '22' }]}>
                    <Text style={[dynamicStyles.historyStatusText, { color: ref.status === 'Rewarded' ? colors.success : ref.status === 'Completed' ? '#60A5FA' : colors.warning }]}>
                      {ref.status}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

function getDynamicStyles(colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: 20 },
    heroCard: {
      borderRadius: 20, padding: 24, alignItems: 'center',
      borderWidth: 1, borderColor: colors.glassBorder, marginBottom: 20,
    },
    heroTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginTop: 12, marginBottom: 8 },
    heroSub: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
    codeCard: {
      backgroundColor: colors.bgCard, borderRadius: 16, padding: 20,
      borderWidth: 1, borderColor: colors.border, marginBottom: 20, alignItems: 'center',
    },
    codeLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 12 },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    codeBox: {
      backgroundColor: colors.emeraldGlow, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
      borderWidth: 1, borderColor: colors.emerald + '33',
    },
    codeText: { color: colors.emerald, fontSize: 20, fontWeight: '900', letterSpacing: 2 },
    copyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.bgCard2, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    copyBtnText: { color: colors.emerald, fontSize: 13, fontWeight: '700' },
    generateBtn: {
      backgroundColor: colors.emerald, borderRadius: 12, paddingVertical: 14,
      paddingHorizontal: 32, alignItems: 'center',
    },
    generateBtnDisabled: { opacity: 0.6 },
    generateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.emerald, borderRadius: 12, paddingVertical: 12,
      paddingHorizontal: 24,
    },
    shareBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    errorBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: colors.error + '33', marginTop: 12, alignSelf: 'stretch',
    },
    errorText: { color: colors.error, fontSize: 13, lineHeight: 18, flex: 1 },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: {
      flex: 1, alignItems: 'center', gap: 6,
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    statVal: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
    statLbl: { color: colors.textMuted, fontSize: 11 },
    sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    stepsCard: {
      backgroundColor: colors.bgCard, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 20,
    },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    stepNum: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center',
    },
    stepNumText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    stepTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    stepDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    stepDivider: { height: 1, backgroundColor: colors.border, marginLeft: 40 },
    historyCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10,
    },
    historyIcon: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.emeraldGlow, alignItems: 'center', justifyContent: 'center',
    },
    historyEmail: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
    historyDate: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    historyStatus: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    historyStatusText: { fontSize: 10, fontWeight: '700' },
  });
}
