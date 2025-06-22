import React from 'react';
import { motion } from 'framer-motion';
import { BranchAlertSummary } from '../types/types';
import { MapPin, ArrowUpRight, Loader2, Building, TrendingUp, Globe } from 'lucide-react';
import { getSeverityColorByCount } from '../utils/formatters'; // Using fallback function
import { useTheme } from '../context/ThemeContext';

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${
        theme === 'dark' 
          ? 'bg-white/10 border-white/20' 
          : 'bg-card border-theme shadow-card'
      } backdrop-blur-xl ${fullWidth ? 'col-span-full' : ''}`}
    >
      <div className={`flex justify-between items-center p-6 border-b ${
        theme === 'dark' ? 'border-white/20' : 'border-theme'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Branch Alerts</h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-orange-200/70' : 'text-orange-600'
            }`}>Location-based monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>{total}</div>
            <div className={`text-xs font-medium ${
              theme === 'dark' ? 'text-orange-300' : 'text-orange-600'
            }`}>Total Alerts</div>
          </div>
          <button className={`flex items-center text-sm transition-colors group ${
            theme === 'dark' 
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
              <div className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Loading branch analytics...</div>
              <div className={`text-sm mt-1 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Analyzing location-based patterns</div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/30' 
                  : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Building className="w-4 h-4 text-orange-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                  }`}>Active Branches</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{data.length}</div>
              </div>
              
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30' 
                  : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                  }`}>Avg per Branch</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{avgAlertsPerBranch}</div>
              </div>
              
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30' 
                  : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                  }`}>Highest Activity</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{topBranch}</div>
              </div>
            </div>

            {/* Branch List */}
            <div className={`space-y-4 max-h-96 overflow-y-auto custom-scrollbar ${
              fullWidth ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 space-y-0' : ''
            }`}>
              {data.sort((a, b) => b.count - a.count).map((branch, index) => {
                const percentage = Math.round((branch.count / total) * 100) || 0;
                
                return (
                  <motion.div 
                    key={branch.branch_name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`group hover:scale-[1.02] transition-all duration-200 ${
                      fullWidth 
                        ? `p-6 rounded-xl border ${
                            theme === 'dark' 
                              ? 'bg-gradient-to-br from-white/5 to-white/10 border-white/10 hover:border-white/20' 
                              : 'bg-gradient-to-br from-surface to-card border-theme hover:border-gray-300'
                          }` 
                        : 'space-y-3'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className={`h-4 w-4 rounded-full ${getSeverityColorByCount(branch.count)} mr-3 shadow-lg`}></div>
                        <div>
                          <h3 className={`text-sm font-semibold transition-colors ${
                            theme === 'dark' 
                              ? 'text-white group-hover:text-orange-200' 
                              : 'text-gray-900 group-hover:text-orange-700'
                          }`}>
                            {branch.branch_name}
                          </h3>
                          {fullWidth && (
                            <p className={`text-xs mt-1 ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>Branch Location</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className={`text-sm font-bold ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>{branch.count}</span>
                          <span className={`text-xs ml-1 ${
                            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                          }`}>alerts</span>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          theme === 'dark' 
                            ? 'text-orange-300/80 bg-orange-500/20' 
                            : 'text-orange-700 bg-orange-200'
                        }`}>
                          {percentage}%
                        </span>
                      </div>
                    </div>
                    
                    <div className={`h-2 rounded-full overflow-hidden ${
                      theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
                    }`}>
                      <motion.div 
                        className={`h-full ${getSeverityColorByCount(branch.count)} shadow-lg`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.3 + index * 0.05, ease: "easeOut" }}
                      ></motion.div>
                    </div>

                    {fullWidth && (
                      <div className={`flex justify-between items-center text-xs mt-3 ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}>
                        <span>Risk Level: {branch.count > 50 ? 'High' : branch.count > 20 ? 'Medium' : 'Low'}</span>
                        <span>#{index + 1} of {data.length}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BranchesPanel;