import React, { useState, useEffect, useRef } from 'react';
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
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Zap,
  Copy,
  Check,
  Lock,
  Unlock,
  CreditCard,
  Clock,
  Building,
  Globe,
  Briefcase,
  DollarSign,
  Loader2,
  Info,
  RefreshCw
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
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    findings: string;
    action_taken: string;
    remarks: string;
    confidence: number;
    analysis: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [alertLocked, setAlertLocked] = useState(false);
  const [lockOwner, setLockOwner] = useState<string | null>(null);
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [formData, setFormData] = useState<Partial<AlertDisposition>>({
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

  // Reset form when alert changes
  useEffect(() => {
    if (alert) {
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
      setStep('form');
      setAiSuggestions(null);
      setCopiedField(null);
    }
  }, [alert]);

  // Acquire lock when opening modal
  useEffect(() => {
    if (isOpen && alert && user) {
      // In a real implementation, this would call an API to acquire a lock
      const lockKey = `alert_lock_${alert.alert_id}`;
      const existingLock = localStorage.getItem(lockKey);
      
      if (existingLock) {
        try {
          const lockData = JSON.parse(existingLock);
          // Check if lock is expired (older than 5 minutes)
          const lockTime = new Date(lockData.timestamp).getTime();
          const now = Date.now();
          const fiveMinutesMs = 5 * 60 * 1000;
          
          if (now - lockTime > fiveMinutesMs) {
            // Lock expired, acquire it
            acquireLock();
          } else if (lockData.userId !== user.id) {
            // Lock is valid and owned by someone else
            setAlertLocked(true);
            setLockOwner(lockData.userName || 'another user');
          } else {
            // Lock is valid and owned by current user
            refreshLock();
          }
        } catch (error) {
          console.error('Error parsing lock data:', error);
          acquireLock();
        }
      } else {
        // No existing lock, acquire it
        acquireLock();
      }
    }
    
    return () => {
      // Clear lock refresh timer when closing modal
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    };
  }, [isOpen, alert, user]);

  const acquireLock = () => {
    if (!alert || !user) return;
    
    const lockKey = `alert_lock_${alert.alert_id}`;
    const lockData = {
      userId: user.id,
      userName: user.full_name,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(lockKey, JSON.stringify(lockData));
    setAlertLocked(false);
    setLockOwner(null);
    
    // Set up periodic lock refresh
    refreshLock();
  };

  const refreshLock = () => {
    if (!alert || !user) return;
    
    // Clear existing timer if any
    if (lockTimerRef.current) {
      clearInterval(lockTimerRef.current);
    }
    
    // Set up periodic lock refresh (every minute)
    lockTimerRef.current = setInterval(() => {
      const lockKey = `alert_lock_${alert.alert_id}`;
      const lockData = {
        userId: user.id,
        userName: user.full_name,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(lockKey, JSON.stringify(lockData));
    }, 60 * 1000);
  };

  const releaseLock = () => {
    if (!alert) return;
    
    const lockKey = `alert_lock_${alert.alert_id}`;
    localStorage.removeItem(lockKey);
    
    if (lockTimerRef.current) {
      clearInterval(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  };

  const forceUnlock = () => {
    if (!alert || !user || !user.role_id || user.role_id > 1) {
      addNotification('You do not have permission to force unlock alerts', 'error');
      return;
    }
    
    acquireLock();
    addNotification('Alert has been force unlocked', 'success');
  };

  const handleClose = () => {
    releaseLock();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!alert || !user) {
      addNotification('Missing required information', 'error');
      return;
    }

    // Validate form based on disposition type
    if (formData.disposition_type === 'TRUE_POSITIVE') {
      if (!formData.findings?.trim()) {
        addNotification('Please provide findings for true positive disposition', 'warning');
        return;
      }
      
      if (!formData.action_taken?.trim()) {
        addNotification('Please specify action taken for true positive disposition', 'warning');
        return;
      }
    } else {
      // For false positives, only findings is required
      if (!formData.findings?.trim()) {
        addNotification('Please provide findings', 'warning');
        return;
      }
    }

    if (step === 'form') {
      setStep('review');
      return;
    }

    setIsSubmitting(true);

    const disposition: AlertDisposition = {
      alert_id: alert.alert_id,
      disposition_type: formData.disposition_type as 'TRUE_POSITIVE' | 'FALSE_POSITIVE',
      risk_category: formData.risk_category as 'HIGH' | 'MEDIUM' | 'LOW',
      findings: formData.findings || '',
      remarks: formData.remarks || '',
      action_taken: formData.action_taken || '',
      escalated: formData.escalated || false,
      escalation_reason: formData.escalation_reason || '',
      reviewed_by: user.full_name,
      reviewed_at: new Date().toISOString(),
      follow_up_required: formData.follow_up_required || false,
      follow_up_date: formData.follow_up_date || '',
      compliance_notes: formData.compliance_notes || ''
    };

    try {
      const success = await onDispose(disposition);
      if (success) {
        releaseLock();
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
        setStep('form');
      }
    } catch (error) {
      console.error('Error disposing alert:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateAISuggestions = async () => {
    if (!alert) return;
    
    setIsGeneratingAI(true);
    setAiSuggestions(null);
    
    try {
      // In a real implementation, this would call an API to generate AI suggestions
      // For now, we'll simulate the API call with a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate mock AI suggestions based on the alert data
      const isTruePositive = Math.random() > 0.5;
      const confidence = 0.5 + Math.random() * 0.4; // 50-90% confidence
      
      let findings = '';
      let action = '';
      let remarks = '';
      let analysis = '';
      
      if (isTruePositive) {
        findings = `Analysis of transaction patterns for customer ${alert.cust_name} (${alert.cust_code}) shows unusual activity that triggered rule ${alert.rule_id}. The transaction exhibits characteristics consistent with structuring to avoid reporting thresholds.`;
        
        action = `1. Escalated to compliance team for further review\n2. Placed temporary hold on future transactions pending investigation\n3. Documented findings in case management system`;
        
        remarks = `Customer has previous history of similar alerts. Recommend enhanced due diligence and customer interview to clarify source of funds.`;
        
        analysis = `This alert shows multiple high-risk indicators including transaction velocity, amount structuring, and unusual beneficiary patterns. The confidence score is ${(confidence * 100).toFixed(1)}% based on historical patterns.`;
      } else {
        findings = `Review of transaction for customer ${alert.cust_name} (${alert.cust_code}) shows legitimate business activity that triggered rule ${alert.rule_id} due to transaction amount. Customer profile and transaction history are consistent with declared business activities.`;
        
        action = `No action required. Transaction is consistent with customer's declared business activities and risk profile.`;
        
        remarks = `False positive triggered by rule threshold. Consider adjusting rule parameters to reduce similar false positives.`;
        
        analysis = `This appears to be a false positive with ${(confidence * 100).toFixed(1)}% confidence. The transaction matches the customer's established pattern and business profile. No suspicious indicators detected.`;
      }
      
      setAiSuggestions({
        findings,
        action_taken: action,
        remarks,
        confidence,
        analysis
      });
      
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      addNotification('Failed to generate AI suggestions', 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleApplySuggestion = (field: 'findings' | 'action_taken' | 'remarks') => {
    if (!aiSuggestions) return;
    
    setFormData(prev => ({
      ...prev,
      [field]: aiSuggestions[field]
    }));
    
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleApplyAllSuggestions = () => {
    if (!aiSuggestions) return;
    
    setFormData(prev => ({
      ...prev,
      findings: aiSuggestions.findings,
      action_taken: aiSuggestions.action_taken,
      remarks: aiSuggestions.remarks
    }));
    
    setCopiedField('all');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
            onClick={handleClose}
          />

          <div className="fixed inset-0 overflow-y-auto z-50">
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={`w-full max-w-5xl rounded-3xl border shadow-2xl overflow-hidden ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-slate-900/98 via-blue-900/98 to-indigo-900/98 border-white/20' 
                    : 'bg-gradient-to-br from-white/98 via-gray-50/98 to-blue-50/98 border-gray-200'
                } backdrop-blur-2xl max-h-[90vh] flex flex-col`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className={`p-6 border-b ${
                  theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className={`text-2xl font-bold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>Alert Disposition</h2>
                        <p className={`${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }`}>
                           {alert.cust_name} ({alert.cust_code})
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleClose}
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

                {/* Alert Summary */}
                <div className={`px-6 py-4 border-b ${
                  theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div>
                        <div className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                        }`}>Service Type</div>
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{alert.service_type}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <div>
                        <div className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                        }`}>Timestamp</div>
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{new Date(alert.time_stamp).toLocaleString()}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <div>
                        <div className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                        }`}>Priority</div>
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{alert.rule_priority || 'MEDIUM'}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <div>
                        <div className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                        }`}>Alert ID</div>
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{alert.alert_id.slice(0, 50)}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <div>
                        <div className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                        }`}>Status</div>
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{alert.status || 'OPEN'}</div>
                      </div>
                    </div>
                    
                    {/* <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      <div>
                        <div className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                        }`}>Customer</div>
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{alert.cust_name} ({alert.cust_code})</div>
                      </div>
                    </div> */}
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" />
                      <div>
                        <div className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                        }`}>Rule Remarks</div>
                        <div className={`${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{alert.rule_remarks}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Alert Lock Warning */}
                  {alertLocked && (
                    <div className={`mt-3 p-3 rounded-lg border ${
                      theme === 'dark' 
                        ? 'bg-red-500/10 border-red-500/30 text-red-300' 
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 flex-shrink-0" />
                        <div>
                          <span className="font-medium">Alert is locked by {lockOwner || 'undefined'}</span>
                          <p className="text-sm mt-1">This alert is currently being reviewed by another user.</p>
                        </div>
                        
                        {user?.role_id !== undefined && user.role_id <= 1 && (
                          <button
                            onClick={forceUnlock}
                            className={`ml-auto px-3 py-1.5 rounded-lg text-xs ${
                              theme === 'dark' 
                                ? 'bg-white/10 hover:bg-white/20 text-white' 
                                : 'bg-white hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            Force Unlock
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                  <AnimatePresence mode="wait">
                    {step === 'form' ? (
                      <motion.div
                        key="form"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="p-6"
                      >
                        <form onSubmit={handleSubmit} className="space-y-6">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column - Disposition Form */}
                            <div className="lg:col-span-2 space-y-6">
                              {/* Disposition Type */}
                              <div>
                                <label className={`block text-sm font-medium mb-2 ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Disposition Type *</label>
                                <div className="flex gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, disposition_type: 'FALSE_POSITIVE' })}
                                    className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                                      formData.disposition_type === 'FALSE_POSITIVE'
                                        ? theme === 'dark'
                                          ? 'border-green-500/60 bg-green-500/10 text-green-300 shadow-lg shadow-green-500/20'
                                          : 'border-green-500 bg-green-50 text-green-700 shadow-lg shadow-green-500/20'
                                        : theme === 'dark'
                                          ? 'border-white/20 bg-white/5 hover:bg-white/10 text-white'
                                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    <CheckCircle className="w-5 h-5" />
                                    <span className="font-medium">False Positive</span>
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, disposition_type: 'TRUE_POSITIVE' })}
                                    className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                                      formData.disposition_type === 'TRUE_POSITIVE'
                                        ? theme === 'dark'
                                          ? 'border-red-500/60 bg-red-500/10 text-red-300 shadow-lg shadow-red-500/20'
                                          : 'border-red-500 bg-red-50 text-red-700 shadow-lg shadow-red-500/20'
                                        : theme === 'dark'
                                          ? 'border-white/20 bg-white/5 hover:bg-white/10 text-white'
                                          : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    <XCircle className="w-5 h-5" />
                                    <span className="font-medium">True Positive</span>
                                  </button>
                                </div>
                              </div>

                              {/* Risk Category */}
                              <div>
                                <label className={`block text-sm font-medium mb-2 ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>Risk Category *</label>
                                <div className="flex gap-3">
                                  {(['HIGH', 'MEDIUM', 'LOW'] as const).map(level => (
                                    <button
                                      key={level}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, risk_category: level })}
                                      className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                                        formData.risk_category === level
                                          ? level === 'HIGH'
                                            ? theme === 'dark'
                                              ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                              : 'bg-red-100 text-red-700 border-red-300'
                                            : level === 'MEDIUM'
                                              ? theme === 'dark'
                                                ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                                                : 'bg-orange-100 text-orange-700 border-orange-300'
                                              : theme === 'dark'
                                                ? 'bg-green-500/20 text-green-300 border-green-500/40'
                                                : 'bg-green-100 text-green-700 border-green-300'
                                          : theme === 'dark'
                                            ? 'bg-white/5 text-white/70 hover:bg-white/10 border-white/20'
                                            : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                                      }`}
                                    >
                                      {level}
                                    </button>
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

                              {/* Action Taken - Only required for TRUE_POSITIVE */}
                              <div>
                                <label className={`block text-sm font-medium mb-2 ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>
                                  Action Taken {formData.disposition_type === 'TRUE_POSITIVE' && '*'}
                                </label>
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
                                  required={formData.disposition_type === 'TRUE_POSITIVE'}
                                />
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

                              {/* Collapsible Sections */}
                              <div className="space-y-4">
                                {/* Escalation Section */}
                                <div className={`p-4 rounded-xl border ${
                                  theme === 'dark' 
                                    ? 'bg-white/5 border-white/10' 
                                    : 'bg-gray-50 border-gray-200'
                                }`}>
                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={formData.escalated}
                                      onChange={(e) => setFormData({ ...formData, escalated: e.target.checked })}
                                      className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
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
                                        className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                          theme === 'dark' 
                                            ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                                            : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                                        }`}
                                      />
                                    </motion.div>
                                  )}
                                </div>

                                {/* Follow-up Section */}
                                <div className={`p-4 rounded-xl border ${
                                  theme === 'dark' 
                                    ? 'bg-white/5 border-white/10' 
                                    : 'bg-gray-50 border-gray-200'
                                }`}>
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

                                {/* Compliance Notes */}
                                <div className={`p-4 rounded-xl border ${
                                  theme === 'dark' 
                                    ? 'bg-white/5 border-white/10' 
                                    : 'bg-gray-50 border-gray-200'
                                }`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <label className={`font-medium ${
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>Compliance Notes</label>
                                  </div>
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

                            {/* Right Column - AI Assistant */}
                            <div className="space-y-6">
                              <div className={`rounded-xl border overflow-hidden ${
                                theme === 'dark' 
                                  ? 'bg-white/5 border-white/10' 
                                  : 'bg-gray-50 border-gray-200'
                              }`}>
                                <div className={`p-4 border-b ${
                                  theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {/* <Zap className="w-5 h-5 text-yellow-400" /> */}
                                      {/* <h3 className={`font-semibold ${
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      }`}>AI Assistant</h3> */}
                                    </div>
                                    
                                    <button
                                      type="button"
                                      onClick={generateAISuggestions}
                                      disabled={isGeneratingAI}
                                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                        theme === 'dark' 
                                          ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed' 
                                          : 'bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                                      }`}
                                    >
                                      {isGeneratingAI ? (
                                        <>
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                          <span>Generating...</span>
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="w-3 h-3" />
                                          <span>Generate Suggestions</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                                
                                <div className="p-4 max-h-[400px] overflow-y-auto">
                                  {isGeneratingAI ? (
                                    <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                      <Loader2 className={`w-8 h-8 animate-spin ${
                                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                      }`} />
                                      <p className={theme === 'dark' ? 'text-white/70' : 'text-gray-600'}>
                                        Analyzing alert data...
                                      </p>
                                    </div>
                                  ) : aiSuggestions ? (
                                    <div className="space-y-4">
                                      {/* AI Confidence */}
                                      <div className={`p-3 rounded-lg border ${
                                        aiSuggestions.confidence > 0.7
                                          ? theme === 'dark'
                                            ? 'bg-green-500/10 border-green-500/30 text-green-300'
                                            : 'bg-green-50 border-green-200 text-green-700'
                                          : theme === 'dark'
                                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                                            : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                      }`}>
                                        <div className="flex items-center gap-2">
                                          {aiSuggestions.confidence > 0.7 ? (
                                            <CheckCircle className="w-4 h-4" />
                                          ) : (
                                            <AlertTriangle className="w-4 h-4" />
                                          )}
                                          <div>
                                            <span className="font-medium">AI Confidence: {(aiSuggestions.confidence * 100).toFixed(1)}%</span>
                                            {aiSuggestions.confidence < 0.7 && (
                                              <p className="text-xs mt-1">Low confidence - review suggestions carefully</p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* AI Analysis */}
                                      <div className={`p-3 rounded-lg border ${
                                        theme === 'dark' 
                                          ? 'bg-blue-500/10 border-blue-500/20' 
                                          : 'bg-blue-50 border-blue-200'
                                      }`}>
                                        <div className="flex items-start gap-2">
                                          <Info className={`w-4 h-4 mt-0.5 ${
                                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                          }`} />
                                          <div>
                                            <div className={`text-xs font-medium mb-1 ${
                                              theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                                            }`}>AI Analysis</div>
                                            <p className={`text-sm ${
                                              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                            }`}>{aiSuggestions.analysis}</p>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Suggested Findings */}
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <div className={`text-xs font-medium ${
                                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                          }`}>Suggested Findings</div>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => copyToClipboard(aiSuggestions.findings, 'findings-copy')}
                                              className={`p-1 rounded-md ${
                                                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                              }`}
                                              title="Copy to clipboard"
                                            >
                                              {copiedField === 'findings-copy' ? (
                                                <Check className="w-3 h-3 text-green-400" />
                                              ) : (
                                                <Copy className="w-3 h-3 text-gray-400" />
                                              )}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleApplySuggestion('findings')}
                                              className={`p-1 rounded-md ${
                                                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                              }`}
                                              title="Apply suggestion"
                                            >
                                              {copiedField === 'findings' ? (
                                                <Check className="w-3 h-3 text-green-400" />
                                              ) : (
                                                <CheckCircle className="w-3 h-3 text-blue-400" />
                                              )}
                                            </button>
                                          </div>
                                        </div>
                                        <div className={`p-3 rounded-lg border text-sm ${
                                          theme === 'dark' 
                                            ? 'bg-white/5 border-white/10 text-white/80' 
                                            : 'bg-white border-gray-200 text-gray-700'
                                        }`}>
                                          {aiSuggestions.findings}
                                        </div>
                                      </div>
                                      
                                      {/* Suggested Action */}
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <div className={`text-xs font-medium ${
                                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                          }`}>Suggested Action</div>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => copyToClipboard(aiSuggestions.action_taken, 'action-copy')}
                                              className={`p-1 rounded-md ${
                                                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                              }`}
                                              title="Copy to clipboard"
                                            >
                                              {copiedField === 'action-copy' ? (
                                                <Check className="w-3 h-3 text-green-400" />
                                              ) : (
                                                <Copy className="w-3 h-3 text-gray-400" />
                                              )}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleApplySuggestion('action_taken')}
                                              className={`p-1 rounded-md ${
                                                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                              }`}
                                              title="Apply suggestion"
                                            >
                                              {copiedField === 'action_taken' ? (
                                                <Check className="w-3 h-3 text-green-400" />
                                              ) : (
                                                <CheckCircle className="w-3 h-3 text-blue-400" />
                                              )}
                                            </button>
                                          </div>
                                        </div>
                                        <div className={`p-3 rounded-lg border text-sm ${
                                          theme === 'dark' 
                                            ? 'bg-white/5 border-white/10 text-white/80' 
                                            : 'bg-white border-gray-200 text-gray-700'
                                        }`}>
                                          {aiSuggestions.action_taken}
                                        </div>
                                      </div>
                                      
                                      {/* Suggested Remarks */}
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <div className={`text-xs font-medium ${
                                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                          }`}>Suggested Remarks</div>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => copyToClipboard(aiSuggestions.remarks, 'remarks-copy')}
                                              className={`p-1 rounded-md ${
                                                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                              }`}
                                              title="Copy to clipboard"
                                            >
                                              {copiedField === 'remarks-copy' ? (
                                                <Check className="w-3 h-3 text-green-400" />
                                              ) : (
                                                <Copy className="w-3 h-3 text-gray-400" />
                                              )}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleApplySuggestion('remarks')}
                                              className={`p-1 rounded-md ${
                                                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                              }`}
                                              title="Apply suggestion"
                                            >
                                              {copiedField === 'remarks' ? (
                                                <Check className="w-3 h-3 text-green-400" />
                                              ) : (
                                                <CheckCircle className="w-3 h-3 text-blue-400" />
                                              )}
                                            </button>
                                          </div>
                                        </div>
                                        <div className={`p-3 rounded-lg border text-sm ${
                                          theme === 'dark' 
                                            ? 'bg-white/5 border-white/10 text-white/80' 
                                            : 'bg-white border-gray-200 text-gray-700'
                                        }`}>
                                          {aiSuggestions.remarks}
                                        </div>
                                      </div>
                                      
                                      {/* Apply All Button */}
                                      <button
                                        type="button"
                                        onClick={handleApplyAllSuggestions}
                                        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                          theme === 'dark' 
                                            ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30' 
                                            : 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300'
                                        }`}
                                      >
                                        {copiedField === 'all' ? (
                                          <>
                                            <Check className="w-4 h-4" />
                                            <span>Applied All Suggestions</span>
                                          </>
                                        ) : (
                                          <>
                                            <Zap className="w-4 h-4" />
                                            <span>Apply All Suggestions</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                      <Zap className={`w-8 h-8 ${
                                        theme === 'dark' ? 'text-yellow-400/50' : 'text-yellow-500/50'
                                      }`} />
                                      <div className="text-center">
                                        <p className={theme === 'dark' ? 'text-white/70' : 'text-gray-600'}>
                                          Generate AI suggestions to help with your analysis
                                        </p>
                                        <p className={`text-xs mt-2 ${
                                          theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                                        }`}>
                                          AI will analyze the alert and provide recommendations
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={generateAISuggestions}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                          theme === 'dark' 
                                            ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30' 
                                            : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-300'
                                        }`}
                                      >
                                        <Zap className="w-4 h-4" />
                                        <span>Generate Suggestions</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
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
                                onClick={handleClose}
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
                                disabled={isSubmitting || alertLocked}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                                  alertLocked
                                    ? theme === 'dark'
                                      ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : theme === 'dark'
                                      ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                                      : 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300'
                                }`}
                              >
                                <ChevronRight className="w-5 h-5" />
                                Review & Submit
                              </motion.button>
                            </div>
                          </div>
                        </form>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="review"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="p-6"
                      >
                        <div className="space-y-6">
                          <div className={`p-4 rounded-xl border ${
                            theme === 'dark' 
                              ? 'bg-white/5 border-white/10' 
                              : 'bg-gray-50 border-gray-200'
                          }`}>
                            <h3 className={`text-lg font-semibold mb-4 ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Review Disposition</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <div className={`mb-4 ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>
                                  <div className="text-sm font-medium mb-1">Disposition Type</div>
                                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${
                                    formData.disposition_type === 'TRUE_POSITIVE'
                                      ? theme === 'dark'
                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                        : 'bg-red-100 text-red-700 border border-red-300'
                                      : theme === 'dark'
                                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                        : 'bg-green-100 text-green-700 border border-green-300'
                                  }`}>
                                    {formData.disposition_type === 'TRUE_POSITIVE' ? (
                                      <>
                                        <XCircle className="w-4 h-4" />
                                        <span>True Positive</span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-4 h-4" />
                                        <span>False Positive</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                
                                <div className={`mb-4 ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>
                                  <div className="text-sm font-medium mb-1">Risk Category</div>
                                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${
                                    formData.risk_category === 'HIGH'
                                      ? theme === 'dark'
                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                        : 'bg-red-100 text-red-700 border border-red-300'
                                      : formData.risk_category === 'MEDIUM'
                                        ? theme === 'dark'
                                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                          : 'bg-orange-100 text-orange-700 border border-orange-300'
                                        : theme === 'dark'
                                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                          : 'bg-green-100 text-green-700 border border-green-300'
                                  }`}>
                                    <Shield className="w-4 h-4" />
                                    <span>{formData.risk_category}</span>
                                  </div>
                                </div>
                                
                                {formData.escalated && (
                                  <div className={`mb-4 ${
                                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                  }`}>
                                    <div className="text-sm font-medium mb-1">Escalation</div>
                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${
                                      theme === 'dark'
                                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                        : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                    }`}>
                                      <Flag className="w-4 h-4" />
                                      <span>Escalated to Management</span>
                                    </div>
                                  </div>
                                )}
                                
                                {formData.follow_up_required && formData.follow_up_date && (
                                  <div className={`mb-4 ${
                                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                  }`}>
                                    <div className="text-sm font-medium mb-1">Follow-up Date</div>
                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${
                                      theme === 'dark'
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                        : 'bg-blue-100 text-blue-700 border border-blue-300'
                                    }`}>
                                      <Calendar className="w-4 h-4" />
                                      <span>{formData.follow_up_date}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <div>
                                <div className={`mb-4 ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>
                                  <div className="text-sm font-medium mb-1">Reviewed By</div>
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-blue-400" />
                                    <span>{user?.full_name}</span>
                                  </div>
                                </div>
                                
                                <div className={`mb-4 ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>
                                  <div className="text-sm font-medium mb-1">Review Date</div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-green-400" />
                                    <span>{new Date().toLocaleDateString()}</span>
                                  </div>
                                </div>
                                
                                <div className={`mb-4 ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>
                                  <div className="text-sm font-medium mb-1">Alert ID</div>
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-purple-400" />
                                    <span>{alert.alert_id.slice(0, 50)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className={`p-4 rounded-xl border ${
                              theme === 'dark' 
                                ? 'bg-white/5 border-white/10' 
                                : 'bg-gray-50 border-gray-200'
                            }`}>
                              <h4 className={`font-medium mb-2 ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>Findings</h4>
                              <div className={`whitespace-pre-line ${
                                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                              }`}>{formData.findings}</div>
                            </div>
                            
                            <div className={`p-4 rounded-xl border ${
                              theme === 'dark' 
                                ? 'bg-white/5 border-white/10' 
                                : 'bg-gray-50 border-gray-200'
                            }`}>
                              <h4 className={`font-medium mb-2 ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>Action Taken</h4>
                              <div className={`whitespace-pre-line ${
                                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                              }`}>{formData.action_taken || 'No action required'}</div>
                            </div>
                          </div>
                          
                          {(formData.remarks || formData.escalation_reason || formData.compliance_notes) && (
                            <div className={`p-4 rounded-xl border ${
                              theme === 'dark' 
                                ? 'bg-white/5 border-white/10' 
                                : 'bg-gray-50 border-gray-200'
                            }`}>
                              {formData.remarks && (
                                <div className="mb-4">
                                  <h4 className={`font-medium mb-2 ${
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>Remarks</h4>
                                  <div className={`whitespace-pre-line ${
                                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                  }`}>{formData.remarks}</div>
                                </div>
                              )}
                              
                              {formData.escalated && formData.escalation_reason && (
                                <div className="mb-4">
                                  <h4 className={`font-medium mb-2 ${
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>Escalation Reason</h4>
                                  <div className={`whitespace-pre-line ${
                                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                  }`}>{formData.escalation_reason}</div>
                                </div>
                              )}
                              
                              {formData.compliance_notes && (
                                <div>
                                  <h4 className={`font-medium mb-2 ${
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>Compliance Notes</h4>
                                  <div className={`whitespace-pre-line ${
                                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                  }`}>{formData.compliance_notes}</div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* AI Warning for True Positive with Low Confidence */}
                          {formData.disposition_type === 'TRUE_POSITIVE' && 
                           aiSuggestions && 
                           aiSuggestions.confidence < 0.7 && (
                            <div className={`p-4 rounded-xl border ${
                              theme === 'dark' 
                                ? 'bg-yellow-500/10 border-yellow-500/30' 
                                : 'bg-yellow-50 border-yellow-200'
                            }`}>
                              <div className="flex items-start gap-3">
                                <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                                }`} />
                                <div>
                                  <h4 className={`font-medium mb-1 ${
                                    theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'
                                  }`}>AI Confidence Warning</h4>
                                  <p className={`${
                                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                  }`}>
                                    You've marked this as a True Positive, but AI analysis has low confidence ({(aiSuggestions.confidence * 100).toFixed(1)}%). 
                                    Please ensure you've thoroughly reviewed the alert before submission.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Footer */}
                          <div className={`flex justify-between items-center pt-6 border-t ${
                            theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                          }`}>
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setStep('form')}
                              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                                theme === 'dark' 
                                  ? 'bg-white/10 hover:bg-white/20 text-white' 
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              }`}
                            >
                              <ChevronLeft className="w-5 h-5" />
                              Back to Edit
                            </motion.button>
                            
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleSubmit}
                              disabled={isSubmitting || alertLocked}
                              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                                alertLocked
                                  ? theme === 'dark'
                                    ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  : theme === 'dark'
                                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                                    : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                              }`}
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  <span>Processing...</span>
                                </>
                              ) : (
                                <>
                                  <Save className="w-5 h-5" />
                                  <span>Submit Disposition</span>
                                </>
                              )}
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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