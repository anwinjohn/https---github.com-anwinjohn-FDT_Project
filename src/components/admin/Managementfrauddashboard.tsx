import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  Clock,
  Gauge,
  Users,
  Layers,
  FileWarning,
  Loader2,
  Building2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { fetchFraudDashboard } from '../../hooks/FraudDashboardApi';
import { exportDashboardToPdf } from '../../utils/exportDashboardToPdf';
import {
  FraudDashboardResponse,
  FraudKpi,
} from '../../types/fraudDashboard.types';
import { DateRange } from '../../types/types';

interface ManagementFraudDashboardProps {
  /** Optional — reuses the date range already selected in the parent header. Falls back to last 12 weeks. */
  dateRange?: DateRange;
}

const ACCENT = '#3B82F6'; // single restrained accent — Apple-style "system blue"
const DANGER = '#E5484D';
const SUCCESS = '#12B76A';
const NEUTRAL_GRID_DARK = 'rgba(255,255,255,0.06)';
const NEUTRAL_GRID_LIGHT = 'rgba(15,23,42,0.06)';

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, sans-serif";

function formatCurrencyShort(n: number) {
  return `$${(n / 1000).toFixed(0)}K`;
}

const Sparkline: React.FC<{ data: number[]; color: string }> = ({
  data,
  color,
}) => {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={points}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

const TrendBadge: React.FC<{ kpi: FraudKpi }> = ({ kpi }) => {
  const isGood = kpi.inverse ? kpi.changePct < 0 : kpi.changePct >= 0;
  const Icon =
    kpi.trend === 'flat'
      ? Minus
      : kpi.trend === 'up'
        ? TrendingUp
        : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        isGood
          ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10'
          : 'text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10'
      }`}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(kpi.changePct).toFixed(1)}%
    </span>
  );
};

const KpiCard: React.FC<{ kpi: FraudKpi; index: number; dark: boolean }> = ({
  kpi,
  index,
  dark,
}) => {
  const isGood = kpi.inverse ? kpi.changePct < 0 : kpi.changePct >= 0;
  const sparkColor = isGood ? SUCCESS : DANGER;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      className={`rounded-2xl border p-5 flex flex-col justify-between ${
        dark
          ? 'bg-white/[0.03] border-white/10'
          : 'bg-white border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span
          className={`text-[13px] font-medium ${
            dark ? 'text-white/55' : 'text-slate-500'
          }`}
        >
          {kpi.label}
        </span>
        <TrendBadge kpi={kpi} />
      </div>
      <div
        className={`text-[28px] leading-none font-semibold tracking-tight mb-3 ${
          dark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {kpi.displayValue}
      </div>
      <Sparkline data={kpi.sparkline} color={sparkColor} />
    </motion.div>
  );
};

const SectionShell: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  dark: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, icon, dark, children, className }) => (
  <div
    className={`rounded-2xl border p-6 ${className || ''} ${
      dark
        ? 'bg-white/[0.03] border-white/10'
        : 'bg-white border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
    }`}
  >
    <div className="flex items-center gap-2.5 mb-5">
      <div
        className={`p-1.5 rounded-lg ${
          dark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'
        }`}
      >
        {icon}
      </div>
      <div>
        <h3
          className={`text-[15px] font-semibold ${
            dark ? 'text-white' : 'text-slate-900'
          }`}
        >
          {title}
        </h3>
        {subtitle && (
          <p className={`text-xs ${dark ? 'text-white/45' : 'text-slate-500'}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {children}
  </div>
);

const SkeletonBlock: React.FC<{ dark: boolean; className?: string }> = ({
  dark,
  className,
}) => (
  <div
    className={`animate-pulse rounded-2xl ${className} ${
      dark ? 'bg-white/5' : 'bg-slate-100'
    }`}
  />
);

const ManagementFraudDashboard: React.FC<ManagementFraudDashboardProps> = ({
  dateRange,
}) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [data, setData] = useState<FraudDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [granularity, setGranularity] = useState<
    'daily' | 'weekly' | 'monthly'
  >('weekly');

  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFraudDashboard({
      startDate:
        dateRange?.startDate?.toString() ||
        new Date(Date.now() - 84 * 86400000).toISOString().slice(0, 10),
      endDate:
        dateRange?.endDate?.toString() || new Date().toISOString().slice(0, 10),
      granularity,
    })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled)
          setError('Unable to load fraud trend data. Please retry.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dateRange, granularity]);

  const trendChartData = useMemo(
    () =>
      (data?.trend || []).map((p) => ({
        ...p,
        label: new Date(p.period).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
      })),
    [data]
  );

  const handleExport = async () => {
    await exportDashboardToPdf(exportRef.current, {
      fileName: `fraud-trend-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: 'Fraud Trend — Management Dashboard',
      subtitle: data
        ? `${data.period.startDate} to ${data.period.endDate} · Generated ${new Date(
            data.generatedAt
          ).toLocaleString()}`
        : '',
      onProgress: setExporting,
    });
  };

  const gridColor = dark ? NEUTRAL_GRID_DARK : NEUTRAL_GRID_LIGHT;
  const axisColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.45)';

  return (
    <div style={{ fontFamily: fontStack }} className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            className={`text-[22px] font-semibold tracking-tight ${
              dark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Fraud Trend
          </h2>
          <p className={`text-sm ${dark ? 'text-white/50' : 'text-slate-500'}`}>
            Key fraud KPIs, trends, and operational performance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex items-center rounded-xl border p-0.5 ${
              dark
                ? 'border-white/10 bg-white/[0.03]'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            {(['daily', 'weekly', 'monthly'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                  granularity === g
                    ? dark
                      ? 'bg-white/10 text-white'
                      : 'bg-white text-slate-900 shadow-sm'
                    : dark
                      ? 'text-white/50 hover:text-white/80'
                      : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            disabled={exporting || loading || !data}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              dark
                ? 'bg-white text-slate-900 border-white hover:bg-white/90'
                : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
            }`}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {exporting ? 'Preparing PDF…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-sm px-4 py-3 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Everything inside this ref is what gets captured to PDF */}
      <div ref={exportRef} className="space-y-6">
        {/* KPI grid */}
        {loading || !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} dark={dark} className="h-[132px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.kpis.map((kpi, i) => (
              <KpiCard key={kpi.id} kpi={kpi} index={i} dark={dark} />
            ))}
          </div>
        )}

        {/* Trend chart + category mix */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <SectionShell
            title="Fraud Volume Over Time"
            subtitle="Alerts raised vs. confirmed fraud vs. false positives"
            icon={<TrendingUp className="w-4 h-4" />}
            dark={dark}
            className="xl:col-span-2"
          >
            {loading || !data ? (
              <SkeletonBlock dark={dark} className="h-[280px]" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendChartData}>
                  <defs>
                    <linearGradient id="alertsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="confirmedGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={DANGER} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={DANGER} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridColor}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      background: dark ? '#0f172a' : '#ffffff',
                      border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="alertsRaised"
                    name="Alerts Raised"
                    stroke={ACCENT}
                    fill="url(#alertsGrad)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="confirmedFraud"
                    name="Confirmed Fraud"
                    stroke={DANGER}
                    fill="url(#confirmedGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SectionShell>

          <SectionShell
            title="Fraud Category Mix"
            subtitle="Share of confirmed cases"
            icon={<Layers className="w-4 h-4" />}
            dark={dark}
          >
            {loading || !data ? (
              <SkeletonBlock dark={dark} className="h-[280px]" />
            ) : (
              <div className="space-y-3">
                {data.categoryBreakdown.map((c, i) => (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span
                        className={dark ? 'text-white/70' : 'text-slate-600'}
                      >
                        {c.category}
                      </span>
                      <span
                        className={dark ? 'text-white/50' : 'text-slate-400'}
                      >
                        {c.percentOfTotal}%
                      </span>
                    </div>
                    <div
                      className={`h-1.5 rounded-full overflow-hidden ${
                        dark ? 'bg-white/10' : 'bg-slate-100'
                      }`}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${c.percentOfTotal}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
                        className="h-full rounded-full"
                        style={{ background: ACCENT, opacity: 1 - i * 0.1 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionShell>
        </div>

        {/* Financial impact */}
        <SectionShell
          title="Financial Exposure vs. Prevented"
          subtitle="Estimated loss at risk compared to amounts blocked or recovered"
          icon={<FileWarning className="w-4 h-4" />}
          dark={dark}
        >
          {loading || !data ? (
            <SkeletonBlock dark={dark} className="h-[220px]" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendChartData} barGap={4}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={formatCurrencyShort}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrencyShort(v)}
                  contentStyle={{
                    background: dark ? '#0f172a' : '#ffffff',
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="financialExposure"
                  name="Exposure"
                  fill={dark ? 'rgba(255,255,255,0.15)' : '#CBD5E1'}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="financialPrevented"
                  name="Prevented"
                  fill={SUCCESS}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionShell>

        {/* Operational performance */}
        <SectionShell
          title="Operational Performance"
          subtitle="How the fraud operations team is performing against SLA"
          icon={<Gauge className="w-4 h-4" />}
          dark={dark}
        >
          {loading || !data ? (
            <SkeletonBlock dark={dark} className="h-[140px]" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                {
                  icon: Clock,
                  label: 'Avg. Triage Time',
                  value: `${data.operational.avgTriageTimeMinutes} min`,
                },
                {
                  icon: ShieldCheck,
                  label: 'SLA Compliance',
                  value: `${data.operational.slaComplianceRate}%`,
                },
                {
                  icon: Users,
                  label: 'Analyst Caseload',
                  value: `${data.operational.analystCaseload} cases`,
                },
                {
                  icon: Layers,
                  label: 'Open Backlog',
                  value: `${data.operational.backlogCount}`,
                },
              ].map((m) => (
                <div key={m.label}>
                  <div
                    className={`flex items-center gap-2 mb-1.5 text-xs ${
                      dark ? 'text-white/50' : 'text-slate-500'
                    }`}
                  >
                    <m.icon className="w-3.5 h-3.5" />
                    {m.label}
                  </div>
                  <div
                    className={`text-xl font-semibold ${
                      dark ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {m.value}
                  </div>
                </div>
              ))}

              <div className="col-span-2 md:col-span-4 pt-4 mt-2 border-t border-dashed grid grid-cols-1 sm:grid-cols-2 gap-4 border-slate-200/70 dark:border-white/10">
                <div
                  className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                    dark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                  }`}
                >
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300 text-sm">
                    <Building2 className="w-4 h-4" />
                    Top branch — {data.operational.topPerformingBranch.name}
                  </div>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-300 text-sm">
                    {data.operational.topPerformingBranch.resolutionRate}%
                  </span>
                </div>
                <div
                  className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                    dark ? 'bg-rose-500/10' : 'bg-rose-50'
                  }`}
                >
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300 text-sm">
                    <Building2 className="w-4 h-4" />
                    Needs attention — {data.operational.laggingBranch.name}
                  </div>
                  <span className="font-semibold text-rose-600 dark:text-rose-300 text-sm">
                    {data.operational.laggingBranch.resolutionRate}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </SectionShell>
      </div>
    </div>
  );
};

export default ManagementFraudDashboard;
