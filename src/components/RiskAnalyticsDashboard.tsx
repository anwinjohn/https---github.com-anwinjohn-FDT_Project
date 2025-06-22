import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  Users, 
  Building, 
  TrendingUp, 
  Network,
  Eye,
  FileText,
  Target,
  Globe,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  DollarSign,
  UserCheck,
  MapPin,
  Briefcase,
  CreditCard,
  Loader2,
  AlertCircle,
  RefreshCw,
  BarChart3,
  PieChart,
  Calendar,
  Gauge
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Cell } from 'recharts';
import { useRiskAnalytics } from '../hooks/useRiskAnalytics';
import { DateRange } from '../types/types';
import { useTheme } from '../context/ThemeContext';
import { formatNumber } from '../utils/formatters';

interface RiskAnalyticsDashboardProps {
  dateRange: DateRange;
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Risk Analytics Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-2">Something went wrong</h3>
            <p className="text-white/60 text-sm">Unable to display this section. Please try refreshing.</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Safe data access helper
const safeGet = (obj: any, path: string, defaultValue: any = null) => {
  try {
    return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
  } catch {
    return defaultValue;
  }
};

// Empty state component
const EmptyState: React.FC<{ 
  icon: React.ComponentType<any>; 
  title: string; 
  description: string;
  action?: () => void;
  actionLabel?: string;
}> = ({ icon: Icon, title, description, action, actionLabel }) => {
  const { theme } = useTheme();
  
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className={`p-4 rounded-2xl ${
        theme === 'dark' 
          ? 'bg-white/10 border border-white/20' 
          : 'bg-gray-100 border border-gray-200'
      }`}>
        <Icon className={`w-12 h-12 ${
          theme === 'dark' ? 'text-white/40' : 'text-gray-400'
        }`} />
      </div>
      <div className="text-center max-w-md">
        <h3 className={`text-lg font-semibold mb-2 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>{title}</h3>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
        }`}>{description}</p>
        {action && actionLabel && (
          <button
            onClick={action}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

const RiskAnalyticsDashboard: React.FC<RiskAnalyticsDashboardProps> = ({ dateRange }) => {
  const { data, isLoading, error, lastUpdated, refreshData } = useRiskAnalytics(dateRange);
  const [activeTab, setActiveTab] = useState('overview');
  const { theme } = useTheme();

  const tabs = [
    { id: 'overview', label: 'Executive Overview', icon: Gauge },
    { id: 'customers', label: 'Customer Risk', icon: Users },
    { id: 'transactions', label: 'Transaction Analysis', icon: CreditCard },
    { id: 'network', label: 'Network Analysis', icon: Network },
    { id: 'temporal', label: 'Temporal Patterns', icon: BarChart3 },
    { id: 'actions', label: 'Action Items', icon: Target }
  ];

  // Safe data extraction with fallbacks
  const safeData = useMemo(() => {
    if (!data) return null;
    
    return {
      executiveSummary: safeGet(data, 'executive_summary', {}),
      metadata: safeGet(data, 'metadata', {}),
      keyRiskIndicators: safeGet(data, 'key_risk_indicators', {}),
      customerRiskAnalysis: safeGet(data, 'customer_risk_analysis', {}),
      transactionAnalysis: safeGet(data, 'transaction_analysis', {}),
      networkAnalysis: safeGet(data, 'network_analysis', {}),
      temporalAnalysis: safeGet(data, 'temporal_analysis', {}),
      predictiveInsights: safeGet(data, 'predictive_insights', {}),
      actionableRecommendations: safeGet(data, 'actionable_recommendations', [])
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
        <Loader2 className="w-12 h-12 text-red-400 animate-spin" />
        <div className="text-center">
          <div className={`font-medium text-lg ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Loading Risk Analytics...</div>
          <div className={`text-sm mt-1 ${
            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
          }`}>Analyzing fraud patterns and risk indicators</div>
        </div>
      </div>
    );
  }

  if (error || !safeData) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2 className={`text-2xl font-bold mb-2 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>Unable to Load Risk Analytics</h2>
        <p className={`mb-6 ${
          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
        }`}>{error || 'No data available for the selected period'}</p>
        <button
          onClick={refreshData}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-5 h-5" />
          Retry
        </button>
      </div>
    );
  }

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-400 bg-red-500/20';
    if (score >= 60) return 'text-orange-400 bg-orange-500/20';
    if (score >= 40) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-green-400 bg-green-500/20';
  };

  const getRiskLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'critical': return 'text-red-400 bg-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-green-400 bg-green-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const renderOverviewTab = () => {
    const executiveSummary = safeData.executiveSummary;
    const keyRiskIndicators = safeData.keyRiskIndicators;
    const metadata = safeData.metadata;

    return (
      <ErrorBoundary>
        <div className="space-y-8">
          {/* Executive Summary Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-8 ${
              theme === 'dark' 
                ? 'bg-gradient-to-br from-red-500/10 via-orange-500/5 to-yellow-500/10 border-red-500/20' 
                : 'bg-gradient-to-br from-red-50 via-orange-25 to-yellow-50 border-red-200'
            } backdrop-blur-xl shadow-2xl`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl shadow-lg">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className={`text-3xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Fraud & Risk Analytics</h1>
                  <p className={`text-lg ${
                    theme === 'dark' ? 'text-red-200/80' : 'text-red-700'
                  }`}> Risk Dashboard</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-sm ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>Report Period</div>
                <div className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {safeGet(metadata, 'analysis_period.start', 'N/A')} - {safeGet(metadata, 'analysis_period.end', 'N/A')}
                </div>
                {lastUpdated && (
                  <div className={`text-xs mt-1 flex items-center gap-1 ${
                    theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                  }`}>
                    <Clock className="w-3 h-3" />
                    Updated: {lastUpdated.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            {/* Risk Score and Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className={`p-6 rounded-xl border text-center ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-red-500/20 to-red-500/10 border-red-500/30' 
                    : 'bg-gradient-to-br from-red-100 to-red-50 border-red-300'
                }`}
              >
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Gauge className="w-6 h-6 text-red-400" />
                  <span className={`font-semibold ${
                    theme === 'dark' ? 'text-red-300' : 'text-red-700'
                  }`}>Overall Risk Score</span>
                </div>
                <div className={`text-4xl font-bold mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{safeGet(executiveSummary, 'overall_risk_score', 0)}</div>
                <div className={`text-sm ${
                  theme === 'dark' ? 'text-red-200/70' : 'text-red-600'
                }`}>
                  Trend: {safeGet(executiveSummary, 'risk_trend', 'Unknown')}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className={`p-6 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-orange-500/20 to-orange-500/10 border-orange-500/30' 
                    : 'bg-gradient-to-br from-orange-100 to-orange-50 border-orange-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-6 h-6 text-orange-400" />
                  <span className={`font-semibold ${
                    theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                  }`}>Total Alerts</span>
                </div>
                <div className={`text-3xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{formatNumber(safeGet(keyRiskIndicators, 'volume_metrics.total_alerts', 0))}</div>
                <div className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-orange-200/70' : 'text-orange-600'
                }`}>Active fraud alerts</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className={`p-6 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-500/10 border-yellow-500/30' 
                    : 'bg-gradient-to-br from-yellow-100 to-yellow-50 border-yellow-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-6 h-6 text-yellow-400" />
                  <span className={`font-semibold ${
                    theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'
                  }`}>Critical Customers</span>
                </div>
                <div className={`text-3xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{safeGet(keyRiskIndicators, 'customer_risk.critical', 0)}</div>
                <div className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-yellow-200/70' : 'text-yellow-600'
                }`}>Requiring immediate attention</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className={`p-6 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-purple-500/30' 
                    : 'bg-gradient-to-br from-purple-100 to-purple-50 border-purple-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Building className="w-6 h-6 text-purple-400" />
                  <span className={`font-semibold ${
                    theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                  }`}>High-Risk Branches</span>
                </div>
                <div className={`text-3xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{safeGet(keyRiskIndicators, 'branch_risk.high_risk_branches', 0)}</div>
                <div className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-purple-200/70' : 'text-purple-600'
                }`}>Requiring audit</div>
              </motion.div>
            </div>
          </motion.div>

          {/* Key Findings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`rounded-2xl border p-6 ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/20' 
                : 'bg-white border-gray-200'
            } backdrop-blur-xl shadow-2xl`}
          >
            <h2 className={`text-xl font-bold mb-6 flex items-center gap-3 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              <FileText className="w-6 h-6 text-blue-400" />
              Key Findings
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(safeGet(executiveSummary, 'key_findings', []) || []).map((finding: string, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/10' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="p-1 bg-green-500/20 rounded-full mt-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  </div>
                  <span className={`text-sm ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>{finding}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </ErrorBoundary>
    );
  };

  const renderCustomersTab = () => {
    const customerRiskAnalysis = safeData.customerRiskAnalysis;
    const criticalCustomers = safeGet(customerRiskAnalysis, 'critical_customers', []);
    const emergingRisks = safeGet(customerRiskAnalysis, 'emerging_risks', {});

    return (
      <ErrorBoundary>
        <div className="space-y-8">
          {criticalCustomers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Critical Customers Found"
              description="No customers with critical risk levels were identified in the current analysis period."
              action={refreshData}
              actionLabel="Refresh Data"
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-6 ${
                theme === 'dark' 
                  ? 'bg-white/5 border-white/20' 
                  : 'bg-white border-gray-200'
              } backdrop-blur-xl shadow-2xl`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className={`text-lg font-bold flex items-center gap-3 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  <Target className="w-5 h-5 text-red-400" />
                  Critical Risk Customers ({criticalCustomers.length})
                </h3>
              </div>

              <div className="space-y-4">
                {criticalCustomers.map((customer: any, index: number) => (
                  <motion.div
                    key={customer.customer_id || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] ${
                      theme === 'dark' 
                        ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/20 hover:border-red-500/40' 
                        : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200 hover:border-red-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className={`font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{safeGet(customer, 'name', 'Unknown Customer')}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Briefcase className="w-3 h-3 text-gray-400" />
                          <span className={`text-xs ${
                            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                          }`}>{safeGet(customer, 'profession', 'Unknown')}</span>
                        </div>
                      </div>
                      <span className="px-2 py-1 text-xs font-bold bg-red-500/20 text-red-300 rounded-full">
                        CRITICAL
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-red-300' : 'text-red-600'
                        }`}>{safeGet(customer, 'activity_summary.alert_count', 0)}</div>
                        <div className={`text-xs ${
                          theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                        }`}>Alerts</div>
                      </div>
                      <div>
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-orange-300' : 'text-orange-600'
                        }`}>{safeGet(customer, 'activity_summary.beneficiary_count', 0)}</div>
                        <div className={`text-xs ${
                          theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                        }`}>Beneficiaries</div>
                      </div>
                      <div>
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-green-300' : 'text-green-600'
                        }`}>AED {formatNumber(safeGet(customer, 'activity_summary.total_amount', 0))}</div>
                        <div className={`text-xs ${
                          theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                        }`}>Total Amount</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </ErrorBoundary>
    );
  };

  const renderTransactionsTab = () => {
    const transactionAnalysis = safeData.transactionAnalysis;
    const patternDetection = safeGet(transactionAnalysis, 'pattern_detection', {});
    const highFrequency = safeGet(patternDetection, 'high_frequency', []);
    const highValue = safeGet(patternDetection, 'high_value', []);
    const unusualTiming = safeGet(patternDetection, 'unusual_timing', {});

    const hasData = highFrequency.length > 0 || highValue.length > 0 || 
                   safeGet(unusualTiming, 'off_hour_transactions', 0) > 0;

    return (
      <ErrorBoundary>
        <div className="space-y-8">
          {!hasData ? (
            <EmptyState
              icon={CreditCard}
              title="No Transaction Patterns Found"
              description="No suspicious transaction patterns were detected in the current analysis period."
              action={refreshData}
              actionLabel="Refresh Data"
            />
          ) : (
            <>
              {/* High-Frequency Patterns */}
              {highFrequency.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border p-6 ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/20' 
                      : 'bg-white border-gray-200'
                  } backdrop-blur-xl shadow-2xl`}
                >
                  <h3 className={`text-lg font-bold flex items-center gap-3 mb-6 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Zap className="w-5 h-5 text-yellow-400" />
                    High-Frequency Transaction Patterns
                  </h3>

                  <div className="space-y-4">
                    {highFrequency.map((pattern: any, index: number) => (
                      <motion.div
                        key={pattern.customer_id || index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-xl border ${
                          theme === 'dark' 
                            ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/20' 
                            : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className={`font-semibold ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Customer ID: {safeGet(pattern, 'customer_id', 'Unknown')}</div>
                            <div className={`text-sm ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>Pattern: {safeGet(pattern, 'pattern_type', 'Unknown')}</div>
                          </div>
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            theme === 'dark' 
                              ? 'bg-yellow-500/20 text-yellow-300' 
                              : 'bg-yellow-200 text-yellow-700'
                          }`}>
                            HIGH FREQUENCY
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-yellow-300' : 'text-yellow-600'
                            }`}>{formatNumber(safeGet(pattern, 'characteristics.count', 0))}</div>
                            <div className={`text-xs ${
                              theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                            }`}>Transactions</div>
                          </div>
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-orange-300' : 'text-orange-600'
                            }`}>AED {formatNumber(safeGet(pattern, 'characteristics.total_amount', 0))}</div>
                            <div className={`text-xs ${
                              theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                            }`}>Total Amount</div>
                          </div>
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-green-300' : 'text-green-600'
                            }`}>{safeGet(pattern, 'characteristics.service_type', 'Unknown')}</div>
                            <div className={`text-xs ${
                              theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                            }`}>Service Type</div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* High-Value Transactions */}
              {highValue.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`rounded-2xl border p-6 ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/20' 
                      : 'bg-white border-gray-200'
                  } backdrop-blur-xl shadow-2xl`}
                >
                  <h3 className={`text-lg font-bold flex items-center gap-3 mb-6 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <DollarSign className="w-5 h-5 text-green-400" />
                    High-Value Transactions
                  </h3>

                  <div className="space-y-4">
                    {highValue.map((transaction: any, index: number) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-xl border ${
                          theme === 'dark' 
                            ? 'bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500/20' 
                            : 'bg-gradient-to-r from-green-50 to-blue-50 border-green-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className={`font-semibold ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>{safeGet(transaction, 'customer_name', 'Unknown Customer')}</div>
                            <div className={`text-sm ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>Type: {safeGet(transaction, 'transaction_type', 'Unknown')}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold text-lg ${
                              theme === 'dark' ? 'text-green-300' : 'text-green-600'
                            }`}>AED {formatNumber(safeGet(transaction, 'characteristics.amount', 0))}</div>
                            <div className={`text-xs ${
                              theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                            }`}>{safeGet(transaction, 'characteristics.service_type', 'Unknown')}</div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Unusual Timing */}
              {(safeGet(unusualTiming, 'off_hour_transactions', 0) > 0 || safeGet(unusualTiming, 'weekend_transactions', 0) > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className={`rounded-2xl border p-6 ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/20' 
                      : 'bg-white border-gray-200'
                  } backdrop-blur-xl shadow-2xl`}
                >
                  <h3 className={`text-lg font-bold flex items-center gap-3 mb-6 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Clock className="w-5 h-5 text-purple-400" />
                    Unusual Timing Patterns
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`p-4 rounded-xl border ${
                      theme === 'dark' 
                        ? 'bg-purple-500/10 border-purple-500/20' 
                        : 'bg-purple-100 border-purple-300'
                    }`}>
                      <div className={`text-2xl font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{formatNumber(safeGet(unusualTiming, 'off_hour_transactions', 0))}</div>
                      <div className={`text-sm ${
                        theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                      }`}>Off-Hour Transactions</div>
                    </div>
                    
                    <div className={`p-4 rounded-xl border ${
                      theme === 'dark' 
                        ? 'bg-indigo-500/10 border-indigo-500/20' 
                        : 'bg-indigo-100 border-indigo-300'
                    }`}>
                      <div className={`text-2xl font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{formatNumber(safeGet(unusualTiming, 'weekend_transactions', 0))}</div>
                      <div className={`text-sm ${
                        theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'
                      }`}>Weekend Transactions</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </ErrorBoundary>
    );
  };

  const renderNetworkTab = () => {
    const networkAnalysis = safeData.networkAnalysis;
    const clusterAnalysis = safeGet(networkAnalysis, 'cluster_analysis', []);
    const centralActors = safeGet(networkAnalysis, 'central_actors', []);

    const hasData = clusterAnalysis.length > 0 || centralActors.length > 0;

    return (
      <ErrorBoundary>
        <div className="space-y-8">
          {!hasData ? (
            <EmptyState
              icon={Network}
              title="No Network Patterns Found"
              description="No suspicious network clusters or central actors were identified in the current analysis period."
              action={refreshData}
              actionLabel="Refresh Data"
            />
          ) : (
            <>
              {/* Suspicious Clusters */}
              {clusterAnalysis.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border p-6 ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/20' 
                      : 'bg-white border-gray-200'
                  } backdrop-blur-xl shadow-2xl`}
                >
                  <h3 className={`text-lg font-bold flex items-center gap-3 mb-6 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Network className="w-5 h-5 text-purple-400" />
                    Suspicious Network Clusters ({clusterAnalysis.length})
                  </h3>

                  <div className="space-y-4">
                    {clusterAnalysis.slice(0, 5).map((cluster: any, index: number) => (
                      <motion.div
                        key={cluster.cluster_id || index}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-xl border ${
                          theme === 'dark' 
                            ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20' 
                            : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
                        }`}
                      >
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className={`font-semibold ${
                              theme === 'dark' ? 'text-purple-300' : 'text-purple-600'
                            }`}>{safeGet(cluster, 'characteristics.customer_count', 0)} Customers</div>
                            <div className={`text-sm ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>{safeGet(cluster, 'characteristics.total_transactions', 0)} transactions</div>
                          </div>
                          <div>
                            <div className={`font-semibold ${
                              theme === 'dark' ? 'text-pink-300' : 'text-pink-600'
                            }`}>AED {formatNumber(safeGet(cluster, 'characteristics.total_amount', 0))}</div>
                            <div className={`text-sm ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>Total value</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <span className={`text-xs font-medium ${
                              theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                            }`}>Branches: </span>
                            <span className={`text-xs ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>{safeGet(cluster, 'characteristics.common_attributes.branches', []).join(', ') || 'N/A'}</span>
                          </div>
                          <div>
                            <span className={`text-xs font-medium ${
                              theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                            }`}>Countries: </span>
                            <span className={`text-xs ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>{safeGet(cluster, 'characteristics.common_attributes.countries', []).join(', ') || 'N/A'}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Central Actors */}
              {centralActors.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`rounded-2xl border p-6 ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/20' 
                      : 'bg-white border-gray-200'
                  } backdrop-blur-xl shadow-2xl`}
                >
                  <h3 className={`text-lg font-bold flex items-center gap-3 mb-6 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Users className="w-5 h-5 text-orange-400" />
                    Central Network Actors ({centralActors.length})
                  </h3>

                  <div className="space-y-4">
                    {centralActors.slice(0, 5).map((actor: any, index: number) => (
                      <motion.div
                        key={actor.customer_code || index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-xl border ${
                          theme === 'dark' 
                            ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20' 
                            : 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className={`font-semibold ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>{safeGet(actor, 'customer_name', 'Unknown Customer')}</div>
                            <div className={`text-sm ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>Risk: {safeGet(actor, 'risk_implications', 'Unknown')}</div>
                          </div>
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            theme === 'dark' 
                              ? 'bg-orange-500/20 text-orange-300' 
                              : 'bg-orange-200 text-orange-700'
                          }`}>
                            CENTRAL ACTOR
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-orange-300' : 'text-orange-600'
                            }`}>{formatNumber(safeGet(actor, 'transaction_summary.total_transactions', 0))}</div>
                            <div className={`text-xs ${
                              theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                            }`}>Transactions</div>
                          </div>
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-red-300' : 'text-red-600'
                            }`}>{formatNumber(safeGet(actor, 'transaction_summary.beneficiary_count', 0))}</div>
                            <div className={`text-xs ${
                              theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                            }`}>Beneficiaries</div>
                          </div>
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-green-300' : 'text-green-600'
                            }`}>AED {formatNumber(safeGet(actor, 'transaction_summary.total_amount', 0))}</div>
                            <div className={`text-xs ${
                              theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                            }`}>Total Amount</div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </ErrorBoundary>
    );
  };

  const renderTemporalTab = () => {
    const temporalAnalysis = safeData.temporalAnalysis;
    const alertTrends = safeGet(temporalAnalysis, 'alert_trends', {});
    const dailyPattern = safeGet(alertTrends, 'daily_pattern', []);
    const hourlyPattern = safeGet(alertTrends, 'hourly_pattern', []);

    const hasData = dailyPattern.length > 0 || hourlyPattern.length > 0;

    return (
      <ErrorBoundary>
        <div className="space-y-8">
          {!hasData ? (
            <EmptyState
              icon={BarChart3}
              title="No Temporal Patterns Found"
              description="No temporal alert patterns were found in the current analysis period."
              action={refreshData}
              actionLabel="Refresh Data"
            />
          ) : (
            <>
              {/* Daily Pattern Chart */}
              {dailyPattern.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border p-6 ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/20' 
                      : 'bg-white border-gray-200'
                  } backdrop-blur-xl shadow-2xl`}
                >
                  <h3 className={`text-lg font-bold flex items-center gap-3 mb-6 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Daily Alert Patterns
                  </h3>

                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyPattern}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: theme === 'dark' ? 'white' : 'black', fontSize: 12 }}
                          tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <YAxis tick={{ fill: theme === 'dark' ? 'white' : 'black', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.2)',
                            borderRadius: '12px',
                            color: theme === 'dark' ? 'white' : 'black',
                          }}
                          labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="alert_count" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
                          activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {/* Hourly Pattern Chart */}
              {hourlyPattern.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`rounded-2xl border p-6 ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/20' 
                      : 'bg-white border-gray-200'
                  } backdrop-blur-xl shadow-2xl`}
                >
                  <h3 className={`text-lg font-bold flex items-center gap-3 mb-6 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Clock className="w-5 h-5 text-purple-400" />
                    Hourly Alert Distribution
                  </h3>

                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyPattern}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                        <XAxis 
                          dataKey="hour" 
                          tick={{ fill: theme === 'dark' ? 'white' : 'black', fontSize: 12 }}
                          tickFormatter={(value) => `${value}:00`}
                        />
                        <YAxis tick={{ fill: theme === 'dark' ? 'white' : 'black', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                            border: theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.2)',
                            borderRadius: '12px',
                            color: theme === 'dark' ? 'white' : 'black',
                          }}
                          labelFormatter={(value) => `${value}:00`}
                        />
                        <Bar 
                          dataKey="count" 
                          fill="#8b5cf6"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </ErrorBoundary>
    );
  };

  const renderActionsTab = () => {
    const recommendations = safeData.actionableRecommendations || [];

    return (
      <ErrorBoundary>
        <div className="space-y-8">
          {recommendations.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No Action Items Found"
              description="No actionable recommendations were generated for the current analysis period."
              action={refreshData}
              actionLabel="Refresh Data"
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-6 ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 border-blue-500/20' 
                  : 'bg-gradient-to-br from-blue-50 via-indigo-25 to-purple-50 border-blue-200'
              } backdrop-blur-xl shadow-2xl`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Executive Recommendations ({recommendations.length})</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.map((recommendation: any, index: number) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      theme === 'dark' 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className={`p-2 rounded-lg mt-1 ${getRiskLevelColor(safeGet(recommendation, 'priority', 'low'))}`}>
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${getRiskLevelColor(safeGet(recommendation, 'priority', 'low'))}`}>
                          {safeGet(recommendation, 'priority', 'Unknown').toUpperCase()}
                        </span>
                        <span className={`text-xs ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }`}>{safeGet(recommendation, 'timeframe', 'Unknown timeframe')}</span>
                      </div>
                      <p className={`text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{safeGet(recommendation, 'action', 'No action specified')}</p>
                      <p className={`text-xs ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}>{safeGet(recommendation, 'rationale', 'No rationale provided')}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </ErrorBoundary>
    );
  };

  const renderTabContent = () => {
    try {
      switch (activeTab) {
        case 'overview':
          return renderOverviewTab();
        case 'customers':
          return renderCustomersTab();
        case 'transactions':
          return renderTransactionsTab();
        case 'network':
          return renderNetworkTab();
        case 'temporal':
          return renderTemporalTab();
        case 'actions':
          return renderActionsTab();
        default:
          return renderOverviewTab();
      }
    } catch (error) {
      console.error('Error rendering tab content:', error);
      return (
        <EmptyState
          icon={AlertCircle}
          title="Error Loading Content"
          description="There was an error loading this section. Please try again."
          action={() => setActiveTab('overview')}
          actionLabel="Go to Overview"
        />
      );
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className={`rounded-xl border p-2 ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-gray-50 border-gray-200'
        } backdrop-blur-xl`}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-2 p-3 rounded-lg transition-all duration-200 text-sm font-medium ${
                  activeTab === tab.id
                    ? theme === 'dark'
                      ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-white shadow-lg'
                      : 'bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-300 text-blue-700 shadow-lg'
                    : theme === 'dark'
                      ? 'text-white/70 hover:text-white hover:bg-white/5'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${
                  activeTab === tab.id 
                    ? 'text-blue-400' 
                    : theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                }`} />
                <span className="hidden sm:inline">{tab.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

export default RiskAnalyticsDashboard;