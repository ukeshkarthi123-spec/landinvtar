import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  FileText,
  PieChart,
  TrendingUp,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Printer
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import { reportService } from '../services/reportService';
import type { ReportStats, ChartData } from '../services/reportService';
import { exportService } from '../services/exportService';
import clsx from 'clsx';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

const StatCard = ({ label, value, trend, color, loading }: any) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">{label}</p>
    {loading ? (
      <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
    ) : (
      <div className="flex items-end justify-between">
        <h3 className={clsx("text-2xl font-black tracking-tight", color)}>{value}</h3>
        {trend && (
          <span className={clsx("text-xs font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-full",
            trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          )}>
            <ArrowUpRight size={12} className={trend.startsWith('+') ? "" : "rotate-90"} />
            {trend}
          </span>
        )}
      </div>
    )}
  </div>
);

const Reports = () => {
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [revenueChart, setRevenueChart] = useState<ChartData[]>([]);
  const [userChart, setUserChart] = useState<ChartData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [newStats, revData, userData] = await Promise.all([
        reportService.getDashboardStats(dateRange),
        reportService.getChartData('revenue', dateRange),
        reportService.getChartData('users', dateRange)
      ]);

      setStats(newStats);
      setRevenueChart(revData);
      setUserChart(userData);
    } catch (err: any) {
      setError(err.message || "Platform synchronization failure.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleExport = async (type: 'Revenue' | 'Growth' | 'Audit' | 'Projects', format: 'csv' | 'xls' | 'pdf') => {
    try {
      let data: any[] = [];
      let filename = `InvestLand_${type}_${new Date().toISOString().split('T')[0]}`;

      if (type === 'Projects') {
        data = await reportService.getProjectPerformance();
      } else if (type === 'Audit') {
        const audit = await reportService.getFinancialAudit();
        data = [...audit.payments, ...audit.walletTxs];
      } else {
        // Generic fallback data
        data = stats ? [stats] : [];
      }

      if (format === 'pdf') {
        exportService.printPDF('reports-container');
      } else {
        exportService.downloadCSV(data, filename);
      }
    } catch (e) {
      alert("Failed to generate report export.");
    }
  };

  const reportTypes = [
    { id: 'Revenue', name: 'Revenue Report', description: 'Total investments and earnings', icon: TrendingUp },
    { id: 'Growth', name: 'User Growth', description: 'New users and KYC conversion', icon: PieChart },
    { id: 'Projects', name: 'Project Performance', description: 'ROI and funding speed per project', icon: BarChart3 },
    { id: 'Audit', name: 'Financial Audit', description: 'All wallet transactions and withdrawals', icon: FileText },
  ];

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6">
        <div className="p-4 bg-red-50 text-red-600 rounded-3xl border border-red-100 flex items-center gap-3 font-bold">
          <AlertCircle size={24}/> {error}
        </div>
        <button onClick={() => fetchAllData()} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]">
          <RefreshCw size={16}/> Retry Handshake
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20" id="reports-container">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase tracking-[3px]">Intelligence</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-500" />
            Live Platform Analytics & Performance Logs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="pl-10 pr-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
            >
              <option>Today</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
              <option>This Year</option>
            </select>
          </div>
          <button
            onClick={() => fetchAllData(true)}
            disabled={refreshing}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 transition-all text-slate-500"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => handleExport('Audit', 'pdf')}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all active:scale-95"
          >
            <Printer size={16} />
            Snapshot
          </button>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          trend="+12.5%"
          color="text-emerald-600"
          loading={loading}
        />
        <StatCard
          label="Avg Investment"
          value={formatCurrency(stats?.avgInvestment || 0)}
          trend="-2.1%"
          color="text-blue-600"
          loading={loading}
        />
        <StatCard
          label="Withdrawals"
          value={formatCurrency(stats?.totalWithdrawals || 0)}
          color="text-orange-600"
          loading={loading}
        />
        <StatCard
          label="Conversion"
          value={`${Math.round(stats?.conversionRate || 0)}%`}
          trend="+5.4%"
          color="text-purple-600"
          loading={loading}
        />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <SectionHeader title="Capital Growth" icon={TrendingUp} />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChart}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(v) => formatCurrency(Number(v))}
                />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <SectionHeader title="Acquisition" icon={PieChart} />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {userChart.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* GENERATORS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black uppercase tracking-widest tracking-[3px]">Generate Custom Nodes</h3>
            <Filter size={18} className="text-slate-400" />
          </div>
          <div className="space-y-4">
            {reportTypes.map((report) => (
              <div
                key={report.id}
                onClick={() => handleExport(report.id as any, 'csv')}
                className="group p-5 bg-slate-50 dark:bg-slate-800/40 rounded-[28px] border border-transparent hover:border-emerald-500 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-5">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl group-hover:text-emerald-500 transition-colors shadow-sm">
                    <report.icon size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{report.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{report.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-300 group-hover:text-emerald-500 transition-all translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100">
                  <span className="text-[10px] font-black uppercase tracking-widest">CSV</span>
                  <Download size={18} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-xl font-black uppercase tracking-widest tracking-[3px] mb-8">Platform Health</h3>
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">KYC Conversion</span>
                <span className="text-sm font-black text-emerald-500">{Math.round(stats?.conversionRate || 0)}%</span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats?.conversionRate}%` }} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Successful Payments</span>
                <span className="text-sm font-black text-blue-500">{stats?.successfulPayments.toLocaleString()} Success</span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '88%' }} />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 dark:border-slate-800 grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Active Investors</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{stats?.activeInvestors.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Failed Payments</p>
                <p className="text-lg font-black text-red-500">{stats?.failedPayments.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
  <div className="flex items-center justify-between mb-8">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
        <Icon size={18} />
      </div>
      <h3 className="text-sm font-black uppercase tracking-widest tracking-[3px] text-slate-900 dark:text-white">{title}</h3>
    </div>
    <div className="flex gap-1">
      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
    </div>
  </div>
);

export default Reports;
