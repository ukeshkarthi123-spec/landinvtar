import { useEffect, useState, useCallback } from 'react';
import {
  Check, X, Eye, Clock, AlertCircle, RefreshCw,
  Search, Loader2, User, ExternalLink, ShieldCheck,
  CreditCard, FileText, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';
import type { KycDocument, Profile } from '../../../types/database';

const KYC = () => {
  const [requests, setRequests] = useState<(KycDocument & { profiles?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedKyc, setSelectedKyc] = useState<(KycDocument & { profiles?: Profile }) | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchKYC = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[KYC Audit] Syncing ledger data...');

      // 1. Fetch raw documents without join first to verify table content
      const { data: rawDocs, error: docError } = await supabase
        .from('kyc_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (docError) throw docError;

      if (!rawDocs || rawDocs.length === 0) {
        console.log('[KYC Audit] No documents found in kyc_documents table.');
        setRequests([]);
        return;
      }

      console.log(`[KYC Audit] Found ${rawDocs.length} records. Fetching user identities...`);

      // 2. Fetch associated profiles manually to bypass join permission issues
      const userIds = rawDocs.map(d => d.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profileError) console.warn('[KYC Audit] Profile lookup warning:', profileError);

      const profileMap = (profiles || []).reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});

      const merged = rawDocs.map(doc => ({
        ...doc,
        profiles: profileMap[doc.user_id] || { name: 'Unknown User', email: 'N/A' }
      }));

      setRequests(merged as any);
    } catch (err: any) {
      console.error('[KYC Audit] Global synchronization failure:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKYC();
  }, [fetchKYC]);

  const updateStatus = async (status: 'approved' | 'rejected', reason?: string) => {
    if (!selectedKyc || isUpdating) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('kyc_documents')
        .update({
          status,
          rejection_reason: reason || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedKyc.id);

      if (error) throw error;
      setIsModalOpen(false);
      fetchKYC();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const filtered = requests.filter(req => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      req.full_name?.toLowerCase().includes(s) ||
      req.pan_number?.toLowerCase().includes(s) ||
      req.aadhaar_number?.toLowerCase().includes(s) ||
      req.profiles?.email?.toLowerCase().includes(s) ||
      req.profiles?.name?.toLowerCase().includes(s);

    if (filter === 'all') return matchSearch;

    // Normalize status for comparison
    const dbStatus = req.status.toLowerCase();
    const filterStatus = filter.toLowerCase();

    return matchSearch && dbStatus === filterStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-[2px]">Identity Audit</h1>
          <p className="text-slate-500 font-medium">Verification gateway for fractional land ownership credentials.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchKYC} className="p-3 bg-white dark:bg-slate-900 border border-slate-100 rounded-2xl hover:text-emerald-500 transition-all shadow-sm">
            <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="px-5 py-3 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 flex items-center gap-3">
             <Clock size={18} className="text-orange-600" />
             <span className="text-sm font-black text-orange-700 uppercase tracking-widest">{requests.filter(r => r.status.toLowerCase() === 'pending').length} PENDING NODES</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input type="text" placeholder="Search Identity (Name, PAN, Aadhaar)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-6 py-3.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white" />
          </div>
          <div className="flex items-center gap-2">
            {['pending', 'approved', 'rejected', 'all'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                    "px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border",
                    filter === f ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 hover:bg-slate-50'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-[2px] font-black">
              <tr>
                <th className="px-8 py-5">Node Identity</th>
                <th className="px-8 py-5">Verification State</th>
                <th className="px-8 py-5">Credential Data</th>
                <th className="px-8 py-5">Timestamp</th>
                <th className="px-8 py-5 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={32} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-slate-400 uppercase font-black text-xs tracking-widest">No KYC records matching filter in ledger</td></tr>
              ) : filtered.map(req => (
                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform"><User size={20} /></div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{req.full_name || req.profiles?.name || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{req.profiles?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={clsx("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                      req.status.toLowerCase() === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      req.status.toLowerCase() === 'pending' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                      'bg-red-50 text-red-700 border-red-100')}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-tighter uppercase">PAN: {req.pan_number}</p>
                        <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 tracking-tighter uppercase">AADHAAR: {req.aadhaar_number}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase">{new Date(req.created_at).toLocaleDateString()}</td>
                  <td className="px-8 py-6 text-right">
                    <button onClick={() => { setSelectedKyc(req); setIsModalOpen(true); }} className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all shadow-sm"><Eye size={20} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {isModalOpen && selectedKyc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-800">
            <div className="px-10 py-8 border-b flex justify-between items-center dark:border-slate-800">
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest">Credential Audit</h2>
                <p className="text-[10px] font-bold text-slate-400 mt-1">Audit Log ID: {selectedKyc.id}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400"><X size={24}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-[3px] text-emerald-500 flex items-center gap-2"><User size={14}/> Identity Details</h3>
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/40 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800">
                    <div className="col-span-2 space-y-1 border-b border-slate-200 dark:border-slate-700 pb-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</p>
                        <p className="text-lg font-black dark:text-white uppercase">{selectedKyc.full_name}</p>
                    </div>
                    <div className="pt-4 space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PAN Number</p>
                        <p className="text-sm font-bold uppercase text-blue-600 tracking-tighter">{selectedKyc.pan_number}</p>
                    </div>
                    <div className="pt-4 space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aadhaar Number</p>
                        <p className="text-sm font-bold uppercase text-purple-600 tracking-tighter">{selectedKyc.aadhaar_number}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[32px] border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] mb-6">Biometric Selfie</p>
                  <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white dark:border-slate-700 shadow-2xl bg-slate-200">
                    <img src={selectedKyc.selfie} className="w-full h-full object-cover transition-transform hover:scale-110 duration-700" alt="Selfie" />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[3px] text-emerald-500">Visual Evidence</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { label: 'PAN FRONT', url: selectedKyc.pan_image },
                    { label: 'AADHAAR FRONT', url: selectedKyc.aadhaar_front },
                    { label: 'AADHAAR BACK', url: selectedKyc.aadhaar_back }
                  ].map((doc, i) => (
                    <div key={i} className="space-y-3 group">
                      <div className="flex justify-between px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{doc.label}</p>
                        {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-emerald-500 transition-colors"><ExternalLink size={12}/></a>}
                      </div>
                      <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 rounded-[24px] overflow-hidden border dark:border-slate-800 relative shadow-sm group-hover:shadow-xl transition-all">
                        {doc.url ? (
                            <img src={doc.url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt={doc.label} />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                <ImageIcon size={32} className="text-slate-300" />
                                <p className="text-[10px] font-black text-slate-400 uppercase">Missing</p>
                            </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-10 border-t bg-slate-50/50 dark:bg-slate-800/30 dark:border-slate-800">
              {selectedKyc.status.toLowerCase() === 'pending' ? (
                <div className="flex gap-6">
                  <button onClick={() => { const r = prompt('Specify rejection parameters:'); if(r) updateStatus('rejected', r); }} disabled={isUpdating} className="flex-1 py-5 border-2 border-red-500/20 text-red-600 rounded-3xl font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 transition-all active:scale-95">Reject Integrity</button>
                  <button onClick={() => updateStatus('approved')} disabled={isUpdating} className="flex-[2] py-5 bg-emerald-600 text-white rounded-3xl font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-4 transition-all active:scale-95">
                    {isUpdating ? <Loader2 className="animate-spin" size={24}/> : <ShieldCheck size={24}/>} Approve Verification
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-8 bg-white dark:bg-slate-900 rounded-[32px] border dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className={clsx("p-3 rounded-2xl", selectedKyc.status.toLowerCase() === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                      {selectedKyc.status.toLowerCase() === 'approved' ? <Check size={24}/> : <X size={24}/>}
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Result</p>
                        <p className="text-lg font-black uppercase dark:text-white">{selectedKyc.status}</p>
                    </div>
                  </div>
                  {selectedKyc.rejection_reason && (
                    <div className="max-w-md text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rejection Trace</p>
                        <p className="text-sm font-bold text-red-500">{selectedKyc.rejection_reason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KYC;
