import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  User,
  Clock,
  Search,
  SlidersHorizontal,
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
  ClipboardList,
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

// `llm_configs` has no fixed shape — it varies per rule, so it is always
// rendered dynamically from whatever keys/values the API returns.
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
type ViewMode = 'all' | 'wip';
type Density = 'comfortable' | 'compact';

interface FilterState {
  view: ViewMode;
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

type AdvancedFields = Pick<
  FilterState,
  | 'status'
  | 'priority'
  | 'channel'
  | 'ruleId'
  | 'location'
  | 'username'
  | 'closed'
  | 'fraud'
>;

interface FilterOptionsResponse {
  statuses: string[];
  priorities: string[];
  channels: string[];
  rules: { id: string; description: string }[];
}

interface AlertListingProps {
  /**
   * Id of the signed-in user. Wire this from your auth context
   * (e.g. `useAuth().user.id`). It is sent to the back-end with the WIP
   * request; the back-end MUST still resolve the real user from the session
   * token and treat this value as a hint only.
   */
  currentUserId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALERTS_ENDPOINT = '/alerts-summary-master';
const ALERT_DETAIL_ENDPOINT = (alertId: string) =>
  `/alerts-summary-details?alert_id=${encodeURIComponent(alertId)}`;
const ALERTS_FILTERS_ENDPOINT = '/alerts-filters';
// NEW endpoints (back-end work needed — see notes):
const ALERTS_EXPORT_ENDPOINT = '/alerts-summary-export';
const ALERTS_WIP_COUNT_ENDPOINT = '/alerts-wip-count';
const MENU_KEY = 'alert_lists';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];
const AUTO_REFRESH_MS = 30000;
const DENSITY_STORAGE_KEY = 'alerts.listing.density';

const SORT_FIELDS: { key: SortField; label: string }[] = [
  { key: 'created_at', label: 'Created' },
  { key: 'rule_priority', label: 'Priority' },
  { key: 'rule_id', label: 'Rule' },
  { key: 'branch_name', label: 'Branch' },
  { key: 'channel', label: 'Channel' },
  { key: 'status', label: 'Status' },
];

const ADV_DEFAULT: AdvancedFields = {
  status: '',
  priority: '',
  channel: '',
  ruleId: '',
  location: '',
  username: '',
  closed: 'all',
  fraud: 'all',
};

// z-index ladder. Everything that floats above the page is rendered through a
// portal into <body>, so none of it can be trapped under (or fight with) a
// parent stacking context such as a blurred / transformed filter panel.
const Z_POPOVER = 'z-30';
const Z_DRAWER = 'z-[90]';
const Z_MODAL = 'z-[100]';

// ---------------------------------------------------------------------------
// Design tokens (one place for the dark/light class pairs)
// ---------------------------------------------------------------------------

const tokens = (dark: boolean) => ({
  text: dark ? 'text-white' : 'text-gray-900',
  body: dark ? 'text-white/80' : 'text-gray-700',
  muted: dark ? 'text-white/50' : 'text-gray-500',
  faint: dark ? 'text-white/40' : 'text-gray-400',
  line: dark ? 'border-white/10' : 'border-gray-100',
  panel: dark ? 'bg-white/5 border-white/15' : 'bg-white border-gray-200',
  sunken: dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100',
  surface: dark ? 'bg-slate-900 border-white/15' : 'bg-white border-gray-200',
  hover: dark ? 'hover:bg-white/5' : 'hover:bg-gray-50',
  input: dark
    ? 'bg-white/10 border border-white/20 text-white placeholder-white/40'
    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400',
  btn: dark
    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300',
});
type Tokens = ReturnType<typeof tokens>;

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

// Re-render on an interval so relative times ("5m ago") don't go stale.
function useTick(ms: number) {
  const [, setN] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
}

// Shared body-scroll lock (counter based, so stacked/overlapping overlays can't
// restore `overflow` too early or leave the page permanently locked).
let scrollLockCount = 0;
let scrollLockPrev = '';
function useBodyScrollLock() {
  useEffect(() => {
    if (scrollLockCount === 0) {
      scrollLockPrev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLockCount++;
    return () => {
      scrollLockCount--;
      if (scrollLockCount === 0) document.body.style.overflow = scrollLockPrev;
    };
  }, []);
}

// Dialog behaviour: Esc closes, focus moves in, Tab is trapped, focus returns
// to the element that opened it.
function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key === 'Tab' && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      previouslyFocused?.focus?.();
    };
  }, []);

  return ref;
}

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined'
    ? null
    : createPortal(children, document.body);

// Local-time ISO date (YYYY-MM-DD). `toISOString()` is UTC and returns
// "yesterday" for the first hours of the day in UTC+ time zones (e.g. Dubai).
const pad2 = (n: number) => String(n).padStart(2, '0');
const toLocalISODate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => toLocalISODate(new Date());
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalISODate(d);
};

const DATE_PRESETS: { label: string; get: () => [string, string] }[] = [
  { label: 'Today', get: () => [todayISO(), todayISO()] },
  { label: 'Yesterday', get: () => [daysAgoISO(1), daysAgoISO(1)] },
  { label: 'Last 7 days', get: () => [daysAgoISO(6), todayISO()] },
  { label: 'Last 30 days', get: () => [daysAgoISO(29), todayISO()] },
  {
    label: 'This month',
    get: () => {
      const now = new Date();
      return [
        toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
        todayISO(),
      ];
    },
  },
];

const defaultFilters = (): FilterState => ({
  view: 'all',
  ...ADV_DEFAULT,
  fromDate: todayISO(),
  toDate: todayISO(),
});

const isValidDate = (iso?: string) =>
  !!iso && !Number.isNaN(new Date(iso).getTime());

function formatDate(iso?: string) {
  if (!isValidDate(iso)) return '—';
  return new Date(iso as string).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
function formatTime(iso?: string) {
  if (!isValidDate(iso)) return '';
  return new Date(iso as string).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
function timeAgo(iso?: string) {
  if (!isValidDate(iso)) return '';
  const diffSec = Math.floor(
    (Date.now() - new Date(iso as string).getTime()) / 1000
  );
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

function downloadBlob(content: BlobPart, filename: string, type: string) {
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

// CSV cell with formula-injection protection (a cell starting with = + - @
// would execute as a formula when the file is opened in Excel).
const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

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
        .map(csvCell)
        .join(',')
    ),
  ];
  // BOM so Excel renders non-Latin (e.g. Arabic) names correctly.
  downloadBlob(
    `\uFEFF${lines.join('\n')}`,
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
// summary, supporting detail fragments, and the rule "LOGIC" clause.
function parseComment(comment: string | null | undefined): {
  summary: string;
  details: string[];
  logic: string | null;
} {
  const raw = comment ?? '';
  const segments = raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  const logicSeg = segments.find((s) => /^LOGIC:/i.test(s));
  const rest = segments.filter((s) => s !== logicSeg);
  const summary = rest[0] ?? raw;
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

function formatAmount(amount: number | undefined, currency?: string) {
  if (amount === undefined || amount === null || Number.isNaN(amount))
    return '—';
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

// "daily_threshold_count" -> "Daily Threshold Count"
function humanizeKey(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDynamicValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (Array.isArray(value))
    return value.map((v) => formatDynamicValue(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// History rows vary a lot by event type, so only the compact row header is
// assumed; everything else is surfaced dynamically (long text -> paragraphs,
// short values -> label/value grid).
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

// Single place that turns UI state into API query params (used by the list
// fetch AND the server-side export, so they can never drift apart).
function buildFilterParams(
  f: FilterState,
  search: string,
  userId?: string
): Record<string, string | number | boolean> {
  const p: Record<string, string | number | boolean> = {};
  if (search) p.search = search;
  if (f.status) p.status = f.status;
  if (f.priority) p.priority = f.priority;
  if (f.channel) p.channel = f.channel;
  if (f.ruleId) p.rule_id = f.ruleId;
  if (f.location) p.location = f.location;
  if (f.username) p.username = f.username;
  if (f.closed !== 'all') p.is_closed = f.closed === 'true';
  if (f.fraud !== 'all') p.is_fraud = f.fraud === 'true';

  if (f.view === 'wip') {
    // WIP is the user's backlog regardless of when the alert was raised, so the
    // date range is deliberately NOT sent — otherwise the default "Today" range
    // would hide older items that are still in progress.
    p.wip = true;
    if (userId) p.user_id = userId;
  } else {
    if (f.fromDate) p.fromDate = f.fromDate;
    if (f.toDate) p.toDate = f.toDate;
  }
  return p;
}

// ---------------------------------------------------------------------------
// Small shared UI pieces
// ---------------------------------------------------------------------------

const Field: React.FC<{
  label: string;
  t: Tokens;
  children: React.ReactNode;
}> = ({ label, t, children }) => (
  <div>
    <div
      className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${t.faint}`}
    >
      {label}
    </div>
    {children}
  </div>
);

const Skeleton: React.FC<{ rows: number; h: string; dark: boolean }> = ({
  rows,
  h,
  dark,
}) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className={`${h} rounded-lg animate-pulse ${dark ? 'bg-white/5' : 'bg-gray-100'}`}
        style={{ animationDelay: `${i * 60}ms` }}
      />
    ))}
  </div>
);

function Segmented<T extends string>({
  value,
  options,
  onChange,
  dark,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  dark: boolean;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex rounded-lg p-0.5 ${dark ? 'bg-white/10' : 'bg-gray-100'}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
            value === o.value
              ? dark
                ? 'bg-white/20 text-white'
                : 'bg-white text-gray-900 shadow-sm'
              : dark
                ? 'text-white/60 hover:text-white'
                : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SortTh: React.FC<{
  field: SortField;
  label: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  dark: boolean;
  onSort: (f: SortField) => void;
  className?: string;
}> = ({ field, label, sortBy, sortOrder, dark, onSort, className }) => (
  <th
    aria-sort={
      sortBy === field
        ? sortOrder === 'ASC'
          ? 'ascending'
          : 'descending'
        : 'none'
    }
    className={`px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${className ?? ''}`}
  >
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 uppercase tracking-wide ${
        dark
          ? 'text-white/70 hover:text-white'
          : 'text-gray-500 hover:text-gray-900'
      }`}
    >
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
    </button>
  </th>
);

// ---------------------------------------------------------------------------
// Date range field — presets + native pickers, local-time safe
// ---------------------------------------------------------------------------

const DateRangeField: React.FC<{
  fromDate: string;
  toDate: string;
  dark: boolean;
  disabled?: boolean;
  onChange: (from: string, to: string) => void;
}> = ({ fromDate, toDate, dark, disabled, onChange }) => {
  const t = tokens(dark);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const activePreset = DATE_PRESETS.find((p) => {
    const [f, to] = p.get();
    return f === fromDate && to === toDate;
  });

  const short = (iso: string, withYear: boolean) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' as const } : {}),
    });

  const label = activePreset
    ? activePreset.label
    : fromDate === toDate
      ? short(fromDate, true)
      : `${short(fromDate, false)} – ${short(toDate, true)}`;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          disabled
            ? 'Date range is not applied in the My WIP view'
            : 'Choose date range'
        }
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm min-w-[170px] disabled:opacity-40 disabled:cursor-not-allowed ${t.input}`}
      >
        <Calendar className="w-4 h-4 shrink-0 text-gray-400" />
        <span className="flex-1 text-left truncate">
          {disabled ? 'All dates' : label}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Date range"
          className={`absolute left-0 top-full mt-1.5 w-72 rounded-xl border shadow-2xl p-3 ${Z_POPOVER} ${t.surface}`}
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const [f, to] = p.get();
                  onChange(f, to);
                  setOpen(false);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  activePreset?.label === p.label
                    ? dark
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-rose-50 text-rose-700 border-rose-300'
                    : t.btn
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className={`text-[11px] font-semibold uppercase ${t.faint}`}>
              From
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) onChange(v, v > toDate ? v : toDate);
                }}
                style={{ colorScheme: dark ? 'dark' : 'light' }}
                className={`mt-1 w-full px-2 py-1.5 rounded-lg text-sm normal-case ${t.input}`}
              />
            </label>
            <label className={`text-[11px] font-semibold uppercase ${t.faint}`}>
              To
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) onChange(v < fromDate ? v : fromDate, v);
                }}
                style={{ colorScheme: dark ? 'dark' : 'light' }}
                className={`mt-1 w-full px-2 py-1.5 rounded-lg text-sm normal-case ${t.input}`}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Advanced filters — right-hand drawer, rendered in a portal. Edits are held
// in a draft and only applied on "Apply", so typing never triggers a refetch.
// ---------------------------------------------------------------------------

const FilterDrawer: React.FC<{
  dark: boolean;
  initial: AdvancedFields;
  options: {
    statuses: string[];
    priorities: string[];
    channels: string[];
    rules: [string, string][];
  };
  loading: boolean;
  onApply: (next: AdvancedFields) => void;
  onClose: () => void;
}> = ({ dark, initial, options, loading, onApply, onClose }) => {
  const t = tokens(dark);
  const [draft, setDraft] = useState<AdvancedFields>(initial);
  const dialogRef = useDialog(onClose);
  useBodyScrollLock();

  const set = <K extends keyof AdvancedFields>(k: K, v: AdvancedFields[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const selectCls = `w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 ${t.input}`;
  const labelCls = `block text-xs font-semibold uppercase tracking-wide mb-1.5 ${t.muted}`;
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onApply(draft);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className={`fixed inset-0 ${Z_DRAWER} bg-black/50 backdrop-blur-[2px]`}
    >
      <motion.aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Advanced filters"
        tabIndex={-1}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className={`absolute right-0 top-0 h-full w-full sm:w-[400px] border-l shadow-2xl flex flex-col outline-none ${t.surface}`}
      >
        <div
          className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${t.line}`}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className={`w-4 h-4 ${t.muted}`} />
            <h3 className={`text-base font-bold ${t.text}`}>Filters</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close filters"
            className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-6">
          <section className="space-y-4">
            <div className={`text-[11px] font-bold uppercase ${t.faint}`}>
              Alert
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select
                value={draft.priority}
                onChange={(e) => set('priority', e.target.value)}
                disabled={loading}
                className={selectCls}
              >
                <option value="">
                  {loading ? 'Loading…' : 'All priorities'}
                </option>
                {options.priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={draft.status}
                onChange={(e) => set('status', e.target.value)}
                disabled={loading}
                className={selectCls}
              >
                <option value="">
                  {loading ? 'Loading…' : 'All statuses'}
                </option>
                {options.statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Rule</label>
              <select
                value={draft.ruleId}
                onChange={(e) => set('ruleId', e.target.value)}
                disabled={loading}
                className={selectCls}
              >
                <option value="">All rules</option>
                {options.rules.map(([id, desc]) => (
                  <option key={id} value={id}>
                    {id} — {desc}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Channel</label>
              <select
                value={draft.channel}
                onChange={(e) => set('channel', e.target.value)}
                disabled={loading}
                className={selectCls}
              >
                <option value="">All channels</option>
                {options.channels.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-4">
            <div className={`text-[11px] font-bold uppercase ${t.faint}`}>
              Who &amp; where
            </div>
            <div>
              <label className={labelCls}>Branch / Location</label>
              <input
                type="text"
                value={draft.location}
                onChange={(e) => set('location', e.target.value)}
                onKeyDown={onEnter}
                placeholder="e.g. HEAD OFFICE"
                className={selectCls}
              />
            </div>
            <div>
              <label className={labelCls}>Cashier / User</label>
              <input
                type="text"
                value={draft.username}
                onChange={(e) => set('username', e.target.value)}
                onKeyDown={onEnter}
                placeholder="e.g. SADIQUEM"
                className={selectCls}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className={`text-[11px] font-bold uppercase ${t.faint}`}>
              State
            </div>
            <div>
              <label className={labelCls}>Closed status</label>
              <Segmented<TriState>
                dark={dark}
                ariaLabel="Closed status"
                value={draft.closed}
                onChange={(v) => set('closed', v)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'false', label: 'Open' },
                  { value: 'true', label: 'Closed' },
                ]}
              />
            </div>
            <div>
              <label className={labelCls}>Fraud flag</label>
              <Segmented<TriState>
                dark={dark}
                ariaLabel="Fraud flag"
                value={draft.fraud}
                onChange={(v) => set('fraud', v)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'true', label: 'Fraud' },
                  { value: 'false', label: 'Not fraud' },
                ]}
              />
            </div>
          </section>
        </div>

        <div
          className={`px-5 py-3.5 border-t flex items-center justify-between gap-3 shrink-0 ${t.line}`}
        >
          <button
            type="button"
            onClick={() => setDraft(ADV_DEFAULT)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${t.btn}`}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white"
          >
            Apply filters
          </button>
        </div>
      </motion.aside>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Alert detail modal — portaled, fixed layout, prev/next triage navigation
// ---------------------------------------------------------------------------

type DetailTab = 'overview' | 'transactions' | 'history';

const TabButton: React.FC<{
  active: boolean;
  dark: boolean;
  label: string;
  icon: React.ReactNode;
  count?: number;
  onClick: () => void;
}> = ({ active, dark, label, icon, count, onClick }) => (
  <button
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      active
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
          active
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

const AlertDetailModal: React.FC<{
  alert: FraudAlert;
  dark: boolean;
  position?: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}> = ({ alert, dark, position, onPrev, onNext, onClose }) => {
  const t = tokens(dark);
  const dialogRef = useDialog(onClose);
  useBodyScrollLock();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [detail, setDetail] = useState<AlertDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(
    null
  );

  // ←/→ move between alerts in the current list (when not typing in a field).
  const navRef = useRef({ onPrev, onNext });
  navRef.current = { onPrev, onNext };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') navRef.current.onPrev?.();
      if (e.key === 'ArrowRight') navRef.current.onNext?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    setActiveTab('overview');
    setExpandedHistoryId(null);

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
          err?.name === 'AbortError' ||
          err?.code === 'ERR_CANCELED'
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

  // Merge list row + detail payload, preferring the richer detail once loaded.
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
      llmConfigs: info?.llm_configs,
    }),
    [info, alert]
  );

  const {
    summary,
    details: commentDetails,
    logic,
  } = useMemo(() => parseComment(effective.comments), [effective.comments]);

  const llmConfigEntries = useMemo(
    () => Object.entries(effective.llmConfigs ?? {}),
    [effective.llmConfigs]
  );

  const transactions = detail?.details ?? [];
  const history = detail?.history ?? [];
  const prio = (effective.rulePriority || '').toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
      className={`fixed inset-0 ${Z_MODAL} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Alert ${alert.alert_id}`}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:w-[80vw] sm:max-w-[1400px] h-[min(88vh,860px)] overflow-hidden rounded-2xl border shadow-2xl flex flex-col outline-none ${t.surface}`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-start justify-between gap-4 shrink-0 ${t.line}`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shrink-0 shadow-md bg-gradient-to-br ${
                prio === 'high'
                  ? 'from-rose-500 to-red-600'
                  : prio === 'medium'
                    ? 'from-amber-500 to-orange-600'
                    : 'from-blue-500 to-indigo-600'
              }`}
            >
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`text-base font-bold truncate ${t.text}`}>
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
                className={`mt-1 flex items-center gap-1.5 text-xs font-mono ${t.faint}`}
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
            aria-label="Close (Esc)"
            title="Close (Esc)"
            className={`p-1.5 rounded-lg shrink-0 ${dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          className={`flex items-center gap-1 px-6 border-b overflow-x-auto shrink-0 ${t.line}`}
        >
          <TabButton
            dark={dark}
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            label="Overview"
            icon={<Info className="w-3.5 h-3.5" />}
          />
          <TabButton
            dark={dark}
            active={activeTab === 'transactions'}
            onClick={() => setActiveTab('transactions')}
            label="Transactions"
            icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            count={detail ? transactions.length : undefined}
          />
          <TabButton
            dark={dark}
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            label="History"
            icon={<History className="w-3.5 h-3.5" />}
            count={detail ? history.length : undefined}
          />
        </div>

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

        {/* Body — fills remaining height; each tab scrolls independently */}
        <div className="flex-1 min-h-0 px-6">
          {/* ------------------------------ Overview ------------------------------ */}
          {activeTab === 'overview' && (
            <div className="h-full overflow-y-auto overscroll-contain py-5 pr-1 space-y-5">
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

              <div
                className={`grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 rounded-xl border p-4 ${t.sunken}`}
              >
                <Field label="Cashier" t={t}>
                  <div
                    className={`text-sm font-medium ${dark ? 'text-white/90' : 'text-gray-800'}`}
                  >
                    {alert.cashier}
                  </div>
                </Field>
                <Field label="Processed by" t={t}>
                  <div
                    className={`text-sm font-medium ${dark ? 'text-white/90' : 'text-gray-800'}`}
                  >
                    {effective.processedBy}
                  </div>
                </Field>
                <Field label="Branch" t={t}>
                  <div
                    className={`text-sm font-medium ${dark ? 'text-white/90' : 'text-gray-800'}`}
                  >
                    {effective.branch}
                  </div>
                </Field>
                <Field label="Channel" t={t}>
                  <div
                    className={`text-sm font-medium ${dark ? 'text-white/90' : 'text-gray-800'}`}
                  >
                    {alert.channel}
                  </div>
                </Field>
                <Field label="Created" t={t}>
                  <div
                    className={`text-sm font-medium ${dark ? 'text-white/90' : 'text-gray-800'}`}
                  >
                    {formatDate(alert.created_at_timestamp)}
                  </div>
                  <div className={`text-xs ${t.faint}`}>
                    {formatTime(alert.created_at_timestamp)} ·{' '}
                    {timeAgo(alert.created_at_timestamp)}
                  </div>
                </Field>
                <Field label="Rule" t={t}>
                  <div
                    className={`text-sm font-mono font-medium ${dark ? 'text-white/90' : 'text-gray-800'}`}
                  >
                    {effective.ruleId}
                  </div>
                </Field>
              </div>

              <div>
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide mb-2 ${t.faint}`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Alert summary
                </div>
                <p
                  className={`text-sm leading-relaxed ${dark ? 'text-white/90' : 'text-gray-800'}`}
                >
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

              {detailLoading ? (
                <Skeleton rows={3} h="h-9" dark={dark} />
              ) : (
                llmConfigEntries.length > 0 && (
                  <div>
                    <div
                      className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide mb-2 ${t.faint}`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Rule parameters
                    </div>
                    <div
                      className={`rounded-xl border overflow-hidden ${t.line}`}
                    >
                      <table className="w-full">
                        <tbody>
                          {llmConfigEntries.map(([key, value], i) => (
                            <tr
                              key={key}
                              className={`${i % 2 === 1 ? (dark ? 'bg-white/[0.03]' : 'bg-gray-50') : ''} ${i > 0 ? `border-t ${t.line}` : ''}`}
                            >
                              <td
                                className={`px-4 py-2 text-sm font-medium w-1/2 ${dark ? 'text-white/70' : 'text-gray-600'}`}
                              >
                                {humanizeKey(key)}
                              </td>
                              <td
                                className={`px-4 py-2 text-sm font-mono ${dark ? 'text-white/90' : 'text-gray-800'}`}
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

          {/* ---------------------------- Transactions ---------------------------- */}
          {activeTab === 'transactions' && (
            <div className="h-full py-5">
              {detailLoading ? (
                <Skeleton rows={4} h="h-12" dark={dark} />
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
                  className={`h-full rounded-xl border overflow-auto overscroll-contain ${t.line}`}
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
                      {transactions.map((tx, i) => (
                        <tr
                          key={tx.row_id}
                          className={i > 0 ? `border-t ${t.line}` : ''}
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div
                              className={`text-sm ${dark ? 'text-white/90' : 'text-gray-800'}`}
                            >
                              {formatDate(tx.txn_date)}
                            </div>
                            <div className={`text-xs ${t.faint}`}>
                              {formatTime(tx.txn_date)}
                            </div>
                          </td>
                          <td
                            className={`px-4 py-2.5 text-sm font-mono whitespace-nowrap ${dark ? 'text-white/90' : 'text-gray-800'}`}
                          >
                            {String(tx.refno_send_receive ?? '—')}
                          </td>
                          <td className="px-4 py-2.5 max-w-[200px]">
                            <div
                              className={`text-sm truncate ${dark ? 'text-white/90' : 'text-gray-800'}`}
                              title={String(tx.customer_name ?? '')}
                            >
                              {String(tx.customer_name ?? '—')}
                            </div>
                            <div className={`text-xs ${t.faint}`}>
                              {String(tx.customer_type ?? '')}
                            </div>
                          </td>
                          <td
                            className={`px-4 py-2.5 text-sm whitespace-nowrap ${dark ? 'text-white/90' : 'text-gray-800'}`}
                          >
                            {String(tx.beneficiary_name ?? '—')}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap tabular-nums ${dark ? 'text-white/90' : 'text-gray-800'}`}
                          >
                            {formatAmount(
                              tx.amt_aed as number | undefined,
                              tx.curcode as string | undefined
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                                tx.is_employee_txn
                                  ? dark
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-amber-50 text-amber-700'
                                  : dark
                                    ? 'bg-white/10 text-white/50'
                                    : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {tx.is_employee_txn ? 'Yes' : 'No'}
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

          {/* ------------------------------ History ------------------------------ */}
          {activeTab === 'history' && (
            <div className="h-full py-5">
              {detailLoading ? (
                <Skeleton rows={3} h="h-14" dark={dark} />
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
                          aria-expanded={isExpanded}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${t.hover}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${priorityDot(String(h.risk_category ?? ''))}`}
                            />
                            <div className="min-w-0">
                              <div
                                className={`text-sm font-semibold truncate ${t.text}`}
                              >
                                {String(h.action_type ?? 'ACTION').replace(
                                  /_/g,
                                  ' '
                                )}
                                {h.disposition_type
                                  ? ` · ${String(h.disposition_type).replace(/_/g, ' ')}`
                                  : ''}
                              </div>
                              <div className={`text-xs truncate ${t.faint}`}>
                                {h.actioned_by ? `by ${h.actioned_by}` : ''}
                                {h.created_at
                                  ? ` · ${formatDate(String(h.created_at))} ${formatTime(String(h.created_at))}`
                                  : ''}
                              </div>
                            </div>
                          </div>
                          {hasMore && (
                            <ChevronRight
                              className={`w-4 h-4 shrink-0 transition-transform ${t.faint} ${isExpanded ? 'rotate-90' : ''}`}
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
                                {grid.length > 0 && (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                    {grid.map((g) => (
                                      <Field
                                        key={g.label}
                                        label={g.label}
                                        t={t}
                                      >
                                        <div
                                          className={`text-sm ${dark ? 'text-white/85' : 'text-gray-800'}`}
                                        >
                                          {g.value}
                                        </div>
                                      </Field>
                                    ))}
                                  </div>
                                )}
                                {paragraphs.map((n) => (
                                  <Field key={n.label} label={n.label} t={t}>
                                    <p
                                      className={`text-sm leading-relaxed ${dark ? 'text-white/80' : 'text-gray-700'}`}
                                    >
                                      {n.text}
                                    </p>
                                  </Field>
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
          className={`px-6 py-3 border-t flex items-center justify-between gap-3 shrink-0 ${t.line}`}
        >
          <span className={`text-xs font-mono truncate ${t.faint}`}>
            {alert.alert_id}
          </span>
          <div className="flex items-center gap-2">
            {position && position.total > 1 && (
              <div
                className="flex items-center gap-1"
                aria-label="Navigate alerts"
              >
                <button
                  onClick={onPrev}
                  disabled={!onPrev}
                  title="Previous alert (←)"
                  aria-label="Previous alert"
                  className={`p-1.5 rounded-lg disabled:opacity-30 ${t.btn}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className={`text-xs tabular-nums px-1 ${t.muted}`}>
                  {position.index + 1} / {position.total}
                </span>
                <button
                  onClick={onNext}
                  disabled={!onNext}
                  title="Next alert (→)"
                  aria-label="Next alert"
                  className={`p-1.5 rounded-lg disabled:opacity-30 ${t.btn}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium ${t.btn}`}
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

const AlertListing: React.FC<AlertListingProps> = ({ currentUserId }) => {
  const { theme } = useTheme();
  const { getMenuId } = useMenuIds();
  const dark = theme === 'dark';
  const t = tokens(dark);
  const ALERTS_MENU_ID = getMenuId(MENU_KEY);
  const { addNotification } = useNotifications();
  useTick(60000);

  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const searchPending = search !== debouncedSearch;
  const searchRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const [density, setDensity] = useState<Density>(() => {
    try {
      return localStorage.getItem(DENSITY_STORAGE_KEY) === 'compact'
        ? 'compact'
        : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const compact = density === 'compact';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [wipCount, setWipCount] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);

  const [filterOptions, setFilterOptions] = useState<FilterOptionsResponse>({
    statuses: [],
    priorities: [],
    channels: [],
    rules: [],
  });
  const [filtersLoading, setFiltersLoading] = useState(false);

  const canUseWip = !!currentUserId;

  // ---- Filter mutation helpers (always reset to page 1) --------------------
  const patchFilters = useCallback((patch: Partial<FilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }, []);

  const clearAll = () => {
    setFilters(defaultFilters());
    setSearch('');
    setPage(1);
  };

  // ---- Data ----------------------------------------------------------------
  const fetchAlerts = useCallback(
    async (silent = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const id = ++requestId.current;

      if (!silent) setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<AlertsResponse>(ALERTS_ENDPOINT, {
          params: {
            page,
            pageSize,
            sortBy,
            sortOrder,
            ...buildFilterParams(filters, debouncedSearch, currentUserId),
          },
          signal: controller.signal,
        });
        if (id !== requestId.current) return; // a newer request superseded this one
        const payload = response.data;
        setAlerts(payload.data);
        setTotalRecords(payload.totalRecords);
        setTotalPages(payload.totalPages);
        setLastUpdated(new Date());
        // Result set shrank (e.g. alerts closed) — don't strand the user on an empty page.
        if (payload.totalPages > 0 && page > payload.totalPages)
          setPage(payload.totalPages);
      } catch (err: any) {
        if (
          err?.name === 'CanceledError' ||
          err?.name === 'AbortError' ||
          err?.code === 'ERR_CANCELED'
        )
          return;
        if (id !== requestId.current) return;
        console.error('Error fetching fraud alerts:', err);
        setError('Could not reach the alerts service.');
        // Never leave stale rows up as if they were current after a manual load;
        // on a silent background refresh keep what's on screen and flag the error.
        if (!silent) {
          setAlerts([]);
          setTotalRecords(0);
          setTotalPages(1);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [page, pageSize, sortBy, sortOrder, filters, debouncedSearch, currentUserId]
  );

  const fetchWipCount = useCallback(async () => {
    if (!currentUserId) {
      setWipCount(null);
      return;
    }
    try {
      const res = await apiClient.get<{ count: number }>(
        ALERTS_WIP_COUNT_ENDPOINT,
        { params: { user_id: currentUserId } }
      );
      setWipCount(typeof res.data?.count === 'number' ? res.data.count : null);
    } catch {
      setWipCount(null); // badge is a convenience; fail silently
    }
  }, [currentUserId]);

  const fetchFilterOptions = useCallback(async () => {
    setFiltersLoading(true);
    try {
      const response = await apiClient.get<FilterOptionsResponse>(
        ALERTS_FILTERS_ENDPOINT
      );
      setFilterOptions(response.data);
    } catch (err) {
      console.error('Error fetching filter options:', err);
      setFilterOptions({
        statuses: [],
        priorities: [],
        channels: [],
        rules: [],
      });
      addNotification?.('Could not load filter options', 'warning');
    } finally {
      setFiltersLoading(false);
    }
  }, [addNotification]);

  const drawerOptions = useMemo(
    () => ({
      statuses: [...filterOptions.statuses].sort(),
      priorities: [...filterOptions.priorities].sort(),
      channels: [...filterOptions.channels].sort(),
      rules: [...filterOptions.rules]
        .map((r) => [r.id, r.description] as [string, string])
        .sort((a, b) => a[0].localeCompare(b[0])),
    }),
    [filterOptions]
  );

  useEffect(() => {
    fetchAlerts();
    return () => abortRef.current?.abort();
  }, [fetchAlerts]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  useEffect(() => {
    fetchWipCount();
  }, [fetchWipCount]);

  // A new search term always starts from page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Page size change also resets to page 1.
  const changePageSize = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  // Auto-refresh (silent; paused while the tab is hidden)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchAlerts(true);
      fetchWipCount();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAlerts, fetchWipCount]);

  // Close export menu on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportOpen]);

  // "/" focuses search (when not already typing somewhere)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/' || selectedAlert || drawerOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedAlert, drawerOpen]);

  // ---- Actions ---------------------------------------------------------------
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };

  const openAlert = (a: FraudAlert) => {
    // Only one overlay at a time — opening a record dismisses the filter drawer
    // and any open menu so they can never stack on top of each other.
    setDrawerOpen(false);
    setExportOpen(false);
    setSelectedAlert(a);
  };

  const toggleDensity = (d: Density) => {
    setDensity(d);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, d);
    } catch {
      /* ignore */
    }
  };

  const handleServerExport = async () => {
    setExportOpen(false);
    setExporting(true);
    try {
      const res = await apiClient.get(ALERTS_EXPORT_ENDPOINT, {
        params: {
          sortBy,
          sortOrder,
          format: 'csv',
          ...buildFilterParams(filters, debouncedSearch, currentUserId),
        },
        responseType: 'blob',
      });
      downloadBlob(res.data, `fraud-alerts-all-${Date.now()}.csv`, 'text/csv');
    } catch (err) {
      console.error('Export failed:', err);
      addNotification?.('Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  // ---- Derived view state ----------------------------------------------------
  const rows = useMemo(
    () => alerts.map((a) => ({ a, summary: parseComment(a.comments).summary })),
    [alerts]
  );

  const selectedIndex = selectedAlert
    ? alerts.findIndex((a) => a.alert_id === selectedAlert.alert_id)
    : -1;

  const chips = useMemo(() => {
    const c: { key: string; label: string; clear: Partial<FilterState> }[] = [];
    if (filters.priority)
      c.push({
        key: 'priority',
        label: `Priority: ${filters.priority}`,
        clear: { priority: '' },
      });
    if (filters.status)
      c.push({
        key: 'status',
        label: `Status: ${filters.status}`,
        clear: { status: '' },
      });
    if (filters.ruleId)
      c.push({
        key: 'rule',
        label: `Rule: ${filters.ruleId}`,
        clear: { ruleId: '' },
      });
    if (filters.channel)
      c.push({
        key: 'channel',
        label: `Channel: ${filters.channel}`,
        clear: { channel: '' },
      });
    if (filters.location)
      c.push({
        key: 'location',
        label: `Branch: ${filters.location}`,
        clear: { location: '' },
      });
    if (filters.username)
      c.push({
        key: 'username',
        label: `User: ${filters.username}`,
        clear: { username: '' },
      });
    if (filters.closed !== 'all')
      c.push({
        key: 'closed',
        label: filters.closed === 'true' ? 'Closed only' : 'Open only',
        clear: { closed: 'all' },
      });
    if (filters.fraud !== 'all')
      c.push({
        key: 'fraud',
        label: filters.fraud === 'true' ? 'Fraud confirmed' : 'Not fraud',
        clear: { fraud: 'all' },
      });
    return c;
  }, [filters]);

  const pad = compact ? 'py-1.5' : 'py-3';
  const anyFilterActive =
    chips.length > 0 || !!search || filters.view !== 'all';

  return (
    <PermissionGuard
      menuId={ALERTS_MENU_ID}
      action="view"
      fallback={
        <div className={`text-center py-20 ${t.text}`}>
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">
            You don't have permission to view fraud alerts.
          </p>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl shadow-lg">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-xl font-bold leading-tight ${t.text}`}>
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
              <p
                className={`text-xs ${dark ? 'text-rose-200/70' : 'text-rose-600'}`}
              >
                {totalRecords.toLocaleString()}{' '}
                {filters.view === 'wip' ? 'items in your queue' : 'alerts'}
                {lastUpdated && (
                  <span className={t.faint}>
                    {' '}
                    · updated{' '}
                    {lastUpdated.toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              aria-pressed={autoRefresh}
              title={
                autoRefresh ? 'Pause auto-refresh' : 'Auto-refresh every 30s'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                autoRefresh
                  ? dark
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : t.btn
              }`}
            >
              {autoRefresh ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {autoRefresh ? 'Live' : 'Auto'}
            </button>

            <button
              onClick={() => {
                fetchAlerts();
                fetchWipCount();
              }}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${t.btn}`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>

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
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg opacity-50 ${
                    dark
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-green-100 text-green-700 border border-green-300'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              }
            >
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  disabled={exporting}
                  aria-haspopup="menu"
                  aria-expanded={exportOpen}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    dark
                      ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                      : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                  }`}
                >
                  {exporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {exportOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className={`absolute right-0 mt-2 w-64 rounded-xl border shadow-2xl overflow-hidden ${Z_POPOVER} ${t.surface}`}
                    >
                      <button
                        role="menuitem"
                        onClick={() => {
                          exportCSV(alerts);
                          setExportOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 ${dark ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <FileText className="w-4 h-4" /> Current page (CSV)
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          exportJSON(alerts);
                          setExportOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 border-t ${t.line} ${dark ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <Layers className="w-4 h-4" /> Current page (JSON)
                      </button>
                      <button
                        role="menuitem"
                        onClick={handleServerExport}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 border-t ${t.line} ${dark ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <Download className="w-4 h-4" /> All{' '}
                        {totalRecords.toLocaleString()} matching (CSV)
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </PermissionGuard>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm ${
              dark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            <WifiOff className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => fetchAlerts()}
              className="font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Toolbar — one compact row. Nothing in here uses a z-index that could
            compete with the portaled overlays. */}
        <div className={`rounded-xl border p-3 ${t.panel}`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search alerts"
                placeholder="Search comments, cashier, rule…   ( / )"
                className={`w-full pl-9 pr-9 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 ${t.input}`}
              />
              {searchPending && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>

            <DateRangeField
              fromDate={filters.fromDate}
              toDate={filters.toDate}
              dark={dark}
              disabled={filters.view === 'wip'}
              onChange={(from, to) =>
                patchFilters({ fromDate: from, toDate: to })
              }
            />

            {/* View switch: All alerts / My WIP */}
            <div
              role="tablist"
              aria-label="Alert view"
              className={`inline-flex rounded-lg p-0.5 ${dark ? 'bg-white/10' : 'bg-gray-100'}`}
            >
              <button
                role="tab"
                aria-selected={filters.view === 'all'}
                onClick={() => patchFilters({ view: 'all' })}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filters.view === 'all'
                    ? dark
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-gray-900 shadow-sm'
                    : dark
                      ? 'text-white/60 hover:text-white'
                      : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                All alerts
              </button>
              <button
                role="tab"
                aria-selected={filters.view === 'wip'}
                disabled={!canUseWip}
                onClick={() => patchFilters({ view: 'wip' })}
                title={
                  canUseWip
                    ? 'Alerts you are currently working on'
                    : 'Your user could not be resolved'
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  filters.view === 'wip'
                    ? dark
                      ? 'bg-rose-500/25 text-rose-200'
                      : 'bg-white text-rose-700 shadow-sm'
                    : dark
                      ? 'text-white/60 hover:text-white'
                      : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                My WIP
                {wipCount !== null && (
                  <span
                    className={`px-1.5 rounded-full text-[11px] font-semibold ${
                      wipCount > 0
                        ? 'bg-rose-500 text-white'
                        : dark
                          ? 'bg-white/10 text-white/50'
                          : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {wipCount > 99 ? '99+' : wipCount}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => setDrawerOpen(true)}
              aria-haspopup="dialog"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${t.btn}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {chips.length > 0 && (
                <span className="px-1.5 rounded-full text-xs bg-rose-500 text-white">
                  {chips.length}
                </span>
              )}
            </button>

            {anyFilterActive && (
              <button
                onClick={clearAll}
                className={`px-2 py-2 text-sm font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Clear all
              </button>
            )}
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {chips.map((c) => (
                <span
                  key={c.key}
                  className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full border text-xs font-medium ${
                    dark
                      ? 'bg-white/10 border-white/20 text-white/80'
                      : 'bg-gray-100 border-gray-200 text-gray-700'
                  }`}
                >
                  {c.label}
                  <button
                    onClick={() => patchFilters(c.clear)}
                    aria-label={`Remove filter ${c.label}`}
                    className={`p-0.5 rounded-full ${dark ? 'hover:bg-white/20' : 'hover:bg-gray-200'}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className={`rounded-xl border overflow-hidden ${t.panel}`}>
          {/* Results bar: sort + density */}
          <div
            className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b ${t.line}`}
          >
            <div className={`text-xs ${t.muted}`}>
              {filters.view === 'wip' ? (
                <span className="inline-flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Showing your work-in-progress alerts across all dates
                </span>
              ) : (
                <>
                  Showing {rows.length.toLocaleString()} of{' '}
                  {totalRecords.toLocaleString()}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-xs ${t.muted}`} htmlFor="alerts-sort">
                Sort
              </label>
              <select
                id="alerts-sort"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortField);
                  setPage(1);
                }}
                className={`px-2 py-1 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 ${t.input}`}
              >
                {SORT_FIELDS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
                  setPage(1);
                }}
                aria-label={sortOrder === 'ASC' ? 'Ascending' : 'Descending'}
                title={sortOrder === 'ASC' ? 'Ascending' : 'Descending'}
                className={`p-1.5 rounded-lg ${t.btn}`}
              >
                {sortOrder === 'ASC' ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
                )}
              </button>
              <div className="w-44">
                <Segmented<Density>
                  dark={dark}
                  ariaLabel="Row density"
                  value={density}
                  onChange={toggleDensity}
                  options={[
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'compact', label: 'Compact' },
                  ]}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-4">
              <Skeleton
                rows={compact ? 12 : 8}
                h={compact ? 'h-9' : 'h-14'}
                dark={dark}
              />
            </div>
          ) : error && alerts.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <p className={`text-lg font-medium ${t.text}`}>
                  Alerts unavailable
                </p>
                <p className={`text-sm mb-3 ${t.muted}`}>
                  We couldn't load alerts right now.
                </p>
                <button
                  onClick={() => fetchAlerts()}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <ShieldCheck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className={`text-lg font-medium ${t.text}`}>
                  {filters.view === 'wip'
                    ? 'Your queue is clear'
                    : 'No alerts found'}
                </p>
                <p className={`text-sm mb-3 ${t.muted}`}>
                  {filters.view === 'wip'
                    ? 'You have no work-in-progress alerts.'
                    : 'Try widening the date range or adjusting your filters.'}
                </p>
                {filters.view === 'wip' && (
                  <button
                    onClick={() => patchFilters({ view: 'all' })}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium ${t.btn}`}
                  >
                    View all alerts
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-330px)] min-h-[320px]">
              <table className="w-full">
                <thead
                  className={`sticky top-0 z-10 border-b backdrop-blur-sm ${dark ? 'border-white/20 bg-slate-900/95' : 'border-gray-200 bg-gray-50/95'}`}
                >
                  <tr>
                    <SortTh
                      field="rule_priority"
                      label="Priority"
                      className="w-28"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <SortTh
                      field="rule_id"
                      label="Alert"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <SortTh
                      field="branch_name"
                      label="Cashier · Branch"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <SortTh
                      field="status"
                      label="Status"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <SortTh
                      field="created_at"
                      label="Created"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <th className="w-8" aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ a, summary }, index) => {
                    const isSelected = selectedAlert?.alert_id === a.alert_id;
                    return (
                      <tr
                        key={`${a.alert_id}-${a.created_at_timestamp}-${index}`}
                        tabIndex={0}
                        aria-label={`Open alert ${a.rule_id}`}
                        onClick={() => openAlert(a)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openAlert(a);
                          }
                        }}
                        className={`border-b cursor-pointer transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500 ${
                          dark
                            ? 'border-white/10 hover:bg-white/5'
                            : 'border-gray-100 hover:bg-gray-50'
                        } ${
                          isSelected
                            ? dark
                              ? 'bg-white/10'
                              : 'bg-rose-50/60'
                            : index % 2 === 1
                              ? dark
                                ? 'bg-white/[0.02]'
                                : 'bg-gray-50/50'
                              : ''
                        }`}
                      >
                        <td
                          className={`pl-3 pr-2 ${pad} border-l-4 ${
                            a.is_fraud
                              ? dark
                                ? 'border-l-rose-500'
                                : 'border-l-rose-400'
                              : 'border-l-transparent'
                          }`}
                        >
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${priorityStyles(a.rule_priority, dark)}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${priorityDot(a.rule_priority)}`}
                            />
                            {a.rule_priority}
                          </span>
                        </td>

                        <td className={`px-3 ${pad} max-w-[380px]`}>
                          {compact ? (
                            <div className="flex items-baseline gap-2 min-w-0">
                              <span
                                className={`text-sm font-mono font-semibold shrink-0 ${t.text}`}
                              >
                                {a.rule_id}
                              </span>
                              <span
                                className={`text-sm truncate ${t.body}`}
                                title={`${a.rule_description} — ${summary}`}
                              >
                                {summary}
                              </span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span
                                  className={`text-sm font-mono font-semibold shrink-0 ${t.text}`}
                                >
                                  {a.rule_id}
                                </span>
                                <span
                                  className={`text-xs truncate ${t.muted}`}
                                  title={a.rule_description}
                                >
                                  {a.rule_description}
                                </span>
                              </div>
                              <div
                                className={`text-sm truncate mt-0.5 ${t.body}`}
                                title={summary}
                              >
                                {summary}
                              </div>
                            </>
                          )}
                        </td>

                        <td className={`px-3 ${pad}`}>
                          {compact ? (
                            <div
                              className={`text-sm whitespace-nowrap ${t.body}`}
                            >
                              {a.cashier}
                              <span className={t.faint}>
                                {' '}
                                · {a.branch_name} · {a.channel}
                              </span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5">
                                <User
                                  className={`w-3.5 h-3.5 shrink-0 ${t.faint}`}
                                />
                                <span
                                  className={`text-sm ${dark ? 'text-white/90' : 'text-gray-800'}`}
                                >
                                  {a.cashier}
                                </span>
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap ${
                                    dark
                                      ? 'bg-white/10 text-white/70'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {a.channel}
                                </span>
                              </div>
                              <div
                                className={`flex items-center gap-1.5 mt-0.5 text-xs ${t.faint}`}
                              >
                                <Building2 className="w-3 h-3 shrink-0" />
                                <span className="whitespace-nowrap">
                                  {a.branch_name}
                                </span>
                              </div>
                            </>
                          )}
                        </td>

                        <td className={`px-3 ${pad}`}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold w-fit whitespace-nowrap ${statusStyles(a.status, dark)}`}
                            >
                              {a.status}
                            </span>
                            {a.is_fraud && (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${dark ? 'text-rose-300' : 'text-rose-600'}`}
                              >
                                <Flag className="w-3 h-3" />
                                Fraud
                              </span>
                            )}
                          </div>
                        </td>

                        <td className={`px-3 ${pad}`}>
                          {compact ? (
                            <div
                              className={`text-sm whitespace-nowrap ${t.body}`}
                            >
                              {formatDate(a.created_at_timestamp)}{' '}
                              <span className={t.faint}>
                                {formatTime(a.created_at_timestamp)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Clock
                                className={`w-3.5 h-3.5 shrink-0 ${t.faint}`}
                              />
                              <div>
                                <div
                                  className={`text-sm whitespace-nowrap ${dark ? 'text-white/90' : 'text-gray-800'}`}
                                >
                                  {formatDate(a.created_at_timestamp)}{' '}
                                  <span className={t.faint}>
                                    {formatTime(a.created_at_timestamp)}
                                  </span>
                                </div>
                                <div className={`text-xs ${t.faint}`}>
                                  {timeAgo(a.created_at_timestamp)}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="px-2">
                          <ChevronRight
                            className={`w-4 h-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity ${t.faint}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && alerts.length > 0 && (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t ${t.line}`}
            >
              <div className={`text-sm ${t.muted}`}>
                Page {page} of {Math.max(totalPages, 1)} ·{' '}
                {totalRecords.toLocaleString()} records
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm ${t.muted}`}>Go to</span>
                  <input
                    key={page}
                    type="number"
                    min={1}
                    max={totalPages}
                    defaultValue={page}
                    aria-label="Go to page"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = Number((e.target as HTMLInputElement).value);
                        if (v >= 1 && v <= totalPages) setPage(v);
                      }
                    }}
                    className={`w-14 px-2 py-1 rounded-lg text-sm ${t.input}`}
                  />
                </div>
                <select
                  value={pageSize}
                  onChange={(e) => changePageSize(Number(e.target.value))}
                  aria-label="Rows per page"
                  className={`px-2 py-1 rounded-lg text-sm ${t.input}`}
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
                    aria-label="Previous page"
                    className={`p-1.5 rounded-lg disabled:opacity-30 ${dark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
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

      {/* Overlays — rendered in <body> via portal so they sit above everything
          regardless of any ancestor's stacking context. */}
      <Portal>
        <AnimatePresence>
          {drawerOpen && (
            <FilterDrawer
              dark={dark}
              initial={{
                status: filters.status,
                priority: filters.priority,
                channel: filters.channel,
                ruleId: filters.ruleId,
                location: filters.location,
                username: filters.username,
                closed: filters.closed,
                fraud: filters.fraud,
              }}
              options={drawerOptions}
              loading={filtersLoading}
              onClose={() => setDrawerOpen(false)}
              onApply={(next) => {
                patchFilters(next);
                setDrawerOpen(false);
              }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {selectedAlert && (
            <AlertDetailModal
              alert={selectedAlert}
              dark={dark}
              position={
                selectedIndex >= 0
                  ? { index: selectedIndex, total: alerts.length }
                  : undefined
              }
              onPrev={
                selectedIndex > 0
                  ? () => setSelectedAlert(alerts[selectedIndex - 1])
                  : undefined
              }
              onNext={
                selectedIndex >= 0 && selectedIndex < alerts.length - 1
                  ? () => setSelectedAlert(alerts[selectedIndex + 1])
                  : undefined
              }
              onClose={() => setSelectedAlert(null)}
            />
          )}
        </AnimatePresence>
      </Portal>
    </PermissionGuard>
  );
};

export default AlertListing;
