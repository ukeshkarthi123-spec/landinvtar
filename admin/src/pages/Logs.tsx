import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  Clock,
  User,
  Shield,
  Database,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Activity,
  Globe,
  Monitor
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';

interface Log {
  id: string;
  user_id: string | null;
  email: string | null;
  role: string | null;
  module: string;
  action: string;
  description: string | null;
  ip_address: string | null;
  device: string | null;
  browser: string | null;
  status: string;
  created_at: string;
}

const MODULES = ['All', 'User Management', 'KYC', 'Investments', 'Payments', 'Projects', 'Permissions', 'Settings'];

const Logs = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalCount, setUnfilteredCount] = useState(0);
  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('activity_logs')
        .select('*', { count: 'exact' });

      if (moduleFilter !== 'All') {
        query = query.eq('module', moduleFilter);
      }

      if (searchTerm) {
        query = query.or(`email.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,action.ilike.%${searchTerm}%`);
      }

      const { data, error: fetchError, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (fetchError) throw fetchError;
      setLogs(data || []);
      setUnfilteredCount(count || 0);
    } catch (err: any) {
      console.error('[Logs] Fetch Error:', err);
      setError(err.message || 'Failed to load system logs.');
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, searchTerm, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('activity_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setLogs(prev => [payload.new as Log, ...prev].slice(0, pageSize));
        setUnfilteredCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleExport = () => {
    const headers = ['Log ID', 'Timestamp', 'User', 'Role', 'Module', 'Action', 'Description', 'Status', 'IP Address', 'Device'];
    const csvData = logs.map(log => [
      log.id,
      new Date(log.created_at).toLocaleString(),
      log.email || 'System',
      log.role || 'N/A',
      log.module,
      log.action,
      log.description || '',
      log.status,
      log.ip_address || 'N/A',
      log.device || 'N/A'
    ]);

    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `investland_logs_${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Activity Logs</h1>
          <p className="text-slate-500 text-sm">Monitor all system events and user actions in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExport}
            className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-95"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by action, user or description..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            {MODULES.map((m) => (
              <button
                key={m}
                onClick={() => { setModuleFilter(m); setPage(1); }}
                className={clsx(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap",
                  moduleFilter === m
                    ? "bg-emerald-600 text-white shadow-md"
                    : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-10 text-center">
            <div className="inline-flex p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 mb-4">
              <AlertCircle size={24} />
            </div>
            <p className="text-slate-900 dark:text-slate-100 font-bold">{error}</p>
            <button onClick={fetchLogs} className="mt-4 text-emerald-600 font-bold hover:underline">Try Again</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">Event</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Module</th>
                <th className="px-6 py-4">Details</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading && logs.length === 0 ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-500 font-medium">
                    No logs found matching your criteria.
                  </td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        log.status === 'success' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-red-100 text-red-600 dark:bg-red-900/30"
                      )}>
                        <Terminal size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{log.action}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate max-w-[100px]">{log.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                        {log.email?.charAt(0).toUpperCase() || 'S'}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{log.email || 'System'}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-black">{log.role || 'system'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {log.module}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{log.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                      log.status === 'success' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      <Activity size={10} />
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white">
                        <Clock size={12} className="text-slate-400" />
                        {new Date(log.created_at).toLocaleTimeString()}
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {new Date(log.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-slate-500 bg-slate-50/50 dark:bg-slate-800/20 font-medium">
          <div className="flex items-center gap-4">
             <p>Showing <span className="font-bold text-slate-900 dark:text-white">{logs.length}</span> of {totalCount} events</p>
             <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
             <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
               <Globe size={12} className="text-emerald-500" />
               Real-time Monitoring Active
             </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={clsx(
                      "w-10 h-10 rounded-lg text-xs font-bold transition-all",
                      page === p
                        ? "bg-emerald-600 text-white shadow-md"
                        : "bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="flex items-end px-2 pb-2 text-slate-400">...</span>}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Logs;
