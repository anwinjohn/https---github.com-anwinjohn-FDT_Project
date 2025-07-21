import React, { useState } from 'react';
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
  Shield,
  TrendingUp,
  BarChart3,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useMenuIds } from '../../hooks/useMenuIds';
import { useNotifications } from '../notifications';
import { useAlerts } from '../../hooks/useAlerts';
import PermissionGuard from '../PermissionGuard';
import { AlertSummary } from '../../types/alerts';
import AlertDetailsModal from './AlertDetailsModal';
import AlertFiltersPanel from './AlertFiltersPanel';
import AlertDispositionModal from './AlertDispositionModal';
import { formatNumber } from '../../utils/formatters';

const AlertsManagement: React.FC = () => {
  const { theme } = useTheme();
  const { getMenuId } = useMenuIds();
  const { addNotification } = useNotifications();

  // Use the useAlerts hook instead of managing state directly
  const {
    alerts,
    selectedAlert,
    loading,
    error,
    totalCount,
    totalOpenAlerts,
    totalHighPriorityAlerts,
    currentPage,
    totalPages,
    hasNext,
    hasPrev,
    pageSize,
    filters,
    filterOptions,
    fetchAlerts,
    fetchAlertDetails,
    disposeAlert,
    updateFilters,
    setPage,
    setPageSize,
    refreshAlerts
  } = useAlerts(20);

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [selectedAlertForDisposition, setSelectedAlertForDisposition] = useState<AlertSummary | null>(null);

  // Get menu IDs for permission checks
  const ALERTS_MANAGEMENT_MENU_ID = getMenuId('alerts_management');

  // Clear filters on initial load
  React.useEffect(() => {
    updateFilters({
      search: '',
      service_type: [],
      rule_id: [],
      status: [],
      priority: [],
      date_range: { from: '', to: '' },
      assigned_to: [],
      branch_name: [],
      cust_nationality: []
    });
  }, []);

  const handleViewDetails = async (alert: AlertSummary) => {
    setSelectedAlertId(alert.alert_id);
    await fetchAlertDetails(alert.alert_id);
    setShowDetailsModal(true);
  };

  const handleDisposeAlert = (alert: AlertSummary) => {
    setSelectedAlertForDisposition(alert);
    setShowDispositionModal(true);
  };

  const handleExportToExcel = () => {
    // In a real implementation, this would call an API to generate and download an Excel file
    addNotification('Exporting alerts to Excel...', 'info');

    // Simulate export delay
    setTimeout(() => {
      addNotification('Alerts exported successfully', 'success');
    }, 1500);
  };

  const getRiskBadge = (rule_priority: string) => {
    const priority = rule_priority?.toUpperCase() || 'LOW';
    switch (priority) {
      case 'HIGH':
      case 'CRITICAL':
        return { level: 'HIGH', color: 'bg-red-500/20 text-red-300 border-red-500/30' };
      case 'MEDIUM':
      case 'MODERATE':
        return { level: 'MEDIUM', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' };
      case 'LOW':
      default:
        return { level: 'LOW', color: 'bg-green-500/20 text-green-300 border-green-500/30' };
    }
  };

  const getServiceTypeIcon = (serviceType: string) => {
    const type = serviceType?.toUpperCase() || '';
    
    switch (type) {
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

  const stats = [
    {
      title: 'Total Alerts',
      value: totalOpenAlerts,
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bgColor: theme === 'dark' ? 'from-red-500/20 to-red-500/10' : 'from-red-100 to-red-50'
    },
    {
      title: 'High Priority',
      value: totalHighPriorityAlerts,
      icon: Shield,
      color: 'from-orange-500 to-orange-600',
      bgColor: theme === 'dark' ? 'from-orange-500/20 to-orange-500/10' : 'from-orange-100 to-orange-50'
    },
    {
      title: 'Pending Review',
      value: alerts.length,
      icon: Clock,
      color: 'from-blue-500 to-blue-600',
      bgColor: theme === 'dark' ? 'from-blue-500/20 to-blue-500/10' : 'from-blue-100 to-blue-50'
    },
    {
      title: 'Unique Customers',
      value: new Set(alerts.map(a => a.cust_code)).size,
      icon: User,
      color: 'from-green-500 to-green-600',
      bgColor: theme === 'dark' ? 'from-green-500/20 to-green-500/10' : 'from-green-100 to-green-50'
    }
  ];

  return (
    <PermissionGuard
      menuId={ALERTS_MANAGEMENT_MENU_ID}
      action="view"
      fallback={
        <div className={`text-center py-20 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view alerts management.</p>
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
              <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Fraud & Risk Alerts</h1>
              <p className={`${theme === 'dark' ? 'text-red-200/70' : 'text-red-600'
                }`}>Alert disposition and case management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${showFilters
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : theme === 'dark'
                    ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
            >
              <div className="relative">
                <Filter className="w-4 h-4" />
                {(() => {
                  const activeCount = [
                    filters.search,
                    filters.service_type.length > 0,
                    filters.rule_id.length > 0,
                    filters.status.length > 0,
                    filters.priority.length > 0,
                    filters.assigned_to.length > 0,
                    filters.branch_name.length > 0,
                    filters.cust_nationality.length > 0,
                    filters.date_range.from || filters.date_range.to
                  ].filter(Boolean).length;

                  return activeCount > 0 ? (
                    <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {activeCount > 9 ? '9+' : activeCount}
                    </span>
                  ) : null;
                })()}
              </div>
              Filters
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={refreshAlerts}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${theme === 'dark'
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </motion.button>

            <PermissionGuard
              menuId={ALERTS_MANAGEMENT_MENU_ID}
              action="export"
              fallback={
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => addNotification("You don't have permission to export alerts", "warning")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors opacity-50 ${theme === 'dark'
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
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${theme === 'dark'
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
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-6 rounded-2xl border backdrop-blur-xl ${theme === 'dark'
                  ? `bg-gradient-to-br ${stat.bgColor} border-white/10`
                  : `bg-gradient-to-br ${stat.bgColor} border-gray-200`
                }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                {formatNumber(stat.value)}
              </div>
              <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>
                {stat.title}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <AlertFiltersPanel
              filters={filters}
              filterOptions={filterOptions}
              onFiltersChange={updateFilters}
              onClose={() => setShowFilters(false)}
            />
          )}
        </AnimatePresence>

        {/* Alerts Table */}
        <div className={`rounded-2xl border overflow-hidden ${theme === 'dark'
            ? 'bg-white/5 border-white/20'
            : 'bg-white border-gray-200'
          } backdrop-blur-xl shadow-2xl`}>
          <div className={`p-6 border-b ${theme === 'dark' ? 'border-white/20' : 'border-gray-200'
            }`}>
            <div className="flex justify-between items-center">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Open Alerts</h2>
              <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>
                Showing {alerts.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} alerts
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
                <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>Loading alerts...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className={`text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Failed to load alerts
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                  {error}
                </p>
              </div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className={`text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  No alerts found
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                  All alerts have been processed or no alerts match your filters
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${theme === 'dark' ? 'border-white/20 bg-white/5' : 'border-gray-200 bg-gray-50'
                  }`}>
                  <tr>
                    <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Alert Details</th>
                    <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Customer</th>
                    <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Rule</th>
                    <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Risk Level</th>
                    <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Date</th>
                    <th className={`px-6 py-4 text-right font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert, index) => {
                    const riskBadge = getRiskBadge(alert.rule_priority);
                    return (
                      <motion.tr
                        key={alert.alert_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`border-b transition-colors hover:scale-[1.01] ${theme === 'dark'
                            ? 'border-white/10 hover:bg-white/5'
                            : 'border-gray-100 hover:bg-gray-50'
                          }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
                              }`}>
                              {getServiceTypeIcon(alert.service_type)}
                            </div>
                            <div>
                              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                {alert.service_type}
                              </div>
                              <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                }`}>
                                ID: {alert.alert_id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div>
                            <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>
                              {alert.cust_name}
                            </div>
                            <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                              }`}>
                              Code: {alert.cust_code}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div>
                            <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>
                              {alert.rule_id}
                            </div>
                            <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                              }`}>
                              {alert.rule_desc.length > 50
                                ? `${alert.rule_desc.slice(0, 50)}...`
                                : alert.rule_desc
                              }
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full border ${riskBadge.color}`}>
                            {riskBadge.level}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className={`text-sm ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                            }`}>
                            {new Date(alert.time_stamp).toLocaleDateString()}
                          </div>
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
                                className={`p-2 rounded-lg transition-colors ${theme === 'dark'
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
                                className={`p-2 rounded-lg transition-colors ${theme === 'dark'
                                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
                                    : 'bg-green-100 hover:bg-green-200 text-green-700'
                                  }`}
                                title="Dispose Alert"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </motion.button>
                            </PermissionGuard>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={`flex justify-between items-center px-6 py-4 border-t ${theme === 'dark' ? 'border-white/20' : 'border-gray-200'
              }`}>
              <div className="flex items-center gap-2">
                <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                  }`}>
                  Page {currentPage} of {totalPages}
                </div>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className={`ml-4 px-2 py-1 rounded-lg text-sm ${theme === 'dark'
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'bg-white text-gray-700 border border-gray-300'
                    }`}
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPage(currentPage - 1)}
                  disabled={!hasPrev}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${!hasPrev
                      ? 'opacity-50 cursor-not-allowed'
                      : theme === 'dark'
                        ? 'bg-white/10 hover:bg-white/20 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </motion.button>

                <div className="hidden md:flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show pages around current page
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
                      <motion.button
                        key={pageToShow}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setPage(pageToShow)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${currentPage === pageToShow
                            ? theme === 'dark'
                              ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                              : 'bg-blue-100 text-blue-700 border border-blue-300'
                            : theme === 'dark'
                              ? 'bg-white/10 hover:bg-white/20 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                      >
                        {pageToShow}
                      </motion.button>
                    );
                  })}

                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className={theme === 'dark' ? 'text-white/50' : 'text-gray-500'}>...</span>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setPage(totalPages)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${theme === 'dark'
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                      >
                        {totalPages}
                      </motion.button>
                    </>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPage(currentPage + 1)}
                  disabled={!hasNext}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${!hasNext
                      ? 'opacity-50 cursor-not-allowed'
                      : theme === 'dark'
                        ? 'bg-white/10 hover:bg-white/20 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                >
                  <span className="hidden sm:inline">Next</span>
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
          alertDetails={selectedAlert}
          alertId={selectedAlertId}
          loading={loading}
        />

        <AlertDispositionModal
          isOpen={showDispositionModal}
          onClose={() => setShowDispositionModal(false)}
          alert={selectedAlertForDisposition}
          onDispose={disposeAlert}
        />
      </div>
    </PermissionGuard>
  );
};

export default AlertsManagement;