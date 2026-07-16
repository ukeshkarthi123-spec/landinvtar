import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, TrendingUp, Users, ShieldCheck, BadgeCheck } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import type { LandProject } from '@/types/database';

const { width } = Dimensions.get('window');

interface Props {
  project: LandProject;
  onPress: () => void;
  horizontal?: boolean;
}

export default function PropertyCard({ project, onPress, horizontal = false }: Props) {
  const { colors, isDark } = useTheme();
  const cardWidth = horizontal ? width * 0.72 : ('100%' as any);

  const riskColors = {
    Low: colors.success,
    Medium: colors.warning,
    High: colors.error,
  };

  const imageOverlayColors: [string, string] = isDark
    ? ['transparent', 'rgba(0,0,0,0.85)']
    : ['transparent', 'rgba(0,0,0,0.7)'];

  const dynamicStyles = getDynamicStyles(colors, isDark);

  return (
    <TouchableOpacity style={[dynamicStyles.card, { width: cardWidth }]} onPress={onPress} activeOpacity={0.85}>
      <View style={dynamicStyles.imageContainer}>
        <Image source={{ uri: project.image }} style={dynamicStyles.image} resizeMode="cover" />
        <LinearGradient colors={imageOverlayColors} style={dynamicStyles.imageOverlay} />

        <View style={dynamicStyles.badgesRow}>
          {project.is_govt_approved && (
            <View style={dynamicStyles.badge}>
              <ShieldCheck size={10} color={colors.emerald} />
              <Text style={dynamicStyles.badgeText}>Govt Approved</Text>
            </View>
          )}
          {project.is_verified && (
            <View style={dynamicStyles.badgeVerified}>
              <BadgeCheck size={10} color="#fff" />
              <Text style={dynamicStyles.badgeTextVerified}>Verified</Text>
            </View>
          )}
        </View>

        <View style={[dynamicStyles.riskBadge, {
          backgroundColor: riskColors[project.risk_score] + '22',
          borderColor: riskColors[project.risk_score] + '55',
        }]}>
          <Text style={[dynamicStyles.riskText, { color: riskColors[project.risk_score] }]}>
            {project.risk_score} Risk
          </Text>
        </View>

        <View style={dynamicStyles.categoryTag}>
          <Text style={dynamicStyles.categoryText}>{project.category}</Text>
        </View>
      </View>

      <View style={dynamicStyles.content}>
        <Text style={dynamicStyles.projectName} numberOfLines={1}>{project.name}</Text>
        <View style={dynamicStyles.locationRow}>
          <MapPin size={12} color={colors.textMuted} />
          <Text style={dynamicStyles.locationText} numberOfLines={1}>{project.location}</Text>
        </View>

        <View style={dynamicStyles.statsRow}>
          <View style={dynamicStyles.stat}>
            <Text style={dynamicStyles.statLabel}>Min. Invest</Text>
            <Text style={dynamicStyles.statValue}>₹{project.min_investment.toLocaleString('en-IN')}</Text>
          </View>
          <View style={dynamicStyles.statDivider} />
          <View style={dynamicStyles.stat}>
            <Text style={dynamicStyles.statLabel}>Expected ROI</Text>
            <View style={dynamicStyles.roiRow}>
              <TrendingUp size={12} color={colors.emerald} />
              <Text style={[dynamicStyles.statValue, { color: colors.emerald }]}>{project.expected_roi}% p.a.</Text>
            </View>
          </View>
          <View style={dynamicStyles.statDivider} />
          <View style={dynamicStyles.stat}>
            <Text style={dynamicStyles.statLabel}>Area</Text>
            <Text style={dynamicStyles.statValue}>{project.total_area}</Text>
          </View>
        </View>

        <View style={dynamicStyles.progressSection}>
          <View style={dynamicStyles.progressHeader}>
            <Text style={dynamicStyles.progressLabel}>
              ₹{project.raised_funding >= 100000
                ? `${(project.raised_funding / 100000).toFixed(1)}L`
                : project.raised_funding.toLocaleString('en-IN')} raised
            </Text>
            <View style={dynamicStyles.investorsRow}>
              <Users size={11} color={colors.textMuted} />
              <Text style={dynamicStyles.investorsText}>{project.investors_count.toLocaleString()} investors</Text>
            </View>
          </View>
          <View style={dynamicStyles.progressBg}>
            <View style={[
              dynamicStyles.progressFill,
              { width: `${Math.min(100, project.funding_progress)}%` as any },
              project.funding_progress >= 100 && { backgroundColor: colors.success }
            ]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
             <Text style={[
               dynamicStyles.progressPercent,
               project.funding_progress >= 100 && { color: colors.success }
             ]}>
               {project.funding_progress >= 100 ? 'Fully Funded' : `${project.funding_progress}% funded`}
             </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[dynamicStyles.investBtn, project.funding_progress >= 100 && { opacity: 0.8 }]}
          onPress={onPress}
          activeOpacity={0.85}
          disabled={project.funding_progress >= 100}
        >
          <LinearGradient
            colors={project.funding_progress >= 100 ? [colors.textMuted, colors.textDisabled] : colors.gradientGreen}
            style={dynamicStyles.investGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={dynamicStyles.investBtnText}>
              {project.funding_progress >= 100 ? 'Sold Out' : 'Invest Now'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgCard, borderRadius: 20, overflow: 'hidden',
      borderWidth: 1, borderColor: colors.border, marginBottom: 16,
    },
    imageContainer: { height: 180, position: 'relative' },
    image: { width: '100%', height: '100%' },
    imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
    badgesRow: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.emeraldGlow, borderWidth: 1, borderColor: colors.emerald + '44',
      borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
    },
    badgeText: { color: colors.emerald, fontSize: 10, fontWeight: '600' },
    badgeVerified: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(59,130,246,0.2)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)',
      borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
    },
    badgeTextVerified: { color: '#60A5FA', fontSize: 10, fontWeight: '600' },
    riskBadge: { position: 'absolute', top: 10, right: 10, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
    riskText: { fontSize: 10, fontWeight: '700' },
    categoryTag: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    categoryText: { color: colors.textSecondary, fontSize: 10, fontWeight: '500' },
    content: { padding: 14 },
    projectName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
    locationText: { color: colors.textMuted, fontSize: 12, flex: 1 },
    statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard2, borderRadius: 12, padding: 10, marginBottom: 12 },
    stat: { flex: 1, alignItems: 'center', gap: 3 },
    statDivider: { width: 1, height: 28, backgroundColor: colors.border },
    statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '500' },
    statValue: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    roiRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    progressSection: { marginBottom: 12 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    progressLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
    investorsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    investorsText: { color: colors.textMuted, fontSize: 11 },
    progressBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginBottom: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.emerald, borderRadius: 3 },
    progressPercent: { color: colors.emerald, fontSize: 10, fontWeight: '600', textAlign: 'right' },
    investBtn: { borderRadius: 12, overflow: 'hidden' },
    investGradient: { paddingVertical: 12, alignItems: 'center' },
    investBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  });
}
