import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Loader2,
  TrendingUp,
  Activity,
  Zap,
  ShieldAlert,
  Trophy,
  Award,
} from 'lucide-react';
import { AlertSummary } from '../types/types';
import { useTheme } from '../context/ThemeContext';

interface TopAlertRulesPanelProps {
  data: AlertSummary[];
  isLoading: boolean;
}

const PRIORITY_COLOR: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f97316',
  Low: '#22c55e',
};

const PRIORITY_TEXT: Record<string, string> = {
  High: 'text-red-400',
  Medium: 'text-orange-400',
  Low: 'text-green-400',
};

const PRIORITY_BADGE: Record<string, string> = {
  High: 'bg-red-500/15 text-red-400 border-red-500/30',
  Medium: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Low: 'bg-green-500/15 text-green-400 border-green-500/30',
};

const RANK_BADGE_STYLE = [
  'bg-gradient-to-br from-amber-400 to-yellow-600 text-white', // #1
  'bg-gradient-to-br from-slate-300 to-slate-500 text-white', // #2
  'bg-gradient-to-br from-orange-400 to-amber-700 text-white', // #3
];

// Lightweight count-up animation (no extra dependency).
const useCountUp = (target: number, duration = 700) => {
  const [value, setValue] = useState(0);
  const frame = useRef<number>();

  useEffect(() => {
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
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

const TopAlertRulesPanel: React.FC<TopAlertRulesPanelProps> = ({
  data,
  isLoading,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const totalAlerts = useMemo(
    () => data.reduce((sum, rule) => sum + rule.count, 0),
    [data]
  );
  const avgAlerts = data.length > 0 ? Math.round(totalAlerts / data.length) : 0;
  const topAlert = data.length > 0 ? Math.max(...data.map((r) => r.count)) : 0;

  const topRules = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((rule, index) => ({
          ...rule,
          rank: index + 1,
          shortDesc:
            rule.rule_desc.length > 100
              ? rule.rule_desc.substring(0, 100) + '…'
              : rule.rule_desc,
        })),
    [data]
  );

  const maxTopCount = topRules.length > 0 ? topRules[0].count : 0;

  const highPriorityShare = useMemo(() => {
    if (totalAlerts === 0) return 0;
    const highSum = data
      .filter((r) => r.rule_priority === 'High')
      .reduce((sum, r) => sum + r.count, 0);
    return Math.round((highSum / totalAlerts) * 100);
  }, [data, totalAlerts]);

  const top10Concentration = useMemo(() => {
    if (totalAlerts === 0) return 0;
    const top10Sum = topRules.reduce((sum, r) => sum + r.count, 0);
    return Math.round((top10Sum / totalAlerts) * 100);
  }, [topRules, totalAlerts]);

  const animatedTotal = useCountUp(totalAlerts);

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
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-2xl font-bold ${primaryText}`}>
              Top Alert Rules
            </h3>
            <p
              className={`text-sm ${isDark ? 'text-blue-200/70' : 'text-blue-600'}`}
            >
              Most triggered security rules
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold tabular-nums ${primaryText}`}>
            {isLoading ? '—' : animatedTotal}
          </div>
          <div
            className={`text-xs font-medium ${isDark ? 'text-blue-300' : 'text-blue-600'}`}
          >
            Total Alerts
          </div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[420px] space-y-4">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <div className="text-center">
              <div className={`font-medium ${primaryText}`}>
                Loading alert rules...
              </div>
              <div className={`text-sm mt-1 ${mutedText}`}>
                Analyzing rules patterns
              </div>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[420px] space-y-3 text-center">
            <div
              className={`p-4 rounded-full ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}
            >
              <ShieldAlert className="w-10 h-10 text-blue-400" />
            </div>
            <div className={`font-semibold ${primaryText}`}>
              No rule activity recorded
            </div>
            <div className={`text-sm max-w-xs ${mutedText}`}>
              No alert rules were triggered in the selected period.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30'
                    : 'bg-gradient-to-br from-blue-100 to-cyan-100 border-blue-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span
                    className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}
                  >
                    Active Rules
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {data.length}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border-purple-500/30'
                    : 'bg-gradient-to-br from-purple-100 to-indigo-100 border-purple-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span
                    className={`text-sm font-medium ${
                      isDark ? 'text-purple-300' : 'text-purple-700'
                    }`}
                  >
                    Avg Triggers
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {avgAlerts}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-red-500/20 to-rose-500/20 border-red-500/30'
                    : 'bg-gradient-to-br from-red-100 to-rose-100 border-red-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span
                    className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}
                  >
                    High-Priority
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {highPriorityShare}%
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/30'
                    : 'bg-gradient-to-br from-orange-100 to-red-100 border-orange-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-orange-400" />
                  <span
                    className={`text-sm font-medium ${
                      isDark ? 'text-orange-300' : 'text-orange-700'
                    }`}
                  >
                    Peak Activity
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {topAlert}
                </div>
              </div>
            </div>

            {/* Ranked list */}
            <div
              className={`rounded-xl border ${
                isDark
                  ? 'bg-white/5 border-white/10'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div
                className={`flex items-center justify-between px-4 py-3 border-b ${dividerBorder}`}
              >
                <div className="flex items-center gap-2">
                  <Award
                    className={`w-4 h-4 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}
                  />
                  <span className={`text-sm font-semibold ${primaryText}`}>
                    Grouped by trigger volume
                  </span>
                </div>
                <span className={`text-xs ${mutedText}`}>
                  Top {topRules.length} rules generate{' '}
                  <span className={`font-semibold ${primaryText}`}>
                    {top10Concentration}%
                  </span>{' '}
                  of all alerts
                </span>
              </div>

              <div className="p-3 space-y-2">
                {topRules.map((rule, index) => {
                  const percentOfTotal =
                    totalAlerts > 0 ? (rule.count / totalAlerts) * 100 : 0;
                  const relativeToMax =
                    maxTopCount > 0 ? (rule.count / maxTopCount) * 100 : 0;
                  const priorityColor =
                    PRIORITY_COLOR[rule.rule_priority] || '#3b82f6';
                  const priorityText =
                    PRIORITY_TEXT[rule.rule_priority] || 'text-blue-400';
                  const priorityBadge =
                    PRIORITY_BADGE[rule.rule_priority] ||
                    'bg-blue-500/15 text-blue-400 border-blue-500/30';

                  return (
                    <motion.div
                      key={rule.rule_id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      onMouseEnter={() => setHoveredId(rule.rule_id)}
                      onMouseLeave={() => setHoveredId(null)}
                      title={rule.rule_desc}
                      className={`p-3 rounded-lg border transition-all duration-200 cursor-default ${
                        isDark
                          ? 'bg-white/5 border-white/10 hover:border-white/25'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank badge */}
                        <div
                          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            RANK_BADGE_STYLE[index] ||
                            (isDark
                              ? 'bg-white/10 text-white/70'
                              : 'bg-gray-200 text-gray-600')
                          }`}
                        >
                          {rule.rank}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`font-semibold text-sm truncate ${primaryText}`}
                              >
                                {rule.rule_id}
                              </span>
                              <span
                                className={`hidden sm:inline text-xs px-1.5 py-0.5 rounded-md border flex-shrink-0 ${priorityBadge}`}
                              >
                                {rule.rule_priority}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-1.5 flex-shrink-0">
                              <span
                                className={`font-bold tabular-nums ${primaryText}`}
                              >
                                {rule.count}
                              </span>
                              <span
                                className={`text-xs tabular-nums ${mutedText}`}
                              >
                                ({percentOfTotal.toFixed(1)}%)
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
                              animate={{ width: `${relativeToMax}%` }}
                              transition={{
                                duration: 0.6,
                                delay: 0.1 + index * 0.05,
                                ease: 'easeOut',
                              }}
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: priorityColor,
                                opacity:
                                  hoveredId === null ||
                                  hoveredId === rule.rule_id
                                    ? 1
                                    : 0.45,
                              }}
                            />
                          </div>

                          <div className={`text-xs mt-1 truncate ${mutedText}`}>
                            {rule.shortDesc}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TopAlertRulesPanel;
