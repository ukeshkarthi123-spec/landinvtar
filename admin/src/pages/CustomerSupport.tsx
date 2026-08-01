import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  LifeBuoy, Search, RefreshCw, AlertCircle, Filter,
  X, Clock, CheckCircle2, AlertTriangle, ChevronRight
} from 'lucide-react';
import clsx from 'clsx';

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

const statusStyles: Record<string, string> = {
  Open: 'bg-orange-100 text-orange-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Resolved: 'bg-emerald-100 text-emerald-700',
  Closed: 'bg-slate-100 text-slate-700',
};

const CustomerSupport = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch tickets first (Robust method to avoid relationship detection errors)
      const { data: ticketData, error: ticketError } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (ticketError) throw ticketError;
      if (!ticketData || ticketData.length === 0) {
        setTickets([]);
        setLoading(false);
        return;
      }

      // 2. Extract user IDs
      const userIds = [...new Set(ticketData.map(t => t.user_id))];

      // 3. Fetch profiles separately
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profileError) {
        console.warn('[CustomerSupport] Profile fetch warning:', profileError);
      }

      // 4. Merge in memory
      const profileMap = (profileData || []).reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});
      const merged = ticketData.map(ticket => ({
        ...ticket,
        profiles: profileMap[ticket.user_id] || { name: 'Unknown User', email: 'N/A' }
      }));

      setTickets(merged);
    } catch (err: any) {
      console.error('[CustomerSupport] Global Fetch Error:', err);
      setError(err.message || 'Failed to load support tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        t.subject?.toLowerCase().includes(s) ||
        t.profiles?.name?.toLowerCase().includes(s) ||
        t.profiles?.email?.toLowerCase().includes(s);

      if (statusFilter === 'All') return matchesSearch;
      return matchesSearch && t.status === statusFilter;
    });
  }, [tickets, searchTerm, statusFilter]);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;

      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support Management</h1>
          <p className="text-slate-500 text-sm">Review and respond to customer inquiries.</p>
        </div>
        <button
          onClick={fetchTickets}
          disabled={loading}
          className="p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all disabled:opacity-50"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search subject or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-slate-400 mr-1" />
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                  statusFilter === s ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'
                )}
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
            <button onClick={fetchTickets} className="mt-4 text-emerald-600 font-bold hover:underline">Try Again</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Created At</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-slate-500">
                    <LifeBuoy size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No tickets found.</p>
                  </td>
                </tr>
              ) : filteredTickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100 max-w-xs truncate">{t.subject}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{t.profiles?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{t.profiles?.email}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase', statusStyles[t.status] || 'bg-slate-100 text-slate-700')}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500 whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400">
                    <ChevronRight size={18} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTicket(null)}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTicket.subject}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  From: {selectedTicket.profiles?.name} ({selectedTicket.profiles?.email}) · {new Date(selectedTicket.created_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-100 dark:border-slate-800">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Update Status</h4>
                  <div className="flex gap-2">
                    {STATUS_FILTERS.filter(s => s !== 'All').map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(selectedTicket.id, s)}
                        disabled={updating}
                        className={clsx(
                          'px-4 py-2 text-xs font-bold rounded-xl transition-all border',
                          selectedTicket.status === s
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSupport;
