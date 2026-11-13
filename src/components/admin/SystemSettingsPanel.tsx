import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  X,
  ToggleLeft,
  ToggleRight,
  Database,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../notifications';
import { useMenuIds } from '../../hooks/useMenuIds';
import PermissionGuard from '../PermissionGuard';
import { confirmDialog } from '../notifications/confirmService';
import {
  systemSettingsService,
  parseSettingValue,
  validateSettingInput,
  type SystemSetting,
  type SystemSettingInput,
  type SettingType,
} from '../../services/systemSettingsService';
import { useAuth } from '../../context/AuthContext';

const SETTING_TYPES: SettingType[] = ['bool', 'string', 'int', 'float', 'json'];

const TYPE_BADGE: Record<SettingType, string> = {
  bool: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  string: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  int: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  float: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  json: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
};

const EMPTY_INPUT: SystemSettingInput = {
  setting_key: '',
  setting_value: '',
  setting_type: 'string',
  description: '',
  is_active: true,
};

const SystemSettingsPanel: React.FC = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const { getMenuId } = useMenuIds();
  const settingsMenuId = getMenuId('system_settings');

  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | SettingType>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Editor drawer state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SystemSetting | null>(null);
  const [draft, setDraft] = useState<SystemSettingInput>(EMPTY_INPUT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadSettings = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const result = await systemSettingsService.list();
        if (result.success && result.data) {
          setSettings(result.data);
          setIsMock(Boolean(result.mock));
        } else {
          addNotification(
            result.error || 'Failed to load system settings.',
            'error',
            5000,
            'Load Failed'
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [addNotification]
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return settings.filter((s) => {
      const matchesQuery =
        !q ||
        s.setting_key.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q) ||
        s.setting_value.toLowerCase().includes(q);
      const matchesType = typeFilter === 'all' || s.setting_type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [settings, search, typeFilter]);

  const activeCount = settings.filter((s) => s.is_active).length;

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_INPUT);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (setting: SystemSetting) => {
    setEditing(setting);
    setDraft({
      setting_key: setting.setting_key,
      setting_value: setting.setting_value,
      setting_type: setting.setting_type,
      description: setting.description ?? '',
      is_active: setting.is_active,
    });
    setFormError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
    setDraft(EMPTY_INPUT);
    setFormError(null);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!draft.setting_value.trim()) {
      setFormError('Value is required.');
      return;
    }
    setSaving(true);
    const actor = user?.username || user?.full_name || 'admin';
    try {
      const result = editing
        ? await systemSettingsService.update(editing, draft, actor)
        : await systemSettingsService.create(draft, actor);
      if (result.success) {
        addNotification(
          editing
            ? `Setting "${draft.setting_key}" updated.`
            : `Setting "${draft.setting_key}" created.`,
          'success',
          4000,
          isMock || result.mock ? 'Saved (test mode)' : 'Saved'
        );
        closeEditor();
        await loadSettings(false);
      } else {
        setFormError(result.error || 'Failed to save setting.');
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to save setting.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (setting: SystemSetting) => {
    const res = await confirmDialog({
      title: 'Delete setting?',
      message: `"${setting.setting_key}" will be permanently removed. Applications relying on it may stop working.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (res.action !== 'confirmed') return;

    const result = await systemSettingsService.delete(setting);
    if (result.success) {
      addNotification(
        `Setting "${setting.setting_key}" deleted.`,
        'success',
        4000,
        'Deleted'
      );
      await loadSettings(false);
    } else {
      addNotification(
        result.error || 'Failed to delete setting.',
        'error',
        5000,
        'Delete Failed'
      );
    }
  };

  const handleToggleActive = async (setting: SystemSetting) => {
    const next = !setting.is_active;
    const res = await confirmDialog({
      title: next ? 'Activate setting?' : 'Deactivate setting?',
      message: next
        ? `"${setting.setting_key}" will be enabled system-wide.`
        : `"${setting.setting_key}" will be disabled system-wide. Consumers reading it will fall back to defaults.`,
      confirmLabel: next ? 'Activate' : 'Deactivate',
      icon: next ? 'info' : 'warning',
    });
    if (res.action !== 'confirmed') return;

    const actor = user?.username || user?.full_name || 'admin';
    const result = await systemSettingsService.setActive(setting, next, actor);
    if (result.success) {
      addNotification(
        `Setting "${setting.setting_key}" is now ${next ? 'active' : 'inactive'}.`,
        'success',
        4000,
        'Updated'
      );
      await loadSettings(false);
    } else {
      addNotification(
        result.error || 'Failed to update setting.',
        'error',
        5000,
        'Update Failed'
      );
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSettings(false);
    setRefreshing(false);
  };

  const renderValue = (setting: SystemSetting) => {
    if (setting.setting_type === 'bool') {
      return parseSettingValue(setting) ? 'True' : 'False';
    }
    if (setting.setting_type === 'json') {
      const raw = setting.setting_value;
      return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw;
    }
    return setting.setting_value;
  };

  const inputClass = dark
    ? 'w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500'
    : 'w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

  const labelClass = dark
    ? 'text-xs font-medium text-white/70'
    : 'text-xs font-medium text-slate-600';

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div
        className={`rounded-xl border p-5 ${dark ? 'bg-white/5 border-white/15' : 'bg-white border-slate-200 shadow-sm'}`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl ${dark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-600'}`}
            >
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <h2
                className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-900'}`}
              >
                System Parameters
              </h2>
              <p
                className={`text-sm mt-0.5 ${dark ? 'text-white/60' : 'text-slate-500'}`}
              >
                Create, edit and manage global configuration consumed by the
                platform.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${dark ? 'bg-white/10 text-white/80' : 'bg-slate-100 text-slate-700'}`}
                >
                  <Database className="w-3 h-3" />
                  {settings.length} total · {activeCount} active
                </span>
                {isMock && (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    <FlaskConical className="w-3 h-3" />
                    Test mode — backend API unreachable, changes are in-memory
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PermissionGuard menuId={settingsMenuId} action="create">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={openCreate}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all ${
                  dark
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/25'
                }`}
              >
                <Plus className="w-4 h-4" />
                New Setting
              </motion.button>
            </PermissionGuard>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2.5 rounded-xl border transition-all ${
                dark
                  ? 'bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-50'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50'
              }`}
              title="Refresh settings"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Filters + table */}
      <div
        className={`rounded-xl border overflow-hidden ${dark ? 'bg-white/5 border-white/15' : 'bg-white border-slate-200 shadow-sm'}`}
      >
        <div
          className={`flex flex-col gap-3 p-4 border-b sm:flex-row sm:items-center ${dark ? 'border-white/10' : 'border-slate-100'}`}
        >
          <div className="relative flex-1">
            <Search
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${dark ? 'text-white/40' : 'text-slate-400'}`}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by key, description or value…"
              className={`${inputClass} pl-9`}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', ...SETTING_TYPES] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  typeFilter === t
                    ? dark
                      ? 'bg-blue-500/25 text-blue-200'
                      : 'bg-blue-100 text-blue-700'
                    : dark
                      ? 'text-white/50 hover:text-white hover:bg-white/10'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {t === 'all' ? 'All types' : t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2
              className={`w-7 h-7 animate-spin ${dark ? 'text-white' : 'text-slate-900'}`}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Settings
              className={`w-10 h-10 mx-auto mb-3 ${dark ? 'text-white/30' : 'text-slate-300'}`}
            />
            <p
              className={`font-medium ${dark ? 'text-white/70' : 'text-slate-600'}`}
            >
              {settings.length === 0
                ? 'No settings configured yet'
                : 'No settings match your filters'}
            </p>
            <p
              className={`text-sm mt-1 ${dark ? 'text-white/40' : 'text-slate-400'}`}
            >
              {settings.length === 0
                ? 'Create the first parameter to get started.'
                : 'Try a different search or type filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={`text-left ${dark ? 'bg-white/[0.03] text-white/50' : 'bg-slate-50 text-slate-500'}`}
                >
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Key
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider hidden md:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((setting) => (
                  <tr
                    key={setting.setting_id}
                    className={`border-t transition-colors ${dark ? 'border-white/10 hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50/60'}`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}
                      >
                        {setting.setting_key}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono ${dark ? 'text-blue-200' : 'text-blue-700'}`}
                      >
                        {renderValue(setting)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[setting.setting_type]}`}
                      >
                        {setting.setting_type}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 hidden md:table-cell max-w-[280px] truncate ${dark ? 'text-white/60' : 'text-slate-500'}`}
                    >
                      {setting.description ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <PermissionGuard menuId={settingsMenuId} action="edit">
                        <button
                          onClick={() => handleToggleActive(setting)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                            setting.is_active
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20'
                          }`}
                          title={
                            setting.is_active
                              ? 'Click to deactivate'
                              : 'Click to activate'
                          }
                        >
                          {setting.is_active ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                          {setting.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </PermissionGuard>
                      {!setting.is_active && (
                        <PermissionGuard
                          menuId={settingsMenuId}
                          action="edit"
                          fallback={
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                setting.is_active
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                  : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/60'
                              }`}
                            >
                              Inactive
                            </span>
                          }
                        >
                          <span />
                        </PermissionGuard>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <PermissionGuard menuId={settingsMenuId} action="edit">
                          <button
                            onClick={() => openEdit(setting)}
                            className={`p-2 rounded-lg transition-colors ${dark ? 'text-blue-300 hover:bg-white/10' : 'text-blue-600 hover:bg-blue-50'}`}
                            title="Edit setting"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </PermissionGuard>
                        <PermissionGuard
                          menuId={settingsMenuId}
                          action="delete"
                        >
                          <button
                            onClick={() => handleDelete(setting)}
                            className={`p-2 rounded-lg transition-colors ${dark ? 'text-red-300 hover:bg-white/10' : 'text-red-600 hover:bg-red-50'}`}
                            title="Delete setting"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit drawer */}
      <AnimatePresence>
        {editorOpen && (
          <motion.div
            key="settings-editor-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm flex justify-end"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeEditor();
            }}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className={`w-full max-w-md h-full overflow-y-auto ${dark ? 'bg-slate-900' : 'bg-white'}`}
            >
              <div
                className={`sticky top-0 flex items-center justify-between px-5 py-4 border-b backdrop-blur-xl z-10 ${dark ? 'bg-slate-900/90 border-white/10' : 'bg-white/90 border-slate-200'}`}
              >
                <div>
                  <h3
                    className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-900'}`}
                  >
                    {editing ? 'Edit Setting' : 'New Setting'}
                  </h3>
                  <p
                    className={`text-xs mt-0.5 ${dark ? 'text-white/50' : 'text-slate-500'}`}
                  >
                    {editing
                      ? `ID ${editing.setting_id}`
                      : 'Define a global parameter'}
                  </p>
                </div>
                <button
                  onClick={closeEditor}
                  className={`p-2 rounded-lg transition-colors ${dark ? 'text-white/60 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
                  aria-label="Close editor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {formError && (
                  <div
                    className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${dark ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-red-50 border-red-200 text-red-700'}`}
                  >
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className={labelClass}>Key</label>
                  <input
                    value={draft.setting_key}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        setting_key: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9_]/g, '_'),
                      })
                    }
                    placeholder="e.g. SESSION_TIMEOUT_MIN"
                    disabled={Boolean(editing)}
                    className={`${inputClass} font-mono ${editing ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  {editing && (
                    <p
                      className={`text-xs ${dark ? 'text-white/40' : 'text-slate-400'}`}
                    >
                      Keys are immutable — consumers resolve settings by key.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SETTING_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setDraft({ ...draft, setting_type: t })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          draft.setting_type === t
                            ? dark
                              ? 'bg-blue-500/25 text-blue-200 ring-1 ring-blue-400/40'
                              : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                            : dark
                              ? 'text-white/50 hover:text-white hover:bg-white/10'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Value</label>
                  {draft.setting_type === 'bool' ? (
                    <div className="flex gap-2">
                      {['true', 'false'].map((v) => (
                        <button
                          key={v}
                          onClick={() =>
                            setDraft({ ...draft, setting_value: v })
                          }
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                            draft.setting_value.trim().toLowerCase() === v
                              ? v === 'true'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-500 text-white'
                              : dark
                                ? 'bg-white/10 text-white/60 hover:bg-white/20'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  ) : draft.setting_type === 'json' ? (
                    <textarea
                      value={draft.setting_value}
                      onChange={(e) =>
                        setDraft({ ...draft, setting_value: e.target.value })
                      }
                      rows={5}
                      placeholder='{"threshold": 0.85}'
                      className={`${inputClass} font-mono resize-y`}
                    />
                  ) : (
                    <input
                      value={draft.setting_value}
                      onChange={(e) =>
                        setDraft({ ...draft, setting_value: e.target.value })
                      }
                      placeholder={
                        draft.setting_type === 'int'
                          ? 'e.g. 30'
                          : draft.setting_type === 'float'
                            ? 'e.g. 0.75'
                            : 'e.g. production'
                      }
                      className={`${inputClass} font-mono`}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    rows={3}
                    placeholder="What does this parameter control?"
                    className={`${inputClass} resize-y`}
                  />
                </div>

                <button
                  onClick={() =>
                    setDraft({ ...draft, is_active: !draft.is_active })
                  }
                  className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${dark ? 'bg-white/5 border-white/15 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                >
                  <span
                    className={`text-sm font-medium ${dark ? 'text-white/80' : 'text-slate-700'}`}
                  >
                    Active system-wide
                  </span>
                  {draft.is_active ? (
                    <ToggleRight className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <ToggleLeft
                      className={`w-5 h-5 ${dark ? 'text-white/40' : 'text-slate-400'}`}
                    />
                  )}
                </button>

                <div
                  className={`flex items-center gap-1.5 text-xs pt-1 ${dark ? 'text-white/40' : 'text-slate-400'}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Values are validated against the selected type before saving.
                </div>
              </div>

              <div
                className={`sticky bottom-0 flex justify-end gap-2 px-5 py-4 border-t backdrop-blur-xl ${dark ? 'bg-slate-900/90 border-white/10' : 'bg-white/90 border-slate-200'}`}
              >
                <button
                  onClick={closeEditor}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 disabled:opacity-60 transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editing ? 'Save Changes' : 'Create Setting'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SystemSettingsPanel;
