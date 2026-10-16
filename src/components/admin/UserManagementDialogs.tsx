import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  X,
  Eye,
  EyeOff,
  Key,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Mail,
  Trash2,
  Pencil,
  Copy,
  Check,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Activity,
  RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { UserOnboardingData } from '../../types/userOnboarding';

export type UserActionKind =
  | 'activate'
  | 'deactivate'
  | 'lock'
  | 'unlock'
  | 'reset_password'
  | 'delete'
  | 'sensitive_enable'
  | 'sensitive_disable';

/* =============================================================== */
/* Design tokens & shared primitives (also used by the main screen) */
/* =============================================================== */
export const cx = (...cls: (string | false | null | undefined)[]) =>
  cls.filter(Boolean).join(' ');

export const useDark = () => useTheme().theme === 'dark';

export type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

const TONE: Record<Tone, { light: string; dark: string; dot: string }> = {
  neutral: {
    light: 'bg-slate-100 text-slate-700 ring-slate-200',
    dark: 'bg-white/5 text-slate-300 ring-white/10',
    dot: 'bg-slate-400',
  },
  success: {
    light: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dark: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
    dot: 'bg-emerald-500',
  },
  danger: {
    light: 'bg-rose-50 text-rose-700 ring-rose-200',
    dark: 'bg-rose-400/10 text-rose-300 ring-rose-400/25',
    dot: 'bg-rose-500',
  },
  warning: {
    light: 'bg-amber-50 text-amber-800 ring-amber-200',
    dark: 'bg-amber-400/10 text-amber-300 ring-amber-400/25',
    dot: 'bg-amber-500',
  },
  info: {
    light: 'bg-sky-50 text-sky-700 ring-sky-200',
    dark: 'bg-sky-400/10 text-sky-300 ring-sky-400/25',
    dot: 'bg-sky-500',
  },
};

export const toneCls = (dark: boolean, tone: Tone) =>
  dark ? TONE[tone].dark : TONE[tone].light;

/** Semantic surface / text tokens so light & dark stay in lock-step. */
export const ui = (dark: boolean) => ({
  panel: dark
    ? 'bg-slate-900 text-slate-100 ring-1 ring-white/10'
    : 'bg-white text-slate-900 ring-1 ring-slate-900/5',
  hairline: dark ? 'border-white/10' : 'border-slate-200',
  divide: dark ? 'divide-white/10' : 'divide-slate-100',
  strong: dark ? 'text-white' : 'text-slate-900',
  body: dark ? 'text-slate-300' : 'text-slate-600',
  muted: dark ? 'text-slate-400' : 'text-slate-500',
  subtle: dark ? 'bg-white/[0.04]' : 'bg-slate-50',
  hover: dark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50',
  focus:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70',
});

type BtnVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'warning'
  | 'success';

export const btnCls = (
  dark: boolean,
  variant: BtnVariant = 'secondary',
  size: 'sm' | 'md' = 'md'
) =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 focus-visible:ring-offset-1',
    dark
      ? 'focus-visible:ring-offset-slate-900'
      : 'focus-visible:ring-offset-white',
    'disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
    variant === 'primary' &&
      (dark
        ? 'bg-white text-slate-900 hover:bg-slate-200'
        : 'bg-slate-900 text-white hover:bg-slate-800'),
    variant === 'secondary' &&
      (dark
        ? 'bg-white/5 text-slate-100 ring-1 ring-inset ring-white/15 hover:bg-white/10'
        : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'),
    variant === 'ghost' &&
      (dark
        ? 'text-slate-300 hover:bg-white/10'
        : 'text-slate-600 hover:bg-slate-100'),
    variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
    variant === 'warning' && 'bg-amber-400 text-slate-900 hover:bg-amber-300',
    variant === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-700'
  );

export const Pill: React.FC<{
  tone?: Tone;
  dot?: boolean;
  icon?: LucideIcon;
  children: React.ReactNode;
}> = ({ tone = 'neutral', dot, icon: Icon, children }) => {
  const dark = useDark();
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        toneCls(dark, tone)
      )}
    >
      {dot && (
        <span className={cx('h-1.5 w-1.5 rounded-full', TONE[tone].dot)} />
      )}
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
};

/** Same logic as the original status badge: locked > active > inactive. */
export const getStatus = (
  u: UserOnboardingData
): { label: string; tone: Tone } =>
  u.account_locked
    ? { label: 'Locked', tone: 'danger' }
    : u.active_flag
      ? { label: 'Active', tone: 'success' }
      : { label: 'Inactive', tone: 'neutral' };

const AVATAR_LIGHT = [
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-teal-100 text-teal-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
];
const AVATAR_DARK = [
  'bg-sky-400/15 text-sky-200',
  'bg-violet-400/15 text-violet-200',
  'bg-teal-400/15 text-teal-200',
  'bg-amber-400/15 text-amber-200',
  'bg-rose-400/15 text-rose-200',
];

export const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg' }> = ({
  name,
  size = 'md',
}) => {
  const dark = useDark();
  const parts = (name || '?').trim().split(/\s+/);
  const initials = (
    (parts[0]?.[0] ?? '?') +
    (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette = dark ? AVATAR_DARK : AVATAR_LIGHT;
  return (
    <span
      aria-hidden
      className={cx(
        'grid shrink-0 place-items-center rounded-full font-semibold',
        palette[hash % palette.length],
        size === 'sm' && 'h-8 w-8 text-xs',
        size === 'md' && 'h-9 w-9 text-xs',
        size === 'lg' && 'h-14 w-14 text-lg'
      )}
    >
      {initials}
    </span>
  );
};

/** One vocabulary for every action: menu, drawer and confirmation share it. */
export const ACTION_META: Record<
  UserActionKind,
  { label: string; hint: string; icon: LucideIcon; tone: Tone }
> = {
  activate: {
    label: 'Activate user',
    hint: 'Allow this user to sign in again',
    icon: UserCheck,
    tone: 'success',
  },
  deactivate: {
    label: 'Deactivate user',
    hint: 'Block sign-in; account and data are kept',
    icon: UserX,
    tone: 'warning',
  },
  lock: {
    label: 'Lock account',
    hint: 'Block sign-in until it is unlocked',
    icon: Lock,
    tone: 'warning',
  },
  unlock: {
    label: 'Unlock account',
    hint: 'Let this account sign in again',
    icon: Unlock,
    tone: 'success',
  },
  reset_password: {
    label: 'Reset password',
    hint: 'Email the user a reset link',
    icon: Key,
    tone: 'info',
  },
  sensitive_enable: {
    label: 'Enable sensitive data',
    hint: 'Show masked and personal data',
    icon: Eye,
    tone: 'info',
  },
  sensitive_disable: {
    label: 'Disable sensitive data',
    hint: 'Mask sensitive fields everywhere',
    icon: EyeOff,
    tone: 'warning',
  },
  delete: {
    label: 'Delete user',
    hint: 'Permanently remove this account',
    icon: Trash2,
    tone: 'danger',
  },
};

const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : undefined;

/**
 * Overlays render on <body>. Inside the list card they were positioned against
 * the card (backdrop-filter / overflow-hidden create a containing block for
 * fixed elements), which made them as short as the table.
 */
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined'
    ? null
    : createPortal(children, document.body);

/* =============================================================== */
/* Accessibility: focus trap, scroll lock, stacked Escape handling  */
/* =============================================================== */
const dialogStack: object[] = [];
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

function useDialogA11y(
  ref: React.RefObject<HTMLElement>,
  onClose: () => void,
  locked: boolean,
  initialFocus?: React.RefObject<HTMLElement>
) {
  const closeRef = useRef(onClose);
  const lockedRef = useRef(locked);
  closeRef.current = onClose;
  lockedRef.current = locked;

  useEffect(() => {
    const token = {};
    dialogStack.push(token);
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => {
      const el =
        initialFocus?.current ??
        ref.current?.querySelector<HTMLElement>(FOCUSABLE) ??
        ref.current;
      el?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      // Only the top-most dialog reacts (confirm sits above the drawer).
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        if (!lockedRef.current) closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = Array.from(
        ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      );
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!ref.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      dialogStack.splice(dialogStack.indexOf(token), 1);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* =============================================================== */
/* Centered dialog (becomes a bottom sheet on mobile)               */
/* =============================================================== */
const Dialog: React.FC<{
  label: string;
  onClose: () => void;
  locked?: boolean;
  width?: string;
  z?: string;
  initialFocus?: React.RefObject<HTMLElement>;
  children: React.ReactNode;
}> = ({
  label,
  onClose,
  locked,
  width = 'sm:max-w-lg',
  z = 'z-[90]',
  initialFocus,
  children,
}) => {
  const dark = useDark();
  const t = ui(dark);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(ref, onClose, !!locked, initialFocus);

  return (
    <Portal>
      <motion.div
        className={cx(
          'fixed inset-0 flex items-end justify-center sm:items-center sm:p-6',
          z,
          dark ? 'bg-slate-950/60' : 'bg-slate-900/40'
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !locked) onClose();
        }}
      >
        <motion.div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: 'spring', damping: 30, stiffness: 380 }}
          className={cx(
            'flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl shadow-2xl outline-none sm:rounded-2xl',
            width,
            t.panel
          )}
        >
          {children}
        </motion.div>
      </motion.div>
    </Portal>
  );
};

const DialogFooter: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const t = ui(useDark());
  return (
    <div
      className={cx(
        'flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end',
        t.hairline
      )}
    >
      {children}
    </div>
  );
};

/* =============================================================== */
/* Event logs (lazy – only fetched when the tab is opened)          */
/* =============================================================== */
export interface UserEventLog {
  id: string;
  event_type: string;
  description?: string | null;
  status?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export type EventLogLoader = (
  userId: string,
  page: number,
  pageSize: number
) => Promise<{ items: UserEventLog[]; hasMore: boolean }>;

const LOG_PAGE_SIZE = 15;

const humanize = (s: string) =>
  s.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const dayLabel = (s: string) => {
  const d = new Date(s);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const timeOf = (s: string) =>
  new Date(s).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

const logTone = (status?: string | null): Tone => {
  const v = (status ?? '').toLowerCase();
  if (['failed', 'failure', 'error', 'denied', 'blocked'].includes(v))
    return 'danger';
  if (['success', 'succeeded', 'ok', 'completed'].includes(v)) return 'success';
  return 'neutral';
};

const EventLogsPanel: React.FC<{ userId: string; load: EventLogLoader }> = ({
  userId,
  load,
}) => {
  const dark = useDark();
  const t = ui(dark);
  const loadRef = useRef(load);
  loadRef.current = load;
  const reqId = useRef(0);

  const [items, setItems] = useState<UserEventLog[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      const id = ++reqId.current;
      setError(null);
      if (replace) setPhase('loading');
      else setLoadingMore(true);
      try {
        const res = await loadRef.current(userId, nextPage, LOG_PAGE_SIZE);
        if (id !== reqId.current) return;
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setPage(nextPage);
        setHasMore(res.hasMore);
        setPhase('ready');
      } catch (e) {
        if (id !== reqId.current) return;
        setError(
          e instanceof Error ? e.message : 'We couldn’t load the event logs.'
        );
        setPhase(replace ? 'error' : 'ready');
      } finally {
        if (id === reqId.current) setLoadingMore(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchPage(1, true);
    return () => {
      reqId.current++; // ignore late responses after unmount
    };
  }, [fetchPage]);

  const groups = useMemo(() => {
    const out: { label: string; entries: UserEventLog[] }[] = [];
    items.forEach((it) => {
      const label = dayLabel(it.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.entries.push(it);
      else out.push({ label, entries: [it] });
    });
    return out;
  }, [items]);

  const errorBox = (retry: () => void) => (
    <div
      role="alert"
      className={cx(
        'flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset',
        toneCls(dark, 'danger')
      )}
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        {error}
      </span>
      <button
        type="button"
        onClick={retry}
        className={btnCls(dark, 'secondary', 'sm')}
      >
        Retry
      </button>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className={cx('text-sm font-semibold', t.strong)}>
          Recent activity
        </h3>
        <button
          type="button"
          onClick={() => fetchPage(1, true)}
          disabled={phase === 'loading'}
          aria-label="Refresh event logs"
          title="Refresh"
          className={cx(btnCls(dark, 'ghost', 'sm'), '!h-8 !w-8 !px-0')}
        >
          <RefreshCw
            className={cx('h-3.5 w-3.5', phase === 'loading' && 'animate-spin')}
            aria-hidden
          />
        </button>
      </div>

      {phase === 'loading' && (
        <div className="space-y-5" aria-busy aria-label="Loading event logs">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div
                className={cx(
                  'h-6 w-6 shrink-0 animate-pulse rounded-full motion-reduce:animate-none',
                  dark ? 'bg-white/10' : 'bg-slate-100'
                )}
              />
              <div className="flex-1 space-y-2">
                <div
                  className={cx(
                    'h-3.5 w-2/3 animate-pulse rounded motion-reduce:animate-none',
                    dark ? 'bg-white/10' : 'bg-slate-100'
                  )}
                />
                <div
                  className={cx(
                    'h-3 w-1/3 animate-pulse rounded motion-reduce:animate-none',
                    dark ? 'bg-white/5' : 'bg-slate-50'
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {phase === 'error' && errorBox(() => fetchPage(1, true))}

      {phase === 'ready' && items.length === 0 && (
        <div className="py-12 text-center">
          <span
            className={cx(
              'mx-auto grid h-11 w-11 place-items-center rounded-full',
              dark ? 'bg-white/5' : 'bg-slate-100'
            )}
          >
            <Activity className={cx('h-5 w-5', t.muted)} aria-hidden />
          </span>
          <p className={cx('mt-3 text-sm font-medium', t.strong)}>
            No activity recorded yet
          </p>
          <p className={cx('mt-1 text-xs', t.muted)}>
            Sign-ins and account changes will show up here.
          </p>
        </div>
      )}

      {phase === 'ready' && items.length > 0 && (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h4 className={cx('mb-3 text-xs font-medium', t.muted)}>
                {g.label}
              </h4>
              <ol>
                {g.entries.map((e, idx) => {
                  const tone = logTone(e.status);
                  const Icon =
                    tone === 'danger'
                      ? AlertTriangle
                      : tone === 'success'
                        ? CheckCircle2
                        : Activity;
                  const isLast = idx === g.entries.length - 1;
                  return (
                    <li
                      key={e.id}
                      className={cx('relative pl-10', !isLast && 'pb-5')}
                    >
                      {!isLast && (
                        <span
                          aria-hidden
                          className={cx(
                            'absolute bottom-0 left-3 top-7 w-px',
                            dark ? 'bg-white/10' : 'bg-slate-200'
                          )}
                        />
                      )}
                      <span
                        className={cx(
                          'absolute left-0 top-0 grid h-6 w-6 place-items-center rounded-full ring-1 ring-inset',
                          toneCls(dark, tone)
                        )}
                      >
                        <Icon className="h-3 w-3" aria-hidden />
                      </span>
                      <div className="flex items-start justify-between gap-3">
                        <p className={cx('text-sm font-medium', t.strong)}>
                          {humanize(e.event_type)}
                        </p>
                        <time
                          dateTime={e.created_at}
                          className={cx(
                            'shrink-0 text-xs tabular-nums',
                            t.muted
                          )}
                        >
                          {timeOf(e.created_at)}
                        </time>
                      </div>
                      {e.description && (
                        <p className={cx('mt-0.5 break-words text-sm', t.body)}>
                          {e.description}
                        </p>
                      )}
                      {(e.status || e.ip_address) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {e.status && (
                            <Pill tone={tone}>{humanize(e.status)}</Pill>
                          )}
                          {e.ip_address && (
                            <span
                              className={cx('text-xs tabular-nums', t.muted)}
                            >
                              IP {e.ip_address}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}

          {error && errorBox(() => fetchPage(page + 1, false))}

          {hasMore && !error && (
            <button
              type="button"
              onClick={() => fetchPage(page + 1, false)}
              disabled={loadingMore}
              className={cx(btnCls(dark, 'secondary'), 'w-full')}
            >
              {loadingMore && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              {loadingMore ? 'Loading…' : 'Load older activity'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* =============================================================== */
/* Details drawer – full-height, rendered in a portal               */
/* =============================================================== */
interface DrawerProps {
  user: UserOnboardingData | null;
  canViewSensitive: boolean;
  onClose: () => void;
  onEdit: (u: UserOnboardingData) => void;
  onAction: (action: UserActionKind, u: UserOnboardingData) => void;
  /** When provided, an "Event logs" tab is shown and loaded on demand. */
  loadEventLogs?: EventLogLoader;
}

type DrawerTab = 'details' | 'logs';

const DrawerPanel: React.FC<DrawerProps & { user: UserOnboardingData }> = ({
  user,
  canViewSensitive,
  onClose,
  onEdit,
  onAction,
  loadEventLogs,
}) => {
  const dark = useDark();
  const t = ui(dark);
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<DrawerTab>('details');
  const [logsOpened, setLogsOpened] = useState(false); // gate for the first API call
  useDialogA11y(panelRef, onClose, false, closeRef);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  const selectTab = (next: DrawerTab) => {
    setTab(next);
    if (next === 'logs') setLogsOpened(true);
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(user.email_id);
      setCopied(true);
    } catch {
      /* clipboard unavailable – ignore */
    }
  };

  const status = getStatus(user);
  const attempts = user.login_attempts ?? 0;

  const manage: UserActionKind[] = [
    user.active_flag ? 'deactivate' : 'activate',
    user.account_locked ? 'unlock' : 'lock',
    'reset_password',
    canViewSensitive ? 'sensitive_disable' : 'sensitive_enable',
  ];

  const sectionTitle = (text: string) => (
    <h3 className={cx('mb-1 text-sm font-semibold', t.strong)}>{text}</h3>
  );

  const row = (label: string, value?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-6 py-3 text-sm">
      <dt className={t.muted}>{label}</dt>
      <dd
        className={cx('min-w-0 break-words text-right font-medium', t.strong)}
      >
        {value ?? '—'}
      </dd>
    </div>
  );

  const signal = (
    Icon: LucideIcon,
    label: string,
    value: string,
    tone: Tone
  ) => (
    <div className="flex flex-1 flex-col gap-2 p-4">
      <span
        className={cx(
          'grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset',
          toneCls(dark, tone)
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <div className={cx('text-xs', t.muted)}>{label}</div>
        <div className={cx('text-sm font-semibold', t.strong)}>{value}</div>
      </div>
    </div>
  );

  const tabs: { id: DrawerTab; label: string }[] = [
    { id: 'details', label: 'Details' },
    ...(loadEventLogs
      ? [{ id: 'logs' as DrawerTab, label: 'Event logs' }]
      : []),
  ];

  const onTabKey = (e: React.KeyboardEvent) => {
    if (tabs.length < 2) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next =
        tabs[(tabs.findIndex((x) => x.id === tab) + 1) % tabs.length];
      selectTab(next.id);
      document.getElementById(`um-tab-${next.id}`)?.focus();
    }
  };

  return (
    <Portal>
      <motion.div
        className={cx(
          'fixed inset-0 z-[80] flex justify-end',
          dark ? 'bg-slate-950/55' : 'bg-slate-900/35'
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.aside
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${user.full_name}`}
          tabIndex={-1}
          initial={reduce ? { opacity: 0 } : { x: '100%' }}
          animate={reduce ? { opacity: 1 } : { x: 0 }}
          exit={reduce ? { opacity: 0 } : { x: '100%' }}
          transition={{ type: 'spring', damping: 34, stiffness: 340 }}
          className={cx(
            'flex h-full w-full flex-col overflow-hidden shadow-2xl outline-none sm:max-w-[480px]',
            t.panel
          )}
        >
          {/* Header (fixed) */}
          <header className="shrink-0 px-6 pt-6">
            <div className="flex items-start gap-4">
              <Avatar name={user.full_name} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold tracking-tight">
                  {user.full_name}
                </h2>
                <p className={cx('truncate text-sm', t.muted)}>
                  {user.username}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Pill tone={status.tone} dot>
                    {status.label}
                  </Pill>
                  <Pill>{user.user_roles}</Pill>
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className={cx(btnCls(dark, 'ghost', 'sm'), '!h-8 !w-8 !px-0')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {tabs.length > 1 && (
              <div
                role="tablist"
                aria-label="User sections"
                onKeyDown={onTabKey}
                className={cx(
                  '-mx-6 mt-5 flex gap-6 border-b px-6',
                  t.hairline
                )}
              >
                {tabs.map((x) => {
                  const active = tab === x.id;
                  return (
                    <button
                      key={x.id}
                      id={`um-tab-${x.id}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls={`um-panel-${x.id}`}
                      tabIndex={active ? 0 : -1}
                      onClick={() => selectTab(x.id)}
                      className={cx(
                        '-mb-px border-b-2 pb-3 text-sm font-medium transition-colors',
                        t.focus,
                        active
                          ? dark
                            ? 'border-teal-400 text-white'
                            : 'border-teal-600 text-slate-900'
                          : cx('border-transparent', t.muted)
                      )}
                    >
                      {x.label}
                    </button>
                  );
                })}
              </div>
            )}
            {tabs.length <= 1 && (
              <div className={cx('-mx-6 mt-5 border-b', t.hairline)} />
            )}
          </header>

          {/* Body – the only scrolling region, independent of the page/table */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6"
          >
            {tab === 'details' && (
              <div
                role="tabpanel"
                id="um-panel-details"
                aria-labelledby="um-tab-details"
                className="space-y-7"
              >
                <section aria-label="Security signals">
                  <div
                    className={cx(
                      'flex divide-x overflow-hidden rounded-xl border',
                      t.hairline,
                      t.divide
                    )}
                  >
                    {signal(
                      user.mfa_enabled ? ShieldCheck : ShieldAlert,
                      'Multi-factor',
                      user.mfa_enabled ? 'Enabled' : 'Disabled',
                      user.mfa_enabled ? 'success' : 'warning'
                    )}
                    {signal(
                      user.email_verified ? CheckCircle2 : AlertTriangle,
                      'Email',
                      user.email_verified ? 'Verified' : 'Unverified',
                      user.email_verified ? 'success' : 'warning'
                    )}
                    {signal(
                      attempts > 0 ? AlertTriangle : CheckCircle2,
                      'Failed logins',
                      String(attempts),
                      attempts > 0 ? 'warning' : 'neutral'
                    )}
                  </div>
                </section>

                <section>
                  {sectionTitle('Profile')}
                  <dl className={cx('divide-y', t.divide)}>
                    {row('Username', user.username)}
                    {row(
                      'Email',
                      <span className="inline-flex items-center gap-1.5">
                        <span className="break-all">{user.email_id}</span>
                        <button
                          type="button"
                          onClick={copyEmail}
                          aria-label="Copy email address"
                          className={cx(
                            'grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors',
                            t.muted,
                            t.hover,
                            t.focus
                          )}
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </span>
                    )}
                    {row('Role', user.user_roles)}
                    {row('User status', user.user_status)}
                    {row('Account status', user.account_status)}
                    {row(
                      'Sensitive data',
                      <Pill
                        tone={canViewSensitive ? 'success' : 'neutral'}
                        icon={canViewSensitive ? ShieldCheck : ShieldAlert}
                      >
                        {canViewSensitive ? 'Allowed' : 'Blocked'}
                      </Pill>
                    )}
                  </dl>
                </section>

                <section>
                  {sectionTitle('Activity')}
                  <dl className={cx('divide-y', t.divide)}>
                    {row('Last login', fmtDateTime(user.last_login) ?? 'Never')}
                    {row(
                      'Last password change',
                      fmtDateTime(user.last_password_change)
                    )}
                    {row('Created', fmtDateTime(user.created_at))}
                  </dl>
                </section>

                <section>
                  {sectionTitle('Manage access')}
                  <ul className="-mx-2 mt-1">
                    {manage.map((kind) => {
                      const m = ACTION_META[kind];
                      const Icon = m.icon;
                      return (
                        <li key={kind}>
                          <button
                            type="button"
                            onClick={() => onAction(kind, user)}
                            className={cx(
                              'group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors',
                              t.hover,
                              t.focus
                            )}
                          >
                            <span
                              className={cx(
                                'grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset',
                                toneCls(dark, m.tone)
                              )}
                            >
                              <Icon className="h-4 w-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={cx(
                                  'block text-sm font-medium',
                                  t.strong
                                )}
                              >
                                {m.label}
                              </span>
                              <span className={cx('block text-xs', t.muted)}>
                                {m.hint}
                              </span>
                            </span>
                            <ChevronRight
                              className={cx(
                                'h-4 w-4 transition-transform group-hover:translate-x-0.5',
                                t.muted
                              )}
                              aria-hidden
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section
                  className={cx(
                    'rounded-xl border p-4',
                    dark
                      ? 'border-rose-400/25 bg-rose-400/5'
                      : 'border-rose-200 bg-rose-50/60'
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div
                        className={cx(
                          'text-sm font-semibold',
                          dark ? 'text-rose-200' : 'text-rose-800'
                        )}
                      >
                        Delete this user
                      </div>
                      <p className={cx('mt-0.5 text-xs', t.muted)}>
                        Permanently removes the account. This can’t be undone.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAction('delete', user)}
                      className={cx(
                        btnCls(dark, 'secondary', 'sm'),
                        dark
                          ? '!text-rose-300 hover:!bg-rose-500/10'
                          : '!text-rose-700 hover:!bg-rose-100'
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* Mounted on first visit only, then kept (hidden) so state is not refetched */}
            {loadEventLogs && logsOpened && (
              <div
                role="tabpanel"
                id="um-panel-logs"
                aria-labelledby="um-tab-logs"
                hidden={tab !== 'logs'}
              >
                <EventLogsPanel userId={user.id} load={loadEventLogs} />
              </div>
            )}
          </div>

          {/* Footer (fixed) */}
          <footer
            className={cx(
              'flex shrink-0 gap-2 border-t px-6 py-4',
              t.hairline,
              dark ? 'bg-slate-900' : 'bg-white'
            )}
          >
            <button
              type="button"
              onClick={onClose}
              className={btnCls(dark, 'secondary')}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onEdit(user)}
              className={cx(btnCls(dark, 'primary'), 'flex-1')}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Edit details
            </button>
          </footer>
        </motion.aside>
      </motion.div>
    </Portal>
  );
};

export const UserDetailsDrawer: React.FC<DrawerProps> = (props) => (
  <AnimatePresence>
    {props.user && (
      <DrawerPanel key={props.user.id} {...props} user={props.user} />
    )}
  </AnimatePresence>
);

/* =============================================================== */
/* Edit user                                                        */
/* =============================================================== */
const inputCls = (dark: boolean, invalid: boolean) =>
  cx(
    'h-10 w-full rounded-lg border px-3 text-sm outline-none transition-shadow',
    'focus:ring-2',
    invalid
      ? 'border-rose-400 focus:ring-rose-400/40'
      : dark
        ? 'border-white/15 focus:border-teal-400 focus:ring-teal-400/30'
        : 'border-slate-300 focus:border-teal-500 focus:ring-teal-500/30',
    dark
      ? 'bg-white/5 text-white placeholder-slate-500'
      : 'bg-white text-slate-900 placeholder-slate-400'
  );

const EditForm: React.FC<{
  user: UserOnboardingData;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (
    u: UserOnboardingData,
    patch: { full_name: string; email_id: string }
  ) => void;
}> = ({ user, saving, error, onClose, onSave }) => {
  const dark = useDark();
  const t = ui(dark);
  const nameRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email_id);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const dirty =
    fullName.trim() !== user.full_name || email.trim() !== user.email_id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let ok = true;
    if (!fullName.trim()) {
      setNameErr('Enter the user’s full name.');
      ok = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailErr('Enter a valid email address.');
      ok = false;
    }
    if (!ok) return;
    onSave(user, { full_name: fullName.trim(), email_id: email.trim() });
  };

  const label = (id: string, text: string) => (
    <label
      htmlFor={id}
      className={cx('mb-1.5 block text-sm font-medium', t.strong)}
    >
      {text}
    </label>
  );

  return (
    <Dialog
      label={`Edit ${user.full_name}`}
      onClose={onClose}
      locked={saving}
      initialFocus={nameRef}
      width="sm:max-w-[480px]"
    >
      <form
        onSubmit={submit}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <div
          className={cx(
            'flex items-center gap-4 border-b px-6 py-5',
            t.hairline
          )}
        >
          <Avatar name={user.full_name} size="lg" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Edit user</h2>
            <p className={cx('truncate text-sm', t.muted)}>
              {user.username} · {user.user_roles}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div>
            {label('um-full-name', 'Full name')}
            <input
              ref={nameRef}
              id="um-full-name"
              autoComplete="off"
              className={inputCls(dark, !!nameErr)}
              value={fullName}
              aria-invalid={!!nameErr}
              aria-describedby={nameErr ? 'um-name-err' : undefined}
              onChange={(e) => {
                setFullName(e.target.value);
                setNameErr(null);
              }}
            />
            {nameErr && (
              <p
                id="um-name-err"
                role="alert"
                className="mt-1.5 text-xs text-rose-500"
              >
                {nameErr}
              </p>
            )}
          </div>

          <div>
            {label('um-email', 'Email')}
            <input
              id="um-email"
              type="email"
              autoComplete="off"
              className={inputCls(dark, !!emailErr)}
              value={email}
              aria-invalid={!!emailErr}
              aria-describedby={emailErr ? 'um-email-err' : 'um-email-hint'}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailErr(null);
              }}
            />
            {emailErr ? (
              <p
                id="um-email-err"
                role="alert"
                className="mt-1.5 text-xs text-rose-500"
              >
                {emailErr}
              </p>
            ) : (
              <p id="um-email-hint" className={cx('mt-1.5 text-xs', t.muted)}>
                Password reset links are sent to this address.
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className={cx(
                'flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset',
                toneCls(dark, 'danger')
              )}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={btnCls(dark, 'secondary')}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !dirty}
            className={btnCls(dark, 'primary')}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  );
};

export const EditUserModal: React.FC<{
  user: UserOnboardingData | null;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (
    u: UserOnboardingData,
    patch: { full_name: string; email_id: string }
  ) => void;
}> = ({ user, saving, error, onClose, onSave }) => (
  <AnimatePresence>
    {user && (
      <EditForm
        key={user.id}
        user={user}
        saving={saving}
        error={error}
        onClose={onClose}
        onSave={onSave}
      />
    )}
  </AnimatePresence>
);

/* =============================================================== */
/* Confirmation (stacks above the drawer so context stays visible)  */
/* =============================================================== */
const CONFIRM_META: Record<
  UserActionKind,
  { title: string; body: string; cta: string }
> = {
  activate: {
    title: 'Activate user',
    body: 'This user will be able to sign in and use the platform again.',
    cta: 'Activate',
  },
  deactivate: {
    title: 'Deactivate user',
    body: 'This user will immediately lose access to the platform. Their account and data are kept.',
    cta: 'Deactivate',
  },
  lock: {
    title: 'Lock account',
    body: 'The account will be blocked from signing in until it is unlocked.',
    cta: 'Lock account',
  },
  unlock: {
    title: 'Unlock account',
    body: 'The account will be able to sign in again.',
    cta: 'Unlock',
  },
  reset_password: {
    title: 'Reset password',
    body: 'A password reset link will be emailed to the user. Their current password stops working once the link is used.',
    cta: 'Send reset email',
  },
  delete: {
    title: 'Delete user',
    body: 'This permanently removes the user account and cannot be undone.',
    cta: 'Delete permanently',
  },
  sensitive_enable: {
    title: 'Enable sensitive data access',
    body: 'This user will be able to view sensitive fields (masked values, personal data) in alerts and reports.',
    cta: 'Enable access',
  },
  sensitive_disable: {
    title: 'Disable sensitive data access',
    body: 'Sensitive fields will be hidden or masked everywhere for this user, effective immediately.',
    cta: 'Disable access',
  },
};

const CONFIRM_BTN: Record<Tone, BtnVariant> = {
  danger: 'danger',
  warning: 'warning',
  success: 'success',
  info: 'primary',
  neutral: 'primary',
};

const ConfirmPanel: React.FC<{
  action: UserActionKind;
  user: UserOnboardingData;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ action, user, busy, error, onClose, onConfirm }) => {
  const dark = useDark();
  const t = ui(dark);
  const meta = CONFIRM_META[action];
  const visual = ACTION_META[action];
  const Icon = visual.icon;
  const destructive = visual.tone === 'danger';
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      label={meta.title}
      onClose={onClose}
      locked={busy}
      width="sm:max-w-[440px]"
      z="z-[90]"
      // Destructive actions start on Cancel so Enter can't delete by accident.
      initialFocus={destructive ? cancelRef : confirmRef}
    >
      <div className="px-6 pb-2 pt-6">
        <div className="flex items-start gap-4">
          <span
            className={cx(
              'grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset',
              toneCls(dark, visual.tone)
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{meta.title}</h2>
            <p className={cx('mt-1 text-sm leading-relaxed', t.body)}>
              {meta.body}
            </p>
          </div>
        </div>

        <div
          className={cx(
            'mt-5 flex items-center gap-3 rounded-xl border p-3',
            t.hairline,
            t.subtle
          )}
        >
          <Avatar name={user.full_name} size="sm" />
          <div className="min-w-0">
            <div className={cx('truncate text-sm font-medium', t.strong)}>
              {user.full_name}
            </div>
            <div className={cx('truncate text-xs', t.muted)}>
              {user.email_id}
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className={cx(
              'mt-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset',
              toneCls(dark, 'danger')
            )}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}
      </div>

      <div className="pt-4">
        <DialogFooter>
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className={btnCls(dark, 'secondary')}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={btnCls(dark, CONFIRM_BTN[visual.tone])}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? 'Working…' : meta.cta}
          </button>
        </DialogFooter>
      </div>
    </Dialog>
  );
};

export const ConfirmUserActionModal: React.FC<{
  action: UserActionKind | null;
  user: UserOnboardingData | null;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ action, user, busy, error, onClose, onConfirm }) => (
  <AnimatePresence>
    {action && user && (
      <ConfirmPanel
        key="confirm"
        action={action}
        user={user}
        busy={busy}
        error={error}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    )}
  </AnimatePresence>
);

/* =============================================================== */
/* Reset password success                                           */
/* =============================================================== */
const ResetSentPanel: React.FC<{
  user: UserOnboardingData;
  onClose: () => void;
}> = ({ user, onClose }) => {
  const dark = useDark();
  const t = ui(dark);
  const doneRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      label="Reset email sent"
      onClose={onClose}
      width="sm:max-w-[420px]"
      initialFocus={doneRef}
    >
      <div className="px-6 pb-2 pt-8 text-center">
        <span
          className={cx(
            'mx-auto grid h-12 w-12 place-items-center rounded-full ring-1 ring-inset',
            toneCls(dark, 'success')
          )}
        >
          <Mail className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-base font-semibold">Reset email sent</h2>
        <p
          className={cx(
            'mx-auto mt-1.5 max-w-xs text-sm leading-relaxed',
            t.body
          )}
        >
          A password reset link was sent to{' '}
          <strong className={t.strong}>{user.email_id}</strong>. The link
          expires after a short period; ask the user to check their inbox.
        </p>
      </div>
      <div className="pt-6">
        <DialogFooter>
          <button
            ref={doneRef}
            type="button"
            onClick={onClose}
            className={cx(btnCls(dark, 'primary'), 'sm:min-w-[96px]')}
          >
            Done
          </button>
        </DialogFooter>
      </div>
    </Dialog>
  );
};

export const ResetPasswordSentModal: React.FC<{
  user: UserOnboardingData | null;
  onClose: () => void;
}> = ({ user, onClose }) => (
  <AnimatePresence>
    {user && <ResetSentPanel key="sent" user={user} onClose={onClose} />}
  </AnimatePresence>
);
