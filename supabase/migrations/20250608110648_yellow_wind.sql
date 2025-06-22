-- Enhanced PostgreSQL table structure for menu system with detailed permissions

-- Create menu table (if not exists)
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

-- Enhanced menu permissions table with detailed access control
CREATE TABLE IF NOT EXISTS menu_permissions (
    id SERIAL PRIMARY KEY,
    menu_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_menu_items_parent_id ON menu_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active_role ON menu_items(is_active, required_role_id);
CREATE INDEX IF NOT EXISTS idx_menu_permissions_role_menu ON menu_permissions(role_id, menu_id);

-- Insert enhanced permissions data
INSERT INTO menu_permissions (menu_id, role_id, can_view, can_edit, can_delete, can_create, can_export, can_import) VALUES
-- Super Admin (role_id = 0) - Full access to all menus
(1, 0, true, true, true, true, true, true),
(2, 0, true, true, true, true, true, true),
(3, 0, true, true, true, true, true, true),
(4, 0, true, true, true, true, true, true),
(5, 0, true, true, true, true, true, true),
(6, 0, true, true, true, true, true, true),
(7, 0, true, true, true, true, true, true),
(8, 0, true, true, true, true, true, true),
(9, 0, true, true, true, true, true, true),
(10, 0, true, true, true, true, true, true),
(11, 0, true, true, true, true, true, true),
(12, 0, true, true, true, true, true, true),
(13, 0, true, true, true, true, true, true),

-- Admin (role_id = 1) - Access to most menus with limited permissions
(1, 1, true, true, false, true, true, false),
(2, 1, true, true, false, true, true, false),
(3, 1, true, true, false, true, true, false),
(4, 1, true, true, false, true, true, false),
(5, 1, true, true, false, true, true, false),
(6, 1, true, true, false, true, true, false),
(7, 1, true, true, false, true, true, false),
(8, 1, true, true, false, true, true, false),
(9, 1, true, true, false, true, true, false),
(10, 1, true, false, false, false, false, false),
(11, 1, true, false, false, false, false, false),
(12, 1, true, false, false, false, false, false),
(13, 1, true, false, false, false, false, false),

-- Regular User (role_id = 2) - View only access to basic features
(1, 2, true, false, false, false, true, false),
(2, 2, true, false, false, false, true, false),
(3, 2, true, false, false, false, true, false),
(4, 2, true, false, false, false, true, false),
(5, 2, true, false, false, false, true, false),
(6, 2, true, false, false, false, true, false),
(7, 2, true, false, false, false, true, false),
(8, 2, true, false, false, false, true, false),
(9, 2, true, false, false, false, true, false),

-- Analyst (role_id = 3) - Enhanced view and limited edit access
(1, 3, true, false, false, false, true, false),
(2, 3, true, true, false, false, true, false),
(3, 3, true, true, false, false, true, false),
(4, 3, true, true, false, false, true, false),
(5, 3, true, true, false, false, true, false),
(6, 3, true, true, false, false, true, false),
(7, 3, true, true, false, true, true, false),
(8, 3, true, true, false, true, true, false),
(9, 3, true, true, false, true, true, false)

ON CONFLICT (menu_id, role_id) DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_create = EXCLUDED.can_create,
    can_export = EXCLUDED.can_export,
    can_import = EXCLUDED.can_import,
    updated_at = CURRENT_TIMESTAMP;

-- Enhanced query to get menu items with permissions for a specific user role
-- Usage: Replace $1 with the user's role_id
WITH RECURSIVE menu_tree AS (
    -- Base case: get root menu items with permissions
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
        ARRAY[m.menu_order] as sort_path,
        COALESCE(mp.can_view, false) as can_view,
        COALESCE(mp.can_edit, false) as can_edit,
        COALESCE(mp.can_delete, false) as can_delete,
        COALESCE(mp.can_create, false) as can_create,
        COALESCE(mp.can_export, false) as can_export,
        COALESCE(mp.can_import, false) as can_import
    FROM menu_items m
    LEFT JOIN menu_permissions mp ON m.id = mp.menu_id AND mp.role_id = $1
    WHERE m.parent_id IS NULL 
    AND m.is_active = true
    AND (m.required_role_id <= $1 OR COALESCE(mp.can_view, false) = true)
    
    UNION ALL
    
    -- Recursive case: get child menu items with permissions
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
        mt.sort_path || m.menu_order,
        COALESCE(mp.can_view, false) as can_view,
        COALESCE(mp.can_edit, false) as can_edit,
        COALESCE(mp.can_delete, false) as can_delete,
        COALESCE(mp.can_create, false) as can_create,
        COALESCE(mp.can_export, false) as can_export,
        COALESCE(mp.can_import, false) as can_import
    FROM menu_items m
    INNER JOIN menu_tree mt ON m.parent_id = mt.id
    LEFT JOIN menu_permissions mp ON m.id = mp.menu_id AND mp.role_id = $1
    WHERE m.is_active = true
    AND (m.required_role_id <= $1 OR COALESCE(mp.can_view, false) = true)
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
    level,
    can_view,
    can_edit,
    can_delete,
    can_create,
    can_export,
    can_import
FROM menu_tree
ORDER BY sort_path;

-- Function to check specific permission for a user
CREATE OR REPLACE FUNCTION check_menu_permission(
    p_menu_id INTEGER,
    p_role_id INTEGER,
    p_permission_type VARCHAR(20)
) RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := false;
BEGIN
    -- Check if user has the specific permission
    SELECT 
        CASE p_permission_type
            WHEN 'view' THEN COALESCE(mp.can_view, false)
            WHEN 'edit' THEN COALESCE(mp.can_edit, false)
            WHEN 'delete' THEN COALESCE(mp.can_delete, false)
            WHEN 'create' THEN COALESCE(mp.can_create, false)
            WHEN 'export' THEN COALESCE(mp.can_export, false)
            WHEN 'import' THEN COALESCE(mp.can_import, false)
            ELSE false
        END INTO has_permission
    FROM menu_items m
    LEFT JOIN menu_permissions mp ON m.id = mp.menu_id AND mp.role_id = p_role_id
    WHERE m.id = p_menu_id;
    
    -- If no explicit permission found, check if user role meets minimum requirement
    IF NOT has_permission THEN
        SELECT (m.required_role_id <= p_role_id) INTO has_permission
        FROM menu_items m
        WHERE m.id = p_menu_id;
    END IF;
    
    RETURN COALESCE(has_permission, false);
END;
$$ LANGUAGE plpgsql;

-- Example usage of the permission check function:
-- SELECT check_menu_permission(1, 1, 'view');  -- Check if role_id 1 can view menu_id 1
-- SELECT check_menu_permission(11, 2, 'edit'); -- Check if role_id 2 can edit menu_id 11