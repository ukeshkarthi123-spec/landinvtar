import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, MapPin, TrendingUp, Edit2, Trash2, Eye,
  RefreshCw, AlertCircle, Filter, ChevronRight, ChevronLeft,
  Star, LayoutGrid, List, MoreVertical, Copy,
  ArrowUpDown, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LandProject, InvestmentStatus } from '../types/project';
import StarRating from '../components/StarRating';
import clsx from 'clsx';

const STATUS_FILTERS: (InvestmentStatus | 'All')[] = ['All', 'Upcoming', 'Active', 'Funded', 'Completed', 'Sold Out'];

const Projects = () => {
  const [projects, setProjects] = useState<LandProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvestmentStatus | 'All'>('All');
  const [featuredFilter, setFeaturedFilter] = useState<boolean | 'All'>('All');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [viewMode, setViewViewMode] = useState<'table' | 'grid'>('table');
  const navigate = useNavigate();

  // Pagination State
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

      // Search
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,project_code.ilike.%${searchTerm}%`);
      }

      // Status Filter
      if (statusFilter !== 'All') {
        query = query.eq('investment_status', statusFilter);
      }

      // Featured Filter
      if (featuredFilter !== 'All') {
        query = query.eq('featured', featuredFilter);
      }

      // Sorting
      switch (sortBy) {
        case 'newest': query = query.order('created_at', { ascending: false }); break;
        case 'oldest': query = query.order('created_at', { ascending: true }); break;
        case 'rating': query = query.order('rating', { ascending: false }); break;
        case 'roi': query = query.order('expected_roi', { ascending: false }); break;
        case 'investment': query = query.order('minimum_investment', { ascending: true }); break;
        default: query = query.order('created_at', { ascending: false });
      }

      // Pagination
      const from = page * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;
      setProjects((data || []) as LandProject[]);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('[Projects] Fetch Error:', err);
      setError(err.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, featuredFilter, sortBy, page, rowsPerPage]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;

    try {
      const { error: deleteError } = await supabase
        .from('land_projects')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      fetchProjects();
    } catch (err: any) {
      console.error('[Projects] Delete Error:', err);
      alert(err.message || 'Delete failed');
    }
  };

  const handleDuplicate = async (project: LandProject) => {
    try {
      const { id, created_at, updated_at, ...rest } = project;
      const duplicateData = {
        ...rest,
        name: `${project.name} (Copy)`,
        project_code: project.project_code ? `${project.project_code}-COPY` : '',
        is_active: false,
        investment_status: 'Upcoming'
      };

      const { error: insertError } = await supabase
        .from('land_projects')
        .insert([duplicateData]);

      if (insertError) throw insertError;
      fetchProjects();
      alert('Project duplicated successfully!');
    } catch (err: any) {
      console.error('[Projects] Duplicate Error:', err);
      alert(err.message || 'Duplicate failed');
    }
  };

  const getStatusColor = (status: InvestmentStatus) => {
    switch (status) {
      case 'Upcoming': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'Funded': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'Completed': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
      case 'Sold Out': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Land Project Management</h1>
          <p className="text-slate-500 font-medium">Control your real estate inventory and investment flow.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
            <button
              onClick={() => setViewViewMode('table')}
              className={clsx("p-2 rounded-lg transition-all", viewMode === 'table' ? "bg-slate-100 dark:bg-slate-800 text-emerald-600" : "text-slate-400")}
            >
              <List size={20} />
            </button>
            <button
              onClick={() => setViewViewMode('grid')}
              className={clsx("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-slate-100 dark:bg-slate-800 text-emerald-600" : "text-slate-400")}
            >
              <LayoutGrid size={20} />
            </button>
          </div>
          <button
            onClick={() => navigate('/admin/projects/new')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-black uppercase tracking-wider transition-all shadow-xl shadow-emerald-600/20 active:scale-95"
          >
            <Plus size={20} strokeWidth={3} />
            Add New Project
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search projects, location, code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {STATUS_FILTERS.map(s => <option key={s} value={s}>{s} Status</option>)}
            </select>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="rating">Highest Rating</option>
            <option value="roi">Highest ROI</option>
            <option value="investment">Lowest Investment</option>
          </select>

          <button
            onClick={() => fetchProjects()}
            className="p-3 text-slate-400 hover:text-emerald-500 bg-slate-50 dark:bg-slate-800 rounded-xl transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center gap-3 font-bold shadow-sm">
          <AlertCircle size={20}/> {error}
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[10px] uppercase font-black tracking-[2px]">
                  <th className="px-6 py-5">Project</th>
                  <th className="px-6 py-5">Rating</th>
                  <th className="px-6 py-5">Investment</th>
                  <th className="px-6 py-5">ROI & Duration</th>
                  <th className="px-6 py-5">Funding Progress</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-8"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-slate-400 font-bold">No projects found matching your criteria.</td>
                  </tr>
                ) : projects.map((project) => (
                  <tr key={project.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                          <img src={project.cover_image || project.image || 'https://via.placeholder.com/800x400?text=No+Image'} className="w-full h-full object-cover" alt="" />
                          {project.featured && (
                            <div className="absolute top-1 left-1 bg-amber-400 p-0.5 rounded shadow-lg"><Star size={8} className="fill-white text-white" /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">{project.name}</p>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-0.5">
                            <MapPin size={10} className="text-emerald-500" />
                            <span className="truncate">{project.location}, {project.city}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StarRating rating={project.rating} size={14} />
                      <span className="text-[10px] font-black text-slate-400 mt-1 block">{project.rating.toFixed(1)} / 5.0</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-900 dark:text-white">₹{project.minimum_investment.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400">Min. Stake</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-emerald-600 font-black">
                        <TrendingUp size={14} />
                        <span className="text-sm">{project.expected_roi}%</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">{project.duration || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4 w-64">
                      <div className="flex justify-between items-center text-[10px] font-black mb-2 uppercase">
                        <span className="text-slate-400">₹{(project.raised_amount / 100000).toFixed(1)}L Raised</span>
                        <span className="text-emerald-600">{Math.round((project.raised_amount / (project.funding_goal || 1)) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, (project.raised_amount / (project.funding_goal || 1)) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border", getStatusColor(project.investment_status))}>
                        {project.investment_status}
                      </span>
                      {!project.is_active && (
                        <span className="ml-2 text-[9px] font-black text-red-500 uppercase">Draft</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/admin/projects/${project.id}`)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                          title="Edit Project"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(project)}
                          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all"
                          title="Duplicate"
                        >
                          <Copy size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <div className="px-6 py-5 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Showing <span className="text-slate-900 dark:text-white">{Math.min(projects.length, rowsPerPage)}</span> of {totalCount} Projects
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 0 || loading}
                onClick={() => setPage(prev => prev - 1)}
                className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
              >
                <ChevronLeft size={18}/>
              </button>
              <button
                disabled={(page + 1) * rowsPerPage >= totalCount || loading}
                onClick={() => setPage(prev => prev + 1)}
                className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl disabled:opacity-30 hover:bg-slate-50 transition-all shadow-sm"
              >
                <ChevronRight size={18}/>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            [1, 2, 3, 4].map(i => <div key={i} className="h-96 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 animate-pulse" />)
          ) : projects.map(project => (
            <div key={project.id} className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
              <div className="relative h-48">
                <img src={project.cover_image || project.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                <div className="absolute top-4 right-4 flex gap-2">
                  <span className={clsx("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md", getStatusColor(project.investment_status))}>
                    {project.investment_status}
                  </span>
                </div>
                {project.featured && (
                  <div className="absolute top-4 left-4 bg-amber-400 text-white px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
                    <Star size={10} className="fill-white" />
                    <span className="text-[10px] font-black uppercase">Featured</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-white font-black text-lg truncate tracking-tight">{project.name}</h3>
                  <p className="text-slate-300 text-xs font-bold flex items-center gap-1 mt-1 truncate">
                    <MapPin size={12} className="text-emerald-400" />
                    {project.location}
                  </p>
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col space-y-4">
                <div className="flex justify-between items-center">
                  <StarRating rating={project.rating} size={14} />
                  <div className="text-emerald-500 font-black text-sm flex items-center gap-1">
                    <TrendingUp size={16} />
                    {project.expected_roi}%
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Funding</span>
                    <span className="text-emerald-500">{Math.round((project.raised_amount / (project.funding_goal || 1)) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(project.raised_amount / (project.funding_goal || 1)) * 100}%` }} />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                  <button
                    onClick={() => navigate(`/admin/projects/${project.id}`)}
                    className="flex-1 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Eye size={14}/> Details
                  </button>
                  <button
                    onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                    className="p-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                  >
                    <Edit2 size={16}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Projects;
