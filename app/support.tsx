import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Modal, FlatList,
} from 'react-native';
import {
  HeadphonesIcon, Plus, MessageCircle, ChevronRight,
  AlertCircle, Send, Clock, CheckCircle2,
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import type { SupportTicket } from '@/types/database';

const CATEGORIES = ['General', 'Investment', 'Payment', 'KYC', 'Technical'] as const;
const FAQS = [
  { q: 'How do I start investing?', a: 'Complete your KYC verification, add money to your wallet, and browse projects on the Explore tab to invest.' },
  { q: 'When will I get returns?', a: 'Returns are calculated based on the expected ROI of each project. You can track your portfolio performance in real-time.' },
  { q: 'How do I withdraw money?', a: 'Go to your Wallet tab, tap Withdraw, and select your linked bank account. Withdrawals are processed within 1-2 business days.' },
  { q: 'Is my investment safe?', a: 'All investments are in legally compliant, government-approved land projects. However, all investments carry market risk.' },
  { q: 'How long is the lock-in period?', a: 'Lock-in periods vary by project. Check the project timeline on the property details page before investing.' },
];

export default function SupportScreen() {
  const { colors, isDark } = useTheme();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [showFaq, setShowFaq] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('General');
  const [creating, setCreating] = useState(false);

  const [chatMessage, setChatMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTickets = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setTickets((data ?? []) as SupportTicket[]);
      setError(null);
    }
  }, []);

  useEffect(() => {
    fetchTickets().finally(() => setLoading(false));
  }, [fetchTickets]);

  const handleCreate = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Missing Info', 'Please enter subject and description.');
      return;
    }
    setCreating(true);
    const { error: insertError } = await supabase
      .from('support_tickets')
      .insert({
        subject: subject.trim(),
        description: description.trim(),
        category,
        status: 'Open',
        priority: 'Medium',
        messages: [{
          sender: 'user',
          message: description.trim(),
          created_at: new Date().toISOString(),
        }],
      });

    if (insertError) {
      Alert.alert('Error', insertError.message);
    } else {
      await fetchTickets();
      setShowCreate(false);
      setSubject('');
      setDescription('');
      setCategory('General');
    }
    setCreating(false);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !activeTicket) return;
    setSending(true);
    const { error: rpcError } = await supabase.rpc('add_support_message', {
      p_ticket_id: activeTicket.id,
      p_message: chatMessage.trim(),
    });

    if (rpcError) {
      Alert.alert('Error', rpcError.message);
    } else {
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', activeTicket.id)
        .maybeSingle();
      if (data) {
        setActiveTicket(data as SupportTicket);
        setTickets(prev => prev.map(t => t.id === data.id ? data as SupportTicket : t));
      }
      setChatMessage('');
    }
    setSending(false);
  };

  const openChat = (ticket: SupportTicket) => {
    setActiveTicket(ticket);
    setShowChat(true);
  };

  const statusColor = (status: string) => {
    if (status === 'Open') return colors.warning;
    if (status === 'In Progress') return '#60A5FA';
    if (status === 'Resolved') return colors.success;
    return colors.textMuted;
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <ScreenHeader
        title="Customer Support"
        rightAction={
          <TouchableOpacity style={dynamicStyles.addBtn} onPress={() => setShowCreate(true)}>
            <Plus size={20} color={colors.emerald} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={dynamicStyles.centered}>
          <ActivityIndicator color={colors.emerald} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scroll}>
          <View style={dynamicStyles.infoBanner}>
            <HeadphonesIcon size={20} color={colors.emerald} />
            <View style={{ flex: 1 }}>
              <Text style={dynamicStyles.infoTitle}>24/7 Support</Text>
              <Text style={dynamicStyles.infoSub}>We typically respond within 2 hours</Text>
            </View>
          </View>

          {error && (
            <View style={dynamicStyles.errorBox}>
              <AlertCircle size={14} color={colors.error} />
              <Text style={dynamicStyles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={dynamicStyles.sectionTitle}>Your Tickets</Text>
          {tickets.length === 0 ? (
            <View style={dynamicStyles.emptyCard}>
              <MessageCircle size={32} color={colors.textMuted} />
              <Text style={dynamicStyles.emptyText}>No support tickets yet</Text>
              <TouchableOpacity style={dynamicStyles.createBtn} onPress={() => setShowCreate(true)}>
                <Plus size={14} color="#fff" />
                <Text style={dynamicStyles.createBtnText}>Create Ticket</Text>
              </TouchableOpacity>
            </View>
          ) : (
            tickets.map((ticket) => (
              <TouchableOpacity
                key={ticket.id}
                style={dynamicStyles.ticketCard}
                onPress={() => openChat(ticket)}
                activeOpacity={0.75}
              >
                <View style={dynamicStyles.ticketHeader}>
                  <View style={[dynamicStyles.categoryTag, { backgroundColor: colors.emeraldGlow }]}>
                    <Text style={dynamicStyles.categoryText}>{ticket.category}</Text>
                  </View>
                  <View style={[dynamicStyles.statusTag, { backgroundColor: statusColor(ticket.status) + '22' }]}>
                    <Text style={[dynamicStyles.statusText, { color: statusColor(ticket.status) }]}>{ticket.status}</Text>
                  </View>
                </View>
                <Text style={dynamicStyles.ticketSubject}>{ticket.subject}</Text>
                <Text style={dynamicStyles.ticketDesc} numberOfLines={2}>{ticket.description}</Text>
                <View style={dynamicStyles.ticketFooter}>
                  <Clock size={11} color={colors.textMuted} />
                  <Text style={dynamicStyles.ticketTime}>{new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                  {ticket.messages.length > 0 && (
                    <>
                      <View style={dynamicStyles.msgDot} />
                      <Text style={dynamicStyles.msgCount}>{ticket.messages.length} message{ticket.messages.length > 1 ? 's' : ''}</Text>
                    </>
                  )}
                  <ChevronRight size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text style={dynamicStyles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={dynamicStyles.faqCard}>
            {FAQS.map((faq, idx) => (
              <View key={idx}>
                <TouchableOpacity
                  style={dynamicStyles.faqItem}
                  onPress={() => setShowFaq(showFaq === idx ? null : idx)}
                  activeOpacity={0.7}
                >
                  <Text style={dynamicStyles.faqQ}>{faq.q}</Text>
                  <ChevronRight
                    size={16}
                    color={colors.textMuted}
                    style={{ transform: [{ rotate: showFaq === idx ? '90deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
                {showFaq === idx && (
                  <Text style={dynamicStyles.faqA}>{faq.a}</Text>
                )}
                {idx < FAQS.length - 1 && <View style={dynamicStyles.faqDivider} />}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Create Support Ticket</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>Category</Text>
                <View style={dynamicStyles.categoryRow}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[dynamicStyles.categoryChip, category === cat && dynamicStyles.categoryChipActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[dynamicStyles.categoryChipText, category === cat && { color: '#fff' }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>Subject</Text>
                <TextInput style={dynamicStyles.input} placeholder="Brief summary of your issue" placeholderTextColor={colors.textMuted} value={subject} onChangeText={setSubject} />
              </View>
              <View style={dynamicStyles.inputGroup}>
                <Text style={dynamicStyles.inputLabel}>Description</Text>
                <TextInput
                  style={[dynamicStyles.input, dynamicStyles.textArea]}
                  placeholder="Describe your issue in detail..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={description}
                  onChangeText={setDescription}
                />
              </View>
            </ScrollView>
            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity style={dynamicStyles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={dynamicStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dynamicStyles.saveBtn} onPress={handleCreate} disabled={creating}>
                {creating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dynamicStyles.saveBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showChat} animationType="slide" transparent>
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.chatContent}>
            <View style={dynamicStyles.chatHeader}>
              <View style={{ flex: 1 }}>
                <Text style={dynamicStyles.chatTitle} numberOfLines={1}>{activeTicket?.subject}</Text>
                <View style={dynamicStyles.chatStatusRow}>
                  <View style={[dynamicStyles.statusTag, { backgroundColor: statusColor(activeTicket?.status ?? 'Open') + '22' }]}>
                    <Text style={[dynamicStyles.statusText, { color: statusColor(activeTicket?.status ?? 'Open') }]}>{activeTicket?.status}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={dynamicStyles.closeBtn} onPress={() => setShowChat(false)}>
                <Text style={dynamicStyles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={activeTicket?.messages ?? []}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={({ item }) => (
                <View style={[dynamicStyles.msgBubble, item.sender === 'user' ? dynamicStyles.msgUser : dynamicStyles.msgSupport]}>
                  <Text style={dynamicStyles.msgText}>{item.message}</Text>
                  <Text style={dynamicStyles.msgTime}>{new Date(item.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              )}
              contentContainerStyle={dynamicStyles.chatList}
              showsVerticalScrollIndicator={false}
            />

            <View style={dynamicStyles.chatInputRow}>
              <TextInput
                style={dynamicStyles.chatInput}
                placeholder="Type a message..."
                placeholderTextColor={colors.textMuted}
                value={chatMessage}
                onChangeText={setChatMessage}
              />
              <TouchableOpacity style={dynamicStyles.sendBtn} onPress={handleSendMessage} disabled={sending || !chatMessage.trim()}>
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getDynamicStyles(colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    addBtn: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: colors.emeraldGlow, alignItems: 'center', justifyContent: 'center',
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: 20 },
    infoBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.emeraldGlow2, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.emerald + '22', marginBottom: 20,
    },
    infoTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    infoSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    errorBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: colors.error + '33', marginBottom: 16,
    },
    errorText: { color: colors.error, fontSize: 13, lineHeight: 18, flex: 1 },
    sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    emptyCard: {
      alignItems: 'center', gap: 10,
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 24,
      borderWidth: 1, borderColor: colors.border,
    },
    emptyText: { color: colors.textMuted, fontSize: 13 },
    createBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.emerald, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
      marginTop: 4,
    },
    createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    ticketCard: {
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10,
    },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    categoryTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    categoryText: { color: colors.emerald, fontSize: 10, fontWeight: '700' },
    statusTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    statusText: { fontSize: 10, fontWeight: '700' },
    ticketSubject: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    ticketDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 8 },
    ticketFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ticketTime: { color: colors.textMuted, fontSize: 11 },
    msgDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textMuted },
    msgCount: { color: colors.textMuted, fontSize: 11 },
    faqCard: {
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 4,
      borderWidth: 1, borderColor: colors.border,
    },
    faqItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
    faqQ: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 },
    faqA: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, paddingHorizontal: 14, paddingBottom: 14 },
    faqDivider: { height: 1, backgroundColor: colors.border },
    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, maxHeight: '85%',
    },
    modalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 20 },
    inputGroup: { marginBottom: 14 },
    inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
    input: {
      backgroundColor: colors.bgInput, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 14, color: colors.textPrimary, fontSize: 15,
    },
    textArea: { minHeight: 100, paddingTop: 14 },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    categoryChip: {
      backgroundColor: colors.bgInput, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
      borderWidth: 1, borderColor: colors.border,
    },
    categoryChipActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
    categoryChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cancelBtn: {
      flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
      backgroundColor: colors.bgCard2, borderWidth: 1, borderColor: colors.border,
    },
    cancelBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    saveBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: colors.emerald },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    chatContent: {
      flex: 1, backgroundColor: colors.bgCard,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      marginTop: 50,
    },
    chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    chatTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
    chatStatusRow: { flexDirection: 'row' },
    closeBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgCard2, borderRadius: 8 },
    closeBtnText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    chatList: { padding: 16, gap: 10 },
    msgBubble: { maxWidth: '80%', borderRadius: 14, padding: 12 },
    msgUser: { alignSelf: 'flex-end', backgroundColor: colors.emerald + '22' },
    msgSupport: { alignSelf: 'flex-start', backgroundColor: colors.bgCard2 },
    msgText: { color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
    msgTime: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
    chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
    chatInput: {
      flex: 1, backgroundColor: colors.bgInput, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 12,
      color: colors.textPrimary, fontSize: 14,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center',
    },
  });
}
