import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getDefaultDateRange } from '../utils/dateUtils';
import { DateRange } from '../types/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSystemSettings } from '../hooks/useSystemSettings';
import DateRangePicker from './DateRangePicker';
import AlertsPanel from './AlertsPanel';
import UsersPanel from './UsersPanel';
import BranchesPanel from './BranchesPanel';
import StatisticCard from './StatisticCard';
import RiskDistributionPanel from './RiskDistributionPanel';
import TopAlertRulesPanel from './TopAlertRulesPanel';
import DetailedRulesPanel from './DetailedRulesPanel';
import TrendAnalysisPanel from './TrendAnalysisPanel';
import RiskAnalyticsDashboard from './RiskAnalyticsDashboard';
import SettingsModal from './SettingsModal';
import SecureAdminDashboard from './admin/SecureAdminDashboard';
import AlertsManagement from './alerts/AlertsManagement';
import SecureSidebar from './SecureSidebar';
import PermissionGuard from './PermissionGuard';
import SystemLogMonitor from './alerts/AlertAuditLog';
import RulesManagement from './admin/RulesManagement';
import {
  RefreshCw,
  AlertTriangle,
  Users,
  Building,
  Shield,
  Activity,
  Eye,
  EyeOff,
  TrendingUp,
  BarChart3,
  PieChart,
  Table,
  Settings,
  LogOut,
  Menu,
  Calendar,
  Clock,
  Home,
  FileText,
  Bell,
  Zap,
  Target,
  Globe,
  Layers,
  ArrowUpRight,
  Filter,
  Download,
  Sun,
  Moon,
  Power,
} from 'lucide-react';
import { logger } from '../utils/logger';
import { appConfig as config } from '../config/runtime-config';
import { Axios } from 'axios';
import apiClient from '../utils/apiClient';

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

  const { user, logout, resetSessionTimer } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { getSetting } = useSystemSettings();

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
    branchAlertsSummary,
    branchAlertDetails,
    isLoading,
    error,
    lastUpdated,
    violationType,
    refreshData,
  } = useApi(dateRange, shouldAutoRefresh ? ApiRefreshInteval : 0);

  interface AlertRule {
    rule_id: string;
    scenario: string;
    scenario_logic: string;
    rule_priority: RulePriority;
    active_status: boolean;
    configs: RuleConfig[];
  }
  interface RuleConfig {
    config_key: string;
    config_value: string;
    is_active: boolean;
  }

  useEffect(() => {
    if (activeView !== 'rule-management') return;

    const loadRules = async () => {
      try {
        setRulesLoading(true);

        const response = await apiClient.get(
          'http://localhost:8000/rules-config'
        );
        console.log('rules config', response);
        setRules(response.data);
      } catch (err) {
        console.error(err);
      } finally {
        setRulesLoading(false);
      }
    };

    loadRules();
  }, [activeView]);

  type RulePriority = 'High' | 'Medium' | 'Low';

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

  const handleDateRangeChange = useCallback(
    (newDateRange: DateRange) => {
      setDateRange(newDateRange);
      resetSessionTimer();
    },
    [resetSessionTimer]
  );
  console.log(dateRange);
  const handleRefresh = useCallback(() => {
    refreshData();
    resetSessionTimer();
  }, [refreshData, resetSessionTimer]);

  const handleLogout = () => {
    logger.info('User logged out', user?.full_name);
    logout();
  };

  const handleViewChange = (view: string) => {
    setActiveView(view);
    // Update URL to reflect current view
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

  const totalAlerts = alertsSummary.reduce((sum, item) => sum + item.count, 0);
  const totalUsers = userAlertsSummary.length;
  const totalBranches = branchAlertDetails.length;

  // Calculate alert counts by risk category
  const getAlertCountsByRiskCategory = () => {
    // Group alerts by risk category and sum their counts
    const riskCounts = {
      'High Risk': 0,
      'Medium Risk': 0,
      'Low Risk': 0,
    };

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
  };
  const riskDistributionData = getAlertCountsByRiskCategory();

  // Get top 5 alert rules by count
  const topAlertRules = useMemo(() => {
    return [...alertsSummary].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [alertsSummary]);

  // Calculate high risk alerts count
  const highRiskAlertsCount = useMemo(() => {
    return alertsSummary
      .filter(
        (alert) =>
          alert.rule_priority === 'High' || alert.rule_priority === 'High'
      )
      .reduce((sum, alert) => sum + alert.count, 0);
  }, [alertsSummary]);

  // Get the top rule ID and count
  const topRuleInfo = useMemo(() => {
    if (alertsSummary.length === 0) return { id: 'N/A', count: 0 };

    const topRule = [...alertsSummary].sort((a, b) => b.count - a.count)[0];
    return { id: topRule.rule_id, count: topRule.count };
  }, [alertsSummary]);

  const getViewTitle = (view: string) => {
    const titles: Record<string, string> = {
      dashboard: 'Fraud Detection & Analytics Dashboard',
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
    return titles[view] || 'Dashboard';
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleViewChange('risk-analytics')}
                className={`group relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 backdrop-blur-xl shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-red-500/15 via-red-500/10 to-red-500/5 border-red-500/20 hover:border-red-500/40 hover:shadow-red-500/20'
                    : 'bg-gradient-to-br from-red-50 to-red-25 border-red-200 hover:border-red-300 hover:shadow-red-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg group-hover:shadow-red-500/25 transition-all duration-300">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3
                  className={`text-lg font-bold mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Fraud & Risk Analytics
                </h3>
                <p
                  className={`text-sm mb-3 ${
                    theme === 'dark' ? 'text-red-200/80' : 'text-red-700'
                  }`}
                >
                  Risk intelligence dashboard
                </p>
                <div className="flex items-center gap-2">
                  {/* <span className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>24</span> */}
                  <span
                    className={`text-sm ${
                      theme === 'dark' ? 'text-red-300' : 'text-red-700'
                    }`}
                  >
                    View more details
                  </span>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleViewChange('rules')}
                className={`group relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 backdrop-blur-xl shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40 hover:shadow-blue-500/20'
                    : 'bg-gradient-to-br from-blue-50 to-blue-25 border-blue-200 hover:border-blue-300 hover:shadow-blue-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3
                  className={`text-lg font-bold mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Top Alert Rules
                </h3>
                {/* <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-blue-200/80' : 'text-blue-700'
                  }`}>Most triggered security rules</p> */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-2xl font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {topRuleInfo.count}
                    </span>
                    <span
                      className={`text-sm ${
                        theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                      }`}
                    >
                      {topRuleInfo.id} top rule hits
                    </span>
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}
                  >
                    {highRiskAlertsCount} high risk alerts
                  </div>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleViewChange('users')}
                className={`group relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 backdrop-blur-xl shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-green-500/15 via-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/40 hover:shadow-green-500/20'
                    : 'bg-gradient-to-br from-green-50 to-green-25 border-green-200 hover:border-green-300 hover:shadow-green-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg group-hover:shadow-green-500/25 transition-all duration-300">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3
                  className={`text-lg font-bold mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  User Analytics
                </h3>
                <p
                  className={`text-sm mb-3 ${
                    theme === 'dark' ? 'text-green-200/80' : 'text-green-700'
                  }`}
                >
                  Employee activity monitoring
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-2xl font-bold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {totalUsers}
                  </span>
                  <span
                    className={`text-sm ${
                      theme === 'dark' ? 'text-green-300' : 'text-green-700'
                    }`}
                  >
                    active users
                  </span>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleViewChange('branches')}
                className={`group relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 backdrop-blur-xl shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-orange-500/15 via-orange-500/10 to-orange-500/5 border-orange-500/20 hover:border-orange-500/40 hover:shadow-orange-500/20'
                    : 'bg-gradient-to-br from-orange-50 to-orange-25 border-orange-200 hover:border-orange-300 hover:shadow-orange-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg group-hover:shadow-orange-500/25 transition-all duration-300">
                    <Building className="w-6 h-6 text-white" />
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3
                  className={`text-lg font-bold mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Branch Analytics
                </h3>
                <p
                  className={`text-sm mb-3 ${
                    theme === 'dark' ? 'text-orange-200/80' : 'text-orange-700'
                  }`}
                >
                  Location-based insights
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-2xl font-bold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {totalBranches}
                  </span>
                  <span
                    className={`text-sm ${
                      theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                    }`}
                  >
                    monitored branches
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Main Analytics Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <RiskDistributionPanel
                data={riskDistributionData}
                isLoading={isLoading}
              />
              <TopAlertRulesPanel data={alertsSummary} isLoading={isLoading} />
            </div>

            {/* Secondary Analytics Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <UsersPanel
                data={userAlertsSummary}
                isLoading={isLoading}
                dateRange={dateRange}
              />
              <BranchesPanel data={branchAlertDetails} isLoading={isLoading} />
            </div>

            {/* Enhanced System Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`p-6 rounded-2xl border backdrop-blur-xl shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-purple-500/15 via-purple-500/10 to-purple-500/5 border-purple-500/20'
                    : 'bg-gradient-to-br from-purple-50 to-purple-25 border-purple-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <h3
                    className={`text-lg font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    System Performance
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}
                    >
                      Response Time
                    </span>
                    <span
                      className={`font-medium ${
                        theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                      }`}
                    >
                      {'< 100ms'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}
                    >
                      Uptime
                    </span>
                    <span className="font-medium text-green-400">99.9%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}
                    >
                      Active Sessions
                    </span>
                    <span className="font-medium text-blue-400">
                      {totalUsers * 3}
                    </span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`p-6 rounded-2xl border backdrop-blur-xl shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-cyan-500/15 via-cyan-500/10 to-cyan-500/5 border-cyan-500/20'
                    : 'bg-gradient-to-br from-cyan-50 to-cyan-25 border-cyan-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <h3
                    className={`text-lg font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Detection Accuracy
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}
                    >
                      True Positives
                    </span>
                    <span className="font-medium text-green-400">94.2%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}
                    >
                      False Positives
                    </span>
                    <span className="font-medium text-yellow-400">5.8%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}
                    >
                      Confidence Score
                    </span>
                    <span
                      className={`font-medium ${
                        theme === 'dark' ? 'text-cyan-300' : 'text-cyan-700'
                      }`}
                    >
                      High
                    </span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`p-6 rounded-2xl border backdrop-blur-xl shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-indigo-500/15 via-indigo-500/10 to-indigo-500/5 border-indigo-500/20'
                    : 'bg-gradient-to-br from-indigo-50 to-indigo-25 border-indigo-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  <h3
                    className={`text-lg font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Global Coverage
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}
                    >
                      Regions Monitored
                    </span>
                    <span
                      className={`font-medium ${
                        theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'
                      }`}
                    >
                      12
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}
                    >
                      Data Centers
                    </span>
                    <span className="font-medium text-blue-400">3</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}
                    >
                      Compliance
                    </span>
                    <span className="font-medium text-green-400">100%</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        );
      case 'alerts-management':
        return <AlertsManagement />;
      case 'rule-management':
        return <RulesManagement data={rules} isLoading={isLoading} />;
      case 'risk-analytics':
        return <RiskAnalyticsDashboard dateRange={dateRange} />;
      case 'audit-logs':
      case 'logs':
        return <SystemLogMonitor />;
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
          <TrendAnalysisPanel data={alertsSummary} isLoading={isLoading} />
        );
      case 'admin':
        return <SecureAdminDashboard initialTab="users" />;
      case 'user-management':
        return <SecureAdminDashboard initialTab="users" />;
      case 'onboarding':
        return <SecureAdminDashboard initialTab="onboarding" />;
      case 'permissions':
        return <SecureAdminDashboard initialTab="permissions" />;
      default:
        return (
          <div
            className={`rounded-2xl border p-8 min-h-[500px] backdrop-blur-xl ${
              theme === 'dark'
                ? 'bg-white/5 border-white/10'
                : 'bg-card border-theme'
            }`}
          >
            <div className="text-center py-20">
              <div
                className={`p-6 rounded-2xl inline-block mb-6 border ${
                  theme === 'dark'
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
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                {getViewTitle(activeView)}
              </h2>
              <p
                className={`max-w-md mx-auto ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-700'
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

  // Check if user is admin (role_id 0 or 1) - FIXED SETTINGS VISIBILITY
  const isAdmin = user?.role_id === 0 || user?.role_id === 1;

  // Show loading screen while dashboard is initializing
  if (dashboardLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950'
            : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className={`w-16 h-16 border-4 rounded-full mx-auto mb-6 ${
              theme === 'dark'
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
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Loading {appShortName}
            </h2>
            <p
              className={`${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              Initializing {appName} dashboard...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950'
          : 'bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50'
      }`}
    >
      {/* Enhanced Secure Sidebar */}
      <SecureSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activeView={activeView}
        onViewChange={handleViewChange}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Enhanced Modern Header */}
        <header
          className={`sticky top-0 z-30 backdrop-blur-xl border-b ${
            theme === 'dark'
              ? 'bg-black/20 border-white/10'
              : 'bg-white/80 border-theme'
          }`}
        >
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              {/* Left Section */}
              <div className="flex items-center gap-4">
                <button
                  id="menu-button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`p-2 rounded-xl transition-all duration-200 group ${
                    theme === 'dark'
                      ? 'hover:bg-white/10 text-white group-hover:text-blue-300'
                      : 'hover:bg-gray-100 text-gray-700 group-hover:text-blue-600'
                  }`}
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="hidden sm:flex flex-col">
                  <div className="flex items-center gap-3">
                    {/* <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div> */}
                    <h1
                      className={`text-xl font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {getViewTitle(activeView)}
                    </h1>
                  </div>
                  <span
                    className={`text-sm font-medium ml-5 ${
                      theme === 'dark' ? 'text-blue-200/80' : 'text-blue-600'
                    }`}
                  >
                    Welcome, {user?.full_name}
                  </span>
                </div>
              </div>

              {/* Right Section - Modern Controls */}
              <div className="flex items-center gap-3">
                {activeView !== 'admin' &&
                  activeView !== 'onboarding' &&
                  activeView !== 'permissions' && (
                    <>
                      <DateRangePicker
                        dateRange={dateRange}
                        onDateRangeChange={handleDateRangeChange}
                      />

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        disabled={!masterLiveEnabled}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border shadow-lg ${
                          !masterLiveEnabled
                            ? theme === 'dark'
                              ? 'bg-gray-500/20 text-gray-400 border-gray-500/30 cursor-not-allowed'
                              : 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed'
                            : autoRefresh
                              ? theme === 'dark'
                                ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-200 border-green-500/40 shadow-green-500/20'
                                : 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-green-300 shadow-green-200'
                              : theme === 'dark'
                                ? 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-300 border-gray-500/30 hover:from-gray-500/30 hover:to-slate-500/30'
                                : 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-600 border-gray-300 hover:from-gray-200 hover:to-slate-200'
                        }`}
                      >
                        {autoRefresh && masterLiveEnabled ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">
                          {!masterLiveEnabled
                            ? 'Live Disabled'
                            : autoRefresh
                              ? 'Live'
                              : 'Manual'}
                        </span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className={`p-2 rounded-xl border transition-all duration-200 shadow-lg ${
                          theme === 'dark'
                            ? 'bg-gradient-to-r from-blue-500/30 to-indigo-500/30 hover:from-blue-500/40 hover:to-indigo-500/40 text-blue-200 border-blue-500/40 shadow-blue-500/20'
                            : 'bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 text-blue-700 border-blue-300 shadow-blue-200'
                        }`}
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${
                            isLoading ? 'animate-spin' : ''
                          }`}
                        />
                      </motion.button>
                    </>
                  )}

                {/* Professional VitePress-style Theme Toggle */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                  <button
                    onClick={toggleTheme}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      theme === 'dark'
                        ? 'bg-blue-600 focus:ring-blue-500'
                        : 'bg-gray-300 focus:ring-gray-400'
                    }`}
                    title={`Switch to ${
                      theme === 'dark' ? 'light' : 'dark'
                    } theme`}
                    aria-label={`Switch to ${
                      theme === 'dark' ? 'light' : 'dark'
                    } theme`}
                  >
                    <motion.div
                      className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center ${
                        theme === 'dark'
                          ? 'left-6 bg-white'
                          : 'left-0.5 bg-white'
                      }`}
                      animate={{
                        x: theme === 'dark' ? 0 : 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 30,
                      }}
                    >
                      {theme === 'dark' ? (
                        <Moon className="w-3 h-3 text-blue-600" />
                      ) : (
                        <Sun className="w-3 h-3 text-yellow-500" />
                      )}
                    </motion.div>
                  </button>
                </motion.div>

                {/* Home Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleHomeClick}
                  className={`p-2 rounded-xl border transition-all duration-200 shadow-lg ${
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-blue-500/30 to-indigo-500/30 hover:from-blue-500/40 hover:to-indigo-500/40 text-blue-200 border-blue-500/40 shadow-blue-500/20'
                      : 'bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 text-blue-700 border-blue-300 shadow-blue-200'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  {/* <span className="hidden sm:inline text-sm font-medium">Home</span> */}
                </motion.button>

                {/* FIXED: Settings button visibility for admin users */}
                {isAdmin && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsSettingsOpen(true)}
                    className={`p-2 rounded-xl border transition-all duration-200 shadow-lg ${
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 hover:from-purple-500/40 hover:to-pink-500/40 text-purple-200 border-purple-500/40 shadow-purple-500/20'
                        : 'bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 text-purple-700 border-purple-300 shadow-purple-200'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className={`p-2 rounded-xl border transition-all duration-200 shadow-lg ${
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-red-500/20 to-rose-500/20 hover:from-red-500/30 hover:to-rose-500/30 text-red-200 border-red-500/40 shadow-red-500/20'
                      : 'bg-gradient-to-r from-red-100 to-rose-100 hover:from-red-200 hover:to-rose-200 text-red-700 border-red-300 shadow-red-200'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  {/* <span className="hidden sm:inline font-medium">Logout</span> */}
                </motion.button>
              </div>
            </div>

            {/* Enhanced Status Bar */}
            <div
              className={`flex justify-end items-center mt-2 pt-2 border-t ${
                theme === 'dark' ? 'border-white/5' : 'border-theme'
              }`}
            >
              <div
                className={`flex items-center gap-6 text-xs ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-blue-400" />
                  <span className="font-medium">Secure System Active</span>
                </div>
                {autoRefresh &&
                  activeView !== 'admin' &&
                  activeView !== 'onboarding' &&
                  activeView !== 'permissions' &&
                  activeView !== 'risk-analytics' &&
                  masterLiveEnabled && (
                    <div className="flex items-center gap-2 text-green-400">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="font-medium">Real-time Updates</span>
                    </div>
                  )}
                {lastUpdated &&
                  activeView !== 'admin' &&
                  activeView !== 'onboarding' &&
                  activeView !== 'permissions' &&
                  activeView !== 'risk-analytics' && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
                    </div>
                  )}
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-3 backdrop-blur-xl border rounded-xl p-3 ${
                  theme === 'dark'
                    ? 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/30'
                    : 'bg-gradient-to-r from-red-100 to-rose-100 border-red-300'
                }`}
              >
                <div
                  className={`flex items-center gap-3 ${
                    theme === 'dark' ? 'text-red-200' : 'text-red-700'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium text-sm">{error}</span>
                </div>
              </motion.div>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {/* Statistics Cards - Only show for non-admin views */}
          {/* {(activeView === 'dashboard' || activeView === 'overview') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
            >
              <StatisticCard
                title="Total Alerts"
                value={totalAlerts}
                icon={<BarChart3 />}
                color="bg-gradient-to-br from-blue-500 to-blue-600"
                trend="+12%"
                subtitle="Active security events"
                isActive={activeView === 'dashboard' || activeView === 'overview'}
                onClick={() => handleViewChange('dashboard')}
                isLoading={isLoading}
              />
              <StatisticCard
                title="High Risk"
                value={highRiskAlerts.length}
                icon={<AlertTriangle />}
                color="bg-gradient-to-br from-red-500 to-red-600"
                trend="-5%"
                subtitle="Critical alerts requiring attention"
                isActive={activeView === 'rules'}
                onClick={() => handleViewChange('rules')}
                isLoading={isLoading}
              />
              <StatisticCard
                title="Active Users"
                value={totalUsers}
                icon={<Users />}
                color="bg-gradient-to-br from-green-500 to-green-600"
                trend="+3%"
                subtitle="Users with recent activity"
                isActive={activeView === 'users'}
                onClick={() => handleViewChange('users')}
                isLoading={isLoading}
              />
              <StatisticCard
                title="Branches"
                value={totalBranches}
                icon={<Building />}
                color="bg-gradient-to-br from-orange-500 to-orange-600"
                trend="+8%"
                subtitle="Monitored locations"
                isActive={activeView === 'branches'}
                onClick={() => handleViewChange('branches')}
                isLoading={isLoading}
              />
            </motion.div>
          )} */}

          {/* Content Area */}
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </main>

        <footer
          className={`py-3 mt-8 backdrop-blur-xl border-t ${
            theme === 'dark'
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

      {/* FIXED: Settings modal visibility for admin users */}
      {isAdmin && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          user={user}
          masterLiveEnabled={masterLiveEnabled}
          onMasterLiveChange={setMasterLiveEnabled}
        />
      )}
    </div>
  );
};

export default Dashboard;
