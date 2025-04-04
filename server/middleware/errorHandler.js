/**
 * Centralized Express error handling middleware.
 * 
 * @param {Error} err - The error object.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
import logger from '../logger.js'; // Import the logger

/**
 * Centralized Express error handling middleware.
 * 
 * @param {Error} err - The error object.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
const errorHandler = (err, req, res, next) => {
    // Log the error using the logger
    logger.error('Error caught by errorHandler:', {
        message: err.message,
        stack: err.stack, // Winston automatically handles stack traces for Error objects
        path: req.path,
        method: req.method,
        // You might want to add more context like user ID if available
    });

    // Determine the status code
    // Use err.statusCode if it's set (e.g., by custom error classes), otherwise default to 500
    const statusCode = err.statusCode || 500;

    // Determine the response message
    // For internal server errors (500), avoid sending detailed error messages to the client
    const message = statusCode === 500 ? 'Internal Server Error' : err.message;

    // Send the standardized error response
    res.status(statusCode).json({
        status: 'error',
        statusCode: statusCode,
        message: message,
        // Optionally include stack trace in development environment
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};

export default errorHandler;

// Example of a custom error class (optional but useful)
// export class AppError extends Error {
//     constructor(message, statusCode) {
//         super(message);
//         this.statusCode = statusCode;
//         this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
//         this.isOperational = true; // Flag for operational errors vs programming errors
//         Error.captureStackTrace(this, this.constructor);
//     }
// }
