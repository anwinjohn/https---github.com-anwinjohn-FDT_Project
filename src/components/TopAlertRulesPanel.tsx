import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Loader2, TrendingUp, Activity, Zap } from 'lucide-react';
import { AlertSummary } from '../types/types';
import { useTheme } from '../context/ThemeContext';

interface TopAlertRulesPanelProps {
  data: AlertSummary[];
  isLoading: boolean;
}

const TopAlertRulesPanel: React.FC<TopAlertRulesPanelProps> = ({ data, isLoading }) => {
  const { theme } = useTheme();
  
  const topRules = [...data]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(rule => ({
      ...rule,
      shortDesc: rule.rule_desc.length > 25 ? rule.rule_desc.substring(0, 25) + '...' : rule.rule_desc
    }));

  const totalAlerts = data.reduce((sum, rule) => sum + rule.count, 0);
  const avgAlerts = data.length > 0 ? Math.round(totalAlerts / data.length) : 0;
  const topAlert = data.length > 0 ? Math.max(...data.map(r => r.count)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${
        theme === 'dark' 
          ? 'bg-white/10 border-white/20' 
          : 'bg-white border-gray-200 shadow-card'
      } backdrop-blur-xl`}
    >
      <div className={`flex justify-between items-center p-6 border-b ${
        theme === 'dark' ? 'border-white/20' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Top Alert Rules</h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-blue-200/70' : 'text-blue-600'
            }`}>Most triggered security rules</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>{totalAlerts}</div>
          <div className={`text-xs font-medium ${
            theme === 'dark' ? 'text-blue-300' : 'text-blue-600'
          }`}>Total Alerts</div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <div className="text-center">
              <div className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Loading alert rules...</div>
              <div className={`text-sm mt-1 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Analyzing security patterns</div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30' 
                  : 'bg-gradient-to-br from-blue-100 to-cyan-100 border-blue-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                  }`}>Active Rules</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{data.length}</div>
              </div>
              
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border-purple-500/30' 
                  : 'bg-gradient-to-br from-purple-100 to-indigo-100 border-purple-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                  }`}>Avg Triggers</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{avgAlerts}</div>
              </div>
              
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/30' 
                  : 'bg-gradient-to-br from-orange-100 to-red-100 border-orange-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-orange-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-orange-300' : 'text-orange-700'
                  }`}>Peak Activity</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{topAlert}</div>
              </div>
            </div>

            {/* Chart */}
            <div className={`h-[400px] rounded-xl p-4 border ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/10' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topRules} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} 
                  />
                  <XAxis
                    dataKey="rule_id"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ 
                      fill: theme === 'dark' ? 'white' : 'black', 
                      fontSize: 11, 
                      fontWeight: 'bold' 
                    }}
                  />
                  <YAxis 
                    tick={{ 
                      fill: theme === 'dark' ? 'white' : 'black', 
                      fontSize: 11, 
                      fontWeight: 'bold' 
                    }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      border: theme === 'dark' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(59, 130, 246, 0.5)',
                      borderRadius: '12px',
                      color: theme === 'dark' ? 'white' : 'black',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value} alerts`,
                      props.payload.rule_desc
                    ]}
                    labelStyle={{ 
                      color: '#60a5fa', 
                      fontWeight: 'bold' 
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#barGradient)"
                    radius={[6, 6, 0, 0]}
                    stroke="rgba(59, 130, 246, 0.5)"
                    strokeWidth={1}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TopAlertRulesPanel;