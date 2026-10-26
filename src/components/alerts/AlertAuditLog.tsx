import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  User,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  AlertTriangle,
  X,
  Copy,
  Check,
  Shield,
  Layers,
  Activity,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  WifiOff,
  Calendar,
  Play,
  Pause,
  Loader2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';
import { useNotifications } from '../notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SystemLogEntry {
  id: number;
  action: string;
  user_id?: string;
  username: string;
  module: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'DEBUG' | string;
  critical: boolean;
  details: string;
  ip_address?: string;
  reference_id?: string;
  host_name?: string;
  created_at: string;
  status_code?: number;
  metadata?: Record<string, any>;
}

interface SystemLogsResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  data: SystemLogEntry[];
}

type SortField =
  | 'id'
  | 'action'
  | 'username'
  | 'module'
  | 'level'
  | 'created_at'
  | 'status_code';
type SortOrder = 'asc' | 'desc';
type CriticalFilter = 'all' | 'critical' | 'normal';

interface FilterState {
  search: string;
  module: string;
  level: string;
  action: string;
  username: string;
  critical: CriticalFilter;
  fromDate: string;
  toDate: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const AUTO_REFRESH_MS = 30000;

const SORT_FIELDS: { key: SortField; label: string }[] = [
  { key: 'created_at', label: 'Timestamp' },
  { key: 'id', label: 'ID' },
  { key: 'level', label: 'Level' },
  { key: 'module', label: 'Module' },
  { key: 'action', label: 'Action' },
  { key: 'username', label: 'User' },
  { key: 'status_code', label: 'Status Code' },
];

// ---------------------------------------------------------------------------
// Fallback data — used ONLY when the API call fails, so the page can still be
// reviewed for design/UX purposes.
// ---------------------------------------------------------------------------

const FALLBACK_LOGS: SystemLogEntry[] = [
  {
    id: 38,
    action: 'UPDATE',
    username: 'anwin',
    module: 'MENU_ACCESS',
    level: 'INFO',
    critical: true,
    details:
      'Role permissions updated successfully for Super Admin role. Added export and delete scopes.',
    created_at: new Date().toISOString(),
    status_code: 200,
    metadata: {
      roleId: 1,
      roleName: 'Super Admin',
      permissions: [
        'alerts.view',
        'alerts.export',
        'users.manage',
        'roles.manage',
      ],
      updatedBy: 'anwin',
      previousPermissionCount: 24,
      newPermissionCount: 28,
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}
const TODAY = toISODate(new Date());
const DEFAULT_FILTERS: FilterState = {
  search: '',
  module: '',
  level: '',
  action: '',
  username: '',
  critical: 'all',
  fromDate: TODAY,
  toDate: TODAY,
};

const DATE_PRESETS: { label: string; get: () => [string, string] }[] = [
  { label: 'Today', get: () => [TODAY, TODAY] },
  {
    label: 'Yesterday',
    get: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const s = toISODate(d);
      return [s, s];
    },
  },
  {
    label: 'Last 7 days',
    get: () => {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return [toISODate(start), TODAY];
    },
  },
  {
    label: 'Last 30 days',
    get: () => {
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return [toISODate(start), TODAY];
    },
  },
  {
    label: 'This month',
    get: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return [toISODate(start), TODAY];
    },
  },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
function timeAgo(iso: string) {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return `${Math.floor(day / 30)}mo ago`;
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCSV(rows: SystemLogEntry[]) {
  const headers = [
    'ID',
    'Level',
    'Critical',
    'Action',
    'Module',
    'Username',
    'Status Code',
    'Created At',
    'Details',
  ];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.id,
        r.level,
        r.critical ? 'Yes' : 'No',
        r.action,
        r.module,
        r.username,
        r.status_code ?? '',
        r.created_at,
        r.details,
      ]
        .map(escape)
        .join(',')
    ),
  ];
  downloadBlob(
    lines.join('\n'),
    `system-logs-${Date.now()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

function exportJSON(rows: SystemLogEntry[]) {
  downloadBlob(
    JSON.stringify(rows, null, 2),
    `system-logs-${Date.now()}.json`,
    'application/json'
  );
}

// Lightweight JSON syntax highlighter (no external deps).
function highlightJSON(value: unknown, dark: boolean): string {
  const json = JSON.stringify(value, null, 2) ?? 'null';
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const colors = dark
    ? {
        key: '#7dd3fc',
        string: '#86efac',
        number: '#fcd34d',
        bool: '#c4b5fd',
        null: '#fca5a5',
      }
    : {
        key: '#0369a1',
        string: '#15803d',
        number: '#b45309',
        bool: '#6d28d9',
        null: '#be123c',
      };
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let color = colors.number;
      if (/^"/.test(match)) {
        color = /:\s*$/.test(match) ? colors.key : colors.string;
      } else if (/true|false/.test(match)) {
        color = colors.bool;
      } else if (/null/.test(match)) {
        color = colors.null;
      }
      return `<span style="color:${color}">${match}</span>`;
    }
  );
}

function levelStyles(level: string, theme: string) {
  const dark = theme === 'dark';
  switch (level.toUpperCase()) {
    case 'INFO':
      return dark
        ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
        : 'bg-blue-50 text-blue-700 border-blue-200';
    case 'WARN':
      return dark
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-amber-50 text-amber-700 border-amber-200';
    case 'ERROR':
      return dark
        ? 'bg-red-500/15 text-red-300 border-red-500/30'
        : 'bg-red-50 text-red-700 border-red-200';
    case 'CRITICAL':
      return dark
        ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
        : 'bg-rose-50 text-rose-700 border-rose-300';
    case 'DEBUG':
      return dark
        ? 'bg-slate-500/15 text-slate-300 border-slate-500/30'
        : 'bg-slate-100 text-slate-600 border-slate-300';
    default:
      return dark
        ? 'bg-white/10 text-white/70 border-white/20'
        : 'bg-gray-100 text-gray-700 border-gray-300';
  }
}

function statusStyles(code: number | undefined, theme: string) {
  const dark = theme === 'dark';
  if (!code) return dark ? 'text-white/40' : 'text-gray-400';
  if (code < 300) return dark ? 'text-emerald-400' : 'text-emerald-600';
  if (code < 400) return dark ? 'text-blue-400' : 'text-blue-600';
  if (code < 500) return dark ? 'text-amber-400' : 'text-amber-600';
  return dark ? 'text-red-400' : 'text-red-600';
}

// ---------------------------------------------------------------------------
// Date range field — click-anywhere calendar + quick presets
// ---------------------------------------------------------------------------

const DateRangeField: React.FC<{
  fromDate: string;
  toDate: string;
  dark: boolean;
  onChange: (from: string, to: string) => void;
}> = ({ fromDate, toDate, dark, onChange }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const el = ref.current as any;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        /* fall through */
      }
    }
    el.focus();
  };

  const activePreset = DATE_PRESETS.find((p) => {
    const [f, t] = p.get();
    return f === fromDate && t === toDate;
  });

  const label = activePreset
    ? activePreset.label
    : fromDate === toDate
      ? new Date(`${fromDate}T00:00:00`).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : `${new Date(`${fromDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(
          `${toDate}T00:00:00`
        ).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`;

  return (
    <div className="relative" ref={wrapperRef}>
      <label
        className={`block text-sm font-medium mb-2 ${dark ? 'text-white/70' : 'text-gray-600'}`}
      >
        Date range
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border w-56 text-left transition-colors ${
          dark
            ? 'bg-white/10 border-white/20 text-white hover:bg-white/15'
            : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
        }`}
      >
        <Calendar className="w-4 h-4 opacity-60 shrink-0" />
        <span className="text-sm truncate flex-1">{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`absolute z-30 mt-2 w-120 rounded-xl border shadow-2xl p-6 ${
              dark ? 'bg-slate-900 border-white/20' : 'bg-white border-gray-200'
            }`}
          >
            <div className="grid grid-cols-2 gap-2 mb-4">
              {DATE_PRESETS.map((p) => {
                const [f, t] = p.get();
                const active = f === fromDate && t === toDate;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      onChange(f, t);
                      setOpen(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                      active
                        ? 'bg-blue-500 text-white'
                        : dark
                          ? 'bg-white/10 hover:bg-white/20 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div
              className={`text-xs font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/40' : 'text-gray-400'}`}
            >
              Custom range
            </div>
            <div className="flex items-center gap-2">
              <div
                onClick={() => openPicker(fromRef)}
                className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer ${
                  dark
                    ? 'bg-white/10 border-white/20 hover:bg-white/15'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Calendar
                  className={`w-3.5 h-3.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                />
                <input
                  ref={fromRef}
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => onChange(e.target.value, toDate)}
                  className={`w-full bg-transparent text-sm outline-none cursor-pointer ${dark ? 'text-white' : 'text-gray-900'}`}
                />
              </div>
              <span className={dark ? 'text-white/40' : 'text-gray-400'}>
                –
              </span>
              <div
                onClick={() => openPicker(toRef)}
                className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer ${
                  dark
                    ? 'bg-white/10 border-white/20 hover:bg-white/15'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Calendar
                  className={`w-3.5 h-3.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                />
                <input
                  ref={toRef}
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={TODAY}
                  onChange={(e) => onChange(fromDate, e.target.value)}
                  className={`w-full bg-transparent text-sm outline-none cursor-pointer ${dark ? 'text-white' : 'text-gray-900'}`}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SystemLogMonitor: React.FC = () => {
  const { theme } = useTheme();
  const { getMenuId } = useMenuIds();
  const dark = theme === 'dark';
  const AUDIT_LOGS_MENU_ID = getMenuId('audit_logs');

  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search, 400);
  const debouncedUsername = useDebouncedValue(filters.username, 400);
  const searchPending = filters.search !== debouncedSearch;

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedLog, setSelectedLog] = useState<SystemLogEntry | null>(null);
  const [copied, setCopied] = useState(false);

  const [autoRefresh, setAutoRefresh] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const { addNotification } = useNotifications();

  // ---- Dynamic filter facets, built from whatever the API actually returns ----
  const facetSets = useRef({
    modules: new Set<string>(),
    actions: new Set<string>(),
    levels: new Set<string>(),
    usernames: new Set<string>(),
  });
  const [facetVersion, setFacetVersion] = useState(0);

  const mergeFacets = (rows: SystemLogEntry[]) => {
    let changed = false;
    rows.forEach((r) => {
      if (r.module && !facetSets.current.modules.has(r.module)) {
        facetSets.current.modules.add(r.module);
        changed = true;
      }
      if (r.action && !facetSets.current.actions.has(r.action)) {
        facetSets.current.actions.add(r.action);
        changed = true;
      }
      if (r.level && !facetSets.current.levels.has(r.level)) {
        facetSets.current.levels.add(r.level);
        changed = true;
      }
      if (r.username && !facetSets.current.usernames.has(r.username)) {
        facetSets.current.usernames.add(r.username);
        changed = true;
      }
    });
    if (changed) setFacetVersion((v) => v + 1);
  };

  const moduleOptions = useMemo(
    () => Array.from(facetSets.current.modules).sort(),
    [facetVersion]
  );
  const actionOptions = useMemo(
    () => Array.from(facetSets.current.actions).sort(),
    [facetVersion]
  );
  const levelOptions = useMemo(
    () => Array.from(facetSets.current.levels).sort(),
    [facetVersion]
  );
  const usernameOptions = useMemo(
    () => Array.from(facetSets.current.usernames).sort(),
    [facetVersion]
  );

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Esc closes the JSON drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedLog) closeDrawer();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLog]);

  const fetchLogs = useCallback(
    async (silent = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!silent) setLoading(true);
      setError(null);

      const params: Record<string, string | number | boolean> = {
        page,
        pageSize,
        sortBy,
        sortOrder,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.module) params.module = filters.module;
      if (filters.level) params.level = filters.level;
      if (filters.action) params.action = filters.action;
      if (debouncedUsername) params.username = debouncedUsername;
      if (filters.critical !== 'all')
        params.critical = filters.critical === 'critical';
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;

      try {
        const response = await apiClient.get<SystemLogsResponse>(
          '/admin/system-logs',
          {
            params,
            signal: controller.signal,
          }
        );
        const payload = response.data;
        setLogs(payload.data);
        setTotalRecords(payload.totalRecords);
        setTotalPages(payload.totalPages);
        setUsingFallback(false);
        mergeFacets(payload.data);
      } catch (err: any) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        console.error('Error fetching system logs:', err);
        setError(
          'Could not reach the system logs service. Showing sample data for design review.'
        );
        setUsingFallback(true);
        setLogs(FALLBACK_LOGS);
        setTotalRecords(FALLBACK_LOGS.length);
        setTotalPages(1);
        mergeFacets(FALLBACK_LOGS);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      page,
      pageSize,
      sortBy,
      sortOrder,
      debouncedSearch,
      debouncedUsername,
      filters.module,
      filters.level,
      filters.action,
      filters.critical,
      filters.fromDate,
      filters.toDate,
    ]
  );

  useEffect(() => {
    fetchLogs();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLogs]);

  // Reset to page 1 whenever a filter (not page/pageSize) changes
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearch,
    debouncedUsername,
    filters.module,
    filters.level,
    filters.action,
    filters.critical,
    filters.fromDate,
    filters.toDate,
    pageSize,
  ]);

  // Auto-refresh (silent, keeps drawer/scroll position)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchLogs(true), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.module) n++;
    if (filters.action) n++;
    if (filters.username) n++;
    return n;
  }, [filters]);

  const toggleRow = (log: SystemLogEntry) => {
    if (expandedId === log.id) {
      setExpandedId(null);
      setSelectedLog(null);
    } else {
      setExpandedId(log.id);
      setSelectedLog(log);
    }
  };

  function closeDrawer() {
    setExpandedId(null);
    setSelectedLog(null);
  }

  const handleCopyJSON = async () => {
    if (!selectedLog) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(selectedLog.metadata ?? {}, null, 2)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const criticalOnPage = logs.filter((l) => l.critical).length;
  const errorsOnPage = logs.filter((l) =>
    ['ERROR', 'CRITICAL'].includes(l.level.toUpperCase())
  ).length;

  const panelBase = dark
    ? 'bg-white/5 border-white/20'
    : 'bg-white border-gray-200';
  const inputBase = dark
    ? 'bg-white/10 border border-white/20 text-white placeholder-white/40'
    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400';
  const labelBase = dark ? 'text-white/70' : 'text-gray-600';

  return (
    <PermissionGuard
      menuId={AUDIT_LOGS_MENU_ID}
      action="view"
      fallback={
        <div
          className={`text-center py-20 ${dark ? 'text-white' : 'text-gray-900'}`}
        >
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">
            You don't have permission to view system logs.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}
                >
                  System Log Monitor
                </h2>
                {autoRefresh && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Live
                  </span>
                )}
              </div>
              <p className={dark ? 'text-blue-200/70' : 'text-blue-600'}>
                Search, filter and inspect system audit events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                autoRefresh
                  ? dark
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : dark
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }`}
              title={
                autoRefresh ? 'Pause auto-refresh' : 'Auto-refresh every 30s'
              }
            >
              {autoRefresh ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {autoRefresh ? 'Live' : 'Auto-refresh'}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchLogs()}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                dark
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              }`}
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </motion.button>

            <PermissionGuard
              menuId={AUDIT_LOGS_MENU_ID}
              action="export"
              fallback={
                <button
                  onClick={() =>
                    addNotification(
                      'You do not have permission to export system logs, Contact Administrator.',
                      'warning'
                    )
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl opacity-50 ${
                    dark
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-green-100 text-green-700 border border-green-300'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              }
            >
              <div className="relative" ref={exportRef}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setExportOpen((v) => !v)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                    dark
                      ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                      : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Export
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`}
                  />
                </motion.button>
                <AnimatePresence>
                  {exportOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className={`absolute right-0 mt-2 w-48 rounded-xl border shadow-2xl z-20 overflow-hidden ${
                        dark
                          ? 'bg-slate-900 border-white/20'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <button
                        onClick={() => {
                          exportCSV(logs);
                          setExportOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 ${dark ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <FileText className="w-4 h-4" /> Export current page
                        (CSV)
                      </button>
                      <button
                        onClick={() => {
                          exportJSON(logs);
                          setExportOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 border-t ${
                          dark
                            ? 'text-white hover:bg-white/10 border-white/10'
                            : 'text-gray-700 hover:bg-gray-50 border-gray-100'
                        }`}
                      >
                        <Layers className="w-4 h-4" /> Export current page
                        (JSON)
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </PermissionGuard>
          </div>
        </div>

        {/* Fallback banner */}
        {usingFallback && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
              dark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stat strip — critical/error cards double as quick filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            className={`rounded-2xl border p-4 backdrop-blur-xl ${panelBase}`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <div>
                <div
                  className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}
                >
                  {totalRecords.toLocaleString()}
                </div>
                <div className={`text-xs ${labelBase}`}>Total records</div>
              </div>
            </div>
          </div>

          <button
            onClick={() =>
              setFilters((f) => ({
                ...f,
                critical: f.critical === 'critical' ? 'all' : 'critical',
              }))
            }
            className={`text-left rounded-2xl border p-4 backdrop-blur-xl transition-all ${panelBase} ${
              filters.critical === 'critical'
                ? 'ring-2 ring-rose-500'
                : 'hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 shadow-md">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div>
                <div
                  className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}
                >
                  {criticalOnPage}
                </div>
                <div className={`text-xs ${labelBase}`}>Critical (page)</div>
              </div>
            </div>
          </button>

          <button
            onClick={() =>
              setFilters((f) => ({
                ...f,
                level: f.level === 'ERROR' ? '' : 'ERROR',
              }))
            }
            className={`text-left rounded-2xl border p-4 backdrop-blur-xl transition-all ${panelBase} ${
              filters.level === 'ERROR'
                ? 'ring-2 ring-amber-500'
                : 'hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-md">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <div
                  className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}
                >
                  {errorsOnPage}
                </div>
                <div className={`text-xs ${labelBase}`}>Errors (page)</div>
              </div>
            </div>
          </button>

          <div
            className={`rounded-2xl border p-4 backdrop-blur-xl ${panelBase}`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <div
                  className={`text-lg font-bold ${dark ? 'text-white' : 'text-gray-900'}`}
                >
                  {logs.length} of {totalRecords}
                </div>
                <div className={`text-xs ${labelBase}`}>Showing</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div
          className={`relative z-20 rounded-2xl border p-6 backdrop-blur-xl ${panelBase}`}
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[220px]">
              <label className={`block text-sm font-medium mb-2 ${labelBase}`}>
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  placeholder="Search by action, details, module…"
                  className={`w-full pl-10 pr-9 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBase}`}
                />
                {searchPending && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>
            </div>

            <DateRangeField
              fromDate={filters.fromDate}
              toDate={filters.toDate}
              dark={dark}
              onChange={(from, to) =>
                setFilters((f) => ({ ...f, fromDate: from, toDate: to }))
              }
            />

            <div className="w-40">
              <label className={`block text-sm font-medium mb-2 ${labelBase}`}>
                Level
              </label>
              <select
                value={filters.level}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, level: e.target.value }))
                }
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBase}`}
              >
                <option value="">All levels</option>
                {levelOptions.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-40">
              <label className={`block text-sm font-medium mb-2 ${labelBase}`}>
                Critical
              </label>
              <select
                value={filters.critical}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    critical: e.target.value as CriticalFilter,
                  }))
                }
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBase}`}
              >
                <option value="all">All events</option>
                <option value="critical">Critical only</option>
                <option value="normal">Non-critical</option>
              </select>
            </div>

            <div className="w-52">
              <label className={`block text-sm font-medium mb-2 ${labelBase}`}>
                Sort by
              </label>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortField)}
                  className={`flex-1 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBase}`}
                >
                  {SORT_FIELDS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
                  }
                  className={`px-3 rounded-lg border ${dark ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-700'}`}
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'asc' ? (
                    <ArrowUp className="w-4 h-4" />
                  ) : (
                    <ArrowDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                dark
                  ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-300 text-gray-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Advanced
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-blue-500 text-white">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <button
              onClick={clearFilters}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                dark
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Clear
            </button>
          </div>

          <AnimatePresence>
            {advancedOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className={`mt-5 pt-5 border-t grid grid-cols-1 md:grid-cols-3 gap-4 ${dark ? 'border-white/10' : 'border-gray-100'}`}
                >
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${labelBase}`}
                    >
                      Module
                    </label>
                    <select
                      value={filters.module}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, module: e.target.value }))
                      }
                      className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBase}`}
                    >
                      <option value="">All modules</option>
                      {moduleOptions.map((m) => (
                        <option key={m} value={m}>
                          {m.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                    {moduleOptions.length === 0 && (
                      <p
                        className={`text-xs mt-1 ${dark ? 'text-white/30' : 'text-gray-400'}`}
                      >
                        Options populate as records load
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${labelBase}`}
                    >
                      Action
                    </label>
                    <select
                      value={filters.action}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, action: e.target.value }))
                      }
                      className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBase}`}
                    >
                      <option value="">All actions</option>
                      {actionOptions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${labelBase}`}
                    >
                      Username
                    </label>
                    <input
                      list="username-facet-options"
                      type="text"
                      value={filters.username}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, username: e.target.value }))
                      }
                      placeholder="Start typing a username…"
                      className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBase}`}
                    />
                    <datalist id="username-facet-options">
                      {usernameOptions.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Table + Drawer split view */}
        <div className="flex gap-4 items-start">
          <div
            className={`flex-1 min-w-0 rounded-2xl border overflow-hidden backdrop-blur-xl shadow-2xl ${panelBase}`}
          >
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-14 rounded-xl animate-pulse ${dark ? 'bg-white/5' : 'bg-gray-100'}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p
                    className={`text-lg font-medium ${dark ? 'text-white' : 'text-gray-900'}`}
                  >
                    No log events found
                  </p>
                  <p className={`text-sm ${labelBase}`}>
                    Try widening the date range or adjusting your filters
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-auto max-h-[65vh]">
                <table className="w-full">
                  <thead
                    className={`sticky top-0 z-10 border-b backdrop-blur-sm ${dark ? 'border-white/20 bg-slate-900/95' : 'border-gray-200 bg-gray-50/95'}`}
                  >
                    <tr>
                      <th className="w-8" />
                      {(
                        [
                          ['id', 'ID'],
                          ['level', 'Level'],
                          ['action', 'Action'],
                          ['module', 'Module'],
                          ['username', 'User'],
                        ] as [SortField, string][]
                      ).map(([key, label]) => (
                        <th
                          key={key}
                          onClick={() => handleSort(key)}
                          className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer select-none ${
                            dark
                              ? 'text-white/70 hover:text-white'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            {sortBy === key ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-30" />
                            )}
                          </span>
                        </th>
                      ))}
                      <th
                        className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${dark ? 'text-white/70' : 'text-gray-500'}`}
                      >
                        Details
                      </th>
                      <th
                        onClick={() => handleSort('created_at')}
                        className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer select-none ${
                          dark
                            ? 'text-white/70 hover:text-white'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          Timestamp
                          {sortBy === 'created_at' ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => {
                      const isExpanded = expandedId === log.id;
                      return (
                        <React.Fragment key={log.id}>
                          <motion.tr
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            onClick={() => toggleRow(log)}
                            className={`border-b cursor-pointer transition-colors ${dark ? 'border-white/10 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'} ${
                              isExpanded
                                ? dark
                                  ? 'bg-blue-500/10'
                                  : 'bg-blue-50/60'
                                : index % 2 === 1
                                  ? dark
                                    ? 'bg-white/[0.02]'
                                    : 'bg-gray-50/50'
                                  : ''
                            }`}
                          >
                            <td
                              className={`pl-4 border-l-4 ${log.critical ? (dark ? 'border-l-rose-500' : 'border-l-rose-400') : 'border-l-transparent'}`}
                            >
                              <ChevronRight
                                className={`w-4 h-4 transition-transform ${dark ? 'text-white/40' : 'text-gray-400'} ${isExpanded ? 'rotate-90' : ''}`}
                              />
                            </td>
                            <td
                              className={`px-4 py-3 text-sm font-mono ${dark ? 'text-white/60' : 'text-gray-500'}`}
                            >
                              #{log.id}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${levelStyles(log.level, theme)}`}
                              >
                                {log.critical && (
                                  <AlertTriangle className="w-3 h-3" />
                                )}
                                {log.level}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-3 text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}
                            >
                              {log.action.replace(/_/g, ' ')}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm ${dark ? 'text-white/80' : 'text-gray-700'}`}
                            >
                              {log.module.replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <User
                                  className={`w-3.5 h-3.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                />
                                <span
                                  className={`text-sm ${dark ? 'text-white/80' : 'text-gray-700'}`}
                                >
                                  {log.username
                                    ? `${log.user_id} (${log.username})`
                                    : log.user_id}
                                </span>
                              </div>
                            </td>
                            <td
                              className={`px-4 py-3 text-sm max-w-[260px] ${dark ? 'text-white/70' : 'text-gray-600'}`}
                            >
                              <span
                                className="block truncate"
                                title={log.details}
                              >
                                {log.details}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Clock
                                  className={`w-3.5 h-3.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                />
                                <div>
                                  <div
                                    className={`text-sm ${dark ? 'text-white/90' : 'text-gray-800'}`}
                                  >
                                    {formatDate(log.created_at)}
                                  </div>
                                  <div
                                    className={`text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                  >
                                    {formatTime(log.created_at)} ·{' '}
                                    {timeAgo(log.created_at)}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.tr
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                              >
                                <td
                                  colSpan={8}
                                  className={`px-4 pb-4 pt-0 ${dark ? 'bg-blue-500/5' : 'bg-blue-50/40'}`}
                                >
                                  <div
                                    className={`rounded-xl border p-4 ${dark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}
                                  >
                                    <div className="flex flex-wrap gap-6">
                                      <div className="flex-1 min-w-[220px]">
                                        <div
                                          className={`text-xs font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                        >
                                          Full details
                                        </div>
                                        <p
                                          className={`text-sm ${dark ? 'text-white/85' : 'text-gray-700'}`}
                                        >
                                          {log.details}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-6">
                                        <div>
                                          <div
                                            className={`text-xs font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                          >
                                            Status code
                                          </div>
                                          <span
                                            className={`text-sm font-mono font-semibold ${statusStyles(log.status_code, theme)}`}
                                          >
                                            {log.status_code ?? '—'}
                                          </span>
                                        </div>
                                        <div>
                                          <div
                                            className={`text-xs font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                          >
                                            Critical
                                          </div>
                                          <span
                                            className={`text-sm font-medium ${log.critical ? 'text-rose-400' : dark ? 'text-white/70' : 'text-gray-600'}`}
                                          >
                                            {log.critical ? 'Yes' : 'No'}
                                          </span>
                                        </div>
                                        <div>
                                          <div
                                            className={`text-xs font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                          >
                                            Event ID
                                          </div>
                                          <span
                                            className={`text-sm font-mono ${dark ? 'text-white/70' : 'text-gray-600'}`}
                                          >
                                            #{log.id}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-6 mt-4">
                                      <div>
                                        <div
                                          className={`text-xs font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                        >
                                          Correlation ID
                                        </div>
                                        <span
                                          className={`text-sm font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                        >
                                          {log.reference_id ?? '—'}
                                        </span>
                                      </div>
                                      <div>
                                        <div
                                          className={`text-xs font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                        >
                                          Host Name
                                        </div>
                                        <span
                                          className={`text-sm font-medium ${log.critical ? 'text-rose-400' : dark ? 'text-white/70' : 'text-gray-600'}`}
                                        >
                                          {log.host_name ?? '-'}
                                        </span>
                                      </div>
                                      <div>
                                        <div
                                          className={`text-xs font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                        >
                                          IP Address
                                        </div>
                                        <span
                                          className={`text-sm font-mono ${dark ? 'text-white/70' : 'text-gray-600'}`}
                                        >
                                          {log.ip_address ?? '-'}
                                        </span>
                                      </div>
                                    </div>

                                    <div
                                      className={`mt-3 text-xs ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                    >
                                      Full JSON payload open in the panel →
                                    </div>
                                  </div>
                                </td>
                              </motion.tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && logs.length > 0 && (
              <div
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t ${dark ? 'border-white/10' : 'border-gray-100'}`}
              >
                <div className={`text-sm ${labelBase}`}>
                  Page {page} of {Math.max(totalPages, 1)} ·{' '}
                  {totalRecords.toLocaleString()} records
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm ${labelBase}`}>Go to</span>
                    <input
                      key={page}
                      type="number"
                      min={1}
                      max={totalPages}
                      defaultValue={page}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = Number(
                            (e.target as HTMLInputElement).value
                          );
                          if (v >= 1 && v <= totalPages) setPage(v);
                        }
                      }}
                      className={`w-14 px-2 py-1.5 rounded-lg text-sm ${inputBase}`}
                    />
                  </div>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className={`px-2 py-1.5 rounded-lg text-sm ${inputBase}`}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={`p-1.5 rounded-lg disabled:opacity-30 ${dark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className={`p-1.5 rounded-lg disabled:opacity-30 ${dark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right-hand JSON drawer */}
          <AnimatePresence>
            {selectedLog && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 420, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className={`shrink-0 rounded-2xl border overflow-hidden backdrop-blur-xl shadow-2xl sticky top-4 ${panelBase}`}
                style={{ maxHeight: 'calc(100vh - 180px)' }}
              >
                <div
                  className={`flex items-center justify-between px-4 py-3 border-b ${dark ? 'border-white/10' : 'border-gray-100'}`}
                >
                  <div>
                    <div
                      className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}
                    >
                      Event #{selectedLog.id} metadata
                    </div>
                    <div className={`text-xs ${labelBase}`}>
                      {selectedLog.module.replace(/_/g, ' ')} ·{' '}
                      {selectedLog.action}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopyJSON}
                      className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'}`}
                      title="Copy JSON"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={closeDrawer}
                      className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'}`}
                      title="Close (Esc)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div
                  className="overflow-auto p-4"
                  style={{ maxHeight: 'calc(100vh - 240px)' }}
                >
                  <pre
                    className={`text-xs leading-relaxed font-mono whitespace-pre-wrap break-words ${dark ? 'text-white/90' : 'text-gray-800'}`}
                    dangerouslySetInnerHTML={{
                      __html: highlightJSON(selectedLog.metadata ?? {}, dark),
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default SystemLogMonitor;
