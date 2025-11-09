import React, { useState } from 'react';
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
import UserManagement from './UserManagement';
import RoleMenuPermissions from './RoleMenuPermissions';
import UserOnboarding from './UserOnboarding';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      description: 'Manage user accounts and permissions'
    },
    {
      id: 'onboarding',
      label: 'User Onboarding',
      icon: UserPlus,
      description: 'Add new users to the system'
    },
    {
      id: 'permissions',
      label: 'Role Permissions',
      icon: Shield,
      description: 'Configure role-based menu access'
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      icon: FileText,
      description: 'View system activity logs'
    },
    {
      id: 'settings',
      label: 'System Settings',
      icon: Settings,
      description: 'Configure system parameters'
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement/>;
      case 'onboarding':
        return <UserOnboarding />;
      case 'permissions':
        return <RoleMenuPermissions />;
      case 'audit':
        return (
          <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 p-8 min-h-[500px]">
            <div className="text-center py-20">
              <div className="p-6 bg-white/10 rounded-2xl inline-block mb-6">
                <FileText className="w-12 h-12 text-blue-400 mx-auto" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Audit Logs</h2>
              <p className="text-white/60 max-w-md mx-auto">
                Comprehensive audit logging system to track all administrative actions and system changes.
              </p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 p-8 min-h-[500px]">
            <div className="text-center py-20">
              <div className="p-6 bg-white/10 rounded-2xl inline-block mb-6">
                <Settings className="w-12 h-12 text-purple-400 mx-auto" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">System Settings</h2>
              <p className="text-white/60 max-w-md mx-auto">
                Configure system-wide settings, security policies, and application parameters.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 p-2">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-3 p-4 rounded-lg transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-white shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${
                activeTab === tab.id ? 'text-blue-400' : 'text-white/60'
              }`} />
              <div className="text-left">
                <div className="font-medium text-sm">{tab.label}</div>
                <div className="text-xs text-white/50">{tab.description}</div>
              </div>
            </motion.button>
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

export default AdminDashboard;