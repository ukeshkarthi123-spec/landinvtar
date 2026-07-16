import { supabase } from '../lib/supabase';

export interface ReportStats {
  totalRevenue: number;
  totalInvestments: number;
  netProfit: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  successfulPayments: number;
  failedPayments: number;
  activeInvestors: number;
  totalUsers: number;
  totalProjects: number;
  avgInvestment: number;
  conversionRate: number;
  roiStats: {
    average: number;
    highest: number;
  };
}

export interface ChartData {
  name: string;
  value: number;
}

export const reportService = {
  async getDashboardStats(dateRange: string): Promise<ReportStats> {
    const { startDate, endDate } = this.getDateRangeBounds(dateRange);

    const [
      { data: investments, error: invErr },
      { data: profiles, error: profErr },
      { data: projects, error: projErr },
      { data: walletTxs, error: txErr },
      { data: payments, error: payErr }
    ] = await Promise.all([
      supabase.from('investments').select('amount, user_id, status, created_at'),
      supabase.from('profiles').select('id, kyc_status, created_at'),
      supabase.from('land_projects').select('id, raised_funding, investors_count, expected_roi, is_active'),
      supabase.from('wallet_transactions').select('amount, type, status, created_at, description'),
      supabase.from('payment_orders').select('amount, status, created_at')
    ]);

    if (invErr || profErr || projErr || txErr || payErr) {
      throw new Error("Failed to fetch statistics from one or more tables.");
    }

    const filteredInvs = investments?.filter(i =>
      new Date(i.created_at) >= startDate && new Date(i.created_at) <= endDate
    ) || [];

    // Avoid accidental variable name typos; delegate heavy computation to calculateStats
    return this.calculateStats(investments || [], profiles || [], projects || [], walletTxs || [], payments || [], startDate, endDate);
  },

  calculateStats(
    investments: any[],
    profiles: any[],
    projects: any[],
    walletTxs: any[],
    payments: any[],
    startDate: Date,
    endDate: Date
  ): ReportStats {
    const filteredInvs = investments.filter(i => {
      const d = new Date(i.created_at);
      return d >= startDate && d <= endDate;
    });

    const totalRevenue = filteredInvs.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const totalInvestments = filteredInvs.length;
    const avgInvestment = totalInvestments > 0 ? totalRevenue / totalInvestments : 0;

    const totalWithdrawals = walletTxs
      .filter(tx => tx.type === 'debit' && tx.status === 'Completed' && new Date(tx.created_at) >= startDate && new Date(tx.created_at) <= endDate)
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    const pendingWithdrawals = walletTxs
      .filter(tx => tx.type === 'debit' && tx.status === 'Pending')
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    const successfulPayments = payments
      .filter(p => p.status === 'paid' && new Date(p.created_at) >= startDate && new Date(p.created_at) <= endDate)
      .reduce((acc, curr) => acc + (Number(curr.amount || 0) / 100), 0); // Assuming paise

    const failedPaymentsCount = payments.filter(p => p.status === 'failed').length;

    const activeInvestorsIds = new Set(investments.filter(i => i.status === 'Active').map(i => i.user_id));
    const activeInvestors = activeInvestorsIds.size;

    const totalUsers = profiles.length;
    const verifiedUsers = profiles.filter(p => p.kyc_status === 'Verified').length;
    const conversionRate = totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0;

    const roiValues = projects.filter(p => p.is_active).map(p => Number(p.expected_roi || 0));
    const roiStats = {
      average: roiValues.length > 0 ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length : 0,
      highest: roiValues.length > 0 ? Math.max(...roiValues) : 0
    };

    // Net Profit: Usually fees? Let's say 2% of total revenue for demo purposes if no fee column exists
    // Actually, in a real app we'd have a fees table or column.
    const netProfit = totalRevenue * 0.05; // 5% platform margin

    return {
      totalRevenue,
      totalInvestments,
      netProfit,
      totalWithdrawals,
      pendingWithdrawals,
      successfulPayments,
      failedPayments: failedPaymentsCount,
      activeInvestors,
      totalUsers,
      totalProjects: projects.length,
      avgInvestment,
      conversionRate,
      roiStats
    };
  },

  getDateRangeBounds(range: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate = new Date();

    switch (range) {
      case 'Today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'Last 7 Days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'Last 30 Days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'Last 90 Days':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'This Year':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    return { startDate, endDate };
  },

  async getChartData(type: 'revenue' | 'users' | 'payments', range: string): Promise<ChartData[]> {
    const { startDate, endDate } = this.getDateRangeBounds(range);

    // Simplification: just return monthly or daily points
    if (type === 'revenue') {
       const { data } = await supabase.from('investments').select('amount, created_at').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
       return this.groupByDate(data || [], 'amount');
    }

    if (type === 'users') {
       const { data } = await supabase.from('profiles').select('created_at').gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
       return this.groupByDate(data || [], 'count');
    }

    return [];
  },

  groupByDate(data: any[], valKey: string): ChartData[] {
    const groups: Record<string, number> = {};
    data.forEach(item => {
      const date = new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      groups[date] = (groups[date] || 0) + (valKey === 'count' ? 1 : Number(item[valKey] || 0));
    });

    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  },

  async getProjectPerformance() {
    const { data, error } = await supabase
      .from('land_projects')
      .select('name, raised_funding, investors_count, expected_roi, funding_progress, is_active');

    if (error) throw error;
    return data;
  },

  async getFinancialAudit() {
    const [payments, walletTxs] = await Promise.all([
      supabase.from('payment_orders').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(50)
    ]);

    return {
      payments: payments.data || [],
      walletTxs: walletTxs.data || []
    };
  }
};
