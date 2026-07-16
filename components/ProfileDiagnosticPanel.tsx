import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Shield, Globe, Cpu, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

export function ProfileDiagnosticPanel() {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [network, setNetwork] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetwork(state);
    });
    return () => unsubscribe();
  }, []);

  const config = {
    URL: process.env.EXPO_PUBLIC_SUPABASE_URL ? '✅ Configured' : '❌ MISSING',
    KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configured' : '❌ MISSING',
    Platform: Platform.OS,
    Version: Platform.Version,
  };

  if (!expanded) {
    return (
      <TouchableOpacity
        style={[styles.miniBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        onPress={() => setExpanded(true)}
      >
        <Shield size={14} color={colors.textSecondary} />
        <Text style={[styles.miniText, { color: colors.textSecondary }]}>Network Diagnostics</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>System Diagnostics</Text>
        <TouchableOpacity onPress={() => setExpanded(false)}>
          <Text style={{ color: colors.emerald, fontWeight: '700' }}>Close</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Section title="Environment Variables" icon={<Cpu size={16} color={colors.emerald} />} colors={colors}>
          <Row label="Supabase URL" value={config.URL} colors={colors} />
          <Row label="Anon Key" value={config.KEY} colors={colors} />
          {!process.env.EXPO_PUBLIC_SUPABASE_URL && (
            <Text style={styles.errorHint}>
              Note: EXPO_PUBLIC_ variables must be defined in your EAS Secrets or .env at build time.
            </Text>
          )}
        </Section>

        <Section title="Connectivity" icon={<Globe size={16} color="#3B82F6" />} colors={colors}>
          <Row label="Status" value={network?.isConnected ? 'Connected' : 'Disconnected'} colors={colors} />
          <Row label="Type" value={network?.type || 'Unknown'} colors={colors} />
          <Row label="Internet Reachable" value={network?.isInternetReachable ? 'Yes' : 'No'} colors={colors} />
        </Section>

        <Section title="Supabase Client" icon={<Shield size={16} color="#8B5CF6" />} colors={colors}>
          <Row label="Initialized" value="Yes" colors={colors} />
          <TouchableOpacity
            style={styles.testBtn}
            onPress={async () => {
               try {
                 const { error } = await supabase.from('profiles').select('id').limit(1);
                 alert(error ? `Supabase Error: ${error.message}` : 'Supabase Connection Success!');
               } catch (e: any) {
                 alert(`Network Request Failed: ${e.message}`);
               }
            }}
          >
            <Text style={styles.testBtnText}>Test Database Connection</Text>
          </TouchableOpacity>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, icon, children, colors }: any) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value, colors }: any) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    alignSelf: 'center'
  },
  miniText: { fontSize: 12, fontWeight: '600' },
  container: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    maxHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '800' },
  content: { gap: 16 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  sectionBody: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: 12 },
  value: { fontSize: 12, fontWeight: '600' },
  errorHint: { fontSize: 10, color: '#EF4444', marginTop: 4, fontStyle: 'italic' },
  testBtn: {
    backgroundColor: '#16C784',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  testBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' }
});
