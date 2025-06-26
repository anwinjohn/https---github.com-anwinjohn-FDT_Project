import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  User, 
  Calendar,
  Shield,
  Save,
  Upload,
  Flag,
  MessageSquare
} from 'lucide-react';
import { AlertSummary, AlertDisposition } from '../../types/alerts';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../notifications';

interface AlertDispositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: AlertSummary | null;
  onDispose: (disposition: AlertDisposition) => Promise<boolean>;
}

const AlertDispositionModal: React.FC<AlertDispositionModalProps> = ({
  isOpen,
  onClose,
  alert,
  onDispose
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  
  const [formData, setFormData] = useState({
    disposition_type: 'FALSE_POSITIVE' as 'TRUE_POSITIVE' | 'FALSE_POSITIVE',
    risk_category: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
    findings: '',
    remarks: '',
    action_taken: '',
    escalated: false,
    escalation_reason: '',
    follow_up_required: false,
    follow_up_date: '',
    compliance_notes: ''
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!alert || !user) {
      addNotification('Missing required information', 'error');
      return;
    }

    if (!formData.findings.trim()) {
      addNotification('Please provide findings', 'warning');
      return;
    }

    if (!formData.action_taken.trim()) {
      addNotification('Please specify action taken', 'warning');
      return;
    }

    setLoading(true);

    const disposition: AlertDisposition = {
      alert_id: alert.alert_id,
      disposition_type: formData.disposition_type,
      risk_category: formData.risk_category,
      findings: formData.findings,
      remarks: formData.remarks,
      action_taken: formData.action_taken,
      escalated: formData.escalated,
      escalation_reason: formData.escalation_reason,
      reviewed_by: user.full_name,
      reviewed_at: new Date().toISOString(),
      follow_up_required: formData.follow_up_required,
      follow_up_date: formData.follow_up_date,
      compliance_notes: formData.compliance_notes
    };

    try {
      const success = await onDispose(disposition);
      if (success) {
        onClose();
        // Reset form
        setFormData({
          disposition_type: 'FALSE_POSITIVE',
          risk_category: 'MEDIUM',
          findings: '',
          remarks: '',
          action_taken: '',
          escalated: false,
          escalation_reason: '',
          follow_up_required: false,
          follow_up_date: '',
          compliance_notes: ''
        });
      }
    } catch (error) {
      console.error('Error disposing alert:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !alert) return null;

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
                className={`w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-slate-900/98 via-blue-900/98 to-indigo-900/98 border-white/20' 
                    : 'bg-gradient-to-br from-white/98 via-gray-50/98 to-blue-50/98 border-gray-200'
                } backdrop-blur-2xl max-h-[90vh] flex flex-col`}
              >
                {/* Header */}
                <div className={`p-6 border-b ${
                  theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className={`text-2xl font-bold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>Alert Disposition</h2>
                        <p className={`${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }`}>
                          Review and dispose alert for {alert.cust_name}
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className={`p-3 rounded-2xl transition-all duration-200 ${
                        theme === 'dark' 
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
                  <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Alert Summary */}
                    <div className={`p-6 rounded-2xl border ${
                      theme === 'dark' 
                        ? 'bg-white/5 border-white/20' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <h3 className={`text-lg font-bold mb-4 flex items-center gap-3 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        Alert Summary
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${
                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                          }`}>Customer</label>
                          <div className={`font-semibold ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {alert.cust_name} ({alert.cust_code})
                          </div>
                        </div>
                        
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${
                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                          }`}>Rule</label>
                          <div className={`font-semibold ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {alert.rule_id} - {alert.rule_desc}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Disposition Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Left Column */}
                      <div className="space-y-6">
                        {/* Disposition Type */}
                        <div>
                          <label className={`block text-sm font-medium mb-3 ${
                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                          }`}>Disposition Type *</label>
                          <div className="grid grid-cols-2 gap-3">
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setFormData({ ...formData, disposition_type: 'TRUE_POSITIVE' })}
                              className={`p-4 rounded-xl border transition-all ${
                                formData.disposition_type === 'TRUE_POSITIVE'
                                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                                  : theme === 'dark'
                                    ? 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <XCircle className="w-6 h-6 mx-auto mb-2" />
                              <div className="font-medium">True Positive</div>
                              <div className="text-xs opacity-80">Genuine fraud</div>
                            </motion.button>
                            
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setFormData({ ...formData, disposition_type: 'FALSE_POSITIVE' })}
                              className={`p-4 rounded-xl border transition-all ${
                                formData.disposition_type === 'FALSE_POSITIVE'
                                  ? 'bg-green-500/20 border-green-500/40 text-green-300'
                                  : theme === 'dark'
                                    ? 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <CheckCircle className="w-6 h-6 mx-auto mb-2" />
                              <div className="font-medium">False Positive</div>
                              <div className="text-xs opacity-80">Legitimate activity</div>
                            </motion.button>
                          </div>
                        </div>

                        {/* Risk Category */}
                        <div>
                          <label className={`block text-sm font-medium mb-3 ${
                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                          }`}>Risk Category *</label>
                          <div className="grid grid-cols-3 gap-3">
                            {(['HIGH', 'MEDIUM', 'LOW'] as const).map(level => (
                              <motion.button
                                key={level}
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setFormData({ ...formData, risk_category: level })}
                                className={`p-3 rounded-xl border transition-all ${
                                  formData.risk_category === level
                                    ? level === 'HIGH'
                                      ? 'bg-red-500/20 border-red-500/40 text-red-300'
                                      : level === 'MEDIUM'
                                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                                        : 'bg-green-500/20 border-green-500/40 text-green-300'
                                    : theme === 'dark'
                                      ? 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                <div className="font-medium text-sm">{level}</div>
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* Findings */}
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                          }`}>Findings *</label>
                          <textarea
                            value={formData.findings}
                            onChange={(e) => setFormData({ ...formData, findings: e.target.value })}
                            placeholder="Describe your investigation findings..."
                            rows={4}
                            className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              theme === 'dark' 
                                ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                                : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                            }`}
                            required
                          />
                        </div>

                        {/* Action Taken */}
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                          }`}>Action Taken *</label>
                          <textarea
                            value={formData.action_taken}
                            onChange={(e) => setFormData({ ...formData, action_taken: e.target.value })}
                            placeholder="Describe actions taken to resolve this alert..."
                            rows={3}
                            className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              theme === 'dark' 
                                ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                                : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                            }`}
                            required
                          />
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-6">
                        {/* Escalation */}
                        <div>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.escalated}
                              onChange={(e) => setFormData({ ...formData, escalated: e.target.checked })}
                              className="w-4 h-4 text-red-600 bg-white/10 border-white/20 rounded focus:ring-red-500"
                            />
                            <span className={`font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Escalate to Senior Management</span>
                          </label>
                          
                          {formData.escalated && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3"
                            >
                              <textarea
                                value={formData.escalation_reason}
                                onChange={(e) => setFormData({ ...formData, escalation_reason: e.target.value })}
                                placeholder="Reason for escalation..."
                                rows={3}
                                className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${
                                  theme === 'dark' 
                                    ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                                    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                                }`}
                              />
                            </motion.div>
                          )}
                        </div>

                        {/* Follow-up Required */}
                        <div>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.follow_up_required}
                              onChange={(e) => setFormData({ ...formData, follow_up_required: e.target.checked })}
                              className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                            />
                            <span className={`font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Follow-up Required</span>
                          </label>
                          
                          {formData.follow_up_required && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3"
                            >
                              <input
                                type="date"
                                value={formData.follow_up_date}
                                onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                                className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  theme === 'dark' 
                                    ? 'bg-white/10 border border-white/20 text-white' 
                                    : 'bg-white border border-gray-300 text-gray-900'
                                }`}
                              />
                            </motion.div>
                          )}
                        </div>

                        {/* Remarks */}
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                          }`}>Additional Remarks</label>
                          <textarea
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            placeholder="Any additional comments or observations..."
                            rows={3}
                            className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              theme === 'dark' 
                                ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                                : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                            }`}
                          />
                        </div>

                        {/* Compliance Notes */}
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                          }`}>Compliance Notes</label>
                          <textarea
                            value={formData.compliance_notes}
                            onChange={(e) => setFormData({ ...formData, compliance_notes: e.target.value })}
                            placeholder="Regulatory compliance notes..."
                            rows={3}
                            className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              theme === 'dark' 
                                ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                                : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className={`flex justify-between items-center pt-6 border-t ${
                      theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                    }`}>
                      <div className={`text-sm ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}>
                        Reviewed by: {user?.full_name}
                      </div>
                      
                      <div className="flex gap-3">
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={onClose}
                          className={`px-6 py-3 rounded-xl transition-colors ${
                            theme === 'dark' 
                              ? 'bg-white/10 hover:bg-white/20 text-white' 
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          Cancel
                        </motion.button>
                        
                        <motion.button
                          type="submit"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          disabled={loading}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg"
                        >
                          {loading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                          ) : (
                            <Save className="w-5 h-5" />
                          )}
                          {loading ? 'Processing...' : 'Dispose Alert'}
                        </motion.button>
                      </div>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AlertDispositionModal;