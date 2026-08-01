import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, MapPin, TrendingUp, Info,
  IndianRupee, Layers, Calendar, ShieldCheck,
  FileText, ExternalLink, CheckCircle2, AlertCircle,
  LayoutGrid, Download, Clock, File, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { LandProject } from '../types/project';
import StarRating from '../components/StarRating';
import ErrorBoundary from '../components/ErrorBoundary';
import clsx from 'clsx';

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<LandProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('land_projects')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.message.includes('schema cache')) {
          setError('Database schema cache is out of sync. Please notify your administrator to reload the schema.');
        } else {
          throw fetchError;
        }
      }
      setProject(data as LandProject);
    } catch (err: any) {
      console.error('[ProjectDetails] Error:', err);
      setError(err.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Generating Report...</p>
    </div>
  );

  if (error || !project) return (
    <div className="max-w-xl mx-auto p-12 bg-white dark:bg-slate-900 rounded-[40px] border border-red-100 text-center shadow-2xl mt-20">
      <AlertCircle className="mx-auto text-red-500 mb-6" size={64} />
      <h2 className="text-2xl font-black mb-2">Project Not Found</h2>
      <p className="text-slate-500 mb-8">{error || 'The requested project node does not exist in the decentralized ledger.'}</p>
      <button onClick={() => navigate('/admin/projects')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest transition-all hover:bg-black">
        Return to Inventory
      </button>
    </div>
  );

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/admin/projects')}
              className="p-4 bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-emerald-500 shadow-sm transition-all group"
            >
              <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[2px]">Project Audit No: {project.id.slice(0, 8)}</p>
              </div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{project.name}</h1>
            </div>
          </div>

          <button
            onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
            className="flex items-center justify-center gap-3 px-10 py-5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-[24px] text-xs font-black uppercase tracking-[3px] shadow-2xl hover:scale-[1.03] active:scale-95 transition-all"
          >
            <Edit2 size={18} />
            Modify Parameters
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-10">
            {/* Cover & Gallery */}
            <div className="space-y-4">
              <div className="relative h-[500px] w-full rounded-[48px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 group bg-slate-100 dark:bg-slate-800">
                  <img src={project.cover_image || project.image} className="w-full h-full object-cover" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  <div className="absolute bottom-8 left-10 right-10 flex items-end justify-between">
                    <div className="space-y-2">
                      <p className="text-white/80 font-bold flex items-center gap-2">
                        <MapPin size={18} className="text-emerald-400" />
                        {project.location}, {project.city}
                      </p>
                      <StarRating rating={project.rating || 0} size={20} className="mt-2" />
                    </div>
                  </div>
              </div>

              {project.gallery_images && project.gallery_images.length > 0 && (
                <div className="grid grid-cols-4 gap-4">
                  {project.gallery_images.slice(0, 4).map((url, i) => (
                      <div key={i} className="h-24 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm relative group bg-slate-100 dark:bg-slate-800">
                        <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                      </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detailed Info */}
            <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm p-10 space-y-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[4px] text-emerald-500 flex items-center gap-3">
                  <Info size={16} />
                  Executive Summary
                </h3>
                <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap pt-4">
                  {project.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t border-slate-50 dark:border-slate-800">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[3px] text-slate-400">Logistics & Area</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Layers size={20}/></div>
                      <div>
                        <p className="text-xs font-black dark:text-white uppercase tracking-wider">{project.total_area || 'N/A'}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Site Dimension</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Clock size={20}/></div>
                      <div>
                        <p className="text-xs font-black dark:text-white uppercase tracking-wider">{project.duration || project.timeline || 'N/A'}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Holding Period</p>
                      </div>
                    </div>
                  </div>
                </div>

                {project.documents && (project.documents as any[]).length > 0 && (
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[3px] text-slate-400">Legal Documents</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {(project.documents as any[]).map((doc, idx) => (
                        <a
                          key={idx}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group border border-transparent hover:border-emerald-100 dark:hover:border-emerald-800"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-slate-400 group-hover:text-emerald-500 transition-colors">
                              {doc.type?.includes('image') ? <ImageIcon size={18} /> : <File size={18} />}
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{doc.name}</span>
                          </div>
                          <ExternalLink size={14} className="text-slate-300 group-hover:text-emerald-500" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-10 w-full">
            {/* Investment Summary */}
            <div className="bg-slate-900 rounded-[48px] p-8 text-white space-y-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />

              <div className="space-y-2">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[4px]">Financial Blueprint</p>
                <h4 className="text-2xl font-black tracking-tight">Investment Summary</h4>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Min Entry</p>
                    <p className="text-xl font-black">₹{(project.min_investment || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Target Return</p>
                    <p className="text-xl font-black text-emerald-400">{project.expected_roi || 0}%</p>
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-white/40">Funding Liquidity</span>
                    <span className="text-emerald-400">{project.funding_progress}%</span>
                  </div>
                  <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, project.funding_progress)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-white/30 tracking-tight">
                      <span>₹{((project.raised_funding || 0) / 100000).toFixed(1)}L Raised</span>
                      <span>GOAL: ₹{((project.funding_goal || 0) / 10000000).toFixed(1)} Cr</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default ProjectDetails;
