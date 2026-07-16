import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowDownCircle, Search, Check, X, Clock, Banknote, RefreshCw, AlertCircle, Filter } from 'lucide-react';

const Withdrawals = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('Pending');

  const fetchWithdrawalsData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch debit transactions
      const { data: txData, error: txError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('type', 'debit')
        .order('created_at', { ascending: false });

      if (txError) throw txError;
      if (!txData || txData.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // 2. Fetch profiles separately
      const userIds = [...new Set(txData.map(t => t.user_id))];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      // 3. Merge
      const profileMap = (profiles || []).reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});
      const mergedData = txData.map(tx => ({
        ...tx,
        profiles: profileMap[tx.user_id] || { name: 'Unknown User', email: 'N/A' }
      }));

      setRequests(mergedData);
    } catch (err: any) {
      console.error('[Withdrawals] Fetch Error:', err);
      setError(err.message || 'Failed to fetch withdrawal requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawalsData();
  }, []);

  const handleUpdateStatus = async (id: string, status: 'Completed' | 'Failed') => {
    try {
      const { error } = await supabase
        .from('wallet_transactions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      fetchWithdrawalsData();
    } catch (err: any) {
      alert(err.message || 'Failed to update withdrawal status');
    }
  };

  const filteredRequests = requests.filter(req => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      req.profiles?.name?.toLowerCase().includes(s) ||
      req.profiles?.email?.toLowerCase().includes(s) ||
      req.reference_id?.toLowerCase().includes(s);

    if (filter === 'All') return matchesSearch;
    return matchesSearch && req.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Withdrawal Requests</h1>
          <p className="text-slate-500 text-sm">Review and process bank transfer requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchWithdrawalsData}
            disabled={loading}
            className="p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
            {['Pending', 'Completed', 'Failed', 'All'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  filter === f
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by User or Reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="p-10 text-center text-red-600 bg-red-50/20">
            <AlertCircle size={32} className="mx-auto mb-4 opacity-50" />
            <p className="font-bold">{error}</p>
            <button onClick={fetchWithdrawalsData} className="mt-4 text-emerald-600 font-bold hover:underline">Try Again</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Bank Reference</th>
                <th className="px-6 py-4 text-right">Request Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading...</td>
                  </tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500 font-medium">
                    No {filter.toLowerCase()} withdrawal requests found.
                  </td>
                </tr>
              ) : filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{req.profiles?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500 font-medium">{req.profiles?.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-bold text-red-600">₹{Number(req.amount).toLocaleString('en-IN')}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      req.status === 'Completed'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : req.status === 'Failed'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {req.status === 'Completed' ? <Check size={12} /> : req.status === 'Failed' ? <X size={12} /> : <Clock size={12} />}
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded inline-block">
                      {req.reference_id || 'PENDING'}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500 font-medium whitespace-nowrap">
                    {new Date(req.created_at).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {req.status === 'Pending' ? (
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Completed')}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                        >
                          <Check size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Failed')}
                          className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 text-[10px] font-bold uppercase rounded-lg hover:bg-red-600 hover:text-white transition-all border border-red-200 dark:border-red-800"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <Search size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Withdrawals;
