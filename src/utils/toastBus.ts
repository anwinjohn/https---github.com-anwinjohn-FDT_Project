/**
 * Usage:
 *   import { toast } from '../utils/toastBus';
 *   toast.success('Saved');
 *   toast.error('Something failed', { duration: 0 }); // duration 0 = persistent
 *   toast.info('...', { title: 'Heads up' });
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastPayload {
  message: string;
  type: ToastType;
  duration?: number;
  title?: string;
  onClick?: () => void;
  /** Inline action button rendered inside the toast (e.g. "Close anyway"). */
  actionLabel?: string;
  onAction?: () => void;
}

type Listener = (payload: ToastPayload) => void;

const listeners = new Set<Listener>();

export function onToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitToast(payload: ToastPayload): void {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (err) {
      console.error('toast listener failed', err);
    }
  });
}

export const toast = {
  success: (
    message: string,
    options?: Omit<ToastPayload, 'message' | 'type'>
  ) => emitToast({ message, type: 'success', ...options }),
  error: (message: string, options?: Omit<ToastPayload, 'message' | 'type'>) =>
    emitToast({ message, type: 'error', ...options }),
  warning: (
    message: string,
    options?: Omit<ToastPayload, 'message' | 'type'>
  ) => emitToast({ message, type: 'warning', ...options }),
  info: (message: string, options?: Omit<ToastPayload, 'message' | 'type'>) =>
    emitToast({ message, type: 'info', ...options }),
};
