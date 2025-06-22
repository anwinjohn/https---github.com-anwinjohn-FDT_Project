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
import { useAdminApi } from '../../hooks/useAdminApi';
import { useNotifications } from '../notifications';

const RoleMenuPermissions: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<RoleMenuPermission[]>([]);
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);

  const { loading, error, fetchRoles, fetchRoleMenuPermissions, updateRoleMenuPermissions } = useAdminApi();
  const { addNotification } = useNotifications();

  const loadRoles = useCallback(async () => {
    const result = await fetchRoles();
    if (result) {
      setRoles(result);
      if (result.length > 0 && !selectedRole) {
        setSelectedRole(result[0]);
      }
    }
  }, [fetchRoles, selectedRole]);

  const loadPermissions = useCallback(async (roleId: number) => {
    const result = await fetchRoleMenuPermissions(roleId);
    if (result) {
      setPermissions(result);
      setHasChanges(false);
    }
  }, [fetchRoleMenuPermissions]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

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

    const result = await updateRoleMenuPermissions(selectedRole.id, permissions);
    if (result?.success) {
      addNotification(result.message, 'success');
      setHasChanges(false);
    } else {
      addNotification(error || 'Failed to save permissions', 'error');
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
          className="border-b border-white/10 hover:bg-white/5 transition-colors"
        >
          <td className="px-6 py-4" style={{ paddingLeft: `${24 + level * 20}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren && (
                <button
                  onClick={() => toggleMenuExpansion(permission.menu_id)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-white/60" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/60" />
                  )}
                </button>
              )}
              <div>
                <div className="font-medium text-white">{permission.menu_name}</div>
                <div className="text-sm text-white/60">{permission.menu_url}</div>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Role Menu Permissions</h1>
            <p className="text-white/60">Manage menu access permissions for user roles</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          
          <button
            onClick={savePermissions}
            disabled={!hasChanges || loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-green-300 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Role Selection */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Select Role</label>
            <select
              value={selectedRole?.id || ''}
              onChange={(e) => {
                const role = roles.find(r => r.id === parseInt(e.target.value));
                setSelectedRole(role || null);
              }}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {roles.map(role => (
                <option key={role.id} value={role.id} className="bg-slate-800">
                  {role.role_name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Search Menus</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search menus..."
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Filter</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyAssigned}
                onChange={(e) => setShowOnlyAssigned(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
              />
              <span className="text-white/80">Show only assigned permissions</span>
            </label>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 p-4">
        <div className="flex flex-wrap gap-3">
          <span className="text-white/80 font-medium">Bulk Actions:</span>
          
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

      {/* Permissions Table */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/20">
              <tr>
                <th className="px-6 py-4 text-left text-white font-semibold">Menu</th>
                <th className="px-6 py-4 text-center text-white font-semibold">
                  <div className="flex flex-col items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span className="text-xs">View</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-white font-semibold">
                  <div className="flex flex-col items-center gap-1">
                    <Edit className="w-4 h-4" />
                    <span className="text-xs">Edit</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-white font-semibold">
                  <div className="flex flex-col items-center gap-1">
                    <Trash2 className="w-4 h-4" />
                    <span className="text-xs">Delete</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-white font-semibold">
                  <div className="flex flex-col items-center gap-1">
                    <Plus className="w-4 h-4" />
                    <span className="text-xs">Create</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-white font-semibold">
                  <div className="flex flex-col items-center gap-1">
                    <Download className="w-4 h-4" />
                    <span className="text-xs">Export</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-white font-semibold">
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
                      <span className="text-white/60">Loading permissions...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Shield className="w-12 h-12 text-white/40" />
                      <span className="text-white/60">No permissions found</span>
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
        <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Role Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Role Name</label>
              <div className="text-white">{selectedRole.role_name}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Description</label>
              <div className="text-white/80">{selectedRole.description}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Status</label>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                selectedRole.is_active 
                  ? 'bg-green-500/20 text-green-300' 
                  : 'bg-red-500/20 text-red-300'
              }`}>
                {selectedRole.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Created</label>
              <div className="text-white/80">{new Date(selectedRole.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleMenuPermissions;