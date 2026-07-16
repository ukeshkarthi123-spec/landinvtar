import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { TrendingUp, TrendingDown } from 'lucide-react-native';

interface Props {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  highlight?: boolean;
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, sub, positive = true, highlight = false, icon }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: highlight ? colors.emerald + '33' : colors.border }]}>
      {highlight ? (
        <LinearGradient
          colors={colors.gradientCard}
          style={styles.highlightGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
          <Text style={[styles.value, { color: colors.emerald }]}>{value}</Text>
          {sub && (
            <View style={styles.subRow}>
              {positive ? (
                <TrendingUp size={12} color={colors.success} />
              ) : (
                <TrendingDown size={12} color={colors.error} />
              )}
              <Text style={[styles.sub, { color: positive ? colors.success : colors.error }]}>{sub}</Text>
            </View>
          )}
        </LinearGradient>
      ) : (
        <View style={styles.inner}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
          <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
          {sub && (
            <View style={styles.subRow}>
              {positive ? (
                <TrendingUp size={12} color={colors.success} />
              ) : (
                <TrendingDown size={12} color={colors.error} />
              )}
              <Text style={[styles.sub, { color: positive ? colors.success : colors.error }]}>{sub}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minWidth: 140,
  },
  highlightGradient: {
    padding: 14,
    flex: 1,
  },
  inner: {
    padding: 14,
    flex: 1,
  },
  iconContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  sub: {
    fontSize: 11,
    fontWeight: '600',
  },
});
