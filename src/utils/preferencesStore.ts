/**
 * User preferences persisted in localStorage. Read/written from anywhere
 * (components and plain .ts files) — keep keys stable, they are storage.
 */

export interface NotificationPrefs {
  /** Master switch for transient toast popups. */
  toastsEnabled: boolean;
}

const KEY = 'userPreferences.notification';

const DEFAULTS: NotificationPrefs = {
  toastsEnabled: true,
};

export function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      toastsEnabled: typeof parsed.toastsEnabled === 'boolean'
        ? parsed.toastsEnabled
        : DEFAULTS.toastsEnabled,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage full/unavailable — preferences just won't persist.
  }
}

/** DOM event fired whenever preferences change, so live UI can react. */
export const NOTIFICATION_PREFS_EVENT = 'app:notification-prefs-changed';

export function notifyPrefsChanged(prefs: NotificationPrefs): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_PREFS_EVENT, { detail: prefs })
  );
}
