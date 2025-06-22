import { useState, useEffect, useCallback } from 'react';
import config from '../config/app-config.json';

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string;
  created_at: string;
  updated_at: string;
}

export const useSystemSettings = () => {
  const [settings, setSettings] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  });

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${config.api.baseUrl}/api/admin/system-settings`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`);
      }
      
      const settingsData: SystemSetting[] = await response.json();
      const settingsMap = new Map();
      
      settingsData.forEach(setting => {
        // Parse JSON values
        try {
          settingsMap.set(setting.setting_key, JSON.parse(setting.setting_value));
        } catch {
          settingsMap.set(setting.setting_key, setting.setting_value);
        }
      });
      
      setSettings(settingsMap);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch settings';
      setError(errorMessage);
      console.error('Error fetching system settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSetting = useCallback(async (key: string, value: any) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${config.api.baseUrl}/api/admin/system-settings/${key}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          setting_value: typeof value === 'string' ? value : JSON.stringify(value)
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update setting: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Update local state
        setSettings(prev => new Map(prev.set(key, value)));
        return true;
      } else {
        throw new Error(result.message || 'Failed to update setting');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update setting';
      setError(errorMessage);
      console.error('Error updating system setting:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSetting = useCallback((key: string, defaultValue: any = null) => {
    return settings.get(key) ?? defaultValue;
  }, [settings]);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSetting,
    getSetting
  };
};