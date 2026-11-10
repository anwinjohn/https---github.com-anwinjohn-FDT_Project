import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';
import { appConfig as config, securityConfig } from '../config/runtime-config';
import { logger } from './logger';
import { jwtDecode } from 'jwt-decode';
import { getLocalMachineInfo } from './machineInfoStore';

// Simplified Security Configuration
const SECURITY_CONFIG = {
  SECRET_KEY: 'xK6$9pF2!qW8#zR1@lY3*uM5%vS7^dN$',
  JWT_SECRET:
    '3d915e06c745490f95e0d1713b2d67a168e5db1ed2cb6bd7d1622171f2a0bb5e',
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

interface EncryptedApiResponse {
  data: string;
}

interface ApiRequestConfig extends AxiosRequestConfig {
  skipBodyEncryption?: boolean;
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
          const machineInfo = getLocalMachineInfo();
          if (machineInfo) {
            // The header also covers body-less requests such as GET and DELETE.
            request.headers['X-Machine-Info'] = this.encryptRequest(
              JSON.stringify(machineInfo)
            );
          } else {
            console.log('Machine info null or empty : ', machineInfo);
          }

          let token = localStorage.getItem('authToken');
          if (token) {
            if (this.isTokenExpired(token)) {
              token = await this.performTokenRefresh();
            }
            request.headers.Authorization = `Bearer ${token}`;
          }
          request.headers['X-Timestamp'] = Math.floor(
            Date.now() / 1000
          ).toString();
          if (
            !(request as any).skipBodyEncryption &&
            request.data !== undefined &&
            request.data !== null &&
            // FormData (multipart uploads) must go through untouched:
            // JSON.stringify(FormData) is "{}", so encrypting it would
            // replace the file with an encrypted empty object.
            !(request.data instanceof FormData) &&
            !(request as any)._machineInfoEnriched
          ) {
            const body = request.data;
            let payload: any = body;
            if (typeof body === 'string') {
              try {
                payload = JSON.parse(body);
              } catch {
                payload = { payload: body };
              }
            }
            // const enrichedPayload = machineInfo
            //   ? payload && typeof payload === 'object' && !Array.isArray(payload)
            //     ? { ...payload, machine_info: machineInfo }
            //     : { payload, machine_info: machineInfo }
            //   : payload;
            const originalData = JSON.stringify(payload);
            if (config.logging.console_enabled) {
              console.log(originalData);
            }
            const encryptedData = this.encryptRequest(originalData);
            request.headers['X-Encrypted'] = 'true';
            if (!encryptedData) {
              logger.error('Failed to encrypt', '', 'Interceptor Error');
            }
            request.data = { data: encryptedData };
          }
          (request as any)._machineInfoEnriched = true;
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
          const isEncrypted =
            response.headers?.['x-encrypted'] === 'true' ||
            response.headers?.['X-Encrypted'] === 'true';

          if (config.logging.console_enabled) {
            console.log('Response Header: ', response.headers);
            console.log('Raw response:', response.data);
            console.log('response.data', response.data);
            console.log('tyepeof response.data', typeof response.data);
            console.log('response.data.data', response.data.data);
          }
          if (
            isEncrypted &&
            response.data.data &&
            typeof response.data.data == 'string'
          ) {
            if (config.logging.console_enabled) {
              console.log('data: ', response.data);
              console.log(
                'DECY data',
                this.decryptResponse(response.data.data)
              );
            }
            const decrypted = this.decryptResponse(response.data.data);
            response.data = decrypted;
          }
        } catch (error) {
          logger.error('Response decryption failed', '', error);
          throw error;
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
            // performTokenRefresh already clears the session only for a
            // definitive rejection; transient failures must not force a
            // logout of an active user. Surface the failed request normally.
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
      return exp < now + securityConfig.security.jwt.expirationBuffer;
    } catch (err) {
      console.error('Error decoding token:', err);
      return true;
    }
  }

  private encryptRequest = (data: string): any => {
    try {
      const iv = CryptoJS.lib.WordArray.random(
        securityConfig.security.encryption.ivLength
      );
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
      // console.log('Trying to decrypt : ', encryptedData);
      // Decode base64
      const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedData);
      // Extract IV (first 16 bytes/4 words)
      const iv = CryptoJS.lib.WordArray.create(
        encryptedBytes.words.slice(0, 4),
        securityConfig.security.encryption.ivLength
      );
      // Extract ciphertext (rest of the data)
      const ciphertext = CryptoJS.lib.WordArray.create(
        encryptedBytes.words.slice(4),
        encryptedBytes.sigBytes - securityConfig.security.encryption.ivLength
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
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = (async () => {
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        const payload = JSON.stringify({
          refresh_token: refreshToken,
        });
        const encryptedPayload = this.encryptRequest(payload);
        const response = await axios.post(
          `${config.api.authBaseUrl}/refresh`,
          {
            data: encryptedPayload,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Client-Version': config.app.version,
              'X-Client-Type': 'web-app',
              'X-Encrypted': 'true',
            },
          }
        );
        const decryptedResponse = this.decryptResponse(response.data.data);
        const newAccessToken = decryptedResponse?.access_token;
        const newRefreshToken = decryptedResponse?.refresh_token;
        if (
          decryptedResponse?.status_code !== 200 ||
          !newAccessToken ||
          !newRefreshToken
        ) {
          throw new Error('Invalid refresh response');
        }

        localStorage.setItem('authToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        return newAccessToken;
      } catch (error) {
        // Only a definitive rejection from the refresh endpoint (invalid /
        // revoked refresh token) may end the session. Transient failures —
        // network blips, backend restarts, timeouts — must NOT clear the
        // session: an actively-working user would be force-logged-out. The
        // thrown error still fails the caller's request, which surfaces a
        // normal error message instead of a redirect.
        if (axios.isAxiosError(error) && error.response) {
          this.handleAuthenticationFailure();
        }
        throw error;
      } finally {
        this.refreshTokenPromise = null;
      }
    })();

    return this.refreshTokenPromise;
  }

  private handleAuthenticationFailure() {
    // Clear all authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('sessionWarningShown');
    localStorage.removeItem('localMachineInfo');
    // Flag so the login screen can tell the user WHY they were signed out.
    localStorage.setItem('sessionExpired', 'true');
    // Redirect to login
    window.location.href = '/login';
  }

  // Public API methods with enhanced error handling
  async get<T = any>(
    url: string,
    configs?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      if (config.logging.console_enabled) {
        console.log('apiClient', 'GET', `Posting to ${url} | ${configs}`);
      }
      const response: AxiosResponse<T> = await this.axiosInstance.get(
        url,
        configs
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
    configs?: ApiRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      if (config.logging.console_enabled) {
        console.log(
          'apiClient',
          'POST',
          `Posting to ${url} with data: ${JSON.stringify(data)}`
        );
      }
      const response: AxiosResponse<T> = await this.axiosInstance.post(
        url,
        data,
        configs
      );

      if (config.logging.console_enabled) {
        console.log('POST Response', response.data);
      }
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      if (config.logging.console_enabled) {
        logger.error('apiClient', 'post', `Error posting to ${url}: ${error}`);
      }
      return this.handleApiError(error);
    }
  }
  async put<T = any>(
    url: string,
    data?: any,
    configs?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      if (config.logging.console_enabled) {
        console.log(
          'apiClient',
          'PUT',
          `Posting to ${url} with data: ${JSON.stringify(data)}`
        );
      }
      const response: AxiosResponse<T> = await this.axiosInstance.put(
        url,
        data,
        configs
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
    configs?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      if (config.logging.console_enabled) {
        console.log('apiClient', 'DELETE', `Posting to ${url}`);
      }
      const response: AxiosResponse<T> = await this.axiosInstance.delete(
        url,
        configs
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  /**
   * Multipart upload that bypasses the JSON-body encryption interceptor
   * (the browser sets the multipart boundary; the backend accepts raw
   * multipart on this endpoint). Auth, machine-info and 401-refresh still
   * apply because it runs on the shared axios instance.
   */
  async postForm<T = any>(
    url: string,
    formData: FormData
  ): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.post(
        url,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          // Belt-and-braces with the FormData check in the interceptor.
          skipBodyEncryption: true,
        } as ApiRequestConfig
      );
      return { success: true, data: response.data };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  /**
   * Binary download through the shared instance (Bearer token + refresh
   * handling). Returns the raw Blob on success.
   */
  async downloadBlob(url: string): Promise<{
    success: boolean;
    blob?: Blob;
    error?: string;
    status?: number;
  }> {
    try {
      const response: AxiosResponse<Blob> = await this.axiosInstance.get(url, {
        responseType: 'blob',
      });
      return { success: true, blob: response.data };
    } catch (error) {
      const handled = this.handleApiError(error);
      return { success: false, error: handled.error, status: handled.status };
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
