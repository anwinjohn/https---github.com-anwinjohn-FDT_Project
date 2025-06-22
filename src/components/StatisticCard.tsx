import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpIcon, ArrowDownIcon, Minus, Loader2 } from 'lucide-react';
import { formatNumber } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';

interface StatisticCardProps {
  title: string;
  value: number;
  percentChange?: number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  subtitle?: string;
  isActive?: boolean;
  onClick?: () => void;
  isLoading?: boolean;
}

const StatisticCard: React.FC<StatisticCardProps> = ({
  title,
  value,
  percentChange,
  icon,
  color,
  trend,
  subtitle,
  isActive,
  onClick,
  isLoading = false,
}) => {
  const { theme } = useTheme();

  const getTrendIcon = () => {
    if (!percentChange) return <Minus size={14} />;
    
    if (percentChange > 0) {
      return <ArrowUpIcon size={14} className="text-red-400" />;
    } else if (percentChange < 0) {
      return <ArrowDownIcon size={14} className="text-green-400" />;
    } else {
      return <Minus size={14} className={theme === 'dark' ? 'text-white/40' : 'text-gray-400'} />;
    }
  };

  const getPercentageText = () => {
    if (!percentChange) return null;
    
    const absValue = Math.abs(percentChange);
    const className = percentChange > 0 
      ? 'text-red-400' 
      : percentChange < 0 
        ? 'text-green-400' 
        : theme === 'dark' ? 'text-white/40' : 'text-gray-400';
    
    return (
      <span className={className}>
        {percentChange > 0 ? '+' : ''}{absValue}%
      </span>
    );
  };

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 group overflow-hidden ${
        isActive
          ? theme === 'dark'
            ? 'bg-white/20 border-2 border-blue-400/50 shadow-2xl shadow-blue-500/20'
            : 'bg-blue-50 border-2 border-blue-400 shadow-2xl shadow-blue-500/20'
          : theme === 'dark'
            ? 'bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30'
            : 'bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 shadow-card hover:shadow-card-hover'
      } backdrop-blur-xl`}
    >
      {/* Background Gradient Effect */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${color}`} />
      
      {/* Loading Overlay */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`absolute inset-0 rounded-2xl flex items-center justify-center z-10 ${
            theme === 'dark' ? 'bg-black/20' : 'bg-white/80'
          } backdrop-blur-sm`}
        >
          <Loader2 className={`w-6 h-6 animate-spin ${
            theme === 'dark' ? 'text-white' : 'text-gray-600'
          }`} />
        </motion.div>
      )}

      <div className="flex items-start justify-between mb-4">
        <motion.div 
          className={`p-3 rounded-xl ${color} shadow-lg group-hover:scale-110 transition-transform duration-200`}
          whileHover={{ rotate: 5 }}
        >
          <div className="text-white">{icon}</div>
        </motion.div>
        
        {(percentChange !== undefined || trend) && (
          <div className="text-right">
            {trend ? (
              <motion.span 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className={`text-sm font-bold px-2 py-1 rounded-lg ${
                  trend?.startsWith('+') 
                    ? 'text-green-600 bg-green-500/20 dark:text-green-400 dark:bg-green-500/20' 
                    : 'text-red-600 bg-red-500/20 dark:text-red-400 dark:bg-red-500/20'
                }`}
              >
                {trend}
              </motion.span>
            ) : (
              <div className="flex items-center gap-1 text-sm">
                {getTrendIcon()}
                {getPercentageText()}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex items-baseline gap-2"
        >
          <h3 className={`text-3xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>{formatNumber(value)}</h3>
          {isLoading && <Loader2 className={`w-4 h-4 animate-spin ${
            theme === 'dark' ? 'text-white/60' : 'text-gray-400'
          }`} />}
        </motion.div>
        <p className={`font-semibold text-sm ${
          theme === 'dark' ? 'text-white/90' : 'text-gray-800'
        }`}>{title}</p>
        {subtitle && (
          <p className={`text-xs leading-relaxed ${
            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
          }`}>{subtitle}</p>
        )}
      </div>
      
      {/* Active State Indicator */}
      {isActive && (
        <motion.div
          layoutId="activeCard"
          className={`absolute inset-0 rounded-2xl ${
            theme === 'dark' 
              ? 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10' 
              : 'bg-gradient-to-r from-blue-100/50 to-indigo-100/50'
          }`}
          initial={false}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}

      {/* Hover Glow Effect */}
      <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${
        theme === 'dark' 
          ? 'bg-gradient-to-r from-white/5 to-white/10' 
          : 'bg-gradient-to-r from-gray-100/50 to-gray-200/50'
      }`} />
    </motion.div>
  );
};

export default StatisticCard;