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

interface CacheEntry {
  permissions: MenuPermissions;
  cachedAt: number;
}

// How long a cached permission set is considered fresh. After this elapses,
// the next caller re-fetches from the API so backend permission changes
// propagate without requiring a hard refresh / cache clear.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level cache keyed by role_id. Survives across re-renders AND across
// components, so the permission API is called at most once per role per TTL
// window. This is what stops the per-row <PermissionGuard> instances from
// each firing their own duplicate fetch.
const permissionCache = new Map<string, CacheEntry>();
// In-flight requests keyed by role_id, so concurrent callers share one fetch.
const inflight = new Map<string, Promise<MenuPermissions>>();

async function fetchPermissionsForRole(
  roleId: string
): Promise<MenuPermissions> {
  const response = await apiClient.get(
    `${config.api.baseUrl}/api/menus/permissions/${roleId}`
  );

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
        canImport: perm.can_import,
      };
    });
    return permissionsMap;
  }
  return {};
}

function isCacheFresh(entry: CacheEntry | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.cachedAt < CACHE_TTL_MS;
}

function getPermissionsForRole(roleId: string): Promise<MenuPermissions> {
  const cached = permissionCache.get(roleId);
  if (isCacheFresh(cached)) return Promise.resolve(cached!.permissions);

  let promise = inflight.get(roleId);
  if (!promise) {
    promise = fetchPermissionsForRole(roleId)
      .then((result) => {
        permissionCache.set(roleId, {
          permissions: result,
          cachedAt: Date.now(),
        });
        inflight.delete(roleId);
        return result;
      })
      .catch((err) => {
        inflight.delete(roleId);
        throw err;
      });
    inflight.set(roleId, promise);
  }
  return promise;
}

// Force a fresh fetch, bypassing the cache. Used by refreshPermissions so
// manual refreshes always reflect the latest backend state.
function forceFetchPermissionsForRole(
  roleId: string
): Promise<MenuPermissions> {
  let promise = inflight.get(roleId);
  if (!promise) {
    promise = fetchPermissionsForRole(roleId)
      .then((result) => {
        permissionCache.set(roleId, {
          permissions: result,
          cachedAt: Date.now(),
        });
        inflight.delete(roleId);
        return result;
      })
      .catch((err) => {
        inflight.delete(roleId);
        throw err;
      });
    inflight.set(roleId, promise);
  }
  return promise;
}

export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<MenuPermissions>(() => {
    if (!user?.role_id) return {};
    const cached = permissionCache.get(user.role_id.toString());
    return cached?.permissions ?? {};
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPermissions = useCallback(async () => {
    if (!user?.role_id) {
      setPermissions({});
      setLoading(false);
      return;
    }

    // Serve from cache immediately if fresh, no API call.
    const cached = permissionCache.get(user.role_id.toString());
    if (isCacheFresh(cached)) {
      setPermissions(cached!.permissions);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await getPermissionsForRole(user.role_id.toString());
      setPermissions(result);
    } catch (err) {
      setError('Failed to load permissions');
      console.error('Error loading permissions:', err);
      setPermissions({});
    } finally {
      setLoading(false);
    }
  }, [user?.role_id]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const hasPermission = useCallback(
    (menuId: number, action: keyof Permission): boolean => {
      if (action === 'menuId') return false;

      const permission = permissions[menuId];
      if (!permission) return false;

      return permission[action] === true;
    },
    [permissions]
  );

  const canAccess = useCallback(
    (menuId: number): boolean => {
      return hasPermission(menuId, 'canView');
    },
    [hasPermission]
  );

  const canPerformAction = useCallback(
    (
      menuId: number,
      action: 'edit' | 'delete' | 'create' | 'export' | 'import'
    ): boolean => {
      const permissionKey = `can${
        action.charAt(0).toUpperCase() + action.slice(1)
      }` as keyof Permission;
      return hasPermission(menuId, permissionKey);
    },
    [hasPermission]
  );

  const refreshPermissions = useCallback(async () => {
    if (!user?.role_id) {
      setPermissions({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await forceFetchPermissionsForRole(
        user.role_id.toString()
      );
      setPermissions(result);
    } catch (err) {
      setError('Failed to load permissions');
      console.error('Error loading permissions:', err);
      setPermissions({});
    } finally {
      setLoading(false);
    }
  }, [user?.role_id]);

  return {
    permissions,
    loading,
    error,
    hasPermission,
    canAccess,
    canPerformAction,
    refreshPermissions,
  };
};

/**
 * Invalidate the cache for a role (e.g. after a role/permission change).
 * Call with no args to clear the entire cache.
 */
export function invalidatePermissions(roleId?: string) {
  if (roleId) {
    permissionCache.delete(roleId);
  } else {
    permissionCache.clear();
  }
}
