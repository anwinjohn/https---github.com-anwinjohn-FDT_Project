import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';
import config from '../config/app-config.json';
import { logger } from './logger';
import { jwtDecode } from 'jwt-decode';

// Simplified Security Configuration
const SECURITY_CONFIG = {
  SECRET_KEY: 'xK6$9pF2!qW8#zR1@lY3*uM5%vS7^dN$',
  JWT_SECRET:
    '3d915e06c745490f95e0d1713b2d67a168e5db1ed2cb6bd7d1622171f2a0bb5e',
  MAX_REQUEST_AGE: 300, // 5 minutes in seconds
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface DecodedToken {
  exp: number;
  iat: number;
  [key: string]: any;
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
        'X-Client-Version': config.app.version,
        'X-Client-Type': 'web-app',
      },
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
    this.axiosInstance.interceptors.request.use(
      async (request) => {
        try {
          const token = localStorage.getItem('authToken');
          if (token && !this.isTokenExpired(token)) {
            request.headers.Authorization = `Bearer ${token}`;
          }
          request.headers['X-Timestamp'] = Math.floor(
            Date.now() / 1000
          ).toString();
          if (request.data) {
            const originalData = JSON.stringify(request.data);
            if (config.logging.console_enabled) {
              console.log(originalData);
            }
            const encryptedData = this.encryptRequest(originalData);
            request.headers['X-Encrypted'] = 'true';
            if (!encryptedData) {
              logger.error('Failed to encrypt', '', 'Interceptor Error');
            }
            request.data = { payload: encryptedData };
          }
          return request;
        } catch (error) {
          console.error('Request interceptor error:', error);
          return Promise.reject(error);
        }
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        try {
          if (config.logging.console_enabled) {
            console.log(response);
          }
          // Only decrypt if backend response contains encrypted payload
          if (typeof response.data === 'string') {
            // Entire string-encrypted data
            response.data = this.decryptResponse(response.data);
          } else if (response.data && response.data.encryptedData) {
            // Encrypted under a property
            response.data = this.decryptResponse(response.data.encryptedData);
          }
        } catch (err) {
          console.warn(
            'Response appears unencrypted or decryption failed. Returning raw data.'
          );
        }

        return response;
      },

      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.performTokenRefresh();
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

  static decodeToken(token: string): DecodedToken | null {
    try {
      return jwtDecode<DecodedToken>(token);
    } catch (error) {
      console.error('Error decoding token with jwt-decode:', error);
      return null;
    }
  }
  private isTokenExpired(token: string): boolean {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const decodedPayload = JSON.parse(window.atob(base64));
      const exp = decodedPayload.exp;

      if (!exp) return true;

      const now = Math.floor(Date.now() / 1000);
      return exp < now;
    } catch (err) {
      console.error('Error decoding token:', err);
      return true;
    }
  }

  private encryptRequest = (data: string): any => {
    try {
      const iv = CryptoJS.lib.WordArray.random(16);
      const encrypted = CryptoJS.AES.encrypt(
        data,
        CryptoJS.enc.Utf8.parse(SECURITY_CONFIG.SECRET_KEY),
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );

      return iv.concat(encrypted.ciphertext).toString(CryptoJS.enc.Base64);
    } catch (err) {
      logger.error('Error while encrypt payload', '', err);
      return null;
    }
  };

  private decryptResponse = (encryptedData: string): any => {
    try {
      // Decode base64
      const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedData);
      // Extract IV (first 16 bytes/4 words)
      const iv = CryptoJS.lib.WordArray.create(
        encryptedBytes.words.slice(0, 4),
        16
      );
      // Extract ciphertext (rest of the data)
      const ciphertext = CryptoJS.lib.WordArray.create(
        encryptedBytes.words.slice(4),
        encryptedBytes.sigBytes - 16
      );
      // Decrypt
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: ciphertext } as any,
        CryptoJS.enc.Utf8.parse(SECURITY_CONFIG.SECRET_KEY),
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );
      // Convert to string and parse JSON
      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedStr);
    } catch (error) {
      logger.error('Error while decrypt response', '', error);
      throw new Error('Failed to decrypt server response');
    }
  };

  // private async refreshToken(): Promise<string> {
  //   if (this.refreshTokenPromise) {
  //     return this.refreshTokenPromise;
  //   }

  //   this.refreshTokenPromise = this.performTokenRefresh();

  //   try {
  //     const newToken = await this.refreshTokenPromise;
  //     return newToken;
  //   } finally {
  //     this.refreshTokenPromise = null;
  //   }
  // }

  private async performTokenRefresh(): Promise<string> {
    const currentToken = localStorage.getItem('authToken');
    if (currentToken) {
      try {
        const response = await axios.post(`${config.api.authBaseUrl}/refresh`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Version': config.app.version,
            'X-Client-Type': 'web-app',
            Authorization: currentToken,
          },
        });
        if (response.data) {
          localStorage.setItem('authToken', response.data);
          return response.data;
        } else {
          this.handleAuthenticationFailure();
          return '';
        }
      } catch (err) {
        logger.error('Token renewal failed', '', err);
        return '';
      }
    } else {
      this.handleAuthenticationFailure();
      return '';
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
  async get<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.get(
        url,
        config
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      console.log(
        'apiClient',
        'post',
        `Posting to ${url} with data: ${JSON.stringify(data)}`
      );
      const response: AxiosResponse<T> = await this.axiosInstance.post(
        url,
        data,
        config
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('apiClient', 'post', `Error posting to ${url}: ${error}`);
      return this.handleApiError(error);
    }
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.put(
        url,
        data,
        config
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.delete(
        url,
        config
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  private handleApiError(error: any): ApiResponse {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail =
        error.response?.data?.detail || error.message || 'An error occurred';

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
        ...(errorType && { errorType }),
      };
    }

    return {
      success: false,
      error: 'Network or unknown error occurred',
      message: 'Network or unknown error occurred',
    };
  }
}

// Export singleton instance
const apiClient = SecureApiClient.getInstance();
export default apiClient;
