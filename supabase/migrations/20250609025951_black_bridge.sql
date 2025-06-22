/*
  # Add Admin Menu Items

  1. New Menu Items
    - Administration parent menu
    - User Management submenu
    - Role Permissions submenu
    - Audit Logs submenu
    - System Settings submenu

  2. Enhanced Permissions
    - Add detailed permissions for admin menus
    - Configure role-based access

  3. Menu Structure
    - Hierarchical menu with proper parent-child relationships
    - Proper ordering and icons
*/

-- Insert new admin menu items
INSERT INTO menu_items (id, parent_id, menu_name, menu_url, menu_icon, menu_order, is_active, required_role_id) VALUES
-- Administration parent menu (if not exists)
(10, NULL, 'Administration', '/admin', 'Settings', 4, true, 1),
-- Admin submenus
(11, 10, 'User Management', '/admin/users', 'UserCog', 1, true, 1),
(12, 10, 'Role Permissions', '/admin/permissions', 'Shield', 2, true, 1),
(13, 10, 'Audit Logs', '/admin/logs', 'FileSearch', 3, true, 1),
(14, 10, 'System Settings', '/admin/settings', 'Cog', 4, true, 0)

ON CONFLICT (id) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    menu_name = EXCLUDED.menu_name,
    menu_url = EXCLUDED.menu_url,
    menu_icon = EXCLUDED.menu_icon,
    menu_order = EXCLUDED.menu_order,
    is_active = EXCLUDED.is_active,
    required_role_id = EXCLUDED.required_role_id,
    updated_at = CURRENT_TIMESTAMP;

-- Insert enhanced permissions for admin menus
INSERT INTO menu_permissions (menu_id, role_id, can_view, can_edit, can_delete, can_create, can_export, can_import) VALUES
-- Super Admin (role_id = 0) - Full access to all admin menus
(10, 0, true, true, true, true, true, true),
(11, 0, true, true, true, true, true, true),
(12, 0, true, true, true, true, true, true),
(13, 0, true, true, true, true, true, true),
(14, 0, true, true, true, true, true, true),

-- Admin (role_id = 1) - Limited access to admin menus
(10, 1, true, true, false, false, true, false),
(11, 1, true, true, false, true, true, false),
(12, 1, true, true, false, false, true, false),
(13, 1, true, false, false, false, true, false),
(14, 1, true, false, false, false, false, false)

ON CONFLICT (menu_id, role_id) DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_create = EXCLUDED.can_create,
    can_export = EXCLUDED.can_export,
    can_import = EXCLUDED.can_import,
    updated_at = CURRENT_TIMESTAMP;

-- Update sequence to ensure proper ID generation
SELECT setval('menu_items_id_seq', (SELECT MAX(id) FROM menu_items));

-- Create function to add new menu items easily
CREATE OR REPLACE FUNCTION add_menu_item(
    p_parent_id INTEGER,
    p_menu_name VARCHAR(100),
    p_menu_url VARCHAR(255),
    p_menu_icon VARCHAR(50),
    p_menu_order INTEGER,
    p_required_role_id INTEGER DEFAULT 0,
    p_is_active BOOLEAN DEFAULT true
) RETURNS INTEGER AS $$
DECLARE
    new_menu_id INTEGER;
BEGIN
    INSERT INTO menu_items (parent_id, menu_name, menu_url, menu_icon, menu_order, is_active, required_role_id)
    VALUES (p_parent_id, p_menu_name, p_menu_url, p_menu_icon, p_menu_order, p_is_active, p_required_role_id)
    RETURNING id INTO new_menu_id;
    
    RETURN new_menu_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to add menu permissions for a role
CREATE OR REPLACE FUNCTION add_menu_permission(
    p_menu_id INTEGER,
    p_role_id INTEGER,
    p_can_view BOOLEAN DEFAULT false,
    p_can_edit BOOLEAN DEFAULT false,
    p_can_delete BOOLEAN DEFAULT false,
    p_can_create BOOLEAN DEFAULT false,
    p_can_export BOOLEAN DEFAULT false,
    p_can_import BOOLEAN DEFAULT false
) RETURNS VOID AS $$
BEGIN
    INSERT INTO menu_permissions (menu_id, role_id, can_view, can_edit, can_delete, can_create, can_export, can_import)
    VALUES (p_menu_id, p_role_id, p_can_view, p_can_edit, p_can_delete, p_can_create, p_can_export, p_can_import)
    ON CONFLICT (menu_id, role_id) DO UPDATE SET
        can_view = EXCLUDED.can_view,
        can_edit = EXCLUDED.can_edit,
        can_delete = EXCLUDED.can_delete,
        can_create = EXCLUDED.can_create,
        can_export = EXCLUDED.can_export,
        can_import = EXCLUDED.can_import,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Example usage of helper functions:
-- Add a new menu item:
-- SELECT add_menu_item(10, 'New Admin Feature', '/admin/new-feature', 'Star', 5, 1);

-- Add permissions for the new menu:
-- SELECT add_menu_permission(15, 0, true, true, true, true, true, true); -- Super Admin
-- SELECT add_menu_permission(15, 1, true, true, false, false, true, false); -- Admin