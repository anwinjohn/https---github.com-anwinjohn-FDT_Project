import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { 
  TrendingUp, 
  Loader2, 
  AlertTriangle, 
  Calendar, 
  Filter, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight,
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useNotifications } from '../notifications';

interface TimeSeriesDataPoint {
  date: string;
  value: number;
  isAnomaly?: boolean;
  anomalyScore?: number;
  anomalyType?: 'spike' | 'drop' | 'level_shift' | 'trend_change' | 'volatility';
}

interface TimeSeriesAnomalyDetectionProps {
  data?: TimeSeriesDataPoint[];
  isLoading?: boolean;
  title?: string;
  description?: string;
  yAxisLabel?: string;
  dateRange?: { start: string; end: string };
  onDateRangeChange?: (range: { start: string; end: string }) => void;
}

const TimeSeriesAnomalyDetection: React.FC<TimeSeriesAnomalyDetectionProps> = ({
  data,
  isLoading = false,
  title = "Time Series Anomaly Detection",
  description = "Automated detection of unusual patterns and anomalies in transaction data",
  yAxisLabel = "Transaction Volume",
  dateRange,
  onDateRangeChange
}) => {
  const { theme } = useTheme();
  const { addNotification } = useNotifications();
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [selectedAnomaly, setSelectedAnomaly] = useState<TimeSeriesDataPoint | null>(null);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [timeWindow, setTimeWindow] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);

  // Generate mock data if none provided
  useEffect(() => {
    if (data) {
      setTimeSeriesData(data);
      setAnomalyCount(data.filter(point => point.isAnomaly).length);
    } else {
      // Generate mock time series data with anomalies
      const mockData: TimeSeriesDataPoint[] = [];
      const now = new Date();
      const baseValue = 1000;
      
      // Generate 90 days of data
      for (let i = 90; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // Base value with some randomness and weekly pattern
        let value = baseValue + Math.random() * 200 - 100;
        const dayOfWeek = date.getDay();
        
        // Lower values on weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          value *= 0.6;
        }
        
        // Add seasonal trend (higher in middle of month)
        const dayOfMonth = date.getDate();
        if (dayOfMonth > 10 && dayOfMonth < 20) {
          value *= 1.2;
        }
        
        // Determine if this is an anomaly
        let isAnomaly = false;
        let anomalyScore = 0;
        let anomalyType: TimeSeriesDataPoint['anomalyType'] = undefined;
        
        // Inject some anomalies
        if (i === 10) { // Recent spike
          value *= 2.5;
          isAnomaly = true;
          anomalyScore = 0.92;
          anomalyType = 'spike';
        } else if (i === 30) { // Drop
          value *= 0.3;
          isAnomaly = true;
          anomalyScore = 0.88;
          anomalyType = 'drop';
        } else if (i >= 50 && i <= 55) { // Level shift
          value *= 1.8;
          isAnomaly = true;
          anomalyScore = 0.75;
          anomalyType = 'level_shift';
        } else if (i === 70) { // Another spike
          value *= 2.2;
          isAnomaly = true;
          anomalyScore = 0.85;
          anomalyType = 'spike';
        }
        
        // Random anomalies
        if (Math.random() < 0.03 && !isAnomaly) {
          const anomalyFactor = Math.random() < 0.5 ? 0.4 : 2;
          value *= anomalyFactor;
          isAnomaly = true;
          anomalyScore = 0.7 + Math.random() * 0.2;
          anomalyType = Math.random() < 0.5 ? 'spike' : 'drop';
        }
        
        mockData.push({
          date: date.toISOString().split('T')[0],
          value: Math.round(value),
          isAnomaly,
          anomalyScore,
          anomalyType
        });
      }
      
      setTimeSeriesData(mockData);
      setAnomalyCount(mockData.filter(point => point.isAnomaly).length);
    }
  }, [data]);

  const handleAnomalyClick = (dataPoint: TimeSeriesDataPoint) => {
    setSelectedAnomaly(dataPoint);
    
    // Show notification with anomaly details
    const date = new Date(dataPoint.date).toLocaleDateString();
    const score = dataPoint.anomalyScore ? `${(dataPoint.anomalyScore * 100).toFixed(1)}%` : 'N/A';
    const type = dataPoint.anomalyType ? dataPoint.anomalyType.replace('_', ' ') : 'unknown';
    
    addNotification(
      `Date: ${date}\nValue: ${dataPoint.value}\nAnomaly Score: ${score}\nType: ${type}`,
      'warning',
      5000,
      'Anomaly Details'
    );
  };

  const handleExport = () => {
    try {
      // Create CSV content
      const headers = ['Date', 'Value', 'Is Anomaly', 'Anomaly Score', 'Anomaly Type'];
      const csvContent = [
        headers.join(','),
        ...timeSeriesData.map(point => [
          point.date,
          point.value,
          point.isAnomaly ? 'Yes' : 'No',
          point.anomalyScore || '',
          point.anomalyType || ''
        ].join(','))
      ].join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `time-series-anomalies-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addNotification('Time series data exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      addNotification('Failed to export time series data', 'error');
    }
  };

  const handleTimeWindowChange = (window: typeof timeWindow) => {
    setTimeWindow(window);
    
    // In a real app, this would trigger a data fetch with the new time window
    // For now, we'll just show a notification
    addNotification(`Time window changed to ${window}`, 'info');
  };

  // Filter data based on current settings
  const filteredData = showAnomaliesOnly 
    ? timeSeriesData.filter(point => point.isAnomaly)
    : timeSeriesData;

  // Prepare chart options
  const getChartOptions = () => {
    const dates = filteredData.map(item => item.date);
    const values = filteredData.map(item => item.value);
    const anomalyPoints = filteredData
      .filter(item => item.isAnomaly)
      .map(item => [
        filteredData.findIndex(d => d.date === item.date),
        item.value
      ]);
    
    return {
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        formatter: function(params: any) {
          const dataIndex = params[0].dataIndex;
          const point = filteredData[dataIndex];
          let tooltipText = `<div style="font-weight: bold; margin-bottom: 5px;">${point.date}</div>`;
          tooltipText += `<div>${yAxisLabel}: ${point.value}</div>`;
          
          if (point.isAnomaly) {
            tooltipText += `<div style="color: #ef4444; margin-top: 5px;">⚠️ Anomaly Detected</div>`;
            if (point.anomalyScore) {
              tooltipText += `<div>Confidence: ${(point.anomalyScore * 100).toFixed(1)}%</div>`;
            }
            if (point.anomalyType) {
              tooltipText += `<div>Type: ${point.anomalyType.replace('_', ' ')}</div>`;
            }
          }
          
          return tooltipText;
        }
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
          formatter: function(value: string) {
            // Format date based on time window
            const date = new Date(value);
            if (timeWindow === 'day') {
              return `${date.getHours()}:00`;
            } else if (timeWindow === 'week' || timeWindow === 'month') {
              return `${date.getDate()}/${date.getMonth() + 1}`;
            } else {
              return `${date.getMonth() + 1}/${date.getFullYear().toString().substr(2, 2)}`;
            }
          }
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameTextStyle: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
        },
        axisLabel: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
          }
        },
        splitLine: {
          lineStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
          }
        }
      },
      series: [
        {
          name: yAxisLabel,
          type: 'line',
          data: values,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 3,
            color: theme === 'dark' ? '#8b5cf6' : '#6366f1'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0,
                color: theme === 'dark' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(99, 102, 241, 0.5)'
              }, {
                offset: 1,
                color: theme === 'dark' ? 'rgba(139, 92, 246, 0.05)' : 'rgba(99, 102, 241, 0.05)'
              }]
            }
          }
        },
        {
          name: 'Anomalies',
          type: 'scatter',
          data: anomalyPoints,
          symbolSize: 10,
          itemStyle: {
            color: '#ef4444'
          }
        }
      ]
    };
  };

  // Helper function to get most common anomaly type
  const getMostCommonAnomalyType = () => {
    const anomaliesWithType = timeSeriesData.filter(d => d.isAnomaly && d.anomalyType);
    if (anomaliesWithType.length === 0) return 'None';
    
    const typeCounts = anomaliesWithType.reduce((acc, curr) => {
      acc[curr.anomalyType!] = (acc[curr.anomalyType!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const entries = Object.entries(typeCounts);
    const sortedEntries = entries.sort((a, b) => b[1] - a[1]);
    const mostCommon = sortedEntries[0];
    
    return mostCommon ? mostCommon[0].replace('_', ' ') : 'None';
  };

  // Helper function to get last anomaly date
  const getLastAnomalyDate = () => {
    const anomalies = timeSeriesData.filter(d => d.isAnomaly);
    if (anomalies.length === 0) return 'None';
    
    const sortedAnomalies = anomalies.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastAnomaly = sortedAnomalies[0];
    
    return lastAnomaly ? new Date(lastAnomaly.date).toLocaleDateString() : 'None';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${
        theme === 'dark' 
          ? 'bg-white/10 border-white/20' 
          : 'bg-white border-gray-200'
      } backdrop-blur-xl`}
    >
      <div className={`flex justify-between items-center p-6 border-b ${
        theme === 'dark' ? 'border-white/20' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>{title}</h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-purple-200/70' : 'text-purple-600'
            }`}>{description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            theme === 'dark' ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
          }`}>
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">{anomalyCount} Anomalies</span>
          </div>
          
          <button
            onClick={handleExport}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300' 
                : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
            }`}
            title="Export Data"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={`p-4 border-b ${
        theme === 'dark' ? 'border-white/10' : 'border-gray-200'
      }`}>
        <div className="flex flex-wrap justify-between items-center">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTimeWindowChange('day')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                timeWindow === 'day'
                  ? theme === 'dark'
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-purple-100 text-purple-700 border border-purple-300'
                  : theme === 'dark'
                    ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              Day
            </button>
            
            <button
              onClick={() => handleTimeWindowChange('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                timeWindow === 'week'
                  ? theme === 'dark'
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-purple-100 text-purple-700 border border-purple-300'
                  : theme === 'dark'
                    ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              Week
            </button>
            
            <button
              onClick={() => handleTimeWindowChange('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                timeWindow === 'month'
                  ? theme === 'dark'
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-purple-100 text-purple-700 border border-purple-300'
                  : theme === 'dark'
                    ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              Month
            </button>
            
            <button
              onClick={() => handleTimeWindowChange('quarter')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                timeWindow === 'quarter'
                  ? theme === 'dark'
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-purple-100 text-purple-700 border border-purple-300'
                  : theme === 'dark'
                    ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              Quarter
            </button>
            
            <button
              onClick={() => handleTimeWindowChange('year')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                timeWindow === 'year'
                  ? theme === 'dark'
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-purple-100 text-purple-700 border border-purple-300'
                  : theme === 'dark'
                    ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              Year
            </button>
          </div>
          
          <div className="flex items-center mt-2 sm:mt-0">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAnomaliesOnly}
                onChange={(e) => setShowAnomaliesOnly(e.target.checked)}
                className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
              />
              <span className={`text-sm ${
                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
              }`}>Show anomalies only</span>
            </label>
          </div>
        </div>
      </div>

      <div className="h-[500px] p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className={`w-12 h-12 animate-spin ${
              theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
            }`} />
            <p className={`mt-4 ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>Analyzing time series data...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertTriangle className={`w-12 h-12 ${
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
            }`} />
            <p className={`mt-4 ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>No data available for the selected filters</p>
          </div>
        ) : (
          <ReactECharts
            option={getChartOptions()}
            style={{ height: '100%', width: '100%' }}
            theme={theme === 'dark' ? 'dark' : undefined}
            onEvents={{
              click: (params) => {
                if (params.seriesName === 'Anomalies') {
                  const dataIndex = params.dataIndex;
                  const point = filteredData.filter(p => p.isAnomaly)[dataIndex];
                  handleAnomalyClick(point);
                }
              }
            }}
          />
        )}
      </div>

      {/* Anomaly Insights */}
      <div className={`p-6 border-t ${
        theme === 'dark' ? 'border-white/10' : 'border-gray-200'
      }`}>
        <h4 className={`text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>Anomaly Insights</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-400" />
              <h5 className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Detection Summary</h5>
            </div>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>
              {anomalyCount > 0 
                ? `${anomalyCount} anomalies detected in the current time window.`
                : 'No anomalies detected in the current time window.'}
            </p>
          </div>
          
          <div className={`p-4 rounded-xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h5 className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Pattern Analysis</h5>
            </div>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>
              Most common anomaly type: {getMostCommonAnomalyType()}
            </p>
          </div>
          
          <div className={`p-4 rounded-xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <h5 className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Recent Activity</h5>
            </div>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>
              Last anomaly detected: {getLastAnomalyDate()}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TimeSeriesAnomalyDetection;