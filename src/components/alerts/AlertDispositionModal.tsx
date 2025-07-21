import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  FileText, 
  Send, 
  Save, 
  Loader2, 
  ChevronRight, 
  ChevronDown, 
  AlertTriangle,
  Clock,
  Zap,
  Brain,
  ArrowRight,
  Lightbulb,
  Sparkles,
  BarChart3,
  Shield,
  ChevronLeft,
  Bot,
  BotMessageSquare
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../notifications';
import { AlertSummary, AlertDisposition } from '../../types/alerts';
import { logger } from '../../utils/logger';

// Disposition type labels
const DISPOSITION_LABELS = {
  "N": "No Action",
  "R": "Review Required",
  "E": "Escalate",
  "S": "Suspicious",
  "C": "Closed",
  "D": "Deferred",
  "P": "Positive Match",
  "X": "External Escalation"
};

// Risk category options
const RISK_CATEGORIES = ['HIGH', 'MEDIUM', 'LOW'];

interface AISuggestion {
  findings: string;
  analysis: string;
  action: string;
  remarks: string;
  confidence: number;
  similarity: number;
  auto_disposition: keyof typeof DISPOSITION_LABELS;
}

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
  
  const [step, setStep] = useState<'form' | 'review' | 'success'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [dispositionType, setDispositionType] = useState<'TRUE_POSITIVE' | 'FALSE_POSITIVE'>('TRUE_POSITIVE');
  const [riskCategory, setRiskCategory] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [findings, setFindings] = useState('');
  const [action, setAction] = useState('');
  const [remarks, setRemarks] = useState('');
  const [escalated, setEscalated] = useState(false);
  const [escalationReason, setEscalationReason] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [aiSuggestionUsed, setAiSuggestionUsed] = useState(false);
  
  // Reset form when alert changes
  useEffect(() => {
    if (alert) {
      setStep('form');
      setDispositionType('TRUE_POSITIVE');
      setRiskCategory('MEDIUM');
      setFindings('');
      setAction('');
      setRemarks('');
      setEscalated(false);
      setEscalationReason('');
      setFollowUpRequired(false);
      setFollowUpDate('');
      setAiSuggestion(null);
      setShowAiAnalysis(false);
      setAiSuggestionUsed(false);
    }
  }, [alert]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!alert) return;
    
    // Validate form
    if (!findings) {
      addNotification('Please enter findings', 'warning');
      return;
    }
    
    if (!action) {
      addNotification('Please enter action taken', 'warning');
      return;
    }
    
    if (escalated && !escalationReason) {
      addNotification('Please enter escalation reason', 'warning');
      return;
    }
    
    if (followUpRequired && !followUpDate) {
      addNotification('Please select follow-up date', 'warning');
      return;
    }
    
    // If AI suggestion was used with low confidence, confirm
    if (aiSuggestionUsed && aiSuggestion && aiSuggestion.confidence < 0.7) {
      const confirmed = window.confirm(
        'You are using AI suggestions with low confidence. Are you sure you want to continue?'
      );
      if (!confirmed) return;
    }
    
    // Move to review step
    setStep('review');
  };

  const handleConfirmDisposition = async () => {
    if (!alert || !user) return;
    
    setIsSubmitting(true);
    
    try {
      const disposition: AlertDisposition = {
        alert_id: alert.alert_id,
        disposition_type: dispositionType,
        risk_category: riskCategory,
        findings,
        remarks,
        action_taken: action,
        escalated,
        escalation_reason: escalated ? escalationReason : undefined,
        reviewed_by: user.username,
        reviewed_at: new Date().toISOString(),
        follow_up_required: followUpRequired,
        follow_up_date: followUpRequired ? followUpDate : undefined
      };
      
      const success = await onDispose(disposition);
      
      if (success) {
        setStep('success');
        
        // Log the disposition
        logger.info(
          `Alert ${alert.alert_id} disposed as ${dispositionType}`,
          user.full_name,
          { 
            alertId: alert.alert_id,
            dispositionType,
            riskCategory,
            aiSuggestionUsed,
            aiConfidence: aiSuggestion?.confidence
          }
        );
      } else {
        setStep('form');
        addNotification('Failed to save disposition', 'error');
      }
    } catch (error) {
      console.error('Error submitting disposition:', error);
      addNotification('An error occurred while saving disposition', 'error');
      setStep('form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const generateAISuggestions = async () => {
    if (!alert) return;
    
    setIsGeneratingAI(true);
    setAiSuggestion(null);
    
    try {
      // Prepare the payload with the required fields
      const payload = {
        rule_id: alert.rule_id,
        employee: "VARUNPAU",
        cashier_id: "VARUNPAU",
        reversal_count: 5, // Example value
        reversal_amount: "2500 AED", // Example value
        daily_volume: "12000 AED", // Example value
        registration_date: new Date().toISOString().split('T')[0],
        cust_code: alert.cust_code,
        branch_name: "DEIRA-CFE"
      };
      
      // Call the AI suggestions API
      const response = await fetch('http://0.0.0.0:8002/generate_suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Set the AI suggestion
      setAiSuggestion(data);
      setShowAiAnalysis(true);
      
      // Log the AI suggestion
      logger.info(
        'AI suggestion generated',
        user?.full_name,
        { 
          alertId: alert.alert_id,
          confidence: data.confidence,
          auto_disposition: data.auto_disposition,
          similarity: data.similarity
        }
      );
      
      // Show notification
      addNotification('AI suggestions generated successfully', 'success');
      
      // Show warning if confidence is low
      if (data.confidence < 0.7) {
        addNotification(
          'AI suggestions have low confidence. Please review carefully before using.',
          'warning'
        );
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      addNotification('Failed to generate AI suggestions', 'error');
      
      // Log the error
      logger.error(
        'AI suggestion generation failed',
        user?.full_name,
        { alertId: alert.alert_id, error },
        error instanceof Error ? error : new Error('AI suggestion failed')
      );
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const applyAiSuggestion = (field: 'findings' | 'action' | 'remarks') => {
    if (!aiSuggestion) return;
    
    switch (field) {
      case 'findings':
        setFindings(aiSuggestion.findings);
        break;
      case 'action':
        setAction(aiSuggestion.action);
        break;
      case 'remarks':
        setRemarks(aiSuggestion.remarks);
        break;
    }
    
    setAiSuggestionUsed(true);
    addNotification(`AI suggestion applied to ${field}`, 'success');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) {
      return theme === 'dark' ? 'text-green-300' : 'text-green-600';
    } else if (confidence >= 0.6) {
      return theme === 'dark' ? 'text-yellow-300' : 'text-yellow-600';
    } else {
      return theme === 'dark' ? 'text-red-300' : 'text-red-600';
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.8) {
      return theme === 'dark' 
        ? 'bg-green-500/20 text-green-300 border-green-500/30' 
        : 'bg-green-100 text-green-700 border-green-300';
    } else if (confidence >= 0.6) {
      return theme === 'dark' 
        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' 
        : 'bg-yellow-100 text-yellow-700 border-yellow-300';
    } else {
      return theme === 'dark' 
        ? 'bg-red-500/20 text-red-300 border-red-500/30' 
        : 'bg-red-100 text-red-700 border-red-300';
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
              >
                {/* Header */}
                <div className={`p-6 border-b ${
                  theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className={`text-2xl font-bold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>Alert Disposition</h2>
                        <p className={`${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }`}>
                          Review and disposition for alert
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

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <AnimatePresence mode="wait">
                    {step === 'form' && (
                      <motion.form
                        key="form"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        onSubmit={handleSubmit}
                        className="space-y-6"
                      >
                        {/* Alert Summary */}
                        <div className={`rounded-xl border p-4 ${
                          theme === 'dark' 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <h3 className={`text-lg font-semibold mb-4 ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Alert Summary</h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <div className={`text-sm font-medium mb-1 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Service Type</div>
                              <div className={`font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>{alert.service_type}</div>
                            </div>
                            
                            <div>
                              <div className={`text-sm font-medium mb-1 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Timestamp</div>
                              <div className={`font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>{new Date(alert.time_stamp).toLocaleString()}</div>
                            </div>
                            
                            <div>
                              <div className={`text-sm font-medium mb-1 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Priority</div>
                              <div className={`font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>{alert.priority || 'MEDIUM'}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <div className={`text-sm font-medium mb-1 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Alert ID</div>
                              <div className={`font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>{alert.alert_id}</div>
                            </div>
                            
                            <div>
                              <div className={`text-sm font-medium mb-1 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Status</div>
                              <div className={`font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>{alert.status || 'OPEN'}</div>
                            </div>
                          </div>
                          
                          <div>
                            <div className={`text-sm font-medium mb-1 ${
                              theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                            }`}>Rule Remarks</div>
                            <div className={`${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>{alert.rule_remarks}</div>
                          </div>
                        </div>

                        {/* Customer Information */}
                        <div className={`rounded-xl border p-4 ${
                          theme === 'dark' 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <h3 className={`text-lg font-semibold mb-4 ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Customer Information</h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className={`text-sm font-medium mb-1 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Customer Name</div>
                              <div className={`font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>{alert.cust_name}</div>
                            </div>
                            
                            <div>
                              <div className={`text-sm font-medium mb-1 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Customer Code</div>
                              <div className={`font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>{alert.cust_code}</div>
                            </div>
                          </div>
                        </div>

                        {/* Rule Information */}
                        <div className={`rounded-xl border p-4 ${
                          theme === 'dark' 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <h3 className={`text-lg font-semibold mb-4 ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Rule Information</h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <div className={`text-sm font-medium mb-1 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Rule ID</div>
                              <div className={`font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>{alert.rule_id}</div>
                            </div>
                            
                            <div>
                              <div className={`text-sm font-medium mb-1 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Branch Name</div>
                              <div className={`font-semibold ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>{alert.branch_name || 'N/A'}</div>
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            <div className={`text-sm font-medium mb-1 ${
                              theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                            }`}>Rule Description</div>
                            <div className={`${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>{alert.rule_desc}</div>
                          </div>
                        </div>

                        {/* AI Suggestions */}
                        <div className={`rounded-xl border p-4 ${
                          theme === 'dark' 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className={`text-lg font-semibold flex items-center gap-2 ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                              <Bot className="w-5 h-5 text-purple-400" />
                              AI Suggestions
                            </h3>
                            
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={generateAISuggestions}
                              disabled={isGeneratingAI}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                theme === 'dark' 
                                  ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30' 
                                  : 'bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300'
                              }`}
                            >
                              {isGeneratingAI ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Generating...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  <span>Generate</span>
                                </>
                              )}
                            </motion.button>
                          </div>
                          
                          {aiSuggestion ? (
                            <div className="space-y-4">
                              {/* AI Analysis */}
                              <div className={`p-4 rounded-lg border ${
                                theme === 'dark' 
                                  ? 'bg-purple-500/10 border-purple-500/20' 
                                  : 'bg-purple-50 border-purple-200'
                              }`}>
                                <div className="flex justify-between items-start">
                                  <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg ${
                                      theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
                                    }`}>
                                      <Brain className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <div>
                                      <div className={`font-medium ${
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      }`}>AI Analysis</div>
                                      <div className={`text-sm mt-1 ${
                                        theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                                      }`}>{aiSuggestion.analysis}</div>
                                    </div>
                                  </div>
                                  <div className={`px-2 py-1 text-xs font-medium rounded-full border whitespace-nowrap ${
                                    getConfidenceBadgeColor(aiSuggestion.confidence)
                                  }`}>
                                    {getConfidenceLabel(aiSuggestion.confidence)} : ({Math.round(aiSuggestion.confidence * 100)}%)
                                  </div>
                                </div>
                                
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-purple-500/20">
                                  <div className={`text-xs ${
                                    theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                                  }`}>
                                    Recommended Disposition: <span className="font-medium">{DISPOSITION_LABELS[aiSuggestion.auto_disposition]}</span>
                                  </div>
                                  <div className={`text-xs ${
                                    theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                                  }`}>
                                    Similarity: {Math.round(aiSuggestion.similarity * 100)}%
                                  </div>
                                </div>
                              </div>
                              
                              {/* Findings */}
                              <div className={`p-4 rounded-lg border ${
                                theme === 'dark' 
                                  ? 'bg-blue-500/10 border-blue-500/20' 
                                  : 'bg-blue-50 border-blue-200'
                              }`}>
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-blue-400" />
                                    <span className={`font-medium ${
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>Suggested Findings</span>
                                  </div>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => applyAiSuggestion('findings')}
                                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                                      theme === 'dark' 
                                        ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' 
                                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                    }`}
                                  >
                                    Use Suggestion
                                  </motion.button>
                                </div>
                                <div className={`text-sm ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>
                                  {aiSuggestion.findings}
                                </div>
                              </div>
                              
                              {/* Action */}
                              <div className={`p-4 rounded-lg border ${
                                theme === 'dark' 
                                  ? 'bg-green-500/10 border-green-500/20' 
                                  : 'bg-green-50 border-green-200'
                              }`}>
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-green-400" />
                                    <span className={`font-medium ${
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>Suggested Action</span>
                                  </div>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => applyAiSuggestion('action')}
                                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                                      theme === 'dark' 
                                        ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300' 
                                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                                    }`}
                                  >
                                    Use Suggestion
                                  </motion.button>
                                </div>
                                <div className={`text-sm ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>
                                  {aiSuggestion.action}
                                </div>
                              </div>
                              
                              {/* Remarks */}
                              <div className={`p-4 rounded-lg border ${
                                theme === 'dark' 
                                  ? 'bg-orange-500/10 border-orange-500/20' 
                                  : 'bg-orange-50 border-orange-200'
                              }`}>
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-orange-400" />
                                    <span className={`font-medium ${
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>Suggested Remarks</span>
                                  </div>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => applyAiSuggestion('remarks')}
                                    className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                                      theme === 'dark' 
                                        ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300' 
                                        : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                                    }`}
                                  >
                                    Use Suggestion
                                  </motion.button>
                                </div>
                                <div className={`text-sm ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                                }`}>
                                  {aiSuggestion.remarks}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className={`p-6 text-center ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>
                              <BotMessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                              <p>Generate AI suggestions to help with alert disposition</p>
                              <p className="text-sm mt-2">
                                AI will analyze the alert and provide recommendations for findings, actions, and disposition
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Disposition Form */}
                        <div className={`rounded-xl border p-4 ${
                          theme === 'dark' 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <h3 className={`text-lg font-semibold mb-4 ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Disposition Details</h3>
                          
                          {/* Disposition Type */}
                          <div className="mb-4">
                            <label className={`block text-sm font-medium mb-2 ${
                              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                            }`}>Disposition Type</label>
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => setDispositionType('TRUE_POSITIVE')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  dispositionType === 'TRUE_POSITIVE'
                                    ? theme === 'dark'
                                      ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                                      : 'bg-red-100 text-red-700 border border-red-300'
                                    : theme === 'dark'
                                      ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20'
                                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  <span>True Positive</span>
                                </div>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => setDispositionType('FALSE_POSITIVE')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  dispositionType === 'FALSE_POSITIVE'
                                    ? theme === 'dark'
                                      ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                                      : 'bg-green-100 text-green-700 border border-green-300'
                                    : theme === 'dark'
                                      ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20'
                                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4" />
                                  <span>False Positive</span>
                                </div>
                              </button>
                            </div>
                          </div>
                          
                          {/* Risk Category */}
                          <div className="mb-4">
                            <label className={`block text-sm font-medium mb-2 ${
                              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                            }`}>Risk Category</label>
                            <div className="flex flex-wrap gap-3">
                              {RISK_CATEGORIES.map((category) => (
                                <button
                                  key={category}
                                  type="button"
                                  onClick={() => setRiskCategory(category as 'HIGH' | 'MEDIUM' | 'LOW')}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    riskCategory === category
                                      ? category === 'HIGH'
                                        ? theme === 'dark'
                                          ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                                          : 'bg-red-100 text-red-700 border border-red-300'
                                        : category === 'MEDIUM'
                                          ? theme === 'dark'
                                            ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                                            : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                          : theme === 'dark'
                                            ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                                            : 'bg-green-100 text-green-700 border border-green-300'
                                      : theme === 'dark'
                                        ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20'
                                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                  }`}
                                >
                                  {category}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Findings */}
                          <div className="mb-4">
                            <label className={`block text-sm font-medium mb-2 ${
                              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                            }`}>Findings</label>
                            <textarea
                              value={findings}
                              onChange={(e) => setFindings(e.target.value)}
                              rows={4}
                              className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                theme === 'dark' 
                                  ? 'bg-white/10 border border-white/20 text-white' 
                                  : 'bg-white border border-gray-300 text-gray-900'
                              }`}
                              placeholder="Enter your findings..."
                            />
                          </div>
                          
                          {/* Action Taken */}
                          <div className="mb-4">
                            <label className={`block text-sm font-medium mb-2 ${
                              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                            }`}>Action Taken</label>
                            <textarea
                              value={action}
                              onChange={(e) => setAction(e.target.value)}
                              rows={3}
                              className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                theme === 'dark' 
                                  ? 'bg-white/10 border border-white/20 text-white' 
                                  : 'bg-white border border-gray-300 text-gray-900'
                              }`}
                              placeholder="Describe actions taken..."
                            />
                          </div>
                          
                          {/* Remarks */}
                          <div className="mb-4">
                            <label className={`block text-sm font-medium mb-2 ${
                              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                            }`}>Remarks</label>
                            <textarea
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                              rows={2}
                              className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                theme === 'dark' 
                                  ? 'bg-white/10 border border-white/20 text-white' 
                                  : 'bg-white border border-gray-300 text-gray-900'
                              }`}
                              placeholder="Additional remarks..."
                            />
                          </div>
                          
                          {/* Escalation */}
                          <div className="mb-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="escalated"
                                checked={escalated}
                                onChange={(e) => setEscalated(e.target.checked)}
                                className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                              />
                              <label htmlFor="escalated" className={`text-sm font-medium ${
                                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                              }`}>
                                Escalate to Compliance
                              </label>
                            </div>
                            
                            {escalated && (
                              <div className="mt-3">
                                <textarea
                                  value={escalationReason}
                                  onChange={(e) => setEscalationReason(e.target.value)}
                                  rows={2}
                                  className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    theme === 'dark' 
                                      ? 'bg-white/10 border border-white/20 text-white' 
                                      : 'bg-white border border-gray-300 text-gray-900'
                                  }`}
                                  placeholder="Reason for escalation..."
                                />
                              </div>
                            )}
                          </div>
                          
                          {/* Follow-up */}
                          <div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="followUp"
                                checked={followUpRequired}
                                onChange={(e) => setFollowUpRequired(e.target.checked)}
                                className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                              />
                              <label htmlFor="followUp" className={`text-sm font-medium ${
                                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                              }`}>
                                Follow-up Required
                              </label>
                            </div>
                            
                            {followUpRequired && (
                              <div className="mt-3">
                                <input
                                  type="date"
                                  value={followUpDate}
                                  onChange={(e) => setFollowUpDate(e.target.value)}
                                  min={new Date().toISOString().split('T')[0]}
                                  className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    theme === 'dark' 
                                      ? 'bg-white/10 border border-white/20 text-white' 
                                      : 'bg-white border border-gray-300 text-gray-900'
                                  }`}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end">
                          <motion.button
                            type="submit"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg"
                          >
                            <Send className="w-5 h-5" />
                            Review Disposition
                          </motion.button>
                        </div>
                      </motion.form>
                    )}

                    {step === 'review' && (
                      <motion.div
                        key="review"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                      >
                        <div className={`rounded-xl border p-6 ${
                          theme === 'dark' 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <h3 className={`text-lg font-semibold mb-6 ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Review Disposition</h3>
                          
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <div className={`text-sm font-medium mb-2 ${
                                  theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                                }`}>Disposition Type</div>
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                  dispositionType === 'TRUE_POSITIVE'
                                    ? theme === 'dark'
                                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                      : 'bg-red-100 text-red-700 border border-red-300'
                                    : theme === 'dark'
                                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                      : 'bg-green-100 text-green-700 border border-green-300'
                                }`}>
                                  {dispositionType === 'TRUE_POSITIVE' ? (
                                    <>
                                      <AlertCircle className="w-4 h-4" />
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
                              
                              <div>
                                <div className={`text-sm font-medium mb-2 ${
                                  theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                                }`}>Risk Category</div>
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                  riskCategory === 'HIGH'
                                    ? theme === 'dark'
                                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                      : 'bg-red-100 text-red-700 border border-red-300'
                                    : riskCategory === 'MEDIUM'
                                      ? theme === 'dark'
                                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                        : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                      : theme === 'dark'
                                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                        : 'bg-green-100 text-green-700 border border-green-300'
                                }`}>
                                  {riskCategory}
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <div className={`text-sm font-medium mb-2 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Findings</div>
                              <div className={`p-4 rounded-lg ${
                                theme === 'dark' ? 'bg-white/10' : 'bg-white'
                              }`}>
                                <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                  {findings}
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <div className={`text-sm font-medium mb-2 ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>Action Taken</div>
                              <div className={`p-4 rounded-lg ${
                                theme === 'dark' ? 'bg-white/10' : 'bg-white'
                              }`}>
                                <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                  {action}
                                </p>
                              </div>
                            </div>
                            
                            {remarks && (
                              <div>
                                <div className={`text-sm font-medium mb-2 ${
                                  theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                                }`}>Remarks</div>
                                <div className={`p-4 rounded-lg ${
                                  theme === 'dark' ? 'bg-white/10' : 'bg-white'
                                }`}>
                                  <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                    {remarks}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {escalated && (
                              <div>
                                <div className={`text-sm font-medium mb-2 ${
                                  theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                                }`}>Escalation Reason</div>
                                <div className={`p-4 rounded-lg ${
                                  theme === 'dark' ? 'bg-white/10' : 'bg-white'
                                }`}>
                                  <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                    {escalationReason}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {followUpRequired && (
                              <div>
                                <div className={`text-sm font-medium mb-2 ${
                                  theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                                }`}>Follow-up Date</div>
                                <div className={`p-4 rounded-lg ${
                                  theme === 'dark' ? 'bg-white/10' : 'bg-white'
                                }`}>
                                  <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                    {new Date(followUpDate).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {aiSuggestionUsed && aiSuggestion && (
                              <div className={`p-4 rounded-lg border ${
                                theme === 'dark' 
                                  ? 'bg-purple-500/10 border-purple-500/20' 
                                  : 'bg-purple-50 border-purple-200'
                              }`}>
                                <div className="flex items-center gap-2">
                                  <Brain className="w-4 h-4 text-purple-400" />
                                  <span className={`text-sm font-medium ${
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>AI</span>
                                </div>
                                <div className={`text-xs mt-1 ${
                                  theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                                }`}>
                                  AI suggestions with {Math.round(aiSuggestion.confidence * 100)}% confidence were used in this disposition.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex justify-between">
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
                            onClick={handleConfirmDisposition}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Submitting...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-5 h-5" />
                                <span>Confirm & Submit</span>
                              </>
                            )}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {step === 'success' && (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center py-10"
                      >
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                          className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl"
                        >
                          <CheckCircle className="w-10 h-10 text-white" />
                        </motion.div>
                        
                        <h3 className={`text-2xl font-bold mb-2 ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          Disposition Submitted
                        </h3>
                        
                        <p className={`mb-6 ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }`}>
                          The alert has been successfully dispositioned
                        </p>
                        
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleClose}
                          className={`px-6 py-3 rounded-xl transition-colors ${
                            theme === 'dark' 
                              ? 'bg-white/10 hover:bg-white/20 text-white' 
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          Close
                        </motion.button>
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