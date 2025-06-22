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
  User as UserIcon
} from 'lucide-react';
import { User, Role, UserAction, UserSearchFilters, PaginationInfo } from '../../types/admin';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../notifications';
import { useTheme } from '../../context/ThemeContext';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';

// Menu ID for User Management (should match database)
const USER_MANAGEMENT_MENU_ID = 11;

const SecureUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: UserAction; user: User } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<UserSearchFilters>({
    search: '',
    role_id: null,
    is_active: null,
    account_locked: null,
    mfa_enabled: null
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

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.role_id !== null && { role_id: filters.role_id.toString() }),
        ...(filters.is_active !== null && { is_active: filters.is_active.toString() }),
        ...(filters.account_locked !== null && { account_locked: filters.account_locked.toString() }),
        ...(filters.mfa_enabled !== null && { mfa_enabled: filters.mfa_enabled.toString() })
      });

      const response = await apiClient.get(`/api/admin/users?${params}`);
      
      if (response.success && response.data) {
        setUsers(response.data.users);
        setPagination(response.data.pagination);
      } else {
        throw new Error(response.error || 'Failed to load users');
      }
    } catch (err) {
      setError('Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  const loadRoles = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/admin/roles');
      if (response.success && response.data) {
        setRoles(response.data);
      }
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleUserAction = async (action: UserAction, user: User) => {
    try {
      setLoading(true);
      
      const response = await apiClient.post('/api/admin/users/action', action);
      
      if (response.success) {
        addNotification(response.data?.message || 'Action completed successfully', 'success');
        loadUsers();
        setActionMenuOpen(null);
        setConfirmAction(null);
      } else {
        throw new Error(response.error || 'Action failed');
      }
    } catch (err) {
      addNotification('Action failed', 'error');
      console.error('Error performing user action:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedUsers.size === 0) {
      addNotification('Please select users first', 'warning');
      return;
    }

    for (const userId of selectedUsers) {
      const user = users.find(u => u.id === userId);
      if (user) {
        await handleUserAction({ action: action as any, user_id: userId }, user);
      }
    }
    setSelectedUsers(new Set());
  };

  const getStatusBadge = (user: User) => {
    if (user.account_locked) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-300 rounded-full">Locked</span>;
    }
    if (!user.is_active) {
      return <span className="px-2 py-1 text-xs font-medium bg-gray-500/20 text-gray-300 rounded-full">Inactive</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-green-500/20 text-green-300 rounded-full">Active</span>;
  };

  const getRoleName = (roleId: number) => {
    return roles.find(r => r.id === roleId)?.role_name || 'Unknown';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <PermissionGuard 
      menuId={USER_MANAGEMENT_MENU_ID} 
      action="view"
      fallback={
        <div className={`text-center py-20 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
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
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Secure User Management</h1>
              <p className={`${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Manage user accounts with role-based permissions</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showFilters 
                  ? 'bg-blue-500/20 text-blue-300' 
                  : theme === 'dark' 
                    ? 'bg-white/10 text-white hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            
            <button
              onClick={loadUsers}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'bg-white/10 hover:bg-white/20 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <PermissionGuard menuId={USER_MANAGEMENT_MENU_ID} action="create">
              <button className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300' 
                  : 'bg-green-100 hover:bg-green-200 text-green-700'
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
              className={`rounded-xl border p-6 overflow-hidden ${
                theme === 'dark' 
                  ? 'bg-white/5 border-white/20' 
                  : 'bg-gray-50 border-gray-200'
              } backdrop-blur-xl`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      placeholder="Search users..."
                      className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                        theme === 'dark' 
                          ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                  </div>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Role</label>
                  <select
                    value={filters.role_id || ''}
                    onChange={(e) => setFilters({ ...filters, role_id: e.target.value ? parseInt(e.target.value) : null })}
                    className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === 'dark' 
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
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Status</label>
                  <select
                    value={filters.is_active === null ? '' : filters.is_active.toString()}
                    onChange={(e) => setFilters({ ...filters, is_active: e.target.value === '' ? null : e.target.value === 'true' })}
                    className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === 'dark' 
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
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}>Account</label>
                  <select
                    value={filters.account_locked === null ? '' : filters.account_locked.toString()}
                    onChange={(e) => setFilters({ ...filters, account_locked: e.target.value === '' ? null : e.target.value === 'true' })}
                    className={`w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      theme === 'dark' 
                        ? 'bg-white/10 border border-white/20 text-white' 
                        : 'bg-white border border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">All Accounts</option>
                    <option value="false" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>Unlocked</option>
                    <option value="true" className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>Locked</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setFilters({ search: '', role_id: null, is_active: null, account_locked: null, mfa_enabled: null })}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    theme === 'dark' 
                      ? 'bg-white/10 hover:bg-white/20 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Clear
                </button>
                <button
                  onClick={() => setPagination({ ...pagination, page: 1 })}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    theme === 'dark' 
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
            className={`rounded-xl border p-4 ${
              theme === 'dark' 
                ? 'bg-blue-500/20 border-blue-500/30' 
                : 'bg-blue-100 border-blue-300'
            } backdrop-blur-xl`}
          >
            <div className="flex justify-between items-center">
              <span className={`font-medium ${
                theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
              }`}>
                {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <PermissionGuard menuId={USER_MANAGEMENT_MENU_ID} action="edit">
                  <button
                    onClick={() => handleBulkAction('activate')}
                    className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded text-sm transition-colors"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleBulkAction('deactivate')}
                    className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-sm transition-colors"
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={() => handleBulkAction('unlock')}
                    className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded text-sm transition-colors"
                  >
                    Unlock
                  </button>
                </PermissionGuard>
              </div>
            </div>
          </motion.div>
        )}

        {/* Users Table */}
        <div className={`rounded-xl border overflow-hidden ${
          theme === 'dark' 
            ? 'bg-white/5 border-white/20' 
            : 'bg-white border-gray-200'
        } backdrop-blur-xl shadow-2xl`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${
                theme === 'dark' 
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
                  <th className={`px-6 py-4 text-left font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>User</th>
                  <th className={`px-6 py-4 text-left font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Role</th>
                  <th className={`px-6 py-4 text-left font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Status</th>
                  <th className={`px-6 py-4 text-left font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Last Login</th>
                  <th className={`px-6 py-4 text-left font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Failed Logins</th>
                  <th className={`px-6 py-4 text-left font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>MFA</th>
                  <th className={`px-6 py-4 text-right font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>Loading users...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <UserIcon className={`w-12 h-12 ${
                          theme === 'dark' ? 'text-white/40' : 'text-gray-400'
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
                      className={`border-b transition-colors ${
                        theme === 'dark' 
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
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>{user.full_name}</div>
                            <div className={`text-sm ${
                              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                            }`}>{user.username}</div>
                            <div className={`text-xs ${
                              theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                            }`}>{user.email_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-300 rounded-full">
                          {getRoleName(user.role_id)}
                        </span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(user)}</td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-2 ${
                          theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                        }`}>
                          <Clock className="w-4 h-4 text-gray-400" />
                          {formatDate(user.last_login)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.failed_login_count > 0 
                            ? 'bg-red-500/20 text-red-300' 
                            : 'bg-green-500/20 text-green-300'
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
                            <span className={`text-xs ${
                              theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                            }`}>No access</span>
                          }
                        >
                          <div className="relative">
                            <button
                              onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)}
                              className={`p-2 rounded-lg transition-colors ${
                                theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                              }`}
                            >
                              <MoreVertical className={`w-4 h-4 ${
                                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                              }`} />
                            </button>
                            
                            {actionMenuOpen === user.id && (
                              <div className={`absolute right-0 top-full mt-1 w-48 rounded-lg shadow-xl z-10 border ${
                                theme === 'dark' 
                                  ? 'bg-slate-800/95 border-white/20' 
                                  : 'bg-white border-gray-200'
                              } backdrop-blur-xl`}>
                                <div className="py-1">
                                  <PermissionGuard menuId={USER_MANAGEMENT_MENU_ID} action="edit">
                                    <button
                                      onClick={() => setConfirmAction({ 
                                        action: { action: user.is_active ? 'deactivate' : 'activate', user_id: user.id }, 
                                        user 
                                      })}
                                      className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                                        theme === 'dark' 
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
                                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                                          theme === 'dark' 
                                            ? 'text-white/80 hover:bg-white/10' 
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                      >
                                        <Unlock className="w-4 h-4" />
                                        Unlock Account
                                      </button>
                                    )}
                                    
                                    {user.failed_login_count > 0 && (
                                      <button
                                        onClick={() => setConfirmAction({ 
                                          action: { action: 'reset_failed_login', user_id: user.id }, 
                                          user 
                                        })}
                                        className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                                          theme === 'dark' 
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
                                      className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                                        theme === 'dark' 
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
                                      className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                                        theme === 'dark' 
                                          ? 'text-white/80 hover:bg-white/10' 
                                          : 'text-gray-700 hover:bg-gray-100'
                                      }`}
                                    >
                                      {user.mfa_enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                      {user.mfa_enabled ? 'Disable MFA' : 'Enable MFA'}
                                    </button>
                                  </PermissionGuard>
                                  
                                  <div className={`border-t my-1 ${
                                    theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                                  }`}></div>
                                  
                                  <PermissionGuard menuId={USER_MANAGEMENT_MENU_ID} action="edit">
                                    <button className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                                      theme === 'dark' 
                                        ? 'text-white/80 hover:bg-white/10' 
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}>
                                      <Edit className="w-4 h-4" />
                                      Edit User
                                    </button>
                                  </PermissionGuard>
                                  
                                  <PermissionGuard menuId={USER_MANAGEMENT_MENU_ID} action="delete">
                                    <button className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                                      theme === 'dark' 
                                        ? 'text-red-300 hover:bg-red-500/10' 
                                        : 'text-red-600 hover:bg-red-100'
                                    }`}>
                                      <Trash2 className="w-4 h-4" />
                                      Delete User
                                    </button>
                                  </PermissionGuard>
                                </div>
                              </div>
                            )}
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
            <div className={`flex justify-between items-center px-6 py-4 border-t ${
              theme === 'dark' ? 'border-white/20' : 'border-gray-200'
            }`}>
              <div className={`text-sm ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className={`px-3 py-1 rounded transition-colors ${
                    theme === 'dark' 
                      ? 'bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.totalPages}
                  className={`px-3 py-1 rounded transition-colors ${
                    theme === 'dark' 
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
        {confirmAction && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-xl p-6 max-w-md w-full border ${
                theme === 'dark' 
                  ? 'bg-slate-800/95 border-white/20' 
                  : 'bg-white border-gray-200'
              } backdrop-blur-xl`}
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                <h3 className={`text-lg font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Confirm Action</h3>
              </div>
              
              <p className={`mb-6 ${
                theme === 'dark' ? 'text-white/80' : 'text-gray-700'
              }`}>
                Are you sure you want to {confirmAction.action.action.replace('_', ' ')} user "{confirmAction.user.full_name}"?
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    theme === 'dark' 
                      ? 'bg-white/10 hover:bg-white/20 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUserAction(confirmAction.action, confirmAction.user)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
};

export default SecureUserManagement;