import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { ThemeMode, getTokens, badgeClasses } from './tokens';

export const EmptyState: React.FC<{
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
  theme: ThemeMode;
}> = ({ icon: Icon, title, description, action, actionLabel, theme }) => {
  const tk = getTokens(theme);
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className={`p-3.5 rounded-xl border ${tk.chip}`}>
        <Icon className={`w-8 h-8 ${tk.textTertiary}`} />
      </div>
      <div className="text-center max-w-md">
        <h3 className={`text-base font-semibold mb-1.5 ${tk.textPrimary}`}>
          {title}
        </h3>
        <p className={`text-sm ${tk.textSecondary}`}>{description}</p>
        {action && actionLabel && (
          <button
            onClick={action}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export const Panel: React.FC<{
  icon?: React.ComponentType<any>;
  iconColor?: string;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  theme: ThemeMode;
  delay?: number;
  noPadding?: boolean;
  children: React.ReactNode;
}> = ({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  meta,
  theme,
  delay = 0,
  noPadding,
  children,
}) => {
  const tk = getTokens(theme);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={`rounded-xl border ${tk.surface} shadow-sm overflow-hidden`}
    >
      <div
        className={`flex items-center justify-between gap-3 px-5 py-4 border-b ${tk.border}`}
      >
        <div>
          <h3
            className={`text-sm font-semibold flex items-center gap-2 ${tk.textPrimary}`}
          >
            {Icon && (
              <Icon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: iconColor || '#2563EB' }}
              />
            )}
            {title}
          </h3>
          {subtitle && (
            <p className={`text-xs mt-0.5 ${tk.textTertiary}`}>{subtitle}</p>
          )}
        </div>
        {meta}
      </div>
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </motion.div>
  );
};

export const StatCard: React.FC<{
  icon: React.ComponentType<any>;
  label: string;
  value: React.ReactNode;
  sublabel: React.ReactNode;
  accent: 'critical' | 'high' | 'medium' | 'low' | 'info';
  theme: ThemeMode;
  delay?: number;
}> = ({ icon: Icon, label, value, sublabel, accent, theme, delay = 0 }) => {
  const tk = getTokens(theme);
  const accentHex = {
    critical: '#DC2626',
    high: '#EA580C',
    medium: '#D97706',
    low: '#16A34A',
    info: '#2563EB',
  }[accent];
  const iconWrap =
    theme === 'dark'
      ? {
          critical: 'bg-red-500/10',
          high: 'bg-orange-500/10',
          medium: 'bg-amber-500/10',
          low: 'bg-emerald-500/10',
          info: 'bg-blue-500/10',
        }[accent]
      : {
          critical: 'bg-red-50',
          high: 'bg-orange-50',
          medium: 'bg-amber-50',
          low: 'bg-emerald-50',
          info: 'bg-blue-50',
        }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={`rounded-xl border ${tk.surface} shadow-sm p-5 border-l-4`}
      style={{ borderLeftColor: accentHex }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`p-1.5 rounded-lg ${iconWrap}`}>
          <Icon className="w-4 h-4" style={{ color: accentHex }} />
        </div>
        <span
          className={`text-xs font-medium uppercase tracking-wide ${tk.textSecondary}`}
        >
          {label}
        </span>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${tk.textPrimary}`}>
        {value}
      </div>
      <div className={`text-xs mt-1.5 ${tk.textTertiary}`}>{sublabel}</div>
    </motion.div>
  );
};

export const alignClass: Record<string, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export const DataTable: React.FC<{
  columns: {
    key: string;
    label: string;
    align?: 'left' | 'right' | 'center';
    render?: (row: any) => React.ReactNode;
  }[];
  rows: any[];
  theme: ThemeMode;
  keyField?: string;
  onRowClick?: (row: any) => void;
  selectedKey?: string | number | null;
}> = ({ columns, rows, theme, keyField, onRowClick, selectedKey }) => {
  const tk = getTokens(theme);
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b ${tk.border}`}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2 px-3 font-medium text-[11px] uppercase tracking-wide whitespace-nowrap ${tk.textTertiary} ${alignClass[col.align || 'left']}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rowKey = keyField ? (row[keyField] ?? i) : i;
            const isSelected = selectedKey != null && rowKey === selectedKey;
            return (
              <tr
                key={rowKey}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b last:border-0 ${tk.border} transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${
                  isSelected
                    ? theme === 'dark'
                      ? 'bg-blue-500/10'
                      : 'bg-blue-50'
                    : tk.rowHover
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2.5 px-3 ${alignClass[col.align || 'left']} ${tk.textPrimary}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const SeverityBadge: React.FC<{ label: string; theme: ThemeMode }> = ({
  label,
  theme,
}) => (
  <span
    className={`px-2 py-0.5 text-[11px] font-semibold rounded-full whitespace-nowrap ${badgeClasses(label, theme)}`}
  >
    {(label || 'UNKNOWN').toUpperCase()}
  </span>
);

export const ChartSkeleton: React.FC<{ theme: ThemeMode; height?: number }> = ({
  theme,
  height = 320,
}) => {
  const tk = getTokens(theme);
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <div
        className={`animate-spin rounded-full h-9 w-9 border-2 border-t-transparent ${theme === 'dark' ? 'border-blue-500' : 'border-blue-600'}`}
      />
      <span className={`ml-3 text-sm ${tk.textSecondary}`}>
        Loading chart data…
      </span>
    </div>
  );
};

export const Tag: React.FC<{ label: string; theme: ThemeMode }> = ({
  label,
  theme,
}) => {
  const tk = getTokens(theme);
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium border ${tk.chip} ${tk.textSecondary}`}
    >
      {label.replace(/_/g, ' ')}
    </span>
  );
};

export const ProgressBar: React.FC<{
  value: number;
  max?: number;
  theme: ThemeMode;
  color?: string;
}> = ({ value, max = 100, theme, color }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`h-1.5 w-full rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color || '#2563EB' }}
      />
    </div>
  );
};

export const MetricChip: React.FC<{
  label: string;
  value: React.ReactNode;
  theme: ThemeMode;
}> = ({ label, value, theme }) => {
  const tk = getTokens(theme);
  return (
    <div
      className={`flex items-center justify-between gap-4 px-3 py-2 rounded-lg border ${tk.chip}`}
    >
      <span className={`text-xs ${tk.textSecondary}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${tk.textPrimary}`}>
        {value}
      </span>
    </div>
  );
};

export const Callout: React.FC<{
  icon: React.ComponentType<any>;
  variant: 'critical' | 'warning' | 'info';
  title: string;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  theme: ThemeMode;
}> = ({ icon: Icon, variant, title, description, meta, theme }) => {
  const hexByVariant = {
    critical: '#DC2626',
    warning: '#D97706',
    info: '#2563EB',
  }[variant];
  const bg =
    theme === 'dark'
      ? {
          critical: 'bg-red-500/10 border-red-500/25',
          warning: 'bg-amber-500/10 border-amber-500/25',
          info: 'bg-blue-500/10 border-blue-500/25',
        }[variant]
      : {
          critical: 'bg-red-50 border-red-200',
          warning: 'bg-amber-50 border-amber-200',
          info: 'bg-blue-50 border-blue-200',
        }[variant];

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${bg}`}>
      <div
        className="p-1.5 rounded-lg flex-shrink-0"
        style={{ backgroundColor: `${hexByVariant}1A` }}
      >
        <Icon className="w-4 h-4" style={{ color: hexByVariant }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: hexByVariant }}>
          {title}
        </p>
        {description && (
          <div className="text-sm mt-0.5 opacity-90">{description}</div>
        )}
        {meta && <div className="mt-2">{meta}</div>}
      </div>
    </div>
  );
};
