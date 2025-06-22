import { useState, useEffect, useCallback } from 'react';
import apiClient from '../utils/apiClient';
import config from '../config/app-config.json';

interface MenuIdMapping {
  [menuKey: string]: number;
}

export const useMenuIds = () => {
  const [menuIds, setMenuIds] = useState<MenuIdMapping>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMenuIds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get(`${config.api.baseUrl}/api/menu_key_list`);
      console.table(response);
      if (response.success && response.data) {
        setMenuIds(response.data.data);  // Direct assignment as per your proposal
      } else {
        throw new Error(response.error || 'Failed to load menu IDs');
      }
    } catch (err) {
      setError('Failed to load menu IDs');
      console.error('Error loading menu IDs:', err);
      
      // Fallback to empty object for development
      setMenuIds({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenuIds();
  }, [loadMenuIds]);

  const getMenuId = useCallback(
    (menuKey: string): number => menuIds[menuKey] || 0,
    [menuIds]
  );

  return {
    menuIds,
    loading,
    error,
    getMenuId,
    refreshMenuIds: loadMenuIds,
  };
};