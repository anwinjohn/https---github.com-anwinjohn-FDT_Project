import { useState, useEffect, useCallback } from 'react';
import { appConfig as config } from '../config/runtime-config';
import apiClient from '../utils/apiClient';

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

  const fetchSettings = useCallback(async (settingKey?: string) => {
    try {
      setLoading(true);
      setError(null);
      const request = { setting_key: settingKey };
      const sysSettings = await apiClient.post<any>("/getSystemSettings", request);
      if (!sysSettings.success || !sysSettings.data) {
        throw new Error(sysSettings.message || 'Failed to fetch settings');
      }
      const settingsMap = new Map<string, any>();
      const responseData = sysSettings.data;

      if (settingKey) {
        const key = responseData.request_id || settingKey;
        const value = responseData.value;
        settingsMap.set(key, value);
      } else {
        Object.entries(responseData).forEach(([key, value]) => {
          try {
            if (typeof value === 'object' && value !== null && 'value' in value) {
              settingsMap.set(key, (value as any).value);
            } else {
              settingsMap.set(key, JSON.parse(value as string));
            }
          } catch {
            settingsMap.set(key, value);
          }
        });
      }
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
