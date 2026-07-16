import { supabase } from './supabase';

export interface LandValueRequest {
  todayValue: number;
  growthRate: number;
}

export interface LandValueData {
  todayValue: number;
  growthRate: number;
  tomorrowValue: number;
  growthAmount: number;
}

export interface LandValueResponse {
  success: boolean;
  data?: LandValueData;
  error?: string;
}

/**
 * Calculate tomorrow's land value based on today's value and growth rate
 * Formula: Tomorrow's Value = Today's Value × (1 + (Growth Rate / 100))
 *
 * @param todayValue - Current land value in ₹
 * @param growthRate - Daily growth rate as a percentage (e.g., 0.001 for 0.001%)
 * @returns Promise with calculated values and growth amount
 *
 * @example
 * const result = await calculateLandValueGrowth(100000, 0.001);
 * // Returns: {
 * //   success: true,
 * //   data: {
 * //     todayValue: 100000,
 * //     growthRate: 0.001,
 * //     tomorrowValue: 100001,
 * //     growthAmount: 1
 * //   }
 * // }
 */
export async function calculateLandValueGrowth(
  todayValue: number,
  growthRate: number
): Promise<LandValueResponse> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'calculate-land-value',
      {
        body: {
          todayValue,
          growthRate,
        },
      }
    );

    if (error) {
      console.error('Error calling calculate-land-value function:', error);
      return {
        success: false,
        error: error.message || 'Failed to calculate land value',
      };
    }

    return data as LandValueResponse;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('Exception in calculateLandValueGrowth:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Calculate land value growth offline (without server call)
 * Useful for immediate calculations without network latency
 *
 * @param todayValue - Current land value in ₹
 * @param growthRate - Daily growth rate as a percentage
 * @returns Calculated values
 *
 * @example
 * const result = calculateLandValueLocal(100000, 0.001);
 */
export function calculateLandValueLocal(
  todayValue: number,
  growthRate: number
): LandValueResponse {
  // Validate inputs
  if (!Number.isFinite(todayValue) || todayValue < 0) {
    return {
      success: false,
      error: "Today's value must be a non-negative number",
    };
  }

  if (!Number.isFinite(growthRate)) {
    return {
      success: false,
      error: 'Growth rate must be a valid number',
    };
  }

  // Calculate tomorrow's value
  const growthMultiplier = 1 + growthRate / 100;
  const tomorrowValue = todayValue * growthMultiplier;
  const growthAmount = tomorrowValue - todayValue;

  return {
    success: true,
    data: {
      todayValue: Number(todayValue.toFixed(2)),
      growthRate: Number(growthRate.toFixed(3)),
      tomorrowValue: Number(tomorrowValue.toFixed(2)),
      growthAmount: Number(growthAmount.toFixed(2)),
    },
  };
}

/**
 * Project land value over multiple days
 * Calculates compound growth over time
 *
 * @param todayValue - Starting land value in ₹
 * @param growthRate - Daily growth rate as a percentage
 * @param days - Number of days to project
 * @returns Projected value after specified days
 *
 * @example
 * const future = projectLandValueGrowth(100000, 0.001, 365);
 * // Returns projected value after 1 year (365 days)
 */
export function projectLandValueGrowth(
  todayValue: number,
  growthRate: number,
  days: number
): LandValueResponse {
  if (!Number.isFinite(todayValue) || todayValue < 0) {
    return {
      success: false,
      error: "Today's value must be a non-negative number",
    };
  }

  if (!Number.isFinite(growthRate)) {
    return {
      success: false,
      error: 'Growth rate must be a valid number',
    };
  }

  if (!Number.isInteger(days) || days < 0) {
    return {
      success: false,
      error: 'Days must be a non-negative integer',
    };
  }

  // Calculate projected value with compound growth
  const growthMultiplier = 1 + growthRate / 100;
  const projectedValue = todayValue * Math.pow(growthMultiplier, days);
  const totalGrowthAmount = projectedValue - todayValue;

  return {
    success: true,
    data: {
      todayValue: Number(todayValue.toFixed(2)),
      growthRate: Number(growthRate.toFixed(3)),
      tomorrowValue: Number(projectedValue.toFixed(2)),
      growthAmount: Number(totalGrowthAmount.toFixed(2)),
    },
  };
}

/**
 * Calculate average daily growth rate needed to reach a target value
 *
 * @param todayValue - Current land value in ₹
 * @param targetValue - Target land value in ₹
 * @param days - Number of days to reach target
 * @returns Required daily growth rate as a percentage
 *
 * @example
 * const rate = calculateRequiredGrowthRate(100000, 110000, 365);
 * // Returns daily growth rate needed to reach 110000 in 365 days
 */
export function calculateRequiredGrowthRate(
  todayValue: number,
  targetValue: number,
  days: number
): {
  success: boolean;
  requiredRate?: number;
  error?: string;
} {
  if (!Number.isFinite(todayValue) || todayValue <= 0) {
    return {
      success: false,
      error: "Today's value must be a positive number",
    };
  }

  if (!Number.isFinite(targetValue) || targetValue < 0) {
    return {
      success: false,
      error: 'Target value must be a non-negative number',
    };
  }

  if (!Number.isInteger(days) || days <= 0) {
    return {
      success: false,
      error: 'Days must be a positive integer',
    };
  }

  // Calculate required growth rate: growthRate = ((targetValue / todayValue) ^ (1/days) - 1) * 100
  const ratio = targetValue / todayValue;
  const requiredRate = (Math.pow(ratio, 1 / days) - 1) * 100;

  return {
    success: true,
    requiredRate: Number(requiredRate.toFixed(3)),
  };
}
