import config from '../config/app-config.json';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'security';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  data?: any;
  stackTrace?: string;
}

interface SecurityEvent {
  type: 'auth_failure' | 'invalid_signature' | 'replay_attack' | 'rate_limit' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private securityEvents: (LogEntry & { securityEvent: SecurityEvent })[] = [];
  private maxLogs: number = 1000;
  private maxSecurityEvents: number = 500;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatDate(date: Date): string {
    return date.toISOString();
  }

  private getClientInfo() {
    return {
      userAgent: navigator.userAgent,
      timestamp: this.formatDate(new Date()),
      sessionId: sessionStorage.getItem('sessionId') || 'unknown',
      // Note: IP address would need to be obtained from server
    };
  }

  private addLog(level: LogLevel, message: string, userId?: string, data?: any, stackTrace?: string) {
    const clientInfo = this.getClientInfo();
    
    const logEntry: LogEntry = {
      timestamp: clientInfo.timestamp,
      level,
      message,
      userId,
      sessionId: clientInfo.sessionId,
      userAgent: clientInfo.userAgent,
      data,
      stackTrace
    };

    this.logs.unshift(logEntry);
    
    // Keep logs under limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Log to console in development
    if (config.environment === 'development') {
      const consoleMsg = `[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}`;
      switch (level) {
        case 'error':
          console.error(consoleMsg, data, stackTrace);
          break;
        case 'warn':
          console.warn(consoleMsg, data);
          break;
        case 'debug':
          console.debug(consoleMsg, data);
          break;
        case 'security':
          console.warn(`🔒 SECURITY: ${consoleMsg}`, data);
          break;
        default:
          console.log(consoleMsg, data);
      }
    }

    // Send critical logs to server in production
    if (config.environment === 'production' && (level === 'error' || level === 'security')) {
      this.sendLogToServer(logEntry);
    }
  }

  private async sendLogToServer(logEntry: LogEntry) {
    try {
      // Only send in production and for critical events
      if (config.environment !== 'production') return;

      await fetch(`${config.api.baseUrl}/api/logs/client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(logEntry)
      });
    } catch (error) {
      // Silently fail to avoid infinite loops
      console.error('Failed to send log to server:', error);
    }
  }

  info(message: string, userId?: string, data?: any) {
    this.addLog('info', message, userId, data);
  }

  warn(message: string, userId?: string, data?: any) {
    this.addLog('warn', message, userId, data);
  }

  error(message: string, userId?: string, data?: any, error?: Error) {
    const stackTrace = error?.stack;
    this.addLog('error', message, userId, data, stackTrace);
  }

  debug(message: string, userId?: string, data?: any) {
    this.addLog('debug', message, userId, data);
  }

  security(message: string, securityEvent: SecurityEvent, userId?: string, data?: any) {
    const logEntry: LogEntry = {
      timestamp: this.formatDate(new Date()),
      level: 'security',
      message,
      userId,
      data: { ...data, securityEvent }
    };

    // Add to security events
    this.securityEvents.unshift({ ...logEntry, securityEvent });
    
    // Keep security events under limit
    if (this.securityEvents.length > this.maxSecurityEvents) {
      this.securityEvents = this.securityEvents.slice(0, this.maxSecurityEvents);
    }

    // Also add to regular logs
    this.addLog('security', message, userId, { ...data, securityEvent });

    // Immediate server notification for critical security events
    if (securityEvent.severity === 'critical' || securityEvent.severity === 'high') {
      this.sendSecurityAlert(logEntry, securityEvent);
    }
  }

  private async sendSecurityAlert(logEntry: LogEntry, securityEvent: SecurityEvent) {
    try {
      if (config.environment !== 'production') return;

      await fetch(`${config.api.baseUrl}/api/security/alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          ...logEntry,
          securityEvent,
          clientInfo: {
            url: window.location.href,
            referrer: document.referrer,
            timestamp: Date.now()
          }
        })
      });
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }

  // API Security specific logging methods
  logAuthFailure(reason: string, userId?: string, details?: any) {
    this.security(`Authentication failure: ${reason}`, {
      type: 'auth_failure',
      severity: 'high',
      details: { reason, ...details }
    }, userId);
  }

  logInvalidSignature(endpoint: string, userId?: string, details?: any) {
    this.security(`Invalid signature for endpoint: ${endpoint}`, {
      type: 'invalid_signature',
      severity: 'critical',
      details: { endpoint, ...details }
    }, userId);
  }

  logReplayAttack(nonce: string, userId?: string, details?: any) {
    this.security(`Potential replay attack detected with nonce: ${nonce}`, {
      type: 'replay_attack',
      severity: 'critical',
      details: { nonce, ...details }
    }, userId);
  }

  logRateLimit(endpoint: string, userId?: string, details?: any) {
    this.security(`Rate limit exceeded for endpoint: ${endpoint}`, {
      type: 'rate_limit',
      severity: 'medium',
      details: { endpoint, ...details }
    }, userId);
  }

  logSuspiciousActivity(activity: string, userId?: string, details?: any) {
    this.security(`Suspicious activity detected: ${activity}`, {
      type: 'suspicious_activity',
      severity: 'high',
      details: { activity, ...details }
    }, userId);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getSecurityEvents(): (LogEntry & { securityEvent: SecurityEvent })[] {
    return [...this.securityEvents];
  }

  clearLogs() {
    this.logs = [];
  }

  clearSecurityEvents() {
    this.securityEvents = [];
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify({
      logs: this.logs,
      securityEvents: this.securityEvents,
      exportedAt: this.formatDate(new Date())
    }, null, 2);
  }
}

export const logger = Logger.getInstance();
export type { LogEntry, SecurityEvent };