import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export default function AdminLayout() {
  const { profile, loading, isAuthenticated } = useApp();
  const { colors } = useTheme();

  useEffect(() => {
    if (!loading) {
      // Check if user is authenticated and is an admin
      // Note: We check both is_admin (current) and role (new) for compatibility
      const isAdmin = profile?.is_admin || (profile as any)?.role === 'admin';

      if (!isAuthenticated || !isAdmin) {
        router.replace('/login');
      }
    }
  }, [loading, isAuthenticated, profile]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.emerald} />
      </View>
    );
  }

  const isAdmin = profile?.is_admin || (profile as any)?.role === 'admin';
  if (!isAdmin) {
    return null; // Will redirect in useEffect
  }

  return (
    <Stack screenOptions={{
      headerShown: true,
      headerStyle: { backgroundColor: colors.bgCard },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: { fontWeight: 'bold' },
      animation: 'slide_from_right'
    }}>
      <Stack.Screen name="index" options={{ title: 'Admin Dashboard', headerShown: false }} />
      <Stack.Screen name="users" options={{ title: 'User Management' }} />
      <Stack.Screen name="properties" options={{ title: 'Property Management' }} />
      <Stack.Screen name="kyc" options={{ title: 'KYC Approvals' }} />
      <Stack.Screen name="investments" options={{ title: 'Investment Logs' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
