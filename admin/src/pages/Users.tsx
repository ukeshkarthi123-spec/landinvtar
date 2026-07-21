import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Shield,
  Ban,
  Users as UsersIcon,
  X,
  Mail,
  Phone,
  User,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { getSupabaseClient, supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

// --- TYPES ---
interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: 'super_admin' | 'admin' | 'support' | 'user';
  is_admin: boolean;
  kyc_status: string;
  wallet_balance: number;
  created_at: string;
  avatar: string | null;
}

const ROLES = ['user', 'admin', 'support', 'super_admin'];

const Users = () => {
  // --- STATE ---
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'user' as UserProfile['role']
  });

  // --- DATA FETCHING ---
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setUsers(data || []);
    } catch (err: any) {
      console.error('[Users] Fetch Error:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // --- HANDLERS ---
  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_admin: !currentStatus,
          role: !currentStatus ? 'admin' : 'user'
        })
        .eq('id', userId);

      if (updateError) throw updateError;
      fetchUsers();
    } catch (err: any) {
      console.error('[Users] Update Error:', err);
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    // Validation
    if (!formData.name.trim()) return setAddError('Full name is required');
    if (!formData.email.trim()) return setAddError('Email is required');
    if (!formData.password || formData.password.length < 6) return setAddError('Password must be at least 6 characters');

    setIsSubmitting(true);
    try {
      // 1. Create a non-persistent Supabase client to avoid signing out the current admin
      // We use the existing client's URL and Key from the validated instance
      const supabaseUrl = supabase.supabaseUrl;
      const supabaseAnonKey = supabase.supabaseKey;

      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false }
      });

      // 2. Sign up the new user
      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            name: formData.name.trim(),
            full_name: formData.name.trim(),
            phone: formData.phone.trim()
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed - No data returned');

      // 3. The profile is created automatically by a DB trigger in this project.
      // However, if we want to set the ROLE immediately (since trigger defaults to 'user'),
      // we update the profile record that was just created.
      if (formData.role !== 'user') {
        const { error: roleError } = await supabase
          .from('profiles')
          .update({
            role: formData.role,
            is_admin: formData.role === 'admin' || formData.role === 'super_admin'
          })
          .eq('id', authData.user.id);

        if (roleError) console.warn('[Users] Failed to set custom role:', roleError);
      }

      // Success
      setIsAddModalOpen(false);
      setFormData({ name: '', email: '', phone: '', password: '', role: 'user' });
      fetchUsers();
      alert('User created successfully. They can now log in with their credentials.');

    } catch (err: any) {
      console.error('[Users] Creation Error:', err);
      setAddError(err.message || 'Failed to create user account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- FILTERING ---
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm);

    if (filter === 'All') return matchesSearch;
    if (filter === 'Admin') return matchesSearch && (user.is_admin || user.role === 'admin' || user.role === 'super_admin');
    if (filter === 'Verified') return matchesSearch && user.kyc_status === 'Verified';
    if (filter === 'Pending KYC') return matchesSearch && user.kyc_status === 'Pending';
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
          <p className="text-slate-500 text-sm">Manage all platform users, roles, and status.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <UserPlus size={18} />
            Add User
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, email or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            {['All', 'Admin', 'Verified', 'Pending KYC'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  filter === f
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {f}
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
            <button onClick={fetchUsers} className="mt-4 text-emerald-600 font-bold hover:underline">Try Again</button>
          </div>
        )}

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">KYC Status</th>
                <th className="px-6 py-4">Wallet</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800"></div>
                        <div className="space-y-2">
                          <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded"></div>
                          <div className="h-2 w-48 bg-slate-100 dark:bg-slate-800 rounded"></div>
                        </div>
                      </div>
                    </td>
                    <td colSpan={5} className="px-6 py-4">
                      <div className="h-4 bg-slate-50 dark:bg-slate-800 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-500 font-medium">
                    {searchTerm ? `No users matching "${searchTerm}"` : 'No users found in the system.'}
                  </td>
                </tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold overflow-hidden border border-emerald-200 dark:border-emerald-800">
                        {user.avatar && user.avatar.length <= 2 ? user.avatar : <User size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{user.name || 'N/A'}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        {user.phone && <p className="text-[10px] text-slate-400 mt-0.5">{user.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                      user.role === 'admin' || user.role === 'super_admin'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {user.role === 'admin' || user.role === 'super_admin' ? <Shield size={10} strokeWidth={3} /> : <UsersIcon size={10} />}
                      {user.role || 'user'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                      user.kyc_status === 'Verified'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : user.kyc_status === 'Pending'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {user.kyc_status === 'Verified' ? <CheckCircle size={10} strokeWidth={3} /> : user.kyc_status === 'Pending' ? <AlertCircle size={10} strokeWidth={3} /> : <XCircle size={10} strokeWidth={3} />}
                      {user.kyc_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-sm text-slate-900 dark:text-slate-100">
                    ₹{Number(user.wallet_balance || 0).toLocaleString('en-IN')}
                    {user.kyc_status !== 'Verified' && <p className="text-[9px] text-orange-500 font-black uppercase mt-1">Restricted</p>}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                    {new Date(user.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => toggleAdmin(user.id, user.is_admin || user.role === 'admin' || user.role === 'super_admin')}
                        title={user.is_admin ? "Revoke Admin" : "Make Admin"}
                        className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-purple-600 transition-all shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                      >
                        <Shield size={18} />
                      </button>
                      <button className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-600 transition-all shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                        <Ban size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-500 bg-slate-50/50 dark:bg-slate-800/20 font-medium">
          <p>Showing <span className="font-bold text-slate-900 dark:text-slate-100">{filteredUsers.length}</span> of {users.length} users</p>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 font-bold transition-all shadow-sm" disabled>Previous</button>
            <button className="px-4 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 font-bold transition-all shadow-sm" disabled>Next</button>
          </div>
        </div>
      </div>

      {/* --- ADD USER MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <UserPlus size={20} />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create New Account</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-xs font-bold animate-shake">
                  <AlertCircle size={16} />
                  {addError}
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white font-medium"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white font-medium"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              {/* Phone (Optional) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number (Optional)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white font-medium"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Login Password</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    required
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white font-medium font-mono"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assigned Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white font-bold appearance-none cursor-pointer"
                >
                  {ROLES.map(role => (
                    <option key={role} value={role}>{role.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* Footer */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] px-4 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Register User
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
