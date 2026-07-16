import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, AlertCircle, Upload, Image as ImageIcon,
  MapPin, TrendingUp, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Project {
  id: string;
  name: string;
  location: string;
  city: string;
  state: string;
  category: string;
  total_area: string;
  timeline: string;
  expected_roi: number;
  min_investment: number;
  total_funding: number;
  raised_funding: number;
  funding_progress: number;
  investors_count: number;
  image: string;
  is_active: boolean;
  description: string;
}

const CATEGORIES = ['Residential', 'Commercial', 'Farm Land', 'Industrial', 'Luxury Villas'];

const EditProject = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Project | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) fetchProject();
  }, [id]);

  const fetchProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('land_projects')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Project not found');

      setFormData(data as Project);
    } catch (err: any) {
      console.error('[EditProject] Fetch Error:', err);
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !formData) return;

    setIsSubmitting(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `projects/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('project-images')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image: publicUrl });
    } catch (err: any) {
      console.error('[EditProject] Image Upload Error:', err);
      alert(err.message || 'Image upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !id) return;
    setIsSubmitting(true);

    try {
      // Auto-calculate progress
      const progress = Math.min(100, Math.round((formData.raised_funding / formData.total_funding) * 100));

      // WHITELIST: Only send editable columns to prevent RLS violations
      const updateData = {
        name: formData.name,
        location: formData.location,
        city: formData.city,
        state: formData.state,
        category: formData.category,
        total_area: formData.total_area,
        timeline: formData.timeline,
        expected_roi: formData.expected_roi,
        min_investment: formData.min_investment,
        total_funding: formData.total_funding,
        raised_funding: formData.raised_funding,
        funding_progress: progress,
        investors_count: formData.investors_count,
        image: formData.image,
        is_active: formData.is_active,
        description: formData.description,
        updated_at: new Date().toISOString()
      };

      console.log('[EditProject] Attempting update with:', updateData);

      const { error: updateError } = await supabase
        .from('land_projects')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('[EditProject] Supabase Update Error:', updateError);
        throw updateError;
      }

      navigate(`/admin/projects`);
    } catch (err: any) {
      console.error('[EditProject] Submission Error:', err);
      alert(err.message || 'Update failed. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
        <p className="text-slate-500 font-medium">Loading project data...</p>
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-red-100 shadow-sm">
        <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
        <h2 className="text-xl font-bold mb-2">Error Loading Project</h2>
        <p className="text-slate-500 mb-6">{error || 'Project not found'}</p>
        <button onClick={() => navigate('/admin/projects')} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/admin/projects`)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors"
        >
          <ArrowLeft size={20} />
          Discard Changes
        </button>
        <h1 className="text-2xl font-bold">Edit Project</h1>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Image Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <ImageIcon size={16} />
              Project Media
            </h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative h-64 w-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[24px] flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors cursor-pointer group"
            >
              {formData.image ? (
                <>
                  <img src={formData.image} className="absolute inset-0 w-full h-full object-cover rounded-[24px]" alt="Project" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-[24px]">
                    <div className="flex flex-col items-center gap-2">
                      <Upload size={32}/>
                      <span className="font-bold">Replace Image</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <ImageIcon className="text-slate-400" size={48} />
                  <span className="text-sm font-bold text-slate-500">Click to upload project cover</span>
                </>
              )}
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project Identity */}
            <div className="col-span-full space-y-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Info size={16} />
                General Information
              </h3>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Project Name</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Category</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Description</label>
              <textarea rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium leading-relaxed" />
            </div>

            {/* Location */}
            <div className="col-span-full space-y-4 mt-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <MapPin size={16} />
                Location Details
              </h3>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Location / Area</label>
              <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">City</label>
              <input required type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">State</label>
              <input required type="text" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Total Area</label>
              <input type="text" placeholder="e.g. 63 Acres" value={formData.total_area || ''} onChange={e => setFormData({...formData, total_area: e.target.value})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Timeline</label>
              <input type="text" placeholder="e.g. 18-24 months" value={formData.timeline || ''} onChange={e => setFormData({...formData, timeline: e.target.value})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Status</label>
              <div className="flex gap-4 p-1 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, is_active: true})}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${formData.is_active ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-white dark:hover:bg-slate-700'}`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, is_active: false})}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${!formData.is_active ? 'bg-slate-600 text-white shadow-lg shadow-slate-600/20' : 'text-slate-500 hover:bg-white dark:hover:bg-slate-700'}`}
                >
                  Draft
                </button>
              </div>
            </div>

            {/* Financials */}
            <div className="col-span-full space-y-4 mt-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <TrendingUp size={16} />
                Financial Metrics
              </h3>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Expected ROI (%)</label>
              <input required type="number" step="0.1" value={formData.expected_roi} onChange={e => setFormData({...formData, expected_roi: parseFloat(e.target.value)})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black text-emerald-600" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Min Invest (₹)</label>
              <input required type="number" value={formData.min_investment} onChange={e => setFormData({...formData, min_investment: parseFloat(e.target.value)})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Funding Goal (₹)</label>
              <input required type="number" value={formData.total_funding} onChange={e => setFormData({...formData, total_funding: parseFloat(e.target.value)})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 ml-1">Raised (₹)</label>
              <input required type="number" value={formData.raised_funding} onChange={e => setFormData({...formData, raised_funding: parseFloat(e.target.value)})} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
            </div>

            <div className="col-span-full pt-8 flex gap-4">
              <button
                type="button"
                onClick={() => navigate(`/admin/projects`)}
                className="flex-1 py-4 border border-slate-200 dark:border-slate-800 rounded-[20px] font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-[2] py-4 bg-emerald-600 text-white rounded-[20px] font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                Save Project Details
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProject;
