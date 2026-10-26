import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Clock,
} from 'lucide-react';
import { Notification } from './NotificationContext';
import { useTheme } from '../../context/ThemeContext';

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}


const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRemove,
}) => {
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);
  const { theme } = useTheme();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isDark = theme === 'dark';

  
const notificationConfig = {
  success: {
    icon: CheckCircle,
    accent: '#22c55e',
    accentDark: '#16a34a',
    label: 'Success',
    iconBg: 'rgba(34,197,94,0.12)',
    iconColor: '#22c55e',
    progressColor: '#22c55e',
    bgColor:
          theme === 'dark'
            ? 'bg-gradient-to-r from-green-500/90 to-emerald-500/90'
            : 'bg-gradient-to-r from-green-500 to-emerald-500',
  },
  error: {
    icon: AlertCircle,
    accent: '#ef4444',
    accentDark: '#dc2626',
    label: 'Error',
    iconBg: 'rgba(239,68,68,0.12)',
    iconColor: '#ef4444',
    progressColor: '#ef4444',
    bgColor:
          theme === 'dark'
            ? 'bg-gradient-to-r from-red-500/90 to-rose-500/90'
            : 'bg-gradient-to-r from-red-500 to-rose-500',
        borderColor: 'border-red-400',
  },
  warning: {
    icon: AlertTriangle,
    accent: '#f59e0b',
    accentDark: '#d97706',
    label: 'Warning',
    iconBg: 'rgba(245,158,11,0.12)',
    iconColor: '#f59e0b',
    progressColor: '#f59e0b',
    bgColor:
          theme === 'dark'
            ? 'bg-gradient-to-r from-yellow-500/90 to-orange-500/90'
            : 'bg-gradient-to-r from-yellow-500 to-orange-500',
  },
  info: {
    icon: Info,
    accent: '#3b82f6',
    accentDark: '#2563eb',
    label: 'Info',
    iconBg: 'rgba(59,130,246,0.12)',
    iconColor: '#3b82f6',
    progressColor: '#3b82f6',
    bgColor:
          theme === 'dark'
            ? 'bg-gradient-to-r from-blue-500/90 to-indigo-500/90'
            : 'bg-gradient-to-r from-blue-500 to-indigo-500',
  },
};

  // Keep existing session-warning icon logic intact
  const getNotificationConfig = (type: Notification['type']) => {
    const base = notificationConfig[type] || notificationConfig.info;
    if (type === 'warning' && notification.title?.includes('Session')) {
      return { ...base, icon: Clock };
    }
    return base;
  };

  const config = getNotificationConfig(notification.type);
  const Icon = config.icon;

  const handleRemove = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onRemove(notification.id);
  };

  const handleClick = () => {
    if (notification.onClick) {
      notification.onClick();
      handleRemove();
    }
  };

  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const intervalTime = 100;
      const steps = notification.duration / intervalTime;
      const decrementPerStep = 100 / steps;

      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - decrementPerStep;
          if (newProgress <= 0) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setTimeout(() => {
              onRemove(notification.id);
            }, 0);
            return 0;
          }
          return newProgress;
        });
      }, intervalTime);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [notification.id, notification.duration, onRemove]);

  const bg = isDark ? 'rgba(252, 252, 252, 0.92)' : 'rgba(45,45,46,0.92)';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const titleColor = isDark ? '#0f172a' : '#f1f5f9' ;
  const msgColor = isDark ? '#475569' : '#94a3b8' ;
  const actionColor = config.accent;
  const closeBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const closeHoverBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
  const shadow = isDark
    ? `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${border}, inset 0 1px 0 rgba(255,255,255,0.06)`
    : `0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04), 0 0 0 1px ${border}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97, x: 20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.97, x: 20 }}
      transition={{ duration: 0.28, type: 'spring', stiffness: 340, damping: 28 }}
      style={{ width: '100%', maxWidth: 380, position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect behind card */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          background: `radial-gradient(ellipse at 20% 50%, ${config.accent}18 0%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
        }}
      />

      <div
        onClick={notification.onClick ? handleClick : undefined}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 14px 14px 16px',
          background: bg,
          borderRadius: 16,
          boxShadow: shadow,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          cursor: notification.onClick ? 'pointer' : 'default',
          overflow: 'hidden',
          transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          borderLeft: `3px solid ${config.accent}`,
        }}
      >
        {/* Icon pill */}
        <div
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 10,
            background: config.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          <Icon
            style={{ width: 18, height: 18, color: config.iconColor }}
            strokeWidth={2.2}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Type label + title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: notification.title ? 2 : 4 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: config.accent,
                fontFamily: 'ui-monospace, "Fira Code", monospace',
              }}
            >
              {config.label}
            </span>
            {notification.type === 'warning' && notification.title?.includes('Session') && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: config.accent }}
              />
            )}
          </div>

          {notification.title && (
            <p
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: titleColor,
                margin: '0 0 3px',
                lineHeight: 1.35,
                letterSpacing: '-0.01em',
              }}
            >
              {notification.title}
            </p>
          )}

          <p
            style={{
              fontSize: 13,
              color: msgColor,
              margin: 0,
              lineHeight: 1.5,
              letterSpacing: '-0.005em',
            }}
          >
            {notification.message}
          </p>

          {notification.onClick && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 7 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: actionColor,
                  letterSpacing: '-0.01em',
                }}
              >
                Take action →
              </span>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            background: isHovered ? closeHoverBg : closeBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
            marginTop: 1,
            color: msgColor,
          }}
        >
          <X style={{ width: 14, height: 14 }} strokeWidth={2.5} />
        </button>

        {/* Progress bar */}
        {notification.duration && notification.duration > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: config.progressColor,
                opacity: 0.7,
                borderRadius: '0 1px 1px 0',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        )}

        {/* Persistent dot */}
        {notification.persistent && (
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              position: 'absolute',
              top: 10,
              right: 48,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: config.accent,
            }}
          />
        )}
      </div>
    </motion.div>
  );
};

export default NotificationItem;