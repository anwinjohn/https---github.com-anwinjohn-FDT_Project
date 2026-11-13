/**
 * Browser push notifications via the Push API + the existing service worker.
 *
 * Why the permission prompt kept re-appearing: `Notification.requestPermission`
 * was being called on every app load. A denied prompt is sticky — Chrome re-asks
 * after a while — so the only durable fix is to ask exactly once, remember the
 * outcome, and never call requestPermission again unless the user explicitly
 * turns notifications on from settings.
 *
 * Permission state machine (persisted in localStorage under 'push-perm-state'):
 *   'default'  -> never asked before; show the in-app prompt banner once
 *   'granted'  -> subscription exists or is created silently on next load
 *   'denied'   -> never prompt again; user can only re-enable from settings
 *   'unavailable' -> this browser has no push support; UI hides push controls
 */
import { notificationService } from '../services/notificationService';

const PERMISSION_STATE_KEY = 'push-perm-state';
const SUBSCRIPTION_ENDPOINT_KEY = 'push-endpoint';

export type PushPermissionState =
  | 'default'
  | 'granted'
  | 'denied'
  | 'unavailable';

interface PushEnableResult {
  ok: boolean;
  state: PushPermissionState;
  error?: string;
}

const readStoredState = (): PushPermissionState | null => {
  try {
    const raw = localStorage.getItem(PERMISSION_STATE_KEY);
    if (
      raw === 'default' ||
      raw === 'granted' ||
      raw === 'denied' ||
      raw === 'unavailable'
    ) {
      return raw;
    }
  } catch {
    /* private mode */
  }
  return null;
};

const storeState = (state: PushPermissionState): void => {
  try {
    localStorage.setItem(PERMISSION_STATE_KEY, state);
  } catch {
    /* private mode */
  }
};

export const pushService = {
  /** Current permission state, reconciling stored state with the browser. */
  getState(): PushPermissionState {
    if (typeof window === 'undefined') return 'unavailable';
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return 'unavailable';
    }
    const live = Notification.permission as PushPermissionState;
    const stored = readStoredState();
    // The browser is the source of truth; storage only remembers "we already
    // asked" so the UI never triggers a second prompt.
    if (stored !== live && stored !== null) {
      storeState(live);
    }
    return live;
  },

  /** True when we've already asked the user (so we must not ask again). */
  hasAsked(): boolean {
    return readStoredState() !== null && readStoredState() !== 'default';
  },

  /**
   * Called on app start (after login). NEVER calls requestPermission.
   * If permission is already granted, silently (re)syncs the subscription.
   */
  async init(username: string): Promise<void> {
    if (this.getState() !== 'granted') return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const endpoint = existing.endpoint;
        if (localStorage.getItem(SUBSCRIPTION_ENDPOINT_KEY) !== endpoint) {
          localStorage.setItem(SUBSCRIPTION_ENDPOINT_KEY, endpoint);
        }
        await notificationService.subscribe(username, existing.toJSON());
      } else {
        await this.subscribeWithStoredPermission(username);
      }
    } catch (error) {
      console.warn('[push] init failed', error);
    }
  },

  /**
   * The ONLY path that shows the browser prompt. Must be called from a real
   * user gesture (a button click), never on page load.
   */
  async enableFromUserGesture(username: string): Promise<PushEnableResult> {
    if (this.getState() === 'unavailable') {
      return {
        ok: false,
        state: 'unavailable',
        error: 'Push not supported in this browser',
      };
    }
    if (Notification.permission === 'granted') {
      const sub = await this.subscribeWithStoredPermission(username);
      return sub.ok ? { ok: true, state: 'granted' } : sub;
    }
    if (Notification.permission === 'denied') {
      return {
        ok: false,
        state: 'denied',
        error:
          'Notifications are blocked. Enable them in your browser settings.',
      };
    }
    try {
      const permission = await Notification.requestPermission();
      storeState(permission as PushPermissionState);
      if (permission !== 'granted') {
        return { ok: false, state: permission as PushPermissionState };
      }
      const sub = await this.subscribeWithStoredPermission(username);
      return sub.ok ? { ok: true, state: 'granted' } : sub;
    } catch (error) {
      return {
        ok: false,
        state: 'denied',
        error:
          error instanceof Error ? error.message : 'Permission request failed',
      };
    }
  },

  /** Creates the subscription and posts it to the API. Assumes permission granted. */
  async subscribeWithStoredPermission(
    username: string
  ): Promise<PushEnableResult> {
    try {
      const vapidKey = await notificationService.getVapidPublicKey();
      if (!vapidKey) {
        return {
          ok: false,
          state: 'granted',
          error: 'Push is not configured on the server yet',
        };
      }
      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          applicationServerKey,
          userVisibleOnly: true,
        }));
      localStorage.setItem(SUBSCRIPTION_ENDPOINT_KEY, subscription.endpoint);
      await notificationService.subscribe(username, subscription.toJSON());
      return { ok: true, state: 'granted' };
    } catch (error) {
      return {
        ok: false,
        state: 'granted',
        error: error instanceof Error ? error.message : 'Subscription failed',
      };
    }
  },

  /** Turns push off for this user and removes the browser subscription. */
  async disable(username: string): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        console.log('Disabling push notifications for user:', username);
        await notificationService.unsubscribe(username, subscription.endpoint);
        await subscription.unsubscribe();
      }
      localStorage.removeItem(SUBSCRIPTION_ENDPOINT_KEY);
    } catch (error) {
      console.warn('[push] disable failed', error);
    }
  },

  /** Local test notification (no server round-trip). */
  async showLocal(title: string, body: string): Promise<void> {
    if (this.getState() !== 'granted') return;
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      tag: `local-${Date.now()}`,
    });
  },
};

/** VAPID keys are base64url-encoded; the Push API needs raw bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
