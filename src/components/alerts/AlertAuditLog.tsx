import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  User, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw, 
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Flag,
  ArrowUpRight,
  Calendar,
  Shield
} from 'lucide-react';
import { AlertAuditLog } from '../../types/alerts';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';

interface AlertAuditLogProps {
  alertId?: string;
}

const AlertAuditLogComponent: React.FC<AlertAuditLogProps> = ({ alertId }) => {
  const { theme } = useTheme();
  const { getMenuId } = useMenuIds();
  const [logs, setLogs] = useState<AlertAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Get menu ID for permission check
  const AUDIT_LOGS_MENU_ID = getMenuId('audit_logs');

  useEffect(() => {
    fetchLogs();
  }, [alertId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would call the API
      // const response = await apiClient.get(`/api/alerts/${alertId}/audit-logs`);
      
      // For now, we'll use mock data
      const mockLogs: AlertAuditLog[] = [
        {
          id: '1',
          alert_id: alertId || '53529D64-BB1A-4138-B5F6-A0AB81F03475',
          action: 'VIEWED',
          performed_by: 'John Doe',
          timestamp: new Date().toISOString(),
          details: { ip_address: '192.168.1.1' }
        },
        {
          id: '2',
          alert_id: alertId || '53529D64-BB1A-4138-B5F6-A0AB81F03475',
          action: 'DISPOSITION_UPDATED',
          performed_by: 'Jane Smith',
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          details: { 
            old_status: 'OPEN', 
            new_status: 'IN_PROGRESS',
            disposition_type: 'TRUE_POSITIVE',
            risk_category: 'HIGH'
          }
        },
        {
          id: '3',
          alert_id: alertId || '53529D64-BB1A-4138-B5F6-A0AB81F03475',
          action: 'COMMENT_ADDED',
          performed_by: 'John Doe',
          timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          details: { 
            comment: 'Customer has unusual transaction pattern that requires further investigation.'
          }
        },
        {
          id: '4',
          alert_id: alertId || '53529D64-BB1A-4138-B5F6-A0AB81F03475',
          action: 'ESCALATED',
          performed_by: 'Jane Smith',
          timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
          details: { 
            reason: 'High risk transaction pattern detected',
            escalated_to: 'Compliance Team'
          }
        },
        {
          id: '5',
          alert_id: alertId || '53529D64-BB1A-4138-B5F6-A0AB81F03475',
          action: 'CREATED',
          performed_by: 'System',
          timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          details: { 
            rule_id: 'RF-012',
            rule_desc: 'Multiple Transactions in day from a Single Customer'
          }
        }
      ];

      setLogs(mockLogs);
    } catch (err) {
      setError('Failed to load audit logs');
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'VIEWED': return <Eye className="w-4 h-4 text-blue-400" />;
      case 'DISPOSITION_UPDATED': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'COMMENT_ADDED': return <FileText className="w-4 h-4 text-purple-400" />;
      case 'ESCALATED': return <Flag className="w-4 h-4 text-red-400" />;
      case 'CREATED': return <AlertCircle className="w-4 h-4 text-orange-400" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'VIEWED': return theme === 'dark' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-300';
      case 'DISPOSITION_UPDATED': return theme === 'dark' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-100 text-green-700 border-green-300';
      case 'COMMENT_ADDED': return theme === 'dark' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-300';
      case 'ESCALATED': return theme === 'dark' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-100 text-red-700 border-red-300';
      case 'CREATED': return theme === 'dark' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-300';
      default: return theme === 'dark' ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' : 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.performed_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = dateFilter === '' || 
      new Date(log.timestamp).toLocaleDateString() === new Date(dateFilter).toLocaleDateString();
    
    return matchesSearch && matchesDate;
  });

  return (
    <PermissionGuard
      menuId={AUDIT_LOGS_MENU_ID}
      action="view"
      fallback={
        <div className={`text-center py-20 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view audit logs.</p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Alert Audit Log</h2>
              <p className={`${
                theme === 'dark' ? 'text-blue-200/70' : 'text-blue-600'
              }`}>
                {alertId ? `Audit trail for alert ${alertId.slice(0, 8)}...` : 'System-wide alert activity'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchLogs}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </motion.button>
            
            <PermissionGuard
              menuId={AUDIT_LOGS_MENU_ID}
              action="export"
              fallback={
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => alert("You don't have permission to export audit logs")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors opacity-50 ${
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
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
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

        {/* Filters */}
        <div className={`rounded-2xl border p-6 ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-gray-50 border-gray-200'
        } backdrop-blur-xl`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
              }`}>Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search logs..."
                  className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    theme === 'dark' 
                      ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
              }`}>Date Filter</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    theme === 'dark' 
                      ? 'bg-white/10 border border-white/20 text-white' 
                      : 'bg-white border border-gray-300 text-gray-900'
                  }`}
                />
              </div>
            </div>
            
            <div className="flex items-end">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSearchTerm('');
                  setDateFilter('');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'bg-white/10 hover:bg-white/20 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                Clear Filters
              </motion.button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className={`rounded-2xl border overflow-hidden ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-white border-gray-200'
        } backdrop-blur-xl shadow-2xl`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>Loading audit logs...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className={`text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Failed to load audit logs
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                  {error}
                </p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className={`text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  No audit logs found
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                  Try adjusting your filters or check back later
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${
                  theme === 'dark' ? 'border-white/20 bg-white/5' : 'border-gray-200 bg-gray-50'
                }`}>
                  <tr>
                    <th className={`px-6 py-4 text-left font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Action</th>
                    <th className={`px-6 py-4 text-left font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>User</th>
                    <th className={`px-6 py-4 text-left font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Timestamp</th>
                    <th className={`px-6 py-4 text-left font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <motion.tr
                      key={log.id}
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
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getActionColor(log.action)}`}>
                          {getActionIcon(log.action)}
                          <span className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
                          }`}>
                            <User className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className={`font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {log.performed_by}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
                          }`}>
                            <Clock className="w-4 h-4 text-green-400" />
                          </div>
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                              {new Date(log.timestamp).toLocaleDateString()}
                            </div>
                            <div className={`text-sm ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm ${
                          theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                        }`}>
                          {log.action === 'DISPOSITION_UPDATED' && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Status:</span>
                                <span>{log.details.old_status} → {log.details.new_status}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Type:</span>
                                <span>{log.details.disposition_type.replace('_', ' ')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Risk:</span>
                                <span>{log.details.risk_category}</span>
                              </div>
                            </div>
                          )}
                          
                          {log.action === 'COMMENT_ADDED' && (
                            <div>
                              <span className="font-medium">Comment:</span>
                              <p className="mt-1">{log.details.comment}</p>
                            </div>
                          )}
                          
                          {log.action === 'ESCALATED' && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Escalated to:</span>
                                <span>{log.details.escalated_to}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Reason:</span>
                                <span>{log.details.reason}</span>
                              </div>
                            </div>
                          )}
                          
                          {log.action === 'CREATED' && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Rule:</span>
                                <span>{log.details.rule_id} - {log.details.rule_desc}</span>
                              </div>
                            </div>
                          )}
                          
                          {log.action === 'VIEWED' && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">IP:</span>
                              <span>{log.details.ip_address}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
};

export default AlertAuditLogComponent;