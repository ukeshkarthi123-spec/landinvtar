import { supabase } from './supabase';

export interface KycStatusResult {
  isVerified: boolean;
  isPending: boolean;
  status: 'not_started' | 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
}

/**
 * Single source of truth for KYC status.
 * Fetches fresh data from BOTH 'profiles' and 'kyc_documents' tables.
 */
export async function getFreshKycStatus(userId: string): Promise<KycStatusResult> {
  try {
    console.log(`[KYC Service] Fetching fresh status for user: ${userId}`);

    // Fetch both in parallel for speed
    const [profileRes, docRes] = await Promise.all([
      supabase.from('profiles').select('kyc_status, is_kyc_verified').eq('id', userId).single(),
      supabase.from('kyc_documents').select('status, rejection_reason').eq('user_id', userId).maybeSingle()
    ]);

    const profileStatus = (profileRes.data?.kyc_status || 'not_started').toLowerCase();
    const docStatus = (docRes.data?.status || 'not_started').toLowerCase();

    console.log('[KYC Service] Raw Data:', {
      profileStatus,
      profileVerified: profileRes.data?.is_kyc_verified,
      docStatus,
      rejectionReason: docRes.data?.rejection_reason
    });

    // A user is verified if EITHER table says so (case-insensitive)
    const isVerified =
      profileStatus === 'approved' ||
      profileStatus === 'verified' ||
      docStatus === 'approved' ||
      docStatus === 'verified' ||
      profileRes.data?.is_kyc_verified === true;

    // A user is pending if not verified AND either says pending
    const isPending = !isVerified && (profileStatus === 'pending' || docStatus === 'pending');

    // Final consolidated status
    let finalStatus: KycStatusResult['status'] = 'not_started';
    if (isVerified) finalStatus = 'approved';
    else if (isPending) finalStatus = 'pending';
    else if (profileStatus === 'rejected' || docStatus === 'rejected') finalStatus = 'rejected';

    const result = {
      isVerified,
      isPending,
      status: finalStatus,
      rejectionReason: docRes.data?.rejection_reason || null
    };

    console.log('[KYC Service] Final Decision:', result);
    return result;
  } catch (err) {
    console.error('[KYC Service] Critical failure:', err);
    return { isVerified: false, isPending: false, status: 'not_started' };
  }
}
