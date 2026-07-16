import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, TrendingUp, Users, Calendar,
  ShieldCheck, Clock, Edit2, Trash2, AlertCircle, Loader2,
  Image as ImageIcon, Globe, Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Project {
  id: string;
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
  created_at: string;
}

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchProject();
  }, [id]);

  const fetchProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('land_projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (err: any) {
      console.error('Fetch Project Details Error:', err);
      setError(err.message || 'Failed to fetch project details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project?.id || !confirm('Are you sure you want to delete this project?')) return;

    try {
      const { error } = await supabase
        .from('land_projects')
        .delete()
        .eq('id', project.id);
      if (error) throw error;
      navigate('/admin/projects');
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
        <p className="text-slate-500 font-medium">Loading project details...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-red-100">
        <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
        <h2 className="text-xl font-bold mb-2">Error Loading Project</h2>
        <p className="text-slate-500 mb-6">{error || 'Project not found'}</p>
        <button
          onClick={() => navigate('/admin/projects')}
          className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/projects')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Projects
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 transition-all"
          >
            <Edit2 size={18} />
            Edit Project
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all"
          >
            <Trash2 size={18} />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Image & Overview */}
        <div className="lg:col-span-2 space-y-8">
          <div className="relative h-96 rounded-[32px] overflow-hidden shadow-2xl shadow-emerald-900/10">
            <img
              src={project.image || 'https://via.placeholder.com/1200x800'}
              className="w-full h-full object-cover"
              alt={project.name}
            />
            <div className="absolute top-6 left-6">
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg ${
                project.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-white'
              }`}>
                {project.is_active ? 'Active' : 'Draft Mode'}
              </span>
            </div>
            <div className="absolute bottom-6 right-6">
              <span className="px-4 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-xs font-bold text-slate-900 shadow-lg">
                {project.category}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">{project.name}</h1>
              <div className="flex items-center gap-2 text-slate-500 mt-2 font-medium">
                <MapPin size={18} className="text-emerald-500" />
                <span>{project.location}, {project.city}, {project.state}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Activity size={20} className="text-emerald-500" />
                Project Description
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {project.description || 'No description provided for this project.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Stats & ROI */}
        <div className="space-y-8">
          <div className="bg-emerald-600 p-8 rounded-[32px] text-white shadow-xl shadow-emerald-600/20 space-y-6">
            <div className="space-y-1">
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest">Expected Returns</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black">{project.expected_roi}%</span>
                <span className="text-emerald-100 font-bold mb-1">Annual ROI</span>
              </div>
            </div>

            <div className="h-px bg-white/20 w-full" />

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-widest">Min Invest</p>
                <p className="text-xl font-black">₹{project.min_investment}</p>
              </div>
              <div className="space-y-1">
                <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-widest">Investors</p>
                <p className="text-xl font-black">{project.investors_count}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Funding Progress</p>
                <p className="text-emerald-600 font-black">{project.funding_progress}%</p>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                  style={{ width: `${project.funding_progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-400">Raised: ₹{project.raised_funding.toLocaleString()}</span>
                <span className="text-slate-900 dark:text-slate-100">Goal: ₹{project.total_funding.toLocaleString()}</span>
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800 w-full" />

            <div className="space-y-4">
              <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <Calendar size={20} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Created On</p>
                  <p className="text-sm font-bold">{new Date(project.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <ShieldCheck size={20} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Project Status</p>
                  <p className="text-sm font-bold">Verified Asset</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
