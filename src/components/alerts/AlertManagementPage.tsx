import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import PermissionGuard from '../PermissionGuard';
import { Shield } from 'lucide-react';
import AlertManagementTable from './AlertManagementTable';

const AlertManagementPage: React.FC = () => {
  const { theme } = useTheme();
  const { getMenuId } = useMenuIds();
  
  // Get menu ID for permission check
  const ALERTS_MANAGEMENT_MENU_ID = getMenuId('alerts_management');
  
  return (
    <PermissionGuard
      menuId={ALERTS_MANAGEMENT_MENU_ID}
      action="view"
      fallback={
        <div className={`text-center py-20 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view alert management.</p>
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <AlertManagementTable />
      </motion.div>
    </PermissionGuard>
  );
};

export default AlertManagementPage;