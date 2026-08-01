import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, MapPin, Edit2, Trash2, Eye,
  RefreshCw, AlertCircle, Filter, ChevronRight, ChevronLeft,
  List, LayoutGrid
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { LandProject } from '../types/project';
import StarRating from '../components/StarRating';
import ErrorBoundary from '../components/ErrorBoundary';
import clsx from 'clsx';

// Note: investment_status is NOT in DB schema, we use is_active as proxy
const STATUS_FILTERS: ('All' | 'Active' | 'Inactive')[] = ['All', 'Active', 'Inactive'];

const Projects = () => {
  const [projects, setProjects] = useState<LandProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [viewMode, setViewViewMode] = useState<'table' | 'grid'>('table');
  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('land_projects')
        .select('*', { count: 'exact' });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`);
      }

      if (statusFilter === 'Active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'Inactive') {
        query = query.eq('is_active', false);
      }

      switch (sortBy) {
        case 'newest': query = query.order('created_at', { ascending: false }); break;
        case 'oldest': query = query.order('created_at', { ascending: true }); break;
        case 'rating': query = query.order('rating', { ascending: false }); break;
        case 'roi': query = query.order('expected_roi', { ascending: false }); break;
        case 'investment': query = query.order('min_investment', { ascending: true }); break;
        default: query = query.order('created_at', { ascending: false });
      }

      const from = page * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;

      setProjects((data || []) as LandProject[]);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('[LandProjects] Error:', err);
      setError(err.message || 'Platform synchronization failure.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, sortBy, page, rowsPerPage]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      const { error: deleteError } = await supabase.from('land_projects').delete().eq('id', id);
      if (deleteError) throw deleteError;
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-20 min-h-screen">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-[2px]">Land Projects</h1>
            <p className="text-slate-500 font-medium">Control your real estate inventory and investment flow.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
              <button onClick={() => setViewViewMode('table')} className={clsx("p-2 rounded-lg", viewMode === 'table' ? "bg-slate-100 dark:bg-slate-800 text-emerald-600" : "text-slate-400")}><List size={20} /></button>
              <button onClick={() => setViewViewMode('grid')} className={clsx("p-2 rounded-lg", viewMode === 'grid' ? "bg-slate-100 dark:bg-slate-800 text-emerald-600" : "text-slate-400")}><LayoutGrid size={20} /></button>
            </div>
            <button onClick={() => navigate('/admin/projects/new')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-black uppercase tracking-wider shadow-xl shadow-emerald-600/20">
              <Plus size={20} strokeWidth={3} /> Add Project
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search projects..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white" />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(0); }} className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-xs font-bold outline-none cursor-pointer">
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(0); }} className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-xs font-bold outline-none cursor-pointer">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="rating">Highest Rating</option>
              <option value="roi">Highest ROI</option>
              <option value="investment">Lowest Investment</option>
            </select>
            <button onClick={() => fetchProjects()} className="p-3 text-slate-400 hover:text-emerald-500 bg-slate-50 dark:bg-slate-800 rounded-xl"><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </div>

        {error && <div className="p-10 bg-red-50 text-center rounded-[40px]"><AlertCircle size={32} className="mx-auto text-red-600" /><p className="text-red-600 font-bold mt-4">{error}</p></div>}

        <div className={clsx("bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden", loading && "opacity-60")}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[10px] uppercase font-black tracking-[2px]">
                  <th className="px-6 py-5">Project</th>
                  <th className="px-6 py-5 text-center">Rating</th>
                  <th className="px-6 py-5 text-center">Investment</th>
                  <th className="px-6 py-5 text-center">ROI & Duration</th>
                  <th className="px-6 py-5">Funding Progress</th>
                  <th className="px-6 py-5 text-center">Status</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {projects.map((project) => (
                  <tr key={project.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img src={project.cover_image || project.image || 'https://via.placeholder.com/800x400'} className="w-16 h-12 rounded-xl object-cover" alt="" />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">{project.name}</p>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400"><MapPin size={10} className="text-emerald-500" />{project.location}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center"><StarRating rating={project.rating || 0} size={14} /><span className="text-[10px] font-black text-slate-400 block mt-1">{(project.rating || 0).toFixed(1)}</span></td>
                    <td className="px-6 py-4 text-center"><p className="text-sm font-black text-slate-900 dark:text-white">₹{(project.min_investment || 0).toLocaleString()}</p></td>
                    <td className="px-6 py-4 text-center"><div className="text-emerald-600 font-black">{project.expected_roi || 0}%</div><p className="text-[10px] font-bold text-slate-400">{project.duration || 'N/A'}</p></td>
                    <td className="px-6 py-4 w-64">
                      <div className="flex justify-between items-center text-[10px] font-black mb-2 uppercase"><span className="text-slate-400">₹{( (project.raised_funding || 0) / 100000).toFixed(1)}L Raised</span><span className="text-emerald-600">{project.funding_progress}%</span></div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${project.funding_progress}%` }} /></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={clsx("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border", project.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                        {project.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/admin/projects/${project.id}`)} className="p-2 text-slate-400 hover:text-emerald-600"><Eye size={18} /></button>
                        <button onClick={() => navigate(`/admin/projects/${project.id}/edit`)} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 size={18} /></button>
                        <button onClick={() => handleDelete(project.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-5 bg-slate-50 flex items-center justify-between border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase">Page {page + 1} · Total: {totalCount}</p>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-2 bg-white rounded-xl disabled:opacity-30"><ChevronLeft size={18}/></button>
              <button disabled={(page + 1) * rowsPerPage >= totalCount} onClick={() => setPage(p => p + 1)} className="p-2 bg-white rounded-xl disabled:opacity-30"><ChevronRight size={18}/></button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Projects;
