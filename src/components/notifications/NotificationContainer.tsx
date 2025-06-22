import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNotifications } from './NotificationContext';
import NotificationItem from './NotificationItem';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <div key={notification.id} className="pointer-events-auto">
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