# Admin Task API Documentation

This document outlines the expected API endpoints and data structures for the admin task functionality.

## Base Configuration

```json
{
  "api": {
    "baseUrl": "http://127.0.0.1:8000",
    "authBaseUrl": "http://127.0.0.1:8001"
  }
}
```

## Authentication

All admin API endpoints require authentication via Bearer token:

```
Authorization: Bearer <access_token>
```

## 1. User Management APIs

### GET /api/admin/users

Fetch users with filtering and pagination.

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `search` (string): Search in username, email, full_name
- `role_id` (number): Filter by role ID
- `is_active` (boolean): Filter by active status
- `account_locked` (boolean): Filter by lock status
- `mfa_enabled` (boolean): Filter by MFA status

**Response:**

```json
{
  "users": [
    {
      "id": "uuid-string",
      "username": "john.doe",
      "email_id": "john.doe@company.com",
      "full_name": "John Doe",
      "role_id": 2,
      "role_name": "User",
      "is_active": true,
      "failed_login_count": 0,
      "last_login": "2025-01-08T10:30:00Z",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-08T10:30:00Z",
      "mfa_enabled": false,
      "account_locked": false,
      "password_expires_at": "2025-04-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### POST /api/admin/users/action

Perform actions on users.

**Request Body:**

```json
{
  "action": "activate|deactivate|unlock|reset_password|reset_failed_login|change_role|enable_mfa|disable_mfa",
  "user_id": "uuid-string",
  "new_role_id": 2, // Optional, for change_role action
  "reason": "Administrative action" // Optional
}
```

**Response:**

```json
{
  "success": true,
  "message": "User activated successfully"
}
```

### GET /api/admin/roles

Fetch all available roles.

**Response:**

```json
[
  {
    "id": 0,
    "role_name": "Super Admin",
    "description": "Full system access",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  {
    "id": 1,
    "role_name": "Admin",
    "description": "Administrative access",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  {
    "id": 2,
    "role_name": "User",
    "description": "Standard user access",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
]
```

## 2. Role Menu Permissions APIs

### GET /api/admin/roles/{role_id}/menu-permissions

Fetch menu permissions for a specific role.

**Response:**

```json
[
  {
    "id": 1,
    "role_id": 1,
    "menu_id": 1,
    "menu_name": "Dashboard",
    "menu_url": "/dashboard",
    "menu_icon": "LayoutDashboard",
    "parent_id": null,
    "can_view": true,
    "can_edit": true,
    "can_delete": false,
    "can_create": true,
    "can_export": true,
    "can_import": false,
    "level": 0
  },
  {
    "id": 2,
    "role_id": 1,
    "menu_id": 2,
    "menu_name": "Analytics",
    "menu_url": "/analytics",
    "menu_icon": "BarChart3",
    "parent_id": null,
    "can_view": true,
    "can_edit": true,
    "can_delete": false,
    "can_create": true,
    "can_export": true,
    "can_import": false,
    "level": 0
  }
]
```

### PUT /api/admin/roles/{role_id}

Update menu permissions for a role.

**Request Body:**

```json
{
  "permissions": [
    {
      "menu_id": 1,
      "can_view": true,
      "can_edit": true,
      "can_delete": false,
      "can_create": true,
      "can_export": true,
      "can_import": false
    },
    {
      "menu_id": 2,
      "can_view": true,
      "can_edit": false,
      "can_delete": false,
      "can_create": false,
      "can_export": true,
      "can_import": false
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Permissions updated successfully"
}
```

## 3. Audit Log APIs

### GET /api/admin/audit-logs

Fetch audit logs with filtering and pagination.

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `user_id` (string): Filter by target user ID
- `action` (string): Filter by action type
- `target_type` (string): Filter by target type (user|role|menu_permission)

**Response:**

```json
{
  "logs": [
    {
      "id": 1,
      "user_id": "target-user-uuid",
      "admin_user_id": "admin-user-uuid",
      "admin_username": "admin",
      "action": "activate",
      "target_type": "user",
      "target_id": "target-user-uuid",
      "old_values": {
        "is_active": false
      },
      "new_values": {
        "is_active": true
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "timestamp": "2025-01-08T10:30:00Z",
      "reason": "User requested account reactivation"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "totalPages": 25
  }
}
```

## 4. Database Schema

### Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email_id VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    is_active BOOLEAN DEFAULT true,
    failed_login_count INTEGER DEFAULT 0,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mfa_enabled BOOLEAN DEFAULT false,
    account_locked BOOLEAN DEFAULT false,
    password_expires_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);
```

### Roles Table

```sql
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID, -- Target user (can be null for system actions)
    admin_user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL, -- 'user', 'role', 'menu_permission'
    target_id VARCHAR(255) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);
```

## 5. Sample Data

### Sample Users

```sql
INSERT INTO users (username, email_id, full_name, role_id, is_active) VALUES
('admin', 'admin@company.com', 'System Administrator', 1, true),
('john.doe', 'john.doe@company.com', 'John Doe', 2, true),
('jane.smith', 'jane.smith@company.com', 'Jane Smith', 2, false),
('bob.wilson', 'bob.wilson@company.com', 'Bob Wilson', 3, true);
```

### Sample Roles

```sql
INSERT INTO roles (id, role_name, description) VALUES
(0, 'Super Admin', 'Full system access with all permissions'),
(1, 'Admin', 'Administrative access with limited system settings'),
(2, 'User', 'Standard user access to basic features'),
(3, 'Analyst', 'Enhanced access to analytics and reporting features');
```

## 6. Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error_code": "VALIDATION_ERROR|PERMISSION_DENIED|NOT_FOUND|INTERNAL_ERROR",
  "details": {
    "field": "Specific field error message"
  }
}
```

## 7. Security Considerations

1. **Audit Logging**: All admin actions must be logged with:
   - Admin user performing the action
   - Target user/resource
   - Old and new values
   - IP address and user agent
   - Timestamp and reason

2. **Permission Validation**:
   - Verify admin has permission to perform the action
   - Prevent privilege escalation
   - Log all permission checks

3. **Rate Limiting**: Implement rate limiting on admin endpoints

4. **Input Validation**: Validate all input parameters and sanitize data

5. **Encryption**: Sensitive data should be encrypted in transit and at rest

## 7. Profile APIs (My Profile page)

All profile endpoints are relative to the API base URL and require the standard
`Authorization: Bearer <token>` header plus the encryption envelope used by the
shared API client (`{ "data": "<encrypted>" }` request bodies, encrypted
response bodies flagged with `X-Encrypted: true`). Avatar upload is raw
`multipart/form-data` (never JSON-encrypted).

**Identity:** every request body carries `user_id` for compatibility only. The
server MUST derive the acting user from the session token and ignore, or
validate against the token, the `user_id` field.

**Mock fallback:** the page ships with sample data that activates ONLY when
`VITE_PROFILE_MOCKS=true` in a local `.env` and the network call fails. With the
flag off (and in production builds), every failure is a real error. The shapes
below are the contract the backend must fulfil.

### Types

```ts
UserProfileData {
  id: string
  username: string                  // immutable, shown read-only
  first_name: string
  last_name: string
  email: string
  phone: string | null
  job_title: string | null
  department?: string | null
  role_name: string
  avatar_url: string | null
  timezone: string                  // IANA zone, e.g. "Asia/Dubai"
  language: string                  // ISO code, e.g. "en"
  two_factor_enabled: boolean
  last_login: string | null         // ISO 8601 (UTC)
  created_at: string | null
  password_changed_at?: string | null
  // Optional enterprise fields — absent is fine:
  email_verified?: boolean
  status?: 'active' | 'suspended' | 'locked' | string
  manager_name?: string | null
  permissions?: string[]            // e.g. ["alerts.view", "cases.create"]
}

UserSession {
  session_id: string
  device: string
  browser: string
  ip_address: string
  location?: string
  last_active: string               // ISO 8601
  is_current: boolean
  // Optional — absent is fine:
  is_new_location?: boolean         // first sign-in from this location/device
}

UserPreferences {
  email_notifications: boolean
  push_notifications: boolean
  security_alerts: boolean          // locked ON by the UI
  weekly_digest: boolean
  // Optional extensions — the client defaults them if absent:
  high_risk_alerts?: boolean
  case_assignments?: boolean
  sla_breaches?: boolean
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string        // "HH:MM" 24h local, e.g. "22:00"
  quiet_hours_end?: string          // e.g. "07:00"
  time_format?: '12h' | '24h'
}

TwoFactorSetup {
  secret: string                    // base32 TOTP secret
  otpauth_uri?: string              // otpauth://totp/... URI
  qr_code_data_url?: string         // server-rendered QR as a data: URL
                                    // (keeps the secret off third-party QR services)
}

ActivityEvent {
  id: string
  type: 'login' | 'login_failed' | 'logout' | 'password_changed'
      | 'two_factor_enabled' | 'two_factor_disabled' | 'profile_updated'
      | 'avatar_changed' | 'session_revoked' | 'preferences_updated' | string
  timestamp: string                 // ISO 8601
  success: boolean
  ip_address?: string
  device?: string
  location?: string
  detail?: string                   // human-readable summary
}
```

### GET /profile/me

```json
{
  "data": {
    "id": "u-1001",
    "username": "demo.analyst",
    "first_name": "Demo",
    "last_name": "Analyst",
    "email": "demo.analyst@arie.app",
    "phone": "+971 50 123 4567",
    "job_title": "Senior Fraud Analyst",
    "department": "Risk & Compliance",
    "role_name": "Analyst",
    "avatar_url": "/uploads/avatars/u-1001.png",
    "timezone": "Asia/Dubai",
    "language": "en",
    "two_factor_enabled": false,
    "last_login": "2026-11-11T06:12:00Z",
    "created_at": "2024-03-15T09:30:00Z",
    "password_changed_at": "2026-09-28T14:05:00Z",
    "email_verified": true,
    "status": "active",
    "manager_name": "Layla Haddad",
    "permissions": ["alerts.view", "alerts.triage", "cases.create"]
  }
}
```

### PUT /profile/update

Request: `{ "user_id": "...", ...only the changed fields }` — any of
`first_name, last_name, email, phone, job_title, department, timezone, language`.

Success: `200` with the full updated `UserProfileData` under `data` (an empty
body is also accepted; the page merges locally).

Validation failure: `400` with field-level errors:

```json
{
  "errors": { "email": "This email is already in use" },
  "message": "Validation failed"
}
```

### POST /profile/avatar

`multipart/form-data` with `user_id` and `avatar` (file).
The client center-crops to a square, resizes to max 512px, compresses, and
validates the file signature (not just the MIME type) before upload — but the
server MUST re-validate content independently.
Success: `200` with `{ "data": { "avatar_url": "/uploads/avatars/u-1001.png" } }`.
Constraints: JPG/PNG/WEBP, max 8 MB raw / 2 MB after client processing.

### DELETE /profile/avatar

Request: `{ "user_id": "..." }`. Success: `200`, any body.

### POST /profile/change-password

Request: `{ "user_id": "...", "current_password": "...", "new_password": "...", "confirm_password": "..." }`
Success: `200`, any body.
Client-side policy (server is the source of truth, keep in sync):
min 12 chars, upper + lower + digit + special, must not contain the user's
name/username/email, must not be a common password.
Wrong current password: `400` or `401` with `{ "message": "..." }` — shown on
the current-password field.

### POST /profile/two-factor/setup

Starts enrollment. Request: `{ "user_id": "..." }`.
Success `200`:

```json
{
  "data": {
    "secret": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
    "otpauth_uri": "otpauth://totp/ARIE:demo.analyst?secret=JBSWY3DPEHPK3PXP&issuer=ARIE",
    "qr_code_data_url": "data:image/png;base64,..."
  }
}
```

`otpauth_uri` and `qr_code_data_url` are optional; the UI falls back to manual
key entry from `secret`. The pending secret should be stored server-side (not
activated) until verify succeeds.

### POST /profile/two-factor/verify

Completes enrollment and ENABLES 2FA. Request: `{ "user_id": "...", "code": "123456" }`.
Success `200` with one-time recovery codes:

```json
{ "data": { "recovery_codes": ["A1B2C-D3E4F", "G5H6I-J7K8L", "..."] } }
```

Bad code: `400` with `{ "message": "Invalid verification code" }`.
Replaces the removed `POST /profile/two-factor { enabled: true }`.

### POST /profile/two-factor/disable

Requires re-authentication. Request: `{ "user_id": "...", "password": "current password" }`.
Success: `200`, any body. Wrong password: `400`/`401` with `{ "message": "..." }`.
Replaces the removed `POST /profile/two-factor { enabled: false }`.

### GET /profile/sessions

```json
{
  "data": [
    {
      "session_id": "s-current",
      "device": "Chrome on Windows",
      "browser": "Chrome 126",
      "ip_address": "10.20.4.87",
      "location": "Dubai, AE",
      "last_active": "2026-11-11T08:00:00Z",
      "is_current": true
    },
    {
      "session_id": "s-3",
      "device": "Firefox on Linux",
      "browser": "Firefox 127",
      "ip_address": "185.220.101.4",
      "location": "Unknown",
      "last_active": "2026-11-10T06:00:00Z",
      "is_current": false,
      "is_new_location": true
    }
  ]
}
```

### POST /profile/sessions/revoke

Request: `{ "user_id": "...", "session_id": "..." }`. Success: `200`, any body.
Revoking the current session is not offered by the UI.

### POST /profile/sessions/revoke-others

Request: `{ "user_id": "..." }`. Success: `200`, any body.
Terminates every non-current session server-side.

### GET /profile/preferences

```json
{
  "data": {
    "email_notifications": true,
    "push_notifications": true,
    "security_alerts": true,
    "weekly_digest": false,
    "high_risk_alerts": true,
    "case_assignments": true,
    "sla_breaches": true,
    "quiet_hours_enabled": false,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "07:00",
    "time_format": "24h"
  }
}
```

### PUT /profile/preferences

Request: `{ "user_id": "...", ...only the changed preferences }`. Success:
`200`, any body. The UI never allows `security_alerts: false`.

### GET /profile/activity?page=1&limit=10

Paginated account audit trail, newest first.
Success `200`:

```json
{
  "data": {
    "events": [
      {
        "id": "a-1",
        "type": "login",
        "success": true,
        "timestamp": "2026-11-11T06:12:00Z",
        "ip_address": "10.20.4.87",
        "location": "Dubai, AE",
        "device": "Chrome on Windows"
      },
      {
        "id": "a-2",
        "type": "login_failed",
        "success": false,
        "timestamp": "2026-11-10T23:41:00Z",
        "ip_address": "185.220.101.4",
        "location": "Unknown",
        "device": "Firefox on Linux"
      }
    ],
    "has_more": true
  }
}
```

Compatibility: a bare `ActivityEvent[]` array (no `{ events, has_more }` wrapper)
is also accepted; paging then stops after the first page. Defaults: `page=1`,
`limit=10`.

### Error envelope (all endpoints)

Failures surface to the page as thrown errors with:

- `status`: HTTP status when known (401/403/429 have built-in friendly messages)
- `fieldErrors`: from a `400` body `{ "errors": { "<field>": "..." } }`
- `message`: from `response.data.message` / `response.data.error` / Axios message

`401` triggers the shared token-refresh flow before failing. Network-level
failures (no response at all) are distinguishable from HTTP errors and are the
only trigger for the mock fallback when enabled.
