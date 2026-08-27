import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  User,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  X,
  Copy,
  Check,
  Shield,
  Layers,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  WifiOff,
  Calendar,
  Play,
  Pause,
  Loader2,
  Building2,
  Hash,
  Radio,
  FileText,
  Lock,
  Unlock,
  Flag,
  Info,
  MessageSquare,
  ArrowLeftRight,
  History,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';
import { useNotifications } from '../notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FraudAlert {
  alert_id: string;
  created_date: string;
  created_at_timestamp: string;
  cashier: string;
  branch_name: string;
  comments: string;
  rule_id: string;
  rule_description: string;
  rule_priority: 'High' | 'Medium' | 'Low' | string;
  status: string;
  is_alert_closed: boolean;
  is_fraud: boolean;
  created_user_full_name: string;
  channel: string;
  row_status: string;
}

interface AlertsResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  data: FraudAlert[];
}

// ---- Alert detail (fetched per-row on click) ------------------------------
// `llm_configs` has no fixed shape — it varies per rule, so it is always
// rendered dynamically from whatever keys/values the API returns, never
// hardcoded to a specific rule's parameters.
export interface AlertDetailInfo {
  alert_date?: string;
  created_user_full_name?: string;
  branch_name?: string;
  comments?: string;
  rule_id?: string;
  rule_description?: string;
  rule_priority?: string;
  is_alert_closed?: boolean;
  llm_configs?: Record<string, unknown>;
}

export interface AlertTransaction {
  row_id: string;
  txn_date?: string;
  refno_send_receive?: string;
  customer_code?: string;
  customer_type?: string;
  customer_name?: string;
  amt_aed?: number;
  curcode?: string;
  is_employee_txn?: boolean;
  customer_nationality?: string;
  beneficiary_name?: string;
  [key: string]: unknown;
}

export interface AlertHistoryEntry {
  id: number | string;
  created_at?: string;
  action_type?: string;
  disposition_type?: string;
  risk_category?: string;
  remarks?: string;
  analyst_findings?: string;
  analyst_remarks?: string;
  analyst_actions?: string;
  is_escalated?: boolean;
  escalated_to?: string | null;
  user_comments?: string | null;
  actioned_by?: string;
  followup_date?: string | null;
  followup_assigned_to?: string;
  [key: string]: unknown;
}

export interface AlertDetailResponse {
  alert_id: string;
  info: AlertDetailInfo;
  details: AlertTransaction[];
  history: AlertHistoryEntry[];
}

type SortField =
  | 'created_at'
  | 'rule_priority'
  | 'rule_id'
  | 'branch_name'
  | 'channel'
  | 'status';
type SortOrder = 'ASC' | 'DESC';
type TriState = 'all' | 'true' | 'false';

interface FilterState {
  search: string;
  status: string;
  priority: string;
  channel: string;
  ruleId: string;
  location: string;
  username: string;
  closed: TriState;
  fraud: TriState;
  fromDate: string;
  toDate: string;
}

// NOTE: adjust to match your actual API route + menu registration key.
const ALERTS_ENDPOINT = '/alerts-summary-master';
const ALERT_DETAIL_ENDPOINT = (alertId: string) =>
  `/alerts-summary-details?alert_id=${alertId}`;
const MENU_KEY = 'alert_lists';
const ALERTS_FILTERS_ENDPOINT = '/alerts-filters';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];
const AUTO_REFRESH_MS = 30000;

const SORT_FIELDS: { key: SortField; label: string }[] = [
  { key: 'created_at', label: 'Created At' },
  { key: 'rule_priority', label: 'Priority' },
  { key: 'rule_id', label: 'Rule' },
  { key: 'branch_name', label: 'Branch' },
  { key: 'channel', label: 'Channel' },
  { key: 'status', label: 'Status' },
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
  status: '',
  priority: '',
  channel: '',
  ruleId: '',
  location: '',
  username: '',
  closed: 'all',
  fraud: 'all',
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

function exportCSV(rows: FraudAlert[]) {
  const headers = [
    'Alert ID',
    'Priority',
    'Status',
    'Rule ID',
    'Rule Description',
    'Cashier',
    'Full Name',
    'Branch',
    'Channel',
    'Fraud Confirmed',
    'Closed',
    'Created At',
    'Comments',
  ];
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.alert_id,
        r.rule_priority,
        r.status,
        r.rule_id,
        r.rule_description,
        r.cashier,
        r.created_user_full_name,
        r.branch_name,
        r.channel,
        r.is_fraud ? 'Yes' : 'No',
        r.is_alert_closed ? 'Yes' : 'No',
        r.created_at_timestamp,
        r.comments,
      ]
        .map(escape)
        .join(',')
    ),
  ];
  downloadBlob(
    lines.join('\n'),
    `fraud-alerts-${Date.now()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

function exportJSON(rows: FraudAlert[]) {
  downloadBlob(
    JSON.stringify(rows, null, 2),
    `fraud-alerts-${Date.now()}.json`,
    'application/json'
  );
}

// Splits the pipe-delimited comment string the API returns into a short
// summary, a handful of supporting detail fragments, and the rule "LOGIC"
// clause (if present), so the UI can present it as a readable narrative
// rather than one long run-on string.
function parseComment(comment: string): {
  summary: string;
  details: string[];
  logic: string | null;
} {
  const segments = comment
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  const logicSeg = segments.find((s) => /^LOGIC:/i.test(s));
  const rest = segments.filter((s) => s !== logicSeg);
  const summary = rest[0] ?? comment;
  const details = rest.slice(1);
  const logic = logicSeg
    ? logicSeg.replace(/^LOGIC:\s*/i, '').replace(/\*\*/g, '')
    : null;
  return { summary, details, logic };
}

function priorityStyles(priority: string, dark: boolean) {
  switch ((priority || '').toLowerCase()) {
    case 'high':
      return dark
        ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
        : 'bg-rose-50 text-rose-700 border-rose-300';
    case 'medium':
      return dark
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low':
      return dark
        ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
        : 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return dark
        ? 'bg-white/10 text-white/70 border-white/20'
        : 'bg-gray-100 text-gray-700 border-gray-300';
  }
}

function priorityDot(priority: string) {
  switch ((priority || '').toLowerCase()) {
    case 'high':
      return 'bg-rose-500';
    case 'medium':
      return 'bg-amber-500';
    case 'low':
      return 'bg-blue-500';
    default:
      return 'bg-gray-400';
  }
}

function formatAmount(amount: number | undefined, currency?: string) {
  if (amount === undefined || amount === null || Number.isNaN(amount))
    return '—';
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

// Turns a snake_case / camelCase key into a readable label, e.g.
// "daily_threshold_count" -> "Daily Threshold Count".
function humanizeKey(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// `llm_configs` has no fixed schema across rules, so every value is
// rendered generically rather than assuming a particular type per key.
function formatDynamicValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (Array.isArray(value))
    return value.map((v) => formatDynamicValue(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// History rows vary a lot by event type (disposition, escalation, follow-up,
// system actions, etc.), so nothing beyond the compact row header (date,
// action, risk, actioned-by) is assumed to always exist. Everything else in
// the entry is surfaced dynamically: long free-text fields render as
// paragraphs, short fields render as a compact label/value grid.
const HISTORY_CORE_KEYS = new Set([
  'id',
  'created_at',
  'action_type',
  'disposition_type',
  'risk_category',
  'actioned_by',
]);

function splitHistoryFields(entry: AlertHistoryEntry) {
  const paragraphs: { label: string; text: string }[] = [];
  const grid: { label: string; value: string }[] = [];

  Object.entries(entry).forEach(([key, value]) => {
    if (HISTORY_CORE_KEYS.has(key)) return;
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'string' && value.length > 60) {
      paragraphs.push({ label: humanizeKey(key), text: value });
    } else {
      grid.push({ label: humanizeKey(key), value: formatDynamicValue(value) });
    }
  });

  return { paragraphs, grid };
}

function statusStyles(status: string, dark: boolean) {
  const s = (status || '').toUpperCase();
  if (s.includes('CLOS'))
    return dark
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s.includes('NEW'))
    return dark
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      : 'bg-blue-50 text-blue-700 border-blue-200';
  if (s.includes('REVIEW') || s.includes('PROGRESS'))
    return dark
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : 'bg-amber-50 text-amber-700 border-amber-200';
  if (s.includes('OPEN'))
    return dark
      ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
      : 'bg-rose-50 text-rose-700 border-rose-300';
  return dark
    ? 'bg-white/10 text-white/70 border-white/20'
    : 'bg-gray-100 text-gray-700 border-gray-300';
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

  //   return (
  //     <div className="relative" ref={wrapperRef}>
  //       <label
  //         className={`block text-sm font-medium mb-2 ${dark ? 'text-white/70' : 'text-gray-600'}`}
  //       >
  //         Date range
  //       </label>
  //       <button
  //         type="button"
  //         onClick={() => setOpen((v) => !v)}
  //         className={`flex items-center gap-2 px-3 py-2 rounded-lg border w-56 text-left transition-colors ${
  //           dark
  //             ? 'bg-white/10 border-white/20 text-white hover:bg-white/15'
  //             : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
  //         }`}
  //       >
  //         <Calendar className="w-4 h-4 opacity-60 shrink-0" />
  //         <span className="text-sm truncate flex-1">{label}</span>
  //         <ChevronDown
  //           className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
  //         />
  //       </button>

  //       <AnimatePresence>
  //         {open && (
  //           <motion.div
  //             initial={{ opacity: 0, y: -6 }}
  //             animate={{ opacity: 1, y: 0 }}
  //             exit={{ opacity: 0, y: -6 }}
  //             className={`absolute z-30 mt-2 w-[26rem] rounded-xl border shadow-2xl p-6 ${
  //               dark ? 'bg-slate-900 border-white/20' : 'bg-white border-gray-200'
  //             }`}
  //           >
  //             <div className="grid grid-cols-3 gap-2 mb-5">
  //               {DATE_PRESETS.map((p) => {
  //                 const [f, t] = p.get();
  //                 const active = f === fromDate && t === toDate;
  //                 return (
  //                   <button
  //                     key={p.label}
  //                     type="button"
  //                     onClick={() => {
  //                       onChange(f, t);
  //                       setOpen(false);
  //                     }}
  //                     className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
  //                       active
  //                         ? 'bg-blue-500 text-white'
  //                         : dark
  //                           ? 'bg-white/10 hover:bg-white/20 text-white'
  //                           : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
  //                     }`}
  //                   >
  //                     {p.label}
  //                   </button>
  //                 );
  //               })}
  //             </div>

  //             <div
  //               className={`text-xs font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-white/40' : 'text-gray-400'}`}
  //             >
  //               Custom range
  //             </div>
  //             <div className="flex items-center gap-2">
  //               <div
  //                 onClick={() => openPicker(fromRef)}
  //                 className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer ${
  //                   dark
  //                     ? 'bg-white/10 border-white/20 hover:bg-white/15'
  //                     : 'bg-white border-gray-300 hover:bg-gray-50'
  //                 }`}
  //               >
  //                 <Calendar
  //                   className={`w-3.5 h-3.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}
  //                 />
  //                 <input
  //                   ref={fromRef}
  //                   type="date"
  //                   value={fromDate}
  //                   max={toDate}
  //                   onChange={(e) => onChange(e.target.value, toDate)}
  //                   className={`w-full bg-transparent text-sm outline-none cursor-pointer ${dark ? 'text-white' : 'text-gray-900'}`}
  //                 />
  //               </div>
  //               <span className={dark ? 'text-white/40' : 'text-gray-400'}>
  //                 –
  //               </span>
  //               <div
  //                 onClick={() => openPicker(toRef)}
  //                 className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer ${
  //                   dark
  //                     ? 'bg-white/10 border-white/20 hover:bg-white/15'
  //                     : 'bg-white border-gray-300 hover:bg-gray-50'
  //                 }`}
  //               >
  //                 <Calendar
  //                   className={`w-3.5 h-3.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}
  //                 />
  //                 <input
  //                   ref={toRef}
  //                   type="date"
  //                   value={toDate}
  //                   min={fromDate}
  //                   max={TODAY}
  //                   onChange={(e) => onChange(fromDate, e.target.value)}
  //                   className={`w-full bg-transparent text-sm outline-none cursor-pointer ${dark ? 'text-white' : 'text-gray-900'}`}
  //                 />
  //               </div>
  //             </div>
  //           </motion.div>
  //         )}
  //       </AnimatePresence>
  //     </div>
  //   );
};

// ---------------------------------------------------------------------------
// Alert detail modal — fetches the full record (info / details / history) for
// the clicked alert_id and renders it as a tabbed, elegant popup.
// ---------------------------------------------------------------------------

type DetailTab = 'overview' | 'transactions' | 'history';

const AlertDetailModal: React.FC<{
  alert: FraudAlert;
  dark: boolean;
  onClose: () => void;
}> = ({ alert, dark, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [detail, setDetail] = useState<AlertDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(
    null
  );

  // Prevent the page behind the modal from scrolling while it's open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Fetch the full detail payload for this alert_id.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    setActiveTab('overview');

    apiClient
      .get<AlertDetailResponse>(ALERT_DETAIL_ENDPOINT(alert.alert_id), {
        signal: controller.signal,
      })
      .then((res) => {
        if (!cancelled) setDetail(res.data);
      })
      .catch((err: any) => {
        if (
          cancelled ||
          err?.name === 'CanceledError' ||
          err?.name === 'AbortError'
        )
          return;
        console.error('Error fetching alert detail:', err);
        setDetailError(
          'Could not load the full alert record. Showing what we have from the list.'
        );
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [alert.alert_id]);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(alert.alert_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  // The list row and the detail API describe overlapping but different
  // fields — merge them, preferring the richer detail payload once it loads.
  const info = detail?.info;
  const effective = useMemo(
    () => ({
      ruleDescription: info?.rule_description || alert.rule_description,
      rulePriority: info?.rule_priority || alert.rule_priority,
      ruleId: info?.rule_id || alert.rule_id,
      comments: info?.comments ?? alert.comments,
      isClosed: info?.is_alert_closed ?? alert.is_alert_closed,
      branch: info?.branch_name || alert.branch_name,
      processedBy: info?.created_user_full_name || alert.created_user_full_name,
      alertDate: info?.alert_date || alert.created_date,
      llmConfigs: info?.llm_configs,
    }),
    [info, alert]
  );

  const {
    summary,
    details: commentDetails,
    logic,
  } = useMemo(
    () => parseComment(effective.comments || ''),
    [effective.comments]
  );

  const llmConfigEntries = useMemo(
    () => Object.entries(effective.llmConfigs ?? {}),
    [effective.llmConfigs]
  );

  const transactions = detail?.details ?? [];
  const history = detail?.history ?? [];

  const fieldLabel = dark ? 'text-white/40' : 'text-gray-400';
  const fieldValue = dark ? 'text-white/90' : 'text-gray-800';
  const cardBase = dark
    ? 'bg-white/5 border-white/10'
    : 'bg-gray-50 border-gray-100';

  const TabButton: React.FC<{
    tab: DetailTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = ({ tab, label, icon, count }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        activeTab === tab
          ? dark
            ? 'border-rose-400 text-white'
            : 'border-rose-500 text-gray-900'
          : dark
            ? 'border-transparent text-white/50 hover:text-white/80'
            : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      {icon}
      {label}
      {typeof count === 'number' && (
        <span
          className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
            activeTab === tab
              ? dark
                ? 'bg-rose-500/20 text-rose-300'
                : 'bg-rose-100 text-rose-700'
              : dark
                ? 'bg-white/10 text-white/50'
                : 'bg-gray-100 text-gray-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:w-[80vw] sm:max-w-[1400px] max-h-[88vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col ${
          dark ? 'bg-slate-900 border-white/15' : 'bg-white border-gray-200'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-5 border-b flex items-start justify-between gap-4 shrink-0 ${
            dark ? 'border-white/10' : 'border-gray-100'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shrink-0 shadow-md bg-gradient-to-br ${
                effective.rulePriority?.toLowerCase() === 'high'
                  ? 'from-rose-500 to-red-600'
                  : effective.rulePriority?.toLowerCase() === 'medium'
                    ? 'from-amber-500 to-orange-600'
                    : 'from-blue-500 to-indigo-600'
              }`}
            >
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className={`text-base font-bold truncate ${dark ? 'text-white' : 'text-gray-900'}`}
                >
                  {effective.ruleDescription}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wide ${priorityStyles(effective.rulePriority, dark)}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${priorityDot(effective.rulePriority)}`}
                  />
                  {effective.rulePriority}
                </span>
              </div>
              <div
                className={`mt-1 flex items-center gap-1.5 text-xs font-mono ${dark ? 'text-white/40' : 'text-gray-400'}`}
              >
                <Hash className="w-3 h-3" />
                {effective.ruleId}
                <span className="mx-1">·</span>
                <button
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 hover:underline"
                  title="Copy alert ID"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {alert.alert_id.slice(0, 8)}…
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg shrink-0 ${dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Close (Esc)"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className={`flex items-center gap-1 px-6 border-b overflow-x-auto shrink-0 ${
            dark ? 'border-white/10' : 'border-gray-100'
          }`}
        >
          <TabButton
            tab="overview"
            label="Overview"
            icon={<Info className="w-3.5 h-3.5" />}
          />
          <TabButton
            tab="transactions"
            label="Transactions"
            icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            count={detail ? transactions.length : undefined}
          />
          <TabButton
            tab="history"
            label="History"
            icon={<History className="w-3.5 h-3.5" />}
            count={detail ? history.length : undefined}
          />
        </div>

        {/* Error banner (applies to any tab) */}
        {detailError && (
          <div
            className={`mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm shrink-0 ${
              dark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>{detailError}</span>
          </div>
        )}

        {/* Body — fixed height so switching tabs doesn't resize the modal;
            each tab scrolls independently within this region. */}
        <div className="h-[58vh] px-6">
          {/* -------------------------------- Overview -------------------------------- */}
          {activeTab === 'overview' && (
            <div className="h-full overflow-y-auto overscroll-contain py-5 pr-1 space-y-5">
              {/* Status chips */}
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusStyles(alert.status, dark)}`}
                >
                  <Radio className="w-3 h-3" />
                  {alert.status}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
                    effective.isClosed
                      ? dark
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : dark
                        ? 'bg-white/10 text-white/70 border-white/20'
                        : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                >
                  {effective.isClosed ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <Unlock className="w-3 h-3" />
                  )}
                  {effective.isClosed ? 'Closed' : 'Open'}
                </span>
                {alert.is_fraud && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
                      dark
                        ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
                        : 'bg-rose-50 text-rose-700 border-rose-300'
                    }`}
                  >
                    <Flag className="w-3 h-3" />
                    Fraud confirmed
                  </span>
                )}
              </div>

              {/* Key/value grid */}
              <div
                className={`grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 rounded-xl border p-4 ${cardBase}`}
              >
                <div>
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${fieldLabel}`}
                  >
                    Cashier
                  </div>
                  <div className={`text-sm font-medium ${fieldValue}`}>
                    {alert.cashier}
                  </div>
                </div>
                <div>
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${fieldLabel}`}
                  >
                    Processed by
                  </div>
                  <div className={`text-sm font-medium ${fieldValue}`}>
                    {effective.processedBy}
                  </div>
                </div>
                <div>
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${fieldLabel}`}
                  >
                    Branch
                  </div>
                  <div className={`text-sm font-medium ${fieldValue}`}>
                    {effective.branch}
                  </div>
                </div>
                <div>
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${fieldLabel}`}
                  >
                    Channel
                  </div>
                  <div className={`text-sm font-medium ${fieldValue}`}>
                    {alert.channel}
                  </div>
                </div>
                <div>
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${fieldLabel}`}
                  >
                    Created
                  </div>
                  <div className={`text-sm font-medium ${fieldValue}`}>
                    {formatDate(alert.created_at_timestamp)}
                  </div>
                  <div className={`text-xs ${fieldLabel}`}>
                    {formatTime(alert.created_at_timestamp)} ·{' '}
                    {timeAgo(alert.created_at_timestamp)}
                  </div>
                </div>
                <div>
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${fieldLabel}`}
                  >
                    Rule
                  </div>
                  <div
                    className={`text-sm font-mono font-medium ${fieldValue}`}
                  >
                    {effective.ruleId}
                  </div>
                </div>
              </div>

              {/* Alert narrative */}
              <div>
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide mb-2 ${fieldLabel}`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Alert summary
                </div>
                <p className={`text-sm leading-relaxed ${fieldValue}`}>
                  {summary}
                </p>
                {commentDetails.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {commentDetails.map((d, i) => (
                      <li
                        key={i}
                        className={`text-sm flex items-start gap-2 ${dark ? 'text-white/70' : 'text-gray-600'}`}
                      >
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-current shrink-0 opacity-60" />
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Rule logic callout */}
              {logic && (
                <div
                  className={`rounded-xl border p-4 flex gap-3 ${
                    dark
                      ? 'bg-indigo-500/10 border-indigo-500/30'
                      : 'bg-indigo-50 border-indigo-200'
                  }`}
                >
                  <Info
                    className={`w-4 h-4 mt-0.5 shrink-0 ${dark ? 'text-indigo-300' : 'text-indigo-600'}`}
                  />
                  <div>
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-indigo-300' : 'text-indigo-600'}`}
                    >
                      Rule logic
                    </div>
                    <p
                      className={`text-sm leading-relaxed ${dark ? 'text-indigo-100/90' : 'text-indigo-900'}`}
                    >
                      {logic}
                    </p>
                  </div>
                </div>
              )}

              {/* Rule parameters — dynamic, key/value shape varies per rule */}
              {detailLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-9 rounded-lg animate-pulse ${dark ? 'bg-white/5' : 'bg-gray-100'}`}
                    />
                  ))}
                </div>
              ) : (
                llmConfigEntries.length > 0 && (
                  <div>
                    <div
                      className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide mb-2 ${fieldLabel}`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Rule parameters
                    </div>
                    <div
                      className={`rounded-xl border overflow-hidden ${dark ? 'border-white/10' : 'border-gray-100'}`}
                    >
                      <table className="w-full">
                        <tbody>
                          {llmConfigEntries.map(([key, value], i) => (
                            <tr
                              key={key}
                              className={`${i % 2 === 1 ? (dark ? 'bg-white/[0.03]' : 'bg-gray-50') : ''} ${
                                i > 0
                                  ? `border-t ${dark ? 'border-white/10' : 'border-gray-100'}`
                                  : ''
                              }`}
                            >
                              <td
                                className={`px-4 py-2 text-sm font-medium w-1/2 ${dark ? 'text-white/70' : 'text-gray-600'}`}
                              >
                                {humanizeKey(key)}
                              </td>
                              <td
                                className={`px-4 py-2 text-sm font-mono ${fieldValue}`}
                              >
                                {formatDynamicValue(value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* ----------------------------- Transactions ----------------------------- */}
          {activeTab === 'transactions' && (
            <div className="h-full py-5">
              {detailLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-12 rounded-lg animate-pulse ${dark ? 'bg-white/5' : 'bg-gray-100'}`}
                    />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <ArrowLeftRight
                    className={`w-10 h-10 mx-auto mb-3 ${dark ? 'text-white/20' : 'text-gray-300'}`}
                  />
                  <p
                    className={`text-sm font-medium ${dark ? 'text-white/70' : 'text-gray-600'}`}
                  >
                    No linked transactions
                  </p>
                </div>
              ) : (
                <div
                  className={`h-full rounded-xl border overflow-auto overscroll-contain ${dark ? 'border-white/10' : 'border-gray-100'}`}
                >
                  <table className="w-full">
                    <thead
                      className={`sticky top-0 z-10 backdrop-blur-sm ${dark ? 'bg-slate-900/95' : 'bg-gray-50/95'}`}
                    >
                      <tr>
                        {[
                          'Date / time',
                          'Reference',
                          'Customer',
                          'Beneficiary',
                          'Amount',
                          'Employee txn',
                        ].map((h) => (
                          <th
                            key={h}
                            className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap border-b ${
                              dark
                                ? 'text-white/50 border-white/10'
                                : 'text-gray-500 border-gray-100'
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t, i) => (
                        <tr
                          key={t.row_id}
                          className={`${i > 0 ? `border-t ${dark ? 'border-white/10' : 'border-gray-100'}` : ''}`}
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className={`text-sm ${fieldValue}`}>
                              {t.txn_date ? formatDate(t.txn_date) : '—'}
                            </div>
                            <div className={`text-xs ${fieldLabel}`}>
                              {t.txn_date ? formatTime(t.txn_date) : ''}
                            </div>
                          </td>
                          <td
                            className={`px-4 py-2.5 text-sm font-mono whitespace-nowrap ${fieldValue}`}
                          >
                            {String(t.refno_send_receive ?? '—')}
                          </td>
                          <td className="px-4 py-2.5 max-w-[200px]">
                            <div
                              className={`text-sm truncate ${fieldValue}`}
                              title={String(t.customer_name ?? '')}
                            >
                              {String(t.customer_name ?? '—')}
                            </div>
                            <div className={`text-xs ${fieldLabel}`}>
                              {String(t.customer_type ?? '')}
                            </div>
                          </td>
                          <td
                            className={`px-4 py-2.5 text-sm whitespace-nowrap ${fieldValue}`}
                          >
                            {String(t.beneficiary_name ?? '—')}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap ${fieldValue}`}
                          >
                            {formatAmount(
                              t.amt_aed as number | undefined,
                              t.curcode as string | undefined
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                                t.is_employee_txn
                                  ? dark
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-amber-50 text-amber-700'
                                  : dark
                                    ? 'bg-white/10 text-white/50'
                                    : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {t.is_employee_txn ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* -------------------------------- History -------------------------------- */}
          {activeTab === 'history' && (
            <div className="h-full py-5">
              {detailLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-14 rounded-lg animate-pulse ${dark ? 'bg-white/5' : 'bg-gray-100'}`}
                    />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <History
                    className={`w-10 h-10 mx-auto mb-3 ${dark ? 'text-white/20' : 'text-gray-300'}`}
                  />
                  <p
                    className={`text-sm font-medium ${dark ? 'text-white/70' : 'text-gray-600'}`}
                  >
                    No history recorded yet
                  </p>
                </div>
              ) : (
                <div
                  className={`h-full overflow-y-auto overscroll-contain rounded-xl border divide-y ${
                    dark
                      ? 'border-white/10 divide-white/10'
                      : 'border-gray-100 divide-gray-100'
                  }`}
                >
                  {history.map((h, index) => {
                    const isExpanded = expandedHistoryId === index;
                    const { paragraphs, grid } = splitHistoryFields(h);
                    const hasMore = paragraphs.length > 0 || grid.length > 0;
                    return (
                      <div key={h.id ?? index}>
                        <button
                          onClick={() =>
                            setExpandedHistoryId(isExpanded ? null : index)
                          }
                          className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                            dark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                String(h.risk_category ?? '').toLowerCase() ===
                                'high'
                                  ? 'bg-rose-500'
                                  : String(
                                        h.risk_category ?? ''
                                      ).toLowerCase() === 'medium'
                                    ? 'bg-amber-500'
                                    : String(
                                          h.risk_category ?? ''
                                        ).toLowerCase() === 'low'
                                      ? 'bg-blue-500'
                                      : 'bg-gray-400'
                              }`}
                            />
                            <div className="min-w-0">
                              <div
                                className={`text-sm font-semibold truncate ${dark ? 'text-white' : 'text-gray-900'}`}
                              >
                                {(h.action_type ?? 'ACTION')
                                  .toString()
                                  .replace(/_/g, ' ')}
                                {h.disposition_type
                                  ? ` · ${String(h.disposition_type).replace(/_/g, ' ')}`
                                  : ''}
                              </div>
                              <div className={`text-xs truncate ${fieldLabel}`}>
                                {h.actioned_by ? `by ${h.actioned_by}` : ''}
                                {h.created_at
                                  ? ` · ${formatDate(String(h.created_at))} ${formatTime(String(h.created_at))}`
                                  : ''}
                              </div>
                            </div>
                          </div>
                          {hasMore && (
                            <ChevronRight
                              className={`w-4 h-4 shrink-0 transition-transform ${dark ? 'text-white/40' : 'text-gray-400'} ${
                                isExpanded ? 'rotate-90' : ''
                              }`}
                            />
                          )}
                        </button>
                        <AnimatePresence>
                          {isExpanded && hasMore && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div
                                className={`px-4 pb-4 pt-1 space-y-4 ${dark ? 'bg-white/[0.02]' : 'bg-gray-50/60'}`}
                              >
                                {/* Short fields — rendered as a compact grid, whatever keys this event has */}
                                {grid.length > 0 && (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                    {grid.map((g) => (
                                      <div key={g.label}>
                                        <div
                                          className={`text-[11px] font-semibold uppercase tracking-wide mb-0.5 ${fieldLabel}`}
                                        >
                                          {g.label}
                                        </div>
                                        <div
                                          className={`text-sm ${dark ? 'text-white/85' : 'text-gray-800'}`}
                                        >
                                          {g.value}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Long free-text fields — rendered as paragraphs */}
                                {paragraphs.map((n) => (
                                  <div key={n.label}>
                                    <div
                                      className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${fieldLabel}`}
                                    >
                                      {n.label}
                                    </div>
                                    <p
                                      className={`text-sm leading-relaxed ${dark ? 'text-white/80' : 'text-gray-700'}`}
                                    >
                                      {n.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-3.5 border-t flex items-center justify-between shrink-0 ${
            dark ? 'border-white/10' : 'border-gray-100'
          }`}
        >
          <span className={`text-xs font-mono ${fieldLabel}`}>
            {alert.alert_id}
          </span>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              dark
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AlertListing: React.FC = () => {
  const { theme } = useTheme();
  const { getMenuId } = useMenuIds();
  const dark = theme === 'dark';
  const ALERTS_MENU_ID = getMenuId(MENU_KEY);

  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search, 400);
  const debouncedUsername = useDebouncedValue(filters.username, 400);
  const debouncedLocation = useDebouncedValue(filters.location, 400);
  const searchPending = filters.search !== debouncedSearch;

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const { addNotification } = useNotifications();

  // ---- Dynamic filter facets, built from whatever the API actually returns ----
  interface FilterOptionsResponse {
    statuses: string[];
    priorities: string[];
    channels: string[];
    rules: { id: string; description: string }[];
  }
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResponse>({
    statuses: [],
    priorities: [],
    channels: [],
    rules: [],
  });
  const [filtersLoading, setFiltersLoading] = useState(false);

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Esc closes the modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedAlert) setSelectedAlert(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedAlert]);

  const fetchAlerts = useCallback(
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
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.channel) params.channel = filters.channel;
      if (filters.ruleId) params.rule_id = filters.ruleId;
      if (debouncedLocation) params.location = debouncedLocation;
      if (debouncedUsername) params.username = debouncedUsername;
      if (filters.closed !== 'all')
        params.is_closed = filters.closed === 'true';
      if (filters.fraud !== 'all') params.is_fraud = filters.fraud === 'true';
      //   if (filters.fromDate) params.fromDate = filters.fromDate;
      //   if (filters.toDate) params.toDate = filters.toDate;

      try {
        const response = await apiClient.get<AlertsResponse>(ALERTS_ENDPOINT, {
          params,
          signal: controller.signal,
        });
        const payload = response.data;
        setAlerts(payload.data);
        setTotalRecords(payload.totalRecords);
        setTotalPages(payload.totalPages);
        setUsingFallback(false);
      } catch (err: any) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        console.error('Error fetching fraud alerts:', err);
        setError(
          'Could not reach the alerts service. Showing sample data for design review.'
        );
        setUsingFallback(true);
        setTotalPages(1);
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
      debouncedLocation,
      filters.status,
      filters.priority,
      filters.channel,
      filters.ruleId,
      filters.closed,
      filters.fraud,
      filters.fromDate,
      filters.toDate,
    ]
  );

  const fetchFilterOptions = useCallback(async () => {
    setFiltersLoading(true);
    try {
      const response = await apiClient.get<FilterOptionsResponse>(
        ALERTS_FILTERS_ENDPOINT
      );
      setFilterOptions(response.data);
    } catch (err) {
      console.error('Error fetching filter options:', err);
      // Set default/fallback options or keep empty arrays
      setFilterOptions({
        statuses: [],
        priorities: [],
        channels: [],
        rules: [],
      });
      // Optionally show a notification
      addNotification?.('Could not load filter options', 'warning');
    } finally {
      setFiltersLoading(false);
    }
  }, [addNotification]);

  const statusOptions = useMemo(
    () => [...filterOptions.statuses].sort(),
    [filterOptions.statuses]
  );
  const priorityOptions = useMemo(
    () => [...filterOptions.priorities].sort(),
    [filterOptions.priorities]
  );
  const channelOptions = useMemo(
    () => [...filterOptions.channels].sort(),
    [filterOptions.channels]
  );
  const ruleOptions = useMemo(
    () =>
      [...filterOptions.rules]
        .map((r) => [r.id, r.description] as [string, string])
        .sort(),
    [filterOptions.rules]
  );

  useEffect(() => {
    fetchAlerts();
    return () => abortRef.current?.abort();
  }, [fetchAlerts]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Reset to page 1 whenever a filter (not page/pageSize) changes
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearch,
    debouncedUsername,
    debouncedLocation,
    filters.status,
    filters.priority,
    filters.channel,
    filters.ruleId,
    filters.closed,
    filters.fraud,
    filters.fromDate,
    filters.toDate,
    pageSize,
  ]);

  // Auto-refresh (silent, keeps scroll position)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchAlerts(true), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAlerts]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.channel) n++;
    if (filters.ruleId) n++;
    if (filters.location) n++;
    if (filters.username) n++;
    if (filters.closed !== 'all') n++;
    if (filters.fraud !== 'all') n++;
    return n;
  }, [filters]);

  const panelBase = dark
    ? 'bg-white/5 border-white/20'
    : 'bg-white border-gray-200';
  const inputBase = dark
    ? 'bg-white/10 border border-white/20 text-white placeholder-white/40'
    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400';
  const labelBase = dark ? 'text-white/70' : 'text-gray-600';

  const SortHeader: React.FC<{
    field: SortField;
    label: string;
    className?: string;
  }> = ({ field, label, className }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${
        dark
          ? 'text-white/70 hover:text-white'
          : 'text-gray-500 hover:text-gray-900'
      } ${className ?? ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortBy === field ? (
          sortOrder === 'ASC' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );

  return (
    <PermissionGuard
      menuId={ALERTS_MENU_ID}
      action="view"
      fallback={
        <div
          className={`text-center py-20 ${dark ? 'text-white' : 'text-gray-900'}`}
        >
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">
            You don't have permission to view fraud alerts.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="relative z-30 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl shadow-lg">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}
                >
                  Fraud &amp; Risk Alerts
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
              <p className={dark ? 'text-rose-200/70' : 'text-rose-600'}>
                {totalRecords.toLocaleString()} alerts · search, filter and
                investigate flagged activity
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
              onClick={() => fetchAlerts()}
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
              menuId={ALERTS_MENU_ID}
              action="export"
              fallback={
                <button
                  onClick={() =>
                    addNotification(
                      'You do not have permission to export alerts, contact your administrator.',
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
                          exportCSV(alerts);
                          setExportOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 ${dark ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <FileText className="w-4 h-4" /> Export current page
                        (CSV)
                      </button>
                      <button
                        onClick={() => {
                          exportJSON(alerts);
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  placeholder="Search by comments, cashier, rule…"
                  className={`w-full pl-10 pr-9 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${inputBase}`}
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

            <div className="w-44">
              <label className={`block text-sm font-medium mb-2 ${labelBase}`}>
                Priority
              </label>
              <select
                value={filters.priority}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, priority: e.target.value }))
                }
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${inputBase}`}
                disabled={filtersLoading}
              >
                <option value="">
                  {filtersLoading ? 'Loading...' : 'All statuses'}
                </option>
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-44">
              <label className={`block text-sm font-medium mb-2 ${labelBase}`}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
                className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${inputBase}`}
                disabled={filtersLoading}
              >
                <option value="">
                  {filtersLoading ? 'Loading...' : 'All statuses'}
                </option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-56">
              <label className={`block text-sm font-medium mb-2 ${labelBase}`}>
                Sort by
              </label>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortField)}
                  className={`flex-1 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${inputBase}`}
                >
                  {SORT_FIELDS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'))
                  }
                  className={`px-3 rounded-lg border ${dark ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-700'}`}
                  title={sortOrder === 'ASC' ? 'Ascending' : 'Descending'}
                >
                  {sortOrder === 'ASC' ? (
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
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-rose-500 text-white">
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
                      Rule
                    </label>
                    <select
                      value={filters.ruleId}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, ruleId: e.target.value }))
                      }
                      className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${inputBase}`}
                    >
                      <option value="">All rules</option>
                      {ruleOptions.map(([id, desc]) => (
                        <option key={id} value={id}>
                          {id} — {desc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${labelBase}`}
                    >
                      Channel
                    </label>
                    <select
                      value={filters.channel}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, channel: e.target.value }))
                      }
                      className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${inputBase}`}
                    >
                      <option value="">All channels</option>
                      {channelOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${labelBase}`}
                    >
                      Branch / Location
                    </label>
                    <input
                      type="text"
                      value={filters.location}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, location: e.target.value }))
                      }
                      placeholder="e.g. HEAD OFFICE"
                      className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${inputBase}`}
                    />
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${labelBase}`}
                    >
                      Cashier / User
                    </label>
                    <input
                      type="text"
                      value={filters.username}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, username: e.target.value }))
                      }
                      placeholder="e.g. SADIQUEM"
                      className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${inputBase}`}
                    />
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${labelBase}`}
                    >
                      Closed status
                    </label>
                    <select
                      value={filters.closed}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          closed: e.target.value as TriState,
                        }))
                      }
                      className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${inputBase}`}
                    >
                      <option value="all">All alerts</option>
                      <option value="false">Open only</option>
                      <option value="true">Closed only</option>
                    </select>
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium mb-2 ${labelBase}`}
                    >
                      Fraud flag
                    </label>
                    <select
                      value={filters.fraud}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          fraud: e.target.value as TriState,
                        }))
                      }
                      className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${inputBase}`}
                    >
                      <option value="all">All alerts</option>
                      <option value="true">Fraud confirmed</option>
                      <option value="false">Not fraud</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Table */}
        <div
          className={`rounded-2xl border backdrop-blur-xl overflow-hidden ${panelBase}`}
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
          ) : alerts.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <ShieldCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p
                  className={`text-lg font-medium ${dark ? 'text-white' : 'text-gray-900'}`}
                >
                  No alerts found
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
                    <SortHeader
                      field="rule_priority"
                      label="Priority"
                      className="w-28"
                    />
                    <SortHeader
                      field="rule_id"
                      label="Rule"
                      className="min-w-[200px]"
                    />
                    <th
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${dark ? 'text-white/70' : 'text-gray-500'}`}
                    >
                      Alert Summary
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${dark ? 'text-white/70' : 'text-gray-500'}`}
                    >
                      Cashier
                    </th>
                    <SortHeader
                      field="branch_name"
                      label="Branch"
                      className="whitespace-nowrap"
                    />
                    <SortHeader
                      field="channel"
                      label="Channel"
                      className="whitespace-nowrap"
                    />
                    <SortHeader
                      field="status"
                      label="Status"
                      className="whitespace-nowrap"
                    />
                    <SortHeader
                      field="created_at"
                      label="Created"
                      className="whitespace-nowrap"
                    />
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert, index) => {
                    const { summary } = parseComment(alert.comments);
                    return (
                      <motion.tr
                        key={`${alert.alert_id}-${alert.created_at_timestamp}-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index, 20) * 0.015 }}
                        onClick={() => setSelectedAlert(alert)}
                        className={`border-b cursor-pointer transition-colors group ${
                          dark
                            ? 'border-white/10 hover:bg-white/5'
                            : 'border-gray-100 hover:bg-gray-50'
                        } ${index % 2 === 1 ? (dark ? 'bg-white/[0.02]' : 'bg-gray-50/50') : ''}`}
                      >
                        <td
                          className={`pl-4 pr-2 py-3 border-l-4 ${
                            alert.is_fraud
                              ? dark
                                ? 'border-l-rose-500'
                                : 'border-l-rose-400'
                              : 'border-l-transparent'
                          }`}
                        >
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${priorityStyles(alert.rule_priority, dark)}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${priorityDot(alert.rule_priority)}`}
                            />
                            {alert.rule_priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className={`text-sm font-mono font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}
                          >
                            {alert.rule_id}
                          </div>
                          <div
                            className={`text-xs truncate max-w-[220px] ${dark ? 'text-white/50' : 'text-gray-500'}`}
                            title={alert.rule_description}
                          >
                            {alert.rule_description}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 text-sm max-w-[280px] ${dark ? 'text-white/80' : 'text-gray-700'}`}
                        >
                          <span className="block truncate" title={summary}>
                            {summary}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User
                              className={`w-3.5 h-3.5 shrink-0 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                            />
                            <div>
                              <div
                                className={`text-sm ${dark ? 'text-white/90' : 'text-gray-800'}`}
                              >
                                {alert.cashier}
                              </div>
                              <div
                                className={`text-xs truncate max-w-[140px] ${dark ? 'text-white/40' : 'text-gray-400'}`}
                                title={alert.created_user_full_name}
                              >
                                {alert.created_user_full_name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Building2
                              className={`w-3.5 h-3.5 shrink-0 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                            />
                            <span
                              className={`text-sm whitespace-nowrap ${dark ? 'text-white/80' : 'text-gray-700'}`}
                            >
                              {alert.branch_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                              dark
                                ? 'bg-white/10 text-white/70'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {alert.channel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold w-fit ${statusStyles(alert.status, dark)}`}
                            >
                              {alert.status}
                            </span>
                            {alert.is_fraud && (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold w-fit ${dark ? 'text-rose-300' : 'text-rose-600'}`}
                              >
                                <Flag className="w-3 h-3" />
                                Fraud
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Clock
                              className={`w-3.5 h-3.5 shrink-0 ${dark ? 'text-white/40' : 'text-gray-400'}`}
                            />
                            <div>
                              <div
                                className={`text-sm whitespace-nowrap ${dark ? 'text-white/90' : 'text-gray-800'}`}
                              >
                                {formatDate(alert.created_at_timestamp)}
                              </div>
                              <div
                                className={`text-xs whitespace-nowrap ${dark ? 'text-white/40' : 'text-gray-400'}`}
                              >
                                {formatTime(alert.created_at_timestamp)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <ChevronRight
                            className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${dark ? 'text-white/40' : 'text-gray-400'}`}
                          />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && alerts.length > 0 && (
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
                        const v = Number((e.target as HTMLInputElement).value);
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
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={`p-1.5 rounded-lg disabled:opacity-30 ${dark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedAlert && (
          <AlertDetailModal
            alert={selectedAlert}
            dark={dark}
            onClose={() => setSelectedAlert(null)}
          />
        )}
      </AnimatePresence>
    </PermissionGuard>
  );
};

export default AlertListing;
