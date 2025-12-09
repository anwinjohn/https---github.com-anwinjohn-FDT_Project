import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Notification, NotificationType } from './types';

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    colors: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-500',
      text: 'text-emerald-900',
      icon: 'text-emerald-600',
      progress: 'bg-gray-300',
      hover: 'hover:bg-emerald-100',
    },
  },
  error: {
    icon: AlertCircle,
    colors: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-900',
      icon: 'text-red-600',
      progress: 'bg-gray-800',
      hover: 'hover:bg-red-100',
    },
  },
  warning: {
    icon: AlertTriangle,
    colors: {
      bg: 'bg-amber-50',
      border: 'border-amber-500',
      text: 'text-amber-900',
      icon: 'text-amber-600',
      progress: 'bg-gray-800',
      hover: 'hover:bg-amber-100',
    },
  },
  info: {
    icon: Info,
    colors: {
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-900',
      icon: 'text-blue-600',
      progress: 'bg-gray-800',
      hover: 'hover:bg-blue-100',
    },
  },
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRemove,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const config = typeConfig[notification.type];
  const Icon = config.icon;
  const colors = config.colors;

  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const interval = 50;
      const decrement = (100 / notification.duration) * interval;

      const timer = setInterval(() => {
        setProgress((prev) => {
          const next = prev - decrement;
          return next <= 0 ? 0 : next;
        });
      }, interval);

      return () => clearInterval(timer);
    }
  }, [notification.duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(notification.id);
    }, 300);
  };

  return (
    <div
      className={`
        relative overflow-hidden
        ${colors.bg} ${colors.border} ${colors.text}
        border-l-4 rounded-lg shadow-lg
        transition-all duration-300 ease-out
        ${
          isExiting
            ? 'opacity-0 translate-x-full scale-95'
            : 'opacity-100 translate-x-0 scale-100'
        }
      `}
      style={{
        animation: isExiting ? 'none' : 'slideIn 0.3s ease-out',
      }}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`flex-shrink-0 ${colors.icon} animate-fadeIn`}>
          <Icon className="w-5 h-5" strokeWidth={2.5} />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {notification.title && (
            <h3 className="font-semibold text-sm mb-1 leading-tight">
              {notification.title}
            </h3>
          )}
          <p className="text-sm leading-relaxed opacity-90">
            {notification.message}
          </p>
        </div>

        <button
          onClick={handleClose}
          className={`
            flex-shrink-0 p-1.5 rounded-md
            ${colors.hover}
            transition-all duration-200 ease-out
            opacity-60 hover:opacity-100
            focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current
          `}
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {notification.duration && notification.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-5">
          <div
            className={`h-full ${colors.progress} transition-all duration-50 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};
