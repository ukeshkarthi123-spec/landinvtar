import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, MapPin, TrendingUp, Edit2, Trash2, Eye,
  RefreshCw, AlertCircle, X, Upload, Check, Loader2, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Project {
  id?: string;
  name: string;
  location: string;
  city: string;
  state: string;
  category: string;
  expected_roi: number;
  min_investment: number;
  total_funding: number;
  raised_funding: number;
  funding_progress: number;
  investors_count: number;
  image: string;
  is_active: boolean;
  description: string;
  created_at?: string;
}

const CATEGORIES = ['Residential', 'Commercial', 'Farm Land', 'Industrial', 'Luxury Villas'];

const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsModalSubmitting] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<Project>({
    name: '',
    location: '',
    city: '',
    state: '',
    category: 'Residential',
    expected_roi: 18,
    min_investment: 500,
    total_funding: 1000000,
    raised_funding: 0,
    funding_progress: 0,
    investors_count: 0,
    image: '',
    is_active: true,
    description: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('land_projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setProjects(data || []);
    } catch (err: any) {
      console.error('[Projects] Fetch Error:', err);
      setError(err.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleOpenModal = (project: Project | null = null) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name || '',
        location: project.location || '',
        city: project.city || '',
        state: project.state || '',
        category: project.category || 'Residential',
        expected_roi: project.expected_roi || 0,
        min_investment: project.min_investment || 500,
        total_funding: project.total_funding || 0,
        raised_funding: project.raised_funding || 0,
        funding_progress: project.funding_progress || 0,
        investors_count: project.investors_count || 0,
        image: project.image || '',
        is_active: project.is_active ?? true,
        description: project.description || ''
      });
    } else {
      setEditingProject(null);
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
        funding_progress: 0,
        investors_count: 0,
        image: '',
        is_active: true,
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsModalSubmitting(true);
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
      console.error('[Projects] Image Upload Error:', err);
      alert(err.message || 'Image upload failed');
    } finally {
      setIsModalSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalSubmitting(true);

    try {
      // Auto-calculate progress
      const progress = Math.min(100, Math.round((formData.raised_funding / formData.total_funding) * 100));

      // WHITELIST: Explicitly define columns to send to prevent RLS errors
      const submissionData = {
        name: formData.name,
        location: formData.location,
        city: formData.city,
        state: formData.state,
        category: formData.category,
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

      if (editingProject?.id) {
        console.log('[Projects] Updating project:', editingProject.id);
        const { error: updateError } = await supabase
          .from('land_projects')
          .update(submissionData)
          .eq('id', editingProject.id);

        if (updateError) {
          console.error('[Projects] Update Error:', updateError);
          throw updateError;
        }
      } else {
        console.log('[Projects] Creating new project');
        const { error: insertError } = await supabase
          .from('land_projects')
          .insert([submissionData]);

        if (insertError) {
          console.error('[Projects] Insert Error:', insertError);
          throw insertError;
        }
      }

      setIsModalOpen(false);
      fetchProjects();
    } catch (err: any) {
      console.error('[Projects] Submission Error:', err);
      alert(err.message || 'Action failed. Check console for details.');
    } finally {
      setIsModalSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('land_projects')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('[Projects] Delete Error:', deleteError);
        throw deleteError;
      }

      fetchProjects();
    } catch (err: any) {
      console.error('[Projects] Delete Exception:', err);
      alert(err.message || 'Delete failed');
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Land Projects</h1>
          <p className="text-slate-500 text-sm">Manage {projects.length} total properties.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchProjects} className="p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900 rounded-lg transition-all border border-transparent hover:border-slate-200">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg shadow-emerald-600/20"
          >
            <Plus size={18} />
            New Project
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search by name, location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-3 font-medium">
        <AlertCircle size={18}/> {error}
      </div>}

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-[400px] bg-white dark:bg-slate-900 rounded-2xl animate-pulse border border-slate-200" />)
        ) : filteredProjects.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300">
            No projects found.
          </div>
        ) : (
          filteredProjects.map((project) => (
            <div key={project.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group hover:shadow-xl transition-all">
              <div className="relative h-48">
                <img src={project.image || 'https://via.placeholder.com/800x400?text=No+Image'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={project.name} />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={() => handleOpenModal(project)} className="p-2 bg-white/90 dark:bg-slate-900/90 rounded-lg text-slate-600 hover:text-emerald-600 shadow shadow-black/10 transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(project.id!)} className="p-2 bg-white/90 dark:bg-slate-900/90 rounded-lg text-slate-600 hover:text-red-600 shadow shadow-black/10 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${project.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>
                    {project.is_active ? 'Active' : 'Draft'}
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-bold truncate text-slate-900 dark:text-slate-100">{project.name}</h3>
                  <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                    <MapPin size={14} className="text-emerald-500" />
                    <span className="truncate">{project.location}, {project.city}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Expected ROI</p>
                    <p className="text-emerald-600 font-bold text-lg">{project.expected_roi}%</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Min Invest</p>
                    <p className="text-slate-900 dark:text-slate-100 font-bold text-lg">₹{project.min_investment}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Progress</span>
                    <span className="text-emerald-600">{project.funding_progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${project.funding_progress}%` }} />
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/admin/projects/${project.id}`)}
                  className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
                >
                  <Eye size={18} /> View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-bold">{editingProject ? 'Edit Project' : 'New Land Project'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh] grid grid-cols-2 gap-6">
              {/* Image Upload Area */}
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Project Cover Image</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-40 w-full border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors cursor-pointer group"
                >
                  {formData.image ? (
                    <>
                      <img src={formData.image} className="absolute inset-0 w-full h-full object-cover rounded-2xl" alt="Preview" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-2xl"><Upload size={24}/></div>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="text-slate-400" size={32} />
                      <span className="text-sm font-medium text-slate-500">Click to upload or drag image</span>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Project Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Location</label>
                <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">City</label>
                <input required type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">State</label>
                <input required type="text" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Expected ROI (%)</label>
                <input required type="number" step="0.1" value={formData.expected_roi} onChange={e => setFormData({...formData, expected_roi: parseFloat(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Min Investment (₹)</label>
                <input required type="number" value={formData.min_investment} onChange={e => setFormData({...formData, min_investment: parseFloat(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Total Funding Goal (₹)</label>
                <input required type="number" value={formData.total_funding} onChange={e => setFormData({...formData, total_funding: parseFloat(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Raised Funding (₹)</label>
                <input required type="number" value={formData.raised_funding} onChange={e => setFormData({...formData, raised_funding: parseFloat(e.target.value)})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Status</label>
                <select value={formData.is_active ? 'Active' : 'Draft'} onChange={e => setFormData({...formData, is_active: e.target.value === 'Active'})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Description</label>
                <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div className="col-span-2 pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Check size={20}/>}
                  {editingProject ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
