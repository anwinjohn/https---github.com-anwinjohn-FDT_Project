import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Search, 
  Calendar, 
  Filter, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp,
  Building,
  User,
  Shield,
  AlertTriangle,
  FileText,
  Globe,
  Check
} from 'lucide-react';
import { AlertFilters } from '../../types/alerts';
import { useTheme } from '../../context/ThemeContext';

interface FilterOptions {
  serviceTypes: string[];
  ruleIds: string[];
  statuses: string[];
  priorities: string[];
  assignees: string[];
  branches: string[];
  nationalities: string[];
}

interface AlertFiltersPanelProps {
  filters: AlertFilters;
  filterOptions: FilterOptions;
  onFiltersChange: (filters: Partial<AlertFilters>) => void;
  onClose: () => void;
  isCompact?: boolean;
}

const AlertFiltersPanel: React.FC<AlertFiltersPanelProps> = ({
  filters,
  filterOptions,
  onFiltersChange,
  onClose,
  isCompact = true
}) => {
  const { theme } = useTheme();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.service_type.length > 0) count++;
    if (filters.rule_id.length > 0) count++;
    if (filters.status.length > 0) count++;
    if (filters.priority.length > 0) count++;
    if (filters.assigned_to.length > 0) count++;
    if (filters.branch_name.length > 0) count++;
    if (filters.cust_nationality.length > 0) count++;
    if (filters.date_range.from || filters.date_range.to) count++;
    return count;
  };

  const FilterDropdown = ({ 
    title, 
    field, 
    options, 
    currentValues, 
    icon,
    width = 'w-32'
  }: { 
    title: string; 
    field: keyof AlertFilters; 
    options: string[]; 
    currentValues: string[];
    icon?: React.ReactNode;
    width?: string;
  }) => {
    if (!options || options.length === 0) return null;

    const isExpanded = expandedSection === field;
    const hasSelection = currentValues.length > 0;

    return (
      <div className={`relative ${width}`}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setExpandedSection(isExpanded ? null : field)}
          className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full border ${
            hasSelection 
              ? 'bg-blue-500/10 text-blue-600 border-blue-300 shadow-sm dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30' 
              : theme === 'dark' 
                ? 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border-gray-600/50 hover:border-gray-500' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="w-4 h-4 flex-shrink-0 opacity-70">{icon}</span>}
            <span className="truncate">{title}</span>
            {hasSelection && (
              <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 min-w-[20px] text-center">
                {currentValues.length}
              </span>
            )}
          </div>
          {isExpanded ? 
            <ChevronUp className="w-4 h-4 flex-shrink-0 opacity-70" /> : 
            <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-70" />
          }
        </motion.button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={`absolute top-full left-0 mt-1 w-full min-w-[220px] rounded-xl shadow-2xl border backdrop-blur-xl z-[9999] ${
                theme === 'dark' 
                  ? 'bg-gray-800/95 border-gray-600/50' 
                  : 'bg-white/95 border-gray-200/50'
              }`}
              style={{ 
                boxShadow: theme === 'dark' 
                  ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1)' 
                  : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="p-2">
                <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                  {options.map(option => (
                    <motion.label 
                      key={option} 
                      className={`flex items-center gap-3 cursor-pointer group p-2.5 rounded-lg transition-all hover:scale-[1.02] ${
                        theme === 'dark' 
                          ? 'hover:bg-gray-700/50' 
                          : 'hover:bg-gray-50'
                      }`}
                      whileHover={{ x: 2 }}
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={currentValues.includes(option)}
                          onChange={() => handleMultiSelectChange(field, option, currentValues)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        />
                        {currentValues.includes(option) && (
                          <Check className="w-3 h-3 text-white absolute top-0.5 left-0.5 pointer-events-none" />
                        )}
                      </div>
                      <span className={`text-sm font-medium transition-colors truncate flex-1 ${
                        currentValues.includes(option)
                          ? 'text-blue-600 dark:text-blue-400'
                          : theme === 'dark' 
                            ? 'text-gray-300 group-hover:text-white' 
                            : 'text-gray-700 group-hover:text-gray-900'
                      }`} title={option}>
                        {option}
                      </span>
                    </motion.label>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`rounded-xl border p-5 relative ${
        theme === 'dark' 
          ? 'bg-gray-900/95 border-gray-700/50' 
          : 'bg-white/95 border-gray-200/50'
      } backdrop-blur-xl shadow-xl`}
      style={{ zIndex: 1000 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg">
            <Filter className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Advanced Filters
            </h3>
            {getActiveFiltersCount() > 0 && (
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {getActiveFiltersCount()} filter{getActiveFiltersCount() !== 1 ? 's' : ''} applied
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClearFilters}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              getActiveFiltersCount() > 0
                ? theme === 'dark' 
                  ? 'text-orange-300 hover:text-orange-200 hover:bg-orange-500/10 border border-orange-500/30' 
                  : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50 border border-orange-200'
                : theme === 'dark' 
                  ? 'text-gray-500 cursor-not-allowed border border-gray-700' 
                  : 'text-gray-400 cursor-not-allowed border border-gray-200'
            }`}
            disabled={getActiveFiltersCount() === 0}
          >
            <RotateCcw className="w-4 h-4" />
            Clear All
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'text-gray-400 hover:text-white hover:bg-gray-700/50' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      <div className="space-y-4">
        {/* First Row: Search, Priority, Services, Rule */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Input - Reduced width */}
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              placeholder="Search alerts..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border ${
                filters.search
                  ? 'border-blue-300 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-500/10'
                  : theme === 'dark' 
                    ? 'bg-gray-800/50 border-gray-600/50 text-white placeholder-gray-400 focus:border-blue-500/50' 
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500 shadow-sm'
              }`}
            />
          </div>

          <FilterDropdown
            title="Priority"
            field="priority"
            options={filterOptions.priorities}
            currentValues={filters.priority}
            icon={<AlertTriangle className="w-4 h-4" />}
            width="w-36"
          />

          <FilterDropdown
            title="Services"
            field="service_type"
            options={filterOptions.serviceTypes}
            currentValues={filters.service_type}
            icon={<Building className="w-4 h-4" />}
            width="w-36"
          />

          <FilterDropdown
            title="Rule"
            field="rule_id"
            options={filterOptions.ruleIds}
            currentValues={filters.rule_id}
            icon={<FileText className="w-4 h-4" />}
            width="w-26"
          />
          <FilterDropdown
            title="Branch"
            field="branch_name"
            options={filterOptions.branches}
            currentValues={filters.branch_name}
            icon={<Building className="w-4 h-4" />}
            width="w-42"
          />
          {/* Date Range - Compact design */}
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
            (filters.date_range.from || filters.date_range.to)
              ? 'border-blue-300 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-500/10'
              : theme === 'dark' 
                ? 'bg-gray-800/50 border-gray-600/50' 
                : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={filters.date_range.from}
              onChange={(e) => onFiltersChange({ 
                date_range: { ...filters.date_range, from: e.target.value }
              })}
              className={`w-32 px-2 py-1 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all ${
                theme === 'dark' 
                  ? 'bg-gray-700/50 border border-gray-600/50 text-gray-300' 
                  : 'bg-gray-50 border border-gray-200 text-gray-700'
              }`}
            />
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>to</span>
            <input
              type="date"
              value={filters.date_range.to}
              onChange={(e) => onFiltersChange({ 
                date_range: { ...filters.date_range, to: e.target.value }
              })}
              className={`w-32 px-2 py-1 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all ${
                theme === 'dark' 
                  ? 'bg-gray-700/50 border border-gray-600/50 text-gray-300' 
                  : 'bg-gray-50 border border-gray-200 text-gray-700'
              }`}
            />
          </div>
        </div>

        {/* Second Row: Branch, Date Range */}
        {/* <div className="flex items-center gap-3 flex-wrap">
          <FilterDropdown
            title="Branch"
            field="branch_name"
            options={filterOptions.branches}
            currentValues={filters.branch_name}
            icon={<Building className="w-4 h-4" />}
            width="w-36"
          /> */}

          {/* Date Range - Compact design */}
          {/* <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
            (filters.date_range.from || filters.date_range.to)
              ? 'border-blue-300 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-500/10'
              : theme === 'dark' 
                ? 'bg-gray-800/50 border-gray-600/50' 
                : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={filters.date_range.from}
              onChange={(e) => onFiltersChange({ 
                date_range: { ...filters.date_range, from: e.target.value }
              })}
              className={`w-32 px-2 py-1 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all ${
                theme === 'dark' 
                  ? 'bg-gray-700/50 border border-gray-600/50 text-gray-300' 
                  : 'bg-gray-50 border border-gray-200 text-gray-700'
              }`}
            />
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>to</span>
            <input
              type="date"
              value={filters.date_range.to}
              onChange={(e) => onFiltersChange({ 
                date_range: { ...filters.date_range, to: e.target.value }
              })}
              className={`w-32 px-2 py-1 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all ${
                theme === 'dark' 
                  ? 'bg-gray-700/50 border border-gray-600/50 text-gray-300' 
                  : 'bg-gray-50 border border-gray-200 text-gray-700'
              }`}
            />
          </div>
        </div> */}

        {/* Active Filters Tags */}
        {getActiveFiltersCount() > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`pt-4 border-t ${theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200/50'}`}
          >
            <div className="flex flex-wrap gap-2">
              {filters.search && (
                <motion.span 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50"
                >
                  <Search className="w-3 h-3" />
                  "{filters.search}"
                </motion.span>
              )}
              
              {filters.service_type.slice(0, 2).map(type => (
                <motion.span 
                  key={type}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-700/50"
                >
                  <Building className="w-3 h-3" />
                  {type}
                </motion.span>
              ))}
              {filters.service_type.length > 2 && (
                <span className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  +{filters.service_type.length - 2} more
                </span>
              )}
              
              {filters.priority.slice(0, 2).map(priority => (
                <motion.span 
                  key={priority}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-700/50"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {priority}
                </motion.span>
              ))}
              {filters.priority.length > 2 && (
                <span className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  +{filters.priority.length - 2} more
                </span>
              )}

              {filters.rule_id.slice(0, 2).map(rule => (
                <motion.span 
                  key={rule}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50"
                >
                  <FileText className="w-3 h-3" />
                  {rule}
                </motion.span>
              ))}
              {filters.rule_id.length > 2 && (
                <span className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  +{filters.rule_id.length - 2} more
                </span>
              )}

              {filters.branch_name.slice(0, 2).map(branch => (
                <motion.span 
                  key={branch}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-700/50"
                >
                  <Building className="w-3 h-3" />
                  {branch}
                </motion.span>
              ))}
              {filters.branch_name.length > 2 && (
                <span className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  +{filters.branch_name.length - 2} more
                </span>
              )}
              
              {(filters.date_range.from || filters.date_range.to) && (
                <motion.span 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50"
                >
                  <Calendar className="w-3 h-3" />
                  {filters.date_range.from || 'Start'} - {filters.date_range.to || 'End'}
                </motion.span>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default AlertFiltersPanel;