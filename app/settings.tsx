import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Share, Alert,
} from 'react-native';
import {
  Bell, Lock, FileText, HeadphonesIcon, Star, Info,
  ChevronRight, LogOut, Shield, Download, Share2, Trash2,
  Sun, Moon, Smartphone, Check,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { useTheme, ThemeMode } from '@/context/ThemeContext';

export default function SettingsScreen() {
  const { signOut, profile } = useApp();
  const { mode, setMode, colors, isDark } = useTheme();
  const isAdmin = profile?.is_admin === true;

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Check out InvestLand - Invest in premium land from Rs. 500! Download now.',
        title: 'InvestLand',
      });
    } catch {
      // User cancelled
    }
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This will clear cached data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', onPress: () => Alert.alert('Done', 'Cache cleared successfully.') },
    ]);
  };

  const themeOptions: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Light Mode', icon: <Sun size={18} color={colors.emerald} /> },
    { mode: 'dark', label: 'Dark Mode', icon: <Moon size={18} color={colors.emerald} /> },
    { mode: 'system', label: 'System Default', icon: <Smartphone size={18} color={colors.emerald} /> },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Settings" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Appearance */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Appearance</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {themeOptions.map((opt, idx) => (
            <React.Fragment key={opt.mode}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setMode(opt.mode)}
                activeOpacity={0.75}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.emeraldGlow }]}>
                  {opt.icon}
                </View>
                <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
                {mode === opt.mode && (
                  <Check size={18} color={colors.emerald} />
                )}
              </TouchableOpacity>
              {idx < themeOptions.length - 1 && (
                <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Account */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Account</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/edit-profile')} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: colors.emeraldGlow }]}>
              <Shield size={18} color={colors.emerald} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Edit Profile</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/security')} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
              <Lock size={18} color='#60A5FA' />
            </View>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Security & Privacy</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications')} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: colors.emeraldGlow }]}>
              <Bell size={18} color={colors.emerald} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Notifications</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Financial */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Financial</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/bank-accounts')} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
              <FileText size={18} color='#60A5FA' />
            </View>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Bank Accounts</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/tax-reports')} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(167,139,250,0.12)' }]}>
              <Download size={18} color='#A78BFA' />
            </View>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Tax Reports</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Support */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Support</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/support')} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: colors.emeraldGlow }]}>
              <HeadphonesIcon size={18} color={colors.emerald} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Customer Support</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/rate')} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(251,191,36,0.12)' }]}>
              <Star size={18} color='#FBBF24' />
            </View>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Rate InvestLand</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.menuItem} onPress={handleShareApp} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: colors.emeraldGlow }]}>
              <Share2 size={18} color={colors.emerald} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Share App</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>About</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('InvestLand', 'Version 1.0.0\nMade in India')} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: colors.bgCard2 }]}>
              <Info size={18} color={colors.textSecondary} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>App Version</Text>
            <Text style={[styles.menuValue, { color: colors.textMuted }]}>1.0.0</Text>
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.menuItem} onPress={handleClearCache} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(239,68,68,0.08)' }]}>
              <Trash2 size={18} color={colors.error} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Clear Cache</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {isAdmin && (
            <>
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/admin')} activeOpacity={0.75}>
                <View style={[styles.menuIcon, { backgroundColor: colors.emeraldGlow }]}>
                  <Shield size={18} color={colors.emerald} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Admin Panel</Text>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Logout */}
        <View style={[styles.menuCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.75}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
              <LogOut size={18} color={colors.error} />
            </View>
            <Text style={[styles.menuLabel, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  menuCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  menuIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  menuValue: { fontSize: 12, fontWeight: '500', marginRight: 8 },
  menuDivider: { height: 1, marginLeft: 64 },
});
