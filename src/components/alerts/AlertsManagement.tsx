import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  SlidersHorizontal,
  RefreshCw,
  Eye,
  Clock,
  User,
  CreditCard,
  FileText,
  Shield,
  TrendingUp,
  BarChart3,
  PieChart,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Search,
  X,
  ClipboardList,
  Loader2,
  Info,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import { useNotifications } from '../notifications';
import { useAlerts } from '../../hooks/useAlerts';
import PermissionGuard from '../PermissionGuard';
import { AlertSummary } from '../../types/alerts';
import AlertDetailsModal from './AlertDetailsModal';
import AlertFiltersPanel from './AlertFiltersPanel';
import AlertDispositionModal from './AlertDispositionModal';
import AlertsDownloadWidget, { ExportFormat } from './AlertsDownloadWidget';
import { formatNumber } from '../../utils/formatters';
import {
  AlertsExportProgress,
  exportAllAlerts,
} from '../../utils/alertsCsvExport';
import { useAuth } from '../../context/AuthContext';
// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AlertsManagementProps {
  /**
   * Id of the signed-in user (wire from your auth context). It is sent to the
   * back-end together with the WIP flag. The back-end must still resolve the
   * real user from the session token — treat this value as a hint only.
   */
  currentUserId?: string;
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const PAGE_SIZES = [10, 20, 50, 100];
const DENSITY_KEY = 'alerts.management.density';
type Density = 'comfortable' | 'compact';

// z-index ladder — every floating layer is portaled to <body>, so ordering is
// decided here and not by whichever ancestor happens to create a stacking
// context (blurred / transformed panels were the cause of the overlap bug).
const Z_DRAWER = 'z-[90]';
const Z_MODALS = 'z-[100]';

const EMPTY_FILTERS = {
  search: '',
  service_type: [],
  rule_id: [],
  status: [],
  priority: [],
  date_range: { from: '', to: '' },
  assigned_to: [],
  branch_name: [],
  cust_nationality: [],
};

function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Shared, counter-based body scroll lock (safe with several overlays).
let lockCount = 0;
let lockPrev = '';
function useBodyScrollLock() {
  useEffect(() => {
    if (lockCount === 0) {
      lockPrev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0) document.body.style.overflow = lockPrev;
    };
  }, []);
}

// Esc to close, focus in, Tab trapped, focus restored on close.
function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      prev?.focus?.();
    };
  }, []);
  return ref;
}

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined'
    ? null
    : createPortal(children, document.body);

const tokens = (dark: boolean) => ({
  text: dark ? 'text-white' : 'text-gray-900',
  body: dark ? 'text-white/80' : 'text-gray-700',
  muted: dark ? 'text-white/60' : 'text-gray-600',
  faint: dark ? 'text-white/40' : 'text-gray-400',
  line: dark ? 'border-white/10' : 'border-gray-100',
  panel: dark ? 'bg-white/5 border-white/15' : 'bg-white border-gray-200',
  surface: dark ? 'bg-slate-900 border-white/15' : 'bg-white border-gray-200',
  hover: dark ? 'hover:bg-white/5' : 'hover:bg-gray-50',
  input: dark
    ? 'bg-white/10 border border-white/20 text-white placeholder-white/40'
    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400',
  btn: dark
    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300',
});

// Risk badge — same mapping as before, with light-theme-safe colours.
const getRiskBadge = (rule_priority: string, dark: boolean) => {
  const priority = rule_priority?.toUpperCase() || 'LOW';
  switch (priority) {
    case 'HIGH':
    case 'CRITICAL':
      return {
        level: 'HIGH' as const,
        color: dark
          ? 'bg-red-500/20 text-red-300 border-red-500/30'
          : 'bg-red-50 text-red-700 border-red-200',
        icon: AlertTriangle,
      };
    case 'MEDIUM':
    case 'MODERATE':
      return {
        level: 'MEDIUM' as const,
        color: dark
          ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
          : 'bg-orange-50 text-orange-700 border-orange-200',
        icon: AlertCircle,
      };
    default:
      return {
        level: 'LOW' as const,
        color: dark
          ? 'bg-green-500/20 text-green-300 border-green-500/30'
          : 'bg-green-50 text-green-700 border-green-200',
        icon: CheckCircle,
      };
  }
};

const getServiceTypeIcon = (serviceType: string) => {
  switch ((serviceType || '').toUpperCase()) {
    case 'OUTWARD':
      return <TrendingUp className="w-4 h-4" />;
    case 'INWARD':
      return <BarChart3 className="w-4 h-4" />;
    case 'CASHIER-RULE':
      return <User className="w-4 h-4" />;
    case 'CUSTOMER-ONBOARDING':
    case 'CUSTOMER-ONBAORDING':
      return <Shield className="w-4 h-4" />;
    case 'TRANSACTION':
      return <CreditCard className="w-4 h-4" />;
    case 'KYC':
      return <FileText className="w-4 h-4" />;
    default:
      return <AlertTriangle className="w-4 h-4" />;
  }
};

const isWipAlert = (a: AlertSummary) =>
  a.wip === true || a.status?.toUpperCase() === 'IN WIP';

const getInitials = (name?: string) => {
  if (!name) return '?';
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return initials || '?';
};

const isValid = (s?: string) => !!s && !Number.isNaN(new Date(s).getTime());

// const formatRelativeDate = (timestamp: string) => {
//   if (!isValid(timestamp)) return '—';
//   const date = new Date(timestamp);
//   const now = new Date();
//   const yesterday = new Date(now);
//   yesterday.setDate(now.getDate() - 1);
//   if (date.toDateString() === now.toDateString()) return 'Today';
//   if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
//   return date.toLocaleDateString();
// };
const formatRelativeDate = (timestamp: string) => {
  // 1. Validate the timestamp payload
  if (!timestamp || isNaN(Date.parse(timestamp))) return '—';

  const date = new Date(timestamp);
  const now = new Date();

  // 2. Clear out time components to ensure pure date comparison
  const dString = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).toDateString();
  const todayString = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayString = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate()
  ).toDateString();

  // 3. Evaluate relative matches
  if (dString === todayString) return 'Today';
  if (dString === yesterdayString) return 'Yesterday';

  // 4. Construct the custom dd-MMM-yy layout using Intl
  // This extracts pieces independently so we can join them explicitly with dashes
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const day = parts.find((p) => p.type === 'day')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const year = parts.find((p) => p.type === 'year')?.value;

  return `${day}-${month}-${year}`;
};

const formatClock = (timestamp: string) =>
  isValid(timestamp)
    ? new Date(timestamp).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const truncate = (s: string | null | undefined, n: number) => {
  const v = s ?? '';
  return v.length > n ? `${v.slice(0, n)}...` : v;
};

// ---------------------------------------------------------------------------
// Filters drawer — hosts the existing AlertFiltersPanel unchanged, but in a
// portaled, modal-style layer so it can never float over another dialog.
// ---------------------------------------------------------------------------

const FiltersDrawer: React.FC<{
  dark: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ dark, onClose, children }) => {
  const t = tokens(dark);
  const ref = useDialog(onClose);
  useBodyScrollLock();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className={`fixed inset-0 ${Z_DRAWER} bg-black/50 backdrop-blur-[2px]`}
    >
      <motion.aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Alert filters"
        tabIndex={-1}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className={`absolute right-0 top-0 h-full w-full sm:w-[480px] border-l shadow-2xl flex flex-col outline-none ${t.surface}`}
      >
        <div
          className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${t.line}`}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className={`w-4 h-4 ${t.muted}`} />
            <h3 className={`text-base font-bold ${t.text}`}>Filters</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close filters"
            className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {children}
        </div>
        <div
          className={`px-5 py-3 border-t flex justify-end shrink-0 ${t.line}`}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white"
          >
            Done
          </button>
        </div>
      </motion.aside>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const AlertsManagement: React.FC<AlertsManagementProps> = ({
  currentUserId,
}) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const t = tokens(dark);
  const { getMenuId, loading: menuIdsLoading } = useMenuIds();
  const { addNotification } = useNotifications();

  const {
    alerts,
    selectedAlert,
    loading,
    error,
    totalCount,
    totalOpenAlerts,
    pendingReview,
    totalHighPriorityAlerts,
    currentPage,
    totalPages,
    hasNext,
    hasPrev,
    pageSize,
    filters,
    filterOptions,
    fetchAlertDetails,
    disposeAlert,
    updateFilters,
    setPage,
    setPageSize,
    refreshAlerts,
  } = useAlerts(20);

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [selectedAlertForDisposition, setSelectedAlertForDisposition] =
    useState<AlertSummary | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] =
    useState<AlertsExportProgress | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [density, setDensity] = useState<Density>(() => {
    try {
      return localStorage.getItem(DENSITY_KEY) === 'compact'
        ? 'compact'
        : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const compact = density === 'compact';

  const ALERTS_MANAGEMENT_MENU_ID = getMenuId('alerts_management');
  const { user } = useAuth();
  // `wip` / `user_id` are new filter keys (see hook/type patch). They are read
  // and written through these helpers so the filters object stays the single
  // source of truth for fetching AND for exportAllAlerts.
  const isWip = Boolean((filters as { wip?: boolean }).wip);
  const canUseWip = !!user?.username;
  const patchFilters = useCallback(
    (patch: Record<string, unknown>) =>
      updateFilters({ ...filters, ...patch } as typeof filters),
    [filters, updateFilters]
  );

  // Clear filters on initial load (existing behaviour, now WIP-aware).
  useEffect(() => {
    updateFilters({
      ...EMPTY_FILTERS,
      wip: false,
      user_id: currentUserId,
    } as unknown as typeof filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Search (debounced; stays in sync with the filters panel) -------------
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const lastSentSearch = useRef('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debouncedSearch !== (filters.search || '')) {
      lastSentSearch.current = debouncedSearch;
      patchFilters({ search: debouncedSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    // external change (filters panel / clear) -> mirror into the input
    if ((filters.search || '') === lastSentSearch.current) return;
    setSearch(filters.search || '');
    lastSentSearch.current = filters.search || '';
  }, [filters.search]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key !== '/' ||
        showFilters ||
        showDetailsModal ||
        showDispositionModal
      )
        return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showFilters, showDetailsModal, showDispositionModal]);

  // ---- Actions ---------------------------------------------------------------
  // Only one overlay at a time: opening a record always dismisses the filters.
  const handleViewDetails = async (alert: AlertSummary) => {
    if (openingId) return;
    setShowFilters(false);
    setSelectedAlertId(alert.alert_id);
    setOpeningId(alert.alert_id);
    try {
      await fetchAlertDetails(alert.alert_id, alert.rule_id);
      setShowDetailsModal(true);
    } catch (e) {
      console.error('Error loading alert details:', e);
      addNotification(
        'Could not load alert details. Please try again.',
        'error'
      );
    } finally {
      setOpeningId(null);
    }
  };

  const handleDisposeAlert = (alert: AlertSummary) => {
    setShowFilters(false);
    setSelectedAlertForDisposition(alert);
    setShowDispositionModal(true);
  };

  const handleExport = async (format: ExportFormat) => {
    if (exporting) return;
    setExporting(true);
    setExportProgress({
      progress: 0,
      stage: 'Preparing export…',
      exportedCount: 0,
      totalCount: 0,
    });
    try {
      const { exportedCount } = await exportAllAlerts(
        filters,
        format,
        setExportProgress
      );
      if (exportedCount === 0) {
        addNotification(
          'There are no alerts matching the current filters to export',
          'warning'
        );
        return;
      }
      addNotification(
        `${formatNumber(exportedCount)} alerts exported as ${format.toUpperCase()} successfully`,
        'success'
      );
    } catch (exportError) {
      console.error('Error exporting alerts:', exportError);
      addNotification('Failed to export alerts. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const setView = (wip: boolean) => {
    if (wip && !canUseWip) return;
    patchFilters({ wip, user_id: currentUserId });
  };

  const clearAll = () => {
    setSearch('');
    lastSentSearch.current = '';
    updateFilters({
      ...EMPTY_FILTERS,
      wip: false,
      user_id: currentUserId,
    } as unknown as typeof filters);
  };

  const toggleDensity = (d: Density) => {
    setDensity(d);
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      /* ignore */
    }
  };

  // ---- Derived ---------------------------------------------------------------
  const priorityBreakdown = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    alerts.forEach((a) => {
      counts[getRiskBadge(a.rule_priority, dark).level] += 1;
    });
    const total = alerts.length || 1;
    return [
      {
        level: 'HIGH',
        count: counts.HIGH,
        pct: (counts.HIGH / total) * 100,
        bar: 'bg-red-500',
        text: 'text-red-500',
      },
      {
        level: 'MEDIUM',
        count: counts.MEDIUM,
        pct: (counts.MEDIUM / total) * 100,
        bar: 'bg-orange-500',
        text: 'text-orange-500',
      },
      {
        level: 'LOW',
        count: counts.LOW,
        pct: (counts.LOW / total) * 100,
        bar: 'bg-green-500',
        text: 'text-green-500',
      },
    ];
  }, [alerts, dark]);

  const serviceTypeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    alerts.forEach((a) => {
      const key = a.service_type || 'UNKNOWN';
      counts[key] = (counts[key] || 0) + 1;
    });
    const total = alerts.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count, pct: (count / total) * 100 }));
  }, [alerts]);

  // Filter chips (what the Filters badge counts, made visible & removable)
  const chips = useMemo(() => {
    const c: { key: string; label: string; clear: Record<string, unknown> }[] =
      [];
    const addList = (k: string, label: string, v?: string[]) => {
      if (v && v.length > 0)
        c.push({
          key: k,
          label: `${label}: ${v.length > 2 ? `${v.slice(0, 2).join(', ')} +${v.length - 2}` : v.join(', ')}`,
          clear: { [k]: [] },
        });
    };
    addList('service_type', 'Source', filters.service_type);
    addList('rule_id', 'Rule', filters.rule_id);
    addList('status', 'Status', filters.status);
    addList('priority', 'Priority', filters.priority);
    addList('assigned_to', 'Assigned', filters.assigned_to);
    addList('branch_name', 'Branch', filters.branch_name);
    addList('cust_nationality', 'Nationality', filters.cust_nationality);
    if (filters.date_range?.from || filters.date_range?.to)
      c.push({
        key: 'date_range',
        label: `Date: ${filters.date_range.from || '…'} → ${filters.date_range.to || '…'}`,
        clear: { date_range: { from: '', to: '' } },
      });
    return c;
  }, [filters]);

  const anyActive = chips.length > 0 || !!search || isWip;
  const pad = compact ? 'py-2' : 'py-3.5';
  const rangeFrom = alerts.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeTo = Math.min(currentPage * pageSize, totalCount);

  // Page numbers (same windowing logic as before)
  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => {
      if (totalPages <= 5 || currentPage <= 3) return i + 1;
      if (currentPage >= totalPages - 2) return totalPages - 4 + i;
      return currentPage - 2 + i;
    }
  );

  const kpis = [
    {
      label: 'Open',
      value: totalOpenAlerts,
      cls: dark ? 'text-red-300' : 'text-red-600',
    },
    {
      label: 'High priority',
      value: totalHighPriorityAlerts,
      cls: dark ? 'text-orange-300' : 'text-orange-600',
    },
    {
      label: 'WIP',
      value: pendingReview,
      cls: dark ? 'text-blue-300' : 'text-blue-600',
    },
  ];

  // The menu-ID lookup runs on its own API call. Until it resolves,
  // getMenuId returns 0 and the permission check would wrongly render the
  // "Access Denied" fallback, so keep showing a loader until we have a real ID.
  // This early return must stay AFTER every hook call in this component
  // (Rules of Hooks) — it is placed immediately before the final return.
  if (menuIdsLoading || !ALERTS_MANAGEMENT_MENU_ID) {
    return (
      <div className="flex items-center justify-center p-4 py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <PermissionGuard
      menuId={ALERTS_MANAGEMENT_MENU_ID}
      action="view"
      fallback={
        <div className={`text-center py-20 ${t.text}`}>
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">
            You don't have permission to view alerts management.
          </p>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
              {totalHighPriorityAlerts > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white/80 animate-pulse" />
              )}
            </div>
            <div>
              <h1 className={`text-xl font-bold leading-tight ${t.text}`}>
                Fraud &amp; Risk Alerts
              </h1>
              <p
                className={`text-xs ${dark ? 'text-red-200/70' : 'text-red-600'}`}
              >
                Alert disposition and case management
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 ml-3">
              {kpis.map((k) =>
                k.label === 'WIP' ? (
                  <button
                    key={k.label}
                    onClick={() => setView(true)}
                    disabled={!canUseWip}
                    title={
                      canUseWip
                        ? 'Show your work in progress'
                        : 'Your user could not be resolved'
                    }
                    className={`px-3 py-1 rounded-lg border text-xs ${t.panel} ${canUseWip ? 'cursor-pointer transition-colors ' + (dark ? 'hover:bg-white/10' : 'hover:bg-gray-100') : 'opacity-50 cursor-not-allowed'}`}
                  >
                    <span className={`font-bold text-sm tabular-nums ${k.cls}`}>
                      {formatNumber(k.value ?? 0)}
                    </span>{' '}
                    <span className={t.muted}>{k.label}</span>
                  </button>
                ) : (
                  <div
                    key={k.label}
                    className={`px-3 py-1 rounded-lg border text-xs ${t.panel}`}
                  >
                    <span className={`font-bold text-sm tabular-nums ${k.cls}`}>
                      {formatNumber(k.value ?? 0)}
                    </span>{' '}
                    <span className={t.muted}>{k.label}</span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshAlerts}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${t.btn}`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>

            <PermissionGuard
              menuId={ALERTS_MANAGEMENT_MENU_ID}
              action="export"
              fallback={
                <button
                  onClick={() =>
                    addNotification(
                      "You don't have permission to export alerts",
                      'warning'
                    )
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border ${
                    dark
                      ? 'bg-white/5 text-white/40 border-white/10'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Download
                </button>
              }
            >
              <AlertsDownloadWidget
                theme={theme}
                totalCount={totalCount}
                exporting={exporting}
                exportProgress={exportProgress?.progress}
                exportStage={exportProgress?.stage}
                canExport={true}
                onExport={handleExport}
              />
            </PermissionGuard>
          </div>
        </div>

        {/* Toolbar */}
        <div className={`rounded-xl border p-3 ${t.panel}`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search alerts"
                placeholder="Search alerts…   ( / )"
                className={`w-full pl-9 pr-9 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${t.input}`}
              />
              {search !== debouncedSearch && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>

            {/* View switch */}
            <div
              role="tablist"
              aria-label="Alert view"
              className={`inline-flex rounded-lg p-0.5 ${dark ? 'bg-white/10' : 'bg-gray-100'}`}
            >
              <button
                role="tab"
                aria-selected={!isWip}
                onClick={() => setView(false)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  !isWip
                    ? dark
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-gray-900 shadow-sm'
                    : dark
                      ? 'text-white/60 hover:text-white'
                      : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                All alerts
              </button>
              <button
                role="tab"
                aria-selected={isWip}
                disabled={!canUseWip}
                onClick={() => setView(true)}
                title={
                  canUseWip
                    ? 'Alerts you are currently working on'
                    : 'Your user could not be resolved'
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isWip
                    ? dark
                      ? 'bg-blue-500/30 text-blue-200'
                      : 'bg-white text-blue-700 shadow-sm'
                    : dark
                      ? 'text-white/60 hover:text-white'
                      : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                My WIP
                {isWip && !loading && (
                  <span className="px-1.5 rounded-full text-[11px] font-semibold bg-blue-500 text-white">
                    {formatNumber(totalCount)}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => setShowFilters(true)}
              aria-haspopup="dialog"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${t.btn}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {chips.length > 0 && (
                <span className="px-1.5 rounded-full text-xs bg-red-500 text-white">
                  {chips.length}
                </span>
              )}
            </button>

            {anyActive && (
              <button
                onClick={clearAll}
                className={`px-2 py-2 text-sm font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Clear all
              </button>
            )}
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {chips.map((c) => (
                <span
                  key={c.key}
                  className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full border text-xs font-medium ${
                    dark
                      ? 'bg-white/10 border-white/20 text-white/80'
                      : 'bg-gray-100 border-gray-200 text-gray-700'
                  }`}
                >
                  {c.label}
                  <button
                    onClick={() => patchFilters(c.clear)}
                    aria-label={`Remove filter ${c.label}`}
                    className={`p-0.5 rounded-full ${dark ? 'hover:bg-white/20' : 'hover:bg-gray-200'}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Insights (collapsed by default — they only describe the current page) */}
        {/* {alerts.length > 0 && (
          <div className={`rounded-xl border ${t.panel}`}>
            <button
              onClick={() => setShowInsights((v) => !v)}
              aria-expanded={showInsights}
              className={`w-full flex items-center justify-between px-4 py-2 text-sm ${t.muted}`}
            >
              <span className="flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Page insights
                <span className={`text-xs ${t.faint}`}>
                  · priority mix &amp; top sources on this page
                </span>
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showInsights ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {showInsights && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className={`grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 pb-4 pt-2 border-t ${t.line}`}
                  >
                    <div>
                      <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
                        {priorityBreakdown.map((p) => (
                          <div
                            key={p.level}
                            className={p.bar}
                            style={{ width: `${p.pct}%` }}
                            title={`${p.level}: ${p.count}`}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        {priorityBreakdown.map((p) => (
                          <div
                            key={p.level}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className={`w-2 h-2 rounded-full ${p.bar}`} />
                            <span className={t.muted}>{p.level}</span>
                            <span className={`font-medium ${p.text}`}>
                              {p.count} · {Math.round(p.pct)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {serviceTypeBreakdown.map((s) => (
                        <div key={s.type}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className={t.muted}>{s.type}</span>
                            <span className={t.faint}>{s.count}</span>
                          </div>
                          <div
                            className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                              style={{ width: `${s.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )} */}

        {/* Alerts list */}
        <div
          className={`rounded-xl border overflow-hidden shadow-xl ${t.panel}`}
        >
          <div
            className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b ${t.line}`}
          >
            <div className="flex items-center gap-3">
              <h2 className={`text-base font-bold ${t.text}`}>
                {isWip ? 'My Work in Progress' : 'Open Alerts'}
              </h2>
              <span className={`text-xs ${t.muted}`}>
                Showing {formatNumber(rangeFrom)}–{formatNumber(rangeTo)} of{' '}
                {formatNumber(totalCount)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isWip && (
                <span
                  className={`hidden sm:inline-flex items-center gap-1.5 text-xs ${t.muted}`}
                >
                  <Info className="w-3.5 h-3.5" />
                  Items assigned to you, across all dates
                </span>
              )}
              <div
                role="group"
                aria-label="Row density"
                className={`inline-flex rounded-lg p-0.5 ${dark ? 'bg-white/10' : 'bg-gray-100'}`}
              >
                {(['comfortable', 'compact'] as Density[]).map((d) => (
                  <button
                    key={d}
                    aria-pressed={density === d}
                    onClick={() => toggleDensity(d)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                      density === d
                        ? dark
                          ? 'bg-white/20 text-white'
                          : 'bg-white text-gray-900 shadow-sm'
                        : dark
                          ? 'text-white/60 hover:text-white'
                          : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: compact ? 10 : 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`${compact ? 'h-10' : 'h-14'} rounded-lg animate-pulse ${dark ? 'bg-white/5' : 'bg-gray-100'}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className={`text-lg font-medium ${t.text}`}>
                  Failed to load alerts
                </p>
                <p className={`text-sm mb-3 ${t.muted}`}>{error}</p>
                <button
                  onClick={refreshAlerts}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className={`text-lg font-medium ${t.text}`}>
                  {isWip ? 'Your queue is clear' : 'No alerts found'}
                </p>
                <p className={`text-sm mb-3 ${t.muted}`}>
                  {isWip
                    ? 'You have no work-in-progress alerts.'
                    : 'All alerts have been processed or no alerts match your filters'}
                </p>
                {isWip && (
                  <button
                    onClick={() => setView(false)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium ${t.btn}`}
                  >
                    View all alerts
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="overflow-auto hidden md:block max-h-[calc(100vh-340px)] min-h-[300px]">
                <table className="w-full">
                  <thead
                    className={`sticky top-0 z-10 border-b backdrop-blur-sm ${
                      dark
                        ? 'border-white/20 bg-slate-900/95'
                        : 'border-gray-200 bg-gray-50/95'
                    }`}
                  >
                    <tr>
                      {['Risk', 'Alert', 'User', 'Customer', 'Rule'].map(
                        (h) => (
                          <th
                            key={h}
                            className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${dark ? 'text-white/70' : 'text-gray-500'}`}
                          >
                            {h}
                          </th>
                        )
                      )}
                      <th
                        className={`px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-white/70' : 'text-gray-500'}`}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert, index) => {
                      const risk = getRiskBadge(alert.rule_priority, dark);
                      const RiskIcon = risk.icon;
                      const isSelected =
                        showDetailsModal && selectedAlertId === alert.alert_id;
                      return (
                        <tr
                          key={alert.alert_id}
                          className={`border-b transition-colors ${
                            dark
                              ? 'border-white/10 hover:bg-white/5'
                              : 'border-gray-100 hover:bg-gray-50'
                          } ${
                            isSelected
                              ? dark
                                ? 'bg-white/10'
                                : 'bg-blue-50/60'
                              : index % 2 === 1
                                ? dark
                                  ? 'bg-white/[0.02]'
                                  : 'bg-gray-50/50'
                                : ''
                          }`}
                        >
                          <td className={`px-3 ${pad}`}>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border ${risk.color}`}
                              >
                                <RiskIcon className="w-3 h-3" />
                                {risk.level}
                              </span>
                              {isWipAlert(alert) && (
                                <span
                                  title="In your work in progress"
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                                    dark
                                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                      : 'bg-blue-100 text-blue-700 border-blue-300'
                                  }`}
                                >
                                  <ClipboardList className="w-3 h-3" />
                                  WIP
                                </span>
                              )}
                            </div>
                          </td>

                          <td className={`px-4 ${pad}`}>
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`p-1.5 rounded-lg shrink-0 ${dark ? 'bg-white/10' : 'bg-gray-100'} ${t.body}`}
                              >
                                {getServiceTypeIcon(alert.service_type)}
                              </div>
                              <div className="min-w-0">
                                <div
                                  className={`text-sm font-medium ${t.text}`}
                                >
                                  {alert.service_type}
                                </div>
                                {!compact && (
                                  <div
                                    className={`text-xs font-mono ${t.muted}`}
                                  >
                                    ID: {alert.alert_id}
                                  </div>
                                )}
                              </div>
                              {compact && (
                                <span
                                  className={`text-xs font-mono ${t.faint}`}
                                >
                                  {alert.alert_id}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className={`px-4 ${pad} max-w-[300px]`}>
                            {compact ? (
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span
                                  className={`text-sm font-medium shrink-0 ${t.text}`}
                                >
                                  {alert.cashier}
                                </span>
                                <span
                                  className={`text-sm truncate ${t.muted}`}
                                  title={alert.branch_name}
                                >
                                  {alert.branch_name}
                                </span>
                              </div>
                            ) : (
                              <>
                                <div
                                  className={`text-sm font-medium ${t.text}`}
                                >
                                  {alert.cashier}
                                </div>
                                <div
                                  title={alert.branch_name}
                                  className={`text-xs ${t.muted}`}
                                >
                                  {truncate(alert.branch_name, 50)}
                                </div>
                              </>
                            )}
                          </td>

                          <td className={`px-4 ${pad}`}>
                            <div className="flex items-center gap-2.5">
                              {!compact && (
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                                    dark
                                      ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-blue-200'
                                      : 'bg-gradient-to-br from-blue-100 to-purple-100 text-blue-700'
                                  }`}
                                >
                                  {getInitials(alert.cust_name)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div
                                  className={`text-sm font-medium truncate max-w-[200px] ${t.text}`}
                                  title={alert.cust_name}
                                >
                                  {alert.cust_name}
                                </div>
                                {!compact && (
                                  <div className={`text-xs ${t.muted}`}>
                                    Code: {alert.cust_code}
                                  </div>
                                )}
                              </div>
                              {compact && (
                                <span className={`text-xs ${t.faint}`}>
                                  {alert.cust_code}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className={`px-4 ${pad} max-w-[300px]`}>
                            {compact ? (
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span
                                  className={`text-sm font-medium shrink-0 ${t.text}`}
                                >
                                  {alert.rule_id}
                                </span>
                                <span
                                  className={`text-sm truncate ${t.muted}`}
                                  title={alert.rule_desc}
                                >
                                  {alert.rule_desc}
                                </span>
                              </div>
                            ) : (
                              <>
                                <div
                                  className={`text-sm font-medium ${t.text}`}
                                >
                                  {alert.rule_id}
                                </div>
                                <div
                                  title={alert.rule_desc}
                                  className={`text-xs ${t.muted}`}
                                >
                                  {truncate(alert.rule_desc, 50)}
                                </div>
                              </>
                            )}
                          </td>

                          {/* <td className={`px-4 ${pad} whitespace-nowrap`}>
                            <div
                              title={
                                isValid(alert.time_stamp)
                                  ? new Date(alert.time_stamp).toLocaleString()
                                  : ''
                              }
                              className={`text-sm ${t.body}`}
                            >
                              {formatRelativeDate(alert.time_stamp)}{' '}
                              <span className={t.faint}>
                                {formatClock(alert.time_stamp)}
                              </span>
                            </div>
                          </td> */}

                          <td className={`px-4 ${pad} text-right`}>
                            <div className="flex items-center justify-end gap-1.5">
                              <PermissionGuard
                                menuId={ALERTS_MANAGEMENT_MENU_ID}
                                action="view"
                              >
                                <button
                                  onClick={() => handleViewDetails(alert)}
                                  disabled={openingId !== null}
                                  className={`p-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                                    dark
                                      ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                                      : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                  }`}
                                  title="View Details"
                                  aria-label={`View details for alert ${alert.alert_id}`}
                                >
                                  {openingId === alert.alert_id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </button>
                              </PermissionGuard>
                              <PermissionGuard
                                menuId={ALERTS_MANAGEMENT_MENU_ID}
                                action="edit"
                                fallback={null}
                              >
                                <button
                                  onClick={() => handleDisposeAlert(alert)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    dark
                                      ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
                                      : 'bg-green-100 hover:bg-green-200 text-green-700'
                                  }`}
                                  title="Dispose Alert"
                                  aria-label={`Dispose alert ${alert.alert_id}`}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              </PermissionGuard>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div
                className={`md:hidden divide-y ${dark ? 'divide-white/10' : 'divide-gray-100'}`}
              >
                {alerts.map((alert) => {
                  const risk = getRiskBadge(alert.rule_priority, dark);
                  const RiskIcon = risk.icon;
                  return (
                    <div key={alert.alert_id} className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-lg shrink-0 ${dark ? 'bg-white/10' : 'bg-gray-100'} ${t.body}`}
                          >
                            {getServiceTypeIcon(alert.service_type)}
                          </div>
                          <div className="min-w-0">
                            <div className={`font-medium truncate ${t.text}`}>
                              {alert.service_type}
                            </div>
                            <div className={`text-xs ${t.faint}`}>
                              ID: {alert.alert_id}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border shrink-0 ${risk.color}`}
                        >
                          <RiskIcon className="w-3 h-3" />
                          {risk.level}
                        </span>
                        {isWipAlert(alert) && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border shrink-0 ${
                              dark
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : 'bg-blue-100 text-blue-700 border-blue-300'
                            }`}
                          >
                            <ClipboardList className="w-3 h-3" />
                            WIP
                          </span>
                        )}
                      </div>
                      <div className={`text-sm mb-1 ${t.body}`}>
                        {alert.cust_name}{' '}
                        <span className={t.faint}>· {alert.cust_code}</span>
                      </div>
                      <div className={`text-xs mb-3 ${t.muted}`}>
                        <span className="font-medium">{alert.rule_id}</span> ·{' '}
                        {truncate(alert.rule_desc, 60)}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${t.faint}`}>
                          <Clock className="inline w-3 h-3 mr-1" />
                          {formatRelativeDate(alert.time_stamp)}{' '}
                          {formatClock(alert.time_stamp)}
                        </span>
                        <div className="flex items-center gap-2">
                          <PermissionGuard
                            menuId={ALERTS_MANAGEMENT_MENU_ID}
                            action="view"
                          >
                            <button
                              onClick={() => handleViewDetails(alert)}
                              disabled={openingId !== null}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60 ${
                                dark
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {openingId === alert.alert_id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                              View
                            </button>
                          </PermissionGuard>
                          <PermissionGuard
                            menuId={ALERTS_MANAGEMENT_MENU_ID}
                            action="edit"
                            fallback={null}
                          >
                            <button
                              onClick={() => handleDisposeAlert(alert)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                                dark
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Dispose
                            </button>
                          </PermissionGuard>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Pagination — always shown when there are rows, so page size stays reachable */}
          {!loading && !error && alerts.length > 0 && (
            <div
              className={`flex flex-col sm:flex-row gap-3 justify-between sm:items-center px-4 py-2.5 border-t ${t.line}`}
            >
              <div className="flex items-center gap-3">
                <div className={`text-sm ${t.muted}`}>
                  Page {currentPage} of {Math.max(totalPages, 1)}
                </div>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Rows per page"
                  className={`px-2 py-1 rounded-lg text-sm ${t.input}`}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(currentPage - 1)}
                  disabled={!hasPrev}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${t.btn}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                <div className="hidden md:flex gap-1">
                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      aria-current={currentPage === p ? 'page' : undefined}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                        currentPage === p
                          ? dark
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                            : 'bg-blue-100 text-blue-700 border border-blue-300'
                          : dark
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className={`self-center ${t.faint}`}>...</span>
                      <button
                        onClick={() => setPage(totalPages)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                          dark
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
                  onClick={() => setPage(currentPage + 1)}
                  disabled={!hasNext}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${t.btn}`}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlays — portaled to <body>. Filters (z-90) and the record modals
          (z-100) can never be trapped under, or stack over, each other. */}
      <Portal>
        <AnimatePresence>
          {showFilters && (
            <FiltersDrawer dark={dark} onClose={() => setShowFilters(false)}>
              <AlertFiltersPanel
                filters={filters}
                filterOptions={filterOptions}
                onFiltersChange={updateFilters}
                onClose={() => setShowFilters(false)}
              />
            </FiltersDrawer>
          )}
        </AnimatePresence>

        <div className={`relative ${Z_MODALS}`}>
          <AlertDetailsModal
            isOpen={showDetailsModal}
            onClose={() => setShowDetailsModal(false)}
            alertDetails={selectedAlert}
            alertId={selectedAlertId}
            loading={openingId !== null}
          />
          <AlertDispositionModal
            isOpen={showDispositionModal}
            onClose={() => setShowDispositionModal(false)}
            alert={selectedAlertForDisposition}
            onDispose={disposeAlert}
          />
        </div>
      </Portal>
    </PermissionGuard>
  );
};

export default AlertsManagement;
