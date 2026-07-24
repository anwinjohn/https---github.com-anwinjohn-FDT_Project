window.__APP_CONFIG__ = {
  api: {
    baseUrl: 'http://127.0.0.1:8000',
    authBaseUrl: 'http://127.0.0.1:8000',
    userInfo: 'http://localhost:5050/users',
    timeout: 30000,
  },
  auth: {
    enabled: true,
    methods: {
      password: true,
      faceid: true,
      sms: true,
    },
    autoRefreshInterval: 30000,
    sessionTimeout: 3600000,
  },
  dashboard: {
    autoRefresh: {
      enabled: false,
      interval: 60000,
    },
    defaultDateRange: {
      days: 7,
    },
    logo: './src/ARIE_Logo.png',
  },
  app: {
    name: 'Fraud Detection & Monitoring Tool',
    shortName: 'FDT',
    version: '2.1.0',
    favicon: '/src/favicon.ico',
  },
  environment: 'development',
  logging: {
    console_enabled: false,
    api_enabled: false,
    level: 'error',
    maxEntries: 1000,
  },
};
