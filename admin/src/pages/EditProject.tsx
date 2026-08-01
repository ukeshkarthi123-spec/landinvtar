import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Image as ImageIcon,
  MapPin, Info, FileText, IndianRupee, Trash2, Plus,
  LayoutGrid, AlertCircle, FileUp, ExternalLink, File
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { LandProject } from '../types/project';
import { SectionHeader } from '../components/SectionHeader';
import StarRating from '../components/StarRating';
import clsx from 'clsx';

const TABS = [
  { id: 'general', label: 'General Info', icon: Info },
  { id: 'investment', label: 'Investment', icon: IndianRupee },
  { id: 'media', label: 'Media & Gallery', icon: ImageIcon },
  { id: 'location', label: 'Location/Map', icon: MapPin },
  { id: 'documents', label: 'Legal Documents', icon: FileText },
];

const CATEGORIES = ['Residential', 'Commercial', 'Farm Land', 'Industrial', 'Luxury Villas'];

interface ProjectDocument {
  name: string;
  url: string;
  type: string;
  uploaded_at: string;
}

const EditProject = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState(false);

  const [formData, setFormData] = useState<Partial<LandProject>>({
    name: '',
    description: '',
    location: '',
    city: '',
    state: '',
    latitude: null,
    longitude: null,
    min_investment: 500,
    expected_roi: 18,
    duration: '18-24 Months',
    funding_goal: 10000000,
    raised_funding: 0,
    is_active: true,
    cover_image: '',
    gallery_images: [],
    rating: 5.0,
    category: 'Residential',
    risk_score: 'Low',
    total_area: '',
    highlights: [],
    amenities: [],
    documents: [],
    appreciation_rate: 0,
    investors_count: 0,
    is_govt_approved: true,
    is_verified: true
  });

  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEdit) fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('land_projects')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const p = data as any;
      setFormData({
        id: p.id,
        name: p.name || '',
        location: p.location || '',
        state: p.state || '',
        city: p.city || '',
        total_area: p.total_area || '',
        min_investment: Number(p.min_investment || 0),
        expected_roi: Number(p.expected_roi || 0),
        funding_progress: Number(p.funding_progress || 0),
        total_funding: Number(p.total_funding || 0),
        raised_funding: Number(p.raised_funding || 0),
        investors_count: Number(p.investors_count || 0),
        risk_score: p.risk_score || 'Low',
        category: p.category || 'Residential',
        is_govt_approved: !!p.is_govt_approved,
        is_verified: !!p.is_verified,
        timeline: p.timeline || '',
        description: p.description || '',
        highlights: p.highlights || [],
        amenities: p.amenities || [],
        documents: p.documents || [],
        lat: p.lat,
        lng: p.lng,
        appreciation_rate: Number(p.appreciation_rate || 0),
        is_active: p.is_active ?? true,
        rating: Number(p.rating ?? 5.0),
        duration: p.duration || '',
        cover_image: p.cover_image || p.image || '',
        funding_goal: Number(p.funding_goal || 0),
        gallery_images: p.gallery_images || p.images || [],
        latitude: p.latitude,
        longitude: p.longitude
      });
    } catch (err: any) {
      handleSupabaseError(err, 'load project');
    } finally {
      setLoading(false);
    }
  };

  const handleSupabaseError = (err: any, action: string) => {
    console.error(`[EditProject] Error during ${action}:`, err);
    const msg = err.message || 'Unknown error';
    setError(`Synchronization failed during ${action}: ${msg}`);
    if (msg.includes('schema cache')) setSchemaError(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let val: any = value;
    if (type === 'number') val = value === '' ? null : parseFloat(value);
    if (type === 'checkbox') val = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'cover_image' | 'gallery_images' | 'documents') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSubmitting(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('Authentication required. Please log in to upload documents.');
      }

      const bucket = 'project-documents';
      const uploadedItems: any[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}${Date.now()}.${fileExt}`;
        const filePath = `${field}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        if (field === 'documents') {
          uploadedItems.push({
            name: file.name,
            url: publicUrl,
            type: file.type || 'application/octet-stream',
            uploaded_at: new Date().toISOString()
          });
        } else {
          uploadedItems.push(publicUrl);
        }
      }

      if (field === 'gallery_images') {
        setFormData(prev => ({
          ...prev,
          gallery_images: [...(prev.gallery_images || []), ...uploadedItems]
        }));
      } else if (field === 'documents') {
        setFormData(prev => ({
          ...prev,
          documents: [...(prev.documents || []), ...uploadedItems]
        }));
      } else {
        setFormData(prev => ({ ...prev, [field]: uploadedItems[0] }));
      }
    } catch (err: any) {
      let msg = err.message;
      if (msg === 'Bucket not found' || msg?.includes('bucket')) {
        msg = `Supabase Storage bucket 'project-documents' does not exist. Create it in Storage.`;
      }
      alert('Upload failed: ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const removeGalleryImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      gallery_images: prev.gallery_images?.filter((_, i) => i !== index)
    }));
  };

  const removeDocument = (index: number) => {
    setFormData(prev => ({
      ...prev,
      documents: (prev.documents as any[])?.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSchemaError(false);

    if (!formData.name || !formData.location) {
      alert('Project Name and Location are required');
      return;
    }

    setSubmitting(true);
    try {
      const progress = Math.min(100, Math.round(((formData.raised_funding || 0) / (formData.funding_goal || 1)) * 100));

      const payload = {
        name: formData.name,
        location: formData.location,
        state: formData.state || '',
        city: formData.city || '',
        image: formData.cover_image || '',
        images: formData.gallery_images || [],
        total_area: formData.total_area || '',
        min_investment: Number(formData.min_investment || 0),
        expected_roi: Number(formData.expected_roi || 0),
        funding_progress: progress,
        total_funding: Number(formData.funding_goal || 0),
        raised_funding: Number(formData.raised_funding || 0),
        investors_count: Number(formData.investors_count || 0),
        risk_score: formData.risk_score || 'Low',
        category: formData.category || 'Residential',
        is_govt_approved: !!formData.is_govt_approved,
        is_verified: !!formData.is_verified,
        timeline: formData.duration || '',
        description: formData.description || '',
        highlights: formData.highlights || [],
        amenities: formData.amenities || [],
        documents: formData.documents || [],
        lat: formData.latitude || null,
        lng: formData.longitude || null,
        appreciation_rate: Number(formData.appreciation_rate || 0),
        is_active: formData.is_active ?? true,
        rating: Number(formData.rating || 0),
        duration: formData.duration || '',
        cover_image: formData.cover_image || '',
        funding_goal: Number(formData.funding_goal || 0),
        gallery_images: formData.gallery_images || [],
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        updated_at: new Date().toISOString()
      };

      if (isEdit) {
        const { error: updateError } = await supabase.from('land_projects').update(payload).eq('id', id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('land_projects').insert([payload]);
        if (insertError) throw insertError;
      }

      navigate('/admin/projects');
    } catch (err: any) {
      handleSupabaseError(err, 'save project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshCache = async () => {
    setSubmitting(true);
    try {
      const { error: rpcError } = await supabase.rpc('reload_postgrest_cache');
      if (rpcError) alert('Run "NOTIFY pgrst, \'reload schema\';" in Supabase.');
      else {
        alert('Cache refreshed.');
        setError(null);
        setSchemaError(false);
        if (isEdit) fetchProject();
      }
    } catch (e) {
      alert('Error.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
      <Loader2 className="animate-spin text-emerald-600" size={48} strokeWidth={3} />
      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Accessing Inventory...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/projects')} className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 transition-all">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{isEdit ? 'Update Project' : 'New Project'}</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">ID: {id || 'PENDING'}</p>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-3 px-10 py-4 bg-emerald-600 text-white rounded-[24px] text-sm font-black uppercase tracking-widest shadow-xl disabled:opacity-50">
          {submitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Sync Ledger
        </button>
      </div>

      {error && (
        <div className="p-8 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-[32px] flex flex-col md:flex-row items-center gap-6 text-red-600 dark:text-red-400">
          <AlertCircle size={40} className="opacity-40" />
          <div className="flex-1">
            <p className="text-lg font-black uppercase tracking-widest">Protocol Sync Failure</p>
            <p className="text-sm font-medium opacity-80 mt-1">{error}</p>
            {schemaError && <code className="block p-2 mt-2 bg-slate-100 dark:bg-black rounded text-xs">NOTIFY pgrst, 'reload schema';</code>}
          </div>
          {schemaError && <button onClick={handleRefreshCache} className="px-6 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest">Refresh Cache</button>}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-10 items-start">
        <aside className="w-full lg:w-72 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 shrink-0">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={clsx("flex items-center gap-4 px-6 py-4 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all", activeTab === tab.id ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-2xl border border-slate-100 dark:border-slate-800 scale-[1.05]" : "bg-slate-50 dark:bg-slate-900/50 text-slate-400 hover:text-slate-600 border border-transparent")}>
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 w-full bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden min-h-[700px]">
          <div className="p-6 sm:p-12 space-y-12">
            {activeTab === 'general' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                <SectionHeader title="Basic Details" icon={Info} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Asset Name</label>
                    <input required name="name" value={formData.name} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                    <select name="category" value={formData.category} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Compliance Summary</label>
                    <textarea name="description" rows={5} value={formData.description} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium dark:text-white leading-relaxed" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Star Rating</label>
                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <StarRating rating={formData.rating || 0} editable onChange={(r) => setFormData(prev => ({...prev, rating: r}))} />
                      <span className="font-black text-emerald-500">{(formData.rating || 0).toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Total Area</label>
                    <input name="total_area" value={formData.total_area} onChange={handleChange} placeholder="e.g. 10.5 Acres" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'investment' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                <SectionHeader title="Financial Parameters" icon={IndianRupee} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Min Entry (₹)</label>
                    <input type="number" name="min_investment" value={formData.min_investment ?? ''} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Expected ROI (%)</label>
                    <input type="number" step="0.1" name="expected_roi" value={formData.expected_roi ?? ''} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Holding Duration</label>
                    <input name="duration" value={formData.duration} onChange={handleChange} placeholder="e.g. 18-24 Months" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Funding Target (₹)</label>
                    <input type="number" name="funding_goal" value={formData.funding_goal ?? ''} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Raised Amount (₹)</label>
                    <input type="number" name="raised_funding" value={formData.raised_funding ?? ''} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'media' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                <SectionHeader title="Visual Assets" icon={ImageIcon} />
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-[4px] text-slate-900 dark:text-white flex items-center gap-3">
                    <LayoutGrid size={20} className="text-emerald-500" />
                    Cover Master
                  </h3>
                  <div onClick={() => coverInputRef.current?.click()} className="relative h-72 w-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer group overflow-hidden">
                    {formData.cover_image ? <img src={formData.cover_image} className="absolute inset-0 w-full h-full object-cover" alt="" /> : <div className="text-slate-400 flex flex-col items-center gap-2"><Plus size={32} /><span className="text-[10px] font-black uppercase">Upload Cover</span></div>}
                    <input type="file" ref={coverInputRef} onChange={(e) => handleFileUpload(e, 'cover_image')} className="hidden" accept="image/*" />
                  </div>
                </div>
                <div className="space-y-4">
                   <h3 className="text-sm font-black uppercase tracking-[4px] text-slate-900 dark:text-white flex items-center gap-3">
                    <ImageIcon size={20} className="text-blue-500" />
                    Project Gallery
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {formData.gallery_images?.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-3xl overflow-hidden group border border-slate-100 dark:border-slate-800 shadow-sm">
                        <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" alt="" />
                        <button type="button" onClick={() => removeGalleryImage(idx)} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg shadow-red-500/20"><Trash2 size={16} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => galleryInputRef.current?.click()} className="aspect-square border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all text-slate-400 hover:text-emerald-500">
                      <Plus size={32} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Add Media</span>
                    </button>
                  </div>
                  <input type="file" multiple ref={galleryInputRef} onChange={(e) => handleFileUpload(e, 'gallery_images')} className="hidden" accept="image/*" />
                </div>
              </div>
            )}

            {activeTab === 'location' && (
               <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
               <SectionHeader title="Geographical Sync" icon={MapPin} />
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                 <div className="col-span-full space-y-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Site Address</label>
                   <input name="location" value={formData.location} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">City</label>
                    <input name="city" value={formData.city} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">State</label>
                    <input name="state" value={formData.state} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Latitude</label>
                    <input type="number" step="any" name="latitude" value={formData.latitude ?? ''} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Longitude</label>
                    <input type="number" step="any" name="longitude" value={formData.longitude ?? ''} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
               </div>
             </div>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                <SectionHeader title="Legal Repository" icon={FileText} />
                <div className="grid grid-cols-1 gap-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verified Documentation</p>
                    <button type="button" onClick={() => docInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all">
                      <FileUp size={16} /> Add Documents
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(formData.documents as ProjectDocument[])?.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-[24px] group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                            {doc.type.includes('image') ? <ImageIcon size={24} /> : <File size={24} />}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[200px]">{doc.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white dark:bg-slate-900 text-slate-400 hover:text-emerald-500 rounded-xl border border-slate-100 dark:border-slate-800">
                            <ExternalLink size={16} />
                          </a>
                          <button type="button" onClick={() => removeDocument(idx)} className="p-2 bg-white dark:bg-slate-900 text-slate-400 hover:text-red-500 rounded-xl border border-slate-100 dark:border-slate-800">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!formData.documents || (formData.documents as any[]).length === 0) && (
                      <div className="col-span-full py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[32px] flex flex-col items-center justify-center gap-4 text-slate-400">
                        <FileText size={48} className="opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No Documents Uploaded</p>
                      </div>
                    )}
                  </div>
                  <input type="file" multiple ref={docInputRef} onChange={(e) => handleFileUpload(e, 'documents')} className="hidden" accept=".pdf,.doc,.docx,image/*" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProject;
