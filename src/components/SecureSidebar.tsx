import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
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
  X,
  Eye,
  Edit,
  Trash2,
  Plus,
  Download,
  Upload,
  Home,
  Bell,
  Search
} from 'lucide-react';
import { useMenu } from '../hooks/useMenu';
import { MenuItem } from '../types/menu';
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
  Bell
};

const SecureSidebar: React.FC<SecureSidebarProps> = ({ isOpen, onToggle, activeView, onViewChange }) => {
  const { menuItems, loading, error, hasPermission, getUserPermissions } = useMenu();
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showPermissions, setShowPermissions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const toggleExpanded = (itemId: number) => {
    const newExpanded = new Set(expandedItems);

    if (!newExpanded.has(itemId)) {
      newExpanded.clear();
      newExpanded.add(itemId);
    } else {
      newExpanded.delete(itemId);
    }

    setExpandedItems(newExpanded);
  };

  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;

    const filterItems = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        const itemMatches = item.menu_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchingChildren = item.children ? filterItems(item.children) : [];

        if (itemMatches) {
          return item;
        }

        if (matchingChildren.length > 0) {
          return {
            ...item,
            children: matchingChildren
          };
        }

        return null;
      }).filter(Boolean) as MenuItem[];
    };

    return filterItems(menuItems);
  }, [menuItems, searchQuery]);

  const handleMenuClick = (item: MenuItem) => {
    if (item.children && item.children.length > 0) {
      toggleExpanded(item.id);
    } else {
      const viewId = item.menu_url.split('/').pop() || item.menu_url.replace('/', '');
      onViewChange(viewId);
      onToggle();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen) {
        const sidebar = document.getElementById('sidebar');
        const menuButton = document.getElementById('menu-button');
        const target = event.target as Node;

        if (sidebar && !sidebar.contains(target) && menuButton && !menuButton.contains(target)) {
          onToggle();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  const isActiveRoute = (url: string) => {
    const viewId = url.split('/').pop() || url.replace('/', '');
    return activeView === viewId;
  };

  const renderPermissionBadges = (menuId: number) => {
    if (!showPermissions) return null;

    const permissions = getUserPermissions(menuId);
    if (!permissions) return null;

    return (
      <div className="flex gap-1 ml-2">
        {permissions.canView && (
          <div className="p-1 bg-blue-500/20 rounded text-blue-300" title="Can View">
            <Eye className="w-3 h-3" />
          </div>
        )}
        {permissions.canEdit && (
          <div className="p-1 bg-yellow-500/20 rounded text-yellow-300" title="Can Edit">
            <Edit className="w-3 h-3" />
          </div>
        )}
        {permissions.canDelete && (
          <div className="p-1 bg-red-500/20 rounded text-red-300" title="Can Delete">
            <Trash2 className="w-3 h-3" />
          </div>
        )}
        {permissions.canCreate && (
          <div className="p-1 bg-green-500/20 rounded text-green-300" title="Can Create">
            <Plus className="w-3 h-3" />
          </div>
        )}
        {permissions.canExport && (
          <div className="p-1 bg-purple-500/20 rounded text-purple-300" title="Can Export">
            <Download className="w-3 h-3" />
          </div>
        )}
        {permissions.canImport && (
          <div className="p-1 bg-orange-500/20 rounded text-orange-300" title="Can Import">
            <Upload className="w-3 h-3" />
          </div>
        )}
      </div>
    );
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const Icon = iconMap[item.menu_icon] || Shield;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isActive = isActiveRoute(item.menu_url);
    const canView = hasPermission(item.id, 'view');

    if (!canView && item.required_role_id > 0) {
      return null;
    }

    return (
      <div key={item.id}>
        <motion.button
          onClick={() => handleMenuClick(item)}
          whileHover={{ x: level === 0 ? 4 : 2 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center gap-3 p-3 text-left transition-all duration-200 rounded-xl group relative ${isActive
            ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-white shadow-lg'
            : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          style={{ paddingLeft: `${16 + level * 20}px` }}
        >
          <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-white/60 group-hover:text-white'
            }`} />

          <div className="flex-1 text-left">
            <div className="font-medium text-sm">{item.menu_name}</div>
            {level === 0 && (
              <div className="text-xs text-white/50 group-hover:text-white/70">
                {hasChildren ? `${item.children?.length || 0} items` : 'Navigate to section'}
              </div>
            )}
          </div>

          {renderPermissionBadges(item.id)}

          {hasChildren && (
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4" />
            </motion.div>
          )}

          {isActive && (
            <motion.div
              layoutId="activeMenuItem"
              className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </motion.button>

        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-1 space-y-1">
                {item.children!.map(child => renderMenuItem(child, level + 1))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      <motion.aside
        id="sidebar"
        initial={false}
        animate={{
          width: isOpen ? '280px' : '0px',
          opacity: isOpen ? 1 : 0
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900/95 via-blue-900/95 to-indigo-900/95 backdrop-blur-xl border-r border-white/10 z-50 overflow-hidden"
      >
        <div className="flex flex-col h-full">
          {/* Header with Search */}
          <div className="flex flex-col p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">FDT Portal</h2>
                  <p className="text-xs text-blue-200/70">Fraud Detection Tool</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPermissions(!showPermissions)}
                  className={`p-2 rounded-lg transition-colors ${showPermissions ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-white/60'
                    }`}
                  title="Toggle Permission Display"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  onClick={onToggle}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                }`} />
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-8 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all duration-300 ${theme === 'dark'
                    ? 'bg-white/10 border border-white/20 text-white placeholder-white/50 focus:border-blue-500/50'
                    : 'bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                  }`}
              />
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/20' : 'hover:bg-gray-200'
                    }`}
                >
                  <X className={`w-3 h-3 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`} />
                </motion.button>
              )}
            </div>
          </div>

          {/* Permission Legend */}
          {showPermissions && (
            <div className="p-4 border-b border-white/10 bg-white/5">
              <h3 className="text-xs font-semibold text-white/80 mb-2">Permissions</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3 text-blue-300" />
                  <span className="text-white/60">View</span>
                </div>
                <div className="flex items-center gap-1">
                  <Edit className="w-3 h-3 text-yellow-300" />
                  <span className="text-white/60">Edit</span>
                </div>
                <div className="flex items-center gap-1">
                  <Trash2 className="w-3 h-3 text-red-300" />
                  <span className="text-white/60">Delete</span>
                </div>
                <div className="flex items-center gap-1">
                  <Plus className="w-3 h-3 text-green-300" />
                  <span className="text-white/60">Create</span>
                </div>
                <div className="flex items-center gap-1">
                  <Download className="w-3 h-3 text-purple-300" />
                  <span className="text-white/60">Export</span>
                </div>
                <div className="flex items-center gap-1">
                  <Upload className="w-3 h-3 text-orange-300" />
                  <span className="text-white/60">Import</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/60"></div>
                <p className="text-white/60 text-sm">Loading menu...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="p-4 bg-red-500/20 rounded-xl border border-red-500/30 mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-red-300 text-sm">Failed to load menu</p>
                  <p className="text-red-400/70 text-xs mt-1">{error}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMenuItems.length > 0 ? (
                  filteredMenuItems.map(item => renderMenuItem(item))
                ) : searchQuery ? (
                  <div className="text-center py-8">
                    <Search className="w-12 h-12 mx-auto mb-4 text-white/40" />
                    <p className="text-white/60 text-sm">
                      No menu items found for "{searchQuery}"
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/10">
            <div className="text-center text-white/40 text-xs">
              © {new Date().getFullYear()} Al Rostamani Exchange
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default SecureSidebar;