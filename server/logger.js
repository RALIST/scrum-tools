import winston from 'winston';

const { combine, timestamp, printf, colorize, align } = winston.format;

// Define the log format
const logFormat = printf(({ level, message, timestamp: ts, stack, ...metadata }) => {
  let msg = `${ts} [${level}]: ${message}`;
  // Include metadata if present
  if (metadata && Object.keys(metadata).length > 0) {
    // Avoid logging the 'level', 'message', 'timestamp' properties from metadata itself
    const metaString = JSON.stringify(metadata, (key, value) => {
        if (key === 'level' || key === 'message' || key === 'timestamp') {
            return undefined; // Exclude these properties
        }
        return value;
    }, 2); // Indent for readability
    if (metaString !== '{}') {
        msg += ` ${metaString}`;
    }
  }
  // Include stack trace for errors
  if (stack) {
    msg += `\n${stack}`;
  }
  return msg;
});

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Default to 'info', can be configured via env var
  format: combine(
    colorize(), // Add colors to the output
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add timestamp
    align(), // Align log messages
    logFormat // Apply the custom format
  ),
  transports: [
    new winston.transports.Console(),
    // Optionally add file transport for production
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'combined.log' }),
  ],
  exceptionHandlers: [
    // Log unhandled exceptions to the console and optionally to a file
    new winston.transports.Console(),
    // new winston.transports.File({ filename: 'exceptions.log' })
  ],
  rejectionHandlers: [
    // Log unhandled promise rejections
    new winston.transports.Console(),
    // new winston.transports.File({ filename: 'rejections.log' })
  ]
});

export default logger;
