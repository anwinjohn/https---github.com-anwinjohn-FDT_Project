-- PostgreSQL table structure for menu system

-- Create menu table
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    menu_name VARCHAR(100) NOT NULL,
    menu_url VARCHAR(255) NOT NULL,
    menu_icon VARCHAR(50) NOT NULL,
    menu_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    required_role_id INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create menu permissions table for fine-grained access control
CREATE TABLE IF NOT EXISTS menu_permissions (
    id SERIAL PRIMARY KEY,
    menu_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT false,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(menu_id, role_id)
);

-- Insert sample menu data
INSERT INTO menu_items (id, parent_id, menu_name, menu_url, menu_icon, menu_order, is_active, required_role_id) VALUES
(1, NULL, 'Dashboard', '/dashboard', 'LayoutDashboard', 1, true, 0),
(2, NULL, 'Analytics', '/analytics', 'BarChart3', 2, true, 0),
(3, 2, 'Alert Rules', '/analytics/rules', 'AlertTriangle', 1, true, 0),
(4, 2, 'User Analysis', '/analytics/users', 'Users', 2, true, 0),
(5, 2, 'Branch Analysis', '/analytics/branches', 'Building', 3, true, 0),
(6, 2, 'Trend Analysis', '/analytics/trends', 'TrendingUp', 4, true, 0),
(7, NULL, 'Reports', '/reports', 'FileText', 3, true, 0),
(8, 7, 'Daily Reports', '/reports/daily', 'Calendar', 1, true, 0),
(9, 7, 'Monthly Reports', '/reports/monthly', 'CalendarDays', 2, true, 0),
(10, NULL, 'Administration', '/admin', 'Settings', 4, true, 1),
(11, 10, 'User Management', '/admin/users', 'UserCog', 1, true, 1),
(12, 10, 'System Settings', '/admin/settings', 'Cog', 2, true, 1),
(13, 10, 'Audit Logs', '/admin/logs', 'FileSearch', 3, true, 1);

-- Insert sample permissions
INSERT INTO menu_permissions (menu_id, role_id, can_view, can_edit, can_delete) VALUES
-- Super Admin (role_id = 0) - Full access to all menus
(1, 0, true, true, true),
(2, 0, true, true, true),
(3, 0, true, true, true),
(4, 0, true, true, true),
(5, 0, true, true, true),
(6, 0, true, true, true),
(7, 0, true, true, true),
(8, 0, true, true, true),
(9, 0, true, true, true),
(10, 0, true, true, true),
(11, 0, true, true, true),
(12, 0, true, true, true),
(13, 0, true, true, true),

-- Admin (role_id = 1) - Access to most menus except some admin functions
(1, 1, true, true, false),
(2, 1, true, true, false),
(3, 1, true, true, false),
(4, 1, true, true, false),
(5, 1, true, true, false),
(6, 1, true, true, false),
(7, 1, true, true, false),
(8, 1, true, true, false),
(9, 1, true, true, false),
(10, 1, true, false, false),
(11, 1, true, false, false),
(12, 1, true, false, false),
(13, 1, true, false, false),

-- Regular User (role_id = 2) - Limited access
(1, 2, true, false, false),
(2, 2, true, false, false),
(3, 2, true, false, false),
(4, 2, true, false, false),
(5, 2, true, false, false),
(6, 2, true, false, false),
(7, 2, true, false, false),
(8, 2, true, false, false),
(9, 2, true, false, false);

-- Query to get menu items for a specific user role
-- This query returns hierarchical menu structure based on user role
WITH RECURSIVE menu_tree AS (
    -- Base case: get root menu items
    SELECT 
        m.id,
        m.parent_id,
        m.menu_name,
        m.menu_url,
        m.menu_icon,
        m.menu_order,
        m.is_active,
        m.required_role_id,
        0 as level,
        ARRAY[m.menu_order] as sort_path
    FROM menu_items m
    LEFT JOIN menu_permissions mp ON m.id = mp.menu_id AND mp.role_id = $1 -- User's role_id parameter
    WHERE m.parent_id IS NULL 
    AND m.is_active = true
    AND (m.required_role_id <= $1 OR (mp.can_view = true))
    
    UNION ALL
    
    -- Recursive case: get child menu items
    SELECT 
        m.id,
        m.parent_id,
        m.menu_name,
        m.menu_url,
        m.menu_icon,
        m.menu_order,
        m.is_active,
        m.required_role_id,
        mt.level + 1,
        mt.sort_path || m.menu_order
    FROM menu_items m
    INNER JOIN menu_tree mt ON m.parent_id = mt.id
    LEFT JOIN menu_permissions mp ON m.id = mp.menu_id AND mp.role_id = $1
    WHERE m.is_active = true
    AND (m.required_role_id <= $1 OR (mp.can_view = true))
)
SELECT 
    id,
    parent_id,
    menu_name,
    menu_url,
    menu_icon,
    menu_order,
    is_active,
    required_role_id,
    level
FROM menu_tree
ORDER BY sort_path;

-- Alternative simpler query for getting user menu items
SELECT 
    m.id,
    m.parent_id,
    m.menu_name,
    m.menu_url,
    m.menu_icon,
    m.menu_order,
    m.is_active,
    m.required_role_id
FROM menu_items m
LEFT JOIN menu_permissions mp ON m.id = mp.menu_id AND mp.role_id = $1
WHERE m.is_active = true
AND (m.required_role_id <= $1 OR (mp.can_view = true))
ORDER BY m.parent_id NULLS FIRST, m.menu_order;