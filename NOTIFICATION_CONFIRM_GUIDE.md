# Confirmation Alerts & Toast Notifications — Usage Guide

Two reusable pieces live in `src/components/notifications/`:

| Piece | File | What it's for |
|---|---|---|
| `confirmDialog(...)` | `confirmService.ts` | Ask the user OK / Cancel before an action — callable from **any** `.ts` or `.tsx` file |
| Toast notifications | `NotificationContext.tsx` + `NotificationItem.tsx` | Bottom-of-screen status messages (success, error, warning, info) |

Both are already mounted app-wide in `App.tsx` — no per-page setup needed.

---

## 1. Confirmation dialogs (`confirmDialog`)

### The one rule

Import the **function**, not a hook. It returns a **Promise**, so you `await`
it anywhere — event handlers, services, plain helper modules, hooks, even
top-of-file initialization code that runs outside React.

```ts
import { confirmDialog } from './components/notifications/confirmService';
```

(Path adjusts to wherever the importing file lives, e.g.
`../components/notifications/confirmService` from `src/services/`.)

### Basic sample — OK / Cancel

```tsx
// Any .tsx component
import { confirmDialog } from '../components/notifications/confirmService';

async function handleDeleteAttachment(id: string) {
  const res = await confirmDialog({
    title: 'Delete attachment?',
    message: 'This file will be permanently removed.',
    confirmLabel: 'Delete',
    danger: true,
  });

  if (res.action === 'confirmed') {
    await deleteAttachment(id);
  }
  // 'cancelled' (Cancel button) or 'dismissed' (X, backdrop, Escape) → do nothing
}
```

### From a plain `.ts` service file (no React)

```ts
// src/services/reportBuilderService.ts
import { confirmDialog } from '../components/notifications/confirmService';

export async function runReport(params: ReportParams) {
  if (params.overwriteExisting) {
    const res = await confirmDialog({
      title: 'Report already exists',
      message: `A report named "${params.name}" exists. Replace it?`,
      confirmLabel: 'Replace',
    });
    if (res.action !== 'confirmed') return null; // user backed out
  }
  return buildReport(params);
}
```

### All options

```ts
const res = await confirmDialog({
  title: 'Revoke user access?',       // required — the headline
  message: 'They will be signed out on all devices immediately.', // optional body
  confirmLabel: 'Revoke access',      // default 'Confirm'
  cancelLabel: 'Keep access',         // default 'Cancel'
  danger: true,                       // red confirm button + warning icon
  hideCancel: true,                   // OK-only dialog (just an acknowledge step)
  hideClose: true,                    // remove the X — user must pick a button
  icon: 'warning',                    // 'help' | 'warning' | 'danger' | 'info' | 'success' | 'error' | 'none'
});
```

### Result values

| `res.action` | Triggered by |
|---|---|
| `'confirmed'` | The primary (colored) button |
| `'cancelled'` | The secondary button |
| `'dismissed'` | Escape key, backdrop click, or the X |

Escape and backdrop-click both map to `'dismissed'` — treat them the same as
cancel (never perform the action).

### Fail-safe behavior

If `ConfirmProvider` somehow isn't mounted (e.g. a unit test renders a
component in isolation), the promise resolves `{ action: 'dismissed' }`
after ~3 seconds instead of hanging forever. The dialog itself stays open
until answered once the provider has acknowledged it.

### Escaping long messages

`message` renders as plain text with line breaks preserved — no HTML. Use
`\n` for manual line breaks:

```ts
confirmDialog({
  title: 'Bulk action',
  message: `You are about to dismiss ${count} alerts.\nThis cannot be undone.`,
  danger: true,
});
```

---

## 2. Toast notifications

### From a component

```tsx
import { useNotifications } from '../components/notifications';

const toast = useNotifications();

toast.addNotification('Attachment deleted.', 'success');
toast.addNotification('Could not reach the server.', 'error');
toast.addNotification('Session expires in 2 minutes.', 'warning', 0, 'Session'); // duration 0 = pinned
```

### From a plain `.ts` file

Plain (non-React) files can't call hooks — dispatch through the same
event bridge the toasts already use, or simply call `confirmDialog`'s
sibling: `window.dispatchEvent`. The simplest supported path from `.ts`
files is to route through a component-level callback, but if you need
fire-and-forget toasts from services, use the exported helper:

```ts
// src/utils/notify.ts (optional convenience wrapper)
import { confirmDialog } from '../components/notifications/confirmService';
// Toasts from .ts files: dispatch the existing DOM event that
// NotificationProvider listens for, or keep toast calls in components.
```

In practice, keep `addNotification` calls in components/hooks (which can use
the hook) and reserve `confirmDialog` for anywhere-in-app use — it is the
piece designed to be callable from plain `.ts`.

---

## 3. Real-world patterns

### Delete with confirmation + toast feedback

```tsx
const toast = useNotifications();

async function onDelete(id: string) {
  const res = await confirmDialog({
    title: 'Delete this alert note?',
    message: 'The note will be removed for all users.',
    confirmLabel: 'Delete note',
    danger: true,
  });
  if (res.action !== 'confirmed') return;

  const result = await deleteNote(id);
  if (result.success) toast.addNotification('Note deleted.', 'success');
  else toast.addNotification(result.error ?? 'Delete failed.', 'error');
}
```

### Guarding a risky bulk action in a service layer

```ts
// src/utils/alertsCsvExport.ts
import { confirmDialog } from '../components/notifications/confirmService';

export async function exportAllBranches(): Promise<Blob | null> {
  const res = await confirmDialog({
    title: 'Export every branch?',
    message: 'This may take a minute for large datasets.',
    confirmLabel: 'Export all',
    icon: 'info',
  });
  if (res.action !== 'confirmed') return null;
  return buildExport();
}
```

### OK-only acknowledgment

```ts
await confirmDialog({
  title: 'Session expired',
  message: 'Please sign in again to continue.',
  confirmLabel: 'Sign in',
  hideCancel: true,
  hideClose: true,
});
```

---

## 4. What changed in this redesign

- **Toasts (`NotificationItem.tsx`)** — rebuilt with a flat, token-aligned
  look: solid surface, hairline border, one type-colored accent (icon chip,
  left edge, progress bar). Glass gradients and glows removed. Timer still
  pauses on hover; pinned/session styles retained.
- **New: `ConfirmDialog.tsx` + `confirmService.ts`** — portal-rendered modal
  with backdrop blur, spring entrance, Escape/backdrop dismissal, focus on
  the confirm button, and dark/light theming from the app's existing tokens.
- **`App.tsx`** — added `<ConfirmProvider>` around the app (once, above all
  routes).

## 5. Rules of thumb

- Use `confirmDialog` whenever an action is destructive, irreversible, or
  affects other users — never for plain informational messages (use toasts).
- Always check `res.action`, not truthiness — `{ action: 'cancelled' }` is a
  truthy object.
- Keep `danger: true` for anything that deletes, revokes, or permanently
  changes data.
- One confirm per action; don't stack confirms ("are you REALLY sure") —
  set `hideClose` on the single must-answer dialog instead.
