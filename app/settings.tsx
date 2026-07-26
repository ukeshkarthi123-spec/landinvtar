import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Share, Alert, StatusBar, Platform
} from 'react-native';
import {
  Bell, Lock, FileText, HeadphonesIcon, Star, Info,
  ChevronRight, LogOut, Shield, Download, Share2, Trash2,
  Sun, Moon, Smartphone, Check, ArrowLeft
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { useTheme, ThemeMode } from '@/context/ThemeContext';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
  colors?: any;
}

const MenuItem = ({ icon, label, value, onPress, danger, active, colors }: MenuItemProps) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? 'rgba(239, 68, 68, 0.1)' : (colors ? colors.emerald + '0d' : 'rgba(0, 227, 140, 0.05)') }]}>
        {icon}
      </View>
      <Text style={[styles.menuLabel, colors && { color: colors.textPrimary }, danger && { color: '#EF4444' }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value && <Text style={[styles.menuValue, colors && { color: colors.textMuted }]}>{value}</Text>}
      {active ? <Check size={18} color="#00E38C" /> : <ChevronRight size={16} color={colors ? colors.textMuted : "#666"} />}
    </TouchableOpacity>
);

export default function SettingsScreen() {
  const { signOut, profile } = useApp();
  const { mode, setMode, colors, isDark } = useTheme();
  const isAdmin = profile?.is_admin === true || (profile as any)?.role === 'admin';

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
    Alert.alert('Clear Cache', 'Are you sure you want to clear the app cache?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Success', 'Cache cleared successfully.') }
    ]);
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={dynamicStyles.header}>
        <TouchableOpacity style={dynamicStyles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scroll}>
        {/* Section: Appearance */}
        <Text style={dynamicStyles.sectionTitle}>Appearance</Text>
        <View style={dynamicStyles.menuCard}>
            <MenuItem
                icon={<Sun size={18} color="#00E38C" />}
                label="Light Mode"
                onPress={() => setMode('light')}
                active={mode === 'light'}
                colors={colors}
            />
            <View style={dynamicStyles.divider} />
            <MenuItem
                icon={<Moon size={18} color="#00E38C" />}
                label="Dark Mode"
                onPress={() => setMode('dark')}
                active={mode === 'dark'}
                colors={colors}
            />
            <View style={dynamicStyles.divider} />
            <MenuItem
                icon={<Smartphone size={18} color="#00E38C" />}
                label="System Default"
                onPress={() => setMode('system')}
                active={mode === 'system'}
                colors={colors}
            />
        </View>

        {/* Section: Security */}
        <Text style={dynamicStyles.sectionTitle}>Security & Privacy</Text>
        <View style={dynamicStyles.menuCard}>
            <MenuItem
                icon={<Shield size={18} color="#3B82F6" />}
                label="Face ID / Biometrics"
                onPress={() => router.push('/security')}
                colors={colors}
            />
            <View style={dynamicStyles.divider} />
            <MenuItem
                icon={<Lock size={18} color="#3B82F6" />}
                label="Change Password"
                onPress={() => router.push('/change-password')}
                colors={colors}
            />
        </View>

        {/* Section: App Info */}
        <Text style={dynamicStyles.sectionTitle}>About InvestLand</Text>
        <View style={dynamicStyles.menuCard}>
            <MenuItem
                icon={<Info size={18} color="#A0A0A0" />}
                label="App Version"
                value="1.0.0"
                onPress={() => {}}
                colors={colors}
            />
            <View style={dynamicStyles.divider} />
            <MenuItem
                icon={<Share2 size={18} color="#A0A0A0" />}
                label="Share App"
                onPress={handleShareApp}
                colors={colors}
            />
            <View style={dynamicStyles.divider} />
            <MenuItem
                icon={<Trash2 size={18} color="#EF4444" />}
                label="Clear Cache"
                onPress={handleClearCache}
                colors={colors}
            />
        </View>

        {isAdmin && (
            <>
                <Text style={dynamicStyles.sectionTitle}>Administration</Text>
                <View style={dynamicStyles.menuCard}>
                    <MenuItem
                        icon={<Shield size={18} color="#00E38C" />}
                        label="Admin Panel"
                        onPress={() => router.push('/admin')}
                        colors={colors}
                    />
                </View>
            </>
        )}

        <View style={[dynamicStyles.menuCard, { marginTop: 12 }]}>
            <MenuItem
                icon={<LogOut size={18} color="#EF4444" />}
                label="Sign Out"
                danger
                onPress={handleLogout}
                colors={colors}
            />
        </View>

        <Text style={dynamicStyles.footerNote}>InvestLand v1.0.0 • Made with ❤️ in India</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 16,
      paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20,
    },
    backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    scroll: { paddingHorizontal: 24, paddingTop: 10 },
    sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
    menuCard: { backgroundColor: colors.bgCard, borderRadius: 24, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 24 },
    divider: { height: 1, backgroundColor: colors.border, marginLeft: 72 },
    footerNote: { color: colors.textMuted, fontSize: 11, textAlign: 'center', fontWeight: '700', marginTop: 12 },
  });
}

const styles = StyleSheet.create({
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '700' },
  menuValue: { fontSize: 13, fontWeight: '600', marginRight: 8 },
});
