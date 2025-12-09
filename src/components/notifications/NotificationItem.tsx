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
  const { theme } = useTheme();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getNotificationConfig = (type: Notification['type']) => {
    const configs = {
      success: {
        icon: CheckCircle,
        bgColor:
          theme === 'dark'
            ? 'bg-gradient-to-r from-green-500/90 to-emerald-500/90'
            : 'bg-gradient-to-r from-green-500 to-emerald-500',
        borderColor: 'border-green-400',
        textColor: 'text-white',
        iconColor: 'text-green-100',
        shadowColor: 'shadow-green-500/25',
      },
      error: {
        icon: AlertCircle,
        bgColor:
          theme === 'dark'
            ? 'bg-gradient-to-r from-red-500/90 to-rose-500/90'
            : 'bg-gradient-to-r from-red-500 to-rose-500',
        borderColor: 'border-red-400',
        textColor: 'text-white',
        iconColor: 'text-red-100',
        shadowColor: 'shadow-red-500/25',
      },
      warning: {
        icon: notification.title?.includes('Session') ? Clock : AlertTriangle,
        bgColor:
          theme === 'dark'
            ? 'bg-gradient-to-r from-yellow-500/90 to-orange-500/90'
            : 'bg-gradient-to-r from-yellow-500 to-orange-500',
        borderColor: 'border-yellow-400',
        textColor: 'text-white',
        iconColor: 'text-yellow-100',
        shadowColor: 'shadow-yellow-500/25',
      },
      info: {
        icon: Info,
        bgColor:
          theme === 'dark'
            ? 'bg-gradient-to-r from-blue-500/90 to-indigo-500/90'
            : 'bg-gradient-to-r from-blue-500 to-indigo-500',
        borderColor: 'border-blue-400',
        textColor: 'text-white',
        iconColor: 'text-blue-100',
        shadowColor: 'shadow-blue-500/25',
      },
    };
    return configs[type] || configs.info;
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
      // Calculate interval time based on duration
      const intervalTime = 100; // Update every 100ms
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
            // Use a timeout to avoid state updates during render
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -50, scale: 0.95, x: 100 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, y: -20, scale: 0.95, x: 100 }}
      transition={{
        duration: 0.3,
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      className="relative overflow-hidden w-full max-w-sm"
    >
      <div
        className={`
          relative flex items-start gap-3 p-4 
          ${config.bgColor} ${config.borderColor}
          border-l-4 rounded-xl shadow-lg ${config.shadowColor}
          backdrop-blur-sm cursor-pointer transition-all duration-200
          hover:scale-[1.02] hover:shadow-xl
          ${notification.onClick ? 'hover:brightness-110' : ''}
        `}
        onClick={notification.onClick ? handleClick : undefined}
      >
        {/* Icon */}
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {notification.title && (
            <h4
              className={`text-sm font-semibold ${config.textColor} mb-1 flex items-center gap-2`}
            >
              {notification.title}
              {notification.type === 'warning' &&
                notification.title.includes('Session') && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-2 h-2 bg-yellow-300 rounded-full"
                  />
                )}
            </h4>
          )}
          <p className={`text-sm ${config.textColor} leading-relaxed`}>
            {notification.message}
          </p>
          {notification.onClick && (
            <p
              className={`text-xs ${config.textColor} opacity-80 mt-1 font-medium`}
            >
              Click to take action
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          className={`
            flex-shrink-0 ${config.iconColor} 
            hover:bg-white/20 active:bg-white/30
            p-1 rounded transition-colors
          `}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress bar */}
        {notification.duration && notification.duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <motion.div
              className="h-full bg-white/60"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}

        {/* Persistent indicator */}
        {notification.persistent && (
          <div className="absolute top-2 right-2">
            <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default NotificationItem;
