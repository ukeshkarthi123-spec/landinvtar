import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, Dimensions, TextInput, Modal,
  ActivityIndicator, RefreshControl, Linking, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft, MapPin, TrendingUp, Users, ShieldCheck,
  BadgeCheck, ChevronRight, Star, Check, X, AlertCircle,
  FileText, Leaf, Landmark, Plane, Train, Hospital,
  School, ChevronDown, ChevronUp, LogOut, Lock,
  Plus, Wallet,
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/api-utils';
import { useApp } from '@/context/AppContext';
import type { LandProject, Investment } from '@/types/database';
import { computeCurrentValue } from '@/types/database';

const { width, height } = Dimensions.get('window');

const faqs = [
  { q: 'How does fractional land investment work?', a: 'You purchase a fractional share of the land through InvestLand. Your ownership is recorded digitally and you earn proportional returns based on your investment.' },
  { q: 'What is the exit strategy?', a: 'Investors can exit through the secondary marketplace (after lock-in period), when the project is sold, or through InvestLand\'s guaranteed buyback program (where applicable).' },
  { q: 'Is my investment legally protected?', a: 'Yes. All investments are backed by legally registered land documents, and investors receive digital ownership certificates. Our legal team ensures full compliance.' },
  { q: 'When will I receive returns?', a: 'Returns are paid quarterly as rental income (if applicable) and on appreciation at exit. The projected timeline is stated in each project.' },
];

function getAmenityIcon(type: string, colors: any) {
  switch (type) {
    case 'work': return <Landmark size={16} color="#60A5FA" />;
    case 'hospital': return <Hospital size={16} color="#F87171" />;
    case 'shopping': return <Star size={16} color="#FBBF24" />;
    case 'metro': return <Train size={16} color="#A78BFA" />;
    case 'transport': return <Train size={16} color="#A78BFA" />;
    case 'airport': return <Plane size={16} color={colors.emerald} />;
    case 'nature': return <Leaf size={16} color={colors.emerald} />;
    case 'city': return <Landmark size={16} color="#60A5FA" />;
    case 'landmark': return <MapPin size={16} color="#FBBF24" />;
    default: return <MapPin size={16} color={colors.textMuted} />;
  }
}

export default function PropertyDetailsScreen() {
  const { colors, isDark } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, refreshProfile, setWalletBalance } = useApp();

  const riskColors = { Low: colors.success, Medium: colors.warning, High: colors.error };

  const [project, setProject] = useState<LandProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeImage, setActiveImage] = useState(0);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [investAmount, setInvestAmount] = useState('500');
  const [investing, setInvesting] = useState(false);
  const [investError, setInvestError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [userInvestment, setUserInvestment] = useState<Investment | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeSuccess, setCloseSuccess] = useState<{ amount: number } | null>(null);

  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [addAmount, setAddAmount] = useState('500');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const isMounted = useRef(true);
  const channelSubscribed = useRef(false);

  // Fetch project with timeout
  const fetchProject = async () => {
    try {
      const result = await withTimeout(
        Promise.resolve(supabase
          .from('land_projects')
          .select('*')
          .eq('id', id)
          .maybeSingle()),
        10000
      ) as any;

      if (!isMounted.current) return;

      const { data, error } = result;
      if (error) {
        setError(error.message);
      } else if (!data) {
        setError('Project not found');
      } else {
        setProject(data as LandProject);
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError((err instanceof Error ? err.message : 'Failed to load project'));
      }
    }
  };

  // Fetch user investment with timeout
  const fetchUserInvestment = async () => {
    if (!id) return;
    try {
      const result = await withTimeout(
        Promise.resolve(supabase
          .from('investments')
          .select('id, amount, roi_rate, status, created_at, lock_in_period, exit_charge_pct')
          .eq('project_id', id)
          .eq('status', 'Active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()),
        10000
      ) as any;

      if (!isMounted.current) return;

      const { data, error } = result;
      if (!error && data) {
        setUserInvestment(data as Investment);
      } else {
        setUserInvestment(null);
      }
    } catch (err) {
      if (isMounted.current) {
        console.error('Error fetching user investment:', err);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    setLoading(true);

    Promise.all([fetchProject(), fetchUserInvestment()])
      .catch(err => console.error('Error in data fetch:', err))
      .finally(() => {
        if (isMounted.current) {
          setLoading(false);
        }
      });

    return () => {
      isMounted.current = false;
    };
  }, [id]);

  // Subscribe to live project updates (once)
  useEffect(() => {
    if (!id || channelSubscribed.current) return;
    channelSubscribed.current = true;

    const channel = supabase
      .channel(`project-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'land_projects',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (!isMounted.current) return;
          console.log('Live project update received:', payload.new);
          setProject(payload.new as LandProject);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelSubscribed.current = false;
    };
  }, [id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchProject(), fetchUserInvestment()]);
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  }, []);

  const expectedReturn = Math.round(parseInt(investAmount || '0') * ((project?.expected_roi ?? 0) / 100));
  const totalReturn = parseInt(investAmount || '0') + expectedReturn;

  const handleOpenMap = () => {
    if (!project) return;
    const query = encodeURIComponent(`${project.name}, ${project.location}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open maps.');
    });
  };

  const handleInvest = async () => {
    const kycStatus = profile?.kyc_status;

    if (kycStatus === 'Pending') {
      Alert.alert(
        'KYC Under Review',
        'Your identity verification is currently being processed. You can start investing once approved.',
        [{ text: 'Check Status', onPress: () => router.push('/kyc') }, { text: 'OK' }]
      );
      return;
    }

    if (kycStatus !== 'Verified') {
      Alert.alert(
        'KYC Required',
        'Complete your KYC verification to continue using financial services.',
        [{ text: 'Complete KYC', onPress: () => router.push('/kyc') }, { text: 'Cancel', style: 'cancel' }]
      );
      return;
    }
    const val = parseInt(investAmount || '0');
    if (!project) return;
    if (val < project.min_investment) {
      setInvestError(`Minimum investment is ₹${project.min_investment.toLocaleString('en-IN')}`);
      return;
    }
    if (val > (profile?.wallet_balance ?? 0)) {
      setInvestError('Insufficient wallet balance. Please add money first.');
      return;
    }

    setInvesting(true);
    setInvestError(null);
    const { data, error } = await supabase.rpc('invest_in_project', {
      p_project_id: project.id,
      p_amount: val,
    });
    if (error) {
      setInvestError(error.message);
      setInvesting(false);
      return;
    }
    const result = data as { success: boolean; new_balance: number } | null;
    if (result && typeof result.new_balance === 'number') {
      setWalletBalance(result.new_balance);
    } else {
      await refreshProfile();
    }
    setInvesting(false);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setShowInvestModal(false);
      fetchProject();
      fetchUserInvestment();
    }, 2000);
  };

  const isInvestmentLocked = (inv: Investment) => {
    const lockEnd = new Date(inv.created_at).getTime() + (inv.lock_in_period ?? 1) * 24 * 60 * 60 * 1000;
    return Date.now() < lockEnd;
  };

  const lockEndDate = (inv: Investment) => {
    return new Date(new Date(inv.created_at).getTime() + (inv.lock_in_period ?? 1) * 24 * 60 * 60 * 1000);
  };

  const handleCloseInvestment = async () => {
    if (!userInvestment) return;
    setClosing(true);
    setCloseError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('exit_investment', {
        p_investment_id: userInvestment.id,
      });
      if (rpcError) {
        setCloseError(rpcError.message);
        return;
      }
      const result = data as { success: boolean; exit_amount: number; new_balance: number } | null;
      if (result && typeof result.new_balance === 'number') {
        setWalletBalance(result.new_balance);
      } else {
        await refreshProfile();
      }
      if (result) {
        setCloseSuccess({ amount: result.exit_amount });
      }
      await fetchUserInvestment();
      fetchProject();
    } catch (err: any) {
      setCloseError(err?.message ?? 'Failed to close investment');
    } finally {
      setClosing(false);
    }
  };

  const closeCloseModal = () => {
    if (closing) return;
    setShowCloseModal(false);
    setCloseError(null);
    setCloseSuccess(null);
  };

  const handleAddMoney = async () => {
    if (!userInvestment) return;
    const val = parseInt(addAmount || '0');
    if (val <= 0) {
      setAddError('Please enter a valid amount');
      return;
    }
    if (val > (profile?.wallet_balance ?? 0)) {
      setAddError('Insufficient wallet balance');
      return;
    }

    setAdding(true);
    setAddError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('add_to_investment', {
        p_investment_id: userInvestment.id,
        p_amount: val,
      });
      if (rpcError) {
        setAddError(rpcError.message);
        return;
      }
      const result = data as { success: boolean; new_balance: number; new_amount: number } | null;
      if (result && typeof result.new_balance === 'number') {
        setWalletBalance(result.new_balance);
      } else {
        await refreshProfile();
      }
      setAddSuccess(true);
      setTimeout(() => {
        setAddSuccess(false);
        setShowAddMoneyModal(false);
        setAddAmount('500');
        fetchUserInvestment();
        fetchProject();
      }, 2000);
    } catch (err: any) {
      setAddError(err?.message ?? 'Failed to add money');
    } finally {
      setAdding(false);
    }
  };

  const closeAddMoneyModal = () => {
    if (adding) return;
    setShowAddMoneyModal(false);
    setAddError(null);
    setAddSuccess(false);
    setAddAmount('500');
  };

  const dynamicStyles = getDynamicStyles(colors, isDark);

  if (loading) {
    return (
      <View style={dynamicStyles.container}>
        <TouchableOpacity style={dynamicStyles.backBtnSimple} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={dynamicStyles.centered}>
          <ActivityIndicator color={colors.emerald} size="large" />
          <Text style={dynamicStyles.loadingText}>Loading project...</Text>
        </View>
      </View>
    );
  }

  if (error || !project) {
    return (
      <View style={dynamicStyles.container}>
        <TouchableOpacity style={dynamicStyles.backBtnSimple} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={dynamicStyles.centered}>
          <AlertCircle size={40} color={colors.error} />
          <Text style={dynamicStyles.errorText}>{error ?? 'Project not found'}</Text>
          <TouchableOpacity style={dynamicStyles.retryBtn} onPress={onRefresh}>
            <Text style={dynamicStyles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
      >
        {/* Image Gallery */}
        <View style={dynamicStyles.imageGallery}>
          <Image source={{ uri: project.images[activeImage] ?? project.image }} style={dynamicStyles.mainImage} resizeMode="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={dynamicStyles.imageTopGrad} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={dynamicStyles.imageBottomGrad} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />

          <TouchableOpacity style={dynamicStyles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={dynamicStyles.thumbnails}>
            {project.images.map((img, i) => (
              <TouchableOpacity key={i} onPress={() => setActiveImage(i)}>
                <Image source={{ uri: img }} style={[dynamicStyles.thumbnail, i === activeImage && dynamicStyles.thumbnailActive]} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={dynamicStyles.imageBottomRow}>
            <View style={dynamicStyles.categoryTag}>
              <Text style={dynamicStyles.categoryText}>{project.category}</Text>
            </View>
            <View style={[dynamicStyles.riskTag, { borderColor: riskColors[project.risk_score] + '55' }]}>
              <Text style={[dynamicStyles.riskText, { color: riskColors[project.risk_score] }]}>{project.risk_score} Risk</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={dynamicStyles.content}>
          {/* Title & Badges */}
          <View style={dynamicStyles.titleSection}>
            <Text style={dynamicStyles.projectName}>{project.name}</Text>
            <View style={dynamicStyles.locationRow}>
              <MapPin size={13} color={colors.textMuted} />
              <Text style={dynamicStyles.locationText}>{project.location}</Text>
            </View>
            <View style={dynamicStyles.badgesRow}>
              {project.is_govt_approved && (
                <View style={dynamicStyles.badge}>
                  <ShieldCheck size={12} color={colors.emerald} />
                  <Text style={dynamicStyles.badgeText}>Govt Approved</Text>
                </View>
              )}
              {project.is_verified && (
                <View style={dynamicStyles.badgeBlue}>
                  <BadgeCheck size={12} color="#60A5FA" />
                  <Text style={[dynamicStyles.badgeText, { color: '#60A5FA' }]}>Verified Docs</Text>
                </View>
              )}
            </View>
          </View>

          {/* Key Stats */}
          <View style={dynamicStyles.statsCard}>
            <View style={dynamicStyles.statsRow}>
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statLabel}>Min. Investment</Text>
                <Text style={dynamicStyles.statValue}>₹{project.min_investment.toLocaleString('en-IN')}</Text>
              </View>
              <View style={dynamicStyles.statDivider} />
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statLabel}>Expected ROI</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={14} color={colors.emerald} />
                  <Text style={[dynamicStyles.statValue, { color: colors.emerald }]}>{project.expected_roi}%</Text>
                </View>
              </View>
              <View style={dynamicStyles.statDivider} />
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statLabel}>Total Area</Text>
                <Text style={dynamicStyles.statValue}>{project.total_area}</Text>
              </View>
            </View>
            <View style={dynamicStyles.statsDivider} />
            <View style={dynamicStyles.statsRow}>
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statLabel}>Appreciation</Text>
                <Text style={[dynamicStyles.statValue, { color: colors.emerald }]}>+{project.appreciation_rate}%</Text>
              </View>
              <View style={dynamicStyles.statDivider} />
              <View style={dynamicStyles.statItem}>
                <Text style={dynamicStyles.statLabel}>Timeline</Text>
                <Text style={dynamicStyles.statValue}>{project.timeline}</Text>
              </View>
              <View style={dynamicStyles.statDivider} />
              <View style={dynamicStyles.statItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Users size={12} color={colors.textMuted} />
                  <Text style={dynamicStyles.statLabel}>Investors</Text>
                </View>
                <Text style={dynamicStyles.statValue}>{project.investors_count.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Funding Progress */}
          <View style={dynamicStyles.fundingCard}>
            <View style={dynamicStyles.fundingHeader}>
              <Text style={dynamicStyles.sectionTitle}>Funding Progress</Text>
              <Text style={[
                dynamicStyles.fundingPercent,
                project.funding_progress >= 100 && { color: colors.success }
              ]}>
                {project.funding_progress >= 100 ? 'Fully Funded' : `${project.funding_progress}%`}
              </Text>
            </View>
            <View style={dynamicStyles.progressBg}>
              <LinearGradient
                colors={project.funding_progress >= 100 ? [colors.success, colors.emerald] : colors.gradientGreen}
                style={[dynamicStyles.progressFill, { width: `${Math.min(100, project.funding_progress)}%` as any }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
            <View style={dynamicStyles.fundingDetails}>
              <Text style={dynamicStyles.fundingDetail}>
                Raised: ₹{project.raised_funding >= 10000000
                  ? `${(project.raised_funding / 10000000).toFixed(2)} Cr`
                  : project.raised_funding >= 100000
                    ? `${(project.raised_funding / 100000).toFixed(1)}L`
                    : project.raised_funding.toLocaleString('en-IN')}
              </Text>
              <Text style={dynamicStyles.fundingDetail}>
                Goal: ₹{project.total_funding >= 10000000
                  ? `${(project.total_funding / 10000000).toFixed(2)} Cr`
                  : project.total_funding >= 100000
                    ? `${(project.total_funding / 100000).toFixed(1)}L`
                    : project.total_funding.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* Description */}
          <View style={dynamicStyles.descCard}>
            <Text style={dynamicStyles.sectionTitle}>About This Project</Text>
            <Text style={dynamicStyles.descText}>{project.description}</Text>
            <View style={dynamicStyles.highlightsList}>
              {project.highlights.map(h => (
                <View key={h} style={dynamicStyles.highlightItem}>
                  <Check size={14} color={colors.emerald} />
                  <Text style={dynamicStyles.highlightText}>{h}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Investment Calculator */}
          <View style={dynamicStyles.calcCard}>
            <Text style={dynamicStyles.sectionTitle}>Investment Calculator</Text>
            <View style={dynamicStyles.calcInput}>
              <Text style={dynamicStyles.calcRupee}>₹</Text>
              <TextInput
                style={dynamicStyles.calcInputField}
                value={investAmount}
                onChangeText={setInvestAmount}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={dynamicStyles.calcQuick}>
              {[500, 1000, 5000, 10000].map(a => (
                <TouchableOpacity key={a} style={[dynamicStyles.calcQuickBtn, investAmount === a.toString() && dynamicStyles.calcQuickBtnActive]} onPress={() => setInvestAmount(a.toString())}>
                  <Text style={[dynamicStyles.calcQuickText, investAmount === a.toString() && { color: colors.emerald }]}>₹{a >= 1000 ? `${a/1000}K` : a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={dynamicStyles.calcResults}>
              <View style={dynamicStyles.calcResult}>
                <Text style={dynamicStyles.calcResultLabel}>Your Investment</Text>
                <Text style={dynamicStyles.calcResultVal}>₹{parseInt(investAmount || '0').toLocaleString('en-IN')}</Text>
              </View>
              <View style={dynamicStyles.calcResult}>
                <Text style={dynamicStyles.calcResultLabel}>Expected Return (p.a.)</Text>
                <Text style={[dynamicStyles.calcResultVal, { color: colors.emerald }]}>+₹{expectedReturn.toLocaleString('en-IN')}</Text>
              </View>
              <LinearGradient colors={colors.gradientCard} style={dynamicStyles.calcResultTotal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={dynamicStyles.calcResultBorder}>
                  <Text style={dynamicStyles.calcResultLabel}>Total Value (1 Year)</Text>
                  <Text style={[dynamicStyles.calcResultVal, { color: colors.emerald, fontSize: 20 }]}>₹{totalReturn.toLocaleString('en-IN')}</Text>
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* Location & Amenities */}
          <View style={dynamicStyles.amenitiesCard}>
            <Text style={dynamicStyles.sectionTitle}>Location & Amenities</Text>
            <TouchableOpacity style={dynamicStyles.mapPlaceholder} onPress={handleOpenMap} activeOpacity={0.8}>
              <MapPin size={32} color={colors.emerald} />
              <Text style={dynamicStyles.mapText}>{project.location}</Text>
              <Text style={dynamicStyles.mapSub}>Tap to view on Maps</Text>
            </TouchableOpacity>
            {project.amenities.map(a => (
              <View key={a.name} style={dynamicStyles.amenityItem}>
                <View style={dynamicStyles.amenityIcon}>{getAmenityIcon(a.type, colors)}</View>
                <Text style={dynamicStyles.amenityName}>{a.name}</Text>
                <Text style={dynamicStyles.amenityDist}>{a.distance}</Text>
              </View>
            ))}
          </View>

          {/* Documents */}
          <View style={dynamicStyles.docsCard}>
            <Text style={dynamicStyles.sectionTitle}>Legal Documents</Text>
            {project.documents.map(doc => (
              <View key={doc.name} style={dynamicStyles.docItem}>
                <FileText size={16} color={doc.status === 'Verified' ? colors.emerald : colors.warning} />
                <Text style={dynamicStyles.docName}>{doc.name}</Text>
                <View style={[dynamicStyles.docStatus, { backgroundColor: doc.status === 'Verified' ? colors.emeraldGlow : 'rgba(245,158,11,0.12)' }]}>
                  <Text style={[dynamicStyles.docStatusText, { color: doc.status === 'Verified' ? colors.emerald : colors.warning }]}>
                    {doc.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Risk Analysis */}
          <View style={dynamicStyles.riskCard}>
            <View style={dynamicStyles.riskHeader}>
              <AlertCircle size={16} color={riskColors[project.risk_score]} />
              <Text style={dynamicStyles.sectionTitle}>Risk Analysis</Text>
            </View>
            <View style={[dynamicStyles.riskBadgeLarge, { borderColor: riskColors[project.risk_score] + '44', backgroundColor: riskColors[project.risk_score] + '11' }]}>
              <Text style={[dynamicStyles.riskBadgeText, { color: riskColors[project.risk_score] }]}>{project.risk_score} Risk</Text>
            </View>
            <Text style={dynamicStyles.riskDesc}>
              This investment has been assessed as {project.risk_score.toLowerCase()} risk based on government approvals, document verification, location potential, and market conditions.
            </Text>
          </View>

          {/* FAQs */}
          <View style={dynamicStyles.faqCard}>
            <Text style={dynamicStyles.sectionTitle}>FAQs</Text>
            {faqs.map((faq, i) => (
              <View key={i} style={dynamicStyles.faqItem}>
                <TouchableOpacity style={dynamicStyles.faqQuestion} onPress={() => setOpenFaq(openFaq === i ? null : i)}>
                  <Text style={dynamicStyles.faqQ}>{faq.q}</Text>
                  {openFaq === i ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
                </TouchableOpacity>
                {openFaq === i && (
                  <Text style={dynamicStyles.faqA}>{faq.a}</Text>
                )}
                {i < faqs.length - 1 && <View style={dynamicStyles.faqDivider} />}
              </View>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={dynamicStyles.bottomBar}>
        {userInvestment ? (
          <>
            <View style={dynamicStyles.bottomLeft}>
              <Text style={dynamicStyles.bottomLabel}>Your Investment</Text>
              <Text style={dynamicStyles.bottomValue}>₹{userInvestment.amount.toLocaleString('en-IN')}</Text>
            </View>
            <View style={dynamicStyles.bottomBtnRow}>
              <TouchableOpacity style={dynamicStyles.addMoneyBtn} onPress={() => { setAddError(null); setShowAddMoneyModal(true); }} activeOpacity={0.85}>
                <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={dynamicStyles.addMoneyBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Plus size={14} color="#fff" />
                  <Text style={dynamicStyles.addMoneyBtnText}>Add Money</Text>
                </LinearGradient>
              </TouchableOpacity>
              {isInvestmentLocked(userInvestment) ? (
                <TouchableOpacity style={dynamicStyles.closeBtnLocked} activeOpacity={0.85} onPress={() => { setCloseError(null); setCloseSuccess(null); setShowCloseModal(true); }}>
                  <View style={dynamicStyles.closeBtnLockedInner}>
                    <Lock size={14} color={colors.textMuted} />
                    <Text style={dynamicStyles.closeBtnLockedText}>Close</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={dynamicStyles.closeBtn} onPress={() => { setCloseError(null); setCloseSuccess(null); setShowCloseModal(true); }} activeOpacity={0.85}>
                  <LinearGradient colors={['#EF4444', '#B91C1C']} style={dynamicStyles.closeBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <LogOut size={14} color="#fff" />
                    <Text style={dynamicStyles.closeBtnText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <>
            <View style={dynamicStyles.bottomLeft}>
              <Text style={dynamicStyles.bottomLabel}>{project.funding_progress >= 100 ? 'Status' : 'Min. Investment'}</Text>
              <Text style={[
                dynamicStyles.bottomValue,
                project.funding_progress >= 100 && { color: colors.success }
              ]}>
                {project.funding_progress >= 100 ? 'Fully Funded' : `₹${project.min_investment.toLocaleString('en-IN')}`}
              </Text>
            </View>
            <TouchableOpacity
              style={[dynamicStyles.investBtn, project.funding_progress >= 100 && { opacity: 0.7 }]}
              onPress={() => project.funding_progress < 100 && setShowInvestModal(true)}
              disabled={project.funding_progress >= 100}
            >
              <LinearGradient
                colors={project.funding_progress >= 100 ? [colors.textMuted, colors.textDisabled] : colors.gradientGreen}
                style={dynamicStyles.investBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={dynamicStyles.investBtnText}>
                  {project.funding_progress >= 100 ? 'Sold Out' : 'Invest Now'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Investment Modal */}
      <Modal visible={showInvestModal} transparent animationType="slide">
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modal}>
            {showSuccess ? (
              <View style={dynamicStyles.successState}>
                <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.successCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Check size={36} color="#fff" />
                </LinearGradient>
                <Text style={dynamicStyles.successTitle}>Investment Confirmed!</Text>
                <Text style={dynamicStyles.successSub}>
                  ₹{parseInt(investAmount || '0').toLocaleString('en-IN')} invested in {project.name}
                </Text>
                <Text style={dynamicStyles.successNote}>Your digital agreement has been generated. Check Portfolio for details.</Text>
              </View>
            ) : (
              <>
                <View style={dynamicStyles.modalHeader}>
                  <Text style={dynamicStyles.modalTitle}>Invest in {project.name}</Text>
                  <TouchableOpacity onPress={() => { setShowInvestModal(false); setInvestError(null); }} disabled={investing}>
                    <X size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={dynamicStyles.modalProject}>
                  <MapPin size={13} color={colors.textMuted} />
                  <Text style={dynamicStyles.modalProjectLoc}>{project.location}</Text>
                  <View style={dynamicStyles.roiChip}>
                    <TrendingUp size={11} color={colors.emerald} />
                    <Text style={dynamicStyles.roiChipText}>{project.expected_roi}% ROI</Text>
                  </View>
                </View>

                <Text style={dynamicStyles.modalSectionLabel}>Investment Amount</Text>
                <View style={dynamicStyles.amtInput}>
                  <Text style={dynamicStyles.amtRupee}>₹</Text>
                  <TextInput
                    style={dynamicStyles.amtField}
                    value={investAmount}
                    onChangeText={setInvestAmount}
                    keyboardType="numeric"
                    autoFocus
                    editable={!investing}
                  />
                </View>

                <View style={dynamicStyles.quickBtns}>
                  {[500, 1000, 5000, 10000, 25000].map(a => (
                    <TouchableOpacity key={a} style={[dynamicStyles.quickBtn, investAmount === a.toString() && dynamicStyles.quickBtnActive]} onPress={() => setInvestAmount(a.toString())} disabled={investing}>
                      <Text style={[dynamicStyles.quickBtnText, investAmount === a.toString() && { color: colors.emerald }]}>₹{a >= 1000 ? `${a/1000}K` : a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={dynamicStyles.summaryCard}>
                  <View style={dynamicStyles.summaryRow}>
                    <Text style={dynamicStyles.summaryLabel}>You Invest</Text>
                    <Text style={dynamicStyles.summaryVal}>₹{parseInt(investAmount || '0').toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={dynamicStyles.summaryRow}>
                    <Text style={dynamicStyles.summaryLabel}>Expected Annual Return</Text>
                    <Text style={[dynamicStyles.summaryVal, { color: colors.emerald }]}>+₹{expectedReturn.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={dynamicStyles.summaryRow}>
                    <Text style={dynamicStyles.summaryLabel}>Wallet Balance After</Text>
                    <Text style={dynamicStyles.summaryVal}>₹{((profile?.wallet_balance ?? 0) - parseInt(investAmount || '0')).toLocaleString('en-IN')}</Text>
                  </View>
                </View>

                {investError && (
                  <View style={dynamicStyles.investErrorBanner}>
                    <AlertCircle size={14} color={colors.error} />
                    <Text style={dynamicStyles.investErrorText}>{investError}</Text>
                  </View>
                )}

                <Text style={dynamicStyles.investDisclaimer}>
                  By investing, you agree to the Digital Investment Agreement and InvestLand T&Cs. Investments are subject to market risk.
                </Text>

                <TouchableOpacity style={dynamicStyles.confirmInvestBtn} onPress={handleInvest} disabled={investing}>
                  <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.confirmInvestGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {investing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={dynamicStyles.confirmInvestText}>Confirm & Invest</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Close Investment Modal */}
      <Modal visible={showCloseModal} transparent animationType="slide" onRequestClose={closeCloseModal}>
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modal}>
            {closeSuccess ? (
              <View style={dynamicStyles.successState}>
                <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.successCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Check size={36} color="#fff" />
                </LinearGradient>
                <Text style={dynamicStyles.successTitle}>Investment Closed!</Text>
                <Text style={dynamicStyles.successSub}>
                  ₹{closeSuccess.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} credited to your wallet
                </Text>
                <Text style={dynamicStyles.successNote}>The amount has been added to your InvestLand wallet. Check your Portfolio History for details.</Text>
              </View>
            ) : userInvestment ? (
              <>
                <View style={dynamicStyles.modalHeader}>
                  <Text style={dynamicStyles.modalTitle}>Close Investment</Text>
                  <TouchableOpacity onPress={closeCloseModal} disabled={closing}>
                    <X size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={dynamicStyles.modalProject}>
                  <MapPin size={13} color={colors.textMuted} />
                  <Text style={dynamicStyles.modalProjectLoc}>{project.location}</Text>
                  <View style={dynamicStyles.roiChip}>
                    <TrendingUp size={11} color={colors.emerald} />
                    <Text style={dynamicStyles.roiChipText}>{userInvestment.roi_rate}% ROI</Text>
                  </View>
                </View>

                {closeError && (
                  <View style={dynamicStyles.investErrorBanner}>
                    <AlertCircle size={14} color={colors.error} />
                    <Text style={dynamicStyles.investErrorText}>{closeError}</Text>
                  </View>
                )}

                {(() => {
                  const currentVal = computeCurrentValue(userInvestment.amount, userInvestment.roi_rate, userInvestment.created_at);
                  const returns = currentVal - userInvestment.amount;
                  const returnsPct = (returns / userInvestment.amount) * 100;
                  const exitChargePct = userInvestment.exit_charge_pct ?? 1.0;
                  const exitCharge = Math.round(currentVal * (exitChargePct / 100) * 100) / 100;
                  const finalAmount = Math.round((currentVal - exitCharge) * 100) / 100;
                  const locked = isInvestmentLocked(userInvestment);

                  return (
                    <>
                      <View style={dynamicStyles.summaryCard}>
                        <View style={dynamicStyles.summaryRow}>
                          <Text style={dynamicStyles.summaryLabel}>Invested Amount</Text>
                          <Text style={dynamicStyles.summaryVal}>₹{userInvestment.amount.toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={dynamicStyles.summaryRow}>
                          <Text style={dynamicStyles.summaryLabel}>Current Value</Text>
                          <Text style={dynamicStyles.summaryVal}>₹{Math.round(currentVal).toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={dynamicStyles.summaryRow}>
                          <Text style={dynamicStyles.summaryLabel}>Profit / Loss</Text>
                          <Text style={[dynamicStyles.summaryVal, { color: returns >= 0 ? colors.emerald : colors.error }]}>
                            {returns >= 0 ? '+' : ''}₹{Math.round(Math.abs(returns)).toLocaleString('en-IN')} ({returnsPct.toFixed(2)}%)
                          </Text>
                        </View>
                        <View style={dynamicStyles.summaryRow}>
                          <Text style={dynamicStyles.summaryLabel}>Exit Charge ({exitChargePct}%)</Text>
                          <Text style={[dynamicStyles.summaryVal, { color: colors.warning }]}>-₹{exitCharge.toLocaleString('en-IN')}</Text>
                        </View>
                      </View>

                      {locked && (
                        <View style={dynamicStyles.closeLockBanner}>
                          <Lock size={14} color={colors.warning} />
                          <Text style={dynamicStyles.closeLockText}>
                            You can close this investment after 24 hours from the time of investment.
                          </Text>
                        </View>
                      )}

                      <LinearGradient colors={colors.gradientCard} style={dynamicStyles.closePayoutCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <View style={dynamicStyles.closePayoutBorder}>
                          <Text style={dynamicStyles.closePayoutLabel}>Final Amount Credited</Text>
                          <Text style={dynamicStyles.closePayoutAmount}>₹{finalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                          <Text style={dynamicStyles.closePayoutSub}>To your InvestLand Wallet</Text>
                        </View>
                      </LinearGradient>

                      <Text style={dynamicStyles.investDisclaimer}>
                        By confirming, you agree to close this investment. The final amount will be credited to your wallet instantly. This action cannot be undone.
                      </Text>

                      <View style={dynamicStyles.closeActions}>
                        <TouchableOpacity style={dynamicStyles.closeCancelBtn} onPress={closeCloseModal} disabled={closing}>
                          <Text style={dynamicStyles.closeCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[dynamicStyles.confirmInvestBtn, (closing || locked) && { opacity: 0.5 }]}
                          onPress={handleCloseInvestment}
                          disabled={closing || locked}
                        >
                          <LinearGradient colors={['#EF4444', '#B91C1C']} style={dynamicStyles.confirmInvestGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            {closing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dynamicStyles.confirmInvestText}>Confirm & Close</Text>}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </>
                  );
                })()}
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Add Money Modal */}
      <Modal visible={showAddMoneyModal} transparent animationType="slide" onRequestClose={closeAddMoneyModal}>
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modal}>
            {addSuccess ? (
              <View style={dynamicStyles.successState}>
                <LinearGradient colors={colors.gradientGreen} style={dynamicStyles.successCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Check size={36} color="#fff" />
                </LinearGradient>
                <Text style={dynamicStyles.successTitle}>Money Added!</Text>
                <Text style={dynamicStyles.successSub}>
                  ₹{parseInt(addAmount || '0').toLocaleString('en-IN')} added to your investment
                </Text>
                <Text style={dynamicStyles.successNote}>Your investment has been updated. Check Portfolio for details.</Text>
              </View>
            ) : (
              <>
                <View style={dynamicStyles.modalHeader}>
                  <Text style={dynamicStyles.modalTitle}>Add Money</Text>
                  <TouchableOpacity onPress={closeAddMoneyModal} disabled={adding}>
                    <X size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={dynamicStyles.modalProject}>
                  <MapPin size={13} color={colors.textMuted} />
                  <Text style={dynamicStyles.modalProjectLoc}>{project.location}</Text>
                  <View style={dynamicStyles.roiChip}>
                    <TrendingUp size={11} color={colors.emerald} />
                    <Text style={dynamicStyles.roiChipText}>{userInvestment?.roi_rate ?? project.expected_roi}% ROI</Text>
                  </View>
                </View>

                {addError && (
                  <View style={dynamicStyles.investErrorBanner}>
                    <AlertCircle size={14} color={colors.error} />
                    <Text style={dynamicStyles.investErrorText}>{addError}</Text>
                  </View>
                )}

                <Text style={dynamicStyles.modalSectionLabel}>Add Amount</Text>
                <View style={dynamicStyles.amtInput}>
                  <Text style={dynamicStyles.amtRupee}>₹</Text>
                  <TextInput
                    style={dynamicStyles.amtField}
                    value={addAmount}
                    onChangeText={setAddAmount}
                    keyboardType="numeric"
                    autoFocus
                    editable={!adding}
                  />
                </View>

                <View style={dynamicStyles.quickBtns}>
                  {[500, 1000, 5000, 10000, 25000].map(a => (
                    <TouchableOpacity key={a} style={[dynamicStyles.quickBtn, addAmount === a.toString() && dynamicStyles.quickBtnActive]} onPress={() => setAddAmount(a.toString())} disabled={adding}>
                      <Text style={[dynamicStyles.quickBtnText, addAmount === a.toString() && { color: colors.emerald }]}>₹{a >= 1000 ? `${a/1000}K` : a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={dynamicStyles.summaryCard}>
                  <View style={dynamicStyles.summaryRow}>
                    <Text style={dynamicStyles.summaryLabel}>Current Investment</Text>
                    <Text style={dynamicStyles.summaryVal}>₹{(userInvestment?.amount ?? 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={dynamicStyles.summaryRow}>
                    <Text style={dynamicStyles.summaryLabel}>Adding</Text>
                    <Text style={[dynamicStyles.summaryVal, { color: '#3B82F6' }]}>+₹{parseInt(addAmount || '0').toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={dynamicStyles.summaryRow}>
                    <Text style={dynamicStyles.summaryLabel}>New Total</Text>
                    <Text style={dynamicStyles.summaryVal}>₹{((userInvestment?.amount ?? 0) + parseInt(addAmount || '0')).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={dynamicStyles.summaryRow}>
                    <Text style={dynamicStyles.summaryLabel}>Wallet Balance After</Text>
                    <Text style={dynamicStyles.summaryVal}>₹{((profile?.wallet_balance ?? 0) - parseInt(addAmount || '0')).toLocaleString('en-IN')}</Text>
                  </View>
                </View>

                <Text style={dynamicStyles.investDisclaimer}>
                  The amount will be deducted from your wallet and added to this investment immediately.
                </Text>

                <View style={dynamicStyles.closeActions}>
                  <TouchableOpacity style={dynamicStyles.closeCancelBtn} onPress={closeAddMoneyModal} disabled={adding}>
                    <Text style={dynamicStyles.closeCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[dynamicStyles.confirmInvestBtn, adding && { opacity: 0.5 }]}
                    onPress={handleAddMoney}
                    disabled={adding}
                  >
                    <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={dynamicStyles.confirmInvestGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      {adding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={dynamicStyles.confirmInvestText}>Add Money</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getDynamicStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    backBtnSimple: { position: 'absolute', top: 56, left: 20, zIndex: 10 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: colors.textMuted, fontSize: 13 },
    errorText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.emeraldGlow, borderWidth: 1, borderColor: colors.emerald + '44' },
    retryText: { color: colors.emerald, fontSize: 14, fontWeight: '700' },
    imageGallery: { position: 'relative', height: 300 },
    mainImage: { width: '100%', height: '100%' },
    imageTopGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
    imageBottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
    backBtn: {
      position: 'absolute',
      top: 52,
      left: 16,
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    thumbnails: { position: 'absolute', bottom: 44, left: 16, flexDirection: 'row', gap: 6 },
    thumbnail: { width: 44, height: 32, borderRadius: 6, borderWidth: 1, borderColor: 'transparent' },
    thumbnailActive: { borderColor: colors.emerald, borderWidth: 2 },
    imageBottomRow: { position: 'absolute', bottom: 12, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
    categoryTag: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    categoryText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
    riskTag: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
    riskText: { fontSize: 11, fontWeight: '700' },
    content: { padding: 20 },
    titleSection: { marginBottom: 16 },
    projectName: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
    locationText: { color: colors.textMuted, fontSize: 13 },
    badgesRow: { flexDirection: 'row', gap: 8 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.emeraldGlow,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: colors.emerald + '33',
    },
    badgeBlue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(96,165,250,0.12)',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: 'rgba(96,165,250,0.3)',
    },
    badgeText: { color: colors.emerald, fontSize: 11, fontWeight: '600' },
    statsCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
    },
    statsRow: { flexDirection: 'row', alignItems: 'center' },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { width: 1, height: 32, backgroundColor: colors.border },
    statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
    statValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '800', textAlign: 'center' },
    statsDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
    fundingCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
    },
    fundingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 12 },
    fundingPercent: { color: colors.emerald, fontSize: 16, fontWeight: '800' },
    progressBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: '100%', borderRadius: 4 },
    fundingDetails: { flexDirection: 'row', justifyContent: 'space-between' },
    fundingDetail: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
    descCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
    },
    descText: { color: colors.textSecondary, fontSize: 13, lineHeight: 21, marginBottom: 14 },
    highlightsList: { gap: 8 },
    highlightItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    highlightText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
    calcCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
    },
    calcInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgInput,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 10,
      gap: 6,
    },
    calcRupee: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
    calcInputField: { flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
    calcQuick: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
    calcQuickBtn: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    calcQuickBtnActive: { borderColor: colors.emerald, backgroundColor: colors.emeraldGlow },
    calcQuickText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    calcResults: { gap: 8 },
    calcResult: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    calcResultLabel: { color: colors.textMuted, fontSize: 12 },
    calcResultVal: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
    calcResultTotal: { borderRadius: 12, overflow: 'hidden' },
    calcResultBorder: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.emerald + '22',
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    amenitiesCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
    },
    mapPlaceholder: {
      height: 100,
      backgroundColor: colors.bgCard2,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mapText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
    mapSub: { color: colors.textMuted, fontSize: 11 },
    amenityItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
    amenityIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.bgCard2, alignItems: 'center', justifyContent: 'center' },
    amenityName: { flex: 1, color: colors.textSecondary, fontSize: 13 },
    amenityDist: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    docsCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
    },
    docItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
    docName: { flex: 1, color: colors.textSecondary, fontSize: 13 },
    docStatus: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    docStatusText: { fontSize: 11, fontWeight: '700' },
    riskCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
    },
    riskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    riskBadgeLarge: { alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 10 },
    riskBadgeText: { fontSize: 13, fontWeight: '700' },
    riskDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
    faqCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 14,
    },
    faqItem: {},
    faqQuestion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
    faqQ: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 20 },
    faqA: { color: colors.textSecondary, fontSize: 12, lineHeight: 19, paddingBottom: 10 },
    faqDivider: { height: 1, backgroundColor: colors.border },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: colors.bgCard,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 20,
      paddingVertical: 14,
      paddingBottom: 28,
    },
    bottomLeft: { flex: 1 },
    bottomLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
    bottomValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
    bottomBtnRow: { flex: 2, flexDirection: 'row', gap: 10 },
    addMoneyBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
    addMoneyBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    addMoneyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    closeBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
    closeBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    closeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    closeBtnLocked: { flex: 1, borderRadius: 14, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
    closeBtnLockedInner: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    closeBtnLockedText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    investBtn: { flex: 2, borderRadius: 14, overflow: 'hidden' },
    investBtnGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    investBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modal: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomWidth: 0,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', flex: 1 },
    modalProject: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
    modalProjectLoc: { color: colors.textMuted, fontSize: 12, flex: 1 },
    roiChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.emeraldGlow,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    roiChipText: { color: colors.emerald, fontSize: 10, fontWeight: '700' },
    modalSectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
    amtInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgInput,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 12,
      gap: 6,
    },
    amtRupee: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
    amtField: { flex: 1, color: colors.textPrimary, fontSize: 26, fontWeight: '800' },
    quickBtns: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
    quickBtn: { borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: 12, paddingVertical: 7 },
    quickBtnActive: { borderColor: colors.emerald, backgroundColor: colors.emeraldGlow },
    quickBtnText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    summaryCard: {
      backgroundColor: colors.bg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
      marginBottom: 14,
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { color: colors.textMuted, fontSize: 12 },
    summaryVal: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    investErrorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(239,68,68,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.3)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 14,
    },
    investErrorText: { color: colors.error, fontSize: 12, fontWeight: '600', flex: 1 },
    investDisclaimer: { color: colors.textMuted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginBottom: 14 },
    confirmInvestBtn: { borderRadius: 14, overflow: 'hidden' },
    confirmInvestGrad: { paddingVertical: 16, alignItems: 'center' },
    confirmInvestText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    successState: { alignItems: 'center', paddingVertical: 20 },
    successCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    successTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', marginBottom: 6 },
    successSub: { color: colors.emerald, fontSize: 14, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
    successNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
    closeLockBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', marginBottom: 14,
    },
    closeLockText: { color: colors.warning, fontSize: 12, flex: 1, lineHeight: 17 },
    closePayoutCard: { borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
    closePayoutBorder: { borderRadius: 14, borderWidth: 1, borderColor: colors.emerald + '22', padding: 16, alignItems: 'center' },
    closePayoutLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    closePayoutAmount: { color: colors.emerald, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
    closePayoutSub: { color: colors.textMuted, fontSize: 11 },
    closeActions: { flexDirection: 'row', gap: 12 },
    closeCancelBtn: {
      flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
      backgroundColor: colors.bgCard2, borderWidth: 1, borderColor: colors.border,
    },
    closeCancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
  });
}
