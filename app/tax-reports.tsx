import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Share, Platform,
} from 'react-native';
import { FileText, Download, TrendingUp, DollarSign, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { computeCurrentValue } from '@/types/database';
import type { Investment, TaxReport } from '@/types/database';

export default function TaxReportsScreen() {
  const { colors, isDark } = useTheme();
  const [reports, setReports] = useState<TaxReport[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [reportRes, investRes] = await Promise.all([
      supabase.from('tax_reports').select('*').order('created_at', { ascending: false }),
      supabase
        .from('investments')
        .select('*, land_projects!investments_project_id_fkey(id, name, location, image, expected_roi, category)')
        .eq('status', 'Active'),
    ]);
    if (reportRes.error) setError(reportRes.error.message);
    else setReports((reportRes.data ?? []) as TaxReport[]);
    if (investRes.data) setInvestments(investRes.data as Investment[]);
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const currentFY = (() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return month >= 3 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
  })();

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    const totalInvested = investments.reduce((s, i) => s + i.amount, 0);
    const portfolioValue = investments.reduce(
      (s, i) => s + computeCurrentValue(i.amount, i.roi_rate, i.created_at), 0
    );
    const totalReturns = Math.round((portfolioValue - totalInvested) * 100) / 100;

    const reportData = {
      investments: investments.map(i => ({
        project: i.land_projects?.name ?? 'Unknown',
        amount: i.amount,
        current_value: Math.round(computeCurrentValue(i.amount, i.roi_rate, i.created_at) * 100) / 100,
        roi_rate: i.roi_rate,
        invested_on: i.created_at,
      })),
      summary: {
        total_invested: totalInvested,
        portfolio_value: Math.round(portfolioValue * 100) / 100,
        total_returns: totalReturns,
        returns_pct: totalInvested > 0 ? Math.round((totalReturns / totalInvested) * 10000) / 100 : 0,
      },
    };

    const { error: insertError } = await supabase
      .from('tax_reports')
      .insert({
        financial_year: currentFY,
        total_invested: totalInvested,
        total_returns: totalReturns,
        report_data: reportData,
        status: 'Ready',
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      await fetchData();
      Alert.alert('Report Generated', `Your tax report for FY ${currentFY} is ready to download.`);
    }
    setGenerating(false);
  };

  const handleDownload = async (report: TaxReport) => {
    const data = report.report_data as { summary?: Record<string, number>; investments?: unknown[] };
    const summary = data?.summary ?? {};
    const lines = [
      `InvestLand Tax Report - FY ${report.financial_year}`,
      `Generated: ${new Date(report.created_at).toLocaleDateString('en-IN')}`,
      '',
      '--- Summary ---',
      `Total Invested: Rs. ${(report.total_invested ?? 0).toLocaleString('en-IN')}`,
      `Portfolio Value: Rs. ${(summary.portfolio_value ?? 0).toLocaleString('en-IN')}`,
      `Total Returns: Rs. ${(report.total_returns ?? 0).toLocaleString('en-IN')}`,
      `Returns %: ${summary.returns_pct ?? 0}%`,
      '',
      '--- Investments ---',
      ...(Array.isArray(data?.investments)
        ? (data.investments as { project: string; amount: number; current_value: number; roi_rate: number }[]).map(
            (inv, idx) => `${idx + 1}. ${inv.project} - Rs. ${inv.amount.toLocaleString('en-IN')} (ROI: ${inv.roi_rate}%)`
          )
        : ['No active investments']),
      '',
      'This is a computer-generated report for informational purposes only.',
      'Please consult a tax professional for filing.',
    ];
    const reportText = lines.join('\n');

    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `InvestLand_TaxReport_FY${report.financial_year}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          message: reportText,
          title: `InvestLand Tax Report FY ${report.financial_year}`,
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to download report.');
    }
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <ScreenHeader title="Tax Reports" />

      {loading ? (
        <View style={dynamicStyles.centered}>
          <ActivityIndicator color={colors.emerald} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scroll}>
          <View style={dynamicStyles.summaryCard}>
            <View style={dynamicStyles.summaryHeader}>
              <Calendar size={16} color={colors.emerald} />
              <Text style={dynamicStyles.summaryTitle}>Financial Year {currentFY}</Text>
            </View>
            <View style={dynamicStyles.summaryStats}>
              <View style={dynamicStyles.summaryStat}>
                <DollarSign size={14} color={colors.textMuted} />
                <Text style={dynamicStyles.summaryStatVal}>Rs. {investments.reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN')}</Text>
                <Text style={dynamicStyles.summaryStatLbl}>Invested</Text>
              </View>
              <View style={dynamicStyles.summaryStat}>
                <TrendingUp size={14} color={colors.emerald} />
                <Text style={[dynamicStyles.summaryStatVal, { color: colors.emerald }]}>
                  Rs. {Math.round(investments.reduce((s, i) => s + computeCurrentValue(i.amount, i.roi_rate, i.created_at) - i.amount, 0)).toLocaleString('en-IN')}
                </Text>
                <Text style={dynamicStyles.summaryStatLbl}>Returns</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[dynamicStyles.generateBtn, generating && dynamicStyles.generateBtnDisabled]}
              onPress={handleGenerate}
              disabled={generating}
              activeOpacity={0.85}
            >
              {generating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={dynamicStyles.generateBtnText}>Generate Report</Text>
              )}
            </TouchableOpacity>
          </View>

          {error && (
            <View style={dynamicStyles.errorBox}>
              <AlertCircle size={14} color={colors.error} />
              <Text style={dynamicStyles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={dynamicStyles.sectionTitle}>Generated Reports</Text>
          {reports.length === 0 ? (
            <View style={dynamicStyles.emptyCard}>
              <FileText size={32} color={colors.textMuted} />
              <Text style={dynamicStyles.emptyText}>No reports yet. Generate one above.</Text>
            </View>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={dynamicStyles.reportCard}>
                <View style={dynamicStyles.reportIcon}>
                  <FileText size={18} color="#A78BFA" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={dynamicStyles.reportTitle}>FY {report.financial_year}</Text>
                  <Text style={dynamicStyles.reportDate}>{new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  <View style={dynamicStyles.reportStats}>
                    <Text style={dynamicStyles.reportStat}>Invested: Rs. {(report.total_invested ?? 0).toLocaleString('en-IN')}</Text>
                    <Text style={[dynamicStyles.reportStat, { color: colors.emerald }]}>Returns: Rs. {(report.total_returns ?? 0).toLocaleString('en-IN')}</Text>
                  </View>
                </View>
                <View style={dynamicStyles.reportStatus}>
                  {report.status === 'Ready' ? (
                    <TouchableOpacity style={dynamicStyles.downloadBtn} onPress={() => handleDownload(report)}>
                      <Download size={16} color={colors.emerald} />
                    </TouchableOpacity>
                  ) : report.status === 'Generating' ? (
                    <ActivityIndicator size={16} color={colors.warning} />
                  ) : (
                    <AlertCircle size={16} color={colors.error} />
                  )}
                </View>
              </View>
            ))
          )}

          <View style={dynamicStyles.infoCard}>
            <CheckCircle2 size={14} color={colors.emerald} />
            <Text style={dynamicStyles.infoText}>
              Tax reports include your investment summary, returns, and project-wise breakdown for the financial year. Use this for filing your income tax returns.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function getDynamicStyles(colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: 20 },
    summaryCard: {
      backgroundColor: colors.bgCard, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 20,
    },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    summaryTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    summaryStats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    summaryStat: { flex: 1, gap: 4 },
    summaryStatVal: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
    summaryStatLbl: { color: colors.textMuted, fontSize: 11 },
    generateBtn: {
      backgroundColor: colors.emerald, borderRadius: 12, paddingVertical: 14,
      alignItems: 'center',
    },
    generateBtnDisabled: { opacity: 0.6 },
    generateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
    reportCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10,
    },
    reportIcon: {
      width: 38, height: 38, borderRadius: 10,
      backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center',
    },
    reportTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    reportDate: { color: colors.textMuted, fontSize: 11, marginBottom: 4 },
    reportStats: { flexDirection: 'row', gap: 12 },
    reportStat: { color: colors.textSecondary, fontSize: 11 },
    reportStatus: { alignItems: 'center', justifyContent: 'center' },
    downloadBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.emeraldGlow, alignItems: 'center', justifyContent: 'center',
    },
    infoCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: colors.bgCard, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginTop: 16,
    },
    infoText: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, flex: 1 },
  });
}
