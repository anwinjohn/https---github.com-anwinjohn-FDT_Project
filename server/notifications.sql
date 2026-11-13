/*
# Notifications tables (in-app notification list + Web Push subscriptions)

1. New Tables
- `app_notifications`
  - `notification_id` (varchar(36), primary key)
  - `user_id` (varchar(100), indexed) — matches the authenticated username
  - `type` (varchar(20)) — alert | system | success | warning | info
  - `title` (varchar(255))
  - `message` (text)
  - `is_read` (boolean, default false)
  - `created_at` (timestamptz, default now())
  - `link` (varchar(512), nullable) — optional deep link inside the SPA
  - `meta_json` (text, nullable) — JSON-encoded metadata
- `push_subscriptions`
  - `id` (varchar(36), primary key)
  - `user_id` (varchar(100), indexed)
  - `endpoint` (varchar(1024), unique) — the browser's push endpoint URL
  - `p256dh`, `auth` (varchar(255)) — Web Push encryption keys
  - `machine_info` (text, nullable)
  - `created_at` (timestamptz), `last_used_at` (timestamptz, nullable)

2. Notes
- Both tables are only written by the API service (server/notifications.py);
  the browser never touches the database directly.
- The unique index on `endpoint` makes re-subscribing idempotent: the same
  browser subscription updates its row instead of duplicating it.
- Push subscriptions are keyed per user per browser; deleting a row
  (unsubscribe) stops pushes to that device only.
*/

CREATE TABLE IF NOT EXISTS app_notifications (
    notification_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    link VARCHAR(512),
    meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user
    ON app_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_unread
    ON app_notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_app_notifications_created
    ON app_notifications (created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    endpoint VARCHAR(1024) NOT NULL UNIQUE,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    machine_info TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions (user_id);
