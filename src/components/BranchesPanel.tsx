import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BranchAlertSummary, BranchAlertDetails } from '../types/types';
import {
  MapPin,
  ArrowUpRight,
  Loader2,
  Building,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Activity,
  Eye,
  Calendar,
  Users,
  FileText,
  Filter,
  Download,
  Trophy,
  Building2,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface BranchesPanelProps {
  data: BranchAlertDetails[];
  isLoading: boolean;
  fullWidth?: boolean;
}


const RISK_DOT_CLASS: Record<string, string> = {
  High: 'bg-red-500',
  Medium: 'bg-orange-500',
  Low: 'bg-green-500',
};

const RISK_BAR_CLASS: Record<string, string> = {
  High: 'bg-red-500',
  Medium: 'bg-orange-500',
  Low: 'bg-green-500',
};

const RISK_TEXT_CLASS: Record<string, string> = {
  High: 'text-red-400',
  Medium: 'text-orange-400',
  Low: 'text-green-400',
};

const RISK_BADGE_CLASS = (isDark: boolean): Record<string, string> => ({
  High: isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700',
  Medium: isDark
    ? 'bg-orange-500/20 text-orange-300'
    : 'bg-orange-100 text-orange-700',
  Low: isDark
    ? 'bg-green-500/20 text-green-300'
    : 'bg-green-100 text-green-700',
});

const RISK_ROW_HOVER = (isDark: boolean): Record<string, string> => ({
  High: isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50',
  Medium: isDark ? 'hover:bg-orange-500/10' : 'hover:bg-orange-50',
  Low: isDark ? 'hover:bg-green-500/10' : 'hover:bg-green-50',
});

const RANK_BADGE_STYLE = [
  'bg-gradient-to-br from-amber-400 to-yellow-600 text-white',
  'bg-gradient-to-br from-slate-300 to-slate-500 text-white',
  'bg-gradient-to-br from-orange-400 to-amber-700 text-white',
];

const getRiskMeta = (level: string) => {
  if (level === 'High') return { level: 'High', color: 'red' };
  if (level === 'Medium') return { level: 'Medium', color: 'orange' };
  return { level: 'Low', color: 'green' };
};

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

const BranchesPanel: React.FC<BranchesPanelProps> = ({
  data,
  isLoading,
  fullWidth = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const total = data.reduce((sum, branch) => sum + branch.total_alerts, 0);
  const avgAlertsPerBranch =
    data.length > 0 ? Math.round(total / data.length) : 0;
  const topBranch =
    data.length > 0 ? Math.max(...data.map((b) => b.total_alerts)) : 0;

  const topBranches = useMemo(
    () => [...data].sort((a, b) => b.total_alerts - a.total_alerts).slice(0, 5),
    [data]
  );

  const sortedBranches = useMemo(
    () => [...data].sort((a, b) => b.total_alerts - a.total_alerts),
    [data]
  );

  const branchRiskCounts = {
    high: data.filter((branch) => branch.risk_level === 'High').length,
    medium: data.filter((branch) => branch.risk_level === 'Medium').length,
    low: data.filter((branch) => branch.risk_level === 'Low').length,
  };

  const needsAttentionShare =
    data.length > 0
      ? Math.round(
          ((branchRiskCounts.high + branchRiskCounts.medium) / data.length) *
            100
        )
      : 0;

  const top5Concentration = useMemo(() => {
    if (total === 0) return 0;
    const top5Sum = topBranches.reduce((sum, b) => sum + b.total_alerts, 0);
    return Math.round((top5Sum / total) * 100);
  }, [topBranches, total]);

  const highestBranch = sortedBranches[0];
  const lowestBranch =
    sortedBranches.length > 0
      ? sortedBranches[sortedBranches.length - 1]
      : null;

  const animatedTotal = useCountUp(total);
  const badgeClass = RISK_BADGE_CLASS(isDark);
  const rowHoverClass = RISK_ROW_HOVER(isDark);

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
      transition={{ duration: 0.3, delay: 0.2 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${cardBg} backdrop-blur-xl ${
        fullWidth ? 'col-span-full' : ''
      }`}
    >
      <div
        className={`flex justify-between items-center p-6 border-b ${dividerBorder}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${primaryText}`}>
              Branch Risk Analysis
            </h2>
            <p
              className={`text-sm ${isDark ? 'text-orange-200/70' : 'text-orange-600'}`}
            >
              Location-based fraud monitoring
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-2xl font-bold tabular-nums ${primaryText}`}>
              {isLoading ? '—' : animatedTotal}
            </div>
            <div
              className={`text-xs font-medium ${isDark ? 'text-orange-300' : 'text-orange-600'}`}
            >
              Total Alerts
            </div>
          </div>
          <button
            className={`flex items-center text-sm transition-colors group ${
              isDark
                ? 'text-orange-400 hover:text-orange-300'
                : 'text-orange-600 hover:text-orange-700'
            }`}
          >
            View All
            <ArrowUpRight
              size={14}
              className="ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
            />
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
            <Loader2 className="w-12 h-12 text-orange-400 animate-spin" />
            <div className="text-center">
              <div className={`font-medium ${primaryText}`}>
                Loading branch analytics...
              </div>
              <div className={`text-sm mt-1 ${mutedText}`}>
                Analyzing location-based fraud patterns
              </div>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] space-y-3 text-center">
            <div
              className={`p-4 rounded-full ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}
            >
              <Building2 className="w-10 h-10 text-orange-400" />
            </div>
            <div className={`font-semibold ${primaryText}`}>
              No branch activity recorded
            </div>
            <div className={`text-sm max-w-xs ${mutedText}`}>
              No branches reported alerts in the selected period.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/30'
                    : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Building className="w-4 h-4 text-orange-400" />
                  <span
                    className={`text-sm font-medium ${isDark ? 'text-orange-300' : 'text-orange-700'}`}
                  >
                    Monitored Branches
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {data.length}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className={`text-xs ${mutedText}`}>Active locations</div>
                  <div
                    className={`text-xs px-2 py-1 rounded-full ${
                      isDark
                        ? 'bg-orange-500/20 text-orange-300'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {needsAttentionShare}% need attention
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30'
                    : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span
                    className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}
                  >
                    High Risk Branches
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {branchRiskCounts.high}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className={`text-xs ${mutedText}`}>
                    Require investigation
                  </div>
                  <div
                    className={`text-xs px-2 py-1 rounded-full ${
                      isDark
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {data.length > 0
                      ? Math.round((branchRiskCounts.high / data.length) * 100)
                      : 0}
                    % of total
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30'
                    : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span
                    className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}
                  >
                    Avg Alerts per Branch
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {avgAlertsPerBranch}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className={`text-xs ${mutedText}`}>Baseline metric</div>
                  <div
                    className={`text-xs px-2 py-1 rounded-full ${
                      isDark
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {topBranch > 0 && avgAlertsPerBranch > 0
                      ? `+${Math.round(((topBranch - avgAlertsPerBranch) / avgAlertsPerBranch) * 100)}%`
                      : '0%'}{' '}
                    peak
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Distribution */}
            {fullWidth && (
              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-white/5 border-white/10'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <h3
                  className={`font-semibold mb-3 flex items-center gap-2 ${primaryText}`}
                >
                  <Shield className="w-4 h-4 text-purple-400" />
                  Branch Risk Distribution
                </h3>

                <div
                  className={`flex h-2.5 rounded-full overflow-hidden mb-3 ${
                    isDark ? 'bg-white/10' : 'bg-gray-200'
                  }`}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(branchRiskCounts.high / data.length) * 100}%`,
                    }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="h-full bg-red-500"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(branchRiskCounts.medium / data.length) * 100}%`,
                    }}
                    transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
                    className="h-full bg-orange-500"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(branchRiskCounts.low / data.length) * 100}%`,
                    }}
                    transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
                    className="h-full bg-green-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      isDark
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span
                        className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}
                      >
                        High Risk
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold tabular-nums ${primaryText}`}>
                        {branchRiskCounts.high}
                      </span>
                      <span
                        className={`text-xs ${isDark ? 'text-red-300/70' : 'text-red-600'}`}
                      >
                        (
                        {Math.round(
                          (branchRiskCounts.high / data.length) * 100
                        )}
                        %)
                      </span>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      isDark
                        ? 'bg-orange-500/10 border-orange-500/20'
                        : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span
                        className={`text-sm font-medium ${isDark ? 'text-orange-300' : 'text-orange-700'}`}
                      >
                        Medium Risk
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold tabular-nums ${primaryText}`}>
                        {branchRiskCounts.medium}
                      </span>
                      <span
                        className={`text-xs ${isDark ? 'text-orange-300/70' : 'text-orange-600'}`}
                      >
                        (
                        {Math.round(
                          (branchRiskCounts.medium / data.length) * 100
                        )}
                        %)
                      </span>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      isDark
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span
                        className={`text-sm font-medium ${isDark ? 'text-green-300' : 'text-green-700'}`}
                      >
                        Low Risk
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold tabular-nums ${primaryText}`}>
                        {branchRiskCounts.low}
                      </span>
                      <span
                        className={`text-xs ${isDark ? 'text-green-300/70' : 'text-green-600'}`}
                      >
                        (
                        {Math.round((branchRiskCounts.low / data.length) * 100)}
                        %)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Branches Highlight */}
            {fullWidth && (
              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-white/5 border-white/10'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3
                    className={`font-semibold flex items-center gap-2 ${primaryText}`}
                  >
                    <Trophy className="w-4 h-4 text-orange-400" />
                    Top Risk Branches
                  </h3>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${mutedText}`}>
                      Top {topBranches.length} generate{' '}
                      <span className={`font-semibold ${primaryText}`}>
                        {top5Concentration}%
                      </span>{' '}
                      of all alerts
                    </span>
                    <button
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                        isDark
                          ? 'bg-white/10 text-white/70 hover:bg-white/20'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Filter className="w-3 h-3" />
                      <span>Filter</span>
                    </button>
                    <button
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                        isDark
                          ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      <Download className="w-3 h-3" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={isDark ? 'bg-white/5' : 'bg-gray-50'}>
                      <tr>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                        >
                          Rank
                        </th>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                        >
                          Branch Name
                        </th>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                        >
                          Risk Level
                        </th>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                        >
                          Alert Count
                        </th>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                        >
                          % of Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {topBranches.map((branch, index) => {
                        const riskLevel = getRiskMeta(branch.risk_level);
                        return (
                          <tr
                            key={branch.branch_name}
                            className={`border-b ${dividerBorder} ${rowHoverClass[riskLevel.level]} transition-colors`}
                          >
                            <td className="px-4 py-3">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  RANK_BADGE_STYLE[index] ||
                                  (isDark
                                    ? 'bg-white/10 text-white/70'
                                    : 'bg-gray-200 text-gray-600')
                                }`}
                              >
                                {index + 1}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`p-2 rounded-lg ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}
                                >
                                  <MapPin className="w-4 h-4 text-orange-400" />
                                </div>
                                <div>
                                  <div className={`font-medium ${primaryText}`}>
                                    {branch.branch_name}
                                  </div>
                                  <div
                                    className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}
                                  >
                                    {branch.risk_rank}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${badgeClass[branch.risk_level]}`}
                              >
                                {branch.risk_level}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className={`font-bold tabular-nums ${RISK_TEXT_CLASS[branch.risk_level]}`}
                              >
                                {branch.total_alerts}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-full max-w-[100px] h-2 rounded-full overflow-hidden ${
                                    isDark ? 'bg-white/10' : 'bg-gray-200'
                                  }`}
                                >
                                  <div
                                    className={`h-full rounded-full ${RISK_BAR_CLASS[branch.risk_level]}`}
                                    style={{
                                      width: `${branch.risk_percentage}%`,
                                    }}
                                  ></div>
                                </div>
                                <span
                                  className={`text-sm tabular-nums ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                                >
                                  {branch.risk_percentage}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Branch List */}
            <div
              className={`space-y-4 max-h-screen overflow-y-auto custom-scrollbar ${
                fullWidth
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 space-y-0'
                  : ''
              }`}
            >
              {sortedBranches.map((branch, index) => {
                const percentage = branch.risk_percentage || 0;
                const riskLevel = getRiskMeta(branch.risk_level);

                return (
                  <motion.div
                    key={branch.branch_name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`group hover:scale-[1.02] transition-all duration-200 ${
                      fullWidth
                        ? `p-6 rounded-xl border ${
                            isDark
                              ? 'bg-gradient-to-br from-white/5 to-white/10 border-white/10 hover:border-white/20'
                              : 'bg-gradient-to-br from-gray-50 to-white border-gray-200 hover:border-gray-300'
                          }`
                        : 'space-y-3'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div
                          className={`h-4 w-4 rounded-full ${RISK_DOT_CLASS[riskLevel.level]} mr-3 shadow-lg`}
                        ></div>
                        <div>
                          <h3
                            className={`text-sm font-semibold transition-colors ${
                              isDark
                                ? 'text-white group-hover:text-orange-200'
                                : 'text-gray-900 group-hover:text-orange-700'
                            }`}
                          >
                            {branch.branch_name}
                          </h3>
                          {fullWidth && (
                            <p className={`text-xs mt-1 ${mutedText}`}>
                              Risk Level: {branch.risk_level}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span
                            className={`text-sm font-bold tabular-nums ${primaryText}`}
                          >
                            {branch.total_alerts}
                          </span>
                          <span className={`text-xs ml-1 ${mutedText}`}>
                            alerts
                          </span>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            isDark
                              ? 'text-orange-300/80 bg-orange-500/20'
                              : 'text-orange-700 bg-orange-200'
                          }`}
                        >
                          {percentage}%
                        </span>
                      </div>
                    </div>

                    <div
                      className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}
                    >
                      <motion.div
                        className={`h-full ${RISK_DOT_CLASS[riskLevel.level]} shadow-lg`}
                        initial={{ width: 0 }}
                        animate={{ width: `${branch.risk_percentage}%` }}
                        transition={{
                          duration: 0.8,
                          delay: 0.3 + index * 0.05,
                          ease: 'easeOut',
                        }}
                      ></motion.div>
                    </div>

                    {fullWidth && (
                      <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                        <div
                          className={`p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3 text-orange-400" />
                            <span
                              className={`font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}
                            >
                              Last Alert
                            </span>
                          </div>
                          <span
                            className={
                              isDark ? 'text-white/70' : 'text-gray-600'
                            }
                          >
                            {branch.last_alert_date}
                          </span>
                        </div>

                        <div
                          className={`p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <Users className="w-3 h-3 text-blue-400" />
                            <span
                              className={`font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}
                            >
                              Cashiers
                            </span>
                          </div>
                          <span
                            className={
                              isDark ? 'text-white/70' : 'text-gray-600'
                            }
                          >
                            {branch.unique_cashiers}
                          </span>
                        </div>

                        <div
                          className={`p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <FileText className="w-3 h-3 text-green-400" />
                            <span
                              className={`font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}
                            >
                              Top Rule
                            </span>
                          </div>
                          <span
                            className={
                              isDark ? 'text-white/70' : 'text-gray-600'
                            }
                          >
                            {branch.top_rule}
                          </span>
                        </div>

                        <div
                          className={`p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <Users className="w-3 h-3 text-orange-500" />
                            <span
                              className={`font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}
                            >
                              Customers
                            </span>
                          </div>
                          <span
                            className={
                              isDark ? 'text-white/70' : 'text-gray-600'
                            }
                          >
                            {branch.unique_customers}
                          </span>
                        </div>
                      </div>
                    )}

                    {fullWidth && (
                      <div
                        className={`flex justify-between items-center text-xs mt-3 ${mutedText}`}
                      >
                        <span>{branch.risk_rank}</span>
                        <button
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                            isDark
                              ? 'bg-white/10 hover:bg-white/20 text-white/80'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>Details</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Additional Insights for Full Width */}
            {fullWidth && data.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div
                  className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                >
                  <h3
                    className={`font-semibold mb-3 flex items-center gap-2 ${primaryText}`}
                  >
                    <Shield className="w-4 h-4 text-orange-400" />
                    Risk Assessment
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-red-500/20 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                      </div>
                      <span
                        className={isDark ? 'text-white/80' : 'text-gray-700'}
                      >
                        High Risk (50+ alerts): Immediate audit required
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-orange-500/20 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-orange-400" />
                      </div>
                      <span
                        className={isDark ? 'text-white/80' : 'text-gray-700'}
                      >
                        Medium Risk (20-49 alerts): Schedule audit within 14
                        days
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-green-500/20 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-green-400" />
                      </div>
                      <span
                        className={isDark ? 'text-white/80' : 'text-gray-700'}
                      >
                        Low Risk (0-19 alerts): Regular monitoring
                      </span>
                    </li>
                  </ul>
                </div>

                <div
                  className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                >
                  <h3
                    className={`font-semibold mb-3 flex items-center gap-2 ${primaryText}`}
                  >
                    <Activity className="w-4 h-4 text-blue-400" />
                    Concentration Analysis
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Top 5 Branch Share</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-orange-400" />
                        <span className="text-orange-400 font-medium tabular-nums">
                          {top5Concentration}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">High Risk Share</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-red-400" />
                        <span className="text-red-400 font-medium tabular-nums">
                          {data.length > 0
                            ? Math.round(
                                (branchRiskCounts.high / data.length) * 100
                              )
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Alert Distribution</span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            isDark
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {top5Concentration >= 60 ? 'Concentrated' : 'Even'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                >
                  <h3
                    className={`font-semibold mb-3 flex items-center gap-2 ${primaryText}`}
                  >
                    <MapPin className="w-4 h-4 text-purple-400" />
                    Branch Concentration
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-red-400" />
                        Highest Load
                      </span>
                      <span
                        className={`text-sm font-medium truncate max-w-[140px] ${isDark ? 'text-white/80' : 'text-gray-700'}`}
                      >
                        {highestBranch
                          ? `${highestBranch.branch_name} (${highestBranch.risk_percentage}%)`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-green-400" />
                        Lowest Load
                      </span>
                      <span
                        className={`text-sm font-medium truncate max-w-[140px] ${isDark ? 'text-white/80' : 'text-gray-700'}`}
                      >
                        {lowestBranch
                          ? `${lowestBranch.branch_name} (${lowestBranch.risk_percentage}%)`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Branches Monitored</span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            isDark
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {data.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons for Full Width */}
            {fullWidth && (
              <div className="flex justify-end gap-3 mt-6">
                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Advanced Filters
                </button>

                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isDark
                      ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30'
                      : 'bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-300'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Export Report
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BranchesPanel;
