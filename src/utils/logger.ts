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
  component?: string;
  action?: string;
  category?: string;
}

interface SecurityEvent {
  type: 'auth_failure' | 'invalid_signature' | 'replay_attack' | 'rate_limit' | 'suspicious_activity' | 'permission_violation' | 'data_access_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private securityEvents: (LogEntry & { securityEvent: SecurityEvent })[] = [];
  private maxLogs: number = 1000;
  private maxSecurityEvents: number = 500;
  private logBuffer: LogEntry[] = [];
  private bufferSize: number = 20;
  private bufferFlushInterval: number = 10000; // 10 seconds
  private flushIntervalId: number | null = null;
  private isFlushingBuffer: boolean = false;

  private constructor() {
    // Start buffer flush interval
    this.flushIntervalId = window.setInterval(() => this.flushBuffer(), this.bufferFlushInterval);
  }

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
      sessionId: sessionStorage.getItem('sessionId') || localStorage.getItem('authToken')?.substring(0, 8) || 'unknown',
      // Note: IP address would need to be obtained from server
    };
  }

  private addLog(level: LogLevel, message: string, userId?: string, data?: any, stackTrace?: string, component?: string, action?: string, category?: string) {
    const clientInfo = this.getClientInfo();
    
    const logEntry: LogEntry = {
      timestamp: clientInfo.timestamp,
      level,
      message,
      userId,
      sessionId: clientInfo.sessionId,
      userAgent: clientInfo.userAgent,
      data,
      stackTrace,
      component,
      action,
      category
    };

    // Add to buffer for batch processing
    this.logBuffer.push(logEntry);
    
    // If buffer reaches threshold, flush it
    if (this.logBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }

    // Log to console in development
    if (config.environment === 'development') {
      const consoleMsg = `[${logEntry.timestamp}] ${level.toUpperCase()}${component ? ` [${component}]` : ''}${action ? ` [${action}]` : ''}: ${message}`;
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

    // Send critical logs to server immediately
    if ((level === 'error' || level === 'security') && (category === 'critical' || data?.critical)) {
      this.sendLogToServer(logEntry);
    }
  }

  private async flushBuffer() {
    if (this.isFlushingBuffer || this.logBuffer.length === 0) return;
    
    this.isFlushingBuffer = true;
    
    try {
      // Process buffer
      const bufferToProcess = [...this.logBuffer];
      this.logBuffer = [];
      
      // Add to main logs
      bufferToProcess.forEach(logEntry => {
        this.logs.unshift(logEntry);
      });
      
      // Keep logs under limit
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(0, this.maxLogs);
      }
      
      // Send to server in production
      if (config.environment === 'production') {
        await this.sendBatchLogsToServer(bufferToProcess);
      }
    } catch (error) {
      console.error('Error flushing log buffer:', error);
    } finally {
      this.isFlushingBuffer = false;
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

  private async sendBatchLogsToServer(logs: LogEntry[]) {
    try {
      // Only send in production
      if (config.environment !== 'production') return;

      // Filter logs to only send important ones to server
      const criticalLogs = logs.filter(log => 
        log.level === 'error' || 
        log.level === 'security' || 
        log.category === 'critical' || 
        log.data?.critical
      );
      
      if (criticalLogs.length === 0) return;

      await fetch(`${config.api.baseUrl}/api/logs/client/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ logs: criticalLogs })
      });
    } catch (error) {
      console.error('Failed to send batch logs to server:', error);
    }
  }

  info(message: string, userId?: string, data?: any, component?: string, action?: string) {
    this.addLog('info', message, userId, data, undefined, component, action, 'general');
  }

  warn(message: string, userId?: string, data?: any, component?: string, action?: string) {
    this.addLog('warn', message, userId, data, undefined, component, action, 'warning');
  }

  error(message: string, userId?: string, data?: any, error?: Error, component?: string, action?: string) {
    const stackTrace = error?.stack;
    this.addLog('error', message, userId, data, stackTrace, component, action, 'error');
  }

  debug(message: string, userId?: string, data?: any, component?: string, action?: string) {
    this.addLog('debug', message, userId, data, undefined, component, action, 'debug');
  }

  critical(message: string, userId?: string, data?: any, error?: Error, component?: string, action?: string) {
    const stackTrace = error?.stack;
    this.addLog('error', message, userId, { ...data, critical: true }, stackTrace, component, action, 'critical');
  }

  security(message: string, securityEvent: SecurityEvent, userId?: string, data?: any, component?: string, action?: string) {
    const logEntry: LogEntry = {
      timestamp: this.formatDate(new Date()),
      level: 'security',
      message,
      userId,
      data: { ...data, securityEvent },
      component,
      action,
      category: 'security'
    };

    // Add to security events
    this.securityEvents.unshift({ ...logEntry, securityEvent });
    
    // Keep security events under limit
    if (this.securityEvents.length > this.maxSecurityEvents) {
      this.securityEvents = this.securityEvents.slice(0, this.maxSecurityEvents);
    }

    // Also add to regular logs
    this.addLog('security', message, userId, { ...data, securityEvent }, undefined, component, action, 'security');

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
  logAuthFailure(reason: string, userId?: string, details?: any, component?: string) {
    this.security(`Authentication failure: ${reason}`, {
      type: 'auth_failure',
      severity: 'high',
      details: { reason, ...details }
    }, userId, undefined, component, 'authentication');
  }

  logInvalidSignature(endpoint: string, userId?: string, details?: any, component?: string) {
    this.security(`Invalid signature for endpoint: ${endpoint}`, {
      type: 'invalid_signature',
      severity: 'critical',
      details: { endpoint, ...details }
    }, userId, undefined, component, 'api_security');
  }

  logReplayAttack(nonce: string, userId?: string, details?: any, component?: string) {
    this.security(`Potential replay attack detected with nonce: ${nonce}`, {
      type: 'replay_attack',
      severity: 'critical',
      details: { nonce, ...details }
    }, userId, undefined, component, 'api_security');
  }

  logRateLimit(endpoint: string, userId?: string, details?: any, component?: string) {
    this.security(`Rate limit exceeded for endpoint: ${endpoint}`, {
      type: 'rate_limit',
      severity: 'medium',
      details: { endpoint, ...details }
    }, userId, undefined, component, 'api_security');
  }

  logSuspiciousActivity(activity: string, userId?: string, details?: any, component?: string) {
    this.security(`Suspicious activity detected: ${activity}`, {
      type: 'suspicious_activity',
      severity: 'high',
      details: { activity, ...details }
    }, userId, undefined, component, 'security_monitoring');
  }

  logPermissionViolation(action: string, resource: string, userId?: string, details?: any, component?: string) {
    this.security(`Permission violation: Attempted ${action} on ${resource}`, {
      type: 'permission_violation',
      severity: 'high',
      details: { action, resource, ...details }
    }, userId, undefined, component, 'access_control');
  }

  logDataAccessViolation(dataType: string, accessType: string, userId?: string, details?: any, component?: string) {
    this.security(`Data access violation: Attempted ${accessType} on ${dataType}`, {
      type: 'data_access_violation',
      severity: 'critical',
      details: { dataType, accessType, ...details }
    }, userId, undefined, component, 'data_security');
  }

  // User activity logging
  logUserActivity(action: string, userId?: string, details?: any, component?: string) {
    this.info(`User activity: ${action}`, userId, details, component, 'user_activity');
  }

  // System activity logging
  logSystemActivity(action: string, details?: any, component?: string) {
    this.info(`System activity: ${action}`, undefined, details, component, 'system');
  }

  // Performance logging
  logPerformance(operation: string, durationMs: number, userId?: string, details?: any, component?: string) {
    const severity = durationMs > 1000 ? 'warn' : 'info';
    this[severity](`Performance: ${operation} took ${durationMs}ms`, userId, { ...details, durationMs }, component, 'performance');
  }

  // API request logging
  logApiRequest(method: string, url: string, statusCode: number, durationMs: number, userId?: string, details?: any) {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    this[level](
      `API ${method} ${url} - ${statusCode} (${durationMs}ms)`, 
      userId, 
      { ...details, statusCode, durationMs }, 
      'API', 
      'request'
    );
  }

  getLogs(): LogEntry[] {
    // Flush buffer before returning logs to ensure all logs are included
    this.flushBuffer();
    return [...this.logs];
  }

  getSecurityEvents(): (LogEntry & { securityEvent: SecurityEvent })[] {
    return [...this.securityEvents];
  }

  clearLogs() {
    this.logs = [];
    this.logBuffer = [];
  }

  clearSecurityEvents() {
    this.securityEvents = [];
  }

  // Export logs for debugging
  exportLogs(): string {
    // Flush buffer before exporting
    this.flushBuffer();
    return JSON.stringify({
      logs: this.logs,
      securityEvents: this.securityEvents,
      exportedAt: this.formatDate(new Date())
    }, null, 2);
  }

  // Filter logs by criteria
  filterLogs(criteria: {
    level?: LogLevel | LogLevel[],
    component?: string,
    action?: string,
    category?: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date
  }): LogEntry[] {
    // Flush buffer before filtering
    this.flushBuffer();
    
    return this.logs.filter(log => {
      if (criteria.level) {
        if (Array.isArray(criteria.level)) {
          if (!criteria.level.includes(log.level)) return false;
        } else if (log.level !== criteria.level) {
          return false;
        }
      }
      
      if (criteria.component && log.component !== criteria.component) return false;
      if (criteria.action && log.action !== criteria.action) return false;
      if (criteria.category && log.category !== criteria.category) return false;
      if (criteria.userId && log.userId !== criteria.userId) return false;
      
      if (criteria.startDate || criteria.endDate) {
        const logDate = new Date(log.timestamp);
        if (criteria.startDate && logDate < criteria.startDate) return false;
        if (criteria.endDate && logDate > criteria.endDate) return false;
      }
      
      return true;
    });
  }

  // Clean up resources
  destroy() {
    if (this.flushIntervalId !== null) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
    
    // Flush any remaining logs
    this.flushBuffer();
  }
}

export const logger = Logger.getInstance();