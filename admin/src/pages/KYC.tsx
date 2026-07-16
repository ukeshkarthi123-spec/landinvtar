import { useEffect, useState } from 'react';
import { Shield, Check, X, Eye, Clock, AlertCircle, RefreshCw, Filter, Search, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

const KYC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('Pending');
  const [searchTerm, setSearchTerm] = useState('');

  // Detail Modal State
  const [selectedKyc, setSelectedKyc] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchKYCRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch KYC documents first
      const { data: kycDocs, error: kycError } = await supabase
        .from('kyc_documents')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (kycError) throw kycError;
      if (!kycDocs || kycDocs.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // 2. Fetch profiles separately using the user_ids from kycDocs
      const userIds = [...new Set(kycDocs.map(doc => doc.user_id))];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, phone')
        .in('id', userIds);

      if (profileError) throw profileError;

      // 3. Merge datasets in TypeScript
      const profileMap = (profiles || []).reduce((acc: any, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});

      const mergedData = kycDocs.map(doc => ({
        ...doc,
        profiles: profileMap[doc.user_id] || null
      }));

      setRequests(mergedData);
    } catch (err: any) {
      console.error('Error fetching KYC requests:', err);
      setError(err.message || 'Failed to fetch KYC requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKYCRequests();
  }, []);

  const handleUpdateStatus = async (kycId: string, status: 'Approved' | 'Rejected', reason?: string) => {
    setIsUpdating(true);
    try {
      const { data: kycData, error: updateError } = await supabase
        .from('kyc_documents')
        .update({
          status,
          rejection_reason: reason || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', kycId)
        .select('user_id')
        .single();

      if (updateError) throw updateError;

      // Add a notification for the user
      await supabase.from('notifications').insert({
        user_id: kycData.user_id,
        title: status === 'Approved' ? 'KYC Verified!' : 'KYC Rejected',
        message: status === 'Approved'
          ? 'Your KYC documents have been successfully verified. You can now start investing.'
          : `Your KYC was rejected. Reason: ${reason || 'Incomplete documents'}`,
        type: status === 'Approved' ? 'success' : 'warning'
      });

      setIsModalOpen(false);
      fetchKYCRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to update KYC status');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch =
      req.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.pan_number?.toLowerCase().includes(searchTerm.toLowerCase());

    if (filter === 'All') return matchesSearch;
    return matchesSearch && req.status === filter;
  });

  const openDetails = (kyc: any) => {
    setSelectedKyc(kyc);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KYC Verifications</h1>
          <p className="text-slate-500 text-sm">Review and approve user identity documents.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchKYCRequests}
            className="p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 rounded-lg text-xs font-bold border border-orange-100 dark:border-orange-800">
            <Clock size={14} />
            {requests.filter(r => r.status === 'Pending').length} Pending Requests
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, email or PAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            {['Pending', 'Approved', 'Rejected', 'All'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filter === f
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-10 text-center text-red-600">
            <AlertCircle size={32} className="mx-auto mb-4 opacity-50" />
            <p className="font-bold">{error}</p>
            <button onClick={fetchKYCRequests} className="mt-4 text-emerald-600 font-bold hover:underline">Try Again</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Submitted Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-8">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                    No {filter.toLowerCase()} KYC requests found
                  </td>
                </tr>
              ) : filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{req.profiles?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{req.profiles?.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      req.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : req.status === 'Pending'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {req.status === 'Approved' ? <Check size={12} /> : req.status === 'Pending' ? <Clock size={12} /> : <X size={12} />}
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(req.submitted_at || req.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openDetails(req)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors shadow-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* KYC Detail Modal */}
      {isModalOpen && selectedKyc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold">KYC Document Review</h2>
                <p className="text-sm text-slate-500">{selectedKyc.profiles?.name} ({selectedKyc.profiles?.email})</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20}/></button>
            </div>

            <div className="p-8 overflow-y-auto max-h-[75vh] space-y-8">
              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Identity Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">PAN Number</p>
                      <p className="text-lg font-black font-mono tracking-wider">{selectedKyc.pan_number}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Aadhaar Number</p>
                      <p className="text-lg font-black font-mono tracking-wider">{selectedKyc.aadhaar_number}</p>
                    </div>
                  </div>
                  {selectedKyc.profiles?.phone && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Phone Number</p>
                      <p className="font-bold">{selectedKyc.profiles.phone}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Submission Info</h3>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Date Submitted</p>
                      <p className="font-bold">{new Date(selectedKyc.submitted_at).toLocaleString()}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${selectedKyc.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {selectedKyc.status}
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Images */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Document Previews</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 text-center">PAN Card</p>
                    <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group relative">
                      <img src={selectedKyc.pan_file_url} className="w-full h-full object-contain hover:scale-110 transition-transform duration-500" alt="PAN" />
                      <a href={selectedKyc.pan_file_url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition-opacity">View Full</a>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 text-center">Aadhaar Card</p>
                    <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group relative">
                      <img src={selectedKyc.aadhaar_file_url} className="w-full h-full object-contain hover:scale-110 transition-transform duration-500" alt="Aadhaar" />
                      <a href={selectedKyc.aadhaar_file_url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition-opacity">View Full</a>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 text-center">User Selfie</p>
                    <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group relative">
                      <img src={selectedKyc.selfie_url} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" alt="Selfie" />
                      <a href={selectedKyc.selfie_url} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition-opacity">View Full</a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {selectedKyc.status === 'Pending' && (
                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                  <button
                    onClick={() => {
                      const reason = prompt('Enter rejection reason:', 'Invalid documents');
                      if (reason) handleUpdateStatus(selectedKyc.id, 'Rejected', reason);
                    }}
                    disabled={isUpdating}
                    className="flex-1 py-4 border border-red-200 text-red-600 rounded-[20px] font-black text-sm uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50"
                  >
                    Reject KYC
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedKyc.id, 'Approved')}
                    disabled={isUpdating}
                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-[20px] font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="animate-spin" size={20}/> : <ShieldCheck size={20}/>}
                    Approve Verification
                  </button>
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
