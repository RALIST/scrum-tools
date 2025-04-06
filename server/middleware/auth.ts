import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload, VerifyErrors } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // Should be in env variables

// Define the structure of your JWT payload
interface UserPayload extends JwtPayload {
    userId: string;
    // Add other properties expected in your token payload (e.g., email, role)
}

// Extend the Express Request interface to include the 'user' property
declare global {
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
            // Use return to stop execution after sending response
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        // Type assertion after verifying the payload structure if necessary
        req.user = decoded as UserPayload;
        next();
    });
  // Error handling is inside the jwt.verify callback
};

// Optional middleware to make authentication optional
export const optionalAuthenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token: string | undefined = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    req.user = null;
    return next();
  }
  
  try {
    // Type the callback for jwt.verify
    jwt.verify(token, JWT_SECRET, (err: VerifyErrors | null, decoded: string | JwtPayload | undefined) => {
        if (err) {
            // If token is invalid in optional auth, just set user to null and proceed
            req.user = null;
            return next();
        }
        // Type assertion after verifying the payload structure if necessary
        req.user = decoded as UserPayload;
        next();
    });
  } catch (error) {
    // Error handling is now inside the jwt.verify callback
  }
};
