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
import { useAdminApi } from '../../hooks/useAdminApi';
import { useNotifications } from '../notifications';
import { useAuth } from '../../context/AuthContext';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: UserAction; user: User } | null>(null);
  
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

  const { loading, error, fetchUsers, performUserAction, fetchRoles } = useAdminApi();
  const { addNotification } = useNotifications();
  const { user: currentUser } = useAuth();

  const loadUsers = useCallback(async () => {
    const result = await fetchUsers(filters, { page: pagination.page, limit: pagination.limit });
    if (result) {
      setUsers(result.users);
      setPagination(result.pagination);
    }
  }, [fetchUsers, filters, pagination.page, pagination.limit]);

  const loadRoles = useCallback(async () => {
    const result = await fetchRoles();
    if (result) {
      setRoles(result);
    }
  }, [fetchRoles]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleUserAction = async (action: UserAction, user: User) => {
    const result = await performUserAction(action);
    if (result?.success) {
      addNotification(result.message, 'success');
      loadUsers();
      setActionMenuOpen(null);
      setConfirmAction(null);
    } else {
      addNotification(error || 'Action failed', 'error');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-white/60">Manage user accounts, roles, and permissions</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFilters ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 p-6 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Search users..."
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Role</label>
                <select
                  value={filters.role_id || ''}
                  onChange={(e) => setFilters({ ...filters, role_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Roles</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id} className="bg-slate-800">
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Status</label>
                <select
                  value={filters.is_active === null ? '' : filters.is_active.toString()}
                  onChange={(e) => setFilters({ ...filters, is_active: e.target.value === '' ? null : e.target.value === 'true' })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="true" className="bg-slate-800">Active</option>
                  <option value="false" className="bg-slate-800">Inactive</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Account</label>
                <select
                  value={filters.account_locked === null ? '' : filters.account_locked.toString()}
                  onChange={(e) => setFilters({ ...filters, account_locked: e.target.value === '' ? null : e.target.value === 'true' })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Accounts</option>
                  <option value="false" className="bg-slate-800">Unlocked</option>
                  <option value="true" className="bg-slate-800">Locked</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setFilters({ search: '', role_id: null, is_active: null, account_locked: null, mfa_enabled: null })}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: 1 })}
                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
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
          className="bg-blue-500/20 backdrop-blur-xl rounded-xl border border-blue-500/30 p-4"
        >
          <div className="flex justify-between items-center">
            <span className="text-blue-300 font-medium">
              {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
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
            </div>
          </div>
        </motion.div>
      )}

      {/* Users Table */}
      <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/20">
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
                <th className="px-6 py-4 text-left text-white font-semibold">User</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Role</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Last Login</th>
                <th className="px-6 py-4 text-left text-white font-semibold">Failed Logins</th>
                <th className="px-6 py-4 text-left text-white font-semibold">MFA</th>
                <th className="px-6 py-4 text-right text-white font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      <span className="text-white/60">Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <UserIcon className="w-12 h-12 text-white/40" />
                      <span className="text-white/60">No users found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors"
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
                          <div className="font-medium text-white">{user.full_name}</div>
                          <div className="text-sm text-white/60">{user.username}</div>
                          <div className="text-xs text-white/40">{user.email_id}</div>
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
                      <div className="flex items-center gap-2 text-white/80">
                        <Clock className="w-4 h-4 text-white/40" />
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
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-white/60" />
                        </button>
                        
                        {actionMenuOpen === user.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl z-10">
                            <div className="py-1">
                              <button
                                onClick={() => setConfirmAction({ 
                                  action: { action: user.is_active ? 'deactivate' : 'activate', user_id: user.id }, 
                                  user 
                                })}
                                className="w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 flex items-center gap-2"
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
                                  className="w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 flex items-center gap-2"
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
                                  className="w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 flex items-center gap-2"
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
                                className="w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 flex items-center gap-2"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Reset Password
                              </button>
                              
                              <button
                                onClick={() => setConfirmAction({ 
                                  action: { action: user.mfa_enabled ? 'disable_mfa' : 'enable_mfa', user_id: user.id }, 
                                  user 
                                })}
                                className="w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 flex items-center gap-2"
                              >
                                {user.mfa_enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                {user.mfa_enabled ? 'Disable MFA' : 'Enable MFA'}
                              </button>
                              
                              <div className="border-t border-white/20 my-1"></div>
                              
                              <button className="w-full px-4 py-2 text-left text-white/80 hover:bg-white/10 flex items-center gap-2">
                                <Edit className="w-4 h-4" />
                                Edit User
                              </button>
                              
                              <button className="w-full px-4 py-2 text-left text-red-300 hover:bg-red-500/10 flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />
                                Delete User
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-white/20">
            <div className="text-white/60 text-sm">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
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
            className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-xl p-6 max-w-md w-full"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">Confirm Action</h3>
            </div>
            
            <p className="text-white/80 mb-6">
              Are you sure you want to {confirmAction.action.action.replace('_', ' ')} user "{confirmAction.user.full_name}"?
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
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
  );
};

export default UserManagement;