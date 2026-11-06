import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  ResponsiveContainer
} from 'recharts';
import {
  Shield,
  AlertTriangle,
  Users,
  Network,
  FileText,
  Target,
  Zap,
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
  Flag,
  Activity,
  Database,
  Layers,
  Radar,
  ChevronRight,
  X,
  UserPlus,
  Sparkles
} from 'lucide-react';
import { useRiskAnalytics } from '../hooks/useRiskAnalytics';
import { DateRange } from '../types/types';
import { useTheme } from '../context/ThemeContext';
import { formatNumber } from '../utils/formatters';
import { ThemeMode, CHART, severityHex, scoreHex, getTokens, chartTheme } from '../design/Tokens';
import { Panel, StatCard, DataTable, SeverityBadge, EmptyState, ChartSkeleton, Tag, ProgressBar, MetricChip, Callout } from '../design/Primitives';

interface RiskAnalyticsDashboardProps {
  dateRange: DateRange;
}

/* ------------------------------------------------------------------ */
/*  Defensive access                                                    */
/*                                                                      */
/*  metadata.data_quality reports missing_fields / data_warnings, which */
/*  means this payload is expected to sometimes be incomplete. Every    */
/*  read goes through safeGet with an explicit default, and every       */
/*  section renders nothing (rather than crashing) when its slice of    */
/*  data is absent or empty.                                            */
/* ------------------------------------------------------------------ */

const safeGet = (obj: any, path: string, defaultValue: any = null) => {
  try {
    const value = path.split('.').reduce((current, key) => current?.[key], obj);
    return value === undefined || value === null ? defaultValue : value;
  } catch {
    return defaultValue;
  }
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Risk Analytics Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
          <div className="text-center">
            <h3 className="text-base font-semibold text-slate-200 mb-1">Something went wrong</h3>
            <p className="text-slate-400 text-sm">Unable to display this section.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const parseDate = (value: string) => new Date((value || '').replace(' ', 'T'));

const formatDateShort = (value: string) => {
  const d = parseDate(value);
  return isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);

const RiskAnalyticsDashboard: React.FC<RiskAnalyticsDashboardProps> = ({ dateRange }) => {
  const { data, isLoading, error, lastUpdated, refreshData } = useRiskAnalytics(dateRange);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const { theme } = useTheme() as { theme: ThemeMode };
  const tk = getTokens(theme);
  const ct = chartTheme(theme);

  const tabs = [
    { id: 'overview', label: 'Executive Overview', icon: Gauge },
    { id: 'customers', label: 'Customer Risk', icon: Users },
    { id: 'transactions', label: 'Transaction Analysis', icon: CreditCard },
    { id: 'network', label: 'Network Analysis', icon: Network },
    { id: 'temporal', label: 'Temporal Patterns', icon: BarChart3 },
    { id: 'actions', label: 'Action Items', icon: Target }
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
      actionableRecommendations: safeGet(data, 'actionable_recommendations', [])
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <div className="text-center">
          <div className={`font-medium text-base ${tk.textPrimary}`}>Loading Risk Analytics...</div>
          <div className={`text-sm mt-1 ${tk.textSecondary}`}>Analyzing fraud patterns and risk indicators</div>
        </div>
      </div>
    );
  }

  if (error || !safeData) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <h2 className={`text-xl font-bold mb-2 ${tk.textPrimary}`}>Unable to Load Risk Analytics</h2>
        <p className={`mb-6 text-sm ${tk.textSecondary}`}>{error || 'No data available for the selected period'}</p>
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
    const transactionAnalysis = safeData.transactionAnalysis;
    const networkAnalysis = safeData.networkAnalysis;
    const temporalAnalysis = safeData.temporalAnalysis;

    const score = Number(safeGet(executiveSummary, 'overall_risk_score', 0)) || 0;
    const trend = safeGet(executiveSummary, 'risk_trend', 'Unknown');
    const findings: string[] = safeGet(executiveSummary, 'key_findings', []) || [];
    const topRiskFactors: string[] = safeGet(executiveSummary, 'top_risk_factors', []) || [];
    const gaugeColor = scoreHex(score);
    const gaugeData = [{ name: 'score', value: score, fill: gaugeColor }];

    const completeness = safeGet(metadata, 'data_quality.completeness_score', null);
    const dataWarnings: string[] = safeGet(metadata, 'data_quality.data_warnings', []) || [];

    const customerRiskCounts = safeGet(keyRiskIndicators, 'customer_risk', {});
    const severityDistribution = [
      { severity: 'critical', count: Number(safeGet(customerRiskCounts, 'critical', 0)) || 0 },
      { severity: 'high', count: Number(safeGet(customerRiskCounts, 'high', 0)) || 0 },
      { severity: 'medium', count: Number(safeGet(customerRiskCounts, 'medium', 0)) || 0 },
      { severity: 'low', count: Number(safeGet(customerRiskCounts, 'low', 0)) || 0 }
    ].filter((s) => s.count > 0);
    const severityTotal = severityDistribution.reduce((sum, s) => sum + s.count, 0) || 1;

    const anomalousSpikes = safeGet(temporalAnalysis, 'alert_trends.anomalous_spikes', []) || [];
    const totalAnomalies = safeGet(transactionAnalysis, 'amount_analysis.anomaly_detection.total_anomalies', 0);
    const clusterCount = (safeGet(networkAnalysis, 'cluster_analysis', []) || []).length;

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
                  <h1 className={`text-xl font-bold tracking-tight ${tk.textPrimary}`}>Fraud &amp; Risk Analytics</h1>
                  <p className={`text-sm ${tk.textSecondary}`}>Executive risk dashboard</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className={`text-xs uppercase tracking-wide ${tk.textTertiary}`}>Report Period</div>
                  <div className={`text-sm font-semibold ${tk.textPrimary}`}>
                    {safeGet(metadata, 'analysis_period.start', 'N/A')} &ndash; {safeGet(metadata, 'analysis_period.end', 'N/A')}
                  </div>
                  <div className={`text-xs mt-1 flex items-center justify-end gap-2 ${tk.textTertiary}`}>
                    {lastUpdated && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {lastUpdated.toLocaleTimeString()}
                      </span>
                    )}
                    {completeness != null && (
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {completeness}% complete
                      </span>
                    )}
                  </div>
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
                      <PolarAngleAxis type="number" domain={[0, 100]} dataKey="value" angleAxisId={0} tick={false} />
                      <RadialBar background={{ fill: theme === 'dark' ? '#1F2937' : '#EEF2F6' }} dataKey="value" cornerRadius={6} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
                    <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: gaugeColor }}>{score}</span>
                    <span className={`text-[10px] uppercase tracking-wide mt-0.5 ${tk.textTertiary}`}>Risk Score &middot; {trend}</span>
                  </div>
                </div>
              </div>
            </div>

            {topRiskFactors.length > 0 && (
              <div className={`flex flex-wrap items-center gap-2 mt-5 pt-5 border-t ${tk.border}`}>
                <span className={`text-xs font-medium uppercase tracking-wide mr-1 ${tk.textTertiary}`}>Top Risk Factors</span>
                {topRiskFactors.map((f, i) => (
                  <Tag key={i} label={f} theme={theme} />
                ))}
              </div>
            )}
          </div>

          {anomalousSpikes.length > 0 && (
            <Callout
              theme={theme}
              variant="warning"
              icon={Activity}
              title={`Alert volume spike detected — ${anomalousSpikes[0].date}`}
              description={`${formatNumber(anomalousSpikes[0].count)} alerts, ${anomalousSpikes[0].deviation_from_normal} vs. normal volume.`}
              meta={
                (anomalousSpikes[0].primary_contributors || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {anomalousSpikes[0].primary_contributors.map((c: string, i: number) => (
                      <Tag key={i} label={c} theme={theme} />
                    ))}
                  </div>
                )
              }
            />
          )}

          {dataWarnings.length > 0 && (
            <Callout
              theme={theme}
              variant="info"
              icon={Database}
              title="Data quality notice"
              description={dataWarnings.join(' ')}
            />
          )}

          {/* KPI stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              theme={theme}
              icon={AlertTriangle}
              label="Total Alerts"
              value={formatNumber(safeGet(keyRiskIndicators, 'volume_metrics.total_alerts', 0))}
              sublabel={`${formatNumber(safeGet(keyRiskIndicators, 'volume_metrics.unique_customers', 0))} unique customers`}
              accent="high"
              delay={0.05}
            />
            <StatCard
              theme={theme}
              icon={Users}
              label="Critical Customers"
              value={safeGet(customerRiskCounts, 'critical', 0)}
              sublabel="Requiring immediate attention"
              accent="critical"
              delay={0.1}
            />
            <StatCard
              theme={theme}
              icon={Sparkles}
              label="Anomalous Transactions"
              value={formatNumber(totalAnomalies)}
              sublabel="Flagged by amount analysis"
              accent="medium"
              delay={0.15}
            />
            <StatCard
              theme={theme}
              icon={Layers}
              label="Suspicious Clusters"
              value={clusterCount}
              sublabel="Networks under review"
              accent="info"
              delay={0.2}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Key findings */}
            <Panel theme={theme} icon={FileText} iconColor={CHART.trend} title="Key Findings" delay={0.25}>
              {findings.length === 0 ? (
                <p className={`text-sm ${tk.textTertiary}`}>No key findings for this period.</p>
              ) : (
                <div className="space-y-2.5">
                  {findings.map((finding: string, index: number) => (
                    <div key={index} className={`flex items-start gap-2.5 p-3 rounded-lg border ${tk.chip}`}>
                      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span className={`text-sm ${tk.textSecondary}`}>{finding}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Customer risk distribution */}
            <Panel theme={theme} icon={Flag} iconColor={severityHex('critical')} title="Customer Risk Distribution" delay={0.3}>
              {severityDistribution.length === 0 ? (
                <p className={`text-sm ${tk.textTertiary}`}>No customer risk data for this period.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={severityDistribution} dataKey="count" nameKey="severity" innerRadius={48} outerRadius={72} paddingAngle={3}>
                          {severityDistribution.map((entry, i) => (
                            <Cell key={i} fill={severityHex(entry.severity)} />
                          ))}
                        </Pie>
                        <Tooltip {...ct.tooltip} formatter={(v: any, name: any) => [formatNumber(v), String(name).charAt(0).toUpperCase() + String(name).slice(1)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {severityDistribution.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <SeverityBadge label={entry.severity} theme={theme} />
                        <span className={`text-sm font-semibold tabular-nums ${tk.textPrimary}`}>
                          {entry.count} <span className={`font-normal text-xs ${tk.textTertiary}`}>({Math.round((entry.count / severityTotal) * 100)}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </div>
      </ErrorBoundary>
    );
  };

  /* ---------------------------- Customers ---------------------------- */

  const renderCustomersTab = () => {
    const customerRiskAnalysis = safeData.customerRiskAnalysis;
    const predictiveInsights = safeData.predictiveInsights;
    const criticalCustomers = safeGet(customerRiskAnalysis, 'critical_customers', []) || [];
    const newHighRisk = safeGet(customerRiskAnalysis, 'emerging_risks.new_high_risk_customers', []) || [];
    const dormantReactivated = safeGet(customerRiskAnalysis, 'emerging_risks.dormant_reactivated', []) || [];
    const propensityCustomers = safeGet(predictiveInsights, 'propensity_scores.high_risk_customers', []) || [];

    if (criticalCustomers.length === 0 && newHighRisk.length === 0 && propensityCustomers.length === 0) {
      return (
        <ErrorBoundary>
          <EmptyState
            theme={theme}
            icon={Users}
            title="No Customer Risk Data Found"
            description="No critical, emerging, or predicted high-risk customers were identified in the current analysis period."
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
      beneficiaries: Number(safeGet(c, 'activity_summary.beneficiary_count', 0)) || 0,
      id: safeGet(c, 'customer_id', i)
    }));

    const propensityChartData = propensityCustomers
      .slice()
      .sort((a: any, b: any) => (Number(b.propensity_score) || 0) - (Number(a.propensity_score) || 0))
      .map((c: any, i: number) => ({
        id: safeGet(c, 'customer_id', i),
        label: safeGet(c, 'name', 'Unknown'),
        score: Number(safeGet(c, 'propensity_score', 0)) || 0
      }));

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {criticalCustomers.length > 0 && (
            <Panel
              theme={theme}
              icon={Target}
              iconColor="#DC2626"
              title={`Critical Risk Customers (${criticalCustomers.length})`}
              meta={<span className={`text-xs ${tk.textTertiary}`}>Bubble size = beneficiaries</span>}
            >
              <div className="h-80 mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis
                      type="number"
                      dataKey="alerts"
                      name="Alerts"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      label={{ value: 'Alert Count', position: 'insideBottom', offset: -4, fill: ct.tick, fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="amount"
                      name="Total Amount"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      tickFormatter={(v) => formatNumber(v)}
                      width={70}
                    />
                    <ZAxis type="number" dataKey="beneficiaries" range={[60, 400]} name="Beneficiaries" />
                    <Tooltip
                      {...ct.tooltip}
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(value: any, name: any) => (name === 'Total Amount' ? [`AED ${formatNumber(value)}`, name] : [formatNumber(value), name])}
                      labelFormatter={() => ''}
                    />
                    <Scatter data={bubbleData} fill={CHART.amount} fillOpacity={0.75} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                theme={theme}
                keyField="id"
                rows={criticalCustomers.map((c: any, i: number) => ({
                  id: safeGet(c, 'customer_id', i),
                  name: safeGet(c, 'name', 'Unknown Customer'),
                  profession: safeGet(c, 'profession', 'Unknown'),
                  riskScore: safeGet(c, 'risk_profile.score', null),
                  factors: safeGet(c, 'risk_profile.factors', []) || [],
                  velocity: safeGet(c, 'activity_summary.transaction_velocity', 'N/A'),
                  alerts: safeGet(c, 'activity_summary.alert_count', 0),
                  beneficiaries: safeGet(c, 'activity_summary.beneficiary_count', 0),
                  amount: safeGet(c, 'activity_summary.total_amount', 0)
                }))}
                columns={[
                  {
                    key: 'name',
                    label: 'Customer',
                    render: (r) => (
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className={`text-xs flex items-center gap-1 mt-0.5 ${tk.textTertiary}`}>
                          <Briefcase className="w-3 h-3" />
                          {r.profession} &middot; {r.velocity}
                        </div>
                        {r.factors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {r.factors.map((f: string, i: number) => (
                              <Tag key={i} label={f} theme={theme} />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  },
                  {
                    key: 'riskScore',
                    label: 'Risk Score',
                    align: 'right',
                    render: (r) => (r.riskScore != null ? <span className="tabular-nums font-semibold" style={{ color: scoreHex(r.riskScore * 10) }}>{r.riskScore}</span> : <span className={tk.textTertiary}>N/A</span>)
                  },
                  { key: 'alerts', label: 'Alerts', align: 'right', render: (r) => <span className="tabular-nums font-medium">{formatNumber(r.alerts)}</span> },
                  { key: 'beneficiaries', label: 'Beneficiaries', align: 'right', render: (r) => <span className="tabular-nums">{formatNumber(r.beneficiaries)}</span> },
                  { key: 'amount', label: 'Total Amount', align: 'right', render: (r) => <span className="tabular-nums font-medium">AED {formatNumber(r.amount)}</span> }
                ]}
              />
            </Panel>
          )}

          {propensityChartData.length > 0 && (
            <Panel theme={theme} icon={Radar} iconColor={CHART.network} title="Predictive Risk Propensity" subtitle="Model-scored likelihood of escalating risk" delay={0.05}>
              <div className="h-56 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={propensityChartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: ct.tick, fontSize: 12 }} />
                    <YAxis type="category" dataKey="label" tick={{ fill: ct.tick, fontSize: 12 }} width={140} />
                    <Tooltip {...ct.tooltip} formatter={(v: any) => [`${v}`, 'Propensity Score']} />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16}>
                      {propensityChartData.map((entry: any, i: number) => (
                        <Cell key={i} fill={scoreHex(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {propensityCustomers.map((c: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg border ${tk.chip}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-sm font-medium ${tk.textPrimary}`}>{safeGet(c, 'name', 'Unknown')}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: scoreHex(Number(safeGet(c, 'propensity_score', 0))) }}>
                        {safeGet(c, 'propensity_score', 0)}
                      </span>
                    </div>
                    <ProgressBar value={Number(safeGet(c, 'propensity_score', 0))} theme={theme} color={scoreHex(Number(safeGet(c, 'propensity_score', 0)))} />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(safeGet(c, 'top_risk_factors', []) || []).map((f: string, fi: number) => (
                        <Tag key={fi} label={f} theme={theme} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {(newHighRisk.length > 0 || dormantReactivated.length > 0) && (
            <Panel theme={theme} icon={UserPlus} iconColor={CHART.frequency} title="Emerging Risks" subtitle="Customers newly entering high-risk status" delay={0.1}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {newHighRisk.length > 0 && (
                  <div>
                    <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${tk.textTertiary}`}>New High-Risk Customers</h4>
                    <DataTable
                      theme={theme}
                      keyField="id"
                      rows={newHighRisk.map((c: any, i: number) => ({
                        id: safeGet(c, 'customer_id', i),
                        name: safeGet(c, 'name', 'Unknown'),
                        days: safeGet(c, 'days_since_first_alert', 0),
                        perDay: safeGet(c, 'alerts_per_day', 0)
                      }))}
                      columns={[
                        { key: 'name', label: 'Customer' },
                        { key: 'days', label: 'Days Since First Alert', align: 'right' },
                        { key: 'perDay', label: 'Alerts/Day', align: 'right', render: (r) => <span className="tabular-nums font-medium">{r.perDay}</span> }
                      ]}
                    />
                  </div>
                )}
                {dormantReactivated.length > 0 && (
                  <div>
                    <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${tk.textTertiary}`}>Dormant Accounts Reactivated</h4>
                    <DataTable theme={theme} rows={dormantReactivated} columns={[{ key: 'name', label: 'Customer' }]} />
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>
      </ErrorBoundary>
    );
  };

  /* -------------------------- Transactions --------------------------- */

  const renderTransactionsTab = () => {
    const transactionAnalysis = safeData.transactionAnalysis;
    const patternDetection = safeGet(transactionAnalysis, 'pattern_detection', {});
    const highFrequency = safeGet(patternDetection, 'high_frequency', []) || [];
    const highValue = safeGet(patternDetection, 'high_value', []) || [];
    const unusualTiming = safeGet(patternDetection, 'unusual_timing', {});
    const offHour = Number(safeGet(unusualTiming, 'off_hour_transactions', 0)) || 0;
    const weekend = Number(safeGet(unusualTiming, 'weekend_transactions', 0)) || 0;

    const anomalyDetection = safeGet(transactionAnalysis, 'amount_analysis.anomaly_detection', {});
    const topAnomalies = safeGet(anomalyDetection, 'top_amount_anomalies', []) || [];
    const totalAnomalies = safeGet(anomalyDetection, 'total_anomalies', 0);
    const roundNumbers = safeGet(transactionAnalysis, 'amount_analysis.round_number_transactions', {});

    const hasData = highFrequency.length > 0 || highValue.length > 0 || offHour > 0 || weekend > 0 || topAnomalies.length > 0;

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
      count: Number(safeGet(p, 'characteristics.count', 0)) || 0
    }));

    const valueChartData = highValue.map((t: any, i: number) => ({
      id: i,
      label: safeGet(t, 'customer_name', 'Unknown'),
      amount: Number(safeGet(t, 'characteristics.amount', 0)) || 0
    }));

    const timingPie = [
      { name: 'Off-Hour', value: offHour, color: CHART.network },
      { name: 'Weekend', value: weekend, color: '#6366F1' }
    ].filter((d) => d.value > 0);

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {topAnomalies.length > 0 && (
            <Panel
              theme={theme}
              icon={Sparkles}
              iconColor="#DC2626"
              title={`Amount Anomalies (${formatNumber(totalAnomalies)} flagged)`}
              subtitle="Transactions with the most unusual amount patterns, scored by an isolation model"
              meta={
                roundNumbers && safeGet(roundNumbers, 'count', 0) > 0 ? (
                  <MetricChip
                    theme={theme}
                    label="Round-number transactions"
                    value={`${formatNumber(safeGet(roundNumbers, 'count', 0))} (${safeGet(roundNumbers, 'percentage_of_total', 0)}%)`}
                  />
                ) : undefined
              }
            >
              <DataTable
                theme={theme}
                rows={topAnomalies.slice(0, 10).map((a: any, i: number) => ({
                  id: i,
                  customer: safeGet(a, 'customer', 'Unknown'),
                  amount: safeGet(a, 'amount', 0),
                  context: safeGet(a, 'context', ''),
                  score: safeGet(a, 'anomaly_score', 0)
                }))}
                columns={[
                  {
                    key: 'customer',
                    label: 'Customer',
                    render: (r) => (
                      <div>
                        <div className="font-medium">{r.customer}</div>
                        <div className={`text-xs mt-0.5 ${tk.textTertiary}`}>{r.context}</div>
                      </div>
                    )
                  },
                  { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="tabular-nums font-medium">AED {formatNumber(r.amount)}</span> },
                  { key: 'score', label: 'Anomaly Score', align: 'right', render: (r) => <span className="tabular-nums text-red-500 font-medium">{Number(r.score).toFixed(3)}</span> }
                ]}
              />
            </Panel>
          )}

          {highFrequency.length > 0 && (
            <Panel theme={theme} icon={Zap} iconColor={CHART.frequency} title="High-Frequency Transaction Patterns" delay={0.05}>
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={freqChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
                    <YAxis type="category" dataKey="label" tick={{ fill: ct.tick, fontSize: 12 }} width={110} />
                    <Tooltip {...ct.tooltip} formatter={(v: any) => [formatNumber(v), 'Transactions']} />
                    <Bar dataKey="count" fill={CHART.frequency} radius={[0, 4, 4, 0]} barSize={16} />
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
                  avgAmount: safeGet(p, 'characteristics.avg_amount', 0),
                  amount: safeGet(p, 'characteristics.total_amount', 0),
                  service: safeGet(p, 'characteristics.service_type', 'Unknown')
                }))}
                columns={[
                  { key: 'customer', label: 'Customer ID' },
                  { key: 'pattern', label: 'Pattern' },
                  { key: 'service', label: 'Service Type' },
                  { key: 'count', label: 'Transactions', align: 'right', render: (r) => <span className="tabular-nums font-medium">{formatNumber(r.count)}</span> },
                  { key: 'avgAmount', label: 'Avg. Amount', align: 'right', render: (r) => <span className="tabular-nums">AED {formatNumber(r.avgAmount)}</span> },
                  { key: 'amount', label: 'Total Amount', align: 'right', render: (r) => <span className="tabular-nums font-medium">AED {formatNumber(r.amount)}</span> }
                ]}
              />
            </Panel>
          )}

          {highValue.length > 0 && (
            <Panel theme={theme} icon={DollarSign} iconColor={CHART.amount} title="High-Value Transactions" delay={0.1}>
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
                    <YAxis type="category" dataKey="label" tick={{ fill: ct.tick, fontSize: 12 }} width={110} />
                    <Tooltip {...ct.tooltip} formatter={(v: any) => [`AED ${formatNumber(v)}`, 'Amount']} />
                    <Bar dataKey="amount" fill={CHART.amount} radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                theme={theme}
                rows={highValue.map((t: any, i: number) => ({
                  id: i,
                  customer: safeGet(t, 'customer_name', 'Unknown Customer'),
                  type: safeGet(t, 'transaction_type', 'Unknown'),
                  service: safeGet(t, 'characteristics.service_type', 'Unknown'),
                  counterparties: (safeGet(t, 'characteristics.counterparties', []) || []).join(', ') || 'N/A',
                  amount: safeGet(t, 'characteristics.amount', 0)
                }))}
                columns={[
                  {
                    key: 'customer',
                    label: 'Customer',
                    render: (r) => (
                      <div>
                        <div className="font-medium">{r.customer}</div>
                        <div className={`text-xs mt-0.5 ${tk.textTertiary}`}>&rarr; {r.counterparties}</div>
                      </div>
                    )
                  },
                  { key: 'type', label: 'Transaction Type' },
                  { key: 'service', label: 'Service Type' },
                  { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="tabular-nums font-semibold" style={{ color: CHART.amount }}>AED {formatNumber(r.amount)}</span> }
                ]}
              />
            </Panel>
          )}

          {(offHour > 0 || weekend > 0) && (
            <Panel theme={theme} icon={Clock} iconColor={CHART.network} title="Unusual Timing Patterns" delay={0.15}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={timingPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
                        {timingPie.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip {...ct.tooltip} formatter={(v: any) => formatNumber(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {timingPie.map((entry, i) => (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${tk.chip}`}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className={`text-sm ${tk.textSecondary}`}>{entry.name} Transactions</span>
                      </div>
                      <span className={`text-lg font-bold tabular-nums ${tk.textPrimary}`}>{formatNumber(entry.value)}</span>
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
    const keyRiskIndicators = safeData.keyRiskIndicators;
    const clusterAnalysis = safeGet(networkAnalysis, 'cluster_analysis', []) || [];
    const centralActors = safeGet(networkAnalysis, 'central_actors', []) || [];
    const detailedRelationships = safeGet(networkAnalysis, 'detailed_relationships', []) || [];
    const topBranch = safeGet(keyRiskIndicators, 'branch_risk.top_branch_by_anomalies', null);
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
      transactions: Number(safeGet(c, 'characteristics.total_transactions', 0)) || 0,
      amount: Number(safeGet(c, 'characteristics.total_amount', 0)) || 0,
      customers: Number(safeGet(c, 'characteristics.customer_count', 0)) || 0
    }));

    const actorChartData = centralActors.slice(0, 8).map((a: any, i: number) => ({
      id: safeGet(a, 'customer_code', i),
      label: safeGet(a, 'customer_name', 'Unknown'),
      transactions: Number(safeGet(a, 'transaction_summary.total_transactions', 0)) || 0
    }));

    const activeCluster = clusterAnalysis.find((c: any) => safeGet(c, 'cluster_id', null) === selectedCluster) || null;
    const activeClusterRelationships = selectedCluster
      ? detailedRelationships.filter((r: any) => safeGet(r, 'cluster_id', null) === selectedCluster)
      : [];

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {clusterAnalysis.length > 0 && (
            <Panel
              theme={theme}
              icon={Network}
              iconColor={CHART.network}
              title={`Suspicious Network Clusters (${clusterAnalysis.length})`}
              subtitle={topBranch ? `Highest anomaly volume at ${topBranch}` : undefined}
              meta={<span className={`text-xs ${tk.textTertiary}`}>Bubble size = customers &middot; click a row to inspect</span>}
            >
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis
                      type="number"
                      dataKey="transactions"
                      name="Transactions"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      label={{ value: 'Total Transactions', position: 'insideBottom', offset: -4, fill: ct.tick, fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="amount"
                      name="Total Amount"
                      tick={{ fill: ct.tick, fontSize: 12 }}
                      tickFormatter={(v) => formatNumber(v)}
                      width={70}
                    />
                    <ZAxis type="number" dataKey="customers" range={[60, 400]} name="Customers" />
                    <Tooltip
                      {...ct.tooltip}
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(value: any, name: any) => (name === 'Total Amount' ? [`AED ${formatNumber(value)}`, name] : [formatNumber(value), name])}
                      labelFormatter={() => ''}
                    />
                    <Scatter
                      data={clusterBubbles}
                      fill={CHART.network}
                      fillOpacity={0.75}
                      onClick={(point: any) => setSelectedCluster((prev) => (prev === point.id ? null : point.id))}
                      cursor="pointer"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                theme={theme}
                keyField="id"
                onRowClick={(row) => setSelectedCluster((prev) => (prev === row.id ? null : row.id))}
                selectedKey={selectedCluster}
                rows={clusterAnalysis.map((c: any, i: number) => ({
                  id: safeGet(c, 'cluster_id', i),
                  riskScore: safeGet(c, 'risk_score', 0),
                  customers: safeGet(c, 'characteristics.customer_count', 0),
                  transactions: safeGet(c, 'characteristics.total_transactions', 0),
                  amount: safeGet(c, 'characteristics.total_amount', 0),
                  span: safeGet(c, 'characteristics.time_span_days', 0),
                  pattern: safeGet(c, 'characteristics.transaction_pattern', null),
                  branches: (safeGet(c, 'characteristics.common_attributes.branches', []) || []).join(', ') || 'N/A',
                  countries: (safeGet(c, 'characteristics.common_attributes.countries', []) || []).join(', ') || 'N/A'
                }))}
                columns={[
                  {
                    key: 'id',
                    label: 'Cluster',
                    render: (r) => (
                      <div className="flex items-center gap-1.5">
                        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${selectedCluster === r.id ? 'rotate-90' : ''} ${tk.textTertiary}`} />
                        <div>
                          <div className="font-medium">{r.id}</div>
                          {r.pattern && <div className={`text-[11px] ${tk.textTertiary}`}>{String(r.pattern).replace(/_/g, ' ')}</div>}
                        </div>
                      </div>
                    )
                  },
                  {
                    key: 'riskScore',
                    label: 'Risk Score',
                    align: 'right',
                    render: (r) => <span className="tabular-nums font-semibold" style={{ color: scoreHex(r.riskScore) }}>{r.riskScore}</span>
                  },
                  { key: 'customers', label: 'Customers', align: 'right', render: (r) => <span className="tabular-nums font-medium">{r.customers}</span> },
                  { key: 'transactions', label: 'Transactions', align: 'right', render: (r) => <span className="tabular-nums">{formatNumber(r.transactions)}</span> },
                  { key: 'amount', label: 'Total Value', align: 'right', render: (r) => <span className="tabular-nums font-medium">AED {formatNumber(r.amount)}</span> },
                  { key: 'span', label: 'Span (days)', align: 'right' },
                  { key: 'branches', label: 'Branches' },
                  { key: 'countries', label: 'Countries' }
                ]}
              />

              <AnimatePresence>
                {activeCluster && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className={`mt-4 rounded-lg border ${tk.border} ${tk.surfaceAlt} p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`text-sm font-semibold ${tk.textPrimary}`}>Cluster Detail &middot; {selectedCluster}</h4>
                        <button onClick={() => setSelectedCluster(null)} className={`p-1 rounded hover:bg-slate-500/10 ${tk.textTertiary}`}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {(safeGet(activeCluster, 'fraud_indications', []) || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {activeCluster.fraud_indications.map((f: string, i: number) => (
                            <Tag key={i} label={f} theme={theme} />
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${tk.textTertiary}`}>Customers in Cluster</h5>
                          <DataTable
                            theme={theme}
                            keyField="customer_code"
                            rows={safeGet(activeCluster, 'participants.customers', []) || []}
                            columns={[
                              { key: 'customer_name', label: 'Customer' },
                              { key: 'transaction_count', label: 'Tx', align: 'right' },
                              { key: 'total_amount', label: 'Amount', align: 'right', render: (r: any) => <span className="tabular-nums">AED {formatNumber(r.total_amount)}</span> }
                            ]}
                          />
                        </div>
                        <div>
                          <h5 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${tk.textTertiary}`}>Beneficiaries</h5>
                          <DataTable
                            theme={theme}
                            keyField="beneficiary_name"
                            rows={(safeGet(activeCluster, 'participants.beneficiaries', []) || []).slice(0, 6)}
                            columns={[
                              { key: 'beneficiary_name', label: 'Beneficiary', render: (r: any) => <span>{r.beneficiary_name}<span className={`ml-1.5 text-[11px] ${tk.textTertiary}`}>{r.country}</span></span> },
                              { key: 'transaction_count', label: 'Tx', align: 'right' },
                              { key: 'total_amount', label: 'Amount', align: 'right', render: (r: any) => <span className="tabular-nums">AED {formatNumber(r.total_amount)}</span> }
                            ]}
                          />
                        </div>
                      </div>

                      {activeClusterRelationships.length > 0 && (
                        <div className="mt-4">
                          <h5 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${tk.textTertiary}`}>Customer &rarr; Beneficiary Relationships</h5>
                          <DataTable
                            theme={theme}
                            rows={activeClusterRelationships.slice(0, 8).map((r: any, i: number) => ({
                              id: i,
                              from: r.customer_name,
                              to: r.beneficiary_name,
                              count: r.transaction_count,
                              amount: r.total_amount,
                              window: `${formatDateShort(r.first_transaction)} – ${formatDateShort(r.last_transaction)}`
                            }))}
                            columns={[
                              { key: 'from', label: 'Customer' },
                              { key: 'to', label: 'Beneficiary' },
                              { key: 'window', label: 'Window' },
                              { key: 'count', label: 'Tx', align: 'right' },
                              { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="tabular-nums">AED {formatNumber(r.amount)}</span> }
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>
          )}

          {centralActors.length > 0 && (
            <Panel theme={theme} icon={Users} iconColor="#EA580C" title={`Central Network Actors (${centralActors.length})`} delay={0.05}>
              <div className="h-56 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={actorChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
                    <YAxis type="category" dataKey="label" tick={{ fill: ct.tick, fontSize: 12 }} width={110} />
                    <Tooltip {...ct.tooltip} formatter={(v: any) => [formatNumber(v), 'Transactions']} />
                    <Bar dataKey="transactions" fill="#EA580C" radius={[0, 4, 4, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                theme={theme}
                keyField="id"
                rows={centralActors.map((a: any, i: number) => ({
                  id: safeGet(a, 'customer_code', i),
                  name: safeGet(a, 'customer_name', 'Unknown Customer'),
                  centrality: safeGet(a, 'centrality_score', 0),
                  connections: safeGet(a, 'connection_types', []) || [],
                  risk: safeGet(a, 'risk_implications', 'Unknown'),
                  transactions: safeGet(a, 'transaction_summary.total_transactions', 0),
                  beneficiaries: safeGet(a, 'transaction_summary.beneficiary_count', 0),
                  amount: safeGet(a, 'transaction_summary.total_amount', 0),
                  topBeneficiary: safeGet(a, 'transaction_summary.top_beneficiaries.0.name', null)
                }))}
                columns={[
                  {
                    key: 'name',
                    label: 'Customer',
                    render: (r) => (
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className={`text-xs mt-0.5 ${tk.textTertiary}`}>{r.risk}</div>
                        {r.connections.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.connections.map((c: string, i: number) => (
                              <Tag key={i} label={c} theme={theme} />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  },
                  { key: 'centrality', label: 'Centrality', align: 'right', render: (r) => <span className="tabular-nums">{Number(r.centrality).toFixed(3)}</span> },
                  { key: 'transactions', label: 'Transactions', align: 'right', render: (r) => <span className="tabular-nums font-medium">{formatNumber(r.transactions)}</span> },
                  { key: 'beneficiaries', label: 'Beneficiaries', align: 'right', render: (r) => <span className="tabular-nums">{formatNumber(r.beneficiaries)}</span> },
                  { key: 'amount', label: 'Total Amount', align: 'right', render: (r) => <span className="tabular-nums font-medium">AED {formatNumber(r.amount)}</span> }
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
    const hourlyPatternRaw = safeGet(alertTrends, 'hourly_pattern', []) || [];
    const anomalousSpikes = safeGet(alertTrends, 'anomalous_spikes', []) || [];
    const hasData = dailyPattern.length > 0 || hourlyPatternRaw.length > 0;

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

    // Fill every hour 0–23 so gaps read as "zero activity", not missing data.
    const hourlyByHour = new Map(hourlyPatternRaw.map((h: any) => [Number(h.hour), Number(h.count) || 0]));
    const hourlyPattern = HOURS_24.map((h) => ({ hour: h, count: hourlyByHour.get(h) || 0 }));

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          {anomalousSpikes.length > 0 && (
            <Panel theme={theme} icon={Activity} iconColor="#D97706" title="Anomalous Spikes" subtitle="Periods with alert volume well outside the normal range">
              <div className="space-y-3">
                {anomalousSpikes.map((s: any, i: number) => (
                  <div key={i} className={`p-4 rounded-lg border ${tk.chip}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className={`text-sm font-semibold ${tk.textPrimary}`}>{s.date}</span>
                      <span className="text-sm font-bold" style={{ color: '#D97706' }}>{formatNumber(s.count)} alerts &middot; {s.deviation_from_normal}</span>
                    </div>
                    {(s.primary_contributors || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.primary_contributors.map((c: string, ci: number) => (
                          <Tag key={ci} label={c} theme={theme} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {dailyPattern.length > 0 && (
            <Panel theme={theme} icon={Calendar} iconColor={CHART.trend} title="Daily Alert Patterns" delay={0.05}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyPattern} margin={{ left: -8, right: 16 }}>
                    <defs>
                      <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.trend} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={CHART.trend} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis dataKey="date" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={formatDateShort} />
                    <YAxis tick={{ fill: ct.tick, fontSize: 12 }} />
                    <Tooltip {...ct.tooltip} labelFormatter={(value) => formatDateShort(value as string)} formatter={(v: any) => [formatNumber(v), 'Alerts']} />
                    <Area
                      type="monotone"
                      dataKey="alert_count"
                      stroke={CHART.trend}
                      strokeWidth={2}
                      fill="url(#dailyFill)"
                      dot={{ fill: CHART.trend, strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, stroke: CHART.trend, strokeWidth: 2, fill: theme === 'dark' ? '#0F172A' : '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          {hourlyPatternRaw.length > 0 && (
            <Panel theme={theme} icon={Clock} iconColor={CHART.frequency} title="Hourly Alert Distribution" delay={0.1}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyPattern} margin={{ left: -8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis dataKey="hour" tick={{ fill: ct.tick, fontSize: 12 }} tickFormatter={(value) => `${value}:00`} interval={1} />
                    <YAxis tick={{ fill: ct.tick, fontSize: 12 }} />
                    <Tooltip {...ct.tooltip} labelFormatter={(value) => `${value}:00`} formatter={(v: any) => [formatNumber(v), 'Alerts']} />
                    <Bar dataKey="count" fill={CHART.frequency} radius={[4, 4, 0, 0]} />
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
      .map((p) => ({ name: p.charAt(0).toUpperCase() + p.slice(1), value: priorityCounts[p], color: severityHex(p) }));

    return (
      <ErrorBoundary>
        <div className="space-y-6">
          <Panel theme={theme} icon={Zap} iconColor={CHART.trend} title={`Executive Recommendations (${recommendations.length})`}>
            {priorityChartData.length > 1 && (
              <div className="h-40 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityChartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fill: ct.tick, fontSize: 12 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: ct.tick, fontSize: 12 }} width={70} />
                    <Tooltip {...ct.tooltip} formatter={(v: any) => [v, 'Items']} />
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
                <div key={index} className={`p-4 rounded-lg border flex items-start gap-3 ${tk.chip}`}>
                  <div className="p-1.5 rounded-md mt-0.5" style={{ backgroundColor: `${severityHex(safeGet(recommendation, 'priority', 'low'))}1A` }}>
                    <Target className="w-3.5 h-3.5" style={{ color: severityHex(safeGet(recommendation, 'priority', 'low')) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <SeverityBadge label={safeGet(recommendation, 'priority', 'Unknown')} theme={theme} />
                      <span className={`text-xs ${tk.textTertiary}`}>{safeGet(recommendation, 'timeframe', 'Unknown timeframe')}</span>
                    </div>
                    <p className={`text-sm font-medium mb-1 ${tk.textPrimary}`}>{safeGet(recommendation, 'action', 'No action specified')}</p>
                    <p className={`text-xs ${tk.textSecondary}`}>{safeGet(recommendation, 'rationale', 'No rationale provided')}</p>
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
        case 'overview': return renderOverviewTab();
        case 'customers': return renderCustomersTab();
        case 'transactions': return renderTransactionsTab();
        case 'network': return renderNetworkTab();
        case 'temporal': return renderTemporalTab();
        case 'actions': return renderActionsTab();
        default: return renderOverviewTab();
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
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedCluster(null);
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                    active ? 'bg-blue-600 text-white shadow-sm' : `${tk.textSecondary} hover:bg-slate-500/10`
                  }`}
                >
                  <tab.icon className={`w-4 h-4 ${active ? 'text-white' : ''}`} />
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