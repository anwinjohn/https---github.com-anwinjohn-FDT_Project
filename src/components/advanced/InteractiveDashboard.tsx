import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { 
  LayoutDashboard, 
  Loader2, 
  AlertTriangle, 
  Users, 
  Building, 
  TrendingUp, 
  Network,
  Eye,
  FileText,
  Target,
  Globe,
  Activity,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  DollarSign,
  UserCheck,
  MapPin,
  Briefcase,
  CreditCard,
  Download,
  Filter,
  RefreshCw,
  Maximize2,
  Minimize2,
  Move,
  Plus,
  X
} from 'lucide-react';
import NetworkGraphVisualization from './NetworkGraphVisualization';
import TimeSeriesAnomalyDetection from './TimeSeriesAnomalyDetection';
import UserBehaviorAnalytics from './UserBehaviorAnalytics';
import { useNotifications } from '../notifications';

interface DashboardWidget {
  id: string;
  type: 'network-graph' | 'time-series' | 'user-behavior' | 'stats' | 'alerts' | 'transactions';
  title: string;
  description?: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number };
  isMaximized?: boolean;
}

interface InteractiveDashboardProps {
  isLoading?: boolean;
}

const InteractiveDashboard: React.FC<InteractiveDashboardProps> = ({
  isLoading = false
}) => {
  const { theme } = useTheme();
  const { addNotification } = useNotifications();
  const [widgets, setWidgets] = useState<DashboardWidget[]>([
    {
      id: 'network-graph',
      type: 'network-graph',
      title: 'Fraud Network Analysis',
      description: 'Interactive visualization of suspicious transaction networks',
      size: 'large',
      position: { x: 0, y: 0 }
    },
    {
      id: 'time-series',
      type: 'time-series',
      title: 'Transaction Anomaly Detection',
      description: 'Automated detection of unusual patterns in transaction data',
      size: 'medium',
      position: { x: 0, y: 1 }
    },
    {
      id: 'user-behavior',
      type: 'user-behavior',
      title: 'User Behavior Analysis',
      description: 'Detect unusual user behavior patterns and potential insider threats',
      size: 'large',
      position: { x: 1, y: 0 }
    },
    {
      id: 'stats',
      type: 'stats',
      title: 'Key Risk Indicators',
      size: 'small',
      position: { x: 1, y: 1 }
    }
  ]);
  const [editMode, setEditMode] = useState(false);
  const [draggingWidget, setDraggingWidget] = useState<string | null>(null);
  const [availableWidgets, setAvailableWidgets] = useState([
    {
      id: 'alerts',
      type: 'alerts',
      title: 'Alert Summary',
      description: 'Overview of recent security alerts',
      size: 'medium'
    },
    {
      id: 'transactions',
      type: 'transactions',
      title: 'Transaction Monitoring',
      description: 'Real-time transaction monitoring dashboard',
      size: 'large'
    }
  ]);

  const handleWidgetMaximize = (widgetId: string) => {
    setWidgets(prev => prev.map(widget => 
      widget.id === widgetId 
        ? { ...widget, isMaximized: !widget.isMaximized }
        : widget
    ));
  };

  const handleWidgetRemove = (widgetId: string) => {
    // Get the widget being removed
    const widgetToRemove = widgets.find(w => w.id === widgetId);
    
    if (!widgetToRemove) return;
    
    // Remove the widget
    setWidgets(prev => prev.filter(widget => widget.id !== widgetId));
    
    // Add it back to available widgets
    if (widgetToRemove.type !== 'stats') { // Don't add stats back to available widgets
      setAvailableWidgets(prev => [...prev, {
        id: widgetToRemove.id,
        type: widgetToRemove.type,
        title: widgetToRemove.title,
        description: widgetToRemove.description,
        size: widgetToRemove.size
      }]);
    }
    
    addNotification(`Removed "${widgetToRemove.title}" widget`, 'info');
  };

  const handleAddWidget = (widgetType: string) => {
    // Find the widget in available widgets
    const widgetIndex = availableWidgets.findIndex(w => w.id === widgetType);
    if (widgetIndex === -1) return;
    
    const widgetToAdd = availableWidgets[widgetIndex];
    
    // Add the widget to the dashboard
    setWidgets(prev => [...prev, {
      ...widgetToAdd,
      position: { x: 0, y: 2 } // Add to bottom of dashboard
    }]);
    
    // Remove from available widgets
    setAvailableWidgets(prev => prev.filter((_, index) => index !== widgetIndex));
    
    addNotification(`Added "${widgetToAdd.title}" widget`, 'success');
  };

  const handleExportDashboard = () => {
    try {
      // Create a JSON representation of the dashboard
      const dashboardConfig = {
        widgets: widgets.map(widget => ({
          id: widget.id,
          type: widget.type,
          size: widget.size,
          position: widget.position
        }))
      };
      
      // Convert to JSON string
      const jsonString = JSON.stringify(dashboardConfig, null, 2);
      
      // Create a blob and download link
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addNotification('Dashboard configuration exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting dashboard:', error);
      addNotification('Failed to export dashboard configuration', 'error');
    }
  };

  const renderWidget = (widget: DashboardWidget) => {
    if (widget.isMaximized) {
      return (
        <div className="fixed inset-0 z-50 p-4 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className={`w-full max-w-7xl max-h-[90vh] overflow-auto rounded-2xl border shadow-2xl ${
            theme === 'dark' 
              ? 'bg-white/10 border-white/20' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`flex justify-between items-center p-4 border-b ${
              theme === 'dark' ? 'border-white/20' : 'border-gray-200'
            }`}>
              <h3 className={`font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>{widget.title}</h3>
              <button
                onClick={() => handleWidgetMaximize(widget.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'hover:bg-white/10 text-white/70' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {renderWidgetContent(widget)}
            </div>
          </div>
        </div>
      );
    }

    return (
      <motion.div
        className={`rounded-xl border shadow-lg overflow-hidden ${
          theme === 'dark' 
            ? 'bg-white/10 border-white/20' 
            : 'bg-white border-gray-200'
        } ${
          widget.size === 'small' 
            ? 'col-span-1 row-span-1' 
            : widget.size === 'medium'
              ? 'col-span-1 row-span-2'
              : widget.size === 'large'
                ? 'col-span-2 row-span-2'
                : 'col-span-full row-span-2'
        } ${
          editMode ? 'cursor-move' : ''
        }`}
        layoutId={widget.id}
        drag={editMode}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragStart={() => setDraggingWidget(widget.id)}
        onDragEnd={() => setDraggingWidget(null)}
        whileDrag={{ scale: 1.02, zIndex: 10 }}
      >
        <div className={`flex justify-between items-center p-4 border-b ${
          theme === 'dark' ? 'border-white/20' : 'border-gray-200'
        }`}>
          <h3 className={`font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>{widget.title}</h3>
          <div className="flex items-center gap-1">
            {editMode && (
              <button
                onClick={() => handleWidgetRemove(widget.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'hover:bg-red-500/20 text-red-300' 
                    : 'hover:bg-red-100 text-red-700'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => handleWidgetMaximize(widget.id)}
              className={`p-1.5 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'hover:bg-white/10 text-white/70' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-4">
          {renderWidgetContent(widget)}
        </div>
      </motion.div>
    );
  };

  const renderWidgetContent = (widget: DashboardWidget) => {
    switch (widget.type) {
      case 'network-graph':
        return <NetworkGraphVisualization />;
      case 'time-series':
        return <TimeSeriesAnomalyDetection />;
      case 'user-behavior':
        return <UserBehaviorAnalytics />;
      case 'stats':
        return renderStatsWidget();
      case 'alerts':
        return renderAlertsWidget();
      case 'transactions':
        return renderTransactionsWidget();
      default:
        return <div>Unknown widget type</div>;
    }
  };

  const renderStatsWidget = () => {
    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-xl border ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-red-500/20 to-red-500/10 border-red-500/30' 
            : 'bg-gradient-to-br from-red-100 to-red-50 border-red-300'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className={`text-sm font-medium ${
              theme === 'dark' ? 'text-red-300' : 'text-red-700'
            }`}>High Risk Alerts</span>
          </div>
          <div className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>24</div>
          <div className="flex items-center gap-1 mt-1">
            <ArrowUpRight className="w-3 h-3 text-red-400" />
            <span className={`text-xs ${
              theme === 'dark' ? 'text-red-300' : 'text-red-700'
            }`}>+12% vs. last week</span>
          </div>
        </div>
        
        <div className={`p-4 rounded-xl border ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-500/30' 
            : 'bg-gradient-to-br from-blue-100 to-blue-50 border-blue-300'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className={`text-sm font-medium ${
              theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
            }`}>High Risk Users</span>
          </div>
          <div className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>5</div>
          <div className="flex items-center gap-1 mt-1">
            <ArrowUpRight className="w-3 h-3 text-red-400" />
            <span className={`text-xs ${
              theme === 'dark' ? 'text-red-300' : 'text-red-700'
            }`}>+2 new this week</span>
          </div>
        </div>
        
        <div className={`p-4 rounded-xl border ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-green-500/20 to-green-500/10 border-green-500/30' 
            : 'bg-gradient-to-br from-green-100 to-green-50 border-green-300'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-green-400" />
            <span className={`text-sm font-medium ${
              theme === 'dark' ? 'text-green-300' : 'text-green-700'
            }`}>Detection Rate</span>
          </div>
          <div className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>94.2%</div>
          <div className="flex items-center gap-1 mt-1">
            <ArrowUpRight className="w-3 h-3 text-green-400" />
            <span className={`text-xs ${
              theme === 'dark' ? 'text-green-300' : 'text-green-700'
            }`}>+1.5% improvement</span>
          </div>
        </div>
      </div>
    );
  };

  const renderAlertsWidget = () => {
    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-xl border ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/10' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <h4 className={`font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Recent Alerts</h4>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {[...Array(5)].map((_, index) => (
              <div 
                key={index}
                className={`p-3 rounded-lg border ${
                  index === 0
                    ? theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
                    : index === 1
                      ? theme === 'dark' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200'
                      : theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`font-medium ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {index === 0 ? 'Multiple high-value transactions' :
                       index === 1 ? 'Unusual login time detected' :
                       index === 2 ? 'Transaction pattern anomaly' :
                       index === 3 ? 'Suspicious beneficiary' :
                       'Unusual access pattern'}
                    </div>
                    <div className={`text-xs mt-1 ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}>
                      {index === 0 ? 'User: John Smith, 15 minutes ago' :
                       index === 1 ? 'User: Ahmed Hassan, 1 hour ago' :
                       index === 2 ? 'User: Sarah Johnson, 3 hours ago' :
                       index === 3 ? 'User: Mohammed Al Farsi, 5 hours ago' :
                       'User: Lisa Chen, 8 hours ago'}
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    index === 0
                      ? theme === 'dark' ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                      : index === 1
                        ? theme === 'dark' ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'
                        : theme === 'dark' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {index === 0 ? 'High' : index === 1 ? 'Medium' : 'Low'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTransactionsWidget = () => {
    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-xl border ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/10' 
            : 'bg-gray-50 border-gray-200'
        }`}>
          <h4 className={`font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Live Transaction Monitoring</h4>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${
                theme === 'dark' ? 'border-white/20' : 'border-gray-200'
              }`}>
                <tr>
                  <th className={`px-4 py-2 text-left text-xs font-semibold ${
                    theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                  }`}>Time</th>
                  <th className={`px-4 py-2 text-left text-xs font-semibold ${
                    theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                  }`}>User</th>
                  <th className={`px-4 py-2 text-left text-xs font-semibold ${
                    theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                  }`}>Amount</th>
                  <th className={`px-4 py-2 text-left text-xs font-semibold ${
                    theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                  }`}>Type</th>
                  <th className={`px-4 py-2 text-left text-xs font-semibold ${
                    theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                  }`}>Risk</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(8)].map((_, index) => (
                  <tr 
                    key={index}
                    className={`border-b ${
                      theme === 'dark' ? 'border-white/10' : 'border-gray-100'
                    } ${
                      index === 1 || index === 4
                        ? theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-sm">
                      {new Date(Date.now() - index * 5 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className={`px-4 py-2 text-sm ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {index === 0 ? 'John S.' :
                       index === 1 ? 'Ahmed H.' :
                       index === 2 ? 'Sarah J.' :
                       index === 3 ? 'Mohammed A.' :
                       index === 4 ? 'John S.' :
                       index === 5 ? 'Lisa C.' :
                       index === 6 ? 'Sarah J.' :
                       'Mohammed A.'}
                    </td>
                    <td className={`px-4 py-2 text-sm font-medium ${
                      index === 1 || index === 4
                        ? 'text-red-500'
                        : theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      ${index === 1 ? '12,000' :
                         index === 4 ? '8,000' :
                         (1000 + index * 500).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {index % 3 === 0 ? 'OUTWARD' : index % 3 === 1 ? 'INWARD' : 'INTERNAL'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        index === 1 || index === 4
                          ? theme === 'dark' ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                          : index === 2 || index === 6
                            ? theme === 'dark' ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-700'
                            : theme === 'dark' ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                      }`}>
                        {index === 1 || index === 4 ? 'High' : index === 2 || index === 6 ? 'Medium' : 'Low'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
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
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Interactive Analytics Dashboard</h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-blue-200/70' : 'text-blue-600'
            }`}>Customizable fraud detection and risk analytics</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              editMode
                ? theme === 'dark'
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                  : 'bg-blue-100 text-blue-700 border border-blue-300'
                : theme === 'dark'
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
            }`}
          >
            {editMode ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Done</span>
              </>
            ) : (
              <>
                <Move className="w-4 h-4" />
                <span className="text-sm">Edit Layout</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleExportDashboard}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-white/10 hover:bg-white/20 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title="Export Dashboard"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => addNotification('Dashboard refreshed', 'success')}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'bg-white/10 hover:bg-white/20 text-white' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title="Refresh Dashboard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {editMode && availableWidgets.length > 0 && (
        <div className={`p-4 border-b ${
          theme === 'dark' ? 'border-white/10' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-blue-400" />
            <h4 className={`font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Add Widgets</h4>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {availableWidgets.map(widget => (
              <button
                key={widget.id}
                onClick={() => handleAddWidget(widget.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  theme === 'dark' 
                    ? 'bg-white/10 hover:bg-white/20 text-white border-white/20' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">{widget.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[600px]">
            <Loader2 className={`w-12 h-12 animate-spin ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`} />
            <p className={`mt-4 ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>Loading dashboard components...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 auto-rows-auto gap-6">
            {widgets.map(widget => renderWidget(widget))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default InteractiveDashboard;