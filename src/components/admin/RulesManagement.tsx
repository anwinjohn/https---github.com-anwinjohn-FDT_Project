import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldOff,
  Search,
  ChevronDown,
  Pencil,
  Save,
  X,
  Check,
  RotateCcw,
  AlertCircle,
  ListChecks,
  Inbox,
  Loader2,
  Flag,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import apiClient from '../../utils/apiClient';

/* ------------------------------------------------------------------ */
/*  Types — merge these into ../types/types.ts                         */
/* ------------------------------------------------------------------ */

export interface RuleConfig {
  config_key: string;
  config_value: string;
  /** Kept for backwards compatibility with the API payload. Not editable in the UI. */
  is_active: boolean;
  rule_id: string;
}

/** Priorities come from the API (GET /rule/priorities), so this is a plain string. */
export type RulePriority = string;

export interface AlertRule {
  rule_id: string;
  scenario: string;
  scenario_logic: string;
  rule_priority: RulePriority;
  active_status: boolean;
  configs: RuleConfig[];
}

interface RulesManagementPageProps {
  data: AlertRule[];
  isLoading: boolean;
  /** Optional: notified after any rule has been successfully changed on the server. */
  onRuleUpdated?: (rule: AlertRule) => void;
}

type StatusFilter = 'all' | 'active' | 'inactive';
type ToastState = { message: string; type: 'success' | 'error' } | null;

/* ------------------------------------------------------------------ */
/*  API layer                                                          */
/*  Every request carries the selected rule_id + only what changed.    */
/* ------------------------------------------------------------------ */

const FALLBACK_PRIORITIES: RulePriority[] = ['High', 'Medium', 'Low'];

const ruleApi = {
  /** GET /rule/priorities -> ["High","Medium","Low"] or [{ rule_priority: "High" }, ...] */
  async getPriorities(): Promise<RulePriority[]> {
    const res = await apiClient.get('/rule/priorities');
    const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    const list = raw
      .map((p: any) =>
        typeof p === 'string'
          ? p
          : (p?.rule_priority ?? p?.priority ?? p?.value ?? p?.name)
      )
      .filter(Boolean) as RulePriority[];
    return list.length ? list : FALLBACK_PRIORITIES;
  },

  /** POST /rule/toggle-status { rule_id, active_status } */
  async toggleStatus(ruleId: string, activeStatus: boolean) {
    const res = await apiClient.post('/rule/toggle-status', {
      rule_id: ruleId,
      active_status: activeStatus,
    });
    return res.data;
  },

  /** POST /rule/update-priority { rule_id, rule_priority } */
  async updatePriority(ruleId: string, rulePriority: RulePriority) {
    const res = await apiClient.post('/rule/update-priority', {
      rule_id: ruleId,
      rule_priority: rulePriority,
    });
    return res.data;
  },

  /** POST /rule/update-configs { rule_id, configs: [{ config_key, config_value }] } (changed keys only) */
  async updateConfigs(
    ruleId: string,
    configs: Pick<RuleConfig, 'config_key' | 'config_value'>[]
  ) {
    const res = await apiClient.post('/rule/update-configs', {
      rule_id: ruleId,
      configs,
    });
    return res.data;
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

// Renders **bold** markdown segments inside scenario_logic strings.
const renderLogic = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
};

const humanizeKey = (key: string) =>
  key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const getErrorMessage = (err: any, fallback: string) =>
  err?.response?.data?.message || err?.message || fallback;

type PriorityTone = { badge: string; dot: string; bar: string };

const getPriorityTone = (priority: string, dark: boolean): PriorityTone => {
  switch (priority?.toLowerCase()) {
    case 'high':
      return {
        badge: dark
          ? 'bg-red-500/15 text-red-300 border-red-500/30'
          : 'bg-red-50 text-red-700 border-red-200',
        dot: 'bg-red-400',
        bar: 'bg-red-500',
      };
    case 'medium':
      return {
        badge: dark
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-400',
        bar: 'bg-amber-500',
      };
    case 'low':
      return {
        badge: dark
          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
          : 'bg-sky-50 text-sky-700 border-sky-200',
        dot: 'bg-sky-400',
        bar: 'bg-sky-500',
      };
    default:
      return {
        badge: dark
          ? 'bg-white/10 text-white/70 border-white/20'
          : 'bg-gray-100 text-gray-700 border-gray-200',
        dot: 'bg-gray-400',
        bar: 'bg-gray-400',
      };
  }
};

/* ------------------------------------------------------------------ */
/*  Toggle switch (rule master only)                                   */
/* ------------------------------------------------------------------ */

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ checked, onChange, disabled, label }) => {
  const { theme } = useTheme();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-12 h-6 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        theme === 'dark'
          ? 'focus-visible:ring-offset-slate-900'
          : 'focus-visible:ring-offset-white'
      } ${
        checked
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
          : theme === 'dark'
            ? 'bg-white/15'
            : 'bg-gray-300'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
        style={{ left: checked ? 'calc(100% - 22px)' : '2px' }}
      />
    </button>
  );
};

/* ------------------------------------------------------------------ */
/*  Priority badge                                                     */
/* ------------------------------------------------------------------ */

const PriorityBadge: React.FC<{ priority: RulePriority }> = ({ priority }) => {
  const { theme } = useTheme();
  const tone = getPriorityTone(priority, theme === 'dark');
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${tone.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      {priority}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Toast                                                              */
/* ------------------------------------------------------------------ */

const Toast: React.FC<{
  message: string;
  type: 'success' | 'error';
  theme: string;
}> = ({ message, type, theme }) => (
  <motion.div
    initial={{ opacity: 0, y: 16, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 8, scale: 0.96 }}
    role="status"
    className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl ${
      theme === 'dark'
        ? 'bg-slate-900/90 border-white/10 text-white'
        : 'bg-white border-gray-200 text-gray-900'
    }`}
  >
    <div
      className={`p-1 rounded-full ${
        type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
      }`}
    >
      {type === 'success' ? (
        <Check className="w-4 h-4 text-emerald-400" />
      ) : (
        <AlertCircle className="w-4 h-4 text-red-400" />
      )}
    </div>
    <span className="text-sm font-medium">{message}</span>
  </motion.div>
);

/* ------------------------------------------------------------------ */
/*  Config field (value only — no status toggle)                       */
/* ------------------------------------------------------------------ */

const ConfigField: React.FC<{
  config: RuleConfig;
  original: string;
  editing: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}> = ({ config, original, editing, disabled, onChange }) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const changed = editing && config.config_value !== original;

  return (
    <div
      className={`px-4 py-3 rounded-lg border transition-colors ${
        changed
          ? dark
            ? 'bg-blue-500/10 border-blue-400/40'
            : 'bg-blue-50 border-blue-300'
          : dark
            ? 'bg-white/5 border-white/10'
            : 'bg-gray-50 border-gray-200'
      }`}
    >
      <label
        className={`block text-[11px] font-semibold uppercase tracking-wide ${
          dark ? 'text-white/50' : 'text-gray-500'
        }`}
      >
        {humanizeKey(config.config_key)}
      </label>
      {editing ? (
        <input
          value={config.config_value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1.5 w-full px-2.5 py-1.5 rounded-md text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 ${
            dark
              ? 'bg-slate-900/80 border-white/20 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        />
      ) : (
        <div
          className={`mt-1 text-sm font-semibold break-words ${
            dark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {config.config_value || '—'}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Rule card                                                          */
/* ------------------------------------------------------------------ */

interface SavePayload {
  priority?: RulePriority;
  configs?: Pick<RuleConfig, 'config_key' | 'config_value'>[];
}

const RuleCard: React.FC<{
  rule: AlertRule;
  priorities: RulePriority[];
  togglePending: boolean;
  onToggleStatus: () => void;
  onSave: (payload: SavePayload) => Promise<boolean>;
}> = ({ rule, priorities, togglePending, onToggleStatus, onSave }) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftConfigs, setDraftConfigs] = useState<RuleConfig[]>(rule.configs);
  const [draftPriority, setDraftPriority] = useState<RulePriority>(
    rule.rule_priority
  );

  // Re-sync drafts with the server state whenever we're not mid-edit.
  useEffect(() => {
    if (!editing) {
      setDraftConfigs(rule.configs);
      setDraftPriority(rule.rule_priority);
    }
  }, [rule.configs, rule.rule_priority, editing]);

  const hasConfigs = rule.configs.length > 0;
  const tone = getPriorityTone(rule.rule_priority, dark);

  // Make sure the current priority is always selectable, even if the API list lacks it.
  const priorityOptions = useMemo(
    () =>
      priorities.includes(rule.rule_priority)
        ? priorities
        : [rule.rule_priority, ...priorities],
    [priorities, rule.rule_priority]
  );

  const changedConfigs = useMemo(
    () =>
      draftConfigs
        .filter((d) => {
          const orig = rule.configs.find((c) => c.config_key === d.config_key);
          return orig && orig.config_value !== d.config_value;
        })
        .map(({ config_key, config_value }) => ({ config_key, config_value })),
    [draftConfigs, rule.configs]
  );
  const priorityChanged = draftPriority !== rule.rule_priority;
  const dirty = priorityChanged || changedConfigs.length > 0;

  const startEditing = () => {
    setDraftConfigs(rule.configs);
    setDraftPriority(rule.rule_priority);
    setEditing(true);
    setExpanded(true);
  };

  const cancelEditing = () => {
    setDraftConfigs(rule.configs);
    setDraftPriority(rule.rule_priority);
    setEditing(false);
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    const ok = await onSave({
      priority: priorityChanged ? draftPriority : undefined,
      configs: changedConfigs.length ? changedConfigs : undefined,
    });
    setSaving(false);
    if (ok) setEditing(false);
  };

  const btnBase =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const btnNeutral = dark
    ? 'bg-white/5 border-white/15 text-white hover:bg-white/10'
    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`relative rounded-xl border overflow-hidden transition-colors ${
        dark
          ? `bg-white/5 ${rule.active_status ? 'border-white/15' : 'border-white/5'}`
          : `bg-white ${rule.active_status ? 'border-gray-200' : 'border-gray-100'}`
      }`}
    >
      {/* Priority accent bar */}
      <span
        className={`absolute left-0 top-0 bottom-0 w-1 ${tone.bar} ${
          rule.active_status ? '' : 'opacity-40'
        }`}
      />

      <div className="p-5 pl-6">
        {/* Top: identity + master toggle */}
        <div className="flex items-start justify-between gap-4">
          <div
            className={`min-w-0 flex-1 ${rule.active_status ? '' : 'opacity-70'}`}
          >
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${
                  dark
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {rule.rule_id}
              </span>
              <PriorityBadge priority={rule.rule_priority} />
            </div>
            <h4
              className={`text-base font-bold ${dark ? 'text-white' : 'text-gray-900'}`}
            >
              {rule.scenario}
            </h4>
            <p
              className={`mt-1.5 text-sm leading-relaxed ${
                dark ? 'text-white/60' : 'text-gray-600'
              }`}
            >
              {renderLogic(rule.scenario_logic)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <ToggleSwitch
              checked={rule.active_status}
              onChange={onToggleStatus}
              disabled={togglePending}
              label={`Toggle ${rule.rule_id}`}
            />
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                rule.active_status
                  ? dark
                    ? 'text-emerald-300'
                    : 'text-emerald-700'
                  : dark
                    ? 'text-white/40'
                    : 'text-gray-400'
              }`}
            >
              {togglePending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : rule.active_status ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <ShieldOff className="w-3.5 h-3.5" />
              )}
              {rule.active_status ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Footer: expand + edit actions */}
        <div
          className={`mt-4 pt-4 border-t flex items-center justify-between ${
            dark ? 'border-white/10' : 'border-gray-100'
          }`}
        >
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
              dark
                ? 'text-blue-300 hover:text-blue-200'
                : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            {expanded ? 'Hide details' : 'Details'}
            {hasConfigs && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  dark
                    ? 'bg-white/10 text-white/70'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {rule.configs.length} config{rule.configs.length > 1 ? 's' : ''}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </button>

          {!editing ? (
            <button
              type="button"
              onClick={startEditing}
              className={`${btnBase} ${btnNeutral}`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className={`${btnBase} ${btnNeutral}`}
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className={`${btnBase} border-transparent text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-md`}
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          )}
        </div>

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-4">
                {/* Priority */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg border ${
                    dark
                      ? 'bg-white/5 border-white/10'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Flag
                      className={`w-4 h-4 ${dark ? 'text-white/50' : 'text-gray-500'}`}
                    />
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        dark ? 'text-white/50' : 'text-gray-500'
                      }`}
                    >
                      Rule Priority
                    </span>
                  </div>
                  {editing ? (
                    <select
                      value={draftPriority}
                      disabled={saving}
                      onChange={(e) => setDraftPriority(e.target.value)}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 ${
                        priorityChanged
                          ? dark
                            ? 'border-blue-400/60'
                            : 'border-blue-400'
                          : dark
                            ? 'border-white/20'
                            : 'border-gray-300'
                      } ${
                        dark
                          ? 'bg-slate-900/80 text-white'
                          : 'bg-white text-gray-900'
                      }`}
                    >
                      {priorityOptions.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <PriorityBadge priority={rule.rule_priority} />
                  )}
                </div>

                {/* Configs */}
                {hasConfigs ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {draftConfigs.map((cfg) => (
                      <ConfigField
                        key={cfg.config_key}
                        config={cfg}
                        original={
                          rule.configs.find(
                            (c) => c.config_key === cfg.config_key
                          )?.config_value ?? cfg.config_value
                        }
                        editing={editing}
                        disabled={saving}
                        onChange={(value) =>
                          setDraftConfigs((prev) =>
                            prev.map((c) =>
                              c.config_key === cfg.config_key
                                ? { ...c, config_value: value }
                                : c
                            )
                          )
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed text-sm ${
                      dark
                        ? 'border-white/10 text-white/40'
                        : 'border-gray-200 text-gray-400'
                    }`}
                  >
                    <Inbox className="w-4 h-4" />
                    No configurable parameters for this rule
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

const RulesManagement: React.FC<RulesManagementPageProps> = ({
  data,
  isLoading,
  onRuleUpdated,
}) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [rules, setRules] = useState<AlertRule[]>(data);
  const [priorities, setPriorities] =
    useState<RulePriority[]>(FALLBACK_PRIORITIES);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | RulePriority>(
    'all'
  );
  const [togglingIds, setTogglingIds] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => setRules(data), [data]);

  // Load the priority list from the API once.
  useEffect(() => {
    let cancelled = false;
    ruleApi
      .getPriorities()
      .then((list) => !cancelled && setPriorities(list))
      .catch(() => {
        if (!cancelled) {
          setPriorities(FALLBACK_PRIORITIES);
          setToast({
            message: 'Could not load priority list, using defaults',
            type: 'error',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const patchRule = useCallback(
    (ruleId: string, patch: (r: AlertRule) => AlertRule) => {
      let updated: AlertRule | undefined;
      setRules((prev) =>
        prev.map((r) => {
          if (r.rule_id !== ruleId) return r;
          updated = patch(r);
          return updated;
        })
      );
      return updated;
    },
    []
  );

  /* ---- Status toggle (rule master only), optimistic with rollback ---- */
  const handleToggleStatus = async (ruleId: string) => {
    const current = rules.find((r) => r.rule_id === ruleId);
    if (!current || togglingIds.includes(ruleId)) return;
    const next = !current.active_status;

    setTogglingIds((p) => [...p, ruleId]);
    patchRule(ruleId, (r) => ({ ...r, active_status: next }));

    try {
      await ruleApi.toggleStatus(ruleId, next);
      setToast({
        message: `${ruleId} ${next ? 'activated' : 'deactivated'}`,
        type: 'success',
      });
      onRuleUpdated?.({ ...current, active_status: next });
    } catch (err) {
      patchRule(ruleId, (r) => ({ ...r, active_status: !next }));
      setToast({
        message: getErrorMessage(err, `Failed to update ${ruleId} status`),
        type: 'error',
      });
    } finally {
      setTogglingIds((p) => p.filter((id) => id !== ruleId));
    }
  };

  /* ---- Save priority and/or config values ---- */
  const handleSave = async (
    ruleId: string,
    { priority, configs }: SavePayload
  ): Promise<boolean> => {
    const current = rules.find((r) => r.rule_id === ruleId);
    if (!current) return false;

    let nextRule = current;

    try {
      if (priority !== undefined) {
        await ruleApi.updatePriority(ruleId, priority);
        nextRule = { ...nextRule, rule_priority: priority };
        patchRule(ruleId, (r) => ({ ...r, rule_priority: priority }));
      }

      if (configs && configs.length) {
        await ruleApi.updateConfigs(ruleId, configs);
        const valueByKey = new Map(
          configs.map((c) => [c.config_key, c.config_value])
        );
        const mergeConfigs = (r: AlertRule): AlertRule => ({
          ...r,
          configs: r.configs.map((c) =>
            valueByKey.has(c.config_key)
              ? { ...c, config_value: valueByKey.get(c.config_key)! }
              : c
          ),
        });
        nextRule = mergeConfigs(nextRule);
        patchRule(ruleId, mergeConfigs);
      }

      setToast({ message: `${ruleId} updated`, type: 'success' });
      onRuleUpdated?.(nextRule);
      return true;
    } catch (err) {
      setToast({
        message: getErrorMessage(err, `Failed to update ${ruleId}`),
        type: 'error',
      });
      return false;
    }
  };

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((rule) => {
      const matchesSearch =
        q === '' ||
        rule.rule_id.toLowerCase().includes(q) ||
        rule.scenario.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && rule.active_status) ||
        (statusFilter === 'inactive' && !rule.active_status);
      const matchesPriority =
        priorityFilter === 'all' || rule.rule_priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [rules, search, statusFilter, priorityFilter]);

  const activeCount = rules.filter((r) => r.active_status).length;

  const inputBase = `w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
    dark
      ? 'bg-white/5 border-white/15 text-white placeholder-white/40'
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
  }`;

  const selectBase = `px-3 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
    dark
      ? 'bg-white/5 border-white/15 text-white'
      : 'bg-white border-gray-200 text-gray-900'
  }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${
        dark
          ? 'bg-white/10 border-white/20'
          : 'bg-white border-gray-200 shadow-card'
      } backdrop-blur-xl`}
    >
      {/* Header */}
      <div
        className={`flex justify-between items-center p-6 border-b ${
          dark ? 'border-white/20' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
            <ListChecks className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3
              className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}
            >
              Alert Rules
            </h3>
            <p
              className={`text-sm ${dark ? 'text-blue-200/70' : 'text-blue-600'}`}
            >
              Activate, prioritise and tune detection rules
            </p>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}
          >
            {activeCount}
            <span
              className={`text-base font-medium ${dark ? 'text-white/40' : 'text-gray-400'}`}
            >
              {' '}
              / {rules.length}
            </span>
          </div>
          <div
            className={`text-xs font-medium ${dark ? 'text-blue-300' : 'text-blue-600'}`}
          >
            Rules Active
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[350px] space-y-4">
            <div
              className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin ${
                dark ? 'border-blue-400/60' : 'border-blue-500/60'
              }`}
            />
            <div className="text-center">
              <div
                className={`font-medium ${dark ? 'text-white' : 'text-gray-900'}`}
              >
                Loading rules...
              </div>
              <div
                className={`text-sm mt-1 ${dark ? 'text-white/60' : 'text-gray-600'}`}
              >
                Fetching rule configuration
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                    dark ? 'text-white/40' : 'text-gray-400'
                  }`}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by rule ID or scenario..."
                  className={inputBase}
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className={selectBase}
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className={selectBase}
                  aria-label="Filter by priority"
                >
                  <option value="all">All priorities</option>
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className={`text-xs font-medium ${dark ? 'text-white/50' : 'text-gray-500'}`}
            >
              Showing {filteredRules.length} of {rules.length} rules
            </div>

            {/* Rule list */}
            {filteredRules.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {filteredRules.map((rule) => (
                    <RuleCard
                      key={rule.rule_id}
                      rule={rule}
                      priorities={priorities}
                      togglePending={togglingIds.includes(rule.rule_id)}
                      onToggleStatus={() => handleToggleStatus(rule.rule_id)}
                      onSave={(payload) => handleSave(rule.rule_id, payload)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div
                className={`flex flex-col items-center justify-center py-16 rounded-xl border border-dashed ${
                  dark
                    ? 'border-white/10 text-white/40'
                    : 'border-gray-200 text-gray-400'
                }`}
              >
                <RotateCcw className="w-8 h-8 mb-3" />
                <p className="text-sm font-medium">
                  No rules match your filters
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                    setPriorityFilter('all');
                  }}
                  className={`mt-3 text-xs font-semibold underline underline-offset-2 ${
                    dark ? 'text-blue-300' : 'text-blue-600'
                  }`}
                >
                  Clear filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <Toast message={toast.message} type={toast.type} theme={theme} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RulesManagement;
