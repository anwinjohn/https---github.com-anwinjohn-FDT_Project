import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../components/notifications';
import { appConfig as config } from '../config/runtime-config';
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle,
  User,
  Fingerprint,
  Smartphone,
  Globe,
  Activity,
  Zap,
  Brain,
  TrendingUp,
  ScanFace,
} from 'lucide-react';
import FaceIdLogin from './FaceIdLogin';
import { useLocalMachine } from '../context/DeviceInfoContext';
import { useSystemSettings } from '../hooks/useSystemSettings';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { machineInfo, loading, available } = useLocalMachine();
  const [username, setUsername] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const {
    fetchSettings,
    settings,
    loading: settingsLoading,
  } = useSystemSettings();
  const [isLDAPEnabled, setIsLDAPEnabled] = useState(false);

  useEffect(() => {
    if (machineInfo && !loading && isLDAPEnabled) {
      setIsLoading(false);
      const detectedUser = machineInfo?.UserName;
      if (detectedUser) {
        setUsername(detectedUser);
        setIsReadOnly(true);
      } else {
        setUsername('');
        setIsReadOnly(false);
      }
    }
  }, [machineInfo]);

  useEffect(() => {
    const loadLdapSettings = async () => {
      await fetchSettings('LDAP_LOGIN');
    };
    loadLdapSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const ldapValue = settings.get('LDAP_LOGIN');
    //console.log('LDAP_LOGIN value from settings:', ldapValue);
    if (ldapValue !== undefined) {
      const isEnabled = Boolean(ldapValue);
      setIsLDAPEnabled(isEnabled);
      //console.log('LDAP Login enabled:', isEnabled);
    }
  }, [settings]);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMethod, setAuthMethod] = useState('password');
  const [step, setStep] = useState('login');
  const [showFaceId, setShowFaceId] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && step !== 'success' && step !== 'login') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate, step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    //  console.log( name === 'rememberMe' ? checked : value);
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (error) setError('');
  };

  const handleFaceIdSuccess = () => {
    setStep('success');
    // Navigate after animation completes
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
  };

  const handleFaceIdBack = () => {
    setShowFaceId(false);
  };

  const logoPath = config.dashboard.logo;
  const appName = config.app.name;
  const appShortName = config.app.shortName;

  interface MachineInfo {
    UserName: string;
    Domain: string;
    Identity: string;
    MachineName: string;
    Network: string;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(
        username,
        formData.password,
        isLDAPEnabled,
        machineInfo
      );
      if (success) {
        setStep('success');
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      addNotification(
        'Unable to connect to authentication service. Please try again.',
        'error',
        6000,
        'Connection Error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthMethodChange = (methodId: string) => {
    setAuthMethod(methodId);
    if (methodId === 'faceid') {
      setShowFaceId(true);
    }
  };

  // Filter auth methods based on config
  const authMethods = [
    {
      id: 'password',
      label: 'Password',
      icon: Lock,
      description: 'Standard login',
    },
    { id: 'faceid', label: 'Face ID', icon: ScanFace, description: 'Face ID' },
    {
      id: 'sms',
      label: 'SMS',
      icon: Smartphone,
      description: 'SMS verification',
    },
  ].filter((method) => config.auth.methods[method.id]);

  const handleForgotPassword = () => {
    navigate('/change-password', {
      state: {
        forced: false,
        username: username,
      },
    });
  };

  const securityFeatures = [
    // { icon: Shield, text: 'Enterprise Security', description: 'Bank-grade encryption' },
    {
      icon: Zap,
      text: 'Real-time Detection',
      description: 'Instant threat response',
    },
    {
      icon: Brain,
      text: 'AI-Powered Analytics',
      description: 'Machine learning insights',
    },
  ];

  if (showFaceId) {
    return (
      <FaceIdLogin
        onSuccess={handleFaceIdSuccess}
        onBack={handleFaceIdBack}
        username={formData.username}
      />
    );
  }

  const stats = [
    { value: '99.9%', label: 'Uptime', icon: TrendingUp },
    { value: '24/7', label: 'Monitoring', icon: Activity },
    { value: 'Ai', label: 'Powered', icon: Brain },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Hard override so selected text in the login inputs is always legible,
          regardless of any pre-existing global .login-input selection styles */}
      <style>{`
        .login-input::selection {
          background-color: #3b82f6 !important;
          color: #ffffff !important;
        }
        .login-input::-moz-selection {
          background-color: #3b82f6 !important;
          color: #ffffff !important;
        }
      `}</style>
      {/* Enhanced Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              y: [null, -100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-[1680px] mx-auto flex lg:flex-row flex-col gap-10 lg:gap-8 items-center lg:items-stretch justify-between px-6 sm:px-10 lg:px-14 xl:px-20 z-0">
        {/* Left Side - Enhanced Branding & Info */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="hidden lg:flex lg:flex-col lg:justify-center space-y-10 w-full lg:w-[68%] xl:w-[70%] flex-shrink-0"
        >
          <div className="space-y-4">
            {/* Logo and Title */}
            <div className="flex items-center gap-4">
              <motion.div
                className="p-4 bg-gradient-to-br from-c-dark-blue-500 to-c-black-600 rounded-2xl shadow-2xl"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Shield className="w-12 h-12 text-white" />
              </motion.div>
              <div>
                <motion.h1
                  className="text-6xl font-bold bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {appShortName}
                </motion.h1>
                <motion.p
                  className="text-blue-200/80 text-lg mt-1 font-medium"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {appName}
                </motion.p>
              </div>
            </div>

            {/* Enhanced Description */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Advanced fraud monitoring
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  & analytics platform
                </span>
              </h2>
              <p className="text-white/70 text-lg leading-relaxed max-w-4xl">
                A comprehensive platform leveraging rule-based logic and
                artificial intelligence models to detect and prevent fraudulent
                activities in real time. The solution enables customization of
                detection rules, continuous monitoring of suspicious behavior,
                and delivery of actionable insights through intuitive and
                informative dashboards.
              </p>
            </motion.div>
          </div>

          {/* Enhanced Security Features */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <div className="grid sm:grid-cols-1 gap-6">
              {securityFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + index * 0.1 }}
                  whileHover={{ y: -3, scale: 1.02 }}
                  className="flex items-center gap-4 p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 group cursor-pointer max-w-[500px]"
                >
                  <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-all duration-300">
                    <feature.icon className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                  </div>
                  <div>
                    <span className="text-white/90 font-medium block">
                      {feature.text}
                    </span>
                    <span className="text-white/60 text-sm">
                      {feature.description}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Enhanced Stats */}
          <motion.div
            className="grid grid-cols-3 gap-4 max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -5, scale: 1.05 }}
                className="text-center p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 group"
              >
                <div className="flex justify-center mb-2">
                  <stat.icon className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
                </div>
                <div className="text-2xl font-bold text-white group-hover:text-blue-200 transition-colors">
                  {stat.value}
                </div>
                <div className="text-white/60 text-sm group-hover:text-white/80 transition-colors">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Vertical divider - subtle separation between panels on large screens */}
        <div className="hidden lg:block w-px self-stretch bg-gradient-to-b from-transparent via-white/15 to-transparent" />

        {/* Right Side - Enhanced Login Form */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full lg:w-[32%] xl:w-[30%] flex-shrink-0 flex lg:items-center"
        >
          <div className="w-full max-w-md mx-auto lg:mx-0">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300">
              {/* Mobile Header */}
              <div className="lg:hidden text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {appShortName}
                </h1>
                <p className="text-white/70">Secure Access Portal</p>
              </div>

              <AnimatePresence mode="wait">
                {/* Login Step */}
                {step === 'login' && (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Logo */}
                    <div className="flex justify-center mt-8">
                      <img
                        src={logoPath}
                        alt="Logo"
                        className="login-logo mb-4"
                      />
                    </div>
                    <div className="text-center mb-8">
                      {/* <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2> */}
                      <p className="text-white/70">
                        Sign in to access your dashboard
                      </p>
                    </div>

                    {/* Authentication Method Selector */}
                    {authMethods.length > 1 && (
                      <div className="mb-6">
                        <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
                          {authMethods.map((method) => (
                            <button
                              key={method.id}
                              onClick={() => handleAuthMethodChange(method.id)}
                              className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all duration-200 ${
                                authMethod === method.id
                                  ? 'bg-white/20 text-white shadow-lg scale-105'
                                  : 'text-white/60 hover:text-white hover:bg-white/10'
                              }`}
                            >
                              <method.icon className="w-5 h-5" />
                              <span className="text-xs font-medium">
                                {method.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Username Field - FIXED with dark background */}
                      <div className="space-y-2">
                        <label className="text-white/80 text-sm font-medium">
                          Username
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-5 w-5 text-blue-400 group-focus-within:text-blue-300 transition-colors" />
                          </div>
                          <input
                            type="text"
                            name="username"
                            value={username}
                            readOnly={isReadOnly}
                            autoComplete="username"
                            aria-label="Username"
                            onChange={(e) => setUsername(e.target.value)}
                            className="login-input w-full pl-10 pr-4 py-3 border-2 border-white/15 rounded-xl bg-white/[0.06] text-white placeholder-white/35 caret-white selection:bg-blue-500 selection:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm disabled:opacity-60"
                            placeholder="Enter your username"
                            required
                          />
                        </div>
                      </div>
                      {authMethod === 'password' && (
                        <div className="space-y-2">
                          <label className="text-white/80 text-sm font-medium">
                            Password
                          </label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Lock className="h-5 w-5 text-blue-400 group-focus-within:text-blue-300 transition-colors" />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              name="password"
                              value={formData.password}
                              onChange={handleInputChange}
                              autoComplete="current-password"
                              aria-label="Password"
                              className="login-input w-full pl-10 pr-12 py-3 border-2 border-white/15 rounded-xl bg-white/[0.06] text-white placeholder-white/35 caret-white selection:bg-blue-500 selection:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                              placeholder="Enter your password"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={
                                showPassword ? 'Hide password' : 'Show password'
                              }
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Remember Me & Forgot Password */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            name="rememberMe"
                            checked={formData.rememberMe}
                            onChange={handleInputChange}
                            className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2 transition-all"
                          />
                          <span className="text-white/70 text-sm group-hover:text-white/90 transition-colors">
                            Remember me
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors hover:underline"
                        >
                          Change Password?
                        </button>
                      </div>

                      {/* Enhanced Login Button */}
                      <motion.button
                        type="submit"
                        disabled={isLoading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                      >
                        {/* Button shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

                        {isLoading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                        ) : (
                          <>
                            Sign In
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </motion.button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer Links */}
              {step === 'login' && (
                <div className="mt-6 pt-6 border-t border-white/10 text-center">
                  <p className="text-white/60 text-sm">
                    Need help?{' '}
                    <button className="text-blue-400 hover:text-blue-300 font-medium transition-colors hover:underline">
                      Contact Support
                    </button>
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6 text-center">
              <p className="text-white/40 text-xs">
                © {new Date().getFullYear()} {appShortName} - {appName}. All
                rights reserved.
              </p>
            </div>
          </div>
        </motion.div>
        {/* Footer */}
      </div>

      {/* Welcome Modal - centered, full-screen overlay on successful login */}
      <AnimatePresence>
        {step === 'success' && (
          <motion.div
            key="success-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{
                duration: 0.4,
                type: 'spring',
                stiffness: 220,
                damping: 20,
              }}
              className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl"
              >
                <CheckCircle className="w-10 h-10 text-white" />
              </motion.div>
              <motion.h2
                className="text-2xl font-bold text-white mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Welcome to FDT!
              </motion.h2>
              <motion.p
                className="text-white/70 mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Login successful. Redirecting to dashboard...
              </motion.p>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: 'easeInOut' }}
                  className="h-full bg-gradient-to-r from-green-400 to-blue-400 rounded-full"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginPage;
