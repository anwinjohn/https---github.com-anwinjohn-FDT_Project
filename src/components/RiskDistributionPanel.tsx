import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  Shield,
  Loader2,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface RiskDistributionPanelProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  isLoading: boolean;
}

/**
 * NOTE ON DESIGN:
 * This component consumes exactly the same `data` / `isLoading` props as before —
 * no API, response shape, or business logic has changed. Everything additional
 * here (the Composite Risk Index, the dominant-category callout, the ranked
 * bars) is a *derived, presentational* read of the same three numbers the
 * widget already received, intended to help a reader triage the breakdown in
 * a couple of seconds instead of parsing a legend.
 */

type RiskLevel = 'high' | 'medium' | 'low' | 'other';

const getRiskLevel = (name: string): RiskLevel => {
  const n = name.toLowerCase();
  if (n.includes('high')) return 'high';
  if (n.includes('medium')) return 'medium';
  if (n.includes('low')) return 'low';
  return 'other';
};

// Severity weighting used only to compute the on-screen composite index.
const RISK_WEIGHT: Record<RiskLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
  other: 1.5,
};

const RISK_ICON: Record<RiskLevel, React.ElementType> = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: CheckCircle,
  other: Shield,
};

const RISK_TEXT_CLASS: Record<RiskLevel, string> = {
  high: 'text-red-400',
  medium: 'text-orange-400',
  low: 'text-green-400',
  other: 'text-blue-400',
};

// Lightweight count-up animation (no extra dependency).
const useCountUp = (target: number, duration = 700) => {
  const [value, setValue] = useState(0);
  const frame = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + eased * (target - from)));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
};

const getPostureMeta = (score: number) => {
  if (score >= 80) {
    return { label: 'Critical', text: 'text-red-400', bar: 'bg-red-500' };
  }
  if (score >= 60) {
    return { label: 'Elevated', text: 'text-orange-400', bar: 'bg-orange-500' };
  }
  if (score >= 34) {
    return { label: 'Watch', text: 'text-amber-400', bar: 'bg-amber-500' };
  }
  return { label: 'Stable', text: 'text-green-400', bar: 'bg-green-500' };
};

// Enlarges the hovered donut segment slightly for a tactile hover response.
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } =
    props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
};

const RiskDistributionPanel: React.FC<RiskDistributionPanelProps> = ({
  data,
  isLoading,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data]
  );

  const sortedData = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data]
  );

  const dominant = sortedData[0];

  const compositeScore = useMemo(() => {
    if (total === 0) return 0;
    const weightedSum = data.reduce(
      (sum, item) => sum + item.value * RISK_WEIGHT[getRiskLevel(item.name)],
      0
    );
    return Math.round((weightedSum / (total * 3)) * 100);
  }, [data, total]);

  const posture = getPostureMeta(compositeScore);
  const animatedTotal = useCountUp(total);
  const animatedScore = useCountUp(compositeScore);

  const cardBg = isDark
    ? 'bg-white/10 border-white/20'
    : 'bg-white border-gray-200 shadow-card';
  const dividerBorder = isDark ? 'border-white/20' : 'border-gray-200';
  const primaryText = isDark ? 'text-white' : 'text-gray-900';
  const mutedText = isDark ? 'text-white/60' : 'text-gray-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${cardBg} backdrop-blur-xl`}
    >
      {/* Header */}
      <div
        className={`flex justify-between items-center p-6 border-b ${dividerBorder}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-2xl font-bold ${primaryText}`}>
              Risk Distribution
            </h3>
            <p
              className={`text-sm ${isDark ? 'text-red-200/70' : 'text-red-600'}`}
            >
              Security threat analysis
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold tabular-nums ${primaryText}`}>
            {isLoading ? '—' : animatedTotal}
          </div>
          <div
            className={`text-xs font-medium ${isDark ? 'text-red-300' : 'text-red-600'}`}
          >
            Total Alerts
          </div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[420px] space-y-4">
            <Loader2 className="w-12 h-12 text-red-400 animate-spin" />
            <div className="text-center">
              <div className={`font-medium ${primaryText}`}>
                Analyzing risk distribution...
              </div>
              <div className={`text-sm mt-1 ${mutedText}`}>
                Processing security threat levels
              </div>
            </div>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center h-[420px] space-y-3 text-center">
            <div
              className={`p-4 rounded-full ${
                isDark ? 'bg-green-500/10' : 'bg-green-50'
              }`}
            >
              <ShieldCheck className="w-10 h-10 text-green-400" />
            </div>
            <div className={`font-semibold ${primaryText}`}>
              No risk activity recorded
            </div>
            <div className={`text-sm max-w-xs ${mutedText}`}>
              No alerts were raised in the selected period across high, medium,
              or low risk categories.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Composite Risk Index */}
            <div
              className={`p-4 rounded-xl border ${
                isDark
                  ? 'bg-gradient-to-r from-white/5 to-white/10 border-white/10'
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${primaryText}`}>
                    Composite Risk Index
                  </span>
                  <span
                    title="Weighted by severity: High×3, Medium×2, Low×1, scaled to 0–100."
                    className={`cursor-help ${mutedText}`}
                  >
                    <Info className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-lg font-bold tabular-nums ${posture.text}`}
                  >
                    {animatedScore}
                  </span>
                  <span className={`text-xs font-medium ${posture.text}`}>
                    {posture.label}
                  </span>
                </div>
              </div>
              <div
                className={`relative h-2.5 rounded-full overflow-hidden ${
                  isDark ? 'bg-white/10' : 'bg-gray-200'
                }`}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${compositeScore}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${posture.bar}`}
                />
              </div>
              <div
                className={`flex justify-between mt-1.5 text-[10px] font-medium ${mutedText}`}
              >
                <span>Stable</span>
                <span>Watch</span>
                <span>Elevated</span>
                <span>Critical</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Ranked breakdown */}
              <div className="lg:col-span-2 space-y-3">
                {dominant && dominant.value > 0 && (
                  <div
                    className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
                      isDark
                        ? 'bg-white/5 text-white/70'
                        : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: dominant.color }}
                    />
                    <span>
                      <span className={`font-semibold ${primaryText}`}>
                        {dominant.name}
                      </span>{' '}
                      accounts for the largest share at{' '}
                      <span className={`font-semibold ${primaryText}`}>
                        {((dominant.value / total) * 100).toFixed(1)}%
                      </span>{' '}
                      of all alerts.
                    </span>
                  </div>
                )}

                {sortedData.map((item, index) => {
                  const level = getRiskLevel(item.name);
                  const Icon = RISK_ICON[level];
                  const percentage = total > 0 ? (item.value / total) * 100 : 0;

                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.08 }}
                      onMouseEnter={() =>
                        setActiveIndex(
                          data.findIndex((d) => d.name === item.name)
                        )
                      }
                      onMouseLeave={() => setActiveIndex(null)}
                      className={`p-3 rounded-xl border transition-all duration-200 cursor-default ${
                        isDark
                          ? 'bg-gradient-to-r from-white/5 to-white/10 border-white/10 hover:border-white/25'
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={RISK_TEXT_CLASS[level]}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <span
                            className={`font-medium text-sm ${primaryText}`}
                          >
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={`font-bold tabular-nums ${primaryText}`}
                          >
                            {item.value}
                          </span>
                          <span className={`text-xs tabular-nums ${mutedText}`}>
                            ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div
                        className={`h-1.5 rounded-full overflow-hidden ${
                          isDark ? 'bg-white/10' : 'bg-gray-200'
                        }`}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{
                            duration: 0.6,
                            delay: 0.1 + index * 0.08,
                            ease: 'easeOut',
                          }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Donut chart */}
              <div className="lg:col-span-3 h-[320px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={78}
                      outerRadius={130}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={2}
                      stroke={
                        isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                      }
                      activeIndex={
                        activeIndex === null ? undefined : activeIndex
                      }
                      activeShape={renderActiveShape}
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {data.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          style={{
                            opacity:
                              activeIndex === null || activeIndex === index
                                ? 1
                                : 0.45,
                            transition: 'opacity 0.2s ease',
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#ffffff' : '#0f172a',
                        border: isDark
                          ? '1px solid rgba(0,0,0,0.08)'
                          : '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '12px',
                        boxShadow: isDark
                          ? '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)'
                          : '0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
                        padding: '10px 14px',
                      }}
                      labelStyle={{
                        color: isDark ? '#09090b' : '#f8fafc',
                        fontWeight: 600,
                        fontSize: '13px',
                        marginBottom: '4px',
                      }}
                      itemStyle={{
                        color: isDark ? '#3f3f46' : '#cbd5e1',
                        fontSize: '13px',
                      }}
                      formatter={(value: number, name: string) => [
                        `${value} alerts (${((value / total) * 100).toFixed(1)}%)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Stats */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className={`text-sm font-medium ${mutedText}`}>
                    Total Alerts
                  </span>
                  <span
                    className={`text-3xl font-bold tabular-nums ${primaryText}`}
                  >
                    {animatedTotal}
                  </span>
                  <span
                    className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}
                  >
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RiskDistributionPanel;
