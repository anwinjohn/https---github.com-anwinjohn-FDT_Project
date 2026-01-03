import { useNotification } from '../context/NotificationContext'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export function Toast() {
  const { notifications, removeNotification } = useNotification();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return null;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getTextColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-900';
      case 'error':
        return 'text-red-900';
      case 'warning':
        return 'text-yellow-900';
      case 'info':
        return 'text-blue-900';
      default:
        return 'text-gray-900';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`flex items-start gap-3 p-4 rounded-lg border ${getBgColor(
            notification.type
          )} shadow-lg animate-in slide-in-from-right-2 fade-in-0 duration-200`}
        >
          <div className="flex-shrink-0">{getIcon(notification.type)}</div>
          <div className="flex-1">
            <p className={`font-semibold ${getTextColor(notification.type)}`}>
              {notification.title}
            </p>
            {notification.message && (
              <p className={`text-sm mt-1 ${getTextColor(notification.type)} opacity-80`}>
                {notification.message}
              </p>
            )}
          </div>
          <button
            onClick={() => removeNotification(notification.id)}
            className={`flex-shrink-0 ${getTextColor(notification.type)} hover:opacity-70 transition-opacity`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
