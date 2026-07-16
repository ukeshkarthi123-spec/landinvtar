import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, Search, Trash2, CheckCircle, Clock, AlertCircle, RefreshCw, X, Send, Loader2 } from 'lucide-react';

interface Profile {
  id: string;
  name: string;
  email: string;
}

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  is_read: boolean;
  created_at: string;
  profile?: Profile;
}

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [targetUser, setTargetUser] = useState('all'); // 'all' or specific user ID
  const [newNotif, setNewNewNotif] = useState({
    title: '',
    message: '',
    type: 'info' as const
  });

  const fetchNotificationsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch raw notifications
      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (notifError) throw notifError;
      console.log("Notifications Raw:", notifData);

      if (!notifData || notifData.length === 0) {
        setNotifications([]);
        return;
      }

      // 2. Extract unique user IDs and fetch profiles separately
      const userIds = [...new Set(notifData.map(n => n.user_id))];
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profileError) throw profileError;
      console.log("Profiles for Notifications:", profileData);

      // 3. Create lookup map
      const profileMap = Object.fromEntries(
        (profileData || []).map(p => [p.id, p])
      );

      // 4. Merge data
      const merged: Notification[] = notifData.map(n => ({
        ...n,
        profile: profileMap[n.user_id]
      }));

      setNotifications(merged);
    } catch (err: any) {
      console.error("[Notifications] Fetch Error:", err);
      setError(err.message || "Failed to load system notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotificationsData();
  }, [fetchNotificationsData]);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      if (targetUser === 'all') {
        // Fetch all user IDs to send global notification
        const { data: users } = await supabase.from('profiles').select('id');
        if (!users) throw new Error("No users found to notify.");

        const batch = users.map(u => ({
          user_id: u.id,
          title: newNotif.title,
          message: newNotif.message,
          type: newNotif.type
        }));

        const { error } = await supabase.from('notifications').insert(batch);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('notifications').insert({
          user_id: targetUser,
          title: newNotif.title,
          message: newNotif.message,
          type: newNotif.type
        });
        if (error) throw error;
      }

      setIsModalOpen(false);
      setNewNewNotif({ title: '', message: '', type: 'info' });
      fetchNotificationsData();
    } catch (err: any) {
      alert(err.message || "Failed to send notification.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this notification log?")) return;
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    const s = searchTerm.toLowerCase();
    return (
      notif.title?.toLowerCase().includes(s) ||
      notif.message?.toLowerCase().includes(s) ||
      notif.profile?.name?.toLowerCase().includes(s) ||
      notif.profile?.email?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Notifications</h1>
          <p className="text-slate-500 text-sm">Platform-wide alert history and communication.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchNotificationsData} disabled={loading} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all"
          >
            <Bell size={18} />
            Send Notification
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by title, message or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {error && (
          <div className="p-10 text-center">
            <AlertCircle size={40} className="mx-auto text-red-500 mb-4 opacity-20" />
            <p className="text-red-600 font-bold">{error}</p>
            <button onClick={fetchNotificationsData} className="mt-4 text-emerald-600 font-bold hover:underline">Try Again</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Notification Details</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse h-20 bg-slate-50/20 dark:bg-slate-800/10"><td colSpan={5}/></tr>
                ))
              ) : filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold">
                    {searchTerm ? "No results matching your search." : "No system notifications found."}
                  </td>
                </tr>
              ) : filteredNotifications.map((notif) => (
                <tr key={notif.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{notif.profile?.name || 'User'}</p>
                      <p className="text-[11px] text-slate-500">{notif.profile?.email || notif.user_id.slice(0, 8)}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${
                        notif.type === 'success' ? 'bg-emerald-500' :
                        notif.type === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
                      }`} />
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{notif.title}</p>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{notif.message}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {notif.is_read ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                        <CheckCircle size={12} /> Read
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
                        <Clock size={12} /> New
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                    {new Date(notif.created_at).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(notif.id)}
                      className="p-2 text-slate-300 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send Notification Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">New Notification</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>

            <form onSubmit={handleSendNotification} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Send To</label>
                  <select
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold appearance-none"
                  >
                    <option value="all">All Registered Users</option>
                    {/* In a real app, you might have a user search here */}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Alert Level</label>
                  <div className="flex gap-2">
                    {['info', 'success', 'warning'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewNewNotif({...newNotif, type: type as any})}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                          newNotif.type === type
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Notification Title</label>
                  <input
                    required
                    type="text"
                    value={newNotif.title}
                    onChange={e => setNewNewNotif({...newNotif, title: e.target.value})}
                    placeholder="e.g. New Project Launch!"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Message Content</label>
                  <textarea
                    required
                    rows={3}
                    value={newNotif.message}
                    onChange={e => setNewNewNotif({...newNotif, message: e.target.value})}
                    placeholder="Briefly explain the update..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSending ? <Loader2 className="animate-spin" size={20}/> : <Send size={18}/>}
                  Broadcast Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
