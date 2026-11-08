import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  HelpCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  _resolveConfirm,
  _acknowledgeConfirm,
} from './confirmService';
import type { ConfirmOptions } from './confirmService';

export type { ConfirmOptions };

export type ConfirmResultAction =
  | 'confirmed'
  | 'cancelled'
  | 'dismissed';

export interface ConfirmResult {
  action: ConfirmResultAction;
}

export type ConfirmIcon =
  | 'help'
  | 'warning'
  | 'danger'
  | 'info'
  | 'success'
  | 'error'
  | 'none';

interface DialogState {
  id: number;
  options: ConfirmOptions;
}

const EVENT_NAME = 'app:confirm-dialog';

const ICON_CONFIG: Record<
  Exclude<ConfirmIcon, 'none'>,
  { icon: React.ElementType; color: string; bgLight: string; bgDark: string }
> = {
  help: { icon: HelpCircle, color: '#3B82F6', bgLight: 'rgba(59,130,246,0.12)', bgDark: 'rgba(59,130,246,0.18)' },
  warning: { icon: AlertTriangle, color: '#F59E0B', bgLight: 'rgba(245,158,11,0.12)', bgDark: 'rgba(245,158,11,0.18)' },
  danger: { icon: AlertTriangle, color: '#EF4444', bgLight: 'rgba(239,68,68,0.12)', bgDark: 'rgba(239,68,68,0.18)' },
  info: { icon: Info, color: '#3B82F6', bgLight: 'rgba(59,130,246,0.12)', bgDark: 'rgba(59,130,246,0.18)' },
  success: { icon: CheckCircle2, color: '#10B981', bgLight: 'rgba(16,185,129,0.12)', bgDark: 'rgba(16,185,129,0.18)' },
  error: { icon: XCircle, color: '#EF4444', bgLight: 'rgba(239,68,68,0.12)', bgDark: 'rgba(239,68,68,0.18)' },
};

export const ConfirmProvider: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const idRef = useRef<number | null>(null);

  const openDialog = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail as DialogState;
    if (!detail?.options) return;
    _acknowledgeConfirm(detail.id);
    idRef.current = detail.id;
    setDialog(detail);
  }, []);

  useEffect(() => {
    window.addEventListener(EVENT_NAME, openDialog);
    return () => window.removeEventListener(EVENT_NAME, openDialog);
  }, [openDialog]);

  const settle = useCallback(
    (action: ConfirmResultAction) => {
      const id = idRef.current;
      idRef.current = null;
      setDialog(null);
      if (id !== null) {
        _resolveConfirm(id, { action });
      }
    },
    []
  );

  // Escape key closes as dismissed.
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle('dismissed');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, settle]);

  const dark = document.documentElement.classList.contains('dark');
  const opts = dialog?.options;

  const isDark = dark;
  const surface = isDark ? '#111827' : '#FFFFFF';
  const borderColor = isDark ? '#1F2937' : '#E3E8EF';
  const titleColor = isDark ? '#F9FAFB' : '#101828';
  const textColor = isDark ? 'rgba(226,232,240,0.85)' : '#475467';
  const cancelBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(16,24,40,0.04)';
  const cancelHover = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(16,24,40,0.08)';
  const cancelBorder = isDark ? 'rgba(255,255,255,0.12)' : '#E3E8EF';

  const danger = opts?.danger ?? false;
  const iconKey: ConfirmIcon = opts?.icon ?? (danger ? 'danger' : 'help');
  const iconCfg =
    iconKey === 'none' ? null : ICON_CONFIG[iconKey];
  const IconComponent = iconCfg?.icon ?? HelpCircle;

  // Confirm button colors follow the icon type unless overridden by danger.
  const confirmColor = danger ? '#DC2626' : iconCfg?.color ?? '#2563EB';

  return (
    <>
      {children}
      {createPortal(
        <AnimatePresence>
          {dialog && opts && (
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                background: 'rgba(2,6,23,0.55)',
                backdropFilter: 'blur(2px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) settle('dismissed');
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-message"
                style={{
                  width: 'min(420px, 100%)',
                  borderRadius: 16,
                  background: surface,
                  border: `1px solid ${borderColor}`,
                  boxShadow: isDark
                    ? '0 24px 64px -16px rgba(0,0,0,0.6)'
                    : '0 24px 64px -16px rgba(16,24,40,0.28)',
                  padding: 24,
                  position: 'relative',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Close X */}
                {!opts.hideClose && (
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => settle('dismissed')}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: isDark ? '#94A3B8' : '#98A2B3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {/* Icon */}
                {iconCfg && (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: isDark ? iconCfg.bgDark : iconCfg.bgLight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <IconComponent
                      style={{ width: 22, height: 22, color: iconCfg.color }}
                      strokeWidth={2.2}
                    />
                  </div>
                )}

                {/* Title + message */}
                <h3
                  id="confirm-title"
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    color: titleColor,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {opts.title}
                </h3>
                {opts.message && (
                  <p
                    id="confirm-message"
                    style={{
                      margin: '6px 0 0',
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: textColor,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {opts.message}
                  </p>
                )}

                {/* Buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                    marginTop: 22,
                  }}
                >
                  {!opts.hideCancel && (
                    <button
                      type="button"
                      onClick={() => settle('cancelled')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        border: `1px solid ${cancelBorder}`,
                        background: cancelBg,
                        color: textColor,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = cancelHover)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = cancelBg)
                      }
                    >
                      {opts.cancelLabel || 'Cancel'}
                    </button>
                  )}
                  <button
                    type="button"
                    autoFocus
                    onClick={() => settle('confirmed')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      border: 'none',
                      background: confirmColor,
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      boxShadow: `0 4px 12px -4px ${confirmColor}66`,
                      transition: 'filter 0.15s ease',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.filter = 'brightness(0.92)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.filter = 'none')
                    }
                  >
                    {opts.confirmLabel || 'Confirm'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
