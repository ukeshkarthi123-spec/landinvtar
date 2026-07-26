import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, MapPin, TrendingUp, Info, Star,
  IndianRupee, Layers, Calendar, Globe, ShieldCheck,
  FileText, ExternalLink, Video, CheckCircle2, AlertCircle,
  LayoutGrid, Download, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LandProject } from '../types/project';
import StarRating from '../components/StarRating';
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

      if (fetchError) throw fetchError;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Upcoming': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Active': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Funded': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'Completed': return 'bg-slate-50 text-slate-600 border-slate-100';
      case 'Sold Out': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-slate-50 text-slate-600';
    }
  };

  return (
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
              <span className={clsx("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border", getStatusColor(project.investment_status))}>
                {project.investment_status}
              </span>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[2px]">Project Audit No: {project.project_code || 'N/A'}</p>
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
             <div className="relative h-[500px] w-full rounded-[48px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 group">
                <img src={project.cover_image || project.image} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                <div className="absolute bottom-8 left-10 right-10 flex items-end justify-between">
                  <div className="space-y-2">
                    <p className="text-white/80 font-bold flex items-center gap-2">
                      <MapPin size={18} className="text-emerald-400" />
                      {project.location}, {project.city}
                    </p>
                    <StarRating rating={project.rating} size={20} className="mt-2" />
                  </div>
                  {project.video_url && (
                     <a href={project.video_url} target="_blank" rel="noreferrer" className="p-4 bg-white/20 backdrop-blur-xl rounded-full text-white hover:scale-110 transition-all border border-white/30">
                       <Video size={24} />
                     </a>
                  )}
                </div>
             </div>

             {project.gallery_images && project.gallery_images.length > 0 && (
               <div className="grid grid-cols-4 gap-4">
                 {project.gallery_images.slice(0, 4).map((url, i) => (
                    <div key={i} className="h-24 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm relative group">
                      <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                      {i === 3 && project.gallery_images.length > 4 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-xs">
                          +{project.gallery_images.length - 4} MORE
                        </div>
                      )}
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
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-relaxed italic border-l-4 border-emerald-500 pl-6">
                "{project.short_description || 'A premium high-yield land investment opportunity in the heart of strategic growth corridor.'}"
              </p>
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
                      <p className="text-xs font-black dark:text-white uppercase tracking-wider">{project.total_area || '63 Acres'}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Site Dimension</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Clock size={20}/></div>
                    <div>
                      <p className="text-xs font-black dark:text-white uppercase tracking-wider">{project.duration || '24 Months'}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Holding Period</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Globe size={20}/></div>
                    <div>
                      <p className="text-xs font-black dark:text-white uppercase tracking-wider">{project.city}, {project.state}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Jurisdiction</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[3px] text-slate-400">Inventory Status</h3>
                <div className="space-y-4">
                   <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><LayoutGrid size={20}/></div>
                    <div>
                      <p className="text-xs font-black dark:text-white uppercase tracking-wider">{project.total_units || '0'}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Total Fractional Blocks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500"><CheckCircle2 size={20}/></div>
                    <div>
                      <p className="text-xs font-black dark:text-white uppercase tracking-wider">{project.available_units || '0'}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Unallocated Supply</p>
                    </div>
                  </div>
                </div>
              </div>
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
                   <p className="text-xl font-black">₹{project.minimum_investment.toLocaleString()}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Max Cap</p>
                   <p className="text-xl font-black">₹{project.maximum_investment?.toLocaleString() || '∞'}</p>
                 </div>
              </div>

              <div className="flex justify-between items-end border-b border-white/10 pb-4">
                 <div>
                   <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Target Return</p>
                   <p className="text-xl font-black text-emerald-400">{project.target_return}%</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">Annual ROI</p>
                   <p className="text-xl font-black text-emerald-400">{project.expected_roi}%</p>
                 </div>
              </div>

              <div className="space-y-3 pt-4">
                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                   <span className="text-white/40">Funding Liquidity</span>
                   <span className="text-emerald-400">{Math.round((project.raised_amount / (project.funding_goal || 1)) * 100)}%</span>
                 </div>
                 <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                   <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, (project.raised_amount / (project.funding_goal || 1)) * 100)}%` }}
                   />
                 </div>
                 <div className="flex justify-between text-[10px] font-bold text-white/30 tracking-tight">
                    <span>₹{(project.raised_amount / 100000).toFixed(1)}L Raised</span>
                    <span>GOAL: ₹{(project.funding_goal / 1000000).toFixed(1)} Cr</span>
                 </div>
              </div>
            </div>

            <a
              href={project.google_map_url || '#'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-3 w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[3px] transition-all"
            >
              <MapPin size={16} className="text-emerald-400" />
              Satellite View
            </a>
          </div>

          {/* Compliance & Docs */}
          <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-100 dark:border-slate-800 p-8 space-y-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[3px] text-slate-400 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500" />
              Legal Authorization
            </h3>

            <div className="space-y-4">
              {[
                { label: 'Platform Brochure', url: project.brochure_url },
                { label: 'Legal Audit Report', url: project.legal_document_url },
                { label: 'DTCP Certificate', url: project.dtcp_certificate_url },
                { label: 'RERA Registration', url: project.rera_certificate_url },
                { label: 'Draft Sale Deed', url: project.sale_deed_url },
                { label: 'Master Layout Plan', url: project.master_plan_url },
              ].map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-transparent hover:border-emerald-500/30 transition-all group">
                   <div className="flex items-center gap-3">
                     <FileText size={18} className={clsx(doc.url ? "text-emerald-500" : "text-slate-300")} />
                     <span className={clsx("text-xs font-bold", doc.url ? "text-slate-800 dark:text-slate-200" : "text-slate-400")}>{doc.label}</span>
                   </div>
                   {doc.url ? (
                     <a href={doc.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-emerald-500 transition-colors">
                       <Download size={14} />
                     </a>
                   ) : (
                     <span className="text-[8px] font-black text-slate-300 uppercase">Awaiting</span>
                   )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
