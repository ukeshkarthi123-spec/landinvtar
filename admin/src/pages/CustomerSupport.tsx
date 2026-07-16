import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  LifeBuoy, Search, RefreshCw, AlertCircle, Filter, Send,
  X, Clock, CheckCircle2, AlertTriangle, MessageSquare
} from 'lucide-react';
import clsx from 'clsx';

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

const priorityStyles: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-blue-100 text-blue-700',
  Low: 'bg-slate-100 text-slate-700',
};

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
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const profileMapRef = useRef<Record<string, any>>({});

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
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

      // support_tickets.user_id references auth.users, not profiles directly,
      // so fetch profiles separately and merge (avoids PostgREST embed issues).
      const userIds = [...new Set(ticketData.map(t => t.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const profileMap = (profilesData || []).reduce((acc: any, p) => ({ ...acc, [p.id]: p }), {});
      profileMapRef.current = { ...profileMapRef.current, ...profileMap };

      const merged = ticketData.map(t => ({
        ...t,
        profiles: profileMap[t.user_id] || { name: 'Unknown User', email: 'N/A' },
      }));

      setTickets(merged);
    } catch (err: any) {
      console.error('[CustomerSupport] Fetch Error:', err);
      setError(err.message || 'Failed to load support tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();

    const channel = supabase
      .channel('support_tickets_admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setTickets(prev => prev.filter(t => t.id !== deletedId));
            setSelectedTicket((prev: any) => (prev && prev.id === deletedId ? null : prev));
            return;
          }

          const row = payload.new as any;
          const merged = {
            ...row,
            profiles: profileMapRef.current[row.user_id] || { name: 'Unknown User', email: 'N/A' },
          };

          setTickets(prev => {
            const exists = prev.some(t => t.id === merged.id);
            return exists
              ? prev.map(t => (t.id === merged.id ? merged : t))
              : [merged, ...prev];
          });

          setSelectedTicket((prev: any) => (prev && prev.id === merged.id ? merged : prev));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        t.subject?.toLowerCase().includes(s) ||
        t.profiles?.name?.toLowerCase().includes(s) ||
        t.profiles?.email?.toLowerCase().includes(s) ||
        t.category?.toLowerCase().includes(s);

      if (statusFilter === 'All') return matchesSearch;
      return matchesSearch && t.status === statusFilter;
    });
  }, [tickets, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    open: tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length,
    urgent: tickets.filter(t => t.priority === 'Urgent' && t.status !== 'Resolved' && t.status !== 'Closed').length,
  }), [tickets]);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
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
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setSending(true);
    try {
      const newMessage = {
        sender: 'admin',
        text: replyText.trim(),
        message: replyText.trim(),
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      const updatedMessages = [...(selectedTicket.messages || []), newMessage];

      const { error } = await supabase
        .from('support_tickets')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);

      if (error) throw error;

      const updatedTicket = { ...selectedTicket, messages: updatedMessages };
      setSelectedTicket(updatedTicket);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
      setReplyText('');
    } catch (err: any) {
      alert('Failed to send reply: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customer Support</h1>
          <p className="text-slate-500 text-sm">Manage and respond to user support tickets.</p>
        </div>
        <button
          onClick={fetchTickets}
          disabled={loading}
          className="p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all disabled:opacity-50"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-orange-600 bg-opacity-10"><Clock className="text-orange-600" size={22} /></div>
          <div><p className="text-xs font-bold text-slate-500 uppercase">Open</p><p className="text-xl font-black">{stats.open}</p></div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-600 bg-opacity-10"><MessageSquare className="text-blue-600" size={22} /></div>
          <div><p className="text-xs font-bold text-slate-500 uppercase">In Progress</p><p className="text-xl font-black">{stats.inProgress}</p></div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-600 bg-opacity-10"><CheckCircle2 className="text-emerald-600" size={22} /></div>
          <div><p className="text-xs font-bold text-slate-500 uppercase">Resolved</p><p className="text-xl font-black">{stats.resolved}</p></div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-600 bg-opacity-10"><AlertTriangle className="text-red-600" size={22} /></div>
          <div><p className="text-xs font-bold text-slate-500 uppercase">Urgent</p><p className="text-xl font-black">{stats.urgent}</p></div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by subject, user or category..."
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
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-center">Priority</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div></td>
                  </tr>
                ))
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-slate-500">
                    <LifeBuoy size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                      {tickets.length === 0 ? 'No support tickets yet.' : `No tickets match "${statusFilter}"${searchTerm ? ` and "${searchTerm}"` : ''}.`}
                    </p>
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
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{t.profiles?.name}</p>
                    <p className="text-xs text-slate-500">{t.profiles?.email}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">{t.category}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase', priorityStyles[t.priority] || 'bg-slate-100 text-slate-700')}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase', statusStyles[t.status] || 'bg-slate-100 text-slate-700')}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-slate-500 whitespace-nowrap">
                    {new Date(t.updated_at || t.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
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
                  {selectedTicket.profiles?.name} · {selectedTicket.profiles?.email} · {selectedTicket.category}
                </p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
              {STATUS_FILTERS.filter(s => s !== 'All').map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(selectedTicket.id, s)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-bold rounded-lg transition-all',
                    selectedTicket.status === s ? statusStyles[s] : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <p className="text-sm text-slate-700 dark:text-slate-300">{selectedTicket.description}</p>
              </div>
              {(selectedTicket.messages || []).map((m: any, i: number) => {
                const msgText = m.text ?? m.message ?? '';
                const msgTime = m.timestamp ?? m.created_at ?? null;
                return (
                <div key={i} className={clsx('flex', m.sender === 'admin' ? 'justify-end' : 'justify-start')}>
                  <div className={clsx(
                    'max-w-[75%] rounded-xl p-3 text-sm',
                    m.sender === 'admin' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  )}>
                    <p>{msgText}</p>
                    <p className={clsx('text-[10px] mt-1', m.sender === 'admin' ? 'text-emerald-100' : 'text-slate-400')}>
                      {msgTime ? new Date(msgTime).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="Type a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !sending) handleSendReply(); }}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                onClick={handleSendReply}
                disabled={sending || !replyText.trim()}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50 transition-all"
              >
                {sending ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSupport;
