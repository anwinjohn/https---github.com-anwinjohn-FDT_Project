import React from 'react';
import { motion } from 'framer-motion';
import { AlertSummary } from '../types/types';
import { Filter, Download } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface DetailedRulesPanelProps {
  data: AlertSummary[];
  isLoading: boolean;
}

const DetailedRulesPanel: React.FC<DetailedRulesPanelProps> = ({ data, isLoading }) => {
  const { theme } = useTheme();

  const getRiskLevel = (riskLevel: string) => {
    if (riskLevel === 'High') return { level: 'HIGH', color: 'text-red-400 bg-red-500/20' };
    if (riskLevel === 'Medium') return { level: 'MEDIUM', color: 'text-orange-400 bg-orange-500/20' };
    return { level: 'LOW', color: 'text-green-400 bg-green-500/20' };
  };
  const getActiveStatus = (isActive: boolean) => {
    if (isActive) return { status: 'Active', textColor: 'text-green-400', bgColor: 'bg-green-500/20', dotColor: 'bg-green-400' };
    return { status: 'Inactive', textColor: 'text-gray-400', bgColor: 'bg-gray-500/20', dotColor: 'bg-red-400' };
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl p-6 border shadow-2xl ${theme === 'dark'
        ? 'bg-white/10 border-white/20'
        : 'bg-white border-gray-200 shadow-card'
        } backdrop-blur-xl`}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-2xl font-bold flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
            <Filter className="w-5 h-5 text-white" />
          </div>
          Alert Rules Analysis
        </h3>
        <button className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${theme === 'dark'
          ? 'bg-white/10 hover:bg-white/20 text-white'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}>
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-96">
          <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${theme === 'dark' ? 'border-blue-500' : 'border-blue-600'
            }`}></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b-2 ${theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                }`}>
                <th className={`px-6 py-4 text-left font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Rule ID</th>
                <th className={`px-6 py-4 text-left font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Description</th>
                <th className={`px-6 py-4 text-right font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Count</th>
                <th className={`px-6 py-4 text-center font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Risk Level</th>
                <th className={`px-6 py-4 text-center font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data
                // .sort((a, b) => b.count - a.count)
                .map((rule) => {
                  console.table(rule);
                  const risk = getRiskLevel(rule.rule_priority);
                  const isActive = getActiveStatus(rule.active_status);
                  return (
                    <tr
                      key={rule.rule_id}
                      className={`border-b transition-all duration-200 group ${theme === 'dark'
                        ? 'border-white/10 hover:bg-white/5'
                        : 'border-gray-100 hover:bg-gray-50'
                        }`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono whitespace-nowrap bg-blue-500/20 px-3 py-1 rounded-lg text-sm">
                          {rule.rule_id}
                        </span>
                      </td>
                      <td className={`px-6 py-4 transition-colors ${theme === 'dark'
                        ? 'text-white group-hover:text-blue-200'
                        : 'text-gray-900 group-hover:text-blue-700'
                        }`}>
                        {rule.rule_desc}
                        <div className={`text-xs mt-1 overflow-hidden text-clip max-w-[800px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                          {rule.scenario_logic}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                          {rule.count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${risk.color}`}>
                          {risk.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`flex items-center justify-center px-3 py-1 rounded-full ${isActive.bgColor}`}>
                          <div className={`w-3 h-3 rounded-full animate-pulse ${isActive.dotColor}`}></div>
                          <span className={`ml-2 text-sm ${isActive.textColor}`}>
                            {isActive.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
};

export default DetailedRulesPanel;