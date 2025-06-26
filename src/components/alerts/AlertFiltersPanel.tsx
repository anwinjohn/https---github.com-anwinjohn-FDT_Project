import React from 'react';
import { motion } from 'framer-motion';
import { X, Search, Calendar, Filter, RotateCcw } from 'lucide-react';
import { AlertFilters } from '../../types/alerts';
import { useTheme } from '../../context/ThemeContext';

interface AlertFiltersPanelProps {
  filters: AlertFilters;
  onFiltersChange: (filters: Partial<AlertFilters>) => void;
  onClose: () => void;
}

const AlertFiltersPanel: React.FC<AlertFiltersPanelProps> = ({
  filters,
  onFiltersChange,
  onClose
}) => {
  const { theme } = useTheme();

  const serviceTypes = ['OUTWARD', 'INWARD', 'INTERNAL'];
  const ruleIds = ['RF-005', 'RF-012', 'RF-001', 'RF-003', 'RF-007'];
  const statuses = ['OPEN', 'IN_PROGRESS', 'CLOSED'];
  const priorities = ['HIGH', 'MEDIUM', 'LOW'];

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      service_type: [],
      rule_id: [],
      status: [],
      priority: [],
      date_range: { from: '', to: '' },
      assigned_to: [],
      branch_name: [],
      cust_nationality: []
    });
  };

  const handleMultiSelectChange = (
    field: keyof AlertFilters,
    value: string,
    currentValues: string[]
  ) => {
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    onFiltersChange({ [field]: newValues });
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={`rounded-2xl border p-6 overflow-hidden ${
        theme === 'dark' 
          ? 'bg-white/5 border-white/20' 
          : 'bg-gray-50 border-gray-200'
      } backdrop-blur-xl`}
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
            <Filter className="w-5 h-5 text-white" />
          </div>
          <h3 className={`text-lg font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Advanced Filters</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClearFilters}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-white/10 hover:bg-white/20 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Clear
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-white/10 hover:bg-white/20 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Search */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
          }`}>Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              placeholder="Customer, rule, code..."
              className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark' 
                  ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                  : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
        </div>

        {/* Service Type */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
          }`}>Service Type</label>
          <div className="space-y-2">
            {serviceTypes.map(type => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.service_type.includes(type)}
                  onChange={() => handleMultiSelectChange('service_type', type, filters.service_type)}
                  className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                />
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Rule ID */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
          }`}>Rule ID</label>
          <div className="space-y-2">
            {ruleIds.map(ruleId => (
              <label key={ruleId} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.rule_id.includes(ruleId)}
                  onChange={() => handleMultiSelectChange('rule_id', ruleId, filters.rule_id)}
                  className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                />
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>{ruleId}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-white/80' : 'text-gray-700'
          }`}>Date Range</label>
          <div className="space-y-2">
            <input
              type="date"
              value={filters.date_range.from}
              onChange={(e) => onFiltersChange({ 
                date_range: { ...filters.date_range, from: e.target.value }
              })}
              className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark' 
                  ? 'bg-white/10 border border-white/20 text-white' 
                  : 'bg-white border border-gray-300 text-gray-900'
              }`}
            />
            <input
              type="date"
              value={filters.date_range.to}
              onChange={(e) => onFiltersChange({ 
                date_range: { ...filters.date_range, to: e.target.value }
              })}
              className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark' 
                  ? 'bg-white/10 border border-white/20 text-white' 
                  : 'bg-white border border-gray-300 text-gray-900'
              }`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AlertFiltersPanel;