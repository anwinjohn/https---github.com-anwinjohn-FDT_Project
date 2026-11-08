import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  motion,
  AnimatePresence,
  animate,
  useMotionValue,
  useTransform,
  type Variants,
} from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getDefaultDateRange } from '../utils/dateUtils';
import { DateRange } from '../types/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSystemSettings } from '../hooks/useSystemSettings';
import DateRangePicker from './DateRangePicker';
import UsersPanel from './UsersPanel';
import BranchesPanel from './BranchesPanel';
import RiskDistributionPanel from './RiskDistributionPanel';
import TopAlertRulesPanel from './TopAlertRulesPanel';
import DetailedRulesPanel from './DetailedRulesPanel';
import TrendAnalysisPanel from './TrendAnalysisPanel';
import RiskAnalyticsDashboard from './RiskAnalyticsDashboard';
import SettingsModal from './SettingsModal';
import SecureAdminDashboard from './admin/SecureAdminDashboard';
import AlertsManagement from './alerts/AlertsManagement';
import SecureSidebar from './SecureSidebar';
import SystemLogMonitor from './alerts/AlertAuditLog';
import RulesManagement from './admin/RulesManagement';
import ManagementFraudDashboard from './admin/Managementfrauddashboard';
import AlertListing from './alerts/AlertListing';
import ReportsPage from './ReportsPage';
import UserProfilePage from './UserProfile';
import {
  NotificationCenterPanel,
  useNotificationCenter,
} from './notifications';
import {
  FraudVolumeOverTimeCard,
  FraudCategoryMixCard,
} from './admin/Fraudtrendwidgets';
import { exportDashboardToPdf } from '../utils/exportDashboardToPdf';
import SystemSettingsPanel from './admin/SystemSettingsPanel';
import {
  RefreshCw,
  AlertTriangle,
  Users,
  Building,
  Shield,
  Activity,
  Eye,
  EyeOff,
  BarChart3,
  Settings,
  Menu,
  Clock,
  Home,
  FileText,
  Bell,
  ArrowUpRight,
  Download,
  Sun,
  Moon,
  Power,
  Loader2,
} from 'lucide-react';
import { logger } from '../utils/logger';
import { appConfig as config } from '../config/runtime-config';
import apiClient from '../utils/apiClient';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type RulePriority = 'High' | 'Medium' | 'Low';

interface RuleConfig {
  config_key: string;
  config_value: string;
  is_active: boolean;
}

interface AlertRule {
  rule_id: string;
  scenario: string;
  scenario_logic: string;
  rule_priority: RulePriority;
  active_status: boolean;
  configs: RuleConfig[];
}

type Tone = 'red' | 'blue' | 'green' | 'orange';

/* -------------------------------------------------------------------------- */
/*  Static design tokens (full class strings so Tailwind can see them)        */
/* -------------------------------------------------------------------------- */

const TONES: Record<
  Tone,
  {
    cardDark: string;
    cardLight: string;
    icon: string;
    arrow: string;
    subDark: string;
    subLight: string;
    accentDark: string;
    accentLight: string;
    valueHex: string;
  }
> = {
  red: {
    cardDark:
      'bg-gradient-to-br from-red-500/15 via-red-500/10 to-red-500/5 border-red-500/20 hover:border-red-500/40 hover:shadow-red-500/20',
    cardLight:
      'bg-gradient-to-br from-red-50 to-white border-red-200 hover:border-red-300 hover:shadow-red-100',
    icon: 'from-red-500 to-red-600 group-hover:shadow-red-500/30',
    arrow: 'text-red-400',
    subDark: 'text-red-200/80',
    subLight: 'text-red-700',
    accentDark: 'text-red-300',
    accentLight: 'text-red-700',
    valueHex: 'text-red-400',
  },
  blue: {
    cardDark:
      'bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40 hover:shadow-blue-500/20',
    cardLight:
      'bg-gradient-to-br from-blue-50 to-white border-blue-200 hover:border-blue-300 hover:shadow-blue-100',
    icon: 'from-blue-500 to-blue-600 group-hover:shadow-blue-500/30',
    arrow: 'text-blue-400',
    subDark: 'text-blue-200/80',
    subLight: 'text-blue-700',
    accentDark: 'text-blue-300',
    accentLight: 'text-blue-700',
    valueHex: 'text-blue-400',
  },
  green: {
    cardDark:
      'bg-gradient-to-br from-green-500/15 via-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/40 hover:shadow-green-500/20',
    cardLight:
      'bg-gradient-to-br from-green-50 to-white border-green-200 hover:border-green-300 hover:shadow-green-100',
    icon: 'from-green-500 to-green-600 group-hover:shadow-green-500/30',
    arrow: 'text-green-400',
    subDark: 'text-green-200/80',
    subLight: 'text-green-700',
    accentDark: 'text-green-300',
    accentLight: 'text-green-700',
    valueHex: 'text-green-400',
  },
  orange: {
    cardDark:
      'bg-gradient-to-br from-orange-500/15 via-orange-500/10 to-orange-500/5 border-orange-500/20 hover:border-orange-500/40 hover:shadow-orange-500/20',
    cardLight:
      'bg-gradient-to-br from-orange-50 to-white border-orange-200 hover:border-orange-300 hover:shadow-orange-100',
    icon: 'from-orange-500 to-orange-600 group-hover:shadow-orange-500/30',
    arrow: 'text-orange-400',
    subDark: 'text-orange-200/80',
    subLight: 'text-orange-700',
    accentDark: 'text-orange-300',
    accentLight: 'text-orange-700',
    valueHex: 'text-orange-400',
  },
};

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Fraud Detection & Analytics Dashboard',
  'management-dashboard': 'Management Dashboard — Fraud Trend',
  'risk-analytics': 'Fraud & Risk Analytics',
  rules: 'Alert Rules Management',
  users: 'User Activity Analytics',
  branches: 'Branch Performance Analytics',
  trends: 'Trend Analysis & Insights',
  reports: 'Reports & Documentation',
  notifications: 'Alert Notifications',
  analytics: 'Advanced Analytics',
  settings: 'System Configuration',
  admin: 'Secure Administration Panel',
  onboarding: 'User Onboarding',
  permissions: 'Role Permissions',
};

const getViewTitle = (view: string) => VIEW_TITLES[view] || 'Dashboard';

const ADMIN_VIEWS = ['admin', 'onboarding', 'permissions'];

/* -------------------------------------------------------------------------- */
/*  Motion presets                                                            */
/* -------------------------------------------------------------------------- */

const EASE = [0.22, 1, 0.36, 1] as const;

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const riseItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/* -------------------------------------------------------------------------- */
/*  Small presentational helpers                                              */
/* -------------------------------------------------------------------------- */

/** Counts smoothly up/down to `value` whenever it changes. */
const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(mv, Number(value) || 0, {
      duration: 0.9,
      ease: 'easeOut',
    });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span>{text}</motion.span>;
};

interface IconButtonProps {
  label: string;
  onClick?: () => void;
  isDark: boolean;
  children: React.ReactNode;
  badge?: number;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  id?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  label,
  onClick,
  isDark,
  children,
  badge,
  active,
  danger,
  disabled,
  id,
}) => {
  const base =
    'relative h-9 w-9 grid place-items-center rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50 disabled:cursor-not-allowed';
  const tone = danger
    ? isDark
      ? 'text-red-300 hover:bg-red-500/15'
      : 'text-red-600 hover:bg-red-50'
    : active
      ? isDark
        ? 'bg-blue-500/20 text-blue-300'
        : 'bg-blue-100 text-blue-700'
      : isDark
        ? 'text-white/80 hover:bg-white/10 hover:text-white'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';
  return (
    <motion.button
      id={id}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`${base} ${tone}`}
    >
      {children}
      <AnimatePresence>
        {badge && badge > 0 ? (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center shadow"
          >
            {badge > 99 ? '99+' : badge}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
};

interface NavCardProps {
  tone: Tone;
  isDark: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  children: React.ReactNode;
}

const NavCard: React.FC<NavCardProps> = ({
  tone,
  isDark,
  icon,
  title,
  subtitle,
  onClick,
  children,
}) => {
  const t = TONES[tone];
  return (
    <motion.div
      variants={riseItem}
      whileHover={{ y: -4, scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative p-4 rounded-2xl border cursor-pointer transition-shadow duration-300 backdrop-blur-xl shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
        isDark ? t.cardDark : t.cardLight
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className={`p-2 bg-gradient-to-br ${t.icon} rounded-xl shadow-lg transition-all duration-300 group-hover:scale-110`}
        >
          {icon}
        </div>
        <ArrowUpRight
          className={`w-4 h-4 ${t.arrow} opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-300`}
        />
      </div>
      <h3
        className={`text-base font-bold mb-0.5 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}
      >
        {title}
      </h3>
      <p className={`text-xs mb-2 ${isDark ? t.subDark : t.subLight}`}>
        {subtitle}
      </p>
      {children}
    </motion.div>
  );
};

interface InsightRow {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}

interface InsightCardProps {
  tone: Tone;
  isDark: boolean;
  icon: React.ReactNode;
  title: string;
  rows: InsightRow[] | null;
  emptyText: string;
}

const InsightCard: React.FC<InsightCardProps> = ({
  tone,
  isDark,
  icon,
  title,
  rows,
  emptyText,
}) => {
  const t = TONES[tone];
  return (
    <motion.div
      variants={riseItem}
      whileHover={{ y: -3 }}
      className={`p-6 rounded-2xl border backdrop-blur-xl shadow-lg ${
        isDark
          ? t.cardDark.split(' hover:')[0]
          : t.cardLight.split(' hover:')[0]
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 bg-gradient-to-br ${t.icon} rounded-lg`}>
          {icon}
        </div>
        <h3
          className={`text-lg font-semibold ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {title}
        </h3>
      </div>
      {rows ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between items-center">
              <span
                className={`text-sm ${
                  isDark ? 'text-white/70' : 'text-gray-700'
                }`}
              >
                {r.label}
              </span>
              <span
                className={`font-medium ${
                  r.valueClass ?? (isDark ? t.accentDark : t.accentLight)
                }`}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={`text-sm ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
          {emptyText}
        </p>
      )}
    </motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Dashboard                                                                 */
/* -------------------------------------------------------------------------- */

const Dashboard: React.FC = () => {
  const { viewId } = useParams<{ viewId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeView, setActiveView] = useState<string>(viewId || 'dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [masterLiveEnabled, setMasterLiveEnabled] = useState(true);

  // sidebarOpen doubles as the "pinned open" flag (menu button);
  // sidebarHovering drives the auto show/hide-on-hover behaviour.
  const [sidebarHovering, setSidebarHovering] = useState(false);
  const sidebarCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const openSidebarOnHover = useCallback(() => {
    if (sidebarCloseTimerRef.current) {
      clearTimeout(sidebarCloseTimerRef.current);
      sidebarCloseTimerRef.current = null;
    }
    setSidebarHovering(true);
  }, []);

  const scheduleSidebarClose = useCallback(() => {
    if (sidebarCloseTimerRef.current) {
      clearTimeout(sidebarCloseTimerRef.current);
    }
    sidebarCloseTimerRef.current = setTimeout(() => {
      setSidebarHovering(false);
      sidebarCloseTimerRef.current = null;
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      if (sidebarCloseTimerRef.current) {
        clearTimeout(sidebarCloseTimerRef.current);
      }
    };
  }, []);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [preparingExport, setPreparingExport] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const { user, logout, resetSessionTimer } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { getSetting } = useSystemSettings();
  const isDark = theme === 'dark';

  // Always-fresh handle on the theme (used by the PDF export, which has to
  // flip the theme and then read the *new* value after React re-renders).
  const themeRef = useRef({ theme, toggleTheme });
  themeRef.current = { theme, toggleTheme };

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);

  // Update activeView when URL parameter changes
  useEffect(() => {
    if (viewId) {
      setActiveView(viewId);
    } else if (location.pathname === '/dashboard') {
      setActiveView('dashboard');
    }
  }, [viewId, location.pathname]);

  const ApiRefreshInteval = config.dashboard.autoRefresh?.interval || 6000;
  const ApiRefreshEnbaled = config.dashboard.autoRefresh?.enabled;
  const shouldAutoRefresh =
    activeView === 'dashboard' &&
    autoRefresh &&
    masterLiveEnabled &&
    ApiRefreshEnbaled;

  const {
    alertsSummary,
    userAlertsSummary,
    branchAlertDetails,
    isLoading,
    error,
    lastUpdated,
    violationType,
    refreshData,
    useFraudVolume,
    trendAnalysisData,
  } = useApi(dateRange, shouldAutoRefresh ? ApiRefreshInteval : 0);

  const apiBaseUrl = config.api.baseUrl;

  useEffect(() => {
    if (activeView !== 'rule-management') return;

    const loadRules = async () => {
      try {
        setRulesLoading(true);
        const response = await apiClient.get(`${apiBaseUrl}/rules-config`);
        setRules(response.data);
      } catch (err) {
        console.error(err);
      } finally {
        setRulesLoading(false);
      }
    };

    loadRules();
  }, [activeView]);

  const appName = config.app.name;
  const appShortName = config.app.shortName;

  // Sync master live setting
  useEffect(() => {
    const systemMasterLive = getSetting('master_live_enabled', true);
    setMasterLiveEnabled(systemMasterLive);
  }, [getSetting]);

  // Simulate dashboard loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setDashboardLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Reset session timer on any activity
  useEffect(() => {
    resetSessionTimer();
  }, [activeView, dateRange, resetSessionTimer]);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const { unreadCount } = useNotificationCenter();

  const handleDateRangeChange = useCallback(
    (newDateRange: DateRange) => {
      setDateRange(newDateRange);
      resetSessionTimer();
    },
    [resetSessionTimer]
  );

  const handleRefresh = useCallback(() => {
    refreshData();
    resetSessionTimer();
  }, [refreshData, resetSessionTimer]);

  /**
   * PDF export — ALWAYS rendered in light mode.
   *
   * Root cause of the blank-PDF bug: in dark mode the page is full of
   * `text-white` / `bg-white/5` utilities. The PDF is painted on a white
   * page, so white text on white = invisible. Rather than patching dozens of
   * components, we briefly switch the app to the light theme (behind a
   * full-screen "preparing" overlay so there is no visible flicker), capture,
   * and restore the user's theme afterwards — even if the export throws.
   */
  const handleExportPdf = useCallback(async () => {
    if (preparingExport || isExportingPdf) return;

    const waitFor = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    const wasDark = themeRef.current.theme === 'dark';

    setPreparingExport(true);
    try {
      if (wasDark) {
        themeRef.current.toggleTheme();
        // wait (max ~2s) until the context really reports light
        for (let i = 0; i < 40 && themeRef.current.theme !== 'light'; i++) {
          await waitFor(50);
        }
        // let layout, entrance animations and chart transitions settle
        await waitFor(700);
      }

      await exportDashboardToPdf(mainContentRef.current, {
        fileName: `${activeView}-report-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`,
        title: getViewTitle(activeView),
        subtitle: `Generated ${new Date().toLocaleString()}`,
        onProgress: setIsExportingPdf,
      });
    } catch (err) {
      logger.error?.('PDF export failed', String(err));
      console.error(err);
    } finally {
      // restore the user's theme
      if (wasDark && themeRef.current.theme !== 'dark') {
        themeRef.current.toggleTheme();
      }
      setPreparingExport(false);
      resetSessionTimer();
    }
  }, [activeView, resetSessionTimer, preparingExport, isExportingPdf]);

  const handleLogout = () => {
    logger.info('User logged out', user?.full_name);
    logout();
  };

  const handleViewChange = (view: string) => {
    setActiveView(view);
    if (view === 'dashboard') {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard/${view}`);
    }
    resetSessionTimer();
    logger.info(`View changed to: ${view}`, user?.full_name || 'Unknown User');
  };

  const handleHomeClick = () => {
    setActiveView('dashboard');
    navigate('/dashboard');
    resetSessionTimer();
    logger.info(
      'Navigated to dashboard via home button',
      user?.full_name || 'Unknown User'
    );
  };

  /* ------------------------------ derived data ----------------------------- */

  const totalAlerts = alertsSummary.reduce((sum, item) => sum + item.count, 0);
  const totalUsers = userAlertsSummary.length;
  const totalBranches = branchAlertDetails.length;

  const riskDistributionData = useMemo(() => {
    const riskCounts = { 'High Risk': 0, 'Medium Risk': 0, 'Low Risk': 0 };
    alertsSummary.forEach((alert) => {
      if (alert.rule_priority === 'High') {
        riskCounts['High Risk'] += alert.count;
      } else if (alert.rule_priority === 'Medium') {
        riskCounts['Medium Risk'] += alert.count;
      } else {
        riskCounts['Low Risk'] += alert.count;
      }
    });
    return [
      { name: 'High Risk', value: riskCounts['High Risk'], color: '#ef4444' },
      {
        name: 'Medium Risk',
        value: riskCounts['Medium Risk'],
        color: '#f97316',
      },
      { name: 'Low Risk', value: riskCounts['Low Risk'], color: '#22c55e' },
    ];
  }, [alertsSummary]);

  const highRiskAlertsCount = useMemo(
    () =>
      alertsSummary
        .filter((alert) => alert.rule_priority === 'High')
        .reduce((sum, alert) => sum + alert.count, 0),
    [alertsSummary]
  );

  const topRuleInfo = useMemo(() => {
    if (alertsSummary.length === 0) return { id: 'N/A', count: 0 };
    const topRule = [...alertsSummary].sort((a, b) => b.count - a.count)[0];
    return { id: topRule.rule_id, count: topRule.count };
  }, [alertsSummary]);

  const topRiskRule = useMemo(() => {
    if (alertsSummary.length === 0) return null;
    return [...alertsSummary].sort((a, b) => b.count - a.count)[0];
  }, [alertsSummary]);

  const topRiskCashier = useMemo(() => {
    const cashiers = userAlertsSummary?.cashiers || [];
    if (cashiers.length === 0) return null;
    return cashiers.reduce((prev, current) =>
      prev.count > current.count ? prev : current
    );
  }, [userAlertsSummary]);

  const topRiskBranchInsight = useMemo(() => {
    if (branchAlertDetails.length === 0) return null;
    return [...branchAlertDetails].sort(
      (a, b) => b.total_alerts - a.total_alerts
    )[0];
  }, [branchAlertDetails]);

  const isAdmin = user?.role_id === 0 || user?.role_id === 1;
  const isAdminView = ADMIN_VIEWS.includes(activeView);
  const isOverview = activeView === 'dashboard' || activeView === 'overview';

  /* --------------------------------- views --------------------------------- */

  const renderOverview = () => (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Quick navigation cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <NavCard
          tone="red"
          isDark={isDark}
          icon={<AlertTriangle className="w-5 h-5 text-white" />}
          title="Fraud & Risk Analytics Dashboard"
          subtitle="Risk intelligence dashboard"
          onClick={() => handleViewChange('risk-analytics')}
        >
          <span
            className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}
          >
            View more details
          </span>
          {totalAlerts > 0 && (
            <div
              className={`flex h-1.5 rounded-full overflow-hidden mt-3 ${
                isDark ? 'bg-white/10' : 'bg-white/70'
              }`}
              title="High / Medium / Low risk mix"
            >
              {riskDistributionData.map((segment, i) => (
                <motion.div
                  key={segment.name}
                  className="h-full"
                  style={{ backgroundColor: segment.color }}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(segment.value / totalAlerts) * 100}%`,
                  }}
                  transition={{
                    duration: 0.9,
                    delay: 0.3 + i * 0.1,
                    ease: EASE,
                  }}
                />
              ))}
            </div>
          )}
        </NavCard>

        <NavCard
          tone="blue"
          isDark={isDark}
          icon={<Shield className="w-5 h-5 text-white" />}
          title="Top Alert Rules"
          subtitle="Most triggered security rules"
          onClick={() => handleViewChange('rules')}
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              <AnimatedNumber value={topRuleInfo.count} />
            </span>
            <span
              className={`text-sm ${isDark ? 'text-blue-300' : 'text-blue-700'}`}
            >
              {topRuleInfo.id} top rule hits
            </span>
          </div>
          <div
            className={`text-xs mt-1 ${
              isDark ? 'text-white/60' : 'text-gray-600'
            }`}
          >
            <AnimatedNumber value={highRiskAlertsCount} /> high risk alerts
          </div>
        </NavCard>

        <NavCard
          tone="green"
          isDark={isDark}
          icon={<Users className="w-5 h-5 text-white" />}
          title="User Analytics"
          subtitle="Employee activity monitoring"
          onClick={() => handleViewChange('users')}
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              <AnimatedNumber value={totalUsers} />
            </span>
            <span
              className={`text-sm ${
                isDark ? 'text-green-300' : 'text-green-700'
              }`}
            >
              active users
            </span>
          </div>
        </NavCard>

        <NavCard
          tone="orange"
          isDark={isDark}
          icon={<Building className="w-5 h-5 text-white" />}
          title="Branch Analytics"
          subtitle="Location-based insights"
          onClick={() => handleViewChange('branches')}
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              <AnimatedNumber value={totalBranches} />
            </span>
            <span
              className={`text-sm ${
                isDark ? 'text-orange-300' : 'text-orange-700'
              }`}
            >
              monitored branches
            </span>
          </div>
        </NavCard>
      </div>

      {/* Fraud trend */}
      <motion.div
        variants={riseItem}
        className="grid grid-cols-1 xl:grid-cols-2 gap-6"
      >
        <FraudVolumeOverTimeCard data={useFraudVolume} isLoading={isLoading} />
        <FraudCategoryMixCard data={violationType} isLoading={isLoading} />
      </motion.div>

      {/* Main analytics */}
      <motion.div
        variants={riseItem}
        className="grid grid-cols-1 xl:grid-cols-2 gap-8"
      >
        <RiskDistributionPanel
          data={riskDistributionData}
          isLoading={isLoading}
        />
        <TopAlertRulesPanel data={alertsSummary} isLoading={isLoading} />
      </motion.div>

      {/* Secondary analytics */}
      <motion.div
        variants={riseItem}
        className="grid grid-cols-1 xl:grid-cols-2 gap-8"
      >
        <UsersPanel
          data={userAlertsSummary}
          isLoading={isLoading}
          dateRange={dateRange}
        />
        <BranchesPanel data={branchAlertDetails} isLoading={isLoading} />
      </motion.div>

      {/* Executive insights — derived from already-fetched data */}
      {(topRiskRule || topRiskCashier || topRiskBranchInsight) && (
        <motion.div
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <InsightCard
            tone="blue"
            isDark={isDark}
            icon={<Shield className="w-5 h-5 text-white" />}
            title="Highest-Triggered Rule"
            emptyText="No rule activity for this period."
            rows={
              topRiskRule
                ? [
                    { label: 'Rule ID', value: topRiskRule.rule_id },
                    {
                      label: 'Priority',
                      value: topRiskRule.rule_priority,
                      valueClass: 'text-red-400',
                    },
                    {
                      label: 'Triggers',
                      value: topRiskRule.count,
                      valueClass: 'text-blue-400',
                    },
                  ]
                : null
            }
          />
          <InsightCard
            tone="red"
            isDark={isDark}
            icon={<Users className="w-5 h-5 text-white" />}
            title="Highest-violated Cashier"
            emptyText="No cashier activity for this period."
            rows={
              topRiskCashier
                ? [
                    { label: 'Cashier ID', value: topRiskCashier.emp_id },
                    {
                      label: 'Violations',
                      value: topRiskCashier.count,
                      valueClass: 'text-red-400',
                    },
                    {
                      label: 'Last Violation',
                      value: topRiskCashier.last_violation,
                      valueClass: isDark ? 'text-white/80' : 'text-gray-700',
                    },
                  ]
                : null
            }
          />
          <InsightCard
            tone="orange"
            isDark={isDark}
            icon={<Building className="w-5 h-5 text-white" />}
            title="Riskiest Branch"
            emptyText="No branch activity for this period."
            rows={
              topRiskBranchInsight
                ? [
                    {
                      label: 'Branch',
                      value: (
                        <span className="inline-block truncate max-w-[140px] align-bottom">
                          {topRiskBranchInsight.branch_name}
                        </span>
                      ),
                    },
                    {
                      label: 'Alerts',
                      value: topRiskBranchInsight.total_alerts,
                      valueClass: 'text-orange-400',
                    },
                    {
                      label: 'Risk Level',
                      value: (
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            isDark
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {topRiskBranchInsight.risk_level}
                        </span>
                      ),
                      valueClass: '',
                    },
                  ]
                : null
            }
          />
        </motion.div>
      )}
    </motion.div>
  );

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
      case 'overview':
        return renderOverview();
      case 'management-dashboard':
        return <ManagementFraudDashboard dateRange={dateRange} />;
      case 'alerts-management':
        return <AlertsManagement />;
      case 'rule-management':
        return <RulesManagement data={rules} isLoading={isLoading} />;
      case 'risk-analytics':
        return <RiskAnalyticsDashboard dateRange={dateRange} />;
      case 'alert-lists':
        return <AlertListing />;
      case 'reports':
      case 'report-builder':
        return <ReportsPage />;
      case 'audit-logs':
      case 'logs':
        return <SystemLogMonitor />;
      case 'profile-management':
        return <UserProfilePage />;
      case 'rules':
        return (
          <DetailedRulesPanel data={alertsSummary} isLoading={isLoading} />
        );
      case 'users':
        return (
          <UsersPanel
            data={userAlertsSummary}
            isLoading={isLoading}
            fullWidth
            dateRange={dateRange}
          />
        );
      case 'branches':
        return (
          <BranchesPanel
            data={branchAlertDetails}
            isLoading={isLoading}
            fullWidth
          />
        );
      case 'trends':
        return (
          <TrendAnalysisPanel data={trendAnalysisData} isLoading={isLoading} />
        );
      case 'admin':
      case 'user-management':
        return <SecureAdminDashboard initialTab="users" />;
      case 'onboarding':
        return <SecureAdminDashboard initialTab="onboarding" />;
      case 'permissions':
        return <SecureAdminDashboard initialTab="permissions" />;
      case 'settings':
        return <SystemSettingsPanel />;
      default:
        return (
          <div
            className={`rounded-2xl border p-8 min-h-[500px] backdrop-blur-xl ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-card border-theme'
            }`}
          >
            <div className="text-center py-20">
              <div
                className={`p-6 rounded-2xl inline-block mb-6 border ${
                  isDark
                    ? 'bg-white/10 border-white/20'
                    : 'bg-surface border-theme'
                }`}
              >
                {activeView === 'reports' && (
                  <FileText className="w-12 h-12 text-indigo-400 mx-auto" />
                )}
                {activeView === 'notifications' && (
                  <Bell className="w-12 h-12 text-yellow-400 mx-auto" />
                )}
                {activeView === 'analytics' && (
                  <BarChart3 className="w-12 h-12 text-purple-400 mx-auto" />
                )}
                {!['reports', 'notifications', 'analytics'].includes(
                  activeView
                ) && <Home className="w-12 h-12 text-blue-400 mx-auto" />}
              </div>
              <h2
                className={`text-2xl font-bold mb-4 capitalize ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {getViewTitle(activeView)}
              </h2>
              <p
                className={`max-w-md mx-auto ${
                  isDark ? 'text-white/60' : 'text-gray-700'
                }`}
              >
                This section will display detailed {activeView} information and
                analytics. Content panels will be rendered here based on the
                selected view.
              </p>
            </div>
          </div>
        );
    }
  };

  /* ------------------------------ loading screen --------------------------- */

  if (dashboardLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark
            ? 'bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950'
            : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className={`w-16 h-16 border-4 rounded-full mx-auto mb-6 ${
              isDark
                ? 'border-blue-500/30 border-t-blue-500'
                : 'border-blue-300/30 border-t-blue-600'
            }`}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2
              className={`text-2xl font-bold mb-2 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Loading {appShortName}
            </h2>
            <p className={isDark ? 'text-white/60' : 'text-gray-600'}>
              Initializing {appName} dashboard...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ---------------------------------- shell -------------------------------- */

  const liveLabel = !masterLiveEnabled
    ? 'Live Disabled'
    : autoRefresh
      ? 'Live'
      : 'Manual';

  const divider = (
    <span
      className={`mx-1 h-5 w-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}
      aria-hidden="true"
    />
  );

  return (
    <div
      className={`min-h-screen flex ${
        isDark
          ? 'bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950'
          : 'bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'
      }`}
    >
      {/* Sidebar — hover-to-reveal (unchanged behaviour) */}
      <div>
        <div
          onMouseEnter={openSidebarOnHover}
          className="fixed left-0 top-0 h-full w-6 z-40"
          aria-hidden="true"
        />
        <SecureSidebar
          isOpen={sidebarOpen || sidebarHovering}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          activeView={activeView}
          onViewChange={handleViewChange}
          onHoverStart={openSidebarOnHover}
          onHoverEnd={scheduleSidebarClose}
        />
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ============================ HEADER ============================ */}
        <motion.header
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className={`sticky top-0 z-30 backdrop-blur-xl border-b ${
            isDark ? 'bg-black/30 border-white/10' : 'bg-white/85 border-theme'
          }`}
        >
          {/* Row 1 — identity & global actions */}
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <IconButton
                id="menu-button"
                label={sidebarOpen ? 'Unpin sidebar' : 'Pin sidebar open'}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                isDark={isDark}
                active={sidebarOpen}
              >
                <Menu className="w-5 h-5" />
              </IconButton>

              <div className="min-w-0">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.h1
                    key={activeView}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className={`text-lg sm:text-xl font-bold leading-tight truncate ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {getViewTitle(activeView)}
                  </motion.h1>
                </AnimatePresence>
                <p
                  className={`hidden sm:block text-xs font-medium truncate ${
                    isDark ? 'text-blue-200/80' : 'text-blue-600'
                  }`}
                >
                  Welcome back, {user?.full_name}
                </p>
              </div>
            </div>

            <div
              className={`lex items-center gap-3 ml-auto ${
                isDark
                  ? 'bg-white/[0.04] border-white/10'
                  : 'bg-white border-gray-200 shadow-sm'
              }`}
            >
              {!isAdminView && (
                <DateRangePicker
                  dateRange={dateRange}
                  onDateRangeChange={handleDateRangeChange}
                />
              )}
            </div>
            {/* Global actions — one tidy pill */}
            <div
              className={`flex items-center gap-0.5 p-1 rounded-xl border ${
                isDark
                  ? 'bg-white/[0.04] border-white/10'
                  : 'bg-white border-gray-200 shadow-sm'
              }`}
            >
              <IconButton
                label="Home"
                onClick={handleHomeClick}
                isDark={isDark}
                active={isOverview}
              >
                <Home className="w-4 h-4" />
              </IconButton>

              <div className="relative">
                <IconButton
                  label="Notifications"
                  onClick={() => setNotificationOpen((o) => !o)}
                  isDark={isDark}
                  active={notificationOpen}
                  badge={unreadCount}
                >
                  <Bell className="w-4 h-4" />
                </IconButton>
              </div>

              <IconButton
                label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
                onClick={toggleTheme}
                isDark={isDark}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isDark ? 'moon' : 'sun'}
                    initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.2 }}
                    className="grid place-items-center"
                  >
                    {isDark ? (
                      <Moon className="w-4 h-4" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500" />
                    )}
                  </motion.span>
                </AnimatePresence>
              </IconButton>

              {isAdmin && (
                <IconButton
                  label="Settings"
                  onClick={() => setIsSettingsOpen(true)}
                  isDark={isDark}
                >
                  <Settings className="w-4 h-4" />
                </IconButton>
              )}

              {divider}

              <IconButton
                label="Log out"
                onClick={handleLogout}
                isDark={isDark}
                danger
              >
                <Power className="w-4 h-4" />
              </IconButton>
            </div>
          </div>

          {/* Row 2 — data controls (left) and system status (right) */}
          <div
            className={`px-6 py-2 flex flex-wrap items-center justify-between gap-3 border-t ${
              isDark ? 'border-white/5' : 'border-gray-100'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {!isAdminView && (
                <>
                  {/* <DateRangePicker
                    dateRange={dateRange}
                    onDateRangeChange={handleDateRangeChange}
                  /> */}

                  {/* Live / Manual segmented toggle */}
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    disabled={!masterLiveEnabled}
                    aria-pressed={autoRefresh && masterLiveEnabled}
                    className={`flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium border transition-colors duration-200 disabled:cursor-not-allowed ${
                      !masterLiveEnabled
                        ? isDark
                          ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                        : autoRefresh
                          ? isDark
                            ? 'bg-green-500/15 text-green-200 border-green-500/30'
                            : 'bg-green-50 text-green-700 border-green-200'
                          : isDark
                            ? 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {autoRefresh && masterLiveEnabled ? (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60 animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                      </span>
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{liveLabel}</span>
                  </motion.button>

                  <IconButton
                    label="Refresh data"
                    onClick={handleRefresh}
                    isDark={isDark}
                    disabled={isLoading}
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                    />
                  </IconButton>

                  {isOverview && (
                    <>
                      {divider}
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={handleExportPdf}
                        disabled={isExportingPdf || preparingExport}
                        title="Download this view as PDF (light theme)"
                        className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
                          isDark
                            ? 'bg-blue-500/15 text-blue-200 border-blue-500/30 hover:bg-blue-500/25'
                            : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {isExportingPdf || preparingExport ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">
                          {isExportingPdf || preparingExport
                            ? 'Exporting…'
                            : 'Export PDF'}
                        </span>
                      </motion.button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Status chips */}
            <div
              className={`flex items-center gap-4 text-xs ${
                isDark ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-blue-400" />
                <span className="font-medium">Secure System Active</span>
              </div>
              <AnimatePresence>
                {autoRefresh &&
                  !isAdminView &&
                  activeView !== 'risk-analytics' &&
                  masterLiveEnabled && (
                    <motion.div
                      key="rt"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="flex items-center gap-1.5 text-green-400"
                    >
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      <span className="font-medium">Real-time Updates</span>
                    </motion.div>
                  )}
              </AnimatePresence>
              {lastUpdated &&
                !isAdminView &&
                activeView !== 'risk-analytics' && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
                  </div>
                )}
            </div>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden px-6"
              >
                <div
                  className={`mb-3 flex items-center gap-3 rounded-xl border p-3 ${
                    isDark
                      ? 'bg-red-500/15 border-red-500/30 text-red-200'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium text-sm">{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>

        <NotificationCenterPanel
          open={notificationOpen}
          onClose={() => setNotificationOpen(false)}
          theme={theme}
          onNavigate={handleViewChange}
        />

        {/* ============================ CONTENT ============================ */}
        <main ref={mainContentRef} className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer
          className={`py-3 mt-8 backdrop-blur-xl border-t ${
            isDark
              ? 'bg-black/20 border-white/10 text-white/40'
              : 'bg-white/80 border-theme text-gray-500'
          }`}
        >
          <div className="container mx-auto px-4 text-center text-xs">
            © {new Date().getFullYear()} {appShortName} - {appName}. All rights
            reserved.
          </div>
        </footer>
      </div>

      {isAdmin && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          user={user}
          masterLiveEnabled={masterLiveEnabled}
          onMasterLiveChange={setMasterLiveEnabled}
        />
      )}

      {/* Masks the brief light-theme switch while the PDF is captured */}
      <AnimatePresence>
        {preparingExport && (
          <motion.div
            key="export-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-6 py-4 text-white shadow-2xl"
            >
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <div>
                <p className="text-sm font-semibold">Preparing your PDF…</p>
                <p className="text-xs text-white/60">
                  Rendering in light mode for a clean, readable report
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
