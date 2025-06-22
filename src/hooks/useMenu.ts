import { useState, useEffect } from 'react';
import { MenuItem, MenuPermission, MenuWithPermissions, UserMenuAccess } from '../types/menu';
import { useAuth } from '../context/AuthContext';
import config from '../config/app-config.json';

export const useMenu = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [userPermissions, setUserPermissions] = useState<Map<number, UserMenuAccess>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchMenuItems = async () => {
      if (!user?.role_id) {
        setMenuItems([]);
        setUserPermissions(new Map());
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Call the Python API to get menu based on role_id
        const response = await fetch(`${config.api.baseUrl}/api/menus/${user.role_id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch menu: ${response.status} ${response.statusText}`);
        }

        const menuData: MenuItem[] = await response.json();
        
        // Build permissions map from the API response
        const permissionsMap = new Map<number, UserMenuAccess>();
        
        const extractPermissions = (items: MenuItem[]) => {
          items.forEach(item => {
            permissionsMap.set(item.id, {
              menuId: item.id,
              canView: item.can_view || false,
              canEdit: item.can_edit || false,
              canDelete: item.can_delete || false,
              canCreate: item.can_create || false,
              canExport: item.can_export || false,
              canImport: item.can_import || false
            });
            
            // Process children recursively
            if (item.children && item.children.length > 0) {
              extractPermissions(item.children);
            }
          });
        };

        extractPermissions(menuData);
        setUserPermissions(permissionsMap);
        setMenuItems(menuData);

      } catch (error) {
        console.error('Error fetching menu items:', error);
        setError(error instanceof Error ? error.message : 'Failed to load menu');
        setMenuItems([]);
        setUserPermissions(new Map());
      } finally {
        setLoading(false);
      }
    };

    fetchMenuItems();
  }, [user?.role_id]);

  const hasPermission = (menuId: number, action: 'view' | 'edit' | 'delete' | 'create' | 'export' | 'import'): boolean => {
    const permission = userPermissions.get(menuId);
    if (!permission) return false;
    
    switch (action) {
      case 'view':
        return permission.canView;
      case 'edit':
        return permission.canEdit;
      case 'delete':
        return permission.canDelete;
      case 'create':
        return permission.canCreate;
      case 'export':
        return permission.canExport;
      case 'import':
        return permission.canImport;
      default:
        return false;
    }
  };

  const getUserPermissions = (menuId: number): UserMenuAccess | null => {
    return userPermissions.get(menuId) || null;
  };

  return { 
    menuItems, 
    loading, 
    error,
    hasPermission, 
    getUserPermissions,
    userPermissions: Array.from(userPermissions.values())
  };
};