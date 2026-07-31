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
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../notifications';
import { AlertSummary, AlertDisposition } from '../../types/alerts';
import { logger } from '../../utils/logger';
import { appConfig as config } from '../../config/runtime-config';

// Disposition type labels
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

const apiBaseUrl = config.api.baseUrl;
const aiURL = config.api.aisuggestions;

// Risk category options
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

/* ------------------------------------------------------------------ */
/*  Small, presentational helper components (no business logic)       */
/* ------------------------------------------------------------------ */

const SectionCard: React.FC<{
  icon: React.ElementType;
  iconClass: string;
  title: string;
  theme: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, iconClass, title, theme, right, children, className }) => (
  <div
    className={`rounded-2xl border p-5 transition-colors duration-200 ${
      theme === 'dark'
        ? 'bg-white/[0.04] border-white/10 hover:border-white/[0.15]'
        : 'bg-white border-gray-200 shadow-sm hover:shadow-md'
    } ${className || ''}`}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-xl shadow-sm ${iconClass}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h3
          className={`text-[15px] font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          {title}
        </h3>
      </div>
      {right}
    </div>
    {children}
  </div>
);

const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
  theme: string;
  icon?: React.ElementType;
}> = ({ label, value, theme, icon: Icon }) => (
  <div>
    <div
      className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1 uppercase tracking-wider ${
        theme === 'dark' ? 'text-white/40' : 'text-gray-500'
      }`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </div>
    <div
      className={`text-sm font-medium leading-snug ${
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      }`}
    >
      {value}
    </div>
  </div>
);

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
}> = ({ options, value, onChange, theme, layoutId }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const active = value === opt.value;
      const Icon = opt.icon;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`relative px-4 py-2 rounded-xl text-sm font-medium overflow-hidden transition-colors duration-150 ${
            active
              ? 'text-white'
              : theme === 'dark'
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

const ConfidenceMeter: React.FC<{ confidence: number; theme: string }> = ({
  confidence,
  theme,
}) => {
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
          theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
        }`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
        />
      </div>
      <span
        className={`text-xs font-bold tabular-nums ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}
      >
        {pct}%
      </span>
    </div>
  );
};

const STEP_META = [
  { key: 'form', label: 'Disposition Details', icon: FileText },
  { key: 'review', label: 'Review & Confirm', icon: ClipboardCheck },
  { key: 'success', label: 'Complete', icon: CheckCircle },
] as const;

const StepIndicator: React.FC<{
  step: 'form' | 'review' | 'success';
  theme: string;
}> = ({ step, theme }) => {
  const activeIndex = STEP_META.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center w-full">
      {STEP_META.map((s, idx) => {
        const isDone = idx < activeIndex;
        const isActive = idx === activeIndex;
        const Icon = s.icon;
        return (
          <React.Fragment key={s.key}>
            <div className="flex items-center gap-2.5 shrink-0">
              <div
                className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${
                  isDone
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-500 border-transparent'
                    : isActive
                      ? theme === 'dark'
                        ? 'border-blue-400 bg-blue-500/20'
                        : 'border-blue-500 bg-blue-50'
                      : theme === 'dark'
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
                        ? theme === 'dark'
                          ? 'text-blue-300'
                          : 'text-blue-600'
                        : theme === 'dark'
                          ? 'text-white/40'
                          : 'text-gray-400'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-xs font-semibold hidden sm:block whitespace-nowrap ${
                  isActive
                    ? theme === 'dark'
                      ? 'text-white'
                      : 'text-gray-900'
                    : theme === 'dark'
                      ? 'text-white/40'
                      : 'text-gray-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < STEP_META.length - 1 && (
              <div
                className={`flex-1 h-[2px] mx-3 rounded-full overflow-hidden ${
                  theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
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

/* ------------------------------------------------------------------ */
/*  Custom follow-up calendar date picker                              */
/*  Keeps the exact same "YYYY-MM-DD" string contract as the old       */
/*  native <input type="date" /> so no state/API shape changes.        */
/* ------------------------------------------------------------------ */

const FollowUpDatePicker: React.FC<{
  value: string;
  onChange: (date: string) => void;
  minDate: string;
  theme: string;
}> = ({ value, onChange, minDate, theme }) => {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() =>
    value ? new Date(`${value}T00:00:00`) : new Date(`${minDate}T00:00:00`)
  );
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    openUp: boolean;
  }>({
    top: 0,
    left: 0,
    openUp: false,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // The modal shell uses `overflow-hidden` / `overflow-y-auto` for its rounded
  // corners and scroll area. An absolutely-positioned popover nested inside
  // those ancestors gets clipped instead of floating above the modal, so this
  // popover is rendered through a portal into document.body and positioned
  // using the trigger's live viewport coordinates instead.
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
    // capture:true so scroll events from the modal's internal scroll
    // container (which don't bubble) are still picked up here
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

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
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isDisabled = (d: number) => {
    const candidate = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
    return (
      candidate < new Date(min.getFullYear(), min.getMonth(), min.getDate())
    );
  };

  const isSelected = (d: number) => {
    if (!value) return false;
    const sel = new Date(`${value}T00:00:00`);
    return (
      sel.getFullYear() === viewDate.getFullYear() &&
      sel.getMonth() === viewDate.getMonth() &&
      sel.getDate() === d
    );
  };

  const isToday = (d: number) => {
    const now = new Date();
    return (
      now.getFullYear() === viewDate.getFullYear() &&
      now.getMonth() === viewDate.getMonth() &&
      now.getDate() === d
    );
  };

  const selectDay = (d: number) => {
    const chosen = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
    onChange(toDateStr(chosen));
    setOpen(false);
  };

  const goToday = () => {
    const t = min > new Date() ? min : new Date();
    setViewDate(t);
    onChange(toDateStr(t));
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

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
          theme === 'dark'
            ? `bg-white/10 border-white/20 text-white hover:bg-white/[0.14] ${
                open ? 'ring-2 ring-blue-500 border-transparent' : ''
              }`
            : `bg-white border-gray-300 text-gray-900 hover:bg-gray-50 ${
                open ? 'ring-2 ring-blue-500 border-transparent' : ''
              }`
        }`}
      >
        <span
          className={`flex items-center gap-2 truncate ${
            !value ? (theme === 'dark' ? 'text-white/45' : 'text-gray-400') : ''
          }`}
        >
          <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
          {displayValue}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          } ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`}
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
                  theme === 'dark'
                    ? 'bg-slate-900 border-white/15'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={() =>
                      setViewDate(
                        new Date(
                          viewDate.getFullYear(),
                          viewDate.getMonth() - 1,
                          1
                        )
                      )
                    }
                    className={`p-1.5 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-white/10 text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div
                    className={`font-semibold text-sm ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {monthLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setViewDate(
                        new Date(
                          viewDate.getFullYear(),
                          viewDate.getMonth() + 1,
                          1
                        )
                      )
                    }
                    className={`p-1.5 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'hover:bg-white/10 text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className={`grid grid-cols-7 mb-1 text-center text-[11px] font-semibold ${
                    theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                  }`}
                >
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i}>{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1">
                  {cells.map((d, i) => {
                    if (d === null) return <div key={`empty-${i}`} />;
                    const disabled = isDisabled(d);
                    const selected = isSelected(d);
                    const today = isToday(d);
                    return (
                      <div key={i} className="flex justify-center">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => selectDay(d)}
                          className={`relative h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                            selected
                              ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30'
                              : disabled
                                ? theme === 'dark'
                                  ? 'text-white/15 cursor-not-allowed'
                                  : 'text-gray-300 cursor-not-allowed'
                                : theme === 'dark'
                                  ? 'text-white/80 hover:bg-white/10'
                                  : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {d}
                          {today && !selected && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div
                  className={`flex justify-between mt-3 pt-3 border-t ${
                    theme === 'dark' ? 'border-white/10' : 'border-gray-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={goToday}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      theme === 'dark'
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
                      theme === 'dark'
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

  const [step, setStep] = useState<'form' | 'review' | 'success'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlertDetails, setSelectedAlertDetails] = useState<any>(null);

  // Reset form when alert changes
  useEffect(() => {
    if (alert) {
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
      setShowAiAnalysis(false);
      setAiSuggestionUsed(false);
    }
  }, [alert]);

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
    if (isOpen && alert) {
      fetchAlertDetails(alert.alert_id);
    }
  }, [isOpen, alert, fetchAlertDetails]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!alert) return;

    // Validate form
    if (!findings) {
      addNotification('Please enter findings', 'warning');
      return;
    }

    if (!action) {
      addNotification('Please enter action taken', 'warning');
      return;
    }

    if (escalated && !escalationReason) {
      addNotification('Please enter escalation reason', 'warning');
      return;
    }

    if (followUpRequired && !followUpDate) {
      addNotification('Please select follow-up date', 'warning');
      return;
    }

    // If AI suggestion was used with low confidence, confirm
    if (aiSuggestionUsed && aiSuggestion && aiSuggestion.confidence < 0.7) {
      const confirmed = window.confirm(
        'You are using AI suggestions with low confidence. Are you sure you want to continue?'
      );
      if (!confirmed) return;
    }

    // Move to review step
    setStep('review');
  };

  const handleConfirmDisposition = async () => {
    if (!alert || !user) return;

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

        // Log the disposition
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

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const generateAISuggestions = async () => {
    if (!alert) return;

    setIsGeneratingAI(true);
    setAiSuggestion(null);
    try {
      // Prepare the payload with the required fields
      const payload = {
        rule_id: alert.rule_id,
        alert_id: alert.alert_id,
        ruleDesc: alert.rule_desc,
        cashier: '',
        ruleRemarks: alert.rule_remarks,
        branch_name: alert.branch_name,
      };

      // Call the AI suggestions API
      const response = await fetch(`${aiURL}/generate_suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Set the AI suggestion
      setAiSuggestion(data);
      setShowAiAnalysis(true);

      // Log the AI suggestion
      logger.info('AI suggestion generated', user?.full_name, {
        alertId: alert.alert_id,
        confidence: data.confidence,
        auto_disposition: data.auto_disposition,
        similarity: data.similarity,
      });

      // Show notification
      addNotification('AI suggestions generated successfully', 'success');

      // Show warning if confidence is low
      if (data.confidence < 0.7) {
        addNotification(
          'AI suggestions have low confidence. Please review carefully before using.',
          'warning'
        );
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      addNotification('Failed to generate AI suggestions', 'error');

      // Log the error
      logger.error(
        'AI suggestion generation failed',
        user?.full_name,
        { alertId: alert.alert_id, error },
        error instanceof Error ? error : new Error('AI suggestion failed')
      );
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const applyAiSuggestion = (field: 'findings' | 'action' | 'remarks') => {
    if (!aiSuggestion) return;

    switch (field) {
      case 'findings':
        setFindings(aiSuggestion.findings);
        break;
      case 'action':
        setAction(aiSuggestion.action);
        break;
      case 'remarks':
        setRemarks(aiSuggestion.remarks);
        break;
    }

    setAiSuggestionUsed(true);
    addNotification(`AI suggestion applied to ${field}`, 'success');
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.8) {
      return theme === 'dark'
        ? 'bg-green-500/20 text-green-300 border-green-500/30'
        : 'bg-green-100 text-green-700 border-green-300';
    } else if (confidence >= 0.6) {
      return theme === 'dark'
        ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
        : 'bg-yellow-100 text-yellow-700 border-yellow-300';
    } else {
      return theme === 'dark'
        ? 'bg-red-500/20 text-red-300 border-red-500/30'
        : 'bg-red-100 text-red-700 border-red-300';
    }
  };

  if (!isOpen || !alert) return null;

  const todayStr = new Date().toISOString().split('T')[0];

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

  const inputClass = `w-full px-4 py-3 rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    theme === 'dark'
      ? 'bg-white/10 border border-white/15 text-white placeholder-white/30 focus:bg-white/[0.13]'
      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400'
  }`;

  const labelClass = `block text-sm font-semibold mb-2 ${
    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
  }`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          <div className="fixed inset-0 overflow-y-auto z-50">
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                className={`relative max-w-screen-xl rounded-3xl border shadow-2xl overflow-hidden ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-slate-900/98 via-blue-950/98 to-indigo-950/98 border-white/15'
                    : 'bg-gradient-to-br from-white via-gray-50/80 to-blue-50/60 border-gray-200'
                } backdrop-blur-2xl max-h-[92vh] flex flex-col`}
              >
                {/* top accent line */}
                <div className="h-[3px] w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shrink-0" />

                {/* Header */}
                <div
                  className={`px-6 py-5 border-b shrink-0 ${
                    theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center gap-4 mb-5">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-blue-500 rounded-2xl blur-lg opacity-40" />
                        <div className="relative p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                          <FileText className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2
                            className={`text-2xl font-bold ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}
                          >
                            Alert Disposition
                          </h2>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                              theme === 'dark'
                                ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            <Hash className="w-3 h-3" />
                            {alert.alert_id}
                          </span>
                        </div>
                        <p
                          className={`text-sm truncate ${
                            theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                          }`}
                        >
                          {alert.cust_name} &middot; {alert.rule_id}
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.08, rotate: 90 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={handleClose}
                      className={`p-3 rounded-2xl transition-colors duration-150 shrink-0 ${
                        theme === 'dark'
                          ? 'bg-white/10 hover:bg-white/20 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>

                  <StepIndicator step={step} theme={theme} />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <AnimatePresence mode="wait">
                    {step === 'form' && (
                      <motion.form
                        key="form"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        onSubmit={handleSubmit}
                        className="grid grid-cols-1 lg:grid-cols-5 gap-6"
                      >
                        {/* LEFT COLUMN — alert context */}
                        <div className="lg:col-span-2 space-y-5">
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
                                value={new Date(
                                  alert.time_stamp
                                ).toLocaleString()}
                                theme={theme}
                              />
                            </div>
                            <div
                              className={`pt-4 border-t ${
                                theme === 'dark'
                                  ? 'border-white/10'
                                  : 'border-gray-100'
                              }`}
                            >
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
                            title="Customer Information"
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
                            title="Rule Information"
                            theme={theme}
                          >
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <InfoRow
                                label="Rule ID"
                                value={alert.rule_id}
                                theme={theme}
                              />
                              <InfoRow
                                label="Branch Name"
                                value={alert.branch_name || 'N/A'}
                                theme={theme}
                                icon={MapPin}
                              />
                            </div>
                            <div
                              className={`pt-4 border-t ${
                                theme === 'dark'
                                  ? 'border-white/10'
                                  : 'border-gray-100'
                              }`}
                            >
                              <InfoRow
                                label="Rule Description"
                                value={alert.rule_desc}
                                theme={theme}
                              />
                            </div>
                          </SectionCard>
                        </div>

                        {/* RIGHT COLUMN — AI + disposition form */}
                        <div className="lg:col-span-3 space-y-5">
                          {/* AI Suggestions */}
                          <SectionCard
                            icon={Bot}
                            iconClass="bg-gradient-to-br from-purple-500 to-fuchsia-600"
                            title="AI Suggestions"
                            theme={theme}
                            right={
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={generateAISuggestions}
                                disabled={isGeneratingAI}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                                  theme === 'dark'
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
                                    <span>Generate</span>
                                  </>
                                )}
                              </motion.button>
                            }
                          >
                            {aiSuggestion ? (
                              <div className="space-y-3">
                                {/* AI Analysis */}
                                <div
                                  className={`p-4 rounded-xl border ${
                                    theme === 'dark'
                                      ? 'bg-purple-500/10 border-purple-500/20'
                                      : 'bg-purple-50 border-purple-200'
                                  }`}
                                >
                                  <div className="flex justify-between items-start gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <div
                                        className={`p-2 rounded-lg shrink-0 ${
                                          theme === 'dark'
                                            ? 'bg-purple-500/20'
                                            : 'bg-purple-100'
                                        }`}
                                      >
                                        <Brain className="w-4 h-4 text-purple-400" />
                                      </div>
                                      <div className="min-w-0">
                                        <div
                                          className={`font-medium ${
                                            theme === 'dark'
                                              ? 'text-white'
                                              : 'text-gray-900'
                                          }`}
                                        >
                                          AI Analysis
                                        </div>
                                        <div
                                          className={`text-sm mt-1 ${
                                            theme === 'dark'
                                              ? 'text-white/70'
                                              : 'text-gray-600'
                                          }`}
                                        >
                                          {aiSuggestion.analysis}
                                        </div>
                                      </div>
                                    </div>
                                    <div
                                      className={`px-2 py-1 text-xs font-medium rounded-full border whitespace-nowrap shrink-0 ${getConfidenceBadgeColor(
                                        aiSuggestion.confidence
                                      )}`}
                                    >
                                      {getConfidenceLabel(
                                        aiSuggestion.confidence
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-3 border-t border-dashed border-purple-500/20">
                                    <div className="flex items-center justify-between mb-2">
                                      <span
                                        className={`text-xs ${
                                          theme === 'dark'
                                            ? 'text-white/50'
                                            : 'text-gray-500'
                                        }`}
                                      >
                                        Confidence
                                      </span>
                                      <ConfidenceMeter
                                        confidence={aiSuggestion.confidence}
                                        theme={theme}
                                      />
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span
                                        className={
                                          theme === 'dark'
                                            ? 'text-white/50'
                                            : 'text-gray-500'
                                        }
                                      >
                                        Recommended:{' '}
                                        <span
                                          className={`font-semibold ${
                                            theme === 'dark'
                                              ? 'text-white/80'
                                              : 'text-gray-700'
                                          }`}
                                        >
                                          {
                                            DISPOSITION_LABELS[
                                              aiSuggestion.auto_disposition
                                            ]
                                          }
                                        </span>
                                      </span>
                                      <span
                                        className={
                                          theme === 'dark'
                                            ? 'text-white/50'
                                            : 'text-gray-500'
                                        }
                                      >
                                        Similarity:{' '}
                                        {Math.round(
                                          aiSuggestion.similarity * 100
                                        )}
                                        %
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Findings */}
                                <div
                                  className={`p-4 rounded-xl border ${
                                    theme === 'dark'
                                      ? 'bg-blue-500/10 border-blue-500/20'
                                      : 'bg-blue-50 border-blue-200'
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-2 gap-2">
                                    <div className="flex items-center gap-2">
                                      <Lightbulb className="w-4 h-4 text-blue-400" />
                                      <span
                                        className={`font-medium text-sm ${
                                          theme === 'dark'
                                            ? 'text-white'
                                            : 'text-gray-900'
                                        }`}
                                      >
                                        Suggested Findings
                                      </span>
                                    </div>
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() =>
                                        applyAiSuggestion('findings')
                                      }
                                      className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                                        theme === 'dark'
                                          ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                                          : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                      }`}
                                    >
                                      Use Suggestion
                                    </motion.button>
                                  </div>
                                  <div
                                    className={`text-sm ${
                                      theme === 'dark'
                                        ? 'text-white/80'
                                        : 'text-gray-700'
                                    }`}
                                  >
                                    {aiSuggestion.findings}
                                  </div>
                                </div>

                                {/* Action */}
                                <div
                                  className={`p-4 rounded-xl border ${
                                    theme === 'dark'
                                      ? 'bg-green-500/10 border-green-500/20'
                                      : 'bg-green-50 border-green-200'
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-2 gap-2">
                                    <div className="flex items-center gap-2">
                                      <Zap className="w-4 h-4 text-green-400" />
                                      <span
                                        className={`font-medium text-sm ${
                                          theme === 'dark'
                                            ? 'text-white'
                                            : 'text-gray-900'
                                        }`}
                                      >
                                        Suggested Action
                                      </span>
                                    </div>
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() =>
                                        applyAiSuggestion('action')
                                      }
                                      className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                                        theme === 'dark'
                                          ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
                                          : 'bg-green-100 hover:bg-green-200 text-green-700'
                                      }`}
                                    >
                                      Use Suggestion
                                    </motion.button>
                                  </div>
                                  <div
                                    className={`text-sm ${
                                      theme === 'dark'
                                        ? 'text-white/80'
                                        : 'text-gray-700'
                                    }`}
                                  >
                                    {aiSuggestion.action}
                                  </div>
                                </div>

                                {/* Remarks */}
                                <div
                                  className={`p-4 rounded-xl border ${
                                    theme === 'dark'
                                      ? 'bg-orange-500/10 border-orange-500/20'
                                      : 'bg-orange-50 border-orange-200'
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-2 gap-2">
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-orange-400" />
                                      <span
                                        className={`font-medium text-sm ${
                                          theme === 'dark'
                                            ? 'text-white'
                                            : 'text-gray-900'
                                        }`}
                                      >
                                        Suggested Remarks
                                      </span>
                                    </div>
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() =>
                                        applyAiSuggestion('remarks')
                                      }
                                      className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                                        theme === 'dark'
                                          ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-300'
                                          : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                                      }`}
                                    >
                                      Use Suggestion
                                    </motion.button>
                                  </div>
                                  <div
                                    className={`text-sm ${
                                      theme === 'dark'
                                        ? 'text-white/80'
                                        : 'text-gray-700'
                                    }`}
                                  >
                                    {aiSuggestion.remarks}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`p-8 text-center rounded-xl border border-dashed ${
                                  theme === 'dark'
                                    ? 'border-white/10 text-white/50'
                                    : 'border-gray-200 text-gray-500'
                                }`}
                              >
                                <BotMessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">
                                  Generate AI suggestions to help with alert
                                  disposition
                                </p>
                                <p className="text-xs mt-1.5">
                                  AI will analyze the alert and recommend
                                  findings, actions and a disposition
                                </p>
                              </div>
                            )}
                          </SectionCard>

                          {/* Disposition Form */}
                          <SectionCard
                            icon={Target}
                            iconClass="bg-gradient-to-br from-slate-600 to-slate-800"
                            title="Disposition Details"
                            theme={theme}
                          >
                            <div className="space-y-5">
                              <div>
                                <label className={labelClass}>
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
                                <label className={labelClass}>
                                  Risk Category
                                </label>
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

                              <div>
                                <label className={labelClass}>Findings</label>
                                <textarea
                                  value={findings}
                                  onChange={(e) => setFindings(e.target.value)}
                                  rows={4}
                                  className={inputClass}
                                  placeholder="Enter your findings..."
                                />
                              </div>

                              <div>
                                <label className={labelClass}>
                                  Action Taken
                                </label>
                                <textarea
                                  value={action}
                                  onChange={(e) => setAction(e.target.value)}
                                  rows={3}
                                  className={inputClass}
                                  placeholder="Describe actions taken..."
                                />
                              </div>

                              <div>
                                <label className={labelClass}>Remarks</label>
                                <textarea
                                  value={remarks}
                                  onChange={(e) => setRemarks(e.target.value)}
                                  rows={2}
                                  className={inputClass}
                                  placeholder="Additional remarks..."
                                />
                              </div>

                              {/* Escalation */}
                              <div
                                className={`rounded-xl border p-4 transition-colors ${
                                  escalated
                                    ? theme === 'dark'
                                      ? 'bg-red-500/5 border-red-500/20'
                                      : 'bg-red-50/50 border-red-200'
                                    : theme === 'dark'
                                      ? 'bg-white/[0.02] border-white/10'
                                      : 'bg-gray-50/50 border-gray-200'
                                }`}
                              >
                                <label
                                  htmlFor="escalated"
                                  className="flex items-center gap-2.5 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    id="escalated"
                                    checked={escalated}
                                    onChange={(e) =>
                                      setEscalated(e.target.checked)
                                    }
                                    className={`w-4 h-4 rounded cursor-pointer text-red-500 focus:ring-red-500 ${
                                      theme === 'dark'
                                        ? 'bg-white/10 border-white/20'
                                        : 'bg-white border-gray-300'
                                    }`}
                                  />
                                  <span
                                    className={`text-sm font-semibold flex items-center gap-1.5 ${
                                      theme === 'dark'
                                        ? 'text-white/80'
                                        : 'text-gray-700'
                                    }`}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                    Escalate to Compliance
                                  </span>
                                </label>

                                <AnimatePresence>
                                  {escalated && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <textarea
                                        value={escalationReason}
                                        onChange={(e) =>
                                          setEscalationReason(e.target.value)
                                        }
                                        rows={2}
                                        className={`${inputClass} mt-3`}
                                        placeholder="Reason for escalation..."
                                      />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>

                              {/* Follow-up */}
                              <div
                                className={`rounded-xl border p-4 transition-colors ${
                                  followUpRequired
                                    ? theme === 'dark'
                                      ? 'bg-blue-500/5 border-blue-500/20'
                                      : 'bg-blue-50/50 border-blue-200'
                                    : theme === 'dark'
                                      ? 'bg-white/[0.02] border-white/10'
                                      : 'bg-gray-50/50 border-gray-200'
                                }`}
                              >
                                <label
                                  htmlFor="followUp"
                                  className="flex items-center gap-2.5 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    id="followUp"
                                    checked={followUpRequired}
                                    onChange={(e) =>
                                      setFollowUpRequired(e.target.checked)
                                    }
                                    className={`w-4 h-4 rounded cursor-pointer text-blue-600 focus:ring-blue-500 ${
                                      theme === 'dark'
                                        ? 'bg-white/10 border-white/20'
                                        : 'bg-white border-gray-300'
                                    }`}
                                  />
                                  <span
                                    className={`text-sm font-semibold flex items-center gap-1.5 ${
                                      theme === 'dark'
                                        ? 'text-white/80'
                                        : 'text-gray-700'
                                    }`}
                                  >
                                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                                    Follow-up Required
                                  </span>
                                </label>

                                <AnimatePresence>
                                  {followUpRequired && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-3">
                                        <FollowUpDatePicker
                                          value={followUpDate}
                                          onChange={setFollowUpDate}
                                          minDate={todayStr}
                                          theme={theme}
                                        />
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </SectionCard>

                          {/* Submit Button */}
                          <div className="flex justify-end">
                            <motion.button
                              type="submit"
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              className="flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25"
                            >
                              <Send className="w-5 h-5" />
                              Review Disposition
                            </motion.button>
                          </div>
                        </div>
                      </motion.form>
                    )}

                    {step === 'review' && (
                      <motion.div
                        key="review"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6 max-w-4xl mx-auto"
                      >
                        <div
                          className={`rounded-2xl border p-6 ${
                            theme === 'dark'
                              ? 'bg-white/[0.04] border-white/10'
                              : 'bg-white border-gray-200 shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-sm">
                              <ClipboardCheck className="w-4 h-4 text-white" />
                            </div>
                            <h3
                              className={`text-lg font-semibold ${
                                theme === 'dark'
                                  ? 'text-white'
                                  : 'text-gray-900'
                              }`}
                            >
                              Review Disposition
                            </h3>
                          </div>

                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <div
                                  className={`text-sm font-medium mb-2 ${
                                    theme === 'dark'
                                      ? 'text-white/70'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  Disposition Type
                                </div>
                                <div
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                    dispositionType === 'TRUE_POSITIVE'
                                      ? theme === 'dark'
                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                        : 'bg-red-100 text-red-700 border border-red-300'
                                      : theme === 'dark'
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
                                  className={`text-sm font-medium mb-2 ${
                                    theme === 'dark'
                                      ? 'text-white/70'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  Risk Category
                                </div>
                                <div
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                    riskCategory === 'HIGH'
                                      ? theme === 'dark'
                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                        : 'bg-red-100 text-red-700 border border-red-300'
                                      : riskCategory === 'MEDIUM'
                                        ? theme === 'dark'
                                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                          : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                        : theme === 'dark'
                                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                          : 'bg-green-100 text-green-700 border border-green-300'
                                  }`}
                                >
                                  {riskCategory}
                                </div>
                              </div>
                            </div>

                            <div>
                              <div
                                className={`text-sm font-medium mb-2 ${
                                  theme === 'dark'
                                    ? 'text-white/70'
                                    : 'text-gray-700'
                                }`}
                              >
                                Findings
                              </div>
                              <div
                                className={`p-4 rounded-lg ${
                                  theme === 'dark'
                                    ? 'bg-white/10'
                                    : 'bg-gray-50'
                                }`}
                              >
                                <p
                                  className={
                                    theme === 'dark'
                                      ? 'text-white'
                                      : 'text-gray-900'
                                  }
                                >
                                  {findings}
                                </p>
                              </div>
                            </div>

                            <div>
                              <div
                                className={`text-sm font-medium mb-2 ${
                                  theme === 'dark'
                                    ? 'text-white/70'
                                    : 'text-gray-700'
                                }`}
                              >
                                Action Taken
                              </div>
                              <div
                                className={`p-4 rounded-lg ${
                                  theme === 'dark'
                                    ? 'bg-white/10'
                                    : 'bg-gray-50'
                                }`}
                              >
                                <p
                                  className={
                                    theme === 'dark'
                                      ? 'text-white'
                                      : 'text-gray-900'
                                  }
                                >
                                  {action}
                                </p>
                              </div>
                            </div>

                            {remarks && (
                              <div>
                                <div
                                  className={`text-sm font-medium mb-2 ${
                                    theme === 'dark'
                                      ? 'text-white/70'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  Remarks
                                </div>
                                <div
                                  className={`p-4 rounded-lg ${
                                    theme === 'dark'
                                      ? 'bg-white/10'
                                      : 'bg-gray-50'
                                  }`}
                                >
                                  <p
                                    className={
                                      theme === 'dark'
                                        ? 'text-white'
                                        : 'text-gray-900'
                                    }
                                  >
                                    {remarks}
                                  </p>
                                </div>
                              </div>
                            )}

                            {escalated && (
                              <div>
                                <div
                                  className={`text-sm font-medium mb-2 ${
                                    theme === 'dark'
                                      ? 'text-white/70'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  Escalation Reason
                                </div>
                                <div
                                  className={`p-4 rounded-lg ${
                                    theme === 'dark'
                                      ? 'bg-white/10'
                                      : 'bg-gray-50'
                                  }`}
                                >
                                  <p
                                    className={
                                      theme === 'dark'
                                        ? 'text-white'
                                        : 'text-gray-900'
                                    }
                                  >
                                    {escalationReason}
                                  </p>
                                </div>
                              </div>
                            )}

                            {followUpRequired && (
                              <div>
                                <div
                                  className={`text-sm font-medium mb-2 ${
                                    theme === 'dark'
                                      ? 'text-white/70'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  Follow-up Date
                                </div>
                                <div
                                  className={`flex items-center gap-2 p-4 rounded-lg ${
                                    theme === 'dark'
                                      ? 'bg-white/10'
                                      : 'bg-gray-50'
                                  }`}
                                >
                                  <Calendar className="w-4 h-4 text-blue-400" />
                                  <p
                                    className={
                                      theme === 'dark'
                                        ? 'text-white'
                                        : 'text-gray-900'
                                    }
                                  >
                                    {new Date(
                                      followUpDate
                                    ).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            )}

                            {aiSuggestionUsed && aiSuggestion && (
                              <div
                                className={`p-4 rounded-lg border ${
                                  theme === 'dark'
                                    ? 'bg-purple-500/10 border-purple-500/20'
                                    : 'bg-purple-50 border-purple-200'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Brain className="w-4 h-4 text-purple-400" />
                                  <span
                                    className={`text-sm font-medium ${
                                      theme === 'dark'
                                        ? 'text-white'
                                        : 'text-gray-900'
                                    }`}
                                  >
                                    AI
                                  </span>
                                </div>
                                <div
                                  className={`text-xs mt-1 ${
                                    theme === 'dark'
                                      ? 'text-white/70'
                                      : 'text-gray-600'
                                  }`}
                                >
                                  AI suggestions with{' '}
                                  {Math.round(aiSuggestion.confidence * 100)}%
                                  confidence were used in this disposition.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setStep('form')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                              theme === 'dark'
                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                          >
                            <ChevronLeft className="w-5 h-5" />
                            Back to Edit
                          </motion.button>

                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleConfirmDisposition}
                            disabled={isSubmitting}
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
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {step === 'success' && (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
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
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                              animate={{
                                opacity: [0, 1, 0],
                                scale: [0, 1, 0.8],
                                x: [0, (i - 1) * 42],
                                y: [0, -34 - i * 6],
                              }}
                              transition={{
                                delay: 0.3 + i * 0.08,
                                duration: 0.9,
                                ease: 'easeOut',
                              }}
                              className="absolute top-1/2 left-1/2"
                            >
                              <Sparkles className="w-4 h-4 text-amber-400" />
                            </motion.div>
                          ))}
                        </div>

                        <h3
                          className={`text-2xl font-bold mb-2 ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          Disposition Submitted
                        </h3>

                        <p
                          className={`mb-8 ${
                            theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                          }`}
                        >
                          The alert has been successfully dispositioned
                        </p>

                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleClose}
                          className={`px-7 py-3 rounded-xl font-semibold transition-colors ${
                            theme === 'dark'
                              ? 'bg-white/10 hover:bg-white/20 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          Close
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AlertDispositionModal;
