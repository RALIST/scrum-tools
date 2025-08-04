// src/utils/logger.ts
/**
 * Centralized logging utility for the application
 * Provides environment-based log level controls and structured logging
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStructuredLogs: boolean;
  prefix?: string;
}

class Logger {
  public config: LogConfig; // Make config public for development tools access

  constructor(config: Partial<LogConfig> = {}) {
    // Default configuration based on environment
    const isDev = import.meta.env.DEV;

    this.config = {
      level: isDev ? LogLevel.DEBUG : LogLevel.WARN,
      enableConsole: true,
      enableStructuredLogs: isDev,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level && this.config.enableConsole;
  }

  private formatMessage(level: string, message: string, prefix?: string): string {
    const timestamp = new Date().toISOString();
    const logPrefix = prefix ? `[${prefix}]` : '';
    return `${timestamp} ${level} ${logPrefix} ${message}`;
  }

  private logToConsole(level: LogLevel, message: string, data?: any, prefix?: string): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(
      LogLevel[level],
      message,
      prefix || this.config.prefix
    );

    const logMethod = this.getConsoleMethod(level);

    if (data !== undefined) {
      if (this.config.enableStructuredLogs) {
        logMethod(formattedMessage, data);
      } else {
        logMethod(formattedMessage);
      }
    } else {
      logMethod(formattedMessage);
    }
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.ERROR:
        return console.error;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
      default:
        return console.log;
    }
  }

  error(message: string, data?: any): void {
    this.logToConsole(LogLevel.ERROR, message, data);
  }

  warn(message: string, data?: any): void {
    this.logToConsole(LogLevel.WARN, message, data);
  }

  info(message: string, data?: any): void {
    this.logToConsole(LogLevel.INFO, message, data);
  }

  debug(message: string, data?: any): void {
    this.logToConsole(LogLevel.DEBUG, message, data);
  }

  trace(message: string, data?: any): void {
    this.logToConsole(LogLevel.TRACE, message, data);
  }

  // Create a child logger with a specific prefix
  createChild(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    });
  }

  // Update log level at runtime
  setLogLevel(level: LogLevel): void {
    this.config.level = level;
  }

  // Enable/disable console logging
  setConsoleEnabled(enabled: boolean): void {
    this.config.enableConsole = enabled;
  }
}

// Create default logger instance
export const logger = new Logger();

// Convenience function for creating component/hook-specific loggers
export const createLogger = (prefix: string): Logger => {
  return logger.createChild(prefix);
};

// Socket-specific logger for consistent debugging
export const createSocketLogger = (namespace: string): Logger => {
  return createLogger(`Socket:${namespace}`);
};

// Hook-specific logger for React hooks
export const createHookLogger = (hookName: string): Logger => {
  return createLogger(`Hook:${hookName}`);
};
