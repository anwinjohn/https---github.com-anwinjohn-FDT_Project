import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from './notifications';
import config from '../config/app-config.json';
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
  TrendingUp
} from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { addNotification } = useNotifications();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMethod, setAuthMethod] = useState('password');
  const [step, setStep] = useState('login');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && step !== 'success' && step !== 'login') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate, step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError('');
  };

  const logoPath = config.dashboard.logo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(formData.username, formData.password);

      if (success) {
        setStep('success');
        // Navigate after animation completes
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        addNotification(
          'Please check your credentials and try again.',
          'error',
          6000,
          'Authentication Failed'
        );
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

  // Filter auth methods based on config
  const authMethods = [
    { id: 'password', label: 'Password', icon: Lock, description: 'Standard login' },
    { id: 'biometric', label: 'Biometric', icon: Fingerprint, description: 'Fingerprint/Face ID' },
    { id: 'sms', label: 'SMS', icon: Smartphone, description: 'SMS verification' }
  ].filter(method => config.auth.methods[method.id]);

  const securityFeatures = [
    // { icon: Shield, text: 'Enterprise Security', description: 'Bank-grade encryption' },
    { icon: Zap, text: 'Real-time Detection', description: 'Instant threat response' },
    { icon: Brain, text: 'AI-Powered Analytics', description: 'Machine learning insights' }
  ];

  const stats = [
    { value: '99.9%', label: 'Uptime', icon: TrendingUp },
    { value: '24/7', label: 'Monitoring', icon: Activity },
    { value: 'AI', label: 'Powered', icon: Brain }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
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

      <div className="relative w-full max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 items-center z-10">
        {/* Left Side - Enhanced Branding & Info */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="hidden lg:block space-y-8"
        >
          <div className="space-y-6">
            {/* Logo and Title */}
            <div className="flex items-center gap-4">
              <motion.div
                className="p-4 bg-gradient-to-br from-c-dark-blue-500 to-c-black-600 rounded-2xl shadow-2xl"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
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
                  FDT
                </motion.h1>
                <motion.p
                  className="text-blue-200/80 text-lg mt-1 font-medium"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Fraud Monitoring Tool
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
              <h2 className="text-4xl font-bold text-white leading-tight">
                Advanced fraud monitoring<br />
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  & analytics platform
                </span>
              </h2>
              <p className="text-white/70 text-lg leading-relaxed max-w-lg">
                A rule-based platform designed to detect and prevent fraud in real time.
                Customize detection rules, monitor suspicious activity, and gain actionable
                insights through intuitive dashboards.
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
            <div className="space-y-4">
              {securityFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + index * 0.1 }}
                  whileHover={{ x: 10, scale: 1.02 }}
                  className="flex items-center gap-4 p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 group cursor-pointer"
                >
                  <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-all duration-300">
                    <feature.icon className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                  </div>
                  <div>
                    <span className="text-white/90 font-medium block">{feature.text}</span>
                    <span className="text-white/60 text-sm">{feature.description}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Enhanced Stats */}
          <motion.div
            className="grid grid-cols-3 gap-4"
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

        {/* Right Side - Enhanced Login Form */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-300">
            {/* Mobile Header */}
            <div className="lg:hidden text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
                  <Shield className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">FDT</h1>
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
                    <img src={logoPath} alt="Logo" className="login-logo mb-4" />
                  </div>
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
                    <p className="text-white/70">Sign in to access your dashboard</p>
                  </div>

                  {/* Authentication Method Selector */}
                  {authMethods.length > 1 && (
                    <div className="mb-6">
                      <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
                        {authMethods.map((method) => (
                          <button
                            key={method.id}
                            onClick={() => setAuthMethod(method.id)}
                            className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all duration-200 ${authMethod === method.id
                              ? 'bg-white/20 text-white shadow-lg scale-105'
                              : 'text-white/60 hover:text-white hover:bg-white/10'
                              }`}
                          >
                            <method.icon className="w-5 h-5" />
                            <span className="text-xs font-medium">{method.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Username Field - FIXED with dark background */}
                    <div className="space-y-2">
                      <label className="text-white/80 text-sm font-medium">Username</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-blue-400 group-focus-within:text-blue-300 transition-colors" />
                        </div>
                        <input
                          type="text"
                          name="username"
                          value={formData.username}
                          onChange={handleInputChange}
                          className="login-input w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                          placeholder="Enter your username"
                          required
                        />
                      </div>
                    </div>

                    {/* Password Field - FIXED with dark background */}
                    {authMethod === 'password' && (
                      <div className="space-y-2">
                        <label className="text-white/80 text-sm font-medium">Password</label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-blue-400 group-focus-within:text-blue-300 transition-colors" />
                          </div>
                          <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            className="login-input w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                            placeholder="Enter your password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                        <span className="text-white/70 text-sm group-hover:text-white/90 transition-colors">Remember me</span>
                      </label>
                      <button
                        type="button"
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors hover:underline"
                      >
                        Forgot password?
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

              {/* Enhanced Success Step */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <div className="mb-8">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                      className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl"
                    >
                      <CheckCircle className="w-10 h-10 text-white" />
                    </motion.div>
                    <motion.h2
                      className="text-2xl font-bold text-white mb-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      Welcome to FDT!
                    </motion.h2>
                    <motion.p
                      className="text-white/70"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      Login successful. Redirecting to dashboard...
                    </motion.p>
                  </div>

                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                      className="h-full bg-gradient-to-r from-green-400 to-blue-400 rounded-full"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer Links */}
            {step === 'login' && (
              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                <p className="text-white/60 text-sm">
                  Need help? {' '}
                  <button className="text-blue-400 hover:text-blue-300 font-medium transition-colors hover:underline">
                    Contact Support
                  </button>
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 text-center">
            <p className="text-white/40 text-xs">
              © {new Date().getFullYear()} Al Rostamani International Exchange LLC. All rights reserved.
            </p>
          </div>
        </motion.div>
        {/* Footer */}
      </div>
    </div>
  );
};

export default LoginPage;