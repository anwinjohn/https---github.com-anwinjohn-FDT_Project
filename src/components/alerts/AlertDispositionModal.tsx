import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  Send,
  Save,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Zap,
  Brain,
  Lightbulb,
  Sparkles,
  Bot,
  BotMessageSquare,
  Calendar,
  ClipboardCheck,
  Building2,
  User,
  Hash,
  MapPin,
  Activity,
  Target,
  Info,
  ShieldCheck,
  Lock,
  Unlock,
  Play,
  StickyNote,
  Bell,
  Paperclip,
  Upload,
  Download,
  Trash2,
  Pencil,
  Clock,
  RefreshCw,
  Check,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../notifications';
import { toast } from '../../utils/toastBus';
import { AlertSummary, AlertDisposition } from '../../types/alerts';
import { logger } from '../../utils/logger';
import { appConfig as config } from '../../config/runtime-config';
import apiClient from '../../utils/apiClient';
import type { AlertAttachment } from '../../services/alertAttachmentsService';
import {
  alertAttachmentsService,
  ALLOWED_EXT,
  MAX_FILE_MB,
  MAX_STAGED_FILES,
  validateFile,
  fmtSize,
} from '../../services/alertAttachmentsService';
import PermissionGuard from '../PermissionGuard';
import { useMenuIds } from '../../hooks/useMenuIds';
import { usePermissions } from '../../hooks/usePermissions';

/* ------------------------------------------------------------------ */
/*  Config & types                                                     */
/* ------------------------------------------------------------------ */

const DISPOSITION_LABELS = {
  N: 'No Action',
  R: 'Review Required',
  E: 'Escalate',
  S: 'Suspicious',
  C: 'Closed',
  D: 'Deferred',
  P: 'Positive Match',
  X: 'External Escalation',
};

const aiURL = config.api.aisuggestions;
const apiBaseUrl = config.api.baseUrl;

const RISK_CATEGORIES = ['HIGH', 'MEDIUM', 'LOW'];

interface AISuggestion {
  findings: string;
  analysis: string;
  action: string;
  remarks: string;
  confidence: number;
  similarity: number;
  auto_disposition: keyof typeof DISPOSITION_LABELS;
  disposition_recommendation: string;
  assessment: confidence_assessment[];
}
interface confidence_assessment {
  evidence_completeness: string;
  rule_match: string;
  data_reliability: string;
  overall_confidence: string;
}
interface AlertDispositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: AlertSummary | null;
  onDispose: (disposition: AlertDisposition) => Promise<boolean>;
}

type NoteType = 'NOTE' | 'REMINDER' | 'FINDING';
interface AlertNote {
  note_id: string;
  alert_id: string;
  note_type: NoteType;
  content: string;
  reminder_at?: string | null;
  is_done?: boolean;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
}
interface AlertLock {
  is_locked: boolean;
  locked_by?: string | null;
  locked_by_name?: string | null;
  locked_at?: string | null;
}
type TabKey = 'info' | 'disposition' | 'notes' | 'files';
type Notify = (
  msg: string,
  type: 'success' | 'error' | 'warning' | 'info'
) => void;

// The permissions system is keyed on the menu, not the modal, so attachment
// upload/download rights piggyback on the alerts-management menu entry.
const MENU_KEY = 'alerts_management';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');
// Local-date string. toISOString() is UTC and returns "yesterday" early in the
// morning for UTC+ timezones (e.g. Dubai), which broke the min follow-up date.
const toLocalDateStr = (d: Date = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${toLocalDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
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
    inset: d ? 'bg-white/[0.06]' : 'bg-gray-50',
    input: `w-full px-4 py-3 rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed ${
      d
        ? 'bg-white/10 border border-white/15 text-white placeholder-white/30'
        : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400'
    }`,
    inputError: 'ring-2 ring-red-500/60',
    label: `block text-sm font-semibold mb-2 ${d ? 'text-white/80' : 'text-gray-700'}`,
    ghostBtn: `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      d
        ? 'bg-white/10 hover:bg-white/20 text-white'
        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
    }`,
    primaryBtn:
      'inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed',
  };
};

/* ------------------------------------------------------------------ */
/*  Small presentational components                                    */
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
        {value || '—'}
      </div>
    </div>
  );
};

interface SegOption {
  value: string;
  label: string;
  icon?: React.ElementType;
  activeClass: string;
}

const SegmentedControl: React.FC<{
  options: SegOption[];
  value: string;
  onChange: (v: string) => void;
  theme: string;
  layoutId: string;
}> = ({ options, value, onChange, theme, layoutId }) => {
  const s = getStyles(theme);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`relative px-4 py-2 rounded-xl text-sm font-medium overflow-hidden transition-colors duration-150 disabled:cursor-not-allowed ${
              active
                ? 'text-white'
                : s.d
                  ? 'text-white/60 hover:text-white/90 bg-white/5 border border-white/10'
                  : 'text-gray-600 hover:text-gray-900 bg-gray-50 border border-gray-200'
            }`}
          >
            {active && (
              <motion.div
                layoutId={layoutId}
                className={`absolute inset-0 ${opt.activeClass}`}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {Icon && <Icon className="w-4 h-4" />}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const ConfidenceMeter: React.FC<{ confidence: number; theme: string }> = ({
  confidence,
  theme,
}) => {
  const s = getStyles(theme);
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.8
      ? 'from-emerald-400 to-green-500'
      : confidence >= 0.6
        ? 'from-yellow-400 to-amber-500'
        : 'from-red-400 to-rose-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div
        className={`flex-1 h-1.5 rounded-full overflow-hidden ${
          s.d ? 'bg-white/10' : 'bg-gray-200'
        }`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums ${s.text}`}>{pct}%</span>
    </div>
  );
};

const STEP_META = [
  { key: 'form', label: 'Details', icon: FileText },
  { key: 'review', label: 'Review & Confirm', icon: ClipboardCheck },
  { key: 'success', label: 'Complete', icon: CheckCircle },
] as const;

const StepIndicator: React.FC<{
  step: 'form' | 'review' | 'success';
  theme: string;
}> = ({ step, theme }) => {
  const s = getStyles(theme);
  const activeIndex = STEP_META.findIndex((m) => m.key === step);
  return (
    <div className="flex items-center w-full">
      {STEP_META.map((m, idx) => {
        const isDone = idx < activeIndex;
        const isActive = idx === activeIndex;
        const Icon = m.icon;
        return (
          <React.Fragment key={m.key}>
            <div className="flex items-center gap-2.5 shrink-0">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${
                  isDone
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-500 border-transparent'
                    : isActive
                      ? s.d
                        ? 'border-blue-400 bg-blue-500/20'
                        : 'border-blue-500 bg-blue-50'
                      : s.d
                        ? 'border-white/15 bg-white/5'
                        : 'border-gray-300 bg-gray-50'
                }`}
              >
                {isDone ? (
                  <CheckCircle className="w-4 h-4 text-white" />
                ) : (
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive
                        ? s.d
                          ? 'text-blue-300'
                          : 'text-blue-600'
                        : s.d
                          ? 'text-white/40'
                          : 'text-gray-400'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-xs font-semibold hidden sm:block whitespace-nowrap ${
                  isActive ? s.text : s.d ? 'text-white/40' : 'text-gray-400'
                }`}
              >
                {m.label}
              </span>
            </div>
            {idx < STEP_META.length - 1 && (
              <div
                className={`flex-1 h-[2px] mx-3 rounded-full overflow-hidden ${
                  s.d ? 'bg-white/10' : 'bg-gray-200'
                }`}
              >
                <motion.div
                  initial={false}
                  animate={{ width: idx < activeIndex ? '100%' : '0%' }}
                  transition={{ duration: 0.4 }}
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Field: React.FC<{
  id: string;
  label: string;
  theme: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ id, label, theme, required, error, children }) => {
  const s = getStyles(theme);
  return (
    <div id={`field-${id}`}>
      <label className={s.label}>
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </div>
  );
};

const ReviewBlock: React.FC<{
  label: string;
  theme: string;
  children: React.ReactNode;
}> = ({ label, theme, children }) => {
  const s = getStyles(theme);
  return (
    <div>
      <div className={`text-sm font-medium mb-2 ${s.sub}`}>{label}</div>
      <div
        className={`p-4 rounded-lg text-sm whitespace-pre-wrap break-words ${s.inset} ${s.text}`}
      >
        {children}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Follow-up date picker (portal-based, same "YYYY-MM-DD" contract)   */
/* ------------------------------------------------------------------ */

const FollowUpDatePicker: React.FC<{
  value: string;
  onChange: (date: string) => void;
  minDate: string;
  theme: string;
  hasError?: boolean;
}> = ({ value, onChange, minDate, theme, hasError }) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() =>
    value ? new Date(`${value}T00:00:00`) : new Date(`${minDate}T00:00:00`)
  );
  const [coords, setCoords] = useState({ top: 0, left: 0, openUp: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const s = getStyles(theme);

  // Rendered through a portal so the modal's overflow containers can't clip it.
  const POPOVER_HEIGHT = 360;
  const POPOVER_WIDTH = 300;

  const updateCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < POPOVER_HEIGHT && rect.top > POPOVER_HEIGHT;
    setCoords({
      top: openUp ? rect.top - 8 : rect.bottom + 8,
      left: Math.max(
        8,
        Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8)
      ),
      openUp,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    // Capture phase + preventDefault so Escape closes only the picker and the
    // modal's own Escape handler (which checks defaultPrevented) stays put.
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [open]);

  const min = new Date(`${minDate}T00:00:00`);
  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0
  ).getDate();
  const firstDayIndex = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1
  ).getDay();
  const monthLabel = viewDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push(null);
  for (let dd = 1; dd <= daysInMonth; dd++) cells.push(dd);

  const isDisabled = (dd: number) =>
    new Date(viewDate.getFullYear(), viewDate.getMonth(), dd) < min;

  const isSelected = (dd: number) => {
    if (!value) return false;
    const sel = new Date(`${value}T00:00:00`);
    return (
      sel.getFullYear() === viewDate.getFullYear() &&
      sel.getMonth() === viewDate.getMonth() &&
      sel.getDate() === dd
    );
  };

  const isToday = (dd: number) => {
    const now = new Date();
    return (
      now.getFullYear() === viewDate.getFullYear() &&
      now.getMonth() === viewDate.getMonth() &&
      now.getDate() === dd
    );
  };

  const selectDay = (dd: number) => {
    onChange(
      toLocalDateStr(new Date(viewDate.getFullYear(), viewDate.getMonth(), dd))
    );
    setOpen(false);
  };

  const goToday = () => {
    const now = new Date();
    const t = min > now ? min : now;
    setViewDate(t);
    onChange(toLocalDateStr(t));
    setOpen(false);
  };

  const displayValue = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Select follow-up date';

  const navBtn = `p-1.5 rounded-lg transition-colors ${
    s.d ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-700'
  }`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 disabled:opacity-60 ${
          s.d
            ? 'bg-white/10 border-white/20 text-white hover:bg-white/[0.14]'
            : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
        } ${open ? 'ring-2 ring-blue-500 border-transparent' : ''} ${hasError ? s.inputError : ''}`}
      >
        <span
          className={`flex items-center gap-2 truncate ${
            !value ? (s.d ? 'text-white/45' : 'text-gray-400') : ''
          }`}
        >
          <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
          {displayValue}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          } ${s.d ? 'text-white/50' : 'text-gray-400'}`}
        />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: coords.openUp ? 8 : -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: coords.openUp ? 8 : -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'fixed',
                  top: coords.openUp ? undefined : coords.top,
                  bottom: coords.openUp
                    ? window.innerHeight - coords.top
                    : undefined,
                  left: coords.left,
                  width: POPOVER_WIDTH,
                  zIndex: 9999,
                }}
                className={`p-4 rounded-2xl border shadow-2xl ${
                  s.d
                    ? 'bg-slate-900 border-white/15'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() =>
                      setViewDate(
                        new Date(
                          viewDate.getFullYear(),
                          viewDate.getMonth() - 1,
                          1
                        )
                      )
                    }
                    className={navBtn}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className={`font-semibold text-sm ${s.text}`}>
                    {monthLabel}
                  </div>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() =>
                      setViewDate(
                        new Date(
                          viewDate.getFullYear(),
                          viewDate.getMonth() + 1,
                          1
                        )
                      )
                    }
                    className={navBtn}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className={`grid grid-cols-7 mb-1 text-center text-[11px] font-semibold ${
                    s.d ? 'text-white/40' : 'text-gray-400'
                  }`}
                >
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dd, i) => (
                    <div key={i}>{dd}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1">
                  {cells.map((dd, i) => {
                    if (dd === null) return <div key={`empty-${i}`} />;
                    const disabled = isDisabled(dd);
                    const selected = isSelected(dd);
                    return (
                      <div key={i} className="flex justify-center">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => selectDay(dd)}
                          className={`relative h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                            selected
                              ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30'
                              : disabled
                                ? s.d
                                  ? 'text-white/15 cursor-not-allowed'
                                  : 'text-gray-300 cursor-not-allowed'
                                : s.d
                                  ? 'text-white/80 hover:bg-white/10'
                                  : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {dd}
                          {isToday(dd) && !selected && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div
                  className={`flex justify-between mt-3 pt-3 border-t ${s.divider}`}
                >
                  <button
                    type="button"
                    onClick={goToday}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      s.d
                        ? 'text-blue-300 hover:bg-blue-500/10'
                        : 'text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      s.d
                        ? 'text-white/50 hover:bg-white/10'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  WIP / lock hook                                                    */
/*                                                                     */
/*  Endpoints assumed (POST, JSON):                                    */
/*   /alert-lock/status   {alert_id}              -> AlertLock         */
/*   /alert-lock/acquire  {alert_id, username}    -> AlertLock (409 if */
/*                          already locked: body = AlertLock)          */
/*   /alert-lock/release  {alert_id, username}    -> {}                */
/*  The server MUST enforce the lock atomically and reject disposition */
/*  / upload calls from non-owners - the UI lock is only a convenience.*/
/* ------------------------------------------------------------------ */

function useAlertLock(
  alertId: string | undefined,
  username: string | undefined,
  active: boolean,
  notify: Notify
) {
  const [lock, setLock] = useState<AlertLock | null>(null);
  const [checking, setChecking] = useState(false);
  const [statusFailed, setStatusFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const { addNotification } = useNotifications();

  const refresh = useCallback(async () => {
    if (!alertId) return;
    try {
      //const data = await apiClient.post('/alert/status'
      const data = await apiClient.post('/alert/status', {
        alert_id: alertId,
      });
      setLock(data);
      setStatusFailed(false);
    } catch (err) {
      console.error('Lock status failed', err);
      setStatusFailed(true);
    } finally {
      setChecking(false);
    }
  }, [alertId]);

  useEffect(() => {
    if (!active || !alertId) return;
    setLock(null);
    setChecking(true);
    refresh();
    // Light polling so a release / takeover by someone else shows up
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [active, alertId, refresh]);

  const acquire = useCallback(async () => {
    if (!alertId || !username) return false;
    setBusy(true);
    try {
      const res = await apiClient.post<AlertLock>('alert-lock/acquire', {
        alert_id: alertId,
        username,
      });
      if (!res.success) {
        if (res.status === 409) {
          const body = (res as any).data ?? null;
          if (body) setLock({ is_locked: true, ...body });
          notify(
            `This alert is already being worked on by ${body?.locked_by_name || body?.locked_by || 'another user'}`,
            'warning'
          );
        } else {
          notify('Could not mark the alert as WIP', 'error');
        }
        return false;
      }
      const data = res.data as AlertLock | undefined;
      setLock(
        data?.is_locked
          ? data
          : {
              is_locked: true,
              locked_by: username,
              locked_at: new Date().toISOString(),
            }
      );
      notify('Alert marked as WIP - it is now locked to you', 'success');
      return true;
    } catch (err) {
      notify('Could not mark the alert as WIP', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }, [alertId, username, notify]);

  const release = useCallback(async () => {
    if (!alertId || !username) return false;
    setBusy(true);
    try {
      await apiClient.post('alert-lock/release', {
        alert_id: alertId,
        username,
      });
      setLock({ is_locked: false });
      notify('Alert released - other analysts can pick it up', 'info');
      return true;
    } catch (err) {
      notify('Could not release the alert', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }, [alertId, username, notify]);

  const isMine =
    !!lock?.is_locked &&
    !!username &&
    (lock.locked_by || '').toLowerCase() === username.toLowerCase();
  const isOther = !!lock?.is_locked && !isMine;

  return {
    lock,
    checking,
    statusFailed,
    busy,
    isMine,
    isOther,
    acquire,
    release,
    refresh,
  };
}

/* ------------------------------------------------------------------ */
/*  Notes panel (private, per-user, saved independently of dispose)    */
/*                                                                     */
/*  Endpoints assumed (POST, JSON):                                    */
/*   /alert-notes/list    {alert_id, username}                         */
/*   /alert-notes/create  {alert_id, username, note_type, content,     */
/*                         reminder_at}                                */
/*   /alert-notes/update  {note_id, alert_id, username, content?,      */
/*                         reminder_at?, is_done?}                     */
/*   /alert-notes/delete  {note_id, alert_id, username}                */
/*  The server must filter by username so notes stay user-specific.    */
/* ------------------------------------------------------------------ */

const NOTE_META: Record<
  NoteType,
  {
    label: string;
    icon: React.ElementType;
    dark: string;
    light: string;
    active: string;
  }
> = {
  NOTE: {
    label: 'Note',
    icon: StickyNote,
    dark: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    light: 'bg-blue-50 text-blue-700 border-blue-200',
    active:
      'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25',
  },
  REMINDER: {
    label: 'Reminder',
    icon: Bell,
    dark: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    light: 'bg-amber-50 text-amber-700 border-amber-200',
    active:
      'bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25',
  },
  FINDING: {
    label: 'Finding',
    icon: Lightbulb,
    dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    light: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    active:
      'bg-gradient-to-r from-emerald-500 to-green-500 shadow-lg shadow-emerald-500/25',
  },
};

const NotesPanel: React.FC<{
  alertId: string;
  username: string;
  theme: string;
  notify: Notify;
  onUseAsFinding: (text: string) => void;
  onStats: (s: { count: number; overdue: number }) => void;
  onDirtyChange: (dirty: boolean) => void;
}> = ({
  alertId,
  username,
  theme,
  notify,
  onUseAsFinding,
  onStats,
  onDirtyChange,
}) => {
  const s = getStyles(theme);
  const [notes, setNotes] = useState<AlertNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [type, setType] = useState<NoteType>('NOTE');
  const [draft, setDraft] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'ALL' | NoteType>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editReminder, setEditReminder] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!alertId || !username) {
        setNotes([]);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const data = await apiClient.post('/alert-notes/list', {
          alert_id: alertId,
          username,
        });
        // Defensive: accept bare array OR { data: [...] } OR { data: { items: [...] } }
        const rawList: AlertNote[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.data)
            ? (data as any).data
            : Array.isArray((data as any)?.data?.items)
              ? (data as any).data.items
              : [];
        const list = rawList.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setNotes(list);
        setLoadError(null);
      } catch (err) {
        if (!silent) {
          setLoadError(
            err instanceof Error ? err.message : 'Failed to load notes'
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [alertId, username]
  );

  useEffect(() => {
    setNotes([]);
    setDraft('');
    setReminderAt('');
    setEditingId(null);
    load();
  }, [load]);

  useEffect(() => {
    const now = Date.now();
    const overdue = notes.filter(
      (n) =>
        n.note_type === 'REMINDER' &&
        !n.is_done &&
        n.reminder_at &&
        new Date(n.reminder_at).getTime() < now
    ).length;
    onStats({ count: notes.length, overdue });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  useEffect(() => {
    onDirtyChange(draft.trim().length > 0 || editingId !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, editingId]);

  const saveNote = async () => {
    if (!draft.trim()) {
      notify('Write something before saving the note', 'warning');
      return;
    }
    if (type === 'REMINDER' && !reminderAt) {
      notify('Pick a date & time for the reminder', 'warning');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/alert-notes/create', {
        alert_id: alertId,
        username,
        note_type: type,
        content: draft.trim(),
        reminder_at:
          type === 'REMINDER' ? new Date(reminderAt).toISOString() : null,
      });
      setDraft('');
      setReminderAt('');
      notify('Note saved', 'success');
      await load(true);
    } catch {
      notify('Failed to save note', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (n: AlertNote) => {
    setEditingId(n.note_id);
    setEditText(n.content);
    setEditReminder(toLocalInput(n.reminder_at));
    setConfirmDeleteId(null);
  };

  const saveEdit = async (n: AlertNote) => {
    if (!editText.trim()) {
      notify('A note cannot be empty', 'warning');
      return;
    }
    setBusyId(n.note_id);
    try {
      await apiClient.post('alert-notes/update', {
        note_id: n.note_id,
        alert_id: alertId,
        username,
        content: editText.trim(),
        reminder_at:
          n.note_type === 'REMINDER' && editReminder
            ? new Date(editReminder).toISOString()
            : (n.reminder_at ?? null),
      });
      setEditingId(null);
      notify('Note updated', 'success');
      await load(true);
    } catch {
      notify('Failed to update note', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleDone = async (n: AlertNote) => {
    setBusyId(n.note_id);
    try {
      await apiClient.post('alert-notes/update', {
        note_id: n.note_id,
        alert_id: alertId,
        username,
        is_done: !n.is_done,
      });
      await load(true);
    } catch {
      notify('Failed to update reminder', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const deleteNote = async (n: AlertNote) => {
    setBusyId(n.note_id);
    try {
      await apiClient.post('alert-notes/delete', {
        note_id: n.note_id,
        alert_id: alertId,
        username,
      });
      setConfirmDeleteId(null);
      notify('Note deleted', 'success');
      await load(true);
    } catch {
      notify('Failed to delete note', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const visible = notes.filter(
    (n) => filter === 'ALL' || n.note_type === filter
  );
  const typeOptions: SegOption[] = (Object.keys(NOTE_META) as NoteType[]).map(
    (k) => ({
      value: k,
      label: NOTE_META[k].label,
      icon: NOTE_META[k].icon,
      activeClass: NOTE_META[k].active,
    })
  );

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row">
      {/* Composer */}
      <div
        className={`shrink-0 lg:w-[380px] lg:overflow-y-auto overscroll-contain p-5 border-b lg:border-b-0 lg:border-r ${s.divider}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Lock className={`w-3.5 h-3.5 ${s.faint}`} />
          <span className={`text-xs font-semibold ${s.faint}`}>
            Private to you &middot; saved separately from the disposition
          </span>
        </div>
        <div className="mt-4 space-y-4">
          <SegmentedControl
            options={typeOptions}
            value={type}
            onChange={(v) => setType(v as NoteType)}
            theme={theme}
            layoutId="noteTypePill"
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveNote();
            }}
            rows={6}
            className={s.input}
            placeholder={
              type === 'REMINDER'
                ? 'What do you need to remember to check?'
                : type === 'FINDING'
                  ? 'Record a finding as you go...'
                  : 'Jot down a note...'
            }
          />
          {type === 'REMINDER' && (
            <div>
              <label className={s.label}>Remind me on</label>
              <input
                type="datetime-local"
                value={reminderAt}
                min={toLocalInput(new Date().toISOString())}
                onChange={(e) => setReminderAt(e.target.value)}
                className={s.input}
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className={`text-[11px] ${s.faint}`}>
              Ctrl / Cmd + Enter to save
            </span>
            <button
              type="button"
              onClick={saveNote}
              disabled={saving || !draft.trim()}
              className={s.primaryBtn + ' !px-5 !py-2.5 text-sm'}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save {NOTE_META[type].label.toLowerCase()}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        <div
          className={`shrink-0 flex items-center gap-2 flex-wrap px-5 py-3 border-b ${s.divider}`}
        >
          {(['ALL', 'NOTE', 'REMINDER', 'FINDING'] as const).map((f) => {
            const active = filter === f;
            const count =
              f === 'ALL'
                ? notes.length
                : notes.filter((n) => n.note_type === f).length;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-blue-500 text-white'
                    : s.d
                      ? 'bg-white/5 text-white/60 hover:bg-white/10'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'ALL' ? 'All' : NOTE_META[f].label + 's'} ({count})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => load()}
            aria-label="Refresh notes"
            className={`ml-auto ${s.ghostBtn}`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-3">
          {loading ? (
            <div
              className={`flex items-center justify-center gap-2 py-16 text-sm ${s.faint}`}
            >
              <Loader2 className="w-4 h-4 animate-spin" /> Loading notes...
            </div>
          ) : loadError ? (
            <div className="text-center py-16">
              <p className="text-sm text-red-400 mb-3">{loadError}</p>
              <button
                type="button"
                onClick={() => load()}
                className={s.ghostBtn}
              >
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className={`text-center py-16 ${s.faint}`}>
              <StickyNote className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No notes yet</p>
              <p className="text-xs mt-1">
                Notes, reminders and findings you add will appear here.
              </p>
            </div>
          ) : (
            visible.map((n) => {
              const meta = NOTE_META[n.note_type] || NOTE_META.NOTE;
              const MetaIcon = meta.icon;
              const overdue =
                n.note_type === 'REMINDER' &&
                !n.is_done &&
                !!n.reminder_at &&
                new Date(n.reminder_at).getTime() < Date.now();
              const editing = editingId === n.note_id;
              const busy = busyId === n.note_id;
              return (
                <div
                  key={n.note_id}
                  className={`rounded-xl border p-4 ${s.card} ${n.is_done ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          s.d ? meta.dark : meta.light
                        }`}
                      >
                        <MetaIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      {n.note_type === 'REMINDER' && n.reminder_at && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            overdue ? 'text-red-400' : s.faint
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {overdue ? 'Overdue · ' : ''}
                          {fmtDateTime(n.reminder_at)}
                        </span>
                      )}
                    </div>
                    {!editing && (
                      <div className="flex items-center gap-1 shrink-0">
                        {n.note_type === 'REMINDER' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleDone(n)}
                            className={s.ghostBtn}
                          >
                            <Check className="w-3.5 h-3.5" />
                            {n.is_done ? 'Reopen' : 'Done'}
                          </button>
                        )}
                        {n.note_type === 'FINDING' && (
                          <button
                            type="button"
                            onClick={() => onUseAsFinding(n.content)}
                            className={s.ghostBtn}
                            title="Append to the Findings field in the Disposition tab"
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                            Add to findings
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Edit note"
                          onClick={() => startEdit(n)}
                          className={s.ghostBtn}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete note"
                          onClick={() => setConfirmDeleteId(n.note_id)}
                          className={s.ghostBtn}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>

                  {editing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={4}
                        className={s.input}
                        autoFocus
                      />
                      {n.note_type === 'REMINDER' && (
                        <input
                          type="datetime-local"
                          value={editReminder}
                          onChange={(e) => setEditReminder(e.target.value)}
                          className={s.input}
                        />
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className={s.ghostBtn}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => saveEdit(n)}
                          className={s.primaryBtn + ' !px-4 !py-1.5 text-xs'}
                        >
                          {busy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={`text-sm whitespace-pre-wrap break-words ${s.text} ${
                        n.is_done ? 'line-through' : ''
                      }`}
                    >
                      {n.content}
                    </p>
                  )}

                  {confirmDeleteId === n.note_id && (
                    <div
                      className={`mt-3 flex items-center justify-between gap-3 p-3 rounded-lg border ${
                        s.d
                          ? 'bg-red-500/10 border-red-500/20'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <span
                        className={`text-xs font-medium ${s.d ? 'text-red-300' : 'text-red-700'}`}
                      >
                        Delete this note permanently?
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className={s.ghostBtn}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => deleteNote(n)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                        >
                          {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={`mt-3 text-[11px] ${s.faint}`}>
                    {fmtDateTime(n.created_at)}
                    {n.updated_at &&
                      n.updated_at !== n.created_at &&
                      ' · edited ' + fmtDateTime(n.updated_at)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Attachments panel                                                  */
/*                                                                     */
/*  Endpoints assumed:                                                 */
/*   POST /alert-attachments/list     {alert_id}                       */
/*   POST /alert-attachments/upload   multipart: alert_id,             */
/*                                    uploaded_by, description, file   */
/*   GET  /alert-attachments/download/{attachment_id}                  */
/*   POST /alert-attachments/delete   {attachment_id, alert_id,        */
/*                                     username}                       */
/* ------------------------------------------------------------------ */

interface StagedFile {
  id: string;
  file: File;
  description: string;
  status: 'pending' | 'uploading' | 'error';
  error?: string;
}

const AttachmentsPanel: React.FC<{
  alertId: string;
  username: string;
  theme: string;
  canEdit: boolean;
  notify: Notify;
  onStats: (count: number) => void;
  onDirtyChange: (dirty: boolean) => void;
}> = ({
  alertId,
  username,
  theme,
  canEdit,
  notify,
  onStats,
  onDirtyChange,
}) => {
  const s = getStyles(theme);
  const [items, setItems] = useState<AlertAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { getMenuId } = useMenuIds();
  const ALERTS_MENU_ID = getMenuId(MENU_KEY);
  const { user } = useAuth();
  const { hasPermission, loading: permsLoading } = usePermissions();
  const isSuperAdmin = user?.role_id === 0;
  const canUpload =
    isSuperAdmin ||
    (!permsLoading &&
      ALERTS_MENU_ID !== 0 &&
      hasPermission(ALERTS_MENU_ID, 'canEdit'));

  const denyUpload = () =>
    notify(
      'You do not have permission to upload alert attachments, contact your administrator.',
      'warning'
    );
  const denyDownload = () =>
    notify(
      'You do not have permission to download alert attachments, contact your administrator.',
      'warning'
    );
  const denayDelete = () =>
    notify(
      'You do not have permission to delete alert attachments, contact your administrator.',
      'warning'
    );

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const list = await alertAttachmentsService.list(alertId);
        list.sort(
          (a, b) =>
            new Date(b.uploaded_at).getTime() -
            new Date(a.uploaded_at).getTime()
        );
        setItems(list);
        setLoadError(null);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load attachments'
        );
      } finally {
        setLoading(false);
      }
    },
    [alertId]
  );

  useEffect(() => {
    setItems([]);
    setStaged([]);
    load();
  }, [load]);

  useEffect(() => {
    onStats(items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useEffect(() => {
    onDirtyChange(staged.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged.length]);

  const addFiles = (list: FileList | null) => {
    if (!list || !canEdit) return;
    if (!canUpload) {
      denyUpload();
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const rejected: string[] = [];
    const accepted: StagedFile[] = [];
    Array.from(list).forEach((file) => {
      const problem = validateFile(file);
      if (problem) {
        rejected.push(`${file.name} (${problem})`);
      } else {
        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          description: '',
          status: 'pending',
        });
      }
    });
    setStaged((prev) => {
      const room = MAX_STAGED_FILES - prev.length;
      if (accepted.length > room) {
        rejected.push(
          `${accepted.length - room} file(s) (max ${MAX_STAGED_FILES} per upload)`
        );
      }
      return [...prev, ...accepted.slice(0, Math.max(room, 0))];
    });
    if (rejected.length) notify(`Skipped: ${rejected.join(', ')}`, 'warning');
    if (inputRef.current) inputRef.current.value = '';
  };

  const uploadAll = async () => {
    const todo = staged.filter((f) => f.status !== 'uploading');
    if (!todo.length) return;
    setUploading(true);
    let okCount = 0;
    for (const sf of todo) {
      setStaged((prev) =>
        prev.map((p) =>
          p.id === sf.id ? { ...p, status: 'uploading', error: undefined } : p
        )
      );
      try {
        await alertAttachmentsService.upload(
          alertId,
          username,
          sf.description,
          sf.file
        );
        okCount++;
        setStaged((prev) => prev.filter((p) => p.id !== sf.id));
      } catch (err) {
        setStaged((prev) =>
          prev.map((p) =>
            p.id === sf.id
              ? {
                  ...p,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Upload failed',
                }
              : p
          )
        );
      }
    }
    setUploading(false);
    if (okCount) {
      notify(`${okCount} file${okCount > 1 ? 's' : ''} uploaded`, 'success');
      await load(true);
    }
    if (okCount < todo.length)
      notify('Some files failed to upload - you can retry them', 'error');
  };

  const deleteItem = async (a: AlertAttachment) => {
    setBusyId(a.attachment_id);
    try {
      await alertAttachmentsService.delete(a.attachment_id, alertId, username);
      setConfirmDeleteId(null);
      notify('Attachment deleted', 'success');
      await load(true);
    } catch {
      notify('Failed to delete attachment', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col lg:flex-row">
      {/* Upload column */}
      <div
        className={`shrink-0 lg:w-[420px] min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r ${s.divider}`}
      >
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (canEdit) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => canEdit && inputRef.current?.click()}
            role="button"
            tabIndex={canEdit ? 0 : -1}
            onKeyDown={(e) => {
              if (canEdit && (e.key === 'Enter' || e.key === ' '))
                inputRef.current?.click();
            }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              !canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            } ${
              dragActive
                ? 'border-blue-500 bg-blue-500/10'
                : s.d
                  ? 'border-white/15 hover:border-white/30'
                  : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <Upload
              className={`w-8 h-8 mx-auto mb-3 ${s.d ? 'text-blue-300' : 'text-blue-500'}`}
            />
            <p className={`text-sm font-semibold ${s.text}`}>
              Drop files here or click to browse
            </p>
            <p className={`text-xs mt-1.5 ${s.faint}`}>
              Up to {MAX_STAGED_FILES} files &middot; {MAX_FILE_MB} MB each
              <br />
              {ALLOWED_EXT.join(', ')}
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              disabled={!canEdit}
              accept={ALLOWED_EXT.map((e) => '.' + e).join(',')}
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
          {!canEdit && (
            <p
              className={`text-xs flex items-center gap-1.5 ${s.d ? 'text-amber-300' : 'text-amber-700'}`}
            >
              <Lock className="w-3.5 h-3.5" />
              Mark the alert as WIP to upload files.
            </p>
          )}

          {staged.length > 0 && (
            <div className="space-y-3">
              <div
                className={`text-xs font-semibold uppercase tracking-wider ${s.faint}`}
              >
                Ready to upload ({staged.length})
              </div>
              {staged.map((sf) => (
                <div key={sf.id} className={`rounded-xl border p-3 ${s.card}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-4 h-4 text-blue-400 shrink-0" />
                      <span
                        className={`text-sm font-medium truncate ${s.text}`}
                      >
                        {sf.file.name}
                      </span>
                      <span className={`text-[11px] shrink-0 ${s.faint}`}>
                        {fmtSize(sf.file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${sf.file.name}`}
                      disabled={sf.status === 'uploading'}
                      onClick={() =>
                        setStaged((p) => p.filter((x) => x.id !== sf.id))
                      }
                      className={`p-1 rounded-md ${s.d ? 'hover:bg-white/10' : 'hover:bg-gray-100'} ${s.faint}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={sf.description}
                    disabled={sf.status === 'uploading'}
                    onChange={(e) =>
                      setStaged((p) =>
                        p.map((x) =>
                          x.id === sf.id
                            ? { ...x, description: e.target.value }
                            : x
                        )
                      )
                    }
                    placeholder="Description / remarks for this file (optional)"
                    className={s.input + ' !py-2'}
                  />
                  {sf.status === 'uploading' && (
                    <p
                      className={`mt-2 text-xs flex items-center gap-1.5 ${s.faint}`}
                    >
                      <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                    </p>
                  )}
                  {sf.status === 'error' && (
                    <p className="mt-2 text-xs text-red-400">
                      Failed: {sf.error}. Click upload to retry.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {staged.length > 0 && (
          <div
            className={`shrink-0 flex justify-end gap-2 px-5 py-3 border-t ${s.divider}`}
          >
            <button
              type="button"
              disabled={uploading}
              onClick={() => setStaged([])}
              className={s.ghostBtn + ' !px-4 !py-2 text-sm'}
            >
              Clear
            </button>
            <PermissionGuard
              menuId={ALERTS_MENU_ID}
              action="edit"
              fallback={
                <button
                  type="button"
                  onClick={denyUpload}
                  className={s.primaryBtn + ' !px-5 !py-2 text-sm opacity-50'}
                >
                  <Upload className="w-4 h-4" />
                  Upload {staged.length} file{staged.length > 1 ? 's' : ''}
                </button>
              }
            >
              <button
                type="button"
                disabled={uploading || !canEdit}
                onClick={uploadAll}
                className={s.primaryBtn + ' !px-5 !py-2 text-sm'}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Upload {staged.length} file{staged.length > 1 ? 's' : ''}
              </button>
            </PermissionGuard>
          </div>
        )}
      </div>

      {/* Existing attachments */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        <div
          className={`shrink-0 flex items-center justify-between px-5 py-3 border-b ${s.divider}`}
        >
          <span className={`text-sm font-semibold ${s.text}`}>
            Attached to this alert ({items.length})
          </span>
          <button
            type="button"
            onClick={() => load()}
            aria-label="Refresh attachments"
            className={s.ghostBtn}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-3">
          {loading ? (
            <div
              className={`flex items-center justify-center gap-2 py-16 text-sm ${s.faint}`}
            >
              <Loader2 className="w-4 h-4 animate-spin" /> Loading
              attachments...
            </div>
          ) : loadError ? (
            <div className="text-center py-16">
              <p className="text-sm text-red-400 mb-3">{loadError}</p>
              <button
                type="button"
                onClick={() => load()}
                className={s.ghostBtn}
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className={`text-center py-16 ${s.faint}`}>
              <Paperclip className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No attachments yet</p>
            </div>
          ) : (
            items.map((a) => {
              const mine =
                a.uploaded_by?.toLowerCase() === username.toLowerCase();
              return (
                <div
                  key={a.attachment_id}
                  className={`rounded-xl border p-4 ${s.card}`}
                >
                  <div className="flex items-start justify-between gap-3">
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
                          {fmtSize(a.file_size)} &middot; {a.uploaded_by}{' '}
                          &middot; {fmtDateTime(a.uploaded_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <PermissionGuard
                        menuId={ALERTS_MENU_ID}
                        action="export"
                        fallback={
                          <button
                            type="button"
                            aria-label={`Download ${a.file_name}`}
                            onClick={denyDownload}
                            className={`${s.ghostBtn} opacity-50`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        }
                      >
                        <button
                          type="button"
                          aria-label={`Download ${a.file_name}`}
                          onClick={async () => {
                            try {
                              await alertAttachmentsService.download(a);
                            } catch {
                              notify(
                                `Failed to download ${a.file_name}`,
                                'error'
                              );
                            }
                          }}
                          className={s.ghostBtn}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </PermissionGuard>
                      {mine && canEdit && (
                        <button
                          type="button"
                          aria-label={`Delete ${a.file_name}`}
                          onClick={() => setConfirmDeleteId(a.attachment_id)}
                          className={s.ghostBtn}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  {confirmDeleteId === a.attachment_id && (
                    <div
                      className={`mt-3 flex items-center justify-between gap-3 p-3 rounded-lg border ${
                        s.d
                          ? 'bg-red-500/10 border-red-500/20'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <span
                        className={`text-xs font-medium ${s.d ? 'text-red-300' : 'text-red-700'}`}
                      >
                        Delete this file permanently?
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className={s.ghostBtn}
                        >
                          Cancel
                        </button>
                        <PermissionGuard
                          menuId={ALERTS_MENU_ID}
                          action="delete"
                          fallback={
                            <button
                              type="button"
                              aria-label={`Download ${a.file_name}`}
                              onClick={denayDelete}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                            >
                              {busyId === a.attachment_id && (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              )}
                              Delete
                            </button>
                          }
                        >
                          <button
                            type="button"
                            disabled={busyId === a.attachment_id}
                            onClick={() => deleteItem(a)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                          >
                            {busyId === a.attachment_id && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            Delete
                          </button>
                        </PermissionGuard>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const AlertDispositionModal: React.FC<AlertDispositionModalProps> = ({
  isOpen,
  onClose,
  alert,
  onDispose,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const s = getStyles(theme);

  const notify = useCallback<Notify>(
    (msg, type) => addNotification(msg, type),
    [addNotification]
  );

  const [tab, setTab] = useState<TabKey>('disposition');
  const [step, setStep] = useState<'form' | 'review' | 'success'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [dispositionType, setDispositionType] = useState<
    'TRUE_POSITIVE' | 'FALSE_POSITIVE'
  >('FALSE_POSITIVE');
  const [riskCategory, setRiskCategory] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(
    'LOW'
  );
  const [findings, setFindings] = useState('');
  const [action, setAction] = useState('');
  const [remarks, setRemarks] = useState('');
  const [escalated, setEscalated] = useState(false);
  const [escalationReason, setEscalationReason] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [aiSuggestionUsed, setAiSuggestionUsed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [noteStats, setNoteStats] = useState({ count: 0, overdue: 0 });
  const [fileCount, setFileCount] = useState(0);
  const [notesDirty, setNotesDirty] = useState(false);
  const [filesDirty, setFilesDirty] = useState(false);

  const [, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [, setSelectedAlertDetails] = useState<any>(null);

  const alertId = alert?.alert_id;
  const lockApi = useAlertLock(
    alertId,
    user?.username,
    isOpen && !!alert,
    notify
  );
  // const canEdit = lockApi.isMine;
  const canEdit = true;

  // Reset ONLY when a different alert is opened. (The old effect depended on the
  // whole `alert` object, so any parent refresh that produced a new object
  // identity wiped everything the analyst had typed.)
  useEffect(() => {
    if (!alertId) return;
    setTab('disposition');
    setStep('form');
    setDispositionType('FALSE_POSITIVE');
    setRiskCategory('LOW');
    setFindings('');
    setAction('');
    setRemarks('');
    setEscalated(false);
    setEscalationReason('');
    setFollowUpRequired(false);
    setFollowUpDate('');
    setAiSuggestion(null);
    setAiSuggestionUsed(false);
    setErrors({});
    setNoteStats({ count: 0, overdue: 0 });
    setFileCount(0);
    setNotesDirty(false);
    setFilesDirty(false);
  }, [alertId]);

  /* ---- Scroll fix: lock the page behind the modal ---------------- */
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

  const fetchAlertDetails = useCallback(
    async (alertId: string) => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${apiBaseUrl}/open-alerts-details`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ alert_id: alertId }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setSelectedAlertDetails(data);

        // Log the successful fetch
        logger.info(
          `Alert details fetched for ID: ${alertId}`,
          user?.full_name,
          { alertId }
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch alert details';
        setError(errorMessage);
        console.error('Error fetching alert details:', err);

        // Log the error
        logger.error(
          'Failed to fetch alert details',
          user?.full_name,
          { alertId, error: errorMessage },
          err instanceof Error ? err : new Error(errorMessage)
        );

        // Show notification
        addNotification('Failed to load alert details', 'error');
      } finally {
        setLoading(false);
      }
    },
    [addNotification, user?.full_name]
  );

  useEffect(() => {
    if (isOpen && alertId) fetchAlertDetails(alertId);
  }, [isOpen, alertId, fetchAlertDetails]);

  const isDirty =
    step !== 'success' &&
    (!!findings ||
      !!action ||
      !!remarks ||
      !!escalationReason ||
      notesDirty ||
      filesDirty);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    if (isDirty) {
      toast.warning('You have unsaved changes', {
        title: 'Unsaved changes',
        duration: 10000,
        actionLabel: 'Close anyway',
        onAction: () => onClose(),
      });
      return;
    }
    onClose();
  }, [isSubmitting, isDirty, onClose]);

  // Escape closes the modal (the date picker handles its own Escape first)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  /* ---- Disposition logic ----------------------------------------- */

  const validate = () => {
    const e: Record<string, string> = {};
    if (!findings.trim()) e.findings = 'Findings are required';
    if (!action.trim()) e.action = 'Action taken is required';
    if (escalated && !escalationReason.trim())
      e.escalationReason = 'Escalation reason is required';
    if (followUpRequired && !followUpDate)
      e.followUpDate = 'Select a follow-up date';
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      document
        .getElementById(`field-${first}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alert || !canEdit) return;
    if (!validate()) return;

    if (aiSuggestionUsed && aiSuggestion && aiSuggestion.confidence < 0.7) {
      const confirmed = window.confirm(
        'You are using Suggestions with low confidence. Are you sure you want to continue?'
      );
      if (!confirmed) return;
    }
    setStep('review');
  };

  const handleConfirmDisposition = async () => {
    if (!alert || !user || !canEdit) return;
    setIsSubmitting(true);
    try {
      const disposition: AlertDisposition = {
        alert_id: alert.alert_id,
        action_type: 'DISPOSITION',
        disposition_type: dispositionType,
        risk_category: riskCategory,
        analyst_findings: findings,
        analyst_remarks: remarks,
        analyst_actions: action,
        ai_findings: aiSuggestion?.findings || '',
        ai_remarks: aiSuggestion?.remarks || '',
        ai_actions: aiSuggestion?.action || '',
        ai_confidence_score: aiSuggestion?.confidence || 0,
        ai_similarity_score: aiSuggestion?.similarity || 0,
        is_escalated: escalated,
        escalated_to: escalated ? user.username : null,
        escalation_reason: escalated ? escalationReason : null,
        actioned_by: user.username,
        user_comments: null,
        actioned_at: new Date().toISOString(),
        follow_up_required: followUpRequired,
        followup_assigned_to: followUpRequired ? user.username : '',
        follow_up_date: followUpRequired ? followUpDate : undefined,
        machine_info: {
          UserName: user.username,
          Domain: '',
          Identity: '',
          MachineName: '',
          Network: '',
        },
      };

      const success = await onDispose(disposition);
      if (success) {
        setStep('success');
        // Best effort - the server should also clear the WIP lock on dispose
        lockApi.release().catch(() => undefined);
        logger.info(
          `Alert ${alert.alert_id} disposed as ${dispositionType}`,
          user.full_name,
          {
            alertId: alert.alert_id,
            dispositionType,
            riskCategory,
            aiSuggestionUsed,
            aiConfidence: aiSuggestion?.confidence,
          }
        );
      } else {
        setStep('form');
        addNotification('Failed to save disposition', 'error');
      }
    } catch (error) {
      console.error('Error submitting disposition:', error);
      addNotification('An error occurred while saving disposition', 'error');
      setStep('form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateAISuggestions = async () => {
    if (!alert) return;
    setIsGeneratingAI(true);
    setAiSuggestion(null);
    try {
      const payload = {
        rule_id: alert.rule_id,
        alert_id: alert.alert_id,
        ruleDesc: alert.rule_desc,
        cashier: '',
        ruleRemarks: alert.rule_remarks,
        branch_name: alert.branch_name,
      };
      const res = await apiClient.post<AISuggestion>(
        `${aiURL}/generate_suggestions`,
        payload,
        { skipBodyEncryption: true }
      );
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to generate Suggestions');
      }
      const data = res.data;
      setAiSuggestion(data);

      logger.info('AI suggestion generated', user?.full_name, {
        alertId: alert.alert_id,
        confidence: data.confidence,
        auto_disposition: data.auto_disposition,
        similarity: data.similarity,
      });
      addNotification('Suggestions generated successfully', 'success');
      if (data.confidence < 0.7) {
        addNotification(
          'Suggestions have low confidence. Please review carefully before using.',
          'warning'
        );
      }
    } catch (error) {
      console.error('Error generating Suggestions:', error);
      addNotification('Failed to generate Suggestions', 'error');
      logger.error(
        'Suggestion generation failed',
        user?.full_name,
        { alertId: alert.alert_id, error },
        error instanceof Error ? error : new Error('Suggestion failed')
      );
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const applyAiSuggestion = (field: 'findings' | 'action' | 'remarks') => {
    if (!aiSuggestion || !canEdit) return;
    if (field === 'findings') setFindings(aiSuggestion.findings);
    if (field === 'action') setAction(aiSuggestion.action);
    if (field === 'remarks') setRemarks(aiSuggestion.remarks);
    setErrors((e) => ({ ...e, [field]: '' }));
    setAiSuggestionUsed(true);
    addNotification(`AI suggestion applied to ${field}`, 'success');
  };

  const applyAllSuggestions = () => {
    if (!aiSuggestion || !canEdit) return;
    setFindings(aiSuggestion.findings);
    setAction(aiSuggestion.action);
    setRemarks(aiSuggestion.remarks);
    setErrors({});
    setAiSuggestionUsed(true);
    addNotification('AI suggestions applied to all fields', 'success');
  };

  const useNoteAsFinding = (text: string) => {
    if (!canEdit) {
      addNotification(
        'Mark the alert as WIP to edit the disposition',
        'warning'
      );
      return;
    }
    setFindings((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
    setErrors((e) => ({ ...e, findings: '' }));
    setTab('disposition');
    addNotification('Added to findings', 'success');
  };

  const getConfidenceLabel = (c: number) =>
    c >= 0.8 ? 'High' : c >= 0.6 ? 'Medium' : 'Low';
  const getConfidenceBadgeColor = (c: number) => {
    if (c >= 0.8)
      return s.d
        ? 'bg-green-500/20 text-green-300 border-green-500/30'
        : 'bg-green-100 text-green-700 border-green-300';
    if (c >= 0.6)
      return s.d
        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
        : 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return s.d
      ? 'bg-red-500/20 text-red-300 border-red-500/30'
      : 'bg-red-100 text-red-700 border-red-300';
  };

  if (!isOpen || !alert || typeof document === 'undefined') return null;

  const todayStr = toLocalDateStr();

  const dispositionOptions: SegOption[] = [
    {
      value: 'TRUE_POSITIVE',
      label: 'True Positive',
      icon: AlertCircle,
      activeClass:
        'bg-gradient-to-r from-red-500 to-rose-500 shadow-lg shadow-red-500/25',
    },
    {
      value: 'FALSE_POSITIVE',
      label: 'False Positive',
      icon: CheckCircle,
      activeClass:
        'bg-gradient-to-r from-emerald-500 to-green-500 shadow-lg shadow-emerald-500/25',
    },
  ];

  const RISK_STYLE: Record<
    string,
    { icon: React.ElementType; activeClass: string }
  > = {
    HIGH: {
      icon: AlertTriangle,
      activeClass:
        'bg-gradient-to-r from-red-500 to-rose-500 shadow-lg shadow-red-500/25',
    },
    MEDIUM: {
      icon: Activity,
      activeClass:
        'bg-gradient-to-r from-yellow-500 to-amber-500 shadow-lg shadow-amber-500/25',
    },
    LOW: {
      icon: ShieldCheck,
      activeClass:
        'bg-gradient-to-r from-emerald-500 to-green-500 shadow-lg shadow-emerald-500/25',
    },
  };
  const riskOptions: SegOption[] = RISK_CATEGORIES.map((category) => ({
    value: category,
    label: category,
    icon: RISK_STYLE[category]?.icon,
    activeClass: RISK_STYLE[category]?.activeClass || '',
  }));

  const errCls = (k: string) => (errors[k] ? s.inputError : '');

  /* ---- Reusable chunks ------------------------------------------- */

  const alertInfo = (
    <div className="space-y-4">
      <SectionCard
        icon={Info}
        iconClass="bg-gradient-to-br from-blue-500 to-indigo-600"
        title="Alert Summary"
        theme={theme}
      >
        <div className="grid grid-cols-2 gap-4 mb-4">
          <InfoRow
            label="Service Type"
            value={alert.service_type}
            theme={theme}
          />
          <InfoRow
            label="Priority"
            value={alert.priority || 'MEDIUM'}
            theme={theme}
          />
          <InfoRow
            label="Status"
            value={alert.status || 'OPEN'}
            theme={theme}
          />
          <InfoRow
            label="Timestamp"
            value={new Date(alert.time_stamp).toLocaleString()}
            theme={theme}
          />
        </div>
        <div className={`pt-4 border-t ${s.divider}`}>
          <InfoRow
            label="Rule Remarks"
            value={alert.rule_remarks}
            theme={theme}
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={User}
        iconClass="bg-gradient-to-br from-teal-500 to-cyan-600"
        title="Customer"
        theme={theme}
      >
        <div className="grid grid-cols-2 gap-4">
          <InfoRow
            label="Customer Name"
            value={alert.cust_name}
            theme={theme}
          />
          <InfoRow
            label="Customer Code"
            value={alert.cust_code}
            theme={theme}
            icon={Hash}
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={Building2}
        iconClass="bg-gradient-to-br from-orange-500 to-amber-600"
        title="Rule"
        theme={theme}
      >
        <div className="grid grid-cols-2 gap-4 mb-4">
          <InfoRow label="Rule ID" value={alert.rule_id} theme={theme} />
          <InfoRow
            label="Branch"
            value={alert.branch_name || 'N/A'}
            theme={theme}
            icon={MapPin}
          />
        </div>
        <div className={`pt-4 border-t ${s.divider}`}>
          <InfoRow
            label="Rule Description"
            value={alert.rule_desc}
            theme={theme}
          />
        </div>
      </SectionCard>
    </div>
  );

  const assessment: Partial<confidence_assessment> | null = Array.isArray(
    aiSuggestion?.assessment
  )
    ? (aiSuggestion!.assessment[0] ?? null)
    : ((aiSuggestion?.assessment as any) ?? null);

  const suggestionCard = (
    kind: 'findings' | 'action' | 'remarks',
    title: string,
    icon: React.ElementType,
    tone: 'blue' | 'green' | 'orange',
    text: string
  ) => {
    const Icon = icon;
    const tones = {
      blue: [
        'bg-blue-500/10 border-blue-500/20',
        'bg-blue-50 border-blue-200',
        'text-blue-400',
        'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300',
        'bg-blue-100 hover:bg-blue-200 text-blue-700',
      ],
      green: [
        'bg-green-500/10 border-green-500/20',
        'bg-green-50 border-green-200',
        'text-green-400',
        'bg-green-500/20 hover:bg-green-500/30 text-green-300',
        'bg-green-100 hover:bg-green-200 text-green-700',
      ],
      orange: [
        'bg-orange-500/10 border-orange-500/20',
        'bg-orange-50 border-orange-200',
        'text-orange-400',
        'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300',
        'bg-orange-100 hover:bg-orange-200 text-orange-700',
      ],
    }[tone];
    return (
      <div className={`p-4 rounded-xl border ${s.d ? tones[0] : tones[1]}`}>
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${tones[2]}`} />
            <span className={`font-medium text-sm ${s.text}`}>{title}</span>
          </div>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => applyAiSuggestion(kind)}
            className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
              s.d ? tones[3] : tones[4]
            }`}
          >
            Use
          </button>
        </div>
        <div
          className={`text-sm whitespace-pre-wrap break-words ${s.d ? 'text-white/80' : 'text-gray-700'}`}
        >
          {text}
        </div>
      </div>
    );
  };

  const aiPanel = (
    <SectionCard
      icon={Bot}
      iconClass="bg-gradient-to-br from-purple-500 to-fuchsia-600"
      title="Suggestions"
      theme={theme}
      right={
        <button
          type="button"
          onClick={generateAISuggestions}
          disabled={isGeneratingAI}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
            s.d
              ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30'
              : 'bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300'
          }`}
        >
          {isGeneratingAI ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{aiSuggestion ? 'Regenerate' : 'Generate'}</span>
            </>
          )}
        </button>
      }
    >
      {aiSuggestion ? (
        <div className="space-y-3">
          <div
            className={`p-4 rounded-xl border ${
              s.d
                ? 'bg-purple-500/10 border-purple-500/20'
                : 'bg-purple-50 border-purple-200'
            }`}
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg shrink-0 ${s.d ? 'bg-purple-500/20' : 'bg-purple-100'}`}
                >
                  <Brain className="w-4 h-4 text-purple-400" />
                </div>
                <div className="min-w-0">
                  <div className={`font-medium ${s.text}`}>Analysis Result</div>
                  <div className={`text-sm mt-1 ${s.sub}`}>
                    {aiSuggestion.analysis}
                  </div>
                </div>
              </div>
              <div
                className={`px-2 py-1 text-xs font-medium rounded-full border whitespace-nowrap shrink-0 ${getConfidenceBadgeColor(
                  aiSuggestion.confidence
                )}`}
              >
                {getConfidenceLabel(aiSuggestion.confidence)}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-dashed border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs ${s.faint}`}>Confidence</span>
                <ConfidenceMeter
                  confidence={aiSuggestion.confidence}
                  theme={theme}
                />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className={s.faint}>
                  Recommended:{' '}
                  <span
                    className={`font-semibold ${s.d ? 'text-white/80' : 'text-gray-700'}`}
                  >
                    {DISPOSITION_LABELS[aiSuggestion.auto_disposition] ??
                      aiSuggestion.auto_disposition}
                  </span>
                </span>
                <span className={s.faint}>
                  Similarity: {Math.round(aiSuggestion.similarity * 100)}%
                </span>
              </div>
              {assessment && (
                <div
                  className={`mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs ${s.faint}`}
                >
                  {assessment.evidence_completeness && (
                    <div>
                      Evidence:{' '}
                      <span className={s.text}>
                        {assessment.evidence_completeness}
                      </span>
                    </div>
                  )}
                  {assessment.rule_match && (
                    <div>
                      Rule match:{' '}
                      <span className={s.text}>{assessment.rule_match}</span>
                    </div>
                  )}
                  {assessment.data_reliability && (
                    <div>
                      Data reliability:{' '}
                      <span className={s.text}>
                        {assessment.data_reliability}
                      </span>
                    </div>
                  )}
                  {assessment.overall_confidence && (
                    <div>
                      Overall:{' '}
                      <span className={s.text}>
                        {assessment.overall_confidence}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {suggestionCard(
            'findings',
            'Suggested Findings',
            Lightbulb,
            'blue',
            aiSuggestion.findings
          )}
          {suggestionCard(
            'action',
            'Suggested Action',
            Zap,
            'green',
            aiSuggestion.action
          )}
          {suggestionCard(
            'remarks',
            'Suggested Remarks',
            FileText,
            'orange',
            aiSuggestion.remarks
          )}

          <button
            type="button"
            disabled={!canEdit}
            onClick={applyAllSuggestions}
            className={`w-full ${s.ghostBtn} !py-2.5 text-sm`}
          >
            <Sparkles className="w-4 h-4" />
            Use all suggestions
          </button>
        </div>
      ) : (
        <div
          className={`p-8 text-center rounded-xl border border-dashed ${
            s.d
              ? 'border-white/10 text-white/50'
              : 'border-gray-200 text-gray-500'
          }`}
        >
          <BotMessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            Generate suggestions to help with the disposition
          </p>
          <p className="text-xs mt-1.5">
            Analyses the alert and recommends findings, actions and a
            disposition
          </p>
        </div>
      )}
    </SectionCard>
  );

  const toggleBox = (
    id: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    icon: React.ReactNode,
    label: string,
    tone: 'red' | 'blue',
    children?: React.ReactNode
  ) => (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        checked
          ? tone === 'red'
            ? s.d
              ? 'bg-red-500/5 border-red-500/20'
              : 'bg-red-50/50 border-red-200'
            : s.d
              ? 'bg-blue-500/5 border-blue-500/20'
              : 'bg-blue-50/50 border-blue-200'
          : s.d
            ? 'bg-white/[0.02] border-white/10'
            : 'bg-gray-50/50 border-gray-200'
      }`}
    >
      <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className={`w-4 h-4 rounded cursor-pointer ${
            tone === 'red'
              ? 'text-red-500 focus:ring-red-500'
              : 'text-blue-600 focus:ring-blue-500'
          } ${s.d ? 'bg-white/10 border-white/20' : 'bg-white border-gray-300'}`}
        />
        <span
          className={`text-sm font-semibold flex items-center gap-1.5 ${s.d ? 'text-white/80' : 'text-gray-700'}`}
        >
          {icon}
          {label}
        </span>
      </label>
      <AnimatePresence initial={false}>
        {checked && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  /* ---- Lock banner ------------------------------------------------ */

  const lockBanner = (() => {
    if (lockApi.checking && !lockApi.lock) {
      return (
        <div
          className={`shrink-0 flex items-center gap-2 px-6 py-2.5 text-xs border-b ${s.divider} ${s.faint}`}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking whether
          anyone else is working on this alert...
        </div>
      );
    }
    if (lockApi.statusFailed && !lockApi.lock) {
      return (
        <div
          className={`shrink-0 flex items-center justify-between gap-3 px-6 py-2.5 text-xs border-b ${s.d ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Couldn&apos;t verify the WIP status of this alert. Editing is
            disabled until it can be checked.
          </span>
          <button
            type="button"
            onClick={lockApi.refresh}
            className={s.ghostBtn}
          >
            Retry
          </button>
        </div>
      );
    }
    if (lockApi.isOther) {
      return (
        <div
          className={`shrink-0 flex items-center gap-2 px-6 py-2.5 text-xs border-b ${s.d ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}
        >
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>
              {lockApi.lock?.locked_by_name || lockApi.lock?.locked_by}
            </strong>{' '}
            is working on this alert
            {lockApi.lock?.locked_at
              ? ` (since ${fmtDateTime(lockApi.lock.locked_at)})`
              : ''}
            . You can view it and keep private notes, but disposition and
            uploads are read-only.
          </span>
        </div>
      );
    }
    if (!lockApi.isMine) {
      return (
        <div
          className={`shrink-0 flex items-center justify-between gap-3 px-6 py-2.5 text-xs border-b ${s.d ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}
        >
          <span className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 shrink-0" />
            You are viewing this alert. Mark it as <strong>WIP</strong> to lock
            it to you and start the disposition.
          </span>
          <button
            type="button"
            onClick={lockApi.acquire}
            disabled={lockApi.busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 shrink-0"
          >
            {lockApi.busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Start working (WIP)
          </button>
        </div>
      );
    }
    return null;
  })();

  /* ---- Tabs -------------------------------------------------------- */

  const tabs: {
    key: TabKey;
    label: string;
    icon: React.ElementType;
    badge?: number;
    alertDot?: boolean;
    mobileOnly?: boolean;
  }[] = [
    { key: 'info', label: 'Alert Info', icon: Info, mobileOnly: true },
    { key: 'disposition', label: 'Disposition', icon: Target },
    {
      key: 'notes',
      label: 'Notes',
      icon: StickyNote,
      badge: noteStats.count,
      alertDot: noteStats.overdue > 0,
    },
    { key: 'files', label: 'Attachments', icon: Paperclip, badge: fileCount },
  ];

  const priority = (alert.priority || 'MEDIUM').toUpperCase();
  const priorityCls =
    priority === 'HIGH' || priority === 'CRITICAL'
      ? s.d
        ? 'bg-red-500/15 text-red-300 border-red-500/30'
        : 'bg-red-50 text-red-700 border-red-200'
      : priority === 'LOW'
        ? s.d
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : s.d
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-amber-50 text-amber-700 border-amber-200';

  /* ---- Render ------------------------------------------------------ */

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center p-0 md:p-3 bg-black/70 backdrop-blur-sm overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label={`Alert disposition ${alert.alert_id}`}
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
        <div className="h-[3px] w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shrink-0" />

        {/* Header */}
        <div className={`px-5 md:px-6 py-4 border-b shrink-0 ${s.divider}`}>
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0 hidden sm:block">
                <div className="absolute inset-0 bg-blue-500 rounded-2xl blur-lg opacity-40" />
                <div className="relative p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={`text-xl md:text-2xl font-bold ${s.text}`}>
                    Alert Disposition
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      s.d
                        ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    <Hash className="w-3 h-3" />
                    {alert.alert_id}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${priorityCls}`}
                  >
                    {priority}
                  </span>
                  {lockApi.isMine && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      <Lock className="w-3 h-3" /> WIP &middot; You
                    </span>
                  )}
                  {lockApi.isOther && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-500/15 text-red-400 border-red-500/30">
                      <Lock className="w-3 h-3" /> Locked &middot;{' '}
                      {lockApi.lock?.locked_by_name || lockApi.lock?.locked_by}
                    </span>
                  )}
                </div>
                <p className={`text-sm truncate ${s.faint}`}>
                  {alert.cust_name} &middot; {alert.rule_id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {lockApi.isMine && step !== 'success' && (
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      isDirty &&
                      !window.confirm(
                        'Releasing the alert keeps your typed text, but other analysts can then pick it up. Release?'
                      )
                    )
                      return;
                    await lockApi.release();
                  }}
                  disabled={lockApi.busy}
                  className={s.ghostBtn + ' !px-3 !py-2'}
                >
                  {lockApi.busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Release</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
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

          {/* Tab bar */}
          <div className="mt-4 -mb-4 flex gap-1 overflow-x-auto" role="tablist">
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
                    t.mobileOnly ? 'lg:hidden' : ''
                  } ${
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
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                        s.d
                          ? 'bg-white/15 text-white'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                  {t.alertDot && (
                    <span
                      className="w-2 h-2 rounded-full bg-red-500"
                      title="Overdue reminder"
                    />
                  )}
                  {active && (
                    <motion.div
                      layoutId="tabUnderline"
                      className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {lockBanner}

        {/* Body: persistent context sidebar + fixed-size tab area */}
        <div className="flex-1 min-h-0 flex">
          <aside
            className={`hidden lg:block w-[340px] xl:w-[380px] shrink-0 overflow-y-auto overscroll-contain p-5 border-r ${s.divider}`}
          >
            {alertInfo}
          </aside>

          <main className="flex-1 min-w-0 min-h-0 relative">
            {/* Panels stay mounted (hidden) so drafts survive tab switches */}
            <section
              className={
                tab === 'info'
                  ? 'h-full overflow-y-auto overscroll-contain p-5 lg:hidden'
                  : 'hidden'
              }
            >
              {alertInfo}
            </section>

            {/* ---------------- Disposition ---------------- */}
            <section
              className={
                tab === 'disposition'
                  ? 'h-full min-h-0 flex flex-col'
                  : 'hidden'
              }
            >
              <div className={`shrink-0 px-6 py-4 border-b ${s.divider}`}>
                <StepIndicator step={step} theme={theme} />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">
                <AnimatePresence mode="wait" initial={false}>
                  {step === 'form' && (
                    <motion.form
                      key="form"
                      id="disposition-form"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      onSubmit={handleSubmit}
                      noValidate
                      className="grid grid-cols-1 2xl:grid-cols-5 gap-6"
                    >
                      <fieldset
                        disabled={!canEdit}
                        className={`min-w-0 2xl:col-span-3 ${!canEdit ? 'opacity-70' : ''}`}
                      >
                        <SectionCard
                          icon={Target}
                          iconClass="bg-gradient-to-br from-slate-600 to-slate-800"
                          title="Disposition Details"
                          theme={theme}
                        >
                          <div className="space-y-5">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                              <div>
                                <label className={s.label}>
                                  Disposition Type
                                </label>
                                <SegmentedControl
                                  options={dispositionOptions}
                                  value={dispositionType}
                                  onChange={(v) =>
                                    setDispositionType(
                                      v as 'TRUE_POSITIVE' | 'FALSE_POSITIVE'
                                    )
                                  }
                                  theme={theme}
                                  layoutId="dispositionPill"
                                />
                              </div>
                              <div>
                                <label className={s.label}>Risk Category</label>
                                <SegmentedControl
                                  options={riskOptions}
                                  value={riskCategory}
                                  onChange={(v) =>
                                    setRiskCategory(
                                      v as 'HIGH' | 'MEDIUM' | 'LOW'
                                    )
                                  }
                                  theme={theme}
                                  layoutId="riskPill"
                                />
                              </div>
                            </div>

                            <Field
                              id="findings"
                              label="Findings"
                              required
                              theme={theme}
                              error={errors.findings}
                            >
                              <textarea
                                value={findings}
                                onChange={(e) => {
                                  setFindings(e.target.value);
                                  if (errors.findings)
                                    setErrors((x) => ({ ...x, findings: '' }));
                                }}
                                rows={5}
                                className={`${s.input} ${errCls('findings')}`}
                                placeholder="Enter your findings..."
                              />
                            </Field>

                            <Field
                              id="action"
                              label="Action Taken"
                              required
                              theme={theme}
                              error={errors.action}
                            >
                              <textarea
                                value={action}
                                onChange={(e) => {
                                  setAction(e.target.value);
                                  if (errors.action)
                                    setErrors((x) => ({ ...x, action: '' }));
                                }}
                                rows={3}
                                className={`${s.input} ${errCls('action')}`}
                                placeholder="Describe actions taken..."
                              />
                            </Field>

                            <Field id="remarks" label="Remarks" theme={theme}>
                              <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                rows={2}
                                className={s.input}
                                placeholder="Additional remarks..."
                              />
                            </Field>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                              {toggleBox(
                                'escalated',
                                escalated,
                                setEscalated,
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
                                'Escalate to Compliance',
                                'red',
                                <Field
                                  id="escalationReason"
                                  label="Escalation reason"
                                  required
                                  theme={theme}
                                  error={errors.escalationReason}
                                >
                                  <textarea
                                    value={escalationReason}
                                    onChange={(e) => {
                                      setEscalationReason(e.target.value);
                                      if (errors.escalationReason)
                                        setErrors((x) => ({
                                          ...x,
                                          escalationReason: '',
                                        }));
                                    }}
                                    rows={2}
                                    className={`${s.input} ${errCls('escalationReason')}`}
                                    placeholder="Reason for escalation..."
                                  />
                                </Field>
                              )}
                              {toggleBox(
                                'followUp',
                                followUpRequired,
                                setFollowUpRequired,
                                <Calendar className="w-3.5 h-3.5 text-blue-400" />,
                                'Follow-up Required',
                                'blue',
                                <Field
                                  id="followUpDate"
                                  label="Follow-up date"
                                  required
                                  theme={theme}
                                  error={errors.followUpDate}
                                >
                                  <FollowUpDatePicker
                                    value={followUpDate}
                                    onChange={(v) => {
                                      setFollowUpDate(v);
                                      if (errors.followUpDate)
                                        setErrors((x) => ({
                                          ...x,
                                          followUpDate: '',
                                        }));
                                    }}
                                    minDate={todayStr}
                                    theme={theme}
                                    hasError={!!errors.followUpDate}
                                  />
                                </Field>
                              )}
                            </div>
                          </div>
                        </SectionCard>
                      </fieldset>

                      <div className="min-w-0 2xl:col-span-2">{aiPanel}</div>
                    </motion.form>
                  )}

                  {step === 'review' && (
                    <motion.div
                      key="review"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className="max-w-4xl mx-auto"
                    >
                      <div className={`rounded-2xl border p-6 ${s.card}`}>
                        <div className="flex items-center gap-2.5 mb-6">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-sm">
                            <ClipboardCheck className="w-4 h-4 text-white" />
                          </div>
                          <h3 className={`text-lg font-semibold ${s.text}`}>
                            Review Disposition
                          </h3>
                        </div>

                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <div
                                className={`text-sm font-medium mb-2 ${s.sub}`}
                              >
                                Disposition Type
                              </div>
                              <div
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                  dispositionType === 'TRUE_POSITIVE'
                                    ? s.d
                                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                      : 'bg-red-100 text-red-700 border border-red-300'
                                    : s.d
                                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                      : 'bg-green-100 text-green-700 border border-green-300'
                                }`}
                              >
                                {dispositionType === 'TRUE_POSITIVE' ? (
                                  <>
                                    <AlertCircle className="w-4 h-4" />
                                    <span>True Positive</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>False Positive</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div>
                              <div
                                className={`text-sm font-medium mb-2 ${s.sub}`}
                              >
                                Risk Category
                              </div>
                              <div
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                  riskCategory === 'HIGH'
                                    ? s.d
                                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                      : 'bg-red-100 text-red-700 border border-red-300'
                                    : riskCategory === 'MEDIUM'
                                      ? s.d
                                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                        : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                      : s.d
                                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                        : 'bg-green-100 text-green-700 border border-green-300'
                                }`}
                              >
                                {riskCategory}
                              </div>
                            </div>
                          </div>

                          <ReviewBlock label="Findings" theme={theme}>
                            {findings}
                          </ReviewBlock>
                          <ReviewBlock label="Action Taken" theme={theme}>
                            {action}
                          </ReviewBlock>
                          {remarks && (
                            <ReviewBlock label="Remarks" theme={theme}>
                              {remarks}
                            </ReviewBlock>
                          )}
                          {escalated && (
                            <ReviewBlock
                              label="Escalation Reason"
                              theme={theme}
                            >
                              {escalationReason}
                            </ReviewBlock>
                          )}
                          {followUpRequired && (
                            <ReviewBlock label="Follow-up Date" theme={theme}>
                              {new Date(
                                `${followUpDate}T00:00:00`
                              ).toLocaleDateString()}
                            </ReviewBlock>
                          )}
                          {fileCount > 0 && (
                            <ReviewBlock label="Attachments" theme={theme}>
                              {fileCount} file{fileCount > 1 ? 's' : ''}{' '}
                              attached to this alert
                            </ReviewBlock>
                          )}

                          {aiSuggestionUsed && aiSuggestion && (
                            <div
                              className={`p-4 rounded-lg border ${
                                s.d
                                  ? 'bg-purple-500/10 border-purple-500/20'
                                  : 'bg-purple-50 border-purple-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Brain className="w-4 h-4 text-purple-400" />
                                <span
                                  className={`text-sm font-medium ${s.text}`}
                                >
                                  AI
                                </span>
                              </div>
                              <div className={`text-xs mt-1 ${s.sub}`}>
                                AI suggestions with{' '}
                                {Math.round(aiSuggestion.confidence * 100)}%
                                confidence were used in this disposition.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 'success' && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="text-center py-14"
                    >
                      <div className="relative w-24 h-24 mx-auto mb-6">
                        <motion.div
                          initial={{ scale: 0.6, opacity: 0.6 }}
                          animate={{ scale: 1.6, opacity: 0 }}
                          transition={{
                            duration: 1.4,
                            repeat: Infinity,
                            ease: 'easeOut',
                          }}
                          className="absolute inset-0 rounded-full bg-emerald-500/40"
                        />
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            delay: 0.15,
                            type: 'spring',
                            stiffness: 200,
                          }}
                          className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30"
                        >
                          <CheckCircle className="w-11 h-11 text-white" />
                        </motion.div>
                      </div>
                      <h3 className={`text-2xl font-bold mb-2 ${s.text}`}>
                        Disposition Submitted
                      </h3>
                      <p className={`mb-8 ${s.sub}`}>
                        The alert has been successfully dispositioned
                      </p>
                      <button
                        type="button"
                        onClick={onClose}
                        className={`px-7 py-3 rounded-xl font-semibold transition-colors ${
                          s.d
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        Close
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sticky action bar - always visible, never scrolls away */}
              {step !== 'success' && (
                <div
                  className={`shrink-0 flex items-center justify-between gap-3 px-6 py-3 border-t ${s.divider} ${s.d ? 'bg-slate-950/40' : 'bg-white/70'} backdrop-blur`}
                >
                  {step === 'form' ? (
                    <>
                      <span className={`text-xs hidden md:block ${s.faint}`}>
                        {canEdit
                          ? 'Not ready to finish? Save progress in the Notes tab - it does not dispose the alert.'
                          : 'Mark the alert as WIP to edit and submit the disposition.'}
                      </span>
                      <button
                        type="submit"
                        form="disposition-form"
                        disabled={!canEdit}
                        className={`${s.primaryBtn} ml-auto`}
                      >
                        <Send className="w-5 h-5" />
                        Review Disposition
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setStep('form')}
                        disabled={isSubmitting}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors disabled:opacity-50 ${
                          s.d
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <ChevronLeft className="w-5 h-5" />
                        Back to Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDisposition}
                        disabled={isSubmitting || !canEdit}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            <span>Confirm &amp; Submit</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* ---------------- Notes ---------------- */}
            <section className={tab === 'notes' ? 'h-full min-h-0' : 'hidden'}>
              <NotesPanel
                alertId={alert.alert_id}
                username={user?.username || ''}
                theme={theme}
                notify={notify}
                onUseAsFinding={useNoteAsFinding}
                onStats={setNoteStats}
                onDirtyChange={setNotesDirty}
              />
            </section>

            {/* ---------------- Attachments ---------------- */}
            <section className={tab === 'files' ? 'h-full min-h-0' : 'hidden'}>
              <AttachmentsPanel
                alertId={alert.alert_id}
                username={user?.username || ''}
                theme={theme}
                canEdit={canEdit}
                notify={notify}
                onStats={setFileCount}
                onDirtyChange={setFilesDirty}
              />
            </section>
          </main>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default AlertDispositionModal;
