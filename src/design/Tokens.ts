/**
 * Shared design tokens for the fraud & risk analytics suite.
 *
 * Import these into every dashboard page so color, spacing, and chart
 * styling stay identical across pages instead of being redefined per file.
 *
 * Convention: ONE brand accent (blue) drives interaction (active tabs,
 * links, primary chart series). Red/orange/amber/green are reserved
 * exclusively for risk severity so color always means the same thing
 * everywhere. Non-severity chart series are assigned by data meaning,
 * not per-card: trend/volume = blue, monetary value = teal,
 * frequency/count = amber, network/relationship = purple,
 * secondary/operational = slate.
 */

export type ThemeMode = 'dark' | 'light';

export const CHART = {
  trend: '#2563EB',
  amount: '#0D9488',
  frequency: '#D97706',
  network: '#7C3AED',
  secondary: '#64748B',
} as const;

export const severityHex = (level: string): string => {
  switch ((level || '').toLowerCase()) {
    case 'critical':
      return '#DC2626';
    case 'high':
      return '#EA580C';
    case 'medium':
      return '#D97706';
    case 'low':
      return '#16A34A';
    default:
      return '#64748B';
  }
};

export const scoreHex = (score: number): string => {
  if (score >= 80) return '#DC2626';
  if (score >= 60) return '#EA580C';
  if (score >= 40) return '#D97706';
  return '#16A34A';
};

export const badgeClasses = (level: string, theme: ThemeMode): string => {
  const key = (level || '').toLowerCase();
  const dark: Record<string, string> = {
    critical: 'bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30',
    high: 'bg-orange-500/15 text-orange-400 ring-1 ring-inset ring-orange-500/30',
    medium:
      'bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30',
    low: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30',
  };
  const light: Record<string, string> = {
    critical: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
    medium: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    low: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  };
  const map = theme === 'dark' ? dark : light;
  return (
    map[key] ||
    (theme === 'dark'
      ? 'bg-slate-500/15 text-slate-400 ring-1 ring-inset ring-slate-500/30'
      : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200')
  );
};

export const getTokens = (theme: ThemeMode) => ({
  page: theme === 'dark' ? 'bg-[#0B1220]' : 'bg-[#F4F6F9]',
  surface:
    theme === 'dark'
      ? 'bg-[#111827] border-[#1F2937]'
      : 'bg-white border-[#E3E8EF]',
  surfaceAlt:
    theme === 'dark'
      ? 'bg-[#0D1420] border-[#1F2937]'
      : 'bg-[#F8FAFC] border-[#E3E8EF]',
  border: theme === 'dark' ? 'border-[#1F2937]' : 'border-[#E3E8EF]',
  textPrimary: theme === 'dark' ? 'text-white' : 'text-[#101828]',
  textSecondary: theme === 'dark' ? 'text-slate-400' : 'text-[#475467]',
  textTertiary: theme === 'dark' ? 'text-slate-500' : 'text-[#98A2B3]',
  rowHover: theme === 'dark' ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50',
  chip:
    theme === 'dark'
      ? 'bg-white/[0.04] border-white/10'
      : 'bg-slate-50 border-slate-200',
  chipActive:
    theme === 'dark'
      ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
      : 'bg-blue-50 border-blue-200 text-blue-700',
});

export const chartTheme = (theme: ThemeMode) => ({
  grid: theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#EEF2F6',
  tick: theme === 'dark' ? '#7C8BA1' : '#64748B',
  tooltip: {
    contentStyle: {
      backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
      border: `1px solid ${theme === 'dark' ? '#1F2937' : '#E2E8F0'}`,
      borderRadius: '8px',
      fontSize: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    },
    labelStyle: {
      color: theme === 'dark' ? '#E2E8F0' : '#101828',
      fontWeight: 600,
      marginBottom: 4,
    },
    itemStyle: { color: theme === 'dark' ? '#CBD5E1' : '#334155' },
  },
});
