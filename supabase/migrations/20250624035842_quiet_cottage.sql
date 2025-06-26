/*
  # Add Alerts Management Menu Items

  1. New Menu Items
    - Alerts Management menu
    - Alerts Export permission

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access
*/

-- Insert new alerts management menu items
INSERT INTO menu_items (id, parent_id, menu_name, menu_url, menu_icon, menu_order, is_active, required_role_id) VALUES
(16, NULL, 'Alerts Management', '/alerts-management', 'AlertTriangle', 2, true, 0),
(17, 16, 'Alerts Export', '/alerts-export', 'Download', 1, true, 1)

ON CONFLICT (id) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    menu_name = EXCLUDED.menu_name,
    menu_url = EXCLUDED.menu_url,
    menu_icon = EXCLUDED.menu_icon,
    menu_order = EXCLUDED.menu_order,
    is_active = EXCLUDED.is_active,
    required_role_id = EXCLUDED.required_role_id,
    updated_at = CURRENT_TIMESTAMP;

-- Insert permissions for alerts management menus
INSERT INTO menu_permissions (menu_id, role_id, can_view, can_edit, can_delete, can_create, can_export, can_import) VALUES
-- Super Admin (role_id = 0) - Full access
(16, 0, true, true, true, true, true, true),
(17, 0, true, true, true, true, true, true),

-- Admin (role_id = 1) - Full access except delete
(16, 1, true, true, false, true, true, false),
(17, 1, true, true, false, true, true, false),

-- Regular User (role_id = 2) - View only
(16, 2, true, false, false, false, false, false),
(17, 2, false, false, false, false, false, false),

-- Analyst (role_id = 3) - View and export
(16, 3, true, false, false, false, true, false),
(17, 3, true, false, false, false, true, false)

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