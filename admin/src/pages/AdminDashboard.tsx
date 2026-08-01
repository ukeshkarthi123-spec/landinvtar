import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Calendar,
  Star,
  Layers,
  CheckCircle2
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

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color, loading, subtitle }: any) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-xl group relative overflow-hidden">
    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
    <div className="flex items-start justify-between mb-4 relative z-10">
      <div className={clsx("p-3 rounded-2xl bg-opacity-10 transition-transform group-hover:scale-110", color)}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
      {!loading && trendValue && (
        <div className={clsx("flex items-center gap-1 text-[10px] font-black uppercase tracking-widest", trend === 'up' ? 'text-emerald-600' : 'text-red-600')}>
          {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trendValue}%
        </div>
      )}
    </div>
    <div className="relative z-10">
      <h3 className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[2px]">{title}</h3>
      {loading ? (
        <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-2"></div>
      ) : (
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black mt-1 text-slate-900 dark:text-white tracking-tighter">{value}</p>
          {subtitle && <span className="text-[10px] font-bold text-slate-400">{subtitle}</span>}
        </div>
      )}
    </div>
  </div>
);

const AdminDashboard = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeProjects: 0,
    totalProjects: 0,
    averageRating: 0,
    averageROI: 0,
    totalFundingGoal: 0,
    totalRaised: 0,
    pendingKYC: 0,
    recentActivities: [] as any[],
    investmentChart: [] as any[]
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, projectsRes, investmentsRes, kycRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('land_projects').select('*'),
        supabase.from('investments').select('amount, created_at'),
        supabase.from('kyc_documents').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(6)
      ]);

      if (usersRes.error) throw usersRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (investmentsRes.error) throw investmentsRes.error;
      if (kycRes.error) throw kycRes.error;
      if (logsRes.error) throw logsRes.error;

      const projects = (projectsRes.data || []) as any[];
      const totalRaised = projects.reduce((sum, p) => sum + Number(p.raised_funding || 0), 0);
      const totalGoal = projects.reduce((sum, p) => sum + Number(p.funding_goal || 0), 0);
      const avgROI = projects.length > 0 ? projects.reduce((sum, p) => sum + Number(p.expected_roi || 0), 0) / projects.length : 0;
      const avgRating = projects.length > 0 ? projects.reduce((sum, p) => sum + Number(p.rating || 0), 0) / projects.length : 0;

      // Aggregating for chart
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentYear = new Date().getFullYear();
      const invByMonth = new Array(12).fill(0);

      (investmentsRes.data || []).forEach(inv => {
        const d = new Date(inv.created_at);
        if (d.getFullYear() === currentYear) invByMonth[d.getMonth()] += Number(inv.amount);
      });

      setStats({
        totalUsers: usersRes.count || 0,
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.is_active === true).length,
        averageRating: avgRating,
        averageROI: avgROI,
        totalFundingGoal: totalGoal,
        totalRaised: totalRaised,
        pendingKYC: kycRes.count || 0,
        recentActivities: logsRes.data || [],
        investmentChart: months.map((m, i) => ({ name: m, amount: invByMonth[i] })).slice(0, new Date().getMonth() + 1)
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
    <div className="space-y-10 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Command Intelligence</h1>
          <p className="text-slate-500 font-medium">Real-time heuristics and platform performance matrix.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchDashboardData} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[20px] hover:text-emerald-500 transition-all shadow-sm">
            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Investors" value={stats.totalUsers.toLocaleString()} icon={UsersIcon} color="bg-blue-600" loading={loading} />
        <StatCard title="Platform AUM" value={`₹${(stats.totalRaised / 100000).toFixed(1)}L`} subtitle={`of ₹${(stats.totalFundingGoal/10000000).toFixed(1)}Cr`} icon={TrendingUp} color="bg-emerald-600" loading={loading} />
        <StatCard title="Active Inventory" value={stats.activeProjects} subtitle={`of ${stats.totalProjects} total`} icon={Layers} color="bg-purple-600" loading={loading} />
        <StatCard title="KYC Queue" value={stats.pendingKYC} icon={ShieldCheck} color="bg-orange-600" loading={loading} />
      </div>

      {/* Secondary Intelligence Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
         <StatCard title="Avg Rating" value={stats.averageRating.toFixed(1)} icon={Star} color="bg-amber-400" loading={loading} />
         <StatCard title="Target ROI" value={`${stats.averageROI.toFixed(1)}%`} icon={IndianRupee} color="bg-emerald-400" loading={loading} />
         <StatCard title="Total Nodes" value={stats.totalProjects} icon={MapPin} color="bg-indigo-400" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Chart Column */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-10 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight uppercase tracking-[2px]">
              <IndianRupee size={20} className="text-emerald-500" />
              Capital Inflow Matrix
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-slate-800 px-4 py-1.5 rounded-full">FY 2026-27</span>
          </div>
          <div className="h-[400px]">
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
                  contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', border: 'none', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorInv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Logs Column */}
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8 flex flex-col relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
           <div className="flex items-center justify-between relative z-10">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight uppercase tracking-[2px]">
              <Activity size={20} className="text-blue-500" />
              Neural Activity
            </h3>
            <button onClick={() => navigate('/admin/logs')} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400"><ChevronRight size={24}/></button>
          </div>
          <div className="space-y-4 flex-1 relative z-10">
            {stats.recentActivities.length === 0 ? (
              <div className="text-center py-20 text-slate-400 space-y-4">
                <Terminal size={48} className="mx-auto opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Pulse...</p>
              </div>
            ) : (
              stats.recentActivities.map((log: any) => (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-3xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 group">
                  <div className={clsx(
                    "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 shadow-sm",
                    log.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                  )}>
                    <Zap size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase tracking-wider">{log.action}</p>
                      <span className="text-[9px] text-slate-400 font-bold">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{log.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => navigate('/admin/logs')}
            className="w-full py-4 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[3px] hover:bg-emerald-500 hover:text-white transition-all"
          >
            Audit History
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
