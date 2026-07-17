import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
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
  Search,
  Loader2,
  X,
} from 'lucide-react';
import { Role } from '../../types/admin';
import { useNotifications } from '../notifications';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';
import { useAuth } from '../../context/AuthContext';

// ---------------------------------------------------------------------------
// Types matching the new role/menu-permissions API response shape
// ---------------------------------------------------------------------------
interface MenuPermissionFlags {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_import: boolean;
}

interface MenuPermissionNode {
  menu_id: number;
  parent_id: number | null;
  is_parent: boolean;
  menu_name: string;
  menu_key: string;
  menu_url: string;
  menu_icon: string;
  permissions: MenuPermissionFlags;
  children?: MenuPermissionNode[];
}

type PermissionKey = keyof MenuPermissionFlags;

const PERMISSION_KEYS: PermissionKey[] = [
  'can_view',
  'can_edit',
  'can_delete',
  'can_create',
  'can_export',
  'can_import',
];

const PERMISSION_META: Record<
  PermissionKey,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  can_view: { label: 'View', icon: Eye },
  can_edit: { label: 'Edit', icon: Edit },
  can_delete: { label: 'Delete', icon: Trash2 },
  can_create: { label: 'Create', icon: Plus },
  can_export: { label: 'Export', icon: Download },
  can_import: { label: 'Import', icon: Upload },
};

// ---------------------------------------------------------------------------
// Fallback / mock data used only when the API is unreachable (development)
// ---------------------------------------------------------------------------
const MOCK_ROLES: Role[] = [
  {
    id: 0,
    role_name: 'Super Admin',
    description: 'Full system access with all permissions',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 1,
    role_name: 'Admin',
    description: 'Administrative access with limited system settings',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 2,
    role_name: 'User',
    description: 'Standard user access to basic features',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 3,
    role_name: 'Analyst',
    description: 'Enhanced access to analytics and reporting features',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const MOCK_MENU_PERMISSIONS: MenuPermissionNode[] = [
  {
    menu_id: 1,
    parent_id: null,
    is_parent: true,
    menu_name: 'Dashboard',
    menu_key: 'dashboard',
    menu_url: '/dashboard',
    menu_icon: 'LayoutDashboard',
    permissions: {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: false,
      can_export: true,
      can_import: false,
    },
  },
  {
    menu_id: 2,
    parent_id: null,
    is_parent: true,
    menu_name: 'Analytics',
    menu_key: 'analytics',
    menu_url: '/analytics',
    menu_icon: 'BarChart3',
    permissions: {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: false,
      can_export: true,
      can_import: false,
    },
    children: [
      {
        menu_id: 3,
        parent_id: 2,
        is_parent: false,
        menu_name: 'Alert Rules',
        menu_key: 'alert_rules',
        menu_url: '/analytics/rules',
        menu_icon: 'AlertTriangle',
        permissions: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
      {
        menu_id: 4,
        parent_id: 2,
        is_parent: false,
        menu_name: 'User Analysis',
        menu_key: 'user_analysis',
        menu_url: '/analytics/users',
        menu_icon: 'Users',
        permissions: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
      {
        menu_id: 5,
        parent_id: 2,
        is_parent: false,
        menu_name: 'Branch Analysis',
        menu_key: 'branch_analysis',
        menu_url: '/analytics/branches',
        menu_icon: 'Building',
        permissions: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
      {
        menu_id: 6,
        parent_id: 2,
        is_parent: false,
        menu_name: 'Trend Analysis',
        menu_key: 'trend_analysis',
        menu_url: '/analytics/trends',
        menu_icon: 'TrendingUp',
        permissions: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
    ],
  },
  {
    menu_id: 7,
    parent_id: null,
    is_parent: true,
    menu_name: 'Reports',
    menu_key: 'reports',
    menu_url: '/reports',
    menu_icon: 'FileText',
    permissions: {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: false,
      can_export: true,
      can_import: false,
    },
    children: [
      {
        menu_id: 8,
        parent_id: 7,
        is_parent: false,
        menu_name: 'Daily Reports',
        menu_key: 'daily_reports',
        menu_url: '/reports/daily',
        menu_icon: 'Calendar',
        permissions: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
      {
        menu_id: 9,
        parent_id: 7,
        is_parent: false,
        menu_name: 'Monthly Reports',
        menu_key: 'monthly_reports',
        menu_url: '/reports/monthly',
        menu_icon: 'CalendarDays',
        permissions: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
    ],
  },
  {
    menu_id: 10,
    parent_id: null,
    is_parent: true,
    menu_name: 'Administration',
    menu_key: 'admin',
    menu_url: '/admin',
    menu_icon: 'Settings',
    permissions: {
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: false,
      can_export: false,
      can_import: false,
    },
    children: [
      {
        menu_id: 11,
        parent_id: 10,
        is_parent: false,
        menu_name: 'User Management',
        menu_key: 'user_management',
        menu_url: '/admin/user-management',
        menu_icon: 'UserCog',
        permissions: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
      {
        menu_id: 12,
        parent_id: 10,
        is_parent: false,
        menu_name: 'Role Permissions',
        menu_key: 'role_permissions',
        menu_url: '/admin/permissions',
        menu_icon: 'Shield',
        permissions: {
          can_view: true,
          can_create: false,
          can_edit: true,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
      {
        menu_id: 13,
        parent_id: 10,
        is_parent: false,
        menu_name: 'Audit Logs',
        menu_key: 'audit_logs',
        menu_url: '/audit-logs',
        menu_icon: 'FileSearch',
        permissions: {
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
      {
        menu_id: 14,
        parent_id: 10,
        is_parent: false,
        menu_name: 'System Settings',
        menu_key: 'system_settings',
        menu_url: '/admin/settings',
        menu_icon: 'Cog',
        permissions: {
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_export: false,
          can_import: false,
        },
      },
      {
        menu_id: 15,
        parent_id: 10,
        is_parent: false,
        menu_name: 'User Onboarding',
        menu_key: 'user_onboarding',
        menu_url: '/admin/onboarding',
        menu_icon: 'UserPlus',
        permissions: {
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
      {
        menu_id: 19,
        parent_id: 10,
        is_parent: false,
        menu_name: 'Rule Management',
        menu_key: 'rule-management',
        menu_url: '/rule-management',
        menu_icon: 'FileText',
        permissions: {
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_export: false,
          can_import: false,
        },
      },
    ],
  },
  {
    menu_id: 16,
    parent_id: null,
    is_parent: true,
    menu_name: 'Alerts',
    menu_key: 'alerts',
    menu_url: '/alerts',
    menu_icon: 'AlertTriangle',
    permissions: {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
      can_export: false,
      can_import: false,
    },
    children: [
      {
        menu_id: 17,
        parent_id: 16,
        is_parent: false,
        menu_name: 'Alerts Management',
        menu_key: 'alerts_management',
        menu_url: '/alerts-management',
        menu_icon: 'AlertTriangle',
        permissions: {
          can_view: true,
          can_create: false,
          can_edit: true,
          can_delete: false,
          can_export: true,
          can_import: false,
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Pure tree helpers (the API now returns an already-nested menu/permission tree)
// ---------------------------------------------------------------------------
function flattenTree(nodes: MenuPermissionNode[]): MenuPermissionNode[] {
  const result: MenuPermissionNode[] = [];
  const walk = (list: MenuPermissionNode[]) => {
    list.forEach((node) => {
      result.push(node);
      if (node.children && node.children.length > 0) walk(node.children);
    });
  };
  walk(nodes);
  return result;
}

function mapTree(
  nodes: MenuPermissionNode[],
  fn: (node: MenuPermissionNode) => MenuPermissionNode
): MenuPermissionNode[] {
  return nodes.map((node) => {
    const updated = fn(node);
    if (updated.children && updated.children.length > 0) {
      return { ...updated, children: mapTree(updated.children, fn) };
    }
    return updated;
  });
}

function updateSinglePermission(
  nodes: MenuPermissionNode[],
  menuId: number,
  key: PermissionKey,
  value: boolean
): MenuPermissionNode[] {
  return mapTree(nodes, (node) =>
    node.menu_id === menuId
      ? { ...node, permissions: { ...node.permissions, [key]: value } }
      : node
  );
}

function updateBulkPermission(
  nodes: MenuPermissionNode[],
  menuIds: Set<number>,
  key: PermissionKey,
  value: boolean
): MenuPermissionNode[] {
  return mapTree(nodes, (node) =>
    menuIds.has(node.menu_id)
      ? { ...node, permissions: { ...node.permissions, [key]: value } }
      : node
  );
}

function filterTree(
  nodes: MenuPermissionNode[],
  predicate: (node: MenuPermissionNode) => boolean
): MenuPermissionNode[] {
  return nodes.reduce<MenuPermissionNode[]>((acc, node) => {
    const filteredChildren = node.children
      ? filterTree(node.children, predicate)
      : undefined;
    const selfMatches = predicate(node);
    const hasMatchingChildren =
      !!filteredChildren && filteredChildren.length > 0;
    if (selfMatches || hasMatchingChildren) {
      acc.push({ ...node, children: filteredChildren });
    }
    return acc;
  }, []);
}

const SecureRoleMenuPermissions: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissionTree, setPermissionTree] = useState<MenuPermissionNode[]>(
    []
  );
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
  const { user } = useAuth();

  // Get menu ID dynamically
  const ROLE_PERMISSIONS_MENU_ID = getMenuId('role_permissions');

  // Guards so the role-switch effect doesn't re-fire the very first time
  // selectedRole gets set by the initial page-load flow below.
  const skipNextRoleEffect = useRef(true);

  const loadPermissions = useCallback(async (roleId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(`/menu-assignment/${roleId}`);

      if (response.success && response.data) {
        setPermissionTree(response.data);
        setHasChanges(false);
      } else {
        throw new Error(response.error || 'Failed to load permissions');
      }
    } catch (err) {
      setError('Failed to load permissions');
      console.error('Error loading permissions:', err);
      // Fallback to mock data for development
      // setPermissionTree(MOCK_MENU_PERMISSIONS);
      // setHasChanges(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // On page load, kick off the role list and the menu-permissions tree
  // together as a single coordinated initialization step.
  const initialize = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const rolesResponse = await apiClient.get('/api/admin/roles');
      if (!rolesResponse.success || !rolesResponse.data) {
        throw new Error(rolesResponse.error || 'Failed to load roles');
      }

      const loadedRoles: Role[] = rolesResponse.data;
      setRoles(loadedRoles);

      const defaultRole =
        loadedRoles.find((r) => r.is_active) || loadedRoles[0] || null;
      skipNextRoleEffect.current = true;
      setSelectedRole(defaultRole);

      if (defaultRole) {
        const permsResponse = await apiClient.get(
          `/menu-assignment/${defaultRole.id}`
        );
        if (!permsResponse.success || !permsResponse.data) {
          throw new Error(
            permsResponse.error || 'Failed to load menu permissions'
          );
        }
        setPermissionTree(permsResponse.data);
        setHasChanges(false);
      }
    } catch (err) {
      setError('Failed to load roles or menu permissions');
      console.error('Error initializing role menu permissions:', err);

      // Fallback to mock data for development
      skipNextRoleEffect.current = true;
      // setRoles(MOCK_ROLES);
      // setSelectedRole(MOCK_ROLES[0]);
      // setPermissionTree(MOCK_MENU_PERMISSIONS);
      // setHasChanges(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!menuIdsLoading && ROLE_PERMISSIONS_MENU_ID) {
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuIdsLoading, ROLE_PERMISSIONS_MENU_ID]);

  // Fires only when the user explicitly switches roles after initial load
  useEffect(() => {
    if (skipNextRoleEffect.current) {
      skipNextRoleEffect.current = false;
      return;
    }
    if (selectedRole) {
      loadPermissions(selectedRole.id);
    }
  }, [selectedRole, loadPermissions]);

  const handlePermissionChange = (
    menuId: number,
    permission: PermissionKey,
    value: boolean
  ) => {
    setPermissionTree((prev) =>
      updateSinglePermission(prev, menuId, permission, value)
    );
    setHasChanges(true);

    logger.info(
      `Permission changed: ${permission} for menu ${menuId} set to ${value}`,
      undefined,
      { menuId, permission, value, roleId: selectedRole?.id }
    );
  };

  const handleBulkPermissionChange = (
    menuIds: number[],
    permission: PermissionKey,
    value: boolean
  ) => {
    const idSet = new Set(menuIds);
    setPermissionTree((prev) =>
      updateBulkPermission(prev, idSet, permission, value)
    );
    setHasChanges(true);

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

      const permissionsPayload = flattenTree(permissionTree).map((p) => ({
        menu_id: p.menu_id,
        permissions: { ...p.permissions },
      }));
      console.log('Saving permissions payload:', permissionsPayload);
      const response = await apiClient.post('/admin/modify-menu-assignment', {
        roleId: selectedRole.id,
        roleName: selectedRole.role_name,
        actionedBy: user?.username,
        actionedUserId: user?.id,
        permissions: permissionsPayload,
      });

      if (response.success) {
        addNotification(
          response.data?.message || 'Permissions updated successfully',
          'success'
        );
        setHasChanges(false);

        logger.info(
          `Role permissions saved for ${selectedRole.role_name}`,
          undefined,
          {
            roleId: selectedRole.id,
            permissionsCount: permissionsPayload.length,
          }
        );
      } else {
        throw new Error(response.error || 'Failed to save permissions');
      }
    } catch (err) {
      addNotification('Failed to save permissions', 'error');
      console.error('Error saving permissions:', err);

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
      setExpandedMenus(new Set());
    } else {
      const parentMenuIds = flattenTree(permissionTree)
        .filter((p) => p.children && p.children.length > 0)
        .map((p) => p.menu_id);
      setExpandedMenus(new Set(parentMenuIds));
    }
    setAllExpanded(!allExpanded);
  };

  // Narrow the tree down to menus matching the search term (name/url/key),
  // keeping any parent that has a matching descendant.
  const searchedTree = useMemo(() => {
    if (!searchTerm.trim()) return permissionTree;
    const term = searchTerm.toLowerCase();
    return filterTree(
      permissionTree,
      (node) =>
        node.menu_name.toLowerCase().includes(term) ||
        node.menu_url.toLowerCase().includes(term) ||
        node.menu_key.toLowerCase().includes(term)
    );
  }, [permissionTree, searchTerm]);

  // Further narrow to menus that have at least one permission assigned,
  // keeping any parent that has a matching descendant.
  const filteredTree = useMemo(() => {
    if (!showOnlyAssigned) return searchedTree;
    return filterTree(searchedTree, (node) =>
      PERMISSION_KEYS.some((key) => node.permissions[key])
    );
  }, [searchedTree, showOnlyAssigned]);

  const filteredFlatList = useMemo(
    () => flattenTree(filteredTree),
    [filteredTree]
  );

  // Auto-expand parents of matching items while searching
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const idsToExpand = flattenTree(searchedTree)
      .filter((n) => n.children && n.children.length > 0)
      .map((n) => n.menu_id);
    if (idsToExpand.length === 0) return;

    setExpandedMenus((prev) => {
      let changed = false;
      const next = new Set(prev);
      idsToExpand.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [searchedTree, searchTerm]);

  const renderPermissionRow = (
    permission: MenuPermissionNode,
    level: number = 0
  ) => {
    const hasChildren = !!permission.children && permission.children.length > 0;
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
          <td
            className="px-6 py-4"
            style={{ paddingLeft: `${24 + level * 20}px` }}
          >
            <div className="flex items-center gap-2">
              {hasChildren && (
                <button
                  onClick={() => toggleMenuExpansion(permission.menu_id)}
                  className={`p-1 rounded transition-colors ${
                    theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown
                      className={`w-4 h-4 ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}
                    />
                  ) : (
                    <ChevronRight
                      className={`w-4 h-4 ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}
                    />
                  )}
                </button>
              )}
              <div>
                <div
                  className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {permission.menu_name}
                </div>
                <div
                  className={`text-sm ${
                    theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                  }`}
                >
                  {permission.menu_url}
                </div>
              </div>
            </div>
          </td>

          {PERMISSION_KEYS.map((perm) => (
            <td key={perm} className="px-6 py-4 text-center">
              <div className="flex justify-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permission.permissions[perm]}
                    onChange={(e) =>
                      handlePermissionChange(
                        permission.menu_id,
                        perm,
                        e.target.checked
                      )
                    }
                    className="sr-only peer"
                  />
                  <div
                    className={`w-11 h-6 rounded-full peer 
                    ${
                      theme === 'dark'
                        ? 'bg-gray-700 peer-checked:bg-blue-600'
                        : 'bg-gray-200 peer-checked:bg-blue-600'
                    } 
                    peer-focus:outline-none peer-focus:ring-4 
                    ${
                      theme === 'dark'
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

        {hasChildren &&
          isExpanded &&
          permission.children!.map((child) =>
            renderPermissionRow(child, level + 1)
          )}
      </React.Fragment>
    );
  };

  // Show loading while menu IDs are being fetched
  if (menuIdsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
            theme === 'dark' ? 'border-white' : 'border-gray-900'
          }`}
        ></div>
      </div>
    );
  }

  return (
    <PermissionGuard
      menuId={ROLE_PERMISSIONS_MENU_ID}
      action="view"
      fallback={
        <div
          className={`text-center py-20 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">
            You don't have permission to view role permissions.
          </p>
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
              <h1
                className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Secure Role Menu Permissions
              </h1>
              <p
                className={`${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}
              >
                Manage menu access permissions for user roles
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasChanges && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500 text-slate-600 rounded-lg">
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
        <div
          className={`rounded-xl border p-6 ${
            theme === 'dark'
              ? 'bg-white/5 border-white/20'
              : 'bg-gray-50 border-gray-200'
          } backdrop-blur-xl`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}
              >
                Select Role
              </label>
              <select
                value={selectedRole?.id ?? ''}
                onChange={(e) => {
                  const role = roles.find(
                    (r) => r.id === parseInt(e.target.value)
                  );
                  setSelectedRole(role || null);
                }}
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  theme === 'dark'
                    ? 'bg-white/10 border border-white/20 text-white'
                    : 'bg-white border border-gray-300 text-gray-900'
                }`}
              >
                {roles.map((role) => (
                  <option
                    key={role.id}
                    value={role.id}
                    className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}
                  >
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}
              >
                Search Menus
              </label>
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
                      theme === 'dark'
                        ? 'hover:bg-white/20'
                        : 'hover:bg-gray-200'
                    }`}
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <label
                className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}
              >
                Filter
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyAssigned}
                    onChange={(e) => setShowOnlyAssigned(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                  />
                  <span
                    className={
                      theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }
                  >
                    Show only assigned permissions
                  </span>
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
          <div
            className={`rounded-xl border p-4 ${
              theme === 'dark'
                ? 'bg-white/5 border-white/20'
                : 'bg-gray-50 border-gray-200'
            } backdrop-blur-xl`}
          >
            <div className="flex flex-wrap gap-3">
              <span
                className={`font-medium ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}
              >
                Bulk Actions:
              </span>

              {PERMISSION_KEYS.map((permission) => (
                <div key={permission} className="flex gap-1">
                  <button
                    onClick={() =>
                      handleBulkPermissionChange(
                        filteredFlatList.map((p) => p.menu_id),
                        permission,
                        true
                      )
                    }
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      theme === 'dark'
                        ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                        : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                    }`}
                  >
                    Grant {permission.replace('can_', '')}
                  </button>
                  <button
                    onClick={() =>
                      handleBulkPermissionChange(
                        filteredFlatList.map((p) => p.menu_id),
                        permission,
                        false
                      )
                    }
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
        <div
          className={`rounded-xl border overflow-hidden ${
            theme === 'dark'
              ? 'bg-white/5 border-white/20'
              : 'bg-white border-gray-200'
          } backdrop-blur-xl shadow-2xl`}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead
                className={`border-b ${
                  theme === 'dark'
                    ? 'bg-white/5 border-white/20'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <tr>
                  <th
                    className={`px-6 py-4 text-left font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Menu
                  </th>
                  {PERMISSION_KEYS.map((perm) => {
                    const Icon = PERMISSION_META[perm].icon;
                    return (
                      <th
                        key={perm}
                        className={`px-6 py-4 text-center font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Icon className="w-4 h-4" />
                          <span className="text-xs">
                            {PERMISSION_META[perm].label}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2
                          className={`h-8 w-8 animate-spin ${
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          }`}
                        />
                        <span
                          className={
                            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                          }
                        >
                          Loading permissions...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTree.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Shield
                          className={`w-12 h-12 ${
                            theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                          }`}
                        />
                        <span
                          className={
                            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                          }
                        >
                          No permissions found
                        </span>
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
                  filteredTree.map((permission) =>
                    renderPermissionRow(permission)
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Info */}
        {selectedRole && (
          <div
            className={`rounded-xl border p-6 ${
              theme === 'dark'
                ? 'bg-white/5 border-white/20'
                : 'bg-gray-50 border-gray-200'
            } backdrop-blur-xl`}
          >
            <h3
              className={`text-lg font-semibold mb-4 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              Role Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}
                >
                  Role Name
                </label>
                <div
                  className={theme === 'dark' ? 'text-white' : 'text-gray-900'}
                >
                  {selectedRole.role_name}
                </div>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}
                >
                  Description
                </label>
                <div
                  className={
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }
                >
                  {selectedRole.description}
                </div>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}
                >
                  Status
                </label>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    selectedRole.is_active
                      ? theme === 'dark'
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : 'bg-green-100 text-green-700 border border-green-300'
                      : theme === 'dark'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-red-100 text-red-700 border border-red-300'
                  }`}
                >
                  {selectedRole.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}
                >
                  Created
                </label>
                <div
                  className={
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }
                >
                  {new Date(selectedRole.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            className={`rounded-xl border p-4 flex items-center gap-2 ${
              theme === 'dark'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">
              {error} — showing local fallback data.
            </span>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
};

export default SecureRoleMenuPermissions;
