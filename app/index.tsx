import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useRootNavigationState } from 'expo-router';
import { Fingerprint } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { useBiometrics } from '@/hooks/useBiometrics';
import { supabase } from '@/lib/supabase';

export default function SplashScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, loading, profile } = useApp();
  const { isLocked, authenticate } = useBiometrics();
  const [hasRedirected, setHasRedirected] = useState(false);
  const redirectionStarted = useRef(false);
  const navigationState = useRootNavigationState();
  const lastLoggedState = useRef<string>('');

  // Diagnostic logging - throttled to only log when state actually changes
  useEffect(() => {
    const currentState = JSON.stringify({ loading, isLocked, isAuthenticated, profileLoaded: !!profile, navReady: !!navigationState?.key });
    if (lastLoggedState.current !== currentState) {
      console.log('[Splash] State Change:', currentState);
      lastLoggedState.current = currentState;
    }
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const tagFade = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[Splash] Starting animations');
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(ringScale, { toValue: 1.5, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(tagFade, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    // 1. Navigation Guard
    if (loading || hasRedirected || redirectionStarted.current || !navigationState?.key) {
      return;
    }

    // 2. Lock Guard
    if (isLocked) {
      return;
    }

    const performRedirect = async () => {
      redirectionStarted.current = true;
      await new Promise(resolve => setTimeout(resolve, 1500));

      try {
        // 3. Maintenance Check
        const { data: config } = await supabase.from('app_settings').select('maintenance_mode, maintenance_message').limit(1).maybeSingle();
        if (config?.maintenance_mode && !profile?.is_admin) {
          Alert.alert('System Maintenance', config.maintenance_message || 'The system is currently undergoing maintenance.');
          redirectionStarted.current = false; // Allow retry on next splash tap
          return;
        }

        const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');

        if (onboardingCompleted !== 'true') {
          console.log('[Splash] -> Onboarding');
          router.replace('/onboarding');
        } else if (isAuthenticated) {
          const isAdmin = profile?.is_admin || (profile as any)?.role === 'admin';
          const target = isAdmin ? '/admin' : '/(tabs)';
          console.log('[Splash] -> Authenticated:', target);
          router.replace(target as any);
        } else {
          console.log('[Splash] -> Login');
          router.replace('/login');
        }
        setHasRedirected(true);
      } catch (err) {
        console.error('[Splash] Navigation failed:', err);
        router.replace('/login');
        setHasRedirected(true);
      }
    };

    performRedirect();
  }, [loading, isLocked, isAuthenticated, profile, hasRedirected, navigationState?.key]);

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <LinearGradient
        colors={isDark ? ['#090909', '#0D1A13', '#090909'] : ['#F8FAFC', '#E2E8F0', '#F8FAFC']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <Animated.View style={[dynamicStyles.ringOuter, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
      <Animated.View style={[dynamicStyles.ringInner, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />

      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <LinearGradient
          colors={colors.gradientGreen}
          style={dynamicStyles.logoCircle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={dynamicStyles.logoIcon}>IL</Text>
        </LinearGradient>

        <Text style={dynamicStyles.logoText}>
          <Text style={{ color: colors.emerald }}>Invest</Text>
          <Text style={{ color: colors.textPrimary }}>Land</Text>
        </Text>

        <Animated.View style={{ opacity: tagFade }}>
          <Text style={dynamicStyles.tagline}>Invest in Premium Land from Rs 500</Text>
          <View style={dynamicStyles.tagDots}>
            <View style={dynamicStyles.dot} />
            <View style={dynamicStyles.dotActive} />
            <View style={dynamicStyles.dot} />
          </View>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[dynamicStyles.footer, { opacity: tagFade }]}>
        {isLocked ? (
          <TouchableOpacity style={dynamicStyles.unlockBtn} onPress={authenticate}>
            <Fingerprint size={20} color="#fff" />
            <Text style={dynamicStyles.unlockText}>Unlock InvestLand</Text>
          </TouchableOpacity>
        ) : (
          <Text style={dynamicStyles.footerText}>India's Trusted Land Investment Platform</Text>
        )}
      </Animated.View>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringOuter: {
      position: 'absolute',
      width: 320,
      height: 320,
      borderRadius: 160,
      borderWidth: 1,
      borderColor: colors.emerald + '33',
    },
    ringInner: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      borderWidth: 1,
      borderColor: colors.emerald + '55',
    },
    logoCircle: {
      width: 90,
      height: 90,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
      shadowColor: colors.emerald,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 20,
    },
    logoIcon: {
      color: '#fff',
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -1,
    },
    logoText: {
      fontSize: 36,
      fontWeight: '900',
      letterSpacing: -1,
      marginBottom: 10,
    },
    tagline: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
      textAlign: 'center',
      letterSpacing: 0.3,
    },
    tagDots: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      marginTop: 18,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 18,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.emerald,
    },
    footer: {
      position: 'absolute',
      bottom: 48,
      alignItems: 'center',
    },
    footerText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '500',
      letterSpacing: 0.5,
    },
    unlockBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.emerald,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 14,
    },
    unlockText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
