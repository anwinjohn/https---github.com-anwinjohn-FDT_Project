import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserAlertSummary, ViolationType } from '../types/types';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip as ChartTooltip
} from 'chart.js';
import { 
  User, 
  ArrowUpRight, 
  Loader2, 
  TrendingUp, 
  Activity, 
  Shield, 
  AlertTriangle, 
  Filter,
  Search,
  ChevronDown,
  Clock,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  SlidersHorizontal,
  X,
  BarChart3,
  Info,
  Eye
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../components/notifications';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip);

interface UsersPanelProps {
  data: UserAlertSummary[];
  isLoading: boolean;
  fullWidth?: boolean;
}

const UsersPanel: React.FC<UsersPanelProps> = ({ data, isLoading, fullWidth = false }) => {
  const { theme } = useTheme();
  const { addNotification } = useNotifications();
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'emp_id'>('count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(fullWidth ? 15 : 6);
  const [loadingViolationTypes, setLoadingViolationTypes] = useState(false);
  const [violationTypes, setViolationTypes] = useState<ViolationType[]>([]);
  
  // Calculate risk levels
  const getRiskLevel = (count: number) => {
    if (count >= 20) return { level: 'high', color: 'red', label: 'High' };
    if (count >= 10) return { level: 'medium', color: 'orange', label: 'Medium' };
    return { level: 'low', color: 'green', label: 'Low' };
  };
  
  // Filter and sort data
  const processedData = useMemo(() => {
    return [...data]
      .filter(user => {
        const matchesSearch = user.emp_id.toLowerCase().includes(searchTerm.toLowerCase());
        const risk = getRiskLevel(user.count);
        
        if (riskFilter === 'all') return matchesSearch;
        return matchesSearch && risk.level === riskFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'count') {
          return sortOrder === 'desc' ? b.count - a.count : a.count - b.count;
        } else {
          return sortOrder === 'desc' 
            ? b.emp_id.localeCompare(a.emp_id) 
            : a.emp_id.localeCompare(b.emp_id);
        }
      });
  }, [data, searchTerm, sortBy, sortOrder, riskFilter]);
  
  // Pagination
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedData.slice(startIndex, startIndex + itemsPerPage);
  }, [processedData, currentPage, itemsPerPage]);
  
  // Top 10 for chart
  const topViolators = useMemo(() => {
    return [...data]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [data]);
  
  // Fetch common violation types
  useEffect(() => {
    const fetchViolationTypes = async () => {
      try {
        setLoadingViolationTypes(true);
        
        // In a real implementation, this would call the API
        // const response = await fetch('/api/violation-types');
        // if (!response.ok) throw new Error('Failed to fetch violation types');
        // const data = await response.json();
        // setViolationTypes(data);
        
        // For now, we'll simulate the API response with a delay
        setTimeout(() => {
          // This would normally come from the API based on actual data
          // The API endpoint would aggregate rule violations across all users
          const mockViolationTypes: ViolationType[] = [
            {
              rule_id: 'RF-012',
              rule_desc: 'Multiple transactions just below reporting thresholds',
              count: 156
            },
            {
              rule_id: 'RF-005',
              rule_desc: 'Unusual transaction patterns outside normal behavior',
              count: 98
            },
            {
              rule_id: 'RF-007',
              rule_desc: 'Transactions with high-risk jurisdictions',
              count: 67
            },
            {
              rule_id: 'RF-003',
              rule_desc: 'Rapid succession of transactions by same customer',
              count: 42
            },
            {
              rule_id: 'RF-001',
              rule_desc: 'Transactions with sanctioned countries',
              count: 23
            }
          ];
          
          setViolationTypes(mockViolationTypes);
          setLoadingViolationTypes(false);
        }, 800);
        
      } catch (error) {
        console.error('Error fetching violation types:', error);
        addNotification('Failed to load violation types', 'error');
        setLoadingViolationTypes(false);
      }
    };
    
    if (fullWidth) {
      fetchViolationTypes();
    }
  }, [fullWidth, addNotification]);
  
  const chartData = {
    labels: topViolators.map(user => user.emp_id),
    datasets: [
      {
        data: topViolators.map(user => user.count),
        backgroundColor: topViolators.map(user => {
          const risk = getRiskLevel(user.count);
          return risk.color === 'red' 
            ? 'rgba(239, 68, 68, 0.8)' 
            : risk.color === 'orange' 
              ? 'rgba(249, 115, 22, 0.8)' 
              : 'rgba(34, 197, 94, 0.8)';
        }),
        borderColor: topViolators.map(user => {
          const risk = getRiskLevel(user.count);
          return risk.color === 'red' 
            ? 'rgba(239, 68, 68, 1)' 
            : risk.color === 'orange' 
              ? 'rgba(249, 115, 22, 1)' 
              : 'rgba(34, 197, 94, 1)';
        }),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: theme === 'dark' ? '#fff' : '#000',
        bodyColor: theme === 'dark' ? '#fff' : '#000',
        bodyFont: {
          size: 14,
          weight: 'bold',
        },
        titleFont: {
          size: 12,
          weight: 'normal',
        },
        padding: 12,
        cornerRadius: 12,
        boxPadding: 6,
        displayColors: false,
        callbacks: {
          title: function(tooltipItems: any) {
            return `Employee ID: ${tooltipItems[0].label}`;
          },
          label: function(context: any) {
            const count = context.raw;
            const risk = getRiskLevel(count);
            return [
              `Rule Violations: ${count}`,
              `Risk Level: ${risk.label}`
            ];
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: theme === 'dark' ? 'rgba(156, 163, 175, 0.8)' : 'rgba(75, 85, 99, 0.8)',
          font: {
            size: 11,
            weight: 'bold',
          },
          callback: function(value: any, index: number) {
            // Truncate long employee IDs
            const label = this.getLabelForValue(value);
            return label.length > 8 ? label.substring(0, 8) + '...' : label;
          }
        },
      },
      y: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: theme === 'dark' ? 'rgba(156, 163, 175, 0.8)' : 'rgba(75, 85, 99, 0.8)',
          font: {
            size: 11,
            weight: 'bold',
          },
          callback: function(value: number) {
            if (Math.floor(value) === value) {
              return value;
            }
          },
        },
      },
    },
  };

  const totalAlerts = data.reduce((sum, user) => sum + user.count, 0);
  const avgAlertsPerUser = data.length > 0 ? Math.round(totalAlerts / data.length) : 0;
  const highRiskUsers = data.filter(user => getRiskLevel(user.count).level === 'high').length;
  const mediumRiskUsers = data.filter(user => getRiskLevel(user.count).level === 'medium').length;
  
  // Get the top violator
  const topViolator = data.length > 0 
    ? data.reduce((prev, current) => (prev.count > current.count) ? prev : current) 
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${
        theme === 'dark' 
          ? 'bg-white/10 border-white/20' 
          : 'bg-white border-gray-200 shadow-card'
      } backdrop-blur-xl ${fullWidth ? 'col-span-full' : ''}`}
    >
      <div className={`flex justify-between items-center p-6 border-b ${
        theme === 'dark' ? 'border-white/20' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Cashier Rule Violations</h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-red-200/70' : 'text-red-600'
            }`}>Fraud risk monitoring & investigation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>{totalAlerts}</div>
            <div className={`text-xs font-medium ${
              theme === 'dark' ? 'text-red-300' : 'text-red-600'
            }`}>Total Violations</div>
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
              showFilters 
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                : theme === 'dark' 
                  ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
          <button className={`flex items-center text-sm transition-colors group ${
            theme === 'dark' 
              ? 'text-red-400 hover:text-red-300' 
              : 'text-red-600 hover:text-red-700'
          }`}>
            View All 
            <ArrowUpRight size={14} className="ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[350px] space-y-4">
            <Loader2 className="w-12 h-12 text-red-400 animate-spin" />
            <div className="text-center">
              <div className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Loading cashier risk data...</div>
              <div className={`text-sm mt-1 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Analyzing rule violation patterns</div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filters Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className={`rounded-xl border p-4 mb-6 overflow-hidden ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/20' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`font-semibold flex items-center gap-2 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                      Advanced Filters
                    </h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className={`p-1.5 rounded-lg ${
                        theme === 'dark' 
                          ? 'hover:bg-white/10 text-white/60' 
                          : 'hover:bg-gray-200 text-gray-500'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}>Search Cashier</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1); // Reset to first page on search
                          }}
                          placeholder="Search by employee ID..."
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
                      }`}>Risk Level</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['all', 'high', 'medium', 'low'] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => {
                              setRiskFilter(level);
                              setCurrentPage(1); // Reset to first page on filter change
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                              riskFilter === level
                                ? level === 'high'
                                  ? theme === 'dark' ? 'bg-red-500/30 text-red-300 border border-red-500/50' : 'bg-red-100 text-red-700 border border-red-300'
                                  : level === 'medium'
                                    ? theme === 'dark' ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50' : 'bg-orange-100 text-orange-700 border border-orange-300'
                                    : level === 'low'
                                      ? theme === 'dark' ? 'bg-green-500/30 text-green-300 border border-green-500/50' : 'bg-green-100 text-green-700 border border-green-300'
                                      : theme === 'dark' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50' : 'bg-blue-100 text-blue-700 border border-blue-300'
                                : theme === 'dark'
                                  ? 'bg-white/10 text-white/70 border border-white/20 hover:bg-white/20'
                                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}>Sort By</label>
                      <div className="relative">
                        <select
                          value={`${sortBy}-${sortOrder}`}
                          onChange={(e) => {
                            const [newSortBy, newSortOrder] = e.target.value.split('-') as ['count' | 'emp_id', 'asc' | 'desc'];
                            setSortBy(newSortBy);
                            setSortOrder(newSortOrder);
                          }}
                          className={`w-full px-3 py-2 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            theme === 'dark' 
                              ? 'bg-white/10 border border-white/20 text-white' 
                              : 'bg-white border border-gray-300 text-gray-900'
                          }`}
                        >
                          <option value="count-desc" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>Violations: High to Low</option>
                          <option value="count-asc" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>Violations: Low to High</option>
                          <option value="emp_id-asc" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>Employee ID: A to Z</option>
                          <option value="emp_id-desc" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>Employee ID: Z to A</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setRiskFilter('all');
                        setSortBy('count');
                        setSortOrder('desc');
                        setCurrentPage(1);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        theme === 'dark' 
                          ? 'bg-white/10 hover:bg-white/20 text-white' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      Reset Filters
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30' 
                  : 'bg-gradient-to-br from-red-100 to-orange-100 border-red-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-red-300' : 'text-red-700'
                  }`}>High Risk Cashiers</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{highRiskUsers}</div>
                <div className={`text-xs ${
                  theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                }`}>Immediate investigation</div>
              </div>
              
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/30' 
                  : 'bg-gradient-to-br from-orange-100 to-amber-100 border-orange-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-orange-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                  }`}>Top Violator</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{topViolator ? topViolator.count : 0}</div>
                <div className={`text-xs ${
                  theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                }`}>{topViolator ? topViolator.emp_id : 'None'}</div>
              </div>
              
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30' 
                  : 'bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                  }`}>Avg Violations</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{avgAlertsPerUser}</div>
                <div className={`text-xs ${
                  theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                }`}>Per cashier</div>
              </div>
              
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30' 
                  : 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                  }`}>Total Cashiers</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{data.length}</div>
                <div className={`text-xs ${
                  theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                }`}>Under monitoring</div>
              </div>
            </div>

            {/* Chart */}
            <div className={`h-[200px] rounded-xl p-4 border ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/10' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-sm font-semibold ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Top 15 Cashiers by Rule Violations</h3>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                    theme === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <BarChart3 className="w-3 h-3" />
                    <span>Violation Count</span>
                  </div>
                </div>
              </div>
              <Bar data={chartData} options={chartOptions} />
            </div>
            
            {/* Employee List */}
            <div className={`rounded-xl border overflow-hidden ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/10' 
                : 'bg-white border-gray-200'
            }`}>
              <div className={`p-4 border-b ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}>
                <div className="flex justify-between items-center">
                  <h3 className={`font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Cashier Risk Assessment</h3>
                  
                  {processedData.length > 0 && (
                    <div className={`text-xs ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}>
                      {searchTerm || riskFilter !== 'all' ? 'Filtered results' : 'Showing top violators'}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`${
                    theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
                  }`}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}>Cashier ID</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}>Risk Level</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}>Violations</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}>Last Violation</th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold ${
                        theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                      }`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center">
                          <AlertCircle className={`w-8 h-8 mx-auto mb-2 ${
                            theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                          }`} />
                          <p className={`${
                            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                          }`}>No cashier rule violations found</p>
                          {(searchTerm || riskFilter !== 'all') && (
                            <button
                              onClick={() => {
                                setSearchTerm('');
                                setRiskFilter('all');
                                setCurrentPage(1);
                              }}
                              className={`mt-2 text-sm ${
                                theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                              }`}
                            >
                              Clear filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((user, index) => {
                        const risk = getRiskLevel(user.count);
                        // Generate a unique key using both emp_id and index
                        const uniqueKey = `${user.emp_id}-${index}-${currentPage}`;
                        
                        return (
                          <tr 
                            key={uniqueKey}
                            className={`border-b ${
                              theme === 'dark' ? 'border-white/10' : 'border-gray-100'
                            } hover:bg-${risk.color}-500/10 transition-colors`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                  theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
                                }`}>
                                  <User className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                  <div className={`font-medium ${
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  }`}>{user.emp_id}</div>
                                  <div className={`text-xs ${
                                    theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                                  }`}>Cashier ID</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                risk.level === 'high'
                                  ? theme === 'dark' ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                                  : risk.level === 'medium'
                                    ? theme === 'dark' ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'
                                    : theme === 'dark' ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                              }`}>
                                {risk.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className={`font-bold ${
                                risk.level === 'high'
                                  ? 'text-red-400'
                                  : risk.level === 'medium'
                                    ? 'text-orange-400'
                                    : 'text-green-400'
                              }`}>{user.count}</div>
                              <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    risk.level === 'high'
                                      ? 'bg-red-500'
                                      : risk.level === 'medium'
                                        ? 'bg-orange-500'
                                        : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (user.count / 30) * 100)}%` }}
                                ></div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span className={`text-sm ${
                                  theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                                }`}>
                                  {/* Simulated date - in real app, this would come from API */}
                                  {new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button className={`p-1.5 rounded-lg ${
                                  theme === 'dark' 
                                    ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' 
                                    : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                }`} title="View Details">
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button className={`p-1.5 rounded-lg ${
                                  theme === 'dark' 
                                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300' 
                                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                                }`} title="Flag for Investigation">
                                  <AlertTriangle className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {processedData.length > itemsPerPage && (
                <div className={`p-4 border-t ${
                  theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className={`text-sm ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}>
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, processedData.length)} of {processedData.length} cashiers
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-lg transition-colors ${
                          currentPage === 1
                            ? theme === 'dark' ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      
                      <div className="flex items-center gap-1">
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
                            <button
                              key={pageToShow}
                              onClick={() => setCurrentPage(pageToShow)}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                                currentPage === pageToShow
                                  ? theme === 'dark' ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50' : 'bg-blue-100 text-blue-700 border border-blue-300'
                                  : theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              }`}
                            >
                              {pageToShow}
                            </button>
                          );
                        })}
                        
                        {totalPages > 5 && currentPage < totalPages - 2 && (
                          <>
                            <span className={theme === 'dark' ? 'text-white/50' : 'text-gray-500'}>...</span>
                            <button
                              onClick={() => setCurrentPage(totalPages)}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                                theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              }`}
                            >
                              {totalPages}
                            </button>
                          </>
                        )}
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-lg transition-colors ${
                          currentPage === totalPages
                            ? theme === 'dark' ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Export Button */}
              {processedData.length > 0 && (
                <div className={`p-4 border-t ${
                  theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                }`}>
                  <div className="flex justify-end">
                    <button className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      theme === 'dark' 
                        ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30' 
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300'
                    }`}>
                      <Download className="w-4 h-4" />
                      Export Report
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Risk Summary */}
            {fullWidth && (
              <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${
                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
              }`}>
                <div className={`p-4 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <h3 className="font-semibold mb-3">Investigation Guidelines</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-red-500/20 mt-0.5">
                        <AlertCircle className="w-3 h-3 text-red-400" />
                      </div>
                      <span>High Risk (20+ violations): Immediate investigation required</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-orange-500/20 mt-0.5">
                        <AlertCircle className="w-3 h-3 text-orange-400" />
                      </div>
                      <span>Medium Risk (10-19 violations): Schedule investigation within 7 days</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-green-500/20 mt-0.5">
                        <AlertCircle className="w-3 h-3 text-green-400" />
                      </div>
                      <span>Low Risk (0-9 violations): Monitor for pattern changes</span>
                    </li>
                  </ul>
                </div>
                
                <div className={`p-4 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <h3 className="font-semibold mb-3">Common Violation Types</h3>
                  {loadingViolationTypes ? (
                    <div className="flex justify-center items-center h-24">
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    </div>
                  ) : violationTypes.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {violationTypes.map((type, index) => (
                        <li key={type.rule_id} className="flex items-start gap-2">
                          <div className="p-1 rounded-full bg-blue-500/20 mt-0.5">
                            <Shield className="w-3 h-3 text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <span>{type.rule_desc}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                              }`}>{type.rule_id}</span>
                              <span className={`text-xs ${
                                theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                              }`}>{type.count} occurrences</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-24 text-sm">
                      <Info className="w-5 h-5 text-blue-400 mb-2" />
                      <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>
                        No violation types data available
                      </span>
                    </div>
                  )}
                </div>
                
                <div className={`p-4 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-white/5 border-white/10' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <h3 className="font-semibold mb-3">Risk Trend Analysis</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">High Risk Cashiers</span>
                      <div className="flex items-center gap-1">
                        <span className="text-red-400 font-medium">{highRiskUsers}</span>
                        <TrendingUp className="w-3 h-3 text-red-400" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Medium Risk Cashiers</span>
                      <div className="flex items-center gap-1">
                        <span className="text-orange-400 font-medium">{mediumRiskUsers}</span>
                        <TrendingUp className="w-3 h-3 text-orange-400" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Average Violations</span>
                      <div className="flex items-center gap-1">
                        <span className="text-blue-400 font-medium">{avgAlertsPerUser}</span>
                        <TrendingUp className="w-3 h-3 text-blue-400" />
                      </div>
                    </div>
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

export default UsersPanel;