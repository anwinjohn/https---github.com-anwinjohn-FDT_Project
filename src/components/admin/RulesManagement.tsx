import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldOff,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Settings2,
  Pencil,
  Save,
  X,
  Check,
  RotateCcw,
  AlertTriangle,
  ListChecks,
  Power,
  Inbox,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/* ------------------------------------------------------------------ */
/*  Types — merge these into ../types/types.ts                         */
/* ------------------------------------------------------------------ */

export interface RuleConfig {
  config_key: string;
  config_value: string;
  is_active: boolean;
}

export type RulePriority = 'High' | 'Medium' | 'Low';

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
  /** Called when a rule is toggled on/off. Wire this to your PATCH /rules/:id endpoint. */
  onToggleRuleStatus?: (ruleId: string, nextStatus: boolean) => void;
  /** Called when a user saves edited configs for a rule. Wire this to your PUT /rules/:id/configs endpoint. */
  onSaveConfigs?: (ruleId: string, configs: RuleConfig[]) => void;
}

type StatusFilter = 'all' | 'active' | 'inactive';
type PriorityFilter = 'all' | RulePriority;

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
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

/* ------------------------------------------------------------------ */
/*  Toggle switch                                                      */
/* ------------------------------------------------------------------ */

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  label?: string;
  size?: 'sm' | 'md';
}> = ({ checked, onChange, label, size = 'md' }) => {
  const { theme } = useTheme();
  const w = size === 'md' ? 'w-12' : 'w-9';
  const h = size === 'md' ? 'h-6' : 'h-5';
  const knob = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative ${w} ${h} shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${
        theme === 'dark' ? 'focus-visible:ring-offset-slate-900' : 'focus-visible:ring-offset-white'
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
        className={`absolute top-0.5 ${knob} rounded-full bg-white shadow-md`}
        style={{ left: checked ? `calc(100% - ${size === 'md' ? '22px' : '18px'})` : '2px' }}
      />
    </button>
  );
};

/* ------------------------------------------------------------------ */
/*  Priority badge                                                     */
/* ------------------------------------------------------------------ */

const PriorityBadge: React.FC<{ priority: RulePriority }> = ({ priority }) => {
  const { theme } = useTheme();

  const styles: Record<RulePriority, string> = {
    High: theme === 'dark'
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : 'bg-red-50 text-red-700 border-red-200',
    Medium: theme === 'dark'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : 'bg-amber-50 text-amber-700 border-amber-200',
    Low: theme === 'dark'
      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
      : 'bg-sky-50 text-sky-700 border-sky-200',
  };

  const dot: Record<RulePriority, string> = {
    High: 'bg-red-400',
    Medium: 'bg-amber-400',
    Low: 'bg-sky-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${styles[priority]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot[priority]}`} />
      {priority}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Toast                                                               */
/* ------------------------------------------------------------------ */

const Toast: React.FC<{ message: string; theme: string }> = ({ message, theme }) => (
  <motion.div
    initial={{ opacity: 0, y: 16, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 8, scale: 0.96 }}
    className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl ${
      theme === 'dark'
        ? 'bg-slate-900/90 border-white/10 text-white'
        : 'bg-white border-gray-200 text-gray-900'
    }`}
  >
    <div className="p-1 rounded-full bg-emerald-500/20">
      <Check className="w-4 h-4 text-emerald-400" />
    </div>
    <span className="text-sm font-medium">{message}</span>
  </motion.div>
);

/* ------------------------------------------------------------------ */
/*  Config editor row                                                  */
/* ------------------------------------------------------------------ */

const ConfigRow: React.FC<{
  config: RuleConfig;
  editing: boolean;
  onChange: (next: RuleConfig) => void;
}> = ({ config, editing, onChange }) => {
  const { theme } = useTheme();

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
        theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium uppercase tracking-wide ${
          theme === 'dark' ? 'text-white/50' : 'text-gray-500'
        }`}>
          {humanizeKey(config.config_key)}
        </div>
        {editing ? (
          <input
            value={config.config_value}
            onChange={(e) => onChange({ ...config, config_value: e.target.value })}
            className={`mt-1 w-full max-w-[220px] px-2 py-1 rounded-md text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              theme === 'dark'
                ? 'bg-slate-900/80 border-white/20 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
        ) : (
          <div className={`mt-0.5 text-sm font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {config.config_value}
          </div>
        )}
      </div>
      <ToggleSwitch
        size="sm"
        checked={config.is_active}
        onChange={() => editing && onChange({ ...config, is_active: !config.is_active })}
        label={`Toggle ${config.config_key}`}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Rule card                                                          */
/* ------------------------------------------------------------------ */

const RuleCard: React.FC<{
  rule: AlertRule;
  onToggleStatus: () => void;
  onSaveConfigs: (configs: RuleConfig[]) => void;
}> = ({ rule, onToggleStatus, onSaveConfigs }) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RuleConfig[]>(rule.configs);

  useEffect(() => {
    setDraft(rule.configs);
  }, [rule.configs]);

  const hasConfigs = rule.configs.length > 0;

  const startEditing = () => {
    setDraft(rule.configs);
    setEditing(true);
    setExpanded(true);
  };

  const cancelEditing = () => {
    setDraft(rule.configs);
    setEditing(false);
  };

  const save = () => {
    onSaveConfigs(draft);
    setEditing(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border overflow-hidden transition-colors ${
        theme === 'dark'
          ? `bg-white/5 ${rule.active_status ? 'border-white/15' : 'border-white/5'}`
          : `bg-white ${rule.active_status ? 'border-gray-200' : 'border-gray-100'}`
      } ${!rule.active_status ? 'opacity-70' : ''}`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${
                  theme === 'dark'
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {rule.rule_id}
              </span>
              <PriorityBadge priority={rule.rule_priority} />
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                  rule.active_status
                    ? theme === 'dark'
                      ? 'text-emerald-300'
                      : 'text-emerald-700'
                    : theme === 'dark'
                    ? 'text-white/40'
                    : 'text-gray-400'
                }`}
              >
                {rule.active_status ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldOff className="w-3.5 h-3.5" />
                )}
                {rule.active_status ? 'Active' : 'Inactive'}
              </span>
            </div>

            <h4 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {rule.scenario}
            </h4>
            <p className={`mt-1.5 text-sm leading-relaxed ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`}>
              {renderLogic(rule.scenario_logic)}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <ToggleSwitch checked={rule.active_status} onChange={onToggleStatus} label={`Toggle ${rule.rule_id}`} />
          </div>
        </div>

        <div className={`mt-4 pt-4 border-t flex items-center justify-between ${
          theme === 'dark' ? 'border-white/10' : 'border-gray-100'
        }`}>
          <button
            onClick={() => setExpanded((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
              theme === 'dark' ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            {hasConfigs ? `Configuration (${rule.configs.length})` : 'Configuration'}
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>

          {expanded && hasConfigs && !editing && (
            <button
              onClick={startEditing}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/15 text-white hover:bg-white/10'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}

          {expanded && editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEditing}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  theme === 'dark'
                    ? 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={save}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 transition-colors shadow-md"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-2">
                {hasConfigs ? (
                  draft.map((cfg, idx) => (
                    <ConfigRow
                      key={cfg.config_key}
                      config={cfg}
                      editing={editing}
                      onChange={(next) =>
                        setDraft((prev) => prev.map((c, i) => (i === idx ? next : c)))
                      }
                    />
                  ))
                ) : (
                  <div
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed text-sm ${
                      theme === 'dark'
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
/*  Stat card (mirrors TopAlertRulesPanel's stat cards)                */
/* ------------------------------------------------------------------ */

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  gradient: string;
  accent: string;
}> = ({ icon, label, value, gradient, accent }) => {
  const { theme } = useTheme();
  return (
    <div
      className={`p-4 rounded-xl border ${
        theme === 'dark' ? `bg-gradient-to-br ${gradient} border-white/10` : `bg-gradient-to-br ${gradient} border-gray-200`
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={accent}>{icon}</span>
        <span className={`text-sm font-medium ${accent}`}>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

const RulesManagement: React.FC<RulesManagementPageProps> = ({
  data,
  isLoading,
  onToggleRuleStatus,
  onSaveConfigs,
}) => {
  const { theme } = useTheme();
  const [rules, setRules] = useState<AlertRule[]>(data);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setRules(data), [data]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const activeCount = rules.filter((r) => r.active_status).length;
  const highPriorityCount = rules.filter((r) => r.rule_priority === 'High').length;

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      const matchesSearch =
        search.trim() === '' ||
        rule.rule_id.toLowerCase().includes(search.toLowerCase()) ||
        rule.scenario.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && rule.active_status) ||
        (statusFilter === 'inactive' && !rule.active_status);
      const matchesPriority = priorityFilter === 'all' || rule.rule_priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [rules, search, statusFilter, priorityFilter]);

  const handleToggleStatus = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.rule_id !== ruleId) return r;
        const next = !r.active_status;
        onToggleRuleStatus?.(ruleId, next);
        setToast(`${ruleId} ${next ? 'activated' : 'deactivated'}`);
        return { ...r, active_status: next };
      })
    );
  };

  const handleSaveConfigs = (ruleId: string, configs: RuleConfig[]) => {
    setRules((prev) => prev.map((r) => (r.rule_id === ruleId ? { ...r, configs } : r)));
    onSaveConfigs?.(ruleId, configs);
    setToast(`${ruleId} configuration saved`);
  };

  const inputBase = `w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
    theme === 'dark'
      ? 'bg-white/5 border-white/15 text-white placeholder-white/40'
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
  }`;

  const selectBase = `px-3 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
    theme === 'dark' ? 'bg-white/5 border-white/15 text-white' : 'bg-white border-gray-200 text-gray-900'
  }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${
        theme === 'dark' ? 'bg-white/10 border-white/20' : 'bg-white border-gray-200 shadow-card'
      } backdrop-blur-xl`}
    >
      {/* Header */}
      <div className={`flex justify-between items-center p-6 border-b ${
        theme === 'dark' ? 'border-white/20' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
            <ListChecks className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Alert Rules
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-blue-200/70' : 'text-blue-600'}`}>
              Activate, deactivate and configure detection rules
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {rules.length}
          </div>
          <div className={`text-xs font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
            Total Rules
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[350px] space-y-4">
            <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin ${
              theme === 'dark' ? 'border-blue-400/60' : 'border-blue-500/60'
            }`} />
            <div className="text-center">
              <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Loading rules...
              </div>
              <div className={`text-sm mt-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                Fetching rule configuration
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon={<Power className="w-4 h-4" />}
                label="Active Rules"
                value={activeCount}
                gradient={theme === 'dark' ? 'from-emerald-500/20 to-teal-500/20' : 'from-emerald-100 to-teal-100'}
                accent={theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}
              />
              <StatCard
                icon={<ShieldOff className="w-4 h-4" />}
                label="Inactive Rules"
                value={rules.length - activeCount}
                gradient={theme === 'dark' ? 'from-slate-500/20 to-slate-700/20' : 'from-gray-100 to-gray-200'}
                accent={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}
              />
              <StatCard
                icon={<AlertTriangle className="w-4 h-4" />}
                label="High Priority"
                value={highPriorityCount}
                gradient={theme === 'dark' ? 'from-red-500/20 to-orange-500/20' : 'from-red-100 to-orange-100'}
                accent={theme === 'dark' ? 'text-red-300' : 'text-red-700'}
              />
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                }`} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by rule ID or scenario..."
                  className={inputBase}
                />
              </div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className={`w-4 h-4 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className={selectBase}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                  className={selectBase}
                >
                  <option value="all">All priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Rule list */}
            {filteredRules.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {filteredRules.map((rule) => (
                    <RuleCard
                      key={rule.rule_id}
                      rule={rule}
                      onToggleStatus={() => handleToggleStatus(rule.rule_id)}
                      onSaveConfigs={(configs) => handleSaveConfigs(rule.rule_id, configs)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center py-16 rounded-xl border border-dashed ${
                theme === 'dark' ? 'border-white/10 text-white/40' : 'border-gray-200 text-gray-400'
              }`}>
                <RotateCcw className="w-8 h-8 mb-3" />
                <p className="text-sm font-medium">No rules match your filters</p>
                <button
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                    setPriorityFilter('all');
                  }}
                  className={`mt-3 text-xs font-semibold underline underline-offset-2 ${
                    theme === 'dark' ? 'text-blue-300' : 'text-blue-600'
                  }`}
                >
                  Clear filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>{toast && <Toast message={toast} theme={theme} />}</AnimatePresence>
    </motion.div>
  );
};

export default RulesManagement;