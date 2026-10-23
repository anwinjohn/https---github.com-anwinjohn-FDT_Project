import React, { useMemo, useState } from 'react';
import { TrendAnalysisData } from '../services/trendAnalysisService';
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
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Gauge,
  Flag,
  CalendarDays,
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

interface TrendAnalysisPanelProps {
  data: TrendAnalysisData;
  isLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Layout constants                                                    */
/* ------------------------------------------------------------------ */

/**
 * Fixed body height shared by the "Severity Distribution" and "Rule Breakdown"
 * cards so they always line up. Anything taller scrolls inside the card.
 *
 * NOTE: `max-h-10` is only 2.5rem (40px), which would hide almost everything,
 * so a readable default is used here. Change this single value to resize both
 * cards (e.g. 'h-80', 'h-96', 'h-[32rem]').
 */
const CARD_BODY_HEIGHT = 'h-[28rem]';

/** Slim, theme-friendly scrollbar for the in-card scroll areas. */
const SCROLL_AREA =
  'overflow-y-auto overflow-x-hidden pr-2 [scrollbar-width:thin] ' +
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/40 ' +
  'hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/70';

const RANGE_OPTIONS: {
  id: '7d' | '14d' | '30d';
  label: string;
  days: number;
}[] = [
  { id: '7d', label: '7D', days: 7 },
  { id: '14d', label: '14D', days: 14 },
  { id: '30d', label: '30D', days: 30 },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const formatDateShort = (value: string) => {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold tabular-nums ${bg}`}
      style={{ color }}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
};

/** Small pill toggle used as a chart legend. */
const LegendToggle: React.FC<{
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  theme: ThemeMode;
}> = ({ label, color, active, onClick, theme }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
      active
        ? theme === 'dark'
          ? 'border-slate-600 bg-slate-800/60'
          : 'border-slate-300 bg-white shadow-sm'
        : 'border-transparent opacity-50 hover:opacity-80'
    }`}
    style={{ color }}
  >
    <span
      className="h-2 w-2 rounded-full"
      style={{ backgroundColor: color, opacity: active ? 1 : 0.4 }}
    />
    {label}
  </button>
);

/** Guards against a `data` prop that exists but doesn't match the contract yet
 *  (e.g. the parent is still passing the old AlertSummary[] shape, or a
 *  partially-wired API response). Without this, `payload.daily_trend.slice(...)`
 *  would crash the page instead of gracefully showing an empty state. */
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

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

const TrendAnalysisPanel: React.FC<TrendAnalysisPanelProps> = ({
  data,
  isLoading,
}) => {
  const { theme } = useTheme() as { theme: ThemeMode };
  const tk = getTokens(theme);
  const ct = chartTheme(theme);
  const [range] = useState<'7d' | '14d' | '30d'>('14d');
  const [showTotal, setShowTotal] = useState(true);
  const [showCritical, setShowCritical] = useState(true);

  const valid = isValidTrendData(data);
  const payload = data;
  const days = RANGE_OPTIONS.find((r) => r.id === range)!.days;

  const dailyTrend = useMemo(
    () => (valid ? payload.daily_trend.slice(-days) : []),
    [valid, payload, days]
  );
  const resolutionTrend = useMemo(
    () => (valid ? payload.resolution_trend.slice(-days) : []),
    [valid, payload, days]
  );

  const avgResolution = useMemo(() => {
    if (!resolutionTrend.length) return 0;
    return (
      resolutionTrend.reduce((s, r) => s + (r.avg_resolution_hours || 0), 0) /
      resolutionTrend.length
    );
  }, [resolutionTrend]);

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

  if (!valid || !payload.daily_trend.length) {
    return (
      <EmptyState
        theme={theme}
        icon={AlertTriangle}
        title="No trend data available"
        description="No alert trend data was found for the selected period."
      />
    );
  }

  const severityTotal =
    payload.severity_distribution.reduce((sum, s) => sum + s.count, 0) || 1;
  const criticalCount =
    payload.severity_distribution.find((s) => s.severity === 'critical')
      ?.count || 0;
  const maxRuleCount = Math.max(
    1,
    ...payload.rule_breakdown.map((r) => r.count)
  );
  // Grow the bar chart with the number of rules so long lists stay legible
  // and simply scroll inside the card.
  const ruleChartHeight = Math.max(200, payload.rule_breakdown.length * 34);

  return (
    <div className={`space-y-6 ${tk.page}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className={`text-xl font-bold tracking-tight ${tk.textPrimary}`}>
            Trend Analysis
          </h2>
          <p className={`text-sm mt-1 ${tk.textSecondary}`}>
            How alert volume, severity and resolution speed are changing.
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 self-start sm:self-auto rounded-full border px-3 py-1.5 text-xs font-medium ${tk.chip} ${tk.textSecondary}`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span className="tabular-nums">
            {formatDateShort(payload.period_start)} &ndash;{' '}
            {formatDateShort(payload.period_end)}
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
          value={`${Math.round((criticalCount / severityTotal) * 100)}%`}
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
          <div className="flex items-center gap-2">
            <LegendToggle
              label="Total"
              color={CHART.trend}
              active={showTotal}
              onClick={() => setShowTotal((v) => !v)}
              theme={theme}
            />
            <LegendToggle
              label="Critical"
              color={severityHex('critical')}
              active={showCritical}
              onClick={() => setShowCritical((v) => !v)}
              theme={theme}
            />
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
                    stopOpacity={0.28}
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
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={ct.grid}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: ct.tick, fontSize: 12 }}
                tickFormatter={formatDateShort}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tick={{ fill: ct.tick, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
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
                  strokeWidth={2.5}
                  fill="url(#totalFill)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              )}
              {showCritical && (
                <Area
                  type="monotone"
                  dataKey="critical_alerts"
                  stroke={severityHex('critical')}
                  strokeWidth={2.5}
                  fill="url(#criticalFill)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Severity distribution + rule breakdown (fixed height, inner scroll) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <Panel
          theme={theme}
          icon={Flag}
          iconColor={severityHex('critical')}
          title="Severity Distribution"
          subtitle="Share of alerts by severity, current period"
          delay={0.05}
        >
          <div className={`${CARD_BODY_HEIGHT} ${SCROLL_AREA}`}>
            {/* Donut with total in the centre */}
            <div className="relative h-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={payload.severity_distribution}
                    dataKey="count"
                    nameKey="severity"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={3}
                    cornerRadius={4}
                    stroke="none"
                  >
                    {payload.severity_distribution.map((entry, i) => (
                      <Cell key={i} fill={severityHex(entry.severity)} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...ct.tooltip}
                    formatter={(v: any, name: any) => [
                      formatNumber(v),
                      capitalize(String(name)),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-2xl font-bold tabular-nums leading-none ${tk.textPrimary}`}
                >
                  {formatNumber(severityTotal)}
                </span>
                <span className={`mt-1 text-xs ${tk.textTertiary}`}>
                  total alerts
                </span>
              </div>
            </div>

            {/* Severity rows with share bars */}
            <div className="mt-3 space-y-2">
              {payload.severity_distribution.map((entry, i) => {
                const pct = Math.round((entry.count / severityTotal) * 100);
                return (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2.5 ${tk.chip}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: severityHex(entry.severity),
                          }}
                        />
                        <SeverityBadge label={entry.severity} theme={theme} />
                      </div>
                      <div className="flex items-baseline gap-2 text-right">
                        <span
                          className={`text-sm font-semibold tabular-nums ${tk.textPrimary}`}
                        >
                          {formatNumber(entry.count)}
                        </span>
                        <span
                          className={`w-9 text-xs tabular-nums ${tk.textTertiary}`}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div
                      className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${
                        theme === 'dark' ? 'bg-slate-700/60' : 'bg-slate-200/80'
                      }`}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: severityHex(entry.severity),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
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
          <div className={`${CARD_BODY_HEIGHT} ${SCROLL_AREA}`}>
            {/* <div className="mb-4 shrink-0" style={{ height: ruleChartHeight }}>
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
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="rule_id"
                    tick={{ fill: ct.tick, fontSize: 12 }}
                    width={56}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    {...ct.tooltip}
                    cursor={{ fill: 'rgba(148,163,184,0.10)' }}
                    formatter={(v: any) => [formatNumber(v), 'Alerts']}
                    labelFormatter={(id) =>
                      payload.rule_breakdown.find((r) => r.rule_id === id)
                        ?.rule_name || id
                    }
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                    {payload.rule_breakdown.map((entry, i) => (
                      <Cell key={i} fill={severityHex(entry.severity)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div> */}

            <DataTable
              theme={theme}
              keyField="rule_id"
              rows={payload.rule_breakdown}
              columns={[
                {
                  key: 'rule_name',
                  label: 'Rule',
                  render: (r) => (
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.rule_name}</div>
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
                    <div className="flex flex-col items-end gap-1">
                      <span className="tabular-nums font-medium">
                        {formatNumber(r.count)}
                      </span>
                      <span
                        className={`block h-1 w-16 overflow-hidden rounded-full ${
                          theme === 'dark'
                            ? 'bg-slate-700/60'
                            : 'bg-slate-200/80'
                        }`}
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${(r.count / maxRuleCount) * 100}%`,
                            backgroundColor: severityHex(r.severity),
                          }}
                        />
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'change_pct',
                  label: 'vs. Prior',
                  align: 'right',
                  render: (r) => (
                    <ChangeBadge pct={r.change_pct} theme={theme} />
                  ),
                },
              ]}
            />
          </div>
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
        meta={
          <span className={`text-xs ${tk.textSecondary}`}>
            Period avg{' '}
            <span className={`font-semibold tabular-nums ${tk.textPrimary}`}>
              {avgResolution.toFixed(1)}h
            </span>
          </span>
        }
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={resolutionTrend} margin={{ left: -8, right: 16 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={ct.grid}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: ct.tick, fontSize: 12 }}
                tickFormatter={formatDateShort}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tick={{ fill: ct.tick, fontSize: 12 }}
                tickFormatter={(v) => `${v}h`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                {...ct.tooltip}
                labelFormatter={(v) => formatDateShort(v as string)}
                formatter={(v: any) => [
                  `${Number(v).toFixed(1)}h`,
                  'Avg. Resolution',
                ]}
              />
              {avgResolution > 0 && (
                <ReferenceLine
                  y={avgResolution}
                  stroke={ct.tick}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
              )}
              <Line
                type="monotone"
                dataKey="avg_resolution_hours"
                stroke={CHART.secondary}
                strokeWidth={2.5}
                dot={{ fill: CHART.secondary, strokeWidth: 0, r: 3 }}
                activeDot={{
                  r: 6,
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
