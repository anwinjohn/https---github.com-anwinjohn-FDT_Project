/**
 * Generic confirmation dialog service.
 *
 * Works from ANY file (.tsx components AND plain .ts files like services,
 * utils, hooks) because it is event-driven, not hook-based:
 *
 *   import { confirmDialog } from './components/notifications/confirmService';
 *   const res = await confirmDialog({
 *     title: 'Delete attachment',
 *     message: 'This cannot be undone.',
 *     confirmLabel: 'Delete',
 *     danger: true,
 *   });
 *   if (res.action === 'confirmed') { ... }
 *
 * Requires <ConfirmProvider> once, high in the tree (already wired in App.tsx).
 */

import type { ConfirmIcon, ConfirmResult } from './ConfirmDialog';

export type ConfirmAction = 'confirmed' | 'cancelled' | 'dismissed';

export interface ConfirmOptions {
  /** Headline. Required. */
  title: string;
  /** Body copy under the title. */
  message?: string;
  /** Primary button text. Default 'Confirm'. */
  confirmLabel?: string;
  /** Secondary button text. Default 'Cancel'. */
  cancelLabel?: string;
  /** Red styling for destructive actions (delete, revoke, etc.). */
  danger?: boolean;
  /** Hide the cancel button — single OK-style dialog. */
  hideCancel?: boolean;
  /** Hide the close X. Use for must-answer prompts. */
  hideClose?: boolean;
  /** Icon: auto-chosen from danger when omitted. */
  icon?: ConfirmIcon;
  /** Button order follows reading direction (confirm on the right). */
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (result: ConfirmResult) => void;
  acknowledged: boolean;
}

const EVENT_NAME = 'app:confirm-dialog';
/** How long to wait for a provider to show the dialog before failing safe. */
const MOUNT_TIMEOUT_MS = 3000;

let currentId = 0;
const pending = new Map<number, PendingConfirm>();

/**
 * Ask the user to confirm an action. Returns a promise that resolves with
 * 'confirmed' | 'cancelled' | 'dismissed' (X / backdrop / Escape).
 * Safe to call from non-React code: fires a DOM event the provider listens to.
 */
export function confirmDialog(options: ConfirmOptions): Promise<ConfirmResult> {
  if (typeof window === 'undefined') {
    return Promise.resolve({ action: 'dismissed' });
  }
  const id = ++currentId;
  return new Promise<ConfirmResult>((resolve) => {
    const entry: PendingConfirm = { options, resolve, acknowledged: false };
    pending.set(id, entry);
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { id, options } })
    );
    // Fail safe: if no provider is mounted, don't hang the caller forever.
    // Once the provider acknowledges, this becomes a no-op.
    window.setTimeout(() => {
      if (pending.has(id) && !pending.get(id)!.acknowledged) {
        pending.delete(id);
        resolve({ action: 'dismissed' });
      }
    }, MOUNT_TIMEOUT_MS);
  });
}

/** Internal: the provider marks the dialog as shown, canceling the fail-safe. */
export function _acknowledgeConfirm(id: number): void {
  const entry = pending.get(id);
  if (entry) entry.acknowledged = true;
}

/** Internal: called by the provider when the user answers. */
export function _resolveConfirm(id: number, result: ConfirmResult): void {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  // Cancel the fail-safe timeout resolution by resolving first.
  entry.resolve(result);
}
