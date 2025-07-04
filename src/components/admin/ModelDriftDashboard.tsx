import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  Filter, 
  Download, 
  RefreshCw, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  Zap, 
  Brain, 
  Target, 
  Layers, 
  Loader2, 
  X,
  CheckCircle,
  XCircle,
  Info,
  Sliders,
  FileText,
  BarChart,
  PieChart,
  AreaChart,
  LineChart
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import { useNotifications } from '../notifications';
import PermissionGuard from '../PermissionGuard';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';

interface DriftMetric {
  id: string;
  date: string;
  feature: string;
  metric: string;
  value: number;
  threshold: number;
  alert: boolean;
  model_id?: string;
  model_version?: string;
  environment?: string;
  category?: string;
}

interface ModelInfo {
  id: string;
  name: string;
  version: string;
  type: string;
  created_at: string;
  last_trained: string;
  status: 'active' | 'inactive' | 'deprecated';
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    auc: number;
  };
}

interface ModelDriftDashboardProps {
  modelId?: string;
}

const ModelDriftDashboard: React.FC<ModelDriftDashboardProps> = ({ modelId }) => {
  const { theme } = useTheme();
  const { getMenuId } = useMenuIds();
  const { addNotification } = useNotifications();
  
  // Get menu ID for permission check
  const MODEL_DRIFT_MENU_ID = getMenuId('model_drift');
  
  // State
  const [metrics, setMetrics] = useState<DriftMetric[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['PSI', 'KS', 'JS']);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'metrics', 'features']));
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'trends'>('table');
  
  // Available features and metrics for filtering
  const availableFeatures = useMemo(() => {
    const features = new Set<string>();
    metrics.forEach(m => features.add(m.feature));
    return Array.from(features);
  }, [metrics]);
  
  const availableMetricTypes = useMemo(() => {
    const metricTypes = new Set<string>();
    metrics.forEach(m => metricTypes.add(m.metric));
    return Array.from(metricTypes);
  }, [metrics]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // In a real implementation, this would call the API
        // const response = await axios.get('/api/drift-metrics', {
        //   params: {
        //     model_id: selectedModel,
        //     start_date: dateRange.start,
        //     end_date: dateRange.end,
        //     features: selectedFeatures.join(','),
        //     metrics: selectedMetrics.join(','),
        //     alerts_only: alertsOnly
        //   }
        // });
        
        // For now, we'll use mock data
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
        
        // Generate mock data
        const mockMetrics: DriftMetric[] = [];
        const features = ['age', 'income', 'credit_score', 'transaction_amount', 'transaction_frequency', 'location', 'device_type', 'time_of_day'];
        const metricTypes = ['PSI', 'KS', 'JS', 'Hellinger', 'Wasserstein'];
        
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        const dayDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Generate data for each day in the range
        for (let i = 0; i <= dayDiff; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Generate metrics for each feature
          features.forEach(feature => {
            // Not all features have all metrics
            const featureMetrics = feature === 'location' || feature === 'device_type' 
              ? ['PSI', 'JS'] 
              : metricTypes;
            
            featureMetrics.forEach(metric => {
              // Base value that's consistent for a feature-metric pair
              const baseValue = (features.indexOf(feature) * 0.1) + (metricTypes.indexOf(metric) * 0.05);
              
              // Add some randomness and trend
              let value = baseValue + (Math.random() * 0.2 - 0.1);
              
              // Add trend - increasing drift over time for some features
              if (feature === 'transaction_amount' || feature === 'credit_score') {
                value += (i / dayDiff) * 0.3;
              }
              
              // Add seasonality for some features
              if (feature === 'time_of_day') {
                const dayOfWeek = currentDate.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                  value += 0.15; // Higher drift on weekends
                }
              }
              
              // Threshold depends on the metric
              let threshold = 0;
              switch (metric) {
                case 'PSI': threshold = 0.2; break;
                case 'KS': threshold = 0.1; break;
                case 'JS': threshold = 0.12; break;
                case 'Hellinger': threshold = 0.15; break;
                case 'Wasserstein': threshold = 0.25; break;
                default: threshold = 0.2;
              }
              
              // Determine if this is an alert
              const alert = value > threshold;
              
              // Only add if it matches the filter criteria
              if ((!alertsOnly || alert) && 
                  (!selectedFeatures.length || selectedFeatures.includes(feature)) &&
                  (!selectedMetrics.length || selectedMetrics.includes(metric))) {
                mockMetrics.push({
                  id: `${dateStr}-${feature}-${metric}`,
                  date: dateStr,
                  feature,
                  metric,
                  value,
                  threshold,
                  alert,
                  model_id: 'model-1',
                  model_version: '1.0.3',
                  environment: 'production',
                  category: feature.includes('transaction') ? 'transaction' : 
                            feature.includes('location') || feature.includes('device') ? 'context' : 'demographic'
                });
              }
            });
          });
        }
        
        // Generate mock models
        const mockModels: ModelInfo[] = [
          {
            id: 'model-1',
            name: 'Fraud Detection Model',
            version: '1.0.3',
            type: 'XGBoost',
            created_at: '2025-01-15',
            last_trained: '2025-05-20',
            status: 'active',
            performance: {
              accuracy: 0.92,
              precision: 0.89,
              recall: 0.85,
              f1_score: 0.87,
              auc: 0.94
            }
          },
          {
            id: 'model-2',
            name: 'Transaction Risk Scorer',
            version: '2.1.0',
            type: 'Random Forest',
            created_at: '2025-02-10',
            last_trained: '2025-06-05',
            status: 'active',
            performance: {
              accuracy: 0.88,
              precision: 0.91,
              recall: 0.82,
              f1_score: 0.86,
              auc: 0.92
            }
          },
          {
            id: 'model-3',
            name: 'Customer Segmentation',
            version: '1.2.1',
            type: 'K-Means',
            created_at: '2025-03-22',
            last_trained: '2025-04-15',
            status: 'inactive',
            performance: {
              accuracy: 0.85,
              precision: 0.83,
              recall: 0.80,
              f1_score: 0.81,
              auc: 0.88
            }
          }
        ];
        
        setMetrics(mockMetrics);
        setModels(mockModels);
        
        // Set default selected model if none is selected
        if (!selectedModel && mockModels.length > 0) {
          setSelectedModel(mockModels[0].id);
        }
        
        // Set default selected features if none are selected
        if (selectedFeatures.length === 0 && features.length > 0) {
          setSelectedFeatures(features.slice(0, 3));
        }
      } catch (err) {
        console.error('Error fetching drift metrics:', err);
        setError('Failed to fetch drift metrics. Please try again.');
        addNotification('Failed to load drift metrics', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [selectedModel, dateRange, alertsOnly, selectedFeatures, selectedMetrics, addNotification]);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort metrics
  const filteredMetrics = useMemo(() => {
    return metrics
      .filter(m => {
        // Filter by selected model
        if (selectedModel && m.model_id !== selectedModel) return false;
        
        // Filter by alerts only
        if (alertsOnly && !m.alert) return false;
        
        // Filter by search term
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          return (
            m.feature.toLowerCase().includes(searchLower) ||
            m.metric.toLowerCase().includes(searchLower) ||
            m.date.includes(searchLower) ||
            (m.category && m.category.toLowerCase().includes(searchLower))
          );
        }
        
        return true;
      })
      .sort((a, b) => {
        let valA, valB;
        
        switch (sortField) {
          case 'date':
            valA = new Date(a.date).getTime();
            valB = new Date(b.date).getTime();
            break;
          case 'value':
            valA = a.value;
            valB = b.value;
            break;
          case 'threshold':
            valA = a.threshold;
            valB = b.threshold;
            break;
          default:
            valA = a[sortField as keyof DriftMetric];
            valB = b[sortField as keyof DriftMetric];
        }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [metrics, selectedModel, alertsOnly, searchTerm, sortField, sortDirection]);

  // Get current model info
  const currentModel = useMemo(() => {
    return models.find(m => m.id === selectedModel) || null;
  }, [models, selectedModel]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalMetrics = filteredMetrics.length;
    const alertCount = filteredMetrics.filter(m => m.alert).length;
    const alertPercentage = totalMetrics > 0 ? (alertCount / totalMetrics) * 100 : 0;
    
    // Get metrics by feature
    const featureMetrics: Record<string, { total: number, alerts: number }> = {};
    filteredMetrics.forEach(m => {
      if (!featureMetrics[m.feature]) {
        featureMetrics[m.feature] = { total: 0, alerts: 0 };
      }
      featureMetrics[m.feature].total += 1;
      if (m.alert) {
        featureMetrics[m.feature].alerts += 1;
      }
    });
    
    // Find feature with most alerts
    let mostDriftedFeature = '';
    let mostDriftedAlerts = 0;
    Object.entries(featureMetrics).forEach(([feature, stats]) => {
      if (stats.alerts > mostDriftedAlerts) {
        mostDriftedFeature = feature;
        mostDriftedAlerts = stats.alerts;
      }
    });
    
    // Calculate drift trend (increasing or decreasing)
    let driftTrend = 'stable';
    if (filteredMetrics.length > 0) {
      // Group by date and calculate average drift value for each date
      const dateGroups: Record<string, number[]> = {};
      filteredMetrics.forEach(m => {
        if (!dateGroups[m.date]) {
          dateGroups[m.date] = [];
        }
        dateGroups[m.date].push(m.value);
      });
      
      // Calculate average drift by date
      const dateAverages = Object.entries(dateGroups)
        .map(([date, values]) => ({
          date,
          avgValue: values.reduce((sum, val) => sum + val, 0) / values.length
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Need at least 2 dates to calculate trend
      if (dateAverages.length >= 2) {
        const firstHalf = dateAverages.slice(0, Math.floor(dateAverages.length / 2));
        const secondHalf = dateAverages.slice(Math.floor(dateAverages.length / 2));
        
        const firstHalfAvg = firstHalf.reduce((sum, item) => sum + item.avgValue, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, item) => sum + item.avgValue, 0) / secondHalf.length;
        
        const percentChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        
        if (percentChange > 5) {
          driftTrend = 'increasing';
        } else if (percentChange < -5) {
          driftTrend = 'decreasing';
        }
      }
    }
    
    return {
      totalMetrics,
      alertCount,
      alertPercentage,
      mostDriftedFeature,
      mostDriftedAlerts,
      driftTrend
    };
  }, [filteredMetrics]);

  // Prepare chart data for feature drift over time
  const getFeatureDriftChartOptions = () => {
    // Group data by feature and date
    const featureSeries: Record<string, { date: string; value: number }[]> = {};
    
    // Only include selected features or top 5 if none selected
    const featuresToInclude = selectedFeatures.length > 0 
      ? selectedFeatures 
      : availableFeatures.slice(0, 5);
    
    filteredMetrics
      .filter(m => featuresToInclude.includes(m.feature) && m.metric === 'PSI') // Use PSI as the primary drift metric
      .forEach(m => {
        if (!featureSeries[m.feature]) {
          featureSeries[m.feature] = [];
        }
        featureSeries[m.feature].push({ date: m.date, value: m.value });
      });
    
    // Sort dates for each feature
    Object.keys(featureSeries).forEach(feature => {
      featureSeries[feature].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
    
    // Get all unique dates
    const allDates = Array.from(new Set(
      filteredMetrics.map(m => m.date)
    )).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    // Prepare series for chart
    const series = Object.entries(featureSeries).map(([feature, data]) => ({
      name: feature,
      type: 'line',
      smooth: true,
      data: allDates.map(date => {
        const point = data.find(d => d.date === date);
        return point ? point.value : null;
      })
    }));
    
    return {
      tooltip: {
        trigger: 'axis',
        formatter: function(params: any) {
          let tooltipText = `<div style="font-weight: bold; margin-bottom: 5px;">${params[0].axisValue}</div>`;
          
          params.forEach((param: any) => {
            const color = param.color;
            const marker = `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${color};"></span>`;
            tooltipText += `<div>${marker}${param.seriesName}: ${param.value !== null ? param.value.toFixed(3) : 'N/A'}</div>`;
          });
          
          return tooltipText;
        }
      },
      legend: {
        data: Object.keys(featureSeries),
        textStyle: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
          formatter: function(value: string) {
            return value.slice(5); // Show only MM-DD
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
        name: 'Drift Value',
        nameTextStyle: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
        },
        axisLabel: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
          formatter: function(value: number) {
            return value.toFixed(2);
          }
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
      series: series
    };
  };

  // Prepare chart data for metric comparison
  const getMetricComparisonChartOptions = () => {
    // Group by metric type and calculate averages
    const metricAverages: Record<string, number> = {};
    const metricAlertCounts: Record<string, number> = {};
    const metricTotals: Record<string, number> = {};
    
    filteredMetrics.forEach(m => {
      if (!metricAverages[m.metric]) {
        metricAverages[m.metric] = 0;
        metricAlertCounts[m.metric] = 0;
        metricTotals[m.metric] = 0;
      }
      
      metricAverages[m.metric] += m.value;
      metricTotals[m.metric] += 1;
      
      if (m.alert) {
        metricAlertCounts[m.metric] += 1;
      }
    });
    
    // Calculate final averages
    Object.keys(metricAverages).forEach(metric => {
      if (metricTotals[metric] > 0) {
        metricAverages[metric] /= metricTotals[metric];
      }
    });
    
    // Prepare data for chart
    const metrics = Object.keys(metricAverages);
    const avgValues = metrics.map(m => metricAverages[m]);
    const alertPercentages = metrics.map(m => 
      metricTotals[m] > 0 ? (metricAlertCounts[m] / metricTotals[m]) * 100 : 0
    );
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      legend: {
        data: ['Avg Value', 'Alert %'],
        textStyle: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: metrics,
        axisLabel: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
          }
        }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Avg Value',
          nameTextStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
          },
          min: 0,
          max: Math.max(...avgValues) * 1.2,
          axisLabel: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
            formatter: function(value: number) {
              return value.toFixed(2);
            }
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
        {
          type: 'value',
          name: 'Alert %',
          nameTextStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
          },
          min: 0,
          max: 100,
          axisLabel: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
            formatter: '{value}%'
          },
          axisLine: {
            lineStyle: {
              color: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
            }
          },
          splitLine: {
            show: false
          }
        }
      ],
      series: [
        {
          name: 'Avg Value',
          type: 'bar',
          data: avgValues,
          itemStyle: {
            color: theme === 'dark' ? '#6366f1' : '#4f46e5'
          }
        },
        {
          name: 'Alert %',
          type: 'line',
          yAxisIndex: 1,
          data: alertPercentages,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 3,
            color: theme === 'dark' ? '#f59e0b' : '#d97706'
          },
          itemStyle: {
            color: theme === 'dark' ? '#f59e0b' : '#d97706'
          }
        }
      ]
    };
  };

  // Prepare chart data for feature importance
  const getFeatureImportanceChartOptions = () => {
    // Calculate feature importance based on alert frequency
    const featureAlerts: Record<string, number> = {};
    const featureTotals: Record<string, number> = {};
    
    filteredMetrics.forEach(m => {
      if (!featureTotals[m.feature]) {
        featureTotals[m.feature] = 0;
        featureAlerts[m.feature] = 0;
      }
      
      featureTotals[m.feature] += 1;
      
      if (m.alert) {
        featureAlerts[m.feature] += 1;
      }
    });
    
    // Calculate alert percentages
    const featureImportance: { feature: string; alertPercentage: number }[] = [];
    Object.keys(featureTotals).forEach(feature => {
      if (featureTotals[feature] > 0) {
        featureImportance.push({
          feature,
          alertPercentage: (featureAlerts[feature] / featureTotals[feature]) * 100
        });
      }
    });
    
    // Sort by importance (alert percentage)
    featureImportance.sort((a, b) => b.alertPercentage - a.alertPercentage);
    
    // Take top 10 features
    const topFeatures = featureImportance.slice(0, 10);
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params: any) {
          const param = params[0];
          return `<div style="font-weight: bold; margin-bottom: 5px;">${param.name}</div>` +
                 `<div>Alert Rate: ${param.value.toFixed(1)}%</div>`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: 'Alert Rate (%)',
        nameTextStyle: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
        },
        axisLabel: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
          formatter: '{value}%'
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
      yAxis: {
        type: 'category',
        data: topFeatures.map(f => f.feature),
        axisLabel: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
          }
        }
      },
      series: [
        {
          name: 'Alert Rate',
          type: 'bar',
          data: topFeatures.map(f => f.alertPercentage),
          itemStyle: {
            color: function(params: any) {
              const value = params.value;
              if (value > 50) return theme === 'dark' ? '#ef4444' : '#dc2626';
              if (value > 25) return theme === 'dark' ? '#f59e0b' : '#d97706';
              return theme === 'dark' ? '#10b981' : '#059669';
            }
          },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%',
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
          }
        }
      ]
    };
  };

  // Prepare chart data for drift trend
  const getDriftTrendChartOptions = () => {
    // Group by date and calculate average drift
    const dateGroups: Record<string, { total: number; count: number; alerts: number }> = {};
    
    filteredMetrics.forEach(m => {
      if (!dateGroups[m.date]) {
        dateGroups[m.date] = { total: 0, count: 0, alerts: 0 };
      }
      
      dateGroups[m.date].total += m.value;
      dateGroups[m.date].count += 1;
      
      if (m.alert) {
        dateGroups[m.date].alerts += 1;
      }
    });
    
    // Calculate averages and sort by date
    const trendData = Object.entries(dateGroups)
      .map(([date, stats]) => ({
        date,
        avgDrift: stats.count > 0 ? stats.total / stats.count : 0,
        alertPercentage: stats.count > 0 ? (stats.alerts / stats.count) * 100 : 0
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: function(params: any) {
          const date = params[0].axisValue;
          let tooltipText = `<div style="font-weight: bold; margin-bottom: 5px;">${date}</div>`;
          
          params.forEach((param: any) => {
            const color = param.color;
            const marker = `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${color};"></span>`;
            const value = param.seriesName === 'Alert %' ? `${param.value.toFixed(1)}%` : param.value.toFixed(3);
            tooltipText += `<div>${marker}${param.seriesName}: ${value}</div>`;
          });
          
          return tooltipText;
        }
      },
      legend: {
        data: ['Avg Drift', 'Alert %'],
        textStyle: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: trendData.map(d => d.date),
        axisLabel: {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
          formatter: function(value: string) {
            return value.slice(5); // Show only MM-DD
          }
        },
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
          }
        }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Avg Drift',
          nameTextStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
          },
          min: 0,
          max: Math.max(...trendData.map(d => d.avgDrift)) * 1.2,
          axisLabel: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
            formatter: function(value: number) {
              return value.toFixed(2);
            }
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
        {
          type: 'value',
          name: 'Alert %',
          nameTextStyle: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'
          },
          min: 0,
          max: 100,
          axisLabel: {
            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
            formatter: '{value}%'
          },
          axisLine: {
            lineStyle: {
              color: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
            }
          },
          splitLine: {
            show: false
          }
        }
      ],
      series: [
        {
          name: 'Avg Drift',
          type: 'line',
          smooth: true,
          data: trendData.map(d => d.avgDrift),
          lineStyle: {
            width: 3,
            color: theme === 'dark' ? '#6366f1' : '#4f46e5'
          },
          itemStyle: {
            color: theme === 'dark' ? '#6366f1' : '#4f46e5'
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
                color: theme === 'dark' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(79, 70, 229, 0.4)'
              }, {
                offset: 1,
                color: theme === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.1)'
              }]
            }
          }
        },
        {
          name: 'Alert %',
          type: 'bar',
          yAxisIndex: 1,
          data: trendData.map(d => d.alertPercentage),
          itemStyle: {
            color: theme === 'dark' ? 'rgba(245, 158, 11, 0.7)' : 'rgba(217, 119, 6, 0.7)'
          }
        }
      ]
    };
  };

  // Handle export
  const handleExport = () => {
    try {
      // Create CSV content
      const headers = ['Date', 'Feature', 'Metric', 'Value', 'Threshold', 'Alert'];
      const csvContent = [
        headers.join(','),
        ...filteredMetrics.map(m => [
          m.date,
          m.feature,
          m.metric,
          m.value.toFixed(4),
          m.threshold.toFixed(4),
          m.alert ? 'Yes' : 'No'
        ].join(','))
      ].join('\n');
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `model-drift-metrics-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addNotification('Drift metrics exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      addNotification('Failed to export drift metrics', 'error');
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setLoading(true);
    
    // In a real app, this would trigger a data fetch
    setTimeout(() => {
      setLoading(false);
      addNotification('Drift metrics refreshed', 'success');
    }, 1000);
  };

  // Render model health indicator
  const renderModelHealth = () => {
    if (!currentModel) return null;
    
    // Calculate health score based on drift metrics
    const alertPercentage = summaryStats.alertPercentage;
    let healthScore = 100;
    
    if (alertPercentage > 0) {
      // Reduce health score based on alert percentage
      healthScore = Math.max(0, 100 - alertPercentage * 2);
    }
    
    // Determine health status
    let healthStatus = 'Healthy';
    let healthColor = 'text-green-400';
    let healthBg = theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100';
    let healthBorder = theme === 'dark' ? 'border-green-500/30' : 'border-green-300';
    
    if (healthScore < 60) {
      healthStatus = 'Critical';
      healthColor = 'text-red-400';
      healthBg = theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100';
      healthBorder = theme === 'dark' ? 'border-red-500/30' : 'border-red-300';
    } else if (healthScore < 80) {
      healthStatus = 'Warning';
      healthColor = 'text-yellow-400';
      healthBg = theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100';
      healthBorder = theme === 'dark' ? 'border-yellow-500/30' : 'border-yellow-300';
    }
    
    return (
      <div className={`p-4 rounded-xl border ${healthBg} ${healthBorder}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className={`font-medium flex items-center gap-2 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            <Target className={`w-4 h-4 ${healthColor}`} />
            Model Health
          </h4>
          <div className={`px-2 py-1 text-xs font-medium rounded-full ${healthBg} ${healthColor}`}>
            {healthStatus}
          </div>
        </div>
        
        <div className="mt-2">
          <div className="flex justify-between items-center mb-1">
            <span className={`text-xs ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>Health Score</span>
            <span className={`text-xs font-medium ${healthColor}`}>{healthScore.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                healthScore < 60 
                  ? 'bg-red-500' 
                  : healthScore < 80 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
              }`}
              style={{ width: `${healthScore}%` }}
            ></div>
          </div>
        </div>
        
        <div className="mt-3 text-xs">
          <div className="flex justify-between items-center">
            <span className={theme === 'dark' ? 'text-white/70' : 'text-gray-600'}>Drift Trend:</span>
            <span className={`font-medium ${
              summaryStats.driftTrend === 'increasing' 
                ? 'text-red-400' 
                : summaryStats.driftTrend === 'decreasing' 
                  ? 'text-green-400' 
                  : 'text-blue-400'
            }`}>
              {summaryStats.driftTrend.charAt(0).toUpperCase() + summaryStats.driftTrend.slice(1)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className={theme === 'dark' ? 'text-white/70' : 'text-gray-600'}>Alert Rate:</span>
            <span className={`font-medium ${
              summaryStats.alertPercentage > 20 
                ? 'text-red-400' 
                : summaryStats.alertPercentage > 10 
                  ? 'text-yellow-400' 
                  : 'text-green-400'
            }`}>
              {summaryStats.alertPercentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Render model performance metrics
  const renderModelPerformance = () => {
    if (!currentModel) return null;
    
    const { performance } = currentModel;
    
    return (
      <div className={`p-4 rounded-xl border ${
        theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
      }`}>
        <h4 className={`font-medium flex items-center gap-2 mb-3 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          <Brain className="w-4 h-4 text-purple-400" />
          Model Performance
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className={`text-xs ${
                theme === 'dark' ? 'text-white/70' : 'text-gray-600'
              }`}>Accuracy</span>
              <span className={`text-xs font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>{(performance.accuracy * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${performance.accuracy * 100}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className={`text-xs ${
                theme === 'dark' ? 'text-white/70' : 'text-gray-600'
              }`}>Precision</span>
              <span className={`text-xs font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>{(performance.precision * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${performance.precision * 100}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className={`text-xs ${
                theme === 'dark' ? 'text-white/70' : 'text-gray-600'
              }`}>Recall</span>
              <span className={`text-xs font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>{(performance.recall * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${performance.recall * 100}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className={`text-xs ${
                theme === 'dark' ? 'text-white/70' : 'text-gray-600'
              }`}>F1 Score</span>
              <span className={`text-xs font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>{(performance.f1_score * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-500 rounded-full"
                style={{ width: `${performance.f1_score * 100}%` }}
              ></div>
            </div>
          </div>
          
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-1">
              <span className={`text-xs ${
                theme === 'dark' ? 'text-white/70' : 'text-gray-600'
              }`}>AUC</span>
              <span className={`text-xs font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>{(performance.auc * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${performance.auc * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PermissionGuard
      menuId={MODEL_DRIFT_MENU_ID}
      action="view"
      fallback={
        <div className={`text-center py-20 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view model drift monitoring.</p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Model Drift Monitoring</h1>
              <p className={`${
                theme === 'dark' ? 'text-purple-200/70' : 'text-purple-600'
              }`}>Track and analyze ML model performance degradation over time</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showFilters 
                  ? theme === 'dark'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                    : 'bg-blue-100 text-blue-700 border border-blue-300'
                  : theme === 'dark' 
                    ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExport}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30' 
                  : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
              }`}
            >
              <Download className="w-4 h-4" />
              Export
            </motion.button>
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`rounded-xl border p-6 overflow-hidden ${
                theme === 'dark' 
                  ? 'bg-white/5 border-white/20' 
                  : 'bg-gray-50 border-gray-200'
              } backdrop-blur-xl`}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className={`font-semibold flex items-center gap-2 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  <Sliders className="w-4 h-4 text-blue-400" />
                  Filter Options
                </h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className={`p-1.5 rounded-lg ${
                    theme === 'dark' 
                      ? 'hover:bg-white/10 text-white/60' 
                      : 'hover:bg-gray-200 text-gray-500'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Model Selection */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Model</label>
                  <select
                    value={selectedModel || ''}
                    onChange={(e) => setSelectedModel(e.target.value || null)}
                    className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === 'dark' 
                        ? 'bg-white/10 border border-white/20 text-white' 
                        : 'bg-white border border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>All Models</option>
                    {models.map(model => (
                      <option 
                        key={model.id} 
                        value={model.id}
                        className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}
                      >
                        {model.name} (v{model.version})
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Date Range */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          theme === 'dark' 
                            ? 'bg-white/10 border border-white/20 text-white' 
                            : 'bg-white border border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          theme === 'dark' 
                            ? 'bg-white/10 border border-white/20 text-white' 
                            : 'bg-white border border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Feature Selection */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Features</label>
                  <select
                    multiple
                    value={selectedFeatures}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setSelectedFeatures(selected);
                    }}
                    className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === 'dark' 
                        ? 'bg-white/10 border border-white/20 text-white' 
                        : 'bg-white border border-gray-300 text-gray-900'
                    }`}
                    size={4}
                  >
                    {availableFeatures.map(feature => (
                      <option 
                        key={feature} 
                        value={feature}
                        className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}
                      >
                        {feature}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Metric Selection */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Metrics</label>
                  <select
                    multiple
                    value={selectedMetrics}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setSelectedMetrics(selected);
                    }}
                    className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === 'dark' 
                        ? 'bg-white/10 border border-white/20 text-white' 
                        : 'bg-white border border-gray-300 text-gray-900'
                    }`}
                    size={4}
                  >
                    {availableMetricTypes.map(metric => (
                      <option 
                        key={metric} 
                        value={metric}
                        className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}
                      >
                        {metric}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex items-center mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertsOnly}
                    onChange={(e) => setAlertsOnly(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                  />
                  <span className={theme === 'dark' ? 'text-white/80' : 'text-gray-700'}>Show alerts only</span>
                </label>
                
                <div className="ml-auto">
                  <button
                    onClick={() => {
                      setSelectedFeatures([]);
                      setSelectedMetrics(['PSI', 'KS', 'JS']);
                      setDateRange({
                        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        end: new Date().toISOString().split('T')[0]
                      });
                      setAlertsOnly(false);
                      setSearchTerm('');
                    }}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      theme === 'dark' 
                        ? 'bg-white/10 hover:bg-white/20 text-white' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Model Overview Section */}
        <div className={`rounded-xl border ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-white border-gray-200'
        } overflow-hidden`}>
          <div 
            className={`flex justify-between items-center p-6 border-b cursor-pointer ${
              theme === 'dark' ? 'border-white/20' : 'border-gray-200'
            }`}
            onClick={() => toggleSection('overview')}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Model Overview</h3>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-purple-200/70' : 'text-purple-600'
                }`}>
                  {currentModel 
                    ? `${currentModel.name} (v${currentModel.version})` 
                    : 'Select a model to view details'}
                </p>
              </div>
            </div>
            {expandedSections.has('overview') ? (
              <ChevronUp className={`w-5 h-5 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`} />
            )}
          </div>
          
          {expandedSections.has('overview') && (
            <div className="p-6">
              {currentModel ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Model Info */}
                  <div className={`p-4 rounded-xl border ${
                    theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <h4 className={`font-medium flex items-center gap-2 mb-3 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      <Info className="w-4 h-4 text-blue-400" />
                      Model Information
                    </h4>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className={`text-sm ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                        }`}>Name:</span>
                        <span className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{currentModel.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-sm ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                        }`}>Version:</span>
                        <span className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{currentModel.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-sm ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                        }`}>Type:</span>
                        <span className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{currentModel.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-sm ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                        }`}>Created:</span>
                        <span className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{currentModel.created_at}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-sm ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                        }`}>Last Trained:</span>
                        <span className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{currentModel.last_trained}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-sm ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                        }`}>Status:</span>
                        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                          currentModel.status === 'active'
                            ? theme === 'dark' ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                            : currentModel.status === 'inactive'
                              ? theme === 'dark' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                              : theme === 'dark' ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                        }`}>
                          {currentModel.status.charAt(0).toUpperCase() + currentModel.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Model Health */}
                  {renderModelHealth()}
                  
                  {/* Model Performance */}
                  {renderModelPerformance()}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Info className={`w-12 h-12 mx-auto mb-4 ${
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                  <p className={`${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Select a model to view detailed information</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drift Metrics Section */}
        <div className={`rounded-xl border ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-white border-gray-200'
        } overflow-hidden`}>
          <div 
            className={`flex justify-between items-center p-6 border-b cursor-pointer ${
              theme === 'dark' ? 'border-white/20' : 'border-gray-200'
            }`}
            onClick={() => toggleSection('metrics')}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Drift Metrics</h3>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-blue-200/70' : 'text-blue-600'
                }`}>
                  {filteredMetrics.length} metrics, {summaryStats.alertCount} alerts ({summaryStats.alertPercentage.toFixed(1)}%)
                </p>
              </div>
            </div>
            {expandedSections.has('metrics') ? (
              <ChevronUp className={`w-5 h-5 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`} />
            )}
          </div>
          
          {expandedSections.has('metrics') && (
            <div className="p-6">
              {/* Tabs */}
              <div className="flex border-b mb-6">
                <button
                  onClick={() => setActiveTab('table')}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${
                    activeTab === 'table'
                      ? theme === 'dark'
                        ? 'text-white border-b-2 border-blue-500'
                        : 'text-blue-700 border-b-2 border-blue-500'
                      : theme === 'dark'
                        ? 'text-white/60 hover:text-white/80'
                        : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BarChart className="w-4 h-4" />
                    <span>Data Table</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${
                    activeTab === 'charts'
                      ? theme === 'dark'
                        ? 'text-white border-b-2 border-blue-500'
                        : 'text-blue-700 border-b-2 border-blue-500'
                      : theme === 'dark'
                        ? 'text-white/60 hover:text-white/80'
                        : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4" />
                    <span>Visualizations</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setActiveTab('trends')}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${
                    activeTab === 'trends'
                      ? theme === 'dark'
                        ? 'text-white border-b-2 border-blue-500'
                        : 'text-blue-700 border-b-2 border-blue-500'
                      : theme === 'dark'
                        ? 'text-white/60 hover:text-white/80'
                        : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AreaChart className="w-4 h-4" />
                    <span>Trend Analysis</span>
                  </div>
                </button>
              </div>
              
              {/* Search Bar (for table view) */}
              {activeTab === 'table' && (
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search metrics..."
                      className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        theme === 'dark' 
                          ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                  </div>
                </div>
              )}
              
              {/* Content based on active tab */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className={`w-12 h-12 animate-spin ${
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                  <p className={`mt-4 ${
                    theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                  }`}>Loading drift metrics...</p>
                </div>
              ) : filteredMetrics.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className={`w-12 h-12 mx-auto mb-4 ${
                    theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                  }`} />
                  <p className={`${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>No drift metrics found for the selected filters</p>
                  <button
                    onClick={() => {
                      setSelectedFeatures([]);
                      setSelectedMetrics(['PSI', 'KS', 'JS']);
                      setAlertsOnly(false);
                      setSearchTerm('');
                    }}
                    className={`mt-4 px-4 py-2 rounded-lg transition-colors ${
                      theme === 'dark' 
                        ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' 
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    }`}
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <>
                  {activeTab === 'table' && (
                    <div className={`rounded-xl border overflow-hidden ${
                      theme === 'dark' 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-white border-gray-200'
                    }`}>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className={`${
                            theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
                          }`}>
                            <tr>
                              <th className={`px-4 py-3 text-left text-xs font-semibold ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>
                                <button 
                                  className="flex items-center gap-1"
                                  onClick={() => handleSort('date')}
                                >
                                  Date
                                  {sortField === 'date' && (
                                    <ChevronDown className={`w-4 h-4 ${
                                      sortDirection === 'desc' ? 'rotate-180' : ''
                                    } transition-transform`} />
                                  )}
                                </button>
                              </th>
                              <th className={`px-4 py-3 text-left text-xs font-semibold ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>
                                <button 
                                  className="flex items-center gap-1"
                                  onClick={() => handleSort('feature')}
                                >
                                  Feature
                                  {sortField === 'feature' && (
                                    <ChevronDown className={`w-4 h-4 ${
                                      sortDirection === 'desc' ? 'rotate-180' : ''
                                    } transition-transform`} />
                                  )}
                                </button>
                              </th>
                              <th className={`px-4 py-3 text-left text-xs font-semibold ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>
                                <button 
                                  className="flex items-center gap-1"
                                  onClick={() => handleSort('metric')}
                                >
                                  Metric
                                  {sortField === 'metric' && (
                                    <ChevronDown className={`w-4 h-4 ${
                                      sortDirection === 'desc' ? 'rotate-180' : ''
                                    } transition-transform`} />
                                  )}
                                </button>
                              </th>
                              <th className={`px-4 py-3 text-left text-xs font-semibold ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>
                                <button 
                                  className="flex items-center gap-1"
                                  onClick={() => handleSort('value')}
                                >
                                  Value
                                  {sortField === 'value' && (
                                    <ChevronDown className={`w-4 h-4 ${
                                      sortDirection === 'desc' ? 'rotate-180' : ''
                                    } transition-transform`} />
                                  )}
                                </button>
                              </th>
                              <th className={`px-4 py-3 text-left text-xs font-semibold ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>
                                <button 
                                  className="flex items-center gap-1"
                                  onClick={() => handleSort('threshold')}
                                >
                                  Threshold
                                  {sortField === 'threshold' && (
                                    <ChevronDown className={`w-4 h-4 ${
                                      sortDirection === 'desc' ? 'rotate-180' : ''
                                    } transition-transform`} />
                                  )}
                                </button>
                              </th>
                              <th className={`px-4 py-3 text-left text-xs font-semibold ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                              }`}>
                                <button 
                                  className="flex items-center gap-1"
                                  onClick={() => handleSort('alert')}
                                >
                                  Status
                                  {sortField === 'alert' && (
                                    <ChevronDown className={`w-4 h-4 ${
                                      sortDirection === 'desc' ? 'rotate-180' : ''
                                    } transition-transform`} />
                                  )}
                                </button>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredMetrics.slice(0, 100).map((metric, index) => (
                              <tr 
                                key={metric.id}
                                className={`border-b transition-colors ${
                                  metric.alert
                                    ? theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'
                                    : theme === 'dark' ? 'border-white/10 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-4 py-3 text-sm">
                                  {metric.date}
                                </td>
                                <td className={`px-4 py-3 text-sm font-medium ${
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                  {metric.feature}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {metric.metric}
                                </td>
                                <td className={`px-4 py-3 text-sm font-medium ${
                                  metric.alert
                                    ? 'text-red-500'
                                    : theme === 'dark' ? 'text-white' : 'text-gray-900'
                                }`}>
                                  {metric.value.toFixed(4)}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {metric.threshold.toFixed(4)}
                                </td>
                                <td className="px-4 py-3">
                                  {metric.alert ? (
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      theme === 'dark' ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                                    }`}>
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      Alert
                                    </span>
                                  ) : (
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      theme === 'dark' ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                                    }`}>
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Normal
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {filteredMetrics.length > 100 && (
                        <div className={`p-4 border-t ${
                          theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                        }`}>
                          <div className={`text-center text-sm ${
                            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                          }`}>
                            Showing 100 of {filteredMetrics.length} metrics. Export to see all data.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'charts' && (
                    <div className="space-y-6">
                      {/* Feature Importance Chart */}
                      <div className={`rounded-xl border overflow-hidden ${
                        theme === 'dark' 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className={`p-4 border-b ${
                          theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                        }`}>
                          <h4 className={`font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Feature Drift Importance</h4>
                        </div>
                        <div className="p-4 h-80">
                          <ReactECharts
                            option={getFeatureImportanceChartOptions()}
                            style={{ height: '100%', width: '100%' }}
                            theme={theme === 'dark' ? 'dark' : undefined}
                          />
                        </div>
                      </div>
                      
                      {/* Metric Comparison Chart */}
                      <div className={`rounded-xl border overflow-hidden ${
                        theme === 'dark' 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className={`p-4 border-b ${
                          theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                        }`}>
                          <h4 className={`font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Metric Comparison</h4>
                        </div>
                        <div className="p-4 h-80">
                          <ReactECharts
                            option={getMetricComparisonChartOptions()}
                            style={{ height: '100%', width: '100%' }}
                            theme={theme === 'dark' ? 'dark' : undefined}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'trends' && (
                    <div className="space-y-6">
                      {/* Drift Trend Chart */}
                      <div className={`rounded-xl border overflow-hidden ${
                        theme === 'dark' 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className={`p-4 border-b ${
                          theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                        }`}>
                          <h4 className={`font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Drift Trend Analysis</h4>
                        </div>
                        <div className="p-4 h-80">
                          <ReactECharts
                            option={getDriftTrendChartOptions()}
                            style={{ height: '100%', width: '100%' }}
                            theme={theme === 'dark' ? 'dark' : undefined}
                          />
                        </div>
                      </div>
                      
                      {/* Feature Drift Over Time */}
                      <div className={`rounded-xl border overflow-hidden ${
                        theme === 'dark' 
                          ? 'bg-white/5 border-white/10' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className={`p-4 border-b ${
                          theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                        }`}>
                          <h4 className={`font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Feature Drift Over Time</h4>
                        </div>
                        <div className="p-4 h-80">
                          <ReactECharts
                            option={getFeatureDriftChartOptions()}
                            style={{ height: '100%', width: '100%' }}
                            theme={theme === 'dark' ? 'dark' : undefined}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Feature Analysis Section */}
        <div className={`rounded-xl border ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-white border-gray-200'
        } overflow-hidden`}>
          <div 
            className={`flex justify-between items-center p-6 border-b cursor-pointer ${
              theme === 'dark' ? 'border-white/20' : 'border-gray-200'
            }`}
            onClick={() => toggleSection('features')}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Feature Analysis</h3>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-green-200/70' : 'text-green-600'
                }`}>Detailed analysis of feature drift patterns</p>
              </div>
            </div>
            {expandedSections.has('features') ? (
              <ChevronUp className={`w-5 h-5 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`} />
            )}
          </div>
          
          {expandedSections.has('features') && (
            <div className="p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className={`w-12 h-12 animate-spin ${
                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  }`} />
                  <p className={`mt-4 ${
                    theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                  }`}>Loading feature analysis...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Feature Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableFeatures.slice(0, 6).map(feature => {
                      // Calculate feature stats
                      const featureMetrics = filteredMetrics.filter(m => m.feature === feature);
                      const alertCount = featureMetrics.filter(m => m.alert).length;
                      const alertPercentage = featureMetrics.length > 0 
                        ? (alertCount / featureMetrics.length) * 100 
                        : 0;
                      
                      // Determine status color
                      let statusColor = 'text-green-400';
                      let statusBg = theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100';
                      let statusBorder = theme === 'dark' ? 'border-green-500/30' : 'border-green-300';
                      
                      if (alertPercentage > 20) {
                        statusColor = 'text-red-400';
                        statusBg = theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100';
                        statusBorder = theme === 'dark' ? 'border-red-500/30' : 'border-red-300';
                      } else if (alertPercentage > 10) {
                        statusColor = 'text-yellow-400';
                        statusBg = theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100';
                        statusBorder = theme === 'dark' ? 'border-yellow-500/30' : 'border-yellow-300';
                      }
                      
                      return (
                        <div 
                          key={feature}
                          className={`p-4 rounded-xl border ${
                            theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h5 className={`font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>{feature}</h5>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusBg} ${statusColor}`}>
                              {alertPercentage > 20 ? 'High Drift' : alertPercentage > 10 ? 'Moderate Drift' : 'Stable'}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                              }`}>Alert Rate:</span>
                              <span className={`text-xs font-medium ${statusColor}`}>
                                {alertPercentage.toFixed(1)}%
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                              }`}>Metrics:</span>
                              <span className={`text-xs font-medium ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>
                                {featureMetrics.length}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                              }`}>Alerts:</span>
                              <span className={`text-xs font-medium ${
                                alertCount > 0 ? 'text-red-400' : 'text-green-400'
                              }`}>
                                {alertCount}
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xs ${
                                theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                              }`}>Drift Level</span>
                              <span className={`text-xs font-medium ${statusColor}`}>
                                {alertPercentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  alertPercentage > 20 
                                    ? 'bg-red-500' 
                                    : alertPercentage > 10 
                                      ? 'bg-yellow-500' 
                                      : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, alertPercentage * 2)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Recommendations */}
                  <div className={`p-4 rounded-xl border ${
                    theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'
                  }`}>
                    <h4 className={`font-medium flex items-center gap-2 mb-3 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      <Zap className="w-4 h-4 text-blue-400" />
                      Recommendations
                    </h4>
                    
                    <div className="space-y-3">
                      {summaryStats.alertPercentage > 20 && (
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                            theme === 'dark' ? 'text-red-400' : 'text-red-600'
                          }`} />
                          <div>
                            <p className={`text-sm font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>High Drift Detected</p>
                            <p className={`text-xs ${
                              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                            }`}>
                              Consider retraining the model as significant drift has been detected across multiple features.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {summaryStats.mostDriftedFeature && (
                        <div className="flex items-start gap-2">
                          <Info className={`w-4 h-4 mt-0.5 ${
                            theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                          }`} />
                          <div>
                            <p className={`text-sm font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Feature Investigation</p>
                            <p className={`text-xs ${
                              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                            }`}>
                              Investigate the "{summaryStats.mostDriftedFeature}" feature which shows the highest drift with {summaryStats.mostDriftedAlerts} alerts.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {summaryStats.driftTrend === 'increasing' && (
                        <div className="flex items-start gap-2">
                          <TrendingUp className={`w-4 h-4 mt-0.5 ${
                            theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                          }`} />
                          <div>
                            <p className={`text-sm font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Increasing Drift Trend</p>
                            <p className={`text-xs ${
                              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                            }`}>
                              The overall drift is increasing over time. Schedule a model review within the next 7 days.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {summaryStats.driftTrend === 'decreasing' && (
                        <div className="flex items-start gap-2">
                          <ArrowDownRight className={`w-4 h-4 mt-0.5 ${
                            theme === 'dark' ? 'text-green-400' : 'text-green-600'
                          }`} />
                          <div>
                            <p className={`text-sm font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>Improving Stability</p>
                            <p className={`text-xs ${
                              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                            }`}>
                              The model is showing improved stability with decreasing drift. Continue monitoring.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-start gap-2">
                        <FileText className={`w-4 h-4 mt-0.5 ${
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        }`} />
                        <div>
                          <p className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>Documentation</p>
                          <p className={`text-xs ${
                            theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                          }`}>
                            Update model monitoring documentation with the latest drift analysis results.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
};

export default ModelDriftDashboard;