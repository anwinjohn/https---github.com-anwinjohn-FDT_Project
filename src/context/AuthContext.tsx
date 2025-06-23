import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config/app-config.json';
import CryptoJS from 'crypto-js';
import { useNotifications } from '../components/notifications';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearTimers = () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  };

  const logout = () => {
    clearTimers();
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('lastActivity');
    setUser(null);
    setIsAuthenticated(false);
    navigate('/login');
  };

  const showSessionWarning = () => {
    const shouldLogout = window.confirm(
      'Your session will expire in 5 minutes due to inactivity. Click OK to continue your session or Cancel to logout now.'
    );

    if (!shouldLogout) {
      logout();
    } else {
      resetSessionTimer();
    }
  };

  const resetSessionTimer = () => {
    if (!isAuthenticated) return;

    clearTimers();
    lastActivityRef.current = Date.now();
    localStorage.setItem('lastActivity', lastActivityRef.current.toString());

    // Set warning timer (25 minutes)
    warningTimerRef.current = setTimeout(() => {
      showSessionWarning();
    }, SESSION_TIMEOUT - WARNING_TIME);

    // Set logout timer (30 minutes)
    sessionTimerRef.current = setTimeout(() => {
      addNotification('Your session has expired due to inactivity. You will be logged out for security reasons.', 'warning', 3000);
      logout();
    }, SESSION_TIMEOUT);
  };

  // Track user activity
  useEffect(() => {
    const handleActivity = () => {
      if (isAuthenticated) {
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

  // Check for session timeout on page load/refresh
  useEffect(() => {
    const checkSessionValidity = () => {
      const lastActivity = localStorage.getItem('lastActivity');
      const token = localStorage.getItem('authToken');

      if (token && lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);

        if (timeSinceLastActivity > SESSION_TIMEOUT) {
          // Session expired
          addNotification('Your session has expired due to inactivity. You will be logged out for security reasons.', 'warning', 3000);
          logout();
          return false;
        }
      }
      return true;
    };

    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('userData');

      if (token && userData && checkSessionValidity()) {
        try {
          // For development: Use mock data if it's the admin token
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
          logout();
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
        if (lastActivity && isAuthenticated) {
          const timeSinceLastActivity = Date.now() - parseInt(lastActivity);

          if (timeSinceLastActivity > SESSION_TIMEOUT) {
            alert('Your session has expired due to inactivity. Please login again.');
            logout();
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
      // Mock admin login
      if (username === 'admin' && password === 'admin123') {
        localStorage.setItem('authToken', 'admin-token');
        localStorage.setItem('userData', JSON.stringify(MOCK_ADMIN));
        localStorage.setItem('lastActivity', Date.now().toString());
        setUser(MOCK_ADMIN);
        setIsAuthenticated(true);
        resetSessionTimer();
        return true;
      }

      // Encrypt the credentials
      const iv = CryptoJS.lib.WordArray.random(16);
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify({ username, password }),
        CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY),
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );
      // Combine IV and ciphertext
      const encryptedData = iv.concat(encrypted.ciphertext).toString(CryptoJS.enc.Base64);

      // Real API call for other users
      const response = await fetch(`${config.api.authBaseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Encrypted': 'true' // Header to indicate encrypted payload
        },
        body: JSON.stringify({ data: encryptedData })
      });

      if (response.ok) {
        const responseData = await response.json();
        const decryptedResponse = decryptResponse(responseData.data);

        // Validate response matches request
        if (decryptedResponse.user.request_username !== username) {
          console.error('Response validation failed: username mismatch');
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
      return false;
    } catch (error) {
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