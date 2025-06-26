import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Building,
  CreditCard,
  Calendar,
  MapPin,
  DollarSign,
  FileText,
  Shield,
  Clock,
  AlertTriangle,
  TrendingUp,
  Globe,
  Briefcase,
  Coins,
  Flag
} from 'lucide-react';
import { AlertDetail } from '../../types/alerts';
import { useTheme } from '../../context/ThemeContext';
import { formatNumber } from '../../utils/formatters';

interface AlertDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertDetails: AlertDetail[] | null;
  alertId: string | null;
  loading: boolean;
}

const AlertDetailsModal: React.FC<AlertDetailsModalProps> = ({
  isOpen,
  onClose,
  alertDetails,
  alertId,
  loading
}) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const firstDetail = alertDetails?.[0];
  const totalAmount = alertDetails?.reduce((sum, detail) => sum + parseFloat(detail.lcy_amt), 0) || 0;

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
                className={`w-full max-w-6xl rounded-3xl border shadow-2xl overflow-hidden ${theme === 'dark'
                    ? 'bg-gradient-to-br from-slate-900/98 via-blue-900/98 to-indigo-900/98 border-white/20'
                    : 'bg-gradient-to-br from-white/98 via-gray-50/98 to-blue-50/98 border-gray-200'
                  } backdrop-blur-2xl max-h-[90vh] flex flex-col`}
              >
                {/* Header */}
                <div className={`p-6 border-b ${theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                  }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl shadow-lg">
                        <AlertTriangle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Alert Details</h2>
                        <p className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                          }`}>
                            <Flag className="inline w-4 h-4 mr-1" />
                          Alert ID: {alertId?.slice(0, 60)}
                          </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className={`p-3 rounded-2xl transition-all duration-200 ${theme === 'dark'
                          ? 'bg-white/10 hover:bg-white/20 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                    >
                      <X className="w-6 h-6" />
                    </motion.button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
                        <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>
                          Loading alert details...
                        </span>
                      </div>
                    </div>
                  ) : !alertDetails || alertDetails.length === 0 ? (
                    <div className="text-center py-20">
                      <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                      <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>No Details Available</h3>
                      <p className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }`}>Unable to load alert details</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-6 rounded-2xl border ${theme === 'dark'
                              ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30'
                              : 'bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-300'
                            }`}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <FileText className="w-6 h-6 text-blue-400" />
                            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>Transactions</h3>
                          </div>
                          <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                            {alertDetails.length}
                          </div>
                          <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                            }`}>Related transactions</p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className={`p-6 rounded-2xl border ${theme === 'dark'
                              ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30'
                              : 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-300'
                            }`}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <Coins className="w-6 h-6 text-green-400" />
                            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>Total Amount</h3>
                          </div>
                          <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                            AED {formatNumber(totalAmount)}
                          </div>
                          <p className={`text-sm ${theme === 'dark' ? 'text-green-300' : 'text-green-700'
                            }`}>Cumulative value</p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className={`p-6 rounded-2xl border ${theme === 'dark'
                              ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/30'
                              : 'bg-gradient-to-br from-orange-100 to-red-100 border-orange-300'
                            }`}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <Shield className="w-6 h-6 text-orange-400" />
                            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>Risk Level</h3>
                          </div>
                          <div className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                            HIGH
                          </div>
                          <p className={`text-sm ${theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                            }`}>Requires review</p>
                        </motion.div>
                      </div>

                      {/* Customer Information */}
                      {firstDetail && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className={`p-6 rounded-2xl border ${theme === 'dark'
                              ? 'bg-white/5 border-white/20'
                              : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                          <h3 className={`text-lg font-bold mb-6 flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                            <User className="w-5 h-5 text-blue-400" />
                            Customer Information
                          </h3>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Customer Name</label>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                {firstDetail.cust_name}
                              </div>
                            </div>

                            <div>
                              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Customer Code</label>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                {firstDetail.cust_code}
                              </div>
                            </div>

                            <div>
                              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Customer Type</label>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                {firstDetail.cust_type}
                              </div>
                            </div>

                            <div>
                              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Profession</label>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                {firstDetail.cust_profession}
                              </div>
                            </div>

                            <div>
                              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Nationality</label>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                {firstDetail.cust_nationality}
                              </div>
                            </div>

                            <div>
                              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Residence Status</label>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                {firstDetail.cust_resi_status}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Rule Information */}
                      {firstDetail && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          className={`p-6 rounded-2xl border ${theme === 'dark'
                              ? 'bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20'
                              : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
                            }`}
                        >
                          <h3 className={`text-lg font-bold mb-6 flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                            Rule Information
                          </h3>

                          <div className="space-y-4">
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Rule ID</label>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                {firstDetail.rule_id}
                              </div>
                            </div>

                            <div>
                              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Rule Description</label>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                {firstDetail.rule_desc}
                              </div>
                            </div>

                            <div>
                              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Rule Remarks</label>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                {firstDetail.rule_remarks}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Transaction Details */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className={`rounded-2xl border overflow-hidden ${theme === 'dark'
                            ? 'bg-white/5 border-white/20'
                            : 'bg-white border-gray-200'
                          }`}
                      >
                        <div className={`p-6 border-b ${theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                          }`}>
                          <h3 className={`text-lg font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                            <CreditCard className="w-5 h-5 text-green-400" />
                            Transaction Details
                          </h3>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className={`border-b ${theme === 'dark' ? 'border-white/20 bg-white/5' : 'border-gray-200 bg-gray-50'
                              }`}>
                              <tr>
                                <th className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>Date</th>
                                <th className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>Reference</th>
                                <th className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>Amount</th>
                                <th className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>Beneficiary</th>
                                <th className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>Branch</th>
                                <th className={`px-4 py-3 text-left font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>Purpose</th>
                              </tr>
                            </thead>
                            <tbody>
                              {alertDetails.map((detail, index) => (
                                <tr
                                  key={detail.row_id}
                                  className={`border-b ${theme === 'dark'
                                      ? 'border-white/10 hover:bg-white/5'
                                      : 'border-gray-100 hover:bg-gray-50'
                                    }`}
                                >
                                  <td className="px-4 py-3">
                                    <div className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      }`}>
                                      {new Date(detail.transaction_date).toLocaleDateString()}
                                    </div>
                                    <div className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                      }`}>
                                      {new Date(detail.transaction_date).toLocaleTimeString()}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      }`}>
                                      {detail.ref_no}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className={`text-sm font-bold ${theme === 'dark' ? 'text-green-300' : 'text-green-600'
                                      }`}>
                                      AED {formatNumber(parseFloat(detail.lcy_amt))}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      }`}>
                                      {detail.beneficiary_name}
                                    </div>
                                    <div className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                      }`}>
                                      {detail.pymnt_to_country}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      }`}>
                                      {detail.branch_name}
                                    </div>
                                    <div className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                      }`}>
                                      By: {detail.cashier_id}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      }`}>
                                      {detail.txn_purpose}
                                    </div>
                                    <div className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                      }`}>
                                      Source: {detail.source_fund}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
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