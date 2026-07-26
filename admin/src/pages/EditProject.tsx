import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, AlertCircle, Upload, Image as ImageIcon,
  MapPin, TrendingUp, Info, X, Check, Star, FileText, Globe,
  ShieldCheck, Smartphone, IndianRupee, Layers, Trash2, Plus,
  LayoutGrid, FileUp, Video, Calendar, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LandProject, InvestmentStatus } from '../types/project';
import StarRating from '../components/StarRating';
import clsx from 'clsx';

const TABS = [
  { id: 'general', label: 'General Info', icon: Info },
  { id: 'investment', label: 'Investment', icon: IndianRupee },
  { id: 'media', label: 'Media & Gallery', icon: ImageIcon },
  { id: 'documents', label: 'Legal Docs', icon: FileText },
  { id: 'location', label: 'Location/Map', icon: MapPin },
];

const CATEGORIES = ['Residential', 'Commercial', 'Farm Land', 'Industrial', 'Luxury Villas'];
const STATUSES: InvestmentStatus[] = ['Upcoming', 'Active', 'Funded', 'Completed', 'Sold Out'];

const EditProject = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<LandProject>>({
    name: '',
    project_code: '',
    description: '',
    short_description: '',
    location: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    google_map_url: '',
    latitude: null,
    longitude: null,
    minimum_investment: 500,
    maximum_investment: 1000000,
    target_return: 18,
    expected_roi: 18,
    duration: '18-24 Months',
    funding_goal: 10000000,
    raised_amount: 0,
    total_units: 100,
    available_units: 100,
    investment_status: 'Active',
    featured: false,
    rating: 5.0,
    is_active: true,
    cover_image: '',
    gallery_images: [],
    video_url: '',
    brochure_url: '',
    legal_document_url: '',
    dtcp_certificate_url: '',
    rera_certificate_url: '',
    sale_deed_url: '',
    master_plan_url: ''
  });

  const fileInputRefs = {
    cover: useRef<HTMLInputElement>(null),
    gallery: useRef<HTMLInputElement>(null),
    brochure: useRef<HTMLInputElement>(null),
    legal: useRef<HTMLInputElement>(null),
    dtcp: useRef<HTMLInputElement>(null),
    rera: useRef<HTMLInputElement>(null),
    sale: useRef<HTMLInputElement>(null),
    master: useRef<HTMLInputElement>(null),
  };

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
      setFormData(data);
    } catch (err: any) {
      console.error('[EditProject] Fetch Error:', err);
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let val: any = value;

    if (type === 'number') val = parseFloat(value) || 0;
    if (type === 'checkbox') val = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleToggle = (name: keyof LandProject) => {
    setFormData(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'media' | 'doc', field: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSubmitting(true);
    try {
      const bucket = type === 'media' ? 'project-media' : 'project-documents';
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${field}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      if (field === 'gallery_images') {
        setFormData(prev => ({
          ...prev,
          gallery_images: [...(prev.gallery_images || []), ...uploadedUrls]
        }));
      } else {
        setFormData(prev => ({ ...prev, [field]: uploadedUrls[0] }));
      }
    } catch (err: any) {
      console.error('[Upload] Error:', err);
      alert('Upload failed: ' + err.message);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.location) {
      alert('Project Name and Location are required');
      return;
    }

    setSubmitting(true);
    try {
      // Auto-calculate progress
      const progress = Math.min(100, Math.round(((formData.raised_amount || 0) / (formData.funding_goal || 1)) * 100));

      const submissionData = {
        ...formData,
        funding_progress: progress,
        updated_at: new Date().toISOString()
      };

      // Compatibility fix for legacy "image" field
      if (formData.cover_image) submissionData.image = formData.cover_image;

      if (isEdit) {
        const { error: updateError } = await supabase
          .from('land_projects')
          .update(submissionData)
          .eq('id', id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('land_projects')
          .insert([submissionData]);

        if (insertError) throw insertError;
      }

      navigate('/admin/projects');
    } catch (err: any) {
      console.error('[Submit] Error:', err);
      alert('Save failed: ' + err.message);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/projects')}
            className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-emerald-600 shadow-sm transition-all"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {isEdit ? 'Update Project' : 'Initiate New Project'}
            </h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
              ID: {id || 'SYSTEM-GEN-UUID'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-3 px-10 py-4 bg-emerald-600 text-white rounded-[24px] text-sm font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
            Synchronize
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 items-start">
        {/* Sidebar Tabs */}
        <aside className="w-full lg:w-72 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex items-center gap-4 px-6 py-4 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-2xl border border-slate-100 dark:border-slate-800 scale-[1.05]"
                  : "bg-slate-50 dark:bg-slate-900/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-transparent shadow-sm"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Form Main Area */}
        <div className="flex-1 w-full bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden min-h-[700px]">
          <form className="p-6 sm:p-12 space-y-12">

            {/* TAB: GENERAL */}
            {activeTab === 'general' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project Name</label>
                    <input required name="name" value={formData.name} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project Code</label>
                    <input name="project_code" value={formData.project_code} onChange={handleChange} placeholder="e.g. LAND-001" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Short Description</label>
                    <input name="short_description" value={formData.short_description} onChange={handleChange} placeholder="One line catchphrase..." className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Detailed Description</label>
                    <textarea name="description" rows={5} value={formData.description} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium dark:text-white leading-relaxed" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Star Rating</label>
                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <StarRating rating={formData.rating || 0} editable onChange={(r) => setFormData(prev => ({...prev, rating: r}))} />
                      <span className="font-black text-emerald-500">{formData.rating?.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Featured Project</label>
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 h-[52px]">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Show on homepage spotlight</span>
                      <button type="button" onClick={() => handleToggle('featured')} className={clsx("w-12 h-6 rounded-full relative transition-all", formData.featured ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")}>
                        <div className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", formData.featured ? "right-1" : "left-1")} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: INVESTMENT */}
            {activeTab === 'investment' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Investment Status</label>
                    <select name="investment_status" value={formData.investment_status} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black dark:text-white cursor-pointer appearance-none">
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Minimum Stake (₹)</label>
                    <input type="number" name="minimum_investment" value={formData.minimum_investment} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Expected ROI (%)</label>
                    <input type="number" step="0.1" name="expected_roi" value={formData.expected_roi} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Duration</label>
                    <input name="duration" value={formData.duration} onChange={handleChange} placeholder="e.g. 18-24 Months" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Funding Goal (₹)</label>
                    <input type="number" name="funding_goal" value={formData.funding_goal} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount Raised (₹)</label>
                    <input type="number" name="raised_amount" value={formData.raised_amount} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Total Units</label>
                    <input type="number" name="total_units" value={formData.total_units} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Available Units</label>
                    <input type="number" name="available_units" value={formData.available_units} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: MEDIA */}
            {activeTab === 'media' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                {/* Cover Image */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-[4px] text-slate-900 dark:text-white flex items-center gap-3">
                    <LayoutGrid size={20} className="text-emerald-500" />
                    Cover Master
                  </h3>
                  <div
                    onClick={() => fileInputRefs.cover.current?.click()}
                    className="relative h-72 w-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer group overflow-hidden"
                  >
                    {formData.cover_image ? (
                      <>
                        <img src={formData.cover_image} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt="" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-black uppercase tracking-[2px] transition-all">Replace Master</div>
                      </>
                    ) : (
                      <>
                        <div className="p-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl text-emerald-600"><Plus size={32}/></div>
                        <p className="text-sm font-bold text-slate-500">Upload Project Cover</p>
                      </>
                    )}
                    <input type="file" ref={fileInputRefs.cover} onChange={(e) => handleFileUpload(e, 'media', 'cover_image')} className="hidden" accept="image/*" />
                  </div>
                </div>

                {/* Gallery */}
                <div className="space-y-4">
                   <h3 className="text-sm font-black uppercase tracking-[4px] text-slate-900 dark:text-white flex items-center gap-3">
                    <ImageIcon size={20} className="text-blue-500" />
                    Project Gallery
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {formData.gallery_images?.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-3xl overflow-hidden group border border-slate-100 dark:border-slate-800 shadow-sm">
                        <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" alt="" />
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(idx)}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg shadow-red-500/20"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRefs.gallery.current?.click()}
                      className="aspect-square border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all text-slate-400 hover:text-emerald-500"
                    >
                      <Plus size={32} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Add Media</span>
                    </button>
                  </div>
                  <input type="file" multiple ref={fileInputRefs.gallery} onChange={(e) => handleFileUpload(e, 'media', 'gallery_images')} className="hidden" accept="image/*" />
                </div>

                {/* Video */}
                <div className="space-y-4">
                   <h3 className="text-sm font-black uppercase tracking-[4px] text-slate-900 dark:text-white flex items-center gap-3">
                    <Video size={20} className="text-red-500" />
                    Virtual Tour
                  </h3>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Youtube / Video URL</label>
                    <input name="video_url" value={formData.video_url} onChange={handleChange} placeholder="https://www.youtube.com/watch?v=..." className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DOCUMENTS */}
            {activeTab === 'documents' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <SectionHeader title="Compliance Vault" icon={ShieldCheck} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { id: 'brochure_url', label: 'E-Brochure PDF', color: 'text-blue-500' },
                    { id: 'legal_document_url', label: 'Legal Audit Report', color: 'text-purple-500' },
                    { id: 'dtcp_certificate_url', label: 'DTCP Certificate', color: 'text-emerald-500' },
                    { id: 'rera_certificate_url', label: 'RERA Registration', color: 'text-orange-500' },
                    { id: 'sale_deed_url', label: 'Draft Sale Deed', color: 'text-indigo-500' },
                    { id: 'master_plan_url', label: 'Layout Master Plan', color: 'text-amber-500' },
                  ].map((doc) => (
                    <div key={doc.id} className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[32px] border border-slate-100 dark:border-slate-800 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={clsx("p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-sm transition-transform group-hover:scale-110", doc.color)}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">{doc.label}</p>
                          <p className="text-[10px] text-slate-400 font-bold truncate max-w-[200px] mt-0.5">
                            {formData[doc.id as keyof LandProject] ? 'Secured in Storage' : 'Required Compliance'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {formData[doc.id as keyof LandProject] && (
                           <a href={formData[doc.id as keyof LandProject] as string} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"><Eye size={18}/></a>
                        )}
                        <button
                          type="button"
                          onClick={() => (fileInputRefs as any)[doc.id.split('_')[0]].current?.click()}
                          className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-emerald-500 hover:border-emerald-500 transition-all shadow-sm"
                        >
                          <FileUp size={18} />
                        </button>
                        <input type="file" ref={(fileInputRefs as any)[doc.id.split('_')[0]]} onChange={(e) => handleFileUpload(e, 'doc', doc.id)} className="hidden" accept=".pdf,.doc,.docx" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: LOCATION */}
            {activeTab === 'location' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                  <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project Site Address</label>
                    <input name="location" value={formData.location} onChange={handleChange} placeholder="Plot No, Street, Main Road..." className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pincode</label>
                    <input name="pincode" value={formData.pincode} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Google Maps URL</label>
                    <input name="google_map_url" value={formData.google_map_url} onChange={handleChange} placeholder="https://maps.google.com/..." className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Latitude</label>
                    <input type="number" name="latitude" value={formData.latitude || ''} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Longitude</label>
                    <input type="number" name="longitude" value={formData.longitude || ''} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold dark:text-white" />
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProject;
