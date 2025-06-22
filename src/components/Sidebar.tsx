import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronRight,
  Shield,
  X,
  Eye,
  Edit,
  Trash2,
  Plus,
  Download,
  Upload,
  LayoutDashboard,
  BarChart3,
  AlertTriangle,
  Users,
  Building,
  TrendingUp,
  FileText,
  Calendar,
  CalendarDays,
  Settings,
  UserCog,
  Cog,
  FileSearch,
  Home,
  Bell,
  UserPlus,
  Menu,
  Search,
  Filter,
  Zap,
  Star,
  Globe,
  Activity,
  Lock
} from 'lucide-react';
import { useSecureMenu, SecureMenuItem } from '../hooks/useSecureMenu';
import { useTheme } from '../context/ThemeContext';

interface SecureSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeView: string;
  onViewChange: (view: string) => void;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  LayoutDashboard,
  BarChart3,
  AlertTriangle,
  Users,
  Building,
  TrendingUp,
  FileText,
  Calendar,
  CalendarDays,
  Settings,
  UserCog,
  Cog,
  FileSearch,
  Shield,
  Home,
  Bell,
  UserPlus,
  Globe,
  Activity,
  Lock
};

const SecureSidebar: React.FC<SecureSidebarProps> = ({ 
  isOpen, 
  onToggle, 
  activeView, 
  onViewChange 
}) => {
  const { menuItems, loading, error } = useSecureMenu();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showPermissions, setShowPermissions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme } = useTheme();

  const toggleExpanded = (itemId: number) => {
    const newExpanded = new Set(expandedItems);
    
    // Accordion behavior - close all other expanded items when opening a new one
    if (!newExpanded.has(itemId)) {
      newExpanded.clear();
      newExpanded.add(itemId);
    } else {
      newExpanded.delete(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleMenuClick = (item: SecureMenuItem) => {
    if (item.children && item.children.length > 0) {
      toggleExpanded(item.id);
    } else {
      // Convert menu URL to view ID
      const viewId = item.menu_url.split('/').pop() || item.menu_url.replace('/', '');
      onViewChange(viewId);
      // Close sidebar on mobile after selection
      if (window.innerWidth < 1024) {
        onToggle();
      }
    }
  };

  const isActiveRoute = (url: string) => {
    const viewId = url.split('/').pop() || url.replace('/', '');
    return activeView === viewId;
  };

  // Enhanced search functionality
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;
    
    const filterItems = (items: SecureMenuItem[]): SecureMenuItem[] => {
      return items.map(item => {
        const itemMatches = item.menu_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchingChildren = item.children ? filterItems(item.children) : [];
        
        // If parent matches, return with all children
        if (itemMatches) {
          return item;
        }
        
        // If parent doesn't match but has matching children, return parent with only matching children
        if (matchingChildren.length > 0) {
          return {
            ...item,
            children: matchingChildren
          };
        }
        
        // No matches found
        return null;
      }).filter(Boolean) as SecureMenuItem[];
    };
    
    return filterItems(menuItems);
  }, [menuItems, searchQuery]);

  const renderPermissionBadges = (item: SecureMenuItem) => {
    if (!showPermissions || isCollapsed) return null;

    const permissions = [
      { key: 'can_view', icon: Eye, color: 'blue', label: 'View' },
      { key: 'can_edit', icon: Edit, color: 'emerald', label: 'Edit' },
      { key: 'can_delete', icon: Trash2, color: 'red', label: 'Delete' },
      { key: 'can_create', icon: Plus, color: 'green', label: 'Create' },
      { key: 'can_export', icon: Download, color: 'purple', label: 'Export' },
      { key: 'can_import', icon: Upload, color: 'orange', label: 'Import' }
    ];

    const activePermissions = permissions.filter(perm => item[perm.key as keyof SecureMenuItem]);

    if (activePermissions.length === 0) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex gap-1 ml-2"
      >
        {activePermissions.slice(0, 3).map((perm) => {
          const Icon = perm.icon;
          return (
            <div 
              key={perm.key}
              className={`p-1 bg-${perm.color}-500/20 rounded-md border border-${perm.color}-500/30`} 
              title={`Can ${perm.label}`}
            >
              <Icon className={`w-3 h-3 text-${perm.color}-300`} />
            </div>
          );
        })}
        {activePermissions.length > 3 && (
          <div className="p-1 bg-gray-500/20 rounded-md border border-gray-500/30" title={`+${activePermissions.length - 3} more`}>
            <Plus className="w-3 h-3 text-gray-300" />
          </div>
        )}
      </motion.div>
    );
  };

  const renderMenuItem = (item: SecureMenuItem, level: number = 0) => {
    const Icon = iconMap[item.menu_icon] || Shield;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isActive = isActiveRoute(item.menu_url);
    const isHovered = hoveredItem === item.id;

    return (
      <div key={item.id} className="relative">
        <motion.button
          onClick={() => handleMenuClick(item)}
          onHoverStart={() => setHoveredItem(item.id)}
          onHoverEnd={() => setHoveredItem(null)}
          whileHover={{ x: isCollapsed ? 0 : 6 }}
          whileTap={{ scale: 0.96 }}
          className={`w-full flex items-center gap-3 p-3 text-left transition-all duration-300 rounded-2xl group relative overflow-hidden ${
            isActive
              ? theme === 'dark'
                ? 'bg-gradient-to-r from-blue-600/25 via-indigo-600/20 to-purple-600/15 border border-blue-400/40 text-white shadow-2xl shadow-blue-500/20'
                : 'bg-gradient-to-r from-blue-100 via-indigo-100 to-purple-100 border border-blue-400 text-blue-900 shadow-lg shadow-blue-500/20'
              : theme === 'dark'
                ? 'text-white/70 hover:text-white hover:bg-gradient-to-r hover:from-white/5 hover:to-white/10 hover:border-white/20 border border-transparent'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 hover:border-gray-300 border border-transparent'
          }`}
          style={{ paddingLeft: isCollapsed ? '12px' : `${16 + level * 24}px` }}
        >
          {/* Animated background gradient */}
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100"
            initial={false}
            animate={{ 
              background: isActive 
                ? theme === 'dark'
                  ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.1))' 
                  : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.05))'
                : theme === 'dark'
                  ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))'
                  : 'linear-gradient(135deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.01))'
            }}
            transition={{ duration: 0.4 }}
          />

          {/* Icon with enhanced styling */}
          <div className={`relative p-2 rounded-xl transition-all duration-300 ${
            isActive 
              ? theme === 'dark'
                ? 'bg-gradient-to-br from-blue-500/30 to-indigo-600/20 shadow-lg shadow-blue-500/20' 
                : 'bg-gradient-to-br from-blue-200 to-indigo-200 shadow-lg shadow-blue-500/20'
              : theme === 'dark'
                ? 'bg-white/10 group-hover:bg-white/20 group-hover:shadow-lg'
                : 'bg-gray-200 group-hover:bg-gray-300 group-hover:shadow-lg'
          }`}>
            <Icon className={`w-5 h-5 transition-all duration-300 ${
              isActive 
                ? theme === 'dark'
                  ? 'text-blue-300 drop-shadow-sm' 
                  : 'text-blue-700 drop-shadow-sm'
                : theme === 'dark'
                  ? 'text-white/60 group-hover:text-white'
                  : 'text-gray-600 group-hover:text-gray-800'
            }`} />
            
            {/* Active indicator dot - only show when not collapsed */}
            {isActive && !isCollapsed && (
              <motion.div
                layoutId="activeIndicator"
                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-blue-400 to-indigo-500'
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                }`}
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            
            {/* Active indicator for collapsed state */}
            {isActive && isCollapsed && (
              <motion.div
                layoutId="activeIndicatorCollapsed"
                className={`absolute top-1/2 -translate-y-1/2 -left-1 w-1 h-8 rounded-full shadow-lg ${
                  theme === 'dark'
                    ? 'bg-gradient-to-b from-blue-400 to-indigo-500'
                    : 'bg-gradient-to-b from-blue-500 to-indigo-600'
                }`}
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </div>
          
          {!isCollapsed && (
            <div className="flex-1 text-left min-w-0">
              <div className={`font-semibold text-sm transition-all duration-300 ${
                isActive 
                  ? theme === 'dark' ? 'text-white' : 'text-blue-900'
                  : theme === 'dark' ? 'text-white/80 group-hover:text-white' : 'text-gray-700 group-hover:text-gray-900'
              }`}>
                {item.menu_name}
              </div>
              {level === 0 && (
                <motion.div 
                  className={`text-xs transition-all duration-300 ${
                    isActive 
                      ? theme === 'dark' ? 'text-blue-200' : 'text-blue-700'
                      : theme === 'dark' ? 'text-white/50 group-hover:text-white/70' : 'text-gray-500 group-hover:text-gray-700'
                  }`}
                  animate={{ opacity: isHovered ? 1 : 0.7 }}
                >
                  {hasChildren ? `${item.children?.length || 0} sections` : 'Click to navigate'}
                </motion.div>
              )}
            </div>
          )}

          {!isCollapsed && renderPermissionBadges(item)}

          {!isCollapsed && hasChildren && (
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
              className={`p-1 rounded-lg transition-colors duration-300 ${
                isActive 
                  ? theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-200'
                  : theme === 'dark' ? 'group-hover:bg-white/20' : 'group-hover:bg-gray-300'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </motion.div>
          )}

          {/* Shimmer effect on hover */}
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-20"
            animate={{
              background: isHovered 
                ? theme === 'dark'
                  ? 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)'
                  : 'linear-gradient(45deg, transparent 30%, rgba(0,0,0,0.05) 50%, transparent 70%)'
                : 'transparent'
            }}
            transition={{ duration: 0.6 }}
          />
        </motion.button>

        {/* Submenu with enhanced animations */}
        <AnimatePresence>
          {!isCollapsed && hasChildren && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -10 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              transition={{ 
                duration: 0.4, 
                ease: [0.04, 0.62, 0.23, 0.98],
                opacity: { duration: 0.25 }
              }}
              className="overflow-hidden"
            >
              <div className={`mt-2 space-y-1 pl-2 border-l-2 ml-4 ${
                theme === 'dark' ? 'border-white/20' : 'border-gray-300'
              }`}>
                {item.children!.map(child => (
                  <div key={child.id} className="relative">
                    <motion.button
                      onClick={() => handleMenuClick(child)}
                      onHoverStart={() => setHoveredItem(child.id)}
                      onHoverEnd={() => setHoveredItem(null)}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.96 }}
                      className={`w-full flex items-center gap-2.5 p-2.5 text-left transition-all duration-300 rounded-xl group relative overflow-hidden ${
                        isActiveRoute(child.menu_url)
                          ? theme === 'dark'
                            ? 'bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-purple-600/10 border border-blue-400/30 text-white shadow-lg shadow-blue-500/10'
                            : 'bg-gradient-to-r from-blue-100 via-indigo-100 to-purple-100 border border-blue-300 text-blue-900 shadow-lg shadow-blue-500/10'
                          : theme === 'dark'
                            ? 'text-white/60 hover:text-white hover:bg-gradient-to-r hover:from-white/5 hover:to-white/10 hover:border-white/20 border border-transparent'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 hover:border-gray-300 border border-transparent'
                      }`}
                    >
                      {/* Child item icon */}
                      <div className={`relative p-1.5 rounded-lg transition-all duration-300 ${
                        isActiveRoute(child.menu_url) 
                          ? theme === 'dark'
                            ? 'bg-gradient-to-br from-blue-500/20 to-indigo-600/15 shadow-md shadow-blue-500/10' 
                            : 'bg-gradient-to-br from-blue-200 to-indigo-200 shadow-md shadow-blue-500/10'
                          : theme === 'dark'
                            ? 'bg-white/10 group-hover:bg-white/20'
                            : 'bg-gray-200 group-hover:bg-gray-300'
                      }`}>
                        {React.createElement(iconMap[child.menu_icon] || Shield, {
                          className: `w-4 h-4 transition-all duration-300 ${
                            isActiveRoute(child.menu_url) 
                              ? theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                              : theme === 'dark' ? 'text-white/60 group-hover:text-white' : 'text-gray-600 group-hover:text-gray-800'
                          }`
                        })}
                      </div>
                      
                      {/* Child item text with smaller font */}
                      <div className="flex-1 text-left min-w-0">
                        <div className={`font-medium text-xs transition-all duration-300 ${
                          isActiveRoute(child.menu_url) 
                            ? theme === 'dark' ? 'text-white' : 'text-blue-900'
                            : theme === 'dark' ? 'text-white/70 group-hover:text-white' : 'text-gray-600 group-hover:text-gray-900'
                        }`}>
                          {child.menu_name}
                        </div>
                      </div>

                      {renderPermissionBadges(child)}
                    </motion.button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      {/* Enhanced Sidebar */}
      <motion.aside
        id="secure-sidebar"
        initial={false}
        animate={{
          width: isOpen ? (isCollapsed ? '80px' : '320px') : '0px',
          opacity: isOpen ? 1 : 0
        }}
        transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
        className={`fixed left-0 top-0 h-full z-50 overflow-hidden border-r shadow-2xl ${
          theme === 'dark' 
            ? 'bg-gradient-to-b from-slate-900/95 via-slate-800/95 to-slate-900/95 border-white/10 shadow-black/20' 
            : 'bg-gradient-to-b from-white/95 via-gray-50/95 to-white/95 border-gray-200 shadow-gray-500/20'
        } backdrop-blur-2xl`}
      >
        {/* Ambient light effect */}
        <div className={`absolute inset-0 pointer-events-none ${
          theme === 'dark' 
            ? 'bg-gradient-to-b from-blue-500/5 via-transparent to-indigo-500/5' 
            : 'bg-gradient-to-b from-blue-100/30 via-transparent to-indigo-100/30'
        }`} />
        
        <div className="relative flex flex-col h-full">
          {/* Enhanced Header */}
          <div className={`flex items-center justify-between p-6 border-b ${
            theme === 'dark' 
              ? 'border-white/10 bg-gradient-to-r from-white/5 to-white/10' 
              : 'border-gray-200 bg-gradient-to-r from-gray-100/50 to-gray-200/30'
          }`}>
            {!isCollapsed && (
              <motion.div 
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.div 
                  className="relative p-3 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-2xl shadow-2xl shadow-blue-500/25"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Shield className="w-7 h-7 text-white drop-shadow-sm" />
                  <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl" />
                </motion.div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    theme === 'dark' 
                      ? 'bg-gradient-to-r from-white via-blue-100 to-indigo-200 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent'
                  }`}>
                    FDT Portal
                  </h2>
                  <p className={`text-xs font-medium ${
                    theme === 'dark' ? 'text-blue-200/70' : 'text-blue-600'
                  }`}>
                    Fraud Detection Tool
                  </p>
                </div>
              </motion.div>
            )}
            
            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => setShowPermissions(!showPermissions)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`p-2.5 rounded-xl transition-all duration-300 ${
                  showPermissions 
                    ? theme === 'dark'
                      ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border border-blue-500/30' 
                      : 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-300'
                    : theme === 'dark'
                      ? 'hover:bg-white/10 text-white/60 hover:text-white border border-transparent'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800 border border-transparent'
                }`}
                title="Toggle Permission Display"
              >
                <Eye className="w-4 h-4" />
              </motion.button>
              
              <motion.button
                onClick={() => setIsCollapsed(!isCollapsed)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`p-2.5 rounded-xl transition-colors ${
                  theme === 'dark' 
                    ? 'hover:bg-white/10 text-white/60 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
                }`}
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                <Menu className="w-4 h-4" />
              </motion.button>
              
              <motion.button
                onClick={onToggle}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`p-2.5 rounded-xl transition-colors ${
                  theme === 'dark' 
                    ? 'hover:bg-white/10 text-white/60 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
                }`}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {/* Enhanced Search Bar */}
          {!isCollapsed && (
            <motion.div 
              className={`p-4 border-b ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                  theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                }`} />
                <input
                  type="text"
                  placeholder="Search navigation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all duration-300 ${
                    theme === 'dark' 
                      ? 'bg-white/10 border border-white/20 text-white placeholder-white/50 focus:border-blue-500/50' 
                      : 'bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                  }`}
                />
                {searchQuery && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setSearchQuery('')}
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-lg transition-colors ${
                      theme === 'dark' ? 'hover:bg-white/20' : 'hover:bg-gray-200'
                    }`}
                  >
                    <X className={`w-3 h-3 ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`} />
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {/* Enhanced Permission Legend */}
          <AnimatePresence>
            {!isCollapsed && showPermissions && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-4 border-b ${
                  theme === 'dark' 
                    ? 'border-white/10 bg-gradient-to-r from-white/5 to-white/10' 
                    : 'border-gray-200 bg-gradient-to-r from-gray-100/30 to-gray-200/20'
                }`}
              >
                <h3 className={`text-xs font-bold mb-3 flex items-center gap-2 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>
                  <Zap className="w-3 h-3 text-yellow-400" />
                  PERMISSIONS
                </h3>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className={`flex items-center gap-1.5 p-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-blue-500/10 border-blue-500/20' 
                      : 'bg-blue-100 border-blue-300'
                  }`}>
                    <Eye className="w-3 h-3 text-blue-300" />
                    <span className={`font-medium ${
                      theme === 'dark' ? 'text-white/80' : 'text-blue-700'
                    }`}>View</span>
                  </div>
                  <div className={`flex items-center gap-1.5 p-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-emerald-500/10 border-emerald-500/20' 
                      : 'bg-emerald-100 border-emerald-300'
                  }`}>
                    <Edit className="w-3 h-3 text-emerald-300" />
                    <span className={`font-medium ${
                      theme === 'dark' ? 'text-white/80' : 'text-emerald-700'
                    }`}>Edit</span>
                  </div>
                  <div className={`flex items-center gap-1.5 p-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-red-500/10 border-red-500/20' 
                      : 'bg-red-100 border-red-300'
                  }`}>
                    <Trash2 className="w-3 h-3 text-red-300" />
                    <span className={`font-medium ${
                      theme === 'dark' ? 'text-white/80' : 'text-red-700'
                    }`}>Delete</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Enhanced Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 space-y-4">
                <div className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
                  theme === 'dark' ? 'border-white/60' : 'border-gray-600'
                }`}></div>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>Loading secure menu...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className={`p-4 rounded-xl border mb-4 ${
                  theme === 'dark' 
                    ? 'bg-red-500/20 border-red-500/30' 
                    : 'bg-red-100 border-red-300'
                }`}>
                  <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${
                    theme === 'dark' ? 'text-red-400' : 'text-red-600'
                  }`} />
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-red-300' : 'text-red-700'
                  }`}>Failed to load secure menu</p>
                  <p className={`text-xs mt-1 ${
                    theme === 'dark' ? 'text-red-400/70' : 'text-red-600/70'
                  }`}>{error}</p>
                </div>
              </div>
            ) : (
              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, staggerChildren: 0.05 }}
              >
                {filteredMenuItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {renderMenuItem(item)}
                  </motion.div>
                ))}
                
                {filteredMenuItems.length === 0 && searchQuery && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8"
                  >
                    <Search className={`w-12 h-12 mx-auto mb-4 ${
                      theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                    }`} />
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}>
                      No menu items found for "{searchQuery}"
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </nav>

          {/* Enhanced Footer */}
          <motion.div 
            className={`p-4 border-t ${
              theme === 'dark' 
                ? 'border-white/10 bg-gradient-to-r from-white/5 to-white/10' 
                : 'border-gray-200 bg-gradient-to-r from-gray-100/30 to-gray-200/20'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {!isCollapsed ? (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className={`font-semibold text-sm ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Secure Portal</span>
                </div>
                <div className={`text-xs ${
                  theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                }`}>
                  © {new Date().getFullYear()} Al Rostamani Exchange
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
            )}
          </motion.div>
        </div>
      </motion.aside>
    </>
  );
};

export default SecureSidebar;