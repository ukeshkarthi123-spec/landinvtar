import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  rightAction?: React.ReactNode;
}

export function ScreenHeader({ title, rightAction }: ScreenHeaderProps) {
  const { colors, isDark } = useTheme();

  const gradientColors: [string, string] = isDark
    ? ['#0D1A13', colors.bg]
    : ['#FFFFFF', colors.bg];

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.header}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title}</Text>
        {rightAction ?? <View style={{ width: 38 }} />}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1 },
});
