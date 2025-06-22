import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  Database, 
  Activity, 
  Search, 
  ChevronRight, 
  Sparkles, 
  Zap, 
  Globe, 
  ToggleLeft, 
  ToggleRight,
  Monitor,
  Wifi,
  WifiOff,
  Save,
  RefreshCw
} from 'lucide-react';
import { logger } from '../utils/logger';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useNotifications } from './notifications';
import { useTheme } from '../context/ThemeContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id?: string;
    username?: string;
    role_id?: number;
    full_name?: string;
  } | null;
  masterLiveEnabled: boolean;
  onMasterLiveChange: (enabled: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  user, 
  masterLiveEnabled, 
  onMasterLiveChange 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localMasterLive, setLocalMasterLive] = useState(masterLiveEnabled);
  
  const { getSetting, updateSetting, loading: settingsLoading } = useSystemSettings();
  const { addNotification } = useNotifications();
  const { theme } = useTheme();

  // Sync with system settings
  useEffect(() => {
    if (!settingsLoading) {
      const systemMasterLive = getSetting('master_live_enabled', true);
      setLocalMasterLive(systemMasterLive);
      onMasterLiveChange(systemMasterLive);
    }
  }, [settingsLoading, getSetting, onMasterLiveChange]);

  const settingsSections = [
    { 
      icon: User, 
      label: 'Profile Settings', 
      description: 'Manage your account preferences and personal information', 
      category: 'Personal', 
      color: 'from-blue-500 to-blue-600',
      bgColor: theme === 'dark' 
        ? 'from-blue-500/15 to-blue-500/5' 
        : 'from-blue-100 to-blue-50',
      borderColor: theme === 'dark' 
        ? 'border-blue-500/30' 
        : 'border-blue-300'
    },
    { 
      icon: Bell, 
      label: 'Notifications', 
      description: 'Configure alert notifications and communication preferences', 
      category: 'Preferences', 
      color: 'from-green-500 to-green-600',
      bgColor: theme === 'dark' 
        ? 'from-green-500/15 to-green-500/5' 
        : 'from-green-100 to-green-50',
      borderColor: theme === 'dark' 
        ? 'border-green-500/30' 
        : 'border-green-300'
    },
    { 
      icon: Monitor, 
      label: 'Master Live Updates', 
      description: 'Control real-time data updates for all users system-wide', 
      category: 'System', 
      color: 'from-purple-500 to-purple-600',
      bgColor: theme === 'dark' 
        ? 'from-purple-500/15 to-purple-500/5' 
        : 'from-purple-100 to-purple-50',
      borderColor: theme === 'dark' 
        ? 'border-purple-500/30' 
        : 'border-purple-300',
      isLiveToggle: true
    },
    { 
      icon: Shield, 
      label: 'Security', 
      description: 'Security settings, authentication and access control', 
      category: 'Security', 
      color: 'from-red-500 to-red-600',
      bgColor: theme === 'dark' 
        ? 'from-red-500/15 to-red-500/5' 
        : 'from-red-100 to-red-50',
      borderColor: theme === 'dark' 
        ? 'border-red-500/30' 
        : 'border-red-300'
    },
    { 
      icon: Database, 
      label: 'Data Management', 
      description: 'Manage data retention, exports and backup settings', 
      category: 'Data', 
      color: 'from-orange-500 to-orange-600',
      bgColor: theme === 'dark' 
        ? 'from-orange-500/15 to-orange-500/5' 
        : 'from-orange-100 to-orange-50',
      borderColor: theme === 'dark' 
        ? 'border-orange-500/30' 
        : 'border-orange-300'
    },
    { 
      icon: Activity, 
      label: 'System Logs', 
      description: 'View application logs, audit trails and system activity', 
      category: 'Monitoring', 
      color: 'from-cyan-500 to-cyan-600',
      bgColor: theme === 'dark' 
        ? 'from-cyan-500/15 to-cyan-500/5' 
        : 'from-cyan-100 to-cyan-50',
      borderColor: theme === 'dark' 
        ? 'border-cyan-500/30' 
        : 'border-cyan-300'
    },
  ];

  const filteredSections = settingsSections.filter(section =>
    section.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleMasterLiveToggle = async () => {
    const newValue = !localMasterLive;
    setLocalMasterLive(newValue);
    
    try {
      const success = await updateSetting('master_live_enabled', newValue);
      if (success) {
        onMasterLiveChange(newValue);
        addNotification(
          `Master live updates ${newValue ? 'enabled' : 'disabled'} successfully`,
          'success'
        );
        logger.info(`Master live updates ${newValue ? 'enabled' : 'disabled'}`, user?.full_name || 'Unknown User');
      } else {
        // Revert on failure
        setLocalMasterLive(!newValue);
        addNotification('Failed to update master live setting', 'error');
      }
    } catch (error) {
      // Revert on error
      setLocalMasterLive(!newValue);
      addNotification('Error updating master live setting', 'error');
    }
  };

  const handleSectionClick = (section: typeof settingsSections[0]) => {
    if (section.isLiveToggle) {
      // Handle live toggle directly
      handleMasterLiveToggle();
      return;
    }

    setActiveSection(section.label);
    setIsLoading(true);
    logger.info(`Settings section clicked: ${section.label}`, user?.full_name || 'Unknown User');

    setTimeout(() => {
      setActiveSection(null);
      setIsLoading(false);
    }, 2000);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <div className="fixed inset-0 overflow-y-auto z-50">
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={`w-full max-w-5xl rounded-3xl border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-br from-slate-900/98 via-blue-900/98 to-indigo-900/98 border-white/20' 
                    : 'bg-gradient-to-br from-white/98 via-gray-50/98 to-blue-50/98 border-gray-200'
                } backdrop-blur-2xl`}
              >
                {/* Enhanced Header */}
                <div className={`relative p-8 border-b ${
                  theme === 'dark' 
                    ? 'border-white/10 bg-gradient-to-r from-white/5 to-white/10' 
                    : 'border-gray-200 bg-gradient-to-r from-gray-100/50 to-blue-100/50'
                }`}>
                  <div className={`absolute inset-0 ${
                    theme === 'dark' 
                      ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10' 
                      : 'bg-gradient-to-r from-blue-200/30 to-purple-200/30'
                  }`}></div>
                  <div className="relative flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                        <SettingsIcon className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className={`text-3xl font-bold mb-1 ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>System Settings</h2>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <p className={theme === 'dark' ? 'text-blue-200/80' : 'text-blue-600'}>
                            Logged in as {user?.full_name || 'Unknown User'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={onClose}
                      className={`p-3 rounded-2xl transition-all duration-200 border ${
                        theme === 'dark' 
                          ? 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/30 text-white' 
                          : 'bg-gray-100 hover:bg-gray-200 border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <X className="w-6 h-6" />
                    </motion.button>
                  </div>
                </div>

                {/* Enhanced Search Bar */}
                <div className={`p-6 border-b ${
                  theme === 'dark' 
                    ? 'border-white/10 bg-gradient-to-r from-white/5 to-transparent' 
                    : 'border-gray-200 bg-gradient-to-r from-gray-100/30 to-transparent'
                }`}>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
                    <input
                      type="text"
                      placeholder="Search settings and preferences..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        theme === 'dark' 
                          ? 'bg-white/10 border border-white/20 text-white placeholder-white/50 hover:bg-white/15' 
                          : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-500 hover:bg-gray-50'
                      } backdrop-blur-sm`}
                    />
                    {searchTerm && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => setSearchTerm('')}
                        className={`absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded-lg transition-colors ${
                          theme === 'dark' ? 'hover:bg-white/20' : 'hover:bg-gray-200'
                        }`}
                      >
                        <X className={`w-4 h-4 ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }`} />
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Enhanced Settings Grid */}
                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                  {filteredSections.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-16"
                    >
                      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border ${
                        theme === 'dark' 
                          ? 'bg-gradient-to-br from-white/10 to-white/5 border-white/20' 
                          : 'bg-gradient-to-br from-gray-100 to-gray-50 border-gray-200'
                      }`}>
                        <Search className={`w-10 h-10 ${
                          theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                        }`} />
                      </div>
                      <h3 className={`text-xl font-semibold mb-2 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>No settings found</h3>
                      <p className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>
                        No settings match "{searchTerm}". Try a different search term.
                      </p>
                    </motion.div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {filteredSections.map((section, index) => (
                        <motion.button
                          key={section.label}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onClick={() => handleSectionClick(section)}
                          disabled={isLoading && !section.isLiveToggle}
                          whileHover={{ y: -4, scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`group relative w-full p-6 rounded-2xl transition-all duration-300 border backdrop-blur-xl shadow-lg hover:shadow-xl ${
                            section.bgColor
                          } ${section.borderColor} ${
                            theme === 'dark' ? 'hover:border-white/30' : 'hover:border-gray-400'
                          } ${
                            activeSection === section.label
                              ? 'ring-2 ring-blue-500/50 shadow-blue-500/20'
                              : ''
                          }`}
                        >
                          {/* Background Effects */}
                          <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                            theme === 'dark' 
                              ? 'bg-gradient-to-br from-white/5 to-transparent' 
                              : 'bg-gradient-to-br from-white/50 to-transparent'
                          }`}></div>
                          
                          <div className="relative flex items-start gap-4">
                            <div className={`p-4 rounded-2xl transition-all duration-300 ${
                              activeSection === section.label || section.isLiveToggle
                                ? `bg-gradient-to-br ${section.color} shadow-lg`
                                : theme === 'dark'
                                  ? 'bg-white/10 group-hover:bg-white/20'
                                  : 'bg-gray-200 group-hover:bg-gray-300'
                            }`}>
                              <section.icon className={`w-6 h-6 transition-colors duration-300 ${
                                activeSection === section.label || section.isLiveToggle
                                  ? 'text-white'
                                  : theme === 'dark'
                                    ? 'text-white/70 group-hover:text-white'
                                    : 'text-gray-600 group-hover:text-gray-800'
                              }`} />
                            </div>
                            
                            <div className="text-left flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className={`text-lg font-semibold transition-colors ${
                                  theme === 'dark' 
                                    ? 'text-white group-hover:text-blue-200' 
                                    : 'text-gray-900 group-hover:text-blue-700'
                                }`}>
                                  {section.label}
                                </h3>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                                  theme === 'dark' 
                                    ? 'bg-white/20 text-white/80 border-white/20' 
                                    : 'bg-gray-200 text-gray-700 border-gray-300'
                                }`}>
                                  {section.category}
                                </span>
                              </div>
                              <p className={`text-sm leading-relaxed transition-colors ${
                                theme === 'dark' 
                                  ? 'text-white/60 group-hover:text-white/80' 
                                  : 'text-gray-600 group-hover:text-gray-800'
                              }`}>
                                {section.description}
                              </p>
                            </div>
                            
                            <div className="flex-shrink-0 ml-2">
                              {section.isLiveToggle ? (
                                <div className="flex items-center gap-2">
                                  {localMasterLive ? (
                                    <>
                                      <Wifi className="w-5 h-5 text-green-400" />
                                      <ToggleRight className="w-8 h-8 text-green-400" />
                                    </>
                                  ) : (
                                    <>
                                      <WifiOff className="w-5 h-5 text-red-400" />
                                      <ToggleLeft className="w-8 h-8 text-red-400" />
                                    </>
                                  )}
                                </div>
                              ) : activeSection === section.label ? (
                                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <ChevronRight className={`w-5 h-5 transition-all duration-200 ${
                                  theme === 'dark' 
                                    ? 'text-white/40 group-hover:text-white/70 group-hover:translate-x-1' 
                                    : 'text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1'
                                }`} />
                              )}
                            </div>
                          </div>

                          {/* Live Status Indicator */}
                          {section.isLiveToggle && (
                            <div className={`mt-4 p-3 rounded-xl border ${
                              theme === 'dark' 
                                ? 'bg-white/5 border-white/10' 
                                : 'bg-gray-100 border-gray-200'
                            }`}>
                              <div className="flex items-center gap-2 text-sm">
                                <div className={`w-2 h-2 rounded-full ${
                                  localMasterLive ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                                }`}></div>
                                <span className={`font-medium ${
                                  theme === 'dark' ? 'text-white/80' : 'text-gray-800'
                                }`}>
                                  {localMasterLive ? 'Live Updates Active' : 'Live Updates Disabled'}
                                </span>
                              </div>
                              <p className={`text-xs mt-1 ${
                                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                              }`}>
                                {localMasterLive 
                                  ? 'Users can control individual live update preferences'
                                  : 'All live updates are disabled system-wide'
                                }
                              </p>
                            </div>
                          )}

                          {/* Decorative Elements */}
                          {section.label === 'Profile Settings' && (
                            <Sparkles className={`absolute top-4 right-4 w-4 h-4 transition-colors ${
                              theme === 'dark' 
                                ? 'text-blue-400/30 group-hover:text-blue-400/60' 
                                : 'text-blue-500/40 group-hover:text-blue-500/70'
                            }`} />
                          )}
                          {section.label === 'Security' && (
                            <Zap className={`absolute top-4 right-4 w-4 h-4 transition-colors ${
                              theme === 'dark' 
                                ? 'text-red-400/30 group-hover:text-red-400/60' 
                                : 'text-red-500/40 group-hover:text-red-500/70'
                            }`} />
                          )}
                          {section.label === 'Data Management' && (
                            <Globe className={`absolute top-4 right-4 w-4 h-4 transition-colors ${
                              theme === 'dark' 
                                ? 'text-orange-400/30 group-hover:text-orange-400/60' 
                                : 'text-orange-500/40 group-hover:text-orange-500/70'
                            }`} />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Enhanced Footer */}
                <div className={`p-6 border-t ${
                  theme === 'dark' 
                    ? 'border-white/10 bg-gradient-to-r from-white/5 to-transparent' 
                    : 'border-gray-200 bg-gradient-to-r from-gray-100/30 to-transparent'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className={`flex items-center gap-3 text-sm ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}>
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>System Status: Operational</span>
                      <span>•</span>
                      <span>Version 2.1.0</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {localMasterLive ? (
                          <>
                            <Wifi className="w-3 h-3 text-green-400" />
                            <span className="text-green-400">Live Active</span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="w-3 h-3 text-red-400" />
                            <span className="text-red-400">Live Disabled</span>
                          </>
                        )}
                      </span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onClose}
                      className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg"
                    >
                      Close Settings
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;