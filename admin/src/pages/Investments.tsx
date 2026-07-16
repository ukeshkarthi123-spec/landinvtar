import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Wallet, Search, MapPin, Calendar, RefreshCw, AlertCircle, FileSpreadsheet, Filter } from 'lucide-react';

const Investments = () => {
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchInvestmentsData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch investments first (No joins to avoid schema cache relationship errors)
      const { data: invData, error: invError } = await supabase
        .from('investments')
        .select('*')
        .order('created_at', { ascending: false });

      if (invError) throw invError;
      if (!invData || invData.length === 0) {
        setInvestments([]);
        setLoading(false);
        return;
      }

      // 2. Extract unique IDs for separate fetching
      const userIds = [...new Set(invData.map(i => i.user_id))];
      const projectIds = [...new Set(invData.map(i => i.project_id))];

      // 3. Fetch Profiles and Projects in parallel
      const [profilesRes, projectsRes] = await Promise.all([
        supabase.from('profiles').select('id, name, email').in('id', userIds),
        supabase.from('land_projects').select('id, name, location, city, image, category').in('id', projectIds)
      ]);

      // 4. Map data for quick lookup
      const profileMap = (profilesRes.data || []).reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});
      const projectMap = (projectsRes.data || []).reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});

      // 5. Merge datasets in memory
      const mergedData = invData.map(inv => ({
        ...inv,
        profiles: profileMap[inv.user_id] || { name: 'Unknown User', email: 'N/A' },
        land_projects: projectMap[inv.project_id] || { name: 'Deleted Project', location: 'N/A' }
      }));

      setInvestments(mergedData);
    } catch (err: any) {
      console.error('[Investments] Fetch Error:', err);
      setError(err.message || 'Failed to load investment records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvestmentsData();
  }, []);

  const filteredInvestments = investments.filter(inv => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      inv.profiles?.name?.toLowerCase().includes(s) ||
      inv.profiles?.email?.toLowerCase().includes(s) ||
      inv.land_projects?.name?.toLowerCase().includes(s);

    if (statusFilter === 'All') return matchesSearch;
    return matchesSearch && inv.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investment Records</h1>
          <p className="text-slate-500 text-sm">Monitor all user investments and portfolio status.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchInvestmentsData}
            disabled={loading}
            className="p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20">
            <FileSpreadsheet size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by investor or project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400 mr-1" />
            {['All', 'Active', 'Pending', 'Exited'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === s
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-10 text-center text-red-600">
            <AlertCircle size={32} className="mx-auto mb-4 opacity-50" />
            <p className="font-bold">{error}</p>
            <button onClick={fetchInvestmentsData} className="mt-4 text-emerald-600 font-bold hover:underline">Try Again</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">Investor</th>
                <th className="px-6 py-4">Project Details</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">ROI Rate</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Invested Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredInvestments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500 font-medium">
                    No investment records found.
                  </td>
                </tr>
              ) : filteredInvestments.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{inv.profiles?.name}</p>
                      <p className="text-xs text-slate-500">{inv.profiles?.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img src={inv.land_projects?.image} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{inv.land_projects?.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                          <MapPin size={10} /> {inv.land_projects?.city} • {inv.land_projects?.category}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">₹{Number(inv.amount).toLocaleString('en-IN')}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded text-xs">
                      {inv.roi_rate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      inv.status === 'Active' ? 'bg-blue-100 text-blue-700' :
                      inv.status === 'Exited' ? 'bg-slate-100 text-slate-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500 font-medium whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Calendar size={14} className="text-slate-400" />
                      {new Date(inv.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
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

export default Investments;
