import React, { createContext, useContext, useState, useCallback } from 'react';
import { Notification, NotificationType, NotificationOptions } from './types';

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (
    type: NotificationType,
    message: string,
    options?: NotificationOptions
  ) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback(
    (
      type: NotificationType,
      message: string,
      options?: NotificationOptions
    ) => {
      const id = `${Date.now()}-${Math.random()}`;
      const notification: Notification = {
        id,
        type,
        message,
        title: options?.title,
        duration: options?.duration ?? 5000,
      };

      setNotifications((prev) => [...prev, notification]);

      if (notification.duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, notification.duration);
      }
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, showNotification, removeNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
