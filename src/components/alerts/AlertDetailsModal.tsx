import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  CreditCard,
  Calendar,
  FileText,
  Shield,
  ShieldAlert,
  ShieldQuestion,
  AlertTriangle,
  CheckCircle,
  Flag,
  Coins,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  RefreshCw,
  Loader2,
  Info,
  Building2,
  Users,
  Globe,
  Activity,
  Moon,
  Layers,
  BadgeCheck,
  UserCheck,
  History,
  Hash,
  HomeIcon,
  LayoutDashboard,
  StickyNote,
  Paperclip,
  Lock,
  Unlock,
  Copy,
  Check,
  Bell,
  Lightbulb,
  Clock,
  Target,
} from 'lucide-react';

import { AlertDetailsResponse } from '../../types/alerts';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { formatNumber } from '../../utils/formatters';
import { appConfig as config } from '../../config/runtime-config';

interface AlertDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertDetails: AlertDetailsResponse | null;
  alertId: string | null;
  loading: boolean;
  /** Optional: shows an "Open disposition" button in the header. */
  onOpenDisposition?: () => void;
}

interface RiskInsights {
  risk_score: number; // 0-100
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  kyc_status: string;
  is_watchlisted: boolean;
  is_pep: boolean;
  prior_alerts_count: number;
  prior_true_positive_count: number;
  account_age_days: number;
  avg_monthly_txn_count: number;
  avg_monthly_txn_amount: number;
  last_review_date?: string;
  analyst_notes?: string[];
}

// Read-only shapes of what AlertDispositionModal stores
interface NoteLite {
  note_id: string;
  note_type: 'NOTE' | 'REMINDER' | 'FINDING';
  content: string;
  reminder_at?: string | null;
  is_done?: boolean;
  created_at: string;
  updated_at?: string | null;
}
interface AttachmentLite {
  attachment_id: string;
  file_name: string;
  file_size: number;
  description?: string;
  uploaded_by: string;
  uploaded_at: string;
}
interface AlertLock {
  is_locked: boolean;
  locked_by?: string | null;
  locked_by_name?: string | null;
  locked_at?: string | null;
}

type TabKey = 'overview' | 'transactions' | 'risk' | 'notes';
type LoadState = 'idle' | 'loading' | 'ok' | 'error';

const apiBaseUrl = config.api.baseUrl;
const RISK_INSIGHTS_API_URL = `${apiBaseUrl}/customer-risk-insight`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function postJson<T = any>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

const num = (v: unknown) => Number.parseFloat(String(v ?? '')) || 0;
const fmtDate = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
};
const fmtTime = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString();
};
const fmtDateTime = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString();
};
const fmtSize = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1024 * 1024
      ? `${(b / 1024).toFixed(1)} KB`
      : `${(b / 1024 / 1024).toFixed(1)} MB`;

// Neutralise spreadsheet formula injection in exported CSV cells
const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const getStyles = (theme: string) => {
  const d = theme === 'dark';
  return {
    d,
    text: d ? 'text-white' : 'text-gray-900',
    sub: d ? 'text-white/70' : 'text-gray-600',
    faint: d ? 'text-white/45' : 'text-gray-500',
    divider: d ? 'border-white/10' : 'border-gray-200',
    card: d
      ? 'bg-white/[0.04] border-white/10'
      : 'bg-white border-gray-200 shadow-sm',
    solid: d ? 'bg-slate-900' : 'bg-gray-50',
    input: `w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      d
        ? 'bg-white/10 border border-white/15 text-white placeholder-white/30'
        : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400'
    }`,
    ghostBtn: `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      d
        ? 'bg-white/10 hover:bg-white/20 text-white'
        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
    }`,
  };
};

/* ------------------------------------------------------------------ */
/*  Presentational components                                          */
/* ------------------------------------------------------------------ */

const SectionCard: React.FC<{
  icon: React.ElementType;
  iconClass: string;
  title: string;
  theme: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, iconClass, title, theme, right, children, className }) => {
  const s = getStyles(theme);
  return (
    <div className={`rounded-2xl border p-5 ${s.card} ${className || ''}`}>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl shadow-sm shrink-0 ${iconClass}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <h3 className={`text-[15px] font-semibold truncate ${s.text}`}>
            {title}
          </h3>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
};

const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
  theme: string;
  icon?: React.ElementType;
}> = ({ label, value, theme, icon: Icon }) => {
  const s = getStyles(theme);
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="min-w-0">
      <div
        className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1 uppercase tracking-wider ${
          s.d ? 'text-white/40' : 'text-gray-500'
        }`}
      >
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`text-sm font-medium leading-snug break-words ${s.text}`}>
        {empty ? <span className="opacity-40">N/A</span> : value}
      </div>
    </div>
  );
};

const KpiTile: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  theme: string;
  tone: 'blue' | 'green' | 'purple' | 'orange';
}> = ({ icon: Icon, label, value, theme, tone }) => {
  const s = getStyles(theme);
  const tones = {
    blue: [
      'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
      'from-blue-50 to-indigo-50 border-blue-200',
      'text-blue-400',
    ],
    green: [
      'from-green-500/20 to-emerald-500/20 border-green-500/30',
      'from-green-50 to-emerald-50 border-green-200',
      'text-green-400',
    ],
    purple: [
      'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30',
      'from-purple-50 to-fuchsia-50 border-purple-200',
      'text-purple-400',
    ],
    orange: [
      'from-orange-500/20 to-red-500/20 border-orange-500/30',
      'from-orange-50 to-red-50 border-orange-200',
      'text-orange-400',
    ],
  }[tone];
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-gradient-to-br min-w-[170px] ${
        s.d ? tones[0] : tones[1]
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${tones[2]}`} />
      <div className="min-w-0">
        <div
          className={`text-[11px] font-semibold uppercase tracking-wider ${s.faint}`}
        >
          {label}
        </div>
        <div className={`text-lg font-bold leading-tight truncate ${s.text}`}>
          {value}
        </div>
      </div>
    </div>
  );
};

const MiniStat: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  theme: string;
  tone?: 'neutral' | 'warn';
}> = ({ icon: Icon, label, value, theme, tone = 'neutral' }) => {
  const s = getStyles(theme);
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border ${
        tone === 'warn'
          ? s.d
            ? 'bg-amber-500/10 border-amber-500/20'
            : 'bg-amber-50 border-amber-200'
          : s.d
            ? 'bg-white/[0.03] border-white/10'
            : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div
        className={`p-2 rounded-lg shrink-0 ${
          tone === 'warn'
            ? s.d
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-amber-100 text-amber-600'
            : s.d
              ? 'bg-white/10 text-white/70'
              : 'bg-white text-gray-500 border border-gray-200'
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <div
          className={`text-[11px] uppercase tracking-wide font-semibold ${s.d ? 'text-white/40' : 'text-gray-500'}`}
        >
          {label}
        </div>
        <div className={`text-sm font-bold truncate ${s.text}`}>
          {value ?? '—'}
        </div>
      </div>
    </div>
  );
};

const RiskLevelBadge: React.FC<{ level: string; theme: string }> = ({
  level,
  theme,
}) => {
  const d = theme === 'dark';
  const styles: Record<string, string> = {
    CRITICAL: d
      ? 'bg-red-600/25 text-red-300 border-red-500/40'
      : 'bg-red-100 text-red-700 border-red-300',
    HIGH: d
      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
      : 'bg-orange-100 text-orange-700 border-orange-300',
    MEDIUM: d
      ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
      : 'bg-yellow-100 text-yellow-700 border-yellow-300',
    LOW: d
      ? 'bg-green-500/20 text-green-300 border-green-500/30'
      : 'bg-green-100 text-green-700 border-green-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
        styles[level] || styles.MEDIUM
      }`}
    >
      <ShieldAlert className="w-3.5 h-3.5" />
      {level}
    </span>
  );
};

const BoolBadge: React.FC<{
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  theme: string;
  invert?: boolean;
}> = ({ value, trueLabel, falseLabel, theme, invert = false }) => {
  const d = theme === 'dark';
  const alarming = invert ? !value : value;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
        alarming
          ? d
            ? 'bg-red-500/20 text-red-300 border-red-500/30'
            : 'bg-red-100 text-red-700 border-red-300'
          : d
            ? 'bg-green-500/20 text-green-300 border-green-500/30'
            : 'bg-green-100 text-green-700 border-green-300'
      }`}
    >
      {alarming ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <CheckCircle className="w-3 h-3" />
      )}
      {value ? trueLabel : falseLabel}
    </span>
  );
};

const RiskScoreMeter: React.FC<{ score: number; theme: string }> = ({
  score,
  theme,
}) => {
  const s = getStyles(theme);
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const color =
    clamped >= 75
      ? 'from-red-500 to-rose-500'
      : clamped >= 50
        ? 'from-orange-500 to-amber-500'
        : clamped >= 25
          ? 'from-yellow-400 to-amber-400'
          : 'from-emerald-400 to-green-500';
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex-1 h-2.5 rounded-full overflow-hidden ${s.d ? 'bg-white/10' : 'bg-gray-200'}`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
        />
      </div>
      <span
        className={`text-sm font-bold tabular-nums w-10 text-right ${s.text}`}
      >
        {clamped}
      </span>
    </div>
  );
};

const NOTE_LABEL: Record<
  string,
  { label: string; icon: React.ElementType; dark: string; light: string }
> = {
  NOTE: {
    label: 'Note',
    icon: StickyNote,
    dark: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    light: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  REMINDER: {
    label: 'Reminder',
    icon: Bell,
    dark: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    light: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  FINDING: {
    label: 'Finding',
    icon: Lightbulb,
    dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    light: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const AlertDetailsModal: React.FC<AlertDetailsModalProps> = ({
  isOpen,
  onClose,
  alertDetails,
  alertId,
  loading,
  onOpenDisposition,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const s = getStyles(theme);
  const username = user?.username;

  const transactions = useMemo(() => alertDetails?.data ?? [], [alertDetails]);
  const ruleDetails = alertDetails?.rule ?? null;
  const firstDetail = transactions[0];
  const customerCode = firstDetail?.customer_code;
  const customerName = firstDetail?.customer_name;

  const [tab, setTab] = useState<TabKey>('overview');
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  /* ---- Reset per alert -------------------------------------------- */
  useEffect(() => {
    setTab('overview');
    setSearchTerm('');
    setExpandedRow(null);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId]);

  /* ---- Scroll fix: lock the page behind the modal ------------------ */
  useEffect(() => {
    if (!isOpen) return;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0)
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  /* ---- Risk insights (additive, non-blocking, race-safe) ------------ */
  const [riskInsights, setRiskInsights] = useState<RiskInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const riskReq = useRef(0);

  const fetchRiskInsights = useCallback(async () => {
    if (!customerCode) return;
    const id = ++riskReq.current;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const data = await postJson<RiskInsights>(RISK_INSIGHTS_API_URL, {
        alert_id: alertId,
        customer_code: customerCode,
        customer_name: customerName,
      });
      if (id !== riskReq.current) return; // stale response
      setRiskInsights(data);
    } catch (error) {
      if (id !== riskReq.current) return;
      console.error('Error fetching risk insights:', error);
      setRiskInsights(null);
      setInsightsError('Unable to load risk insights right now.');
    } finally {
      if (id === riskReq.current) setInsightsLoading(false);
    }
  }, [alertId, customerCode, customerName]);

  useEffect(() => {
    if (isOpen && customerCode) {
      fetchRiskInsights();
    } else {
      riskReq.current++; // invalidate in-flight request
      setRiskInsights(null);
      setInsightsError(null);
      setInsightsLoading(false);
    }
  }, [isOpen, customerCode, fetchRiskInsights]);

  /* ---- Notes / attachments / WIP lock (read-only view) -------------- */
  const [notes, setNotes] = useState<NoteLite[]>([]);
  const [files, setFiles] = useState<AttachmentLite[]>([]);
  const [lock, setLock] = useState<AlertLock | null>(null);
  const [notesState, setNotesState] = useState<LoadState>('idle');
  const [filesState, setFilesState] = useState<LoadState>('idle');
  const sideReq = useRef(0);

  const loadSide = useCallback(async () => {
    if (!alertId) return;
    const id = ++sideReq.current;
    setNotesState(username ? 'loading' : 'idle');
    setFilesState('loading');
    const [n, f, l] = await Promise.allSettled([
      username
        ? postJson<any>(`${apiBaseUrl}/alert-notes/list`, {
            alert_id: alertId,
            username,
          })
        : Promise.resolve(null),
      postJson<any>(`${apiBaseUrl}/alert-attachments/list`, {
        alert_id: alertId,
      }),
      postJson<AlertLock>(`${apiBaseUrl}/alert-lock/status`, {
        alert_id: alertId,
      }),
    ]);
    if (id !== sideReq.current) return;

    if (n.status === 'fulfilled' && n.value) {
      const list: NoteLite[] = Array.isArray(n.value)
        ? n.value
        : (n.value.notes ?? []);
      list.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setNotes(list);
      setNotesState('ok');
    } else if (n.status === 'rejected') {
      setNotesState('error');
    }
    if (f.status === 'fulfilled') {
      const list: AttachmentLite[] = Array.isArray(f.value)
        ? f.value
        : (f.value.attachments ?? []);
      list.sort(
        (a, b) =>
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      );
      setFiles(list);
      setFilesState('ok');
    } else {
      setFilesState('error');
    }
    if (l.status === 'fulfilled') setLock(l.value);
  }, [alertId, username]);

  useEffect(() => {
    if (!isOpen || !alertId) return;
    setNotes([]);
    setFiles([]);
    setLock(null);
    loadSide();
    return () => {
      sideReq.current++;
    };
  }, [isOpen, alertId, loadSide]);

  const lockedByMe =
    !!lock?.is_locked &&
    !!username &&
    (lock.locked_by || '').toLowerCase() === username.toLowerCase();
  const lockedByOther = !!lock?.is_locked && !lockedByMe;
  const lockOwner =
    lock?.locked_by_name || lock?.locked_by || 'another analyst';
  const overdueCount = notes.filter(
    (n) =>
      n.note_type === 'REMINDER' &&
      !n.is_done &&
      n.reminder_at &&
      new Date(n.reminder_at).getTime() < Date.now()
  ).length;

  /* ---- Analytics ---------------------------------------------------- */
  const totalAmount = useMemo(
    () => transactions.reduce((sum, d) => sum + num(d.amt_aed), 0),
    [transactions]
  );

  const analytics = useMemo(() => {
    if (transactions.length === 0) return null;
    const amounts = transactions.map((d) => num(d.amt_aed));
    const total = amounts.reduce((a, b) => a + b, 0);
    const avg = total / transactions.length;
    const max = amounts.reduce((m, a) => Math.max(m, a), 0);

    const employeeTxnCount = transactions.filter(
      (d) => d.is_employee_txn
    ).length;
    const roundAmountCount = amounts.filter(
      (a) => a > 0 && a % 1000 === 0
    ).length;
    const offHoursCount = transactions.filter((d) => {
      const t = new Date(d.transaction_date);
      if (isNaN(t.getTime())) return false;
      const h = t.getHours();
      return h >= 21 || h < 6;
    }).length;

    const times = transactions
      .map((d) => new Date(d.transaction_date).getTime())
      .filter((t) => !isNaN(t));
    const spanDays =
      times.length > 1
        ? Math.ceil(
            (times.reduce((m, t) => Math.max(m, t), -Infinity) -
              times.reduce((m, t) => Math.min(m, t), Infinity)) /
              86400000
          )
        : 0;

    const dayCounts: Record<string, number> = {};
    transactions.forEach((d) => {
      const t = new Date(d.transaction_date);
      if (isNaN(t.getTime())) return;
      const day = t.toDateString();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const maxSameDay = Object.values(dayCounts).reduce(
      (m, c) => Math.max(m, c),
      0
    );

    return {
      avg,
      max,
      employeeTxnCount,
      roundAmountCount,
      offHoursCount,
      spanDays,
      maxSameDay,
    };
  }, [transactions]);

  /* ---- Transaction table -------------------------------------------- */
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'transaction_date' | 'amt_aed'>(
    'transaction_date'
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filteredSorted = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = transactions;
    if (term) {
      list = list.filter((d) =>
        [
          d.refno_send_receive,
          d.beneficiary_name,
          d.branch_name,
          d.purpose,
          d.payment_to_country,
          d.cashier,
          d.source,
        ]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(term))
      );
    }
    return [...list].sort((a, b) => {
      const cmp =
        sortField === 'transaction_date'
          ? new Date(a.transaction_date).getTime() -
            new Date(b.transaction_date).getTime()
          : num(a.amt_aed) - num(b.amt_aed);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [transactions, searchTerm, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filteredSorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setPage(1);
    setExpandedRow(null);
  }, [searchTerm, pageSize, sortField, sortDir]);

  const toggleSort = (field: 'transaction_date' | 'amt_aed') => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleExportCsv = () => {
    if (filteredSorted.length === 0) return;
    const headers = [
      'Date',
      'Time',
      'Reference',
      'Amount (AED)',
      'Beneficiary',
      'Country',
      'Branch',
      'Cashier',
      'Purpose',
      'Source',
      'Employee TXN',
    ];
    const rows = filteredSorted.map((d) => [
      fmtDate(d.transaction_date),
      fmtTime(d.transaction_date),
      d.refno_send_receive,
      d.amt_aed,
      d.beneficiary_name,
      d.payment_to_country,
      d.branch_name,
      d.cashier,
      d.purpose,
      d.source,
      d.is_employee_txn ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map(csvCell).join(','))
      .join('\n');
    // BOM so Excel reads UTF-8 (Arabic names etc.) correctly
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alert-${alertId || 'export'}-transactions.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyId = async () => {
    if (!alertId) return;
    try {
      await navigator.clipboard.writeText(alertId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable - ignore */
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const empIcon = (isEmp: boolean) =>
    isEmp ? (
      <AlertTriangle className="w-4 h-4 text-red-500" />
    ) : (
      <CheckCircle className="w-4 h-4 text-green-500" />
    );

  const offHours = alertDetails?.off_hours ?? analytics?.offHoursCount ?? 0;
  const riskHigh =
    riskInsights &&
    (riskInsights.risk_level === 'HIGH' ||
      riskInsights.risk_level === 'CRITICAL');

  const tabs: {
    key: TabKey;
    label: string;
    icon: React.ElementType;
    badge?: number;
    dot?: boolean;
  }[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      key: 'transactions',
      label: 'Transactions',
      icon: CreditCard,
      badge: transactions.length,
    },
    {
      key: 'risk',
      label: 'Risk Insights',
      icon: ShieldQuestion,
      dot: !!riskHigh,
    },
    {
      key: 'notes',
      label: 'Notes & Files',
      icon: StickyNote,
      badge: notes.length + files.length,
      dot: overdueCount > 0,
    },
  ];

  const sortIcon = (field: 'transaction_date' | 'amt_aed') =>
    sortField === field ? (
      sortDir === 'asc' ? (
        <ArrowUp className="w-3.5 h-3.5" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5" />
      )
    ) : (
      <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
    );

  const th = `px-4 py-3 text-left font-semibold text-sm whitespace-nowrap ${s.text}`;

  /* ---- Tab content --------------------------------------------------- */

  const overview = firstDetail && (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      <div className="xl:col-span-2 space-y-6 min-w-0">
        <SectionCard
          icon={AlertTriangle}
          iconClass="bg-gradient-to-br from-red-500 to-orange-600"
          title="Rule Information"
          theme={theme}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <InfoRow
                label="Rule ID"
                value={firstDetail.rule_id}
                theme={theme}
              />
              <div className="col-span-2">
                <InfoRow
                  label="Scenario Logic"
                  value={
                    ruleDetails?.scenario_logic ?? firstDetail.rule_description
                  }
                  theme={theme}
                />
              </div>
              <InfoRow
                label="Priority"
                value={ruleDetails?.rule_priority}
                theme={theme}
                icon={AlertTriangle}
              />
              <InfoRow
                label="Category"
                value={ruleDetails?.rule_category}
                theme={theme}
              />
            </div>
            <div className={`pt-4 border-t ${s.divider}`}>
              <InfoRow
                label="Findings"
                value={firstDetail.comments}
                theme={theme}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={User}
          iconClass="bg-gradient-to-br from-blue-500 to-indigo-600"
          title="Customer Information"
          theme={theme}
        >
          <div className="grid grid-cols-2 gap-4">
            <InfoRow
              label="Customer Name"
              value={firstDetail.customer_name}
              theme={theme}
            />
            <InfoRow
              label="Customer Code"
              value={firstDetail.customer_code}
              theme={theme}
              icon={Hash}
            />
            <InfoRow
              label="Customer Type"
              value={firstDetail.customer_type}
              theme={theme}
            />
            <InfoRow
              label="Profession"
              value={firstDetail.customer_profession}
              theme={theme}
            />
            <InfoRow
              label="Nationality"
              value={firstDetail.customer_nationality}
              theme={theme}
              icon={Globe}
            />
            <InfoRow
              label="Residence Status"
              value={firstDetail.residential_status}
              theme={theme}
            />
          </div>
          <div
            className={`mt-4 pt-4 border-t flex items-center justify-between ${s.divider}`}
          >
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${s.faint}`}
            >
              Employee Transaction
            </span>
            <div className="flex items-center gap-2">
              {empIcon(firstDetail.is_employee_txn)}
              <span className={`text-sm font-semibold ${s.text}`}>
                {firstDetail.is_employee_txn ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={HomeIcon}
          iconClass="bg-gradient-to-br from-sky-500 to-blue-600"
          title="Branch & Cashier"
          theme={theme}
        >
          <div className="grid grid-cols-2 gap-4">
            <InfoRow
              label="Cashier ID"
              value={firstDetail.cashier}
              theme={theme}
              icon={User}
            />
            <InfoRow
              label="Branch Name"
              value={firstDetail.branch_name}
              theme={theme}
              icon={Globe}
            />
          </div>
        </SectionCard>
      </div>

      <div className="xl:col-span-3 space-y-6 min-w-0">
        {analytics && (
          <SectionCard
            icon={Layers}
            iconClass="bg-gradient-to-br from-teal-500 to-cyan-600"
            title="Transaction Analytics"
            theme={theme}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat
                icon={Users}
                label="Beneficiaries"
                value={alertDetails?.beneficiaries}
                theme={theme}
              />
              <MiniStat
                icon={Globe}
                label="Countries"
                value={alertDetails?.countries}
                theme={theme}
              />
              <MiniStat
                icon={Building2}
                label="Employee TXNs"
                value={analytics.employeeTxnCount}
                theme={theme}
                tone={analytics.employeeTxnCount > 0 ? 'warn' : 'neutral'}
              />
              <MiniStat
                icon={Moon}
                label="Off-hours"
                value={offHours}
                theme={theme}
                tone={offHours > 0 ? 'warn' : 'neutral'}
              />
              <MiniStat
                icon={Hash}
                label="Round Amounts"
                value={analytics.roundAmountCount}
                theme={theme}
                tone={analytics.roundAmountCount > 0 ? 'warn' : 'neutral'}
              />
              <MiniStat
                icon={Activity}
                label="Busiest Day"
                value={`${analytics.maxSameDay} txns`}
                theme={theme}
                tone={analytics.maxSameDay > 1 ? 'warn' : 'neutral'}
              />
              <MiniStat
                icon={Coins}
                label="Highest TXN"
                value={`AED ${formatNumber(analytics.max)}`}
                theme={theme}
              />
              <MiniStat
                icon={Calendar}
                label="Date Span"
                value={`${analytics.spanDays}d`}
                theme={theme}
              />
            </div>
          </SectionCard>
        )}

        <SectionCard
          icon={CreditCard}
          iconClass="bg-gradient-to-br from-green-500 to-emerald-600"
          title="Latest Transactions"
          theme={theme}
          right={
            <button
              type="button"
              onClick={() => setTab('transactions')}
              className={s.ghostBtn}
            >
              View all ({transactions.length})
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          <div className="space-y-2">
            {[...transactions]
              .sort(
                (a, b) =>
                  new Date(b.transaction_date).getTime() -
                  new Date(a.transaction_date).getTime()
              )
              .slice(0, 5)
              .map((d) => (
                <div
                  key={d.row_id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                    s.d
                      ? 'bg-white/[0.03] border-white/10'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${s.text}`}>
                      {d.beneficiary_name || '—'}
                      <span className={`font-normal ${s.faint}`}>
                        {' '}
                        &middot; {d.payment_to_country}
                      </span>
                    </div>
                    <div className={`text-xs ${s.faint}`}>
                      {fmtDateTime(d.transaction_date)} &middot;{' '}
                      {d.refno_send_receive}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-bold shrink-0 ${s.d ? 'text-green-300' : 'text-green-600'}`}
                  >
                    AED {formatNumber(num(d.amt_aed))}
                  </div>
                </div>
              ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );

  const transactionsTab = (
    <div className="h-full min-h-0 flex flex-col">
      <div
        className={`shrink-0 p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3 ${s.divider}`}
      >
        <div className="relative flex-1">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${s.faint}`}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search reference, beneficiary, branch, country, purpose..."
            className={s.input}
          />
        </div>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          aria-label="Rows per page"
          className={`text-sm rounded-xl px-3 py-2.5 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            s.d
              ? 'bg-slate-800 border-white/15 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredSorted.length === 0}
          className={`inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 ${
            s.d
              ? 'bg-green-500/15 hover:bg-green-500/25 text-green-300 border border-green-500/25'
              : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
          }`}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
        <table className="w-full min-w-[980px]">
          <thead
            className={`sticky top-0 z-10 border-b ${s.divider} ${s.d ? 'bg-slate-900' : 'bg-gray-50'}`}
          >
            <tr>
              <th className="w-10" />
              <th className={th}>
                <button
                  type="button"
                  onClick={() => toggleSort('transaction_date')}
                  className="flex items-center gap-1"
                >
                  Date {sortIcon('transaction_date')}
                </button>
              </th>
              <th className={th}>Reference</th>
              <th className={th}>
                <button
                  type="button"
                  onClick={() => toggleSort('amt_aed')}
                  className="flex items-center gap-1"
                >
                  Amount {sortIcon('amt_aed')}
                </button>
              </th>
              <th className={th}>Beneficiary</th>
              <th className={th}>Branch</th>
              <th className={th}>Purpose</th>
              <th className={th}>Employee</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className={`px-4 py-16 text-center text-sm ${s.faint}`}
                >
                  No transactions match your search
                </td>
              </tr>
            ) : (
              paginated.map((d) => {
                const open = expandedRow === d.row_id;
                return (
                  <React.Fragment key={d.row_id}>
                    <tr
                      onClick={() => setExpandedRow(open ? null : d.row_id)}
                      className={`border-b cursor-pointer transition-colors ${
                        s.d
                          ? 'border-white/10 hover:bg-white/5'
                          : 'border-gray-100 hover:bg-gray-50'
                      } ${open ? (s.d ? 'bg-white/5' : 'bg-blue-50/50') : ''}`}
                    >
                      <td className="pl-4 py-3">
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''} ${s.faint}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-sm ${s.text}`}>
                          {fmtDate(d.transaction_date)}
                        </div>
                        <div className={`text-xs ${s.faint}`}>
                          {fmtTime(d.transaction_date)}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${s.text}`}>
                        {d.refno_send_receive}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-bold whitespace-nowrap ${s.d ? 'text-green-300' : 'text-green-600'}`}
                      >
                        AED {formatNumber(num(d.amt_aed))}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-sm ${s.text}`}>
                          {d.beneficiary_name}
                        </div>
                        <div className={`text-xs ${s.faint}`}>
                          {d.payment_to_country}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-sm ${s.text}`}>
                          {d.branch_name}
                        </div>
                        <div className={`text-xs ${s.faint}`}>
                          By: {d.cashier}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-sm ${s.text}`}>{d.purpose}</div>
                        <div className={`text-xs ${s.faint}`}>
                          Source: {d.source}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {empIcon(d.is_employee_txn)}
                          <span className={`text-xs font-medium ${s.sub}`}>
                            {d.is_employee_txn ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <div
                            className={`px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 ${s.d ? 'bg-black/20' : 'bg-gray-50'}`}
                          >
                            <InfoRow
                              label="Row ID"
                              value={d.row_id}
                              theme={theme}
                              icon={Hash}
                            />
                            <InfoRow
                              label="Purpose"
                              value={d.purpose}
                              theme={theme}
                            />
                            <InfoRow
                              label="Source"
                              value={d.source}
                              theme={theme}
                            />
                            <InfoRow
                              label="Cashier"
                              value={d.cashier}
                              theme={theme}
                            />
                            <InfoRow
                              label="Branch"
                              value={d.branch_name}
                              theme={theme}
                            />
                            <InfoRow
                              label="Beneficiary Country"
                              value={d.payment_to_country}
                              theme={theme}
                            />
                            <InfoRow
                              label="Employee Transaction"
                              value={d.is_employee_txn ? 'Yes' : 'No'}
                              theme={theme}
                            />
                            <InfoRow
                              label="Timestamp"
                              value={fmtDateTime(d.transaction_date)}
                              theme={theme}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div
        className={`shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t ${s.divider}`}
      >
        <span className={`text-xs ${s.faint}`}>
          Showing{' '}
          {filteredSorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          &ndash;
          {Math.min(currentPage * pageSize, filteredSorted.length)} of{' '}
          {filteredSorted.length} transactions
          {filteredSorted.length !== transactions.length &&
            ` (filtered from ${transactions.length})`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              s.d
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className={`text-xs font-medium px-2 ${s.sub}`}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              s.d
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const riskTab = (
    <div className="max-w-5xl mx-auto">
      <SectionCard
        icon={ShieldQuestion}
        iconClass="bg-gradient-to-br from-purple-500 to-fuchsia-600"
        title="Risk Insights"
        theme={theme}
        right={
          <button
            type="button"
            onClick={fetchRiskInsights}
            disabled={insightsLoading || !customerCode}
            title="Refresh risk insights"
            aria-label="Refresh risk insights"
            className={s.ghostBtn}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${insightsLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        }
      >
        {insightsLoading ? (
          <div className="flex items-center gap-3 py-16 justify-center">
            <Loader2 className={`w-5 h-5 animate-spin ${s.faint}`} />
            <span className={`text-sm ${s.faint}`}>
              Fetching risk insights...
            </span>
          </div>
        ) : insightsError ? (
          <div
            className={`p-8 rounded-xl border text-center ${s.d ? 'bg-white/[0.02] border-white/10' : 'bg-gray-50 border-gray-200'}`}
          >
            <Info className={`w-7 h-7 mx-auto mb-2 ${s.faint}`} />
            <p className={`text-sm ${s.sub}`}>{insightsError}</p>
            <p className={`text-xs mt-1 mb-4 ${s.faint}`}>
              Core alert data is unaffected.
            </p>
            <button
              type="button"
              onClick={fetchRiskInsights}
              className={s.ghostBtn}
            >
              Try again
            </button>
          </div>
        ) : riskInsights ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${s.faint}`}
                  >
                    Risk Score
                  </span>
                  <RiskLevelBadge
                    level={riskInsights.risk_level}
                    theme={theme}
                  />
                </div>
                <RiskScoreMeter score={riskInsights.risk_score} theme={theme} />
              </div>
              <div className="flex flex-wrap gap-2">
                <BoolBadge
                  value={riskInsights.is_watchlisted}
                  trueLabel="Watchlisted"
                  falseLabel="No Watchlist Hits"
                  theme={theme}
                />
                <BoolBadge
                  value={riskInsights.is_pep}
                  trueLabel="PEP"
                  falseLabel="Not PEP"
                  theme={theme}
                />
              </div>
              <div
                className={`p-3 rounded-xl border text-xs ${
                  s.d
                    ? 'bg-white/[0.03] border-white/10 text-white/60'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
              >
                Avg. {riskInsights.avg_monthly_txn_count} txns/month &middot;
                AED {formatNumber(riskInsights.avg_monthly_txn_amount)}/month
                typical volume
              </div>
              {riskInsights.last_review_date && (
                <InfoRow
                  label="Last Review"
                  value={fmtDate(riskInsights.last_review_date)}
                  theme={theme}
                  icon={Clock}
                />
              )}
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  icon={History}
                  label="Prior Alerts"
                  value={riskInsights.prior_alerts_count}
                  theme={theme}
                  tone={
                    riskInsights.prior_alerts_count > 0 ? 'warn' : 'neutral'
                  }
                />
                <MiniStat
                  icon={AlertTriangle}
                  label="Confirmed TP"
                  value={riskInsights.prior_true_positive_count}
                  theme={theme}
                  tone={
                    riskInsights.prior_true_positive_count > 0
                      ? 'warn'
                      : 'neutral'
                  }
                />
                <MiniStat
                  icon={UserCheck}
                  label="KYC Status"
                  value={riskInsights.kyc_status}
                  theme={theme}
                />
                <MiniStat
                  icon={Calendar}
                  label="Account Age"
                  value={`${riskInsights.account_age_days} days`}
                  theme={theme}
                />
              </div>
              {riskInsights.analyst_notes &&
                riskInsights.analyst_notes.length > 0 && (
                  <div>
                    <div
                      className={`text-xs font-semibold uppercase tracking-wider mb-2 ${s.faint}`}
                    >
                      Analyst Notes
                    </div>
                    <ul className="space-y-1.5">
                      {riskInsights.analyst_notes.map((note, i) => (
                        <li
                          key={i}
                          className={`text-sm flex items-start gap-2 ${s.sub}`}
                        >
                          <BadgeCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-400" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </div>
        ) : (
          <div
            className={`p-12 text-center rounded-xl border border-dashed ${s.d ? 'border-white/10' : 'border-gray-200'} ${s.faint}`}
          >
            <ShieldQuestion className="w-9 h-9 mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              No risk insights available for this customer
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const notesTab = (
    <div className="space-y-6">
      {/* Lock status */}
      <div
        className={`flex items-center justify-between gap-3 flex-wrap p-4 rounded-2xl border ${
          lockedByOther
            ? s.d
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-red-50 border-red-200'
            : lockedByMe
              ? s.d
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-emerald-50 border-emerald-200'
              : s.card
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {lock?.is_locked ? (
            <Lock
              className={`w-5 h-5 shrink-0 ${lockedByOther ? 'text-red-400' : 'text-emerald-400'}`}
            />
          ) : (
            <Unlock className={`w-5 h-5 shrink-0 ${s.faint}`} />
          )}
          <div className="min-w-0">
            <div className={`text-sm font-semibold ${s.text}`}>
              {lockedByOther
                ? `Work in progress by ${lockOwner}`
                : lockedByMe
                  ? 'You are working on this alert (WIP)'
                  : lock
                    ? 'Not assigned - nobody is working on this alert'
                    : 'WIP status unavailable'}
            </div>
            {lock?.is_locked && lock.locked_at && (
              <div className={`text-xs ${s.faint}`}>
                Since {fmtDateTime(lock.locked_at)}
              </div>
            )}
          </div>
        </div>
        {onOpenDisposition && (
          <button
            type="button"
            onClick={onOpenDisposition}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/25"
          >
            <Target className="w-3.5 h-3.5" />
            Open disposition to add or edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Notes */}
        <SectionCard
          icon={StickyNote}
          iconClass="bg-gradient-to-br from-blue-500 to-indigo-600"
          title={`My Notes (${notes.length})`}
          theme={theme}
          right={
            <button
              type="button"
              onClick={loadSide}
              aria-label="Refresh"
              className={s.ghostBtn}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          }
        >
          <p className={`text-xs mb-4 flex items-center gap-1.5 ${s.faint}`}>
            <Lock className="w-3 h-3" /> Private to you. Read-only here.
          </p>
          {notesState === 'loading' ? (
            <div
              className={`flex items-center justify-center gap-2 py-10 text-sm ${s.faint}`}
            >
              <Loader2 className="w-4 h-4 animate-spin" /> Loading notes...
            </div>
          ) : notesState === 'error' ? (
            <div className="text-center py-10">
              <p className="text-sm text-red-400 mb-3">
                Couldn&apos;t load notes.
              </p>
              <button type="button" onClick={loadSide} className={s.ghostBtn}>
                Try again
              </button>
            </div>
          ) : notes.length === 0 ? (
            <div className={`text-center py-10 ${s.faint}`}>
              <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No notes on this alert yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => {
                const meta = NOTE_LABEL[n.note_type] || NOTE_LABEL.NOTE;
                const Icon = meta.icon;
                const overdue =
                  n.note_type === 'REMINDER' &&
                  !n.is_done &&
                  !!n.reminder_at &&
                  new Date(n.reminder_at).getTime() < Date.now();
                return (
                  <div
                    key={n.note_id}
                    className={`rounded-xl border p-4 ${s.d ? 'bg-white/[0.03] border-white/10' : 'bg-gray-50 border-gray-200'} ${n.is_done ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.d ? meta.dark : meta.light}`}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      {n.note_type === 'REMINDER' && n.reminder_at && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${overdue ? 'text-red-400' : s.faint}`}
                        >
                          <Clock className="w-3 h-3" />
                          {overdue ? 'Overdue · ' : ''}
                          {fmtDateTime(n.reminder_at)}
                          {n.is_done ? ' · done' : ''}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm whitespace-pre-wrap break-words ${s.text} ${n.is_done ? 'line-through' : ''}`}
                    >
                      {n.content}
                    </p>
                    <div className={`mt-2 text-[11px] ${s.faint}`}>
                      {fmtDateTime(n.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Attachments */}
        <SectionCard
          icon={Paperclip}
          iconClass="bg-gradient-to-br from-amber-500 to-orange-600"
          title={`Attachments (${files.length})`}
          theme={theme}
        >
          {filesState === 'loading' ? (
            <div
              className={`flex items-center justify-center gap-2 py-10 text-sm ${s.faint}`}
            >
              <Loader2 className="w-4 h-4 animate-spin" /> Loading
              attachments...
            </div>
          ) : filesState === 'error' ? (
            <div className="text-center py-10">
              <p className="text-sm text-red-400 mb-3">
                Couldn&apos;t load attachments.
              </p>
              <button type="button" onClick={loadSide} className={s.ghostBtn}>
                Try again
              </button>
            </div>
          ) : files.length === 0 ? (
            <div className={`text-center py-10 ${s.faint}`}>
              <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No files attached to this alert</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((a) => (
                <div
                  key={a.attachment_id}
                  className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${s.d ? 'bg-white/[0.03] border-white/10' : 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${s.d ? 'bg-blue-500/15' : 'bg-blue-50'}`}
                    >
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-semibold truncate ${s.text}`}
                      >
                        {a.file_name}
                      </div>
                      {a.description && (
                        <p
                          className={`text-sm mt-1 whitespace-pre-wrap break-words ${s.sub}`}
                        >
                          {a.description}
                        </p>
                      )}
                      <div className={`text-[11px] mt-2 ${s.faint}`}>
                        {fmtSize(a.file_size)} &middot; {a.uploaded_by} &middot;{' '}
                        {fmtDateTime(a.uploaded_at)}
                      </div>
                    </div>
                  </div>
                  <a
                    href={`${apiBaseUrl}/alert-attachments/download/${encodeURIComponent(a.attachment_id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Download ${a.file_name}`}
                    className={s.ghostBtn}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );

  /* ---- Render --------------------------------------------------------- */

  const hasData = !loading && transactions.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center p-0 md:p-3 bg-black/60 backdrop-blur-sm overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label={`Alert details ${alertId ?? ''}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.1, duration: 0.35 }}
        // Fixed, full-size shell: every tab renders inside the same box.
        className={`relative flex flex-col w-full h-full max-w-[1800px] mx-auto md:rounded-2xl border shadow-2xl overflow-hidden ${
          s.d
            ? 'bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 border-white/15'
            : 'bg-gradient-to-br from-white via-gray-50 to-blue-50 border-gray-200'
        }`}
      >
        <div className="h-[3px] w-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 shrink-0" />

        {/* Header */}
        <div className={`px-5 md:px-6 pt-4 border-b shrink-0 ${s.divider}`}>
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0 hidden sm:block">
                <div className="absolute inset-0 bg-red-500 rounded-2xl blur-lg opacity-40" />
                <div className="relative p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl shadow-lg">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={`text-xl md:text-2xl font-bold ${s.text}`}>
                    Alert Details
                  </h2>
                  {lock?.is_locked && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        lockedByOther
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      {lockedByOther ? `WIP · ${lockOwner}` : 'WIP · You'}
                    </span>
                  )}
                </div>
                <div
                  className={`flex items-center gap-1.5 text-sm min-w-0 ${s.faint}`}
                >
                  <Flag className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate" title={alertId ?? ''}>
                    Alert ID: {alertId?.slice(0, 60)}
                  </span>
                  <button
                    type="button"
                    onClick={copyId}
                    aria-label="Copy alert ID"
                    className={`p-1 rounded-md shrink-0 ${s.d ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onOpenDisposition && (
                <button
                  type="button"
                  onClick={onOpenDisposition}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                >
                  <Target className="w-4 h-4" />
                  Disposition
                </button>
              )}
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={`p-3 rounded-2xl transition-colors duration-150 ${
                  s.d
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* KPI strip - stays visible on every tab */}
          {hasData && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              <KpiTile
                icon={FileText}
                label="Transactions"
                value={alertDetails?.total_records ?? transactions.length}
                theme={theme}
                tone="blue"
              />
              <KpiTile
                icon={Coins}
                label="Total Amount"
                value={`AED ${formatNumber(totalAmount)}`}
                theme={theme}
                tone="green"
              />
              <KpiTile
                icon={Activity}
                label="Avg. Transaction"
                value={analytics ? `AED ${formatNumber(analytics.avg)}` : '—'}
                theme={theme}
                tone="purple"
              />
              <KpiTile
                icon={Shield}
                label="Risk Level"
                value={
                  insightsLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin opacity-60" />
                  ) : (
                    riskInsights?.risk_level || 'Not Assessed'
                  )
                }
                theme={theme}
                tone="orange"
              />
            </div>
          )}

          {/* Tab bar */}
          <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist">
            {tabs.map((t) => {
              const active = tab === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? s.d
                        ? 'text-white'
                        : 'text-blue-700'
                      : s.d
                        ? 'text-white/50 hover:text-white/80'
                        : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {!!t.badge && (
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${s.d ? 'bg-white/15 text-white' : 'bg-blue-100 text-blue-700'}`}
                    >
                      {t.badge}
                    </span>
                  )}
                  {t.dot && (
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                  {active && (
                    <motion.div
                      layoutId="detailsTabUnderline"
                      className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-red-500 to-orange-500"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body: one fixed-size area shared by all tabs */}
        <div className="flex-1 min-h-0 relative">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500" />
                <span className={s.sub}>Loading alert details...</span>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                <h3 className={`text-xl font-bold mb-2 ${s.text}`}>
                  No Details Available
                </h3>
                <p className={s.sub}>Unable to load alert details</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={
                  tab === 'transactions'
                    ? 'h-full min-h-0'
                    : 'h-full min-h-0 overflow-y-auto overscroll-contain p-5 md:p-6'
                }
              >
                {tab === 'overview' && overview}
                {tab === 'transactions' && transactionsTab}
                {tab === 'risk' && riskTab}
                {tab === 'notes' && notesTab}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default AlertDetailsModal;
