import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Notification } from './NotificationContext';
import { useTheme } from '../../context/ThemeContext';

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Per-type palette                                                   */
/*  rgb is used to build tints/glows; from/to drive the icon gradient  */
/* ------------------------------------------------------------------ */

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    label: 'Success',
    rgb: '16,185,129',
    from: '#10b981',
    to: '#14b8a6',
    textLight: '#047857',
    textDark: '#6ee7b7',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    rgb: '239,68,68',
    from: '#ef4444',
    to: '#f43f5e',
    textLight: '#b91c1c',
    textDark: '#fca5a5',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Warning',
    rgb: '245,158,11',
    from: '#f59e0b',
    to: '#f97316',
    textLight: '#b45309',
    textDark: '#fcd34d',
  },
  info: {
    icon: Info,
    label: 'Info',
    rgb: '59,130,246',
    from: '#3b82f6',
    to: '#6366f1',
    textLight: '#1d4ed8',
    textDark: '#93c5fd',
  },
} as const;

const TICK_MS = 50;

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRemove,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const reduceMotion = useReducedMotion();

  const [progress, setProgress] = useState(1); // 1 → 0
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const pausedRef = useRef(false);
  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;

  const base = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
  const isSession =
    notification.type === 'warning' &&
    !!notification.title?.includes('Session');
  // Keep the existing session-warning icon behaviour
  const Icon = isSession ? Clock : base.icon;

  const hasTimer = !!notification.duration && notification.duration > 0;
  const clickable = !!notification.onClick;

  /* ---- Auto-dismiss timer: pauses while hovered / focused ---- */
  pausedRef.current = isHovered || isFocused;

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

  const handleRemove = () => onRemoveRef.current(notification.id);

  const handleActivate = () => {
    if (!notification.onClick) return;
    notification.onClick();
    handleRemove();
  };

  /* ---- Theme tokens ---- */
  const t = isDark
    ? {
        surface: 'rgba(15, 23, 42, 0.74)',
        title: '#f8fafc',
        message: 'rgba(226, 232, 240, 0.82)',
        border: 'rgba(255, 255, 255, 0.14)',
        ring: 'rgba(0, 0, 0, 0.35)',
        sheen: 'rgba(255, 255, 255, 0.10)',
        closeBg: 'rgba(255, 255, 255, 0.08)',
        closeHover: 'rgba(255, 255, 255, 0.18)',
        track: 'rgba(255, 255, 255, 0.08)',
        labelColor: base.textDark,
        shadow: `0 18px 40px -12px rgba(0,0,0,0.55), 0 6px 14px -6px rgba(0,0,0,0.4)`,
      }
    : {
        surface: 'rgba(255, 255, 255, 0.78)',
        title: '#0f172a',
        message: '#475569',
        border: 'rgba(255, 255, 255, 0.85)',
        ring: 'rgba(15, 23, 42, 0.10)',
        sheen: 'rgba(255, 255, 255, 0.65)',
        closeBg: 'rgba(15, 23, 42, 0.05)',
        closeHover: 'rgba(15, 23, 42, 0.11)',
        track: 'rgba(15, 23, 42, 0.07)',
        labelColor: base.textLight,
        shadow: `0 18px 40px -14px rgba(15,23,42,0.28), 0 6px 14px -6px rgba(15,23,42,0.14)`,
      };

  const tintStrength = isDark ? 0.2 : 0.14;

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
          : { opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.2 } }
      }
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      style={{ width: '100%', maxWidth: 400, position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={() => setIsFocused(false)}
      role={
        notification.type === 'error' || notification.type === 'warning'
          ? 'alert'
          : 'status'
      }
      aria-live={
        notification.type === 'error' || notification.type === 'warning'
          ? 'assertive'
          : 'polite'
      }
    >
      {/* Ambient coloured glow behind the card */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -6,
          borderRadius: 26,
          background: `radial-gradient(60% 80% at 15% 50%, rgba(${base.rgb}, ${
            isDark ? 0.35 : 0.28
          }) 0%, transparent 70%)`,
          filter: 'blur(14px)',
          opacity: isHovered ? 1 : 0.65,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Glass card */}
      <div
        onClick={clickable ? handleActivate : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleActivate();
                }
              }
            : undefined
        }
        tabIndex={clickable ? 0 : undefined}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '16px 14px 18px 16px',
          borderRadius: 20,
          overflow: 'hidden',
          cursor: clickable ? 'pointer' : 'default',
          // tinted layer over the frosted base
          background: `linear-gradient(135deg, rgba(${base.rgb}, ${tintStrength}) 0%, rgba(${base.rgb}, 0.03) 45%, transparent 100%), linear-gradient(${t.surface}, ${t.surface})`,
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: `1px solid ${t.border}`,
          boxShadow: `${t.shadow}, 0 0 0 1px ${t.ring}`,
          transform:
            isHovered && !reduceMotion ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 0.2s ease',
          outline: 'none',
        }}
      >
        {/* Top glass sheen */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, ${t.sheen} 0%, transparent 42%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Accent edge */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 14,
            bottom: 14,
            width: 3,
            borderRadius: '0 3px 3px 0',
            background: `linear-gradient(180deg, ${base.from}, ${base.to})`,
          }}
        />

        {/* Icon */}
        <div
          style={{
            position: 'relative',
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: 13,
            background: `linear-gradient(135deg, ${base.from}, ${base.to})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 6px 16px -4px rgba(${base.rgb}, 0.55), inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}
        >
          <Icon
            style={{ width: 20, height: 20, color: '#fff' }}
            strokeWidth={2.3}
          />
        </div>

        {/* Content */}
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: t.labelColor,
              }}
            >
              {base.label}
            </span>

            {(isSession || notification.persistent) && (
              <motion.span
                aria-hidden
                animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: base.from,
                  boxShadow: `0 0 8px rgba(${base.rgb}, 0.9)`,
                }}
              />
            )}
            {notification.persistent && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: t.message,
                  opacity: 0.8,
                }}
              >
                Pinned
              </span>
            )}
          </div>

          {notification.title && (
            <p
              style={{
                margin: '0 0 3px',
                fontSize: 14.5,
                fontWeight: 650 as any,
                lineHeight: 1.35,
                letterSpacing: '-0.01em',
                color: t.title,
              }}
            >
              {notification.title}
            </p>
          )}

          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.5,
              color: t.message,
              wordBreak: 'break-word',
            }}
          >
            {notification.message}
          </p>

          {clickable && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 10,
                padding: '5px 11px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                color: t.labelColor,
                background: `rgba(${base.rgb}, ${isDark ? 0.18 : 0.12})`,
                border: `1px solid rgba(${base.rgb}, ${isDark ? 0.35 : 0.25})`,
              }}
            >
              Take action
              <ArrowRight style={{ width: 13, height: 13 }} strokeWidth={2.6} />
            </div>
          )}
        </div>

        {/* Close */}
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          style={{
            position: 'relative',
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 9,
            border: 'none',
            background: isHovered ? t.closeHover : t.closeBg,
            color: t.message,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          <X style={{ width: 14, height: 14 }} strokeWidth={2.5} />
        </button>

        {/* Progress (pauses on hover / focus) */}
        {hasTimer && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              background: t.track,
            }}
          >
            <div
              style={{
                height: '100%',
                width: '100%',
                transformOrigin: 'left center',
                transform: `scaleX(${progress})`,
                background: `linear-gradient(90deg, ${base.from}, ${base.to})`,
                transition: `transform ${TICK_MS}ms linear`,
                opacity: isHovered || isFocused ? 0.5 : 0.95,
              }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default NotificationItem;
