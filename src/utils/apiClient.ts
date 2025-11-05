import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';
import config from '../config/app-config.json';
import { logger } from './logger';
import { log } from 'console';

// Simplified Security Configuration
const SECURITY_CONFIG = {
  SECRET_KEY: 'xK6$9pF2!qW8#zR1@lY3*uM5%vS7^dN$', // HMAC secret key
  JWT_SECRET: '3d915e06c745490f95e0d1713b2d67a168e5db1ed2cb6bd7d1622171f2a0bb5e',
  MAX_REQUEST_AGE: 300, // 5 minutes in seconds
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class SecureApiClient {
  private static instance: SecureApiClient;
  private axiosInstance: AxiosInstance;
  private refreshTokenPromise: Promise<string> | null = null;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '2.1.0',
        'X-Client-Type': 'web-app'
      }
    });

    this.setupInterceptors();
  }

  static getInstance(): SecureApiClient {
    if (!SecureApiClient.instance) {
      SecureApiClient.instance = new SecureApiClient();
    }
    return SecureApiClient.instance;
  }

  private setupInterceptors() {
    // Request interceptor with simplified security
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        try {
          // Get authentication token
          const token = localStorage.getItem('authToken');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          // Add timestamp for request freshness validation
          const timestamp = Math.floor(Date.now() / 1000).toString();
          config.headers['X-Timestamp'] = timestamp;
          
          return config;
        } catch (error) {
          console.error('Request interceptor error:', error);
          return Promise.reject(error);
        }
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor with token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle token expiration
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            this.handleAuthenticationFailure();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<string> {
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = this.performTokenRefresh();
    
    try {
      const newToken = await this.refreshTokenPromise;
      return newToken;
    } finally {
      this.refreshTokenPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(`${config.api.authBaseUrl}/refresh`, {
        refresh_token: refreshToken
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': '2.1.0',
          'X-Client-Type': 'web-app'
        }
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;
      
      localStorage.setItem('authToken', access_token);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }

      return access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw new Error('Token refresh failed');
    }
  }

  private handleAuthenticationFailure() {
    // Clear all authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('sessionWarningShown');
    
    // Redirect to login
    window.location.href = '/login';
  }

  // Public API methods with enhanced error handling
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.get(url, config);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      console.log('apiClient', 'post', `Posting to ${url} with data: ${JSON.stringify(data)}`);
      const response: AxiosResponse<T> = await this.axiosInstance.post(url, data, config);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('apiClient', 'post', `Error posting to ${url}: ${error}`);
      return this.handleApiError(error);
    }
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.put(url, data, config);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.delete(url, config);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private handleApiError(error: any): ApiResponse {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail || error.message || 'An error occurred';
      
      // Enhanced error categorization
      let errorType = 'UNKNOWN_ERROR';
      if (status === 400) errorType = 'VALIDATION_ERROR';
      else if (status === 401) errorType = 'AUTHENTICATION_ERROR';
      else if (status === 403) errorType = 'PERMISSION_DENIED';
      else if (status === 404) errorType = 'NOT_FOUND';
      else if (status === 429) errorType = 'RATE_LIMIT_EXCEEDED';
      else if (status && status >= 500) errorType = 'SERVER_ERROR';
      
      return {
        success: false,
        error: detail,
        message: detail,
        ...(status && { status }),
        ...(errorType && { errorType })
      };
    }
    
    return {
      success: false,
      error: 'Network or unknown error occurred',
      message: 'Network or unknown error occurred'
    };
  }
}

// Export singleton instance
const apiClient = SecureApiClient.getInstance();
export default apiClient;