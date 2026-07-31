import React, { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { UserAlertSummary, ViolationType, DateRange } from '../types/types';
import {
  User,
  ArrowUpRight,
  Loader2,
  TrendingUp,
  Activity,
  Shield,
  AlertTriangle,
  Filter,
  Search,
  ChevronDown,
  Clock,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  SlidersHorizontal,
  X,
  Info,
  Trophy,
  ShieldAlert,
  Users as UsersIcon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../components/notifications';
import { appConfig as config } from '../config/runtime-config';

const API_BASE_URL = config.api?.baseUrl;

interface UsersPanelProps {
  data: UserAlertSummary;
  isLoading: boolean;
  fullWidth?: boolean;
  dateRange?: DateRange;
}

const RISK_BADGE_CLASS = (isDark: boolean) => ({
  high: isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700',
  medium: isDark
    ? 'bg-orange-500/20 text-orange-300'
    : 'bg-orange-100 text-orange-700',
  low: isDark
    ? 'bg-green-500/20 text-green-300'
    : 'bg-green-100 text-green-700',
});

const RISK_BAR_CLASS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-orange-500',
  low: 'bg-green-500',
};

const RISK_TEXT_CLASS: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-orange-400',
  low: 'text-green-400',
};

const RISK_ROW_HOVER = (isDark: boolean): Record<string, string> => ({
  high: isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50',
  medium: isDark ? 'hover:bg-orange-500/10' : 'hover:bg-orange-50',
  low: isDark ? 'hover:bg-green-500/10' : 'hover:bg-green-50',
});

const RANK_BADGE_STYLE = [
  'bg-gradient-to-br from-amber-400 to-yellow-600 text-white',
  'bg-gradient-to-br from-slate-300 to-slate-500 text-white',
  'bg-gradient-to-br from-orange-400 to-amber-700 text-white',
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

const UsersPanel: React.FC<UsersPanelProps> = ({
  data,
  isLoading,
  fullWidth = false,
  dateRange,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { addNotification } = useNotifications();
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'emp_id'>('count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [riskFilter, setRiskFilter] = useState<
    'all' | 'high' | 'medium' | 'low'
  >('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(fullWidth ? 15 : 9);
  const [violationTypesLoading, setViolationTypesLoading] = useState(false);
  const [violationTypes, setViolationTypes] = useState<ViolationType[]>([]);

  const cashiers = data?.cashiers || [];
  const highRiskCashiersCount = data?.high_risk_cashiers_count || 0;
  const totalCashiers = data?.total_cashiers || 0;
  const avg_count = data?.avg_violations || 0;

  // Calculate risk levels
  const getRiskLevel = (count: number) => {
    if (count >= 20) return { level: 'high', color: 'red', label: 'High' };
    if (count >= 10)
      return { level: 'medium', color: 'orange', label: 'Medium' };
    return { level: 'low', color: 'green', label: 'Low' };
  };

  useEffect(() => {
    const fetchViolationTypes = async () => {
      // Only fetch if fullWidth is true and we have dateRange
      if (!fullWidth) {
        return;
      }

      // If no dateRange provided, don't fetch
      if (!dateRange || !dateRange.fromDate || !dateRange.toDate) {
        return;
      }

      try {
        setViolationTypesLoading(true);
        const url = `${API_BASE_URL}/user-alerts-summary-alerts?from_date=${dateRange.fromDate}&to_date=${dateRange.toDate}`;
        const response = await axios.get<ViolationType[]>(url);
        setViolationTypes(response.data);
        setViolationTypesLoading(false);
      } catch (error) {
        addNotification('Failed to load violation types', 'error');
        setViolationTypesLoading(false);
      }
    };

    fetchViolationTypes();
  }, [fullWidth, dateRange, addNotification]);

  // Filter and sort data
  const processedData = useMemo(() => {
    return [...cashiers]
      .filter((user) => {
        const matchesSearch = user.emp_id
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const risk = getRiskLevel(user.count);

        if (riskFilter === 'all') return matchesSearch;
        return matchesSearch && risk.level === riskFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'count') {
          return sortOrder === 'desc' ? b.count - a.count : a.count - b.count;
        } else {
          return sortOrder === 'desc'
            ? b.emp_id.localeCompare(a.emp_id)
            : a.emp_id.localeCompare(b.emp_id);
        }
      });
  }, [cashiers, searchTerm, sortBy, sortOrder, riskFilter]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedData.slice(startIndex, startIndex + itemsPerPage);
  }, [processedData, currentPage, itemsPerPage]);

  // Top 10 for the ranked highlight view (full detail remains in the table below)
  const topViolators = useMemo(() => {
    return [...cashiers].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [cashiers]);

  const maxViolatorCount = topViolators.length > 0 ? topViolators[0].count : 0;

  const avgAlertsPerUser = 0;
  const highRiskUsers = cashiers.filter(
    (user) => getRiskLevel(user.count).level === 'high'
  ).length;
  const mediumRiskUsers = cashiers.filter(
    (user) => getRiskLevel(user.count).level === 'medium'
  ).length;
  const lowRiskUsers = Math.max(
    0,
    cashiers.length - highRiskUsers - mediumRiskUsers
  );

  // Get the top violator
  const topViolator =
    cashiers.length > 0
      ? cashiers.reduce((prev, current) =>
          prev.count > current.count ? prev : current
        )
      : null;

  const riskMix = useMemo(() => {
    const n = cashiers.length;
    if (n === 0) return { high: 0, medium: 0, low: 0 };
    return {
      high: (highRiskUsers / n) * 100,
      medium: (mediumRiskUsers / n) * 100,
      low: (lowRiskUsers / n) * 100,
    };
  }, [cashiers.length, highRiskUsers, mediumRiskUsers, lowRiskUsers]);

  const highRiskShareOfTotal =
    totalCashiers > 0
      ? ((highRiskCashiersCount / totalCashiers) * 100).toFixed(1)
      : '0';

  const animatedTotal = useCountUp(totalCashiers);
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
      transition={{ duration: 0.3, delay: 0.1 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${cardBg} backdrop-blur-xl ${
        fullWidth ? 'col-span-full' : ''
      }`}
    >
      <div
        className={`flex justify-between items-center p-6 border-b ${dividerBorder}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${primaryText}`}>
              Cashier Rule Violations
            </h2>
            <p
              className={`text-sm ${isDark ? 'text-red-200/70' : 'text-red-600'}`}
            >
              Fraud risk monitoring &amp; investigation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-2xl font-bold tabular-nums ${primaryText}`}>
              {isLoading ? '—' : animatedTotal}
            </div>
            <div
              className={`text-xs font-medium ${isDark ? 'text-red-300' : 'text-red-600'}`}
            >
              Total Violators
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
              showFilters
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : isDark
                  ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
          <button
            className={`flex items-center text-sm transition-colors group ${
              isDark
                ? 'text-red-400 hover:text-red-300'
                : 'text-red-600 hover:text-red-700'
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
          <div className="flex flex-col items-center justify-center h-[350px] space-y-4">
            <Loader2 className="w-12 h-12 text-red-400 animate-spin" />
            <div className="text-center">
              <div className={`font-medium ${primaryText}`}>
                Loading cashier risk data...
              </div>
              <div className={`text-sm mt-1 ${mutedText}`}>
                Analyzing rule violation patterns
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filters Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className={`rounded-xl border p-4 overflow-hidden ${
                    isDark
                      ? 'bg-white/5 border-white/20'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3
                      className={`font-semibold flex items-center gap-2 ${primaryText}`}
                    >
                      <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                      Advanced Filters
                    </h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className={`p-1.5 rounded-lg ${
                        isDark
                          ? 'hover:bg-white/10 text-white/60'
                          : 'hover:bg-gray-200 text-gray-500'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          isDark ? 'text-white/80' : 'text-gray-700'
                        }`}
                      >
                        Search Cashier
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder="Search by employee ID..."
                          className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            isDark
                              ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                              : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          isDark ? 'text-white/80' : 'text-gray-700'
                        }`}
                      >
                        Risk Level
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['all', 'high', 'medium', 'low'] as const).map(
                          (level) => (
                            <button
                              key={level}
                              onClick={() => {
                                setRiskFilter(level);
                                setCurrentPage(1);
                              }}
                              className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                                riskFilter === level
                                  ? level === 'high'
                                    ? isDark
                                      ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                                      : 'bg-red-100 text-red-700 border border-red-300'
                                    : level === 'medium'
                                      ? isDark
                                        ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50'
                                        : 'bg-orange-100 text-orange-700 border border-orange-300'
                                      : level === 'low'
                                        ? isDark
                                          ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                                          : 'bg-green-100 text-green-700 border border-green-300'
                                        : isDark
                                          ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                                          : 'bg-blue-100 text-blue-700 border border-blue-300'
                                  : isDark
                                    ? 'bg-white/10 text-white/70 border border-white/20 hover:bg-white/20'
                                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                              }`}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          isDark ? 'text-white/80' : 'text-gray-700'
                        }`}
                      >
                        Sort By
                      </label>
                      <div className="relative">
                        <select
                          value={`${sortBy}-${sortOrder}`}
                          onChange={(e) => {
                            const [newSortBy, newSortOrder] =
                              e.target.value.split('-') as [
                                'count' | 'emp_id',
                                'asc' | 'desc',
                              ];
                            setSortBy(newSortBy);
                            setSortOrder(newSortOrder);
                          }}
                          className={`w-full px-3 py-2 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            isDark
                              ? 'bg-white/10 border border-white/20 text-white'
                              : 'bg-white border border-gray-300 text-gray-900'
                          }`}
                        >
                          <option
                            value="count-desc"
                            className={isDark ? 'bg-slate-800' : 'bg-white'}
                          >
                            Violations: High to Low
                          </option>
                          <option
                            value="count-asc"
                            className={isDark ? 'bg-slate-800' : 'bg-white'}
                          >
                            Violations: Low to High
                          </option>
                          <option
                            value="emp_id-asc"
                            className={isDark ? 'bg-slate-800' : 'bg-white'}
                          >
                            Employee ID: A to Z
                          </option>
                          <option
                            value="emp_id-desc"
                            className={isDark ? 'bg-slate-800' : 'bg-white'}
                          >
                            Employee ID: Z to A
                          </option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setRiskFilter('all');
                        setSortBy('count');
                        setSortOrder('desc');
                        setCurrentPage(1);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isDark
                          ? 'bg-white/10 hover:bg-white/20 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      Reset Filters
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30'
                    : 'bg-gradient-to-br from-red-100 to-orange-100 border-red-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span
                    className={`text-sm font-medium ${isDark ? 'text-red-300' : 'text-red-700'}`}
                  >
                    Top High Risk Cashiers
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {highRiskCashiersCount}
                </div>
                <div
                  className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}
                >
                  Immediate investigation · {highRiskShareOfTotal}% of total
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/30'
                    : 'bg-gradient-to-br from-orange-100 to-amber-100 border-orange-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-orange-400" />
                  <span
                    className={`text-sm font-medium ${isDark ? 'text-orange-300' : 'text-orange-700'}`}
                  >
                    Top Violator
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {topViolator ? topViolator.count : 0}
                </div>
                <div
                  className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}
                >
                  Cashier ID: {topViolator ? topViolator.emp_id : 'None'}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30'
                    : 'bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span
                    className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-700'}`}
                  >
                    Avg Violations
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {avg_count}
                </div>
                <div
                  className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}
                >
                  Alerts per cashier
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30'
                    : 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span
                    className={`text-sm font-medium ${isDark ? 'text-purple-300' : 'text-purple-700'}`}
                  >
                    Total Cashiers
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${primaryText}`}
                >
                  {totalCashiers}
                </div>
                <div
                  className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}
                >
                  Individual Counts
                </div>
              </div>
            </div>

            {/* Risk Mix / Violation Distribution */}
            {cashiers.length > 0 && (
              <div
                className={`p-4 rounded-xl border ${
                  isDark
                    ? 'bg-gradient-to-r from-white/5 to-white/10 border-white/10'
                    : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-semibold ${primaryText}`}>
                    Cashier Risk Mix
                  </span>
                  <span className={`text-xs ${mutedText}`}>
                    Top {cashiers.length} alerted cashiers
                  </span>
                </div>
                <div
                  className={`flex h-2.5 rounded-full overflow-hidden ${
                    isDark ? 'bg-white/10' : 'bg-gray-200'
                  }`}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${riskMix.high}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="h-full bg-red-500"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${riskMix.medium}%` }}
                    transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
                    className="h-full bg-orange-500"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${riskMix.low}%` }}
                    transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
                    className="h-full bg-green-500"
                  />
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className={mutedText}>High</span>
                    <span className={`font-semibold ${primaryText}`}>
                      {highRiskUsers} ({riskMix.high.toFixed(1)}%)
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className={mutedText}>Medium</span>
                    <span className={`font-semibold ${primaryText}`}>
                      {mediumRiskUsers} ({riskMix.medium.toFixed(1)}%)
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className={mutedText}>Low</span>
                    <span className={`font-semibold ${primaryText}`}>
                      {lowRiskUsers} ({riskMix.low.toFixed(1)}%)
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Top Violators - ranked highlight */}
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
                  <Trophy
                    className={`w-4 h-4 ${isDark ? 'text-red-300' : 'text-red-600'}`}
                  />
                  <span className={`text-sm font-semibold ${primaryText}`}>
                    Top {topViolators.length} Cashiers by Rule Violations
                  </span>
                </div>
                <span className={`text-xs ${mutedText}`}>
                  Ranked by trigger count
                </span>
              </div>

              {topViolators.length === 0 ? (
                <div className="p-6 text-center">
                  <UsersIcon className={`w-8 h-8 mx-auto mb-2 ${mutedText}`} />
                  <p className={`text-sm ${mutedText}`}>
                    No cashier violations recorded
                  </p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {topViolators.map((user, index) => {
                    const risk = getRiskLevel(user.count);
                    const relative =
                      maxViolatorCount > 0
                        ? (user.count / maxViolatorCount) * 100
                        : 0;

                    return (
                      <motion.div
                        key={`${user.emp_id}-top-${index}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className={`p-2 rounded-lg border transition-all duration-200 ${
                          isDark
                            ? 'bg-white/5 border-white/10 hover:border-white/25'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              RANK_BADGE_STYLE[index] ||
                              (isDark
                                ? 'bg-white/10 text-white/70'
                                : 'bg-gray-200 text-gray-600')
                            }`}
                          >
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`font-semibold text-sm truncate ${primaryText}`}
                                >
                                  {user.emp_id}
                                </span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 ${badgeClass[risk.level as 'high' | 'medium' | 'low']}`}
                                >
                                  {risk.label}
                                </span>
                              </div>
                              <div className="flex items-baseline gap-1.5 flex-shrink-0">
                                <span
                                  className={`font-bold tabular-nums ${primaryText}`}
                                >
                                  {user.count}
                                </span>
                                <span className={`text-xs ${mutedText}`}>
                                  violations
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
                                animate={{ width: `${relative}%` }}
                                transition={{
                                  duration: 0.6,
                                  delay: 0.1 + index * 0.05,
                                  ease: 'easeOut',
                                }}
                                className={`h-full rounded-full ${RISK_BAR_CLASS[risk.level]}`}
                              />
                            </div>

                            <div
                              className={`flex items-center gap-1.5 text-xs mt-1 ${mutedText}`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>Last violation: {user.last_violation}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Employee List */}
            {fullWidth && (
              <div
                className={`rounded-xl border overflow-hidden ${
                  isDark
                    ? 'bg-white/5 border-white/10'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className={`p-4 border-b ${dividerBorder}`}>
                  <div className="flex justify-between items-center">
                    <h3 className={`font-semibold ${primaryText}`}>
                      Cashier Risk Assessment
                    </h3>

                    {processedData.length > 0 && (
                      <div className={`text-xs ${mutedText}`}>
                        {searchTerm || riskFilter !== 'all'
                          ? 'Filtered results'
                          : 'Showing all cashiers'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={isDark ? 'bg-white/5' : 'bg-gray-50'}>
                      <tr>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                        >
                          Cashier ID
                        </th>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                        >
                          Risk Level
                        </th>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                        >
                          Violations
                        </th>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                        >
                          Last Violation
                        </th>
                        <th
                          className={`px-4 py-3 text-left text-xs font-semibold ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center">
                            <AlertCircle
                              className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-white/40' : 'text-gray-400'}`}
                            />
                            <p
                              className={
                                isDark ? 'text-white/60' : 'text-gray-600'
                              }
                            >
                              No cashier rule violations found
                            </p>
                            {(searchTerm || riskFilter !== 'all') && (
                              <button
                                onClick={() => {
                                  setSearchTerm('');
                                  setRiskFilter('all');
                                  setCurrentPage(1);
                                }}
                                className={`mt-2 text-sm ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                              >
                                Clear filters
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        paginatedData.map((user, index) => {
                          const risk = getRiskLevel(user.count);
                          const uniqueKey = `${user.emp_id}-${index}-${currentPage}`;

                          return (
                            <tr
                              key={uniqueKey}
                              className={`border-b ${dividerBorder} ${rowHoverClass[risk.level]} transition-colors`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`p-2 rounded-lg ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}
                                  >
                                    <User className="w-4 h-4 text-blue-400" />
                                  </div>
                                  <div>
                                    <div
                                      className={`font-medium ${primaryText}`}
                                    >
                                      {user.emp_id}
                                    </div>
                                    <div
                                      className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}
                                    >
                                      Cashier ID
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${badgeClass[risk.level as 'high' | 'medium' | 'low']}`}
                                >
                                  {risk.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div
                                  className={`font-bold tabular-nums ${RISK_TEXT_CLASS[risk.level]}`}
                                >
                                  {user.count}
                                </div>
                                <div
                                  className={`w-full h-1.5 rounded-full mt-1 overflow-hidden ${
                                    isDark ? 'bg-white/10' : 'bg-gray-200'
                                  }`}
                                >
                                  <div
                                    className={`h-full rounded-full ${RISK_BAR_CLASS[risk.level]}`}
                                    style={{
                                      width: `${Math.min(100, (user.count / 30) * 100)}%`,
                                    }}
                                  ></div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  <span
                                    className={`text-sm ${isDark ? 'text-white/70' : 'text-gray-700'}`}
                                  >
                                    {user.last_violation}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    className={`p-1.5 rounded-lg ${
                                      isDark
                                        ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                    }`}
                                    title="View Details"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                  <button
                                    className={`p-1.5 rounded-lg ${
                                      isDark
                                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                                        : 'bg-red-100 hover:bg-red-200 text-red-700'
                                    }`}
                                    title="Flag for Investigation"
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {processedData.length > itemsPerPage && (
                  <div className={`p-4 border-t ${dividerBorder}`}>
                    <div className="flex justify-between items-center">
                      <div className={`text-sm ${mutedText}`}>
                        Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                        {Math.min(
                          currentPage * itemsPerPage,
                          processedData.length
                        )}{' '}
                        of {processedData.length} cashiers
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(1, prev - 1))
                          }
                          disabled={currentPage === 1}
                          className={`p-2 rounded-lg transition-colors ${
                            currentPage === 1
                              ? isDark
                                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isDark
                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from(
                            { length: Math.min(5, totalPages) },
                            (_, i) => {
                              let pageToShow;
                              if (totalPages <= 5) {
                                pageToShow = i + 1;
                              } else if (currentPage <= 3) {
                                pageToShow = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageToShow = totalPages - 4 + i;
                              } else {
                                pageToShow = currentPage - 2 + i;
                              }

                              return (
                                <button
                                  key={pageToShow}
                                  onClick={() => setCurrentPage(pageToShow)}
                                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                                    currentPage === pageToShow
                                      ? isDark
                                        ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                                        : 'bg-blue-100 text-blue-700 border border-blue-300'
                                      : isDark
                                        ? 'bg-white/10 hover:bg-white/20 text-white'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                  }`}
                                >
                                  {pageToShow}
                                </button>
                              );
                            }
                          )}

                          {totalPages > 5 && currentPage < totalPages - 2 && (
                            <>
                              <span
                                className={
                                  isDark ? 'text-white/50' : 'text-gray-500'
                                }
                              >
                                ...
                              </span>
                              <button
                                onClick={() => setCurrentPage(totalPages)}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                                  isDark
                                    ? 'bg-white/10 hover:bg-white/20 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                              >
                                {totalPages}
                              </button>
                            </>
                          )}
                        </div>

                        <button
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(totalPages, prev + 1)
                            )
                          }
                          disabled={currentPage === totalPages}
                          className={`p-2 rounded-lg transition-colors ${
                            currentPage === totalPages
                              ? isDark
                                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isDark
                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Export Button */}
                {processedData.length > 0 && (
                  <div className={`p-4 border-t ${dividerBorder}`}>
                    <div className="flex justify-end">
                      <button
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          isDark
                            ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                            : 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300'
                        }`}
                      >
                        <Download className="w-4 h-4" />
                        Export Report
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Risk Summary */}
            {fullWidth && (
              <div
                className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${isDark ? 'text-white/80' : 'text-gray-700'}`}
              >
                <div
                  className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                >
                  <h3 className="font-semibold mb-3">
                    Investigation Guidelines
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-red-500/20 mt-0.5">
                        <AlertCircle className="w-3 h-3 text-red-400" />
                      </div>
                      <span>
                        High Risk (20+ violations): Immediate investigation
                        required
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-orange-500/20 mt-0.5">
                        <AlertCircle className="w-3 h-3 text-orange-400" />
                      </div>
                      <span>
                        Medium Risk (10-19 violations): Schedule investigation
                        within 7 days
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-green-500/20 mt-0.5">
                        <AlertCircle className="w-3 h-3 text-green-400" />
                      </div>
                      <span>
                        Low Risk (0-9 violations): Monitor for pattern changes
                      </span>
                    </li>
                  </ul>
                </div>

                <div
                  className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                >
                  <h3 className="font-semibold mb-3">Common Violation Types</h3>
                  {violationTypesLoading ? (
                    <div className="flex justify-center items-center h-24">
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    </div>
                  ) : violationTypes.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {violationTypes.slice(0, 5).map((type) => (
                        <li
                          key={type.rule_id}
                          className="flex items-start gap-2"
                        >
                          <div className="p-1 rounded-full bg-blue-500/20 mt-0.5">
                            <Shield className="w-3 h-3 text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <span>{type.rule_desc}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  isDark
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {type.rule_id}
                              </span>
                              <span
                                className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}
                              >
                                {type.count} occurrences
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-24 text-sm">
                      <Info className="w-5 h-5 text-blue-400 mb-2" />
                      <span
                        className={isDark ? 'text-white/60' : 'text-gray-600'}
                      >
                        {dateRange
                          ? 'No violation types data available'
                          : 'Date range required to load violation types'}
                      </span>
                    </div>
                  )}
                </div>

                <div
                  className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                >
                  <h3 className="font-semibold mb-3">Risk Trend Analysis</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">High Risk Cashiers</span>
                      <div className="flex items-center gap-1">
                        <span className="text-red-400 font-medium">
                          {highRiskCashiersCount}
                        </span>
                        <ShieldAlert className="w-3 h-3 text-red-400" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Medium Risk Cashiers</span>
                      <div className="flex items-center gap-1">
                        <span className="text-orange-400 font-medium">
                          {mediumRiskUsers}
                        </span>
                        <TrendingUp className="w-3 h-3 text-orange-400" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Average Violations</span>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-400 font-medium">
                          {avgAlertsPerUser}
                        </span>
                        <TrendingUp className="w-3 h-3 text-blue-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default UsersPanel;
