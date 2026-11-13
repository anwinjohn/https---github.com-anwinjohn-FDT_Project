import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { appConfig as config } from '../../config/runtime-config';
import {
  onToast,
  type ToastPayload,
  type ToastType,
} from '../../utils/toastBus';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  title?: string;
  onClick?: () => void;
  persistent?: boolean;
  /** Inline action button rendered inside the toast. */
  actionLabel?: string;
  onAction?: () => void;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (
    message: string,
    type?: Notification['type'],
    duration?: number,
    title?: string,
    onClick?: () => void,
    actionLabel?: string,
    onAction?: () => void
  ) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [timeouts, setTimeouts] = useState<Record<string, NodeJS.Timeout>>({});

  const removeNotificationRef = useRef<(id: string) => void>(() => {});

  const addNotification = useCallback(
    (
      message: string,
      type: Notification['type'] = 'info',
      duration: number = 10000,
      title?: string,
      onClick?: () => void,
      actionLabel?: string,
      onAction?: () => void
    ) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      const notification: Notification = {
        id,
        message,
        type,
        duration,
        title: title ?? config.app.name,
        onClick,
        persistent: duration === 0,
        actionLabel,
        onAction,
      };

      setNotifications((prev) => [...prev, notification]);

      if (duration > 0) {
        const timeout = setTimeout(() => {
          removeNotificationRef.current(id);
        }, duration);
        setTimeouts((prev) => ({ ...prev, [id]: timeout }));
      }
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    setTimeouts((prev) => {
      const t = prev[id];
      if (t) clearTimeout(t);
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  removeNotificationRef.current = removeNotification;

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setTimeouts((prev) => {
      Object.values(prev).forEach((timeout) => clearTimeout(timeout));
      return {};
    });
  }, []);

  // Global toast bus bridge: any module can fire a toast without React
  // context (see utils/toastBus). Registered once, here.
  useEffect(
    () =>
      onToast((payload: ToastPayload) => {
        addNotification(
          payload.message,
          payload.type as ToastType as Notification['type'],
          payload.duration,
          payload.title,
          payload.onClick,
          payload.actionLabel,
          payload.onAction
        );
      }),
    [addNotification]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAllNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within NotificationProvider'
    );
  }
  return context;
};
