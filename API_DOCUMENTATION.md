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