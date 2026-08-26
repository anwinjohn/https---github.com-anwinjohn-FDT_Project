import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Gauge,
  Flag,
  FlaskConical,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { formatNumber } from '../utils/formatters';
import {
  ThemeMode,
  CHART,
  severityHex,
  getTokens,
  chartTheme,
} from '../design/Tokens';
import {
  Panel,
  StatCard,
  DataTable,
  SeverityBadge,
  ChartSkeleton,
  EmptyState,
} from '../design/Primitives';

/* ------------------------------------------------------------------ */
/*  Payload contract                                                    */
/*                                                                      */
/*  This is the shape the real trend-analysis endpoint should return.   */
/*  Until that endpoint exists, MOCK_TREND_DATA below satisfies it so   */
/*  the page can be built and reviewed end-to-end. To go live, pass a   */
/*  `data` prop matching TrendAnalysisData — nothing else in this file  */
/*  needs to change.                                                    */
/* ------------------------------------------------------------------ */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface DailyTrendPoint {
  date: string; // ISO date, e.g. '2026-08-13'
  total_alerts: number;
  critical_alerts: number;
  resolved_alerts: number;
}

export interface SeveritySlice {
  severity: Severity;
  count: number;
}

export interface RuleBreakdownItem {
  rule_id: string;
  rule_name: string;
  count: number;
  change_pct: number; // vs. previous period, e.g. 12.5 or -8.2
  severity: Severity;
}

export interface ResolutionPoint {
  date: string;
  avg_resolution_hours: number;
}

export interface TrendAnalysisData {
  period_start: string;
  period_end: string;
  total_alerts: number;
  alerts_change_pct: number;
  avg_resolution_hours: number;
  resolution_change_pct: number;
  daily_trend: DailyTrendPoint[];
  severity_distribution: SeveritySlice[];
  rule_breakdown: RuleBreakdownItem[];
  resolution_trend: ResolutionPoint[];
}

interface TrendAnalysisPanelProps {
  data?: TrendAnalysisData;
  isLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Mock payload                                                        */
/*                                                                      */
/*  Static and deterministic on purpose — a fraud dashboard should      */
/*  never redraw a trend line with different random numbers on every    */
/*  re-render. Swap this constant out for the API response.            */
/* ------------------------------------------------------------------ */

const dates30d = Array.from({ length: 30 }, (_, i) => {
  const d = new Date('2026-08-26');
  d.setDate(d.getDate() - (29 - i));
  return d.toISOString().slice(0, 10);
});

// A realistic 30-day pattern including a mid-period spike (e.g. a card-testing
// incident), tapering back to baseline after mitigation on day ~24.
const totalPattern = [
  62, 58, 65, 71, 60, 55, 68, 74, 70, 66, 73, 88, 112, 134, 121, 98, 84, 79, 76,
  72, 69, 65, 61, 58, 60, 63, 59, 57, 62, 60,
];
const criticalRatio = [
  0.15, 0.14, 0.16, 0.15, 0.13, 0.12, 0.17, 0.18, 0.16, 0.15, 0.19, 0.24, 0.31,
  0.35, 0.33, 0.27, 0.21, 0.18, 0.16, 0.15, 0.14, 0.13, 0.14, 0.13, 0.14, 0.15,
  0.13, 0.12, 0.14, 0.13,
];
const resolvedRatio = [
  0.82, 0.85, 0.83, 0.8, 0.86, 0.88, 0.81, 0.78, 0.8, 0.83, 0.76, 0.7, 0.62,
  0.58, 0.65, 0.72, 0.78, 0.82, 0.84, 0.85, 0.87, 0.88, 0.86, 0.87, 0.85, 0.86,
  0.88, 0.89, 0.87, 0.88,
];
const resolutionHours = [
  4.2, 4.0, 4.4, 4.6, 4.1, 3.8, 4.3, 4.8, 4.5, 4.2, 5.1, 6.4, 8.9, 10.2, 9.1,
  7.3, 5.8, 5.0, 4.6, 4.3, 4.0, 3.9, 4.1, 3.8, 4.0, 4.2, 3.9, 3.7, 4.0, 3.9,
];

const MOCK_TREND_DATA: TrendAnalysisData = {
  period_start: dates30d[0],
  period_end: dates30d[dates30d.length - 1],
  total_alerts: totalPattern.reduce((a, b) => a + b, 0),
  alerts_change_pct: 8.4,
  avg_resolution_hours: 4.6,
  resolution_change_pct: -6.1,
  daily_trend: dates30d.map((date, i) => ({
    date,
    total_alerts: totalPattern[i],
    critical_alerts: Math.round(totalPattern[i] * criticalRatio[i]),
    resolved_alerts: Math.round(totalPattern[i] * resolvedRatio[i]),
  })),
  severity_distribution: [
    { severity: 'critical', count: 118 },
    { severity: 'high', count: 246 },
    { severity: 'medium', count: 512 },
    { severity: 'low', count: 389 },
  ],
  rule_breakdown: [
    {
      rule_id: 'R-014',
      rule_name: 'Structuring Detection',
      count: 214,
      change_pct: 22.4,
      severity: 'critical',
    },
    {
      rule_id: 'R-032',
      rule_name: 'Velocity Check — High Frequency',
      count: 186,
      change_pct: 14.1,
      severity: 'high',
    },
    {
      rule_id: 'R-007',
      rule_name: 'Cross-Border High Value',
      count: 163,
      change_pct: -4.8,
      severity: 'high',
    },
    {
      rule_id: 'R-051',
      rule_name: 'Beneficiary Network Anomaly',
      count: 142,
      change_pct: 9.6,
      severity: 'medium',
    },
    {
      rule_id: 'R-019',
      rule_name: 'Dormant Account Reactivation',
      count: 97,
      change_pct: -11.2,
      severity: 'medium',
    },
    {
      rule_id: 'R-044',
      rule_name: 'Off-Hours Transaction Pattern',
      count: 88,
      change_pct: 3.2,
      severity: 'low',
    },
  ],
  resolution_trend: dates30d.map((date, i) => ({
    date,
    avg_resolution_hours: resolutionHours[i],
  })),
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const RANGE_OPTIONS: {
  id: '7d' | '14d' | '30d';
  label: string;
  days: number;
}[] = [
  { id: '7d', label: '7D', days: 7 },
  { id: '14d', label: '14D', days: 14 },
  { id: '30d', label: '30D', days: 30 },
];

const formatDateShort = (value: string) => {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ChangeBadge: React.FC<{
  pct: number;
  theme: ThemeMode;
  invert?: boolean;
}> = ({ pct, theme, invert }) => {
  // `invert`: for metrics where a decrease is the good outcome (e.g. resolution time).
  const isGood = invert ? pct <= 0 : pct >= 0;
  const color = isGood ? '#16A34A' : '#DC2626';
  const bg =
    theme === 'dark'
      ? isGood
        ? 'bg-emerald-500/10'
        : 'bg-red-500/10'
      : isGood
        ? 'bg-emerald-50'
        : 'bg-red-50';
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold ${bg}`}
      style={{ color }}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

/** Guards against a `data` prop that exists but doesn't match the contract yet
 *  (e.g. the parent is still passing the old AlertSummary[] shape, or a
 *  partially-wired API response). Without this, `payload.daily_trend.slice(...)`
 *  would crash the page instead of gracefully falling back to mock data. */
const isValidTrendData = (d: unknown): d is TrendAnalysisData => {
  if (!d || typeof d !== 'object') return false;
  const t = d as Partial<TrendAnalysisData>;
  return (
    Array.isArray(t.daily_trend) &&
    Array.isArray(t.severity_distribution) &&
    Array.isArray(t.rule_breakdown) &&
    Array.isArray(t.resolution_trend)
  );
};

const TrendAnalysisPanel: React.FC<TrendAnalysisPanelProps> = ({
  data,
  isLoading,
}) => {
  const { theme } = useTheme() as { theme: ThemeMode };
  const tk = getTokens(theme);
  const ct = chartTheme(theme);
  const [range, setRange] = useState<'7d' | '14d' | '30d'>('14d');
  const [showTotal, setShowTotal] = useState(true);
  const [showCritical, setShowCritical] = useState(true);

  const dataIsValid = isValidTrendData(data);
  const payload = dataIsValid ? data : MOCK_TREND_DATA;
  const isMock = !dataIsValid;
  const days = RANGE_OPTIONS.find((r) => r.id === range)!.days;

  const dailyTrend = useMemo(
    () => payload.daily_trend.slice(-days),
    [payload, days]
  );
  const resolutionTrend = useMemo(
    () => payload.resolution_trend.slice(-days),
    [payload, days]
  );

  const severityTotal =
    payload.severity_distribution.reduce((sum, s) => sum + s.count, 0) || 1;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className={`rounded-xl border ${tk.surface} shadow-sm p-5`}>
          <ChartSkeleton theme={theme} height={80} />
        </div>
        <div className={`rounded-xl border ${tk.surface} shadow-sm p-5`}>
          <ChartSkeleton theme={theme} height={340} />
        </div>
      </div>
    );
  }

  if (!payload.daily_trend.length) {
    return (
      <EmptyState
        theme={theme}
        icon={AlertTriangle}
        title="No Trend Data Available"
        description="No alert trend data was found for the selected period."
      />
    );
  }

  return (
    <div className={`space-y-5 ${tk.page}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-lg font-bold tracking-tight ${tk.textPrimary}`}>
            Trend Analysis
          </h2>
          <p className={`text-sm mt-0.5 ${tk.textSecondary}`}>
            {formatDateShort(payload.period_start)} &ndash;{' '}
            {formatDateShort(payload.period_end)}
            {isMock && (
              <span
                className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'}`}
              >
                <FlaskConical className="w-3 h-3" />
                Preview data &middot; connect API to replace
              </span>
            )}
          </p>
        </div>

        <div
          className={`inline-flex items-center rounded-lg border p-1 gap-1 ${tk.chip}`}
        >
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setRange(opt.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                range === opt.id
                  ? 'bg-blue-600 text-white'
                  : `${tk.textSecondary} hover:bg-slate-500/10`
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          theme={theme}
          icon={AlertTriangle}
          label="Total Alerts"
          value={formatNumber(payload.total_alerts)}
          sublabel={
            <ChangeBadge pct={payload.alerts_change_pct} theme={theme} />
          }
          accent="high"
        />
        <StatCard
          theme={theme}
          icon={Flag}
          label="Critical Share"
          value={`${Math.round(((payload.severity_distribution.find((s) => s.severity === 'critical')?.count || 0) / severityTotal) * 100)}%`}
          sublabel="of alerts this period"
          accent="critical"
          delay={0.05}
        />
        <StatCard
          theme={theme}
          icon={Clock}
          label="Avg Resolution Time"
          value={`${payload.avg_resolution_hours.toFixed(1)}h`}
          sublabel={
            <ChangeBadge
              pct={payload.resolution_change_pct}
              theme={theme}
              invert
            />
          }
          accent="medium"
          delay={0.1}
        />
        <StatCard
          theme={theme}
          icon={Gauge}
          label="Top Rule"
          value={payload.rule_breakdown[0]?.count ?? 0}
          sublabel={payload.rule_breakdown[0]?.rule_name ?? 'N/A'}
          accent="info"
          delay={0.15}
        />
      </div>

      {/* Daily alert trend */}
      <Panel
        theme={theme}
        icon={TrendingUp}
        iconColor={CHART.trend}
        title="Daily Alert Trend"
        subtitle="Total vs. critical-severity alerts"
        meta={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTotal((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${showTotal ? '' : 'opacity-40'}`}
              style={{ color: CHART.trend }}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: CHART.trend }}
              />
              Total
            </button>
            <button
              onClick={() => setShowCritical((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium transition-opacity ${showCritical ? '' : 'opacity-40'}`}
              style={{ color: severityHex('critical') }}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: severityHex('critical') }}
              />
              Critical
            </button>
          </div>
        }
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyTrend} margin={{ left: -8, right: 16 }}>
              <defs>
                <linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={CHART.trend}
                    stopOpacity={0.25}
                  />
                  <stop offset="100%" stopColor={CHART.trend} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="criticalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={severityHex('critical')}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor={severityHex('critical')}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis
                dataKey="date"
                tick={{ fill: ct.tick, fontSize: 12 }}
                tickFormatter={formatDateShort}
              />
              <YAxis tick={{ fill: ct.tick, fontSize: 12 }} />
              <Tooltip
                {...ct.tooltip}
                labelFormatter={(v) => formatDateShort(v as string)}
                formatter={(v: any, name: any) => [
                  formatNumber(v),
                  name === 'total_alerts' ? 'Total Alerts' : 'Critical Alerts',
                ]}
              />
              {showTotal && (
                <Area
                  type="monotone"
                  dataKey="total_alerts"
                  stroke={CHART.trend}
                  strokeWidth={2}
                  fill="url(#totalFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )}
              {showCritical && (
                <Area
                  type="monotone"
                  dataKey="critical_alerts"
                  stroke={severityHex('critical')}
                  strokeWidth={2}
                  fill="url(#criticalFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Severity distribution + rule breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel
          theme={theme}
          icon={Flag}
          iconColor={severityHex('critical')}
          title="Severity Distribution"
          subtitle="Share of alerts by severity, current period"
          delay={0.05}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={payload.severity_distribution}
                    dataKey="count"
                    nameKey="severity"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {payload.severity_distribution.map((entry, i) => (
                      <Cell key={i} fill={severityHex(entry.severity)} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...ct.tooltip}
                    formatter={(v: any, name: any) => [
                      formatNumber(v),
                      String(name).charAt(0).toUpperCase() +
                        String(name).slice(1),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {payload.severity_distribution.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border ${tk.chip}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: severityHex(entry.severity) }}
                    />
                    <SeverityBadge label={entry.severity} theme={theme} />
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold tabular-nums ${tk.textPrimary}`}
                    >
                      {formatNumber(entry.count)}
                    </div>
                    <div className={`text-[11px] ${tk.textTertiary}`}>
                      {Math.round((entry.count / severityTotal) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel
          theme={theme}
          icon={AlertTriangle}
          iconColor={CHART.frequency}
          title="Rule Breakdown"
          subtitle="Top triggered rules, ranked by volume"
          delay={0.1}
        >
          <div className="h-56 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={payload.rule_breakdown}
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
                  dataKey="rule_id"
                  tick={{ fill: ct.tick, fontSize: 12 }}
                  width={56}
                />
                <Tooltip
                  {...ct.tooltip}
                  formatter={(v: any) => [formatNumber(v), 'Alerts']}
                  labelFormatter={(id) =>
                    payload.rule_breakdown.find((r) => r.rule_id === id)
                      ?.rule_name || id
                  }
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                  {payload.rule_breakdown.map((entry, i) => (
                    <Cell key={i} fill={severityHex(entry.severity)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable
            theme={theme}
            keyField="rule_id"
            rows={payload.rule_breakdown}
            columns={[
              {
                key: 'rule_name',
                label: 'Rule',
                render: (r) => (
                  <div>
                    <div className="font-medium">{r.rule_name}</div>
                    <div className={`text-[11px] ${tk.textTertiary}`}>
                      {r.rule_id}
                    </div>
                  </div>
                ),
              },
              {
                key: 'count',
                label: 'Alerts',
                align: 'right',
                render: (r) => (
                  <span className="tabular-nums font-medium">
                    {formatNumber(r.count)}
                  </span>
                ),
              },
              {
                key: 'change_pct',
                label: 'vs. Prior',
                align: 'right',
                render: (r) => <ChangeBadge pct={r.change_pct} theme={theme} />,
              },
            ]}
          />
        </Panel>
      </div>

      {/* Resolution time trend */}
      <Panel
        theme={theme}
        icon={Clock}
        iconColor={CHART.secondary}
        title="Resolution Time Trend"
        subtitle="Average hours to resolve, by day"
        delay={0.15}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={resolutionTrend} margin={{ left: -8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis
                dataKey="date"
                tick={{ fill: ct.tick, fontSize: 12 }}
                tickFormatter={formatDateShort}
              />
              <YAxis
                tick={{ fill: ct.tick, fontSize: 12 }}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip
                {...ct.tooltip}
                labelFormatter={(v) => formatDateShort(v as string)}
                formatter={(v: any) => [
                  `${Number(v).toFixed(1)}h`,
                  'Avg. Resolution',
                ]}
              />
              <Line
                type="monotone"
                dataKey="avg_resolution_hours"
                stroke={CHART.secondary}
                strokeWidth={2}
                dot={{ fill: CHART.secondary, strokeWidth: 0, r: 3 }}
                activeDot={{
                  r: 5,
                  stroke: CHART.secondary,
                  strokeWidth: 2,
                  fill: theme === 'dark' ? '#0F172A' : '#fff',
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
};

export default TrendAnalysisPanel;
