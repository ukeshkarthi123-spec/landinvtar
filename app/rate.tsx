import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Linking, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Star, Heart, ThumbsUp, MessageCircle, Check } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ScreenHeader } from '@/components/ScreenHeader';
import { router } from 'expo-router';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.investland.app';
const APP_STORE_URL = 'https://apps.apple.com/app/investland/id1234567890';

export default function RateScreen() {
  const { colors, isDark } = useTheme();
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<string>('');

  const handleStarPress = (star: number) => {
    setRating(star);
  };

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Please Rate', 'Please select a star rating before submitting.');
      return;
    }

    if (rating >= 4) {
      setSubmitted(true);
      setTimeout(() => {
        const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
        Linking.openURL(url).catch(() => {
          Alert.alert('Thank You!', 'We appreciate your rating. Visit the app store to leave a review.');
        });
        router.back();
      }, 1500);
    } else {
      setSubmitted(true);
      setFeedback('Thank you for your feedback. We are constantly working to improve.');
      setTimeout(() => {
        Alert.alert(
          'Thank You',
          'We appreciate your feedback. Our team will work on improving your experience.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }, 1500);
    }
  };

  const feedbackOptions = [
    { icon: ThumbsUp, label: 'Great app!', color: colors.success },
    { icon: Heart, label: 'Love the features', color: '#FBBF24' },
    { icon: MessageCircle, label: 'Need improvements', color: '#60A5FA' },
  ];

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <View style={dynamicStyles.container}>
      <ScreenHeader title="Rate InvestLand" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dynamicStyles.scroll}>
        <LinearGradient
          colors={['rgba(251,191,36,0.1)', 'rgba(245,158,11,0.04)']}
          style={dynamicStyles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={dynamicStyles.heroIcon}>
            <Star size={36} color={colors.warning} fill={colors.warning} />
          </View>
          <Text style={dynamicStyles.heroTitle}>Enjoying InvestLand?</Text>
          <Text style={dynamicStyles.heroSub}>
            Your feedback helps us improve and reach more investors. Take a moment to rate us!
          </Text>
        </LinearGradient>

        <View style={dynamicStyles.ratingCard}>
          <Text style={dynamicStyles.ratingLabel}>Tap to rate</Text>
          <View style={dynamicStyles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStarPress(star)}
                activeOpacity={0.6}
              >
                <Star
                  size={44}
                  color={star <= rating ? colors.warning : colors.border}
                  fill={star <= rating ? colors.warning : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={dynamicStyles.ratingText}>
              {rating === 5 && 'Excellent!'}
              {rating === 4 && 'Very Good!'}
              {rating === 3 && 'Good'}
              {rating === 2 && 'Needs Improvement'}
              {rating === 1 && 'Poor'}
            </Text>
          )}
        </View>

        {rating > 0 && !submitted && (
          <View style={dynamicStyles.feedbackCard}>
            <Text style={dynamicStyles.feedbackTitle}>What did you like?</Text>
            <View style={dynamicStyles.feedbackRow}>
              {feedbackOptions.map((opt) => (
                <TouchableOpacity key={opt.label} style={dynamicStyles.feedbackChip} activeOpacity={0.7}>
                  <opt.icon size={14} color={opt.color} />
                  <Text style={dynamicStyles.feedbackChipText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!submitted ? (
          <TouchableOpacity style={dynamicStyles.submitBtn} onPress={handleSubmit} activeOpacity={0.85}>
            <Text style={dynamicStyles.submitBtnText}>Submit Rating</Text>
          </TouchableOpacity>
        ) : (
          <View style={dynamicStyles.thankYouCard}>
            <Check size={24} color={colors.success} />
            <Text style={dynamicStyles.thankYouTitle}>Thank You!</Text>
            <Text style={dynamicStyles.thankYouText}>{feedback || 'Your rating has been submitted.'}</Text>
          </View>
        )}

        <View style={dynamicStyles.infoCard}>
          <Text style={dynamicStyles.infoText}>
            If you love using InvestLand, please consider leaving a review on the Play Store or App Store. It helps us grow and serve you better!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function getDynamicStyles(colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20 },
    heroCard: {
      borderRadius: 20, padding: 24, alignItems: 'center',
      borderWidth: 1, borderColor: colors.glassBorder, marginBottom: 20,
    },
    heroIcon: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: 'rgba(251,191,36,0.12)', alignItems: 'center', justifyContent: 'center',
      marginBottom: 12,
    },
    heroTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 },
    heroSub: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
    ratingCard: {
      backgroundColor: colors.bgCard, borderRadius: 16, padding: 24,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginBottom: 16,
    },
    ratingLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 16 },
    starsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    ratingText: { color: colors.warning, fontSize: 16, fontWeight: '700' },
    feedbackCard: {
      backgroundColor: colors.bgCard, borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 16,
    },
    feedbackTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 12 },
    feedbackRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    feedbackChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.bgCard2, borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 8,
      borderWidth: 1, borderColor: colors.border,
    },
    feedbackChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
    submitBtn: {
      backgroundColor: colors.warning, borderRadius: 14, paddingVertical: 16,
      alignItems: 'center', marginBottom: 16,
    },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    thankYouCard: {
      alignItems: 'center', gap: 8,
      backgroundColor: colors.emeraldGlow2, borderRadius: 16, padding: 24,
      borderWidth: 1, borderColor: colors.success + '33', marginBottom: 16,
    },
    thankYouTitle: { color: colors.success, fontSize: 18, fontWeight: '800' },
    thankYouText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
    infoCard: {
      backgroundColor: colors.bgCard, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    infoText: { color: colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  });
}
