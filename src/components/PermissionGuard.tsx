import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';

interface PermissionGuardProps {
  menuId: number;
  action?: 'view' | 'edit' | 'delete' | 'create' | 'export' | 'import';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAll?: boolean; // If true, user must have all specified actions
  actions?: Array<'view' | 'edit' | 'delete' | 'create' | 'export' | 'import'>;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  menuId,
  action = 'view',
  children,
  fallback = null,
  requireAll = false,
  actions = [],
}) => {
  const { hasPermission, loading } = usePermissions();
  const { user } = useAuth();

  // Super admin (role_id 0) has access to everything
  if (user?.role_id === 0) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Check single action
  if (actions.length === 0) {
    const permissionKey =
      `can${action.charAt(0).toUpperCase() + action.slice(1)}` as any;
    const hasAccess = hasPermission(menuId, permissionKey);
    return hasAccess ? <>{children}</> : <>{fallback}</>;
  }

  // Check multiple actions
  const actionChecks = actions.map((act) => {
    const permissionKey =
      `can${act.charAt(0).toUpperCase() + act.slice(1)}` as any;
    return hasPermission(menuId, permissionKey);
  });

  const hasAccess = requireAll
    ? actionChecks.every((check) => check)
    : actionChecks.some((check) => check);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGuard;
