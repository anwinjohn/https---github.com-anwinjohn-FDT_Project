import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Shield, Loader2, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface RiskDistributionPanelProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  isLoading: boolean;
}

const RiskDistributionPanel: React.FC<RiskDistributionPanelProps> = ({ data, isLoading }) => {
  const { theme } = useTheme();
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const getRiskIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'high risk':
        return <AlertTriangle className="w-4 h-4" />;
      case 'medium risk':
        return <AlertCircle className="w-4 h-4" />;
      case 'low risk':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getRiskColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'high risk':
        return 'text-red-400';
      case 'medium risk':
        return 'text-orange-400';
      case 'low risk':
        return 'text-green-400';
      default:
        return 'text-blue-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${theme === 'dark'
          ? 'bg-white/10 border-white/20'
          : 'bg-white border-gray-200 shadow-card'
        } backdrop-blur-xl`}
    >
      <div className={`flex justify-between items-center p-6 border-b ${theme === 'dark' ? 'border-white/20' : 'border-gray-200'
        }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Risk Distribution</h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-red-200/70' : 'text-red-600'
              }`}>Security threat analysis</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>{total}</div>
          <div className={`text-xs font-medium ${theme === 'dark' ? 'text-red-300' : 'text-red-600'
            }`}>Total Alerts</div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[350px] space-y-4">
            <Loader2 className="w-12 h-12 text-red-400 animate-spin" />
            <div className="text-center">
              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Analyzing risk distribution...</div>
              <div className={`text-sm mt-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>Processing security threat levels</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stats Row */}
            <div className="space-y-4">
              <h4 className={`font-semibold text-lg mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Risk Breakdown</h4>

              {data.map((item, index) => {
                const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';

                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 group ${theme === 'dark'
                        ? 'bg-gradient-to-r from-white/5 to-white/10 border-white/10 hover:border-white/20'
                        : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shadow-lg"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <div className="flex items-center gap-2">
                        <span className={getRiskColor(item.name)}>
                          {getRiskIcon(item.name)}
                        </span>
                        <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>{item.name}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{item.value}</div>
                      <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }`}>{percentage}%</div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Summary Stats */}
              <div className={`mt-6 p-4 rounded-xl border ${theme === 'dark'
                  ? 'bg-gradient-to-br from-slate-500/20 to-gray-500/20 border-slate-500/30'
                  : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300'
                }`}>
                <h5 className={`font-semibold text-sm mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Security Summary</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-white/70' : 'text-gray-600'}>Most Critical:</span>
                    <span className="text-red-400 font-medium">
                      {data.find(item => item.name === 'High Risk')?.value || 0} alerts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-white/70' : 'text-gray-600'}>Moderate Risk:</span>
                    <span className="text-orange-400 font-medium">
                      {data.find(item => item.name === 'Medium Risk')?.value || 0} alerts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-white/70' : 'text-gray-600'}>Low Priority:</span>
                    <span className="text-green-400 font-medium">
                      {data.find(item => item.name === 'Low Risk')?.value || 0} alerts
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[350px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={140}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={2}
                    stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#ffffff' : '#0f172a',
                      border: theme === 'dark'
                        ? '1px solid rgba(0,0,0,0.08)'
                        : '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      boxShadow: theme === 'dark'
                        ? '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)'
                        : '0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
                      padding: '10px 14px',
                    }}
                    labelStyle={{
                      color: theme === 'dark' ? '#09090b' : '#f8fafc',
                      fontWeight: 600,
                      fontSize: '13px',
                      marginBottom: '4px',
                    }}
                    itemStyle={{
                      color: theme === 'dark' ? '#3f3f46' : '#cbd5e1',
                      fontSize: '13px',
                    }}
                    formatter={(value: number) => [
                      `${((value / total) * 100).toFixed(1)}%`,
                      `${value} alerts`              
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Stats */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                  }`}>Total Alerts</span>
                <span className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>{total}</span>
                <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                  }`}>Active</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RiskDistributionPanel;