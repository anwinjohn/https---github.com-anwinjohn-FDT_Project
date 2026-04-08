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
import config from '../../config/app-config.json';

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

const UserOnboarding: React.FC = () => {
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

  // Load roles on component mount
  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${config.api.baseUrl}/api/admin/roles`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const rolesData = await response.json();
        setRoles(rolesData.filter((role: Role) => role.is_active));
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
      
      // Call API to fetch user data by ID
      const response = await fetch(`${config.api.baseUrl}/api/admin/fetch-userww/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const fetchedData = await response.json();
        setUserData({
          username: fetchedData.username || '',
          full_name: fetchedData.full_name || '',
          email_id: fetchedData.email_id || '',
          phone_number: fetchedData.phone_number || ''
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

      const response = await fetch(`${config.api.baseUrl}/api/admin/onboard-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(onboardingData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
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
        addNotification(result.message || 'Failed to onboard user', 'error');
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
            <h1 className="text-2xl font-bold text-white">User Onboarding</h1>
            <p className="text-white/60">Add new users to the system</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleManualEntry}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              manualEntry
                ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border border-blue-500/30'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
          >
            {manualEntry ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {manualEntry ? 'Fetch Mode' : 'Manual Entry'}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={clearForm}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Clear
          </motion.button>
        </div>
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* User Data Fetch/Entry Section */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 p-6">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            {manualEntry ? 'Manual User Entry' : 'Fetch User Data'}
          </h2>

          {!manualEntry && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-white/80 mb-2">User ID</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter User ID to fetch data"
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
              <label className="block text-sm font-medium text-white/80 mb-2">Username *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={userData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Full Name *</label>
              <input
                type="text"
                value={userData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                placeholder="Enter full name"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="email"
                  value={userData.email_id}
                  onChange={(e) => handleInputChange('email_id', e.target.value)}
                  placeholder="Enter email address"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="tel"
                  value={userData.phone_number}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Role Selection & Submit Section */}
        <div className="space-y-6">
          {/* Role Selection */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 p-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              Role Assignment
            </h2>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-white animate-spin" />
                <span className="ml-2 text-white/60">Loading roles...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {roles.map((role) => (
                  <motion.label
                    key={role.id}
                    whileHover={{ scale: 1.02 }}
                    className={`flex items-center p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedRole === role.id
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/40'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
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
                      <div className="text-white font-medium">{role.role_name}</div>
                      <div className="text-white/60 text-sm">{role.description}</div>
                    </div>
                  </motion.label>
                ))}
              </div>
            )}
          </div>

          {/* Submit Section */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Submit Onboarding</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <h3 className="text-white font-medium mb-2">Review Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/60">Username:</span>
                    <span className="text-white">{userData.username || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Full Name:</span>
                    <span className="text-white">{userData.full_name || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Email:</span>
                    <span className="text-white">{userData.email_id || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Role:</span>
                    <span className="text-white">
                      {selectedRole ? roles.find(r => r.id === selectedRole)?.role_name : 'Not selected'}
                    </span>
                  </div>
                </div>
              </div>

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
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default UserOnboarding;