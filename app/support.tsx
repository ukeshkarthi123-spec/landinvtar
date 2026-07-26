import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, Platform, Linking, ActivityIndicator,
  FlatList, RefreshControl
} from 'react-native';
import {
  HeadphonesIcon, MessageSquare, Phone, Mail,
  ChevronRight, ArrowLeft, Send, ChevronDown,
  ChevronUp, ShieldCheck, HelpCircle, Inbox,
  Clock, CheckCircle2
} from 'lucide-react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import type { SupportTicket } from '@/types/database';

const FAQS = [
  {
    q: 'How do I withdraw funds?',
    a: 'To withdraw funds, go to the Wallet tab and tap "Withdraw". Enter the amount (min ₹100) and select your linked bank account. Withdrawals are processed within 24-48 working hours.'
  },
  {
    q: 'What are fractional land tokens?',
    a: 'Fractional land ownership allows you to invest in a percentage of a high-value property rather than buying the whole plot. Your investment represents a legal share of the asset.'
  },
  {
    q: 'Is my data secure?',
    a: 'We use industry-standard AES-256 encryption and HTTPS for all data transfers. Your account is protected by Supabase Auth with Row Level Security (RLS).'
  },
  {
    q: 'How are returns calculated?',
    a: 'Returns are calculated based on Target ROI and annual land appreciation. Profits are credited to your wallet upon exit or quarterly.'
  }
];

export default function SupportScreen() {
  const { colors, isDark } = useTheme();
  const { profile } = useApp();

  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isMounted = useRef(true);

  const fetchTickets = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (isMounted.current) setTickets(data as SupportTicket[]);
    } catch (err: any) {
      console.error('[Support] Fetch error:', err);
    } finally {
      if (isMounted.current) {
        setLoadingHistory(false);
        setRefreshing(false);
      }
    }
  }, [profile?.id]);

  useEffect(() => {
    isMounted.current = true;
    if (activeTab === 'history') fetchTickets();
    return () => { isMounted.current = false; };
  }, [activeTab, fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleSendTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in both subject and message.');
      return;
    }

    if (!profile?.id) {
        Alert.alert('Error', 'You must be signed in to send a ticket.');
        return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: profile.id,
          subject: subject.trim(),
          description: message.trim(),
          status: 'Open',
          category: 'General',
          priority: 'Medium'
        });

      if (error) throw error;

      Alert.alert('Success', 'Your support ticket has been created. We will get back to you shortly.');
      setSubject('');
      setMessage('');
      setActiveTab('history');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send ticket.');
    } finally {
      if (isMounted.current) setSending(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const renderTicket = ({ item }: { item: SupportTicket }) => {
    const statusColor = item.status === 'Open' ? colors.warning :
                        item.status === 'In Progress' ? '#3B82F6' :
                        item.status === 'Resolved' ? colors.emerald : '#666';

    return (
      <View style={[styles.ticketCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.ticketHeader}>
          <Text style={[styles.ticketSubject, { color: colors.textPrimary }]} numberOfLines={1}>{item.subject}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={[styles.ticketMessage, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text>
        <View style={styles.ticketFooter}>
          <Clock size={12} color={colors.textMuted} />
          <Text style={[styles.ticketDate, { color: colors.textMuted }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Customer Support</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && { borderBottomColor: colors.emerald }]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabLabel, { color: activeTab === 'new' ? colors.emerald : colors.textMuted }]}>New Ticket</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && { borderBottomColor: colors.emerald }]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabLabel, { color: activeTab === 'history' ? colors.emerald : colors.textMuted }]}>My Tickets</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'new' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* FAQ Section */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Frequently Asked Questions</Text>
          <View style={[styles.faqCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {FAQS.map((faq, i) => (
                  <View key={i} style={[styles.faqItemContainer, { borderBottomColor: colors.border }, i === FAQS.length - 1 && { borderBottomWidth: 0 }]}>
                      <TouchableOpacity
                          style={styles.faqItem}
                          onPress={() => toggleFaq(i)}
                          activeOpacity={0.7}
                      >
                          <Text style={[styles.faqText, { color: colors.textPrimary }, openFaq === i && { color: colors.emerald }]}>{faq.q}</Text>
                          {openFaq === i ? (
                              <ChevronUp size={16} color={colors.emerald} />
                          ) : (
                              <ChevronDown size={16} color={colors.textMuted} />
                          )}
                      </TouchableOpacity>
                      {openFaq === i && (
                          <View style={styles.faqAnswer}>
                              <Text style={[styles.faqAnswerText, { color: colors.textSecondary }]}>{faq.a}</Text>
                          </View>
                      )}
                  </View>
              ))}
          </View>

          {/* Form Section */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Send us a Message</Text>
          <View style={[styles.formCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Subject</Text>
                <TextInput
                    style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
                    placeholder="What can we help you with?"
                    placeholderTextColor={colors.textMuted}
                    value={subject}
                    onChangeText={setSubject}
                    editable={!sending}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Message</Text>
                <TextInput
                    style={[styles.input, styles.textArea, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
                    placeholder="Describe your issue in detail..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={6}
                    value={message}
                    onChangeText={setMessage}
                    editable={!sending}
                />
              </View>

              <TouchableOpacity
                style={[styles.sendBtn, (sending || !subject.trim() || !message.trim()) && { opacity: 0.6 }]}
                onPress={handleSendTicket}
                disabled={sending || !subject.trim() || !message.trim()}
              >
                  <LinearGradient colors={colors.gradientGreen} style={styles.sendBtnGrad}>
                      {sending ? (
                        <ActivityIndicator color="#000" size="small" />
                      ) : (
                        <>
                          <Text style={styles.sendBtnText}>Submit Ticket</Text>
                          <Send size={18} color="#000" />
                        </>
                      )}
                  </LinearGradient>
              </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderTicket}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.historyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
          ListEmptyComponent={
            loadingHistory ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator color={colors.emerald} size="large" />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Inbox size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No support tickets found</Text>
                <TouchableOpacity style={styles.historyBtn} onPress={() => setActiveTab('new')}>
                  <Text style={{ color: colors.emerald, fontWeight: '700' }}>Create New Ticket</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20,
    borderBottomWidth: 1
  },
  backBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  tab: { paddingVertical: 14, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 14, fontWeight: '700' },
  scroll: { paddingHorizontal: 24, paddingTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  faqCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', marginBottom: 32 },
  faqItemContainer: { borderBottomWidth: 1 },
  faqItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  faqText: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 16 },
  faqAnswer: { paddingHorizontal: 18, paddingBottom: 18, paddingTop: 0 },
  faqAnswerText: { fontSize: 13, lineHeight: 20 },
  formCard: { borderRadius: 24, padding: 20, borderWidth: 1 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 4 },
  input: { fontSize: 14, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  sendBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 10 },
  sendBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  sendBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  historyList: { padding: 24, gap: 16 },
  ticketCard: { padding: 18, borderRadius: 20, borderWidth: 1 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  ticketSubject: { fontSize: 15, fontWeight: '800', flex: 1, marginRight: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  ticketMessage: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  ticketFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ticketDate: { fontSize: 11, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '600' },
  historyBtn: { marginTop: 8 }
});
