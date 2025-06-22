export interface MenuItem {
  id: number;
  parent_id: number | null;
  menu_name: string;
  menu_url: string;
  menu_icon: string;
  menu_order: number;
  is_active: boolean;
  required_role_id: number;
  level?: number;
  can_view?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_create?: boolean;
  can_export?: boolean;
  can_import?: boolean;
  children?: MenuItem[];
}

export interface MenuPermission {
  id: number;
  menu_id: number;
  role_id: number;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_create?: boolean;
  can_export?: boolean;
  can_import?: boolean;
  created_at?: string;
}

export interface MenuWithPermissions extends MenuItem {
  permissions?: MenuPermission;
}

export type AccessLevel = 'view' | 'edit' | 'delete' | 'create' | 'export' | 'import';

export interface UserMenuAccess {
  menuId: number;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreate?: boolean;
  canExport?: boolean;
  canImport?: boolean;
}