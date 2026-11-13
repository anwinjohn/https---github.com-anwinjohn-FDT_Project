import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, PanInfo } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Clock,
} from 'lucide-react';
import { Notification } from './NotificationContext';

/**
 * Toast item v2 — "Quiet Glass".
 * Frosted, near-opaque surface, hairline border + inner highlight, one
 * semantic accent (icon ring = countdown, edge pill, action button).
 *
 * Business behavior is unchanged: same props, same Notification fields,
 * same timer / pause / onClick / onRemove / persistent / Session-clock logic.
 * All new capabilities are OPTIONAL extra fields (RichNotification) and
 * therefore non-breaking for existing callers.
 */

export interface RichNotification extends Notification {
  /** Small meta text, e.g. "now", "2m ago" */
  meta?: string;
  /** Avatar image (social toasts). Type icon becomes a small badge. */
  avatarUrl?: string;
  /** Media thumbnail (e.g. upload preview), shown on the right. */
  mediaUrl?: string;
  /** Inline action (e.g. Reply, Retry). Does not replace onClick. */
  actionLabel?: string;
  onAction?: () => void;
}

interface NotificationItemProps {
  notification: RichNotification;
  onRemove: (id: string) => void;
}

interface Palette {
  icon: React.ElementType;
  label: string;
  /** Decorative / non-text UI (>= 3:1) */
  accent: string;
  accentDark: string;
  /** Text-safe accent (>= 4.5:1 on surface) */
  text: string;
  textDark: string;
  /** Solid button background + foreground (>= 4.5:1) */
  btnBg: string;
  btnFg: string;
  btnBgDark: string;
  btnFgDark: string;
}

const TYPE_CONFIG: Record<'success' | 'error' | 'warning' | 'info', Palette> = {
  success: {
    icon: CheckCircle2,
    label: 'Success',
    accent: '#0E9F6E',
    accentDark: '#34D399',
    text: '#047857',
    textDark: '#6EE7B7',
    btnBg: '#047857',
    btnFg: '#FFFFFF',
    btnBgDark: '#34D399',
    btnFgDark: '#052E22',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    accent: '#E11D48',
    accentDark: '#FB7185',
    text: '#BE123C',
    textDark: '#FDA4AF',
    btnBg: '#BE123C',
    btnFg: '#FFFFFF',
    btnBgDark: '#FB7185',
    btnFgDark: '#3B0614',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    accent: '#D97706',
    accentDark: '#FBBF24',
    text: '#B45309',
    textDark: '#FCD34D',
    btnBg: '#B45309',
    btnFg: '#FFFFFF',
    btnBgDark: '#FBBF24',
    btnFgDark: '#3A2300',
  },
  info: {
    icon: Info,
    label: 'Info',
    accent: '#4F6EF7',
    accentDark: '#7C9CFF',
    text: '#3F51D8',
    textDark: '#A5B8FF',
    btnBg: '#3F51D8',
    btnFg: '#FFFFFF',
    btnBgDark: '#7C9CFF',
    btnFgDark: '#0B1230',
  },
};

const TICK_MS = 50;
const SWIPE_DISMISS_PX = 80;
const SWIPE_DISMISS_VELOCITY = 500;
const RING_SIZE = 38;
const RING_R = 17;
const RING_C = 2 * Math.PI * RING_R;

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRemove,
}) => {
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(1);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [held, setHeld] = useState(false); // touch / pointer hold

  const pausedRef = useRef(false);
  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;

  const base = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.info;
  const isSession =
    notification.type === 'warning' &&
    !!notification.title?.includes('Session');
  const Icon = isSession ? Clock : base.icon;

  const hasTimer = !!notification.duration && notification.duration > 0;
  const clickable = !!notification.onClick;
  const paused = hovered || focused || held;
  pausedRef.current = paused;

  useEffect(() => {
    if (!hasTimer) return;
    const total = notification.duration as number;
    let remaining = total;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      remaining -= TICK_MS;
      if (remaining <= 0) {
        clearInterval(id);
        setProgress(0);
        onRemoveRef.current(notification.id);
        return;
      }
      setProgress(remaining / total);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [notification.id, notification.duration, hasTimer]);

  const isDark = document.documentElement.classList.contains('dark');

  // Tokens
  const surface = isDark ? 'rgba(17,24,39,0.82)' : 'rgba(255,255,255,0.86)';
  const titleColor = isDark ? '#F9FAFB' : '#101828';
  const textColor = isDark ? 'rgba(226,232,240,0.88)' : '#475467';
  const metaColor = isDark ? '#94A3B8' : '#667085';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.08)';
  const trackColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(16,24,40,0.08)';
  const accent = isDark ? base.accentDark : base.accent;
  const accentText = isDark ? base.textDark : base.text;
  const btnBg = isDark ? base.btnBgDark : base.btnBg;
  const btnFg = isDark ? base.btnFgDark : base.btnFg;
  const accentSoft = `rgba(${hexToRgb(accent)}, ${isDark ? 0.16 : 0.1})`;
  const accentGlow = `rgba(${hexToRgb(accent)}, ${isDark ? 0.4 : 0.32})`;

  const isPriority =
    notification.type === 'error' || notification.type === 'warning';
  const hasAvatar = !!notification.avatarUrl;

  const shadowRest = isDark
    ? '0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -12px rgba(0,0,0,0.6)'
    : '0 1px 2px rgba(16,24,40,0.06), 0 12px 32px -14px rgba(16,24,40,0.24)';
  const shadowHover = isDark
    ? '0 2px 4px rgba(0,0,0,0.45), 0 18px 40px -12px rgba(0,0,0,0.7)'
    : '0 2px 4px rgba(16,24,40,0.08), 0 18px 40px -14px rgba(16,24,40,0.32)';
  const innerHighlight = isDark
    ? 'inset 0 1px 0 rgba(255,255,255,0.05)'
    : 'inset 0 1px 0 rgba(255,255,255,0.7)';

  const handleActivate = () => {
    if (!notification.onClick) return;
    notification.onClick();
    onRemoveRef.current(notification.id);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setHeld(false);
    if (
      info.offset.x > SWIPE_DISMISS_PX ||
      info.velocity.x > SWIPE_DISMISS_VELOCITY
    ) {
      onRemoveRef.current(notification.id);
    }
  };

  return (
    <motion.div
      layout={!reduceMotion}
      initial={
        reduceMotion ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.96 }
      }
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              x: 40,
              scale: 0.97,
              transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
            }
      }
      whileHover={reduceMotion ? undefined : { y: -1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
      drag={reduceMotion ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.05, right: 0.7 }}
      dragSnapToOrigin
      onDragStart={() => setHeld(true)}
      onDragEnd={handleDragEnd}
      style={{ width: '100%', position: 'relative', touchAction: 'pan-y' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={() => setHeld(true)}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onRemoveRef.current(notification.id);
      }}
      role={isPriority ? 'alert' : 'status'}
      aria-live={isPriority ? 'assertive' : 'polite'}
    >
      <div
        onClick={clickable ? handleActivate : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleActivate();
                }
              }
            : undefined
        }
        tabIndex={clickable ? 0 : undefined}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 12px 14px 18px',
          borderRadius: 16,
          background: surface,
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          border: `1px solid ${borderColor}`,
          boxShadow: `${hovered ? shadowHover : shadowRest}, ${innerHighlight}`,
          cursor: clickable ? 'pointer' : 'default',
          outline: focused && clickable ? `2px solid ${accent}` : 'none',
          outlineOffset: 2,
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.25s ease',
        }}
      >
        {/* Accent edge pill */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 14,
            bottom: 14,
            width: 3,
            borderRadius: '0 3px 3px 0',
            background: accent,
          }}
        />

        {/* Leading visual: avatar (+ type badge) or icon with countdown ring */}
        {hasAvatar ? (
          <div
            style={{
              position: 'relative',
              flexShrink: 0,
              width: RING_SIZE,
              height: RING_SIZE,
            }}
          >
            <img
              src={notification.avatarUrl}
              alt=""
              style={{
                width: RING_SIZE,
                height: RING_SIZE,
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
                border: `1px solid ${borderColor}`,
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                right: -3,
                bottom: -3,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: accent,
                border: `2px solid ${isDark ? '#111827' : '#FFFFFF'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                style={{
                  width: 10,
                  height: 10,
                  color: isDark ? base.btnFgDark : '#FFFFFF',
                }}
                strokeWidth={2.8}
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              flexShrink: 0,
              width: RING_SIZE,
              height: RING_SIZE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: accentSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                style={{ width: 16, height: 16, color: accent }}
                strokeWidth={2.2}
              />
            </div>
            {hasTimer && (
              <svg
                aria-hidden
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: 'rotate(-90deg)',
                }}
              >
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_R}
                  fill="none"
                  stroke={trackColor}
                  strokeWidth={2}
                />
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_R}
                  fill="none"
                  stroke={accent}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - progress)}
                  style={{
                    transition: `stroke-dashoffset ${TICK_MS}ms linear, opacity 0.2s ease`,
                    opacity: paused ? 0.45 : 1,
                  }}
                />
              </svg>
            )}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            {notification.title && (
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 650,
                  lineHeight: 1.35,
                  color: titleColor,
                  letterSpacing: '-0.012em',
                }}
              >
                {notification.title}
              </span>
            )}
            {notification.persistent && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: accentText,
                }}
              >
                Pinned
              </span>
            )}
            {notification.meta && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  fontWeight: 500,
                  color: metaColor,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {notification.meta}
              </span>
            )}
          </div>
          <p
            style={{
              margin: 0,
              marginTop: notification.title ? 2 : 0,
              fontSize: 12.5,
              lineHeight: 1.5,
              color: textColor,
              wordBreak: 'break-word',
            }}
          >
            {notification.message}
          </p>

          {notification.actionLabel && notification.onAction && (
            <div style={{ marginTop: 10 }}>
              {isPriority ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    notification.onAction?.();
                    onRemoveRef.current(notification.id);
                  }}
                  style={{
                    height: 30,
                    padding: '0 14px',
                    borderRadius: 9,
                    border: 'none',
                    background: btnBg,
                    color: btnFg,
                    fontSize: 12,
                    fontWeight: 650,
                    letterSpacing: '-0.005em',
                    cursor: 'pointer',
                    boxShadow: `0 0 0 3px ${accentSoft}, 0 6px 16px -4px ${accentGlow}`,
                  }}
                >
                  {notification.actionLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    notification.onAction?.();
                    onRemoveRef.current(notification.id);
                  }}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    marginLeft: -10,
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: accentText,
                    fontSize: 12,
                    fontWeight: 650,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = accentSoft;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {notification.actionLabel}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Media thumbnail */}
        {notification.mediaUrl && (
          <img
            src={notification.mediaUrl}
            alt=""
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 10,
              objectFit: 'cover',
              border: `1px solid ${borderColor}`,
            }}
          />
        )}

        {/* Close — quiet until hover/focus */}
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveRef.current(notification.id);
          }}
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: isDark ? '#94A3B8' : '#667085',
            opacity: hovered || focused ? 1 : 0.6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition:
              'background 0.15s ease, color 0.15s ease, opacity 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(16,24,40,0.06)';
            e.currentTarget.style.color = isDark ? '#E2E8F0' : '#344054';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = isDark ? '#94A3B8' : '#667085';
          }}
        >
          <X style={{ width: 14, height: 14 }} strokeWidth={2.4} />
        </button>

        {/* Fading underline for toasts without an icon ring (avatar layout) */}
        {hasTimer && hasAvatar && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 2,
              background: trackColor,
            }}
          >
            <div
              style={{
                height: '100%',
                width: '100%',
                transformOrigin: 'left center',
                transform: `scaleX(${progress})`,
                background: accent,
                transition: `transform ${TICK_MS}ms linear`,
                opacity: paused ? 0.4 : 0.9,
              }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

function hexToRgb(hex: string): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

export default NotificationItem;
