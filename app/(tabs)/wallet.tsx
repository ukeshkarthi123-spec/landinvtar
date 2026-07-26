import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Modal, ActivityIndicator, RefreshControl,
  Platform, Alert, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Plus, ArrowDownToLine, Smartphone, Check, X,
  ArrowUpRight, ArrowDownLeft, CreditCard, Building, Repeat, AlertCircle,
  ChevronRight, ArrowRight, Wallet as WalletIcon, Bell
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { getSupabaseRuntimeConfig, supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import type { WalletTransaction } from '@/types/database';

// Import Razorpay dynamically to prevent issues on Web
let RazorpayCheckout: any = null;
if (Platform.OS !== 'web') {
  try {
    const rzp = require('react-native-razorpay');
    RazorpayCheckout = rzp.default || rzp;
  } catch (e) {
    console.error('[Wallet] Failed to load react-native-razorpay:', e);
  }
}

const quickAmounts = [500, 1000, 5000, 10000, 25000, 50000];

export default function WalletScreen() {
  const { colors, isDark } = useTheme();
  const { profile, refreshProfile, setWalletBalance } = useApp();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  const isMounted = useRef(true);
  const dynamicStyles = getDynamicStyles(colors, isDark);

  const fetchTransactions = async () => {
    try {
      const { data, error: err } = await supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!err && data) setTransactions(data as WalletTransaction[]);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchTransactions(), refreshProfile()]);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [refreshProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  }, [loadAll]);

  useEffect(() => {
    isMounted.current = true;
    loadAll();
    return () => { isMounted.current = false; };
  }, [loadAll]);

  // Load Razorpay script for Web
  useEffect(() => {
    if (Platform.OS === 'web' && !razorpayLoaded) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        console.log('[Razorpay Web] SDK Loaded');
        setRazorpayLoaded(true);
      };
      script.onerror = () => console.error('[Razorpay Web] SDK failed to load');
      document.body.appendChild(script);
    }
  }, []);

  /**
   * Main flow for adding money to the wallet.
   * 1. Creates an order via Supabase Edge Function.
   * 2. Opens Razorpay Checkout (Native or Web).
   * 3. Verifies the payment signature via backend.
   */
  const handleAddMoney = async () => {
    const val = Number(amount.trim());
    if (isNaN(val) || val < 100) {
      setError('Minimum add amount is ₹100.');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      console.log(`[AddMoney] Initiating flow for ₹${val}`);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again.');

      const { url: supabaseUrl } = getSupabaseRuntimeConfig();

      // 1. Create order on backend (Edge Function)
      console.log('[AddMoney] Step 1: Creating Razorpay Order...');
      const orderRes = await fetch(`${supabaseUrl}/functions/v1/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amount: val }),
      });

      const orderData = await orderRes.json();
      console.log('[AddMoney] Order Creation Result:', orderData);

      if (!orderRes.ok) {
        throw new Error(orderData.error || `Order creation failed (${orderRes.status})`);
      }

      if (!orderData.order_id) {
        throw new Error('Server did not return a valid Order ID.');
      }

      // 2. Open Checkout
      console.log('[AddMoney] Step 2: Opening Razorpay Checkout...');
      await openRazorpayCheckout(orderData.order_id, orderData.key_id, val);

    } catch (err: any) {
      console.error('[AddMoney] Flow error:', err);
      // Display specific error instead of generic "Payment cancelled"
      setError(err.message || 'Payment flow interrupted.');
    } finally {
      setActionLoading(false);
    }
  };

  const openRazorpayCheckout = (orderId: string, keyId: string, val: number) => {
    return new Promise<void>((resolve, reject) => {
      // Razorpay prefill data cleaning
      const prefillPhone = (profile?.phone || '').replace(/\D/g, '').slice(-10);

      const options = {
        key: keyId,
        amount: Math.round(val * 100), // Note: Overridden by order_id, but good practice
        currency: 'INR',
        name: 'InvestLand',
        description: 'Wallet Top-up',
        image: 'https://investland.app/logo.png', // Fallback icon
        order_id: orderId,
        prefill: {
          name: profile?.name || 'Investor',
          email: profile?.email || '',
          contact: prefillPhone,
        },
        theme: { color: '#00E38C' }, // emerald
        retry: { enabled: true, max_count: 3 },
      };

      console.log('[Razorpay] Checkout Options (Key hidden):', { ...options, key: '***' });

      if (Platform.OS === 'web') {
        if (!(window as any).Razorpay) {
          return reject(new Error('Razorpay script not ready. Please refresh.'));
        }

        const rzp = new (window as any).Razorpay({
          ...options,
          handler: async (res: any) => {
            console.log('[Razorpay Web] Payment received:', res);
            try {
              await verifyPayment(res);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              console.log('[Razorpay Web] Checkout modal closed by user');
              reject(new Error('Payment was cancelled by user.'));
            }
          }
        });
        rzp.open();
      } else {
        if (!RazorpayCheckout) {
          return reject(new Error('Razorpay module not available in this build.'));
        }

        RazorpayCheckout.open(options)
          .then(async (res: any) => {
            console.log('[Razorpay Native] Payment success response:', res);
            try {
              await verifyPayment(res);
              resolve();
            } catch (err) {
              reject(err);
            }
          })
          .catch((err: any) => {
            console.warn('[Razorpay Native] Error/Cancel:', err);

            // Standard Razorpay error mapping
            let msg = 'Payment failed';
            if (err.code === 2) {
              msg = 'Payment was cancelled.';
            } else if (err.description) {
              msg = err.description;
            } else if (err.reason) {
              msg = err.reason;
            } else if (typeof err === 'string') {
              msg = err;
            }

            reject(new Error(msg));
          });
      }
    });
  };

  const verifyPayment = async (res: any) => {
    console.log('[VerifyPayment] Step 3: Verifying with backend...');

    const { data: { session } } = await supabase.auth.getSession();
    const { url: supabaseUrl } = getSupabaseRuntimeConfig();

    if (!session) throw new Error('Session lost. Verification aborted.');

    const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        razorpay_order_id: res.razorpay_order_id,
        razorpay_payment_id: res.razorpay_payment_id,
        razorpay_signature: res.razorpay_signature,
      }),
    });

    const verifyData = await verifyRes.json();
    console.log('[VerifyPayment] Backend verification result:', verifyData);

    if (!verifyRes.ok) {
      throw new Error(verifyData.error || 'Payment signature verification failed.');
    }

    // Success! Update UI
    console.log('[VerifyPayment] Verification successful. New Balance:', verifyData.new_balance);

    if (typeof verifyData.new_balance === 'number') {
      setWalletBalance(verifyData.new_balance);
    }

    await refreshProfile();
    await fetchTransactions();

    setSuccess(true);
    setTimeout(() => {
      if (isMounted.current) {
        setSuccess(false);
        setShowAddModal(false);
        setAmount('');
      }
    }, 2000);
  };

  const handleWithdraw = async () => {
    const val = parseFloat(amount);
    if (!val || val < 100) { setError('Minimum withdrawal is ₹100'); return; }
    if (val > (profile?.wallet_balance ?? 0)) { setError('Insufficient balance'); return; }

    setActionLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('withdraw_wallet_money', { p_amount: val });
      if (rpcError) throw rpcError;

      console.log('[Withdraw] Success:', data);
      setWalletBalance((data as any).new_balance);
      await refreshProfile();
      await fetchTransactions();

      setSuccess(true);
      setTimeout(() => {
        if (isMounted.current) {
          setSuccess(false);
          setShowWithdrawModal(false);
          setAmount('');
        }
      }, 2000);
    } catch (err: any) {
      console.error('[Withdraw] Error:', err);
      setError(err.message || 'Withdrawal failed');
    } finally {
      setActionLoading(false);
    }
  };

  const balance = profile?.wallet_balance ?? 0;

  return (
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={dynamicStyles.header}>
        <View style={dynamicStyles.headerInfo}>
          <Text style={dynamicStyles.greetingText}>Manage Funds</Text>
          <Text style={dynamicStyles.headerTitle}>InvestLand Wallet</Text>
        </View>
        <TouchableOpacity style={dynamicStyles.iconButton} onPress={() => router.push('/notifications')}>
          <Bell size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicStyles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
      >
        {/* Balance Premium Card */}
        <LinearGradient
            colors={isDark ? ['#161B22', '#0F1115'] : ['#FFFFFF', '#F8FAFC']}
            style={dynamicStyles.balanceCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <View style={dynamicStyles.balanceHeader}>
                <View style={dynamicStyles.walletIconBox}>
                    <WalletIcon size={24} color={colors.emerald} />
                </View>
                <View>
                    <Text style={dynamicStyles.balanceLabel}>Available Balance</Text>
                    <Text style={dynamicStyles.balanceValue}>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
            </View>

            <View style={dynamicStyles.actionRow}>
                <TouchableOpacity style={dynamicStyles.actionBtn} onPress={() => { setError(null); setShowAddModal(true); }}>
                    <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.actionBtnGrad}>
                        <Plus size={18} color="#000" />
                        <Text style={dynamicStyles.actionBtnText}>Add Money</Text>
                    </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={dynamicStyles.withdrawBtn} onPress={() => { setError(null); setShowWithdrawModal(true); }}>
                    <ArrowDownToLine size={18} color={isDark ? "#FFFFFF" : colors.textPrimary} />
                    <Text style={dynamicStyles.withdrawBtnText}>Withdraw</Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>

        {/* Transaction History Section */}
        <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>Transaction History</Text>
            <TouchableOpacity><Text style={dynamicStyles.seeAllText}>Filter</Text></TouchableOpacity>
        </View>

        {loading ? (
            <ActivityIndicator color={colors.emerald} style={{ marginTop: 20 }} />
        ) : (
            <View style={dynamicStyles.txList}>
                {transactions.map(tx => (
                    <View key={tx.id} style={dynamicStyles.txCard}>
                        <View style={[dynamicStyles.txIconBox, { backgroundColor: tx.type === 'credit' ? colors.emerald + '1a' : 'rgba(239, 68, 68, 0.1)' }]}>
                            {tx.type === 'credit' ? <ArrowDownLeft size={20} color={colors.emerald} /> : <ArrowUpRight size={20} color={colors.error} />}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={dynamicStyles.txDesc}>{tx.description}</Text>
                            <Text style={dynamicStyles.txDate}>{new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[dynamicStyles.txAmount, { color: tx.type === 'credit' ? colors.emerald : colors.textPrimary }]}>
                                {tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                            </Text>
                            <Text style={[dynamicStyles.txStatus, { color: tx.status === 'Completed' ? colors.emerald : colors.warning }]}>{tx.status}</Text>
                        </View>
                    </View>
                ))}
                {transactions.length === 0 && (
                    <View style={dynamicStyles.emptyState}>
                        <Text style={dynamicStyles.emptyText}>No transactions found</Text>
                    </View>
                )}
            </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Money Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modal}>
            {success ? (
              <View style={dynamicStyles.successState}>
                <View style={dynamicStyles.successCircle}><Check size={32} color="#fff" /></View>
                <Text style={dynamicStyles.successTitle}>Money Added!</Text>
                <Text style={dynamicStyles.successSub}>₹{parseFloat(amount || '0').toLocaleString('en-IN')} added to your wallet.</Text>
              </View>
            ) : (
              <>
                <View style={dynamicStyles.modalHeader}>
                  <Text style={dynamicStyles.modalTitle}>Add Money</Text>
                  <TouchableOpacity onPress={() => setShowAddModal(false)}><X size={22} color={colors.textPrimary} /></TouchableOpacity>
                </View>
                {error && <View style={dynamicStyles.errorBox}><AlertCircle size={14} color={colors.error} /><Text style={dynamicStyles.errorText}>{error}</Text></View>}
                <View style={dynamicStyles.amtInput}>
                  <Text style={dynamicStyles.amtRupee}>₹</Text>
                  <TextInput style={dynamicStyles.amtField} value={amount} onChangeText={setAmount} keyboardType="numeric" autoFocus placeholder="0" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={dynamicStyles.quickBtns}>
                    {[500, 1000, 5000, 10000].map(a => (
                        <TouchableOpacity key={a} style={[dynamicStyles.quickBtn, amount === a.toString() && dynamicStyles.quickBtnActive]} onPress={() => setAmount(a.toString())}>
                            <Text style={[dynamicStyles.quickBtnText, amount === a.toString() && { color: colors.emerald }]}>₹{a >= 1000 ? `${a/1000}K` : a}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity style={dynamicStyles.confirmBtn} onPress={handleAddMoney} disabled={actionLoading}>
                  <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.confirmBtnGrad}>
                    {actionLoading ? <ActivityIndicator color="#000" /> : <Text style={dynamicStyles.confirmBtnText}>Pay Now</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawModal} transparent animationType="slide">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modal}>
            {success ? (
              <View style={dynamicStyles.successState}>
                <View style={dynamicStyles.successCircle}><Check size={32} color="#fff" /></View>
                <Text style={dynamicStyles.successTitle}>Withdrawal Initiated!</Text>
                <Text style={dynamicStyles.successSub}>₹{parseFloat(amount || '0').toLocaleString('en-IN')} will reach your bank in 1-2 days.</Text>
              </View>
            ) : (
              <>
                <View style={dynamicStyles.modalHeader}>
                  <Text style={dynamicStyles.modalTitle}>Withdraw Money</Text>
                  <TouchableOpacity onPress={() => setShowWithdrawModal(false)}><X size={22} color={colors.textPrimary} /></TouchableOpacity>
                </View>
                {error && <View style={dynamicStyles.errorBox}><AlertCircle size={14} color={colors.error} /><Text style={dynamicStyles.errorText}>{error}</Text></View>}
                <View style={dynamicStyles.amtInput}>
                  <Text style={dynamicStyles.amtRupee}>₹</Text>
                  <TextInput style={dynamicStyles.amtField} value={amount} onChangeText={setAmount} keyboardType="numeric" autoFocus placeholder="0" placeholderTextColor={colors.textMuted} />
                </View>
                <Text style={dynamicStyles.availableLabel}>Available for withdrawal: ₹{balance.toLocaleString('en-IN')}</Text>
                <TouchableOpacity style={dynamicStyles.confirmBtn} onPress={handleWithdraw} disabled={actionLoading}>
                  <LinearGradient colors={isDark ? ['#FFFFFF', '#E2E8F0'] : colors.gradientGreen} style={dynamicStyles.confirmBtnGrad}>
                    {actionLoading ? <ActivityIndicator color="#000" /> : <Text style={[dynamicStyles.confirmBtnText, { color: isDark ? '#000' : '#fff' }]}>Withdraw to Bank</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20,
    },
    headerInfo: { flex: 1 },
    greetingText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', marginBottom: 4 },
    headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    iconButton: {
      width: 44, height: 44, borderRadius: 14, backgroundColor: colors.bgCard,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
    },
    profileAvatar: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.emerald, padding: 2, marginLeft: 16 },
    avatarImage: { width: '100%', height: '100%', borderRadius: 12 },
    scrollContent: { paddingHorizontal: 24 },
    balanceCard: { padding: 24, borderRadius: 28, borderWidth: 1, borderColor: colors.border, marginTop: 10 },
    balanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
    walletIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.emerald + '1a', alignItems: 'center', justifyContent: 'center' },
    balanceLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    balanceValue: { color: colors.textPrimary, fontSize: 32, fontWeight: '900', marginTop: 4 },
    actionRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1.5, borderRadius: 16, overflow: 'hidden' },
    actionBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
    actionBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
    withdrawBtn: { flex: 1, backgroundColor: colors.bgCard2, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border },
    withdrawBtnText: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16 },
    sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
    seeAllText: { color: colors.emerald, fontSize: 13, fontWeight: '700' },
    txList: { gap: 12 },
    txCard: { backgroundColor: colors.bgCard, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: colors.border },
    txIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    txDesc: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    txDate: { color: colors.textSecondary, fontSize: 12 },
    txAmount: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
    txStatus: { fontSize: 11, fontWeight: '700' },
    emptyState: { paddingVertical: 40, alignItems: 'center' },
    emptyText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modal: { backgroundColor: colors.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12, marginBottom: 20 },
    errorText: { color: colors.error, fontSize: 13, fontWeight: '600' },
    amtInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    amtRupee: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', marginRight: 8 },
    amtField: { flex: 1, color: colors.textPrimary, fontSize: 32, fontWeight: '900' },
    quickBtns: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    quickBtn: { flex: 1, backgroundColor: colors.bgCard2, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    quickBtnActive: { borderColor: colors.emerald, backgroundColor: colors.emeraldGlow },
    quickBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    confirmBtn: { borderRadius: 16, overflow: 'hidden' },
    confirmBtnGrad: { paddingVertical: 16, alignItems: 'center' },
    confirmBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
    availableLabel: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginBottom: 20, marginTop: -8 },
    successState: { alignItems: 'center', paddingVertical: 32 },
    successCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    successTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', marginBottom: 8 },
    successSub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  });
}
