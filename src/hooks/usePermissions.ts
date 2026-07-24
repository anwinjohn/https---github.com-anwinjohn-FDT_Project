import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../utils/apiClient';
import { appConfig as config } from '../config/runtime-config';

export interface Permission {
  menuId: number;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canExport: boolean;
  canImport: boolean;
}

export interface MenuPermissions {
  [menuId: number]: Permission;
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<MenuPermissions>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadPermissions = useCallback(async () => {
    if (!user?.role_id) {
      setPermissions({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      //  const response = await apiClient.get(`/api/menus/permissions/${user.role_id}`);
      const response = await apiClient.get(`${config.api.baseUrl}/api/menus/permissions/${user.role_id}`);

      if (response.success && response.data) {
        const permissionsMap: MenuPermissions = {};
        response.data.forEach((perm: any) => {
          permissionsMap[perm.menu_id] = {
            menuId: perm.menu_id,
            canView: perm.can_view,
            canEdit: perm.can_edit,
            canDelete: perm.can_delete,
            canCreate: perm.can_create,
            canExport: perm.can_export,
            canImport: perm.can_import
          };
        });
        setPermissions(permissionsMap);
      }
    } catch (err) {
      setError('Failed to load permissions');
      console.error('Error loading permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.role_id]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const hasPermission = useCallback((menuId: number, action: keyof Permission): boolean => {
    if (action === 'menuId') return false;

    const permission = permissions[menuId];
    if (!permission) return false;

    return permission[action] === true;
  }, [permissions]);

  const canAccess = useCallback((menuId: number): boolean => {
    return hasPermission(menuId, 'canView');
  }, [hasPermission]);

  const canPerformAction = useCallback((menuId: number, action: 'edit' | 'delete' | 'create' | 'export' | 'import'): boolean => {
    const permissionKey = `can${action.charAt(0).toUpperCase() + action.slice(1)}` as keyof Permission;
    return hasPermission(menuId, permissionKey);
  }, [hasPermission]);

  return {
    permissions,
    loading,
    error,
    hasPermission,
    canAccess,
    canPerformAction,
    refreshPermissions: loadPermissions
  };
};
