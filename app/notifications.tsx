import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, TrendingUp, Bell, CreditCard, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/database';

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getNotifIcon(type: string, colors: ReturnType<typeof useTheme>['colors']) {
  switch (type) {
    case 'success': return <TrendingUp size={18} color={colors.success} />;
    case 'info': return <Bell size={18} color="#60A5FA" />;
    case 'warning': return <AlertCircle size={18} color={colors.warning} />;
    default: return <Bell size={18} color={colors.textMuted} />;
  }
}

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setNotifications((data ?? []) as Notification[]);
      setError(null);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    setMarking(true);
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
    setMarking(false);
  };

  const unread = notifications.filter(n => !n.is_read);
  const read = notifications.filter(n => n.is_read);

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <LinearGradient colors={isDark ? ['#0D1A13', colors.bg] : ['#FFFFFF', colors.bg]} style={dynamicStyles.header} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
        <View style={dynamicStyles.headerRow}>
          <TouchableOpacity style={dynamicStyles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>Notifications</Text>
          <TouchableOpacity onPress={handleMarkAllRead} disabled={marking || unread.length === 0}>
            <Text style={[dynamicStyles.markAllText, (marking || unread.length === 0) && { opacity: 0.4 }]}>
              {marking ? 'Marking...' : 'Mark All Read'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={dynamicStyles.centered}>
          <ActivityIndicator color={colors.emerald} size="large" />
          <Text style={dynamicStyles.loadingText}>Loading notifications...</Text>
        </View>
      ) : error ? (
        <View style={dynamicStyles.centered}>
          <AlertCircle size={40} color={colors.error} />
          <Text style={dynamicStyles.errorText}>{error}</Text>
          <TouchableOpacity style={dynamicStyles.retryBtn} onPress={onRefresh}>
            <Text style={dynamicStyles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={dynamicStyles.centered}>
          <Bell size={40} color={colors.textMuted} />
          <Text style={dynamicStyles.emptyTitle}>No Notifications</Text>
          <Text style={dynamicStyles.emptySub}>You're all caught up!</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={dynamicStyles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
        >
          {unread.length > 0 && (
            <>
              <Text style={dynamicStyles.sectionLabel}>New</Text>
              {unread.map(notif => (
                <View key={notif.id} style={[dynamicStyles.notifCard, dynamicStyles.notifCardUnread]}>
                  <View style={[dynamicStyles.notifIcon, notif.type === 'success' ? { backgroundColor: colors.emeraldGlow } : notif.type === 'warning' ? { backgroundColor: 'rgba(245,158,11,0.12)' } : { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
                    {getNotifIcon(notif.type, colors)}
                  </View>
                  <View style={dynamicStyles.notifContent}>
                    <Text style={dynamicStyles.notifTitle}>{notif.title}</Text>
                    <Text style={dynamicStyles.notifMsg}>{notif.message}</Text>
                    <Text style={dynamicStyles.notifTime}>{formatTime(notif.created_at)}</Text>
                  </View>
                  <View style={dynamicStyles.unreadDot} />
                </View>
              ))}
            </>
          )}

          {read.length > 0 && (
            <>
              <Text style={dynamicStyles.sectionLabel}>Earlier</Text>
              {read.map(notif => (
                <View key={notif.id} style={dynamicStyles.notifCard}>
                  <View style={[dynamicStyles.notifIcon, notif.type === 'success' ? { backgroundColor: colors.emeraldGlow2 } : notif.type === 'warning' ? { backgroundColor: 'rgba(245,158,11,0.06)' } : { backgroundColor: 'rgba(96,165,250,0.06)' }]}>
                    {getNotifIcon(notif.type, colors)}
                  </View>
                  <View style={dynamicStyles.notifContent}>
                    <Text style={[dynamicStyles.notifTitle, { color: colors.textSecondary }]}>{notif.title}</Text>
                    <Text style={dynamicStyles.notifMsg}>{notif.message}</Text>
                    <Text style={dynamicStyles.notifTime}>{formatTime(notif.created_at)}</Text>
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
    header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', flex: 1 },
    markAllText: { color: colors.emerald, fontSize: 12, fontWeight: '600' },
    scroll: { padding: 20 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
    loadingText: { color: colors.textMuted, fontSize: 13 },
    errorText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.emeraldGlow, borderWidth: 1, borderColor: colors.emerald + '44' },
    retryText: { color: colors.emerald, fontSize: 14, fontWeight: '700' },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
    emptySub: { color: colors.textMuted, fontSize: 14 },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 4,
    },
    notifCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    notifCardUnread: {
      borderColor: colors.emerald + '22',
      backgroundColor: colors.emeraldGlow2,
    },
    notifIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    notifContent: { flex: 1 },
    notifTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    notifMsg: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 6 },
    notifTime: { color: colors.textMuted, fontSize: 11 },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.emerald,
      flexShrink: 0,
      marginTop: 4,
    },
  });
}
