// Format number with commas
export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// Get color based on risk category from API data
const getSeverityColor = (riskCategory: string): string => {
  switch (riskCategory?.toLowerCase()) {
    case 'high':
      return 'bg-red-500';
    case 'medium':
      return 'bg-orange-500';
    case 'low':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
};

// Get text color based on risk category from API data
const getSeverityTextColor = (riskCategory: string): string => {
  switch (riskCategory?.toLowerCase()) {
    case 'high':
      return 'text-red-500';
    case 'medium':
      return 'text-orange-500';
    case 'low':
      return 'text-green-500';
    default:
      return 'text-gray-500';
  }
};

// Calculate percentage change
const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

// Get trend indicator (up, down, or neutral)
const getTrendIndicator = (percentChange: number): 'up' | 'down' | 'neutral' => {
  if (percentChange > 0) return 'up';
  if (percentChange < 0) return 'down';
  return 'neutral';
};

// Legacy function for backward compatibility - now uses count-based fallback
export const getSeverityColorByCount = (count: number): string => {
  if (count >= 100) return 'bg-red-500';
  if (count >= 50) return 'bg-orange-500';
  return 'bg-green-500';
};

// Legacy function for backward compatibility - now uses count-based fallback
const getSeverityTextColorByCount = (count: number): string => {
  if (count >= 100) return 'text-red-500';
  if (count >= 50) return 'text-orange-500';
  return 'text-green-500';
};