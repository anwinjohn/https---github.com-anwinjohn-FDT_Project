import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNotifications } from './NotificationContext';
import NotificationItem from './NotificationItem';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification, clearAllNotifications } = useNotifications();

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'flex-end',
        pointerEvents: 'none',
        width: 'min(380px, calc(100vw - 48px))',
      }}
    >
      {/* Clear all button — visible when 2+ notifications */}
      <AnimatePresence>
        {notifications.length >= 2 && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            onClick={clearAllNotifications}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.75)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '5px 12px',
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
              fontFamily: 'ui-monospace, "Fira Code", monospace',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.75)';
              (e.currentTarget as HTMLButtonElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.55)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)';
            }}
          >
            Clear all ({notifications.length})
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <div key={notification.id} style={{ pointerEvents: 'auto', width: '100%' }}>
            <NotificationItem
              notification={notification}
              onRemove={removeNotification}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationContainer;