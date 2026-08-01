export type InvestmentStatus = 'Upcoming' | 'Active' | 'Funded' | 'Completed' | 'Sold Out';

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
  risk_score: 'Low' | 'Medium' | 'High';
  category: 'Residential' | 'Commercial' | 'Farm Land' | 'Industrial' | 'Luxury Villas';
  is_govt_approved: boolean;
  is_verified: boolean;
  timeline: string;
  description: string;
  highlights: string[];
  amenities: any;
  documents: any;
  lat: number | null;
  lng: number | null;
  appreciation_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  rating: number;
  duration: string;
  cover_image: string;
  funding_goal: number;
  gallery_images: string[];
  latitude: number | null;
  longitude: number | null;

  // UI-only helper (not in DB)
  investment_status?: InvestmentStatus;
}

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  featuredProjects: number;
  averageRating: number;
  averageROI: number;
  totalFundingGoal: number;
  totalRaised: number;
  totalInvestors: number;
  completedProjects: number;
}
