/*
  # User Onboarding System

  1. New Tables
    - `profiles` table for user management
    - `user_activity_logs` table for audit logging
    - `system_settings` table for configuration

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access

  3. Functions
    - User onboarding function
    - Activity logging function
*/

-- Create profiles table (user master table)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  email_id text NOT NULL UNIQUE,
  email_verified boolean DEFAULT false,
  phone_number text,
  phone_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  last_login timestamptz,
  last_password_change timestamptz,
  login_attempts smallint DEFAULT 0,
  account_locked boolean DEFAULT false,
  account_locked_until timestamptz,
  active_flag boolean DEFAULT true NOT NULL,
  role_id int NOT NULL DEFAULT 2,
  timezone text DEFAULT 'UTC',
  locale text DEFAULT 'en-US',
  mfa_enabled boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id)
);

-- Create user activity logs table
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  admin_user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  timestamp timestamptz DEFAULT now() NOT NULL,
  reason text
);

-- Create system settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role_id IN (0, 1)
    )
  );

CREATE POLICY "Admins can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role_id IN (0, 1)
    )
  );

CREATE POLICY "Admins can update profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role_id IN (0, 1)
    )
  );

-- Create policies for user activity logs
CREATE POLICY "Admins can read activity logs"
  ON user_activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role_id IN (0, 1)
    )
  );

CREATE POLICY "Admins can insert activity logs"
  ON user_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role_id IN (0, 1)
    )
  );

-- Create policies for system settings
CREATE POLICY "Admins can manage system settings"
  ON system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role_id IN (0, 1)
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(active_flag);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_admin ON user_activity_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON user_activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id uuid,
  p_admin_user_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO user_activity_logs (
    user_id,
    admin_user_id,
    action,
    target_type,
    target_id,
    old_values,
    new_values,
    reason
  ) VALUES (
    p_user_id,
    p_admin_user_id,
    p_action,
    p_target_type,
    p_target_id,
    p_old_values,
    p_new_values,
    p_reason
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to onboard new user
CREATE OR REPLACE FUNCTION onboard_user(
  p_username text,
  p_full_name text,
  p_email_id text,
  p_phone_number text DEFAULT NULL,
  p_role_id int DEFAULT 2,
  p_admin_user_id uuid DEFAULT NULL,
  p_source_user_id text DEFAULT NULL,
  p_manual_entry boolean DEFAULT false
) RETURNS jsonb AS $$
DECLARE
  new_user_id uuid;
  result jsonb;
BEGIN
  -- Check if username or email already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE username = p_username OR email_id = p_email_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Username or email already exists'
    );
  END IF;
  
  -- Insert new user
  INSERT INTO profiles (
    username,
    full_name,
    email_id,
    phone_number,
    role_id,
    created_by
  ) VALUES (
    p_username,
    p_full_name,
    p_email_id,
    p_phone_number,
    p_role_id,
    p_admin_user_id
  ) RETURNING id INTO new_user_id;
  
  -- Log the activity
  PERFORM log_user_activity(
    new_user_id,
    p_admin_user_id,
    'user_onboarded',
    'user',
    new_user_id::text,
    NULL,
    jsonb_build_object(
      'username', p_username,
      'full_name', p_full_name,
      'email_id', p_email_id,
      'role_id', p_role_id,
      'source_user_id', p_source_user_id,
      'manual_entry', p_manual_entry
    ),
    'User onboarded through admin panel'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'User onboarded successfully',
    'user_id', new_user_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error onboarding user: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample admin user
INSERT INTO profiles (
  id,
  username,
  full_name,
  email_id,
  role_id,
  active_flag
) VALUES (
  gen_random_uuid(),
  'admin',
  'System Administrator',
  'admin@company.com',
  1,
  true
) ON CONFLICT (username) DO NOTHING;

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('master_live_enabled', 'true', 'Master toggle for live updates across the system'),
('session_timeout', '3600', 'Session timeout in seconds'),
('max_login_attempts', '5', 'Maximum login attempts before account lock'),
('password_expiry_days', '90', 'Password expiry period in days')
ON CONFLICT (setting_key) DO NOTHING;

-- Add menu item for User Onboarding
INSERT INTO menu_items (parent_id, menu_name, menu_url, menu_icon, menu_order, is_active, required_role_id) 
VALUES (
  (SELECT id FROM menu_items WHERE menu_name = 'Administration' AND parent_id IS NULL),
  'User Onboarding',
  '/admin/onboarding',
  'UserPlus',
  2,
  true,
  1
) ON CONFLICT DO NOTHING;

-- Add permissions for User Onboarding menu
INSERT INTO menu_permissions (menu_id, role_id, can_view, can_edit, can_delete, can_create, can_export, can_import) 
SELECT 
  m.id,
  0,
  true,
  true,
  true,
  true,
  true,
  true
FROM menu_items m 
WHERE m.menu_name = 'User Onboarding' AND m.menu_url = '/admin/onboarding'
ON CONFLICT (menu_id, role_id) DO NOTHING;

INSERT INTO menu_permissions (menu_id, role_id, can_view, can_edit, can_delete, can_create, can_export, can_import) 
SELECT 
  m.id,
  1,
  true,
  true,
  false,
  true,
  true,
  false
FROM menu_items m 
WHERE m.menu_name = 'User Onboarding' AND m.menu_url = '/admin/onboarding'
ON CONFLICT (menu_id, role_id) DO NOTHING;