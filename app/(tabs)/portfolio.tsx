import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, Dimensions, ActivityIndicator, RefreshControl,
  Share, Platform, Alert, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { TrendingUp, Download, PieChart, Calendar, ChevronRight, ArrowUpRight, X, LogOut, AlertCircle, Check, Lock } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { withTimeout } from '@/lib/api-utils';
import type { Investment } from '@/types/database';
import { computeCurrentValue, computePortfolioStats } from '@/types/database';

const { width } = Dimensions.get('window');

const tabs = ['Active', 'History', 'Analytics'];

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PortfolioScreen() {
  const { colors, isDark } = useTheme();
  const { refreshProfile, setWalletBalance } = useApp();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Active');

  // Exit investment state
  const [exitTarget, setExitTarget] = useState<Investment | null>(null);
  const [exiting, setExiting] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);
  const [exitSuccess, setExitSuccess] = useState<{ amount: number; projectName: string } | null>(null);

  const isMounted = useRef(true);

  // Fetch investments with timeout
  const fetchInvestments = async () => {
    try {
      const result = await withTimeout(
        Promise.resolve(supabase
          .from('investments')
          .select('*, land_projects(id, name, location, image, expected_roi, category)')
          .order('created_at', { ascending: false })),
        10000
      ) as any;

      if (!isMounted.current) return;

      const { data, error } = result;
      if (!error && data) {
        setInvestments(data as Investment[]);
      }
    } catch (err) {
      if (isMounted.current) {
        console.error('Error fetching investments:', err);
      }
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchInvestments(),
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

  const stats = computePortfolioStats(investments);
  const activeInvestments = investments.filter(inv => inv.status === 'Active');
  const exitedInvestments = investments.filter(inv => inv.status !== 'Active');

  const isLocked = (inv: Investment) => {
    const lockEnd = new Date(inv.created_at).getTime() + (inv.lock_in_period ?? 1) * 24 * 60 * 60 * 1000;
    return Date.now() < lockEnd;
  };

  const lockEndDate = (inv: Investment) => {
    return new Date(new Date(inv.created_at).getTime() + (inv.lock_in_period ?? 1) * 24 * 60 * 60 * 1000);
  };

  const handleExitInvestment = async () => {
    if (!exitTarget) return;
    setExiting(true);
    setExitError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('exit_investment', {
        p_investment_id: exitTarget.id,
      });
      if (rpcError) {
        setExitError(rpcError.message);
        return;
      }
      const result = data as { success: boolean; exit_amount: number; new_balance: number; project_name: string } | null;
      if (result && typeof result.new_balance === 'number') {
        setWalletBalance(result.new_balance);
      } else {
        await refreshProfile();
      }
      if (result) {
        setExitSuccess({ amount: result.exit_amount, projectName: result.project_name });
      }
      await fetchInvestments();
    } catch (err: any) {
      setExitError(err?.message ?? 'Failed to exit investment');
    } finally {
      setExiting(false);
    }
  };

  const closeExitModal = () => {
    if (exiting) return;
    setExitTarget(null);
    setExitError(null);
    setExitSuccess(null);
  };

  const formatINR = (v: number) =>
    v >= 100000 ? `₹${(v / 100000).toFixed(2)}L` :
    v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` :
    `₹${Math.round(v)}`;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const handleDownloadStatement = async () => {
    const lines = [
      'InvestLand Portfolio Statement',
      `Generated: ${new Date().toLocaleDateString('en-IN')}`,
      '',
      '--- Summary ---',
      `Portfolio Value: ${formatINR(stats.portfolioValue)}`,
      `Total Invested: ${formatINR(stats.totalInvested)}`,
      `Total Returns: ${formatINR(stats.totalReturns)}`,
      `ROI: ${stats.returnsPercent.toFixed(2)}%`,
      '',
      '--- Active Investments ---',
      ...investments.map((inv, i) => {
        const cv = computeCurrentValue(inv.amount, inv.roi_rate, inv.created_at);
        return `${i + 1}. ${inv.land_projects?.name ?? 'Project'} - Invested: Rs. ${inv.amount.toLocaleString('en-IN')}, Current: Rs. ${Math.round(cv).toLocaleString('en-IN')}, ROI: ${inv.roi_rate}%`;
      }),
      '',
      'This is a computer-generated statement for informational purposes only.',
    ];
    const statementText = lines.join('\n');
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([statementText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `InvestLand_Statement_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: statementText, title: 'InvestLand Portfolio Statement' });
      }
    } catch {
      Alert.alert('Error', 'Failed to generate statement.');
    }
  };

  // Simple bar chart data — last 12 months of cumulative investment growth
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date();
    monthStart.setMonth(monthStart.getMonth() - (11 - i));
    monthStart.setDate(1);
    const cumInvested = investments
      .filter(inv => new Date(inv.created_at) <= monthStart)
      .reduce((s, inv) => s + inv.amount, 0);
    return Math.max(cumInvested, 0);
  });
  const maxChart = Math.max(...chartData, 1);

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  investments.forEach(inv => {
    const cat = inv.land_projects?.category ?? 'Other';
    categoryMap[cat] = (categoryMap[cat] ?? 0) + inv.amount;
  });
  const totalInvested = stats.totalInvested || 1;
  const categories = Object.entries(categoryMap).map(([label, amt]) => ({
    label,
    value: Math.round((amt / totalInvested) * 100),
    color: label === 'Residential' ? colors.emerald :
           label === 'Commercial' ? '#60A5FA' :
           label === 'Farm Land' ? '#34D399' :
           label === 'Industrial' ? '#FBBF24' : '#A78BFA',
  }));

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
            <Text style={dynamicStyles.headerTitle}>My Portfolio</Text>
            <TouchableOpacity style={dynamicStyles.downloadBtn} onPress={handleDownloadStatement}>
              <Download size={16} color={colors.textPrimary} />
              <Text style={dynamicStyles.downloadText}>Statement</Text>
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.valueCard}>
            <View style={dynamicStyles.valueCardBorder}>
              <Text style={dynamicStyles.valueLabel}>Portfolio Value</Text>
              {loading
                ? <ActivityIndicator color={colors.emerald} style={{ marginVertical: 12 }} />
                : <Text style={dynamicStyles.valueAmount}>{formatINR(stats.portfolioValue)}</Text>
              }
              <View style={dynamicStyles.valueRow}>
                <View style={dynamicStyles.valueStat}>
                  <Text style={dynamicStyles.valueStatLabel}>Invested</Text>
                  <Text style={dynamicStyles.valueStatAmt}>{formatINR(stats.totalInvested)}</Text>
                </View>
                <View style={dynamicStyles.valueStatDivider} />
                <View style={dynamicStyles.valueStat}>
                  <Text style={dynamicStyles.valueStatLabel}>Returns</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <TrendingUp size={13} color={colors.emerald} />
                    <Text style={[dynamicStyles.valueStatAmt, { color: colors.emerald }]}>+{formatINR(stats.totalReturns)}</Text>
                  </View>
                </View>
                <View style={dynamicStyles.valueStatDivider} />
                <View style={dynamicStyles.valueStat}>
                  <Text style={dynamicStyles.valueStatLabel}>ROI</Text>
                  <Text style={[dynamicStyles.valueStatAmt, { color: colors.emerald }]}>+{stats.returnsPercent.toFixed(2)}%</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Tabs */}
        <View style={dynamicStyles.tabsRow}>
          {tabs.map(tab => (
            <TouchableOpacity key={tab} style={[dynamicStyles.tab, activeTab === tab && dynamicStyles.tabActive]} onPress={() => setActiveTab(tab)}>
              {activeTab === tab
                ? <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.tabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}><Text style={dynamicStyles.tabTextActive}>{tab}</Text></LinearGradient>
                : <Text style={dynamicStyles.tabText}>{tab}</Text>
              }
            </TouchableOpacity>
          ))}
        </View>

        {/* Active investments */}
        {activeTab === 'Active' && (
          <View style={dynamicStyles.section}>
            {loading && <ActivityIndicator color={colors.emerald} style={{ marginVertical: 24 }} />}

            {!loading && activeInvestments.length === 0 && (
              <View style={dynamicStyles.emptyState}>
                <Text style={dynamicStyles.emptyTitle}>No Investments Yet</Text>
                <Text style={dynamicStyles.emptySub}>Start investing from ₹500 in premium land projects</Text>
                <TouchableOpacity style={dynamicStyles.exploreBtn} onPress={() => router.push('/(tabs)/explore')}>
                  <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.exploreBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={dynamicStyles.exploreBtnText}>Explore Projects</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {activeInvestments.map(inv => {
              const currentVal = computeCurrentValue(inv.amount, inv.roi_rate, inv.created_at);
              const returns = currentVal - inv.amount;
              const returnsPct = (returns / inv.amount) * 100;
              const locked = isLocked(inv);
              return (
                <TouchableOpacity
                  key={inv.id}
                  style={dynamicStyles.investCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/property/${inv.project_id}` as any)}
                >
                  {inv.land_projects?.image && (
                    <Image source={{ uri: inv.land_projects.image }} style={dynamicStyles.investImage} />
                  )}
                  <View style={dynamicStyles.investContent}>
                    <Text style={dynamicStyles.investName} numberOfLines={1}>{inv.land_projects?.name ?? 'Project'}</Text>
                    <Text style={dynamicStyles.investLocation}>{inv.land_projects?.location ?? ''}</Text>
                    <View style={dynamicStyles.investAmounts}>
                      <View>
                        <Text style={dynamicStyles.amtLabel}>Invested</Text>
                        <Text style={dynamicStyles.amtValue}>₹{inv.amount.toLocaleString('en-IN')}</Text>
                      </View>
                      <View>
                        <Text style={dynamicStyles.amtLabel}>Current</Text>
                        <Text style={dynamicStyles.amtValue}>₹{Math.round(currentVal).toLocaleString('en-IN')}</Text>
                      </View>
                      <View>
                        <Text style={dynamicStyles.amtLabel}>Returns</Text>
                        <Text style={[dynamicStyles.amtValue, { color: returns >= 0 ? colors.emerald : colors.error }]}>
                          {returns >= 0 ? '+' : ''}{returnsPct.toFixed(2)}%
                        </Text>
                      </View>
                    </View>
                    <View style={dynamicStyles.investStatusRow}>
                      <View style={dynamicStyles.statusBadge}>
                        <View style={dynamicStyles.statusDot} />
                        <Text style={dynamicStyles.statusText}>{inv.status}</Text>
                      </View>
                      <Text style={dynamicStyles.investDate}>{formatDate(inv.created_at)}</Text>
                    </View>
                    {inv.status === 'Active' && (
                      <TouchableOpacity
                        style={[dynamicStyles.exitBtn, locked && dynamicStyles.exitBtnLocked]}
                        onPress={(e) => {
                          e.stopPropagation();
                          setExitTarget(inv);
                          setExitError(null);
                          setExitSuccess(null);
                        }}
                        activeOpacity={0.7}
                      >
                        {locked ? <Lock size={11} color={colors.textMuted} /> : <LogOut size={11} color={colors.error} />}
                        <Text style={[dynamicStyles.exitBtnText, locked && { color: colors.textMuted }]}>
                          {locked ? `Locked until ${lockEndDate(inv).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : 'Exit Investment'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Analytics */}
        {activeTab === 'Analytics' && (
          <View style={dynamicStyles.section}>
            {/* Bar chart */}
            <View style={dynamicStyles.analyticsCard}>
              <Text style={dynamicStyles.analyticsTitle}>Cumulative Investment (12 months)</Text>
              <View style={dynamicStyles.chartArea}>
                {chartData.map((val, i) => (
                  <View key={i} style={dynamicStyles.barWrapper}>
                    <View style={[dynamicStyles.bar, { height: val > 0 ? Math.max((val / maxChart) * 100, 4) : 4 }]}>
                      <LinearGradient colors={val > 0 ? colors.gradientGreen : [colors.border, colors.border]} style={dynamicStyles.barFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
                    </View>
                    <Text style={dynamicStyles.barLabel}>{months[i].slice(0, 1)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Asset allocation */}
            {categories.length > 0 && (
              <View style={dynamicStyles.analyticsCard}>
                <Text style={dynamicStyles.analyticsTitle}>Asset Allocation</Text>
                <View style={dynamicStyles.allocationRow}>
                  <View style={dynamicStyles.donutOuter}>
                    <View style={dynamicStyles.donutInner}>
                      <PieChart size={28} color={colors.emerald} />
                    </View>
                  </View>
                  <View style={dynamicStyles.allocationList}>
                    {categories.map(a => (
                      <View key={a.label} style={dynamicStyles.allocationItem}>
                        <View style={[dynamicStyles.allocationDot, { backgroundColor: a.color }]} />
                        <Text style={dynamicStyles.allocationLabel}>{a.label}</Text>
                        <Text style={[dynamicStyles.allocationValue, { color: a.color }]}>{a.value}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Summary stats */}
            <View style={dynamicStyles.statsGrid}>
              {[
                { label: 'Total Invested', value: formatINR(stats.totalInvested) },
                { label: 'Total Returns', value: `+${formatINR(stats.totalReturns)}` },
                { label: 'Active Projects', value: `${activeInvestments.length}` },
                { label: 'Avg ROI', value: `${stats.returnsPercent.toFixed(2)}%` },
              ].map(s => (
                <View key={s.label} style={dynamicStyles.statBox}>
                  <Text style={dynamicStyles.statBoxLabel}>{s.label}</Text>
                  <Text style={dynamicStyles.statBoxValue}>{s.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* History */}
        {activeTab === 'History' && (
          <View style={dynamicStyles.section}>
            {exitedInvestments.length === 0 && !loading && (
              <View style={dynamicStyles.emptyState}>
                <Text style={dynamicStyles.emptyTitle}>No History Yet</Text>
                <Text style={dynamicStyles.emptySub}>Your closed investments will appear here</Text>
              </View>
            )}
            {exitedInvestments.map(inv => {
              const currentVal = computeCurrentValue(inv.amount, inv.roi_rate, inv.created_at);
              const exitChargePct = inv.exit_charge_pct ?? 1.0;
              const exitCharge = Math.round(currentVal * (exitChargePct / 100) * 100) / 100;
              const exitAmount = Math.round((currentVal - exitCharge) * 100) / 100;
              return (
                <View key={inv.id} style={dynamicStyles.historyCard}>
                  <View style={[dynamicStyles.historyIcon, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
                    <ArrowUpRight size={16} color="#60A5FA" />
                  </View>
                  <View style={dynamicStyles.historyContent}>
                    <Text style={dynamicStyles.historyName}>{inv.land_projects?.name ?? 'Project'}</Text>
                    <View style={dynamicStyles.historyRow}>
                      <Calendar size={11} color={colors.textMuted} />
                      <Text style={dynamicStyles.historyDate}>{formatDate(inv.created_at)}</Text>
                    </View>
                  </View>
                  <View style={dynamicStyles.historyAmounts}>
                    <Text style={[dynamicStyles.historyAmt, { color: colors.emerald }]}>+₹{exitAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                    <View style={[dynamicStyles.statusBadge, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
                      <View style={[dynamicStyles.statusDot, { backgroundColor: '#60A5FA' }]} />
                      <Text style={[dynamicStyles.statusText, { color: '#60A5FA' }]}>{inv.status}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Exit Investment Modal */}
      <Modal visible={!!exitTarget} transparent animationType="slide" onRequestClose={closeExitModal}>
        <View style={dynamicStyles.exitOverlay}>
          <View style={dynamicStyles.exitModal}>
            {exitSuccess ? (
              <View style={dynamicStyles.exitSuccessState}>
                <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.exitSuccessCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Check size={32} color="#fff" />
                </LinearGradient>
                <Text style={dynamicStyles.exitSuccessTitle}>Investment Exited!</Text>
                <Text style={dynamicStyles.exitSuccessSub}>
                  ₹{exitSuccess.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} credited to your wallet from {exitSuccess.projectName}.
                </Text>
                <TouchableOpacity style={dynamicStyles.exitDoneBtn} onPress={closeExitModal}>
                  <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.exitDoneGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={dynamicStyles.exitDoneText}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : exitTarget ? (
              <>
                <View style={dynamicStyles.exitModalHeader}>
                  <Text style={dynamicStyles.exitModalTitle}>Exit Investment</Text>
                  <TouchableOpacity onPress={closeExitModal} disabled={exiting}>
                    <X size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {exitError && (
                  <View style={dynamicStyles.exitErrorBanner}>
                    <AlertCircle size={14} color={colors.error} />
                    <Text style={dynamicStyles.exitErrorText}>{exitError}</Text>
                  </View>
                )}

                <View style={dynamicStyles.exitProjectInfo}>
                  <Image
                    source={{ uri: exitTarget.land_projects?.image ?? '' }}
                    style={dynamicStyles.exitProjectImage}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={dynamicStyles.exitProjectName} numberOfLines={1}>{exitTarget.land_projects?.name ?? 'Project'}</Text>
                    <Text style={dynamicStyles.exitProjectLoc}>{exitTarget.land_projects?.location ?? ''}</Text>
                  </View>
                </View>

                {(() => {
                  const currentVal = computeCurrentValue(exitTarget.amount, exitTarget.roi_rate, exitTarget.created_at);
                  const returns = currentVal - exitTarget.amount;
                  const returnsPct = (returns / exitTarget.amount) * 100;
                  const exitChargePct = exitTarget.exit_charge_pct ?? 1.0;
                  const exitCharge = Math.round(currentVal * (exitChargePct / 100) * 100) / 100;
                  const exitAmount = Math.round((currentVal - exitCharge) * 100) / 100;
                  const locked = isLocked(exitTarget);

                  return (
                    <>
                      <View style={dynamicStyles.exitSummaryCard}>
                        <View style={dynamicStyles.exitSummaryRow}>
                          <Text style={dynamicStyles.exitSummaryLabel}>Original Investment</Text>
                          <Text style={dynamicStyles.exitSummaryVal}>₹{exitTarget.amount.toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={dynamicStyles.exitSummaryDivider} />
                        <View style={dynamicStyles.exitSummaryRow}>
                          <Text style={dynamicStyles.exitSummaryLabel}>Current Market Value</Text>
                          <Text style={dynamicStyles.exitSummaryVal}>₹{Math.round(currentVal).toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={dynamicStyles.exitSummaryDivider} />
                        <View style={dynamicStyles.exitSummaryRow}>
                          <Text style={dynamicStyles.exitSummaryLabel}>Profit / Loss</Text>
                          <Text style={[dynamicStyles.exitSummaryVal, { color: returns >= 0 ? colors.emerald : colors.error }]}>
                            {returns >= 0 ? '+' : ''}₹{Math.round(Math.abs(returns)).toLocaleString('en-IN')} ({returnsPct.toFixed(2)}%)
                          </Text>
                        </View>
                        <View style={dynamicStyles.exitSummaryDivider} />
                        <View style={dynamicStyles.exitSummaryRow}>
                          <Text style={dynamicStyles.exitSummaryLabel}>Exit Charge ({exitChargePct}%)</Text>
                          <Text style={[dynamicStyles.exitSummaryVal, { color: colors.warning }]}>-₹{exitCharge.toLocaleString('en-IN')}</Text>
                        </View>
                      </View>

                      {locked && (
                        <View style={dynamicStyles.exitLockBanner}>
                          <Lock size={14} color={colors.warning} />
                          <Text style={dynamicStyles.exitLockText}>
                            Lock-in active until {lockEndDate(exitTarget).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}. You cannot exit this investment yet.
                          </Text>
                        </View>
                      )}

                      <LinearGradient colors={colors.gradientCard} style={dynamicStyles.exitPayoutCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <View style={dynamicStyles.exitPayoutBorder}>
                          <Text style={dynamicStyles.exitPayoutLabel}>You Will Receive</Text>
                          <Text style={dynamicStyles.exitPayoutAmount}>₹{exitAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                          <Text style={dynamicStyles.exitPayoutSub}>Credited to your InvestLand Wallet</Text>
                        </View>
                      </LinearGradient>

                      <Text style={dynamicStyles.exitDisclaimer}>
                        By confirming, you agree to exit this investment. The exit amount will be credited to your wallet instantly. This action cannot be undone.
                      </Text>

                      <View style={dynamicStyles.exitActions}>
                        <TouchableOpacity style={dynamicStyles.exitCancelBtn} onPress={closeExitModal} disabled={exiting}>
                          <Text style={dynamicStyles.exitCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[dynamicStyles.exitConfirmBtn, (exiting || locked) && { opacity: 0.5 }]}
                          onPress={handleExitInvestment}
                          disabled={exiting || locked}
                        >
                          <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.exitConfirmGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            {exiting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dynamicStyles.exitConfirmText}>Confirm Exit</Text>}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </>
                  );
                })()}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 20 },
    header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    headerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    downloadBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.bgCard, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
      borderWidth: 1, borderColor: colors.border,
    },
    downloadText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
    valueCard: { borderRadius: 20, overflow: 'hidden', backgroundColor: colors.emeraldGlow2 },
    valueCardBorder: { borderRadius: 20, borderWidth: 1, borderColor: colors.emerald + '22', padding: 18 },
    valueLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    valueAmount: { color: colors.textPrimary, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginBottom: 16 },
    valueRow: { flexDirection: 'row', backgroundColor: colors.glass, borderRadius: 12, padding: 12 },
    valueStat: { flex: 1, alignItems: 'center', gap: 4 },
    valueStatDivider: { width: 1, height: 28, backgroundColor: colors.glassBorder },
    valueStatLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '500', textTransform: 'uppercase' },
    valueStatAmt: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
    tabsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, gap: 8 },
    tab: { flex: 1, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
    tabActive: { borderColor: colors.emerald + '55' },
    tabGrad: { paddingVertical: 10, alignItems: 'center' },
    tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '700', paddingVertical: 10, textAlign: 'center' },
    tabTextActive: { color: '#fff', fontSize: 13, fontWeight: '700' },
    section: { paddingHorizontal: 20 },
    emptyState: { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 6 },
    emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 20 },
    exploreBtn: { borderRadius: 12, overflow: 'hidden' },
    exploreBtnGrad: { paddingVertical: 12, paddingHorizontal: 28, alignItems: 'center' },
    exploreBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    investCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1,
      borderColor: colors.border, padding: 14, marginBottom: 12,
    },
    investImage: { width: 64, height: 64, borderRadius: 12 },
    investContent: { flex: 1 },
    investName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
    investLocation: { color: colors.textMuted, fontSize: 11, marginBottom: 8 },
    investAmounts: { flexDirection: 'row', gap: 14, marginBottom: 8 },
    amtLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '500', textTransform: 'uppercase', marginBottom: 2 },
    amtValue: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    investStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.emeraldGlow, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
    statusDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.emerald },
    statusText: { color: colors.emerald, fontSize: 10, fontWeight: '600' },
    investDate: { color: colors.textMuted, fontSize: 10 },
    analyticsCard: { backgroundColor: colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 },
    analyticsTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 16 },
    chartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 120 },
    barWrapper: { flex: 1, alignItems: 'center', gap: 4 },
    bar: { width: '100%', borderRadius: 4, overflow: 'hidden', maxHeight: 100 },
    barFill: { flex: 1 },
    barLabel: { color: colors.textMuted, fontSize: 9 },
    allocationRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    donutOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 10, borderColor: colors.emerald, alignItems: 'center', justifyContent: 'center' },
    donutInner: { alignItems: 'center', justifyContent: 'center' },
    allocationList: { flex: 1, gap: 12 },
    allocationItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    allocationDot: { width: 8, height: 8, borderRadius: 4 },
    allocationLabel: { color: colors.textSecondary, fontSize: 13, flex: 1 },
    allocationValue: { fontSize: 13, fontWeight: '700' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    statBox: {
      width: (width - 50) / 2, backgroundColor: colors.bgCard,
      borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border,
    },
    statBoxLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500', marginBottom: 6 },
    statBoxValue: { color: colors.emerald, fontSize: 18, fontWeight: '800' },
    historyCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: colors.border,
    },
    historyIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.emeraldGlow, alignItems: 'center', justifyContent: 'center' },
    historyContent: { flex: 1 },
    historyName: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    historyDate: { color: colors.textMuted, fontSize: 11 },
    historyAmounts: { alignItems: 'flex-end', gap: 4 },
    historyAmt: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
    exitBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      marginTop: 10, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8,
      backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
      alignSelf: 'flex-start',
    },
    exitBtnLocked: {
      backgroundColor: colors.bgCard2, borderColor: colors.border,
    },
    exitBtnText: { color: colors.error, fontSize: 11, fontWeight: '700' },
    exitOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    exitModal: {
      backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0,
    },
    exitModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    exitModalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    exitErrorBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 10,
      borderWidth: 1, borderColor: colors.error + '33', marginBottom: 14,
    },
    exitErrorText: { color: colors.error, fontSize: 13, flex: 1, lineHeight: 18 },
    exitProjectInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
    exitProjectImage: { width: 48, height: 48, borderRadius: 10 },
    exitProjectName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 },
    exitProjectLoc: { color: colors.textMuted, fontSize: 12 },
    exitSummaryCard: {
      backgroundColor: colors.bg, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 14, marginBottom: 14,
    },
    exitSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
    exitSummaryLabel: { color: colors.textMuted, fontSize: 13 },
    exitSummaryVal: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    exitSummaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    exitLockBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', marginBottom: 14,
    },
    exitLockText: { color: colors.warning, fontSize: 12, flex: 1, lineHeight: 17 },
    exitPayoutCard: { borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
    exitPayoutBorder: { borderRadius: 14, borderWidth: 1, borderColor: colors.emerald + '22', padding: 16, alignItems: 'center' },
    exitPayoutLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    exitPayoutAmount: { color: colors.emerald, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
    exitPayoutSub: { color: colors.textMuted, fontSize: 11 },
    exitDisclaimer: { color: colors.textMuted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginBottom: 16 },
    exitActions: { flexDirection: 'row', gap: 12 },
    exitCancelBtn: {
      flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
      backgroundColor: colors.bgCard2, borderWidth: 1, borderColor: colors.border,
    },
    exitCancelText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    exitConfirmBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
    exitConfirmGrad: { paddingVertical: 14, alignItems: 'center' },
    exitConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    exitSuccessState: { alignItems: 'center', paddingVertical: 20 },
    exitSuccessCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    exitSuccessTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 6 },
    exitSuccessSub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
    exitDoneBtn: { borderRadius: 14, overflow: 'hidden', width: '100%' },
    exitDoneGrad: { paddingVertical: 14, alignItems: 'center' },
    exitDoneText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  });
}
