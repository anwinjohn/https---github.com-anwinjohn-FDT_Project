import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, ArrowUpRight } from 'lucide-react';
import { AlertSummary } from '../types/types';
import { useTheme } from '../context/ThemeContext';

interface TrendAnalysisPanelProps {
  data: AlertSummary[];
  isLoading: boolean;
}

const TrendAnalysisPanel: React.FC<TrendAnalysisPanelProps> = ({ data, isLoading }) => {
  const { theme } = useTheme();
  
  // Simulate trend data (in a real app, this would come from the API)
  const trendData = data.map((item, index) => ({
    name: item.rule_id,
    value: item.count,
    trend: Math.floor(Math.random() * 200) + 50
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`rounded-2xl p-6 border shadow-2xl ${
          theme === 'dark' 
            ? 'bg-white/10 border-white/20' 
            : 'bg-white border-gray-200 shadow-card'
        } backdrop-blur-xl`}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-2xl font-bold flex items-center gap-3 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            Alert Trends
          </h3>
          <button className={`flex items-center text-sm transition-colors ${
            theme === 'dark' 
              ? 'text-blue-400 hover:text-blue-300' 
              : 'text-blue-600 hover:text-blue-700'
          }`}>
            View Details <ArrowUpRight size={14} className="ml-1" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${
              theme === 'dark' ? 'border-blue-500' : 'border-blue-600'
            }`}></div>
          </div>
        ) : (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} 
                />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: theme === 'dark' ? 'white' : 'black' }} 
                />
                <YAxis 
                  tick={{ fill: theme === 'dark' ? 'white' : 'black' }} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    border: theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.2)',
                    borderRadius: '12px',
                    color: theme === 'dark' ? 'white' : 'black',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="trend"
                  stroke="#3b82f6"
                  fill="url(#trendGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className={`rounded-2xl p-6 border shadow-2xl ${
          theme === 'dark' 
            ? 'bg-white/10 border-white/20' 
            : 'bg-white border-gray-200 shadow-card'
        } backdrop-blur-xl`}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-2xl font-bold flex items-center gap-3 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            Alert Volume
          </h3>
          <button className={`flex items-center text-sm transition-colors ${
            theme === 'dark' 
              ? 'text-purple-400 hover:text-purple-300' 
              : 'text-purple-600 hover:text-purple-700'
          }`}>
            View Details <ArrowUpRight size={14} className="ml-1" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${
              theme === 'dark' ? 'border-purple-500' : 'border-purple-600'
            }`}></div>
          </div>
        ) : (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} 
                />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: theme === 'dark' ? 'white' : 'black' }} 
                />
                <YAxis 
                  tick={{ fill: theme === 'dark' ? 'white' : 'black' }} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    border: theme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.2)',
                    borderRadius: '12px',
                    color: theme === 'dark' ? 'white' : 'black',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default TrendAnalysisPanel;