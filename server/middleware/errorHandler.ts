import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

/**
 * Centralized Express error handling middleware.
 */
const errorHandler: ErrorRequestHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {

    // Determine the status code
    // Use err.statusCode if it's set (e.g., by custom error classes), otherwise default to 500
    // Check if statusCode exists and is a number, otherwise default to 500
    const statusCode: number = typeof err.statusCode === 'number' ? err.statusCode : 500;

    // Determine the response message
    // For internal server errors (500), avoid sending detailed error messages to the client
    // Ensure err.message exists, otherwise provide a default
    const message: string = statusCode === 500 ? 'Internal Server Error' : (err.message || 'An unexpected error occurred');

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
