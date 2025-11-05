import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotifications } from '../components/notifications';
import config from '../config/app-config.json';
import CryptoJS from 'crypto-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RefreshCw } from 'lucide-react';
import { add } from 'date-fns';


interface AuthContextType {
  isAuthenticated: boolean;
  user: UserInfo | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  resetSessionTimer: () => void;
}

interface UserInfo {
  id: string;
  username: string;
  email_id: string;
  full_name: string;
  role_id: number;
  mfa_enabled: boolean;
  request_username: string;
}

// Mock admin user for development
const MOCK_ADMIN: UserInfo = {
  id: '1',
  username: 'admin',
  email_id: 'admin@company.com',
  full_name: 'System Administrator',
  role_id: 1, // Admin role as integer
  mfa_enabled: false,
  request_username: 'admin'
};

const ENCRYPTION_KEY = 'xK6$9pF2!qW8#zR1@lY3*uM5%vS7^dN$';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session timeout modal component
const SessionTimeoutModal: React.FC<{
  isOpen: boolean;
  timeRemaining: number;
  onExtend: () => void;
  theme: 'dark' | 'light';
}> = ({ isOpen, timeRemaining, onExtend, theme }) => {
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${theme === 'dark'
                ? 'bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-slate-800/95 border-white/20'
                : 'bg-gradient-to-br from-white/95 via-gray-50/95 to-white/95 border-gray-200'
                } backdrop-blur-2xl`}
            >
              <div className={`p-6 border-b ${theme === 'dark' ? 'border-white/20' : 'border-gray-200'
                }`}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl shadow-lg">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>Session Timeout Warning</h2>
                    <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}>Your session is about to expire</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className={`mb-6 p-4 rounded-xl border ${theme === 'dark'
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-white/80'
                  : 'bg-yellow-50 border-yellow-200 text-gray-700'
                  }`}>
                  <p className="mb-2">Due to inactivity, your session will expire in:</p>
                  <div className={`text-2xl font-bold text-center ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-600'
                    }`}>
                    {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                  </div>
                </div>

                <p className={`mb-6 text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                  }`}>
                  For security reasons, your session will automatically end if no action is taken.
                  Click the button below to extend your session.
                </p>

                <div className="flex justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onExtend}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${theme === 'dark'
                      ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 hover:from-blue-500/30 hover:to-indigo-500/30 text-blue-300 border border-blue-500/30'
                      : 'bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 text-blue-700 border border-blue-300'
                      }`}
                  >
                    <RefreshCw className="w-5 h-5" />
                    Extend Session
                  </motion.button>
                </div>
              </div>

              <div className={`px-6 py-4 border-t ${theme === 'dark' ? 'border-white/20 bg-white/5' : 'border-gray-200 bg-gray-50'
                }`}>
                <p className={`text-xs text-center ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'
                  }`}>
                  This timeout is for your security. Confidential information requires protection.
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { addNotification } = useNotifications();

  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);
  const isLoggingOutRef = useRef<boolean>(false);

  // Session timeout modal state
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(WARNING_TIME);
  const timeoutIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Update theme based on document class
  useEffect(() => {
    const updateTheme = () => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    };

    updateTheme();

    // Create a mutation observer to watch for class changes on the html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  const clearTimers = () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (timeoutIntervalRef.current) {
      clearInterval(timeoutIntervalRef.current);
      timeoutIntervalRef.current = null;
    }
  };

  const logout = (reason?: string) => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    clearTimers();
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('sessionWarningShown');

    setUser(null);
    setIsAuthenticated(false);
    warningShownRef.current = false;
    setShowTimeoutModal(false);

    // Clear any existing notifications
    if (reason) {
      addNotification(reason, 'warning', 5000, 'Session Expired');
    }

    // Navigate to login and replace history to prevent back navigation
    navigate('/login', { replace: true });

    // Clear browser history to prevent back navigation to protected routes
    window.history.replaceState(null, '', '/login');

    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 1000);
  };

  const showSessionWarning = () => {
    if (warningShownRef.current || isLoggingOutRef.current) return;

    warningShownRef.current = true;
    localStorage.setItem('sessionWarningShown', Date.now().toString());

    // Show the modal instead of notification
    setShowTimeoutModal(true);
    setTimeRemaining(WARNING_TIME);

    // Start countdown timer
    if (timeoutIntervalRef.current) {
      clearInterval(timeoutIntervalRef.current);
    }

    timeoutIntervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          clearInterval(timeoutIntervalRef.current!);
          logout('Your session has expired due to inactivity. Please login again for security.');
          return 0;
        }
        return newTime;
      });
    }, 1000);

    // Auto-logout after warning period if no action taken
    sessionTimerRef.current = setTimeout(() => {
      if (warningShownRef.current && !isLoggingOutRef.current) {
        logout('Your session has expired due to inactivity. Please login again for security.');
      }
    }, WARNING_TIME);
  };

  const resetSessionTimer = () => {
    if (!isAuthenticated || isLoggingOutRef.current) return;

    clearTimers();
    lastActivityRef.current = Date.now();
    localStorage.setItem('lastActivity', lastActivityRef.current.toString());
    localStorage.removeItem('sessionWarningShown');
    warningShownRef.current = false;
    setShowTimeoutModal(false);

    // Set warning timer (25 minutes)
    warningTimerRef.current = setTimeout(() => {
      if (!isLoggingOutRef.current) {
        showSessionWarning();
      }
    }, SESSION_TIMEOUT - WARNING_TIME);

    // Set logout timer (30 minutes)
    sessionTimerRef.current = setTimeout(() => {
      if (!isLoggingOutRef.current) {
        logout('Your session has expired due to inactivity. Please login again for security.');
      }
    }, SESSION_TIMEOUT);
  };

  // Track user activity
  useEffect(() => {
    const handleActivity = () => {
      if (isAuthenticated && !isLoggingOutRef.current) {
        resetSessionTimer();
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [isAuthenticated]);

  // Handle browser navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isAuthenticated && location.pathname === '/login') {
        // User navigated back to login while authenticated - logout
        logout('Session terminated for security reasons.');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, location.pathname]);

  // Check for session timeout on page load/refresh
  useEffect(() => {
    const checkSessionValidity = () => {
      const lastActivity = localStorage.getItem('lastActivity');
      const token = localStorage.getItem('authToken');
      const warningShown = localStorage.getItem('sessionWarningShown');

      if (token && lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        const timeSinceWarning = warningShown ? Date.now() - parseInt(warningShown) : 0;

        if (timeSinceLastActivity > SESSION_TIMEOUT) {
          // Session expired
          logout('Your session has expired. Please login again.');
          return false;
        } else if (timeSinceLastActivity > (SESSION_TIMEOUT - WARNING_TIME)) {
          // In warning period
          if (warningShown && timeSinceWarning > WARNING_TIME) {
            // Warning period also expired
            logout('Your session has expired. Please login again.');
            return false;
          } else if (warningShown) {
            // Still in warning period
            warningShownRef.current = true;
            showSessionWarning();
          }
        }
      }
      return true;
    };

    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('userData');

      if (token && userData && checkSessionValidity()) {
        try {
          if (token === 'admin-token') {
            setUser(MOCK_ADMIN);
            setIsAuthenticated(true);
            resetSessionTimer();
          } else {
            // Parse stored user data
            const parsedUserData = JSON.parse(userData);
            setUser(parsedUserData);
            setIsAuthenticated(true);
            resetSessionTimer();
          }
        } catch (error) {
          console.error('Auth validation error:', error);
          logout('Authentication error. Please login again.');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Handle page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, pause timers
        clearTimers();
      } else {
        // Page is visible, check session and restart timers
        const lastActivity = localStorage.getItem('lastActivity');
        const warningShown = localStorage.getItem('sessionWarningShown');

        if (lastActivity && isAuthenticated && !isLoggingOutRef.current) {
          const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
          const timeSinceWarning = warningShown ? Date.now() - parseInt(warningShown) : 0;

          if (timeSinceLastActivity > SESSION_TIMEOUT) {
            logout('Your session has expired due to inactivity. Please login again.');
          } else if (timeSinceLastActivity > (SESSION_TIMEOUT - WARNING_TIME)) {
            if (warningShown && timeSinceWarning > WARNING_TIME) {
              logout('Your session has expired due to inactivity. Please login again.');
            } else {
              warningShownRef.current = !!warningShown;
              if (warningShown) {
                showSessionWarning();
              } else {
                resetSessionTimer();
              }
            }
          } else {
            resetSessionTimer();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated]);

  const decryptResponse = (encryptedData: string): any => {
    try {
      // Decode base64
      const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedData);
      // Extract IV (first 16 bytes/4 words)
      const iv = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(0, 4), 16);
      // Extract ciphertext (rest of the data)
      const ciphertext = CryptoJS.lib.WordArray.create(
        encryptedBytes.words.slice(4),
        encryptedBytes.sigBytes - 16
      );
      // Decrypt
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: ciphertext } as any,
        CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY),
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );
      // Convert to string and parse JSON
      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedStr);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt server response');
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Clear any existing session data
      clearTimers();
      localStorage.removeItem('sessionWarningShown');
      warningShownRef.current = false;
      isLoggingOutRef.current = false;

      // Mock admin login
      // if (username === 'admin' && password === 'admin123') {
      //   localStorage.setItem('authToken', 'admin-token');
      //   localStorage.setItem('userData', JSON.stringify(MOCK_ADMIN));
      //   localStorage.setItem('lastActivity', Date.now().toString());
      //   setUser(MOCK_ADMIN);
      //   setIsAuthenticated(true);
      //   resetSessionTimer();
      //   return true;
      // }
      
      // Encrypt the credentials
      const iv = CryptoJS.lib.WordArray.random(16);
      const sessionId = iv.toString();

      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify({ username, password, sessionId }),
        CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY),
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );
      // Combine IV and ciphertext
      const encryptedData = iv.concat(encrypted.ciphertext).toString(CryptoJS.enc.Base64);

      const response = await fetch(`${config.api.authBaseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Encrypted': 'true'
        },
        body: JSON.stringify({ data: encryptedData })
      });

      const responseData = await response.json();
      const decryptedResponse = decryptResponse(responseData.data);

      if (response.ok && decryptedResponse.status_code === 200) {
        if (decryptedResponse.user.sessionId !== sessionId) {
          console.error('Login Response validation failed, session does not match.');
          return false;
        }
        // Store token and user data
        localStorage.setItem('authToken', decryptedResponse.access_token);
        localStorage.setItem('userData', JSON.stringify(decryptedResponse.user));
        localStorage.setItem('lastActivity', Date.now().toString());

        setUser(decryptedResponse.user);
        setIsAuthenticated(true);
        resetSessionTimer();
        return true;
      }
      else {
        console.error('Login failed:', decryptedResponse.detail || 'Unknown error');
        addNotification(decryptedResponse.detail || 'Login failed. Please try again.', 'error', 5000, 'Login Error');
        return false;
      }
    } catch (error) {
      addNotification('An error occurred during login. Please try again.', 'error', 5000, 'Login Error');
      console.error('Login error:', error);
      return false;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading, resetSessionTimer }}>
      {children}
      <SessionTimeoutModal
        isOpen={showTimeoutModal}
        timeRemaining={timeRemaining}
        onExtend={resetSessionTimer}
        theme={theme}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};