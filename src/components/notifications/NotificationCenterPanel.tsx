import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BellRing,
  Check,
  CheckCheck,
  Info,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useNotificationCenter } from './NotificationCenterContext';
import { AppNotification } from '../../services/notificationService';

interface NotificationCenterPanelProps {
  open: boolean;
  onClose: () => void;
  theme: string;
  onNavigate?: (link: string) => void;
}

const TYPE_ICON: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  alert: { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/15' },
  warning: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/15' },
  success: { icon: Check, color: 'text-emerald-500', bg: 'bg-emerald-500/15' },
  system: { icon: BellRing, color: 'text-blue-500', bg: 'bg-blue-500/15' },
  info: { icon: Info, color: 'text-sky-500', bg: 'bg-sky-500/15' },
};

const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

export const NotificationCenterPanel: React.FC<NotificationCenterPanelProps> = ({
  open,
  onClose,
  theme,
  onNavigate,
}) => {
  const {
    items,
    unreadCount,
    loading,
    error,
    permission,
    enablePush,
    disablePush,
    markRead,
    markAllRead,
    remove,
    refresh,
  } = useNotificationCenter();
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const askedOnceRef = useRef(false);

  const dark = theme === 'dark';

  // Offer push ONCE per browser, only when permission is still untouched.
  useEffect(() => {
    if (!open || askedOnceRef.current) return;
    if (permission === 'default') {
      setShowPushPrompt(true);
      askedOnceRef.current = true;
    }
  }, [open, permission]);

  const handleItem = (n: AppNotification) => {
    if (!n.is_read) void markRead(n.notification_id);
    if (n.link && onNavigate) {
      onNavigate(n.link);
      onClose();
    }
  };

  const surface = dark ? 'bg-[#0b1220] border-white/10' : 'bg-white border-gray-200';
  const text = dark ? 'text-white' : 'text-gray-900';
  const sub = dark ? 'text-white/60' : 'text-gray-500';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.25 }}
            className={`fixed right-4 top-16 z-50 w-[min(400px,calc(100vw-2rem))] rounded-2xl border shadow-2xl ${surface}`}
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${dark ? 'border-white/10' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-bold ${text}`}>Notifications</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Mark all read"
                  onClick={() => void markAllRead()}
                  className={`rounded-lg p-1.5 transition-colors ${
                    dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Refresh"
                  onClick={() => void refresh()}
                  className={`rounded-lg p-1.5 transition-colors ${
                    dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close notifications"
                  className={`rounded-lg p-1.5 transition-colors ${
                    dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* One-time push prompt — appears only while permission is untouched */}
            {showPushPrompt && permission === 'default' && (
              <div className="mx-3 mt-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-xs font-semibold ${text}`}>Enable push notifications?</p>
                    <p className={`mt-0.5 text-[11px] ${sub}`}>
                      Get notified even when this tab is closed. You can change this anytime.
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        void enablePush();
                        setShowPushPrompt(false);
                      }}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                    >
                      Enable
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPushPrompt(false)}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold ${sub}`}
                    >
                      Later
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* List */}
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
              {loading && items.length === 0 && (
                <div className={`px-4 py-10 text-center text-sm ${sub}`}>Loading…</div>
              )}
              {!loading && error && (
                <div className="px-4 py-10 text-center text-sm text-red-500">{error}</div>
              )}
              {!loading && !error && items.length === 0 && (
                <div className={`px-4 py-10 text-center text-sm ${sub}`}>
                  You're all caught up.
                </div>
              )}
              {items.map((n) => {
                const meta = TYPE_ICON[n.type] ?? TYPE_ICON.info;
                const Icon = meta.icon;
                return (
                  <div
                    key={n.notification_id}
                    className={`group flex items-start gap-3 border-b px-4 py-3 transition-colors last:border-b-0 ${
                      dark
                        ? 'border-white/5 hover:bg-white/5'
                        : 'border-gray-100 hover:bg-gray-50'
                    } ${!n.is_read ? (dark ? 'bg-blue-500/5' : 'bg-blue-50/60') : ''}`}
                  >
                    <div className={`mt-0.5 rounded-lg p-2 ${meta.bg}`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleItem(n)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-xs font-bold ${text}`}>{n.title}</span>
                        {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                      </div>
                      <p className={`mt-0.5 line-clamp-2 text-xs leading-relaxed ${sub}`}>
                        {n.message}
                      </p>
                      <span className="mt-1 block text-[10px] font-medium text-gray-400">
                        {relativeTime(n.created_at)}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => void remove(n.notification_id)}
                      className={`rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100 ${
                        dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-200 text-gray-400'
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer: push toggle */}
            <div className={`border-t px-4 py-2.5 ${dark ? 'border-white/10' : 'border-gray-100'}`}>
              {permission === 'granted' ? (
                <button
                  type="button"
                  onClick={() => void disablePush()}
                  className={`text-[11px] font-semibold ${sub} hover:underline`}
                >
                  Push is on for this device — turn off
                </button>
              ) : permission === 'denied' ? (
                <span className={`text-[11px] ${sub}`}>
                  Push is blocked in your browser settings.
                </span>
              ) : permission === 'unavailable' ? (
                <span className={`text-[11px] ${sub}`}>Push is not supported in this browser.</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void enablePush()}
                  className="text-[11px] font-semibold text-blue-500 hover:underline"
                >
                  Turn on push notifications
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
