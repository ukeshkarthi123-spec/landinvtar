import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import {
  ShieldCheck, CreditCard, Smartphone, Settings,
  Lock, HeadphonesIcon, LogOut, ChevronRight,
  Bell, Gift, FileText, Star, UserCheck,
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import { computePortfolioStats } from '@/types/database';
import type { Investment } from '@/types/database';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  badge?: string;
  onPress?: () => void;
  danger?: boolean;
  color?: string;
  colors: any;
}

function MenuItem({ icon, label, value, badge, onPress, danger = false, color, colors }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.menuIcon, { backgroundColor: color ?? colors.bgCard2 }]}>{icon}</View>
      <Text style={[styles.menuLabel, { color: danger ? colors.error : colors.textPrimary }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value && <Text style={[styles.menuValue, { color: colors.textMuted }]}>{value}</Text>}
      {badge && (
        <View style={[styles.menuBadge, { backgroundColor: colors.emeraldGlow }]}>
          <Text style={[styles.menuBadgeText, { color: colors.emerald }]}>{badge}</Text>
        </View>
      )}
      {!danger && <ChevronRight size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { profile, signOut, refreshProfile } = useApp();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bankCount, setBankCount] = useState(0);
  const [upiCount, setUpiCount] = useState(0);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const isMounted = useRef(true);

  // Fetch investments with timeout
  const fetchInvestments = async () => {
    try {
      const result = await withTimeout(
        Promise.resolve(supabase
          .from('investments')
          .select('*, land_projects(id, name, location, image, expected_roi, category)')
          .eq('status', 'Active')),
        10000
      ) as any;

      if (!isMounted.current) return;

      const { data } = result;
      if (data) setInvestments(data as Investment[]);
    } catch (err) {
      if (isMounted.current) {
        console.error('Error fetching investments:', err);
      }
    }
  };

  // Fetch counts with timeout
  const fetchCounts = async () => {
    try {
      const [bankRes, upiRes, refRes]: any[] = await Promise.all([
        withTimeout(
          Promise.resolve(supabase.from('bank_accounts').select('id', { count: 'exact', head: true })),
          10000
        ),
        withTimeout(
          Promise.resolve(supabase.from('upi_ids').select('id', { count: 'exact', head: true })),
          10000
        ),
        withTimeout(
          Promise.resolve(supabase
            .from('referrals')
            .select('referral_code')
            .is('referred_email', null)
            .limit(1)
            .maybeSingle()),
          10000
        ),
      ]);

      if (!isMounted.current) return;

      setBankCount(bankRes.count ?? 0);
      setUpiCount(upiRes.count ?? 0);
      if (refRes.data) setReferralCode((refRes.data as { referral_code: string }).referral_code);
    } catch (err) {
      if (isMounted.current) {
        console.error('Error fetching counts:', err);
      }
    }
  };

  const loadAll = useCallback(async () => {
    await Promise.all([
      fetchInvestments(),
      fetchCounts(),
      refreshProfile(),
    ]);
  }, [refreshProfile]);

  useEffect(() => {
    isMounted.current = true;
    loadAll();

    return () => {
      isMounted.current = false;
    };
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchInvestments(), fetchCounts()]);
    setRefreshing(false);
  }, [refreshProfile, fetchInvestments, fetchCounts]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleRate = () => {
    router.push('/rate');
  };

  const handleReferral = () => {
    router.push('/refer-earn');
  };

  const stats = computePortfolioStats(investments);
  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const headerGradientColors: [string, string] = isDark
    ? ['#0D1A13', colors.bg]
    : ['#FFFFFF', colors.bg];

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicStyles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
      >
        {/* Header */}
        <LinearGradient colors={headerGradientColors} style={dynamicStyles.header} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
          <View style={dynamicStyles.headerTop}>
            <Text style={dynamicStyles.headerTitle}>Profile</Text>
            <TouchableOpacity style={dynamicStyles.settingsBtn} onPress={() => router.push('/settings')}>
              <Settings size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Profile Card */}
          <View style={dynamicStyles.profileCard}>
            {profile?.avatar && profile.avatar.startsWith('http') ? (
              <Image source={{ uri: profile.avatar }} style={dynamicStyles.avatarImage} />
            ) : (
              <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.avatarCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={dynamicStyles.avatarText}>{profile?.avatar || initials}</Text>
              </LinearGradient>
            )}
            <Text style={dynamicStyles.profileName}>{profile?.name ?? 'User'}</Text>
            <Text style={dynamicStyles.profileEmail}>{profile?.email ?? ''}</Text>
            <Text style={dynamicStyles.profilePhone}>{profile?.phone || 'No phone linked'}</Text>

            <View style={dynamicStyles.kycRow}>
              <ShieldCheck size={14} color={profile?.kyc_status === 'Verified' ? colors.emerald : colors.warning} />
              <Text style={[dynamicStyles.kycText, { color: profile?.kyc_status === 'Verified' ? colors.emerald : colors.warning }]}>
                KYC {profile?.kyc_status ?? 'Not Started'}
              </Text>
              <View style={dynamicStyles.kycDivider} />
              <Star size={14} color={colors.warning} />
              <Text style={dynamicStyles.memberText}>Premium Member</Text>
            </View>

            <TouchableOpacity style={dynamicStyles.editBtn} onPress={() => router.push('/edit-profile')}>
              <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.editBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={dynamicStyles.editBtnText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={dynamicStyles.statsRow}>
            <View style={dynamicStyles.statItem}>
              <Text style={dynamicStyles.statVal}>{investments.length}</Text>
              <Text style={dynamicStyles.statLbl}>Investments</Text>
            </View>
            <View style={dynamicStyles.statDivider} />
            <View style={dynamicStyles.statItem}>
              <Text style={dynamicStyles.statVal}>₹{(stats.portfolioValue / 100000).toFixed(2)}L</Text>
              <Text style={dynamicStyles.statLbl}>Portfolio</Text>
            </View>
            <View style={dynamicStyles.statDivider} />
            <View style={dynamicStyles.statItem}>
              <Text style={dynamicStyles.statVal}>+{stats.returnsPercent.toFixed(1)}%</Text>
              <Text style={dynamicStyles.statLbl}>ROI</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Referral Card */}
        <View style={dynamicStyles.section}>
          <TouchableOpacity style={dynamicStyles.referralCard} activeOpacity={0.85} onPress={handleReferral}>
            <LinearGradient colors={['rgba(22,199,132,0.1)', 'rgba(14,159,110,0.04)']} style={dynamicStyles.referralGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={dynamicStyles.referralContent}>
                <Gift size={28} color={colors.emerald} />
                <View style={{ flex: 1 }}>
                  <Text style={dynamicStyles.referralTitle}>Refer & Earn ₹500</Text>
                  <Text style={dynamicStyles.referralSub}>Invite friends and earn rewards on their first investment</Text>
                </View>
                <ChevronRight size={18} color={colors.emerald} />
              </View>
              <View style={dynamicStyles.referralCodeRow}>
                <Text style={dynamicStyles.referralCodeLabel}>Your Code:</Text>
                <View style={dynamicStyles.referralCode}>
                  <Text style={dynamicStyles.referralCodeText}>{referralCode ?? 'TAP TO GET'}</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Account Menu */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.menuSectionTitle}>Account</Text>
          <View style={dynamicStyles.menuCard}>
            <MenuItem
              icon={<UserCheck size={18} color={colors.emerald} />}
              label="KYC Verification"
              value={profile?.kyc_status ?? 'Not Started'}
              color={colors.emeraldGlow}
              onPress={() => router.push('/kyc')}
              colors={colors}
            />
            <View style={dynamicStyles.menuDivider} />
            <MenuItem
              icon={<CreditCard size={18} color='#60A5FA' />}
              label="Bank Accounts"
              value={bankCount > 0 ? `${bankCount} Linked` : 'Add Account'}
              color="rgba(96,165,250,0.12)"
              onPress={() => router.push('/bank-accounts')}
              colors={colors}
            />
            <View style={dynamicStyles.menuDivider} />
            <MenuItem
              icon={<Smartphone size={18} color='#FBBF24' />}
              label="UPI IDs"
              value={upiCount > 0 ? `${upiCount} Linked` : 'Add UPI'}
              color="rgba(251,191,36,0.12)"
              onPress={() => router.push('/upi-ids')}
              colors={colors}
            />
            <View style={dynamicStyles.menuDivider} />
            <MenuItem
              icon={<FileText size={18} color='#A78BFA' />}
              label="Tax Reports"
              badge="Download"
              color="rgba(167,139,250,0.12)"
              onPress={() => router.push('/tax-reports')}
              colors={colors}
            />
          </View>
        </View>

        {/* Preferences Menu */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.menuSectionTitle}>Preferences</Text>
          <View style={dynamicStyles.menuCard}>
            <MenuItem
              icon={<Bell size={18} color={colors.emerald} />}
              label="Notifications"
              color={colors.emeraldGlow}
              onPress={() => router.push('/notifications')}
              colors={colors}
            />
            <View style={dynamicStyles.menuDivider} />
            <MenuItem
              icon={<Lock size={18} color='#60A5FA' />}
              label="Security & Privacy"
              color="rgba(96,165,250,0.12)"
              onPress={() => router.push('/security')}
              colors={colors}
            />
          </View>
        </View>

        {/* Support Menu */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.menuSectionTitle}>Support</Text>
          <View style={dynamicStyles.menuCard}>
            <MenuItem
              icon={<HeadphonesIcon size={18} color={colors.emerald} />}
              label="Customer Support 24/7"
              color={colors.emeraldGlow}
              onPress={() => router.push('/support')}
              colors={colors}
            />
            <View style={dynamicStyles.menuDivider} />
            <MenuItem
              icon={<Star size={18} color='#FBBF24' />}
              label="Rate InvestLand"
              color="rgba(251,191,36,0.12)"
              onPress={handleRate}
              colors={colors}
            />
          </View>
        </View>

        {/* Logout */}
        <View style={dynamicStyles.section}>
          <View style={dynamicStyles.menuCard}>
            <MenuItem
              icon={<LogOut size={18} color={colors.error} />}
              label="Logout"
              danger
              color="rgba(239,68,68,0.12)"
              onPress={handleLogout}
              colors={colors}
            />
          </View>
        </View>

        <View style={dynamicStyles.versionRow}>
          <Text style={dynamicStyles.versionText}>InvestLand v1.0.0</Text>
          <View style={dynamicStyles.versionDot} />
          <Text style={dynamicStyles.versionText}>Made in India</Text>
        </View>

        <Text style={dynamicStyles.disclaimer}>
          InvestLand facilitates legally compliant fractional land investments. All investments are subject to market risks. Please read all offer documents carefully before investing. SEBI regulations apply.
        </Text>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  menuIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '600' },
  menuValue: { fontSize: 12, fontWeight: '500', marginRight: 8 },
  menuBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  menuBadgeText: { fontSize: 10, fontWeight: '700' },
});

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 20 },
    header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    settingsBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    profileCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: colors.emerald + '44',
    },
    avatarText: { color: '#fff', fontSize: 28, fontWeight: '900' },
    profileName: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 3 },
    profileEmail: { color: colors.textMuted, fontSize: 13, marginBottom: 2 },
    profilePhone: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
    kycRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    kycText: { fontSize: 12, fontWeight: '700' },
    kycDivider: { width: 1, height: 14, backgroundColor: colors.border, marginHorizontal: 4 },
    memberText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
    editBtn: { borderRadius: 10, overflow: 'hidden', alignSelf: 'stretch' },
    editBtnGrad: { paddingVertical: 11, alignItems: 'center' },
    editBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { width: 1, backgroundColor: colors.border },
    statVal: { color: colors.emerald, fontSize: 16, fontWeight: '800' },
    statLbl: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
    section: { paddingHorizontal: 20, marginTop: 16 },
    menuSectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    menuCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    menuDivider: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
    referralCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder },
    referralGrad: { padding: 16 },
    referralContent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    referralTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3 },
    referralSub: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
    referralCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    referralCodeLabel: { color: colors.textMuted, fontSize: 12 },
    referralCode: {
      backgroundColor: colors.emeraldGlow,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.emerald + '33',
    },
    referralCodeText: { color: colors.emerald, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
    versionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 24, marginBottom: 12 },
    versionDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textMuted },
    versionText: { color: colors.textMuted, fontSize: 11 },
    disclaimer: {
      color: colors.textDisabled,
      fontSize: 10,
      lineHeight: 15,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
  });
}
