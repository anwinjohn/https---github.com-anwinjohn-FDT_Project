import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ChevronDown,
  Clock,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Zap,
  TrendingUp,
  BarChart3,
  X
} from 'lucide-react';
import { formatDateForApi, formatDateForDisplay } from '../utils/dateUtils';
import { DateRange } from '../types/types';
import { useTheme } from '../context/ThemeContext';

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (newDateRange: DateRange) => void;
}

interface CustomCalendarProps {
  startDate: Date | null;
  endDate: Date | null;
  onDateChange: (date: Date) => void;
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
}

// Custom Calendar Component
const CustomCalendar: React.FC<CustomCalendarProps> = ({
  startDate,
  endDate,
  onDateChange,
  currentMonth,
  onMonthChange
}) => {
  const { theme } = useTheme();
  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const days = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevDate = new Date(year, month, -firstDayOfWeek + i + 1);
    const isFuture = prevDate > today;
    days.push(
      <button
        key={`prev-${i}`}
        disabled={isFuture}
        className={`p-1.5 text-xs transition-colors rounded-md ${isFuture
          ? theme === 'dark'
            ? 'text-white/20 cursor-not-allowed'
            : 'text-gray-300 cursor-not-allowed'
          : theme === 'dark'
            ? 'text-white/30 hover:text-white/50'
            : 'text-gray-400 hover:text-gray-600'
          }`}
        onClick={() => !isFuture && onDateChange(prevDate)}
      >
        {prevDate.getDate()}
      </button>
    );
  }

  // Add days of the current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = date.toDateString() === today.toDateString();
    const isSelected = (startDate && date.toDateString() === startDate.toDateString()) ||
      (endDate && date.toDateString() === endDate.toDateString());
    const isInRange = startDate && endDate && date >= startDate && date <= endDate;
    const isFuture = date > today; // Block future dates

    days.push(
      <motion.button
        key={day}
        whileHover={!isFuture ? { scale: 1.1 } : {}}
        whileTap={!isFuture ? { scale: 0.95 } : {}}
        disabled={isFuture}
        className={`p-1.5 text-xs font-medium rounded-md transition-all relative ${isFuture
          ? theme === 'dark'
            ? 'text-white/20 cursor-not-allowed'
            : 'text-gray-300 cursor-not-allowed'
          : isSelected
            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
            : isInRange
              ? 'bg-blue-500/20 text-blue-300'
              : isToday
                ? theme === 'dark'
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'bg-blue-100 text-blue-700 border border-blue-300'
                : theme === 'dark'
                  ? 'text-white/80 hover:bg-white/10 hover:text-white'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          }`}
        onClick={() => !isFuture && onDateChange(date)}
      >
        {day}
        {isToday && !isSelected && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full"></div>
        )}
      </motion.button>
    );
  }

  const nextMonthStart = new Date(year, month + 1, 1);
  const remainingCells = 42 - days.length; // 6 rows × 7 days = 42 cells

  for (let i = 0; i < remainingCells; i++) {
    const nextDate = new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), i + 1);
    const isFuture = nextDate > today;
    days.push(
      <button
        key={`next-${i}`}
        disabled={isFuture}
        className={`p-1.5 text-xs transition-colors rounded-md ${isFuture
          ? theme === 'dark'
            ? 'text-white/20 cursor-not-allowed'
            : 'text-gray-300 cursor-not-allowed'
          : theme === 'dark'
            ? 'text-white/30 hover:text-white/50'
            : 'text-gray-400 hover:text-gray-600'
          }`}
        onClick={() => !isFuture && onDateChange(nextDate)}
      >
        {nextDate.getDate()}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onMonthChange(new Date(year, month - 1))}
          className={`p-1.5 rounded-lg transition-all ${theme === 'dark'
            ? 'hover:bg-white/10 text-white/70 hover:text-white'
            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>

        <h3 className={`text-base font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
          {monthNames[month]} {year}
        </h3>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onMonthChange(new Date(year, month + 1))}
          className={`p-1.5 rounded-lg transition-all ${theme === 'dark'
            ? 'hover:bg-white/10 text-white/70 hover:text-white'
            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
        >
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className={`p-1.5 text-center text-xs font-medium ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {days}
      </div>
    </div>
  );
};

const DateRangePicker: React.FC<DateRangePickerProps> = ({ dateRange, onDateRangeChange }) => {
  const { theme } = useTheme();
  const [startDate, setStartDate] = useState<Date | null>(
    new Date(dateRange.fromDate)
  );
  const [endDate, setEndDate] = useState<Date | null>(
    new Date(dateRange.toDate)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  // Move predefinedRanges inside the component so it can access theme
  const predefinedRanges = [
    {
      label: 'Today',
      days: 0,
      icon: Clock,
      color: theme === 'dark'
        ? 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 hover:from-blue-500/30 hover:to-cyan-500/30'
        : 'from-blue-100 to-cyan-100 border-blue-300 hover:from-blue-200 hover:to-cyan-200',
      iconColor: 'text-blue-400'
    },
    {
      label: '7 Days',
      days: 7,
      icon: CalendarDays,
      color: theme === 'dark'
        ? 'from-green-500/20 to-emerald-500/20 border-green-500/30 hover:from-green-500/30 hover:to-emerald-500/30'
        : 'from-green-100 to-emerald-100 border-green-300 hover:from-green-200 hover:to-emerald-200',
      iconColor: 'text-green-400'
    },
    {
      label: '30 Days',
      days: 30,
      icon: TrendingUp,
      color: theme === 'dark'
        ? 'from-orange-500/20 to-amber-500/20 border-orange-500/30 hover:from-orange-500/30 hover:to-amber-500/30'
        : 'from-orange-100 to-amber-100 border-orange-300 hover:from-orange-200 hover:to-amber-200',
      iconColor: 'text-orange-400'
    },
    {
      label: '90 Days',
      days: 90,
      icon: BarChart3,
      color: theme === 'dark'
        ? 'from-purple-500/20 to-pink-500/20 border-purple-500/30 hover:from-purple-500/30 hover:to-pink-500/30'
        : 'from-purple-100 to-pink-100 border-purple-300 hover:from-purple-200 hover:to-pink-200',
      iconColor: 'text-purple-400'
    }
  ];

const handleDateChange = (date: Date) => {
  if (!startDate || (startDate && endDate)) {
    // Starting new selection (first click)
    setStartDate(date);
    setEndDate(null);
    setIsSelectingEnd(true);
  } else if (startDate && !endDate) {
    // Second click - check if it's the same date
    if (date.toDateString() === startDate.toDateString()) {
      // Same date selected twice - set as single day range
      setEndDate(date);
      setIsSelectingEnd(false);
      
      onDateRangeChange({
        fromDate: formatDateForApi(date),
        toDate: formatDateForApi(date)
      });
    } else {
      // Different date selected - determine chronological order
      const fromDate = date > startDate ? startDate : date;
      const toDate = date > startDate ? date : startDate;

      setStartDate(fromDate);
      setEndDate(toDate);
      setIsSelectingEnd(false);

      onDateRangeChange({
        fromDate: formatDateForApi(fromDate),
        toDate: formatDateForApi(toDate)
      });
    }

    // Auto-close after selection
    setTimeout(() => setIsOpen(false), 500);
  }
};

  const handlePredefinedRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    if (days > 0) {
      start.setDate(start.getDate() - days + 1); // Include the current day in the range
    }

    setStartDate(start);
    setEndDate(end);

    onDateRangeChange({
      fromDate: formatDateForApi(start),
      toDate: formatDateForApi(end)
    });

    setTimeout(() => setIsOpen(false), 300);
  };

  const clearSelection = () => {
    // Set to current date instead of null
    const today = new Date();
    setStartDate(today);
    setEndDate(today);
    setIsSelectingEnd(false);

    onDateRangeChange({
      fromDate: formatDateForApi(today),
      toDate: formatDateForApi(today)
    });
  };

  // Calculate days selected with proper counting
  const getDaysSelected = () => {
    if (!startDate || !endDate) return 0;
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1; // Add 1 to include both start and end dates
  };

  const displayText = startDate && endDate
    ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`
    : startDate
      ? `${formatDateForDisplay(startDate)} - Select end date`
      : 'Select date range';

  return (
    <div className="relative z-50">
      <motion.button
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all duration-200 shadow-lg ${theme === 'dark'
          ? 'bg-gradient-to-r from-indigo-500/30 to-purple-500/30 border-indigo-500/40 text-white hover:from-indigo-500/40 hover:to-purple-500/40 shadow-indigo-500/20'
          : 'bg-gradient-to-r from-indigo-100 to-purple-100 border-indigo-300 text-indigo-700 hover:from-indigo-200 hover:to-purple-200 shadow-indigo-200'
          } backdrop-blur-xl font-medium`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar className="w-4 h-4 text-indigo-300" />
        <span className="hidden sm:inline font-medium">{displayText}</span>
        <span className="sm:hidden font-medium">Date</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3 h-3 text-indigo-300" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Panel - Reduced height and improved layout */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`absolute top-full right-0 mt-2 rounded-2xl shadow-2xl shadow-black/40 p-4 w-[400px] z-50 border ${theme === 'dark'
                ? 'bg-gradient-to-br from-slate-800/95 to-slate-900/95 border-white/20'
                : 'bg-gradient-to-br from-white/95 to-gray-50/95 border-gray-200'
                } backdrop-blur-2xl`}
            >
              {/* Compact Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Date Range Selection</h3>
                  <p className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}>Choose analysis period</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsOpen(false)}
                  className={`p-1.5 rounded-lg transition-all ${theme === 'dark'
                    ? 'hover:bg-white/10 text-white/60 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Compact Selection Status */}
              {(startDate || endDate) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`mb-4 p-3 rounded-xl border ${theme === 'dark'
                    ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20'
                    : 'bg-gradient-to-r from-blue-100 to-purple-100 border-blue-300'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                        {startDate && endDate
                          ? `${formatDateForDisplay(startDate)} → ${formatDateForDisplay(endDate)}`
                          : startDate
                            ? `From: ${formatDateForDisplay(startDate)}`
                            : 'No dates selected'
                        }
                      </div>
                      {startDate && endDate && (
                        <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'
                          }`}>
                          {getDaysSelected()} days selected
                        </div>
                      )}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={clearSelection}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${theme === 'dark'
                        ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                        : 'bg-red-200 text-red-700 hover:bg-red-300'
                        }`}
                    >
                      Clear
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Compact Quick Range Buttons */}
              <div className="mb-4">
                <h4 className={`font-semibold text-xs mb-2 flex items-center gap-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                  <Zap className="w-3 h-3 text-yellow-400" />
                  Quick Select
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {predefinedRanges.map((range) => {
                    const Icon = range.icon;
                    return (
                      <motion.button
                        key={range.label}
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg bg-gradient-to-r ${range.color} border transition-all duration-200 group`}
                        onClick={() => handlePredefinedRange(range.days)}
                      >
                        <Icon className={`w-3 h-3 ${range.iconColor}`} />
                        <span className={`font-medium text-xs ${theme === 'dark' ? 'text-white' : 'text-gray-700'
                          }`}>{range.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Compact Custom Calendar */}
              <div>
                <h4 className={`font-semibold text-xs mb-2 flex items-center gap-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                  <Calendar className="w-3 h-3 text-blue-400" />
                  Custom Range
                  {isSelectingEnd && (
                    <span className={`text-xs px-2 py-1 rounded-full ${theme === 'dark'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-blue-100 text-blue-600'
                      }`}>
                      Select End
                    </span>
                  )}
                </h4>
                <div className={`rounded-xl p-3 border ${theme === 'dark'
                  ? 'bg-gradient-to-br from-slate-900/60 to-black/40 border-white/10'
                  : 'bg-gradient-to-br from-gray-50 to-white border-gray-200'
                  }`}>
                  <CustomCalendar
                    startDate={startDate}
                    endDate={endDate}
                    onDateChange={handleDateChange}
                    currentMonth={currentMonth}
                    onMonthChange={setCurrentMonth}
                  />
                </div>
              </div>

              {/* Compact Footer */}
              <div className={`mt-4 pt-3 border-t flex justify-between items-center ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                }`}>
                <div className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                  }`}>
                  {startDate && endDate
                    ? '✓ Range selected'
                    : 'Select dates for analysis'
                  }
                </div>
                <div className="flex gap-2">
                  {startDate && endDate && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsOpen(false)}
                      className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-medium rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-lg"
                    >
                      Apply
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${theme === 'dark'
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    Close
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DateRangePicker;