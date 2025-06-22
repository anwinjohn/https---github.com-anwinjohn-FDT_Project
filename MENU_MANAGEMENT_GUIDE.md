# Menu Management System Guide

This guide explains how to add new menus and manage the menu system in the FDT application.

## 📋 **Overview**

The menu system consists of:
- **Master Menu Table** (`menu_items`): Contains all available menu items
- **Permission Table** (`menu_permissions`): Controls role-based access to menus
- **Dynamic Loading**: Menus are loaded based on user's role permissions

## 🗄️ **Database Structure**

### Menu Items Table
```sql
CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES menu_items(id),
    menu_name VARCHAR(100) NOT NULL,
    menu_url VARCHAR(255) NOT NULL,
    menu_icon VARCHAR(50) NOT NULL,
    menu_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    required_role_id INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Menu Permissions Table
```sql
CREATE TABLE menu_permissions (
    id SERIAL PRIMARY KEY,
    menu_id INTEGER NOT NULL REFERENCES menu_items(id),
    role_id INTEGER NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT false,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,
    can_create BOOLEAN NOT NULL DEFAULT false,
    can_export BOOLEAN NOT NULL DEFAULT false,
    can_import BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(menu_id, role_id)
);
```

## 🔧 **Adding New Menu Items**

### Method 1: Using Helper Function (Recommended)
```sql
-- Add a new parent menu
SELECT add_menu_item(
    NULL,                    -- parent_id (NULL for root menu)
    'Reports',              -- menu_name
    '/reports',             -- menu_url
    'FileText',             -- menu_icon (Lucide React icon name)
    5,                      -- menu_order
    0,                      -- required_role_id (0 = all roles)
    true                    -- is_active
);

-- Add a child menu
SELECT add_menu_item(
    15,                     -- parent_id (ID of parent menu)
    'Daily Reports',        -- menu_name
    '/reports/daily',       -- menu_url
    'Calendar',             -- menu_icon
    1,                      -- menu_order
    0,                      -- required_role_id
    true                    -- is_active
);
```

### Method 2: Direct SQL Insert
```sql
INSERT INTO menu_items (parent_id, menu_name, menu_url, menu_icon, menu_order, required_role_id) 
VALUES (NULL, 'New Feature', '/new-feature', 'Star', 6, 1);
```

## 🔐 **Setting Menu Permissions**

### Using Helper Function
```sql
-- Grant permissions to Super Admin (role_id = 0)
SELECT add_menu_permission(
    15,                     -- menu_id
    0,                      -- role_id (Super Admin)
    true,                   -- can_view
    true,                   -- can_edit
    true,                   -- can_delete
    true,                   -- can_create
    true,                   -- can_export
    true                    -- can_import
);

-- Grant limited permissions to Regular Admin (role_id = 1)
SELECT add_menu_permission(15, 1, true, true, false, false, true, false);

-- Grant view-only to Regular User (role_id = 2)
SELECT add_menu_permission(15, 2, true, false, false, false, false, false);
```

## 🎨 **Available Icons**

The system uses Lucide React icons. Common icons include:
- `LayoutDashboard` - Dashboard
- `BarChart3` - Analytics
- `Users` - User management
- `Settings` - Settings/Admin
- `FileText` - Reports
- `Shield` - Security
- `AlertTriangle` - Alerts
- `Building` - Branches
- `TrendingUp` - Trends
- `Calendar` - Calendar/Dates
- `Bell` - Notifications

## 📁 **Component File Locations**

### For Admin Components
```
src/components/admin/ComponentName.tsx
```
**Example**: `src/components/admin/UserManagement.tsx`

### For Regular Components
```
src/components/ComponentName.tsx
```
**Example**: `src/components/ReportsPanel.tsx`

## 🔄 **Adding New Components**

### Step 1: Create the Component
```typescript
// src/components/admin/NewFeature.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const NewFeature: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
          <Star className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">New Feature</h1>
      </div>
      
      {/* Your component content here */}
    </motion.div>
  );
};

export default NewFeature;
```

### Step 2: Add to Dashboard Router
```typescript
// In src/components/Dashboard.tsx
import NewFeature from './admin/NewFeature';

// Add to renderContent() switch statement
case 'new-feature':
  return <NewFeature />;
```

### Step 3: Add Icon to Icon Map
```typescript
// In src/components/Sidebar.tsx
import { Star } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<any>> = {
  // ... existing icons
  Star,
};
```

## 🔍 **Menu URL Patterns**

### Admin Components
- URL: `/admin/feature-name`
- View ID: `feature-name` (extracted from URL)
- Component: `src/components/admin/FeatureName.tsx`

### Regular Components
- URL: `/feature-name`
- View ID: `feature-name`
- Component: `src/components/FeatureName.tsx`

## 📊 **Permission Levels**

| Permission | Description | Use Case |
|------------|-------------|----------|
| `can_view` | View the menu/page | Basic access |
| `can_edit` | Modify existing data | Edit forms, updates |
| `can_delete` | Remove data | Delete operations |
| `can_create` | Add new data | Create forms, new records |
| `can_export` | Export data | Download reports, CSV exports |
| `can_import` | Import data | Upload files, bulk imports |

## 🚀 **Complete Example: Adding a New Reports Module**

### 1. Add Menu Items
```sql
-- Add parent menu
INSERT INTO menu_items (parent_id, menu_name, menu_url, menu_icon, menu_order, required_role_id) 
VALUES (NULL, 'Reports', '/reports', 'FileText', 5, 0);

-- Add child menus
INSERT INTO menu_items (parent_id, menu_name, menu_url, menu_icon, menu_order, required_role_id) 
VALUES 
(16, 'Daily Reports', '/reports/daily', 'Calendar', 1, 0),
(16, 'Monthly Reports', '/reports/monthly', 'CalendarDays', 2, 0),
(16, 'Custom Reports', '/reports/custom', 'Settings', 3, 1);
```

### 2. Set Permissions
```sql
-- Super Admin - Full access
INSERT INTO menu_permissions (menu_id, role_id, can_view, can_edit, can_delete, can_create, can_export, can_import) VALUES
(16, 0, true, true, true, true, true, true),
(17, 0, true, true, true, true, true, true),
(18, 0, true, true, true, true, true, true),
(19, 0, true, true, true, true, true, true);

-- Admin - Limited access
INSERT INTO menu_permissions (menu_id, role_id, can_view, can_edit, can_delete, can_create, can_export, can_import) VALUES
(16, 1, true, true, false, true, true, false),
(17, 1, true, true, false, true, true, false),
(18, 1, true, true, false, true, true, false),
(19, 1, true, false, false, false, true, false);

-- Regular User - View only
INSERT INTO menu_permissions (menu_id, role_id, can_view, can_edit, can_delete, can_create, can_export, can_import) VALUES
(16, 2, true, false, false, false, true, false),
(17, 2, true, false, false, false, true, false),
(18, 2, true, false, false, false, true, false);
```

### 3. Create Components
```typescript
// src/components/ReportsPanel.tsx
// src/components/DailyReports.tsx
// src/components/MonthlyReports.tsx
// src/components/admin/CustomReports.tsx
```

### 4. Update Dashboard Router
```typescript
case 'reports':
  return <ReportsPanel />;
case 'daily':
  return <DailyReports />;
case 'monthly':
  return <MonthlyReports />;
case 'custom':
  return <CustomReports />;
```

## 🔧 **Troubleshooting**

### Menu Not Showing
1. Check if user role has `can_view` permission
2. Verify `is_active = true` in menu_items
3. Ensure `required_role_id` allows user's role

### Wrong Component Loading
1. Check URL mapping in Dashboard.tsx
2. Verify view ID extraction logic
3. Ensure component import path is correct

### Permission Issues
1. Verify menu_permissions table has correct entries
2. Check role_id matches user's actual role
3. Ensure permission check logic in components

## 📝 **Best Practices**

1. **Consistent Naming**: Use kebab-case for URLs and PascalCase for components
2. **Hierarchical Structure**: Group related features under parent menus
3. **Permission Granularity**: Set appropriate permissions for each role
4. **Icon Consistency**: Use meaningful, consistent icons
5. **Component Organization**: Keep admin components in `/admin` folder
6. **Database Integrity**: Always set proper foreign key relationships

This system provides a flexible, role-based menu management solution that scales with your application needs! 🎯