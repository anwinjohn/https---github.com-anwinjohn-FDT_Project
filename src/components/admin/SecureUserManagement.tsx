import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserOnboardingData,
  UserOnboardingFilters,
  UserOnboardingPagination,
} from '../../types/userOnboarding';
import {
  User,
  ArrowUpRight,
  Loader2,
  Filter,
  Search,
  ChevronDown,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  SlidersHorizontal,
  X,
  Info,
  Shield,
  CheckCircle,
  AlertTriangle,
  Mail,
  Eye,
  RefreshCw,
  UserCheck,
  FileSpreadsheet,
  Edit,
  MoreVertical,
  UserX,
  Unlock,
  Lock,
  Key,
  Send,
  Copy,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import * as XLSX from 'xlsx';
import { useNotifications } from '../notifications';
import { add } from 'date-fns';
import { update } from 'three/examples/jsm/libs/tween.module.js';
import { log } from 'console';
import apiClient from '../../utils/apiClient';

interface UserOnboardingProps {
  apiEndpoint?: string;
  fullWidth?: boolean;
}

const UserManagement: React.FC<UserOnboardingProps> = ({
  apiEndpoint = 'http://127.0.0.1:8000/admin/users',
  fullWidth = false,
}) => {
  const { theme } = useTheme();
  const { addNotification } = useNotifications();

  const [users, setUsers] = useState<UserOnboardingData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'username' | 'email_id' | 'last_login'>(
    'last_login'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [exportLoading, setExportLoading] = useState(false);

  const [filters, setFilters] = useState<UserOnboardingFilters>({
    search: '',
    account_status: '',
    user_status: '',
    user_roles: '',
  });

  const [pagination, setPagination] = useState<UserOnboardingPagination>({
    page: 1,
    page_size: fullWidth ? 20 : 10,
    total: 0,
    total_pages: 0,
  });

  const processedData = useMemo(() => {
    return [...users]
      .filter((user) => {
        const matchesSearch =
          user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.full_name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'username') {
          return sortOrder === 'desc'
            ? b.username.localeCompare(a.username)
            : a.username.localeCompare(b.username);
        } else if (sortBy === 'email_id') {
          return sortOrder === 'desc'
            ? b.email_id.localeCompare(a.email_id)
            : a.email_id.localeCompare(b.email_id);
        } else {
          const dateA = a.last_login ? new Date(a.last_login).getTime() : 0;
          const dateB = b.last_login ? new Date(b.last_login).getTime() : 0;
          return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        }
      });
  }, [users, searchTerm, sortBy, sortOrder]);

  // useEffect(() => {
  //   fetchUsers();
  // }, [
  //   filters,
  //   searchTerm,
  //   sortBy,
  //   sortOrder,
  //   pagination.page,
  //   pagination.page_size,
  // ]);

  // const fetchUsers = async () => {
  //   try {
  //     const queryParams = new URLSearchParams({
  //       page: pagination.page.toString(),
  //       page_size: pagination.page_size.toString(),
  //       search: searchTerm || '',
  //       user_status: filters.user_status || '',
  //       account_status: filters.account_status || '',
  //       sort_by: sortBy,
  //       sort_order: sortOrder,
  //     });

  //     const response = await apiClient.get(
  //       `/admin/users?${queryParams.toString()}`
  //     );
  //     setUsers(response.data.data);
  //     setPagination((prev) => ({
  //       ...prev,
  //       total: response.data.total,
  //       total_pages: response.data.total_pages,
  //     }));
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  const exportToExcel = useCallback(async () => {
    try {
      addNotification('Exporting users to Excel...', 'info');
      setExportLoading(true);

      // Prepare data for export
      const exportData = processedData.map((user) => ({
        'Full Name': user.full_name,
        Username: user.username,
        Email: user.email_id,
        'Email Verified': user.email_verified ? 'Yes' : 'No',
        Role: user.user_roles,
        'Account Status': user.account_status,
        'Active Status': user.active_flag ? 'Active' : 'Inactive',
        'Account Locked': user.account_locked ? 'Yes' : 'No',
        'MFA Enabled': user.mfa_enabled ? 'Yes' : 'No',
        'Last Login': user.last_login
          ? formatDate(user.last_login).date +
            ' ' +
            formatDate(user.last_login).time
          : 'Never',
        'Created At': user.created_at
          ? formatDate(user.created_at).date +
            ' ' +
            formatDate(user.created_at).time
          : 'N/A',
        'Updated At': user.updated_at
          ? formatDate(user.updated_at).date +
            ' ' +
            formatDate(user.updated_at).time
          : 'N/A',
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      const colWidths = [
        { wch: 20 }, // Full Name
        { wch: 15 }, // Username
        { wch: 25 }, // Email
        { wch: 12 }, // Email Verified
        { wch: 15 }, // Role
        { wch: 15 }, // Account Status
        { wch: 12 }, // Active Status
        { wch: 12 }, // Account Locked
        { wch: 12 }, // MFA Enabled
        { wch: 20 }, // Last Login
        { wch: 20 }, // Created At
        { wch: 20 }, // Updated At
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'User Report');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `User_Report_${timestamp}.xlsx`;

      // Export the file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      addNotification('Failed to export users to Excel.', 'error');
    } finally {
      setExportLoading(false);
      addNotification('User export to Excel completed.', 'success');
    }
  }, [processedData]);

  const exportAllUsersToExcel = useCallback(async () => {
    try {
      setExportLoading(true);

      // Fetch all users for complete export
      const params = new URLSearchParams({
        page: '1',
        page_size: pagination.total.toString(), // Get all users
        ...(filters.search && { search: filters.search }),
        ...(filters.account_status && {
          account_status: filters.account_status,
        }),
        ...(filters.user_status && { user_status: filters.user_status }),
        ...(filters.user_roles && { user_roles: filters.user_roles }),
      });

      const response = await fetch(`${apiEndpoint}?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch users for export');
      }

      const data = await response.json();
      const allUsers = data.data || [];

      const exportData = allUsers.map((user) => ({
        'Full Name': user.full_name,
        Username: user.username,
        Email: user.email_id,
        'Email Verified': user.email_verified ? 'Yes' : 'No',
        Role: user.user_roles,
        'Account Status': user.account_status,
        'Active Status': user.active_flag ? 'Active' : 'Inactive',
        'Account Locked': user.account_locked ? 'Yes' : 'No',
        'MFA Enabled': user.mfa_enabled ? 'Yes' : 'No',
        'Last Login': user.last_login
          ? formatDate(user.last_login).date +
            ' ' +
            formatDate(user.last_login).time
          : 'Never',
        'Created At': user.created_at
          ? formatDate(user.created_at).date +
            ' ' +
            formatDate(user.created_at).time
          : 'N/A',
        'Updated At': user.updated_at
          ? formatDate(user.updated_at).date +
            ' ' +
            formatDate(user.updated_at).time
          : 'N/A',
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 20 },
        { wch: 15 },
        { wch: 25 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'All Users Report');

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `All_Users_Report_${timestamp}.xlsx`;

      // Export the file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Error exporting all users to Excel:', error);
      alert('Failed to export complete user report. Please try again.');
    } finally {
      setExportLoading(false);
    }
  }, [apiEndpoint, filters, pagination.total]);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.page_size.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.account_status && {
          account_status: filters.account_status,
        }),
        ...(filters.user_status && { user_status: filters.user_status }),
        ...(filters.user_roles && { user_roles: filters.user_roles }),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const response = await fetch(`${apiEndpoint}?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch user onboarding data');
      }

      const data = await response.json();

      setUsers(data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: data.total,
        total_pages: data.total_pages,
        has_next: data.has_next,
        has_prev: data.has_prev,
        current_page: data.current_page,
      }));
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    apiEndpoint,
    filters,
    pagination.page,
    pagination.page_size,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const delay = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: filters.search.trim() }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => clearTimeout(delay);
  }, [filters.search]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return { date: 'Never', time: '' };

    const date = new Date(dateString);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;

    return {
      date: `${day}-${month}-${year}`,
      time: formattedTime,
    };
  };

  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const handleEditUser = (user) => {
    setEditingUser({ ...user });
    setShowEditModal(true);
    setOpenDropdown(null);
  };

  const updateUserstatus = async (userid, status) => {
    try {
      const response = await fetch(`${apiEndpoint}/update/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userid, new_status: status }),
      });
      if (!response.ok) {
        throw new Error('Failed to update user status');
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleUserAction = (action, user) => {
    console.log(`Action: ${action} for user:`, user.username);
    setOpenDropdown(null);

    // Handle different actions
    switch (action) {
      case 'activate':
        setUsers(
          users.map((u) => (u.id === user.id ? { ...u, active_flag: true } : u))
        );
        updateUserstatus(user.id, 'Active');
        break;
      case 'deactivate':
        setUsers(
          users.map((u) =>
            u.id === user.id ? { ...u, active_flag: false } : u
          )
        );
        updateUserstatus(user.id, 'Inactive');
        break;
      case 'lock':
        setUsers(
          users.map((u) =>
            u.id === user.id ? { ...u, account_locked: true } : u
          )
        );
        break;
      case 'unlock':
        setUsers(
          users.map((u) =>
            u.id === user.id ? { ...u, account_locked: false } : u
          )
        );
        break;
      case 'reset_password':
        alert(`Password reset email sent to ${user.email_id}`);
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete ${user.full_name}?`)) {
          setUsers(users.filter((u) => u.id !== user.id));
        }
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const getStatusBadge = (user: UserOnboardingData) => {
    if (user.account_locked) {
      return (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            theme === 'dark'
              ? 'bg-red-500/20 text-red-300'
              : 'bg-red-100 text-red-700'
          }`}
        >
          Locked
        </span>
      );
    }
    if (user.active_flag) {
      return (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            theme === 'dark'
              ? 'bg-green-500/20 text-green-300'
              : 'bg-green-100 text-green-700'
          }`}
        >
          Active
        </span>
      );
    }
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          theme === 'dark'
            ? 'bg-gray-500/20 text-gray-300'
            : 'bg-gray-200 text-gray-700'
        }`}
      >
        Inactive
      </span>
    );
  };

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.active_flag).length;
    const lockedUsers = users.filter((u) => u.account_locked).length;
    const verifiedEmails = users.filter((u) => u.email_verified).length;
    const mfaEnabled = users.filter((u) => u.mfa_enabled).length;

    return {
      totalUsers,
      activeUsers,
      lockedUsers,
      verifiedEmails,
      mfaEnabled,
    };
  }, [users]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={`rounded-2xl border shadow-2xl overflow-hidden ${
        theme === 'dark'
          ? 'bg-white/10 border-white/20'
          : 'bg-white border-gray-200 shadow-card'
      } backdrop-blur-xl ${fullWidth ? 'col-span-full' : ''}`}
    >
      <div
        className={`flex justify-between items-center p-6 border-b ${
          theme === 'dark' ? 'border-white/20' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
            <UserCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2
              className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              User Management
            </h2>
            <p
              className={`text-sm ${
                theme === 'dark' ? 'text-blue-200/70' : 'text-blue-600'
              }`}
            >
              User registration & account management
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <div className="relative">
              <Search
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                  theme === 'dark'
                    ? ' border-white text-white'
                    : 'border-gray-400 '
                }`}
              />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => {
                  setFilters({ ...filters, search: e.target.value });
                }}
                placeholder="Search..."
                className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  theme === 'dark'
                    ? 'bg-white/80 border-white/40 border background-color:#ccd1d7 text-white/80 placeholder-white'
                    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
          </div>

          {processedData.length > 0 && (
            <div
              className={`p-4 ${
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-end">
                <button
                  onClick={exportToExcel}
                  disabled={exportLoading || processedData.length === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    exportLoading || processedData.length === 0
                      ? theme === 'dark'
                        ? 'bg-gray-500/30 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : theme === 'dark'
                      ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                      : 'bg-green-100 hover:bg-green-200 text-green-800 border border-green-300'
                  }`}
                >
                  {exportLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4" />
                  )}
                  {exportLoading ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
              showFilters
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : theme === 'dark'
                ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
          <button
            onClick={() => {
              setFilters({
                search: '',
                account_status: '',
                user_status: '',
                user_roles: '',
              });
              setSortBy('last_login');
              setSortOrder('desc');
              setPagination((prev) => ({ ...prev, page: 1 }));
              loadUsers();
            }}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
              theme === 'dark'
                ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[350px] space-y-4">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <div className="text-center">
              <div
                className={`font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Loading user onboarding data...
              </div>
              <div
                className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}
              >
                Please wait while we fetch the users
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className={`rounded-xl border p-4 mb-6 overflow-hidden ${
                    theme === 'dark'
                      ? 'bg-white/5 border-white/20'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3
                      className={`font-semibold flex items-center gap-2 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                      Advanced Filters
                    </h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className={`p-1.5 rounded-lg ${
                        theme === 'dark'
                          ? 'hover:bg-white/10 text-white/60'
                          : 'hover:bg-gray-200 text-gray-500'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                        }`}
                      >
                        Account Status
                      </label>
                      <select
                        value={filters.account_status}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            account_status: e.target.value,
                          }))
                        }
                        className={`w-full px-3 py-2 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          theme === 'dark'
                            ? 'bg-white/10 border border-white/20 text-white'
                            : 'bg-white border border-gray-300 text-gray-900'
                        }`}
                      >
                        <option value="">All Status</option>
                        <option value="Locked">Locked</option>
                        <option value="Unlocked">Unlocked</option>
                      </select>
                    </div>

                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                        }`}
                      >
                        User Status
                      </label>
                      <select
                        value={filters.user_status}
                        onChange={(e) => {
                          setFilters({
                            ...filters,
                            user_status: e.target.value,
                          });
                          setPagination((prev) => ({ ...prev, page: 1 }));
                        }}
                        className={`w-full px-3 py-2 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          theme === 'dark'
                            ? 'bg-white/10 border border-white/20 text-white'
                            : 'bg-white border border-gray-300 text-gray-900'
                        }`}
                      >
                        <option value="">All Users</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>

                    <div>
                      <label
                        className={`block text-sm font-medium mb-2 ${
                          theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                        }`}
                      >
                        Sort By
                      </label>
                      <div className="relative">
                        <select
                          value={`${sortBy}-${sortOrder}`}
                          onChange={(e) => {
                            const [newSortBy, newSortOrder] =
                              e.target.value.split('-') as [
                                typeof sortBy,
                                'asc' | 'desc'
                              ];
                            setSortBy(newSortBy);
                            setSortOrder(newSortOrder);
                          }}
                          className={`w-full px-3 py-2 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            theme === 'dark'
                              ? 'bg-white/10 border border-white/20 text-white'
                              : 'bg-white border border-gray-300 text-gray-900'
                          }`}
                        >
                          <option value="last_login-desc">
                            Last Login: Recent First
                          </option>
                          <option value="last_login-asc">
                            Last Login: Oldest First
                          </option>
                          <option value="username-asc">Username: A to Z</option>
                          <option value="username-desc">
                            Username: Z to A
                          </option>
                          <option value="email_id-asc">Email: A to Z</option>
                          <option value="email_id-desc">Email: Z to A</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setFilters({
                          search: '',
                          account_status: '',
                          user_status: '',
                          user_roles: '',
                        });
                        setSortBy('last_login');
                        setSortOrder('desc');
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'bg-white/10 hover:bg-white/20 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      Reset Filters
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div
                className={`p-4 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30'
                    : 'bg-gradient-to-br from-blue-100 to-cyan-100 border-blue-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-blue-400" />
                  <span
                    className={`text-sm font-medium ${
                      theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                    }`}
                  >
                    Total Users
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {stats.totalUsers}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30'
                    : 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span
                    className={`text-sm font-medium ${
                      theme === 'dark' ? 'text-green-300' : 'text-green-700'
                    }`}
                  >
                    Active Users
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {stats.activeUsers}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30'
                    : 'bg-gradient-to-br from-red-100 to-orange-100 border-red-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span
                    className={`text-sm font-medium ${
                      theme === 'dark' ? 'text-red-300' : 'text-red-700'
                    }`}
                  >
                    Locked Accounts
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {stats.lockedUsers}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border-yellow-500/30'
                    : 'bg-gradient-to-br from-yellow-100 to-amber-100 border-yellow-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-yellow-400" />
                  <span
                    className={`text-sm font-medium ${
                      theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'
                    }`}
                  >
                    Verified Emails
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {stats.verifiedEmails}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30'
                    : 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span
                    className={`text-sm font-medium ${
                      theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                    }`}
                  >
                    MFA Enabled
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {stats.mfaEnabled}
                </div>
              </div>
            </div> */}

            <div
              className={`rounded-xl border overflow-hidden ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div
                className={`p-4 border-b ${
                  theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <h3
                    className={`font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    User List
                  </h3>

                  {processedData.length > 0 && (
                    <div
                      className={`text-xs ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}
                    >
                      {searchTerm ||
                      filters.account_status ||
                      filters.user_status
                        ? 'Filtered results'
                        : 'All users'}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto relative">
                <table className="w-full">
                  <thead
                    className={`${
                      theme === 'dark'
                        ? 'bg-white/5 border-b border-white'
                        : 'bg-gray-50 border-b border-black'
                    }`}
                  >
                    <tr>
                      <th
                        className={`px-4 py-3 text-left text-xs font-semibold ${
                          theme === 'dark'
                            ? 'text-white/70 border-b border-white'
                            : 'text-gray-700 border-b border-black'
                        }`}
                      >
                        User
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-semibold ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                        }`}
                      >
                        Email
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-semibold ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                        }`}
                      >
                        Role
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-semibold ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                        }`}
                      >
                        Status
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-semibold ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                        }`}
                      >
                        Failed Count
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-semibold ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                        }`}
                      >
                        Account
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-semibold ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                        }`}
                      >
                        Last Login
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-semibold ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                        }`}
                      >
                        MFA
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-semibold ${
                          theme === 'dark' ? 'text-white/70' : 'text-gray-700'
                        }`}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <AnimatePresence>
                    <tbody>
                      {processedData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center">
                            <AlertCircle
                              className={`w-8 h-8 mx-auto mb-2 ${
                                theme === 'dark'
                                  ? 'text-white/40'
                                  : 'text-gray-400'
                              }`}
                            />
                            <p
                              className={`${
                                theme === 'dark'
                                  ? 'text-white/60'
                                  : 'text-gray-600'
                              }`}
                            >
                              No users found
                            </p>
                            {(searchTerm ||
                              filters.account_status ||
                              filters.user_status) && (
                              <button
                                onClick={() => {
                                  setSearchTerm('');
                                  setFilters({
                                    search: '',
                                    account_status: '',
                                    user_status: '',
                                    user_roles: '',
                                  });
                                }}
                                className={`mt-2 text-sm ${
                                  theme === 'dark'
                                    ? 'text-blue-400 hover:text-blue-300'
                                    : 'text-blue-600 hover:text-blue-700'
                                }`}
                              >
                                Clear filters
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        processedData.map((user, index) => {
                          const uniqueKey = `${user.id}-${index}-${pagination.page}`;

                          return (
                            <tr
                              key={uniqueKey}
                              className={`border-b ${
                                theme === 'dark'
                                  ? 'border-white/10'
                                  : 'border-gray-100'
                              } hover:bg-blue-500/5 transition-colors`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`p-2 rounded-lg ${
                                      theme === 'dark'
                                        ? 'bg-white/10'
                                        : 'bg-gray-100'
                                    }`}
                                  >
                                    <User className="w-4 h-4 text-blue-400" />
                                  </div>
                                  <div>
                                    <div
                                      className={`font-medium ${
                                        theme === 'dark'
                                          ? 'text-white'
                                          : 'text-gray-900'
                                      }`}
                                    >
                                      {user.full_name}
                                    </div>
                                    <div
                                      className={`text-xs ${
                                        theme === 'dark'
                                          ? 'text-white/50'
                                          : 'text-gray-500'
                                      }`}
                                    >
                                      {user.username}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm ${
                                      theme === 'dark'
                                        ? 'text-white/80'
                                        : 'text-gray-700'
                                    }`}
                                  >
                                    {user.email_id}
                                  </span>
                                  {user.email_verified ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    theme === 'dark'
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                      : 'bg-purple-100 text-purple-700 border border-purple-300'
                                  }`}
                                >
                                  {user.user_roles}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {getStatusBadge(user)}
                              </td>
                              <td className="flex px-4 py-3 items-center">
                                {user.login_attempts > 0 ? (
                                  <span className="bg-red-600 text-white"></span>
                                ) : (
                                  <span className="bg-green-800 text-white"></span>
                                )}
                                {user.login_attempts}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {user.account_status.toLowerCase() ===
                                  'locked' ? (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                        theme === 'dark'
                                          ? 'bg-red-600 text-white'
                                          : 'bg-gray-500/20  text-red-500'
                                      }`}
                                    >
                                      <Lock className="w-3 h-3" />
                                      {user.account_status}
                                    </span>
                                  ) : (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                        theme === 'dark'
                                          ? 'bg-green-600 text-white'
                                          : 'bg-gray-500/20 text-green-600'
                                      } `}
                                    >
                                      <Unlock className="w-3 h-3" />
                                      {user.account_status}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div
                                  className={`flex items-start gap-2 ${
                                    theme === 'dark'
                                      ? 'text-white/80'
                                      : 'text-gray-700'
                                  }`}
                                >
                                  <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">
                                      {formatDate(user.last_login).date}
                                    </span>
                                    {formatDate(user.last_login).time && (
                                      <span
                                        className={`text-xs ${
                                          theme === 'dark'
                                            ? 'text-white/50'
                                            : 'text-gray-500'
                                        } mt-0.5`}
                                      >
                                        {formatDate(user.last_login).time}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {user.mfa_enabled ? (
                                  <CheckCircle className="w-5 h-5 text-green-400" />
                                ) : (
                                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button
                                    className={`p-1.5 rounded-lg ${
                                      theme === 'dark'
                                        ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                    }`}
                                    title="View Details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleEditUser(user)}
                                    className={`p-1.5 rounded-lg ${
                                      theme === 'dark'
                                        ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                    }`}
                                    title="Edit"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <div className="relative dropdown-container">
                                    <button
                                      onClick={() =>
                                        setOpenDropdown(
                                          openDropdown === user.id
                                            ? null
                                            : user.id
                                        )
                                      }
                                      className={`p-1.5 rounded-lg ${
                                        theme === 'dark'
                                          ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300'
                                          : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                      }`}
                                      title="More"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>

                                    {openDropdown === user.id && (
                                      <div
                                        className={`${
                                          index >= processedData.length - 4
                                            ? ' fixed'
                                            : 'absolute'
                                        } right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-2xl border border-gray-200 py-1 z-50 transform translate-y-2`}
                                        style={{
                                          top: '100%',
                                          transform:
                                            index >= processedData.length - 4
                                              ? 'translateY(calc(-100% - 40px))'
                                              : 'translateY(0)',
                                        }}
                                      >
                                        {user.active_flag ? (
                                          <button
                                            onClick={() =>
                                              handleUserAction(
                                                'deactivate',
                                                user
                                              )
                                            }
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                          >
                                            <UserX className="w-4 h-4" />
                                            Deactivate User
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() =>
                                              handleUserAction('activate', user)
                                            }
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                          >
                                            <UserCheck className="w-4 h-4 text-green-600" />
                                            Activate User
                                          </button>
                                        )}

                                        {user.account_locked ? (
                                          <button
                                            onClick={() =>
                                              handleUserAction('unlock', user)
                                            }
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                          >
                                            <Unlock className="w-4 h-4 text-green-600" />
                                            Unlock Account
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() =>
                                              handleUserAction('lock', user)
                                            }
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                          >
                                            <Lock className="w-4 h-4" />
                                            Lock Account
                                          </button>
                                        )}

                                        <button
                                          onClick={() =>
                                            handleUserAction(
                                              'reset_password',
                                              user
                                            )
                                          }
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                          <Key className="w-4 h-4" />
                                          Reset Password
                                        </button>

                                        <button
                                          onClick={() =>
                                            handleUserAction('send_email', user)
                                          }
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                          <Send className="w-4 h-4" />
                                          Send Email
                                        </button>

                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(
                                              user.email_id
                                            );
                                            alert('Email copied to clipboard!');
                                            setOpenDropdown(null);
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                          <Copy className="w-4 h-4" />
                                          Copy Email
                                        </button>

                                        <div className="border-t border-gray-200 my-1"></div>

                                        <button
                                          onClick={() =>
                                            handleUserAction('delete', user)
                                          }
                                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          Delete User
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </AnimatePresence>
                </table>
              </div>

              {pagination.total_pages > 1 && (
                <div
                  className={`p-4 border-t ${
                    theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div
                      className={`text-sm ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}
                    >
                      Showing {(pagination.page - 1) * pagination.page_size + 1}{' '}
                      to{' '}
                      {Math.min(
                        pagination.page * pagination.page_size,
                        pagination.total
                      )}{' '}
                      of {pagination.total} users
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            page: Math.max(1, prev.page - 1),
                          }))
                        }
                        disabled={pagination.page === 1}
                        className={`p-2 rounded-lg transition-colors ${
                          pagination.page === 1
                            ? theme === 'dark'
                              ? 'bg-white/5 text-white/30 cursor-not-allowed'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : theme === 'dark'
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: Math.min(5, pagination.total_pages) },
                          (_, i) => {
                            let pageToShow;
                            if (pagination.total_pages <= 5) {
                              pageToShow = i + 1;
                            } else if (pagination.page <= 3) {
                              pageToShow = i + 1;
                            } else if (
                              pagination.page >=
                              pagination.total_pages - 2
                            ) {
                              pageToShow = pagination.total_pages - 4 + i;
                            } else {
                              pageToShow = pagination.page - 2 + i;
                            }

                            return (
                              <button
                                key={pageToShow}
                                onClick={() =>
                                  setPagination((prev) => ({
                                    ...prev,
                                    page: pageToShow,
                                  }))
                                }
                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
                                  pagination.page === pageToShow
                                    ? theme === 'dark'
                                      ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                                      : 'bg-blue-100 text-blue-700 border border-blue-300'
                                    : theme === 'dark'
                                    ? 'bg-white/10 hover:bg-white/20 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                              >
                                {pageToShow}
                              </button>
                            );
                          }
                        )}

                        {pagination.total_pages > 5 &&
                          pagination.page < pagination.total_pages - 2 && (
                            <>
                              <span
                                className={
                                  theme === 'dark'
                                    ? 'text-white/50'
                                    : 'text-gray-500'
                                }
                              >
                                ...
                              </span>
                              <button
                                onClick={() =>
                                  setPagination((prev) => ({
                                    ...prev,
                                    page: pagination.total_pages,
                                  }))
                                }
                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                                  theme === 'dark'
                                    ? 'bg-white/10 hover:bg-white/20 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                              >
                                {pagination.total_pages}
                              </button>
                            </>
                          )}
                      </div>

                      <button
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            page: Math.min(
                              pagination.total_pages,
                              prev.page + 1
                            ),
                          }))
                        }
                        disabled={pagination.page === pagination.total_pages}
                        className={`p-2 rounded-lg transition-colors ${
                          pagination.page === pagination.total_pages
                            ? theme === 'dark'
                              ? 'bg-white/5 text-white/30 cursor-not-allowed'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : theme === 'dark'
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default UserManagement;
