import React from 'react';
import { motion } from 'framer-motion';
import { UserAlertSummary } from '../types/types';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip as ChartTooltip
} from 'chart.js';
import { User, ArrowUpRight, Loader2, TrendingUp, Activity } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip);

interface UsersPanelProps {
  data: UserAlertSummary[];
  isLoading: boolean;
  fullWidth?: boolean;
}

const UsersPanel: React.FC<UsersPanelProps> = ({ data, isLoading, fullWidth = false }) => {
  const { theme } = useTheme();
  
  const chartData = {
    labels: data.map(user => user.emp_id),
    datasets: [
      {
        data: data.map(user => user.count),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 2,
        borderRadius: 8,
        hoverBackgroundColor: 'rgba(34, 197, 94, 0.9)',
        hoverBorderColor: 'rgba(34, 197, 94, 1)',
        hoverBorderWidth: 3,
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
        borderColor: 'rgba(34, 197, 94, 0.5)',
        borderWidth: 1,
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
        },
      },
      y: {
        grid: {
          color: 'rgba(34, 197, 94, 0.1)',
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
          <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Employee Alerts</h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-green-200/70' : 'text-green-600'
            }`}>User activity monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>{totalAlerts}</div>
            <div className={`text-xs font-medium ${
              theme === 'dark' ? 'text-green-300' : 'text-green-600'
            }`}>Total Alerts</div>
          </div>
          <button className={`flex items-center text-sm transition-colors group ${
            theme === 'dark' 
              ? 'text-green-400 hover:text-green-300' 
              : 'text-green-600 hover:text-green-700'
          }`}>
            View All 
            <ArrowUpRight size={14} className="ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
            <Loader2 className="w-12 h-12 text-green-400 animate-spin" />
            <div className="text-center">
              <div className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Loading user analytics...</div>
              <div className={`text-sm mt-1 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Analyzing employee activity patterns</div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30' 
                  : 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-green-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-green-300' : 'text-green-700'
                  }`}>Active Users</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{data.length}</div>
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
                  }`}>Avg per User</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{avgAlertsPerUser}</div>
              </div>
              
              <div className={`p-4 rounded-xl border ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30' 
                  : 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                  }`}>Top User</span>
                </div>
                <div className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {data.length > 0 ? Math.max(...data.map(u => u.count)) : 0}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className={`h-64 rounded-xl p-4 border ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/10' 
                : 'bg-gray-50 border-gray-200'
            }`}>
              <Bar data={chartData} options={chartOptions} />
            </div>
            
            {/* User List */}
            <div className={`grid gap-4 max-h-80 overflow-y-auto custom-scrollbar ${
              fullWidth ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'
            }`}>
              {data.sort((a, b) => b.count - a.count).slice(0, fullWidth ? 16 : 6).map((user, index) => (
                <motion.div
                  key={user.emp_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className={`flex items-center p-4 rounded-xl border transition-all duration-200 group ${
                    theme === 'dark' 
                      ? 'bg-gradient-to-r from-white/5 to-white/10 border-white/10 hover:from-white/10 hover:to-white/15 hover:border-white/20' 
                      : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 hover:from-gray-100 hover:to-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-3 rounded-xl mr-3 border transition-colors ${
                    theme === 'dark' 
                      ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-green-500/20 group-hover:border-green-500/40' 
                      : 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-300 group-hover:border-green-400'
                  }`}>
                    <User size={18} className="text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>{user.emp_id}</p>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}>Employee ID</p>
                  </div>
                  <div className={`px-3 py-2 rounded-xl border ${
                    theme === 'dark' 
                      ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30' 
                      : 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-300'
                  }`}>
                    <span className={`text-sm font-bold ${
                      theme === 'dark' ? 'text-green-300' : 'text-green-700'
                    }`}>{user.count}</span>
                    <span className={`text-xs ml-1 ${
                      theme === 'dark' ? 'text-green-400/70' : 'text-green-600'
                    }`}>alerts</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default UsersPanel;