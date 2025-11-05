import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Filter,
  MoreVertical,
  UserCheck,
  UserX,
  Unlock,
  RotateCcw,
  Shield,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  User as UserIcon,
  X,
  Save,
  Mail,
  Key,
  Loader2,
} from 'lucide-react';
import { User, Role, UserAction, UserSearchFilters, PaginationInfo, UserFilterOptions } from '../../types/admin';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../notifications';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';
import { cos } from 'three/tsl';

const SecureUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: UserAction; user: User } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit user modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState({
    username: '',
    email_id: '',
    full_name: '',
    role_id: 0
  });

  // const [filters, setFilters] = useState<UserSearchFilters>({
  //   search: '',
  //   role_id: null,
  //   is_active: null,
  //   account_locked: null,
  //   mfa_enabled: null
  // });

  const [filters, setFilters] = useState<UserFilterOptions>({
    search: '',
    account_status: '',
    user_status: '',
    user_roles: ''
  });

  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  const { addNotification } = useNotifications();
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const { getMenuId, loading: menuIdsLoading } = useMenuIds();

  // Get menu ID dynamically
  const USER_MANAGEMENT_MENU_ID = getMenuId('user_management');

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.user_status !== null && { user_status: filters.user_status.toString() }),
        ...(filters.user_roles.length ? { user_roles: filters.user_roles.toString() } : {})
      });

      const response = await apiClient.get(`/admin/users?${params}`);

      if (response.success && response.data) {

        const usersWithLegacyFields = response.data.data.map((user: User) => ({
          ...user,
          is_active: user.active_flag,
          failed_login_count: user.login_attempts,
          role_name: user.user_roles
        }));

        setUsers(usersWithLegacyFields);

        setPagination(prev => ({
          ...prev,
          total: response.data.total,
          totalPages: response.data.total_pages,
          hasNext: response.data.has_next,
          hasPrev: response.data.has_prev,
          currentPage: response.data.current_page
        }));

        // Log successful user data fetch
        logger.info(
          'User management data loaded successfully',
          currentUser?.full_name,
          { count: response.data.users.length, total: response.data.pagination.total }
        );
      } else {
        logger.error("failed to load users", currentUser?.full_name, { error: response.error });
        throw new Error(response.error || 'Failed to load users');
      }
    } catch (err) {
      setError('Failed to load users');
      logger.error(
        'Failed to load user management data',
        currentUser?.full_name,
        { error: err },
        err instanceof Error ? err : new Error('User data fetch failed')
      );
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit, currentUser?.full_name]);

  const loadRoles = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/admin/roles');
      if (response.success && response.data) {
        setRoles(response.data);
        // Log successful roles fetch
        logger.info('Roles loaded successfully', currentUser?.full_name, { count: response.data.length });
      } else {
        throw new Error(response.error || 'Failed to load roles');
      }
    } catch (err) {
      console.error('Error loading roles:', err);

      // Log error
      logger.error(
        'Failed to load roles',
        currentUser?.full_name,
        { error: err },
        err instanceof Error ? err : new Error('Roles fetch failed')
      );
    }
  }, [currentUser?.full_name]);

  useEffect(() => {
    if (!menuIdsLoading && USER_MANAGEMENT_MENU_ID) {
      loadUsers();
    }
  }, [loadUsers, menuIdsLoading, USER_MANAGEMENT_MENU_ID]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleUserAction = async (action: UserAction, user: User) => {
    try {
      setLoading(true);

      // Log the action attempt
      logger.info(
        `User action initiated: ${action.action} for user ${user.username}`,
        currentUser?.full_name,
        { action, userId: user.id }
      );

      const response = await apiClient.post('/api/admin/users/action', action);

      if (response.success) {
        addNotification(response.data?.message || 'Action completed successfully', 'success');
        loadUsers();
        setActionMenuOpen(null);
        setConfirmAction(null);

        // Log the successful action
        logger.info(
          `User action completed: ${action.action} for user ${user.username}`,
          currentUser?.full_name,
          { action, userId: user.id, success: true }
        );
      } else {
        throw new Error(response.error || 'Action failed');
      }
    } catch (err) {
      addNotification('Action failed', 'error');
      console.error('Error performing user action:', err);

      // Log the failed action
      logger.error(
        `User action failed: ${action.action} for user ${user.username}`,
        currentUser?.full_name,
        { action, userId: user.id, error: err },
        err instanceof Error ? err : new Error('User action failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedUsers.size === 0) {
      addNotification('Please select users first', 'warning');
      return;
    }

    // Log the bulk action attempt
    logger.info(
      `Bulk user action initiated: ${action} for ${selectedUsers.size} users`,
      currentUser?.full_name,
      { action, userCount: selectedUsers.size }
    );

    for (const userId of selectedUsers) {
      const user = users.find(u => u.id === userId);
      if (user) {
        await handleUserAction({ action: action as any, user_id: userId }, user);
      }
    }
    setSelectedUsers(new Set());
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      username: user.username,
      email_id: user.email_id,
      full_name: user.full_name,
      role_id: user.role_id
    });
    setShowEditModal(true);
    setActionMenuOpen(null);
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;

    try {
      setLoading(true);

      // Validate form data
      if (!editFormData.username.trim()) {
        addNotification('Username is required', 'warning');
        return;
      }
      if (!editFormData.email_id.trim()) {
        addNotification('Email is required', 'warning');
        return;
      }
      if (!editFormData.full_name.trim()) {
        addNotification('Full name is required', 'warning');
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editFormData.email_id)) {
        addNotification('Please enter a valid email address', 'warning');
        return;
      }

      // Log the edit attempt
      logger.info(
        `User edit initiated for ${editingUser.username}`,
        currentUser?.full_name,
        { userId: editingUser.id, changes: editFormData }
      );

      // In a real implementation, this would call an API
      // const response = await apiClient.put(`/api/admin/users/${editingUser.id}`, editFormData);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update local state to reflect the change
      setUsers(prev => prev.map(u =>
        u.id === editingUser.id
          ? {
            ...u,
            username: editFormData.username,
            email_id: editFormData.email_id,
            full_name: editFormData.full_name,
            role_id: editFormData.role_id,
            role_name: roles.find(r => r.id === editFormData.role_id)?.role_name || u.role_name
          }
          : u
      ));

      // Show success notification
      addNotification('User updated successfully', 'success');

      // Log the successful edit
      logger.info(
        `User edit completed for ${editingUser.username}`,
        currentUser?.full_name,
        { userId: editingUser.id, success: true }
      );

      // Close the modal
      setShowEditModal(false);
      setEditingUser(null);
    } catch (err) {
      addNotification('Failed to update user', 'error');
      console.error('Error updating user:', err);

      // Log the failed edit
      logger.error(
        `User edit failed for ${editingUser.username}`,
        currentUser?.full_name,
        { userId: editingUser.id, error: err },
        err instanceof Error ? err : new Error('User edit failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (user: User) => {
    if (user.account_locked) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-300 rounded-full">Locked</span>;
    }
    if (!user.account_locked) {
      return <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-800 rounded-full">Active</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-gray-500/20 text-gray-300 rounded-full">Inactive</span>;
  };

  const getRoleName = (roleId: number) => {
    return roles.find(r => r.id === roleId)?.role_name || 'Unknown';
  };

  // const formatDate = (dateString: string | null) => {
  //   if (!dateString) return 'Never';
  //   return new Date(dateString).toLocaleDateString();
  // };

  // const formatDate = (dateString: string | null) => {
  //   if (!dateString) return 'Never';

  //   const date = new Date(dateString);
  //   return date.toLocaleDateString('en-GB', {
  //     day: '2-digit',
  //     month: 'short',
  //     year: 'numeric'
  //   }).replace(/ /g, '-');
  // };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return { date: 'Never', time: '' };

    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;

    return {
      date: `${day}-${month}-${year}`,
      time: formattedTime
    };
  };

  // Show loading while menu IDs are being fetched
  if (menuIdsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 ${theme === 'dark' ? 'border-white' : 'border-gray-900'
          }`}></div>
      </div>
    );
  }

  return (
    <PermissionGuard
      menuId={USER_MANAGEMENT_MENU_ID}
      action="view"
      fallback={
        <div className={`text-center py-20 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view user management.</p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>User Management</h1>
              <p className={`${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>Manage user accounts with role-based permissions</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showFilters
                ? theme === 'dark'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-blue-100 text-blue-700 border border-blue-300'
                : theme === 'dark'
                  ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>

            <button
              onClick={loadUsers}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <PermissionGuard menuId={USER_MANAGEMENT_MENU_ID} action="create">
              <button className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                }`}>
                <Plus className="w-4 h-4" />
                Add User
              </button>
            </PermissionGuard>
          </div>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`rounded-xl border p-6 overflow-hidden ${theme === 'dark'
                ? 'bg-white/5 border-white/20'
                : 'bg-gray-50 border-gray-200'
                } backdrop-blur-xl`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}>Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      placeholder="Search users..."
                      className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark'
                        ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                        : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}>Role</label>
                  <select
                    value={filters.user_roles ?? ''}
                    onChange={(e) => {
                      const selectedRoleId = e.target.value ? parseInt(e.target.value) : null;
                      const selectedRole = selectedRoleId ? roles.find(role => role.id === selectedRoleId) : null;
                      const roleDescription = selectedRole ? selectedRole.role_name : null;

                      setFilters({ ...filters, 
                       user_roles: roleDescription
                      });
                      console.log('Selected Role Description:', roleDescription);
                    }}
                    className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                      ? 'bg-white/10 border border-white/20 text-white'
                      : 'bg-white border border-gray-300 text-gray-900'
                      }`}
                  >
                    <option value="">All Roles</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id} className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}>Status</label>
                  <select
                    value={filters.user_status ?? ''}
                    onChange={(e) => setFilters({ ...filters, user_status: e.target.value ? e.target.value.toString() : null })}
                    className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                      ? 'bg-white/10 border border-white/20 text-white'
                      : 'bg-white border border-gray-300 text-gray-900'
                      }`}
                  >
                    <option value="">All Status</option>
                    <option value="true" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>Active</option>
                    <option value="false" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>Inactive</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}>Account</label>
                  <select
                    value={filters.account_status === null ? '' : filters.account_status.toString()}
                    onChange={(e) => setFilters({ ...filters, account_status: e.target.value ? null : e.target.value.toString() })}
                    className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                      ? 'bg-white/10 border border-white/20 text-white'
                      : 'bg-white border border-gray-300 text-gray-900'
                      }`}
                  >
                    <option value="">All Accounts</option>
                    <option value="Unlocked" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>Unlocked</option>
                    <option value="Locked" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>Locked</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setFilters({ search: '', account_status: null, user_status: null, user_roles: null })}
                  className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                >
                  Clear
                </button>
                <button
                  onClick={() => setPagination({ ...pagination, page: 1 })}
                  className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                    ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    }`}
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Actions */}
        {selectedUsers.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border p-4 ${theme === 'dark'
              ? 'bg-blue-500/20 border-blue-500/30'
              : 'bg-blue-100 border-blue-300'
              } backdrop-blur-xl`}
          >
            <div className="flex justify-between items-center">
              <span className={`font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                }`}>
                {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <PermissionGuard menuId={USER_MANAGEMENT_MENU_ID} action="edit">
                  <button
                    onClick={() => handleBulkAction('activate')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${theme === 'dark'
                      ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                      : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                      }`}
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleBulkAction('deactivate')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${theme === 'dark'
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                      : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-300'
                      }`}
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={() => handleBulkAction('unlock')}
                    className={`px-3 py-1 rounded text-sm transition-colors ${theme === 'dark'
                      ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30'
                      : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border border-yellow-300'
                      }`}
                  >
                    Unlock
                  </button>
                </PermissionGuard>
              </div>
            </div>
          </motion.div>
        )}

        {/* Users Table */}
        <div className={`rounded-xl border overflow-hidden ${theme === 'dark'
          ? 'bg-white/5 border-white/20'
          : 'bg-white border-gray-200'
          } backdrop-blur-xl shadow-2xl`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${theme === 'dark'
                ? 'bg-white/5 border-white/20'
                : 'bg-gray-50 border-gray-200'
                }`}>
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(new Set(users.map(u => u.id)));
                        } else {
                          setSelectedUsers(new Set());
                        }
                      }}
                      className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>User</th>
                  <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Role</th>
                  <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Status</th>
                  <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Last Login</th>
                  <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Failed Logins</th>
                  <th className={`px-6 py-4 text-left font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>MFA</th>
                  <th className={`px-6 py-4 text-right font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className={`h-12 w-12 animate-spin ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          }`} />
                        <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>Loading users...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <UserIcon className={`w-12 h-12 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                          }`} />
                        <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>No users found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`border-b transition-colors ${theme === 'dark'
                        ? 'border-white/10 hover:bg-white/5'
                        : 'border-gray-100 hover:bg-gray-50'
                        }`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedUsers);
                            if (e.target.checked) {
                              newSelected.add(user.id);
                            } else {
                              newSelected.delete(user.id);
                            }
                            setSelectedUsers(newSelected);
                          }}
                          className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            <UserIcon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>{user.full_name}</div>
                            <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                              }`}>{user.username}</div>
                            <div className={` flex items-center gap-1 text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                              }`}>{user.email_id}
                              {user.email_verified ? (<CheckCircle className='w-4 h-4 text-green-600' />) : (<AlertTriangle className='w-4 h-4 text-red-600' />)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${theme === 'dark'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-purple-100 text-purple-700 border border-purple-300'
                          }`}>
                          {getRoleName(user.role_id)}
                        </span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(user)}</td>
                      <td className="px-6 py-4">
                        <div className={`flex items-start gap-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                          <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {formatDate(user.last_login).date}
                            </span>
                            {formatDate(user.last_login).time && (
                              <span className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'} mt-0.5`}>
                                {formatDate(user.last_login).time}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* <td className="px-6 py-4">
                        <div className={`flex items-center gap-2 ${
                          theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                        }`}>
                          <Clock className="w-4 h-4 text-gray-400" />
                          {formatDate(user.last_login)}
                        </div>
                      </td> */}
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.login_attempts > 0
                          ? theme === 'dark'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-red-100 text-red-700 border border-red-300'
                          : theme === 'dark'
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                            : 'bg-green-100 text-green-700 border border-green-300'
                          }`}>
                          {user.failed_login_count}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.mfa_enabled ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <PermissionGuard
                          menuId={USER_MANAGEMENT_MENU_ID}
                          actions={['edit', 'delete']}
                          fallback={
                            <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                              }`}>No access</span>
                          }
                        >
                          <div className="relative">
                            <button
                              onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)}
                              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                                }`}
                            >
                              <MoreVertical className={`w-4 h-4 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                                }`} />
                            </button>

                            <AnimatePresence>
                              {actionMenuOpen === user.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                  className={`absolute right-0 top-full mt-1 w-48 rounded-lg shadow-xl z-20 border ${theme === 'dark'
                                    ? 'bg-slate-800/95 border-white/20'
                                    : 'bg-white border-gray-200'
                                    } backdrop-blur-xl`}
                                  style={{
                                    maxHeight: '80vh',
                                    overflowY: 'auto'
                                  }}
                                >
                                  <div className="py-1">
                                    <PermissionGuard menuId={USER_MANAGEMENT_MENU_ID} action="edit">
                                      <button
                                        onClick={() => setConfirmAction({
                                          action: { action: user.is_active ? 'deactivate' : 'activate', user_id: user.id },
                                          user
                                        })}
                                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${theme === 'dark'
                                          ? 'text-white/80 hover:bg-white/10'
                                          : 'text-gray-700 hover:bg-gray-100'
                                          }`}
                                      >
                                        {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                        {user.is_active ? 'Deactivate' : 'Activate'}
                                      </button>

                                      {user.account_locked && (
                                        <button
                                          onClick={() => setConfirmAction({
                                            action: { action: 'unlock', user_id: user.id },
                                            user
                                          })}
                                          className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${theme === 'dark'
                                            ? 'text-white/80 hover:bg-white/10'
                                            : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                          <Unlock className="w-4 h-4" />
                                          Unlock Account
                                        </button>
                                      )}

                                      {user.login_attempts > 0 && (
                                        <button
                                          onClick={() => setConfirmAction({
                                            action: { action: 'reset_failed_login', user_id: user.id },
                                            user
                                          })}
                                          className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${theme === 'dark'
                                            ? 'text-white/80 hover:bg-white/10'
                                            : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                          <RotateCcw className="w-4 h-4" />
                                          Reset Failed Logins
                                        </button>
                                      )}

                                      <button
                                        onClick={() => setConfirmAction({
                                          action: { action: 'reset_password', user_id: user.id },
                                          user
                                        })}
                                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${theme === 'dark'
                                          ? 'text-white/80 hover:bg-white/10'
                                          : 'text-gray-700 hover:bg-gray-100'
                                          }`}
                                      >
                                        <RotateCcw className="w-4 h-4" />
                                        Reset Password
                                      </button>

                                      <button
                                        onClick={() => setConfirmAction({
                                          action: { action: user.mfa_enabled ? 'disable_mfa' : 'enable_mfa', user_id: user.id },
                                          user
                                        })}
                                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${theme === 'dark'
                                          ? 'text-white/80 hover:bg-white/10'
                                          : 'text-gray-700 hover:bg-gray-100'
                                          }`}
                                      >
                                        {user.mfa_enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        {user.mfa_enabled ? 'Disable MFA' : 'Enable MFA'}
                                      </button>
                                    </PermissionGuard>

                                    <div className={`border-t my-1 ${theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                                      }`}></div>

                                    <PermissionGuard menuId={USER_MANAGEMENT_MENU_ID} action="edit">
                                      <button
                                        onClick={() => handleEditUser(user)}
                                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${theme === 'dark'
                                          ? 'text-white/80 hover:bg-white/10'
                                          : 'text-gray-700 hover:bg-gray-100'
                                          }`}
                                      >
                                        <Edit className="w-4 h-4" />
                                        Edit User
                                      </button>
                                    </PermissionGuard>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </PermissionGuard>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className={`flex justify-between items-center px-6 py-4 border-t ${theme === 'dark' ? 'border-white/20' : 'border-gray-200'
              }`}>
              <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className={`px-3 py-1 rounded transition-colors ${theme === 'dark'
                    ? 'bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white'
                    : 'bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700'
                    }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.totalPages}
                  className={`px-3 py-1 rounded transition-colors ${theme === 'dark'
                    ? 'bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white'
                    : 'bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700'
                    }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmAction && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                // Close when clicking outside the modal
                if (e.target === e.currentTarget) {
                  setConfirmAction(null);
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-xl p-6 max-w-md w-full border ${theme === 'dark'
                  ? 'bg-slate-800/95 border-white/20'
                  : 'bg-white border-gray-200'
                  } backdrop-blur-xl`}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
              >
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>Confirm Action</h3>
                </div>

                <p className={`mb-6 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>
                  Are you sure you want to {confirmAction.action.action.replace('_', ' ')} user "{confirmAction.user.full_name}"?
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleUserAction(confirmAction.action, confirmAction.user);
                    }}
                    className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                      : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-300'
                      }`}
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit User Modal */}
        <AnimatePresence>
          {showEditModal && editingUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                // Close when clicking outside the modal
                if (e.target === e.currentTarget) {
                  setShowEditModal(false);
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={`rounded-xl p-6 max-w-md w-full border ${theme === 'dark'
                  ? 'bg-slate-800/95 border-white/20'
                  : 'bg-white border-gray-200'
                  } backdrop-blur-xl`}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                      <Edit className="w-5 h-5 text-white" />
                    </div>
                    <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Edit User</h3>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className={`p-2 rounded-lg transition-colors ${theme === 'dark'
                      ? 'hover:bg-white/10 text-white/60'
                      : 'hover:bg-gray-100 text-gray-500'
                      }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}>Username</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={editFormData.username}
                        onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                        className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                          ? 'bg-white/10 border border-white/20 text-white'
                          : 'bg-white border border-gray-300 text-gray-900'
                          }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}>Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={editFormData.email_id}
                        onChange={(e) => setEditFormData({ ...editFormData, email_id: e.target.value })}
                        className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                          ? 'bg-white/10 border border-white/20 text-white'
                          : 'bg-white border border-gray-300 text-gray-900'
                          }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}>Full Name</label>
                    <input
                      type="text"
                      value={editFormData.full_name}
                      onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                      className={`w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                        ? 'bg-white/10 border border-white/20 text-white'
                        : 'bg-white border border-gray-300 text-gray-900'
                        }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}>Role</label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        value={editFormData.role_id}
                        onChange={(e) => setEditFormData({ ...editFormData, role_id: parseInt(e.target.value) })}
                        className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                          ? 'bg-white/10 border border-white/20 text-white'
                          : 'bg-white border border-gray-300 text-gray-900'
                          }`}
                      >
                        {roles.map(role => (
                          <option key={role.id} value={role.id} className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>
                            {role.role_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-white/20">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveUserEdit}
                    disabled={loading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${theme === 'dark'
                      ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30'
                      : 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300'
                      }`}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PermissionGuard>
  );
};

export default SecureUserManagement;