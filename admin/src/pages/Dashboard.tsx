import { useEffect, useState, useCallback, useRef } from 'react';
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
  Terminal
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
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
    <div className="flex items-start justify-between mb-4">
      <div className={clsx("p-2 rounded-lg bg-opacity-10", color)}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
      {!loading && trendValue && (
        <div className={clsx("flex items-center gap-1 text-sm font-medium", trend === 'up' ? 'text-emerald-600' : 'text-red-600')}>
          {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {trendValue}%
        </div>
      )}
    </div>
    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</h3>
    {loading ? (
      <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-1"></div>
    ) : (
      <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{value}</p>
    )}
  </div>
);

const Dashboard = () => {
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
      // 1. Basic Stats
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

      // 2. Process Logs for Activities
      const activities = (logsRes.data || []).map(log => ({
        id: log.id,
        type: log.module,
        description: log.description,
        created_at: log.created_at,
        status: log.status,
        user: log.email || 'System',
        action: log.action
      }));

      // 3. Chart Data (Monthly aggregation)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentYear = new Date().getFullYear();

      const invByMonth = new Array(12).fill(0);
      const usersByMonth = new Array(12).fill(0);

      (investmentsRes.data || []).forEach(inv => {
        const d = new Date(inv.created_at);
        if (d.getFullYear() === currentYear) {
          invByMonth[d.getMonth()] += Number(inv.amount);
        }
      });

      const { data: userDates } = await supabase.from('profiles').select('created_at');
      (userDates || []).forEach(u => {
        const d = new Date(u.created_at);
        if (d.getFullYear() === currentYear) {
          usersByMonth[d.getMonth()] += 1;
        }
      });

      const investmentChart = months.map((m, i) => ({ name: m, amount: invByMonth[i] })).slice(0, new Date().getMonth() + 1);
      const userChart = months.map((m, i) => ({ name: m, count: usersByMonth[i] })).slice(0, new Date().getMonth() + 1);

      setStats({
        totalUsers: usersRes.count || 0,
        activeProjects: projectsRes.count || 0,
        totalInvestments,
        pendingKYC: kycRes.count || 0,
        recentActivities: activities,
        investmentChart,
        userChart
      });
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time subscription for the "Live Feed"
  useEffect(() => {
    const channel = supabase
      .channel('dashboard_activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setStats(prev => ({
          ...prev,
          recentActivities: [payload.new, ...prev.recentActivities].slice(0, 6)
        }));
        setRealtimeActive(true);
        setTimeout(() => setRealtimeActive(false), 3000);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Dashboard] Real-time monitoring active');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
          <p className="text-slate-500 text-sm">Real-time platform performance metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={clsx(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-500",
            realtimeActive
              ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800"
              : "bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800"
          )}>
            <Zap size={14} className={clsx(realtimeActive && "animate-bounce")} />
            <span className="text-[10px] font-black uppercase tracking-widest">Live Feed</span>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={fetchDashboardData} className="ml-auto text-xs font-bold underline">Try Again</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={UsersIcon}
          trend="up"
          trendValue="12"
          color="bg-blue-600"
          loading={loading}
        />
        <StatCard
          title="Active Projects"
          value={stats.activeProjects}
          icon={MapPin}
          trend="up"
          trendValue="4"
          color="bg-emerald-600"
          loading={loading}
        />
        <StatCard
          title="Total Investments"
          value={`₹${(stats.totalInvestments / 100000).toFixed(2)}L`}
          icon={TrendingUp}
          trend="up"
          trendValue="8"
          color="bg-purple-600"
          loading={loading}
        />
        <StatCard
          title="Pending KYC"
          value={stats.pendingKYC}
          icon={ShieldCheck}
          trend="down"
          trendValue="15"
          color="bg-orange-600"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Investment Volume (INR)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.investmentChart}>
                <defs>
                  <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b'}} />
                <Tooltip
                  contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', border: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`, borderRadius: '12px' }}
                  itemStyle={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">User Signups</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.userChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b'}} />
                <Tooltip
                  contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#fff', border: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`, borderRadius: '12px' }}
                  itemStyle={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}
                  formatter={(value: any) => [value, 'Users']}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-500" size={20} />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Activities</h3>
          </div>
          <button
            onClick={() => navigate('/admin/logs')}
            className="text-emerald-600 text-sm font-bold hover:underline flex items-center gap-1 transition-all"
          >
            View all logs
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="p-4 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded"></div>
                  </div>
                </div>
                <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 rounded"></div>
              </div>
            ))
          ) : stats.recentActivities.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
                <Terminal size={32} />
              </div>
              <p className="text-slate-500 font-medium max-w-xs mx-auto">No recent system activities detected. Events will appear here in real-time as they occur.</p>
            </div>
          ) : (
            stats.recentActivities.map((activity, idx) => (
              <div key={activity.id || idx} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                    activity.status === 'success' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" : "bg-red-50 text-red-600 dark:bg-red-900/30"
                  )}>
                    {activity.type === 'Investments' ? <TrendingUp size={20} /> :
                     activity.type === 'Payments' ? <Wallet size={20} /> :
                     activity.type === 'KYC' ? <ShieldCheck size={20} /> :
                     <Activity size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <p className="text-sm font-bold text-slate-900 dark:text-white">{activity.action}</p>
                       <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase tracking-tighter">
                         {activity.type}
                       </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{activity.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(activity.created_at).toLocaleString()} by <span className="font-bold text-slate-500 dark:text-slate-300">{activity.user}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={clsx(
                    "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                    activity.status === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}>
                    {activity.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        {stats.recentActivities.length > 0 && (
           <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[2px]">Real-time system monitoring enabled</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
