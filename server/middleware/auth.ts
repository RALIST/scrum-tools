import type { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload, type VerifyErrors } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // Should be in env variables

// Define the structure of your JWT payload
interface UserPayload extends JwtPayload {
    userId: string;
    email: string;
}

// Extend the Express Request interface to include the 'user' property
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: UserPayload | null; // User can be UserPayload or null (for optional auth)
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token: string | undefined = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return; // Explicitly return void after sending response
  }
  
  // Remove the redundant try...catch block
    // Type the callback for jwt.verify
    jwt.verify(token, JWT_SECRET, (err: VerifyErrors | null, decoded: string | JwtPayload | undefined) => {
        if (err) {
            // Send response and stop execution
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }
        // Type assertion after verifying the payload structure if necessary
        req.user = decoded as UserPayload;
        next();
        return;
    });
  // Error handling is inside the jwt.verify callback
};

// Optional middleware to make authentication optional
export const optionalAuthenticateToken = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token: string | undefined = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    req.user = null;
    next();
    return;
  }

  try {
    // Type the callback for jwt.verify
    jwt.verify(token, JWT_SECRET, (err: VerifyErrors | null, decoded: string | JwtPayload | undefined) => {
        if (err) {
            // If token is invalid in optional auth, just set user to null and proceed
            req.user = null;
            next();
            return;
        }
        // Type assertion after verifying the payload structure if necessary
        req.user = decoded as UserPayload;
        next();
    });
  } catch {
    // Error handling is now inside the jwt.verify callback
    req.user = null;
    next();
  }
};
