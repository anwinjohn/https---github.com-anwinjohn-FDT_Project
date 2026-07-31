import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  CreditCard,
  Calendar,
  FileText,
  Shield,
  ShieldAlert,
  ShieldQuestion,
  AlertTriangle,
  CheckCircle,
  Flag,
  Coins,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  RefreshCw,
  Loader2,
  Info,
  Building2,
  Users,
  Globe,
  Activity,
  Moon,
  Layers,
  BadgeCheck,
  UserCheck,
  History,
  Hash,
  HomeIcon,
} from 'lucide-react';

import { AlertDetailsResponse } from '../../types/alerts';
import { useTheme } from '../../context/ThemeContext';
import { formatNumber } from '../../utils/formatters';
import { appConfig as config } from '../../config/runtime-config';

interface AlertDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertDetails: AlertDetailsResponse | null;
  alertId: string | null;
  loading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Risk Insights — supplementary analyst context fetched from an      */
/*  external risk/customer-profile service. This is purely additive:   */
/*  it never blocks or alters rendering of the core alert/transaction  */
/*  data that the parent already supplies via props.                   */
/* ------------------------------------------------------------------ */

interface RiskInsights {
  risk_score: number; // 0-100
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  kyc_status: string;
  is_watchlisted: boolean;
  is_pep: boolean;
  prior_alerts_count: number;
  prior_true_positive_count: number;
  account_age_days: number;
  avg_monthly_txn_count: number;
  avg_monthly_txn_amount: number;
  last_review_date?: string;
  analyst_notes?: string[];
}
const apiBaseUrl = config.api.baseUrl;

// TODO: point this at your risk/customer-profile microservice.
// Mirrors the same fetch pattern used for AI suggestions in
// AlertDispositionModal.tsx (POST, JSON body, JSON response).
const RISK_INSIGHTS_API_URL = `${apiBaseUrl}/customer-risk-insight`;

/* ------------------------------------------------------------------ */
/*  Small, presentational helper components (no business logic)       */
/* ------------------------------------------------------------------ */

const SectionCard: React.FC<{
  icon: React.ElementType;
  iconClass: string;
  title: string;
  theme: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, iconClass, title, theme, right, children, className }) => (
  <div
    className={`rounded-2xl border p-5 transition-colors duration-200 ${
      theme === 'dark'
        ? 'bg-white/[0.04] border-white/10 hover:border-white/[0.15]'
        : 'bg-white border-gray-200 shadow-sm hover:shadow-md'
    } ${className || ''}`}
  >
    <div className="flex items-center justify-between mb-4 gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`p-2 rounded-xl shadow-sm shrink-0 ${iconClass}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h3
          className={`text-[15px] font-semibold truncate ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          {title}
        </h3>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
  theme: string;
  icon?: React.ElementType;
}> = ({ label, value, theme, icon: Icon }) => (
  <div>
    <div
      className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1 uppercase tracking-wider ${
        theme === 'dark' ? 'text-white/40' : 'text-gray-500'
      }`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </div>
    <div
      className={`text-sm font-medium leading-snug break-words ${
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      }`}
    >
      {value ?? <span className="opacity-40">N/A</span>}
    </div>
  </div>
);

const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  theme: string;
  gradient: string;
  iconColor: string;
  subColor: string;
  delay?: number;
}> = ({
  icon: Icon,
  label,
  value,
  sub,
  theme,
  gradient,
  iconColor,
  subColor,
  delay = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className={`p-5 rounded-2xl border ${gradient}`}
  >
    <div className="flex items-center gap-2.5 mb-3">
      <Icon className={`w-5 h-5 ${iconColor}`} />
      <h3
        className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
      >
        {label}
      </h3>
    </div>
    <div
      className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
    >
      {value}
    </div>
    {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
  </motion.div>
);

const MiniStat: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  theme: string;
  tone?: 'neutral' | 'warn';
}> = ({ icon: Icon, label, value, theme, tone = 'neutral' }) => (
  <div
    className={`flex items-center gap-3 p-3 rounded-xl border ${
      tone === 'warn'
        ? theme === 'dark'
          ? 'bg-amber-500/10 border-amber-500/20'
          : 'bg-amber-50 border-amber-200'
        : theme === 'dark'
          ? 'bg-white/[0.03] border-white/10'
          : 'bg-gray-50 border-gray-200'
    }`}
  >
    <div
      className={`p-2 rounded-lg shrink-0 ${
        tone === 'warn'
          ? theme === 'dark'
            ? 'bg-amber-500/20 text-amber-300'
            : 'bg-amber-100 text-amber-600'
          : theme === 'dark'
            ? 'bg-white/10 text-white/70'
            : 'bg-white text-gray-500 border border-gray-200'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </div>
    <div className="min-w-0">
      <div
        className={`text-[11px] uppercase tracking-wide font-semibold ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}
      >
        {label}
      </div>
      <div
        className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
      >
        {value}
      </div>
    </div>
  </div>
);

const RiskLevelBadge: React.FC<{ level: string; theme: string }> = ({
  level,
  theme,
}) => {
  const styles: Record<string, string> = {
    CRITICAL:
      theme === 'dark'
        ? 'bg-red-600/25 text-red-300 border-red-500/40'
        : 'bg-red-100 text-red-700 border-red-300',
    HIGH:
      theme === 'dark'
        ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
        : 'bg-orange-100 text-orange-700 border-orange-300',
    MEDIUM:
      theme === 'dark'
        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
        : 'bg-yellow-100 text-yellow-700 border-yellow-300',
    LOW:
      theme === 'dark'
        ? 'bg-green-500/20 text-green-300 border-green-500/30'
        : 'bg-green-100 text-green-700 border-green-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
        styles[level] || styles.MEDIUM
      }`}
    >
      <ShieldAlert className="w-3.5 h-3.5" />
      {level}
    </span>
  );
};

const BoolBadge: React.FC<{
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  theme: string;
  invert?: boolean;
}> = ({ value, trueLabel, falseLabel, theme, invert = false }) => {
  // `invert` = true means "true" is the good/safe outcome (e.g. KYC complete)
  const isAlarming = invert ? !value : value;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
        isAlarming
          ? theme === 'dark'
            ? 'bg-red-500/20 text-red-300 border-red-500/30'
            : 'bg-red-100 text-red-700 border-red-300'
          : theme === 'dark'
            ? 'bg-green-500/20 text-green-300 border-green-500/30'
            : 'bg-green-100 text-green-700 border-green-300'
      }`}
    >
      {isAlarming ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <CheckCircle className="w-3 h-3" />
      )}
      {value ? trueLabel : falseLabel}
    </span>
  );
};

const RiskScoreMeter: React.FC<{ score: number; theme: string }> = ({
  score,
  theme,
}) => {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 75
      ? 'from-red-500 to-rose-500'
      : clamped >= 50
        ? 'from-orange-500 to-amber-500'
        : clamped >= 25
          ? 'from-yellow-400 to-amber-400'
          : 'from-emerald-400 to-green-500';
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex-1 h-2.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
        />
      </div>
      <span
        className={`text-sm font-bold tabular-nums w-10 text-right ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
      >
        {clamped}
      </span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const AlertDetailsModal: React.FC<AlertDetailsModalProps> = ({
  isOpen,
  onClose,
  alertDetails,
  alertId,
  loading,
}) => {
  const { theme } = useTheme();

  const transactions = alertDetails?.data ?? [];
  const ruleDetails = alertDetails?.rule ?? null;
  const firstDetail = transactions[0];
  const totalAmount = transactions.reduce(
    (sum, detail) => sum + parseFloat(detail.amt_aed),
    0
  );

  // ---- Risk Insights (API-driven, additive, non-blocking) ----
  const [riskInsights, setRiskInsights] = useState<RiskInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const fetchRiskInsights = async () => {
    if (!firstDetail?.customer_code) return;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const response = await fetch(RISK_INSIGHTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          alert_id: alertId,
          customer_code: firstDetail.customer_code,
          customer_name: firstDetail.customer_name,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setRiskInsights(data);
    } catch (error) {
      console.error('Error fetching risk insights:', error);
      setRiskInsights(null);
      setInsightsError('Unable to load risk insights right now.');
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && firstDetail?.customer_code) {
      fetchRiskInsights();
    }
    if (!isOpen) {
      setRiskInsights(null);
      setInsightsError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, alertId, firstDetail?.customer_code]);

  // ---- Transaction analytics (derived client-side from existing data) ----
  const analytics = useMemo(() => {
    if (transactions.length === 0) return null;

    const amounts = transactions.map((d) => parseFloat(d.amt_aed) || 0);
    const total = amounts.reduce((a, b) => a + b, 0);
    const avg = total / transactions.length;
    const max = Math.max(...amounts);

    const uniqueBeneficiaries = new Set(
      transactions.map((d) => d.beneficiary_name).filter(Boolean)
    ).size;
    const uniqueCountries = new Set(
      transactions.map((d) => d.payment_to_country).filter(Boolean)
    ).size;
    const employeeTxnCount = transactions.filter(
      (d) => d.is_employee_txn
    ).length;

    const roundAmountCount = amounts.filter(
      (a) => a > 0 && a % 1000 === 0
    ).length;

    const offHoursCount = transactions.filter((d) => {
      const t = new Date(d.transaction_date);
      if (isNaN(t.getTime())) return false;
      const h = t.getHours();
      return h >= 21 || h < 6;
    }).length;

    const validDates = transactions
      .map((d) => new Date(d.transaction_date).getTime())
      .filter((t) => !isNaN(t));
    const spanDays =
      validDates.length > 1
        ? Math.ceil(
            (Math.max(...validDates) - Math.min(...validDates)) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

    const dayCounts: Record<string, number> = {};
    transactions.forEach((d) => {
      const t = new Date(d.transaction_date);
      if (isNaN(t.getTime())) return;
      const day = t.toDateString();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const maxSameDay = Object.values(dayCounts).reduce(
      (m, c) => Math.max(m, c),
      0
    );

    return {
      avg,
      max,
      uniqueBeneficiaries,
      uniqueCountries,
      employeeTxnCount,
      roundAmountCount,
      offHoursCount,
      spanDays,
      maxSameDay,
    };
  }, [transactions]);

  // ---- Transaction table: search / sort / pagination / expand ----
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'transaction_date' | 'amt_aed'>(
    'transaction_date'
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filteredSortedDetails = useMemo(() => {
    if (!transactions.length) return [];
    const term = searchTerm.trim().toLowerCase();
    let list = transactions;
    if (term) {
      list = list.filter((d) =>
        [
          d.refno_send_receive,
          d.beneficiary_name,
          d.branch_name,
          d.purpose,
          d.payment_to_country,
          d.cashier,
          d.source,
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term))
      );
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'transaction_date') {
        cmp =
          new Date(a.transaction_date).getTime() -
          new Date(b.transaction_date).getTime();
      } else {
        cmp = (parseFloat(a.amt_aed) || 0) - (parseFloat(b.amt_aed) || 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [transactions, searchTerm, sortField, sortDir]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSortedDetails.length / pageSize)
  );
  const currentPage = Math.min(page, totalPages);
  const paginatedDetails = filteredSortedDetails.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, pageSize, sortField, sortDir]);

  const toggleSort = (field: 'transaction_date' | 'amt_aed') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleExportCsv = () => {
    if (transactions.length === 0) return;
    const headers = [
      'Date',
      'Time',
      'Reference',
      'Amount (AED)',
      'Beneficiary',
      'Country',
      'Branch',
      'Cashier',
      'Purpose',
      'Source',
      'Employee TXN',
    ];
    const rows = filteredSortedDetails.map((d) => [
      new Date(d.transaction_date).toLocaleDateString(),
      new Date(d.transaction_date).toLocaleTimeString(),
      d.refno_send_receive,
      d.amt_aed,
      d.beneficiary_name,
      d.payment_to_country,
      d.branch_name,
      d.cashier,
      d.purpose,
      d.source,
      d.is_employee_txn ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alert-${alertId || 'export'}-transactions.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getEmpTxnTypeIcon = (isEmpTxn: boolean) => {
    return isEmpTxn ? (
      <AlertTriangle className="w-4 h-4 text-red-500" />
    ) : (
      <CheckCircle className="w-4 h-4 text-green-500" />
    );
  };

  // Hooks above run unconditionally on every render (Rules of Hooks);
  // the early-return for a closed modal happens after them, same as before.
  if (!isOpen) return null;

  const inputClass = `w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    theme === 'dark'
      ? 'bg-white/10 border border-white/15 text-white placeholder-white/30'
      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400'
  }`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <div className="fixed inset-0 overflow-y-auto z-50">
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                className={`w-full max-w-screen-xl rounded-3xl border shadow-2xl overflow-hidden ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-slate-900/98 via-blue-950/98 to-indigo-950/98 border-white/15'
                    : 'bg-gradient-to-br from-white via-gray-50/80 to-blue-50/60 border-gray-200'
                } backdrop-blur-2xl max-h-[92vh] flex flex-col`}
              >
                <div className="h-[3px] w-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 shrink-0" />

                {/* Header */}
                <div
                  className={`px-6 py-5 border-b shrink-0 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}
                >
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-red-500 rounded-2xl blur-lg opacity-40" />
                        <div className="relative p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl shadow-lg">
                          <AlertTriangle className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h2
                          className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                        >
                          Alert Details
                        </h2>
                        <p
                          className={`text-sm flex items-center gap-1.5 truncate ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}
                        >
                          <Flag className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            Alert ID: {alertId?.slice(0, 60)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.08, rotate: 90 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={onClose}
                      className={`p-3 rounded-2xl transition-colors duration-150 shrink-0 ${
                        theme === 'dark'
                          ? 'bg-white/10 hover:bg-white/20 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
                        <span
                          className={
                            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                          }
                        >
                          Loading alert details...
                        </span>
                      </div>
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-20">
                      <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                      <h3
                        className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                      >
                        No Details Available
                      </h3>
                      <p
                        className={
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }
                      >
                        Unable to load alert details
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Summary Stat Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                        <StatCard
                          icon={FileText}
                          label="Transactions"
                          value={
                            alertDetails?.total_records ?? transactions.length
                          }
                          sub="Related transactions"
                          theme={theme}
                          gradient={
                            theme === 'dark'
                              ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30'
                              : 'bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-300'
                          }
                          iconColor="text-blue-400"
                          subColor={
                            theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                          }
                        />
                        <StatCard
                          icon={Coins}
                          label="Total Amount"
                          value={`AED ${formatNumber(totalAmount)}`}
                          sub="Cumulative value"
                          theme={theme}
                          gradient={
                            theme === 'dark'
                              ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30'
                              : 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-300'
                          }
                          iconColor="text-green-400"
                          subColor={
                            theme === 'dark'
                              ? 'text-green-300'
                              : 'text-green-700'
                          }
                          delay={0.05}
                        />
                        <StatCard
                          icon={Activity}
                          label="Avg. Transaction"
                          value={
                            analytics
                              ? `AED ${formatNumber(analytics.avg)}`
                              : '—'
                          }
                          sub="Per transaction"
                          theme={theme}
                          gradient={
                            theme === 'dark'
                              ? 'bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border-purple-500/30'
                              : 'bg-gradient-to-br from-purple-100 to-fuchsia-100 border-purple-300'
                          }
                          iconColor="text-purple-400"
                          subColor={
                            theme === 'dark'
                              ? 'text-purple-300'
                              : 'text-purple-700'
                          }
                          delay={0.1}
                        />
                        <StatCard
                          icon={Shield}
                          label="Risk Level"
                          value={
                            insightsLoading ? (
                              <Loader2 className="w-6 h-6 animate-spin opacity-60" />
                            ) : (
                              riskInsights?.risk_level || 'Not Assessed'
                            )
                          }
                          sub={
                            riskInsights
                              ? 'From risk engine'
                              : 'Awaiting risk insights'
                          }
                          theme={theme}
                          gradient={
                            theme === 'dark'
                              ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/30'
                              : 'bg-gradient-to-br from-orange-100 to-red-100 border-orange-300'
                          }
                          iconColor="text-orange-400"
                          subColor={
                            theme === 'dark'
                              ? 'text-orange-300'
                              : 'text-orange-700'
                          }
                          delay={0.15}
                        />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* LEFT column */}
                        <div className="lg:col-span-2 space-y-6">
                          {/* Rule Information */}
                          {firstDetail && (
                            <SectionCard
                              icon={AlertTriangle}
                              iconClass="bg-gradient-to-br from-red-500 to-orange-600"
                              title="Rule Information"
                              theme={theme}
                            >
                              <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                  <InfoRow
                                    label="Rule ID"
                                    value={firstDetail.rule_id}
                                    theme={theme}
                                  />
                                  <div className="col-span-2">
                                    <InfoRow
                                      label="Scenario Logic"
                                      value={
                                        ruleDetails?.scenario_logic ??
                                        firstDetail.rule_description
                                      }
                                      theme={theme}
                                    />
                                  </div>
                                  <InfoRow
                                    label="Priority"
                                    value={ruleDetails?.rule_priority}
                                    theme={theme}
                                    icon={AlertTriangle}
                                  />
                                  <InfoRow
                                    label="Category"
                                    value={ruleDetails?.rule_category}
                                    theme={theme}
                                  />
                                </div>
                                <div
                                  className={`pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}
                                >
                                  <InfoRow
                                    label="Findings"
                                    value={firstDetail.comments}
                                    theme={theme}
                                  />
                                </div>
                              </div>
                            </SectionCard>
                          )}
                          {/* Branch & Cashier Information */}
                          {firstDetail && (
                            <SectionCard
                              icon={HomeIcon}
                              iconClass="bg-gradient-to-br from-blue-500 to-indigo-600"
                              title="Branch & Cashier Information"
                              theme={theme}
                            >
                              <div className="grid grid-cols-2 gap-4">
                                <InfoRow
                                  label="Cashier ID"
                                  value={firstDetail.cashier}
                                  theme={theme}
                                  icon={User}
                                />
                                <InfoRow
                                  label="Branch Name"
                                  value={firstDetail.branch_name}
                                  theme={theme}
                                  icon={Globe}
                                />
                              </div>
                            </SectionCard>
                          )}

                          {/* Customer Information */}
                          {firstDetail && (
                            <SectionCard
                              icon={User}
                              iconClass="bg-gradient-to-br from-blue-500 to-indigo-600"
                              title="Customer Information"
                              theme={theme}
                            >
                              <div className="grid grid-cols-2 gap-4">
                                <InfoRow
                                  label="Customer Name"
                                  value={firstDetail.customer_name}
                                  theme={theme}
                                />
                                <InfoRow
                                  label="Customer Code"
                                  value={firstDetail.customer_code}
                                  theme={theme}
                                  icon={Hash}
                                />
                                <InfoRow
                                  label="Customer Type"
                                  value={firstDetail.customer_type}
                                  theme={theme}
                                />
                                <InfoRow
                                  label="Profession"
                                  value={firstDetail.customer_profession}
                                  theme={theme}
                                />
                                <InfoRow
                                  label="Nationality"
                                  value={firstDetail.customer_nationality}
                                  theme={theme}
                                  icon={Globe}
                                />
                                <InfoRow
                                  label="Residence Status"
                                  value={firstDetail.residential_status}
                                  theme={theme}
                                />
                              </div>
                              <div
                                className={`mt-4 pt-4 border-t flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}
                              >
                                <span
                                  className={`text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}
                                >
                                  Employee Transaction
                                </span>
                                <div className="flex items-center gap-2">
                                  {getEmpTxnTypeIcon(
                                    firstDetail.is_employee_txn
                                  )}
                                  <span
                                    className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                  >
                                    {firstDetail.is_employee_txn ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>
                            </SectionCard>
                          )}

                          {/* Risk Insights — API-driven */}
                          <SectionCard
                            icon={ShieldQuestion}
                            iconClass="bg-gradient-to-br from-purple-500 to-fuchsia-600"
                            title="Risk Insights"
                            theme={theme}
                            right={
                              <motion.button
                                type="button"
                                whileHover={{
                                  scale: 1.08,
                                  rotate: insightsLoading ? 0 : 90,
                                }}
                                whileTap={{ scale: 0.92 }}
                                onClick={fetchRiskInsights}
                                disabled={insightsLoading}
                                title="Refresh risk insights"
                                className={`p-2 rounded-lg transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-white/10 hover:bg-white/20 text-white/70'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                                }`}
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${insightsLoading ? 'animate-spin' : ''}`}
                                />
                              </motion.button>
                            }
                          >
                            {insightsLoading ? (
                              <div className="flex items-center gap-3 py-6 justify-center">
                                <Loader2
                                  className={`w-5 h-5 animate-spin ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`}
                                />
                                <span
                                  className={`text-sm ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}
                                >
                                  Fetching risk insights...
                                </span>
                              </div>
                            ) : insightsError ? (
                              <div
                                className={`p-4 rounded-xl border text-center ${
                                  theme === 'dark'
                                    ? 'bg-white/[0.02] border-white/10'
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <Info
                                  className={`w-6 h-6 mx-auto mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}
                                />
                                <p
                                  className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}
                                >
                                  {insightsError}
                                </p>
                                <p
                                  className={`text-xs mt-1 ${theme === 'dark' ? 'text-white/35' : 'text-gray-400'}`}
                                >
                                  Core alert data above is unaffected.
                                </p>
                              </div>
                            ) : riskInsights ? (
                              <div className="space-y-4">
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span
                                      className={`text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}
                                    >
                                      Risk Score
                                    </span>
                                    <RiskLevelBadge
                                      level={riskInsights.risk_level}
                                      theme={theme}
                                    />
                                  </div>
                                  <RiskScoreMeter
                                    score={riskInsights.risk_score}
                                    theme={theme}
                                  />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <BoolBadge
                                    value={riskInsights.is_watchlisted}
                                    trueLabel="Watchlisted"
                                    falseLabel="No Watchlist Hits"
                                    theme={theme}
                                  />
                                  <BoolBadge
                                    value={riskInsights.is_pep}
                                    trueLabel="PEP"
                                    falseLabel="Not PEP"
                                    theme={theme}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <MiniStat
                                    icon={History}
                                    label="Prior Alerts"
                                    value={riskInsights.prior_alerts_count}
                                    theme={theme}
                                    tone={
                                      riskInsights.prior_alerts_count > 0
                                        ? 'warn'
                                        : 'neutral'
                                    }
                                  />
                                  <MiniStat
                                    icon={AlertTriangle}
                                    label="Confirmed TP"
                                    value={
                                      riskInsights.prior_true_positive_count
                                    }
                                    theme={theme}
                                    tone={
                                      riskInsights.prior_true_positive_count > 0
                                        ? 'warn'
                                        : 'neutral'
                                    }
                                  />
                                  <MiniStat
                                    icon={UserCheck}
                                    label="KYC Status"
                                    value={riskInsights.kyc_status}
                                    theme={theme}
                                  />
                                  <MiniStat
                                    icon={Calendar}
                                    label="Account Age"
                                    value={`${riskInsights.account_age_days} days`}
                                    theme={theme}
                                  />
                                </div>

                                <div
                                  className={`p-3 rounded-xl border text-xs ${
                                    theme === 'dark'
                                      ? 'bg-white/[0.03] border-white/10 text-white/60'
                                      : 'bg-gray-50 border-gray-200 text-gray-600'
                                  }`}
                                >
                                  Avg. {riskInsights.avg_monthly_txn_count}{' '}
                                  txns/month &middot; AED{' '}
                                  {formatNumber(
                                    riskInsights.avg_monthly_txn_amount
                                  )}
                                  /month typical volume
                                </div>

                                {riskInsights.analyst_notes &&
                                  riskInsights.analyst_notes.length > 0 && (
                                    <div>
                                      <div
                                        className={`text-xs font-semibold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}
                                      >
                                        Analyst Notes
                                      </div>
                                      <ul className="space-y-1.5">
                                        {riskInsights.analyst_notes.map(
                                          (note, i) => (
                                            <li
                                              key={i}
                                              className={`text-sm flex items-start gap-2 ${theme === 'dark' ? 'text-white/75' : 'text-gray-700'}`}
                                            >
                                              <BadgeCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-400" />
                                              {note}
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <div
                                className={`p-6 text-center rounded-xl border border-dashed ${
                                  theme === 'dark'
                                    ? 'border-white/10 text-white/50'
                                    : 'border-gray-200 text-gray-500'
                                }`}
                              >
                                <ShieldQuestion className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">
                                  No risk insights available for this customer
                                </p>
                              </div>
                            )}
                          </SectionCard>
                        </div>

                        {/* RIGHT column */}
                        <div className="lg:col-span-3 space-y-6">
                          {/* Transaction Analytics */}
                          {analytics && (
                            <SectionCard
                              icon={Layers}
                              iconClass="bg-gradient-to-br from-teal-500 to-cyan-600"
                              title="Transaction Analytics"
                              theme={theme}
                            >
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <MiniStat
                                  icon={Users}
                                  label="Beneficiaries"
                                  value={alertDetails?.beneficiaries}
                                  theme={theme}
                                />
                                <MiniStat
                                  icon={Globe}
                                  label="Countries"
                                  value={alertDetails?.countries}
                                  theme={theme}
                                />
                                <MiniStat
                                  icon={Building2}
                                  label="Employee TXNs"
                                  value={analytics.employeeTxnCount}
                                  theme={theme}
                                  tone={
                                    analytics.employeeTxnCount > 0
                                      ? 'warn'
                                      : 'neutral'
                                  }
                                />
                                <MiniStat
                                  icon={Moon}
                                  label="Off-hours"
                                  value={alertDetails?.off_hours}
                                  theme={theme}
                                  tone={
                                    alertDetails?.off_hours > 0
                                      ? 'warn'
                                      : 'neutral'
                                  }
                                />
                                <MiniStat
                                  icon={Hash}
                                  label="Round Amounts"
                                  value={analytics.roundAmountCount}
                                  theme={theme}
                                  tone={
                                    analytics.roundAmountCount > 0
                                      ? 'warn'
                                      : 'neutral'
                                  }
                                />
                                <MiniStat
                                  icon={Activity}
                                  label="Busiest Day"
                                  value={`${analytics.maxSameDay} txns`}
                                  theme={theme}
                                  tone={
                                    analytics.maxSameDay > 1
                                      ? 'warn'
                                      : 'neutral'
                                  }
                                />
                                <MiniStat
                                  icon={Coins}
                                  label="Highest TXN"
                                  value={`AED ${formatNumber(analytics.max)}`}
                                  theme={theme}
                                />
                                <MiniStat
                                  icon={Calendar}
                                  label="Date Span"
                                  value={`${analytics.spanDays}d`}
                                  theme={theme}
                                />
                              </div>
                            </SectionCard>
                          )}

                          {/* Transaction Details */}
                          <SectionCard
                            icon={CreditCard}
                            iconClass="bg-gradient-to-br from-green-500 to-emerald-600"
                            title={`Transaction Details (${filteredSortedDetails.length})`}
                            theme={theme}
                            className="!p-0 overflow-hidden"
                            right={
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleExportCsv}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-green-500/15 hover:bg-green-500/25 text-green-300 border border-green-500/25'
                                    : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                                }`}
                              >
                                <Download className="w-3.5 h-3.5" />
                                Export CSV
                              </motion.button>
                            }
                          >
                            <span />
                          </SectionCard>

                          {/* Table shell (kept outside SectionCard padding for edge-to-edge table) */}
                          <div
                            className={`-mt-4 rounded-2xl border overflow-hidden ${
                              theme === 'dark'
                                ? 'bg-white/[0.04] border-white/10'
                                : 'bg-white border-gray-200 shadow-sm'
                            }`}
                          >
                            <div
                              className={`p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3 ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}
                            >
                              <div className="relative flex-1">
                                <Search
                                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}
                                />
                                <input
                                  type="text"
                                  value={searchTerm}
                                  onChange={(e) =>
                                    setSearchTerm(e.target.value)
                                  }
                                  placeholder="Search reference, beneficiary, branch, country, purpose..."
                                  className={inputClass}
                                />
                              </div>
                              <select
                                value={pageSize}
                                onChange={(e) =>
                                  setPageSize(Number(e.target.value))
                                }
                                className={`text-sm rounded-xl px-3 py-2.5 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  theme === 'dark'
                                    ? 'bg-white/10 border-white/15 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              >
                                <option value={10}>10 / page</option>
                                <option value={25}>25 / page</option>
                                <option value={50}>50 / page</option>
                                <option value={100}>100 / page</option>
                              </select>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead
                                  className={`border-b ${theme === 'dark' ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}
                                >
                                  <tr>
                                    <th className="w-8" />
                                    <th className="px-4 py-3 text-left">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleSort('transaction_date')
                                        }
                                        className={`flex items-center gap-1 font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                      >
                                        Date
                                        {sortField === 'transaction_date' ? (
                                          sortDir === 'asc' ? (
                                            <ArrowUp className="w-3.5 h-3.5" />
                                          ) : (
                                            <ArrowDown className="w-3.5 h-3.5" />
                                          )
                                        ) : (
                                          <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                                        )}
                                      </button>
                                    </th>
                                    <th
                                      className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                    >
                                      Reference
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                      <button
                                        type="button"
                                        onClick={() => toggleSort('amt_aed')}
                                        className={`flex items-center gap-1 font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                      >
                                        Amount
                                        {sortField === 'amt_aed' ? (
                                          sortDir === 'asc' ? (
                                            <ArrowUp className="w-3.5 h-3.5" />
                                          ) : (
                                            <ArrowDown className="w-3.5 h-3.5" />
                                          )
                                        ) : (
                                          <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                                        )}
                                      </button>
                                    </th>
                                    <th
                                      className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                    >
                                      Beneficiary
                                    </th>
                                    <th
                                      className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                    >
                                      Branch
                                    </th>
                                    <th
                                      className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                    >
                                      Purpose
                                    </th>
                                    <th
                                      className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                    >
                                      Employee
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedDetails.length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={8}
                                        className={`px-4 py-10 text-center text-sm ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}
                                      >
                                        No transactions match your search
                                      </td>
                                    </tr>
                                  ) : (
                                    paginatedDetails.map((detail) => {
                                      const isExpanded =
                                        expandedRow === detail.row_id;
                                      return (
                                        <React.Fragment key={detail.row_id}>
                                          <tr
                                            onClick={() =>
                                              setExpandedRow(
                                                isExpanded
                                                  ? null
                                                  : detail.row_id
                                              )
                                            }
                                            className={`border-b cursor-pointer transition-colors ${
                                              theme === 'dark'
                                                ? 'border-white/10 hover:bg-white/5'
                                                : 'border-gray-100 hover:bg-gray-50'
                                            } ${isExpanded ? (theme === 'dark' ? 'bg-white/5' : 'bg-blue-50/50') : ''}`}
                                          >
                                            <td className="pl-4 py-3">
                                              <ChevronDown
                                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''} ${
                                                  theme === 'dark'
                                                    ? 'text-white/40'
                                                    : 'text-gray-400'
                                                }`}
                                              />
                                            </td>
                                            <td className="px-4 py-3">
                                              <div
                                                className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                              >
                                                {new Date(
                                                  detail.transaction_date
                                                ).toLocaleDateString()}
                                              </div>
                                              <div
                                                className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}
                                              >
                                                {new Date(
                                                  detail.transaction_date
                                                ).toLocaleTimeString()}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3">
                                              <div
                                                className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                              >
                                                {detail.refno_send_receive}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3">
                                              <div
                                                className={`text-sm font-bold ${theme === 'dark' ? 'text-green-300' : 'text-green-600'}`}
                                              >
                                                AED{' '}
                                                {formatNumber(
                                                  parseFloat(detail.amt_aed)
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3">
                                              <div
                                                className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                              >
                                                {detail.beneficiary_name}
                                              </div>
                                              <div
                                                className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}
                                              >
                                                {detail.payment_to_country}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3">
                                              <div
                                                className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                              >
                                                {detail.branch_name}
                                              </div>
                                              <div
                                                className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}
                                              >
                                                By: {detail.cashier}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3">
                                              <div
                                                className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                                              >
                                                {detail.purpose}
                                              </div>
                                              <div
                                                className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}
                                              >
                                                Source: {detail.source}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3">
                                              <div className="flex items-center gap-1.5">
                                                {getEmpTxnTypeIcon(
                                                  detail.is_employee_txn
                                                )}
                                                <span
                                                  className={`text-xs font-medium ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}
                                                >
                                                  {detail.is_employee_txn
                                                    ? 'Yes'
                                                    : 'No'}
                                                </span>
                                              </div>
                                            </td>
                                          </tr>
                                          <AnimatePresence>
                                            {isExpanded && (
                                              <tr>
                                                <td colSpan={8} className="p-0">
                                                  <motion.div
                                                    initial={{
                                                      opacity: 0,
                                                      height: 0,
                                                    }}
                                                    animate={{
                                                      opacity: 1,
                                                      height: 'auto',
                                                    }}
                                                    exit={{
                                                      opacity: 0,
                                                      height: 0,
                                                    }}
                                                    className="overflow-hidden"
                                                  >
                                                    <div
                                                      className={`px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 ${
                                                        theme === 'dark'
                                                          ? 'bg-black/20'
                                                          : 'bg-gray-50'
                                                      }`}
                                                    >
                                                      <InfoRow
                                                        label="Row ID"
                                                        value={detail.row_id}
                                                        theme={theme}
                                                        icon={Hash}
                                                      />
                                                      <InfoRow
                                                        label="Purpose"
                                                        value={detail.purpose}
                                                        theme={theme}
                                                      />
                                                      <InfoRow
                                                        label="Source"
                                                        value={detail.source}
                                                        theme={theme}
                                                      />
                                                      <InfoRow
                                                        label="Cashier"
                                                        value={detail.cashier}
                                                        theme={theme}
                                                      />
                                                      <InfoRow
                                                        label="Branch"
                                                        value={
                                                          detail.branch_name
                                                        }
                                                        theme={theme}
                                                      />
                                                      <InfoRow
                                                        label="Beneficiary Country"
                                                        value={
                                                          detail.payment_to_country
                                                        }
                                                        theme={theme}
                                                      />
                                                      <InfoRow
                                                        label="Employee Transaction"
                                                        value={
                                                          detail.is_employee_txn
                                                            ? 'Yes'
                                                            : 'No'
                                                        }
                                                        theme={theme}
                                                      />
                                                      <InfoRow
                                                        label="Timestamp"
                                                        value={new Date(
                                                          detail.transaction_date
                                                        ).toLocaleString()}
                                                        theme={theme}
                                                      />
                                                    </div>
                                                  </motion.div>
                                                </td>
                                              </tr>
                                            )}
                                          </AnimatePresence>
                                        </React.Fragment>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* Pagination */}
                            <div
                              className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t ${
                                theme === 'dark'
                                  ? 'border-white/10'
                                  : 'border-gray-100'
                              }`}
                            >
                              <span
                                className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}
                              >
                                Showing{' '}
                                {filteredSortedDetails.length === 0
                                  ? 0
                                  : (currentPage - 1) * pageSize + 1}
                                &ndash;
                                {Math.min(
                                  currentPage * pageSize,
                                  filteredSortedDetails.length
                                )}{' '}
                                of {filteredSortedDetails.length} transactions
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={currentPage <= 1}
                                  onClick={() =>
                                    setPage((p) => Math.max(1, p - 1))
                                  }
                                  className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                    theme === 'dark'
                                      ? 'bg-white/10 hover:bg-white/20 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                  }`}
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span
                                  className={`text-xs font-medium px-2 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}
                                >
                                  Page {currentPage} of {totalPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={currentPage >= totalPages}
                                  onClick={() =>
                                    setPage((p) => Math.min(totalPages, p + 1))
                                  }
                                  className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                    theme === 'dark'
                                      ? 'bg-white/10 hover:bg-white/20 text-white'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                  }`}
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AlertDetailsModal;
