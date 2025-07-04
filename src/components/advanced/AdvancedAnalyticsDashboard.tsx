import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { 
  BarChart3, 
  Loader2, 
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
  Download,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Layers
} from 'lucide-react';
import NetworkGraphVisualization from './NetworkGraphVisualization';
import TimeSeriesAnomalyDetection from './TimeSeriesAnomalyDetection';
import UserBehaviorAnalytics from './UserBehaviorAnalytics';
import InteractiveDashboard from './InteractiveDashboard';
import { useNotifications } from '../notifications';
import { DateRange } from '../../types/types';

interface AdvancedAnalyticsDashboardProps {
  dateRange: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  isLoading?: boolean;
}

const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({
  dateRange,
  onDateRangeChange,
  isLoading = false
}) => {
  const { theme } = useTheme();
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'timeseries' | 'behavior' | 'interactive'>('overview');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'insights']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleExport = () => {
    try {
      addNotification('Preparing analytics export...', 'info');
      
      // Simulate export delay
      setTimeout(() => {
        addNotification('Analytics data exported successfully', 'success');
      }, 1500);
    } catch (error) {
      console.error('Error exporting data:', error);
      addNotification('Failed to export analytics data', 'error');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'network':
        return <NetworkGraphVisualization />;
      case 'timeseries':
        return <TimeSeriesAnomalyDetection />;
      case 'behavior':
        return <UserBehaviorAnalytics />;
      case 'interactive':
        return <InteractiveDashboard />;
      default:
        return renderOverviewTab();
    }
  };

  const renderOverviewTab = () => {
    return (
      <div className="space-y-6">
        {/* Summary Section */}
        <div className={`rounded-2xl border ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-white border-gray-200'
        } overflow-hidden`}>
          <div 
            className={`flex justify-between items-center p-6 border-b cursor-pointer ${
              theme === 'dark' ? 'border-white/20' : 'border-gray-200'
            }`}
            onClick={() => toggleSection('summary')}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Analytics Summary</h3>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-blue-200/70' : 'text-blue-600'
                }`}>Key metrics and performance indicators</p>
              </div>
            </div>
            {expandedSections.has('summary') ? (
              <ChevronUp className={`w-5 h-5 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`} />
            )}
          </div>
          
          {expandedSections.has('summary') && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className={`p-6 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-red-500/20 to-red-500/10 border-red-500/30' 
                    : 'bg-gradient-to-br from-red-100 to-red-50 border-red-300'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                    <span className={`font-semibold ${
                      theme === 'dark' ? 'text-red-300' : 'text-red-700'
                    }`}>Fraud Alerts</span>
                  </div>
                  <div className={`text-3xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>2,453</div>
                  <div className="flex items-center gap-1 mt-2">
                    <ArrowUpRight className="w-4 h-4 text-red-400" />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-red-300' : 'text-red-700'
                    }`}>+12% vs. last month</span>
                  </div>
                </div>
                
                <div className={`p-6 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-500/30' 
                    : 'bg-gradient-to-br from-blue-100 to-blue-50 border-blue-300'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-blue-400" />
                    <span className={`font-semibold ${
                      theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                    }`}>Suspicious Users</span>
                  </div>
                  <div className={`text-3xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>87</div>
                  <div className="flex items-center gap-1 mt-2">
                    <ArrowUpRight className="w-4 h-4 text-red-400" />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-red-300' : 'text-red-700'
                    }`}>+5% vs. last month</span>
                  </div>
                </div>
                
                <div className={`p-6 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-green-500/20 to-green-500/10 border-green-500/30' 
                    : 'bg-gradient-to-br from-green-100 to-green-50 border-green-300'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="w-6 h-6 text-green-400" />
                    <span className={`font-semibold ${
                      theme === 'dark' ? 'text-green-300' : 'text-green-700'
                    }`}>Detection Rate</span>
                  </div>
                  <div className={`text-3xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>94.2%</div>
                  <div className="flex items-center gap-1 mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-400" />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-green-300' : 'text-green-700'
                    }`}>+1.5% improvement</span>
                  </div>
                </div>
                
                <div className={`p-6 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-purple-500/30' 
                    : 'bg-gradient-to-br from-purple-100 to-purple-50 border-purple-300'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <DollarSign className="w-6 h-6 text-purple-400" />
                    <span className={`font-semibold ${
                      theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                    }`}>Fraud Prevention</span>
                  </div>
                  <div className={`text-3xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>$1.2M</div>
                  <div className="flex items-center gap-1 mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-400" />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-green-300' : 'text-green-700'
                    }`}>+18% savings</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Key Insights Section */}
        <div className={`rounded-2xl border ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-white border-gray-200'
        } overflow-hidden`}>
          <div 
            className={`flex justify-between items-center p-6 border-b cursor-pointer ${
              theme === 'dark' ? 'border-white/20' : 'border-gray-200'
            }`}
            onClick={() => toggleSection('insights')}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Key Insights</h3>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-purple-200/70' : 'text-purple-600'
                }`}>AI-powered fraud detection insights</p>
              </div>
            </div>
            {expandedSections.has('insights') ? (
              <ChevronUp className={`w-5 h-5 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`} />
            )}
          </div>
          
          {expandedSections.has('insights') && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-4 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <h4 className={`font-semibold mb-4 flex items-center gap-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Network className="w-4 h-4 text-blue-400" />
                    Network Analysis
                  </h4>
                  
                  <div className="space-y-3">
                    <div className={`p-3 rounded-lg border ${
                      theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Suspicious Transaction Ring Detected</div>
                      <p className={`text-sm mt-1 ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                      }`}>
                        5 customers making circular transactions with 3 common beneficiaries
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`text-xs ${
                          theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                        }`}>Confidence: 92%</span>
                        <button className={`text-xs ${
                          theme === 'dark' ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'
                        }`}>
                          View Details
                        </button>
                      </div>
                    </div>
                    
                    <div className={`p-3 rounded-lg border ${
                      theme === 'dark' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200'
                    }`}>
                      <div className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>High-Risk Jurisdiction Connections</div>
                      <p className={`text-sm mt-1 ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                      }`}>
                        Increased transaction volume to 2 high-risk jurisdictions
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`text-xs ${
                          theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                        }`}>Confidence: 85%</span>
                        <button className={`text-xs ${
                          theme === 'dark' ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'
                        }`}>
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={`p-4 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <h4 className={`font-semibold mb-4 flex items-center gap-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Behavioral Patterns
                  </h4>
                  
                  <div className="space-y-3">
                    <div className={`p-3 rounded-lg border ${
                      theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Unusual After-Hours Activity</div>
                      <p className={`text-sm mt-1 ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                      }`}>
                        2 users showing consistent after-hours system access patterns
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`text-xs ${
                          theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                        }`}>Confidence: 88%</span>
                        <button className={`text-xs ${
                          theme === 'dark' ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'
                        }`}>
                          View Details
                        </button>
                      </div>
                    </div>
                    
                    <div className={`p-3 rounded-lg border ${
                      theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Transaction Velocity Anomalies</div>
                      <p className={`text-sm mt-1 ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                      }`}>
                        Unusual increase in transaction velocity for 3 customers
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`text-xs ${
                          theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                        }`}>Confidence: 76%</span>
                        <button className={`text-xs ${
                          theme === 'dark' ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'
                        }`}>
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Advanced Visualization Previews */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
            className={`rounded-xl border overflow-hidden cursor-pointer transition-all duration-300 ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20' 
                : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('network')}
          >
            <div className={`p-4 border-b ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-purple-400" />
                <h4 className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Network Analysis</h4>
              </div>
            </div>
            <div className="p-4 h-40 flex items-center justify-center">
              <div className={`text-center ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>
                <div className="mb-2">
                  <Network className="w-8 h-8 mx-auto text-purple-400 opacity-50" />
                </div>
                <p className="text-sm">Interactive fraud network visualization</p>
                <button className={`mt-2 text-xs ${
                  theme === 'dark' ? 'text-purple-300' : 'text-purple-600'
                }`}>
                  View Full Analysis
                </button>
              </div>
            </div>
          </div>
          
          <div 
            className={`rounded-xl border overflow-hidden cursor-pointer transition-all duration-300 ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20' 
                : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('timeseries')}
          >
            <div className={`p-4 border-b ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <h4 className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Time Series Analysis</h4>
              </div>
            </div>
            <div className="p-4 h-40 flex items-center justify-center">
              <div className={`text-center ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>
                <div className="mb-2">
                  <TrendingUp className="w-8 h-8 mx-auto text-blue-400 opacity-50" />
                </div>
                <p className="text-sm">Anomaly detection in transaction patterns</p>
                <button className={`mt-2 text-xs ${
                  theme === 'dark' ? 'text-blue-300' : 'text-blue-600'
                }`}>
                  View Full Analysis
                </button>
              </div>
            </div>
          </div>
          
          <div 
            className={`rounded-xl border overflow-hidden cursor-pointer transition-all duration-300 ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20' 
                : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('behavior')}
          >
            <div className={`p-4 border-b ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-400" />
                <h4 className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>User Behavior Analytics</h4>
              </div>
            </div>
            <div className="p-4 h-40 flex items-center justify-center">
              <div className={`text-center ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>
                <div className="mb-2">
                  <Users className="w-8 h-8 mx-auto text-green-400 opacity-50" />
                </div>
                <p className="text-sm">Detect unusual user behavior patterns</p>
                <button className={`mt-2 text-xs ${
                  theme === 'dark' ? 'text-green-300' : 'text-green-600'
                }`}>
                  View Full Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Interactive Dashboard Preview */}
        <div 
          className={`rounded-xl border overflow-hidden cursor-pointer transition-all duration-300 ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20' 
              : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('interactive')}
        >
          <div className={`p-4 border-b ${
            theme === 'dark' ? 'border-white/10' : 'border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-400" />
              <h4 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Interactive Dashboard</h4>
            </div>
          </div>
          <div className="p-6 flex items-center justify-center">
            <div className={`text-center ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`}>
              <div className="mb-3">
                <Layers className="w-12 h-12 mx-auto text-orange-400 opacity-50" />
              </div>
              <p className="text-base max-w-md">Customizable interactive dashboard with drag-and-drop widgets for personalized fraud analytics</p>
              <button className={`mt-3 px-4 py-2 rounded-lg text-sm ${
                theme === 'dark' 
                  ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300' 
                  : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
              }`}>
                Open Interactive Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div>
      {renderTabContent()}
    </motion.div>
  );
};

export default AdvancedAnalyticsDashboard;