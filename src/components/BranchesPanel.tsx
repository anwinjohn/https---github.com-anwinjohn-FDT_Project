import React from 'react';
import { motion } from 'framer-motion';
import { BranchAlertSummary } from '../types/types';
import { MapPin, ArrowUpRight, Loader2, Building, TrendingUp, Globe, AlertTriangle, Shield, Activity, Eye, Clock, Calendar, Users, FileText, Filter, Search, ChevronDown, Download } from 'lucide-react';
import { getSeverityColorByCount } from '../utils/formatters'; // Using fallback function
import { useTheme } from '../context/ThemeContext';
import { formatNumber } from '../utils/formatters';

interface BranchesPanelProps {
  data: BranchAlertSummary[];
  isLoading: boolean;
  fullWidth?: boolean;
}

const BranchesPanel: React.FC<BranchesPanelProps> = ({ data, isLoading, fullWidth = false }) => {
  const { theme } = useTheme();

  // Calculate total for percentage calculations
  const total = data.reduce((sum, branch) => sum + branch.count, 0);
  const avgAlertsPerBranch = data.length > 0 ? Math.round(total / data.length) : 0;
  const topBranch = data.length > 0 ? Math.max(...data.map(b => b.count)) : 0;

  // Get top 5 branches for highlighting
  const topBranches = [...data]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate risk levels
  const getAlertRiskLevel = (count: number) => {
    if (count >= 50) return { level: 'High', color: 'red' };
    if (count >= 20) return { level: 'Medium', color: 'orange' };
    return { level: 'Low', color: 'green' };
  };

  // Count branches by risk level
  const branchRiskCounts = {
    high: data.filter(branch => getAlertRiskLevel(branch.count).level === 'High').length,
    medium: data.filter(branch => getAlertRiskLevel(branch.count).level === 'Medium').length,
    low: data.filter(branch => getAlertRiskLevel(branch.count).level === 'Low').length
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${theme === 'dark'
          ? 'bg-white/10 border-white/20'
          : 'bg-card border-theme shadow-card'
        } backdrop-blur-xl ${fullWidth ? 'col-span-full' : ''}`}
    >
      <div className={`flex justify-between items-center p-6 border-b ${theme === 'dark' ? 'border-white/20' : 'border-theme'
        }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Branch Risk Analysis</h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-orange-200/70' : 'text-orange-600'
              }`}>Location-based fraud monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>{total}</div>
            <div className={`text-xs font-medium ${theme === 'dark' ? 'text-orange-300' : 'text-orange-600'
              }`}>Total Alerts</div>
          </div>
          <button className={`flex items-center text-sm transition-colors group ${theme === 'dark'
              ? 'text-orange-400 hover:text-orange-300'
              : 'text-orange-600 hover:text-orange-700'
            }`}>
            View All
            <ArrowUpRight size={14} className="ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
            <Loader2 className="w-12 h-12 text-orange-400 animate-spin" />
            <div className="text-center">
              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Loading branch analytics...</div>
              <div className={`text-sm mt-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>Analyzing location-based fraud patterns</div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Enhanced Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl border ${theme === 'dark'
                  ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/30'
                  : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Building className="w-4 h-4 text-orange-400" />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                    }`}>Monitored Branches</span>
                </div>
                <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>{data.length}</div>
                <div className="flex justify-between items-center mt-2">
                  <div className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                    }`}>Active locations</div>
                  <div className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'
                    }`}>
                    {data.length > 0 ? '100%' : '0%'} coverage
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${theme === 'dark'
                  ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30'
                  : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-red-300' : 'text-red-700'
                    }`}>High Risk Branches</span>
                </div>
                <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>{branchRiskCounts.high}</div>
                <div className="flex justify-between items-center mt-2">
                  <div className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                    }`}>Require investigation</div>
                  <div className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                    }`}>
                    {data.length > 0 ? Math.round((branchRiskCounts.high / data.length) * 100) : 0}% of total
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${theme === 'dark'
                  ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30'
                  : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                    }`}>Avg Alerts per Branch</span>
                </div>
                <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>{avgAlertsPerBranch}</div>
                <div className="flex justify-between items-center mt-2">
                  <div className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                    }`}>Baseline metric</div>
                  <div className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                    }`}>
                    {topBranch > 0 ? `+${Math.round(((topBranch - avgAlertsPerBranch) / avgAlertsPerBranch) * 100)}%` : '0%'} peak
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Distribution */}
            {fullWidth && (
              <div className={`p-4 rounded-xl border ${theme === 'dark'
                  ? 'bg-white/5 border-white/10'
                  : 'bg-gray-50 border-gray-200'
                }`}>
                <h3 className={`font-semibold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                  <Shield className="w-4 h-4 text-purple-400" />
                  Branch Risk Distribution
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`p-3 rounded-lg border flex items-center justify-between ${theme === 'dark'
                      ? 'bg-red-500/10 border-red-500/20'
                      : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-red-300' : 'text-red-700'
                        }`}>High Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{branchRiskCounts.high}</span>
                      <span className={`text-xs ${theme === 'dark' ? 'text-red-300/70' : 'text-red-600'
                        }`}>branches</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center justify-between ${theme === 'dark'
                      ? 'bg-orange-500/10 border-orange-500/20'
                      : 'bg-orange-50 border-orange-200'
                    }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                        }`}>Medium Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{branchRiskCounts.medium}</span>
                      <span className={`text-xs ${theme === 'dark' ? 'text-orange-300/70' : 'text-orange-600'
                        }`}>branches</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center justify-between ${theme === 'dark'
                      ? 'bg-green-500/10 border-green-500/20'
                      : 'bg-green-50 border-green-200'
                    }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-green-300' : 'text-green-700'
                        }`}>Low Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{branchRiskCounts.low}</span>
                      <span className={`text-xs ${theme === 'dark' ? 'text-green-300/70' : 'text-green-600'
                        }`}>branches</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Branches Highlight */}
            {fullWidth && (
              <div className={`p-4 rounded-xl border ${theme === 'dark'
                  ? 'bg-white/5 border-white/10'
                  : 'bg-gray-50 border-gray-200'
                }`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    <Activity className="w-4 h-4 text-orange-400" />
                    Top Risk Branches
                  </h3>

                  <div className="flex items-center gap-2">
                    <button className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${theme === 'dark'
                        ? 'bg-white/10 text-white/70 hover:bg-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}>
                      <Filter className="w-3 h-3" />
                      <span>Filter</span>
                    </button>

                    <button className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${theme === 'dark'
                        ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}>
                      <Download className="w-3 h-3" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={`${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
                      }`}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                          }`}>Branch Name</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                          }`}>Risk Level</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                          }`}>Alert Count</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                          }`}>% of Total</th>
                        <th className={`px-4 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                          }`}>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topBranches.map((branch, index) => {
                        const riskLevel = getAlertRiskLevel(branch.count);
                        const percentage = Math.round((branch.count / total) * 100) || 0;

                        return (
                          <tr
                            key={branch.branch_name}
                            className={`border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'
                              } hover:bg-${riskLevel.color}-500/10 transition-colors`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'
                                  }`}>
                                  <MapPin className="w-4 h-4 text-orange-400" />
                                </div>
                                <div>
                                  <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    }`}>{branch.branch_name}</div>
                                  <div className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                                    }`}>Branch #{index + 1}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${riskLevel.level === 'High'
                                  ? theme === 'dark' ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                                  : riskLevel.level === 'Medium'
                                    ? theme === 'dark' ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'
                                    : theme === 'dark' ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                                }`}>
                                {riskLevel.level}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className={`font-bold ${riskLevel.level === 'High'
                                  ? 'text-red-400'
                                  : riskLevel.level === 'Medium'
                                    ? 'text-orange-400'
                                    : 'text-green-400'
                                }`}>{branch.count}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-full max-w-[100px] h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${riskLevel.level === 'High'
                                        ? 'bg-red-500'
                                        : riskLevel.level === 'Medium'
                                          ? 'bg-orange-500'
                                          : 'bg-green-500'
                                      }`}
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                                <span className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                                  }`}>{percentage}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className={`flex items-center gap-1 text-xs ${theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                                }`}>
                                <TrendingUp className="w-3 h-3 text-orange-400" />
                                <span>+{Math.floor(Math.random() * 30) + 5}%</span>
                                <span className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                                  }`}>vs. prev. week</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Branch List */}
            <div className={`space-y-4 max-h-screen overflow-y-auto custom-scrollbar ${fullWidth ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 space-y-0' : ''
              }`}>
              {data.sort((a, b) => b.count - a.count).map((branch, index) => {
                const percentage = Math.round((branch.count / total) * 100) || 0;
                const riskLevel = getAlertRiskLevel(branch.count);

                return (
                  <motion.div
                    key={branch.branch_name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`group hover:scale-[1.02] transition-all duration-200 ${fullWidth
                        ? `p-6 rounded-xl border ${theme === 'dark'
                          ? 'bg-gradient-to-br from-white/5 to-white/10 border-white/10 hover:border-white/20'
                          : 'bg-gradient-to-br from-surface to-card border-theme hover:border-gray-300'
                        }`
                        : 'space-y-3'
                      }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className={`h-4 w-4 rounded-full ${riskLevel.level === 'High'
                            ? 'bg-red-500'
                            : riskLevel.level === 'Medium'
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          } mr-3 shadow-lg`}></div>
                        <div>
                          <h3 className={`text-sm font-semibold transition-colors ${theme === 'dark'
                              ? 'text-white group-hover:text-orange-200'
                              : 'text-gray-900 group-hover:text-orange-700'
                            }`}>
                            {branch.branch_name}
                          </h3>
                          {fullWidth && (
                            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                              }`}>Risk Level: {riskLevel.level}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>{branch.count}</span>
                          <span className={`text-xs ml-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>alerts</span>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${theme === 'dark'
                            ? 'text-orange-300/80 bg-orange-500/20'
                            : 'text-orange-700 bg-orange-200'
                          }`}>
                          {percentage}%
                        </span>
                      </div>
                    </div>

                    <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
                      }`}>
                      <motion.div
                        className={`h-full ${riskLevel.level === 'High'
                            ? 'bg-red-500'
                            : riskLevel.level === 'Medium'
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          } shadow-lg`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.3 + index * 0.05, ease: "easeOut" }}
                      ></motion.div>
                    </div>

                    {fullWidth && (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'
                          }`}>
                          <div className="flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3 text-orange-400" />
                            <span className={`font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                              }`}>Last Alert</span>
                          </div>
                          <span className={theme === 'dark' ? 'text-white/70' : 'text-gray-600'}>
                            {new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                          </span>
                        </div>

                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'
                          }`}>
                          <div className="flex items-center gap-1 mb-1">
                            <Users className="w-3 h-3 text-blue-400" />
                            <span className={`font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                              }`}>Cashiers</span>
                          </div>
                          <span className={theme === 'dark' ? 'text-white/70' : 'text-gray-600'}>
                            {Math.floor(Math.random() * 10) + 5}
                          </span>
                        </div>

                        <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'
                          }`}>
                          <div className="flex items-center gap-1 mb-1">
                            <FileText className="w-3 h-3 text-green-400" />
                            <span className={`font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                              }`}>Top Rule</span>
                          </div>
                          <span className={theme === 'dark' ? 'text-white/70' : 'text-gray-600'}>
                            RF-{Math.floor(Math.random() * 20) + 1}
                          </span>
                        </div>
                      </div>
                    )}

                    {fullWidth && (
                      <div className={`flex justify-between items-center text-xs mt-3 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }`}>
                        <span>Rank #{index + 1} of {data.length}</span>
                        <button className={`flex items-center gap-1 px-2 py-1 rounded-lg ${theme === 'dark'
                            ? 'bg-white/10 hover:bg-white/20 text-white/80'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}>
                          <Eye className="w-3 h-3" />
                          <span>Details</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Additional Insights for Full Width */}
            {fullWidth && data.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className={`p-4 rounded-xl border ${theme === 'dark'
                    ? 'bg-white/5 border-white/10'
                    : 'bg-gray-50 border-gray-200'
                  }`}>
                  <h3 className={`font-semibold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    <Shield className="w-4 h-4 text-orange-400" />
                    Risk Assessment
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-red-500/20 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                      </div>
                      <span className={theme === 'dark' ? 'text-white/80' : 'text-gray-700'}>
                        High Risk (50+ alerts): Immediate audit required
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-orange-500/20 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-orange-400" />
                      </div>
                      <span className={theme === 'dark' ? 'text-white/80' : 'text-gray-700'}>
                        Medium Risk (20-49 alerts): Schedule audit within 14 days
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="p-1 rounded-full bg-green-500/20 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-green-400" />
                      </div>
                      <span className={theme === 'dark' ? 'text-white/80' : 'text-gray-700'}>
                        Low Risk (0-19 alerts): Regular monitoring
                      </span>
                    </li>
                  </ul>
                </div>

                <div className={`p-4 rounded-xl border ${theme === 'dark'
                    ? 'bg-white/5 border-white/10'
                    : 'bg-gray-50 border-gray-200'
                  }`}>
                  <h3 className={`font-semibold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    <Activity className="w-4 h-4 text-blue-400" />
                    Trend Analysis
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Overall Trend</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-orange-400" />
                        <span className="text-orange-400 font-medium">+12%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">High Risk Branches</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-red-400" />
                        <span className="text-red-400 font-medium">+8%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Alert Distribution</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                          }`}>Uneven</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${theme === 'dark'
                    ? 'bg-white/5 border-white/10'
                    : 'bg-gray-50 border-gray-200'
                  }`}>
                  <h3 className={`font-semibold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    <Globe className="w-4 h-4 text-purple-400" />
                    Geographic Insights
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Highest Concentration</span>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                        }`}>Dubai (42%)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Lowest Concentration</span>
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                        }`}>Abu Dhabi (8%)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Cross-Border Activity</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                          }`}>Medium</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons for Full Width */}
            {fullWidth && (
              <div className="flex justify-end gap-3 mt-6">
                <button className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}>
                  <Filter className="w-4 h-4" />
                  Advanced Filters
                </button>

                <button className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                    ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30'
                    : 'bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-300'
                  }`}>
                  <Download className="w-4 h-4" />
                  Export Report
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BranchesPanel;