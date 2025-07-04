import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { 
  Users, 
  Loader2, 
  AlertTriangle, 
  User, 
  Clock, 
  Calendar, 
  Filter, 
  Download, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight, 
  Activity,
  Shield,
  FileText,
  Eye,
  EyeOff,
  Zap,
  Target,
  BarChart3
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useNotifications } from '../notifications';
import { UserBehaviorMetrics, TimeSeriesPoint } from '../../types/types';

interface UserBehaviorAnalyticsProps {
  data?: UserBehaviorMetrics[];
  isLoading?: boolean;
  title?: string;
  description?: string;
}

const UserBehaviorAnalytics: React.FC<UserBehaviorAnalyticsProps> = ({
  data,
  isLoading = false,
  title = "User Behavior Analytics",
  description = "Detect unusual user behavior patterns and potential insider threats"
}) => {
  const { theme } = useTheme();
  const { addNotification } = useNotifications();
  const [userData, setUserData] = useState<UserBehaviorMetrics[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'details']));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate mock data if none provided
  useEffect(() => {
    if (data) {
      setUserData(data);
      if (data.length > 0 && !selectedUser) {
        setSelectedUser(data[0].userId);
      }
      setLoading(false);
    } else {
      // Generate mock data
      const generateMockData = async () => {
        try {
          setLoading(true);
          
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const mockUsers: UserBehaviorMetrics[] = [
            {
              userId: 'user-001',
              userName: 'John Smith',
              riskScore: 85,
              metrics: {
                loginTimes: generateTimeSeriesData(30, 5, true),
                transactionVolume: generateTimeSeriesData(30, 8, true),
                accessPatterns: generateTimeSeriesData(30, 3, true)
              },
              anomalies: [
                {
                  type: 'login_time',
                  timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                  description: 'Unusual login time detected at 3:24 AM',
                  severity: 'high'
                },
                {
                  type: 'transaction_volume',
                  timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                  description: 'Abnormal increase in transaction volume',
                  severity: 'medium'
                }
              ]
            },
            {
              userId: 'user-002',
              userName: 'Jane Doe',
              riskScore: 42,
              metrics: {
                loginTimes: generateTimeSeriesData(30, 2, false),
                transactionVolume: generateTimeSeriesData(30, 1, false),
                accessPatterns: generateTimeSeriesData(30, 0, false)
              },
              anomalies: [
                {
                  type: 'access_pattern',
                  timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                  description: 'Accessed unusual system modules',
                  severity: 'low'
                }
              ]
            },
            {
              userId: 'user-003',
              userName: 'Robert Johnson',
              riskScore: 92,
              metrics: {
                loginTimes: generateTimeSeriesData(30, 7, true),
                transactionVolume: generateTimeSeriesData(30, 9, true),
                accessPatterns: generateTimeSeriesData(30, 6, true)
              },
              anomalies: [
                {
                  type: 'login_time',
                  timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                  description: 'Multiple failed login attempts followed by successful login',
                  severity: 'high'
                },
                {
                  type: 'transaction_volume',
                  timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                  description: 'Suspicious transaction pattern detected',
                  severity: 'high'
                },
                {
                  type: 'access_pattern',
                  timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                  description: 'Accessed sensitive customer data outside normal workflow',
                  severity: 'high'
                }
              ]
            },
            {
              userId: 'user-004',
              userName: 'Sarah Williams',
              riskScore: 28,
              metrics: {
                loginTimes: generateTimeSeriesData(30, 1, false),
                transactionVolume: generateTimeSeriesData(30, 0, false),
                accessPatterns: generateTimeSeriesData(30, 2, false)
              },
              anomalies: []
            },
            {
              userId: 'user-005',
              userName: 'Michael Brown',
              riskScore: 76,
              metrics: {
                loginTimes: generateTimeSeriesData(30, 4, true),
                transactionVolume: generateTimeSeriesData(30, 6, true),
                accessPatterns: generateTimeSeriesData(30, 3, false)
              },
              anomalies: [
                {
                  type: 'transaction_volume',
                  timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
                  description: 'Unusual transaction amount pattern',
                  severity: 'medium'
                }
              ]
            }
          ];
          
          setUserData(mockUsers);
          
          // Set default selected user
          if (mockUsers.length > 0 && !selectedUser) {
            setSelectedUser(mockUsers[0].userId);
          }
          
          setLoading(false);
        } catch (error) {
          console.error('Error generating mock data:', error);
          setError('Failed to load user behavior data');
          setLoading(false);
        }
      };
      
      generateMockData();
    }
  }, [data, selectedUser]);

  // Helper function to generate time series data
  function generateTimeSeriesData(days: number, anomalyCount: number, hasPattern: boolean): TimeSeriesPoint[] {
    const data: TimeSeriesPoint[] = [];
    const now = new Date();
    
    // Base value and variation
    const baseValue = 50 + Math.random() * 50;
    const dailyVariation = 10;
    
    // Generate anomaly indices
    const anomalyIndices = new Set<number>();
    while (anomalyIndices.size < anomalyCount) {
      anomalyIndices.add(Math.floor(Math.random() * days));
    }
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (days - i - 1));
      
      // Add some pattern if enabled
      let value = baseValue + (Math.random() * dailyVariation * 2 - dailyVariation);
      
      if (hasPattern) {
        // Weekly pattern (higher on weekdays)
        const dayOfWeek = date.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          value *= 1.2;
        } else {
          value *= 0.7;
        }
        
        // Time of month pattern (higher at beginning/end of month)
        const dayOfMonth = date.getDate();
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        if (dayOfMonth <= 5 || dayOfMonth >= daysInMonth - 5) {
          value *= 1.15;
        }
      }
      
      // Is this an anomaly?
      const isAnomaly = anomalyIndices.has(i);
      
      // For anomalies, significantly adjust the value
      if (isAnomaly) {
        // 50% chance of high anomaly, 50% chance of low anomaly
        if (Math.random() > 0.5) {
          value *= 2 + Math.random(); // High anomaly
        } else {
          value *= 0.3 + Math.random() * 0.2; // Low anomaly
        }
      }
      
      data.push({
        timestamp: date.toISOString(),
        value,
        isAnomaly,
        anomalyScore: isAnomaly ? 0.7 + Math.random() * 0.3 : undefined,
        anomalyType: isAnomaly 
          ? Math.random() > 0.5 ? 'spike' : 'drop'
          : undefined
      });
    }
    
    return data;
  }

  // Toggle section expansion
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Filter users based on search and anomaly filter
  const filteredUsers = userData.filter(user => {
    // Filter by search term
    if (searchTerm && !user.userName.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Filter by anomalies only
    if (showAnomaliesOnly && user.anomalies.length === 0) {
      return false;
    }
    
    return true;
  });

  // Get selected user data
  const selectedUserData = userData.find(user => user.userId === selectedUser);

  // Prepare chart options for user metrics
  const getTimeSeriesChartOptions = (data: TimeSeriesPoint[], title: string) => {
    const dates = data.map(point => new Date(point.timestamp).toLocaleDateString());
    const values = data.map(point => point.value);
    const anomalyPoints = data
      .filter(point => point.isAnomaly)
      .map(point => [
        data.findIndex(d => d.timestamp === point.timestamp),
        point.value
      ]);
    
    return {
      title: {
        text: title,
        left: 'center',
        textStyle: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)',
          fontSize: 14
        }
      },
      tooltip: {
        trigger: 'axis',
        formatter: function(params: any) {
          const dataIndex = params[0].dataIndex;
          const point = data[dataIndex];
          let tooltipText = `<div style="font-weight: bold; margin-bottom: 5px;">${new Date(point.timestamp).toLocaleDateString()}</div>`;
          tooltipText += `<div>Value: ${point.value.toFixed(2)}</div>`;
          
          if (point.isAnomaly) {
            tooltipText += `<div style="color: #ef4444; margin-top: 5px;">⚠️ Anomaly Detected</div>`;
            if (point.anomalyScore) {
              tooltipText += `<div>Confidence: ${(point.anomalyScore * 100).toFixed(1)}%</div>`;
            }
            if (point.anomalyType) {
              tooltipText += `<div>Type: ${point.anomalyType}</div>`;
            }
          }
          
          return tooltipText;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
          formatter: function(value: string) {
            // Format date to be more compact
            const parts = value.split('/');
            return `${parts[1]}/${parts[0]}`;
          }
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
          }
        },
        splitLine: {
          lineStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          }
        }
      },
      series: [
        {
          name: 'Value',
          type: 'line',
          data: values,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 3,
            color: theme === 'dark' ? '#6366f1' : '#4f46e5'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0,
                color: theme === 'dark' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(79, 70, 229, 0.4)'
              }, {
                offset: 1,
                color: theme === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.1)'
              }]
            }
          }
        },
        {
          name: 'Anomalies',
          type: 'scatter',
          data: anomalyPoints,
          symbolSize: 10,
          itemStyle: {
            color: '#ef4444'
          }
        }
      ]
    };
  };

  // Handle export
  const handleExport = () => {
    try {
      // Create CSV content
      const headers = ['User ID', 'User Name', 'Risk Score', 'Anomaly Count'];
      const csvContent = [
        headers.join(','),
        ...userData.map(user => [
          user.userId,
          user.userName,
          user.riskScore,
          user.anomalies.length
        ].join(','))
      ].join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `user-behavior-metrics-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addNotification('User behavior data exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      addNotification('Failed to export user behavior data', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${
        theme === 'dark' 
          ? 'bg-white/10 border-white/20' 
          : 'bg-white border-gray-200'
      } backdrop-blur-xl`}
    >
      <div className={`flex justify-between items-center p-6 border-b ${
        theme === 'dark' ? 'border-white/20' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>{title}</h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-green-200/70' : 'text-green-600'
            }`}>{description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
              className={`w-48 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                theme === 'dark' 
                  ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                  : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAnomaliesOnly}
              onChange={(e) => setShowAnomaliesOnly(e.target.checked)}
              className="w-4 h-4 text-green-600 bg-white/10 border-white/20 rounded focus:ring-green-500"
            />
            <span className={`text-sm ${
              theme === 'dark' ? 'text-white/80' : 'text-gray-700'
            }`}>Anomalies only</span>
          </label>
          
          <button
            onClick={handleExport}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300' 
                : 'bg-green-100 hover:bg-green-200 text-green-700'
            }`}
            title="Export Data"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Overview Section */}
      <div className={`border-b ${
        theme === 'dark' ? 'border-white/20' : 'border-gray-200'
      }`}>
        <div 
          className={`flex justify-between items-center p-4 cursor-pointer ${
            theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'
          }`}
          onClick={() => toggleSection('overview')}
        >
          <h4 className={`font-medium flex items-center gap-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            <BarChart3 className="w-5 h-5 text-green-400" />
            User Overview
          </h4>
          {expandedSections.has('overview') ? (
            <ChevronUp className={`w-5 h-5 ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`} />
          ) : (
            <ChevronDown className={`w-5 h-5 ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`} />
          )}
        </div>
        
        {expandedSections.has('overview') && (
          <div className="p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className={`w-10 h-10 animate-spin ${
                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
                }`} />
                <p className={`mt-4 ${
                  theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                }`}>Loading user data...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className={`w-10 h-10 mx-auto mb-4 ${
                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                }`} />
                <p className={`${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>No users found matching your criteria</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setShowAnomaliesOnly(false);
                  }}
                  className={`mt-4 px-4 py-2 rounded-lg transition-colors ${
                    theme === 'dark' 
                      ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' 
                      : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                  }`}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map(user => {
                  // Determine risk level color
                  let riskColor = 'text-green-400';
                  let riskBg = theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100';
                  let riskBorder = theme === 'dark' ? 'border-green-500/30' : 'border-green-300';
                  let riskLabel = 'Low Risk';
                  
                  if (user.riskScore >= 80) {
                    riskColor = 'text-red-400';
                    riskBg = theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100';
                    riskBorder = theme === 'dark' ? 'border-red-500/30' : 'border-red-300';
                    riskLabel = 'High Risk';
                  } else if (user.riskScore >= 50) {
                    riskColor = 'text-yellow-400';
                    riskBg = theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100';
                    riskBorder = theme === 'dark' ? 'border-yellow-500/30' : 'border-yellow-300';
                    riskLabel = 'Medium Risk';
                  }
                  
                  return (
                    <motion.div
                      key={user.userId}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedUser(user.userId)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                        selectedUser === user.userId
                          ? theme === 'dark'
                            ? 'bg-green-500/20 border-green-500/40 shadow-lg shadow-green-500/10'
                            : 'bg-green-100 border-green-400 shadow-lg shadow-green-500/10'
                          : theme === 'dark'
                            ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
                          }`}>
                            <User className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>{user.userName}</div>
                            <div className={`text-xs ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>ID: {user.userId}</div>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${riskBg} ${riskColor}`}>
                          {riskLabel}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-xs ${
                              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                            }`}>Risk Score</span>
                            <span className={`text-xs font-medium ${riskColor}`}>{user.riskScore}/100</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                user.riskScore >= 80 
                                  ? 'bg-red-500' 
                                  : user.riskScore >= 50 
                                    ? 'bg-yellow-500' 
                                    : 'bg-green-500'
                              }`}
                              style={{ width: `${user.riskScore}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className={`text-xs ${
                            theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                          }`}>Anomalies</span>
                          <span className={`text-xs font-medium ${
                            user.anomalies.length > 0 ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {user.anomalies.length}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className={`text-xs ${
                            theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                          }`}>Last Activity</span>
                          <span className={`text-xs ${
                            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                          }`}>
                            {new Date().toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Details Section */}
      <div>
        <div 
          className={`flex justify-between items-center p-4 cursor-pointer border-b ${
            theme === 'dark' ? 'border-white/20 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'
          }`}
          onClick={() => toggleSection('details')}
        >
          <h4 className={`font-medium flex items-center gap-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            <Activity className="w-5 h-5 text-blue-400" />
            User Details
          </h4>
          {expandedSections.has('details') ? (
            <ChevronUp className={`w-5 h-5 ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`} />
          ) : (
            <ChevronDown className={`w-5 h-5 ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`} />
          )}
        </div>
        
        {expandedSections.has('details') && (
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className={`w-10 h-10 animate-spin ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
                <p className={`mt-4 ${
                  theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                }`}>Loading user details...</p>
              </div>
            ) : !selectedUserData ? (
              <div className="text-center py-8">
                <User className={`w-10 h-10 mx-auto mb-4 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
                <p className={`${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Select a user to view detailed behavior analytics</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* User Header */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${
                      selectedUserData.riskScore >= 80
                        ? theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
                        : selectedUserData.riskScore >= 50
                          ? theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100'
                          : theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'
                    }`}>
                      <User className={`w-8 h-8 ${
                        selectedUserData.riskScore >= 80
                          ? 'text-red-400'
                          : selectedUserData.riskScore >= 50
                            ? 'text-yellow-400'
                            : 'text-green-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{selectedUserData.userName}</h3>
                      <p className={`text-sm ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}>User ID: {selectedUserData.userId}</p>
                    </div>
                  </div>
                  
                  <div className={`p-4 rounded-xl border ${
                    selectedUserData.riskScore >= 80
                      ? theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
                      : selectedUserData.riskScore >= 50
                        ? theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'
                        : theme === 'dark' ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div>
                        <div className={`text-sm ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                        }`}>Risk Score</div>
                        <div className={`text-2xl font-bold ${
                          selectedUserData.riskScore >= 80
                            ? 'text-red-400'
                            : selectedUserData.riskScore >= 50
                              ? 'text-yellow-400'
                              : 'text-green-400'
                        }`}>{selectedUserData.riskScore}/100</div>
                      </div>
                      <div className="h-12 w-0.5 bg-white/10"></div>
                      <div>
                        <div className={`text-sm ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                        }`}>Anomalies</div>
                        <div className={`text-2xl font-bold ${
                          selectedUserData.anomalies.length > 0 ? 'text-red-400' : 'text-green-400'
                        }`}>{selectedUserData.anomalies.length}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Metrics Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className={`rounded-xl border overflow-hidden ${
                    theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
                  }`}>
                    <div className="h-60">
                      <ReactECharts
                        option={getTimeSeriesChartOptions(selectedUserData.metrics.loginTimes, 'Login Activity')}
                        style={{ height: '100%', width: '100%' }}
                        theme={theme === 'dark' ? 'dark' : undefined}
                      />
                    </div>
                  </div>
                  
                  <div className={`rounded-xl border overflow-hidden ${
                    theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
                  }`}>
                    <div className="h-60">
                      <ReactECharts
                        option={getTimeSeriesChartOptions(selectedUserData.metrics.transactionVolume, 'Transaction Volume')}
                        style={{ height: '100%', width: '100%' }}
                        theme={theme === 'dark' ? 'dark' : undefined}
                      />
                    </div>
                  </div>
                  
                  <div className={`rounded-xl border overflow-hidden ${
                    theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
                  }`}>
                    <div className="h-60">
                      <ReactECharts
                        option={getTimeSeriesChartOptions(selectedUserData.metrics.accessPatterns, 'System Access Patterns')}
                        style={{ height: '100%', width: '100%' }}
                        theme={theme === 'dark' ? 'dark' : undefined}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Anomalies List */}
                <div className={`rounded-xl border ${
                  theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
                }`}>
                  <div className={`p-4 border-b ${
                    theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                  }`}>
                    <h4 className={`font-medium flex items-center gap-2 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      Detected Anomalies
                    </h4>
                  </div>
                  
                  {selectedUserData.anomalies.length === 0 ? (
                    <div className="p-6 text-center">
                      <CheckCircle className={`w-8 h-8 mx-auto mb-2 ${
                        theme === 'dark' ? 'text-green-400' : 'text-green-600'
                      }`} />
                      <p className={`${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>No anomalies detected for this user</p>
                      <p className={`text-sm mt-1 ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}>User behavior appears to be within normal patterns</p>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="space-y-4">
                        {selectedUserData.anomalies.map((anomaly, index) => (
                          <div 
                            key={index}
                            className={`p-4 rounded-lg border ${
                              anomaly.severity === 'high'
                                ? theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
                                : anomaly.severity === 'medium'
                                  ? theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'
                                  : theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className={`font-medium ${
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>{anomaly.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                                <p className={`text-sm mt-1 ${
                                  theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                                }`}>{anomaly.description}</p>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  anomaly.severity === 'high'
                                    ? theme === 'dark' ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                                    : anomaly.severity === 'medium'
                                      ? theme === 'dark' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                                      : theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {anomaly.severity.charAt(0).toUpperCase() + anomaly.severity.slice(1)}
                                </span>
                                <span className={`text-xs mt-2 ${
                                  theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                                }`}>
                                  {new Date(anomaly.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Recommendations */}
                <div className={`p-4 rounded-xl border ${
                  selectedUserData.riskScore >= 80
                    ? theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
                    : selectedUserData.riskScore >= 50
                      ? theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'
                      : theme === 'dark' ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200'
                }`}>
                  <h4 className={`font-medium flex items-center gap-2 mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Zap className="w-4 h-4 text-blue-400" />
                    Recommendations
                  </h4>
                  
                  <div className="space-y-3">
                    {selectedUserData.riskScore >= 80 && (
                      <div className="flex items-start gap-2">
                        <Shield className={`w-4 h-4 mt-0.5 ${
                          theme === 'dark' ? 'text-red-400' : 'text-red-600'
                        }`} />
                        <div>
                          <p className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>High Risk User - Immediate Action Required</p>
                          <p className={`text-xs ${
                            theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                          }`}>
                            Temporarily restrict access and conduct a security review of recent activities.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedUserData.riskScore >= 50 && selectedUserData.riskScore < 80 && (
                      <div className="flex items-start gap-2">
                        <Eye className={`w-4 h-4 mt-0.5 ${
                          theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                        }`} />
                        <div>
                          <p className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Enhanced Monitoring Recommended</p>
                          <p className={`text-xs ${
                            theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                          }`}>
                            Increase monitoring frequency and review access patterns for suspicious activity.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedUserData.riskScore < 50 && (
                      <div className="flex items-start gap-2">
                        <CheckCircle className={`w-4 h-4 mt-0.5 ${
                          theme === 'dark' ? 'text-green-400' : 'text-green-600'
                        }`} />
                        <div>
                          <p className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Normal Risk Profile</p>
                          <p className={`text-xs ${
                            theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                          }`}>
                            Continue standard monitoring. No immediate action required.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedUserData.anomalies.some(a => a.type === 'login_time') && (
                      <div className="flex items-start gap-2">
                        <Clock className={`w-4 h-4 mt-0.5 ${
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        }`} />
                        <div>
                          <p className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Unusual Login Times</p>
                          <p className={`text-xs ${
                            theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                          }`}>
                            Verify if the user has a legitimate reason for accessing the system outside normal hours.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedUserData.anomalies.some(a => a.type === 'transaction_volume') && (
                      <div className="flex items-start gap-2">
                        <Target className={`w-4 h-4 mt-0.5 ${
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                        }`} />
                        <div>
                          <p className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Transaction Volume Anomalies</p>
                          <p className={`text-xs ${
                            theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                          }`}>
                            Review recent transactions for potential fraud or policy violations.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedUserData.anomalies.some(a => a.type === 'access_pattern') && (
                      <div className="flex items-start gap-2">
                        <FileText className={`w-4 h-4 mt-0.5 ${
                          theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                        }`} />
                        <div>
                          <p className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Unusual Access Patterns</p>
                          <p className={`text-xs ${
                            theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                          }`}>
                            Investigate access to sensitive data and systems outside normal job functions.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default UserBehaviorAnalytics;