import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Shield, Fingerprint } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';

export default function LockScreen() {
  const { colors } = useTheme();
  const { unlockApp, signOut, profile } = useApp();
  const [authenticating, setAuthenticating] = React.useState(false);

  const handleUnlock = async () => {
    console.log('Biometric: handleUnlock triggered');
    setAuthenticating(true);

    try {
      const success = await unlockApp();
      console.log('Biometric: unlockApp result:', success);

      if (success) {
        console.log('Biometric: Authentication success');
        console.log('Biometric: Navigation started');

        // Short timeout to allow context state to settle
        setTimeout(() => {
          try {
            const isAdmin = profile?.is_admin || (profile as any)?.role === 'admin';
            const homeRoute = isAdmin ? '/admin' : '/(tabs)';

            console.log('Biometric: Target home route:', homeRoute);
            router.replace(homeRoute as any);
            console.log('Biometric: Navigation completed');
          } catch (navErr) {
            console.error('Biometric: Navigation failed:', navErr);
          }
        }, 100);
      } else {
        console.log('Biometric: Authentication cancelled or failed');
        setAuthenticating(false);
      }
    } catch (err) {
      console.error('Biometric: handleUnlock error:', err);
      setAuthenticating(false);
    }
  };

  // Automatically trigger on mount if possible
  React.useEffect(() => {
    handleUnlock();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.bgCard }]}>
          <Shield size={48} color={colors.emerald} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>InvestLand Locked</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Authentication required to access your account
        </Text>

        <TouchableOpacity
          style={[styles.unlockBtn, { backgroundColor: colors.emerald }]}
          onPress={handleUnlock}
          disabled={authenticating}
        >
          {authenticating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Fingerprint size={24} color="#fff" />
              <Text style={styles.unlockBtnText}>Unlock with Biometrics</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()}>
          <Text style={[styles.signOutText, { color: colors.textMuted }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  content: {
    width: '80%',
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
  },
  unlockBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  signOutBtn: {
    marginTop: 24,
    padding: 12,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
