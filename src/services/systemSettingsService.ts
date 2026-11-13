import apiClient from '../utils/apiClient';

export type SettingType = 'string' | 'int' | 'float' | 'bool' | 'json';

export interface SystemSetting {
  setting_id: number;
  setting_key: string;
  setting_value: string;
  setting_type: SettingType;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface SystemSettingInput {
  setting_key: string;
  setting_value: string;
  setting_type: SettingType;
  description: string;
  is_active: boolean;
}

/**
 * Endpoints expected from the backend (FastAPI router style, like
 * notifications.py):
 *   POST /system-settings/list    -> { success, data: SystemSetting[] }
 *   POST /system-settings/create  -> payload SystemSettingInput (+ created_by)
 *   POST /system-settings/update  -> payload { setting_id } & SystemSettingInput
 *   POST /system-settings/delete  -> payload { setting_id }
 *
 * While the backend router is not mounted, the service falls back to an
 * in-memory mock seeded with the sample rows from the settings table so the
 * UI stays testable. All mock writes are kept in memory only.
 */

const ENDPOINTS = {
  list: '/system-settings/list',
  create: '/system-settings/create',
  update: '/system-settings/update',
  delete: '/system-settings/delete',
};

const MOCK_SETTINGS: SystemSetting[] = [
  {
    setting_id: 2,
    setting_key: 'LIVE_UPDATE',
    setting_value: 'True',
    setting_type: 'bool',
    description: 'Control real-time data updates for all users system-wide',
    is_active: true,
    created_by: 'system',
    created_at: '2026-01-02T14:46:59.223462',
    updated_by: null,
    updated_at: null,
  },
  {
    setting_id: 1,
    setting_key: 'LDAP_LOGIN',
    setting_value: 'true',
    setting_type: 'bool',
    description:
      'Mandate user login via LDAP, this also enable get user-ID from local service',
    is_active: true,
    created_by: 'system',
    created_at: '2026-01-02T10:59:24.713803',
    updated_by: null,
    updated_at: null,
  },
];

let mockStore: SystemSetting[] | null = null;
let mockNextId = 100;

function getMockStore(): SystemSetting[] {
  if (!mockStore) {
    mockStore = MOCK_SETTINGS.map((s) => ({ ...s }));
  }
  return mockStore;
}

export function isMockMode(): boolean {
  return mockStore !== null;
}

function normalizeBool(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function normalizeRow(row: any): SystemSetting {
  return {
    setting_id: Number(row.setting_id),
    setting_key: String(row.setting_key ?? ''),
    setting_value: String(row.setting_value ?? ''),
    setting_type: (row.setting_type ?? 'string') as SettingType,
    description: row.description ?? null,
    is_active:
      typeof row.is_active === 'string'
        ? normalizeBool(row.is_active)
        : Boolean(row.is_active),
    created_by: row.created_by ?? null,
    created_at: row.created_at ?? null,
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/** Parse a stored setting_value string into a typed value for display. */
export function parseSettingValue(
  setting: Pick<SystemSetting, 'setting_value' | 'setting_type'>
): unknown {
  const raw = setting.setting_value;
  switch (setting.setting_type) {
    case 'bool':
      return normalizeBool(raw);
    case 'int': {
      const n = parseInt(raw, 10);
      return Number.isNaN(n) ? raw : n;
    }
    case 'float': {
      const n = parseFloat(raw);
      return Number.isNaN(n) ? raw : n;
    }
    case 'json':
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    default:
      return raw;
  }
}

/** Validate a draft before save. Returns an error message or null. */
export function validateSettingInput(input: SystemSettingInput): string | null {
  if (!/^[A-Z][A-Z0-9_]*$/.test(input.setting_key)) {
    return 'Key must be UPPER_SNAKE_CASE (letters, digits, underscores; starts with a letter).';
  }
  if (input.setting_value.trim() === '') {
    return 'Value is required.';
  }
  if (
    input.setting_type === 'int' &&
    !/^-?\d+$/.test(input.setting_value.trim())
  ) {
    return 'Value must be a whole number.';
  }
  if (
    input.setting_type === 'float' &&
    !/^-?\d+(\.\d+)?$/.test(input.setting_value.trim())
  ) {
    return 'Value must be a number.';
  }
  if (
    input.setting_type === 'bool' &&
    !['true', 'false'].includes(input.setting_value.trim().toLowerCase())
  ) {
    return 'Bool value must be true or false.';
  }
  if (input.setting_type === 'json') {
    try {
      JSON.parse(input.setting_value);
    } catch {
      return 'Value must be valid JSON.';
    }
  }
  return null;
}

function storeToMock(
  input: SystemSettingInput,
  existing?: SystemSetting
): SystemSetting {
  const now = new Date().toISOString();
  if (existing) {
    return {
      ...existing,
      setting_key: input.setting_key,
      setting_value:
        input.setting_type === 'bool'
          ? input.setting_value.trim().toLowerCase()
          : input.setting_value,
      setting_type: input.setting_type,
      description: input.description || null,
      is_active: input.is_active,
      updated_by: 'admin (mock)',
      updated_at: now,
    };
  }
  return {
    setting_id: ++mockNextId,
    setting_key: input.setting_key,
    setting_value:
      input.setting_type === 'bool'
        ? input.setting_value.trim().toLowerCase()
        : input.setting_value,
    setting_type: input.setting_type,
    description: input.description || null,
    is_active: input.is_active,
    created_by: 'admin (mock)',
    created_at: now,
    updated_by: null,
    updated_at: null,
  };
}

export const systemSettingsService = {
  async list(): Promise<{
    success: boolean;
    data?: SystemSetting[];
    error?: string;
    mock?: boolean;
  }> {
    try {
      const response = await apiClient.post<any>(ENDPOINTS.list, {});
      if (response.success && response.data) {
        const rows = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.data)
            ? response.data.data
            : [];
        return { success: true, data: rows.map(normalizeRow) };
      }
      throw new Error(response.error || 'Failed to load system settings');
    } catch (err) {
      // Mock fallback so the panel remains usable while the backend
      // router is not yet mounted.
      mockStore = getMockStore();
      return {
        success: true,
        data: getMockStore().map((s) => ({ ...s })),
        mock: true,
      };
    }
  },

  async create(
    input: SystemSettingInput,
    createdBy: string
  ): Promise<{
    success: boolean;
    data?: SystemSetting;
    error?: string;
    mock?: boolean;
  }> {
    const validationError = validateSettingInput(input);
    if (validationError) return { success: false, error: validationError };

    try {
      const response = await apiClient.post<any>(ENDPOINTS.create, {
        ...input,
        created_by: createdBy,
      });
      if (response.success) {
        return {
          success: true,
          data: response.data ? normalizeRow(response.data) : undefined,
        };
      }
      throw new Error(response.error || 'Failed to create setting');
    } catch (err) {
      const keyExists = getMockStore().some(
        (s) => s.setting_key === input.setting_key
      );
      if (keyExists) {
        return {
          success: false,
          error: `A setting with key "${input.setting_key}" already exists.`,
        };
      }
      const created = storeToMock(input);
      getMockStore().push(created);
      return { success: true, data: created, mock: true };
    }
  },

  async update(
    setting: SystemSetting,
    input: SystemSettingInput,
    updatedBy: string
  ): Promise<{
    success: boolean;
    data?: SystemSetting;
    error?: string;
    mock?: boolean;
  }> {
    const validationError = validateSettingInput(input);
    if (validationError) return { success: false, error: validationError };

    try {
      const response = await apiClient.post<any>(ENDPOINTS.update, {
        setting_id: setting.setting_id,
        ...input,
        updated_by: updatedBy,
      });
      if (response.success) {
        return {
          success: true,
          data: response.data ? normalizeRow(response.data) : undefined,
        };
      }
      throw new Error(response.error || 'Failed to update setting');
    } catch (err) {
      const store = getMockStore();
      const idx = store.findIndex((s) => s.setting_id === setting.setting_id);
      if (idx === -1) {
        return { success: false, error: 'Setting not found.' };
      }
      const keyTaken = store.some(
        (s) =>
          s.setting_key === input.setting_key &&
          s.setting_id !== setting.setting_id
      );
      if (keyTaken) {
        return {
          success: false,
          error: `A setting with key "${input.setting_key}" already exists.`,
        };
      }
      const updated = storeToMock(input, store[idx]);
      store[idx] = updated;
      return { success: true, data: updated, mock: true };
    }
  },

  async delete(
    setting: SystemSetting
  ): Promise<{ success: boolean; error?: string; mock?: boolean }> {
    try {
      const response = await apiClient.post<any>(ENDPOINTS.delete, {
        setting_id: setting.setting_id,
      });
      if (response.success) {
        return { success: true };
      }
      throw new Error(response.error || 'Failed to delete setting');
    } catch (err) {
      const store = getMockStore();
      const idx = store.findIndex((s) => s.setting_id === setting.setting_id);
      if (idx === -1) {
        return { success: false, error: 'Setting not found.' };
      }
      store.splice(idx, 1);
      return { success: true, mock: true };
    }
  },

  async setActive(
    setting: SystemSetting,
    isActive: boolean,
    updatedBy: string
  ): Promise<{
    success: boolean;
    data?: SystemSetting;
    error?: string;
    mock?: boolean;
  }> {
    return this.update(
      setting,
      {
        setting_key: setting.setting_key,
        setting_value: setting.setting_value,
        setting_type: setting.setting_type,
        description: setting.description ?? '',
        is_active: isActive,
      },
      updatedBy
    );
  },
};
