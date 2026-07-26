import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowLeft, TrendingUp, Bell, CreditCard, AlertCircle,
  Wallet, ShieldCheck, Landmark, CheckCircle2, Trash2,
  Inbox
} from 'lucide-react-native';
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

function getNotifIcon(type: string, colors: any) {
  switch (type) {
    case 'success': return <CheckCircle2 size={18} color={colors.emerald} />;
    case 'payment': return <Wallet size={18} color={colors.emerald} />;
    case 'investment': return <TrendingUp size={18} color={colors.emerald} />;
    case 'kyc': return <ShieldCheck size={18} color="#3B82F6" />;
    case 'info': return <Bell size={18} color="#60A5FA" />;
    case 'warning': return <AlertCircle size={18} color="#FBBF24" />;
    case 'property': return <Landmark size={18} color="#A78BFA" />;
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

  const isMounted = useRef(true);
  const dynamicStyles = getDynamicStyles(colors, isDark);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isMounted.current) return;

      if (fetchError) throw fetchError;
      setNotifications((data ?? []) as Notification[]);
      setError(null);
    } catch (err: any) {
      if (isMounted.current) {
        setError(err.message || 'Failed to load notifications');
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    setLoading(true);
    fetchNotifications().finally(() => {
        if (isMounted.current) setLoading(false);
    });
    return () => { isMounted.current = false; };
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    if (isMounted.current) setRefreshing(false);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      const { error: rpcError } = await supabase.rpc('mark_all_notifications_read');
      if (rpcError) throw rpcError;
      if (isMounted.current) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error('[Notifications] Mark all read error:', err);
    } finally {
      if (isMounted.current) setMarking(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (updateError) throw updateError;
      if (isMounted.current) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch (err) {
      console.error('[Notifications] Mark as read error:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Premium Header */}
      <View style={dynamicStyles.header}>
        <TouchableOpacity style={dynamicStyles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
            <Text style={dynamicStyles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && <Text style={dynamicStyles.headerSub}>{unreadCount} unread messages</Text>}
        </View>
        <TouchableOpacity
            onPress={handleMarkAllRead}
            disabled={marking || unreadCount === 0}
            style={[dynamicStyles.markAllBtn, (marking || unreadCount === 0) && { opacity: 0.5 }]}
        >
            <Text style={dynamicStyles.markAllText}>{marking ? 'Wait...' : 'Mark All Read'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={dynamicStyles.centered}>
          <ActivityIndicator color={colors.emerald} size="large" />
          <Text style={dynamicStyles.loadingText}>Fetching updates...</Text>
        </View>
      ) : error ? (
        <View style={dynamicStyles.centered}>
          <AlertCircle size={48} color={colors.error} />
          <Text style={dynamicStyles.errorText}>{error}</Text>
          <TouchableOpacity style={dynamicStyles.retryBtn} onPress={onRefresh}>
            <Text style={dynamicStyles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={dynamicStyles.centered}>
          <View style={dynamicStyles.emptyIconBox}>
            <Inbox size={48} color={colors.bgCard2} />
          </View>
          <Text style={dynamicStyles.emptyTitle}>No notifications yet</Text>
          <Text style={dynamicStyles.emptySub}>We'll notify you when something important happens.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={dynamicStyles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
        >
          {notifications.map((notif) => (
            <TouchableOpacity
                key={notif.id}
                style={[dynamicStyles.notifCard, !notif.is_read && dynamicStyles.notifCardUnread]}
                onPress={() => !notif.is_read && handleMarkAsRead(notif.id)}
                activeOpacity={0.8}
            >
              <View style={[dynamicStyles.notifIconBox, { backgroundColor: !notif.is_read ? colors.emerald + '1a' : colors.bgCard2 }]}>
                {getNotifIcon(notif.type, colors)}
              </View>
              <View style={dynamicStyles.notifContent}>
                <View style={dynamicStyles.notifHeader}>
                    <Text style={[dynamicStyles.notifTitle, !notif.is_read && dynamicStyles.notifTitleUnread]}>{notif.title}</Text>
                    {!notif.is_read && <View style={dynamicStyles.unreadDot} />}
                </View>
                <Text style={dynamicStyles.notifMsg} numberOfLines={2}>{notif.message}</Text>
                <Text style={dynamicStyles.notifTime}>{formatTime(notif.created_at)}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 16,
      paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20,
      borderBottomWidth: 1, borderBottomColor: colors.border
    },
    backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    headerSub: { color: colors.emerald, fontSize: 12, fontWeight: '600', marginTop: 2 },
    markAllBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.emerald + '1a' },
    markAllText: { color: colors.emerald, fontSize: 12, fontWeight: '700' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
    loadingText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
    errorText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.emerald + '1a', borderWidth: 1, borderColor: colors.emerald + '4d' },
    retryText: { color: colors.emerald, fontSize: 14, fontWeight: '700' },
    emptyIconBox: { width: 100, height: 100, borderRadius: 40, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    scroll: { padding: 24 },
    notifCard: {
      flexDirection: 'row', gap: 16, padding: 16, borderRadius: 20, backgroundColor: colors.bgCard,
      borderWidth: 1, borderColor: colors.border, marginBottom: 12
    },
    notifCardUnread: {
      borderColor: colors.emerald + '4d',
      backgroundColor: colors.emerald + '05'
    },
    notifIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    notifContent: { flex: 1 },
    notifHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    notifTitle: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
    notifTitleUnread: { color: colors.textPrimary },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald },
    notifMsg: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 8 },
    notifTime: { color: colors.textDisabled, fontSize: 11, fontWeight: '700' }
  });
}
