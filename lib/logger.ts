/**
 * Simple Logger Utility
 * 
 * Provides structured logging with log levels.
 * Can be extended to send logs to external services (e.g., Sentry, Datadog).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

// Log level priority (higher = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level based on environment
function getMinLogLevel(): LogLevel {
  if (process.env.NODE_ENV === 'production') {
    return 'info';
  }
  return process.env.LOG_LEVEL as LogLevel || 'debug';
}

function shouldLog(level: LogLevel): boolean {
  const minLevel = getMinLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function formatLogEntry(entry: LogEntry): string {
  const { level, message, timestamp, context } = entry;
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

function createLogEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const entry = createLogEntry(level, message, context);
  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }

  // Hook for external logging service (future extension)
  // sendToExternalService(entry);
}

// ============================================
// Public Logger API
// ============================================

export const logger = {
  /**
   * Debug level - detailed information for debugging
   * Only shown in development by default
   */
  debug(message: string, context?: LogContext): void {
    log('debug', message, context);
  },

  /**
   * Info level - general operational information
   */
  info(message: string, context?: LogContext): void {
    log('info', message, context);
  },

  /**
   * Warn level - warning conditions that should be reviewed
   */
  warn(message: string, context?: LogContext): void {
    log('warn', message, context);
  },

  /**
   * Error level - error conditions that need attention
   */
  error(message: string, context?: LogContext): void {
    log('error', message, context);
  },

  /**
   * Log an error with stack trace
   */
  exception(message: string, error: unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    log('error', message, errorContext);
  },

  /**
   * Log API request (useful for debugging)
   */
  request(method: string, path: string, context?: LogContext): void {
    log('info', `${method} ${path}`, context);
  },

  /**
   * Log API response
   */
  response(method: string, path: string, status: number, durationMs?: number): void {
    const context: LogContext = { status };
    if (durationMs !== undefined) {
      context.durationMs = durationMs;
    }
    log('info', `${method} ${path} -> ${status}`, context);
  },
};

export default logger;
