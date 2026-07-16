import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

interface Props {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  highlight?: boolean;
}

export default function QuickAction({ icon, label, onPress, highlight = false }: Props) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.75}>
      {highlight ? (
        <LinearGradient
          colors={colors.gradientGreen}
          style={styles.iconBox}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {icon}
        </LinearGradient>
      ) : (
        <View style={[styles.iconBoxDefault, { backgroundColor: colors.bgCard2, borderColor: colors.border }]}>{icon}</View>
      )}
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    minWidth: 60,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxDefault: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
