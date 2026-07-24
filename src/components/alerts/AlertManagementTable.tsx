import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Clock,
  User,
  Building,
  CreditCard,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Calendar,
  ArrowUpDown,
  MoreVertical,
  X,
  Trash2,
  Edit,
  MessageSquare,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import { useNotifications } from '../notifications';
import PermissionGuard from '../PermissionGuard';
import { Shield } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import { exportAlertsToExcel } from '../../utils/excelExport';
import { logger } from '../../utils/logger';
import { useAuth } from '../../context/AuthContext';
import AlertDetailsModal from './AlertDetailsModal';
import AlertDispositionModal from './AlertDispositionModal';
import AlertFiltersPanel from './AlertFiltersPanel';

interface AlertSummary {
  alert_id: string;
  time_stamp: string;
  service_type: string;
  cust_code: string;
  cust_name: string;
  rule_id: string;
  rule_desc: string;
  rule_remarks: string;
  rule_priority?: string;
  status?: string;
}

interface AlertFilters {
  search: string;
  service_type: string[];
  rule_id: string[];
  status: string[];
  priority: string[];
  date_range: {
    from: string;
    to: string;
  };
  assigned_to: string[];
  branch_name: string[];
  cust_nationality: string[];
}

const AlertManagementTable: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<AlertSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<string>('time_stamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [selectedAlertForDisposition, setSelectedAlertForDisposition] =
    useState<AlertSummary | null>(null);
  const [selectedAlertDetails, setSelectedAlertDetails] = useState<
    any[] | null
  >(null);
  const [filters, setFilters] = useState<AlertFilters>({
    search: '',
    service_type: [],
    rule_id: [],
    status: [],
    priority: [],
    date_range: { from: '', to: '' },
    assigned_to: [],
    branch_name: [],
    cust_nationality: [],
  });

  const { theme } = useTheme();
  const { getMenuId } = useMenuIds();
  const { addNotification } = useNotifications();
  const { user } = useAuth();

  // Get menu IDs for permission checks
  const ALERTS_MANAGEMENT_MENU_ID = getMenuId('alerts_management');
  const ALERTS_EXPORT_MENU_ID = getMenuId('alerts_export');

  // const fetchAlerts = useCallback(async () => {
  //   try {
  //     setLoading(true);
  //     setError(null);

  //     const response = await fetch('http://127.0.0.1:8000/open-alerts-summary');

  //     if (!response.ok) {
  //       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  //     }

  //     const data: AlertSummary[] = await response.json();
  //     setAlerts(data);

  //     // Log the successful fetch
  //     logger.info(
  //       'Alerts data fetched successfully',
  //       user?.full_name,
  //       { count: data.length }
  //     );
  //   } catch (err) {
  //     const errorMessage = err instanceof Error ? err.message : 'Failed to fetch alerts';
  //     setError(errorMessage);
  //     console.error('Error fetching alerts:', err);

  //     // Log the error
  //     logger.error(
  //       'Failed to fetch alerts data',
  //       user?.full_name,
  //       { error: errorMessage },
  //       err instanceof Error ? err : new Error(errorMessage)
  //     );

  //     // Show notification
  //     addNotification('Failed to load alerts data', 'error');
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [addNotification, user?.full_name]);

  // const fetchAlertDetails = useCallback(
  //   async (alertId: string) => {
  //     try {
  //       setLoading(true);
  //       setError(null);

  //       const response = await fetch(
  //         'http://127.0.0.1:8000/open-alerts-details',
  //         {
  //           method: 'POST',
  //           headers: {
  //             'Content-Type': 'application/json',
  //           },
  //           body: JSON.stringify({ alert_id: alertId }),
  //         }
  //       );

  //       if (!response.ok) {
  //         throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  //       }

  //       const data = await response.json();
  //       setSelectedAlertDetails(data);

  //       // Log the successful fetch
  //       logger.info(
  //         `Alert details fetched for ID: ${alertId}`,
  //         user?.full_name,
  //         { alertId }
  //       );
  //     } catch (err) {
  //       const errorMessage =
  //         err instanceof Error ? err.message : 'Failed to fetch alert details';
  //       setError(errorMessage);
  //       console.error('Error fetching alert details:', err);

  //       // Log the error
  //       logger.error(
  //         'Failed to fetch alert details',
  //         user?.full_name,
  //         { alertId, error: errorMessage },
  //         err instanceof Error ? err : new Error(errorMessage)
  //       );

  //       // Show notification
  //       addNotification('Failed to load alert details', 'error');
  //     } finally {
  //       setLoading(false);
  //     }
  //   },
  //   [addNotification, user?.full_name]
  // );

  const handleViewDetails = async (alert: AlertSummary) => {
    setSelectedAlertId(alert.alert_id);
    // await fetchAlertDetails(alert.alert_id);
    //setShowDetailsModal(true);
  };

  const handleDisposeAlert = (alert: AlertSummary) => {
    setSelectedAlertForDisposition(alert);
    setShowDispositionModal(true);
  };

  const handleDisposition = async (disposition: any) => {
    try {
      // In a real implementation, this would call an API
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Show success notification
      addNotification('Alert disposition saved successfully', 'success');

      // Log the disposition
      logger.info(
        `Alert disposition saved for ID: ${disposition.alert_id}`,
        user?.full_name,
        {
          alertId: disposition.alert_id,
          dispositionType: disposition.disposition_type,
          riskCategory: disposition.risk_category,
        }
      );

      // Update local state to reflect the change
      setAlerts((prev) =>
        prev.filter((a) => a.alert_id !== disposition.alert_id)
      );

      return true;
    } catch (error) {
      console.error('Error saving disposition:', error);
      addNotification('Failed to save disposition', 'error');

      // Log the error
      logger.error(
        'Failed to save alert disposition',
        user?.full_name,
        { alertId: disposition.alert_id, error },
        error instanceof Error ? error : new Error('Disposition save failed')
      );

      return false;
    }
  };

  const handleExportToExcel = async () => {
    try {
      addNotification('Preparing Excel export...', 'info');

      // Log the export request
      logger.info('Alert data export requested', user?.full_name, {
        count: filteredAlerts.length,
        filters,
      });

      // Export the data
      await exportAlertsToExcel(
        filteredAlerts,
        filters,
        `Alert_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      );

      addNotification('Alerts exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      addNotification('Failed to export alerts', 'error');

      // Log the error
      logger.error(
        'Failed to export alerts',
        user?.full_name,
        { error },
        error instanceof Error ? error : new Error('Export failed')
      );
    }
  };

  const handleFiltersChange = (newFilters: Partial<AlertFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Apply filters and sorting
  useEffect(() => {
    let result = [...alerts];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (alert) =>
          alert.cust_name.toLowerCase().includes(searchLower) ||
          alert.cust_code.toLowerCase().includes(searchLower) ||
          alert.rule_id.toLowerCase().includes(searchLower) ||
          alert.rule_desc.toLowerCase().includes(searchLower)
      );
    }

    // Apply service type filter
    if (filters.service_type.length > 0) {
      result = result.filter((alert) =>
        filters.service_type.includes(alert.service_type)
      );
    }

    // Apply rule ID filter
    if (filters.rule_id.length > 0) {
      result = result.filter((alert) =>
        filters.rule_id.includes(alert.rule_id)
      );
    }

    // Apply status filter
    if (filters.status.length > 0) {
      result = result.filter((alert) =>
        filters.status.includes(alert.status || 'OPEN')
      );
    }

    // Apply priority filter
    if (filters.priority.length > 0) {
      result = result.filter((alert) =>
        filters.priority.includes(alert.rule_priority || 'MEDIUM')
      );
    }

    // Apply date range filter
    if (filters.date_range.from && filters.date_range.to) {
      const fromDate = new Date(filters.date_range.from);
      const toDate = new Date(filters.date_range.to);
      toDate.setHours(23, 59, 59, 999); // End of day

      result = result.filter((alert) => {
        const alertDate = new Date(alert.time_stamp);
        return alertDate >= fromDate && alertDate <= toDate;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let valA, valB;

      switch (sortField) {
        case 'time_stamp':
          valA = new Date(a.time_stamp).getTime();
          valB = new Date(b.time_stamp).getTime();
          break;
        case 'cust_name':
          valA = a.cust_name;
          valB = b.cust_name;
          break;
        case 'rule_id':
          valA = a.rule_id;
          valB = b.rule_id;
          break;
        default:
          valA = a[sortField as keyof AlertSummary];
          valB = b[sortField as keyof AlertSummary];
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredAlerts(result);

    // Calculate total pages
    setTotalPages(Math.max(1, Math.ceil(result.length / itemsPerPage)));

    // Adjust current page if needed
    if (currentPage > Math.ceil(result.length / itemsPerPage)) {
      setCurrentPage(Math.max(1, Math.ceil(result.length / itemsPerPage)));
    }
  }, [alerts, filters, sortField, sortDirection, itemsPerPage, currentPage]);

  // Initial data fetch
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Get current page of alerts
  const currentAlerts = filteredAlerts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getRiskBadge = (ruleId: string, rulePriority?: string) => {
    // Use rule_priority if available, otherwise determine from rule_id
    let level = rulePriority || 'MEDIUM';

    // Fallback logic based on rule_id if priority not provided
    if (!rulePriority) {
      if (ruleId.includes('RF-012')) level = 'HIGH';
      else if (ruleId.includes('RF-005')) level = 'MEDIUM';
      else level = 'LOW';
    }

    const color =
      level === 'HIGH'
        ? theme === 'dark'
          ? 'bg-red-500/20 text-red-300 border-red-500/30'
          : 'bg-red-100 text-red-700 border-red-300'
        : level === 'MEDIUM'
          ? theme === 'dark'
            ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
            : 'bg-orange-100 text-orange-700 border-orange-300'
          : theme === 'dark'
            ? 'bg-green-500/20 text-green-300 border-green-500/30'
            : 'bg-green-100 text-green-700 border-green-300';

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full border ${color}`}
      >
        {level}
      </span>
    );
  };

  const getServiceTypeIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'OUTWARD':
        return <CreditCard className="w-4 h-4" />;
      case 'INWARD':
        return <Building className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    const actualStatus = status || 'OPEN';

    let color;
    switch (actualStatus) {
      case 'CLOSED':
        color =
          theme === 'dark'
            ? 'bg-green-500/20 text-green-300 border-green-500/30'
            : 'bg-green-100 text-green-700 border-green-300';
        break;
      case 'IN_PROGRESS':
        color =
          theme === 'dark'
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
            : 'bg-blue-100 text-blue-700 border-blue-300';
        break;
      default:
        color =
          theme === 'dark'
            ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
            : 'bg-yellow-100 text-yellow-700 border-yellow-300';
    }

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full border ${color}`}
      >
        {actualStatus}
      </span>
    );
  };

  return (
    <PermissionGuard
      menuId={ALERTS_MANAGEMENT_MENU_ID}
      action="view"
      fallback={
        <div
          className={`text-center py-20 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">
            You don't have permission to view alerts management.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Fraud & Risk Alerts
              </h1>
              <p
                className={`${
                  theme === 'dark' ? 'text-red-200/70' : 'text-red-600'
                }`}
              >
                Alert disposition and case management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showFilters
                  ? theme === 'dark'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-blue-100 text-blue-700 border border-blue-300'
                  : theme === 'dark'
                    ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchAlerts}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }`}
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </motion.button>

            <PermissionGuard
              menuId={ALERTS_EXPORT_MENU_ID}
              action="export"
              fallback={
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    addNotification(
                      "You don't have permission to export alerts",
                      'warning'
                    )
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors opacity-50 ${
                    theme === 'dark'
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-green-100 text-green-700 border border-green-300'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Export
                </motion.button>
              }
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleExportToExcel}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                    : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                }`}
              >
                <Download className="w-4 h-4" />
                Export
              </motion.button>
            </PermissionGuard>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`p-6 rounded-2xl border ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-red-500/15 to-red-500/5 border-red-500/20'
                : 'bg-gradient-to-br from-red-50 to-red-25 border-red-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div
              className={`text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {formatNumber(alerts.length)}
            </div>
            <div
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-red-300' : 'text-red-700'
              }`}
            >
              Total Alerts
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`p-6 rounded-2xl border ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-orange-500/15 to-orange-500/5 border-orange-500/20'
                : 'bg-gradient-to-br from-orange-50 to-orange-25 border-orange-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
            <div
              className={`text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {formatNumber(new Set(alerts.map((a) => a.cust_code)).size)}
            </div>
            <div
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
              }`}
            >
              Unique Customers
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`p-6 rounded-2xl border ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-blue-500/15 to-blue-500/5 border-blue-500/20'
                : 'bg-gradient-to-br from-blue-50 to-blue-25 border-blue-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <Building className="w-6 h-6 text-white" />
              </div>
            </div>
            <div
              className={`text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {formatNumber(new Set(alerts.map((a) => a.service_type)).size)}
            </div>
            <div
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
              }`}
            >
              Service Types
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`p-6 rounded-2xl border ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-green-500/15 to-green-500/5 border-green-500/20'
                : 'bg-gradient-to-br from-green-50 to-green-25 border-green-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
            <div
              className={`text-3xl font-bold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              {new Date().toLocaleDateString()}
            </div>
            <div
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-green-300' : 'text-green-700'
              }`}
            >
              Last Updated
            </div>
          </motion.div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <AlertFiltersPanel
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClose={() => setShowFilters(false)}
            />
          )}
        </AnimatePresence>

        {/* Alerts Table */}
        <div
          className={`rounded-2xl border overflow-hidden ${
            theme === 'dark'
              ? 'bg-white/5 border-white/20'
              : 'bg-white border-gray-200'
          } backdrop-blur-xl shadow-2xl`}
        >
          <div
            className={`p-6 border-b ${
              theme === 'dark' ? 'border-white/20' : 'border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center">
              <h2
                className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Alert Management
              </h2>
              <div
                className={`text-sm ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}
              >
                Showing{' '}
                {filteredAlerts.length > 0
                  ? (currentPage - 1) * itemsPerPage + 1
                  : 0}{' '}
                to {Math.min(currentPage * itemsPerPage, filteredAlerts.length)}{' '}
                of {filteredAlerts.length} alerts
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4">
                <Loader2
                  className={`h-12 w-12 animate-spin ${
                    theme === 'dark' ? 'text-red-400' : 'text-red-600'
                  }`}
                />
                <span
                  className={
                    theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                  }
                >
                  Loading alerts...
                </span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p
                  className={`text-lg font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Failed to load alerts
                </p>
                <p
                  className={`text-sm ${
                    theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                  }`}
                >
                  {error}
                </p>
              </div>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p
                  className={`text-lg font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  No alerts found
                </p>
                <p
                  className={`text-sm ${
                    theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                  }`}
                >
                  All alerts have been processed or no alerts match your filters
                </p>
                {Object.values(filters).some((v) =>
                  Array.isArray(v)
                    ? v.length > 0
                    : typeof v === 'object'
                      ? Object.values(v).some((x) => x)
                      : v
                ) && (
                  <button
                    onClick={() => {
                      setFilters({
                        search: '',
                        service_type: [],
                        rule_id: [],
                        status: [],
                        priority: [],
                        date_range: { from: '', to: '' },
                        assigned_to: [],
                        branch_name: [],
                        cust_nationality: [],
                      });
                    }}
                    className={`mt-4 px-4 py-2 rounded-lg ${
                      theme === 'dark'
                        ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    }`}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead
                  className={`border-b ${
                    theme === 'dark'
                      ? 'border-white/20 bg-white/5'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <tr>
                    <th
                      className={`px-6 py-4 text-left font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleSort('alert_id')}
                      >
                        Alert ID
                        {sortField === 'alert_id' && (
                          <ArrowUpDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th
                      className={`px-6 py-4 text-left font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleSort('cust_name')}
                      >
                        Customer
                        {sortField === 'cust_name' && (
                          <ArrowUpDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th
                      className={`px-6 py-4 text-left font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleSort('rule_id')}
                      >
                        Rule
                        {sortField === 'rule_id' && (
                          <ArrowUpDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th
                      className={`px-6 py-4 text-left font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      Risk Level
                    </th>
                    <th
                      className={`px-6 py-4 text-left font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleSort('time_stamp')}
                      >
                        Date
                        {sortField === 'time_stamp' && (
                          <ArrowUpDown className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th
                      className={`px-6 py-4 text-left font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      Status
                    </th>
                    <th
                      className={`px-6 py-4 text-right font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentAlerts.map((alert, index) => (
                    <motion.tr
                      key={alert.alert_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`border-b transition-colors ${
                        theme === 'dark'
                          ? 'border-white/10 hover:bg-white/5'
                          : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
                            }`}
                          >
                            {getServiceTypeIcon(alert.service_type)}
                          </div>
                          <div>
                            <div
                              className={`font-medium ${
                                theme === 'dark'
                                  ? 'text-white'
                                  : 'text-gray-900'
                              }`}
                            >
                              {alert.service_type}
                            </div>
                            <div
                              className={`text-sm ${
                                theme === 'dark'
                                  ? 'text-white/60'
                                  : 'text-gray-600'
                              }`}
                            >
                              ID: {alert.alert_id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div>
                          <div
                            className={`font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {alert.cust_name}
                          </div>
                          <div
                            className={`text-sm ${
                              theme === 'dark'
                                ? 'text-white/60'
                                : 'text-gray-600'
                            }`}
                          >
                            Code: {alert.cust_code}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div>
                          <div
                            className={`font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            {alert.rule_id}
                          </div>
                          <div
                            className={`text-sm ${
                              theme === 'dark'
                                ? 'text-white/60'
                                : 'text-gray-600'
                            }`}
                          >
                            {alert.rule_desc.length > 50
                              ? `${alert.rule_desc.slice(0, 50)}...`
                              : alert.rule_desc}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {getRiskBadge(alert.rule_id, alert.rule_priority)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div
                            className={`text-sm ${
                              theme === 'dark'
                                ? 'text-white/80'
                                : 'text-gray-700'
                            }`}
                          >
                            {new Date(alert.time_stamp).toLocaleDateString()}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {getStatusBadge(alert.status)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <PermissionGuard
                            menuId={ALERTS_MANAGEMENT_MENU_ID}
                            action="view"
                          >
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleViewDetails(alert)}
                              className={`p-2 rounded-lg transition-colors ${
                                theme === 'dark'
                                  ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                                  : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                              }`}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </motion.button>
                          </PermissionGuard>

                          <PermissionGuard
                            menuId={ALERTS_MANAGEMENT_MENU_ID}
                            action="edit"
                            fallback={null}
                          >
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDisposeAlert(alert)}
                              className={`p-2 rounded-lg transition-colors ${
                                theme === 'dark'
                                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
                                  : 'bg-green-100 hover:bg-green-200 text-green-700'
                              }`}
                              title="Dispose Alert"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </motion.button>
                          </PermissionGuard>

                          <div className="relative">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() =>
                                setSelectedAlertId(
                                  selectedAlertId === alert.alert_id
                                    ? null
                                    : alert.alert_id
                                )
                              }
                              className={`p-2 rounded-lg transition-colors ${
                                theme === 'dark'
                                  ? 'bg-white/10 hover:bg-white/20 text-white/70'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              }`}
                              title="More Options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </motion.button>

                            <AnimatePresence>
                              {selectedAlertId === alert.alert_id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                  className={`absolute right-0 top-full mt-1 w-48 rounded-lg shadow-xl z-10 border ${
                                    theme === 'dark'
                                      ? 'bg-slate-800/95 border-white/20'
                                      : 'bg-white border-gray-200'
                                  } backdrop-blur-xl`}
                                >
                                  <div className="py-1">
                                    <PermissionGuard
                                      menuId={ALERTS_MANAGEMENT_MENU_ID}
                                      action="edit"
                                    >
                                      <button
                                        onClick={() => {
                                          setSelectedAlertId(null);
                                          // Add comment functionality here
                                          addNotification(
                                            'Comment feature coming soon',
                                            'info'
                                          );
                                        }}
                                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                                          theme === 'dark'
                                            ? 'text-white/80 hover:bg-white/10'
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                        Add Comment
                                      </button>
                                    </PermissionGuard>

                                    <PermissionGuard
                                      menuId={ALERTS_MANAGEMENT_MENU_ID}
                                      action="delete"
                                    >
                                      <button
                                        onClick={() => {
                                          setSelectedAlertId(null);
                                          // Delete functionality here
                                          addNotification(
                                            'Delete feature coming soon',
                                            'info'
                                          );
                                        }}
                                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                                          theme === 'dark'
                                            ? 'text-red-300 hover:bg-red-500/10'
                                            : 'text-red-600 hover:bg-red-100'
                                        }`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        Delete Alert
                                      </button>
                                    </PermissionGuard>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className={`flex justify-between items-center px-6 py-4 border-t ${
                theme === 'dark' ? 'border-white/20' : 'border-gray-200'
              }`}
            >
              <div
                className={`text-sm ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}
              >
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    currentPage === 1
                      ? 'opacity-50 cursor-not-allowed'
                      : theme === 'dark'
                        ? 'bg-white/10 hover:bg-white/20 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    currentPage === totalPages
                      ? 'opacity-50 cursor-not-allowed'
                      : theme === 'dark'
                        ? 'bg-white/10 hover:bg-white/20 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <AlertDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          alertDetails={selectedAlertDetails}
          alertId={selectedAlertId}
          loading={loading}
        />

        <AlertDispositionModal
          isOpen={showDispositionModal}
          onClose={() => setShowDispositionModal(false)}
          alert={selectedAlertForDisposition}
          onDispose={handleDisposition}
        />
      </div>
    </PermissionGuard>
  );
};

export default AlertManagementTable;
