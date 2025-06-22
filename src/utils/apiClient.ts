import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';
import config from '../config/app-config.json';

// Encryption key for API communication
const ENCRYPTION_KEY = 'xK6$9pF2!qW8#zR1@lY3*uM5%vS7^dN$';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class ApiClient {
  private static instance: ApiClient;
  private axiosInstance: AxiosInstance;
  private refreshTokenPromise: Promise<string> | null = null;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
        'X-Client-Type': 'web-app'
      }
    });

    this.setupInterceptors();
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private setupInterceptors() {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add authentication token
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request timestamp and nonce for replay attack prevention
        const timestamp = Date.now().toString();
        const nonce = CryptoJS.lib.WordArray.random(16).toString();
        config.headers['X-Timestamp'] = timestamp;
        config.headers['X-Nonce'] = nonce;

        // Add request signature for integrity
        const signature = this.generateRequestSignature(config, timestamp, nonce);
        config.headers['X-Signature'] = signature;

        // Encrypt sensitive data in request body
        if (config.data && this.shouldEncryptRequest(config.url || '')) {
          config.data = this.encryptRequestData(config.data);
          config.headers['X-Encrypted'] = 'true';
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Decrypt response if encrypted
        if (response.headers['x-encrypted'] === 'true' && response.data) {
          response.data = this.decryptResponseData(response.data);
        }

        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle token expiration
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            // Redirect to login if refresh fails
            this.handleAuthenticationFailure();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private generateRequestSignature(config: AxiosRequestConfig, timestamp: string, nonce: string): string {
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';
    const body = config.data ? JSON.stringify(config.data) : '';
    const token = localStorage.getItem('authToken') || '';
    
    const signatureData = `${method}|${url}|${body}|${timestamp}|${nonce}|${token}`;
    return CryptoJS.HmacSHA256(signatureData, ENCRYPTION_KEY).toString();
  }

  private shouldEncryptRequest(url: string): boolean {
    const sensitiveEndpoints = ['/login', '/admin/', '/users/', '/permissions/'];
    return sensitiveEndpoints.some(endpoint => url.includes(endpoint));
  }

  private encryptRequestData(data: any): { encryptedData: string } {
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(data),
      CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY),
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );

    const encryptedData = iv.concat(encrypted.ciphertext).toString(CryptoJS.enc.Base64);
    return { encryptedData };
  }

  private decryptResponseData(data: any): any {
    try {
      if (data.encryptedData) {
        const encryptedBytes = CryptoJS.enc.Base64.parse(data.encryptedData);
        const iv = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(0, 4), 16);
        const ciphertext = CryptoJS.lib.WordArray.create(
          encryptedBytes.words.slice(4),
          encryptedBytes.sigBytes - 16
        );

        const decrypted = CryptoJS.AES.decrypt(
          { ciphertext: ciphertext } as any,
          CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY),
          {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          }
        );

        return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
      }
      return data;
    } catch (error) {
      console.error('Failed to decrypt response:', error);
      throw new Error('Response decryption failed');
    }
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

    const response = await axios.post(`${config.api.authBaseUrl}/refresh`, {
      refresh_token: refreshToken
    });

    const { access_token, refresh_token: newRefreshToken } = response.data;
    
    localStorage.setItem('authToken', access_token);
    if (newRefreshToken) {
      localStorage.setItem('refreshToken', newRefreshToken);
    }

    return access_token;
  }

  private handleAuthenticationFailure() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    window.location.href = '/login';
  }

  // Public API methods
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
      const response: AxiosResponse<T> = await this.axiosInstance.post(url, data, config);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
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
      const message = error.response?.data?.message || error.message || 'An error occurred';
      return {
        success: false,
        error: message,
        message
      };
    }
    
    return {
      success: false,
      error: 'Unknown error occurred',
      message: 'Unknown error occurred'
    };
  }
}

export const apiClient = ApiClient.getInstance();
export default apiClient;