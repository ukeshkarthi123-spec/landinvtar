export type InvestmentStatus = 'Upcoming' | 'Active' | 'Funded' | 'Completed' | 'Sold Out';

export interface LandProject {
  id: string;
  name: string;
  project_code: string;
  description: string;
  short_description: string;
  location: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  google_map_url: string;
  latitude: number | null;
  longitude: number | null;

  // Investment
  minimum_investment: number;
  maximum_investment: number;
  target_return: number;
  expected_roi: number;
  duration: string;
  funding_goal: number;
  raised_amount: number;
  available_units: number;
  total_units: number;
  investment_status: InvestmentStatus;
  funding_progress: number; // Percentage

  // Features
  featured: boolean;
  rating: number;
  is_active: boolean;

  // Media
  image: string; // Legacy/Compat
  cover_image: string;
  gallery_images: string[];
  video_url: string;

  // Documents
  brochure_url: string;
  legal_document_url: string;
  dtcp_certificate_url: string;
  rera_certificate_url: string;
  sale_deed_url: string;
  master_plan_url: string;

  created_at: string;
  updated_at: string;
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
