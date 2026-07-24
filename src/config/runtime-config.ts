/**
 * Runtime configuration populated by /public/app-config.js and
 * /public/security-config.js. The scripts are loaded in index.html before the
 * application entry point, so configuration can be changed after a build.
 */

interface AppConfig {
  api: {
    baseUrl: string;
    authBaseUrl: string;
    userInfo: string;
    timeout?: number;
    [key: string]: unknown;
  };
  auth: {
    enabled: boolean;
    methods: Record<string, boolean>;
    autoRefreshInterval?: number;
    sessionTimeout?: number;
    [key: string]: unknown;
  };
  dashboard: {
    autoRefresh?: {
      enabled?: boolean;
      interval?: number;
      [key: string]: unknown;
    };
    defaultDateRange?: { days?: number; [key: string]: unknown };
    logo?: string;
    [key: string]: unknown;
  };
  app: {
    name: string;
    shortName: string;
    version: string;
    favicon?: string;
    [key: string]: unknown;
  };
  environment: string;
  logging: {
    console_enabled: boolean;
    api_enabled: boolean;
    level: string;
    maxEntries?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface SecurityConfig {
  security: {
    encryption: { algorithm: string; keyLength: number; ivLength: number; [key: string]: unknown };
    signature: { algorithm: string; keyLength: number; [key: string]: unknown };
    jwt: { algorithm: string; expirationBuffer: number; [key: string]: unknown };
    request: { maxAge: number; nonceLength: number; retryAttempts: number; [key: string]: unknown };
    endpoints: { sensitive: string[]; [key: string]: unknown };
    [key: string]: unknown;
  };
  rateLimit: { maxRequests: number; windowMs: number; skipSuccessfulRequests: boolean; [key: string]: unknown };
  cors: { allowedOrigins: string[]; allowedMethods: string[]; allowedHeaders: string[]; [key: string]: unknown };
  [key: string]: unknown;
}

declare global {
  interface Window {
    __APP_CONFIG__?: AppConfig;
    __SECURITY_CONFIG__?: SecurityConfig;
  }
}

function requireRuntimeConfig<T>(name: string, config: T | undefined): T {
  if (!config || typeof config !== 'object') {
    throw new Error(
      `${name} is unavailable. Ensure its public config script is loaded before the application entry point.`
    );
  }

  return config;
}

export const appConfig = requireRuntimeConfig('app-config.js', window.__APP_CONFIG__);
export const securityConfig = requireRuntimeConfig('security-config.js', window.__SECURITY_CONFIG__);

