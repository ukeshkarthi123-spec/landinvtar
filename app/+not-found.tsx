import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export default function NotFoundScreen() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.textPrimary }} />
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={styles.emoji}>🏔</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Page Not Found</Text>
        <Text style={[styles.text, { color: colors.textMuted }]}>This screen doesn't exist in InvestLand.</Text>
        <Link href="/" asChild>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.emerald }]}>
            <Text style={styles.btnText}>Go to Home</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  text: { fontSize: 14, marginBottom: 24, textAlign: 'center' },
  btn: {
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
