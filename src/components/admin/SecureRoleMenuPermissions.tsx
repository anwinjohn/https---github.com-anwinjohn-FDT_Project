import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Users,
  ChevronDown,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Plus,
  Download,
  Upload,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Search,
  Filter,
  Loader2,
  X
} from 'lucide-react';
import { Role, RoleMenuPermission } from '../../types/admin';
import { useNotifications } from '../notifications';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';

// Extended interface to include menu_order property
interface EnhancedRoleMenuPermission extends RoleMenuPermission {
  menu_order?: number;
  children?: EnhancedRoleMenuPermission[];
}

const SecureRoleMenuPermissions: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<EnhancedRoleMenuPermission[]>([]);
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);

  const { addNotification } = useNotifications();
  const { theme } = useTheme();
  const { getMenuId, loading: menuIdsLoading } = useMenuIds();

  // Get menu ID dynamically
  const ROLE_PERMISSIONS_MENU_ID = getMenuId('role_permissions');

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/admin/roles');
      
      if (response.success && response.data) {
        setRoles(response.data);
        if (response.data.length > 0 && !selectedRole) {
          setSelectedRole(response.data[0]);
        }
      } else {
        throw new Error(response.error || 'Failed to load roles');
      }
    } catch (err) {
      setError('Failed to load roles');
      console.error('Error loading roles:', err);
      
      // Fallback to mock data for development
      const mockRoles: Role[] = [
        { id: 0, role_name: 'Super Admin', description: 'Full system access with all permissions', is_active: true, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
        { id: 1, role_name: 'Admin', description: 'Administrative access with limited system settings', is_active: true, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
        { id: 2, role_name: 'User', description: 'Standard user access to basic features', is_active: true, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
        { id: 3, role_name: 'Analyst', description: 'Enhanced access to analytics and reporting features', is_active: true, created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' }
      ];
      setRoles(mockRoles);
      if (!selectedRole && mockRoles.length > 0) {
        setSelectedRole(mockRoles[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  const loadPermissions = useCallback(async (roleId: number) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/admin/roles/${roleId}/menu-permissions`);
      
      if (response.success && response.data) {
        setPermissions(response.data);
        setHasChanges(false);
      } else {
        throw new Error(response.error || 'Failed to load permissions');
      }
    } catch (err) {
      setError('Failed to load permissions');
      console.error('Error loading permissions:', err);
      
      // Fallback to mock data for development
      const mockPermissions: EnhancedRoleMenuPermission[] = [
        {
          id: 1,
          role_id: roleId,
          menu_id: 1,
          menu_name: 'Dashboard',
          menu_url: '/dashboard',
          menu_icon: 'LayoutDashboard',
          parent_id: null,
          can_view: true,
          can_edit: roleId < 2,
          can_delete: roleId === 0,
          can_create: roleId < 2,
          can_export: true,
          can_import: roleId === 0,
          level: 0,
          menu_order: 1
        },
        {
          id: 2,
          role_id: roleId,
          menu_id: 2,
          menu_name: 'Analytics',
          menu_url: '/analytics',
          menu_icon: 'BarChart3',
          parent_id: null,
          can_view: true,
          can_edit: roleId < 3,
          can_delete: roleId === 0,
          can_create: roleId < 2,
          can_export: true,
          can_import: roleId === 0,
          level: 0,
          menu_order: 2
        },
        {
          id: 3,
          role_id: roleId,
          menu_id: 3,
          menu_name: 'Alert Rules',
          menu_url: '/analytics/rules',
          menu_icon: 'AlertTriangle',
          parent_id: 2,
          can_view: true,
          can_edit: roleId < 2,
          can_delete: roleId === 0,
          can_create: roleId < 2,
          can_export: true,
          can_import: roleId === 0,
          level: 1,
          menu_order: 1
        },
        {
          id: 4,
          role_id: roleId,
          menu_id: 4,
          menu_name: 'User Analysis',
          menu_url: '/analytics/users',
          menu_icon: 'Users',
          parent_id: 2,
          can_view: true,
          can_edit: roleId < 3,
          can_delete: roleId === 0,
          can_create: roleId < 2,
          can_export: true,
          can_import: roleId === 0,
          level: 1,
          menu_order: 2
        },
        {
          id: 10,
          role_id: roleId,
          menu_id: 10,
          menu_name: 'Administration',
          menu_url: '/admin',
          menu_icon: 'Settings',
          parent_id: null,
          can_view: roleId < 2,
          can_edit: roleId === 0,
          can_delete: roleId === 0,
          can_create: roleId === 0,
          can_export: roleId < 2,
          can_import: roleId === 0,
          level: 0,
          menu_order: 4
        },
        {
          id: 11,
          role_id: roleId,
          menu_id: 11,
          menu_name: 'User Management',
          menu_url: '/admin/users',
          menu_icon: 'UserCog',
          parent_id: 10,
          can_view: roleId < 2,
          can_edit: roleId < 2,
          can_delete: roleId === 0,
          can_create: roleId < 2,
          can_export: roleId < 2,
          can_import: roleId === 0,
          level: 1,
          menu_order: 1
        },
        {
          id: 12,
          role_id: roleId,
          menu_id: 12,
          menu_name: 'Role Permissions',
          menu_url: '/admin/permissions',
          menu_icon: 'Shield',
          parent_id: 10,
          can_view: roleId < 2,
          can_edit: roleId < 2,
          can_delete: roleId === 0,
          can_create: roleId === 0,
          can_export: roleId < 2,
          can_import: roleId === 0,
          level: 1,
          menu_order: 2
        },
        {
          id: 16,
          role_id: roleId,
          menu_id: 16,
          menu_name: 'Alerts Management',
          menu_url: '/alerts-management',
          menu_icon: 'AlertTriangle',
          parent_id: null,
          can_view: true,
          can_edit: roleId < 3,
          can_delete: roleId === 0,
          can_create: roleId < 2,
          can_export: true,
          can_import: roleId === 0,
          level: 0,
          menu_order: 3
        }
      ];
      
      setPermissions(mockPermissions);
      setHasChanges(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!menuIdsLoading && ROLE_PERMISSIONS_MENU_ID) {
      loadRoles();
    }
  }, [loadRoles, menuIdsLoading, ROLE_PERMISSIONS_MENU_ID]);

  useEffect(() => {
    if (selectedRole) {
      loadPermissions(selectedRole.id);
    }
  }, [selectedRole, loadPermissions]);

  const handlePermissionChange = (menuId: number, permission: keyof EnhancedRoleMenuPermission, value: boolean) => {
    setPermissions(prev => prev.map(p => 
      p.menu_id === menuId 
        ? { ...p, [permission]: value }
        : p
    ));
    setHasChanges(true);
    
    // Log the change for audit purposes
    logger.info(
      `Permission changed: ${permission} for menu ${menuId} set to ${value}`,
      undefined,
      { menuId, permission, value, roleId: selectedRole?.id }
    );
  };

  const handleBulkPermissionChange = (menuIds: number[], permission: keyof EnhancedRoleMenuPermission, value: boolean) => {
    setPermissions(prev => prev.map(p => 
      menuIds.includes(p.menu_id)
        ? { ...p, [permission]: value }
        : p
    ));
    setHasChanges(true);
    
    // Log the bulk change for audit purposes
    logger.info(
      `Bulk permission changed: ${permission} for ${menuIds.length} menus set to ${value}`,
      undefined,
      { menuIds, permission, value, roleId: selectedRole?.id }
    );
  };

  const savePermissions = async () => {
    if (!selectedRole) return;

    try {
      setLoading(true);
      
      // Prepare the payload
      const permissionsPayload = permissions.map(p => ({
        menu_id: p.menu_id,
        can_view: p.can_view,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        can_create: p.can_create,
        can_export: p.can_export,
        can_import: p.can_import
      }));
      
      const response = await apiClient.put(`/api/admin/roles/${selectedRole.id}/menu-permissions`, {
        permissions: permissionsPayload
      });
      
      if (response.success) {
        addNotification(response.data?.message || 'Permissions updated successfully', 'success');
        setHasChanges(false);
        
        // Log the successful update for audit purposes
        logger.info(
          `Role permissions saved for ${selectedRole.role_name}`,
          undefined,
          { roleId: selectedRole.id, permissionsCount: permissions.length }
        );
      } else {
        throw new Error(response.error || 'Failed to save permissions');
      }
    } catch (err) {
      addNotification('Failed to save permissions', 'error');
      console.error('Error saving permissions:', err);
      
      // Log the error for audit purposes
      logger.error(
        'Failed to save role permissions',
        undefined,
        { roleId: selectedRole.id, error: err },
        new Error('Permission save failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const resetPermissions = () => {
    if (selectedRole) {
      loadPermissions(selectedRole.id);
      
      // Log the reset for audit purposes
      logger.info(
        `Role permissions reset for ${selectedRole.role_name}`,
        undefined,
        { roleId: selectedRole.id }
      );
    }
  };

  const toggleMenuExpansion = (menuId: number) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuId)) {
      newExpanded.delete(menuId);
    } else {
      newExpanded.add(menuId);
    }
    setExpandedMenus(newExpanded);
  };

  const toggleAllMenus = () => {
    if (allExpanded) {
      // Collapse all
      setExpandedMenus(new Set());
    } else {
      // Expand all parent menus
      const parentMenuIds = permissions
        .filter(p => p.parent_id === null)
        .map(p => p.menu_id);
      setExpandedMenus(new Set(parentMenuIds));
    }
    setAllExpanded(!allExpanded);
  };

  // Memoized filtered permissions to prevent re-renders
  const filteredPermissions = useMemo(() => {
    let filtered = [...permissions];

    if (searchTerm) {
      // Enhanced search that includes both parent and child menus
      const searchLower = searchTerm.toLowerCase();
      
      // First, find all menu IDs that match the search term
      const matchingMenuIds = new Set<number>();
      const parentMenuIds = new Set<number>();
      
      // Add direct matches and collect parent IDs
      permissions.forEach(p => {
        if (
          p.menu_name.toLowerCase().includes(searchLower) ||
          p.menu_url.toLowerCase().includes(searchLower)
        ) {
          matchingMenuIds.add(p.menu_id);
          
          // If this is a child menu, also include its parent
          if (p.parent_id !== null) {
            parentMenuIds.add(p.parent_id);
          }
        }
      });
      
      // Add parent menus of matching children
      permissions.forEach(p => {
        if (p.parent_id !== null && matchingMenuIds.has(p.menu_id)) {
          parentMenuIds.add(p.parent_id);
        }
      });
      
      // Combine matching menus and their parents
      const allIncludedMenuIds = new Set([...matchingMenuIds, ...parentMenuIds]);
      
      // Filter based on the collected menu IDs
      filtered = filtered.filter(p => allIncludedMenuIds.has(p.menu_id));
      
      // Auto-expand parents of matching items
      const parentsToExpand = new Set(expandedMenus);
      parentMenuIds.forEach(id => parentsToExpand.add(id));
      
      // Only update expanded menus if there's a change to prevent re-renders
      if (parentsToExpand.size !== expandedMenus.size) {
        setExpandedMenus(parentsToExpand);
      }
    }

    if (showOnlyAssigned) {
      filtered = filtered.filter(p => 
        p.can_view || p.can_edit || p.can_delete || p.can_create || p.can_export || p.can_import
      );
    }

    return filtered;
  }, [permissions, searchTerm, showOnlyAssigned, expandedMenus]);

  // Memoized menu tree to prevent re-renders
  const menuTree = useMemo(() => {
    const menuMap = new Map<number, EnhancedRoleMenuPermission & { children: EnhancedRoleMenuPermission[] }>();
    const rootMenus: (EnhancedRoleMenuPermission & { children: EnhancedRoleMenuPermission[] })[] = [];

    // Create map with children arrays
    filteredPermissions.forEach(permission => {
      menuMap.set(permission.menu_id, { ...permission, children: [] });
    });

    // Build tree structure
    filteredPermissions.forEach(permission => {
      const menuItem = menuMap.get(permission.menu_id);
      if (!menuItem) return;
      
      if (permission.parent_id === null) {
        rootMenus.push(menuItem);
      } else {
        const parent = menuMap.get(permission.parent_id);
        if (parent) {
          parent.children.push(menuItem);
        } else if (searchTerm) {
          // If we're searching and parent isn't in filtered results, add to root
          rootMenus.push(menuItem);
        }
      }
    });

    // Sort by menu_order if available
    return rootMenus.sort((a, b) => {
      const orderA = a.menu_order || 0;
      const orderB = b.menu_order || 0;
      return orderA - orderB;
    });
  }, [filteredPermissions, searchTerm]);

  const renderPermissionRow = (permission: EnhancedRoleMenuPermission, level: number = 0) => {
    const hasChildren = permission.children && permission.children.length > 0;
    const isExpanded = expandedMenus.has(permission.menu_id);

    return (
      <React.Fragment key={permission.menu_id}>
        <motion.tr
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`border-b transition-colors ${
            theme === 'dark' 
              ? 'border-white/10 hover:bg-white/5' 
              : 'border-gray-100 hover:bg-gray-50'
          }`}
        >
          <td className="px-6 py-4" style={{ paddingLeft: `${24 + level * 20}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren && (
                <button
                  onClick={() => toggleMenuExpansion(permission.menu_id)}
                  className={`p-1 rounded transition-colors ${
                    theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown className={`w-4 h-4 ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`} />
                  ) : (
                    <ChevronRight className={`w-4 h-4 ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`} />
                  )}
                </button>
              )}
              <div>
                <div className={`font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{permission.menu_name}</div>
                <div className={`text-sm ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>{permission.menu_url}</div>
              </div>
            </div>
          </td>
          
          {(['can_view', 'can_edit', 'can_delete', 'can_create', 'can_export', 'can_import'] as const).map(perm => (
            <td key={perm} className="px-6 py-4 text-center">
              <div className="flex justify-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permission[perm]}
                    onChange={(e) => handlePermissionChange(permission.menu_id, perm, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 rounded-full peer 
                    ${theme === 'dark' 
                      ? 'bg-gray-700 peer-checked:bg-blue-600' 
                      : 'bg-gray-200 peer-checked:bg-blue-600'
                    } 
                    peer-focus:outline-none peer-focus:ring-4 
                    ${theme === 'dark' 
                      ? 'peer-focus:ring-blue-800' 
                      : 'peer-focus:ring-blue-300'
                    }
                    after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                    after:bg-white after:border-gray-300 after:border after:rounded-full 
                    after:h-5 after:w-5 after:transition-all 
                    peer-checked:after:translate-x-full peer-checked:after:border-white`}
                  ></div>
                </label>
              </div>
            </td>
          ))}
        </motion.tr>
        
        {hasChildren && isExpanded && 
          permission.children!
            .sort((a, b) => (a.menu_order || 0) - (b.menu_order || 0))
            .map(child => renderPermissionRow(child, level + 1))
        }
      </React.Fragment>
    );
  };

  // Show loading while menu IDs are being fetched
  if (menuIdsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
          theme === 'dark' ? 'border-white' : 'border-gray-900'
        }`}></div>
      </div>
    );
  }

  return (
    <PermissionGuard 
      menuId={ROLE_PERMISSIONS_MENU_ID} 
      action="view"
      fallback={
        <div className={`text-center py-20 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view role permissions.</p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Secure Role Menu Permissions</h1>
              <p className={`${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Manage menu access permissions for user roles</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {hasChanges && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Unsaved changes</span>
              </div>
            )}
            
            <button
              onClick={resetPermissions}
              disabled={!hasChanges}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            
            <PermissionGuard menuId={ROLE_PERMISSIONS_MENU_ID} action="edit">
              <button
                onClick={savePermissions}
                disabled={!hasChanges || loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'bg-green-500/20 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-green-300' 
                    : 'bg-green-100 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed text-green-700'
                }`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </PermissionGuard>
          </div>
        </div>

        {/* Role Selection */}
        <div className={`rounded-xl border p-6 ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-gray-50 border-gray-200'
        } backdrop-blur-xl`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
              }`}>Select Role</label>
              <select
                value={selectedRole?.id || ''}
                onChange={(e) => {
                  const role = roles.find(r => r.id === parseInt(e.target.value));
                  setSelectedRole(role || null);
                }}
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  theme === 'dark' 
                    ? 'bg-white/10 border border-white/20 text-white' 
                    : 'bg-white border border-gray-300 text-gray-900'
                }`}
              >
                {roles.map(role => (
                  <option key={role.id} value={role.id} className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
              }`}>Search Menus</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search menus..."
                  className={`w-full pl-10 pr-10 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    theme === 'dark' 
                      ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full ${
                      theme === 'dark' ? 'hover:bg-white/20' : 'hover:bg-gray-200'
                    }`}
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex flex-col justify-between">
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
              }`}>Filter</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyAssigned}
                    onChange={(e) => setShowOnlyAssigned(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                  />
                  <span className={theme === 'dark' ? 'text-white/80' : 'text-gray-700'}>Show only assigned permissions</span>
                </label>
                
                <button
                  onClick={toggleAllMenus}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    theme === 'dark' 
                      ? 'bg-white/10 hover:bg-white/20 text-white/80' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {allExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  {allExpanded ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        <PermissionGuard menuId={ROLE_PERMISSIONS_MENU_ID} action="edit">
          <div className={`rounded-xl border p-4 ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/20' 
              : 'bg-gray-50 border-gray-200'
          } backdrop-blur-xl`}>
            <div className="flex flex-wrap gap-3">
              <span className={`font-medium ${
                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
              }`}>Bulk Actions:</span>
              
              {(['can_view', 'can_edit', 'can_delete', 'can_create', 'can_export', 'can_import'] as const).map(permission => (
                <div key={permission} className="flex gap-1">
                  <button
                    onClick={() => handleBulkPermissionChange(
                      filteredPermissions.map(p => p.menu_id), 
                      permission, 
                      true
                    )}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      theme === 'dark' 
                        ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30' 
                        : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                    }`}
                  >
                    Grant {permission.replace('can_', '')}
                  </button>
                  <button
                    onClick={() => handleBulkPermissionChange(
                      filteredPermissions.map(p => p.menu_id), 
                      permission, 
                      false
                    )}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      theme === 'dark' 
                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30' 
                        : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-300'
                    }`}
                  >
                    Revoke {permission.replace('can_', '')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </PermissionGuard>

        {/* Permissions Table */}
        <div className={`rounded-xl border overflow-hidden ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-white border-gray-200'
        } backdrop-blur-xl shadow-2xl`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${
                theme === 'dark' 
                  ? 'bg-white/5 border-white/20' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <tr>
                  <th className={`px-6 py-4 text-left font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Menu</th>
                  <th className={`px-6 py-4 text-center font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span className="text-xs">View</span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 text-center font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Edit className="w-4 h-4" />
                      <span className="text-xs">Edit</span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 text-center font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Trash2 className="w-4 h-4" />
                      <span className="text-xs">Delete</span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 text-center font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Plus className="w-4 h-4" />
                      <span className="text-xs">Create</span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 text-center font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Download className="w-4 h-4" />
                      <span className="text-xs">Export</span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 text-center font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-4 h-4" />
                      <span className="text-xs">Import</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className={`h-8 w-8 animate-spin ${
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        }`} />
                        <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>Loading permissions...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPermissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Shield className={`w-12 h-12 ${
                          theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                        }`} />
                        <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>No permissions found</span>
                        {searchTerm && (
                          <button 
                            onClick={() => setSearchTerm('')}
                            className={`mt-2 px-3 py-1 rounded-lg text-sm ${
                              theme === 'dark' 
                                ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' 
                                : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                            }`}
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  menuTree.map(permission => renderPermissionRow(permission))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Info */}
        {selectedRole && (
          <div className={`rounded-xl border p-6 ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/20' 
              : 'bg-gray-50 border-gray-200'
          } backdrop-blur-xl`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Role Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Role Name</label>
                <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{selectedRole.role_name}</div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Description</label>
                <div className={theme === 'dark' ? 'text-white/80' : 'text-gray-700'}>{selectedRole.description}</div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Status</label>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  selectedRole.is_active 
                    ? theme === 'dark'
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                      : 'bg-green-100 text-green-700 border border-green-300'
                    : theme === 'dark'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                      : 'bg-red-100 text-red-700 border border-red-300'
                }`}>
                  {selectedRole.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Created</label>
                <div className={theme === 'dark' ? 'text-white/80' : 'text-gray-700'}>{new Date(selectedRole.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
};

export default SecureRoleMenuPermissions;