import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus,
  Search,
  User,
  Mail,
  Phone,
  Shield,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Download,
  Upload,
  X,
  ChevronDown,
  Filter,
  Star,
  Users,
  Briefcase,
  Lock,
  KeyRound,
  Vault,
} from 'lucide-react';
import { useNotifications } from '../notifications';
import { useTheme } from '../../context/ThemeContext';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';
import { useLocalMachine } from '../../context/DeviceInfoContext';

// Menu ID for User Onboarding (should match database)
const USER_ONBOARDING_MENU_ID = 15;

interface UserData {
  username: string;
  full_name: string;
  email_id: string;
  phone_number: string;
  title: string;
  department: string;
}

interface Role {
  id: number;
  role_name: string;
  description: string;
  is_active: boolean;
  category: string;
  users_count?: number;
}

const SecureUserOnboarding: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [userData, setUserData] = useState<UserData>({
    username: '',
    full_name: '',
    email_id: '',
    phone_number: '',
    title: '',
    department: '',
  });
  const [readonlyFields, setReadonlyFields] = useState({
    username: false,
    full_name: false,
    email_id: false,
    phone_number: false,
    title: false,
    department: false,
  });
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchSuccess, setFetchSuccess] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);

  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const { machineInfo, loading, available } = useLocalMachine();

  const { addNotification } = useNotifications();
  const { theme } = useTheme();

  useEffect(() => {
    loadRoles();
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(roles.map((r) => r.category || 'Uncategorized'))
    );
    return ['all', ...unique];
  }, [roles]);

  const selectedRoleData = useMemo(() => {
    return roles.find((r) => r.id === selectedRole) || null;
  }, [roles, selectedRole]);

  const getCategoryColor = (category: string) => {
    switch (category.trim()) {
      case 'Administrative':
        return 'from-purple-600 to-pink-500 border-purple-400/50 text-white';
      case 'Analytics':
        return 'from-blue-600 to-cyan-500 border-blue-400/50 text-white';
      case 'Management':
        return 'from-green-600 to-emerald-500 border-green-400/50 text-white';
      default:
        return 'from-gray-700 to-gray-600 border-gray-400/30 text-gray-100';
    }
  };
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'administrative':
        return <Shield className="w-4 h-4" />;
      case 'Management':
        return <Briefcase className="w-4 h-4" />;
      case 'Engineering':
        return <Users className="w-4 h-4" />;
      default:
        return <Star className="w-4 h-4" />;
    }
  };
  const filteredRoles = useMemo(() => {
    return roles.filter((role) => {
      const matchesCategory =
        selectedCategory === 'all' || role.category === selectedCategory;
      const matchesSearch = role.role_name
        .toLowerCase()
        .includes(roleSearchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [roles, selectedCategory, roleSearchQuery]);

  const loadRoles = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/api/admin/roles');
      if (response.success && response.data) {
        setRoles(response.data.filter((role: Role) => role.is_active));
      } else {
        addNotification('Failed to load roles', 'error');
      }
    } catch (error) {
      addNotification('Error loading roles', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const fetchUserData = async () => {
    setUserData({
      username: '',
      full_name: '',
      email_id: '',
      phone_number: '',
      title: '',
      department: '',
    });

    if (!userId.trim()) {
      addNotification('Please enter a User ID', 'warning');
      return;
    }

    try {
      setIsFetching(true);
      setFetchSuccess(false);

      const request = { user_id: userId.trim() };
      const response = await apiClient.post<any>('/admin/fetch-user', request);

      //const response = await apiClient.post<any>("/admin/fetch-user", request);
      if (response?.success && response.data?.user) {
        const user = response.data?.user;

        const mappedData = {
          username: user.UserLoginId || '',
          full_name: user.FullName || '',
          email_id: user.EmailId || '',
          phone_number: (user.Phone || '').replace(/[^\d+]/g, ''),
          title: user.Title || '',
          department: user.Department || '',
        };
        setUserData(mappedData);

        setReadonlyFields({
          username: !!mappedData.username,
          full_name: !!mappedData.full_name,
          email_id: !!mappedData.email_id,
          phone_number: !!mappedData.phone_number,
          title: !!mappedData.title,
          department: !!mappedData.department,
        });

        setFetchSuccess(true);
        addNotification('User data fetched successfully', 'success');
      } else {
        setReadonlyFields({
          username: false,
          full_name: false,
          email_id: false,
          phone_number: false,
          title: false,
          department: false,
        });

        addNotification('User not found or error fetching data', 'error');
        setFetchSuccess(false);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      addNotification('Error fetching user data', 'error');
      setFetchSuccess(false);
    } finally {
      setIsFetching(false);
    }
  };

  const handleInputChange = (field: keyof UserData, value: string) => {
    setUserData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setFetchSuccess(false); // Reset fetch success when manually editing
  };

  const validateForm = () => {
    if (!userData.username.trim()) {
      addNotification('Username is required', 'warning');
      return false;
    }
    if (!userData.full_name.trim()) {
      addNotification('Full name is required', 'warning');
      return false;
    }
    if (!userData.email_id.trim()) {
      addNotification('Email is required', 'warning');
      return false;
    }
    if (!selectedRole) {
      addNotification('Please select a role', 'warning');
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email_id)) {
      addNotification('Please enter a valid email address', 'warning');
      return false;
    }

    return true;
  };

  const submitUserOnboarding = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      const authToken = localStorage.getItem('authToken');

      const onboardingData = {
        ...userData,
        role_id: selectedRole,
        source_user_id: userId || null,
        manual_entry: manualEntry,
        machineInfo,
      };
      const response = await apiClient.post(
        '/admin/onboard-user',
        onboardingData
      );

      const resp_data = response.data;

      if (response.success && resp_data) {
        const status_code = resp_data.status_code;

        if (status_code != 200) {
          addNotification(resp_data.detail, 'warning');
        }
        if (status_code == 200) {
          addNotification('User onboarded successfully!', 'success');
          // Reset form
          setUserId('');
          setUserData({
            username: '',
            full_name: '',
            email_id: '',
            phone_number: '',
            title: '',
            department: '',
          });
          setSelectedRole(null);
          setFetchSuccess(false);
          setManualEntry(false);
        }
      } else {
        addNotification(response.error || 'Failed to onboard user', 'error');
      }
    } catch (error) {
      console.error('Error onboarding user:', error);
      addNotification('Error onboarding user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearForm = () => {
    setUserId('');
    setUserData({
      username: '',
      full_name: '',
      email_id: '',
      phone_number: '',
      title: '',
      department: '',
    });
    setSelectedRole(null);
    setFetchSuccess(false);
    setManualEntry(false);
  };

  const toggleManualEntry = () => {
    setManualEntry(!manualEntry);
    if (!manualEntry) {
      // Switching to manual entry
      setUserId('');
      setFetchSuccess(false);
    } else {
      // Switching back to fetch mode
      clearForm();
    }
  };

  return (
    <PermissionGuard
      menuId={USER_ONBOARDING_MENU_ID}
      action="view"
      fallback={
        <div
          className={`text-center py-20 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">
            You don't have permission to access user onboarding.
          </p>
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className={`text-2xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                New User Onboarding
              </h1>
              <p
                className={`${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}
              >
                Add new users to the system with proper authorization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleManualEntry}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
                manualEntry
                  ? theme === 'dark'
                    ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30'
                    : 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border-blue-300'
                  : theme === 'dark'
                    ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
              }`}
            >
              {manualEntry ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              {manualEntry ? 'Fetch Mode' : 'Manual Entry'}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={clearForm}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                theme === 'dark'
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              Clear
            </motion.button>
          </div>
        </div>

        {/* Main Form */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* User Data Fetch/Entry Section */}
          <div
            className={`rounded-xl lg:col-span-2 items-center border p-6 ${
              theme === 'dark'
                ? 'bg-white/5 border-white/20'
                : 'bg-gray-50 border-gray-200'
            } backdrop-blur-xl`}
          >
            <h2
              className={`text-lg font-semibold mb-6 flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              <Search className="w-5 h-5 text-blue-400" />
              {manualEntry ? 'Manual User Entry' : 'Fetch User Data'}
            </h2>

            {!manualEntry && (
              <div className="mb-6">
                <label
                  className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                  }`}
                >
                  User ID
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Enter User ID to fetch data"
                    className={`flex-1 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      theme === 'dark'
                        ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                        : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={fetchUserData}
                    disabled={isFetching || !userId.trim()}
                    className={`px-6 py-3 ${
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-red-800 to-red-600'
                        : 'bg-gradient-to-r from-red-800 to-red-600'
                    }  hover:from-red-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 shadow-lg`}
                  >
                    {isFetching ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>

                {fetchSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex items-center gap-2 text-green-300 text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    User data fetched successfully
                  </motion.div>
                )}
              </div>
            )}

            {/* User Data Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}
                  >
                    Username *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={userData.username}
                      onChange={(e) =>
                        handleInputChange('username', e.target.value)
                      }
                      placeholder="Enter username"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        theme === 'dark'
                          ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      readOnly={readonlyFields.username}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}
                  >
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={userData.full_name}
                    onChange={(e) =>
                      handleInputChange('full_name', e.target.value)
                    }
                    placeholder="Enter full name"
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      theme === 'dark'
                        ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                        : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    readOnly={readonlyFields.full_name}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}
                  >
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={userData.email_id}
                      onChange={(e) =>
                        handleInputChange('email_id', e.target.value)
                      }
                      placeholder="Enter email address"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        theme === 'dark'
                          ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      readOnly={readonlyFields.email_id}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}
                  >
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={userData.phone_number}
                      onChange={(e) =>
                        handleInputChange('phone_number', e.target.value)
                      }
                      placeholder="Enter phone number"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        theme === 'dark'
                          ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      readOnly={readonlyFields.phone_number}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}
                  >
                    Title
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={userData.title}
                      onChange={(e) =>
                        handleInputChange('title', e.target.value)
                      }
                      placeholder="Enter role title"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        theme === 'dark'
                          ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      readOnly={readonlyFields.phone_number}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}
                  >
                    Department
                  </label>
                  <div className="relative">
                    <Vault className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={userData.department}
                      onChange={(e) =>
                        handleInputChange('department', e.target.value)
                      }
                      placeholder="Enter department"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        theme === 'dark'
                          ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                          : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      readOnly={readonlyFields.department}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Role Selection & Submit Section */}
          <div
            className={` ${
              theme === 'dark'
                ? 'bg-white/5 backdrop-blur-xl border border-white/10 '
                : 'bg-gray-50 border-gray-200'
            } rounded-2xl p-6 shadow-xl`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <h2
                className={` ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                } text-xl font-semibold`}
              >
                Role Assignment
              </h2>
            </div>

            {/* Role Selector Dropdown */}
            <div className="relative mb-4">
              <button
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className={`w-full flex items-center justify-between px-4 py-4 border rounded-xl
                  ounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200
                  ${
                    theme === 'dark'
                      ? 'bg-white/10 border border-white/20 text-white placeholder-white/50'
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                  } ${
                    selectedRole
                      ? 'border-purple-500/50 ring-2 ring-purple-500/20'
                      : 'border-gray-50 hover:border-white/30'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-purple-400" />
                  {selectedRoleData ? (
                    <div className="text-left">
                      <div className="text-white font-medium">{}</div>
                      <div
                        className={`${
                          theme === 'dark' ? 'text-white/50' : 'text-gray-900'
                        } text-sm`}
                      >
                        {selectedRoleData.role_name}
                      </div>
                    </div>
                  ) : (
                    <span
                      className={`${
                        theme === 'dark' ? 'text-white/50' : 'text-gray-900'
                      }`}
                    >
                      Select a role...
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-white/50 transition-transform ${
                    isRoleDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Panel */}
              {isRoleDropdownOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-slate-800 border border-white/20 rounded-xl shadow-2xl overflow-hidden">
                  {/* Search and Filter Header */}
                  <div className="p-4 border-b border-white/10 space-y-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={roleSearchQuery}
                        onChange={(e) => setRoleSearchQuery(e.target.value)}
                        placeholder="Search roles..."
                        className="w-full pl-9 pr-4 py-2 bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Category Filter */}
                    <div className="flex gap-2 flex-wrap">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            selectedCategory === cat
                              ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                              : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {cat === 'all' ? 'All Roles' : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Roles List */}
                  <div className=" max-h-60 overflow-y-auto invisible-scrollbar">
                    {filteredRoles.length === 0 ? (
                      <div className="p-8 text-center text-white/50">
                        <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No roles found</p>
                      </div>
                    ) : (
                      <div className="p-2">
                        {filteredRoles.map((role) => (
                          <button
                            key={role.id}
                            onClick={() => {
                              setSelectedRole(role.id);
                              setIsRoleDropdownOpen(false);
                            }}
                            className={`w-full text-left p-3 rounded-lg mb-1 transition-all ${
                              selectedRole === role.id
                                ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/40'
                                : 'hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-white">
                                    {role.role_name}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs border bg-gradient-to-r ${getCategoryColor(
                                      role.category
                                    )}`}
                                  >
                                    {role.category}
                                  </span>
                                </div>
                                <p className="text-sm text-white/60 line-clamp-1">
                                  {role.description}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {role.users_count} users
                                  </span>
                                </div>
                              </div>
                              {selectedRole === role.id && (
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Role Detail Card */}
            {selectedRoleData && (
              <div
                className={` ${
                  theme === 'dark'
                    ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20'
                    : 'bg-gradient-to-r from-slate-700 to-slate-700/20 border-purple-500/20'
                }  rounded-xl p-4`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(selectedRoleData.category)}
                    <h3 className="font-semibold text-white">
                      {selectedRoleData.role_name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedRole(null)}
                    className={` ${
                      theme === 'dark'
                        ? 'hover:bg-white/10'
                        : 'hover:bg-white/20'
                    } p-1  rounded-lg transition-colors`}
                  >
                    <X
                      className={` ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-800'
                      }w-4 h-4 `}
                    />
                  </button>
                </div>
                <p className="text-sm text-white/70 mb-3">
                  {selectedRoleData.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-white/50">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {selectedRoleData.users_count} active users
                  </span>
                  <span
                    className={`px-2 py-1 rounded border bg-gradient-to-r ${getCategoryColor(
                      selectedRoleData.category
                    )}`}
                  >
                    {selectedRoleData.category}
                  </span>
                </div>
              </div>
            )}

            {/* Submit Section */}
            <div
              className={`rounded-xl border p-6 ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/20'
                  : 'bg-gray-50 border-gray-200'
              } backdrop-blur-xl mt-6`}
            >
              <h2
                className={`text-lg font-semibold mb-6 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                Submit Onboarding
              </h2>

              <div className="space-y-4">
                <div
                  className={`p-4 rounded-xl border ${
                    theme === 'dark'
                      ? 'bg-blue-500/10 border-blue-500/20'
                      : 'bg-blue-100 border-blue-300'
                  }`}
                >
                  <h3
                    className={`font-medium mb-2 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    Review Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span
                        className={
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }
                      >
                        Username:
                      </span>
                      <span
                        className={
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }
                      >
                        {userData.username || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span
                        className={
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }
                      >
                        Full Name:
                      </span>
                      <span
                        className={
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }
                      >
                        {userData.full_name || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span
                        className={
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }
                      >
                        Email:
                      </span>
                      <span
                        className={
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }
                      >
                        {userData.email_id || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span
                        className={
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }
                      >
                        Role:
                      </span>
                      <span
                        className={
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }
                      >
                        {selectedRole
                          ? roles.find((r) => r.id === selectedRole)?.role_name
                          : 'Not selected'}
                      </span>
                    </div>
                  </div>
                </div>

                <PermissionGuard
                  menuId={USER_ONBOARDING_MENU_ID}
                  action="create"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={submitUserOnboarding}
                    disabled={
                      isSubmitting ||
                      !userData.username ||
                      !userData.full_name ||
                      !userData.email_id ||
                      !selectedRole
                    }
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Onboard User
                      </>
                    )}
                  </motion.button>
                </PermissionGuard>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </PermissionGuard>
  );
};

export default SecureUserOnboarding;
