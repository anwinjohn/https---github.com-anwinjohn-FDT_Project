import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import config from '../../config/app-config.json'

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  title?: string;
  onClick?: () => void;
  persistent?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (
    message: string, 
    type?: Notification['type'], 
    duration?: number, 
    title?: string,
    onClick?: () => void
  ) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [timeouts, setTimeouts] = useState<Record<string, NodeJS.Timeout>>({});

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [timeouts]);

  const addNotification = useCallback((
    message: string, 
    type: Notification['type'] = 'info', 
    duration: number = 10000,
    title?: string,
    onClick?: () => void
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    title = config.app.name;
    const notification: Notification = { 
      id, 
      message, 
      type, 
      duration, 
      title,
      onClick,
      persistent: duration === 0
    };

    setNotifications(prev => [...prev, notification]);

    if (duration > 0) {
      const timeout = setTimeout(() => {
        removeNotification(id);
      }, duration);
      
      setTimeouts(prev => ({
        ...prev,
        [id]: timeout
      }));
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
    
    // Clear the timeout if it exists
    if (timeouts[id]) {
      clearTimeout(timeouts[id]);
      setTimeouts(prev => {
        const newTimeouts = { ...prev };
        delete newTimeouts[id];
        return newTimeouts;
      });
    }
  }, [timeouts]);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    
    // Clear all timeouts
    Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    setTimeouts({});
  }, [timeouts]);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      addNotification, 
      removeNotification, 
      clearAllNotifications 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};