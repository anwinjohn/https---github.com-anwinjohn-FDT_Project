import { useState, useCallback } from 'react';
import {
  User,
  Role,
  UserAction,
  RoleMenuPermission,
  AuditLog,
  UserSearchFilters,
  PaginationInfo,
} from '../types/admin';
import config from '../config/app-config.json';

export const useAdminApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('authToken')}`,
  });

  const handleApiCall = async <T>(
    apiCall: () => Promise<Response>
  ): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiCall();

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Unknown error' }));
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('API Error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // User Management APIs
  const fetchUsers = useCallback(
    async (
      filters: UserSearchFilters,
      pagination: { page: number; limit: number }
    ) => {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.role_id !== null && {
          role_id: filters.role_id.toString(),
        }),
        ...(filters.is_active !== null && {
          is_active: filters.is_active.toString(),
        }),
        ...(filters.account_locked !== null && {
          account_locked: filters.account_locked.toString(),
        }),
        ...(filters.mfa_enabled !== null && {
          mfa_enabled: filters.mfa_enabled.toString(),
        }),
      });

      return handleApiCall<{ users: User[]; pagination: PaginationInfo }>(() =>
        fetch(`${config.api.baseUrl}/api/admin/users?${params}`, {
          headers: getAuthHeaders(),
        })
      );
    },
    []
  );

  const performUserAction = useCallback(async (action: UserAction) => {
    return handleApiCall<{ success: boolean; message: string }>(() =>
      fetch(`${config.api.baseUrl}/api/admin/users/action`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(action),
      })
    );
  }, []);

  const fetchRoles = useCallback(async () => {
    return handleApiCall<Role[]>(() =>
      fetch(`${config.api.baseUrl}/api/admin/roles`, {
        headers: getAuthHeaders(),
      })
    );
  }, []);

  // Role Menu Permission APIs
  const fetchRoleMenuPermissions = useCallback(async (roleId: number) => {
    return handleApiCall<RoleMenuPermission[]>(() =>
      fetch(`${config.api.baseUrl}/menu-assignment/${roleId}`, {
        headers: getAuthHeaders(),
      })
    );
  }, []);

  const updateRoleMenuPermissions = useCallback(
    async (roleId: number, permissions: Partial<RoleMenuPermission>[]) => {
      return handleApiCall<{ success: boolean; message: string }>(() =>
        fetch(`${config.api.baseUrl}/menu-assignment/${roleId}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ permissions }),
        })
      );
    },
    []
  );

  // Audit Log APIs
  const fetchAuditLogs = useCallback(
    async (
      filters: { user_id?: string; action?: string; target_type?: string },
      pagination: { page: number; limit: number }
    ) => {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.user_id && { user_id: filters.user_id }),
        ...(filters.action && { action: filters.action }),
        ...(filters.target_type && { target_type: filters.target_type }),
      });

      return handleApiCall<{ logs: AuditLog[]; pagination: PaginationInfo }>(
        () =>
          fetch(`${config.api.baseUrl}/api/admin/audit-logs?${params}`, {
            headers: getAuthHeaders(),
          })
      );
    },
    []
  );

  return {
    loading,
    error,
    fetchUsers,
    performUserAction,
    fetchRoles,
    fetchRoleMenuPermissions,
    updateRoleMenuPermissions,
    fetchAuditLogs,
  };
};
