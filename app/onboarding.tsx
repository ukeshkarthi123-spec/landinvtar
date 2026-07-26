import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, TrendingUp, Landmark, ChevronRight, ArrowRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Secure Fractional Investment',
    description: 'Invest in government-verified premium land with complete legal transparency starting from ₹500.',
    icon: Shield,
    colors: ['#00E38C', '#00C476'],
  },
  {
    id: '2',
    title: 'High Asset Appreciation',
    description: 'Our AI selects high-growth regions with projected annual appreciation up to 25%.',
    icon: TrendingUp,
    colors: ['#00E38C', '#00C476'],
  },
  {
    id: '3',
    title: 'Instant Liquidity Exit',
    description: 'Sell your holdings anytime in our secondary marketplace or request a buyback.',
    icon: Landmark,
    colors: ['#00E38C', '#00C476'],
  },
];

export default function OnboardingScreen() {
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
      router.replace('/login');
    } catch (err) {
      router.replace('/login');
    }
  }, []);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboarding();
    }
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  const renderItem = ({ item }: { item: typeof SLIDES[0] }) => {
    const Icon = item.icon;
    return (
      <View style={dynamicStyles.slide}>
        <View style={dynamicStyles.imageContainer}>
          <LinearGradient
            colors={isDark ? ['rgba(0, 227, 140, 0.1)', 'rgba(0, 227, 140, 0.02)'] : ['rgba(0, 227, 140, 0.08)', 'rgba(0, 227, 140, 0.02)']}
            style={dynamicStyles.iconCircle}
          >
            <View style={dynamicStyles.iconInner}>
                <Icon size={80} color={colors.emerald} />
            </View>
          </LinearGradient>
        </View>
        <View style={dynamicStyles.textContainer}>
          <Text style={dynamicStyles.title}>{item.title}</Text>
          <Text style={dynamicStyles.description}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient colors={[colors.bg, colors.bg]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.logoText}><Text style={{color: colors.emerald}}>Invest</Text><Text style={{color: colors.textPrimary}}>Land</Text></Text>
            <TouchableOpacity onPress={completeOnboarding} style={dynamicStyles.skipBtn}>
                <Text style={dynamicStyles.skipText}>Skip</Text>
            </TouchableOpacity>
        </View>

        <FlatList
            data={SLIDES}
            renderItem={renderItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            bounces={false}
            keyExtractor={(item) => item.id}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
            onViewableItemsChanged={viewableItemsChanged}
            viewabilityConfig={viewConfig}
            ref={slidesRef}
            scrollEventThrottle={16}
        />

        <View style={dynamicStyles.footer}>
            <View style={dynamicStyles.indicatorContainer}>
            {SLIDES.map((_, i) => {
                const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 24, 8],
                extrapolate: 'clamp',
                });
                const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.3, 1, 0.3],
                extrapolate: 'clamp',
                });
                return (
                <Animated.View
                    key={i.toString()}
                    style={[dynamicStyles.dot, { width: dotWidth, opacity, backgroundColor: colors.emerald }]}
                />
                );
            })}
            </View>

            <TouchableOpacity
                style={dynamicStyles.button}
                onPress={handleNext}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={colors.gradientGreen}
                    style={dynamicStyles.buttonGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Text style={dynamicStyles.buttonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Start Investing' : 'Continue'}
                    </Text>
                    <ArrowRight size={20} color="#000" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { height: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24 },
    logoText: { fontSize: 20, fontWeight: '900' },
    skipBtn: { padding: 8 },
    skipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
    slide: { width, alignItems: 'center', justifyContent: 'center', padding: 24 },
    imageContainer: { flex: 0.6, justifyContent: 'center', alignItems: 'center' },
    iconCircle: { width: 240, height: 240, borderRadius: 120, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.emerald + '1a' },
    iconInner: { width: 180, height: 180, borderRadius: 90, backgroundColor: colors.emerald + '0d', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.emerald + '33' },
    textContainer: { flex: 0.4, alignItems: 'center', paddingTop: 20 },
    title: { fontSize: 32, fontWeight: '900', color: colors.textPrimary, textAlign: 'center', letterSpacing: -1, lineHeight: 40 },
    description: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20, lineHeight: 26, marginTop: 16 },
    footer: { paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },
    indicatorContainer: { flexDirection: 'row', height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    dot: { height: 6, borderRadius: 3, marginHorizontal: 4 },
    button: { width: '100%', borderRadius: 18, overflow: 'hidden' },
    buttonGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 10 },
    buttonText: { color: '#000', fontSize: 16, fontWeight: '800' },
  });
}
