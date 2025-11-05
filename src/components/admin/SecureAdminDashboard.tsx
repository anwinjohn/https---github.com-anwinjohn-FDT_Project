import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Shield, 
  FileText, 
  Activity,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Eye,
  Settings,
  UserPlus
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import PermissionGuard from '../PermissionGuard';
import SecureUserManagement from './SecureUserManagement';
import SecureRoleMenuPermissions from './SecureRoleMenuPermissions';
import SecureUserOnboarding from './SecureUserOnboarding';

interface SecureAdminDashboardProps {
  initialTab?: string;
}

const SecureAdminDashboard: React.FC<SecureAdminDashboardProps> = ({ initialTab }) => {
  const { theme } = useTheme();
  const { getMenuId, loading: menuIdsLoading } = useMenuIds();

  // Get menu IDs dynamically
  const USER_MANAGEMENT_MENU_ID = getMenuId('user_management');
  const USER_ONBOARDING_MENU_ID = getMenuId('user_onboarding');
  const ROLE_PERMISSIONS_MENU_ID = getMenuId('role_permissions');
  const AUDIT_LOGS_MENU_ID = getMenuId('audit_logs');
  const SYSTEM_SETTINGS_MENU_ID = getMenuId('system_settings');

  const tabs = [
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      description: 'Manage user accounts and permissions',
      menuId: USER_MANAGEMENT_MENU_ID,
      requiredAction: 'view' as const
    },
    {
      id: 'onboarding',
      label: 'User Onboarding',
      icon: UserPlus,
      description: 'Add new users to the system',
      menuId: USER_ONBOARDING_MENU_ID,
      requiredAction: 'view' as const
    },
    {
      id: 'permissions',
      label: 'Role Permissions',
      icon: Shield,
      description: 'Configure role-based menu access',
      menuId: ROLE_PERMISSIONS_MENU_ID,
      requiredAction: 'view' as const
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      icon: FileText,
      description: 'View system activity logs',
      menuId: AUDIT_LOGS_MENU_ID,
      requiredAction: 'view' as const
    },
    {
      id: 'settings',
      label: 'System Settings',
      icon: Settings,
      description: 'Configure system parameters',
      menuId: SYSTEM_SETTINGS_MENU_ID,
      requiredAction: 'view' as const
    }
  ];

  // Initialize activeTab based on initialTab prop
  const [activeTab, setActiveTab] = useState(() => {
    const validTabIds = tabs.map(tab => tab.id);
    if (initialTab && validTabIds.includes(initialTab)) {
      return initialTab;
    }
    return 'users'; // Default tab
  });

  // Update activeTab when initialTab prop changes
useEffect(() => {
  if (!menuIdsLoading) { // Ensure menu IDs are loaded before setting initial tab
    const validTabIds = tabs.map(tab => tab.id);
    if (initialTab && validTabIds.includes(initialTab)) {
      setActiveTab(initialTab);
    } else if (initialTab === 'admin') {
      setActiveTab('users');
    }
  }
}, [initialTab, menuIdsLoading]); // Removed 'tabs' from dependencies


  // Show loading while menu IDs are being fetched
  if (menuIdsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${
          theme === 'dark' ? 'border-white' : 'border-gray-900'
        }`}></div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <SecureUserManagement />;
      case 'onboarding':
        return <SecureUserOnboarding />;
      case 'permissions':
        return <SecureRoleMenuPermissions />;
      case 'audit':
        return (
          <PermissionGuard 
            menuId={AUDIT_LOGS_MENU_ID} 
            action="view"
            fallback={
              <div className={`text-center py-20 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p className="text-gray-500">You don't have permission to view audit logs.</p>
              </div>
            }
          >
            <div className={`rounded-xl border p-8 min-h-[500px] ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/20' 
                : 'bg-white border-gray-200'
            } backdrop-blur-xl`}>
              <div className="text-center py-20">
                <div className={`p-6 rounded-2xl inline-block mb-6 border ${
                  theme === 'dark' 
                    ? 'bg-white/10 border-white/20' 
                    : 'bg-gray-100 border-gray-300'
                }`}>
                  <FileText className="w-12 h-12 text-blue-400 mx-auto" />
                </div>
                <h2 className={`text-2xl font-bold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Secure Audit Logs</h2>
                <p className={`max-w-md mx-auto ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>
                  Comprehensive audit logging system to track all administrative actions and system changes with enhanced security.
                </p>
              </div>
            </div>
          </PermissionGuard>
        );
      case 'settings':
        return (
          <PermissionGuard 
            menuId={SYSTEM_SETTINGS_MENU_ID} 
            action="view"
            fallback={
              <div className={`text-center py-20 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p className="text-gray-500">You don't have permission to view system settings.</p>
              </div>
            }
          >
            <div className={`rounded-xl border p-8 min-h-[500px] ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/20' 
                : 'bg-white border-gray-200'
            } backdrop-blur-xl`}>
              <div className="text-center py-20">
                <div className={`p-6 rounded-2xl inline-block mb-6 border ${
                  theme === 'dark' 
                    ? 'bg-white/10 border-white/20' 
                    : 'bg-gray-100 border-gray-300'
                }`}>
                  <Settings className="w-12 h-12 text-purple-400 mx-auto" />
                </div>
                <h2 className={`text-2xl font-bold mb-4 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Secure System Settings</h2>
                <p className={`max-w-md mx-auto ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>
                  Configure system-wide settings, security policies, and application parameters with role-based access control.
                </p>
              </div>
            </div>
          </PermissionGuard>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className={`rounded-xl border p-2 ${
        theme === 'dark' 
          ? 'bg-white/5 border-white/20' 
          : 'bg-gray-50 border-gray-200'
      } backdrop-blur-xl`}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {tabs.map((tab) => (
            <PermissionGuard
              key={tab.id}
              menuId={tab.menuId}
              action={tab.requiredAction}
              fallback={
                <div className={`flex items-center gap-3 p-4 rounded-lg opacity-50 cursor-not-allowed ${
                  theme === 'dark' ? 'text-white/30' : 'text-gray-400'
                }`}>
                  <tab.icon className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium text-sm">{tab.label}</div>
                    <div className="text-xs">No access</div>
                  </div>
                </div>
              }
            >
              <motion.button
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-3 p-4 rounded-lg transition-all duration-200 w-full text-left ${
                  activeTab === tab.id
                    ? theme === 'dark'
                      ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-white shadow-lg'
                      : 'bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-300 text-blue-700 shadow-lg'
                    : theme === 'dark'
                      ? 'text-white/70 hover:text-white hover:bg-white/5'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className={`w-5 h-5 ${
                  activeTab === tab.id 
                    ? 'text-blue-400' 
                    : theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                }`} />
                <div className="text-left">
                  <div className="font-medium text-sm">{tab.label}</div>
                  <div className={`text-xs ${
                    theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                  }`}>{tab.description}</div>
                </div>
              </motion.button>
            </PermissionGuard>
          ))}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderContent()}
      </motion.div>
    </div>
  );
};

export default SecureAdminDashboard;