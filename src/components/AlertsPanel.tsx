import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertSummary } from '../types/types';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { ArrowUpRight } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface AlertsPanelProps {
  data: AlertSummary[];
  isLoading: boolean;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ data, isLoading }) => {
  const chartData = useMemo(() => {
    const labels = data.map((item) => item.rule_id);
    const values = data.map((item) => item.count);
    const backgroundColors = [
      'rgba(239, 68, 68, 0.8)',   // Red
      'rgba(249, 115, 22, 0.8)',  // Orange
      'rgba(234, 179, 8, 0.8)',   // Yellow
      'rgba(34, 197, 94, 0.8)',   // Green
      'rgba(6, 182, 212, 0.8)',   // Cyan
      'rgba(59, 130, 246, 0.8)',  // Blue
    ];

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
          borderWidth: 1,
          hoverOffset: 15,
        },
      ],
    };
  }, [data]);

  const chartOptions = {
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        bodyFont: {
          size: 14,
        },
        padding: 12,
        cornerRadius: 8,
        boxPadding: 6,
        callbacks: {
          label: function(context: any) {
            const index = context.dataIndex;
            const count = context.dataset.data[index];
            const label = data[index]?.rule_desc || 'Unknown';
            const percentage = ((count / data.reduce((sum, item) => sum + item.count, 0)) * 100).toFixed(1);
            return `${label}: ${count} (${percentage}%)`;
          }
        }
      },
    },
    cutout: '65%',
    responsive: true,
    maintainAspectRatio: false,
    hover: {
      mode: 'nearest',
      intersect: true,
    },
  };

  const totalAlerts = useMemo(() => {
    return data.reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-dark-800 rounded-xl border border-dark-700 shadow-card overflow-hidden"
    >
      <div className="flex justify-between items-center p-6 border-b border-dark-700">
        <h2 className="text-white text-lg font-bold">Alert Rules Summary</h2>
        <button className="text-primary-400 flex items-center text-sm hover:text-primary-300">
          View All <ArrowUpRight size={14} className="ml-1" />
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="relative h-[400px]">
              <Doughnut data={chartData} options={chartOptions} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-dark-400 text-sm">Total Alerts</span>
                <span className="text-white text-3xl font-bold">{totalAlerts}</span>
              </div>
            </div>
            
            <div className="h-[400px] overflow-y-auto space-y-4 custom-scrollbar">
              {data.map((alert) => (
                <motion.div
                  key={alert.rule_id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-between items-center bg-dark-700 rounded-lg p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${getColorForRuleId(alert.rule_id)}`}></div>
                      <p className="text-white text-sm font-medium">{alert.rule_id}</p>
                    </div>
                    <p className="text-dark-400 text-xs mt-1 truncate">{alert.rule_desc}</p>
                  </div>
                  <div className="text-white font-semibold text-sm">{alert.count}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const getColorForRuleId = (ruleId: string): string => {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-cyan-500',
    'bg-blue-500',
  ];
  
  const hash = ruleId.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  return colors[hash % colors.length];
};

export default AlertsPanel;