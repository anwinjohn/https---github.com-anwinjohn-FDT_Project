import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../utils/apiClient';
import { appConfig as config } from '../config/runtime-config';

export interface SecureMenuItem {
  id: number;
  parent_id: number | null;
  menu_name: string;
  menu_url: string;
  menu_icon: string;
  menu_order: number;
  is_active: boolean;
  level: number;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_create: boolean;
  can_export: boolean;
  can_import: boolean;
  children?: SecureMenuItem[];
}

export const useSecureMenu = () => {
  const [menuItems, setMenuItems] = useState<SecureMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const buildMenuTree = (items: SecureMenuItem[]): SecureMenuItem[] => {
    const menuMap = new Map<number, SecureMenuItem>();
    const rootMenus: SecureMenuItem[] = [];

    // Create map of all menu items
    items.forEach(item => {
      menuMap.set(item.id, { ...item, children: [] });
    });

    // Build tree structure
    items.forEach(item => {
      const menuItem = menuMap.get(item.id)!;
      
      if (item.parent_id === null) {
        rootMenus.push(menuItem);
      } else {
        const parent = menuMap.get(item.parent_id);
        if (parent) {
          parent.children!.push(menuItem);
        }
      }
    });

    // Sort menus by order
    const sortMenus = (menus: SecureMenuItem[]) => {
      menus.sort((a, b) => a.menu_order - b.menu_order);
      menus.forEach(menu => {
        if (menu.children && menu.children.length > 0) {
          sortMenus(menu.children);
        }
      });
    };

    sortMenus(rootMenus);
    return rootMenus;
  };

  const loadSecureMenu = useCallback(async () => {
    if (!user?.role_id) {
      setMenuItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get(`${config.api.baseUrl}/api/menus/secure/${user.role_id}`);
      
      if (response.success && response.data) {
        // Filter out items where user doesn't have view access
        const accessibleItems = response.data.filter((item: SecureMenuItem) => 
          item.can_view || user.role_id === 0 // Super admin can see all
        );
        
        const menuTree = buildMenuTree(accessibleItems);
        setMenuItems(menuTree);
      } else {
        throw new Error(response.error || 'Failed to load menu');
      }
    } catch (err) {
      setError('Failed to load menu items');
      console.error('Error loading secure menu:', err);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.role_id]);

  useEffect(() => {
    loadSecureMenu();
  }, [loadSecureMenu]);

  const hasMenuAccess = useCallback((menuId: number, action: 'view' | 'edit' | 'delete' | 'create' | 'export' | 'import' = 'view'): boolean => {
    const findMenuItem = (items: SecureMenuItem[], id: number): SecureMenuItem | null => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findMenuItem(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const menuItem = findMenuItem(menuItems, menuId);
    if (!menuItem) return false;

    switch (action) {
      case 'view': return menuItem.can_view;
      case 'edit': return menuItem.can_edit;
      case 'delete': return menuItem.can_delete;
      case 'create': return menuItem.can_create;
      case 'export': return menuItem.can_export;
      case 'import': return menuItem.can_import;
      default: return false;
    }
  }, [menuItems]);

  return {
    menuItems,
    loading,
    error,
    hasMenuAccess,
    refreshMenu: loadSecureMenu
  };
};
