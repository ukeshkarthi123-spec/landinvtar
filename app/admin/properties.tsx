import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, Image, RefreshControl, ScrollView, Modal,
  TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import {
  Landmark, Plus, Edit2, Trash2, CheckCircle2, XCircle,
  MapPin, TrendingUp, Layers, Info, X, Camera, Save
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { LandProject } from '@/types/database';
import { decode } from 'base64-arraybuffer';

const CATEGORIES = ['Residential', 'Commercial', 'Farm Land', 'Industrial', 'Luxury Villas'];

export default function PropertyManagement() {
  const { colors, isDark } = useTheme();
  const [properties, setProperties] = useState<LandProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<LandProject | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<LandProject>>({
    name: '',
    location: '',
    city: '',
    state: '',
    category: 'Residential',
    expected_roi: 18,
    min_investment: 500,
    total_funding: 1000000,
    raised_funding: 0,
    total_area: '',
    timeline: '',
    image: '',
    is_active: true,
    description: ''
  });

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('land_projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProperties((data || []) as LandProject[]);
    } catch (error: any) {
      console.error('Error fetching properties:', error);
      Alert.alert('Error', 'Failed to fetch properties');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const handleOpenModal = (property: LandProject | null = null) => {
    if (property) {
      setEditingProperty(property);
      setFormData(property);
    } else {
      setEditingProperty(null);
      setFormData({
        name: '',
        location: '',
        city: '',
        state: '',
        category: 'Residential',
        expected_roi: 18,
        min_investment: 500,
        total_funding: 1000000,
        raised_funding: 0,
        total_area: '',
        timeline: '',
        image: '',
        is_active: true,
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      base64: true
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
          setSubmitting(true);
          try {
              const bucketName = 'project-images';
              const fileName = `${Date.now()}.jpg`;
              const filePath = `projects/${fileName}`;
              const { error: uploadError } = await supabase.storage
                  .from(bucketName)
                  .upload(filePath, decode(asset.base64), {
                    contentType: 'image/jpeg',
                    upsert: true
                  });

              if (uploadError) {
                  console.log('Bucket Name:', bucketName);
                  console.log('Upload Path:', filePath);
                  console.log('Storage Error:', uploadError);
                  throw uploadError;
              }

              const { data: { publicUrl } } = supabase.storage
                  .from(bucketName)
                  .getPublicUrl(filePath);

              setFormData({ ...formData, image: publicUrl });
          } catch (err: any) {
              Alert.alert('Upload Error', err.message);
          } finally {
              setSubmitting(false);
          }
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.location || !formData.image) {
      Alert.alert('Missing Fields', 'Please fill in name, location and image.');
      return;
    }

    setSubmitting(true);
    try {
      const progress = Math.min(100, Math.round(((formData.raised_funding || 0) / (formData.total_funding || 1)) * 100));
      const payload = {
        ...formData,
        funding_progress: progress,
        updated_at: new Date().toISOString()
      };

      if (editingProperty) {
        const { error } = await supabase
          .from('land_projects')
          .update(payload)
          .eq('id', editingProperty.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('land_projects')
          .insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchProperties();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('land_projects')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      fetchProperties();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('land_projects').delete().eq('id', id);
            if (error) Alert.alert('Error', error.message);
            else fetchProperties();
          }
        }
      ]
    );
  };

  const renderProperty = ({ item }: { item: LandProject }) => (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <Image source={{ uri: item.image }} style={styles.image} />
        <View style={styles.badgeContainer}>
           <View style={[styles.statusBadge, { backgroundColor: item.is_active ? colors.emeraldGlow : 'rgba(239,68,68,0.1)' }]}>
             <Text style={[styles.statusText, { color: item.is_active ? colors.success : colors.error }]}>
               {item.is_active ? 'ACTIVE' : 'INACTIVE'}
             </Text>
           </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
        <View style={styles.locRow}>
          <MapPin size={12} color={colors.textMuted} />
          <Text style={[styles.location, { color: colors.textSecondary }]}>{item.location}, {item.city}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <TrendingUp size={14} color={colors.emerald} />
            <Text style={[styles.statVal, { color: colors.textPrimary }]}>{item.expected_roi}%</Text>
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>ROI</Text>
          </View>
          <View style={styles.stat}>
            <Layers size={14} color="#3B82F6" />
            <Text style={[styles.statVal, { color: colors.textPrimary }]}>{item.total_area}</Text>
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>Area</Text>
          </View>
          <View style={styles.stat}>
            <Landmark size={14} color="#F59E0B" />
            <Text style={[styles.statVal, { color: colors.textPrimary }]}>{item.funding_progress}%</Text>
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>Funded</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.bgInput }]}
            onPress={() => handleOpenModal(item)}
          >
            <Edit2 size={16} color={colors.textPrimary} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: item.is_active ? 'rgba(239,68,68,0.1)' : colors.emeraldGlow }]}
            onPress={() => toggleStatus(item.id, item.is_active)}
          >
            {item.is_active ? <XCircle size={16} color={colors.error} /> : <CheckCircle2 size={16} color={colors.emerald} />}
            <Text style={[styles.actionBtnText, { color: item.is_active ? colors.error : colors.emerald }]}>
              {item.is_active ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.05)', maxWidth: 50 }]}
            onPress={() => handleDelete(item.id)}
          >
            <Trash2 size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {loading && !refreshing ? (
        <ActivityIndicator style={styles.loader} color={colors.emerald} size="large" />
      ) : (
        <FlatList
          data={properties}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderProperty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProperties(); }} tintColor={colors.emerald} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ color: colors.textMuted }}>No properties found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.emerald }]}
        onPress={() => handleOpenModal()}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={isModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingProperty ? 'Edit Project' : 'New Project'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {formData.image ? (
                  <Image source={{ uri: formData.image }} style={styles.formImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera size={32} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, marginTop: 8 }}>Upload Project Image</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Project Name</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={formData.name}
                  onChangeText={t => setFormData({ ...formData, name: t })}
                  placeholder="E.g. Emerald Heights"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {CATEGORIES.map(c => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setFormData({ ...formData, category: c })}
                        style={[
                          styles.categoryChip,
                          { borderColor: colors.border },
                          formData.category === c && { backgroundColor: colors.emerald, borderColor: colors.emerald }
                        ]}
                      >
                        <Text style={[styles.chipText, formData.category === c && { color: '#fff' }]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Location</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={formData.location}
                  onChangeText={t => setFormData({ ...formData, location: t })}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                    value={formData.city}
                    onChangeText={t => setFormData({ ...formData, city: t })}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>State</Text>
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                    value={formData.state}
                    onChangeText={t => setFormData({ ...formData, state: t })}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>ROI (%)</Text>
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                    value={formData.expected_roi?.toString()}
                    onChangeText={t => setFormData({ ...formData, expected_roi: parseFloat(t) || 0 })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Min Invest</Text>
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                    value={formData.min_investment?.toString()}
                    onChangeText={t => setFormData({ ...formData, min_investment: parseInt(t) || 0 })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, height: 100 }]}
                  value={formData.description}
                  onChangeText={t => setFormData({ ...formData, description: t })}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.emerald }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Save size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Project</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={{ height: 100 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 100 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  cardTop: { height: 160, position: 'relative' },
  image: { width: '100%', height: '100%' },
  badgeContainer: { position: 'absolute', top: 12, right: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800' },
  cardBody: { padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  location: { fontSize: 13 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: 2 },
  statVal: { fontSize: 14, fontWeight: '700' },
  statLbl: { fontSize: 10 },
  divider: { height: 1, backgroundColor: '#000', opacity: 0.1, marginVertical: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12 },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  empty: { padding: 40, alignItems: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: '90%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalForm: { flex: 1 },
  imagePicker: { height: 180, borderRadius: 20, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#ccc' },
  formImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, opacity: 0.6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', marginBottom: 16 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: '600' },
  saveBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});
