import React, { useState, useEffect } from 'react';
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
  Upload
} from 'lucide-react';
import { useNotifications } from '../notifications';
import { useTheme } from '../../context/ThemeContext';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';

// Menu ID for User Onboarding (should match database)
const USER_ONBOARDING_MENU_ID = 15; // Adjust based on your database

interface UserData {
  username: string;
  full_name: string;
  email_id: string;
  phone_number: string;
}

interface Role {
  id: number;
  role_name: string;
  description: string;
  is_active: boolean;
}

const SecureUserOnboarding: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [userData, setUserData] = useState<UserData>({
    username: '',
    full_name: '',
    email_id: '',
    phone_number: ''
  });
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchSuccess, setFetchSuccess] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  
  const { addNotification } = useNotifications();
  const { theme } = useTheme();

  // Load roles on component mount
  useEffect(() => {
    loadRoles();
  }, []);

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
      console.error('Error loading roles:', error);
      addNotification('Error loading roles', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserData = async () => {
    if (!userId.trim()) {
      addNotification('Please enter a User ID', 'warning');
      return;
    }

    try {
      setIsFetching(true);
      setFetchSuccess(false);
      
      const response = await apiClient.get(`/api/admin/fetch-user/${userId}`);

      if (response.success && response.data) {
        setUserData({
          username: response.data.username || '',
          full_name: response.data.full_name || '',
          email_id: response.data.email_id || '',
          phone_number: response.data.phone_number || ''
        });
        setFetchSuccess(true);
        addNotification('User data fetched successfully', 'success');
      } else {
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
    setUserData(prev => ({
      ...prev,
      [field]: value
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
      
      const onboardingData = {
        ...userData,
        role_id: selectedRole,
        source_user_id: userId || null,
        manual_entry: manualEntry
      };

      const response = await apiClient.post('/api/admin/onboard-user', onboardingData);

      if (response.success) {
        addNotification('User onboarded successfully!', 'success');
        // Reset form
        setUserId('');
        setUserData({
          username: '',
          full_name: '',
          email_id: '',
          phone_number: ''
        });
        setSelectedRole(null);
        setFetchSuccess(false);
        setManualEntry(false);
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
      phone_number: ''
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
        <div className={`text-center py-20 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to access user onboarding.</p>
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
              <h1 className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Secure User Onboarding</h1>
              <p className={`${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Add new users to the system with proper authorization</p>
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
              {manualEntry ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* User Data Fetch/Entry Section */}
          <div className={`rounded-xl border p-6 ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/20' 
              : 'bg-gray-50 border-gray-200'
          } backdrop-blur-xl`}>
            <h2 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              <Search className="w-5 h-5 text-blue-400" />
              {manualEntry ? 'Manual User Entry' : 'Fetch User Data'}
            </h2>

            {!manualEntry && (
              <div className="mb-6">
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>User ID</label>
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
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 shadow-lg"
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
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Username *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={userData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="Enter username"
                    className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
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
                }`}>Full Name *</label>
                <input
                  type="text"
                  value={userData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  placeholder="Enter full name"
                  className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                    theme === 'dark' 
                      ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                      : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={userData.email_id}
                    onChange={(e) => handleInputChange('email_id', e.target.value)}
                    placeholder="Enter email address"
                    className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
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
                }`}>Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={userData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                    placeholder="Enter phone number"
                    className={`w-full pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      theme === 'dark' 
                        ? 'bg-white/10 border border-white/20 text-white placeholder-white/50' 
                        : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Role Selection & Submit Section */}
          <div className="space-y-6">
            {/* Role Selection */}
            <div className={`rounded-xl border p-6 ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/20' 
                : 'bg-gray-50 border-gray-200'
            } backdrop-blur-xl`}>
              <h2 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                <Shield className="w-5 h-5 text-purple-400" />
                Role Assignment
              </h2>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span className={`ml-2 ${
                    theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                  }`}>Loading roles...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {roles.map((role) => (
                    <motion.label
                      key={role.id}
                      whileHover={{ scale: 1.02 }}
                      className={`flex items-center p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                        selectedRole === role.id
                          ? theme === 'dark'
                            ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/40'
                            : 'bg-gradient-to-r from-purple-100 to-pink-100 border-purple-300'
                          : theme === 'dark'
                            ? 'bg-white/5 border-white/10 hover:bg-white/10'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role.id}
                        checked={selectedRole === role.id}
                        onChange={() => setSelectedRole(role.id)}
                        className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 focus:ring-purple-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{role.role_name}</div>
                        <div className={`text-sm ${
                          theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                        }`}>{role.description}</div>
                      </div>
                    </motion.label>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Section */}
            <div className={`rounded-xl border p-6 ${
              theme === 'dark' 
                ? 'bg-white/5 border-white/20' 
                : 'bg-gray-50 border-gray-200'
            } backdrop-blur-xl`}>
              <h2 className={`text-lg font-semibold mb-6 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Submit Onboarding</h2>
              
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border ${
                  theme === 'dark' 
                    ? 'bg-blue-500/10 border-blue-500/20' 
                    : 'bg-blue-100 border-blue-300'
                }`}>
                  <h3 className={`font-medium mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Review Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>Username:</span>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{userData.username || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>Full Name:</span>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{userData.full_name || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>Email:</span>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{userData.email_id || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>Role:</span>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                        {selectedRole ? roles.find(r => r.id === selectedRole)?.role_name : 'Not selected'}
                      </span>
                    </div>
                  </div>
                </div>

                <PermissionGuard menuId={USER_ONBOARDING_MENU_ID} action="create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={submitUserOnboarding}
                    disabled={isSubmitting || !userData.username || !userData.full_name || !userData.email_id || !selectedRole}
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