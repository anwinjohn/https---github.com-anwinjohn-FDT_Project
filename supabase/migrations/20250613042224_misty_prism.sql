/*
  # Secure Menu System Implementation

  1. Enhanced Tables
    - Updated menu_items table with security features
    - Enhanced menu_permissions table with detailed access control
    - Added audit logging for menu changes

  2. Security Features
    - Row Level Security (RLS) enabled
    - Role-based access control
    - Audit trail for all changes

  3. Functions
    - Secure menu retrieval functions
    - Permission validation functions
    - Audit logging functions
*/

-- Create enhanced menu_items table if not exists
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID
);

-- Create enhanced menu_permissions table if not exists
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
    created_by UUID,
    updated_by UUID,
    UNIQUE(menu_id, role_id)
);

-- Create menu audit log table
CREATE TABLE IF NOT EXISTS menu_audit_logs (
    id SERIAL PRIMARY KEY,
    menu_id INTEGER,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Enable RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for menu_items
CREATE POLICY "Anyone can view active menu items"
  ON menu_items
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage menu items"
  ON menu_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = id 
      AND raw_user_meta_data->>'role_id' IN ('0', '1')
    )
  );

-- Create policies for menu_permissions
CREATE POLICY "Users can view their role permissions"
  ON menu_permissions
  FOR SELECT
  USING (
    role_id::text = (
      SELECT raw_user_meta_data->>'role_id' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all permissions"
  ON menu_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = id 
      AND raw_user_meta_data->>'role_id' IN ('0', '1')
    )
  );

-- Create policies for audit logs
CREATE POLICY "Admins can view audit logs"
  ON menu_audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = id 
      AND raw_user_meta_data->>'role_id' IN ('0', '1')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_items_parent_active ON menu_items(parent_id, is_active);
CREATE INDEX IF NOT EXISTS idx_menu_items_role_order ON menu_items(required_role_id, menu_order);
CREATE INDEX IF NOT EXISTS idx_menu_permissions_role_menu ON menu_permissions(role_id, menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_permissions_view ON menu_permissions(role_id, can_view) WHERE can_view = true;
CREATE INDEX IF NOT EXISTS idx_menu_audit_menu_time ON menu_audit_logs(menu_id, changed_at);

-- Function to get secure menu for a role
CREATE OR REPLACE FUNCTION get_secure_menu_for_role(p_role_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    parent_id INTEGER,
    menu_name VARCHAR(100),
    menu_url VARCHAR(255),
    menu_icon VARCHAR(50),
    menu_order INTEGER,
    is_active BOOLEAN,
    required_role_id INTEGER,
    level INTEGER,
    can_view BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    can_create BOOLEAN,
    can_export BOOLEAN,
    can_import BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
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
            COALESCE(mp.can_view, m.required_role_id <= p_role_id) as can_view,
            COALESCE(mp.can_edit, false) as can_edit,
            COALESCE(mp.can_delete, false) as can_delete,
            COALESCE(mp.can_create, false) as can_create,
            COALESCE(mp.can_export, false) as can_export,
            COALESCE(mp.can_import, false) as can_import
        FROM menu_items m
        LEFT JOIN menu_permissions mp ON m.id = mp.menu_id AND mp.role_id = p_role_id
        WHERE m.parent_id IS NULL 
        AND m.is_active = true
        AND (m.required_role_id <= p_role_id OR COALESCE(mp.can_view, false) = true)
        
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
            COALESCE(mp.can_view, m.required_role_id <= p_role_id) as can_view,
            COALESCE(mp.can_edit, false) as can_edit,
            COALESCE(mp.can_delete, false) as can_delete,
            COALESCE(mp.can_create, false) as can_create,
            COALESCE(mp.can_export, false) as can_export,
            COALESCE(mp.can_import, false) as can_import
        FROM menu_items m
        INNER JOIN menu_tree mt ON m.parent_id = mt.id
        LEFT JOIN menu_permissions mp ON m.id = mp.menu_id AND mp.role_id = p_role_id
        WHERE m.is_active = true
        AND (m.required_role_id <= p_role_id OR COALESCE(mp.can_view, false) = true)
    )
    SELECT 
        mt.id,
        mt.parent_id,
        mt.menu_name,
        mt.menu_url,
        mt.menu_icon,
        mt.menu_order,
        mt.is_active,
        mt.required_role_id,
        mt.level,
        mt.can_view,
        mt.can_edit,
        mt.can_delete,
        mt.can_create,
        mt.can_export,
        mt.can_import
    FROM menu_tree mt
    WHERE mt.can_view = true
    ORDER BY mt.level, mt.menu_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check specific permission
CREATE OR REPLACE FUNCTION check_menu_permission_secure(
    p_menu_id INTEGER,
    p_role_id INTEGER,
    p_permission_type VARCHAR(20)
) RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := false;
    menu_required_role INTEGER;
BEGIN
    -- Get menu required role
    SELECT required_role_id INTO menu_required_role
    FROM menu_items 
    WHERE id = p_menu_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check explicit permission first
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
    FROM menu_permissions mp
    WHERE mp.menu_id = p_menu_id AND mp.role_id = p_role_id;
    
    -- If explicit permission found, return it
    IF FOUND AND has_permission THEN
        RETURN true;
    END IF;
    
    -- For view permission, check role hierarchy
    IF p_permission_type = 'view' AND menu_required_role <= p_role_id THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log menu changes
CREATE OR REPLACE FUNCTION log_menu_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO menu_audit_logs (
        menu_id,
        action,
        old_values,
        new_values,
        changed_by,
        changed_at
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
        auth.uid(),
        NOW()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for audit logging
DROP TRIGGER IF EXISTS menu_items_audit_trigger ON menu_items;
CREATE TRIGGER menu_items_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION log_menu_change();

DROP TRIGGER IF EXISTS menu_permissions_audit_trigger ON menu_permissions;
CREATE TRIGGER menu_permissions_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON menu_permissions
    FOR EACH ROW EXECUTE FUNCTION log_menu_change();

-- Insert secure menu structure
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
(12, 10, 'Role Permissions', '/admin/permissions', 'Shield', 2, true, 1),
(13, 10, 'Audit Logs', '/admin/logs', 'FileSearch', 3, true, 1),
(14, 10, 'System Settings', '/admin/settings', 'Cog', 4, true, 0),
(15, 10, 'User Onboarding', '/admin/onboarding', 'UserPlus', 5, true, 1)
ON CONFLICT (id) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    menu_name = EXCLUDED.menu_name,
    menu_url = EXCLUDED.menu_url,
    menu_icon = EXCLUDED.menu_icon,
    menu_order = EXCLUDED.menu_order,
    is_active = EXCLUDED.is_active,
    required_role_id = EXCLUDED.required_role_id,
    updated_at = CURRENT_TIMESTAMP;

-- Insert comprehensive permissions
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
(14, 0, true, true, true, true, true, true),
(15, 0, true, true, true, true, true, true),

-- Admin (role_id = 1) - Limited access
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
(11, 1, true, true, false, true, true, false),
(12, 1, true, true, false, false, true, false),
(13, 1, true, false, false, false, true, false),
(14, 1, true, false, false, false, false, false),
(15, 1, true, true, false, true, true, false),

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

-- Analyst (role_id = 3) - Enhanced access to analytics
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

-- Update sequence
SELECT setval('menu_items_id_seq', (SELECT MAX(id) FROM menu_items));