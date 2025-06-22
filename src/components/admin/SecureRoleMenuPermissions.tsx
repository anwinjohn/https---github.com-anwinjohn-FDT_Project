import React, { useState, useEffect, useCallback } from 'react';
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
  Filter
} from 'lucide-react';
import { Role, RoleMenuPermission } from '../../types/admin';
import { useNotifications } from '../notifications';
import { useTheme } from '../../context/ThemeContext';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';
import { useMenuIds } from '../../hooks/useMenuIds';



const SecureRoleMenuPermissions: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<RoleMenuPermission[]>([]);
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handlePermissionChange = (menuId: number, permission: keyof RoleMenuPermission, value: boolean) => {
    setPermissions(prev => prev.map(p =>
      p.menu_id === menuId
        ? { ...p, [permission]: value }
        : p
    ));
    setHasChanges(true);
  };

  const handleBulkPermissionChange = (menuIds: number[], permission: keyof RoleMenuPermission, value: boolean) => {
    setPermissions(prev => prev.map(p =>
      menuIds.includes(p.menu_id)
        ? { ...p, [permission]: value }
        : p
    ));
    setHasChanges(true);
  };

  const savePermissions = async () => {
    if (!selectedRole) return;

    try {
      setLoading(true);
      const response = await apiClient.put(`/api/admin/roles/${selectedRole.id}/menu-permissions`, {
        permissions: permissions
      });

      if (response.success) {
        addNotification(response.data?.message || 'Permissions updated successfully', 'success');
        setHasChanges(false);
      } else {
        throw new Error(response.error || 'Failed to save permissions');
      }
    } catch (err) {
      addNotification('Failed to save permissions', 'error');
      console.error('Error saving permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetPermissions = () => {
    if (selectedRole) {
      loadPermissions(selectedRole.id);
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

  const getFilteredPermissions = () => {
    let filtered = permissions;

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.menu_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.menu_url.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (showOnlyAssigned) {
      filtered = filtered.filter(p =>
        p.can_view || p.can_edit || p.can_delete || p.can_create || p.can_export || p.can_import
      );
    }

    return filtered;
  };

  const buildMenuTree = (permissions: RoleMenuPermission[]) => {
    const menuMap = new Map<number, RoleMenuPermission & { children: RoleMenuPermission[] }>();
    const rootMenus: (RoleMenuPermission & { children: RoleMenuPermission[] })[] = [];

    // Create map with children arrays
    permissions.forEach(permission => {
      menuMap.set(permission.menu_id, { ...permission, children: [] });
    });

    // Build tree structure
    permissions.forEach(permission => {
      const menuItem = menuMap.get(permission.menu_id)!;

      if (permission.parent_id === null) {
        rootMenus.push(menuItem);
      } else {
        const parent = menuMap.get(permission.parent_id);
        if (parent) {
          parent.children.push(menuItem);
        }
      }
    });

    return rootMenus.sort((a, b) => a.menu_name.localeCompare(b.menu_name));
  };

  const renderPermissionRow = (permission: RoleMenuPermission, level: number = 0) => {
    const hasChildren = permissions.some(p => p.parent_id === permission.menu_id);
    const isExpanded = expandedMenus.has(permission.menu_id);

    return (
      <React.Fragment key={permission.menu_id}>
        <motion.tr
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`border-b transition-colors ${theme === 'dark'
              ? 'border-white/10 hover:bg-white/5'
              : 'border-gray-100 hover:bg-gray-50'
            }`}
        >
          <td className="px-6 py-4" style={{ paddingLeft: `${24 + level * 20}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren && (
                <button
                  onClick={() => toggleMenuExpansion(permission.menu_id)}
                  className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                    }`}
                >
                  {isExpanded ? (
                    <ChevronDown className={`w-4 h-4 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`} />
                  ) : (
                    <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`} />
                  )}
                </button>
              )}
              <div>
                <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>{permission.menu_name}</div>
                <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                  }`}>{permission.menu_url}</div>
              </div>
            </div>
          </td>

          {(['can_view', 'can_edit', 'can_delete', 'can_create', 'can_export', 'can_import'] as const).map(perm => (
            <td key={perm} className="px-6 py-4 text-center">
              <input
                type="checkbox"
                checked={permission[perm]}
                onChange={(e) => handlePermissionChange(permission.menu_id, perm, e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
              />
            </td>
          ))}
        </motion.tr>

        {hasChildren && isExpanded &&
          permissions
            .filter(p => p.parent_id === permission.menu_id)
            .map(child => renderPermissionRow(child, level + 1))
        }
      </React.Fragment>
    );
  };

  const filteredPermissions = getFilteredPermissions();
  const menuTree = buildMenuTree(filteredPermissions);

  return (
    <PermissionGuard
      menuId={ROLE_PERMISSIONS_MENU_ID}
      action="view"
      fallback={
        <div className={`text-center py-20 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
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
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Secure Role Menu Permissions</h1>
              <p className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
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
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-green-300 rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </PermissionGuard>
          </div>
        </div>

        {/* Role Selection */}
        <div className={`rounded-xl border p-6 ${theme === 'dark'
            ? 'bg-white/5 border-white/20'
            : 'bg-gray-50 border-gray-200'
          } backdrop-blur-xl`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Select Role</label>
              <select
                value={selectedRole?.id || ''}
                onChange={(e) => {
                  const role = roles.find(r => r.id === parseInt(e.target.value));
                  setSelectedRole(role || null);
                }}
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
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
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Search Menus</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search menus..."
                  className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                      ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Filter</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyAssigned}
                  onChange={(e) => setShowOnlyAssigned(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                />
                <span className={theme === 'dark' ? 'text-white/80' : 'text-gray-700'}>Show only assigned permissions</span>
              </label>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        <PermissionGuard menuId={ROLE_PERMISSIONS_MENU_ID} action="edit">
          <div className={`rounded-xl border p-4 ${theme === 'dark'
              ? 'bg-white/5 border-white/20'
              : 'bg-gray-50 border-gray-200'
            } backdrop-blur-xl`}>
            <div className="flex flex-wrap gap-3">
              <span className={`font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Bulk Actions:</span>

              {(['can_view', 'can_edit', 'can_delete', 'can_create', 'can_export', 'can_import'] as const).map(permission => (
                <div key={permission} className="flex gap-1">
                  <button
                    onClick={() => handleBulkPermissionChange(
                      filteredPermissions.map(p => p.menu_id),
                      permission,
                      true
                    )}
                    className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded text-xs transition-colors"
                  >
                    Grant {permission.replace('can_', '')}
                  </button>
                  <button
                    onClick={() => handleBulkPermissionChange(
                      filteredPermissions.map(p => p.menu_id),
                      permission,
                      false
                    )}
                    className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-xs transition-colors"
                  >
                    Revoke {permission.replace('can_', '')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </PermissionGuard>

        {/* Permissions Table */}
        <div className={`rounded-xl border overflow-hidden ${theme === 'dark'
            ? 'bg-white/5 border-white/20'
            : 'bg-white border-gray-200'
          } backdrop-blur-xl shadow-2xl`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${theme === 'dark'
                  ? 'bg-white/5 border-white/20'
                  : 'bg-gray-50 border-gray-200'
                }`}>
                <tr>
                  <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Menu</th>
                  <th className={`px-6 py-4 text-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span className="text-xs">View</span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 text-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Edit className="w-4 h-4" />
                      <span className="text-xs">Edit</span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 text-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Trash2 className="w-4 h-4" />
                      <span className="text-xs">Delete</span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 text-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Plus className="w-4 h-4" />
                      <span className="text-xs">Create</span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 text-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                    <div className="flex flex-col items-center gap-1">
                      <Download className="w-4 h-4" />
                      <span className="text-xs">Export</span>
                    </div>
                  </th>
                  <th className={`px-6 py-4 text-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
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
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>Loading permissions...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPermissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Shield className={`w-12 h-12 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                          }`} />
                        <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>No permissions found</span>
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
          <div className={`rounded-xl border p-6 ${theme === 'dark'
              ? 'bg-white/5 border-white/20'
              : 'bg-gray-50 border-gray-200'
            } backdrop-blur-xl`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Role Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Role Name</label>
                <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{selectedRole.role_name}</div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Description</label>
                <div className={theme === 'dark' ? 'text-white/80' : 'text-gray-700'}>{selectedRole.description}</div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Status</label>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${selectedRole.is_active
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-red-500/20 text-red-300'
                  }`}>
                  {selectedRole.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
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