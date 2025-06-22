import config from '../config/app-config.json';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  userId?: string;
  data?: any;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

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

  private addLog(level: LogLevel, message: string, userId?: string, data?: any) {
    const logEntry: LogEntry = {
      timestamp: this.formatDate(new Date()),
      level,
      message,
      userId,
      data
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
          console.error(consoleMsg, data);
          break;
        case 'warn':
          console.warn(consoleMsg, data);
          break;
        case 'debug':
          console.debug(consoleMsg, data);
          break;
        default:
          console.log(consoleMsg, data);
      }
    }
  }

  info(message: string, userId?: string, data?: any) {
    this.addLog('info', message, userId, data);
  }

  warn(message: string, userId?: string, data?: any) {
    this.addLog('warn', message, userId, data);
  }

  error(message: string, userId?: string, data?: any) {
    this.addLog('error', message, userId, data);
  }

  debug(message: string, userId?: string, data?: any) {
    this.addLog('debug', message, userId, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }
}

export const logger = Logger.getInstance();