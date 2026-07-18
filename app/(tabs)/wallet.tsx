import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, Modal, ActivityIndicator, RefreshControl,
  Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus, ArrowDownToLine, Smartphone, Check, X,
  ArrowUpRight, ArrowDownLeft, CreditCard, Building, Repeat, AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { getSupabaseRuntimeConfig, supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import type { WalletTransaction } from '@/types/database';
import { router, useFocusEffect } from 'expo-router';

let RazorpayCheckout: any = null;
if (Platform.OS !== 'web') {
  RazorpayCheckout = require('react-native-razorpay').default;
}

const quickAmounts = [500, 1000, 5000, 10000, 25000, 50000];

// Razorpay payment methods - all supported
const paymentMethods = [
  { id: 'upi', label: 'UPI', icon: <Smartphone size={18} color='#16C784' />, desc: 'Google Pay, PhonePe, Paytm' },
  { id: 'card', label: 'Cards', icon: <CreditCard size={18} color='#60A5FA' />, desc: 'Debit / Credit Card' },
  { id: 'netbanking', label: 'Net Banking', icon: <Building size={18} color='#FBBF24' />, desc: 'All major banks' },
  { id: 'wallet', label: 'Wallets', icon: <ArrowDownToLine size={18} color='#A78BFA' />, desc: 'Paytm, Amazon Pay' },
];

// Razorpay checkout options type
interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayError {
  code: string;
  description: string;
  metadata: {
    order_id: string;
    payment_id?: string;
  };
}

declare global {
  interface Window {
    Razorpay: new (options: {
      key: string;
      amount: number;
      currency: string;
      order_id: string;
      name: string;
      description: string;
      image?: string;
      prefill?: {
        name?: string;
        email?: string;
        contact?: string;
      };
      notes?: Record<string, string>;
      theme?: {
        color?: string;
        backdrop_color?: string;
      };
      handler: (response: RazorpayResponse) => void;
      modal?: {
        ondismiss?: () => void;
        escape?: boolean;
      };
    }) => {
      open: () => void;
      close: () => void;
    };
  }
}

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
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  const isMounted = useRef(true);

  // Fetch transactions with timeout
  const fetchTransactions = async () => {
    try {
      const result = await withTimeout(
        Promise.resolve(supabase
          .from('wallet_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)),
        10000
      ) as any;

      if (!isMounted.current) return;

      const { data, error: err } = result;
      if (!err && data) setTransactions(data as WalletTransaction[]);
    } catch (err) {
      if (isMounted.current) {
        console.error('Error fetching transactions:', err);
      }
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTransactions(),
        refreshProfile(),
      ]);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [refreshProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  }, [loadAll]);

  useEffect(() => {
    isMounted.current = true;
    loadAll();

    return () => {
      isMounted.current = false;
    };
  }, [loadAll]);

  // Load Razorpay checkout script for web
  useEffect(() => {
    if (Platform.OS === 'web' && !razorpayLoaded) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setRazorpayLoaded(true);
      script.onerror = () => console.error('Failed to load Razorpay script');
      document.body.appendChild(script);
    }
  }, []);

  // Call Edge Function for Razorpay operations
  const callRazorpayFunction = async (action: string, data: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { url: supabaseUrl } = getSupabaseRuntimeConfig();

    const response = await fetch(
      `${supabaseUrl}/functions/v1/razorpay-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, ...data }),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Payment request failed');
    }
    return result;
  };

  const handleAddMoney = async () => {
    const trimmed = amount.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
      setError('Please enter a valid amount using numbers only.');
      return;
    }

    const val = Number(trimmed);
    if (!Number.isFinite(val) || val < 100) {
      setError('Minimum add amount is ₹100.');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const orderResult = await callRazorpayFunction('create_order', { amount: val, paymentMethod: selectedMethod });
      if (!orderResult.success) {
        throw new Error(orderResult.error || 'Failed to create payment order');
      }

      const order: RazorpayOrder = orderResult.order;
      const keyId = orderResult.key_id;
      await openRazorpayCheckout(order, keyId, val);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const completeAddMoneySuccess = async (newBalance: number) => {
    setWalletBalance(newBalance);
    await refreshProfile();
    await fetchTransactions();
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setShowAddModal(false);
      setAmount('');
      setError(null);
    }, 1800);
  };

  const recordPaymentFailure = async (orderId: string, code?: string, description?: string) => {
    try {
      await callRazorpayFunction('record_failure', {
        orderId,
        errorCode: code,
        errorDesc: description,
        paymentMethod: selectedMethod,
      });
    } catch {
      // Ignore failure logging errors and show the main payment error to the user.
    }
  };

  const openRazorpayCheckout = async (order: RazorpayOrder, keyId: string, amountVal: number) => {
    if (Platform.OS === 'web') {
      if (!razorpayLoaded || typeof window === 'undefined' || !(window as any).Razorpay) {
        throw new Error('Razorpay checkout is not available on this browser yet.');
      }

      return new Promise<void>((resolve, reject) => {
        const options = {
          key: keyId,
          amount: order.amount * 100,
          currency: order.currency,
          order_id: order.id,
          name: 'InvestLand',
          description: 'Add money to wallet',
          image: 'https://sodzuknsemsqaiakevjp.supabase.co/favicon.ico',
          prefill: {
            name: profile?.name || '',
            email: profile?.email || '',
            contact: profile?.phone || '',
          },
          notes: {
            purpose: 'wallet_topup',
            user_id: profile?.id || '',
            payment_method: selectedMethod,
          },
          theme: {
            color: '#16C784',
            backdrop_color: isDark ? '#090909' : '#F8FAFC',
          },
          handler: async (response: RazorpayResponse) => {
            try {
              const verifyResult = await callRazorpayFunction('verify_payment', {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                paymentMethod: selectedMethod,
              });

              if (verifyResult.success) {
                await completeAddMoneySuccess(verifyResult.new_balance);
                resolve();
              } else {
                throw new Error(verifyResult.error || 'Payment verification failed');
              }
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: async () => {
              await recordPaymentFailure(order.id, 'cancelled', 'User cancelled the payment');
              resolve();
            },
            escape: true,
          },
        };

        const razorpayInstance = new (window as any).Razorpay(options);
        razorpayInstance.open();
      });
    }

    if (!RazorpayCheckout) {
      throw new Error('Razorpay payment is unavailable on this platform.');
    }

    return new Promise<void>((resolve, reject) => {
      const options = {
        key: keyId,
        amount: Math.round(amountVal * 100),
        currency: 'INR',
        order_id: order.id,
        name: 'InvestLand',
        description: 'Add money to wallet',
        prefill: {
          name: profile?.name || '',
          email: profile?.email || '',
          contact: profile?.phone || '',
        },
        notes: {
          purpose: 'wallet_topup',
          user_id: profile?.id || '',
          payment_method: selectedMethod,
        },
        theme: { color: '#16C784' },
      };

      RazorpayCheckout.open(options)
        .then(async (response: RazorpayResponse) => {
          try {
            const verifyResult = await callRazorpayFunction('verify_payment', {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              paymentMethod: selectedMethod,
            });

            if (verifyResult.success) {
              await completeAddMoneySuccess(verifyResult.new_balance);
              resolve();
            } else {
              throw new Error(verifyResult.error || 'Payment verification failed');
            }
          } catch (err) {
            reject(err);
          }
        })
        .catch(async (error: any) => {
          const description = error?.description || error?.message || 'Payment could not be completed';
          await recordPaymentFailure(order.id, error?.code || 'payment_failed', description);
          reject(new Error(description));
        });
    });
  };

  const handleWithdraw = async () => {
    const val = parseFloat(amount);
    if (!val || val < 100) {
      setError('Minimum withdrawal is Rs 100');
      return;
    }
    if (val > (profile?.wallet_balance ?? 0)) {
      setError('Insufficient balance');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('withdraw_wallet_money', {
        p_amount: val,
      });
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      const result = data as { success: boolean; new_balance: number };
      setWalletBalance(result.new_balance);
      await fetchTransactions();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setShowWithdrawModal(false);
        setAmount('');
      }, 1800);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (type: 'add' | 'withdraw') => {
    setAmount('');
    setError(null);
    setSuccess(false);
    if (type === 'add') setShowAddModal(true);
    else setShowWithdrawModal(true);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const balance = profile?.wallet_balance ?? 0;

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicStyles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
      >
        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#0D1A13', colors.bg] : ['#FFFFFF', colors.bg]}
          style={dynamicStyles.header}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <Text style={dynamicStyles.headerTitle}>Wallet</Text>

          <LinearGradient
            colors={[colors.emerald, colors.forest]}
            style={dynamicStyles.balanceCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={dynamicStyles.balanceCardInner}>
              <Text style={dynamicStyles.balanceLabel}>Available Balance</Text>
              {loading
                ? <ActivityIndicator color="#fff" style={{ marginVertical: 8 }} />
                : <Text style={dynamicStyles.balanceValue}>{`\u20B9${balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}</Text>
              }
              <Text style={dynamicStyles.balanceSub}>{`InvestLand Wallet • ${profile?.kyc_status ?? 'KYC Verified'}`}</Text>
              <View style={dynamicStyles.walletActions}>
                <TouchableOpacity style={dynamicStyles.walletActionBtn} onPress={() => openModal('add')}>
                  <Plus size={18} color="#fff" />
                  <Text style={dynamicStyles.walletActionText}>Add Money</Text>
                </TouchableOpacity>
                <View style={dynamicStyles.walletActionDivider} />
                <TouchableOpacity style={dynamicStyles.walletActionBtn} onPress={() => openModal('withdraw')}>
                  <ArrowDownToLine size={18} color="#fff" />
                  <Text style={dynamicStyles.walletActionText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </LinearGradient>

        {/* Transaction History */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Transaction History</Text>

          {loading && (
            <View style={dynamicStyles.centered}>
              <ActivityIndicator color={colors.emerald} />
            </View>
          )}

          {!loading && transactions.length === 0 && (
            <View style={dynamicStyles.emptyState}>
              <Text style={dynamicStyles.emptyTitle}>No transactions yet</Text>
              <Text style={dynamicStyles.emptySub}>Add money to get started</Text>
            </View>
          )}

          {transactions.map(tx => (
            <View key={tx.id} style={dynamicStyles.txCard}>
              <View style={[dynamicStyles.txIcon, { backgroundColor: tx.type === 'credit' ? colors.emeraldGlow : 'rgba(239,68,68,0.12)' }]}>
                {tx.type === 'credit'
                  ? <ArrowDownLeft size={16} color={colors.emerald} />
                  : <ArrowUpRight size={16} color={colors.error} />
                }
              </View>
              <View style={dynamicStyles.txContent}>
                <Text style={dynamicStyles.txDesc}>{tx.description}</Text>
                <View style={dynamicStyles.txMeta}>
                  <Text style={dynamicStyles.txDate}>{formatDate(tx.created_at)}</Text>
                  <View style={[dynamicStyles.txStatus, { backgroundColor: tx.status === 'Completed' ? colors.emeraldGlow : tx.status === 'Failed' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)' }]}>
                    <Text style={[dynamicStyles.txStatusText, { color: tx.status === 'Completed' ? colors.success : tx.status === 'Failed' ? colors.error : colors.warning }]}>
                      {tx.status}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[dynamicStyles.txAmount, { color: tx.type === 'credit' ? colors.emerald : colors.error }]}>
                {tx.type === 'credit' ? '+' : '-'}{`\u20B9${tx.amount.toLocaleString('en-IN')}`}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Add Money Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modal}>
            {success ? (
              <SuccessState title={`${`\u20B9${parseFloat(amount || '0').toLocaleString('en-IN')}`} Added!`} sub="Your wallet has been credited." colors={colors} />
            ) : (
              <>
                <View style={dynamicStyles.modalHeader}>
                  <Text style={dynamicStyles.modalTitle}>Add Money</Text>
                  <TouchableOpacity onPress={() => { setShowAddModal(false); setError(null); }}>
                    <X size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {error && <ErrorBanner message={error} colors={colors} />}

                <AmountInput amount={amount} onChangeAmount={a => { setAmount(a); setError(null); }} colors={colors} />

                {/* Payment Methods Info */}
                <View style={dynamicStyles.paymentMethodsInfo}>
                  <Text style={dynamicStyles.paymentMethodsTitle}>Supported Payment Methods</Text>
                  <View style={dynamicStyles.paymentMethodsList}>
                    {paymentMethods.map(pm => {
                      const active = selectedMethod === pm.id;
                      return (
                        <TouchableOpacity
                          key={pm.id}
                          style={[dynamicStyles.paymentMethodTag, active && dynamicStyles.paymentMethodTagActive]}
                          onPress={() => setSelectedMethod(pm.id)}
                        >
                          {pm.icon}
                          <Text style={[dynamicStyles.paymentMethodLabel, active && dynamicStyles.paymentMethodLabelActive]}>{pm.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={dynamicStyles.secureNote}>
                    Razorpay will open the selected flow for UPI, Cards, Net Banking, or Wallets.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[dynamicStyles.confirmBtn, actionLoading && { opacity: 0.65 }]}
                  onPress={handleAddMoney}
                  disabled={actionLoading}
                >
                  <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.confirmBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {actionLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={dynamicStyles.confirmBtnText}>{`Add ${`\u20B9${amount || '0'}`}`}</Text>
                    )}
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
              <SuccessState
                title="Withdrawal Initiated!"
                sub={`${`\u20B9${parseFloat(amount || '0').toLocaleString('en-IN')}`} will be credited to your bank in 1-2 business days.`}
                colors={colors}
              />
            ) : (
              <>
                <View style={dynamicStyles.modalHeader}>
                  <Text style={dynamicStyles.modalTitle}>Withdraw Money</Text>
                  <TouchableOpacity onPress={() => { setShowWithdrawModal(false); setError(null); }}>
                    <X size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {error && <ErrorBanner message={error} colors={colors} />}

                <AmountInput amount={amount} onChangeAmount={a => { setAmount(a); setError(null); }} colors={colors} />
                <Text style={dynamicStyles.availableText}>{`Available: ${`\u20B9${balance.toLocaleString('en-IN')}`}`}</Text>

                <TouchableOpacity
                  style={[dynamicStyles.confirmBtn, actionLoading && { opacity: 0.65 }]}
                  onPress={handleWithdraw}
                  disabled={actionLoading}
                >
                  <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.confirmBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {actionLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dynamicStyles.confirmBtnText}>Withdraw to Bank</Text>}
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

function AmountInput({ amount, onChangeAmount, colors }: { amount: string; onChangeAmount: (v: string) => void; colors: any }) {
  const dynamicStyles = getDynamicStyles(colors, false);
  return (
    <>
      <View style={dynamicStyles.inputWrapper}>
        <Text style={dynamicStyles.currencySymbol}>{'\u20B9'}</Text>
        <TextInput
          style={dynamicStyles.amountInput}
          placeholder="Enter amount"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          value={amount}
          onChangeText={onChangeAmount}
          autoFocus
        />
      </View>
      <View style={dynamicStyles.quickAmounts}>
        {quickAmounts.map(qa => (
          <TouchableOpacity key={qa} style={[dynamicStyles.quickAmtBtn, amount === qa.toString() && dynamicStyles.quickAmtBtnActive]} onPress={() => onChangeAmount(qa.toString())}>
            <Text style={[dynamicStyles.quickAmtText, amount === qa.toString() && { color: colors.emerald }]}>
              {qa >= 1000 ? `${`\u20B9${qa / 1000}`}K` : `${`\u20B9${qa}`}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function SuccessState({ title, sub, colors }: { title: string; sub: string; colors: any }) {
  const dynamicStyles = getDynamicStyles(colors, false);
  return (
    <View style={dynamicStyles.successState}>
      <View style={dynamicStyles.successCircle}>
        <Check size={32} color="#fff" />
      </View>
      <Text style={dynamicStyles.successText}>{title}</Text>
      <Text style={dynamicStyles.successSub}>{sub}</Text>
    </View>
  );
}

function ErrorBanner({ message, colors }: { message: string; colors: any }) {
  const dynamicStyles = getDynamicStyles(colors, false);
  return (
    <View style={dynamicStyles.errorBox}>
      <AlertCircle size={14} color={colors.error} />
      <Text style={dynamicStyles.errorText}>{message}</Text>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 20 },
    header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24 },
    headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginBottom: 18 },
    balanceCard: { borderRadius: 22, overflow: 'hidden' },
    balanceCardInner: { padding: 22 },
    balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    balanceValue: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
    balanceSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500', marginBottom: 20 },
    walletActions: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 14, overflow: 'hidden' },
    walletActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
    walletActionDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
    walletActionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    section: { paddingHorizontal: 20, marginTop: 20 },
    sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 14 },
    centered: { paddingVertical: 30, alignItems: 'center' },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    emptySub: { color: colors.textMuted, fontSize: 13 },
    txCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: colors.border,
    },
    txIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    txContent: { flex: 1 },
    txDesc: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
    txMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    txDate: { color: colors.textMuted, fontSize: 11 },
    txStatus: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
    txStatusText: { fontSize: 10, fontWeight: '600' },
    txAmount: { fontSize: 14, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modal: {
      backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    errorBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 10,
      borderWidth: 1, borderColor: colors.error + '33', marginBottom: 14,
    },
    errorText: { color: colors.error, fontSize: 13, flex: 1 },
    inputWrapper: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgInput,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, gap: 8,
    },
    currencySymbol: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
    amountInput: { flex: 1, color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
    quickAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    quickAmtBtn: {
      borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.bg, paddingHorizontal: 14, paddingVertical: 8,
    },
    quickAmtBtnActive: { borderColor: colors.emerald, backgroundColor: colors.emeraldGlow },
    quickAmtText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    paymentMethodsInfo: {
      backgroundColor: colors.bgCard2, borderRadius: 14, padding: 16, marginBottom: 20,
      borderWidth: 1, borderColor: colors.border,
    },
    paymentMethodsTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
    paymentMethodsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    paymentMethodTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgCard, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    paymentMethodTagActive: { borderWidth: 1, borderColor: colors.emerald, backgroundColor: colors.emeraldGlow },
    paymentMethodLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: '500' },
    paymentMethodLabelActive: { color: colors.emerald },
    secureNote: { color: colors.textMuted, fontSize: 11, marginTop: 12, textAlign: 'center' },
    confirmBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
    confirmBtnGrad: { paddingVertical: 16, alignItems: 'center' },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    availableText: { color: colors.textMuted, fontSize: 12, marginBottom: 20, marginTop: -8 },
    successState: { alignItems: 'center', paddingVertical: 28 },
    successCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.emerald, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    successText: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 6 },
    successSub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  });
}
