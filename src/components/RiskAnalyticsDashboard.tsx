import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  Users,
  Building,
  Network,
  FileText,
  Target,
  Zap,
  ArrowUpRight,
  Clock,
  DollarSign,
  Briefcase,
  CreditCard,
  Loader2,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Calendar,
  Gauge,
  CheckCircle2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useRiskAnalytics } from '../hooks/useRiskAnalytics';
import { DateRange } from '../types/types';
import { useTheme } from '../context/ThemeContext';
import { formatNumber } from '../utils/formatters';

interface RiskAnalyticsDashboardProps {
  dateRange: DateRange;
}


type ThemeMode = 'dark' | 'light';

const CHART = {
  trend: '#2563EB',
  amount: '#0D9488',
  frequency: '#D97706',
  network: '#7C3AED',
  secondary: '#94A3B8',
};

const severityHex = (level: string) => {
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

const scoreHex = (score: number) => {
  if (score >= 80) return '#DC2626';
  if (score >= 60) return '#EA580C';
  if (score >= 40) return '#D97706';
  return '#16A34A';
};

const badgeClasses = (level: string, theme: ThemeMode) => {
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

const getTokens = (theme: ThemeMode) => ({
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
});

const chartTheme = (theme: ThemeMode) => ({
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

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */
/* ------------------------------------------------------------------ */

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Risk Analytics Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <div className="text-center">
              <h3 className="text-base font-semibold text-slate-200 mb-1">
                Something went wrong
              </h3>
              <p className="text-slate-400 text-sm">
                Unable to display this section. Please try refreshing.
              </p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

const safeGet = (obj: any, path: string, defaultValue: any = null) => {
  try {
    return (
      path.split('.').reduce((current, key) => current?.[key], obj) ??
      defaultValue
    );
  } catch {
    return defaultValue;
  }
};

const EmptyState: React.FC<{
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

const Panel: React.FC<{
  icon?: React.ComponentType<any>;
  iconColor?: string;
  title: string;
  meta?: React.ReactNode;
  theme: ThemeMode;
  delay?: number;
  children: React.ReactNode;
}> = ({ icon: Icon, iconColor, title, meta, theme, delay = 0, children }) => {
  const tk = getTokens(theme);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={`rounded-xl border ${tk.surface} shadow-sm overflow-hidden`}
    >
      <div
        className={`flex items-center justify-between px-5 py-4 border-b ${tk.border}`}
      >
        <h3
          className={`text-sm font-semibold flex items-center gap-2 ${tk.textPrimary}`}
        >
          {Icon && (
            <Icon
              className="w-4 h-4"
              style={{ color: iconColor || CHART.trend }}
            />
          )}
          {title}
        </h3>
        {meta}
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
};

const StatCard: React.FC<{
  icon: React.ComponentType<any>;
  label: string;
  value: React.ReactNode;
  sublabel: string;
  accent: 'critical' | 'high' | 'medium' | 'info';
  theme: ThemeMode;
  delay?: number;
}> = ({ icon: Icon, label, value, sublabel, accent, theme, delay = 0 }) => {
  const tk = getTokens(theme);
  const accentHex = {
    critical: '#DC2626',
    high: '#EA580C',
    medium: '#D97706',
    info: '#2563EB',
  }[accent];
  const iconWrap =
    theme === 'dark'
      ? {
          critical: 'bg-red-500/10',
          high: 'bg-orange-500/10',
          medium: 'bg-amber-500/10',
          info: 'bg-blue-500/10',
        }[accent]
      : {
          critical: 'bg-red-50',
          high: 'bg-orange-50',
          medium: 'bg-amber-50',
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

const alignClass: Record<string, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const DataTable: React.FC<{
  columns: {
    key: string;
    label: string;
    align?: 'left' | 'right' | 'center';
    render?: (row: any) => React.ReactNode;
  }[];
  rows: any[];
  theme: ThemeMode;
  keyField?: string;
}> = ({ columns, rows, theme, keyField }) => {
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
          {rows.map((row, i) => (
            <tr
              key={keyField ? (row[keyField] ?? i) : i}
              className={`border-b last:border-0 ${tk.border} ${tk.rowHover} transition-colors`}
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SeverityBadge: React.FC<{ label: string; theme: ThemeMode }> = ({
  label,
  theme,
}) => (
  <span
    className={`px-2 py-0.5 text-[11px] font-semibold rounded-full whitespace-nowrap ${badgeClasses(label, theme)}`}
  >
    {(label || 'UNKNOWN').toUpperCase()}
  </span>
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const RiskAnalyticsDashboard: React.FC<RiskAnalyticsDashboardProps> = ({
  dateRange,
}) => {
  const { data, isLoading, error, lastUpdated, refreshData } =
    useRiskAnalytics(dateRange);
  const [activeTab, setActiveTab] = useState('overview');
  const { theme } = useTheme() as { theme: ThemeMode };
  const tk = getTokens(theme);
  const ct = chartTheme(theme);

  const tabs = [
    { id: 'overview', label: 'Executive Overview', icon: Gauge },
    { id: 'customers', label: 'Customer Risk', icon: Users },
    { id: 'transactions', label: 'Transaction Analysis', icon: CreditCard },
    { id: 'network', label: 'Network Analysis', icon: Network },
    { id: 'temporal', label: 'Temporal Patterns', icon: BarChart3 },
    { id: 'actions', label: 'Action Items', icon: Target },
  ];

  const safeData = useMemo(() => {
    if (!data) return null;
    return {
      executiveSummary: safeGet(data, 'executive_summary', {}),
      metadata: safeGet(data, 'metadata', {}),
      keyRiskIndicators: safeGet(data, 'key_risk_indicators', {}),
      customerRiskAnalysis: safeGet(data, 'customer_risk_analysis', {}),
      transactionAnalysis: safeGet(data, 'transaction_analysis', {}),
      networkAnalysis: safeGet(data, 'network_analysis', {}),
      temporalAnalysis: safeGet(data, 'temporal_analysis', {}),
      predictiveInsights: safeGet(data, 'predictive_insights', {}),
      actionableRecommendations: safeGet(
        data,
        'actionable_recommendations',
        []
      ),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <div className="text-center">
          <div className={`font-medium text-base ${tk.textPrimary}`}>
            Loading Risk Analytics...
          </div>
          <div className={`text-sm mt-1 ${tk.textSecondary}`}>
            Analyzing fraud patterns and risk indicators
          </div>
        </div>
      </div>
    );
  }

  if (error || !safeData) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <h2 className={`text-xl font-bold mb-2 ${tk.textPrimary}`}>
          Unable to Load Risk Analytics
        </h2>
        <p className={`mb-6 text-sm ${tk.textSecondary}`}>
          {error || 'No data available for the selected period'}
        </p>
        <button
          onClick={refreshData}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  /* ---------------------------- Overview ---------------------------- */

  const renderOverviewTab = () => {
    const executiveSummary = safeData.executiveSummary;
    const keyRiskIndicators = safeData.keyRiskIndicators;
    const metadata = safeData.metadata;
    const score =
      Number(safeGet(executiveSummary, 'overall_risk_score', 0)) || 0;
    const trend = safeGet(executiveSummary, 'risk_trend', 'Unknown');
    const findings: string[] =
      safeGet(executiveSummary, 'key_findings', []) || [];
    const gaugeColor = scoreHex(score);
    const gaugeData = [{ name: 'score', value: score, fill: gaugeColor }];

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {/* Header */}
          <div className={`rounded-xl border ${tk.surface} shadow-sm p-6`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-600 shadow-sm">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1
                    className={`text-xl font-bold tracking-tight ${tk.textPrimary}`}
                  >
                    Fraud &amp; Risk Analytics
                  </h1>
                  <p className={`text-sm ${tk.textSecondary}`}>
                    Executive risk dashboard
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div
                    className={`text-xs uppercase tracking-wide ${tk.textTertiary}`}
                  >
                    Report Period
                  </div>
                  <div className={`text-sm font-semibold ${tk.textPrimary}`}>
                    {safeGet(metadata, 'analysis_period.start', 'N/A')} &ndash;{' '}
                    {safeGet(metadata, 'analysis_period.end', 'N/A')}
                  </div>
                  {lastUpdated && (
                    <div
                      className={`text-xs mt-0.5 flex items-center justify-end gap-1 ${tk.textTertiary}`}
                    >
                      <Clock className="w-3 h-3" />
                      Updated {lastUpdated.toLocaleTimeString()}
                    </div>
                  )}
                </div>

                {/* Signature element: risk gauge */}
                <div className="relative w-40 h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="88%"
                      innerRadius="115%"
                      outerRadius="185%"
                      barSize={10}
                      startAngle={180}
                      endAngle={0}
                      data={gaugeData}
                    >
                      <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        dataKey="value"
                        angleAxisId={0}
                        tick={false}
                      />
                      <RadialBar
                        background={{
                          fill: theme === 'dark' ? '#1F2937' : '#EEF2F6',
                        }}
                        dataKey="value"
                        cornerRadius={6}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
                    <span
                      className={`text-2xl font-bold tabular-nums leading-none`}
                      style={{ color: gaugeColor }}
                    >
                      {score}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wide mt-0.5 ${tk.textTertiary}`}
                    >
                      Risk Score &middot; {trend}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              theme={theme}
              icon={AlertTriangle}
              label="Total Alerts"
              value={formatNumber(
                safeGet(keyRiskIndicators, 'volume_metrics.total_alerts', 0)
              )}
              sublabel="Active fraud alerts"
              accent="high"
              delay={0.05}
            />
            <StatCard
              theme={theme}
              icon={Users}
              label="Critical Customers"
              value={safeGet(keyRiskIndicators, 'customer_risk.critical', 0)}
              sublabel="Requiring immediate attention"
              accent="critical"
              delay={0.1}
            />
            <StatCard
              theme={theme}
              icon={Building}
              label="High-Risk Branches"
              value={safeGet(
                keyRiskIndicators,
                'branch_risk.high_risk_branches',
                0
              )}
              sublabel="Requiring audit"
              accent="medium"
              delay={0.15}
            />
          </div>

          {/* Key findings */}
          <Panel
            theme={theme}
            icon={FileText}
            iconColor={CHART.trend}
            title="Key Findings"
            delay={0.2}
          >
            {findings.length === 0 ? (
              <p className={`text-sm ${tk.textTertiary}`}>
                No key findings for this period.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {findings.map((finding: string, index: number) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border ${tk.chip}`}
                  >
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <span className={`text-sm ${tk.textSecondary}`}>
                      {finding}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </ErrorBoundary>
    );
  };

  /* ---------------------------- Customers ---------------------------- */

  const renderCustomersTab = () => {
    const customerRiskAnalysis = safeData.customerRiskAnalysis;
    const criticalCustomers =
      safeGet(customerRiskAnalysis, 'critical_customers', []) || [];

    if (criticalCustomers.length === 0) {
      return (
        <ErrorBoundary>
          <EmptyState
            theme={theme}
            icon={Users}
            title="No Critical Customers Found"
            description="No customers with critical risk levels were identified in the current analysis period."
            action={refreshData}
            actionLabel="Refresh Data"
          />
        </ErrorBoundary>
      );
    }

    const bubbleData = criticalCustomers.map((c: any, i: number) => ({
      name: safeGet(c, 'name', 'Unknown'),
      alerts: Number(safeGet(c, 'activity_summary.alert_count', 0)) || 0,
      amount: Number(safeGet(c, 'activity_summary.total_amount', 0)) || 0,
      beneficiaries:
        Number(safeGet(c, 'activity_summary.beneficiary_count', 0)) || 0,
      id: safeGet(c, 'customer_id', i),
    }));

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          <Panel
            theme={theme}
            icon={Target}
            iconColor="#DC2626"
            title={`Critical Risk Customers (${criticalCustomers.length})`}
            meta={
              <span className={`text-xs ${tk.textTertiary}`}>
                Bubble size = beneficiaries
              </span>
            }
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis
                    type="number"
                    dataKey="alerts"
                    name="Alerts"
                    tick={{ fill: ct.tick, fontSize: 12 }}
                    label={{
                      value: 'Alert Count',
                      position: 'insideBottom',
                      offset: -4,
                      fill: ct.tick,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="amount"
                    name="Total Amount"
                    tick={{ fill: ct.tick, fontSize: 12 }}
                    tickFormatter={(v) => formatNumber(v)}
                    width={70}
                  />
                  <ZAxis
                    type="number"
                    dataKey="beneficiaries"
                    range={[60, 400]}
                    name="Beneficiaries"
                  />
                  <Tooltip
                    {...ct.tooltip}
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value: any, name: string) =>
                      name === 'Total Amount'
                        ? [`AED ${formatNumber(value)}`, name]
                        : [formatNumber(value), name]
                    }
                    labelFormatter={() => ''}
                  />
                  <Scatter
                    data={bubbleData}
                    fill={CHART.amount}
                    fillOpacity={0.75}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel
            theme={theme}
            icon={Users}
            iconColor="#DC2626"
            title="Customer Detail"
            delay={0.05}
          >
            <DataTable
              theme={theme}
              keyField="id"
              rows={criticalCustomers.map((c: any, i: number) => ({
                id: safeGet(c, 'customer_id', i),
                name: safeGet(c, 'name', 'Unknown Customer'),
                profession: safeGet(c, 'profession', 'Unknown'),
                alerts: safeGet(c, 'activity_summary.alert_count', 0),
                beneficiaries: safeGet(
                  c,
                  'activity_summary.beneficiary_count',
                  0
                ),
                amount: safeGet(c, 'activity_summary.total_amount', 0),
              }))}
              columns={[
                {
                  key: 'name',
                  label: 'Customer',
                  render: (r) => (
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div
                        className={`text-xs flex items-center gap-1 mt-0.5 ${tk.textTertiary}`}
                      >
                        <Briefcase className="w-3 h-3" />
                        {r.profession}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'alerts',
                  label: 'Alerts',
                  align: 'right',
                  render: (r) => (
                    <span className="tabular-nums font-medium">
                      {formatNumber(r.alerts)}
                    </span>
                  ),
                },
                {
                  key: 'beneficiaries',
                  label: 'Beneficiaries',
                  align: 'right',
                  render: (r) => (
                    <span className="tabular-nums">
                      {formatNumber(r.beneficiaries)}
                    </span>
                  ),
                },
                {
                  key: 'amount',
                  label: 'Total Amount',
                  align: 'right',
                  render: (r) => (
                    <span className="tabular-nums font-medium">
                      AED {formatNumber(r.amount)}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  align: 'right',
                  render: () => (
                    <SeverityBadge label="critical" theme={theme} />
                  ),
                },
              ]}
            />
          </Panel>
        </div>
      </ErrorBoundary>
    );
  };

  /* -------------------------- Transactions --------------------------- */

  const renderTransactionsTab = () => {
    const transactionAnalysis = safeData.transactionAnalysis;
    const patternDetection = safeGet(
      transactionAnalysis,
      'pattern_detection',
      {}
    );
    const highFrequency = safeGet(patternDetection, 'high_frequency', []) || [];
    const highValue = safeGet(patternDetection, 'high_value', []) || [];
    const unusualTiming = safeGet(patternDetection, 'unusual_timing', {});
    const offHour =
      Number(safeGet(unusualTiming, 'off_hour_transactions', 0)) || 0;
    const weekend =
      Number(safeGet(unusualTiming, 'weekend_transactions', 0)) || 0;

    const hasData =
      highFrequency.length > 0 ||
      highValue.length > 0 ||
      offHour > 0 ||
      weekend > 0;

    if (!hasData) {
      return (
        <ErrorBoundary>
          <EmptyState
            theme={theme}
            icon={CreditCard}
            title="No Transaction Patterns Found"
            description="No suspicious transaction patterns were detected in the current analysis period."
            action={refreshData}
            actionLabel="Refresh Data"
          />
        </ErrorBoundary>
      );
    }

    const freqChartData = highFrequency.map((p: any, i: number) => ({
      id: safeGet(p, 'customer_id', i),
      label: `${safeGet(p, 'customer_id', 'Unknown')}`,
      count: Number(safeGet(p, 'characteristics.count', 0)) || 0,
    }));

    const valueChartData = highValue.map((t: any, i: number) => ({
      id: i,
      label: safeGet(t, 'customer_name', 'Unknown'),
      amount: Number(safeGet(t, 'characteristics.amount', 0)) || 0,
    }));

    const timingPie = [
      { name: 'Off-Hour', value: offHour, color: CHART.network },
      { name: 'Weekend', value: weekend, color: '#6366F1' },
    ].filter((d) => d.value > 0);

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {highFrequency.length > 0 && (
            <Panel
              theme={theme}
              icon={Zap}
              iconColor={CHART.frequency}
              title="High-Frequency Transaction Patterns"
            >
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={freqChartData}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={ct.grid}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      width={110}
                    />
                    <Tooltip
                      {...ct.tooltip}
                      formatter={(v: any) => [formatNumber(v), 'Transactions']}
                    />
                    <Bar
                      dataKey="count"
                      fill={CHART.frequency}
                      radius={[0, 4, 4, 0]}
                      barSize={16}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                theme={theme}
                keyField="id"
                rows={highFrequency.map((p: any, i: number) => ({
                  id: safeGet(p, 'customer_id', i),
                  customer: safeGet(p, 'customer_id', 'Unknown'),
                  pattern: safeGet(p, 'pattern_type', 'Unknown'),
                  count: safeGet(p, 'characteristics.count', 0),
                  amount: safeGet(p, 'characteristics.total_amount', 0),
                  service: safeGet(
                    p,
                    'characteristics.service_type',
                    'Unknown'
                  ),
                }))}
                columns={[
                  { key: 'customer', label: 'Customer ID' },
                  { key: 'pattern', label: 'Pattern' },
                  { key: 'service', label: 'Service Type' },
                  {
                    key: 'count',
                    label: 'Transactions',
                    align: 'right',
                    render: (r) => (
                      <span className="tabular-nums font-medium">
                        {formatNumber(r.count)}
                      </span>
                    ),
                  },
                  {
                    key: 'amount',
                    label: 'Total Amount',
                    align: 'right',
                    render: (r) => (
                      <span className="tabular-nums font-medium">
                        AED {formatNumber(r.amount)}
                      </span>
                    ),
                  },
                ]}
              />
            </Panel>
          )}

          {highValue.length > 0 && (
            <Panel
              theme={theme}
              icon={DollarSign}
              iconColor={CHART.amount}
              title="High-Value Transactions"
              delay={0.05}
            >
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={valueChartData}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={ct.grid}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      width={110}
                    />
                    <Tooltip
                      {...ct.tooltip}
                      formatter={(v: any) => [
                        `AED ${formatNumber(v)}`,
                        'Amount',
                      ]}
                    />
                    <Bar
                      dataKey="amount"
                      fill={CHART.amount}
                      radius={[0, 4, 4, 0]}
                      barSize={16}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                theme={theme}
                rows={highValue.map((t: any, i: number) => ({
                  id: i,
                  customer: safeGet(t, 'customer_name', 'Unknown Customer'),
                  type: safeGet(t, 'transaction_type', 'Unknown'),
                  service: safeGet(
                    t,
                    'characteristics.service_type',
                    'Unknown'
                  ),
                  amount: safeGet(t, 'characteristics.amount', 0),
                }))}
                columns={[
                  { key: 'customer', label: 'Customer' },
                  { key: 'type', label: 'Transaction Type' },
                  { key: 'service', label: 'Service Type' },
                  {
                    key: 'amount',
                    label: 'Amount',
                    align: 'right',
                    render: (r) => (
                      <span
                        className="tabular-nums font-semibold"
                        style={{ color: CHART.amount }}
                      >
                        AED {formatNumber(r.amount)}
                      </span>
                    ),
                  },
                ]}
              />
            </Panel>
          )}

          {(offHour > 0 || weekend > 0) && (
            <Panel
              theme={theme}
              icon={Clock}
              iconColor={CHART.network}
              title="Unusual Timing Patterns"
              delay={0.1}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={timingPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {timingPie.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...ct.tooltip}
                        formatter={(v: any) => formatNumber(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {timingPie.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-lg border ${tk.chip}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className={`text-sm ${tk.textSecondary}`}>
                          {entry.name} Transactions
                        </span>
                      </div>
                      <span
                        className={`text-lg font-bold tabular-nums ${tk.textPrimary}`}
                      >
                        {formatNumber(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          )}
        </div>
      </ErrorBoundary>
    );
  };

  /* ----------------------------- Network ------------------------------ */

  const renderNetworkTab = () => {
    const networkAnalysis = safeData.networkAnalysis;
    const clusterAnalysis =
      safeGet(networkAnalysis, 'cluster_analysis', []) || [];
    const centralActors = safeGet(networkAnalysis, 'central_actors', []) || [];
    const hasData = clusterAnalysis.length > 0 || centralActors.length > 0;

    if (!hasData) {
      return (
        <ErrorBoundary>
          <EmptyState
            theme={theme}
            icon={Network}
            title="No Network Patterns Found"
            description="No suspicious network clusters or central actors were identified in the current analysis period."
            action={refreshData}
            actionLabel="Refresh Data"
          />
        </ErrorBoundary>
      );
    }

    const clusterBubbles = clusterAnalysis.map((c: any, i: number) => ({
      id: safeGet(c, 'cluster_id', i),
      transactions:
        Number(safeGet(c, 'characteristics.total_transactions', 0)) || 0,
      amount: Number(safeGet(c, 'characteristics.total_amount', 0)) || 0,
      customers: Number(safeGet(c, 'characteristics.customer_count', 0)) || 0,
    }));

    const actorChartData = centralActors
      .slice(0, 8)
      .map((a: any, i: number) => ({
        id: safeGet(a, 'customer_code', i),
        label: safeGet(a, 'customer_name', 'Unknown'),
        transactions:
          Number(safeGet(a, 'transaction_summary.total_transactions', 0)) || 0,
      }));

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {clusterAnalysis.length > 0 && (
            <Panel
              theme={theme}
              icon={Network}
              iconColor={CHART.network}
              title={`Suspicious Network Clusters (${clusterAnalysis.length})`}
              meta={
                <span className={`text-xs ${tk.textTertiary}`}>
                  Bubble size = customers
                </span>
              }
            >
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis
                      type="number"
                      dataKey="transactions"
                      name="Transactions"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      label={{
                        value: 'Total Transactions',
                        position: 'insideBottom',
                        offset: -4,
                        fill: ct.tick,
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="amount"
                      name="Total Amount"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      tickFormatter={(v) => formatNumber(v)}
                      width={70}
                    />
                    <ZAxis
                      type="number"
                      dataKey="customers"
                      range={[60, 400]}
                      name="Customers"
                    />
                    <Tooltip
                      {...ct.tooltip}
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(value: any, name: string) =>
                        name === 'Total Amount'
                          ? [`AED ${formatNumber(value)}`, name]
                          : [formatNumber(value), name]
                      }
                      labelFormatter={() => ''}
                    />
                    <Scatter
                      data={clusterBubbles}
                      fill={CHART.network}
                      fillOpacity={0.75}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                theme={theme}
                keyField="id"
                rows={clusterAnalysis.slice(0, 5).map((c: any, i: number) => ({
                  id: safeGet(c, 'cluster_id', i),
                  customers: safeGet(c, 'characteristics.customer_count', 0),
                  transactions: safeGet(
                    c,
                    'characteristics.total_transactions',
                    0
                  ),
                  amount: safeGet(c, 'characteristics.total_amount', 0),
                  branches:
                    (
                      safeGet(
                        c,
                        'characteristics.common_attributes.branches',
                        []
                      ) || []
                    ).join(', ') || 'N/A',
                  countries:
                    (
                      safeGet(
                        c,
                        'characteristics.common_attributes.countries',
                        []
                      ) || []
                    ).join(', ') || 'N/A',
                }))}
                columns={[
                  {
                    key: 'customers',
                    label: 'Customers',
                    align: 'right',
                    render: (r) => (
                      <span className="tabular-nums font-medium">
                        {r.customers}
                      </span>
                    ),
                  },
                  {
                    key: 'transactions',
                    label: 'Transactions',
                    align: 'right',
                    render: (r) => (
                      <span className="tabular-nums">
                        {formatNumber(r.transactions)}
                      </span>
                    ),
                  },
                  {
                    key: 'amount',
                    label: 'Total Value',
                    align: 'right',
                    render: (r) => (
                      <span className="tabular-nums font-medium">
                        AED {formatNumber(r.amount)}
                      </span>
                    ),
                  },
                  { key: 'branches', label: 'Branches' },
                  { key: 'countries', label: 'Countries' },
                ]}
              />
            </Panel>
          )}

          {centralActors.length > 0 && (
            <Panel
              theme={theme}
              icon={Users}
              iconColor="#EA580C"
              title={`Central Network Actors (${centralActors.length})`}
              delay={0.05}
            >
              <div className="h-56 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={actorChartData}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={ct.grid}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      width={110}
                    />
                    <Tooltip
                      {...ct.tooltip}
                      formatter={(v: any) => [formatNumber(v), 'Transactions']}
                    />
                    <Bar
                      dataKey="transactions"
                      fill="#EA580C"
                      radius={[0, 4, 4, 0]}
                      barSize={14}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                theme={theme}
                keyField="id"
                rows={centralActors.slice(0, 5).map((a: any, i: number) => ({
                  id: safeGet(a, 'customer_code', i),
                  name: safeGet(a, 'customer_name', 'Unknown Customer'),
                  risk: safeGet(a, 'risk_implications', 'Unknown'),
                  transactions: safeGet(
                    a,
                    'transaction_summary.total_transactions',
                    0
                  ),
                  beneficiaries: safeGet(
                    a,
                    'transaction_summary.beneficiary_count',
                    0
                  ),
                  amount: safeGet(a, 'transaction_summary.total_amount', 0),
                }))}
                columns={[
                  {
                    key: 'name',
                    label: 'Customer',
                    render: (r) => (
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className={`text-xs mt-0.5 ${tk.textTertiary}`}>
                          {r.risk}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'transactions',
                    label: 'Transactions',
                    align: 'right',
                    render: (r) => (
                      <span className="tabular-nums font-medium">
                        {formatNumber(r.transactions)}
                      </span>
                    ),
                  },
                  {
                    key: 'beneficiaries',
                    label: 'Beneficiaries',
                    align: 'right',
                    render: (r) => (
                      <span className="tabular-nums">
                        {formatNumber(r.beneficiaries)}
                      </span>
                    ),
                  },
                  {
                    key: 'amount',
                    label: 'Total Amount',
                    align: 'right',
                    render: (r) => (
                      <span className="tabular-nums font-medium">
                        AED {formatNumber(r.amount)}
                      </span>
                    ),
                  },
                ]}
              />
            </Panel>
          )}
        </div>
      </ErrorBoundary>
    );
  };

  /* ----------------------------- Temporal ------------------------------ */

  const renderTemporalTab = () => {
    const temporalAnalysis = safeData.temporalAnalysis;
    const alertTrends = safeGet(temporalAnalysis, 'alert_trends', {});
    const dailyPattern = safeGet(alertTrends, 'daily_pattern', []) || [];
    const hourlyPattern = safeGet(alertTrends, 'hourly_pattern', []) || [];
    const hasData = dailyPattern.length > 0 || hourlyPattern.length > 0;

    if (!hasData) {
      return (
        <ErrorBoundary>
          <EmptyState
            theme={theme}
            icon={BarChart3}
            title="No Temporal Patterns Found"
            description="No temporal alert patterns were found in the current analysis period."
            action={refreshData}
            actionLabel="Refresh Data"
          />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {dailyPattern.length > 0 && (
            <Panel
              theme={theme}
              icon={Calendar}
              iconColor={CHART.trend}
              title="Daily Alert Patterns"
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dailyPattern}
                    margin={{ left: -8, right: 16 }}
                  >
                    <defs>
                      <linearGradient
                        id="dailyFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={CHART.trend}
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor={CHART.trend}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString()
                      }
                    />
                    <YAxis tick={{ fill: ct.tick, fontSize: 12 }} />
                    <Tooltip
                      {...ct.tooltip}
                      labelFormatter={(value) =>
                        new Date(value).toLocaleDateString()
                      }
                      formatter={(v: any) => [formatNumber(v), 'Alerts']}
                    />
                    <Area
                      type="monotone"
                      dataKey="alert_count"
                      stroke={CHART.trend}
                      strokeWidth={2}
                      fill="url(#dailyFill)"
                      dot={{ fill: CHART.trend, strokeWidth: 0, r: 3 }}
                      activeDot={{
                        r: 5,
                        stroke: CHART.trend,
                        strokeWidth: 2,
                        fill: theme === 'dark' ? '#0F172A' : '#fff',
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          {hourlyPattern.length > 0 && (
            <Panel
              theme={theme}
              icon={Clock}
              iconColor={CHART.frequency}
              title="Hourly Alert Distribution"
              delay={0.05}
            >
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={hourlyPattern}
                    margin={{ left: -8, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      tickFormatter={(value) => `${value}:00`}
                    />
                    <YAxis tick={{ fill: ct.tick, fontSize: 12 }} />
                    <Tooltip
                      {...ct.tooltip}
                      labelFormatter={(value) => `${value}:00`}
                      formatter={(v: any) => [formatNumber(v), 'Alerts']}
                    />
                    <Bar
                      dataKey="count"
                      fill={CHART.frequency}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
        </div>
      </ErrorBoundary>
    );
  };

  /* ------------------------------ Actions ------------------------------ */

  const renderActionsTab = () => {
    const recommendations = safeData.actionableRecommendations || [];

    if (recommendations.length === 0) {
      return (
        <ErrorBoundary>
          <EmptyState
            theme={theme}
            icon={Target}
            title="No Action Items Found"
            description="No actionable recommendations were generated for the current analysis period."
            action={refreshData}
            actionLabel="Refresh Data"
          />
        </ErrorBoundary>
      );
    }

    const priorityCounts: Record<string, number> = {};
    recommendations.forEach((r: any) => {
      const p = (safeGet(r, 'priority', 'unknown') || 'unknown').toLowerCase();
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    });
    const order = ['critical', 'high', 'medium', 'low'];
    const priorityChartData = order
      .filter((p) => priorityCounts[p])
      .map((p) => ({
        name: p.charAt(0).toUpperCase() + p.slice(1),
        value: priorityCounts[p],
        color: severityHex(p),
      }));

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          <Panel
            theme={theme}
            icon={Zap}
            iconColor={CHART.trend}
            title={`Executive Recommendations (${recommendations.length})`}
          >
            {priorityChartData.length > 1 && (
              <div className="h-40 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={priorityChartData}
                    layout="vertical"
                    margin={{ left: 8, right: 24 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={ct.grid}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      width={70}
                    />
                    <Tooltip
                      {...ct.tooltip}
                      formatter={(v: any) => [v, 'Items']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                      {priorityChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((recommendation: any, index: number) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border flex items-start gap-3 ${tk.chip}`}
                >
                  <div
                    className="p-1.5 rounded-md mt-0.5"
                    style={{
                      backgroundColor: `${severityHex(safeGet(recommendation, 'priority', 'low'))}1A`,
                    }}
                  >
                    <ArrowUpRight
                      className="w-3.5 h-3.5"
                      style={{
                        color: severityHex(
                          safeGet(recommendation, 'priority', 'low')
                        ),
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <SeverityBadge
                        label={safeGet(recommendation, 'priority', 'Unknown')}
                        theme={theme}
                      />
                      <span className={`text-xs ${tk.textTertiary}`}>
                        {safeGet(
                          recommendation,
                          'timeframe',
                          'Unknown timeframe'
                        )}
                      </span>
                    </div>
                    <p className={`text-sm font-medium mb-1 ${tk.textPrimary}`}>
                      {safeGet(recommendation, 'action', 'No action specified')}
                    </p>
                    <p className={`text-xs ${tk.textSecondary}`}>
                      {safeGet(
                        recommendation,
                        'rationale',
                        'No rationale provided'
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </ErrorBoundary>
    );
  };

  const renderTabContent = () => {
    try {
      switch (activeTab) {
        case 'overview':
          return renderOverviewTab();
        case 'customers':
          return renderCustomersTab();
        case 'transactions':
          return renderTransactionsTab();
        case 'network':
          return renderNetworkTab();
        case 'temporal':
          return renderTemporalTab();
        case 'actions':
          return renderActionsTab();
        default:
          return renderOverviewTab();
      }
    } catch (err) {
      console.error('Error rendering tab content:', err);
      return (
        <EmptyState
          theme={theme}
          icon={AlertCircle}
          title="Error Loading Content"
          description="There was an error loading this section. Please try again."
          action={() => setActiveTab('overview')}
          actionLabel="Go to Overview"
        />
      );
    }
  };

  return (
    <ErrorBoundary>
      <div className={`space-y-5 ${tk.page}`}>
        {/* Tab navigation */}
        <div className={`rounded-xl border ${tk.surface} p-1.5 shadow-sm`}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : `${tk.textSecondary} hover:bg-slate-500/10`
                  }`}
                >
                  <tab.icon
                    className={`w-4 h-4 ${active ? 'text-white' : ''}`}
                  />
                  <span className="hidden sm:inline truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

export default RiskAnalyticsDashboard;
