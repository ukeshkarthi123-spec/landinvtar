import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users as UsersIcon,
  MapPin,
  TrendingUp,
  Wallet,
  Clock,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle,
  Activity,
  Zap,
  ChevronRight,
  Terminal,
  IndianRupee,
  Calendar
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color, loading }: any) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md group">
    <div className="flex items-start justify-between mb-4">
      <div className={clsx("p-3 rounded-xl bg-opacity-10 transition-transform group-hover:scale-110", color)}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
      {!loading && trendValue && (
        <div className={clsx("flex items-center gap-1 text-sm font-black", trend === 'up' ? 'text-emerald-600' : 'text-red-600')}>
          {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {trendValue}%
        </div>
      )}
    </div>
    <h3 className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest">{title}</h3>
    {loading ? (
      <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-2"></div>
    ) : (
      <p className="text-3xl font-black mt-1 text-slate-900 dark:text-white tracking-tighter">{value}</p>
    )}
  </div>
);

const AdminDashboard = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeActive, setRealtimeActive] = useState(false);

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeProjects: 0,
    totalInvestments: 0,
    pendingKYC: 0,
    recentActivities: [] as any[],
    investmentChart: [] as any[],
    userChart: [] as any[]
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, projectsRes, investmentsRes, kycRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('land_projects').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('investments').select('amount, created_at'),
        supabase.from('kyc_documents').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(6)
      ]);

      if (usersRes.error) throw usersRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (investmentsRes.error) throw investmentsRes.error;
      if (kycRes.error) throw kycRes.error;
      if (logsRes.error) throw logsRes.error;

      const totalInvestments = (investmentsRes.data || []).reduce((sum, inv) => sum + Number(inv.amount || 0), 0);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentYear = new Date().getFullYear();
      const invByMonth = new Array(12).fill(0);
      const usersByMonth = new Array(12).fill(0);

      (investmentsRes.data || []).forEach(inv => {
        const d = new Date(inv.created_at);
        if (d.getFullYear() === currentYear) invByMonth[d.getMonth()] += Number(inv.amount);
      });

      const { data: userDates } = await supabase.from('profiles').select('created_at');
      (userDates || []).forEach(u => {
        const d = new Date(u.created_at);
        if (d.getFullYear() === currentYear) usersByMonth[d.getMonth()] += 1;
      });

      setStats({
        totalUsers: usersRes.count || 0,
        activeProjects: projectsRes.count || 0,
        totalInvestments,
        pendingKYC: kycRes.count || 0,
        recentActivities: logsRes.data || [],
        investmentChart: months.map((m, i) => ({ name: m, amount: invByMonth[i] })).slice(0, new Date().getMonth() + 1),
        userChart: months.map((m, i) => ({ name: m, count: usersByMonth[i] })).slice(0, new Date().getMonth() + 1)
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Admin Command Center</h1>
          <p className="text-slate-500 text-sm font-medium">Real-time overview of your investment platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={clsx(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-500",
            realtimeActive ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
          )}>
            <Zap size={14} className={clsx(realtimeActive && "animate-pulse")} />
            <span className="text-[10px] font-black uppercase tracking-widest">Live Monitoring</span>
          </div>
          <button onClick={fetchDashboardData} className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={stats.totalUsers.toLocaleString()} icon={UsersIcon} trend="up" trendValue="12" color="bg-blue-600" loading={loading} />
        <StatCard title="Active Projects" value={stats.activeProjects} icon={MapPin} trend="up" trendValue="4" color="bg-emerald-600" loading={loading} />
        <StatCard title="Investments" value={`₹${(stats.totalInvestments / 100000).toFixed(2)}L`} icon={TrendingUp} trend="up" trendValue="8" color="bg-purple-600" loading={loading} />
        <StatCard title="Pending KYC" value={stats.pendingKYC} icon={ShieldCheck} trend="down" trendValue="15" color="bg-orange-600" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <IndianRupee size={20} className="text-emerald-500" />
              Investment Flow
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">Monthly</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.investmentChart}>
                <defs>
                  <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                <Tooltip
                  contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorInv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
           <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Activity size={20} className="text-blue-500" />
              System Activity
            </h3>
            <button onClick={() => navigate('/admin/logs')} className="text-xs font-black text-emerald-600 hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {stats.recentActivities.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Terminal size={40} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold">Waiting for system events...</p>
              </div>
            ) : (
              stats.recentActivities.map((log: any) => (
                <div key={log.id} className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                  <div className={clsx(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    log.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                  )}>
                    <Zap size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{log.action}</p>
                      <span className="text-[10px] text-slate-400 font-bold">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{log.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
