import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Wallet,
  Search,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Filter,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar
} from 'lucide-react';
import clsx from 'clsx';
import InvestmentTable from '../components/InvestmentTable';

const ITEMS_PER_PAGE = 10;

const StatItem = ({ title, value, icon: Icon, color, loading }: any) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
    <div className={clsx("p-3 rounded-xl bg-opacity-10", color)}>
      <Icon className={color.replace('bg-', 'text-')} size={24} />
    </div>
    <div>
      <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
      {loading ? (
        <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded mt-1"></div>
      ) : (
        <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{value}</p>
      )}
    </div>
  </div>
);

const InvestmentRecords = () => {
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const fetchInvestmentsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch investments with related data using a single query if possible,
      // but if schema relationships are tricky, use parallel fetching as before for reliability.
      const { data, error: invError } = await supabase
        .from('investments')
        .select(`
          *,
          profiles!investments_user_id_profiles_fkey(id, name, email),
          land_projects!investments_project_id_fkey(id, name, city, image, category)
        `)
        .order('created_at', { ascending: false });

      if (invError) throw invError;
      setInvestments(data || []);
    } catch (err: any) {
      console.error('[Investments] Fetch Error:', err);
      setError(err.message || 'Failed to load investment records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestmentsData();
  }, [fetchInvestmentsData]);

  const filteredInvestments = useMemo(() => {
    return investments.filter(inv => {
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        inv.profiles?.name?.toLowerCase().includes(s) ||
        inv.profiles?.email?.toLowerCase().includes(s) ||
        inv.land_projects?.name?.toLowerCase().includes(s);

      if (statusFilter === 'All') return matchesSearch;
      return matchesSearch && inv.status === statusFilter;
    });
  }, [investments, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredInvestments.length / ITEMS_PER_PAGE);
  const paginatedInvestments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvestments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInvestments, currentPage]);

  const stats = useMemo(() => {
    const totalAmount = investments.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const active = investments.filter(i => i.status === 'Active').length;
    const exited = investments.filter(i => i.status === 'Exited').length;
    const pending = investments.filter(i => i.status === 'Pending').length;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyAmount = investments
      .filter(i => {
        const d = new Date(i.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, inv) => sum + Number(inv.amount), 0);

    return { totalAmount, active, exited, pending, monthlyAmount };
  }, [investments]);

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const headers = ['ID', 'Investor', 'Email', 'Project', 'Amount', 'ROI', 'Status', 'Date'];
      const rows = filteredInvestments.map(inv => [
        inv.id,
        inv.profiles?.name || 'N/A',
        inv.profiles?.email || 'N/A',
        inv.land_projects?.name || 'N/A',
        inv.amount,
        inv.roi_rate,
        inv.status,
        new Date(inv.created_at).toISOString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `investments_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this investment record? This action cannot be undone.')) return;

    try {
      const { error: delError } = await supabase.from('investments').delete().eq('id', id);
      if (delError) throw delError;
      setInvestments(prev => prev.filter(i => i.id !== id));
      alert('Record deleted successfully');
    } catch (err: any) {
      alert('Error deleting record: ' + err.message);
    }
  };

  const handleEdit = (id: string) => {
    // Implement edit logic or open modal
    alert('Edit feature coming soon for ID: ' + id);
  };

  const handleView = (id: string) => {
    // Implement view details logic
    alert('View details for ID: ' + id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Investment Records</h1>
          <p className="text-slate-500 text-sm font-medium">Complete audit trail of all platform investments.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchInvestmentsData}
            disabled={loading}
            className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isExporting || investments.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-black transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {isExporting ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
            Export Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatItem
          title="Total Volume"
          value={`₹${(stats.totalAmount / 100000).toFixed(2)}L`}
          icon={TrendingUp}
          color="bg-purple-600"
          loading={loading}
        />
        <StatItem
          title="Monthly Growth"
          value={`₹${(stats.monthlyAmount / 1000).toFixed(1)}K`}
          icon={Calendar}
          color="bg-blue-600"
          loading={loading}
        />
        <StatItem
          title="Active"
          value={stats.active}
          icon={CheckCircle2}
          color="bg-emerald-600"
          loading={loading}
        />
        <StatItem
          title="Pending"
          value={stats.pending}
          icon={Clock}
          color="bg-orange-600"
          loading={loading}
        />
        <StatItem
          title="Exited"
          value={stats.exited}
          icon={XCircle}
          color="bg-slate-600"
          loading={loading}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/30 dark:bg-slate-800/20">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search investor, email or project..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg mr-2">
               <Filter size={14} className="text-slate-400" />
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filter</span>
            </div>
            {['All', 'Active', 'Pending', 'Exited'].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setCurrentPage(1);
                }}
                className={clsx(
                  "px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap",
                  statusFilter === s
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-10 text-center text-red-600">
            <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-bold text-lg">{error}</p>
            <button onClick={fetchInvestmentsData} className="mt-4 px-6 py-2 bg-red-50 text-red-600 rounded-full font-bold hover:bg-red-100 transition-all">Retry Connection</button>
          </div>
        )}

        <InvestmentTable
          investments={paginatedInvestments}
          loading={loading}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {filteredInvestments.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/20">
            <p className="text-xs text-slate-500 font-bold">
              Showing <span className="text-slate-900 dark:text-white">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> to <span className="text-slate-900 dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredInvestments.length)}</span> of <span className="text-slate-900 dark:text-white">{filteredInvestments.length}</span> records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={clsx(
                      "w-8 h-8 rounded-lg text-xs font-black transition-all",
                      currentPage === i + 1
                        ? 'bg-emerald-600 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestmentRecords;
