export interface User {
  id: string;
  username: string;
  email_id: string;
  full_name: string;
  role_id: number;
  role_name: string;
  is_active: boolean;
  failed_login_count: number;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  mfa_enabled: boolean;
  account_locked: boolean;
  password_expires_at: string | null;
}

export interface Role {
  id: number;
  role_name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAction {
  action: 'activate' | 'deactivate' | 'unlock' | 'reset_password' | 'reset_failed_login' | 'change_role' | 'enable_mfa' | 'disable_mfa';
  user_id: string;
  new_role_id?: number;
  reason?: string;
}

export interface RoleMenuPermission {
  id: number;
  role_id: number;
  menu_id: number;
  menu_name: string;
  menu_url: string;
  menu_icon: string;
  parent_id: number | null;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_create: boolean;
  can_export: boolean;
  can_import: boolean;
  level: number;
}

interface AuditLog {
  id: number;
  user_id: string;
  admin_user_id: string;
  admin_username: string;
  action: string;
  target_type: 'user' | 'role' | 'menu_permission';
  target_id: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  ip_address: string;
  user_agent: string;
  timestamp: string;
  reason?: string;
}

export interface UserSearchFilters {
  search: string;
  role_id: number | null;
  is_active: boolean | null;
  account_locked: boolean | null;
  mfa_enabled: boolean | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}