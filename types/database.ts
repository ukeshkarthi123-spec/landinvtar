export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string | null;
  avatar_url?: string | null;
  kyc_status: 'not_started' | 'pending' | 'approved' | 'rejected' | 'Not Started';
  is_kyc_verified: boolean;
  kyc_verified?: boolean;
  wallet_balance: number;
  role: 'super_admin' | 'admin' | 'user';
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface KycDocument {
  id: string;
  user_id: string;
  pan_number: string;
  aadhaar_number: string;
  pan_image: string;
  aadhaar_front: string;
  aadhaar_back: string;
  selfie: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandProject {
  id: string;
  name: string;
  location: string;
  state: string;
  city: string;
  image: string;
  images: string[];
  total_area: string;
  min_investment: number;
  expected_roi: number;
  funding_progress: number;
  total_funding: number;
  raised_funding: number;
  investors_count: number;
  rating: number;
  duration: string;
  risk_score: 'Low' | 'Medium' | 'High';
  category: 'Residential' | 'Commercial' | 'Farm Land' | 'Industrial' | 'Luxury Villas';
  is_govt_approved: boolean;
  is_verified: boolean;
  timeline: string;
  description: string;
  highlights: string[];
  amenities: { name: string; distance: string; type: string }[];
  documents: any[];
  lat: number | null;
  lng: number | null;
  appreciation_rate: number;
  is_active: boolean;
  created_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  project_id: string;
  amount: number;
  roi_rate: number;
  status: 'Active' | 'Exited' | 'Pending';
  created_at: string;
  updated_at: string;
  lock_in_period: number;
  exit_charge_pct: number;
  land_projects?: Pick<LandProject, 'id' | 'name' | 'location' | 'image' | 'expected_roi' | 'category'>;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: 'credit' | 'debit';
  description: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed';
  reference_id: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  is_read: boolean;
  created_at: string;
}

export interface BankAccount {
  id: string;
  user_id: string;
  account_holder: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch_name: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpiId {
  id: string;
  user_id: string;
  upi_id: string;
  is_verified: boolean;
  is_default: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  category: 'General' | 'Investment' | 'Payment' | 'KYC' | 'Technical';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High';
  messages?: { sender: string; message: string; created_at: string }[];
  profiles?: { name: string; email: string };
  created_at: string;
  updated_at: string;
}

export interface TaxReport {
  id: string;
  user_id: string;
  financial_year: string;
  total_invested: number;
  total_returns: number;
  report_data: Record<string, unknown>;
  status: 'Generating' | 'Ready' | 'Failed';
  created_at: string;
}

export function computeCurrentValue(amount: number, roiRate: number, createdAt: string): number {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const yearsElapsed = (Date.now() - new Date(createdAt).getTime()) / msPerYear;
  return amount * (1 + (roiRate / 100) * yearsElapsed);
}

export function computePortfolioStats(investments: Investment[]): any {
  if (investments.length === 0) {
    return { portfolioValue: 0, totalInvested: 0, totalReturns: 0, returnsPercent: 0, todayGrowth: 0, todayGrowthPercent: 0 };
  }
  const totalInvested = investments.reduce((s, i) => s + i.amount, 0);
  const portfolioValue = investments.reduce((s, i) => s + computeCurrentValue(i.amount, i.roi_rate, i.created_at), 0);
  const totalReturns = portfolioValue - totalInvested;
  const returnsPercent = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

  const avgRoi = investments.reduce((s, i) => s + i.roi_rate, 0) / investments.length;
  const todayGrowthPercent = avgRoi / 365;
  const todayGrowth = portfolioValue * (todayGrowthPercent / 100);

  return {
    portfolioValue: Math.round(portfolioValue * 100) / 100,
    totalInvested,
    totalReturns: Math.round(totalReturns * 100) / 100,
    returnsPercent: Math.round(returnsPercent * 100) / 100,
    todayGrowth: Math.round(todayGrowth * 100) / 100,
    todayGrowthPercent: Math.round(todayGrowthPercent * 100) / 100,
  };
}

export function isKycVerified(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  const status = (profile.kyc_status || '').toLowerCase();
  // Standardize on multiple success variants and boolean flags
  return (
    status === 'approved' ||
    status === 'verified' ||
    profile.is_kyc_verified === true ||
    profile.kyc_verified === true ||
    profile.role === 'admin' ||
    profile.role === 'super_admin'
  );
}

export function canInvest(profile: Profile | null | undefined): boolean {
  return isKycVerified(profile);
}
